"""Carga de datos y estado en memoria del backend.

Todo se carga una sola vez al iniciar la aplicación (ver app/main.py, lifespan):
dataset histórico, modelo entrenado, umbrales de riesgo, índice de vulnerabilidad,
la tabla de "alertas en vivo" (predicción del modelo + vulnerabilidad + semáforo,
reemplazo dinámico de alertas/salidas/alertas_finales.csv) y las anomalías
(Isolation Forest). Nada se recalcula por request.
"""

from __future__ import annotations

import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.agente_recomendacion import generar_recomendacion
from app.config import (
    DATASET_PATH,
    FEATURE_COLUMNS_PATH,
    MODEL_PATH,
    SALUDIA_ROOT,
    UMBRALES_PATH,
    VULNERABILIDAD_PATH,
)
from app.features import FEATURES, FEATURES_FULL, build_features, next_week_stub_rows

# Reutiliza la lógica ya validada del Esquema/semáforo de Fase 4 en vez de duplicarla.
sys.path.insert(0, str(SALUDIA_ROOT))
from alertas.generar_alertas import clasificar_prediccion, construir_explicacion, nivel_semaforo  # noqa: E402

SEVERIDAD_ORDEN = {"BAJO": 0, "MEDIO": 1, "ALTO": 2, "CRÍTICO": 3}


def _normalizar(texto: str) -> str:
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")
    return sin_tildes.upper().strip()


