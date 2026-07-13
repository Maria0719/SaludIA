# Conclusiones

##Resultados alcanzados
- Dataset enriquecido de 54,629 registros, integrando 4 fuentes de datos abiertas, con 97% de
  geocodificación de casos y control de calidad documentado (incluyendo la corrección de un bug
  real de merge con fuga de datos).
- Modelo de regresión con R²=0.876 sobre un año completo nunca visto en entrenamiento.
- Sistema de niveles de riesgo derivado con 85-92% de confiabilidad, en dos resoluciones (2 niveles para alertas automáticas, 3 niveles para visualización).
- Proceso de diagnóstico y mejora iterativa documentado de principio a fin
## Estado frente al rubric de "Nivel Avanzado"

| Requisito del rubric | Estado |
|---|---|
| Analítica predictiva | ✅ Completo (regresión, R²=0.876) |
| Detección de anomalías | ✅ Completo (Isolation Forest, complementario al modelo de riesgo) |
| Modelos de simulación | ❌ Pendiente (SEIR) |
| Agentes de recomendación | ❌ Pendiente |
| IA generativa (asistentes/reportes) | ❌ Pendiente |
| Big Data — múltiples fuentes, estructuradas | ✅ Parcial (3 fuentes integradas; falta vacunación por caída de API externa) |
| Redes neuronales / arquitecturas híbridas | ⚠️ Explorado en iteraciones previas (MLP), no en el modelo final (Random Forest) |
| Escalabilidad / despliegue | ❌ Pendiente (backend/frontend no implementados — ver `docs/architecture.md`) |

## Limitaciones honestas
1. **Falta el año 2020 completo** en los datos de casos — probable disrupción de reporte por
   COVID-19. No se pudo rellenar ni interpolar de forma confiable.
2. **Cobertura de clima/calidad del aire limitada** a 111 de 963 municipios — las estaciones de
   monitoreo están concentradas en zonas urbanas, no en zonas rurales donde ocurre buena parte de
   la Malaria.
3. **Vacunación no incluida** — la fuente de datos.gov.co disponible (Valle del Cauca) devolvió
   error 500 de servidor al momento de la recolección.
4. **La categoría "Medio"** en la vista de 3 niveles de riesgo tiene menor precisión (56%) que
   "Bajo" y "Alto" — es una limitación estructural (banda angosta de 13 casos frente a un margen de
   error del modelo de ~3 casos), no un error de implementación. Se ofrece la vista de 2 niveles
   como alternativa de mayor confiabilidad para decisiones automáticas.
5. **Población de DANE, no de datos.gov.co** — revisar con el evaluador si esto cumple el
   requisito de "datos abiertos de datos.gov.co" o si se requiere buscar una fuente alternativa
   dentro de esa plataforma específicamente.

## Trabajo futuro
- Implementar el componente de simulación epidemiológica (modelo SEIR) parametrizado con los datos
  ya recolectados.
- Agregar un agente de recomendación / asistente conversacional (LLM) que interprete las
  predicciones y sugiera acciones — mencionado en la propuesta original del proyecto.
- Construir backend + frontend según `docs/architecture.md`.
- Reintentar la fuente de vacunación cuando la API de datos.gov.co esté disponible, o buscar una
  fuente nacional alternativa.
- Explorar variables espaciales más ricas (features de municipios vecinos, no solo del mismo
  departamento) — la versión probada en este proyecto no mostró mejora significativa, pero el
  enfoque en sí sigue siendo razonable con más ingeniería.
