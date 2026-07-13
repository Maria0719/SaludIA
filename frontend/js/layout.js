// Shared navigation + footer, injected into every page.
import { icon } from "./icons.js";
import { renderChatbot } from "./chatbot.js";

const navItems = [
  { name: "Mapa", path: "dashboard.html" },
  { name: "Predicción", path: "prediction.html" },
  { name: "Anomalías", path: "anomalies.html" },
  { name: "Datos", path: "data.html" },
  { name: "Metodología", path: "methodology.html" },
];

function currentFile() {
  const parts = window.location.pathname.split("/");
  const last = parts[parts.length - 1];
  return last === "" ? "index.html" : last;
}

export function renderLayout() {
  const here = currentFile();

  const navRoot = document.getElementById("nav-root");
  if (navRoot) {
    navRoot.innerHTML = `
      <nav class="nav" aria-label="Principal">
        <a class="nav__brand ${here === "index.html" ? "is-active" : ""}" href="index.html" aria-label="Ir al inicio">
          <span>SaludIA</span>
        </a>
        <div class="nav__scroll">
          <ul class="nav__list">
            ${navItems
              .map((item) => {
                const active = item.match ? item.match.includes(here) : here === item.path;
                return `
                  <li>
                    <a class="nav__link ${active ? "is-active" : ""}" href="${item.path}"${
                      active ? ' aria-current="page"' : ""
                    }>
                      <span>${item.name}</span>
                      ${item.badge ? `<span class="nav__badge">${item.badge}</span>` : ""}
                    </a>
                  </li>`;
              })
              .join("")}
          </ul>
        </div>
      </nav>`;
  }

  const footerRoot = document.getElementById("footer-root");
  if (footerRoot) {
    footerRoot.innerHTML = `
      <footer class="footer">
        <div class="footer__inner">
          <div class="footer__icon">${icon("shieldAlert", "", 32).replace('stroke="currentColor"', 'stroke="#21CCC6"')}</div>
          <p class="footer__text">
            La prevención de enfermedades transmitidas por vectores como el Dengue y la Malaria
            requiere de una respuesta proactiva. Al usar datos históricos y variables ambientales
            para crear modelos predictivos, podemos pasar de una postura reactiva a una preventiva,
            salvando vidas y optimizando recursos de salud pública.
          </p>
        </div>
      </footer>`;
  }

  renderChatbot();
}
