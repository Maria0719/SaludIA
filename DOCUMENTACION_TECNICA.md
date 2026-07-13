# SaludIA — Documentación Técnica

Explicación detallada de cada archivo de código: qué hace, cómo funciona por dentro y cómo se conecta con el resto. Todo lo aquí descrito corresponde al código real del repositorio; no hay nada inventado.

El sistema se divide en tres bloques:

1. **Pipeline de datos y modelado** (`SaludIA/`) — produce los artefactos: el dataset maestro, el índice de vulnerabilidad, el CSV de alertas y el modelo entrenado.
2. **Backend** (`backend/`) — carga esos artefactos y sirve una API que recalcula predicciones y alertas en vivo.
3. **Frontend** (`frontend/`) — consume la API y presenta el dashboard.

Se recomienda leer en orden de flujo de datos: pipeline → backend → frontend.

---

# PARTE 1 — Pipeline de datos y modelado (`SaludIA/`)

## 1.1 `etl/etl_paso1.py` — Limpieza y geocodificación

Este script toma las fuentes crudas y las deja listas para unir. Hace cuatro cosas:

**Normalización de nombres de municipio (líneas 10-17).** La función `normalizar()` pasa cada nombre a mayúsculas, quita sufijos entre paréntesis (incluso mal cerrados) con una expresión regular, colapsa espacios y elimina tildes con `unicodedata`. Esto es necesario porque el mismo municipio aparece escrito distinto en cada fuente.

**Alias manuales (líneas 20-38).** Un diccionario `ALIAS` mapea nombres comunes a los nombres oficiales de DIVIPOLA que difieren (por ejemplo `CALI → SANTIAGO DE CALI`, `CUCUTA → SAN JOSE DE CUCUTA`). Sin esto, esos municipios no cruzarían.

**Clasificación de filas (líneas 41-47).** La función `categorizar()` separa las filas en tres categorías: `internacional` (procedencias del exterior), `departamento_sin_municipio` (municipio desconocido) y `municipio` (municipio colombiano identificable). Esto permite descartar después lo que no es geolocalizable sin perder el conteo de casos.

**Cruce y salidas.** Carga DIVIPOLA y arma un lookup por nombre normalizado (línea 55, se queda con la primera ocurrencia para evitar ambigüedad entre departamentos). Cruza los casos contra ese lookup para asignar `cod_mpio`, `dpto`, etc. (líneas 64-67). Luego procesa la población de dos archivos DANE distintos —uno para 2018-2019 y otro post-COVID para 2021— y los concatena (líneas 80-103). Finalmente agrega la calidad del aire/clima: filtra los años relevantes, se queda con nueve variables (`PM2.5`, `PM10`, `NO2`, `SO2`, `O3`, `CO`, precipitación, temperatura, humedad), promedia por municipio-año-variable y pivota a formato ancho (líneas 108-134).

Salidas intermedias: `casos_geocodificado.csv`, `poblacion_municipal.csv`, `calidad_aire_clima_anual.csv`.

## 1.2 `etl/etl_paso2_merge.py` — Unión en el dataset maestro

Une las tres salidas del paso 1 en un solo dataset.

**Prevención de un error sutil de pandas (líneas 13-17).** A diferencia de SQL, pandas trata `NaN == NaN` como coincidencia en un merge. Si no se quitaran antes las filas sin `cod_mpio`, los casos no geocodificados cruzarían contra filas vacías de población o clima. Por eso se hace `dropna` sobre las claves antes de unir.

**Validación de integridad (líneas 19-20, 34-36).** Hay `assert` que verifican que no haya claves duplicadas en población ni en calidad del aire, y que el merge no cambie el número de filas (`validate='many_to_one'` refuerza esto). Es decir: el pipeline falla ruidosamente si algo no cuadra, en vez de producir datos silenciosamente incorrectos.

**Cálculo de la tasa de incidencia (línea 38).** `tasa_incidencia_100k = casos / poblacion * 100000`.

