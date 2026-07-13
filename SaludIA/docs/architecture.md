# Arquitectura propuesta (backend + frontend)

> **Estado: [PENDIENTE de implementación].** Este documento describe la arquitectura planteada para
> la solución en producción; el backend y frontend todavía no existen como código.

## Flujo de datos

```
1. Base de datos histórica          (casos, población, clima por semana)
              │
              ▼
2. Cálculo de features              (rezagos, promedios, tendencia — misma lógica
              │                       que notebooks/pipeline_completo_modelo_v5.ipynb)
              ▼
3. Modelo entrenado (.pkl)          (RandomForestRegressor, cargado con joblib,
              │                       NO se reentrena en cada request)
              ▼
4. API backend                      (expone casos_predichos + nivel_riesgo)
              │
              ▼
5. Frontend                         (mapa coroplético de Colombia + semáforo de riesgo)
```

## Detalle por capa

### 1. Base de datos histórica
Tabla mínima: `municipio, enfermedad, semana, anio, casos, poblacion, clima_variables...`. Se
actualiza cada vez que llegan nuevos reportes de casos (semanal, en teoría).

### 2. Cálculo de features
**Este paso es crítico y se suele subestimar.** El modelo no recibe "casos de esta semana" —
recibe un vector de 14 features (rezagos, canal endémico, tendencia, etc.) calculado a partir del
historial. El backend debe reconstruir exactamente la misma lógica de
`notebooks/pipeline_completo_modelo_v5.ipynb` (sección de feature engineering) cada vez que
necesite una predicción nueva.

### 3. Modelo entrenado
Se entrena corriendo el notebook (o un script derivado de él) y se serializa:
```python
import joblib
joblib.dump(rf_reg, "modelo_prediccion_casos.pkl")
joblib.dump({"umbral_medio": umbral_medio, "umbral_alto": umbral_alto}, "umbrales_riesgo.pkl")
```
El backend carga el modelo **una vez al iniciar**, no en cada request.

### 4. API backend
Contrato sugerido:

```
GET /api/prediccion?municipio={cod_mpio}&enfermedad={Dengue|Malaria}
→ {
    "casos_predichos": 14.2,
    "nivel_riesgo": "Medio",       // Bajo / Medio / Alto — para dashboard
    "nivel_alerta": "Atención",    // Bajo / Atención — para decisiones automáticas
    "semana": 27,
    "anio": 2026
  }

GET /api/prediccion/nacional?semana_actual=true
→ [ { municipio, casos_predichos, nivel_riesgo, nivel_alerta }, ... ]   // para pintar el mapa completo
```

**Principio de diseño:** el backend nunca debe devolver solo un booleano `brote: true/false`. Debe
exponer el score de riesgo y dejar que el consumidor (dashboard vs. sistema de alertas) decida qué
resolución necesita — ver `docs/conclusiones.md`, sección de niveles de riesgo.

### 5. Frontend
- Vista principal: mapa de Colombia coloreado por `nivel_riesgo` (verde/amarillo/rojo).
- Al seleccionar un municipio: `casos_predichos` numérico + tendencia (`casos_lag1` vs.
  `casos_predichos`) + gráfico de la serie histórica.
- Panel de administración (opcional): permite ajustar el punto de corte de `nivel_alerta` según la
  política de sensibilidad que defina la autoridad de salud (ver tabla de puntos de operación en
  `notebooks/pipeline_completo_modelo_v3.ipynb`, sección 4).

## Reentrenamiento
El modelo debe reentrenarse periódicamente (sugerido: cada vez que haya un año completo de datos
nuevos) corriendo de nuevo el pipeline de ETL + notebook de modelado. No es un proceso en tiempo
real — es un job batch programado (ej. cron, o manualmente cada semestre).

## Stack tecnológico (según lo planteado en la propuesta general del reto)
Microservicios + APIs REST, contenedores Docker, backend en Python (FastAPI sugerido, consistente
con el resto del ecosistema), frontend a definir. Modelos de IA con scikit-learn (ya implementado) y
espacio para TensorFlow si se agrega el componente de simulación (SEIR) o redes neuronales más
complejas.
