# -*- coding: utf-8 -*-
"""
============================================================
 FASE 3 — ÍNDICE DE VULNERABILIDAD TERRITORIAL
 Proyecto SaludIA — Predicción de brotes
 Autor: Majo
============================================================

QUÉ HACE ESTE SCRIPT
--------------------
Toma el dataset que dejó Kevin (data/processed/dataset_enriquecido.csv)
y calcula, para cada municipio de Colombia, un ÍNDICE DE VULNERABILIDAD
del 1 al 10 (10 = municipio más vulnerable ante un brote).

El índice NO usa Machine Learning: es un score compuesto y ponderado.

QUÉ PRODUCE
-----------
Un archivo: vulnerabilidad/salidas/indice_vulnerabilidad.csv
Una fila por municipio, con su código DIVIPOLA y su índice.
Ese archivo es lo que Kevin usa en la Fase 4 para cruzar con el modelo.

CÓMO SE CALCULA EL ÍNDICE
-------------------------
Se combinan 4 factores, cada uno con un peso:

  1. Tasa de incidencia histórica promedio (45%)
       -> Qué tan golpeado ha sido el municipio en promedio.
          Es el mejor proxy de vulnerabilidad estructural: si un
          municipio se enferma mucho históricamente, refleja baja
          vacunación, poco acceso a salud y malas condiciones.

  2. Pico histórico de incidencia (20%)
       -> Qué tan grave fue su PEOR semana. Un municipio que ha
          tenido picos altos es más vulnerable a repetirlos.

  3. Calidad del aire - PM2.5 (20%)
       -> Factor ambiental. Solo lo tienen 68 municipios, así que
          donde falta se rellena con el promedio del departamento
          y, si el departamento tampoco tiene, con el promedio nacional.

  4. Población (15%)
       -> Municipios más grandes = brotes potencialmente más grandes.
============================================================
"""

import pandas as pd
import numpy as np
import os

# ------------------------------------------------------------
# 1. RUTAS  (relativas a la raíz del repositorio SaludIA)
# ------------------------------------------------------------
RUTA_DATASET = "data/processed/dataset_enriquecido.csv"
RUTA_SALIDA  = "vulnerabilidad/salidas/indice_vulnerabilidad.csv"

# Pesos de cada factor (deben sumar 1.0)
PESO_TASA_PROM = 0.45
PESO_TASA_PICO = 0.20
PESO_AIRE      = 0.20
PESO_POBLACION = 0.15


# ------------------------------------------------------------
# 2. FUNCIONES AUXILIARES
# ------------------------------------------------------------
def normalizar_0_1(serie):
    """
    Convierte una columna a una escala de 0 a 1 usando PERCENTILES
    (ranking relativo), no el valor bruto.

    ¿Por qué percentiles y no min-max?
    Los datos de salud son muy "sesgados": unos pocos municipios tienen
    cifras enormes y el resto valores bajos. Si usáramos min-max, esos
    pocos extremos aplastarían a todos los demás cerca de 0 y el índice
    perdería sentido. Con percentiles, cada municipio se ubica según su
    POSICIÓN relativa frente a los demás, repartiendo el índice de forma
    pareja del 1 al 10. Además es más fácil de explicar:
    "este municipio está en el percentil 90 de vulnerabilidad del país".
    """
    return serie.rank(method="average", pct=True)


def imputar_por_departamento(df, columna):
    """
    Rellena los vacíos de una columna usando el promedio del
    departamento. Si el departamento entero no tiene dato,
    usa el promedio nacional. Así ningún municipio queda sin valor.
    """
    # promedio nacional (para el peor caso)
    promedio_nacional = df[columna].mean()

    # promedio por departamento
    df[columna] = df.groupby("dpto")[columna].transform(
        lambda x: x.fillna(x.mean())
    )
    # lo que aún quede vacío -> promedio nacional
    df[columna] = df[columna].fillna(promedio_nacional)
    return df


# ------------------------------------------------------------
# 3. CARGA Y FILTRADO DE DATOS
# ------------------------------------------------------------
print("Leyendo dataset de Kevin...")
df = pd.read_csv(RUTA_DATASET)

# Nos quedamos solo con municipios geolocalizados (tienen código DIVIPOLA).
# Descartamos filas de 'departamento sin municipio' e 'internacional'
# porque no se pueden ubicar en el mapa.
df = df[(df["categoria_municipio"] == "municipio") & (df["cod_mpio"].notna())].copy()
print(f"  Filas de municipios geolocalizados: {len(df):,}")