**Salida.** Selecciona 22 columnas finales y escribe `dataset_enriquecido.csv` y un `.xlsx` con una hoja de resumen (métricas de cobertura). Este dataset de **54.629 filas** es la única entrada de todas las fases siguientes.

## 1.3 `vulnerabilidad/calcular_indice.py` — Índice de vulnerabilidad (Fase 3)

Calcula, para cada uno de los 855 municipios, un índice de vulnerabilidad del 1 al 10. **No usa Machine Learning**: es un score compuesto ponderado, transparente.

**Los cuatro factores y sus pesos:**

| Factor | Peso | Razón |
|---|---|---|
| Tasa de incidencia histórica promedio | 45% | Proxy de vulnerabilidad estructural |
| Pico histórico de incidencia | 20% | Gravedad de su peor semana |
| Calidad del aire (PM2.5) | 20% | Factor ambiental |
| Población | 15% | Municipios grandes → brotes más grandes |

**Normalización por percentiles.** La función `normalizar_0_1()` usa `serie.rank(pct=True)`, es decir, la **posición relativa** de cada municipio frente a los demás, no su valor bruto. Esto evita que unos pocos municipios extremos aplasten la escala y hace el índice interpretable como percentil.

**Imputación de datos faltantes.** La calidad del aire solo existe para 68 de los 855 municipios. La función `imputar_por_departamento()` rellena los vacíos con el promedio del departamento y, si el departamento entero no tiene dato, con el promedio nacional. Así ningún municipio queda sin valor.

**Cálculo final.** Se agrega el dataset a nivel municipio (promedio y máximo de tasa, promedio de PM2.5, población), se normaliza cada factor, se combinan con los pesos, y el resultado se escala de 1 a 10. La categoría (`Bajo`/`Medio`/`Alto`) se asigna por terciles (percentiles 33 y 66).

**Salida:** `vulnerabilidad/salidas/indice_vulnerabilidad.csv`, con columnas `cod_mpio`, `nom_mpio`, `dpto`, `tasa_prom`, `tasa_pico`, `pm25`, `poblacion`, `indice_vulnerabilidad`, `nivel_vulnerabilidad`. Reparto real: Alto 291, Medio 282, Bajo 282.

**Nota honesta (documentada en el propio código).** El reto sugiere usar cobertura de vacunación y acceso a servicios de salud, pero esos datos no tienen cobertura nacional suficiente. Se usa la tasa de incidencia histórica como proxy de vulnerabilidad estructural, que captura el efecto acumulado de esas condiciones.

## 1.4 `notebooks/pipeline_completo_modelo_v5.ipynb` — El modelo (Fase 2)

Es el notebook donde se entrenó y validó el modelo. Su lógica de preprocesamiento y entrenamiento está reproducida de forma ejecutable en `backend/features.py` y `backend/train_model.py` (ver Parte 2), precisamente para que el entrenamiento y el servicio nunca diverjan. El hallazgo metodológico central (por qué se usó regresión y no clasificación binaria) está en `docs/marco_metodologico.md`.

## 1.5 `alertas/generar_alertas.py` — Motor de alertas (Fase 4)

Produce el CSV de alertas cruzando el snapshot de predicciones con el índice de vulnerabilidad. **Este archivo es importante porque el backend importa sus funciones directamente** (no las duplica), así que la lógica de semáforo es literalmente la misma en el CSV y en la app en vivo.

**`cargar_datos()` (líneas 21-27).** Lee el snapshot de predicciones y el índice de vulnerabilidad, y convierte `cod_mpio` a entero nullable (`Int64`) en ambos para que el cruce sea exacto (por código, nunca por nombre).

**`unir_datos()` (líneas 30-33).** Merge por `cod_mpio` (left join).

**`clasificar_prediccion()` (líneas 36-54).** Clasifica los casos predichos en `Baja`/`Media`/`Alta`, con umbrales distintos por enfermedad:
- Dengue: ≤1.88 Baja, ≤3.30 Media, >3.30 Alta.
- Malaria: ≤3.68 Baja, ≤15.02 Media, >15.02 Alta.

