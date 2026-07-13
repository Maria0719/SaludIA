# Diccionario de datos — `dataset_enriquecido.csv`

54,629 filas · granularidad: municipio × enfermedad × semana epidemiológica.

| Columna | Tipo | Descripción |
|---|---|---|
| `anio_dataset` | int | Año epidemiológico (2018, 2019 o 2021). |
| `semana` | int | Semana epidemiológica (1-52). |
| `municipio` | str | Nombre de municipio tal como venía en la fuente original de casos (sin normalizar). |
| `categoria_municipio` | str | `municipio` (geolocalizado), `departamento_sin_municipio` (municipio desconocido dentro del departamento) o `internacional` (caso importado del exterior). |
| `cod_dpto` | int/NaN | Código DIVIPOLA del departamento (NaN si no se pudo geocodificar). |
| `dpto` | str/NaN | Nombre oficial del departamento. |
| `cod_mpio` | int/NaN | Código DIVIPOLA del municipio. |
| `nom_mpio` | str/NaN | Nombre oficial del municipio (DIVIPOLA). |
| `enfermedad` | str | `Dengue` o `Malaria`. |
| `enfermedad_codigo` | int | Código numérico de la enfermedad (fuente original). |
| `casos` | int | Casos reportados esa municipio-enfermedad-semana. Variable objetivo del modelo. |
| `poblacion` | float/NaN | Población municipal proyectada para ese año (DANE). |
| `tasa_incidencia_100k` | float/NaN | `casos / poblacion * 100000`. |
| `pm25_promedio` … `co_promedio` | float/NaN | Promedio anual de contaminantes (calidad del aire). Solo 111 municipios. |
| `precipitacion_promedio` | float/NaN | Precipitación promedio anual (mm), misma cobertura que calidad del aire. |
| `temperatura_promedio` | float/NaN | Temperatura promedio anual (°C), misma cobertura. |
| `humedad_promedio` | float/NaN | Humedad relativa promedio anual (%), misma cobertura. |

## Features derivadas (calculadas en el notebook de modelado, no están en el CSV crudo)

| Feature | Descripción |
|---|---|
| `casos_lag1` … `casos_lag4` | Casos de la misma serie municipio+enfermedad, 1 a 4 semanas atrás. |
| `rolling_mean_4` / `rolling_std_4` | Media/desviación estándar de las 4 semanas anteriores (excluyendo la semana actual). |
| `rolling_mean_8` / `rolling_std_8` | Igual, ventana de 8 semanas. |
| `tendencia` | `casos_lag1 - casos_lag2` — ¿la curva sube o baja? |
| `promedio_historico` | Promedio expandido de toda la historia previa de esa serie. |
| `semana_sin` / `semana_cos` | Codificación cíclica de la semana del año. |
| `log_poblacion` | `log(poblacion + 1)`. |
| `enfermedad_cod` | 1 si Dengue, 0 si Malaria. |
| `casos_predichos` | Salida del modelo de regresión — casos esperados la semana siguiente. |
| `nivel_riesgo` | Bajo / Medio / Alto, derivado de `casos_predichos` (percentiles 75/90 del entrenamiento). |
| `nivel_alerta` | Bajo / Atención, versión colapsada de `nivel_riesgo` para decisiones automáticas. |
