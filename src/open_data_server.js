const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

function loadLocalEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  let contents;
  try {
    contents = fsSync.readFileSync(envPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    process.env[match[1]] = value;
  }
}

loadLocalEnv();

const { generateActivitySuggestions } = require('./llm');
const { startGrpc } = require('./open_data_grpc');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const PX_URL = 'https://pxweb.stat.si/SiStatData/Resources/PX/Databases/Data/1080712S.PX';
const OPSI_URL = 'https://podatki.gov.si/dataset/surs1080712s';
const PX_FILE = path.join(ROOT, 'data', 'prireditve_obiskovalci.px');
const PUBLIC_DIR = path.join(ROOT, 'public');
let grpcClient;

function readPxValues(text, variable) {
  const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`VALUES\\("${escaped}"\\)\\s*=([\\s\\S]*?);`, 'i'));
  if (!match) throw new Error(`PC-Axis spremenljivka ${variable} manjka.`);
  return [...match[1].matchAll(/"((?:[^"]|"")*)"/g)].map(item => item[1].replace(/""/g, '"'));
}

function parsePx(text) {
  const types = readPxValues(text, 'VRSTA PRIREDITVE');
  const measures = readPxValues(text, 'MERITVE');
  const years = readPxValues(text, 'LETO');
  const dataMatch = text.match(/(?:^|\n)DATA\s*=([\s\S]*?);/i);
  if (!dataMatch) throw new Error('PC-Axis datoteka nima podatkovnega bloka DATA.');
  const values = dataMatch[1].trim().split(/\s+/).map(value => {
    if (/^-?\d+(?:[.,]\d+)?$/.test(value)) return Number(value.replace(',', '.'));
    return null;
  });

  const yearCount = years.length;
  const measureCount = measures.length;
  const typeCount = types.length;
  if (!typeCount || !measureCount || !yearCount || values.length < typeCount * measureCount * yearCount) {
    throw new Error('Podatki v PC-Axis datoteki nimajo pričakovane oblike.');
  }

  const rows = [];
  for (let typeIndex = 0; typeIndex < typeCount; typeIndex += 1) {
    for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
      const byYear = {};
      for (let yearIndex = 0; yearIndex < yearCount; yearIndex += 1) {
        const index = typeIndex * measureCount * yearCount + measureIndex * yearCount + yearIndex;
        byYear[years[yearIndex]] = values[index];
      }
      rows.push({ vrsta: types[typeIndex], vrstaIndex: typeIndex, meritev: measures[measureIndex], poLetih: byYear });
    }
  }

  const title = text.match(/DESCRIPTION="([^"]+)"/)?.[1] || 'Prireditve in obiskovalci';
  const updated = text.match(/LAST-UPDATED="([^"]+)"/)?.[1] || null;
  return { title, years, measures, rows, glasbeneVrste: types.slice(1, 11), updated, sourceUrl: OPSI_URL, pxUrl: PX_URL };
}

async function loadDataset() {
  try {
    const bytes = await downloadPx();
    const text = new TextDecoder('windows-1250').decode(bytes);
    const dataset = parsePx(text);
    dataset.osvezeno = new Date().toISOString();
    dataset.zivVir = true;
    return dataset;
  } catch (error) {
    const bytes = await fs.readFile(PX_FILE);
    const text = new TextDecoder('windows-1250').decode(bytes);
    const dataset = parsePx(text);
    dataset.osvezeno = new Date().toISOString();
    dataset.zivVir = false;
    dataset.opozorilo = `Trenutno ni bilo mogoče osvežiti podatkov s SURS-a; prikazana je priložena kopija PC-Axis. (${error.message})`;
    return dataset;
  }
}

function downloadPx() {
  return new Promise((resolve, reject) => {
    const request = https.get(PX_URL, { headers: { 'User-Agent': 'Evently-open-data-course-project' } }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`SURS je vrnil HTTP ${response.statusCode}.`));
        return;
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(12000, () => request.destroy(new Error('Povezava s SURS-om je potekla.')));
    request.on('error', reject);
  });
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/') && !grpcClient) {
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'gRPC storitev se še zaganja.' }));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/ideas') {
    try {
      const input = await readJsonBody(request);
      const result = await generateActivitySuggestions(input);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(result));
    } catch (error) {
      const status = error.statusCode || 400;
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (url.pathname === '/api/prireditve') {
    try {
      const grpcData = await grpcUnary('getDataset', {});
      const data = fromGrpcDataset(grpcData);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: `Pridobivanje podatkov prek gRPC ni uspelo: ${error.message}` }));
    }
    return;
  }

  if (url.pathname === '/api/measures') {
    try {
      const data = await grpcUnary('getMeasures', {});
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (url.pathname === '/api/chart-data') {
    try {
      const data = await grpcUnary('getChartData', chartRequest(url));
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (url.pathname === '/api/chart-stream') {
    const call = grpcClient.streamChartData(chartRequest(url));
    let headersSent = false;
    call.on('data', row => {
      if (!headersSent) {
        response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        headersSent = true;
      }
      response.write(`${JSON.stringify(row)}\n`);
    });
    call.on('error', error => {
      if (!headersSent) {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: error.message }));
      } else response.end();
    });
    call.on('end', () => {
      if (!headersSent) response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end();
    });
    response.on('close', () => {
      if (!response.writableEnded) call.cancel();
    });
    return;
  }

  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const target = path.resolve(PUBLIC_DIR, relative);
  if (!target.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  try {
    const body = await fs.readFile(target);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 12000) {
        reject(Object.assign(new Error('Vnos je predolg.'), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Poslan obrazec ni veljaven JSON.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function grpcUnary(method, payload) {
  return new Promise((resolve, reject) => grpcClient[method](payload, (error, result) => error ? reject(error) : resolve(result)));
}

function chartRequest(url) {
  return { measureIndex: Number(url.searchParams.get('measureIndex') || 0), scope: url.searchParams.get('scope') || 'music' };
}

function fromGrpcDataset(data) {
  const rows = data.rows.map(row => ({
    vrsta: row.type,
    vrstaIndex: row.typeIndex,
    meritev: row.measure,
    poLetih: Object.fromEntries(row.values.map(item => [item.year, item.hasValue ? item.value : null])),
  }));
  return {
    title: data.title,
    years: data.years,
    measures: data.measures,
    rows,
    glasbeneVrste: [...new Set(rows.filter(row => row.vrstaIndex > 0).map(row => row.vrsta))].slice(0, 10),
    updated: null,
    sourceUrl: data.sourceUrl,
    pxUrl: data.pcAxisUrl,
    osvezeno: data.refreshedAt,
    zivVir: data.liveSource,
    ...(data.warning ? { opozorilo: data.warning } : {}),
  };
}

startGrpc(loadDataset).then(({ client }) => {
  grpcClient = client;
  server.listen(PORT, () => console.log(`Evently: http://localhost:${PORT} · gRPC posluša na 127.0.0.1:50051`));
}).catch(error => {
  console.error(`Zagon gRPC strežnika ni uspel: ${error.message}`);
  process.exitCode = 1;
});
