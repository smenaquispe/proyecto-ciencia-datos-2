## **Análisis Visual de Datos** 

Objetivo: Reflexionar sobre la calidad de sus datos, el diseño de atributos y la interpretación visual. 

- Cómo se construyó el espacio de características. 

- Cómo las transformaciones afectan las distancias. 

- Cómo interpretar la reducción de dimensionalidad. 

- Cómo validar críticamente la representación obtenida. 

## **1. Definición del vector de características**

### Contexto del proyecto

El proyecto construye una herramienta de scouting de jugadores de fútbol masculino profesional a partir de datos de StatsBomb (≈12 millones de eventos de ~3.464 partidos).

**Tabla fuente principal:** `events_fact` — un registro por acción ocurrida en cada partido, enriquecida con `player_id`, `player_name`, `position_id` y `position_name` (via `reprocess_events_with_player.py`).

**Tablas de soporte:** `player_match_position_fact` (minutos jugados y posición por partido), `team_dim` (género del equipo), `matches_fact` (vínculo partido ↔ competición).

---

### Dos granularidades del vector

El dashboard requiere dos niveles de análisis con distintos objetos de representación:

| Granularidad | Objeto | Clave | Uso en el dashboard |
|---|---|---|---|
| **Por jugador** (acumulado) | Un jugador a lo largo de toda su historia en los datos | `player_id` | Scouting global, comparación de perfiles, proyección PCA/UMAP para similitud |
| **Por jugador-partido** | Un jugador en un partido específico | `player_id` + `match_id` | Análisis de rendimiento por partido, evolución temporal, comparación partido a partido |

En ambos casos `player_id`, `player_name` y `match_id` (cuando aplica) son **columnas de metadatos/etiquetas** — viajan en el dataframe para identificar cada fila, pero **no entran al espacio numérico de features** (no participan en el cálculo de distancias euclidianas ni en PCA/UMAP). Son equivalentes al nombre de un cliente en un dataset de CRM: imprescindibles para interpretar resultados, pero ajenos al modelo matemático.

---

### Filtros previos a la construcción del vector

#### A) Exclusión de fútbol femenino

La variable `gender` de la tabla `team_dim` permite separar equipos masculinos y femeninos. La exclusión se justifica con los siguientes datos obtenidos de la consulta `justify_gender_exclusion()` en `feature_vector.py`:

| Género | Jugadoras/es únicos | Longitud media de pase (m) | Desv. std pase | Distancia media conducción (m) | Remates por jugador |
|--------|--------------------:|---------------------------:|---------------:|-------------------------------:|--------------------:|
| male   | ~8.200              | ~24,8                      | ~15,1          | ~4,6                           | ~10,7               |
| female | ~1.600              | ~20,3                      | ~13,8          | ~3,9                           | ~7,4                |

La diferencia en longitud media de pase (~22 %), distancia de conducción (~18 %) y volumen de remates (~31 %) es estadísticamente significativa y refleja distintas capacidades físicas y niveles de competición. Incluir ambos géneros en un mismo espacio de características generaría **distribuciones bimodales** que el algoritmo de reducción de dimensionalidad (PCA/UMAP) interpretaría como dos clusters estructurales de género, enmascarando los clusters de rol que son el objetivo del scouting.

#### B) Exclusión de jugadores con datos insuficientes

Se eliminan jugadores con **menos de 270 minutos** acumulados (equivalente a 3 partidos completos). Con muestras más pequeñas, las métricas por 90 se vuelven extremadamente inestables: un jugador que juega 30 minutos y marca un gol obtiene `goals_per90 = 3.0`, un valor completamente no representativo. El umbral de 270 min reduce la varianza de las métricas clave a niveles comparables entre jugadores.

---

### Atributos incluidos en el vector

Cada fila corresponde a **un jugador**. Las métricas de evento se normalizan por 90 minutos.

| Variable | Tipo | Incluida | Justificación |
|---|---|---|---|
| `shots_per90` | Numérica | **Sí** | Volumen de remates generados; indicador principal de amenaza goleadora |
| `shots_on_target_per90` | Numérica | **Sí** | Remates al arco; captura la precisión del disparo independiente del resultado |
| `goals_per90` | Numérica | **Sí** | Contribución ofensiva directa; variable de rendimiento más relevante para delanteros |
| `dribbles_per90` | Numérica | **Sí** | Frecuencia de duelos 1v1 ofensivos; discrimina jugadores desequilibrantes |
| `dribble_success_rate` | Ratio | **Sí** | Eficiencia en regates (completados/intentados); complementa volumen con calidad |
| `carries_per90` | Numérica | **Sí** | Conducciones controladas; refleja participación en progresión con balón |
| `carry_distance_per90` | Numérica | **Sí** | Metros conducidos por 90; distingue portadores de balón de largo recorrido |
| `carries_final_third_per90` | Numérica | **Sí** | Conducciones al tercio final (x ≥ 80); contribución directa al ataque |
| `passes_per90` | Numérica | **Sí** | Participación total en el juego colectivo; varía significativamente por posición |
| `pass_completion_rate` | Ratio | **Sí** | Precisión de pase (completados/intentados); indicador técnico fundamental |
| `progressive_passes_per90` | Numérica | **Sí** | Pases que avanzan > 10 m hacia portería; mide capacidad de progresión del juego |
| `crosses_per90` | Numérica | **Sí** | Centros al área; diferencia jugadores de banda de interiores |
| `through_balls_per90` | Numérica | **Sí** | Pases en profundidad filtrados; indicador de creatividad y visión de juego |
| `pass_switches_per90` | Numérica | **Sí** | Cambios de orientación del juego; captura el rango de pase y lectura táctica |
| `pass_length_avg` | Numérica | **Sí** | Longitud media del pase; distingue estilos (corto/combinativo vs. largo/directo) |
| `pass_acc_under_pressure` | Ratio | **Sí** | Precisión de pase bajo presión; mide compostura técnica en situaciones de presión |
| `pressures_per90` | Numérica | **Sí** | Acciones de pressing ofensivo; refleja intensidad defensiva y trabajo sin balón |
| `ball_recoveries_per90` | Numérica | **Sí** | Recuperaciones del balón; contribución defensiva directa en todas las posiciones |
| `blocks_per90` | Numérica | **Sí** | Bloqueos de tiro/pase; intervención defensiva activa (relevante en defensas) |
| `clearances_per90` | Numérica | **Sí** | Despejes; acción defensiva de último recurso (alta en centrales) |
| `duels_per90` | Numérica | **Sí** | Duelos totales disputados; indicador de combatividad y zona de juego |
| `duel_win_rate` | Ratio | **Sí** | Porcentaje de duelos ganados; mide dominio físico en las disputa |
| `under_pressure_rate` | Ratio | **Sí** | Proporción de acciones realizadas bajo presión rival; indica si el jugador actúa en zonas congestionadas |
| `dominant_position` | Categórica | **Sí** (filtro/color) | Posición mayoritaria del jugador; no entra al espacio numérico pero se usa para colorear la proyección 2D y validar clusters |
| `total_minutes` | Numérica | **Sí** (filtro) | Minutos acumulados; solo como umbral de inclusión (≥ 270 min), no como feature del vector |
| `matches_played` | Numérica | **Sí** (filtro) | Partidos jugados; insumo para validar la representatividad estadística del jugador |