@dataclass
class Store:
    df_raw: pd.DataFrame
    vulnerabilidad_df: pd.DataFrame
    alertas_df: pd.DataFrame
    anomalias_df: pd.DataFrame
    municipios_df: pd.DataFrame = field(init=False)

    def __post_init__(self) -> None:
        self.municipios_df = self.vulnerabilidad_df.copy()
        disponibles = self.alertas_df.groupby("cod_mpio")["enfermedad"].apply(list).to_dict()
        self.municipios_df["enfermedades_disponibles"] = self.municipios_df["cod_mpio"].map(
            lambda c: disponibles.get(c, [])
        )

    # -------------------- consultas --------------------
    def municipios(self) -> list[dict]:
        return _records(self.municipios_df)

    def alertas(self, enfermedad: str | None = None, dpto: str | None = None, nivel_alerta: str | None = None) -> list[dict]:
        df = self.alertas_df
        if enfermedad:
            df = df[df["enfermedad"] == enfermedad]
        if dpto:
            df = df[df["dpto"] == dpto]
        if nivel_alerta:
            df = df[df["nivel_alerta"] == nivel_alerta]
        return _records(df)

    def departamentos_resumen(self, enfermedad: str | None = None) -> list[dict]:
        df = self.alertas_df
        if enfermedad:
            df = df[df["enfermedad"] == enfermedad]
        filas = []
        for dpto, grupo in df.groupby("dpto"):
            conteos = grupo["nivel_alerta"].value_counts().to_dict()
            peor = max(grupo["nivel_alerta"], key=lambda n: SEVERIDAD_ORDEN.get(n, -1))
            # Predominante: el nivel con más municipios (empates favorecen el más severo).
            # Se usa para el color del mapa; "peor" solo pintaría casi todo el país en rojo,
            # porque basta un municipio crítico entre decenas para dominar el departamento.
            predominante = max(conteos.items(), key=lambda kv: (kv[1], SEVERIDAD_ORDEN.get(kv[0], -1)))[0]
            filas.append(
                {
                    "dpto": dpto,
                    "nivel_alerta_peor": peor,
                    "nivel_alerta_predominante": predominante,
                    "n_municipios": int(grupo["cod_mpio"].nunique()),
                    "n_bajo": int(conteos.get("BAJO", 0)),
                    "n_medio": int(conteos.get("MEDIO", 0)),
                    "n_alto": int(conteos.get("ALTO", 0)),
                    "n_critico": int(conteos.get("CRÍTICO", 0)),
                }
            )
        filas.sort(key=lambda f: SEVERIDAD_ORDEN.get(f["nivel_alerta_peor"], -1), reverse=True)
        return filas

    def prediccion(self, cod_mpio: int, enfermedad: str) -> dict | None:
        fila = self.alertas_df[
            (self.alertas_df["cod_mpio"] == cod_mpio) & (self.alertas_df["enfermedad"] == enfermedad)
        ]
        if fila.empty:
            return None
        fila = fila.iloc[0]

        historico_df = self.df_raw[
            (self.df_raw["cod_mpio"] == cod_mpio) & (self.df_raw["enfermedad"] == enfermedad)
        ].sort_values(["anio_dataset", "semana"])
        historico = [
            {
                "anio": int(r["anio_dataset"]),
                "semana": int(r["semana"]),
                "casos": int(r["casos"]),
                "tasa": None if pd.isna(r["tasa_incidencia_100k"]) else round(float(r["tasa_incidencia_100k"]), 2),
                "temperatura": None if pd.isna(r["temperatura_promedio"]) else round(float(r["temperatura_promedio"]), 1),
                "precipitacion": None if pd.isna(r["precipitacion_promedio"]) else round(float(r["precipitacion_promedio"]), 1),
            }
            for _, r in historico_df.iterrows()
        ]

        return {
            "cod_mpio": int(fila["cod_mpio"]),
            "municipio": fila["municipio"],
            "dpto": fila["dpto"],
            "enfermedad": fila["enfermedad"],
            "casos_predichos": round(float(fila["casos_predichos"]), 2),
            "confianza": int(fila["confianza"]),
            "indice_vulnerabilidad": None if pd.isna(fila["indice_vulnerabilidad"]) else round(float(fila["indice_vulnerabilidad"]), 1),
            "vulnerabilidad": fila["vulnerabilidad"] if not pd.isna(fila["vulnerabilidad"]) else None,
            "nivel_alerta": fila["nivel_alerta"],
            "explicacion": fila["explicacion"],
            "historico": historico,
        }

    def buscar_municipio(self, nombre: str) -> dict:
        objetivo = _normalizar(nombre)
        coincidencias = self.municipios_df[
            self.municipios_df["nom_mpio"].apply(lambda n: objetivo in _normalizar(str(n)))
        ]
        if coincidencias.empty:
            return {"encontrado": False, "mensaje": f"No se encontró ningún municipio que coincida con '{nombre}'."}

        fila = coincidencias.iloc[0]
        cod_mpio = int(fila["cod_mpio"])
        predicciones = {}
        for enfermedad in ["Dengue", "Malaria"]:
            pred = self.prediccion(cod_mpio, enfermedad)
            if pred:
                predicciones[enfermedad] = {
                    "casos_predichos": pred["casos_predichos"],
                    "nivel_alerta": pred["nivel_alerta"],
                }
            else:
                predicciones[enfermedad] = "sin historial suficiente para predecir"

        return {
            "encontrado": True,
            "municipio": fila["nom_mpio"],
            "dpto": fila["dpto"],
            "indice_vulnerabilidad": float(fila["indice_vulnerabilidad"]),
            "nivel_vulnerabilidad": fila["nivel_vulnerabilidad"],
            "predicciones": predicciones,
        }

    def recomendacion(self, cod_mpio: int, enfermedad: str) -> dict | None:
        prediccion = self.prediccion(cod_mpio, enfermedad)
        if prediccion is None:
            return None

        casos_2021 = [h for h in prediccion["historico"] if h["anio"] == 2021]
        total_2021 = sum(h["casos"] for h in casos_2021)
        pico = max(casos_2021, key=lambda h: h["casos"], default=None)

        contexto = {
            "cod_mpio": prediccion["cod_mpio"],
            "municipio": prediccion["municipio"],
            "dpto": prediccion["dpto"],
            "enfermedad": prediccion["enfermedad"],
            "casos_predichos": prediccion["casos_predichos"],
            "nivel_alerta": prediccion["nivel_alerta"],
            "indice_vulnerabilidad": prediccion["indice_vulnerabilidad"],
            "vulnerabilidad": prediccion["vulnerabilidad"],
            "total_2021": total_2021,
            "pico_casos": pico["casos"] if pico else 0,
            "pico_semana": pico["semana"] if pico else 0,
        }
        return generar_recomendacion(contexto)

    def anomalias(self, enfermedad: str | None = None, severidad: str | None = None, limit: int = 40) -> list[dict]:
        df = self.anomalias_df
        if enfermedad:
            df = df[df["enfermedad"] == enfermedad]
        if severidad:
            df = df[df["severidad"] == severidad]
        return _records(df.head(limit))

    def datos(
        self,
        dpto: str | None = None,
        enfermedad: str | None = None,
        anio: int | None = None,
        q: str | None = None,
        page: int = 1,
        per_page: int = 50,
    ) -> tuple[list[dict], int]:
        df = self.df_raw
        if dpto:
            df = df[df["dpto"] == dpto]
        if enfermedad:
            df = df[df["enfermedad"] == enfermedad]
        if anio:
            df = df[df["anio_dataset"] == anio]
        if q:
            ql = q.lower()
            df = df[df["nom_mpio"].str.lower().str.contains(ql, na=False) | df["dpto"].str.lower().str.contains(ql, na=False)]

        total = len(df)
        start = (page - 1) * per_page
        pagina = df.iloc[start : start + per_page]
        filas = [
            {
                "cod_mpio": int(r["cod_mpio"]),
                "municipio": r["nom_mpio"],
                "dpto": r["dpto"],
                "enfermedad": r["enfermedad"],
                "anio": int(r["anio_dataset"]),
                "semana": int(r["semana"]),
                "casos": int(r["casos"]),
                "poblacion": None if pd.isna(r["poblacion"]) else int(r["poblacion"]),
                "tasa": None if pd.isna(r["tasa_incidencia_100k"]) else round(float(r["tasa_incidencia_100k"]), 2),
                "temperatura": None if pd.isna(r["temperatura_promedio"]) else round(float(r["temperatura_promedio"]), 1),
                "precipitacion": None if pd.isna(r["precipitacion_promedio"]) else round(float(r["precipitacion_promedio"]), 1),
            }
            for _, r in pagina.iterrows()
        ]
        return filas, total