Estos cortes (el "Esquema") fueron una decisión manual basada en la distribución observada en el set de prueba 2021; no son un estándar clínico, sino una forma de construir una señal operativa consistente (así está documentado en el código y en el README de Nicolás).

**`nivel_semaforo()` (líneas 57-69).** La matriz de decisión que cruza predicción × vulnerabilidad:

| Predicción \ Vulnerabilidad | Bajo | Medio | Alto |
|---|---|---|---|
| **Alta** | ALTO | CRÍTICO | CRÍTICO |
| **Media** | MEDIO | ALTO | CRÍTICO |
| **Baja** | BAJO | BAJO | MEDIO |

**`construir_explicacion()` (líneas 72-86).** Genera la frase en lenguaje natural por municipio, del tipo: *"Municipio en CRÍTICO: se prevén 45.00 casos de Dengue (predicción Alta) y la zona tiene vulnerabilidad alta (8.9/10)."* Si falta la vulnerabilidad, lo dice explícitamente en vez de inventarla.

**Salida:** `alertas/salidas/alertas_finales.csv` (826 filas) con `cod_mpio`, `municipio`, `enfermedad`, `casos_predichos`, `indice_vulnerabilidad`, `vulnerabilidad`, `nivel_alerta`, `explicacion`.

## 1.6 `alertas/generar_snapshot_kevin.py` — Referencia de regeneración

No ejecuta ni reentrena nada. Es un archivo de referencia que documenta cómo se obtuvo el snapshot de predicciones (ejecutando el notebook completo y alineando las predicciones por posición sobre el set de prueba). Se deja como guía operativa por si el modelo cambia.

## 1.7 `eda/eda_preprocesamiento.py`

Análisis exploratorio de datos. Genera los gráficos de `eda/graficos/` (serie temporal, top municipios, distribución de la tasa, estacionalidad, correlación con clima) que respaldan las decisiones del modelo.

---

*(Continúa en la Parte 2: Backend, y Parte 3: Frontend y Docker.)*

---

# PARTE 2 — Backend (`backend/`)

El backend es una API **FastAPI**. Su principio de diseño: cargar todo una sola vez al arrancar y no recalcular nada por request. Sirve la API y, en producción, también el frontend compilado, en el mismo puerto.

## 2.1 `app/config.py` — Rutas y configuración

