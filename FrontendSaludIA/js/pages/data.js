import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import { buildRecords, MUNICIPALITIES, YEARS } from "../data.js";

renderLayout();

const records = buildRecords();
const departments = [...new Set(MUNICIPALITIES.map((m) => m.dep))].sort();
const state = { q: "", year: "Todos", dep: "Todos", disease: "Todas", page: 1, perPage: 15 };

const root = document.getElementById("data-root");
root.innerHTML = `
  <div class="toolbar toolbar--stack">
    <div>
      <h1 class="page-title">Explorador de Datos</h1>
      <p class="page-subtitle">Consulta la base de datos completa de registros epidemiológicos</p>
    </div>
    <div class="pred-filters">
      <label class="pred-filters__field pred-filters__field--dep">
        <span class="pred-filters__label">${icon("database", "", 18)} Departamento</span>
        <select class="select select--lg" id="d-dep">
          <option value="Todos">Todos</option>
          ${departments.map((d) => `<option value="${d}">${d}</option>`).join("")}
        </select>
      </label>
      <label class="pred-filters__field">
        <span class="pred-filters__label">Año</span>
        <select class="select select--lg" id="d-year">
          <option value="Todos">Todos</option>
          ${YEARS.map((y) => `<option value="${y}">${y}</option>`).join("")}
        </select>
      </label>
      <label class="pred-filters__field">
        <span class="pred-filters__label">Enfermedad</span>
        <select class="select select--lg" id="d-disease">
          <option value="Todas">Todas</option>
          <option value="Dengue">Dengue</option>
          <option value="Malaria">Malaria</option>
        </select>
      </label>
      <label class="pred-filters__field">
        <span class="pred-filters__label">Buscar</span>
        <div class="search-box">
          ${icon("search", "", 16)}
          <input class="input select--lg" id="d-search" type="text" placeholder="Buscar municipio..." aria-label="Buscar municipio" />
        </div>
      </label>
      <label class="pred-filters__field pred-filters__field--action">
        <span class="pred-filters__label" aria-hidden="true">&nbsp;</span>
        <button class="btn btn--teal select--lg" id="d-csv">${icon("download", "", 16)} CSV</button>
      </label>
    </div>
  </div>

  <div class="card stack" style="min-height:0">

    <div class="table-wrap">
      <table class="data-table" style="white-space:nowrap">
        <thead>
          <tr>
            <th>Municipio</th><th>Enfermedad</th><th>Año/Sem</th>
            <th class="text-right">Casos</th><th class="text-right">Población</th>
            <th class="text-right">Tasa (x100k)</th><th class="text-right">Temp (°C)</th>
            <th class="text-right">Precip (mm)</th>
          </tr>
        </thead>
        <tbody id="d-body"></tbody>
      </table>
    </div>

    <div class="table-foot">
      <p id="d-count"></p>
      <div class="pager" id="d-pager"></div>
    </div>
  </div>
`;

function filtered() {
  const q = state.q.trim().toLowerCase();
  return records.filter(
    (r) =>
      (state.year === "Todos" || String(r.year) === state.year) &&
      (state.dep === "Todos" || r.dep === state.dep) &&
      (state.disease === "Todas" || r.disease === state.disease) &&
      (q === "" || r.mun.toLowerCase().includes(q) || r.dep.toLowerCase().includes(q)),
  );
}

function render() {
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / state.perPage));
  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * state.perPage;
  const pageRows = rows.slice(start, start + state.perPage);

  document.getElementById("d-body").innerHTML = pageRows
    .map(
      (r) => `
      <tr class="data-row" data-mun="${r.mun}" data-disease="${r.disease}" title="Ver predicción de ${r.mun}">
        <td>
          <p style="font-weight:500;margin:0">${r.mun}</p>
          <p class="muted" style="font-size:0.75rem;margin:0">${r.dep}</p>
        </td>
        <td><span class="pill pill--${r.disease.toLowerCase()}" style="text-transform:uppercase;font-size:10px;letter-spacing:0.04em">${r.disease}</span></td>
        <td class="mono muted">${r.year} · S${r.week}</td>
        <td class="text-right mono">${r.cases}</td>
        <td class="text-right mono muted">${r.pop.toLocaleString("es-CO")}</td>
        <td class="text-right mono" style="font-weight:500">${r.rate}</td>
        <td class="text-right mono muted">${r.temp}</td>
        <td class="text-right mono muted">${r.precip}</td>
      </tr>`,
    )
    .join("");

  document.getElementById("d-count").textContent =
    `Mostrando ${pageRows.length} de ${rows.length.toLocaleString("es-CO")} registros`;

  // Row click → deep-link to the weekly prediction for that municipality.
  document.querySelectorAll("tr.data-row").forEach((tr) =>
    tr.addEventListener("click", () => {
      const mun = tr.dataset.mun;
      const disease = tr.dataset.disease;
      window.location.href = `prediction.html?mun=${encodeURIComponent(mun)}&disease=${encodeURIComponent(disease)}`;
    }),
  );

  // Compact pager: first, current-1..current+1, last
  const pager = document.getElementById("d-pager");
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

document.getElementById("d-search").addEventListener("input", (e) => {
  state.q = e.target.value;
  state.page = 1;
  render();
});
["year", "dep", "disease"].forEach((key) => {
  document.getElementById(`d-${key}`).addEventListener("change", (e) => {
    state[key] = e.target.value;
    state.page = 1;
    render();
  });
});
document.getElementById("d-csv").addEventListener("click", () => {
  const rows = filtered();
  const header = ["Municipio", "Departamento", "Enfermedad", "Anio", "Semana", "Casos", "Poblacion", "Tasa", "Temp", "Precip"];
  const csv = [header.join(",")]
    .concat(rows.map((r) => [r.mun, r.dep, r.disease, r.year, r.week, r.cases, r.pop, r.rate, r.temp, r.precip].join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "registros_saludia.csv";
  link.click();
  URL.revokeObjectURL(url);
});

render();
