import pandas as pd

casos = pd.read_csv('/home/claude/casos_geocodificado.csv')
poblacion = pd.read_csv('/home/claude/poblacion_municipal.csv')
calidad = pd.read_csv('/home/claude/calidad_aire_clima_anual.csv')

poblacion['anio'] = poblacion['anio'].astype(int)
calidad['anio'] = calidad['anio'].astype(int)
casos['cod_mpio'] = casos['cod_mpio'].astype('Int64')
poblacion['cod_mpio'] = poblacion['cod_mpio'].astype('Int64')
calidad['cod_mpio'] = calidad['cod_mpio'].astype('Int64')

# OJO: pandas trata NaN==NaN como coincidencia en merge (a diferencia de SQL).
# Las filas de casos sin cod_mpio (municipio no geocodificado) NO deben cruzar
# contra filas vacías/residuales de población o calidad del aire -> las quitamos antes.
poblacion = poblacion.dropna(subset=['cod_mpio', 'anio'])
calidad = calidad.dropna(subset=['cod_mpio', 'anio'])

assert not poblacion.duplicated(subset=['cod_mpio', 'anio']).any(), "Claves duplicadas en población"
assert not calidad.duplicated(subset=['cod_mpio', 'anio']).any(), "Claves duplicadas en calidad del aire"

filas_antes = len(casos)

enriquecido = casos.merge(
    poblacion, left_on=['cod_mpio', 'anio_dataset'], right_on=['cod_mpio', 'anio'],
    how='left', validate='many_to_one'
).drop(columns=['anio'])

enriquecido = enriquecido.merge(
    calidad, left_on=['cod_mpio', 'anio_dataset'], right_on=['cod_mpio', 'anio'],
    how='left', validate='many_to_one'
).drop(columns=['anio'])

assert len(enriquecido) == filas_antes, (
    f"El merge cambió el número de filas: {filas_antes} -> {len(enriquecido)}"
)

enriquecido['tasa_incidencia_100k'] = (enriquecido['casos'] / enriquecido['poblacion']) * 100000

cols_finales = [
    'anio_dataset', 'semana', 'municipio', 'categoria_municipio',
    'cod_dpto', 'dpto', 'cod_mpio', 'nom_mpio',
    'enfermedad', 'enfermedad_codigo', 'casos',
    'poblacion', 'tasa_incidencia_100k',
    'pm25_promedio', 'pm10_promedio', 'no2_promedio', 'so2_promedio', 'o3_promedio', 'co_promedio',
    'precipitacion_promedio', 'temperatura_promedio', 'humedad_promedio',
]
enriquecido = enriquecido[cols_finales]

print("Shape final:", enriquecido.shape)
print("\nCobertura de población (% de filas con población asignada):",
      f"{100*enriquecido['poblacion'].notna().mean():.1f}%")
print("Cobertura de calidad del aire/clima (% de filas con al menos una variable):",
      f"{100*enriquecido[['pm25_promedio','precipitacion_promedio']].notna().any(axis=1).mean():.1f}%")

print("\nMuestra:")
print(enriquecido.head(8))

enriquecido.to_csv('/home/claude/dataset_enriquecido.csv', index=False)

with pd.ExcelWriter('/home/claude/dataset_enriquecido.xlsx', engine='openpyxl') as writer:
    enriquecido.to_excel(writer, sheet_name='dataset_enriquecido', index=False)

    resumen = pd.DataFrame({
        'Métrica': [
            'Filas totales', 'Casos totales', '% casos geocodificados (municipio válido)',
            '% filas con población asignada', 'Municipios con datos de calidad de aire/clima',
            'Años cubiertos', 'Enfermedades',
        ],
        'Valor': [
            len(enriquecido), int(enriquecido['casos'].sum()),
            f"{100*enriquecido[enriquecido['cod_mpio'].notna()]['casos'].sum()/enriquecido['casos'].sum():.1f}%",
            f"{100*enriquecido['poblacion'].notna().mean():.1f}%",
            int(enriquecido.loc[enriquecido['pm25_promedio'].notna(), 'cod_mpio'].nunique()),
            ', '.join(map(str, sorted(enriquecido['anio_dataset'].unique()))),
            ', '.join(enriquecido['enfermedad'].unique()),
        ]
    })
    resumen.to_excel(writer, sheet_name='resumen', index=False)

print("\nGuardado dataset_enriquecido.csv y dataset_enriquecido.xlsx")
