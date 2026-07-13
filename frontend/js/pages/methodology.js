import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";

renderLayout();

const status = [
  { name: "Recolección e integración de datos", done: true },
  { name: "Analítica predictiva (ML)", done: true },
  { name: "Detección de anomalías", done: true },
  { name: "Agente de recomendación & IA Generativa", done: true },
];

const tech = [
  { ic: "server", title: "Arquitectura", desc: "Microservicios, APIs REST y contenedores Docker" },
  { ic: "database", title: "Backend / Frontend", desc: "Python, FastAPI, HTML, CSS y JavaScript" },
  { ic: "cpu", title: "Modelos de IA", desc: "Scikit-Learn (predicción y anomalías), OpenAI (agente de recomendación)" },
];

document.getElementById("method-root").innerHTML = `
  <div class="method__intro">
    <h1 class="page-title">Metodología y Acerca del Proyecto</h1>
    <p class="page-subtitle">Detalles del proyecto de predicción de brotes epidemiológicos</p>
    <p style="font-size:1.125rem;color:var(--text-muted);line-height:1.6;margin-top:16px">
      Este proyecto aborda el reto de <strong style="color:#1e293b">Salud y Bienestar (Nivel Avanzado)</strong>,
      construyendo una plataforma de analítica predictiva para anticipar brotes epidemiológicos en Colombia.
    </p>
  </div>

  <section class="stack gap-4">
    <h2 class="section-title">El Reto de Investigación</h2>
    <div class="blockquote">
      <p>"¿Cómo podemos anticipar, con una semana de anticipación, el riesgo de brote de Dengue o
      Malaria a nivel municipal en Colombia, usando historial de casos, población y variables
      ambientales de fuentes abiertas?"</p>
    </div>
    <p class="muted" style="line-height:1.6">
      Nos enfocamos en Dengue y Malaria por ser las enfermedades transmitidas por vectores con
      mayor cobertura de datos abiertos a nivel municipal en Colombia.
    </p>
  </section>

  <section class="stack gap-6">
    <h2 class="section-title">Estado del Proyecto</h2>
    <div class="card table-wrap">
      <table class="data-table">
        <thead><tr><th>Componente</th><th>Estado</th></tr></thead>
        <tbody>
          ${status
            .map(
              (s) => `
              <tr>
                <td style="font-weight:500;color:${s.done ? "#1e293b" : "var(--text-muted)"}">${s.name}</td>
                <td>
                  <span class="pill ${s.done ? "pill--ok" : "pill--planned"}">
                    ${icon(s.done ? "check" : "circleDashed", "", 14)}
                    ${s.done ? "Implementado" : "Planeado"}
                  </span>
                </td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </section>

  <section class="stack gap-6">
    <h2 class="section-title">Stack Tecnológico</h2>
    <div class="tech-grid">
      ${tech
        .map(
          (t) => `
          <div class="tech-card">
            <span style="color:var(--teal)">${icon(t.ic, "", 24)}</span>
            <div><h3>${t.title}</h3><p>${t.desc}</p></div>
          </div>`,
        )
        .join("")}
    </div>
  </section>

  <section class="callout">
    <h3 style="font-weight:700;font-size:1.125rem;margin:0 0 8px">Nota sobre los datos:</h3>
    <ul>
      <li>El año 2020 no se incluye en los análisis debido a la disrupción en los reportes causada por la pandemia de COVID-19.</li>
      <li>Variables ambientales como NO2, CO y SO2 presentan datos faltantes en aproximadamente el 97% de los registros municipales. El sistema tolera esta escasez sin fallar.</li>
      <li>El nivel de riesgo se calcula según percentiles de la tasa de incidencia nacional.</li>
    </ul>
  </section>
`;
