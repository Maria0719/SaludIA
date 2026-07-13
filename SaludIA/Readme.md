# SaludIA - Fase 4: Motor de Alertas

Proyecto trabajado por Nicolás.

## Qué hice yo
Construí la Fase 4 del proyecto: un motor de alertas que une las predicciones de Kevin con el índice de vulnerabilidad de Majo para producir una alerta final por municipio y enfermedad.

La lógica quedó así:
- Se toma el snapshot de predicciones ya generado por Kevin.
- Se cruza con el índice de vulnerabilidad por `cod_mpio`.
- Se clasifica `casos_predichos` con el Esquema aprobado por enfermedad.
- Se aplica la matriz de semáforo.
- Se genera una explicación natural para cada fila.
- Se guarda el resultado final en `alertas/salidas/alertas_finales.csv`.

## Archivos de mi fase
- `alertas/generar_alertas.py`: script principal y reproducible. Lee el snapshot de Kevin, hace el merge con vulnerabilidad, clasifica, aplica el semáforo, genera la explicación y escribe el CSV final.
- `alertas/generar_snapshot_kevin.py`: archivo de referencia para documentar cómo se obtuvo el snapshot de Kevin si alguna vez hay que regenerarlo.
- `alertas/entradas/predicciones_kevin_snapshot.csv`: snapshot intermedio con las predicciones alineadas por municipio y enfermedad.
- `vulnerabilidad/salidas/indice_vulnerabilidad.csv`: salida de la fase de vulnerabilidad que se usa para el cruce.
- `alertas/salidas/alertas_finales.csv`: salida definitiva del motor de alertas.
- `.gitignore`: excluye el entorno virtual y archivos temporales de Python.

## Cómo reproducir mi resultado
1. Tener listo `alertas/entradas/predicciones_kevin_snapshot.csv`.
2. Ejecutar:

```bash
python alertas/generar_alertas.py
```

3. Revisar el archivo final en `alertas/salidas/alertas_finales.csv`.

## Qué contiene el CSV final
El archivo final tiene estas columnas:

- `cod_mpio`
- `municipio`
- `enfermedad`
- `casos_predichos`
- `indice_vulnerabilidad`
- `vulnerabilidad`
- `nivel_alerta`
- `explicacion`

## Nota
Los cortes de clasificación del Esquema fueron una decisión manual basada en la distribución observada en el set de prueba 2021. No son un estándar clínico; se usaron para construir una salida operativa y consistente.
