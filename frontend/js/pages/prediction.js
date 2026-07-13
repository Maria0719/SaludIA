import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import { getMunicipios, getPrediccion, getRecomendacion } from "../api.js";

renderLayout();

let Chart = null;
try {
  const chartModule = await import("https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm");
  Chart = chartModule.default;
} catch {
  Chart = null;
}

const municipios = await getMunicipios();
municipios.sort((a, b) => a.dpto.localeCompare(b.dpto) || a.nom_mpio.localeCompare(b.nom_mpio));

const params = new URLSearchParams(window.location.search);
const urlCodMpio = Number(params.get("cod_mpio"));
const urlDisease = params.get("enfermedad");
const validMun = municipios.find((m) => m.cod_mpio === urlCodMpio);

const state = {
  codMpio: validMun ? validMun.cod_mpio : municipios.find((m) => m.nom_mpio === "MEDELLÍN")?.cod_mpio || municipios[0].cod_mpio,
  disease: urlDisease === "Malaria" ? "Malaria" : "Dengue",
};

const munOptions = municipios
  .map((m) => `<option value="${m.cod_mpio}"${m.cod_mpio === state.codMpio ? " selected" : ""}>${m.dpto} — ${m.nom_mpio}</option>`)
  .join("");

function enfermedadesDisponibles(codMpio) {
  return municipios.find((m) => m.cod_mpio === codMpio)?.enfermedades_disponibles || [];
}

// Si la enfermedad de la URL/estado no tiene historial suficiente en este municipio,
// se cambia a la primera que sí tenga, para no arrancar en un estado "sin datos".
const disponiblesInicial = enfermedadesDisponibles(state.codMpio);
if (disponiblesInicial.length && !disponiblesInicial.includes(state.disease)) {
  state.disease = disponiblesInicial[0];
}

function opcionesEnfermedadHtml() {
  const disponibles = enfermedadesDisponibles(state.codMpio);
  return ["Dengue", "Malaria"]
    .map((d) => {
      const sinDatos = !disponibles.includes(d);
      const selected = d === state.disease ? " selected" : "";
      const disabled = sinDatos ? " disabled" : "";
      const etiqueta = sinDatos ? `${d} (sin datos suficientes)` : d;
      return `<option value="${d}"${selected}${disabled}>${etiqueta}</option>`;
    })
    .join("");
}

const root = document.getElementById("pred-root");
root.innerHTML = `
  <div class="toolbar toolbar--stack">
    <div>
      <h1 class="page-title">Predicción Semanal</h1>
      <p class="page-subtitle">Estimación de riesgo a 1 semana de anticipación, calculada en vivo por el modelo</p>
    </div>
    <div class="pred-filters">
      <label class="pred-filters__field pred-filters__field--dep">
        <span class="pred-filters__label">${icon("map", "", 18)} Departamento / Municipio</span>
        <select class="select select--lg" id="p-mun">${munOptions}</select>
      </label>
      <label class="pred-filters__field">
        <span class="pred-filters__label">Enfermedad</span>
        <select class="select select--lg" id="p-disease">${opcionesEnfermedadHtml()}</select>
      </label>
    </div>
  </div>

  <div class="pred-grid">
    <div class="card pred-card">
      <div class="flex items-center gap-2 muted" style="margin-bottom:16px;font-weight:700">
        <span id="next-title">Próxima Semana</span>
      </div>
      <div class="pred-gauge" id="gauge"></div>
    </div>

    <div class="card" style="padding:24px" >
      <h2 class="flex items-center gap-2" style="font-weight:700;margin:0 0 24px">
        ${icon("target", "", 20).replace('stroke="currentColor"', 'stroke="#0d9488"')} Histórico vs. Predicción
      </h2>
      <div class="chart-box" id="pred-chart-wrap"><canvas id="pred-chart"></canvas></div>
    </div>
  </div>

  <div class="note-box">
    ${icon("alertCircle", "", 24)}
    <div>
      <p style="font-weight:600;color:var(--text);margin:0 0 4px">Acerca del modelo predictivo</p>
      <p style="margin:0;line-height:1.6">
        Random Forest entrenado con datos históricos de 2018, 2019 y 2021 (excluyendo 2020 por
        anomalías de reporte durante la pandemia de COVID-19). La predicción combina rezagos de
        casos, promedios móviles, tendencia y estacionalidad; se cruza con el índice de
        vulnerabilidad territorial para producir el nivel de alerta final.
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
        Evolución semanal real de las variables clave que alimentan el modelo (año 2021)
      </p>
    </div>

    <div class="detail-grid">
      <div class="card detail-card">
        <div class="detail-card__title">${icon("activity", "", 18)} Cambios en Temperatura (°C)</div>
        <div class="chart-box chart-box--sm" id="chart-temp-wrap"><canvas id="chart-temp"></canvas></div>
      </div>
      <div class="card detail-card">
        <div class="detail-card__title">${icon("activity", "", 18)} Precipitaciones (mm)</div>
        <div class="chart-box chart-box--sm" id="chart-precip-wrap"><canvas id="chart-precip"></canvas></div>
      </div>
      <div class="card detail-card">
        <div class="detail-card__title">${icon("activity", "", 18)} Casos reportados</div>
        <div class="chart-box chart-box--sm" id="chart-cases-wrap"><canvas id="chart-cases"></canvas></div>
      </div>
      <div class="card detail-card">
        <div class="detail-card__title">${icon("database", "", 18)} Población por municipio (departamento)</div>
        <div class="chart-box chart-box--sm" id="chart-pop-wrap"><canvas id="chart-pop"></canvas></div>
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

  <section class="detail-section">
    <div class="card findings-card">
      <h2 class="flex items-center gap-2" style="font-weight:800;margin:0 0 6px">
        ${icon("sparkles", "", 22).replace('stroke="currentColor"', 'stroke="#0d9488"')}
        Agente de recomendación (IA Generativa)
      </h2>
      <p class="page-subtitle" style="margin:0 0 16px">Genera un reporte accionable para la autoridad de salud de este municipio</p>
      <div id="agente"></div>
    </div>
  </section>
`;

