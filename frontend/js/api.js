// ============================================================
// SaludIA — cliente de la API real (backend FastAPI que envuelve
// el modelo entrenado, el índice de vulnerabilidad y el motor de alertas).
// ============================================================

export const API_BASE_URL = "http://localhost:8000";

async function get(path, params = {}) {
  const url = new URL(API_BASE_URL + path);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.pathname} respondió ${res.status}`);
  return res.json();
}

export function getMunicipios() {
  return get("/api/municipios");
}

export function getDepartamentosResumen(enfermedad) {
  return get("/api/departamentos/resumen", { enfermedad });
}

export function getAlertas({ enfermedad, dpto, nivel_alerta } = {}) {
  return get("/api/alertas", { enfermedad, dpto, nivel_alerta });
}

export function getPrediccion(codMpio, enfermedad) {
  return get(`/api/prediccion/${codMpio}`, { enfermedad });
}

export function getAnomalias({ enfermedad, severidad, limit } = {}) {
  return get("/api/anomalias", { enfermedad, severidad, limit });
}

export function getRecomendacion(codMpio, enfermedad) {
  return get(`/api/recomendacion/${codMpio}`, { enfermedad });
}

export function getDatos({ dpto, enfermedad, anio, q, page, per_page } = {}) {
  return get("/api/datos", { dpto, enfermedad, anio, q, page, per_page });
}

export async function postChat(mensajes) {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensajes }),
  });
  if (!res.ok) throw new Error(`/api/chat respondió ${res.status}`);
  return res.json();
}

// Normaliza nombres de departamento para cruzar el GeoJSON (con tildes, mixed case)
// con los datos del backend (mayúsculas, sin tildes por la codificación del dataset original).
export function normalizeDeptName(name) {
  return name
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toUpperCase()
    .trim();
}

// Orden de severidad para colorear el mapa y ordenar rankings.
export const NIVEL_ALERTA_ORDEN = { BAJO: 0, MEDIO: 1, ALTO: 2, "CRÍTICO": 3 };

export const NIVEL_ALERTA_COLOR = {
  BAJO: "#10b981",
  MEDIO: "#fbbf24",
  ALTO: "#f97316",
  "CRÍTICO": "#e11d48",
};

export const NIVEL_ALERTA_DOT_CLASS = {
  BAJO: "dot--low",
  MEDIO: "dot--moderate",
  ALTO: "dot--orange",
  "CRÍTICO": "dot--critical",
};
