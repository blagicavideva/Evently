const canvas = document.querySelector('#chart');
const measureSelect = document.querySelector('#measure');
const scopeSelect = document.querySelector('#scope');
const statusEl = document.querySelector('#status');
const emptyEl = document.querySelector('#empty');
const plannerForm = document.querySelector('#planner-form');
const plannerStatus = document.querySelector('#planner-status');
const suggestionsEl = document.querySelector('#suggestions');
const nf = new Intl.NumberFormat('sl-SI');
let dataset;
let chart;

const localDate = new Date();
const dateInput = document.querySelector('#event-date');
dateInput.min = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
dateInput.value = dateInput.min;

plannerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#planner-submit');
  button.disabled = true;
  plannerStatus.textContent = 'Pripravljam predloge …';
  suggestionsEl.hidden = true;
  suggestionsEl.replaceChildren();
  const form = new FormData(plannerForm);
  try {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Napaka ${response.status}`);
    renderSuggestions(result);
    plannerStatus.textContent = `Pripravljenih predlogov: ${result.predlogi.length} · ${result.lokacija} · ${result.datum}`;
  } catch (error) {
    plannerStatus.textContent = error.message;
    plannerStatus.classList.add('status-warning');
  } finally {
    button.disabled = false;
  }
});

function renderSuggestions(result) {
  const heading = document.createElement('h3');
  heading.textContent = `${result.vrstaDogodka} v ${result.lokacija}`;
  const cards = result.predlogi.map((idea, index) => {
    const card = document.createElement('article');
    card.className = 'suggestion-card';
    const number = document.createElement('span');
    number.className = 'suggestion-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('h4');
    title.textContent = idea.naslov;
    const description = document.createElement('p');
    description.textContent = idea.opis;
    const meta = document.createElement('span');
    meta.className = 'suggestion-meta';
    meta.textContent = `${idea.trajanje_min} min · ${idea.okolje}`;
    card.append(number, title, description, meta);
    return card;
  });
  const note = document.createElement('p');
  note.className = 'suggestion-note';
  note.textContent = result.opomba;
  suggestionsEl.append(heading, ...cards, note);
  suggestionsEl.hidden = false;
}

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
        backgroundColor: '#c9afe3',
        hoverBackgroundColor: '#b995d5',
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
          grid: { color: 'rgba(103,78,120,.13)' },
          ticks: { color: '#83738e', callback: value => nf.format(value) },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#655570', font: { family: 'DM Sans', size: 11 } },
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