Centraliza todas las rutas y variables. Calcula `BACKEND_ROOT` y, a partir de ahí, `SALUDIA_ROOT` (la carpeta `SaludIA/` hermana), de donde lee el dataset y el índice de vulnerabilidad. Define las rutas de los artefactos del modelo (`.pkl`, umbrales, feature_columns), la lista de orígenes permitidos para CORS (los puertos de Vite en desarrollo) y las variables de OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`, que por defecto es `gpt-4o-mini`). Carga variables desde un `.env` si existe (`python-dotenv`).

## 2.2 `app/features.py` — Feature engineering

Reproduce **exactamente** el preprocesamiento del notebook, y se usa tanto para entrenar como para servir, para que nunca diverjan. Define las **13 features** del modelo más `enfermedad_cod`:

- Rezagos: `casos_lag1` a `casos_lag4` (casos de 1 a 4 semanas atrás).
- Canal endémico: `rolling_mean_4/8` y `rolling_std_4/8` (media y desviación móviles de 4 y 8 semanas).
- `tendencia` (diferencia entre el rezago 1 y 2) y `promedio_historico` (media expansiva).
- Estacionalidad: `semana_sin` y `semana_cos` (codificación cíclica de la semana del año).
- `log_poblacion` (logaritmo de la población).

**`build_features()` (líneas 32-68).** Recibe el dataset crudo y devuelve una copia con esas columnas derivadas. Filtra a municipios geolocalizados, construye una fecha real a partir de año+semana (formato ISO `%G%V%u`), ordena por municipio-enfermedad-fecha y calcula todos los rezagos y ventanas móviles **por grupo** (`groupby(["cod_mpio","enfermedad"])`), para que las ventanas de un municipio no se contaminen con las de otro. Un detalle importante: las ventanas móviles se calculan sobre `casos_shift1` (los casos desplazados una semana), no sobre `casos`, para no filtrar el valor que se quiere predecir.

**`next_week_stub_rows()` (líneas 71-107).** Construye, por cada par municipio-enfermedad, una fila "hipotética" para la semana **siguiente** a la última disponible, con `casos = NaN` (es justamente lo que hay que predecir) y las variables ambientales desconocidas también en `NaN`. Maneja el cambio de año (si la semana pasa de 52). Esta fila se concatena al dataset antes de calcular features, así la fila futura recibe exactamente las mismas features que cualquier fila real. Este es el mecanismo que permite predecir "la próxima semana".

## 2.3 `train_model.py` — Entrenamiento del modelo

Entrena y serializa el modelo, reproduciendo el notebook.

**Split temporal (líneas 36-40).** Entrena con 2018-2019 y prueba con 2021, un año que el modelo nunca ve. Esto es correcto para series de tiempo: se valida sobre el futuro, no sobre datos mezclados.

**Modelo y búsqueda de hiperparámetros (líneas 42-61).** Un `RandomForestRegressor` afinado con `RandomizedSearchCV` (6 iteraciones) usando validación cruzada temporal `TimeSeriesSplit(3)` y `scoring="r2"`. El objetivo se entrena en escala logarítmica (`np.log1p(y)`) porque los casos están muy sesgados; al predecir se revierte con `np.expm1`. `random_state=42` en todo, para reproducibilidad.

**Métricas reales (líneas 64-67).** Sobre el test 2021: **R² = 0.876** y **MAE = 2.92 casos**.

**Umbrales de riesgo (líneas 69-71).** Calcula `umbral_medio` y `umbral_alto` como los percentiles 75 y 90 de los casos de entrenamiento. Se guardan junto al modelo.

**Artefactos (líneas 73-76).** Serializa tres archivos en `artifacts/`: `modelo_prediccion_casos.pkl` (el Random Forest), `umbrales_riesgo.pkl` y `feature_columns.json`. Son los que el backend carga en cada arranque.

## 2.4 `app/data_store.py` — El corazón del backend

Carga todo en memoria una vez y responde todas las consultas. Es el archivo más importante del backend.

**Reutilización de la lógica de Fase 4 (líneas 33-35).** En vez de duplicar la matriz de semáforo, **importa** `clasificar_prediccion`, `construir_explicacion` y `nivel_semaforo` desde `SaludIA/alertas/generar_alertas.py`. Garantiza que la app en vivo y el CSV de Fase 4 usen idéntica lógica.

**`load_store()` (líneas 331-346).** Función de arranque. Lee el dataset y el índice de vulnerabilidad, carga el modelo y los umbrales, construye las alertas en vivo y las anomalías, y devuelve un objeto `Store` con todo precomputado.

**`_construir_alertas_en_vivo()` (líneas 260-291).** Aquí ocurre la predicción en vivo. Genera las filas "próxima semana" con `next_week_stub_rows`, las concatena al histórico, calcula features, y se queda con las filas a predecir (las que tienen `casos` en NaN y features completas). Aplica el modelo (`np.expm1(model.predict(X))`, recortado a ≥0), cruza con la vulnerabilidad por `cod_mpio`, y aplica la misma clasificación + matriz de semáforo + explicación de la Fase 4. Resultado: **924 alertas en vivo**.

**`_calcular_confianza()` (líneas 246-257).** Un índice de confianza (5-99) por predicción, que **no es inventado**: mide qué tanto concuerdan entre sí los árboles del Random Forest para esa fila puntual. Toma la predicción de cada árbol del ensamble (`model.estimators_`), calcula el coeficiente de variación (desviación/media) y lo convierte en un porcentaje de confianza. Si los árboles coinciden, la confianza es alta; si difieren, es baja.

**`_construir_anomalias()` (líneas 294-328).** Detecta picos históricos anómalos con un `IsolationForest` (contaminación 0.10, `random_state=42`). Entre las filas marcadas como anómalas, se queda con las que además superan 1.8 veces su media móvil de 8 semanas (`ratio ≥ 1.8`), y asigna severidad: `moderate` (≥1.8), `high` (≥2.1), `critical` (≥2.8). Resultado: **333 anomalías**.

**La clase `Store` (líneas 45-239).** Guarda los DataFrames en memoria y expone los métodos que consumen los endpoints:
- `municipios()` — lista de municipios con su índice y las enfermedades disponibles.
- `alertas(enfermedad, dpto, nivel_alerta)` — alertas filtrables.
- `departamentos_resumen(enfermedad)` — agrega por departamento; calcula el nivel "peor" y el "predominante". Detalle de diseño (líneas 82-85): el mapa se colorea con el **predominante** (el nivel con más municipios), no con el peor, porque bastaría un municipio crítico entre decenas para pintar todo el departamento de rojo.
- `prediccion(cod_mpio, enfermedad)` — predicción + histórico completo del municipio.
- `buscar_municipio(nombre)` — búsqueda por nombre normalizado (sin tildes, mayúsculas), usada por el chatbot.
- `recomendacion(cod_mpio, enfermedad)` — arma el contexto y delega en el agente de OpenAI.
- `anomalias(...)` y `datos(...)` — anomalías filtrables y explorador paginado del dataset.

## 2.5 `app/main.py` — Endpoints de la API

Define la aplicación FastAPI. Usa un `lifespan` (líneas 29-32) que llama a `load_store()` una sola vez al arrancar y lo guarda en `app.state.store`. Configura CORS con los orígenes de `config.py`.

Endpoints:

| Método y ruta | Qué devuelve |
|---|---|
| `GET /health` | Estado del servicio |
| `GET /api/municipios` | Municipios con índice y enfermedades disponibles |
| `GET /api/departamentos/resumen` | Resumen por departamento (para el mapa) |
| `GET /api/alertas` | Alertas filtrables por enfermedad, dpto, nivel |
| `GET /api/prediccion/{cod_mpio}` | Predicción + histórico de un municipio |
| `GET /api/recomendacion/{cod_mpio}` | Recomendación accionable (IA) |
| `GET /api/anomalias` | Anomalías filtrables |
| `POST /api/chat` | Respuesta del chatbot |
| `GET /api/datos` | Explorador paginado del dataset |

**Montaje del frontend (líneas 121-127).** Al final del archivo (después de todas las rutas `/api/...`, para no taparlas), monta el frontend compilado en `/` con `StaticFiles`. Por eso el backend sirve la API y el sitio en el mismo puerto. El bloque solo actúa si existe la carpeta `frontend_dist`, que Docker crea.

Los endpoints de IA (`/api/recomendacion` y `/api/chat`) están envueltos en try/except: si falla el proveedor de LLM, devuelven `{"disponible": False, ...}` en vez de romper la app.

## 2.6 `app/agente_recomendacion.py` — Recomendación accionable

Convierte la salida del modelo + vulnerabilidad en un reporte accionable en lenguaje natural para una autoridad de salud. Construye un prompt con las cifras reales del municipio (casos predichos, nivel de alerta, índice de vulnerabilidad, total y pico de 2021) y le pide a OpenAI una respuesta en JSON con `resumen` y `acciones` (3-5, priorizadas). El prompt le prohíbe explícitamente inventar cifras distintas a las dadas. Cachea el resultado en memoria por (municipio, enfermedad) para no gastar tokens dos veces. Si no hay `OPENAI_API_KEY`, devuelve un mensaje indicando que no está configurado (no rompe).

## 2.7 `app/chatbot.py` — Chatbot con function calling

Un asistente que responde preguntas en español sobre Dengue y Malaria. La clave de su diseño: **nunca inventa cifras**. Usa *function calling* de OpenAI — el modelo no responde números de memoria, sino que llama a herramientas que consultan los datos reales del `Store`.

Define 5 herramientas (líneas 29-98): `ranking_riesgo`, `buscar_alertas`, `resumen_departamento`, `info_municipio` y `anomalias_recientes`. `responder_chat()` (líneas 126-159) corre un bucle de hasta 4 rondas: le pasa las herramientas al modelo, y si el modelo pide ejecutar una, `_ejecutar_tool()` la corre contra el `Store` y le devuelve el resultado real, hasta que el modelo produce una respuesta final. Si no hay clave de OpenAI, devuelve un mensaje indicándolo.

## 2.8 `requirements.txt`

FastAPI, uvicorn, pandas, numpy, **scikit-learn fijado en 1.7.2** (la versión con la que se entrenó el modelo, para que el `.pkl` cargue sin advertencias), joblib, openai y python-dotenv.

---

# PARTE 3 — Frontend (`frontend/`)

Sitio web **multipágina** construido con **Vite** (vanilla HTML/CSS/JS, sin framework). Cada página HTML carga su módulo JS, que a su vez consume la API. Usa **Leaflet** para el mapa y **Chart.js** para las gráficas.

## 3.1 `js/api.js` — Cliente de la API

Punto único de contacto con el backend. Define `API_BASE_URL` (líneas 6-7) de forma inteligente: si el sitio corre bajo el servidor de desarrollo de Vite (puerto 5173), apunta a `http://localhost:8000`; en cualquier otro caso (Docker o Render) usa `location.origin`, es decir, el mismo origen donde está publicado. Esto hace que funcione igual en desarrollo, en Docker local y en producción sin cambiar código.

