# Marco metodológico

## 1. Recolección e integración de datos (ETL)
Ver `docs/fuentes_datos.md` para el detalle de cada fuente. Resumen del proceso
(`etl/etl_paso1.py` y `etl/etl_paso2_merge.py`):

1. Normalización de nombres de municipio: mayúsculas, eliminación de tildes, remoción de sufijos
   entre paréntesis, y un diccionario de 17 alias manuales para nombres oficiales DIVIPOLA que
   difieren del nombre común (ej. "Cali" → "Santiago de Cali").
2. Cruce contra DIVIPOLA para obtener códigos oficiales de municipio y departamento.
3. Construcción de tabla de población municipal (2018, 2019, 2021) a partir de dos archivos DANE
   (2005-2020 y 2020-2035, combinados para cubrir los 3 años).
4. Construcción de tabla de calidad del aire/clima agregada por año y municipio.
5. Merge final con **validación explícita de cardinalidad** (`validate='many_to_one'` + assert de
   conteo de filas) — se detectó y corrigió un bug real de fuga de NaN durante el desarrollo (ver
   `docs/conclusiones.md`, sección de control de calidad).

**Resultado:** 97.0% del volumen de casos geocodificado; 95.4% de las filas con población asignada;
calidad del aire/clima disponible solo para 111 de 963 municipios (limitación documentada — las
estaciones de monitoreo están concentradas en zonas urbanas).

## 2. Análisis exploratorio (EDA)
`eda/eda_preprocesamiento.py` — serie temporal nacional, estacionalidad por semana epidemiológica,
top municipios por volumen de casos, distribución de la tasa de incidencia, correlación con
variables climáticas. Gráficos en `eda/graficos/`.

## 3. Ingeniería de features
Por cada serie municipio+enfermedad, calculada con `shift()` antes de cualquier `rolling()` para
evitar fuga de información (*data leakage*) hacia el futuro:

- Rezagos: `casos_lag1` a `casos_lag4`.
- Canal endémico: `rolling_mean_4/8`, `rolling_std_4/8` (media y desviación de las 4/8 semanas
  anteriores).
- `tendencia`: diferencia entre `casos_lag1` y `casos_lag2`.
- `promedio_historico`: promedio expandido de toda la historia previa de la serie.
- Codificación cíclica de la semana del año (`semana_sin`, `semana_cos`).
- `log_poblacion`: log-transformada, para no dejar que las ciudades grandes dominen el modelo.

## 4. El hallazgo metodológico central: por qué regresión y no clasificación binaria

### Iteración 1-2: clasificación binaria de "brote"
Se definió inicialmente "brote" como *casos > media + 1.5 desviaciones estándar de las 4 semanas
anteriores* (aproximación normal, método de "canal endémico" estándar en vigilancia
epidemiológica). Con tuning de hiperparámetros (`RandomizedSearchCV` + `TimeSeriesSplit`),
comparación de 3 modelos (Random Forest, HistGradientBoosting, red neuronal con sobremuestreo) y
optimización de umbral de decisión, la precisión de la clase "Brote" se mantuvo estancada en
~18-20%.

### Iteración 3: diagnóstico del problema de la etiqueta
Se identificó que la aproximación normal **no es válida para conteos bajos** (proceso de Poisson,
no normal) — en municipios con 1-2 casos/semana de promedio, un salto a 4 casos puede ser ruido
estadístico puro, no un brote real. Se comprobó: de los "brotes" marcados en municipios de bajo
volumen bajo la definición normal, ~75% desaparecían al usar un umbral de Poisson estadísticamente
correcto. Corregir la etiqueta mejoró el ROC-AUC de 0.65 a 0.74, pero la precisión en un umbral fijo
no mejoró sustancialmente — el modelo discriminaba mejor, pero el evento seguía siendo raro y
binarizado.

### Iteración 4 (versión final): reformulación como regresión
Se probaron adicionalmente features espaciales (presión regional del departamento) — no mejoraron
el resultado de forma significativa — y se verificó que los datos no tenían artefactos de reporte
(picos de fin de mes/trimestre por reporte en lote). Con el dataset descartado como causa, se
reformuló el problema: en vez de clasificar "brote sí/no", **el modelo predice directamente el
número de casos esperados** (regresión, `RandomForestRegressor` sobre `log1p(casos)`), y el nivel
de riesgo se deriva de esa predicción con umbrales fijados solo en el set de entrenamiento.

**Resultado:** R²=0.876, MAE=2.92 casos, y 85-87% de precisión detectando semanas de alto riesgo
real — verificado con umbrales tanto por percentil como clínicos fijos (≥5, ≥10, ≥15 casos), todos
calculados sin tocar el set de prueba (2021).

## 5. Validación
- **Split temporal** (no aleatorio): entrenamiento en 2018-2019, prueba en 2021 — año completo que
  el modelo nunca vio, simulando el caso de uso real de predecir el futuro con datos del pasado.
- **Validación cruzada dentro del entrenamiento**: `TimeSeriesSplit` (no `KFold` estándar, que
  filtraría información del futuro hacia el pasado en series de tiempo).
- **Umbrales de riesgo** calculados exclusivamente con datos de entrenamiento (percentiles 75/90 de
  2018-2019), nunca con el año de prueba.

Ver `docs/validation_guide.md` para instrucciones de cómo reproducir estos resultados.
