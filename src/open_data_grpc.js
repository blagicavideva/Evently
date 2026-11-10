const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, 'evently.proto');
const GRPC_ADDRESS = process.env.GRPC_ADDRESS || '127.0.0.1:50051';
const definition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const evently = grpc.loadPackageDefinition(definition).evently;

function createHandlers(loadDataset) {
  let cachedDataset;
  let cachedAt = 0;
  let pendingDataset;
  async function getDataset() {
    if (cachedDataset && Date.now() - cachedAt < 5 * 60 * 1000) return cachedDataset;
    if (!pendingDataset) {
      pendingDataset = loadDataset().then(value => {
        cachedDataset = value;
        cachedAt = Date.now();
        return value;
      }).finally(() => { pendingDataset = null; });
    }
    return pendingDataset;
  }

  async function datasetResponse() {
    const dataset = await getDataset();
    return {
      title: dataset.title,
      years: dataset.years,
      measures: dataset.measures,
      rows: dataset.rows.map(row => ({
        type: row.vrsta,
        typeIndex: row.vrstaIndex,
        measure: row.meritev,
        values: dataset.years.map(year => ({
          year,
          hasValue: row.poLetih[year] !== null && row.poLetih[year] !== undefined,
          value: row.poLetih[year] ?? 0,
        })),
      })),
      liveSource: dataset.zivVir,
      refreshedAt: dataset.osvezeno,
      sourceUrl: dataset.sourceUrl,
      pcAxisUrl: dataset.pxUrl,
      warning: dataset.opozorilo || '',
    };
  }

  async function chartResponse(request) {
    const dataset = await getDataset();
    const measureIndex = Number(request.measureIndex);
    if (!Number.isInteger(measureIndex) || measureIndex < 0 || measureIndex >= dataset.measures.length) {
      throw Object.assign(new Error('Izbrana meritev ne obstaja.'), { code: grpc.status.INVALID_ARGUMENT });
    }
    const measure = dataset.measures[measureIndex];
    const year = dataset.years.at(-1);
    const showAll = request.scope === 'all';
    const rows = dataset.rows
      .filter(row => row.meritev === measure)
      .filter(row => row.vrstaIndex !== 0 && (showAll || row.vrstaIndex <= dataset.glasbeneVrste.length))
      .map(row => ({ type: row.vrsta, value: row.poLetih[year] }))
      .filter(row => row.value !== null && row.value !== undefined)
      .sort((a, b) => b.value - a.value);
    return {
      measure,
      year,
      total: rows.reduce((sum, row) => sum + row.value, 0),
      rows,
    };
  }

  return {
    getDataset: (call, callback) => datasetResponse().then(value => callback(null, value), callback),
    getMeasures: (call, callback) => getDataset()
      .then(value => callback(null, { measures: value.measures }), callback),
    getChartData: (call, callback) => chartResponse(call.request)
      .then(value => callback(null, value), callback),
    streamChartData: (call) => {
      chartResponse(call.request).then(result => {
        for (const row of result.rows) {
          call.write({ measure: result.measure, year: result.year, total: result.total, ...row });
        }
        call.end();
      }).catch(error => call.destroy(error));
    },
  };
}

function startGrpc(loadDataset) {
  const server = new grpc.Server();
  server.addService(evently.EventlyData.service, createHandlers(loadDataset));
  return new Promise((resolve, reject) => {
    server.bindAsync(GRPC_ADDRESS, grpc.ServerCredentials.createInsecure(), error => {
      if (error) return reject(error);
      const client = new evently.EventlyData(GRPC_ADDRESS, grpc.credentials.createInsecure());
      resolve({ server, client });
    });
  });
}

module.exports = { startGrpc };