const NIVEL_ALERTA_LABEL = { BAJO: "Baja", MEDIO: "Media", ALTO: "Alta", "CRÍTICO": "Crítica" };
const NIVEL_ALERTA_GAUGE_CLASS = { BAJO: "low", MEDIO: "moderate", ALTO: "high", "CRÍTICO": "critico" };
const NIVEL_ALERTA_BADGE_CLASS = { BAJO: "low", MEDIO: "moderate", ALTO: "high", "CRÍTICO": "high" };

let chart;
const detailCharts = {};

const TEAL = "#14b8a6";
const AMBER = "#f59e0b";
const ROSE = "#e11d48";

function promedio(valores) {
  const validos = valores.filter((v) => v !== null && v !== undefined);
  if (!validos.length) return null;
  return validos.reduce((s, v) => s + v, 0) / validos.length;
}

function correlacion(a, b) {
  const pares = a.map((v, i) => [v, b[i]]).filter(([x, y]) => x !== null && y !== null);
  if (pares.length < 8) return null;
  const xs = pares.map((p) => p[0]);
  const ys = pares.map((p) => p[1]);
  const mx = promedio(xs);
  const my = promedio(ys);
  let num = 0,
    dx = 0,
    dy = 0;
  pares.forEach(([x, y]) => {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  });
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : +(num / den).toFixed(2);
}

// Vuelve a dejar en el contenedor un <canvas> limpio antes de dibujar. Es clave para que
// un intento fallido (sin datos, Chart.js no cargó, etc.) no deje el gráfico roto para
// siempre: cada vez que se llama a esta función se parte de un lienzo nuevo, nunca del
// mensaje de "sin datos" que pudo haber quedado de una selección anterior.
function resetCanvas(wrapId, canvasId) {
  const wrap = document.getElementById(wrapId);
  wrap.innerHTML = `<canvas id="${canvasId}"></canvas>`;
  return document.getElementById(canvasId);
}

function makeLineChart(id, wrapId, labels, data, label, color, fill = true) {
  if (detailCharts[id]) {
    detailCharts[id].destroy();
    delete detailCharts[id];
  }
  if (!Chart) {
    document.getElementById(wrapId).innerHTML = '<div class="chart-fallback">Gráficos no disponibles</div>';
    return;
  }
  const ctx = resetCanvas(wrapId, id);
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
          spanGaps: true,
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
        x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 10 }, maxTicksLimit: 12 } },
        y: { beginAtZero: true, grid: { color: "#e2e8f0" }, ticks: { color: "#94a3b8", font: { size: 11 } } },
      },
    },
  });
}

