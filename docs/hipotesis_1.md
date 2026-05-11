# Hipotesis 1: Posesion vs goles y resultado

## Hipotesis

Una mayor posesion del balon no garantiza necesariamente una mayor cantidad de goles ni un mejor resultado final en el partido.

## Datos y metodo

- Fuente: events_fact.parquet y matches_fact.parquet.
- Posesion por equipo/partido: conteo de eventos por possession_team_id dividido entre eventos totales del partido.
- Resultado: goles a favor, en contra y diferencia (resultado).

## Procedimiento (detalle)

1. Carga y consolidacion de datos: se importan tablas Parquet (o CSV) con Pandas y DuckDB; se verifican tipos, nulos y duplicados.
2. Limpieza y filtrado: se tratan nulos criticos (por ejemplo, duration negativos, player_nickname con alto % de nulos) y se seleccionan partidos con 360 si es necesario.
3. Analisis univariado: para numericas se calcula media, mediana, desviacion estandar, asimetria y percentiles; se generan histogramas y boxplots. Para categoricas, tablas de frecuencia y graficos de barras.
4. Analisis bivariado y correlaciones: matrices de correlacion (Pearson para numericas, Cramer's V para categoricas). Se exploran relaciones temporales (indice, minuto, posesion) y espaciales (x, y).
5. Visualizaciones exploratorias: lineas de evolucion temporal, mapas de calor de posiciones en el campo y dispersions para tracking 360.
6. Evaluacion de hipotesis: pruebas estadisticas (chi-cuadrado, ANOVA, regresion logistica) segun corresponda.

## Transformaciones y tablas (paso a paso)

Tabla 0. events_fact (columnas usadas).

| Columna            | Uso                | Operacion                    |
| ------------------ | ------------------ | ---------------------------- |
| match_id           | llave del partido  | mantiene valor original      |
| possession_team_id | equipo en posesion | filtro de nulos y agrupacion |

Explicacion: se usan estas columnas para contar eventos por equipo en posesion dentro de cada partido.

Tabla 1. matches_fact (columnas usadas).

| Columna      | Uso               | Operacion                             |
| ------------ | ----------------- | ------------------------------------- |
| match_id     | llave del partido | mantiene valor original               |
| home_team_id | id del local      | renombre a team_id                    |
| away_team_id | id del visitante  | renombre a team_id                    |
| home_score   | goles local       | renombre a goles_favor o goles_contra |
| away_score   | goles visita      | renombre a goles_favor o goles_contra |

Explicacion: se normaliza el resultado a una tabla por equipo (local y visitante).

Tabla 2. pos_counts (eventos por posesion y partido).

| match_id | possession_team_id | eventos_possesion |
| -------- | ------------------ | ----------------- |
| ...      | ...                | ...               |

Explicacion: se filtran nulos en match_id y possession_team_id, luego se agrupa por ambas columnas y se aplica size (conteo). Base para calcular el porcentaje de posesion.

Tabla 3. totals (eventos totales por partido).

| match_id | eventos_total |
| -------- | ------------- |
| ...      | ...           |

Explicacion: se agrupa pos_counts por match_id y se suma eventos_possesion para obtener eventos_total del partido.

Tabla 4. pos_df (posesion porcentual por equipo/partido).

| match_id | possession_team_id | eventos_possesion | eventos_total | posesion_pct |
| -------- | ------------------ | ----------------- | ------------- | ------------ |
| ...      | ...                | ...               | ...           | ...          |

Explicacion: merge por match_id entre pos_counts y totals; luego se calcula posesion_pct = eventos_possesion / eventos_total.

Tabla 5. results (resultado por equipo/partido).

| match_id | team_id | goles_favor | goles_contra | condicion | resultado |
| -------- | ------- | ----------- | ------------ | --------- | --------- |
| ...      | ...     | ...         | ...          | ...       | ...       |

Explicacion: se crean dos tablas (home y away) con columnas normalizadas, se hace concat y se calcula resultado = goles_favor - goles_contra.

Tabla 6. df (posesion + resultado).

| match_id | team_id | posesion_pct | goles_favor | goles_contra | resultado |
| -------- | ------- | ------------ | ----------- | ------------ | --------- |
| ...      | ...     | ...          | ...         | ...          | ...       |

Explicacion: merge entre pos_df y results por match_id y team_id (possession_team_id). Esta es la tabla analitica final.

Tabla 7. resultado_cat (clasificacion del resultado).

| resultado | resultado_cat |
| --------- | ------------- |
| < 0       | derrota       |
| = 0       | empate        |
| > 0       | victoria      |

Explicacion: se usa pd.cut sobre resultado con cortes [-10, -1, 0, 10] para categorizar derrotas, empates y victorias.

Tabla 8. resumen_posesion_por_resultado.

| resultado_cat | count | mean | std | min | 25% | 50% | 75% | max |
| ------------- | ----- | ---- | --- | --- | --- | --- | --- | --- |
| derrota       | ...   | ...  | ... | ... | ... | ... | ... | ... |
| empate        | ...   | ...  | ... | ... | ... | ... | ... | ... |
| victoria      | ...   | ...  | ... | ... | ... | ... | ... | ... |

Explicacion: resultado de describe() sobre posesion_pct agrupado por resultado_cat.

Tabla 9. correlaciones_df.

| Variable     | posesion_pct | goles_favor | goles_contra | resultado |
| ------------ | ------------ | ----------- | ------------ | --------- |
| posesion_pct | 1.000        | ...         | ...          | ...       |
| goles_favor  | ...          | 1.000       | ...          | ...       |
| goles_contra | ...          | ...         | 1.000        | ...       |
| resultado    | ...          | ...         | ...          | 1.000     |

Explicacion: matriz de correlacion Pearson calculada con df.corr().

## Resultados clave

- Media de posesion por resultado:
  - Derrota: 0.459
  - Empate: 0.500
  - Victoria: 0.541
- Correlaciones:
  - Posesion vs goles a favor: 0.291
  - Posesion vs resultado: 0.379

Tabla 1. Posesion promedio por resultado.

| Resultado | Posesion promedio |
| --------- | ----------------- |
| Derrota   | 0.459             |
| Empate    | 0.500             |
| Victoria  | 0.541             |

Tabla 2. Correlaciones principales.

| Relacion                  | Correlacion |
| ------------------------- | ----------- |
| Posesion vs goles a favor | 0.291       |
| Posesion vs resultado     | 0.379       |

## Graficos

![Posesion por resultado](figures/h1_posesion_boxplot.png)
![Posesion vs goles a favor](figures/h1_posesion_scatter.png)

## Conclusión

Hay una relacion positiva pero moderada entre posesion y goles/resultado. La posesion no garantiza por si sola un mejor resultado, aunque si se asocia con mejores promedios. La hipotesis se considera parcialmente verdadera.
