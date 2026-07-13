"""Rutas y configuración compartidas del backend. SaludIA/ no se modifica; solo se lee."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")
REPO_ROOT = BACKEND_ROOT.parent
SALUDIA_ROOT = REPO_ROOT / "SaludIA"

DATASET_PATH = SALUDIA_ROOT / "data" / "processed" / "dataset_enriquecido.csv"
VULNERABILIDAD_PATH = SALUDIA_ROOT / "vulnerabilidad" / "salidas" / "indice_vulnerabilidad.csv"

ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "modelo_prediccion_casos.pkl"
UMBRALES_PATH = ARTIFACTS_DIR / "umbrales_riesgo.pkl"
FEATURE_COLUMNS_PATH = ARTIFACTS_DIR / "feature_columns.json"

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