Expone funciones tipadas por endpoint (`getMunicipios`, `getAlertas`, `getPrediccion`, `getAnomalias`, `getRecomendacion`, `getDatos`, `postChat`) y utilidades compartidas: `normalizeDeptName()` (para cruzar el GeoJSON —con tildes— contra los datos del backend —sin tildes—), el orden de severidad `NIVEL_ALERTA_ORDEN` y los colores del semáforo `NIVEL_ALERTA_COLOR`.

## 3.2 `js/layout.js` — Navegación y estructura común

Inyecta la barra de navegación y el pie en cada página, marcando el enlace activo. Define el menú: **Mapa, Predicción, Anomalías, Datos, Metodología**. También inyecta el widget del chatbot (una sola vez, para que aparezca en todas las páginas).

## 3.3 `js/icons.js`

Provee los íconos SVG usados en la interfaz mediante una función `icon(nombre)`.

## 3.4 `js/chatbot.js` — Widget del asistente

Widget flotante que aparece en todas las páginas. La conversación persiste en `sessionStorage` (líneas 11-19) para sobrevivir la navegación entre páginas, ya que el sitio es multipágina y no un SPA. Envía el historial a `POST /api/chat` y muestra las respuestas. Si el backend responde que el chatbot no está disponible (sin clave de OpenAI), lo comunica en la interfaz.