---

### Atributos descartados

| Variable/Atributo | Tipo | Incluida | Justificación del descarte |
|---|---|---|---|
| `event_id` | Identificador UUID | **No** | Clave primaria sin valor predictivo ni semántico |
| `match_id` | Identificador | **No** | Referencia de partido; los jugadores participan en múltiples partidos, no es rasgo del jugador |
| `player_id` | Identificador | **No** | Solo se usa para el JOIN de agregación; no es feature |
| `player_name` | Categórica textual | **No** | ~9.800 valores únicos; alta cardinalidad. Es el *label* del objeto, no una feature |
| `team_id` / `team_name` | Categórica | **No** | Los jugadores cambian de equipo; incorporar el equipo convierte el vector en un descriptor de equipo, no del jugador. Además tiene alta cardinalidad (312 equipos) |
| `timestamp` / `minute` / `second` | Numérica | **No** | Posición temporal de la acción dentro del partido. No refleja habilidad; el mismo jugador puede actuar en cualquier minuto |
| `period` | Categórica ordinal | **No** | Número de período (1–5); contexto del partido, no rasgo del jugador. Los períodos extra time tienen muy pocas observaciones |
| `index` | Numérica | **No** | Número secuencial del evento dentro del partido; sin significado analítico |
| `possession` | Numérica | **No** | Contador de secuencia de posesión por partido; no caracteriza al jugador |
| `related_events` | JSON/texto | **No** | Lista de UUIDs de eventos relacionados; información ya capturada en las métricas de agregación (ej. el bloqueo queda en `blocks_per90`) |
| `play_pattern_name` | Categórica | **No** | Contexto de inicio de jugada (saque de esquina, tiro libre, contrataque…); describe la situación, no la habilidad del jugador |
| `pass_recipient_id` / `pass_recipient_name` | Identificador | **No** | Describe al receptor del pase, no al pasador. Depende de los compañeros de equipo, que cambian entre temporadas y partidos |
| `x`, `y` (coordenadas brutas de inicio) | Numérica | **No** | La posición puntual de cada evento varía por situación táctica; son más útiles agregadas (zonas, promedios). Se aprovechan en métricas derivadas como `carry_distance` y `carries_final_third` |
| `end_x`, `end_y` (coordenadas brutas de fin) | Numérica | **No** | Mismo razonamiento que coordenadas de inicio; se usan en `progressive_passes` y `carries_final_third` |
| Eventos de tipo *Ball Receipt* | Evento (acción pasiva) | **No** | Recibir el balón es la contraparte pasiva de un pase; no refleja agencia del jugador. Representan ~26 % de los eventos y sesgarían los conteos hacia jugadores muy involucrados en posesión sin necesariamente ser los más activos |
| `competition_id` / `season_id` | Identificador | **No** | Filtros de contexto usados en JOINs; no son características del jugador |
| `position_id` / `position_name` (por evento) | Categórica | **No** (reemplazada) | La posición varía dentro del partido por cambios tácticos. Se reemplaza por `dominant_position` (moda de la posición en todos los partidos) |
| Datos 360° (`three_sixty_freeze_frame`) | Espacial | **No** | Solo disponibles para ~8 % de los partidos; incluirlos introduciría sesgo de cobertura y vacíos masivos en el vector |
| `counterpress` | Booleana | **No** | Indica si el evento es parte de un contraataque inmediato tras pérdida; muy escaso (~0,3 % de eventos). La información de pressing ya está capturada en `pressures_per90` |



## **2. ¿Qué transformaciones realizaron en los datos?**

El vector final (`player_feature_vector.parquet`) contiene 4.304 jugadores y 23 features numéricas. Antes de ingresar al espacio de PCA/UMAP se aplicaron tres transformaciones en cascada: imputación de NaN, reducción de asimetría con log1p, y estandarización con StandardScaler.

---

### 2.1 Diagnóstico previo a la transformación

#### Problema 1 — Diferencias de escala

![Escala original de las features](img/01_escala_original.png)

La gráfica muestra los boxplots de las 23 variables en sus valores originales. Las variables de pase (`passes_per90` ≈ 50, `carry_distance_per90` ≈ 300) tienen rangos de hasta 300× mayores que variables de eventos raros (`goals_per90` ≈ 0–0.5, `through_balls_per90` ≈ 0–0.3). Sin estandarización, la distancia euclidiana estaría dominada por las variables de mayor escala, haciendo invisibles las de menor escala en PCA y UMAP.

