import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";
import { getMunicipios } from "../api.js";

renderLayout();

const municipios = await getMunicipios();
const departamentos = new Set(municipios.map((m) => m.dpto)).size;

const shortcuts = [
  { title: "Predicción", desc: "Estimación de riesgo a 1 semana de anticipación.", ic: "activity", path: "prediction.html" },
  { title: "Anomalías", desc: "Detección de picos inusuales de casos reportados.", ic: "alertTriangle", path: "anomalies.html" },
  { title: "Datos", desc: "Explorador completo de registros epidemiológicos.", ic: "database", path: "data.html" },
];

document.getElementById("home-root").innerHTML = `
  <section class="hero">
    <div class="hero__copy">
      <h1 class="hero__title">
        Predicción de brotes de
        <span class="hero__accent">Dengue y Malaria</span>
        en Colombia
      </h1>
      <p class="hero__lead">
        Plataforma de analítica predictiva y detección de anomalías para anticipar, con una
        semana de anticipación, el riesgo de brote a nivel municipal usando historial de
        casos, población y variables ambientales.
      </p>
      <div>
        <a class="btn btn--primary" href="dashboard.html">
          Ver zonas de riesgo ${icon("chevronRight", "", 20)}
        </a>
      </div>
    </div>
    <div class="hero__media">
      <img src="/hero-brotes.png" alt="Mapa de Colombia con puntos de riesgo y app móvil mostrando alertas de brotes" />
    </div>
  </section>

  <section class="stat-band">
    <div class="stat-band__icon stat-band__icon--map">
      <img
        src="/colombia.png"
        alt="Mapa de Colombia"
        width="52"
        height="52"
        onerror="this.onerror=null; this.src='public/colombia.png';"
      />
    </div>
    <h2 class="stat-band__num">${municipios.length} Municipios estudiados</h2>
    <p class="stat-band__sub">
      De los ${departamentos} departamentos de Colombia con datos en el dataset, monitoreamos y
      analizamos la gran mayoría del territorio nacional.
    </p>
  </section>

  <section class="shortcuts">
    ${shortcuts
      .map(
        (s) => `
        <a class="shortcut" href="${s.path}">
          <div class="shortcut__icon">${icon(s.ic, "", 28)}</div>
          <div>
            <h3 class="shortcut__title">${s.title}</h3>
            <p class="muted">${s.desc}</p>
          </div>
        </a>`,
      )
      .join("")}
  </section>
`;