def _records(df: pd.DataFrame) -> list[dict]:
    return df.replace({np.nan: None}).to_dict(orient="records")


def _calcular_confianza(model, X: pd.DataFrame) -> np.ndarray:
    """Índice de confianza (0-100) por fila, basado en qué tanto concuerdan entre sí
    los árboles del Random Forest para esa predicción puntual: si casi todos los
    árboles predicen un valor similar, la confianza es alta; si difieren mucho entre
    ellos, es baja. No es una cifra inventada — se deriva directamente de la dispersión
    real del ensamble ya entrenado (model.estimators_), específica para cada fila."""
    X_valores = X.to_numpy()
    predicciones_arboles = np.stack([np.expm1(arbol.predict(X_valores)) for arbol in model.estimators_])
    media = predicciones_arboles.mean(axis=0)
    desviacion = predicciones_arboles.std(axis=0)
    coef_variacion = np.divide(desviacion, media, out=np.zeros_like(desviacion), where=media > 0.01)
    return np.clip(100 * (1 - np.minimum(coef_variacion, 1)), 5, 99).round(0)


def _construir_alertas_en_vivo(
    df_raw: pd.DataFrame, vulnerabilidad_df: pd.DataFrame, model, umbral_medio: float, umbral_alto: float
) -> pd.DataFrame:
    stubs = next_week_stub_rows(df_raw)
    extendido = pd.concat([df_raw, stubs], ignore_index=True)
    df_mod = build_features(extendido)

    anclas = df_mod[df_mod["casos"].isna()].dropna(subset=FEATURES).copy()
    if anclas.empty:
        raise RuntimeError("No se pudo construir ninguna fila de predicción (revisa el dataset histórico).")

    X = anclas[FEATURES_FULL]
    anclas["casos_predichos"] = np.clip(np.expm1(model.predict(X)), 0, None).round(2)
    anclas["confianza"] = _calcular_confianza(model, X)
    anclas["cod_mpio"] = anclas["cod_mpio"].astype(int)

    resultado = anclas[["cod_mpio", "nom_mpio", "dpto", "enfermedad", "casos_predichos", "confianza"]].copy()
    columnas_vuln = [c for c in ["cod_mpio", "indice_vulnerabilidad", "nivel_vulnerabilidad"] if c in vulnerabilidad_df.columns]
    resultado = resultado.merge(vulnerabilidad_df[columnas_vuln], on="cod_mpio", how="left")
    resultado = resultado.rename(columns={"nom_mpio": "municipio", "nivel_vulnerabilidad": "vulnerabilidad"})

    resultado["nivel_prediccion"] = resultado.apply(clasificar_prediccion, axis=1)
    resultado["nivel_alerta"] = resultado.apply(
        lambda row: nivel_semaforo(row["nivel_prediccion"], row["vulnerabilidad"]), axis=1
    )
    resultado["explicacion"] = resultado.apply(
        lambda row: construir_explicacion(
            row.rename({"vulnerabilidad": "nivel_vulnerabilidad"})
        ),
        axis=1,
    )
    return resultado.dropna(subset=["nivel_alerta"]).reset_index(drop=True)


