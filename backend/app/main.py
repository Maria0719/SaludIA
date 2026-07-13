"""API de SaludIA: sirve el modelo entrenado (predicción de casos), el índice de
vulnerabilidad y el motor de alertas de SaludIA/, en vivo, para el frontend.

Arrancar (desde backend/): uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.chatbot import responder_chat
from app.config import CORS_ORIGINS
from app.data_store import Store, load_store


class MensajeChat(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    mensajes: list[MensajeChat]


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = load_store()
    yield


app = FastAPI(title="SaludIA API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _store(app: FastAPI) -> Store:
    return app.state.store


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/municipios")
def municipios():
    return _store(app).municipios()


@app.get("/api/departamentos/resumen")
def departamentos_resumen(enfermedad: str | None = Query(default=None)):
    return _store(app).departamentos_resumen(enfermedad=enfermedad)


@app.get("/api/alertas")
def alertas(
    enfermedad: str | None = Query(default=None),
    dpto: str | None = Query(default=None),
    nivel_alerta: str | None = Query(default=None),
):
    return _store(app).alertas(enfermedad=enfermedad, dpto=dpto, nivel_alerta=nivel_alerta)


@app.get("/api/prediccion/{cod_mpio}")
def prediccion(cod_mpio: int, enfermedad: str = Query(...)):
    resultado = _store(app).prediccion(cod_mpio, enfermedad)
    if resultado is None:
        raise HTTPException(status_code=404, detail="Sin predicción para ese municipio/enfermedad")
    return resultado


@app.get("/api/recomendacion/{cod_mpio}")
def recomendacion(cod_mpio: int, enfermedad: str = Query(...)):
    try:
        resultado = _store(app).recomendacion(cod_mpio, enfermedad)
    except Exception as exc:  # errores de red/API del proveedor de LLM
        return {"disponible": False, "mensaje": f"No se pudo generar la recomendación: {exc}"}
    if resultado is None:
        raise HTTPException(status_code=404, detail="Sin predicción para ese municipio/enfermedad")
    return resultado


@app.get("/api/anomalias")
def anomalias(
    enfermedad: str | None = Query(default=None),
    severidad: str | None = Query(default=None),
    limit: int = Query(default=40, le=200),
):
    return _store(app).anomalias(enfermedad=enfermedad, severidad=severidad, limit=limit)


@app.post("/api/chat")
def chat(payload: ChatRequest):
    historial = [m.model_dump() for m in payload.mensajes]
    try:
        return responder_chat(_store(app), historial)
    except Exception as exc:  # errores de red/API del proveedor de LLM
        return {"disponible": False, "mensaje": f"No se pudo responder: {exc}"}


@app.get("/api/datos")
def datos(
    dpto: str | None = Query(default=None),
    enfermedad: str | None = Query(default=None),
    anio: int | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
):
    filas, total = _store(app).datos(dpto=dpto, enfermedad=enfermedad, anio=anio, q=q, page=page, per_page=per_page)
    return {"filas": filas, "total": total, "page": page, "per_page": per_page}

# --- Servir el frontend compilado en el mismo puerto que la API ---
from pathlib import Path as _Path
from fastapi.staticfiles import StaticFiles as _StaticFiles

_FRONTEND_DIST = _Path(__file__).resolve().parents[1] / "frontend_dist"
if _FRONTEND_DIST.exists():
    app.mount("/", _StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")