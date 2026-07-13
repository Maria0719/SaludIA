"""Feature engineering para el modelo de predicción de casos.

Reproduce exactamente la sección 2 ("Preprocesamiento y feature engineering") de
notebooks/pipeline_completo_modelo_v5.ipynb. Se usa tanto para entrenar (train_model.py)
como para servir (data_store.py) — misma función, para que nunca diverjan, que es el
riesgo que señala docs/architecture.md.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

FEATURES = [
    "casos_lag1",
    "casos_lag2",
    "casos_lag3",
    "casos_lag4",
    "rolling_mean_4",
    "rolling_std_4",
    "rolling_mean_8",
    "rolling_std_8",
    "tendencia",
    "promedio_historico",
    "semana_sin",
    "semana_cos",
    "log_poblacion",
]
FEATURES_FULL = FEATURES + ["enfermedad_cod"]


def build_features(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Recibe el dataset crudo (una fila por municipio-enfermedad-semana) y devuelve
    una copia con las columnas derivadas que consume el modelo. Filas sin `cod_mpio`
    (municipios no geolocalizados) quedan con features en NaN y se descartan aguas
    abajo con dropna(subset=FEATURES), igual que en el notebook."""
    df_mod = df_raw[df_raw["categoria_municipio"] == "municipio"].copy()
    df_mod = df_mod.dropna(subset=["cod_mpio"]).copy()

    df_mod["fecha"] = pd.to_datetime(
        df_mod["anio_dataset"].astype(int).astype(str)
        + df_mod["semana"].astype(int).astype(str).str.zfill(2)
        + "1",
        format="%G%V%u",
    )
    df_mod = df_mod.sort_values(["cod_mpio", "enfermedad", "fecha"]).reset_index(drop=True)

    df_mod["semana_sin"] = np.sin(2 * np.pi * df_mod["semana"] / 52)
    df_mod["semana_cos"] = np.cos(2 * np.pi * df_mod["semana"] / 52)
    df_mod["log_poblacion"] = np.log1p(df_mod["poblacion"])

    grupo = df_mod.groupby(["cod_mpio", "enfermedad"])["casos"]
    for lag in [1, 2, 3, 4]:
        df_mod[f"casos_lag{lag}"] = grupo.shift(lag)
    df_mod["casos_shift1"] = grupo.shift(1)

    g2 = df_mod.groupby(["cod_mpio", "enfermedad"])["casos_shift1"]
    df_mod["rolling_mean_4"] = g2.transform(lambda s: s.rolling(4, min_periods=3).mean())
    df_mod["rolling_std_4"] = g2.transform(lambda s: s.rolling(4, min_periods=3).std())
    df_mod["rolling_mean_8"] = g2.transform(lambda s: s.rolling(8, min_periods=5).mean())
    df_mod["rolling_std_8"] = g2.transform(lambda s: s.rolling(8, min_periods=5).std())
    df_mod["tendencia"] = df_mod["casos_lag1"] - df_mod["casos_lag2"]
    df_mod["promedio_historico"] = df_mod.groupby(["cod_mpio", "enfermedad"])[
        "casos_shift1"
    ].transform(lambda s: s.expanding(min_periods=3).mean())

    df_mod["enfermedad_cod"] = (df_mod["enfermedad"] == "Dengue").astype(int)
    return df_mod


def next_week_stub_rows(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Construye, por cada (cod_mpio, enfermedad), una fila hipotética para la semana
    siguiente a la última semana disponible en el dataset (casos=NaN, es lo que hay
    que predecir). Se concatena al dataset crudo antes de llamar build_features, así
    la fila hipotética recibe exactamente las mismas features que cualquier fila real."""
    municipios = df_raw[df_raw["categoria_municipio"] == "municipio"].dropna(subset=["cod_mpio"]).copy()
    municipios["fecha"] = pd.to_datetime(
        municipios["anio_dataset"].astype(int).astype(str)
        + municipios["semana"].astype(int).astype(str).str.zfill(2)
        + "1",
        format="%G%V%u",
    )
    ultimas = municipios.sort_values("fecha").groupby(["cod_mpio", "enfermedad"]).tail(1).copy()

    siguiente_semana = ultimas["semana"] + 1
    siguiente_anio = ultimas["anio_dataset"].where(siguiente_semana <= 52, ultimas["anio_dataset"] + 1)
    siguiente_semana = siguiente_semana.where(siguiente_semana <= 52, 1)

    ultimas["semana"] = siguiente_semana
    ultimas["anio_dataset"] = siguiente_anio
    columnas_desconocidas = [
        "casos",
        "tasa_incidencia_100k",
        "pm25_promedio",
        "pm10_promedio",
        "no2_promedio",
        "so2_promedio",
        "o3_promedio",
        "co_promedio",
        "precipitacion_promedio",
        "temperatura_promedio",
        "humedad_promedio",
    ]
    for col in columnas_desconocidas:
        ultimas[col] = np.nan
    ultimas = ultimas.drop(columns=["fecha"])
    return ultimas
