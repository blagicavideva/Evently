const fs = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const PX_URL = 'https://pxweb.stat.si/SiStatData/Resources/PX/Databases/Data/1080712S.PX';
const OPSI_URL = 'https://podatki.gov.si/dataset/surs1080712s';
const PX_FILE = path.join(ROOT, 'data', 'prireditve_obiskovalci.px');
const PUBLIC_DIR = path.join(ROOT, 'public');

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
  if (url.pathname === '/api/prireditve') {
    try {
      const data = await loadDataset();
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: `Branje PC-Axis podatkov ni uspelo: ${error.message}` }));
    }
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

server.listen(PORT, () => console.log(`Evently odprti podatki: http://localhost:${PORT}`));
