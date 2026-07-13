"""Genera el CSV final de alertas a partir del snapshot de Kevin y el índice de vulnerabilidad.

Los cortes de la clasificación de casos (Esquema) fueron una decisión manual basada en la
distribución observada en el set de prueba 2021, no en un estándar clínico. El propósito aquí es
operativo: combinar predicción + vulnerabilidad para producir una señal de alerta reproducible.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_PATH = REPO_ROOT / "alertas" / "entradas" / "predicciones_kevin_snapshot.csv"
VULNERABILIDAD_PATH = REPO_ROOT / "vulnerabilidad" / "salidas" / "indice_vulnerabilidad.csv"
OUTPUT_PATH = REPO_ROOT / "alertas" / "salidas" / "alertas_finales.csv"


def cargar_datos() -> tuple[pd.DataFrame, pd.DataFrame]:
    snapshot = pd.read_csv(SNAPSHOT_PATH)
    vulnerabilidad = pd.read_csv(VULNERABILIDAD_PATH)

    snapshot["cod_mpio"] = pd.to_numeric(snapshot["cod_mpio"], errors="coerce").astype("Int64")
    vulnerabilidad["cod_mpio"] = pd.to_numeric(vulnerabilidad["cod_mpio"], errors="coerce").astype("Int64")
    return snapshot, vulnerabilidad


def unir_datos(snapshot: pd.DataFrame, vulnerabilidad: pd.DataFrame) -> pd.DataFrame:
    columnas_vuln = [c for c in ["cod_mpio", "indice_vulnerabilidad", "nivel_vulnerabilidad"] if c in vulnerabilidad.columns]
    merged = snapshot.merge(vulnerabilidad[columnas_vuln], on="cod_mpio", how="left")
    return merged


def clasificar_prediccion(row: pd.Series) -> str | pd.NA:
    enfermedad = row["enfermedad"]
    casos = row["casos_predichos"]

    if enfermedad == "Dengue":
        if casos <= 1.88:
            return "Baja"
        if casos <= 3.30:
            return "Media"
        return "Alta"

    if enfermedad == "Malaria":
        if casos <= 3.68:
            return "Baja"
        if casos <= 15.02:
            return "Media"
        return "Alta"

    return pd.NA


def nivel_semaforo(nivel_prediccion: str | pd.NA, nivel_vulnerabilidad: str | pd.NA) -> str | pd.NA:
    matriz = {
        ("Alta", "Bajo"): "ALTO",
        ("Alta", "Medio"): "CRÍTICO",
        ("Alta", "Alto"): "CRÍTICO",
        ("Media", "Bajo"): "MEDIO",
        ("Media", "Medio"): "ALTO",
        ("Media", "Alto"): "CRÍTICO",
        ("Baja", "Bajo"): "BAJO",
        ("Baja", "Medio"): "BAJO",
        ("Baja", "Alto"): "MEDIO",
    }
    return matriz.get((nivel_prediccion, nivel_vulnerabilidad), pd.NA)


def construir_explicacion(row: pd.Series) -> str:
    mapa_vulnerabilidad = {"Bajo": "baja", "Medio": "media", "Alto": "alta"}
    nivel_vulnerabilidad = row["nivel_vulnerabilidad"]
    if pd.isna(nivel_vulnerabilidad):
        return (
            f"Municipio en {row['nivel_alerta']}: se prevén {row['casos_predichos']:.2f} casos de {row['enfermedad']} "
            f"(predicción {row['nivel_prediccion']}) y no hay nivel de vulnerabilidad disponible."
        )

    vulnerabilidad_texto = mapa_vulnerabilidad.get(nivel_vulnerabilidad, str(nivel_vulnerabilidad).lower())
    return (
        f"Municipio en {row['nivel_alerta']}: se prevén {row['casos_predichos']:.2f} casos de {row['enfermedad']} "
        f"(predicción {row['nivel_prediccion']}) y la zona tiene vulnerabilidad {vulnerabilidad_texto} "
        f"({row['indice_vulnerabilidad']:.1f}/10)."
    )


def generar_alertas() -> pd.DataFrame:
    snapshot, vulnerabilidad = cargar_datos()
    merged = unir_datos(snapshot, vulnerabilidad)

    merged["nivel_prediccion"] = merged.apply(clasificar_prediccion, axis=1)
    merged["nivel_alerta"] = merged.apply(
        lambda row: nivel_semaforo(row["nivel_prediccion"], row["nivel_vulnerabilidad"]),
        axis=1,
    )
    merged["explicacion"] = merged.apply(construir_explicacion, axis=1)

    resultado = merged[
        [
            "cod_mpio",
            "nom_mpio",
            "enfermedad",
            "casos_predichos",
            "indice_vulnerabilidad",
            "nivel_vulnerabilidad",
            "nivel_alerta",
            "explicacion",
        ]
    ].copy()
    resultado = resultado.rename(columns={"nom_mpio": "municipio", "nivel_vulnerabilidad": "vulnerabilidad"})
    resultado = resultado[
        [
            "cod_mpio",
            "municipio",
            "enfermedad",
            "casos_predichos",
            "indice_vulnerabilidad",
            "vulnerabilidad",
            "nivel_alerta",
            "explicacion",
        ]
    ]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    resultado.to_csv(OUTPUT_PATH, index=False)
    return resultado


def main() -> None:
    resultado = generar_alertas()
    print(f"Guardado: {OUTPUT_PATH}")
    print(f"Filas: {len(resultado)}")
    print(resultado.head(10).to_string(index=False))


if __name__ == "__main__":
    main()