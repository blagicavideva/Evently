const canvas = document.querySelector('#chart');
const measureSelect = document.querySelector('#measure');
const scopeSelect = document.querySelector('#scope');
const statusEl = document.querySelector('#status');
const emptyEl = document.querySelector('#empty');
const nf = new Intl.NumberFormat('sl-SI');
let dataset;
let chart;

function selectedMeasure() {
  return Number(measureSelect.value || 0);
}

function render() {
  if (!dataset) return;
  const measureIndex = selectedMeasure();
  const measure = dataset.measures[measureIndex];
  const year = dataset.years.at(-1);
  const showAll = scopeSelect.value === 'all';
  const rows = dataset.rows
    .filter(row => row.meritev === measure)
    .filter(row => row.vrstaIndex !== 0 && (showAll || row.vrstaIndex <= dataset.glasbeneVrste.length))
    .map(row => ({ label: row.vrsta, value: row.poLetih[year] }))
    .filter(row => row.value !== null && row.value !== undefined)
    .sort((a, b) => b.value - a.value);

  document.querySelector('#legend-label').textContent = measure;
  document.querySelector('#summary-label').textContent = measure;
  document.querySelector('#summary-year').textContent = year;
  document.querySelector('#summary-total').textContent = nf.format(rows.reduce((sum, row) => sum + row.value, 0));
  emptyEl.hidden = rows.length > 0;
  canvas.hidden = rows.length === 0;
  chart?.destroy();
  if (!rows.length) return;
  canvas.style.height = `${Math.max(280, rows.length * 34)}px`;
  canvas.setAttribute('aria-label', `${measure} ${showAll ? 'po vrstah prireditev' : 'po glasbenih zvrsteh'} v Sloveniji, ${year}`);
  chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map(row => row.label),
      datasets: [{
        label: measure,
        data: rows.map(row => row.value),
        backgroundColor: '#93edc2',
        hoverBackgroundColor: '#c0a7ff',
        borderRadius: 5,
        barThickness: 18,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: context => `${measure}: ${nf.format(context.parsed.x)}` } },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(207,220,240,.10)' },
          ticks: { color: '#91a0b7', callback: value => nf.format(value) },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#cbd4e1', font: { family: 'DM Sans', size: 11 } },
        },
      },
    },
  });
}

async function load() {
  try {
    const response = await fetch('/api/prireditve', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Napaka ${response.status}`);
    dataset = data;
    measureSelect.replaceChildren(...dataset.measures.map((measure, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = measure;
      return option;
    }));
    measureSelect.disabled = false;
    measureSelect.addEventListener('change', render);
    scopeSelect.addEventListener('change', render);
    document.querySelector('#source-link').href = dataset.sourceUrl;
    document.querySelector('#updated').textContent = dataset.zivVir
      ? `Osveženo ob ${new Date(dataset.osvezeno).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`
      : 'Prikazana je lokalna kopija PC-Axis';
    statusEl.textContent = dataset.zivVir ? 'Podatki so osveženi ob nalaganju.' : dataset.opozorilo;
    statusEl.classList.toggle('status-warning', !dataset.zivVir);
    render();
  } catch (error) {
    statusEl.textContent = `Podatkov ni bilo mogoče naložiti: ${error.message}`;
    statusEl.classList.add('status-warning');
  }
}

load();
