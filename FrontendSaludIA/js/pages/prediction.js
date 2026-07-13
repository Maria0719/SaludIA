import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import {
  MUNICIPALITIES,
  predictionSeries,
  riskLevel,
  weeklyDetailSeries,
  departmentMunicipalities,
  findingsSummary,
} from "../data.js";

renderLayout();

let Chart = null;
try {
  const chartModule = await import("https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm");
  Chart = chartModule.default;
} catch {
  Chart = null;
}

// Read municipality / disease from the URL so clicking a department elsewhere
// (map or data explorer) deep-links straight into its weekly prediction.
const params = new URLSearchParams(window.location.search);
const urlMun = params.get("mun");
const urlDisease = params.get("disease");
const validMun = MUNICIPALITIES.find((m) => m.name === urlMun);

const state = {
  mun: validMun ? validMun.name : "Cali",
  disease: urlDisease === "Malaria" ? "Malaria" : "Dengue",
};

const munOptions = MUNICIPALITIES.map(
  (m) =>
    `<option value="${m.name}"${m.name === state.mun ? " selected" : ""}>${m.dep} — ${m.name}</option>`,
).join("");

const root = document.getElementById("pred-root");
root.innerHTML = `
  <div class="toolbar toolbar--stack">
    <div>
      <h1 class="page-title">Predicción Semanal</h1>
      <p class="page-subtitle">Estimación de riesgo a 1 semana de anticipación</p>
    </div>
    <div class="pred-filters">
      <label class="pred-filters__field pred-filters__field--dep">
        <span class="pred-filters__label">${icon("map", "", 18)} Departamento / Municipio</span>
        <select class="select select--lg" id="p-mun">${munOptions}</select>
      </label>
      <label class="pred-filters__field">
        <span class="pred-filters__label">Enfermedad</span>
        <select class="select select--lg" id="p-disease">
          <option value="Dengue"${state.disease === "Dengue" ? " selected" : ""}>Dengue</option>
          <option value="Malaria"${state.disease === "Malaria" ? " selected" : ""}>Malaria</option>
        </select>
      </label>
    </div>
  </div>

  <div class="pred-grid">
    <div class="card pred-card">
      <div class="flex items-center gap-2 muted" style="margin-bottom:16px;font-weight:700">
        ${icon("calendarClock", "", 20)} <span id="next-title">Próxima Semana</span>
      </div>
      <div class="pred-gauge" id="gauge"></div>
    </div>

    <div class="card" style="padding:24px" >
      <h2 class="flex items-center gap-2" style="font-weight:700;margin:0 0 24px">
        ${icon("target", "", 20).replace('stroke="currentColor"', 'stroke="#0d9488"')} Histórico vs. Predicción
      </h2>
      <div class="chart-box"><canvas id="pred-chart"></canvas></div>
    </div>
  </div>

  <div class="note-box">
    ${icon("alertCircle", "", 24)}
    <div>
      <p style="font-weight:600;color:var(--text);margin:0 0 4px">Acerca del modelo predictivo</p>
      <p style="margin:0;line-height:1.6">
        El modelo utiliza datos históricos de 2018, 2019 y 2021 (excluyendo 2020 por anomalías
        de reporte durante la pandemia de COVID-19). La precisión de la predicción varía según
        la disponibilidad local de variables ambientales. Los intervalos de confianza son más
        amplios en municipios con subregistro histórico.
      </p>
    </div>
  </div>

  <section class="detail-section">
    <div class="detail-section__head">
      <h2 class="flex items-center gap-2" style="font-weight:800;margin:0">
        ${icon("activity", "", 22).replace('stroke="currentColor"', 'stroke="#0d9488"')}
        Variables del municipio <span id="detail-mun" class="detail-mun"></span>
      </h2>
      <p class="page-subtitle" style="margin:4px 0 0">
        Evolución semanal de las variables clave que alimentan el modelo (año 2021)
      </p>
    </div>

    <div class="detail-grid">
      <div class="card detail-card">
        <div class="detail-card__title">${icon("activity", "", 18)} Cambios en Temperatura (°C)</div>
        <div class="chart-box chart-box--sm"><canvas id="chart-temp"></canvas></div>
      </div>
      <div class="card detail-card">
        <div class="detail-card__title">${icon("activity", "", 18)} Precipitaciones (mm)</div>
        <div class="chart-box chart-box--sm"><canvas id="chart-precip"></canvas></div>
      </div>
      <div class="card detail-card">
        <div class="detail-card__title">${icon("activity", "", 18)} Casos reportados</div>
        <div class="chart-box chart-box--sm"><canvas id="chart-cases"></canvas></div>
      </div>
      <div class="card detail-card">
        <div class="detail-card__title">${icon("database", "", 18)} Población por municipio (departamento)</div>
        <div class="chart-box chart-box--sm"><canvas id="chart-pop"></canvas></div>
      </div>
    </div>
  </section>

  <section class="detail-section">
    <div class="card findings-card">
      <h2 class="flex items-center gap-2" style="font-weight:800;margin:0 0 6px">
        ${icon("info", "", 22).replace('stroke="currentColor"', 'stroke="#0d9488"')}
        Resumen de hallazgos y posibles causas
      </h2>
      <div id="findings"></div>
    </div>
  </section>
`;

