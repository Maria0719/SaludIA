# SaludIA — Sistema de Alerta Temprana de Brotes de Dengue y Malaria

**Predecir el brote antes de que ocurra.**

SaludIA es un sistema de alerta temprana que predice, a nivel municipal en Colombia, el riesgo de brotes de Dengue y Malaria para la próxima semana, usando únicamente datos abiertos. Combina un modelo de Machine Learning (predicción de casos), un índice de vulnerabilidad territorial y un motor de alertas tipo semáforo, todo servido en un dashboard web interactivo.

**Demo en vivo:** https://saludia-3fzk.onrender.com/

---

## Tabla de contenido

- [El problema](#el-problema)
- [Qué hace el sistema](#qué-hace-el-sistema)
- [Arquitectura](#arquitectura)
- [Resultados reales](#resultados-reales)
- [Fuentes de datos](#fuentes-de-datos)
- [Cómo ejecutarlo](#cómo-ejecutarlo)
- [Estructura del repositorio](#estructura-del-repositorio)
- [El equipo](#el-equipo)

---

## El problema

La vigilancia epidemiológica en Colombia es mayormente **reactiva**: se actúa después de que un brote ya es evidente en las cifras de morbilidad. Los datos se reportan con retraso, las variables (clima, ambiente, morbilidad) se analizan por separado, y no se mide qué tan preparada está cada zona para responder. El resultado es que se pierden semanas críticas de prevención.

La pregunta que guía el proyecto:

> ¿Cómo anticipar, con una semana de adelanto, el riesgo de brote de Dengue o Malaria a nivel municipal en Colombia, usando historial de casos, población y variables ambientales de fuentes abiertas?

---

## Qué hace el sistema

SaludIA responde esa pregunta en tres capas que se integran:

1. **Predicción de casos (Machine Learning).** Un modelo Random Forest predice cuántos casos de Dengue o Malaria habrá en cada municipio la semana siguiente a la última disponible en el dataset.

2. **Índice de vulnerabilidad territorial.** Un score compuesto del 1 al 10 mide qué tan preparada está cada zona para enfrentar un brote (no usa ML; es transparente y explicable).

3. **Motor de alertas tipo semáforo.** Cruza la predicción con la vulnerabilidad mediante una matriz de decisión y marca cada municipio como BAJO, MEDIO, ALTO o CRÍTICO, generando además una explicación en lenguaje natural.

Sobre eso, el backend expone además detección de **anomalías** (picos históricos por encima de lo esperado), un **agente de recomendación** y un **chatbot** que consulta los datos reales.

Todo se presenta en un dashboard web con mapa interactivo de Colombia, predicción por municipio, panel de anomalías y explorador de datos.

---

## Arquitectura

El proyecto tiene dos grandes bloques: un **pipeline de datos y modelado** (carpeta `SaludIA/`) que produce los artefactos, y una **aplicación web** (`backend/` + `frontend/`) que los sirve en vivo.

```
 FUENTES ABIERTAS            PIPELINE (SaludIA/)             APLICACIÓN (backend + frontend)
 ────────────────            ───────────────────             ───────────────────────────────
 DIVIPOLA                    etl/  → dataset_enriquecido.csv
 Calidad del aire   ───────► vulnerabilidad/ → indice_...csv  ─────►  backend/ (FastAPI)
 Casos dengue/malaria        alertas/ → alertas_finales.csv           carga modelo .pkl,
 Población (DANE)            notebooks/ → modelo_prediccion.pkl       recalcula alertas EN VIVO
                                                                      y sirve la API + el sitio
                                                                             │
                                                                             ▼
                                                                      frontend/ (Vite)
                                                                      mapa, predicción, chatbot
```

Punto clave del diseño: el **backend no lee un CSV de alertas precalculado**. En cada arranque carga el modelo entrenado y **recalcula las predicciones y alertas en vivo** desde el dataset histórico, aplicando exactamente la misma lógica de semáforo de la Fase 4 (importa esas funciones en vez de duplicarlas). El archivo `alertas/salidas/alertas_finales.csv` es el entregable de la Fase 4 como hito; la app usa la versión dinámica.

El despliegue es una **sola imagen Docker**: una etapa compila el frontend, y otra levanta el backend, que sirve la API y el sitio web compilado en el mismo puerto. Eso permite un solo comando local y un solo servicio en Render.

---

## Resultados reales

Todas las cifras provienen de ejecutar el código sobre los datos del repositorio.

**Modelo de predicción** (Random Forest Regressor, evaluado sobre 2021, un año que el modelo nunca vio en entrenamiento):

| Métrica | Valor |
|---|---|
| R² (set de prueba 2021) | 0.876 |
| MAE (error medio absoluto) | 2.92 casos por municipio-semana |

**Cobertura de datos:**

| Dato | Valor |
|---|---|
| Filas del dataset maestro | 54.629 |
| Años cubiertos | 2018, 2019, 2021 (no hay 2020) |
| Enfermedades | Dengue y Malaria |
| Municipios geolocalizados | 855 |
| Casos totales registrados | 437.226 |

**Salidas del sistema:**

| Salida | Valor |
|---|---|
| Municipios con índice de vulnerabilidad | 855 (Alto 291 · Medio 282 · Bajo 282) |
| Alertas generadas en vivo por el backend | 924 (Bajo 466 · Medio 291 · Crítico 124 · Alto 43) |
| Anomalías históricas detectadas | 333 |

> Nota honesta sobre dos números de alertas: el archivo estático `alertas/salidas/alertas_finales.csv` tiene **826 filas** (se construyó desde el snapshot de predicciones de la Fase 4). El backend, en cambio, genera **924 alertas en vivo** porque recalcula la predicción de la próxima semana para cada par municipio–enfermedad con historial suficiente. La versión en vivo es la que ve el usuario; el CSV es el hito de la Fase 4.

---

## Fuentes de datos

Cuatro fuentes abiertas, integradas en un solo dataset maestro (detalle completo en `SaludIA/docs/fuentes_datos.md`):

1. **Casos de Dengue y Malaria** por municipio-semana (2018, 2019, 2021) — fuente del reto.
2. **DIVIPOLA** — códigos oficiales de municipios (datos.gov.co), para geocodificar.
3. **Calidad del aire y clima** (datos.gov.co) — PM2.5, PM10, NO2, temperatura, precipitación, humedad, etc.
4. **Proyecciones de población municipal** (DANE) — para calcular tasas de incidencia por 100.000 habitantes.

---

## Cómo ejecutarlo

### Opción A — Con Docker (recomendada, levanta todo)

Requiere Docker Desktop instalado y corriendo. Desde la raíz del repositorio:

```bash
docker compose up --build
```

Luego abre **http://localhost:8000**. Un solo comando compila el frontend, levanta el backend, carga el modelo y sirve el sitio completo.

Para activar el chatbot y el agente de recomendación (opcional), agrega tu clave de OpenAI en `docker-compose.yml` (variable `OPENAI_API_KEY`). Sin la clave, el mapa, la predicción, las alertas y las anomalías funcionan igual; solo el chat y la recomendación por IA quedan desactivados.

### Opción B — Backend y frontend por separado (desarrollo)

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (en otra terminal):

```bash
cd frontend
npm install
npm run dev        # abre en http://localhost:5173
```

### Reproducir el pipeline de datos y el modelo (opcional)

Los artefactos ya están en el repositorio, pero se pueden regenerar:

```bash
# Índice de vulnerabilidad (desde SaludIA/)
python SaludIA/vulnerabilidad/calcular_indice.py

# Motor de alertas CSV (Fase 4)
python SaludIA/alertas/generar_alertas.py

# Reentrenar el modelo (desde backend/)
cd backend && python train_model.py
```

---

## Estructura del repositorio

```
SaludIA (repo)
├── Dockerfile                 Imagen única: compila frontend + sirve backend
├── docker-compose.yml         Un comando levanta todo
│
├── backend/                   API FastAPI (sirve el modelo en vivo)
│   ├── app/
│   │   ├── main.py            Endpoints de la API + montaje del frontend
│   │   ├── data_store.py      Carga y estado en memoria; alertas y anomalías en vivo
│   │   ├── features.py        Feature engineering (compartido con el entrenamiento)
│   │   ├── agente_recomendacion.py   Recomendación accionable vía OpenAI
│   │   ├── chatbot.py         Chatbot con function calling sobre datos reales
│   │   └── config.py          Rutas y configuración
│   ├── train_model.py         Entrena y serializa el modelo
│   ├── artifacts/             modelo_prediccion_casos.pkl, umbrales, feature_columns
│   └── requirements.txt
│
├── frontend/                  Sitio Vite multipágina (HTML/CSS/JS + Leaflet + Chart.js)
│   ├── index.html, dashboard.html, prediction.html, anomalies.html,
│   │   data.html, methodology.html
│   ├── js/                    api.js, layout.js, chatbot.js, icons.js, pages/
│   ├── css/styles.css
│   └── public/data/colombia-departamentos.geojson
│
└── SaludIA/                   Pipeline de datos y modelado
    ├── data/processed/dataset_enriquecido.csv     Dataset maestro (54.629 filas)
    ├── etl/                   etl_paso1.py, etl_paso2_merge.py
    ├── eda/                   Análisis exploratorio + gráficos
    ├── vulnerabilidad/        calcular_indice.py → indice_vulnerabilidad.csv
    ├── alertas/               generar_alertas.py → alertas_finales.csv
    ├── notebooks/             pipeline_completo_modelo_v5.ipynb (modelo)
    └── docs/                  Metodología, diccionario de datos, fuentes, conclusiones
```

---

## Escalabilidad y proyección a futuro

SaludIA está diseñado como una base extensible, no como un ejercicio cerrado. La arquitectura por capas (datos → modelo → vulnerabilidad → alertas → dashboard) permite crecer en varias direcciones sin rehacer el sistema. Las líneas de evolución previstas son:

**1. Ampliación a más enfermedades transmisibles.** El modelo y el motor de alertas no están atados a Dengue y Malaria: operan sobre una estructura genérica de municipio–enfermedad–semana. Incorporar nuevas enfermedades transmisibles (por ejemplo Zika, Chikunguña, Leishmaniasis o enfermedades respiratorias) requiere principalmente sumar sus registros históricos al dataset y ajustar los umbrales de clasificación, reutilizando la misma tubería de features, entrenamiento y semáforo ya validada.

**2. Incorporación de datos en tiempo real.** La versión actual se entrena y evalúa con datos históricos (2018, 2019 y 2021). El siguiente paso natural es conectar el sistema a fuentes que se actualicen de forma continua —los reportes epidemiológicos vigentes del Instituto Nacional de Salud y las variables ambientales del IDEAM— para producir predicciones sobre la situación **actual de 2026**, y no únicamente sobre años pasados. Esto convertiría a SaludIA de un prototipo entrenado con historia a un sistema de vigilancia vivo, capaz de anticipar brotes reales semana a semana.

**3. Actualización automática del modelo.** Con un flujo de datos continuo, el reentrenamiento del modelo puede programarse de forma periódica (por ejemplo, cada vez que se cierre un nuevo año epidemiológico), de modo que el sistema mejore su precisión a medida que ingresa nueva información, sin intervención manual.

**4. Integración con las autoridades de salud.** A mediano plazo, las alertas podrían entregarse directamente a las secretarías de salud departamentales y municipales mediante notificaciones o una API institucional, cerrando el ciclo entre la predicción y la acción preventiva en el territorio.

En conjunto, estas líneas apuntan a un mismo objetivo: pasar de una herramienta que demuestra el concepto sobre datos históricos a un sistema nacional de alerta temprana, multi-enfermedad y en tiempo real, que apoye la toma de decisiones en salud pública de forma continua.

---

## El equipo

| Integrante | Responsabilidad |
|---|---|
| **Nicolás** | Fase 1 (datos/ETL) y Fase 4 (motor de alertas) |
| **Kevin** | Fase 2 (modelo de predicción) |
| **María José (Majo)** | Fase 3 (índice de vulnerabilidad) |
| **Valeria** | Fase 5 (frontend / dashboard) |

**Reto:** Salud y Bienestar — Competencia de Inteligencia Artificial.

Para la documentación técnica detallada del código (archivo por archivo, cómo funciona cada parte por dentro), ver **DOCUMENTACION_TECNICA.md**. En las ramas creadas esta el proceso de como se fue desarrolland todo, siendo la rama "docker" la que tiene la útima versión actualiazada y final"