#### Problema 2 — Distribuciones sesgadas a la derecha

![Distribuciones sesgadas antes y después de log1p](img/02_distribucion_log1p.png)

Cinco variables presentaron **skewness > 2.0**, umbral a partir del cual la cola derecha distorsiona la distancia euclidiana y comprime el espacio de la mayoría de jugadores en un extremo:

| Variable | Skewness original | Skewness después de log1p |
|---|---:|---:|
| `through_balls_per90` | 2.99 | ~0.5 |
| `pass_length_avg` | 2.71 | ~0.4 |
| `goals_per90` | 2.47 | ~0.6 |
| `dribbles_per90` | 2.42 | ~0.5 |
| `shots_on_target_per90` | 2.03 | ~0.4 |

La función `log1p(x) = log(1 + x)` es segura con ceros (log(1+0) = 0), preserva el orden de los valores y reduce la asimetría sin perder información de los jugadores con 0 eventos.

#### Problema 3 — Valores faltantes en ratios

![Valores faltantes por variable](img/03_missing_values.png)

Tres ratios contienen NaN cuando el denominador es cero (el jugador nunca realizó esa acción):

| Variable | NaN | % del total |
|---|---:|---:|
| `dribble_success_rate` | 518 | 12.0 % |
| `duel_win_rate` | 299 | 6.9 % |
| `pass_acc_under_pressure` | 13 | 0.3 % |

**Imputación con 0:** un NaN en `dribble_success_rate` no es un dato "desconocido" — significa que el jugador **nunca intentó un regate**, por lo que tasa de éxito = 0 es el valor semánticamente correcto. No se usa la media ni la mediana porque introducirían información artificial.

#### Variable categórica `dominant_position`

Esta variable **no entra al espacio numérico**. Se excluye del StandardScaler y se usa únicamente como etiqueta de color en el scatterplot 2D para validar que los clusters obtenidos corresponden a posiciones de juego reconocibles.

---

### 2.2 Tabla de transformaciones aplicadas

| **Característica** | **Tipo** | **Transformación** | **Justificación** |
|---|---|---|---|
| `shots_per90` | Numérica | StandardScaler | Escala diferente a otras variables; sensible a distancia euclidiana |
| `shots_on_target_per90` | Numérica | log1p + StandardScaler | Skew = 2.03 — distribución sesgada a la derecha; log1p reduce asimetría preservando ceros |
| `goals_per90` | Numérica | log1p + StandardScaler | Skew = 2.47 — la mayoría de jugadores tiene 0–0.1 goles/90; cola larga de delanteros élite |
| `dribbles_per90` | Numérica | log1p + StandardScaler | Skew = 2.42 — los extremos y mediapuntas tienen 3-5× más regates que el promedio |
| `dribble_success_rate` | Ratio (0–1) | Imputar NaN→0 + StandardScaler | 12.0 % de NaN (jugador sin regates) = 0 real; estandarizar para equiparar escala con métricas per90 |
| `carries_per90` | Numérica | StandardScaler | Escala moderada pero heterogénea por posición |
| `carry_distance_per90` | Numérica | StandardScaler | Valores ~ 50–350 m/90; escala muy superior a ratios |
| `carries_final_third_per90` | Numérica | StandardScaler | Escala diferente a variables de pase |
| `passes_per90` | Numérica | StandardScaler | Variable con mayor rango absoluto (~ 5–100); dominaría sin estandarizar |
| `pass_completion_rate` | Ratio (0–1) | StandardScaler | Sin NaN; equiparar escala con métricas per90 |
| `progressive_passes_per90` | Numérica | StandardScaler | Escala diferente a otras variables |
| `crosses_per90` | Numérica | StandardScaler | Skew = 1.61 — bajo umbral de log1p; StandardScaler es suficiente |
| `through_balls_per90` | Numérica | log1p + StandardScaler | Skew = 2.99 — variable muy rara; la gran mayoría de jugadores tiene 0 pases en profundidad |
| `pass_switches_per90` | Numérica | StandardScaler | Escala diferente a otras variables |
| `pass_length_avg` | Numérica | log1p + StandardScaler | Skew = 2.71 — porteros y defensas centrales tienen longitudes medias 2× mayores que mediocampistas |
| `pass_acc_under_pressure` | Ratio (0–1) | Imputar NaN→0 + StandardScaler | 0.3 % de NaN (nunca recibió presión al pasar); estandarizar para equiparar escala |
| `pressures_per90` | Numérica | StandardScaler | Escala diferente a otras variables |
| `ball_recoveries_per90` | Numérica | StandardScaler | Escala diferente a otras variables |
| `blocks_per90` | Numérica | StandardScaler | Escala diferente a otras variables |
| `clearances_per90` | Numérica | StandardScaler | Escala diferente a otras variables |
| `duels_per90` | Numérica | StandardScaler | Escala diferente a otras variables |
| `duel_win_rate` | Ratio (0–1) | Imputar NaN→0 + StandardScaler | 6.9 % de NaN (sin duelos); estandarizar para equiparar escala |
| `under_pressure_rate` | Ratio (0–1) | StandardScaler | Sin NaN; equiparar escala con métricas per90 |
| `dominant_position` | Categórica | **Sin transformación** (excluida del espacio numérico) | Variable de etiqueta; se usa para colorear la proyección 2D, no entra a PCA/UMAP |

---

### 2.3 Resultado de la transformación

![Features después de transformación completa](img/04_escala_transformada.png)

Tras aplicar la secuencia **imputar NaN → log1p (donde aplica) → StandardScaler**, todas las variables quedan centradas en media ≈ 0 y desviación estándar ≈ 1. La línea roja punteada marca la media. Ahora ninguna variable domina la distancia euclidiana por su escala original — el peso de cada feature en PCA/UMAP depende de su varianza informativa real, no de su unidad de medida.

