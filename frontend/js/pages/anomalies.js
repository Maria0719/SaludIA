import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import { getAnomalias } from "../api.js";

renderLayout();

const state = { disease: "Todas", severity: "Todas", page: 1, perPage: 8 };
let all = [];

const sevLabel = { critical: "Crítica", high: "Alta", moderate: "Moderada" };
const sevDot = { critical: "dot--critical", high: "dot--orange", moderate: "dot--moderate" };

const root = document.getElementById("anom-root");
root.innerHTML = `
  <div class="toolbar toolbar--stack">
    <div>
      <h1 class="page-title">Detección de Anomalías</h1>
      <p class="page-subtitle">Picos inusuales de casos identificados por Isolation Forest sobre el histórico real</p>
    </div>
    <div class="pred-filters">
      <label class="pred-filters__field pred-filters__field--dep">
        <span class="pred-filters__label">${icon("activity", "", 18)} Enfermedad</span>
        <select class="select select--lg" id="a-disease">
          <option value="Todas">Todas</option>
          <option value="Dengue">Dengue</option>
          <option value="Malaria">Malaria</option>
        </select>
      </label>
      <label class="pred-filters__field">
        <span class="pred-filters__label">Severidad</span>
        <select class="select select--lg" id="a-severity">
          <option value="Todas">Todas</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="moderate">Moderada</option>
        </select>
      </label>
      <label class="pred-filters__field pred-filters__field--action">
        <span class="pred-filters__label" aria-hidden="true">&nbsp;</span>
        <button class="btn btn--teal select--lg" id="a-export">${icon("download", "", 16)} Exportar</button>
      </label>
    </div>
  </div>

  <div class="card">
    <div class="table-wrap table-wrap--scrollhint">
      <table class="data-table">
        <thead>
          <tr>
            <th>Semana</th><th>Ubicación</th><th>Enfermedad</th>
            <th>Casos Reportados</th><th>Casos Esperados</th><th>Severidad</th>
          </tr>
        </thead>
        <tbody id="a-body"></tbody>
      </table>
    </div>
    <div class="table-foot">
      <p id="a-count"></p>
      <div class="pager" id="a-pager"></div>
    </div>
  </div>
`;

async function cargar() {
  all = await getAnomalias({
    enfermedad: state.disease === "Todas" ? undefined : state.disease,
    severidad: state.severity === "Todas" ? undefined : state.severity,
    limit: 200,
  });
}

function render() {
  const pages = Math.max(1, Math.ceil(all.length / state.perPage));
  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * state.perPage;
  const pageRows = all.slice(start, start + state.perPage);

  document.getElementById("a-body").innerHTML = pageRows
    .map(
      (a) => `
      <tr>
        <td style="font-weight:500;color:var(--text)">${a.fecha}</td>
        <td>
          <p style="font-weight:500;margin:0">${a.municipio}</p>
          <p class="muted" style="font-size:0.75rem;margin:0">${a.dpto}</p>
        </td>
        <td><span class="pill pill--${a.enfermedad.toLowerCase()}">${a.enfermedad}</span></td>
        <td class="mono" style="color:var(--rose);font-weight:700">${a.casos}</td>
        <td class="mono muted">${a.casos_esperados}</td>
        <td>
          <div class="severity-cell">
            <span class="dot dot--sm ${sevDot[a.severidad]}"></span>
            <span style="color:#334155">${sevLabel[a.severidad]}</span>
            <div class="tooltip">Casos ${a.ratio}x por encima del promedio móvil histórico del municipio para esta época del año.</div>
          </div>
        </td>
      </tr>`,
    )
    .join("");

  document.getElementById("a-count").textContent = `Mostrando ${pageRows.length} de ${all.length} anomalías`;

  // Paginador compacto: primera, última y un rango alrededor de la actual (con "…").
  const pager = document.getElementById("a-pager");
  const nums = new Set([1, pages, state.page, state.page - 1, state.page + 1]);
  const visible = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  let html = `<button ${state.page === 1 ? "disabled" : ""} data-go="prev">Anterior</button>`;
  let prev = 0;
  visible.forEach((n) => {
    if (n - prev > 1) html += `<span style="padding:6px 4px">…</span>`;
    html += `<button class="${n === state.page ? "is-active" : ""}" data-go="${n}">${n}</button>`;
    prev = n;
  });
  html += `<button ${state.page === pages ? "disabled" : ""} data-go="next">Siguiente</button>`;
  pager.innerHTML = html;
  pager.querySelectorAll("button[data-go]").forEach((b) =>
    b.addEventListener("click", () => {
      const go = b.dataset.go;
      if (go === "prev") state.page--;
      else if (go === "next") state.page++;
      else state.page = Number(go);
      render();
    }),
  );
}

async function reload() {
  state.page = 1;
  await cargar();
  render();
}

document.getElementById("a-disease").addEventListener("change", (e) => {
  state.disease = e.target.value;
  reload();
});
document.getElementById("a-severity").addEventListener("change", (e) => {
  state.severity = e.target.value;
  reload();
});
document.getElementById("a-export").addEventListener("click", () => {
  const header = ["Semana", "Municipio", "Departamento", "Enfermedad", "Casos", "Esperados", "Severidad"];
  const csv = [header.join(",")]
    .concat(all.map((a) => [a.fecha, a.municipio, a.dpto, a.enfermedad, a.casos, a.casos_esperados, sevLabel[a.severidad]].join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "anomalias_saludia.csv";
  link.click();
  URL.revokeObjectURL(url);
});

await cargar();
render();
