// ============================================================
// Widget flotante del asistente conversacional de SaludIA.
// Se inyecta una sola vez desde renderLayout() (js/layout.js), así aparece
// en todas las páginas. La conversación persiste en sessionStorage para
// sobrevivir la navegación entre páginas (este sitio es multi-página, no un SPA).
// ============================================================
import { icon } from "./icons.js";
import { postChat } from "./api.js";

const STORAGE_KEY = "saludia_chat_historial";

function cargarHistorial() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function guardarHistorial(historial) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(historial));
  } catch {
    // sessionStorage puede no estar disponible (modo privado); el chat sigue
    // funcionando, solo no persiste entre navegaciones.
  }
}

// Escapa el texto como HTML (evita inyección) y solo después le aplica **negrita**
// y saltos de línea — nunca se reintroduce HTML crudo del modelo o del usuario.
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

export function renderChatbot() {
  if (document.getElementById("chatbot-root")) return;

  const historial = cargarHistorial();

  const root = document.createElement("div");
  root.id = "chatbot-root";
  root.innerHTML = `
    <button class="chatbot-toggle" id="chatbot-toggle" aria-label="Abrir asistente de SaludIA">
      ${icon("messageCircle", "", 26)}
    </button>
    <div class="chatbot-panel" id="chatbot-panel" hidden>
      <div class="chatbot-panel__head">
        <span>${icon("sparkles", "", 18)} Asistente SaludIA</span>
        <button class="chatbot-panel__close" id="chatbot-close" aria-label="Cerrar chat">${icon("x", "", 18)}</button>
      </div>
      <div class="chatbot-messages" id="chatbot-messages"></div>
      <form class="chatbot-input" id="chatbot-form">
        <input type="text" id="chatbot-text" placeholder="Ej: ¿dónde hay más dengue?" autocomplete="off" />
        <button type="submit" aria-label="Enviar">${icon("send", "", 18)}</button>
      </form>
    </div>
  `;
  document.body.appendChild(root);

  const panel = document.getElementById("chatbot-panel");
  const toggle = document.getElementById("chatbot-toggle");
  const messagesEl = document.getElementById("chatbot-messages");
  const form = document.getElementById("chatbot-form");
  const input = document.getElementById("chatbot-text");

  function pintarMensajes() {
    if (!historial.length) {
      messagesEl.innerHTML = `
        <div class="chatbot-msg chatbot-msg--bot">
          Hola, soy el asistente de SaludIA. Pregúntame, por ejemplo:
          <br>· "¿Dónde hay más riesgo de dengue?"
          <br>· "¿Cómo está Quibdó con malaria?"
          <br>· "¿Qué anomalías críticas hay esta semana?"
        </div>`;
      return;
    }
    messagesEl.innerHTML = historial
      .map((m) => `<div class="chatbot-msg chatbot-msg--${m.role === "user" ? "user" : "bot"}">${escaparHtml(m.content)}</div>`)
      .join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      pintarMensajes();
      input.focus();
    }
  });
  document.getElementById("chatbot-close").addEventListener("click", () => {
    panel.hidden = true;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = input.value.trim();
    if (!texto) return;
    input.value = "";

    historial.push({ role: "user", content: texto });
    guardarHistorial(historial);
    pintarMensajes();

    messagesEl.insertAdjacentHTML(
      "beforeend",
      '<div class="chatbot-msg chatbot-msg--bot chatbot-msg--typing" id="chatbot-typing">Escribiendo…</div>',
    );
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const respuesta = await postChat(historial);
      historial.push({
        role: "assistant",
        content: respuesta.disponible ? respuesta.respuesta : respuesta.mensaje,
      });
    } catch {
      historial.push({ role: "assistant", content: "No se pudo contactar al backend. Intenta de nuevo en un momento." });
    }
    guardarHistorial(historial);
    pintarMensajes();
  });

  pintarMensajes();
}
