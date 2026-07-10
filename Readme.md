# Predicción de Brotes de Dengue y Malaria en Colombia

## Problema abordado
Colombia carece de un sistema accesible que anticipe brotes de enfermedades transmisibles
(Dengue, Malaria) a nivel municipal usando datos abiertos. La vigilancia epidemiológica actual es
mayormente reactiva: se actúa después de que el brote ya es evidente en las cifras de morbilidad.

## Justificación (valor público)
Un sistema de alerta temprana permite a las autoridades de salud reforzar vigilancia y recursos
*antes* de que un brote escale, en vez de responder después del hecho. Esto es exactamente el
impacto que busca el reto: *"mejora en la prevención y respuesta temprana del sistema de salud"*.

## Cantidad de datasets utilizados
4 fuentes de datos abiertas, integradas en un solo dataset maestro (ver `docs/fuentes_datos.md`
para el detalle completo de cada una, incluyendo enlaces exactos).

## Dataset utilizado (datos.gov.co)
- **DIVIPOLA — Códigos municipios**: https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w
- **Calidad del Aire en Colombia (Promedio Anual)**: https://www.datos.gov.co/Ambiente-y-Desarrollo-Sostenible/Calidad-Del-Aire-En-Colombia-Promedio-Anual-/kekd-7v7h/about_data

## Dataset utilizado — externos
- **Casos de Dengue/Malaria por municipio-semana** (2018, 2019, 2021) — fuente original del reto.
- **Proyecciones de población municipal** (DANE, descarga manual — su sitio bloquea descargas
  automatizadas, documentado en `docs/fuentes_datos.md`).

## Variables seleccionadas
`casos`, `poblacion`, `tasa_incidencia_100k`, variables de calidad del aire/clima
(`pm25_promedio`, `precipitacion_promedio`, `temperatura_promedio`, entre otras), y variables
derivadas por ingeniería de features: rezagos temporales (`casos_lag1-4`), canal endémico
(`rolling_mean_4/8`, `rolling_std_4/8`), tendencia y promedio histórico. Detalle completo de cada
columna en `docs/diccionario_datos.md`.

## Tipo de análisis
**Predictivo — Regresión** (no clasificación binaria). Se predice el número de casos esperados por
municipio-enfermedad-semana; el nivel de riesgo (Bajo/Medio/Alto) se deriva de esa predicción. La
justificación de por qué se prefirió regresión sobre clasificación binaria está en
`docs/marco_metodologico.md` — es el hallazgo metodológico central del proyecto.

## Modelo utilizado
**Random Forest Regressor** (scikit-learn), con validación cruzada temporal (`TimeSeriesSplit`) y
afinación de hiperparámetros (`RandomizedSearchCV`). Se comparó contra HistGradientBoosting y una
red neuronal (MLP) en iteraciones previas — ver `notebooks/pipeline_completo_modelo_v5.ipynb`.

## Resultados clave
- **R² = 0.876** en el set de prueba (2021, año nunca visto por el modelo).
- **MAE = 2.92 casos** por municipio-semana.
- Nivel de riesgo derivado — vista de 2 categorías (Bajo / Atención): **85% precisión, 76% recall,
  92% accuracy**.
- Nivel de riesgo derivado — vista de 3 categorías (Bajo/Medio/Alto, para dashboard visual): Alto
  86% precisión, Bajo 94%, Medio 56% .

## Interpretación
Clasificar "brote sí/no" directamente con un umbral estadístico dio ~18-20% de precisión sin
importar cuánto se afinara el modelo — el problema no era el modelo ni los datos, era la pregunta:
un umbral binario sobre un evento raro descarta la mayoría de la información disponible.
Reformulando como regresión (predecir la magnitud) y derivando el riesgo después, se recupera esa
información y la precisión sube a >85%. La categoría "Medio" en la vista de 3 niveles es más débil
por diseño (banda angosta de solo 13 casos frente a un margen de error del modelo de ~3 casos) — se
resuelve ofreciendo ambas vistas según el uso (ver `docs/conclusiones.md`).

## Impacto potencial
Un sistema desplegado con este modelo permitiría a un ente de salud pública departamental o
municipal monitorear el riesgo semanal de Dengue/Malaria por municipio, con una confiabilidad del
~85-92% en la detección de semanas de alto riesgo, sin necesidad de infraestructura de vigilancia
adicional a la ya reportada por el sistema de salud.

## Solución en Producción (Demo en Vivo)
`[PENDIENTE]` — el backend y frontend todavía no están construidos. La arquitectura propuesta está
documentada en `docs/architecture.md`. Cuando exista despliegue, esta sección debe incluir:

**Aplicación Web / Producción:** [PENDIENTE]
**Contenedor listo (Docker Hub):** [PENDIENTE] *(o borrar si no aplica)*
**Documentación de la API:** [PENDIENTE] *(o borrar si no aplica)*

## Enlaces de acceso
`[PENDIENTE]` — falta generar `Recursos/Presentacion.pptx` y su PDF. Cuando existan:

*   [Descargar archivo original (.PPTX)](Recursos/Presentacion.pptx) — *Para abrir y editar en PowerPoint.*
*   [Ver presentación en línea (.PDF)](Recursos/presentacion.pdf) — *Abre el visor interactivo de GitHub/GitLab.*
*   [Descarga directa (.PDF)](Recursos/presentacion.pdf?raw=true&inline=false) — *Fuerza la descarga.*
