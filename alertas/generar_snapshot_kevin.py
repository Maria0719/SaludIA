"""Documento opcional para regenerar el snapshot de Kevin si el modelo cambia.

Este archivo no reentrena ni modifica el notebook de Kevin. Solo deja trazada la idea general:
el snapshot se obtiene ejecutando el notebook completo, tomando `test` y alineando `pred`
por posición sobre `test.reset_index(drop=True)`.

Se deja como referencia operativa para cuando Kevin actualice su pipeline.
"""

from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = REPO_ROOT / "notebooks" / "pipeline_completo_modelo_v5.ipynb"
OUTPUT_PATH = REPO_ROOT / "alertas" / "entradas" / "predicciones_kevin_snapshot.csv"


def main() -> None:
    print("Referencia de regeneración del snapshot de Kevin")
    print(f"Notebook fuente: {NOTEBOOK_PATH}")
    print(f"Snapshot esperado: {OUTPUT_PATH}")
    print("La regeneración real debe hacerse ejecutando el notebook completo y alineando pred por posición.")


if __name__ == "__main__":
    main()