# ------------------------------------------------------------
# 4. AGREGACIÓN POR MUNICIPIO
#    El dataset tiene una fila por municipio-enfermedad-semana.
#    Nosotros necesitamos UNA fila por municipio, así que resumimos.
# ------------------------------------------------------------
print("Resumiendo a nivel municipio...")
municipios = df.groupby("cod_mpio").agg(
    nom_mpio          = ("nom_mpio", "first"),
    dpto              = ("dpto", "first"),
    tasa_prom         = ("tasa_incidencia_100k", "mean"),
    tasa_pico         = ("tasa_incidencia_100k", "max"),
    pm25              = ("pm25_promedio", "mean"),
    poblacion         = ("poblacion", "max"),
).reset_index()

print(f"  Municipios únicos: {len(municipios):,}")


# ------------------------------------------------------------
# 5. IMPUTAR CALIDAD DEL AIRE DONDE FALTA
# ------------------------------------------------------------
faltantes_aire = municipios["pm25"].isna().sum()
print(f"Rellenando calidad del aire ({faltantes_aire} municipios sin dato)...")
municipios = imputar_por_departamento(municipios, "pm25")


# ------------------------------------------------------------
# 6. NORMALIZAR CADA FACTOR A ESCALA 0-1
# ------------------------------------------------------------
print("Normalizando factores...")
municipios["n_tasa_prom"] = normalizar_0_1(municipios["tasa_prom"])
municipios["n_tasa_pico"] = normalizar_0_1(municipios["tasa_pico"])
municipios["n_aire"]      = normalizar_0_1(municipios["pm25"])
municipios["n_poblacion"] = normalizar_0_1(municipios["poblacion"])


# ------------------------------------------------------------
# 7. CALCULAR EL ÍNDICE PONDERADO (0 a 1) Y ESCALARLO A 1-10
# ------------------------------------------------------------
print("Calculando índice de vulnerabilidad...")
municipios["indice_0_1"] = (
    PESO_TASA_PROM * municipios["n_tasa_prom"] +
    PESO_TASA_PICO * municipios["n_tasa_pico"] +
    PESO_AIRE      * municipios["n_aire"] +
    PESO_POBLACION * municipios["n_poblacion"]
)

# Escala final de 1 a 10 (más intuitiva para el dashboard)
municipios["indice_vulnerabilidad"] = (1 + 9 * municipios["indice_0_1"]).round(2)


# ------------------------------------------------------------
# 8. CATEGORÍA DE VULNERABILIDAD (Bajo / Medio / Alto)
#    Usamos percentiles: el tercio más alto = Alto, etc.
# ------------------------------------------------------------
p33 = municipios["indice_vulnerabilidad"].quantile(0.33)
p66 = municipios["indice_vulnerabilidad"].quantile(0.66)

def categoria(valor):
    if valor >= p66:
        return "Alto"
    elif valor >= p33:
        return "Medio"
    else:
        return "Bajo"

municipios["nivel_vulnerabilidad"] = municipios["indice_vulnerabilidad"].apply(categoria)


# ------------------------------------------------------------
# 9. ARMAR LA TABLA FINAL Y GUARDARLA
# ------------------------------------------------------------
salida = municipios[[
    "cod_mpio", "nom_mpio", "dpto",
    "tasa_prom", "tasa_pico", "pm25", "poblacion",
    "indice_vulnerabilidad", "nivel_vulnerabilidad"
]].copy()

# Ordenamos de más vulnerable a menos, para que sea fácil de leer
salida = salida.sort_values("indice_vulnerabilidad", ascending=False)

# cod_mpio como entero (para que cruce bien con el dataset de Kevin)
salida["cod_mpio"] = salida["cod_mpio"].astype(int)

# Creamos la carpeta de salida si no existe
os.makedirs(os.path.dirname(RUTA_SALIDA), exist_ok=True)
salida.to_csv(RUTA_SALIDA, index=False, encoding="utf-8-sig")

print("\n" + "="*55)
print(f" LISTO. Archivo generado: {RUTA_SALIDA}")
print(f" {len(salida)} municipios con su índice de vulnerabilidad.")
print("="*55)

# Vista rápida de los 10 municipios más vulnerables
print("\nTOP 10 municipios más vulnerables:")
print(salida.head(10)[["nom_mpio","dpto","indice_vulnerabilidad","nivel_vulnerabilidad"]].to_string(index=False))
