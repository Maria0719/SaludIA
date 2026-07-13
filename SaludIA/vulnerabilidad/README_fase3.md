# Fase 3 — Índice de Vulnerabilidad Territorial

**Encargada:** Majo
**Rama:** `majo`

## Qué hace esta fase

Calcula, para cada municipio de Colombia, un **Índice de Vulnerabilidad**
del 1 al 10 (10 = municipio más vulnerable ante un brote). Este índice
mide qué tan preparada está una zona para enfrentar un brote, y luego se
cruza con las predicciones del modelo de Kevin (Fase 4) para generar las
alertas finales.

**No usa Machine Learning.** Es un score compuesto y ponderado, transparente
y explicable.

## Entrada

- `data/processed/dataset_enriquecido.csv` — el dataset maestro de Kevin.

## Salida

- `vulnerabilidad/salidas/indice_vulnerabilidad.csv` — una fila por municipio.

Este archivo es la **única salida** de la Fase 3 hacia el resto del equipo.
Kevin lo consume en la Fase 4 cruzándolo por la columna `cod_mpio`.

### Columnas del archivo de salida

| Columna | Descripción |
|---|---|
| `cod_mpio` | Código DIVIPOLA del municipio (clave para cruzar con el dataset de Kevin). |
| `nom_mpio` | Nombre del municipio. |
| `dpto` | Departamento. |
| `tasa_prom` | Tasa de incidencia histórica promedio (casos por 100.000 hab). |
| `tasa_pico` | Tasa de incidencia en su peor semana histórica. |
| `pm25` | Calidad del aire (PM2.5), imputada por departamento donde faltaba. |
| `poblacion` | Población municipal. |
| `indice_vulnerabilidad` | **El índice final, de 1 a 10.** |
| `nivel_vulnerabilidad` | Categoría: Bajo / Medio / Alto. |

## Cómo se calcula el índice

Se combinan 4 factores ponderados:

| Factor | Peso | Por qué |
|---|---|---|
| Tasa de incidencia histórica promedio | 45% | Mejor proxy de vulnerabilidad estructural: si un municipio se enferma mucho, refleja baja vacunación, poco acceso a salud y malas condiciones. |
| Pico histórico de incidencia | 20% | Qué tan grave fue su peor momento. |
| Calidad del aire (PM2.5) | 20% | Factor ambiental. Solo 68 municipios lo tienen; el resto se imputa por departamento. |
| Población | 15% | Municipios más grandes = brotes potencialmente más grandes. |

Cada factor se normaliza por **percentiles** (posición relativa frente a los
demás municipios), no por valor bruto, para que el índice se reparta de forma
pareja y no lo dominen unos pocos municipios extremos.

## Cómo ejecutarlo

Desde la raíz del repositorio:

```bash
python vulnerabilidad/calcular_indice.py
```

Genera automáticamente el archivo de salida y muestra el top 10 de
municipios más vulnerables.

## Nota sobre los datos

El reto sugiere usar cobertura de vacunación y acceso a servicios de salud.
El dataset disponible no incluye esas variables con cobertura nacional
suficiente (menos del 8% de los municipios), por lo que se usa la **tasa de
incidencia histórica como proxy de vulnerabilidad estructural**: esta captura
el efecto acumulado de baja vacunación, poco acceso a salud y condiciones
ambientales adversas. Si en el futuro se consiguen esos datos con cobertura
nacional, se integran como factores adicionales sin cambiar la lógica.
