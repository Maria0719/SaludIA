# Guía de validación / reproducibilidad

## Cómo reproducir el dataset final desde cero

1. Descargar las fuentes crudas (ver `docs/fuentes_datos.md` para los enlaces exactos):
   - `dataset.xlsx` (casos de Dengue/Malaria — fuente original del proyecto)
   - Correr `notebooks/01_recoleccion_datos_gov_co.ipynb` en Google Colab para obtener
     `divipola.csv`, `morbilidad.csv`, `calidad_aire.csv`
   - Descargar manualmente los 2 archivos de población del DANE (enlaces en `fuentes_datos.md`)
2. Colocar todos los archivos crudos en una misma carpeta.
3. Ajustar las rutas al inicio de `etl/etl_paso1.py` si es necesario, y correrlo:
   ```
   python etl_paso1.py
   ```
   Esto genera `casos_geocodificado.csv`, `poblacion_municipal.csv`, `calidad_aire_clima_anual.csv`.
4. Correr `etl/etl_paso2_merge.py`:
   ```
   python etl_paso2_merge.py
   ```
   Esto genera `dataset_enriquecido.csv` y `.xlsx` — deben coincidir con los que están en
   `data/processed/` (54,629 filas, 22 columnas).

## Cómo reproducir el modelo

1. Abrir `notebooks/pipeline_completo_modelo_v5.ipynb` en Google Colab.
2. Subir `data/processed/dataset_enriquecido.csv` a la sesión.
3. `Entorno de ejecución > Ejecutar todas`.
4. Verificar que las métricas de la sección de regresión coincidan aproximadamente con:
   - R² ≈ 0.876
   - MAE ≈ 2.92 casos
   - Reporte de clasificación de "nivel de riesgo" (3 niveles): Alto ~86% precisión, Bajo ~94%,
     Medio ~56%.
   - Vista de 2 niveles (sección 4b): Atención ~85% precisión / 76% recall, accuracy ~92%.

Pequeñas variaciones (±2-3 puntos porcentuales) entre corridas son normales por la naturaleza
estocástica de Random Forest, aunque se fijó `random_state=42` en todos los modelos para
minimizarlas.

## Qué NO debe cambiar entre corridas
- El split temporal (train=2018-2019, test=2021) es fijo — no debe aleatorizarse.
- Los umbrales de riesgo (`umbral_medio`, `umbral_alto`) se calculan **solo** con el set de
  entrenamiento — si al modificar el notebook accidentalmente se calculan con el dataset completo
  o con el test, los resultados de precisión quedarán inflados de forma no válida (fuga de datos).

## Checklist de control de calidad (ya aplicado, para referencia)
- [x] Sin duplicados exactos en el dataset final.
- [x] Sin fuga de información temporal en features (`shift()` antes de `rolling()`).
- [x] Sin fuga de información en la definición de umbrales de riesgo (calculados solo con train).
- [x] Validación de cardinalidad en cada merge (`validate='many_to_one'` + assert de conteo de filas).
- [x] Todos los notebooks entregados fueron ejecutados de punta a punta sin errores antes de
      entregarse (no son código sin probar).