const gaugeLabels = { high: "Alta", moderate: "Media", low: "Baja" };
let chart;
const detailCharts = {};

const TEAL = "#14b8a6";
const AMBER = "#f59e0b";
const ROSE = "#e11d48";
const SLATE = "#334155";

function makeLineChart(id, labels, data, label, color, fill = true) {
  if (!Chart) {
    const container = document.getElementById(id)?.parentElement;
    if (container) {
      container.innerHTML = '<div class="chart-fallback">Gráficos no disponibles</div>';
    }
    return;
  }
  if (detailCharts[id]) detailCharts[id].destroy();
  const ctx = document.getElementById(id);
  detailCharts[id] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: fill ? color + "22" : color,
          borderWidth: 2.5,
          fill,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: { padding: 10, cornerRadius: 12, backgroundColor: "#1e293b" },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8", font: { size: 10 }, maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          ticks: { color: "#94a3b8", font: { size: 11 } },
        },
      },
    },
  });
}

function renderDetail() {
  const { mun, disease } = state;
  document.getElementById("detail-mun").textContent = `· ${mun}`;

  const { rows } = weeklyDetailSeries(mun, disease);
  const weekLabels = rows.map((r) => `S${r.week}`);

  makeLineChart("chart-temp", weekLabels, rows.map((r) => r.temp), "Temperatura (°C)", AMBER);
  makeLineChart("chart-precip", weekLabels, rows.map((r) => r.precip), "Precipitación (mm)", TEAL);
  makeLineChart("chart-cases", weekLabels, rows.map((r) => r.cases), "Casos", ROSE);

  // Population comparison across municipalities in the same department.
  const munObj = MUNICIPALITIES.find((m) => m.name === mun);
  const peers = departmentMunicipalities(munObj.dep);
  if (!Chart) {
    const popContainer = document.getElementById("chart-pop")?.parentElement;
    if (popContainer) {
      popContainer.innerHTML = '<div class="chart-fallback">Gráficos no disponibles</div>';
    }
    renderFindings();
    return;
  }
  if (detailCharts["chart-pop"]) detailCharts["chart-pop"].destroy();
  detailCharts["chart-pop"] = new Chart(document.getElementById("chart-pop"), {
    type: "bar",
    data: {
      labels: peers.map((m) => m.name),
      datasets: [
        {
          label: "Población",
          data: peers.map((m) => m.pop),
          backgroundColor: peers.map((m) => (m.name === mun ? TEAL : "#cbd5e1")),
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          cornerRadius: 12,
          backgroundColor: "#1e293b",
          callbacks: {
            label: (c) => ` ${c.parsed.y.toLocaleString("es-CO")} hab.`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 10 } } },
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          ticks: {
            color: "#94a3b8",
            font: { size: 11 },
            callback: (v) => (v >= 1000000 ? v / 1000000 + "M" : v / 1000 + "k"),
          },
        },
      },
    },
  });

  renderFindings();
}