## 3.5 Páginas (`js/pages/`)

**`home.js`** — Página de inicio (`index.html`). Presenta el proyecto y consume `getMunicipios()` para mostrar cifras generales.

**`dashboard.js`** — El mapa (`dashboard.html`), la página principal. Carga Leaflet dinámicamente (con `try/catch` por si falla la importación) y pinta el mapa de Colombia desde el GeoJSON de departamentos. Consume `getDepartamentosResumen()` y `getAlertas()`, colorea cada departamento según su nivel predominante y permite filtrar por enfermedad (Dengue/Malaria). Incluye el panel de "Top Riesgo" con los municipios de más casos predichos.

**`prediction.js`** — Predicción por municipio (`prediction.html`), el módulo más grande (530 líneas). Carga Chart.js dinámicamente. Permite elegir un municipio y una enfermedad, y muestra la predicción de la próxima semana, el nivel de alerta, el índice de vulnerabilidad, la serie histórica graficada y, si está configurada la IA, la recomendación accionable del agente.

**`anomalies.js`** — Panel de anomalías (`anomalies.html`). Consume `getAnomalias()` y lista los picos históricos detectados, filtrables por enfermedad y severidad.

**`data.js`** — Explorador de datos (`data.html`). Consume `getDatos()` con paginación y filtros (departamento, enfermedad, año, búsqueda) para navegar el dataset crudo.