function renderDetail(prediccion) {
  const munObj = municipios.find((m) => m.cod_mpio === state.codMpio);
  document.getElementById("detail-mun").textContent = `· ${munObj.nom_mpio}`;

  const anio2021 = prediccion.historico.filter((r) => r.anio === 2021);
  const weekLabels = anio2021.map((r) => `S${r.semana}`);
  const temps = anio2021.map((r) => r.temperatura);
  const precips = anio2021.map((r) => r.precipitacion);
  const casos2021 = anio2021.map((r) => r.casos);

  const hayTemp = temps.some((v) => v !== null);
  const hayPrecip = precips.some((v) => v !== null);

  if (hayTemp) makeLineChart("chart-temp", "chart-temp-wrap", weekLabels, temps, "Temperatura (°C)", AMBER);
  else {
    if (detailCharts["chart-temp"]) delete detailCharts["chart-temp"];
    document.getElementById("chart-temp-wrap").innerHTML = '<div class="chart-fallback">Sin datos ambientales para este municipio</div>';
  }

  if (hayPrecip) makeLineChart("chart-precip", "chart-precip-wrap", weekLabels, precips, "Precipitación (mm)", TEAL);
  else {
    if (detailCharts["chart-precip"]) delete detailCharts["chart-precip"];
    document.getElementById("chart-precip-wrap").innerHTML = '<div class="chart-fallback">Sin datos ambientales para este municipio</div>';
  }

  makeLineChart("chart-cases", "chart-cases-wrap", weekLabels, casos2021, "Casos", ROSE);

  const peers = municipios.filter((m) => m.dpto === munObj.dpto).sort((a, b) => b.poblacion - a.poblacion).slice(0, 12);
  if (detailCharts["chart-pop"]) {
    detailCharts["chart-pop"].destroy();
    delete detailCharts["chart-pop"];
  }
  if (!Chart) {
    document.getElementById("chart-pop-wrap").innerHTML = '<div class="chart-fallback">Gráficos no disponibles</div>';
    renderFindings(prediccion, { temps, precips, casos2021, anio2021 });
    renderAgente(prediccion);
    return;
  }
  detailCharts["chart-pop"] = new Chart(resetCanvas("chart-pop-wrap", "chart-pop"), {
    type: "bar",
    data: {
      labels: peers.map((m) => m.nom_mpio),
      datasets: [
        {
          label: "Población",
          data: peers.map((m) => m.poblacion),
          backgroundColor: peers.map((m) => (m.cod_mpio === state.codMpio ? TEAL : "#cbd5e1")),
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { padding: 10, cornerRadius: 12, backgroundColor: "#1e293b", callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString("es-CO")} hab.` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 10 } } },
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => (v >= 1000000 ? v / 1000000 + "M" : v / 1000 + "k") },
        },
      },
    },
  });

  renderFindings(prediccion, { temps, precips, casos2021, anio2021 });
  renderAgente(prediccion);
}

function renderAgente(prediccion) {
  const contenedor = document.getElementById("agente");
  contenedor.innerHTML = `
    <button class="btn btn--teal" id="agente-btn">${icon("sparkles", "", 16)} Generar recomendación</button>
    <div id="agente-resultado" style="margin-top:16px"></div>
  `;
  document.getElementById("agente-btn").addEventListener("click", async (e) => {
    const boton = e.currentTarget;
    const resultadoEl = document.getElementById("agente-resultado");
    boton.disabled = true;
    boton.textContent = "Generando...";
    try {
      const rec = await getRecomendacion(prediccion.cod_mpio, prediccion.enfermedad);
      if (!rec.disponible) {
        resultadoEl.innerHTML = `<p class="muted">${rec.mensaje}</p>`;
      } else {
        resultadoEl.innerHTML = `
          <p class="findings-lead">${rec.resumen}</p>
          <p class="findings-subtitle">Acciones recomendadas</p>
          <ul class="findings-list">
            ${rec.acciones.map((a) => `<li>${icon("chevronRight", "", 16)}<span>${a}</span></li>`).join("")}
          </ul>
        `;
      }
    } catch {
      resultadoEl.innerHTML = '<p class="muted">No se pudo contactar al backend para generar la recomendación.</p>';
    }
    boton.remove();
  });
}

function renderFindings(prediccion, { temps, precips, casos2021, anio2021 }) {
  const munObj = municipios.find((m) => m.cod_mpio === state.codMpio);
  const totalCasos2021 = casos2021.reduce((s, c) => s + c, 0);
  const peakIdx = casos2021.reduce((best, v, i) => (v > casos2021[best] ? i : best), 0);
  const peakCases = casos2021[peakIdx] ?? 0;
  const peakWeek = anio2021[peakIdx]?.semana ?? "—";
  const avgTemp = promedio(temps);
  const avgPrecip = promedio(precips);
  const corrTemp = correlacion(temps, casos2021);
  const corrPrecip = correlacion(precips, casos2021);

  const badgeClass = NIVEL_ALERTA_BADGE_CLASS[prediccion.nivel_alerta] || "moderate";
  const nivelLabel = NIVEL_ALERTA_LABEL[prediccion.nivel_alerta] || prediccion.nivel_alerta;

  const causas = [];
  if (prediccion.indice_vulnerabilidad !== null) {
    causas.push(
      `Índice de vulnerabilidad territorial de ${prediccion.indice_vulnerabilidad}/10 (nivel ${(prediccion.vulnerabilidad || "—").toLowerCase()}), calculado a partir de la tasa histórica de incidencia, el pico histórico, la calidad del aire y la población del municipio.`,
    );
  }
  if (corrPrecip !== null && corrPrecip >= 0.3) {
    causas.push(`Correlación positiva entre precipitaciones y casos en 2021 (r=${corrPrecip}): la lluvia genera criaderos de mosquitos que amplifican la transmisión.`);
  }
  if (corrTemp !== null && corrTemp >= 0.3) {
    causas.push(`Correlación positiva entre temperatura y casos en 2021 (r=${corrTemp}), cercana a ${avgTemp.toFixed(1)} °C en promedio.`);
  }
  if (munObj.poblacion >= 300000) {
    causas.push(`Alta densidad poblacional (${Math.round(munObj.poblacion).toLocaleString("es-CO")} hab.), que facilita el contacto humano-vector y la propagación urbana.`);
  }
  if (peakWeek !== "—") {
    causas.push(`En 2021 el pico de casos se registró en la semana ${peakWeek} (${peakCases} casos).`);
  }
  if (avgTemp === null && avgPrecip === null) {
    causas.push("No hay estación de calidad del aire/clima cercana con datos para este municipio (cobertura nacional limitada a ~111 de 963 municipios).");
  }

  document.getElementById("findings").innerHTML = `
    <p class="findings-lead">
      Durante 2021, <strong>${munObj.nom_mpio}</strong> (${munObj.dpto}) registró un total de
      <strong>${totalCasos2021.toLocaleString("es-CO")}</strong> casos de ${state.disease}, con un pico en la
      <strong>semana ${peakWeek}</strong> (${peakCases} casos).
      El modelo proyecta un nivel de alerta
      <span class="findings-badge findings-badge--${badgeClass}">${nivelLabel}</span>
      para la próxima semana (${prediccion.casos_predichos} casos predichos).
    </p>

    <div class="findings-stats">
      <div class="findings-stat">
        <span class="findings-stat__num">${avgTemp !== null ? avgTemp.toFixed(1) + "°C" : "—"}</span>
        <span class="findings-stat__lbl">Temperatura media</span>
      </div>
      <div class="findings-stat">
        <span class="findings-stat__num">${avgPrecip !== null ? avgPrecip.toFixed(1) + " mm" : "—"}</span>
        <span class="findings-stat__lbl">Precipitación media</span>
      </div>
      <div class="findings-stat">
        <span class="findings-stat__num">${prediccion.indice_vulnerabilidad ?? "—"}/10</span>
        <span class="findings-stat__lbl">Índice de vulnerabilidad</span>
      </div>
      <div class="findings-stat">
        <span class="findings-stat__num">${corrPrecip !== null ? "r=" + corrPrecip : "—"}</span>
        <span class="findings-stat__lbl">Correlación lluvia-casos</span>
      </div>
    </div>

    <p class="findings-subtitle">Posibles causas del nivel de alerta</p>
    <ul class="findings-list">
      ${causas.map((c) => `<li>${icon("chevronRight", "", 16)}<span>${c}</span></li>`).join("")}
    </ul>
  `;
}

async function render() {
  let prediccion;
  try {
    prediccion = await getPrediccion(state.codMpio, state.disease);
  } catch {
    document.getElementById("gauge").innerHTML =
      '<p class="muted">No hay predicción disponible para este municipio y enfermedad (sin historial suficiente).</p>';
    // Se deja un mensaje (no se borra el <canvas>): así, si luego se elige un municipio
    // válido, resetCanvas() puede reconstruir el gráfico sin problema.
    document.getElementById("pred-chart-wrap").innerHTML = '<div class="chart-fallback">Sin datos para graficar</div>';
    return;
  }

  const historico = prediccion.historico;
  const ultimo = historico[historico.length - 1];
  const semanaSiguiente = ultimo.semana === 52 ? 1 : ultimo.semana + 1;
  const anioSiguiente = ultimo.semana === 52 ? ultimo.anio + 1 : ultimo.anio;

  const gaugeClass = NIVEL_ALERTA_GAUGE_CLASS[prediccion.nivel_alerta] || "moderate";
  const nivelLabel = NIVEL_ALERTA_LABEL[prediccion.nivel_alerta] || prediccion.nivel_alerta;

  const confianzaColor = prediccion.confianza >= 70 ? "#10b981" : prediccion.confianza >= 40 ? "#fbbf24" : "#e11d48";

  document.getElementById("next-title").textContent = `Próxima Semana (Sem ${semanaSiguiente} · ${anioSiguiente})`;
  document.getElementById("gauge").innerHTML = `
    <div class="pred-gauge__circle pred-gauge__circle--${gaugeClass}">${nivelLabel}</div>
    <h3 style="font-size:1.25rem;font-weight:700;margin:0 0 4px">Probabilidad de Brote</h3>
    <p class="muted" style="margin:0 0 14px">Predicción: ${prediccion.casos_predichos} casos de ${state.disease}</p>
    <div class="severity-cell" style="justify-content:center">
      <span class="dot dot--sm" style="background:${confianzaColor}"></span>
      <span style="font-weight:600;color:#334155;font-size:0.85rem">Confianza del modelo: ${prediccion.confianza}%</span>
      <div class="tooltip" style="left:50%;transform:translateX(-50%);width:220px">
        Qué tanto concuerdan entre sí los árboles del Random Forest para esta predicción puntual.
        Más alto = predicción más estable; más bajo = mayor incertidumbre del modelo en este municipio.
      </div>
    </div>
  `;

  // Si algo falla graficando (Chart.js no cargó del CDN, dato inesperado, etc.) se muestra
  // un aviso claro en vez de dejar la caja en blanco sin explicación.
  try {
    if (!Chart) throw new Error("Chart.js no está disponible");

    // Últimas semanas reales + el punto predicho (sin dato real todavía) al final.
    const ventana = historico.slice(-12);
    const labels = [...ventana.map((r) => `S${r.semana} '${String(r.anio).slice(2)}`), `S${semanaSiguiente} '${String(anioSiguiente).slice(2)}`];
    const actual = [...ventana.map((r) => r.casos), null];
    const predicho = [...ventana.map(() => null), null];
    predicho[predicho.length - 1] = prediccion.casos_predichos;
    predicho[predicho.length - 2] = ventana[ventana.length - 1].casos;

    if (chart) {
      chart.destroy();
      chart = null;
    }
    chart = new Chart(resetCanvas("pred-chart-wrap", "pred-chart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Casos Reales", data: actual, borderColor: "#0f172a", backgroundColor: "#0f172a", borderWidth: 3, spanGaps: false, tension: 0.35, pointRadius: 4 },
          { label: "Predicción del Modelo", data: predicho, borderColor: "#14b8a6", backgroundColor: "#14b8a6", borderWidth: 3, borderDash: [6, 6], tension: 0.35, pointRadius: 4, spanGaps: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { labels: { usePointStyle: true, pointStyle: "circle", font: { size: 12 } } },
          tooltip: { padding: 10, cornerRadius: 12, backgroundColor: "#1e293b" },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 12 } } },
          y: { beginAtZero: true, grid: { color: "#e2e8f0" }, ticks: { color: "#94a3b8", font: { size: 12 } } },
        },
      },
    });
  } catch (err) {
    console.error("No se pudo graficar Histórico vs. Predicción:", err);
    chart = null;
    document.getElementById("pred-chart-wrap").innerHTML =
      '<div class="chart-fallback">No se pudo cargar el gráfico. Intenta con otro municipio o recarga la página.</div>';
  }

  try {
    renderDetail(prediccion);
  } catch (err) {
    console.error("No se pudieron cargar las variables/hallazgos del municipio:", err);
  }
}

document.getElementById("p-mun").addEventListener("change", (e) => {
  state.codMpio = Number(e.target.value);
  const disponibles = enfermedadesDisponibles(state.codMpio);
  if (disponibles.length && !disponibles.includes(state.disease)) {
    state.disease = disponibles[0];
  }
  document.getElementById("p-disease").innerHTML = opcionesEnfermedadHtml();
  render();
});
document.getElementById("p-disease").addEventListener("change", (e) => {
  state.disease = e.target.value;
  render();
});

render();
