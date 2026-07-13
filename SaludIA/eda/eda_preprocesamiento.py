import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.grid": True,
    "grid.alpha": 0.3,
    "font.size": 11,
})
COLOR_DENGUE = "#d1495b"
COLOR_MALARIA = "#2e86ab"

df = pd.read_csv('/mnt/user-data/outputs/dataset_enriquecido.csv')

# 1. Preprocesamiento

# Fecha real a partir de año ISO + semana ISO (lunes de esa semana)
df['fecha'] = pd.to_datetime(
    df['anio_dataset'].astype(str) + df['semana'].astype(str).str.zfill(2) + '1',
    format='%G%V%u'
)
df['mes'] = df['fecha'].dt.month

# Para modelado espacio-temporal por municipio, los casos internacionales y los
# "municipio desconocido dentro del departamento" no son geolocalizables a nivel
# municipio -> se documentan pero se separan del dataset de modelado principal.
df_nacional = df[df['categoria_municipio'] == 'municipio'].copy()

print("=== Preprocesamiento ===")
print(f"Filas totales:               {len(df):,}")
print(f"Filas 'municipio' (modelo):  {len(df_nacional):,} ({100*len(df_nacional)/len(df):.1f}%)")
print(f"Filas excluidas (exterior + municipio desconocido): {len(df) - len(df_nacional):,}")
print(f"Casos excluidos: {df[df['categoria_municipio']!='municipio']['casos'].sum():,} "
      f"de {df['casos'].sum():,} totales "
      f"({100*df[df['categoria_municipio']!='municipio']['casos'].sum()/df['casos'].sum():.1f}%)")

# Subconjunto con variables climáticas/calidad del aire completas (para exploración
# de esas variables específicamente — son solo 111 municipios)
cols_clima = ['pm25_promedio', 'pm10_promedio', 'no2_promedio', 'so2_promedio',
              'o3_promedio', 'co_promedio', 'precipitacion_promedio',
              'temperatura_promedio', 'humedad_promedio']
df_clima = df_nacional.dropna(subset=['pm25_promedio', 'precipitacion_promedio'], how='all').copy()
print(f"\nFilas con al menos una variable climática/calidad del aire: {len(df_clima):,} "
      f"({df_clima['cod_mpio'].nunique()} municipios distintos)")

df_nacional.to_csv('/home/claude/dataset_modelo_nacional.csv', index=False)
df_clima.to_csv('/home/claude/dataset_modelo_clima.csv', index=False)

# 2. Serie de tiempo nacional semanal por enfermedad

serie = df_nacional.groupby(['fecha', 'enfermedad'])['casos'].sum().unstack(fill_value=0)

fig, ax = plt.subplots(figsize=(11, 4.5))
ax.plot(serie.index, serie['Dengue'], color=COLOR_DENGUE, linewidth=1.6, label='Dengue')
ax.plot(serie.index, serie['Malaria'], color=COLOR_MALARIA, linewidth=1.6, label='Malaria')
ax.set_title('Casos semanales a nivel nacional (2018, 2019, 2021)', fontsize=13, fontweight='bold')
ax.set_ylabel('Casos reportados')
ax.set_xlabel('Fecha')
ax.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %Y'))
ax.legend(frameon=False)
ax.spines[['top', 'right']].set_visible(False)
plt.xticks(rotation=0)
plt.tight_layout()
plt.savefig('/home/claude/eda_01_serie_temporal.png', dpi=150)
plt.close()

# 3. Top municipios por casos totales

top_mpios = (
    df_nacional.groupby('nom_mpio')['casos'].sum()
    .sort_values(ascending=False).head(15)
)

fig, ax = plt.subplots(figsize=(9, 6))
ax.barh(top_mpios.index[::-1], top_mpios.values[::-1], color=COLOR_MALARIA)
ax.set_title('Top 15 municipios por casos totales acumulados', fontsize=13, fontweight='bold')
ax.set_xlabel('Casos totales (2018+2019+2021)')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout()
plt.savefig('/home/claude/eda_02_top_municipios.png', dpi=150)
plt.close()

# 4. Distribución de la tasa de incidencia (log)

fig, ax = plt.subplots(figsize=(8, 4.5))
datos_tasa = df_nacional['tasa_incidencia_100k'].dropna()
ax.hist(np.log10(datos_tasa + 1), bins=50, color=COLOR_DENGUE, alpha=0.8)
ax.set_title('Distribución de la tasa de incidencia (log10, por 100k hab.)', fontsize=13, fontweight='bold')
ax.set_xlabel('log10(tasa_incidencia_100k + 1)')
ax.set_ylabel('Frecuencia (municipio-semana)')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout()
plt.savefig('/home/claude/eda_03_distribucion_tasa.png', dpi=150)
plt.close()

# 5. Estacionalidad: promedio de casos por semana del año

estacional = df_nacional.groupby(['semana', 'enfermedad'])['casos'].mean().unstack(fill_value=0)

fig, ax = plt.subplots(figsize=(10, 4.5))
ax.plot(estacional.index, estacional['Dengue'], color=COLOR_DENGUE, linewidth=1.8, label='Dengue')
ax.plot(estacional.index, estacional['Malaria'], color=COLOR_MALARIA, linewidth=1.8, label='Malaria')
ax.set_title('Estacionalidad: promedio de casos por semana del año', fontsize=13, fontweight='bold')
ax.set_xlabel('Semana epidemiológica (1-52)')
ax.set_ylabel('Casos promedio por municipio-semana')
ax.legend(frameon=False)
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout()
plt.savefig('/home/claude/eda_04_estacionalidad.png', dpi=150)
plt.close()

# 6. Correlación variables climáticas/aire vs casos (solo subset con clima)

corr_cols = ['casos', 'tasa_incidencia_100k'] + cols_clima
corr = df_clima[corr_cols].corr(numeric_only=True)

fig, ax = plt.subplots(figsize=(8, 7))
im = ax.imshow(corr, cmap='RdBu_r', vmin=-1, vmax=1)
ax.set_xticks(range(len(corr.columns)))
ax.set_xticklabels(corr.columns, rotation=45, ha='right')
ax.set_yticks(range(len(corr.columns)))
ax.set_yticklabels(corr.columns)
for i in range(len(corr.columns)):
    for j in range(len(corr.columns)):
        ax.text(j, i, f"{corr.iloc[i, j]:.2f}", ha='center', va='center', fontsize=8)
ax.set_title('Correlación: casos/tasa vs. clima y calidad del aire\n(subset de 111 municipios con estación)',
             fontsize=12, fontweight='bold')
plt.colorbar(im, ax=ax, shrink=0.8)
plt.tight_layout()
plt.savefig('/home/claude/eda_05_correlacion_clima.png', dpi=150)
plt.close()

print("\n5 gráficos EDA guardados en /home/claude/eda_0*.png")
print("\nCorrelaciones de 'casos' con variables climáticas/aire:")
print(corr['casos'].drop(['casos', 'tasa_incidencia_100k']).sort_values(ascending=False))
