# Fuentes de datos

## Usadas en el dataset final

| Fuente | Origen | Enlace | Notas |
|---|---|---|---|
| Casos de Dengue/Malaria | Externa al reto (aportada al inicio del proyecto) | — | Semanal, por municipio, 2018/2019/2021. Falta 2020 completo. |
| DIVIPOLA — Códigos municipios | datos.gov.co | https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w | Usado para normalizar nombres de municipio y obtener códigos oficiales. |
| Calidad del Aire en Colombia (Promedio Anual) | datos.gov.co | https://www.datos.gov.co/Ambiente-y-Desarrollo-Sostenible/Calidad-Del-Aire-En-Colombia-Promedio-Anual-/kekd-7v7h/about_data | Incluye variables de calidad del aire (PM2.5, PM10, NO2, SO2, O3, CO) y clima (precipitación, temperatura, humedad) — las mismas estaciones miden ambos. Cobertura: 111 de 963 municipios. |
| Proyecciones de población municipal | DANE (dane.gov.co) | [2020-2035](https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/DCD-area-proypoblacion-Mun-2020-2035-ActPostCOVID-19.xlsx) / [2005-2020](https://www.dane.gov.co/files/investigaciones/poblacion/proyepobla06_20/ProyeccionMunicipios2005_2020.xls) | **No es datos.gov.co** — es DANE directo. Su sitio bloquea descarga automatizada (bot detection); se descargó manualmente. Documentar esta limitación si el reto exige estrictamente datos.gov.co. |

## Evaluadas pero descartadas

| Fuente | Enlace | Por qué se descartó |
|---|---|---|
| Morbilidad General | https://www.datos.gov.co/Salud-y-Protecci-n-Social/Morbilidad-General/gbte-byrg/about_data | Solo cubre un municipio (Pasto, Nariño), un año parcial (abril-diciembre 2021), y contiene apenas 34 registros de Dengue/Malaria de 634,334 totales — no aporta al análisis nacional. |
| Cobertura de Vacunación PAI — Valle del Cauca | https://www.datos.gov.co/Salud-y-Protecci-n-Social/Cobertura-de-Vacunaci-n-PAI-en-el-Valle-del-Cauca/uw8e-gzpp/about_data | La API de datos.gov.co devolvió error 500 (falla del servidor, no del proceso de consulta) en el momento de la recolección. Reintentar en el futuro o buscar fuente alternativa. |
| Precipitación IDEAM (dataset crudo) | https://www.datos.gov.co/Ambiente-y-Desarrollo-Sostenible/Precipitaci-n/s54a-sgyg | Reemplazada por las variables de clima ya incluidas en el dataset de Calidad del Aire (mismas estaciones). El dataset crudo de precipitación es demasiado grande para agregación en tiempo real vía la API pública sin token. |

## Proceso de recolección
El notebook `notebooks/01_recoleccion_datos_gov_co.ipynb` descarga Morbilidad, Calidad del Aire y
DIVIPOLA directamente desde la API SODA de Socrata (`https://www.datos.gov.co/resource/{id}.json`),
con un enfoque de "explorar primero, descargar después" (columnas + conteo de filas antes de decidir
si se trae todo de un golpe o se pagina).