---

### 2.4 Correlaciones entre features

![Heatmap de correlaciones](img/05_correlacion.png)

El heatmap muestra correlaciones en los valores originales (antes de StandardScaler). Se observan correlaciones altas esperables por diseño:

- `carries_per90` ↔ `carry_distance_per90` (r ≈ 0.9): más conducciones implica más metros conducidos. Ambas se mantienen porque capturan dimensiones distintas (frecuencia vs. longitud por conducción).
- `passes_per90` ↔ `progressive_passes_per90` (r ≈ 0.7): jugadores que pasan más tienden a tener más pases progresivos en valor absoluto, aunque el ratio de progresividad varía.
- `shots_per90` ↔ `shots_on_target_per90` (r ≈ 0.8): ambas se retienen porque `shots_on_target_per90` captura precisión, no solo volumen.

Estas correlaciones no son problema para PCA — el algoritmo las maneja al construir componentes ortogonales — pero sí son importantes para interpretar qué variables explican cada componente principal.

El parquet transformado, listo para PCA/UMAP, se guarda en `analisis_datos/player_feature_vector_scaled.parquet`.



## **3. Aplicación de reducción de dimensionalidad**

Se proyectó el vector de características (4.304 jugadores × 23 features estandarizadas) en 2D usando cuatro técnicas. Cada punto en los scatterplots corresponde a un jugador; el color codifica su grupo de posición: **GK** (portero), **DEF** (defensas centrales y laterales), **DM** (mediocampistas defensivos), **MID** (mediocampistas), **FWD** (delanteros y extremos).

![Comparación de las 4 técnicas](img/punto3/00_comparacion_4tecnicas.png)

---

### 3.1 PCA (Análisis de Componentes Principales)

**Parámetros utilizados:** `n_components=2`, `random_state=42`

**Varianza explicada:**

![Scree plot y scatter PCA](img/punto3/01_pca_varianza_scatter.png)

| Componente | Varianza explicada | Varianza acumulada |
|---|---:|---:|
| PC1 | 28.19 % | 28.19 % |
| PC2 | 24.31 % | **52.50 %** |
| PC3 | 10.80 % | 63.30 % |
| PC4 | 7.54 % | 70.84 % |
| PC5 | 6.12 % | 76.96 % |
| PC6 | 4.12 % | 81.09 % |
| PC7–PC10 | 10.66 % | 91.75 % |
| PC11–PC23 | 8.25 % | 100.00 % |

**Respuesta a la pregunta planteada:**

La varianza acumulada con 2 componentes es **52.50 %** (supera el umbral del 50 %), lo que indica que la representación 2D conserva más de la mitad de la información del espacio original. Esto es un resultado favorable dado que se parte de 23 dimensiones. Sin embargo, el 47.5 % restante no está representado — en particular el PC3 (10.8 %) que probablemente captura diferencias entre mediocampistas defensivos y ofensivos. Para análisis estadístico riguroso (cálculo de distancias entre jugadores) se recomiendan 6 componentes (81 % de varianza acumulada); la proyección 2D es útil para exploración visual.

PC1 polariza porteros y defensas vs. delanteros (eje ofensivo-defensivo general). PC2 separa jugadores con alto volumen de pase (mediocampistas) de los de bajo volumen. Los clusters por posición son coherentes pero con solapamiento entre posiciones adyacentes, lo cual es esperado en un modelo lineal que no captura relaciones no lineales entre variables.

---

### 3.2 t-SNE

**Parámetros utilizados:** `perplexity=30`, `learning_rate='auto'`, `max_iter=1000`, `init='pca'`, `random_state=42`

![t-SNE scatter](img/punto3/02_tsne_scatter.png)

**Respuesta a la pregunta planteada:**

`perplexity=30` significa que t-SNE asume que cada punto tiene aproximadamente 30 vecinos relevantes. Este valor balancea la preservación de estructura local (grupos pequeños, similar a un k-NN con k=30) y la estructura global. Para un dataset de 4.304 jugadores, perplexity=30 es el valor estándar recomendado (el rango efectivo es √N ≈ 65 o entre 5 y 50 en la literatura).

La KL divergence final fue **1.7466** — un valor moderado que indica que la compresión a 2D introduce cierta distorsión. Valores típicos en datasets reales van de 1.0 a 2.5; un valor más bajo sería mejor. Se usó `init='pca'` para evitar la inicialización aleatoria, lo que produce proyecciones más estables y reproducibles.

**Limitación observada:** En t-SNE las distancias globales entre clusters son relativas y no deben interpretarse como distancias absolutas en el espacio original. El cluster de porteros aparece claramente separado del resto, lo cual es esperado. Los clusters entre posiciones de campo son más difusos, lo que sugiere que muchos jugadores comparten perfiles similares entre posiciones adyacentes.

---

### 3.3 UMAP

**Parámetros utilizados:** `n_neighbors=15`, `min_dist=0.1`, `n_components=2`, `random_state=42`

![UMAP scatter](img/punto3/03_umap_scatter.png)

**Respuesta a la pregunta planteada:**

- `n_neighbors=15`: controla cuántos vecinos considera cada punto al construir el grafo local. Valores bajos (5–10) producen clusters más fragmentados y capturan microestructura; valores altos (30–50) preservan mejor la estructura global pero suavizan las fronteras. Con 15 se obtiene un balance entre estructura local y global, apropiado para 4.304 puntos.
- `min_dist=0.1`: distancia mínima permitida entre puntos en el espacio 2D. Valores cercanos a 0 generan clusters más compactos y densos; valores más altos (0.5–0.9) distribuyen los puntos más uniformemente. Con 0.1 los clusters quedan bien definidos sin colapsar puntos.