function renderFindings() {
  const { mun, disease } = state;
  const f = findingsSummary(mun, disease);
  const riskClass = f.risk === "high" ? "high" : f.risk === "moderate" ? "moderate" : "low";

  document.getElementById("findings").innerHTML = `
    <p class="findings-lead">
      Durante 2021, <strong>${mun}</strong> (${f.mun.dep}) registró un total de
      <strong>${f.totalCases.toLocaleString("es-CO")}</strong> casos de ${disease}, con un pico en la
      <strong>semana ${f.peakWeek}</strong> (${f.peakCases} casos, tasa de ${f.peakRate} x100k hab.).
      El modelo proyecta un nivel de contagio
      <span class="findings-badge findings-badge--${riskClass}">${f.riskLabel}</span>
      para la próxima semana (${f.nextPred} casos / 100k hab.).
    </p>

    <div class="findings-stats">
      <div class="findings-stat">
        <span class="findings-stat__num">${f.avgTemp}°C</span>
        <span class="findings-stat__lbl">Temperatura media</span>
      </div>
      <div class="findings-stat">
        <span class="findings-stat__num">${f.avgPrecip} mm</span>
        <span class="findings-stat__lbl">Precipitación media</span>
      </div>
      <div class="findings-stat">
        <span class="findings-stat__num">${(f.endem * 100).toFixed(0)}%</span>
        <span class="findings-stat__lbl">Endemicidad</span>
      </div>
      <div class="findings-stat">
        <span class="findings-stat__num">r=${f.corrPrecip}</span>
        <span class="findings-stat__lbl">Correlación lluvia-casos</span>
      </div>
    </div>

    <p class="findings-subtitle">Posibles causas del nivel de contagio</p>
    <ul class="findings-list">
      ${f.causes.map((c) => `<li>${icon("chevronRight", "", 16)}<span>${c}</span></li>`).join("")}
    </ul>
  `;
}

function render() {
  const { mun, disease } = state;
  const { rows, nextWeek, nextPred } = predictionSeries(mun, disease);
  const risk = riskLevel(nextPred);

  document.getElementById("next-title").textContent = `Próxima Semana (Sem ${nextWeek})`;
  document.getElementById("gauge").innerHTML = `
    <div class="pred-gauge__circle pred-gauge__circle--${risk}">${gaugeLabels[risk] || "—"}</div>
    <h3 style="font-size:1.25rem;font-weight:700;margin:0 0 4px">Probabilidad de Brote</h3>
    <p class="muted" style="margin:0">Tasa estimada: ${nextPred} casos / 100k hab.</p>
  `;

  const labels = rows.map((r) => r.week);
  const actual = rows.map((r) => r.actual);
  const predicted = rows.map((r) => r.predicted);

  if (!Chart) {
    const predContainer = document.getElementById("pred-chart")?.parentElement;
    if (predContainer) {
      predContainer.innerHTML = '<div class="chart-fallback">Gráficos no disponibles</div>';
    }
    renderDetail();
    return;
  }

  if (chart) chart.destroy();
  const ctx = document.getElementById("pred-chart");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Casos Reales",
          data: actual,
          borderColor: "#0f172a",
          backgroundColor: "#0f172a",
          borderWidth: 3,
          spanGaps: false,
          tension: 0.35,
          pointRadius: 4,
        },
        {
          label: "Predicción del Modelo",
          data: predicted,
          borderColor: "#14b8a6",
          backgroundColor: "#14b8a6",
          borderWidth: 3,
          borderDash: [6, 6],
          tension: 0.35,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyle: "circle", font: { size: 12 } } },
        tooltip: {
          padding: 10,
          cornerRadius: 12,
          backgroundColor: "#1e293b",
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 12 } } },
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          ticks: { color: "#94a3b8", font: { size: 12 } },
        },
      },
    },
  });

  renderDetail();
}

document.getElementById("p-mun").addEventListener("change", (e) => {
  state.mun = e.target.value;
  render();
});
document.getElementById("p-disease").addEventListener("change", (e) => {
  state.disease = e.target.value;
  render();
});

render();