**`methodology.js`** — Metodología (`methodology.html`). Explica el reto, el enfoque y cómo se construyó el sistema (incluye la pregunta de investigación).

## 3.6 `vite.config.js` y `package.json`

`vite.config.js` declara el sitio como multipágina, registrando cada HTML como punto de entrada del build. `package.json` declara las dependencias (`chart.js`, `leaflet`, y `vite` como dev) y los scripts `dev`, `build` y `preview`.

## 3.7 `public/data/colombia-departamentos.geojson`

El polígono de los departamentos de Colombia que Leaflet usa para dibujar el mapa. Se sirve como archivo estático.

---

# PARTE 4 — Despliegue (Docker)

## 4.1 `Dockerfile` — Imagen única en dos etapas

**Etapa 1 (líneas 7-13):** sobre `node:22-slim`, instala dependencias del frontend y ejecuta `npm run build`, dejando el sitio compilado en `/fe/dist`.

**Etapa 2 (líneas 16-38):** sobre `python:3.11-slim`, instala las dependencias del backend, copia el código del backend (con el modelo `.pkl`) y la carpeta `SaludIA/` (los datos que lee en vivo), y copia el frontend compilado de la etapa 1 a `backend/frontend_dist`, que es donde `main.py` lo busca para servirlo. Arranca `uvicorn` en el puerto que indique la variable `PORT` (8000 en local, el que asigne Render en la nube).

El resultado es que **un solo contenedor** sirve la API y el sitio web en el mismo puerto.

## 4.2 `docker-compose.yml`

Levanta el servicio con un comando (`docker compose up --build`), mapea el puerto 8000 y permite pasar `OPENAI_API_KEY` como variable de entorno (comentada por defecto).

## 4.3 `.dockerignore`

Excluye de la imagen lo pesado o innecesario: `node_modules`, `dist`, `.git`, cachés de Python, el `.env` con secretos, y las carpetas de `SaludIA/` que el backend no necesita en runtime (notebooks, EDA, docs, Recursos).

## 4.4 Despliegue en Render

La imagen se despliega como un único **Web Service** de tipo Docker en Render, conectado a la rama del repositorio. Render detecta el `Dockerfile`, asigna la variable `PORT` automáticamente y publica el servicio en una URL pública. El chatbot y la recomendación por IA se activan agregando `OPENAI_API_KEY` en las variables de entorno del servicio.

**Demo en vivo:** https://saludia-3fzk.onrender.com/

---

# Resumen del flujo completo

1. **ETL** (`etl/`) integra 4 fuentes abiertas en `dataset_enriquecido.csv` (54.629 filas, 855 municipios).
2. **Fase 3** (`vulnerabilidad/`) calcula el índice de vulnerabilidad (855 municipios).
3. **Fase 2** (notebook + `train_model.py`) entrena el Random Forest (R² 0.876, MAE 2.92).
4. **Fase 4** (`alertas/`) cruza predicción × vulnerabilidad en el semáforo.
5. El **backend** carga el modelo y **recalcula 924 alertas y 333 anomalías en vivo**, reutilizando la lógica de la Fase 4, y expone todo por una API.
6. El **frontend** consume esa API y lo presenta en un dashboard con mapa, predicción, anomalías, datos y chatbot.
7. **Docker** empaqueta todo en una imagen única desplegada en Render.

Cada número de este documento proviene de ejecutar el código real del repositorio.

---