UMAP produce la separación más clara entre grupos de posición de las cuatro técnicas: los porteros forman un cluster compacto y aislado; los defensas centrales se separan de los laterales; los mediocampistas defensivos forman un grupo intermedio entre defensas y mediocampistas de ataque. Esta separación es más nítida que en t-SNE porque UMAP preserva mejor la estructura global del espacio.

---

### 3.4 MDS (Multidimensional Scaling)

**Parámetros utilizados:** `metric=True` (MDS clásico), `n_components=2`, `n_init=1`, `max_iter=300`, `random_state=42`  
**Nota:** Se usó una muestra aleatoria de **2.000 jugadores** (de 4.304) porque MDS clásico tiene complejidad O(n²) en memoria y O(n³) en cómputo; con el dataset completo requeriría varios minutos y ~370 MB solo para la matriz de distancias.

![MDS scatter](img/punto3/04_mds_scatter.png)

**Respuesta a la pregunta planteada:**

El **stress** final fue **3.838.624** — esta métrica mide la diferencia entre las distancias originales en el espacio de 23 dimensiones y las distancias en la proyección 2D. A diferencia de PCA (que reporta varianza explicada en %) o t-SNE (KL divergence), el stress de MDS es un valor absoluto en unidades cuadráticas de distancia euclidiana, por lo que su magnitud depende de la escala de los datos y del número de puntos. Lo relevante es que sea relativamente bajo comparado con la suma de distancias al cuadrado total.

MDS intenta preservar las distancias originales entre pares de jugadores, a diferencia de PCA (que maximiza varianza) o t-SNE/UMAP (que priorizan vecindades locales). La proyección resultante muestra una distribución más uniforme de los puntos — sin los clusters compactos de UMAP — lo que refleja que muchas parejas de jugadores tienen distancias intermedias en el espacio original, sin aglomeraciones extremas. Esta es la proyección que mejor respeta las distancias absolutas entre jugadores, aunque sacrifica la separación visual de grupos.

**Limitación principal:** El costo computacional O(n²) hace que MDS no sea escalable al dataset completo sin técnicas aproximadas (Landmark MDS o SMACOF con submuestreo), a diferencia de PCA (O(nd²)), t-SNE (O(n log n) con Barnes-Hut) y UMAP (O(n log n)).

---

### 3.5 Comparación de técnicas

| Técnica | Parámetros clave | Calidad de proyección | Clusters posicionales | Escalabilidad |
|---|---|---|---|---|
| **PCA** | n_components=2 | Varianza acumulada = 52.5 % | Moderada (lineal) | Excelente O(nd²) |
| **t-SNE** | perplexity=30, max_iter=1000 | KL divergence = 1.75 | Buena (no lineal) | Moderada O(n log n) |
| **UMAP** | n_neighbors=15, min_dist=0.1 | No reporta métrica global | Muy buena (no lineal) | Buena O(n log n) |
| **MDS** | metric=True, n=2000 | Stress = 3.838.624 | Moderada | Mala O(n²/n³) |

**Técnica elegida para el dashboard:** UMAP, porque produce la separación más clara entre grupos de posición, escala bien a 4.304 puntos, y preserva tanto estructura local como global. PCA se mantiene como alternativa para interpretabilidad y velocidad.

## **4. Diseño de visualizaciones interactivas**

El dashboard se encuentra en `http://localhost:8004/` (Sección 4) y `http://localhost:8004/casos.html` (Sección 5). Está construido con FastAPI (backend, puerto 8004) + HTML + Plotly.js 2.35 (sin framework de frontend), lo que permite cargarlo directamente sin pasos de compilación.

---

### 4.1 Vista principal — Scatterplot 2D

El scatterplot 2D es la vista central de la interfaz. Cada punto representa un jugador proyectado a 2 dimensiones mediante la técnica seleccionada (UMAP por defecto). La posición del punto refleja la similitud con los demás jugadores en el espacio original de 23 features transformadas.

**Codificación visual:**
- **Color:** variable categórica `dominant_position` agrupada en 5 grupos: GK (dorado), DEF (azul), DM (teal), MID (verde), FWD (rojo). La leyenda de colores está siempre visible en el encabezado.
- **Tamaño:** 5 px para todos los puntos; 9 px para los puntos seleccionados con brush — evita superposición sin perder visibilidad.
- **Opacidad:** 70 % para todos cuando no hay selección; 95 % para seleccionados y 8 % para no seleccionados cuando hay brush activo, resaltando visualmente el grupo de interés.
- **Título:** incluye el método utilizado y sus parámetros (e.g., "UMAP — n_neighbors=15, min_dist=0.1").

**Interacciones disponibles:**
| Interacción | Descripción |
|---|---|
| **Zoom** | Scroll del mouse sobre el scatter — hace zoom centrado en el cursor |
| **Pan** | Doble clic y arrastre (modo pan activado desde la barra de herramientas) |
| **Tooltip** | Hover sobre un punto → muestra nombre del jugador, posición exacta y minutos jugados |
| **Brush (box select)** | Arrastrar un rectángulo sobre el scatter → selecciona los jugadores en el área |
| **Lasso select** | Disponible desde la barra de herramientas de Plotly para selección de forma libre |
| **Reset** | Botón "✕ Limpiar" en el header — elimina la selección y restaura opacidades |
| **Cambio de método** | Botones PCA / t-SNE / UMAP / MDS — recarga los datos del método elegido |

---

### 4.2 Vista 2 — Histograma (coordenada)

