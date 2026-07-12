import { renderLayout } from "../layout.js";
import { icon } from "../icons.js";

renderLayout();

document.getElementById("seir-root").innerHTML = `
  <div class="center-card__inner">
    <div style="color:var(--text-soft);display:flex;justify-content:center;margin-bottom:16px">
      ${icon("clock", "", 48)}
    </div>
    <h2 style="font-size:1.25rem;font-weight:700;color:var(--blue);margin:0 0 8px">Simulación SEIR</h2>
    <p class="muted" style="margin:0 0 16px">
      Esta funcionalidad se encuentra en desarrollo. Próximamente podrás ejecutar
      simulaciones epidemiológicas interactivas.
    </p>
    <a href="index.html" style="color:var(--teal);font-weight:700">Volver al inicio</a>
  </div>
`;
