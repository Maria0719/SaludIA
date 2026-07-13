import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import { getDatos, getMunicipios } from "../api.js";

renderLayout();

const YEARS = [2018, 2019, 2021];
const municipios = await getMunicipios();
const departments = [...new Set(municipios.map((m) => m.dpto))].sort();

const state = { q: "", year: "Todos", dep: "Todos", disease: "Todas", page: 1, perPage: 15 };
let total = 0;

const root = document.getElementById("data-root");
root.innerHTML = `
  <div class="toolbar toolbar--stack">
    <div>
      <h1 class="page-title">Explorador de Datos</h1>
      <p class="page-subtitle">Consulta la base de datos completa de registros epidemiológicos (2018, 2019, 2021)</p>
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

function filtros() {
  return {
    dpto: state.dep === "Todos" ? undefined : state.dep,
    enfermedad: state.disease === "Todas" ? undefined : state.disease,
    anio: state.year === "Todos" ? undefined : state.year,
    q: state.q.trim() || undefined,
  };
}

async function render() {
  const { filas, total: totalFiltrado } = await getDatos({ ...filtros(), page: state.page, per_page: state.perPage });
  total = totalFiltrado;
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  if (state.page > pages) {
    state.page = pages;
    return render();
  }

  document.getElementById("d-body").innerHTML = filas
    .map(
      (r) => `
      <tr class="data-row" data-cod-mpio="${r.cod_mpio}" data-disease="${r.enfermedad}" title="Ver predicción de ${r.municipio}">
        <td>
          <p style="font-weight:500;margin:0">${r.municipio}</p>
          <p class="muted" style="font-size:0.75rem;margin:0">${r.dpto}</p>
        </td>
        <td><span class="pill pill--${r.enfermedad.toLowerCase()}" style="text-transform:uppercase;font-size:10px;letter-spacing:0.04em">${r.enfermedad}</span></td>
        <td class="mono muted">${r.anio} · S${r.semana}</td>
        <td class="text-right mono">${r.casos}</td>
        <td class="text-right mono muted">${r.poblacion !== null ? r.poblacion.toLocaleString("es-CO") : "—"}</td>
        <td class="text-right mono" style="font-weight:500">${r.tasa ?? "—"}</td>
        <td class="text-right mono muted">${r.temperatura ?? "—"}</td>
        <td class="text-right mono muted">${r.precipitacion ?? "—"}</td>
      </tr>`,
    )
    .join("");

  document.getElementById("d-count").textContent = `Mostrando ${filas.length} de ${total.toLocaleString("es-CO")} registros`;

  document.querySelectorAll("tr.data-row").forEach((tr) =>
    tr.addEventListener("click", () => {
      window.location.href = `prediction.html?cod_mpio=${tr.dataset.codMpio}&enfermedad=${encodeURIComponent(tr.dataset.disease)}`;
    }),
  );

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
document.getElementById("d-csv").addEventListener("click", async () => {
  const { filas } = await getDatos({ ...filtros(), page: 1, per_page: 5000 });
  const header = ["Municipio", "Departamento", "Enfermedad", "Anio", "Semana", "Casos", "Poblacion", "Tasa", "Temp", "Precip"];
  const csv = [header.join(",")]
    .concat(filas.map((r) => [r.municipio, r.dpto, r.enfermedad, r.anio, r.semana, r.casos, r.poblacion, r.tasa, r.temperatura, r.precipitacion].join(",")))
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