# PARTE 5 — Escalabilidad y proyección a futuro

Esta sección describe cómo el sistema está preparado, a nivel técnico, para crecer más allá del alcance actual. No documenta funcionalidad ya implementada, sino las líneas de evolución que la arquitectura habilita.

## 5.1 Ampliación a más enfermedades transmisibles

El sistema no está acoplado a Dengue y Malaria. Toda la tubería opera sobre una estructura genérica de **municipio–enfermedad–semana**:

- El feature engineering (`features.py`) calcula rezagos y ventanas móviles agrupando por `["cod_mpio", "enfermedad"]`, sin suponer cuáles son las enfermedades.
- El modelo distingue la enfermedad mediante una única variable (`enfermedad_cod`), fácilmente extensible a una codificación de más categorías.
- El motor de alertas (`generar_alertas.py`) clasifica por enfermedad mediante umbrales parametrizables por enfermedad, y la matriz de semáforo es independiente del diagnóstico.

Incorporar una nueva enfermedad transmisible (Zika, Chikunguña, Leishmaniasis, enfermedades respiratorias, etc.) requiere principalmente: sumar sus registros históricos al dataset maestro, definir sus umbrales de clasificación a partir de su propia distribución, y reentrenar. La lógica de vulnerabilidad, semáforo, explicación, API y frontend se reutiliza sin cambios estructurales.

## 5.2 Incorporación de datos en tiempo real

La versión actual se entrena y evalúa con datos históricos (2018, 2019, 2021). El diseño ya contempla el paso a datos vigentes:

- La función `next_week_stub_rows()` en `features.py` construye la predicción para "la semana siguiente a la última disponible en el dataset". A medida que ingresen semanas más recientes, esa misma función predecirá automáticamente sobre la situación actual, sin cambios de código.
- El backend recalcula las alertas **en vivo** en cada arranque a partir del dataset; por diseño, no depende de un CSV congelado.

El paso a producción consistiría en conectar el pipeline de ingesta a fuentes que se actualicen de forma continua —los reportes epidemiológicos vigentes del Instituto Nacional de Salud (INS) y las variables ambientales del IDEAM— de modo que el sistema prediga brotes sobre la situación **actual de 2026**, semana a semana, y no solo sobre años pasados. Esto convierte a SaludIA de un prototipo entrenado con historia en un sistema de vigilancia vivo.

## 5.3 Reentrenamiento automático

`train_model.py` ya está aislado como un script reproducible y determinista (`random_state=42`, split temporal explícito). Con un flujo de datos continuo, este reentrenamiento puede programarse de forma periódica —por ejemplo, al cierre de cada año epidemiológico o de forma incremental— para que el modelo mejore su precisión conforme ingresa nueva información, sin intervención manual. Los artefactos versionados (`.pkl`, umbrales, feature_columns) hacen que cada actualización sea trazable.

## 5.4 Integración institucional

Los endpoints de la API (`/api/alertas`, `/api/departamentos/resumen`, `/api/prediccion/...`) ya exponen la información en un formato consumible por terceros. A mediano plazo, esto permitiría entregar las alertas directamente a las secretarías de salud departamentales y municipales mediante notificaciones automáticas o una integración institucional, cerrando el ciclo entre la predicción y la acción preventiva en el territorio.

## 5.5 Consideraciones de despliegue a escala

El despliegue actual es una sola imagen Docker en una instancia gratuita, suficiente para la demostración. Para operación a escala real, la misma imagen puede desplegarse en instancias con más memoria (el modelo en memoria pesa ~50 MB) o replicarse detrás de un balanceador. Como el estado se carga una sola vez al arranque y las consultas no recalculan nada, el sistema escala horizontalmente sin cambios en el código.

En conjunto, estas líneas apuntan a un mismo objetivo: pasar de una herramienta que demuestra el concepto sobre datos históricos a un sistema nacional de alerta temprana —multi-enfermedad y en tiempo real— que apoye la toma de decisiones en salud pública de forma continua.