def _construir_anomalias(df_raw: pd.DataFrame) -> pd.DataFrame:
    df_mod = build_features(df_raw).dropna(subset=FEATURES).copy()
    iso = IsolationForest(contamination=0.10, random_state=42, n_jobs=1)
    df_mod["anomalia"] = iso.fit_predict(df_mod[FEATURES]) == -1

    candidatas = df_mod[df_mod["anomalia"] & (df_mod["rolling_mean_8"] > 0)].copy()
    candidatas["esperado"] = candidatas["rolling_mean_8"]
    candidatas["ratio"] = candidatas["casos"] / candidatas["esperado"]
    candidatas = candidatas[candidatas["ratio"] >= 1.8].copy()

    def severidad(ratio: float) -> str:
        if ratio >= 2.8:
            return "critical"
        if ratio >= 2.1:
            return "high"
        return "moderate"

    candidatas["severidad"] = candidatas["ratio"].apply(severidad)
    candidatas["fecha_str"] = candidatas["anio_dataset"].astype(int).astype(str) + " Sem " + candidatas["semana"].astype(int).astype(str)

    salida = candidatas[
        ["fecha_str", "anio_dataset", "semana", "nom_mpio", "dpto", "enfermedad", "casos", "esperado", "ratio", "severidad"]
    ].rename(
        columns={
            "fecha_str": "fecha",
            "anio_dataset": "anio",
            "nom_mpio": "municipio",
            "esperado": "casos_esperados",
        }
    )
    salida["esperado_redondeado"] = salida["casos_esperados"].round(0).astype(int)
    salida["casos_esperados"] = salida["esperado_redondeado"]
    salida = salida.drop(columns=["esperado_redondeado"])
    salida["ratio"] = salida["ratio"].round(1)
    return salida.sort_values("ratio", ascending=False).reset_index(drop=True)


def load_store() -> Store:
    df_raw = pd.read_csv(DATASET_PATH)
    vulnerabilidad_df = pd.read_csv(VULNERABILIDAD_PATH)

    model = joblib.load(MODEL_PATH)
    umbrales = joblib.load(UMBRALES_PATH)

    alertas_df = _construir_alertas_en_vivo(df_raw, vulnerabilidad_df, model, umbrales["umbral_medio"], umbrales["umbral_alto"])
    anomalias_df = _construir_anomalias(df_raw)

    return Store(
        df_raw=df_raw[df_raw["categoria_municipio"] == "municipio"].dropna(subset=["cod_mpio"]).copy(),
        vulnerabilidad_df=vulnerabilidad_df,
        alertas_df=alertas_df,
        anomalias_df=anomalias_df,
    )