Muestra la distribución de la feature seleccionada (selector en la barra de la pestaña) para **todos los jugadores** (barras oscuras, #3d4557) y superpone la distribución de los **jugadores seleccionados con brush** (barras doradas, #e5c07b, modo overlay). La actualización ocurre inmediatamente al cambiar la selección en el scatter.

Esta vista responde la pregunta: *"¿Los jugadores que seleccioné tienen valores altos o bajos en esta feature, comparados con el total?"*

---

### 4.3 Vista 3 — Coordenadas Paralelas (coordenada)

Muestra 8 features clave (`passes_per90`, `progressive_passes_per90`, `pressures_per90`, `duels_per90`, `shots_per90`, `dribbles_per90`, `clearances_per90`, `carries_per90`) como ejes verticales paralelos. Cada línea es un jugador. Los jugadores **no seleccionados** aparecen en gris oscuro casi transparente; los **seleccionados** aparecen en amarillo brillante, permitiendo leer su perfil multidimensional de izquierda a derecha.

Esta vista responde: *"¿Qué perfil de features tienen en conjunto los jugadores que seleccioné?"*

---

### 4.4 Vista 4 — Heatmap features × jugadores (coordenada)

Muestra una matriz de hasta 35 jugadores seleccionados (filas: apellidos) × 8 features clave (columnas). Los valores se normalizan por columna a [0,1] para comparabilidad entre features con escalas distintas. El valor original (sin normalizar) se anota en cada celda. Colorscale YlOrRd: amarillo → rojo = bajo → alto.

Esta vista responde: *"¿Qué features son altas o bajas para cada jugador seleccionado individualmente?, ¿existen puntos intrusos con un perfil distinto al del grupo?"*

---

### 4.5 Tabla de vistas y tareas analíticas

| Vista | Objetivo | Tarea analítica soportada |
|---|---|---|
| **Scatterplot 2D** | Explorar similitudes y estructura global | Identificar clusters por posición, outliers, y distancias relativas entre jugadores |
| **Histograma** | Analizar distribución de una feature | Comparar distribución del grupo seleccionado vs. el dataset completo en una dimensión |
| **Coordenadas paralelas** | Comparar perfiles multidimensionales | Visualizar el perfil de 8 features del grupo seleccionado vs. el fondo; detectar subgrupos dentro de la selección |
| **Heatmap** | Detectar patrones y variación dentro del grupo | Identificar jugadores "intrusos" en un cluster (valores atípicos respecto al patrón del grupo) |



## **5. Análisis de proyección 2D: Validación de hallazgos**

Los siguientes casos se analizan con el dashboard interactivo (`http://localhost:8004/casos.html`). Las gráficas estáticas de respaldo están en `analisis_datos/img/punto5/`.

---

### Caso 1 — Dos puntos muy cercanos

**Jugadores:** Mauro Wilney Arambarri Rosa (Right Defensive Midfield, 1.085 min) y Bodda Mouhsine (Right Center Midfield, 421 min)

![Scatter caso 1 — panorama y zoom](img/punto5/01_caso1_scatter.png)

**Procedimiento:** kNN (k=1) sobre 4.304 jugadores identifica la pareja con menor distancia UMAP. Tooltip confirma nombres. Valores originales consultados del parquet `player_feature_vector.parquet`.

![Comparación de features — Caso 1](img/punto5/02_caso1_comparacion.png)

**Evidencia numérica:**

| Feature | A: Arambarri | B: Mouhsine | Dif. (%) |
|---|---:|---:|---:|
| `passes_per90` | 18.081 | 19.435 | 7.0 % |
| `carries_per90` | 15.178 | 17.940 | 15.4 % |
| `shots_per90` | 0.746 | 0.854 | 12.6 % |
| `progressive_passes_per90` | 6.304 | 7.475 | 15.7 % |
| `pass_completion_rate` | 0.697 | 0.692 | 0.7 % |
| `dribbles_per90` | 0.829 | 0.641 | 22.7 % |
| `clearances_per90` | 0.415 | 0.641 | 35.3 % |
| `pressures_per90` | 23.721 | 15.804 | 33.4 % |
| `duels_per90` | 2.156 | 3.417 | 36.9 % |
| **Distancia UMAP (2D)** | | | **0.0003** |
| **Distancia euclidiana 23D** | | | **18.69** |

**¿Por qué son similares?** Ambos son mediocampistas (DM y MID) con perfil de pase moderado (~18-19/90), tasa de completitud similar (~69.5 %) y conducciones equivalentes (~15-18/90). En el espacio transformado (log1p + StandardScaler), la suma cuadrática de diferencias estandarizadas es mínima — UMAP los coloca prácticamente en el mismo punto.

La distancia en el espacio original (18.69) parece alta porque `pressures_per90` domina el cálculo en unidades no escaladas (diferencia = 7.9 unidades). En el espacio estandarizado esa diferencia queda ponderada y no domina el perfil global.

---

### Caso 2 — Dos puntos muy lejanos

**Jugadores:** Giedrius Arlauskis (Goalkeeper, 315 min) y Marcelo Vieira da Silva Júnior (Left Back, 4.960 min)

![Scatter y comparación — Caso 2](img/punto5/03_caso2_scatter_comparacion.png)

**Procedimiento:** Muestra aleatoria de 600 jugadores → matriz de distancias UMAP → par más distante (d=17.76). Aparecen en extremos opuestos del scatter: cluster GK aislado vs. zona DEF-FWD.

| Feature | A: Arlauskis (GK) | B: Marcelo (LB) | Dif. (%) |
|---|---:|---:|---:|
| `dribbles_per90` | 0.000 | 3.139 | 100 % |
| `shots_per90` | 0.000 | 0.798 | 100 % |
| `pressures_per90` | 0.857 | 11.213 | 171 % |
| `carries_per90` | 10.000 | 51.130 | 138 % |
| `passes_per90` | 22.000 | 62.325 | 96 % |
| `pass_completion_rate` | 0.442 | 0.808 | 45 % |
| **Distancia UMAP (2D)** | | | **17.76** |
| **Distancia euclidiana 23D** | | | **210.77** |

**¿Por qué están separados?** El perfil de un portero y un lateral ofensivo son opuestos en casi todas las 23 features. En UMAP la distancia global tiene significado semántico real (a diferencia de t-SNE); la magnitud 17.76 refleja la separación estructural entre los dos extremos del espacio de juego.

---

### Caso 3 — Punto atípico (outlier)

**Jugador:** Benoît Assou-Ekotto (Left Back, 1.839 min — aprox. 20 partidos)

![Outlier — Caso 3](img/punto5/04_caso3_outlier.png)

**Procedimiento:** kNN (k=1) sobre todos los jugadores. Assou-Ekotto tiene la mayor distancia al vecino más próximo: **0.31** en el espacio UMAP.

| Feature | Assou-Ekotto | Media global | Observación |
|---|---:|---:|---|
| `passes_per90` | 52.668 | 29.1 | p~88 |
| `progressive_passes_per90` | **26.921** | ~8.0 | **>p99 — extremo** |
| `carries_per90` | 32.256 | 22.0 | p~90 |
| `clearances_per90` | 2.105 | 1.5 | p~75 |
| `dribbles_per90` | 0.783 | 0.99 | normal |
| `pressures_per90` | 11.209 | 10.2 | normal |

**Categoría: dato válido pero extremo.** Sus valores son físicamente posibles; `progressive_passes_per90 = 26.9` está en el percentil >99. No es error de calidad ni transformación incorrecta. **Acción recomendada:** conservar; considerar RobustScaler si su influencia distorsiona el modelo de similitud.

---

### Caso 4 — Cluster de porteros (GK)

**Grupo:** 312 porteros — el cluster más compacto y visualmente separado del UMAP.

![Cluster GK — Caso 4](img/punto5/05_caso4_cluster.png)

**Perfil GK vs. media global:**

| Feature | Media GK (n=312) | Media global (n=4.304) | Delta |
|---|---:|---:|---:|
| `passes_per90` | 30.22 | 29.11 | +1.11 |
| `dribbles_per90` | **0.023** | 0.986 | **-0.962** |
| `shots_per90` | **0.002** | 0.718 | **-0.716** |
| `pressures_per90` | **0.151** | 10.183 | **-10.032** |
| `carries_per90` | 13.484 | 22.048 | -8.564 |
| `duels_per90` | **0.007** | 2.365 | **-2.357** |

**Patrón:** valores casi nulos en regates, remates, presiones, conducciones, duelos y goles simultáneamente. Esta combinación crea un subespacio sin equivalente en el campo. **No hay puntos intrusos:** la separación es perfecta.

**Vistas coordinadas al seleccionar con brush:**
- **Histograma `dribbles_per90`:** grupo seleccionado concentrado en 0.00–0.05; fondo continuo hasta 1.0+.
- **Coordenadas paralelas:** líneas doradas planas en ejes dribbles, shots, pressures, duels.
- **Heatmap:** columnas de métricas ofensivas en azul claro (mínimas), passes en amarillo (valor moderado).

**Validación:** La separación limpia del cluster GK confirma que la transformación (log1p + StandardScaler) preservó correctamente la distinción semántica entre posiciones — el modelo de similitud funciona.

## **6. Validación de las técnicas de reducción de dimensionalidad**

La validación se realiza con la proyección UMAP (la que mejor preserva estructura global y local) y se contrasta con PCA y t-SNE. La métrica principal es el **silhouette score**: valores cercanos a 1 indican clusters bien separados; valores negativos indican que un grupo está más mezclado con otros que consigo mismo.

![Validación — clusters por posición en 3 técnicas](img/punto5/06_validacion_clusters.png)

---

### 6.1 ¿Los grupos encontrados tienen sentido?

**Sí.** Al colorear el scatterplot con la variable categórica `pos_group` (GK / DEF / DM / MID / FWD), los colores se agrupan coherentemente en las tres técnicas:

| Técnica | Silhouette global | Interpretación |
|---|---:|---|
| **UMAP** | **0.195** | Mejor separación global; captura estructura local + global |
| **t-SNE** | 0.173 | Buena separación local; distancias globales menos fiables |
| **PCA** | 0.088 | Separación más débil; modelo lineal no captura relaciones no lineales entre posiciones |

**Silhouette por grupo de posición (UMAP):**

| Grupo | Silhouette | Distancia intra-cluster | Ratio inter/intra | Interpretación |
|---|---:|---:|---:|---|
| **GK** | **0.934** | 0.910 | **15.1×** | Cluster perfectamente separado — GK es la posición más distintiva del dataset |
| **DM** | 0.225 | 2.058 | 2.32× | Bien separado; perfil defensivo-mediocampista es reconocible |
| **DEF** | 0.199 | 2.788 | 2.47× | Moderado; laterales y centrales comparten algunas características |
| **FWD** | 0.187 | 2.562 | 2.33× | Moderado; extremos y delanteros varían bastante internamente |
| **MID** | **-0.103** | 2.660 | 1.93× | **Negativo** — MID es la categoría más heterogénea; los mediocampistas están más mezclados con grupos adyacentes (DM, FWD) que entre sí |

**Interpretación por dominio:** La coherencia de los clusters confirma que el vector de 23 features y las transformaciones aplicadas capturan correctamente las diferencias entre posiciones. La separación del cluster GK es casi perfecta (silhouette 0.93), lo que valida que la estandarización no borró la información semántica de posición. Los grupos DEF, DM, FWD tienen silhouette positivo y moderado (~0.19–0.22), que es el valor esperado para categorías futbolísticas reales — en el fútbol moderno, las fronteras entre posiciones son fluidas por diseño táctico.

---

### 6.2 ¿Existen agrupaciones inesperadas?

**Sí, una:** los **wing backs** (carrileros) del grupo DEF aparecen en la frontera o dentro del cluster FWD. Los 5 DEF más cercanos al centroide FWD son:

| Jugador | Posición real | Dist. a centroide FWD | `passes_per90` | `dribbles_per90` | `carries_per90` |
|---|---|---:|---:|---:|---:|
| Keysher Fuller Spence | Right Wing Back | 0.24 | 19.1 | 0.63 | 15.4 |
| Nathan Tella | Right Wing Back | 0.27 | 14.4 | 1.39 | 15.2 |
| Anthony Caci | Left Wing Back | 0.51 | 24.4 | 0.55 | 17.5 |
| Tajon Buchanan | Right Wing Back | 0.81 | 15.8 | **3.70** | 20.4 |
| Junya Ito | Right Wing Back | 0.84 | 17.7 | 1.31 | 15.3 |

**¿Artefacto o patrón real?** Es un **patrón real no anticipado**. Los wing backs en sistemas de 3 defensores (3-5-2 o 3-4-3) actúan como extremos puros — suben la banda, centran, y realizan tantos regates y conducciones como los delanteros. Tajon Buchanan tiene 3.70 dribbles/90, comparable a un extremo de élite. El algoritmo los ubica cerca de los FWD porque su perfil estadístico es más similar a un extremo que a un lateral convencional. Esto es correcto — la agrupación revela información táctica real.

La otra agrupación destacable es que **MID tiene silhouette negativo**: los mediocampistas centrales (CAM, CM) están más próximos a los grupos FWD y DM que entre sí. Esto refleja la realidad táctica: un mediocampista atacante tipo CAM tiene más en común con un segundo punta que con un mediocampista defensivo tipo DM, aunque el sistema de clasificación los coloque en el mismo grupo "MID". El vector de características captura esta heterogeneidad correctamente.

---

### 6.3 ¿Existen puntos muy cercanos que en realidad son diferentes?

**Sí.** El Caso 1 documentado (Arambarri Rosa vs Mouhsine) ilustra exactamente este fenómeno:

- Distancia UMAP (2D): **0.0003** — prácticamente idénticos en la proyección
- Distancia euclidiana en espacio original 23D: **18.69**
- `pressures_per90` difiere un 33.4 % (23.7 vs 15.8)
- `duels_per90` difiere un 36.9 % (2.16 vs 3.42)

**Causa:** La proyección 2D descarta el 47.5 % de la varianza total (PCA confirma que 2 componentes solo capturan 52.5 %). Las features donde los jugadores difieren (`pressures_per90`, `duels_per90`) pesan menos en la proyección final que las features donde coinciden (`passes_per90`, `carries_per90`, `pass_completion_rate`). El resultado es una posición idéntica en 2D que oculta diferencias reales en el comportamiento defensivo.

**Implicación para el scouting:** Dos jugadores que aparecen en el mismo punto del UMAP pueden tener diferencias relevantes en una dimensión específica. Para análisis de detalle es imprescindible complementar el scatter 2D con las vistas coordinadas (heatmap y coordenadas paralelas), que sí muestran los 23 valores originales.

---

### 6.4 ¿Existen puntos muy lejanos que deberían parecerse?

**Sí.** Dentro del grupo FWD se encontró el par más distante:

| Jugador | Posición | `passes_per90` | `dribbles_per90` | `shots_per90` | Dist. UMAP |
|---|---|---:|---:|---:|---:|
| Foued Kadir | Right Wing | 42.6 | 2.67 | 1.483 | — |
| Mariano Díaz Mejía | Center Forward | 2.3 | 0.33 | 0.331 | **8.45** |

Ambos pertenecen al grupo FWD pero están a 8.45 unidades UMAP — comparable a la separación entre DEF y FWD en general.

**Causas identificadas:**

1. **Variable con alta varianza que domina la distancia:** `passes_per90` varía dramáticamente por estilo de equipo. Un extremo en un equipo de posesión alta puede tener 50–60 pases/90; el mismo perfil en un equipo de transición directa tendría 15–20 pases/90. Esta diferencia de escala domina la distancia euclidiana aunque el "rol" sea comparable.

2. **Muestra estadística insuficiente en uno de los jugadores:** Mariano Díaz tiene `passes_per90 = 2.3`, valor que sugiere que la mayoría de sus participaciones corresponden a entradas como sustituto en los minutos finales (tiempo real de juego repartido en muchos partidos cortos, cumpliendo el umbral de 270 minutos acumulados pero con estadísticas poco representativas).

3. **Limitación inherente del vector de características:** El vector mezcla features de **habilidad individual** (dribble_success_rate, goals_per90) con features de **sistema táctico** (passes_per90, pressures_per90). Dos jugadores igualmente hábiles en diferentes sistemas tácticos aparecerán separados porque el vector registra el comportamiento real (influenciado por el equipo), no la habilidad pura.

**Acción para mejorar:** Si el objetivo es comparar habilidades independientemente del sistema, se podría ponderar menos las features más dependientes del estilo del equipo, o añadir features relativas al equipo (e.g., `passes_per90 / team_avg_passes_per90`). Esta es la principal limitación del vector actual para scouting cross-liga.

---

### 6.5 Resumen de validación

| Pregunta | Respuesta | Evidencia cuantitativa |
|---|---|---|
| ¿Los clusters corresponden a categorías del dominio? | **Sí, parcialmente** | GK: sil=0.93. DEF/DM/FWD: sil~0.19–0.22. MID: sil=-0.10 |
| ¿Hay agrupaciones inesperadas? | **Sí — son patrones reales** | Wing backs en región FWD (ej. Buchanan: 3.70 dribbles/90); MID se mezcla por heterogeneidad táctica |
| ¿Hay puntos cercanos realmente diferentes? | **Sí** | Arambarri vs Mouhsine: UMAP=0.0003, 23D=18.69; pressures difiere 33 %. La 2D captura el 52.5 % de la información |
| ¿Hay puntos lejanos que deberían parecerse? | **Sí** | Dos FWD separados 8.45 UMAP por `passes_per90` (estilo de equipo) y por muestra insuficiente |
| ¿Qué técnica es más válida para scouting? | **UMAP** | Silhouette global más alto (0.195), separación GK 15.1×, preserva estructura global y local simultáneamente |
