import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import { MUNICIPALITIES, incidenceRate, riskLevel, ranking, riskCounts } from "../data.js";

renderLayout();

const state = { disease: "Dengue", year: "2021", week: 24 };

const root = document.getElementById("dash-root");
root.innerHTML = `
  <div class="dash__head">
    <div>
      <h1 class="page-title">Índice de Riesgo</h1>
      <p class="page-subtitle">Vista general del país por municipio</p>
    </div>
    <div class="filter-bar">
      <span class="filter-bar__label">${icon("sliders", "", 16)} Filtros:</span>
      <select class="select" id="f-disease">
        <option value="Dengue">Dengue</option>
        <option value="Malaria">Malaria</option>
      </select>
      <select class="select" id="f-year">
        <option value="2021">2021</option>
        <option value="2019">2019</option>
        <option value="2018">2018</option>
      </select>
      <label class="filter-bar__range">
        <span id="week-label">Semana 24</span>
        <input type="range" id="f-week" min="1" max="52" value="24" aria-label="Semana epidemiológica" />
      </label>
    </div>
  </div>

  <div class="dash__grid">
    <div class="card map-panel">
      <div class="map-legend">
        <h4>Nivel de riesgo</h4>
        <div class="map-legend__row"><span class="dot dot--high"></span> Alto / Probable brote <span class="count" id="c-high">0</span></div>
        <div class="map-legend__row"><span class="dot dot--moderate"></span> Moderado <span class="count" id="c-moderate">0</span></div>
        <div class="map-legend__row"><span class="dot dot--low"></span> Bajo <span class="count" id="c-low">0</span></div>
        <div class="map-legend__row"><span class="dot dot--none"></span> Sin datos <span class="count" id="c-none">0</span></div>
      </div>
      <div class="map-canvas">
        <div class="map-grid" id="map-grid"></div>
      </div>
    </div>

    <div class="card rank-panel">
      <div class="rank-panel__head">
        <h3>Top Riesgo Semanal</h3>
        <p class="muted" style="font-size:0.75rem;margin:4px 0 0">Tasa de incidencia x100k hab.</p>
      </div>
      <div class="rank-list" id="rank-list"></div>
      <div class="rank-panel__foot">
        ${icon("info", "", 16)}
        <span>El ranking muestra los municipios con mayor tasa calculada para la semana seleccionada.</span>
      </div>
    </div>
  </div>
`;

const grid = document.getElementById("map-grid");
const rankList = document.getElementById("rank-list");
const weekLabel = document.getElementById("week-label");

function render() {
  const { disease, year, week } = state;
  const y = Number(year);

  // Map cells: one per municipality, coloured by risk. Click → weekly prediction.
  grid.innerHTML = MUNICIPALITIES.map((m) => {
    const rate = incidenceRate(m, disease, y, week);
    const risk = riskLevel(rate);
    const href = `prediction.html?mun=${encodeURIComponent(m.name)}&disease=${encodeURIComponent(disease)}`;
    return `<a class="map-cell map-cell--${risk}" href="${href}" title="${m.name} — ${rate} x100k · Ver predicción" aria-label="Ver predicción de ${m.name}"></a>`;
  }).join("");

  // Legend counts
  const counts = riskCounts(disease, y, week);
  document.getElementById("c-high").textContent = counts.high;
  document.getElementById("c-moderate").textContent = counts.moderate;
  document.getElementById("c-low").textContent = counts.low;
  document.getElementById("c-none").textContent = counts.none;

  // Ranking
  const top = ranking(disease, y, week, 8);
  rankList.innerHTML = top
    .map(
      (m) => `
      <a class="rank-item rank-item--link" href="prediction.html?mun=${encodeURIComponent(m.name)}&disease=${encodeURIComponent(disease)}" title="Ver predicción de ${m.name}">
        <div>
          <div class="rank-item__name"><span class="dot dot--sm dot--${m.risk}"></span>${m.name}</div>
          <p class="rank-item__dep">${m.dep}</p>
        </div>
        <p class="mono" style="font-weight:600;color:#334155">${m.rate}</p>
      </a>`,
    )
    .join("");
}

document.getElementById("f-disease").addEventListener("change", (e) => {
  state.disease = e.target.value;
  render();
});
document.getElementById("f-year").addEventListener("change", (e) => {
  state.year = e.target.value;
  render();
});
document.getElementById("f-week").addEventListener("input", (e) => {
  state.week = Number(e.target.value);
  weekLabel.textContent = `Semana ${state.week}`;
  render();
});

render();
