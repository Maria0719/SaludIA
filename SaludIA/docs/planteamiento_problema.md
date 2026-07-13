# Planteamiento del problema

## Reto
**Salud y Bienestar** — Desarrollar modelos de IA para predecir brotes de enfermedades
transmisibles usando datos de salud pública, vacunación y condiciones ambientales.

- **Datos sugeridos por el reto:** registros de morbilidad, coberturas de vacunación, calidad del
  aire, acceso a servicios de salud.
- **Impacto esperado:** mejora en la prevención y respuesta temprana del sistema de salud.
- **Nivel:** Avanzado — requiere múltiples enfoques de IA integrados: analítica predictiva,
  detección de anomalías, modelos de simulación, agentes de recomendación e IA generativa, sobre
  Big Data combinando fuentes abiertas.

## Alcance de este proyecto (a la fecha)
Este repositorio cubre, hasta ahora: recolección e integración de datos, y el componente de
**analítica predictiva + detección de anomalías**. Los componentes de simulación epidemiológica
(SEIR), agente de recomendación e IA generativa (asistente/reportes automáticos) están planteados
pero no implementados — ver `docs/conclusiones.md` para el estado exacto de cada punto del rubric.

## Por qué Dengue y Malaria
El dataset base disponible (fuente externa al reto, ver `docs/fuentes_datos.md`) contiene registros
semanales de casos de Dengue y Malaria por municipio colombiano para 2018, 2019 y 2021 (2020 no
disponible — coincide con la disrupción de reporte epidemiológico durante la pandemia de COVID-19).
Son las dos enfermedades transmisibles por vector con mayor volumen de datos abiertos disponibles a
nivel municipal en Colombia.

## Pregunta de investigación
¿Es posible predecir, con una semana de anticipación, el riesgo de brote de Dengue o Malaria a
nivel municipal en Colombia, usando únicamente el historial de casos reportados, población, y
variables ambientales disponibles como datos abiertos?

**Hallazgo central:** sí, pero la forma de plantear la pregunta al modelo importa tanto como los
datos mismos — ver `docs/marco_metodologico.md`.
