import pandas as pd
import unicodedata
import re

pd.set_option('display.max_columns', None)
pd.set_option('display.width', 250)

# Utilidades de normalización de nombres de municipio

def normalizar(s):
    if pd.isna(s):
        return s
    s = str(s).strip().upper()
    s = re.sub(r'\s*\([^)]*\)?\s*', ' ', s).strip()  # quita sufijos entre paréntesis (incluso mal cerrados)
    s = re.sub(r'\s+', ' ', s)
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    return s

# Alias manuales para nombres oficiales DIVIPOLA que difieren del nombre común
ALIAS = {
    'CALI': 'SANTIAGO DE CALI',
    'CARTAGENA': 'CARTAGENA DE INDIAS',
    'CUCUTA': 'SAN JOSE DE CUCUTA',
    'BUGA': 'GUADALAJARA DE BUGA',
    'MOMPOS': 'SANTA CRUZ DE MOMPOX',
    'ITSMINA': 'ISTMINA',
    'SANTA MARTHA': 'SANTA MARTA',
    'TOLU': 'SANTIAGO DE TOLU',
    'TOLUVIEJO': 'SAN JOSE DE TOLUVIEJO',
    'UBATE': 'VILLA DE SAN DIEGO DE UBATE',
    'MARIQUITA': 'SAN SEBASTIAN DE MARIQUITA',
    'PUERTO INIRIDA': 'INIRIDA',
    'PIENDAMO': 'PIENDAMO - TUNIA',
    'TUMACO': 'SAN ANDRES DE TUMACO',
    'SINCE': 'SAN LUIS DE SINCE',
    'LOPEZ': 'LOPEZ DE MICAY',
    'OLAYA HERRERA': 'OLAYA HERRERA',
}

# Categorías que NO son municipios colombianos identificables
def categorizar(municipio_original):
    m = str(municipio_original).upper()
    if m.startswith('EXTERIOR_') or m in ('CAMERUM', 'COSTA RICA', 'HONDURAS', 'MALAWI'):
        return 'internacional'
    if 'MUNICIPIO DESCONOCIDO' in m or 'SIN MUNICIPIO' in m or 'PROCEDENCIA DESCONOCIDA' in m:
        return 'departamento_sin_municipio'
    return 'municipio'

# 1. Cargar y normalizar DIVIPOLA

divipola = pd.read_csv('/mnt/user-data/uploads/divipola.csv')
divipola['nom_mpio_norm'] = divipola['nom_mpio'].apply(normalizar)
# Un nombre normalizado puede repetirse entre departamentos distintos (ambiguo) -> nos quedamos
# con la primera ocurrencia para el cruce simple; los casos ambiguos ya quedaron fuera antes.
divipola_lookup = divipola.drop_duplicates('nom_mpio_norm').set_index('nom_mpio_norm')

# 2. Cargar casos y normalizar/clasificar municipio

casos = pd.read_excel('/mnt/user-data/uploads/dataset.xlsx')
casos['categoria_municipio'] = casos['municipio'].apply(categorizar)
casos['municipio_norm'] = casos['municipio'].apply(normalizar)
casos['municipio_norm'] = casos['municipio_norm'].replace(ALIAS)

casos = casos.merge(
    divipola_lookup[['cod_dpto', 'dpto', 'cod_mpio', 'nom_mpio']],
    left_on='municipio_norm', right_index=True, how='left'
)

total_casos = casos['casos'].sum()
casos_con_codigo = casos.dropna(subset=['cod_mpio'])['casos'].sum()
print(f"Cobertura de geocodificación (por volumen de casos): {100*casos_con_codigo/total_casos:.1f}%")
print(casos['categoria_municipio'].value_counts())
print(f"Municipios sin código DIVIPOLA asignado (categoría 'municipio'): "
      f"{casos[(casos['categoria_municipio']=='municipio') & (casos['cod_mpio'].isna())]['municipio'].nunique()}")

casos.to_csv('/home/claude/casos_geocodificado.csv', index=False)

# 3. Población municipal 2018, 2019, y 2021

pob_vieja = pd.read_excel(
    '/mnt/user-data/uploads/ProyeccionMunicipios2005_2020__1_.xls',
    sheet_name='Mpios', header=8
)
pob_2018_2019 = pob_vieja[['DPMP', 2018, 2019]].rename(
    columns={'DPMP': 'cod_mpio', 2018: '2018', 2019: '2019'}
)
pob_2018_2019 = pob_2018_2019.melt(id_vars='cod_mpio', var_name='anio', value_name='poblacion')
pob_2018_2019['cod_mpio'] = pob_2018_2019['cod_mpio'].astype('Int64')
pob_2018_2019['anio'] = pob_2018_2019['anio'].astype(int)

pob_nueva = pd.read_excel(
    '/mnt/user-data/uploads/DCD-area-proypoblacion-Mun-2020-2035-ActPostCOVID-19__2_.xlsx',
    sheet_name='Hoja1', header=8
)
pob_2021 = pob_nueva[
    (pob_nueva['AÑO'] == 2021) & (pob_nueva['ÁREA GEOGRÁFICA'] == 'Total')
][['MPIO', 'AÑO', 'Población']].rename(
    columns={'MPIO': 'cod_mpio', 'AÑO': 'anio', 'Población': 'poblacion'}
)
pob_2021['cod_mpio'] = pob_2021['cod_mpio'].astype('Int64')

poblacion = pd.concat([pob_2018_2019, pob_2021], ignore_index=True)
poblacion.to_csv('/home/claude/poblacion_municipal.csv', index=False)
print(f"\nPoblación municipal: {poblacion.shape[0]} filas, años {sorted(poblacion['anio'].unique())}")

# 4. Calidad del aire / clima — agregado anual por municipio, solo 2018/2019/2021

calidad = pd.read_csv('/mnt/user-data/uploads/calidad_aire.csv')
calidad = calidad[calidad['a_o'].isin([2018, 2019, 2021])].copy()
calidad['c_digo_del_municipio'] = calidad['c_digo_del_municipio'].astype('Int64')

VARS_RELEVANTES = {
    'PM2.5': 'pm25_promedio',
    'PM10': 'pm10_promedio',
    'NO2': 'no2_promedio',
    'SO2': 'so2_promedio',
    'O3': 'o3_promedio',
    'CO': 'co_promedio',
    'P': 'precipitacion_promedio',
    'TAire2': 'temperatura_promedio',
    'HAire2': 'humedad_promedio',
}
calidad = calidad[calidad['variable'].isin(VARS_RELEVANTES.keys())]

calidad_agg = (
    calidad.groupby(['c_digo_del_municipio', 'a_o', 'variable'], as_index=False)['promedio']
    .mean()
)
calidad_wide = calidad_agg.pivot_table(
    index=['c_digo_del_municipio', 'a_o'], columns='variable', values='promedio'
).reset_index()
calidad_wide = calidad_wide.rename(columns=VARS_RELEVANTES)
calidad_wide = calidad_wide.rename(columns={'c_digo_del_municipio': 'cod_mpio', 'a_o': 'anio'})
calidad_wide.to_csv('/home/claude/calidad_aire_clima_anual.csv', index=False)
print(f"\nCalidad del aire/clima agregada: {calidad_wide.shape[0]} filas "
      f"({calidad_wide['cod_mpio'].nunique()} municipios, años {sorted(calidad_wide['anio'].unique())})")
print(calidad_wide.head())
