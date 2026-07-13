"""Entrena y serializa el modelo de predicción de casos.

Reproduce el split y el entrenamiento de notebooks/pipeline_completo_modelo_v5.ipynb
(secciones 2-4): mismo split temporal (train=2018-2019, test=2021), mismo
RandomForestRegressor con RandomizedSearchCV y random_state=42, mismos umbrales de
riesgo (percentiles 75/90 del train). Se corre una sola vez (o cada vez que haya un
año completo de datos nuevos, según docs/architecture.md) para producir los artefactos
que carga el backend en cada arranque.

Uso: python train_model.py
"""

from __future__ import annotations

import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit

from app.config import ARTIFACTS_DIR, DATASET_PATH, FEATURE_COLUMNS_PATH, MODEL_PATH, UMBRALES_PATH
from app.features import FEATURES, FEATURES_FULL, build_features


def main() -> None:
    print(f"Leyendo dataset: {DATASET_PATH}")
    df_raw = pd.read_csv(DATASET_PATH)

    print("Calculando features...")
    df_mod = build_features(df_raw)
    df_mod = df_mod.dropna(subset=FEATURES).copy()

    train = df_mod[df_mod["anio_dataset"].isin([2018, 2019])].sort_values("fecha")
    test = df_mod[df_mod["anio_dataset"] == 2021]
    X_train, y_train = train[FEATURES_FULL], train["casos"]
    X_test, y_test = test[FEATURES_FULL], test["casos"]
    print(f"Train: {len(X_train):,} filas | Test: {len(X_test):,} filas")

    tscv = TimeSeriesSplit(n_splits=3)
    param_dist = {
        "n_estimators": [150, 200, 300],
        "max_depth": [8, 10, 14],
        "min_samples_leaf": [3, 5, 10],
        "max_features": ["sqrt", 0.5],
    }
    reg_search = RandomizedSearchCV(
        RandomForestRegressor(random_state=42, n_jobs=1),
        param_distributions=param_dist,
        n_iter=6,
        scoring="r2",
        cv=tscv,
        random_state=42,
        n_jobs=1,
    )
    reg_search.fit(X_train, np.log1p(y_train))
    print("Mejores hiperparámetros:", reg_search.best_params_)

    rf_reg = reg_search.best_estimator_
    pred = np.clip(np.expm1(rf_reg.predict(X_test)), 0, None)

    mae = mean_absolute_error(y_test, pred)
    r2 = r2_score(y_test, pred)
    print(f"\nMAE: {mae:.2f} casos (referencia docs/validation_guide.md: ~2.92)")
    print(f"R²: {r2:.3f} (referencia docs/validation_guide.md: ~0.876)")

    umbral_medio = float(np.quantile(y_train, 0.75))
    umbral_alto = float(np.quantile(y_train, 0.90))
    print(f"umbral_medio={umbral_medio:.1f} | umbral_alto={umbral_alto:.1f}")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(rf_reg, MODEL_PATH)
    joblib.dump({"umbral_medio": umbral_medio, "umbral_alto": umbral_alto}, UMBRALES_PATH)
    FEATURE_COLUMNS_PATH.write_text(json.dumps(FEATURES_FULL, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nGuardado: {MODEL_PATH}")
    print(f"Guardado: {UMBRALES_PATH}")
    print(f"Guardado: {FEATURE_COLUMNS_PATH}")


if __name__ == "__main__":
    main()
