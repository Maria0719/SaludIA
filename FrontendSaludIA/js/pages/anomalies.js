import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import { detectAnomalies } from "../data.js";

renderLayout();

const all = detectAnomalies(40);
const state = { disease: "Todas", severity: "Todas", page: 1, perPage: 8 };

const sevLabel = { critical: "Crítica", high: "Alta", moderate: "Moderada" };
const sevDot = { critical: "dot--critical", high: "dot--orange", moderate: "dot--moderate" };

const root = document.getElementById("anom-root");
root.innerHTML = `
  <div class="toolbar toolbar--stack">
    <div>
      <h1 class="page-title">Detección de Anomalías</h1>
      <p class="page-subtitle">Picos inusuales de casos identificados por algoritmos de detección</p>
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
    <div class="table-wrap">
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

function filtered() {
  return all.filter(
    (a) =>
      (state.disease === "Todas" || a.disease === state.disease) &&
      (state.severity === "Todas" || a.severity === state.severity),
  );
}

function render() {
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / state.perPage));
  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * state.perPage;
  const pageRows = rows.slice(start, start + state.perPage);

  document.getElementById("a-body").innerHTML = pageRows
    .map(
      (a) => `
      <tr>
        <td style="font-weight:500;color:var(--text)">${a.date}</td>
        <td>
          <p style="font-weight:500;margin:0">${a.mun}</p>
          <p class="muted" style="font-size:0.75rem;margin:0">${a.dep}</p>
        </td>
        <td><span class="pill pill--${a.disease.toLowerCase()}">${a.disease}</span></td>
        <td class="mono" style="color:var(--rose);font-weight:700">${a.cases}</td>
        <td class="mono muted">${a.expected}</td>
        <td>
          <div class="severity-cell">
            <span class="dot dot--sm ${sevDot[a.severity]}"></span>
            <span style="color:#334155">${sevLabel[a.severity]}</span>
            <div class="tooltip">Casos ${a.ratio}x por encima del promedio histórico del municipio para esta época del año.</div>
          </div>
        </td>
      </tr>`,
    )
    .join("");

  document.getElementById("a-count").textContent = `Mostrando ${pageRows.length} de ${rows.length} anomalías`;

  const pager = document.getElementById("a-pager");
  let html = `<button ${state.page === 1 ? "disabled" : ""} data-go="prev">Anterior</button>`;
  for (let p = 1; p <= pages; p++) {
    html += `<button class="${p === state.page ? "is-active" : ""}" data-go="${p}">${p}</button>`;
  }
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

document.getElementById("a-disease").addEventListener("change", (e) => {
  state.disease = e.target.value;
  state.page = 1;
  render();
});
document.getElementById("a-severity").addEventListener("change", (e) => {
  state.severity = e.target.value;
  state.page = 1;
  render();
});
document.getElementById("a-export").addEventListener("click", () => {
  const rows = filtered();
  const header = ["Semana", "Municipio", "Departamento", "Enfermedad", "Casos", "Esperados", "Severidad"];
  const csv = [header.join(",")]
    .concat(
      rows.map((a) =>
        [a.date, a.mun, a.dep, a.disease, a.cases, a.expected, sevLabel[a.severity]].join(","),
      ),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "anomalias_saludia.csv";
  link.click();
  URL.revokeObjectURL(url);
});

render();
