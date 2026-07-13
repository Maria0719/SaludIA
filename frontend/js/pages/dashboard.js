import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import {
  getAlertas,
  getDepartamentosResumen,
  normalizeDeptName,
  NIVEL_ALERTA_COLOR,
  NIVEL_ALERTA_ORDEN,
} from "../api.js";

renderLayout();

let L = null;
try {
  const leaflet = await import("leaflet");
  await import("leaflet/dist/leaflet.css");
  L = leaflet.default;
} catch {
  L = null;
}

const state = { disease: "Dengue" };

const root = document.getElementById("dash-root");
root.innerHTML = `
  <div class="dash__head">
    <div>
      <h1 class="page-title">Índice de Riesgo</h1>
      <p class="page-subtitle">Predicción del modelo para la próxima semana, por departamento</p>
    </div>
    <div class="filter-bar">
      <span class="filter-bar__label">${icon("sliders", "", 16)} Enfermedad:</span>
      <select class="select" id="f-disease">
        <option value="Dengue">Dengue</option>
        <option value="Malaria">Malaria</option>
      </select>
    </div>
  </div>

  <div class="dash__grid">
    <div class="card map-panel">
      <div class="map-legend">
        <h4>Nivel de alerta</h4>
        <div class="map-legend__row"><span class="dot dot--critical"></span> Crítico <span class="count" id="c-critico">0</span></div>
        <div class="map-legend__row"><span class="dot dot--orange"></span> Alto <span class="count" id="c-alto">0</span></div>
        <div class="map-legend__row"><span class="dot dot--moderate"></span> Medio <span class="count" id="c-medio">0</span></div>
        <div class="map-legend__row"><span class="dot dot--low"></span> Bajo <span class="count" id="c-bajo">0</span></div>
      </div>
      <div class="map-canvas">
        <div class="map-leaflet" id="map-leaflet"></div>
      </div>
    </div>

    <div class="card rank-panel">
      <div class="rank-panel__head">
        <h3>Top Riesgo</h3>
        <p class="muted" style="font-size:0.75rem;margin:4px 0 0">Municipios con más casos predichos para la próxima semana</p>
      </div>
      <div class="rank-list" id="rank-list"></div>
      <div class="rank-panel__foot">
        ${icon("info", "", 16)}
        <span>Haz clic en un departamento del mapa para ver sus municipios, o en un municipio de la lista para ver su predicción.</span>
      </div>
    </div>
  </div>
`;

const rankList = document.getElementById("rank-list");
let map;
let geojsonLayer;

if (L) {
  map = L.map("map-leaflet", { scrollWheelZoom: false }).setView([4.4, -73.5], 5.2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    opacity: 0.35,
  }).addTo(map);
}

function severidadColor(nivel) {
  return NIVEL_ALERTA_COLOR[nivel] || "#e2e8f0";
}

function popupHtml(dpto, alertasDpto) {
  const ordenadas = [...alertasDpto].sort(
    (a, b) => NIVEL_ALERTA_ORDEN[b.nivel_alerta] - NIVEL_ALERTA_ORDEN[a.nivel_alerta] || b.casos_predichos - a.casos_predichos,
  );
  const filas = ordenadas
    .slice(0, 15)
    .map(
      (a) => `
      <a href="prediction.html?cod_mpio=${a.cod_mpio}&enfermedad=${encodeURIComponent(a.enfermedad)}" class="popup-mun-link">
        <span class="dot dot--sm" style="background:${severidadColor(a.nivel_alerta)}"></span>
        ${a.municipio} <span class="mono">· ${a.casos_predichos.toFixed(1)}</span>
      </a>`,
    )
    .join("");
  const resto = ordenadas.length > 15 ? `<p class="muted popup-more">+ ${ordenadas.length - 15} municipios más</p>` : "";
  return `<div class="map-popup"><h4>${dpto}</h4>${filas}${resto}</div>`;
}

async function render() {
  const { disease } = state;
  const [resumen, alertas] = await Promise.all([
    getDepartamentosResumen(disease),
    getAlertas({ enfermedad: disease }),
  ]);

  const porDepto = new Map();
  alertas.forEach((a) => {
    const key = normalizeDeptName(a.dpto);
    if (!porDepto.has(key)) porDepto.set(key, []);
    porDepto.get(key).push(a);
  });
  const resumenPorDepto = new Map(resumen.map((r) => [normalizeDeptName(r.dpto), r]));

  // Leyenda: conteo nacional de municipios por nivel de alerta.
  const conteos = { BAJO: 0, MEDIO: 0, ALTO: 0, "CRÍTICO": 0 };
  alertas.forEach((a) => {
    if (a.nivel_alerta in conteos) conteos[a.nivel_alerta]++;
  });
  document.getElementById("c-bajo").textContent = conteos.BAJO;
  document.getElementById("c-medio").textContent = conteos.MEDIO;
  document.getElementById("c-alto").textContent = conteos.ALTO;
  document.getElementById("c-critico").textContent = conteos["CRÍTICO"];

  // Ranking nacional por casos predichos.
  const top = [...alertas].sort((a, b) => b.casos_predichos - a.casos_predichos).slice(0, 8);
  rankList.innerHTML = top
    .map(
      (a) => `
      <a class="rank-item rank-item--link" href="prediction.html?cod_mpio=${a.cod_mpio}&enfermedad=${encodeURIComponent(a.enfermedad)}" title="Ver predicción de ${a.municipio}">
        <div>
          <div class="rank-item__name"><span class="dot dot--sm" style="background:${severidadColor(a.nivel_alerta)}"></span>${a.municipio}</div>
          <p class="rank-item__dep">${a.dpto}</p>
        </div>
        <p class="mono" style="font-weight:600;color:#334155">${a.casos_predichos.toFixed(1)}</p>
      </a>`,
    )
    .join("");

  if (!L) {
    document.getElementById("map-leaflet").innerHTML = '<div class="chart-fallback">Mapa no disponible</div>';
    return;
  }

  if (geojsonLayer) geojsonLayer.remove();
  const geojson = await fetch("/data/colombia-departamentos.geojson").then((r) => r.json());

  geojsonLayer = L.geoJSON(geojson, {
    style: (feature) => {
      const info = resumenPorDepto.get(normalizeDeptName(feature.properties.shapeName));
      return {
        fillColor: info ? severidadColor(info.nivel_alerta_predominante) : "#e2e8f0",
        weight: 1,
        color: "#ffffff",
        fillOpacity: 0.75,
      };
    },
    onEachFeature: (feature, layer) => {
      const key = normalizeDeptName(feature.properties.shapeName);
      const alertasDpto = porDepto.get(key);
      layer.on({
        mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.9 }),
        mouseout: (e) => e.target.setStyle({ weight: 1, fillOpacity: 0.75 }),
      });
      if (alertasDpto && alertasDpto.length) {
        layer.bindPopup(popupHtml(feature.properties.shapeName, alertasDpto));
      } else {
        layer.bindPopup(`<div class="map-popup"><h4>${feature.properties.shapeName}</h4><p class="muted">Sin datos en el dataset.</p></div>`);
      }
    },
  }).addTo(map);
}

document.getElementById("f-disease").addEventListener("change", (e) => {
  state.disease = e.target.value;
  render();
});

render();
