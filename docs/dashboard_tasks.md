# Dashboard StatsBomb — Tareas de Análisis Visual y Mapeo Munzner

Documento técnico-interno. Resume qué tareas analíticas cubre el dashboard
`dashboard_final/` y cómo cada componente se alinea con el marco **What-Why-How**
de Tamara Munzner, codificación visual (marcas/canales), interacción, facetado
y reducción.

Las referencias a `demir.md` y `emre.md` corresponden a los papers incluidos en
el repositorio.

---

## 1. Pila de datos y capas

### 1.1 Pipeline offline (`analisis_datos/`)

| Script | Output | Función |
|---|---|---|
| `feature_vector.py` | `player_feature_vector.parquet` | 23 features per90/ratio por jugador |
| `tactical_features.py` | `player_tactical_features.parquet` | ~35 features tácticos (zones, motifs, network) |
| `build_enriched.py` | `player_enriched_scaled.parquet` | 58 features concatenados + escalado log1p+StandardScaler |
| `autoencoder_embedding.py` | `player_embedding.parquet`, `autoencoder.pt` | AE simétrico `D→40→20→10` (pretrain DEC) |
| `dec_embedding.py` | `player_dec_labels.parquet`, `..._v2.parquet` | **DEC** (refinamiento KL sobre AE) k=4 (Demir) / k=8 (v2 sub-perfiles) |
| `emre_clustering.py` | `emre_results.parquet`, `emre_best_labels.parquet` | Comparativa A1 de Akhanli-Hennig sobre el latente DEC |
| `compare_clustering.py` | `compare_clustering.parquet` | FCM vs DEC vs Emre (ARI/NMI/Silhouette) |

Resultado de la comparativa: sobre el latente DEC, el clustering Emre-A1 (k=4
KMeans) alcanza **ARI=0.97**, **NMI=0.96**, **Silhouette=0.653** vs DEC=0.653
y FCM=0.062 (degradado). Emre es utilizable; recupera el mismo clustering vía
un marco estadístico clásico (sin red).

### 1.2 Backend (`dashboard_final/backend/main.py`)

FastAPI en `:8005`. Endpoints:

```
GET /api/projections?method=umap|pca|tsne|mds
GET /api/cluster/fcm?n_clusters=5
GET /api/cluster/aefcm?n_clusters=5
GET /api/cluster/dec             → k=4 (Demir)
GET /api/cluster/decv2           → k=8 sub-perfiles; devuelve (x,y,z) = PCA3 latente
GET /api/players                 → búsqueda + filtro pos_group
GET /api/players/{id}/matches
GET /api/players/{id}/profile?limit=all|N
GET /api/players/{id}/heatmap?limit=&cell_size=
GET /api/players/{id}/pass-network?limit=
GET /api/players/{id}/goals?limit=
GET /api/players/{id}/assists?limit=
GET /api/players/{id}/defensive-pressure?limit=
GET /api/players/{id}/key-actions?n=20   ← NUEVO: top-N jugadas por peso táctico
POST /api/players/compare
GET /api/health
```

### 1.3 Frontend (`dashboard_final/frontend/`)

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4. Zustand store.
Render: SVG manual inline (sin lib de charts).

---

## 2. Taxonomía de tareas analíticas → implementación

| ID | Tarea | Implementación | Dónde |
|---|---|---|---|
| **T1** | Cuantificar y comparar rendimiento individual (pases, duelos, tiros) y scouting multivariado | `PentagonChart` (radar 12 métricas), `GroupComparison` (barras de promedios por feature), `/api/players/compare` | center bottom + right sidebar Tab "Grupo" |
| **T2** | Modular interactivamente los pesos de evaluación para distintos roles posicionales | `PlayerScoring` (sliders por dimensiones pass/duel/shot/defense + composite score) | right sidebar Tab "Puntuación" |
| **T3** | Explorar huella espacial y direccionalidad de las acciones en el terreno | `HeatmapPanel` (grids 120×80), `PassNetworkPanel` (vectores de pase + key-pass glow), `GoalsPanel` (ubicación de tiros), `AssistsPanel` (origen→tiro), `DefensivePressurePanel` (presión + counterpress flag), `KeyActionsPanel` (overview + lista) | center tabs |
| **T4** | Identificar perfiles tácticos latentes vía clustering no supervisado sobre features objetivas | `ProjectionScatter` (FCM, AE+FCM, **DEC**), `ProjectionScatter3D` (DEC v2 k=8 con rotación 3D), `MembershipOverlap` (teoría de conjuntos fuzzy por sub-perfil) | left sidebar + overlay 3D + right sidebar Tab "Conjuntos" |

---

## 3. Mapping Munzner por componente

### `ProjectionScatter` (algoritmos de proyección + clustering k=4)

| Munzner | Implementación |
|---|---|
| **What**: tabla de atributos proyectados (x,y por método) | `projections.parquet` (UMAP/PCA/t-SNE/MDS) |
| **Why**: ** descubrir ** agrupamiento latente; consulta ** resumir ** comparando clusters; target ** características ** latentes | exploración + color por cluster |
| **How: marcas**: puntos = jugadores | `<circle>` SVG |
| **How: canales**: posición (x,y) — canal más preciso para magnitudes ordinales; color del cluster — canal de identidad para categórico; tamaño (radio) — selección/hover; opacidad — grado de membresía (DEC/FCM) o densidad | Principio de Efectividad satisfecho (atributo principal → posición) |
| **Interacción**: zoom (wheel, +/− buttons), pan (Shift+drag), filtro posicional (`POS_GROUPS`), selección click-resaltado vinculado | Shneiderman: overview → zoom/filter → detalles (tooltip) |
| **Facetado**: small multiples via tabs de abajo donde cada jugador seleccionado aparece como sub-panel | `HeatmapPanel.entries`, `GoalsPanel.entries`, etc |
| **Reducción**: filtrado por `posFilter` para reducir visual clutter cuando el algoritmo es proyección puntual | |

### `ProjectionScatter3D` (DEC v2 k=8) — vista opcional overlay

| Munzner | Implementación |
|---|---|
| **What**: tabla proyectada con 3 componentes PCA del latente DEC (n=4304, k=8) | `player_dec_labels_v2.parquet` |
| **Why**: ** identificar ** perfiles tácticos finos (sub-perfiles), ** comparar ** jugadores en el espacio latente | rotación 3D + linked highlighting contra clustering |
| **How: marcas**: puntos = jugadores | `<circle>` en SVG, sorteados por depth z-back-to-front |
| **How: canales**: posición proyectada (x,y en pantalla), tamaño (radio por depth → perspective), color (cluster), opacidad (depth + membership) | "seudo-3D" ortográfico |
| **Interacción**: rotación yaw/pitch con mouse-drag (Munzner: "navegación"), auto-rotate on/off, reset,_Close | sin lib 3D; upgrade path: three.js |
| **Aceleración GPU**: usa la GPU AMD RX 7600 vía canvas acceleration del navegador (compositor D3D12) | no Overhead |

→ Ponytail: descartado el approach SVG de 4304 puntos rotando a cada frame;
usar Canvas 2D si la rotación se satura. Upgrade path: WebGL points (regl)
para decenas de miles de jugadas si escala el dataset.

### `MembershipOverlap` (set theory fuzzy)

| Munzner | Implementación |
|---|---|
| **What**: tabla de memberships `m1..m8` por jugador, tomados del payload `/api/cluster/decv2` | `scatterPlayers[*].memberships` |
| **Why**: ** comparar ** dos jugadores en términos de sus perfiles latentes (T4); target ** carácter shared ** between players | visible solo cuando `algorithm='decv2'` y `selectedPlayerIds.length === 2` |
| **How: marcas**: rectángulos segmentados = barras tricolor | 1 fila por sub-perfil (8 filas verticales) |
| **How: canales**: longitud del segmento = magnitud de cada fragmento de conjunto (atributo continuo) — canal de magnitud; color del segmento = identidad (sólo-A / compartido / sólo-B) — canal categórico correcto | Principio de Expresividad satisfecho |
| **Set theory**: `unique_A = max(0, m_A − m_B)`, `shared = min(m_A, m_B)`, `unique_B = max(0, m_B − m_A)` → barra dividida Expresividad-fiel a fuzzy set intersection | headline score local `Jaccard = Σ min / Σ max` |
| **Interacción**: tooltip por segmento muestra los % exactos | |

### `KeyActionsPanel` (jugadas importantes)

| Munzner | Implementación |
|---|---|
| **What**: tabla de eventos `KeyAction[]` por jugador (top-N por peso táctico) | `/api/players/{id}/key-actions` |
| **Why**: ** presentar ** momentos clave de un jugador; ** comparar ** 2 jugadores por sus top jugadas; target ** tendencias ** de impacto (cluster de goles/recuperaciones) | tab center "Jugadas" |
| **How: marcas**: puntos en pitch (overview) + rows en lista lateral (details) | coordinated views |
| **How: canales**: posición (x,y) pitch sobre cancha 120×80 — magnitud de posicionamiento; tamaño (radio) = peso cualitativo (1-5) — magnitud; color del punto = identidad de jugador; color lateral = peso (colo mapa calor) | Overview + details-on-demand |
| **Interacción**: hover row → highlight en pitch (Linked Highlighting Munzner); al revés hover point → highlight row | coordinated highlights |
| **Peso táctico** (back-end): `Goal=5, Saved=3, Shot=1, BallRecovery=3, Interception=3, Pressure+counterpress=3, Pass+through_ball=3, Pass+cross=2, Pass+switch=2, Clearance=2, Block=2` filtrado `weight ≥ 2` | CASE WHEN en SQL DuckDB sobre `events_fact` |

### `HeatmapPanel`, `PassNetworkPanel`, `GoalsPanel`, `AssistsPanel`, `DefensivePressurePanel`

| Munzner | Implementación |
|---|---|
| **What**: tabla de eventos con (x,y,end_x,end_y,minute,type) | endpoints existentes |
| **Why**: T3 — explorar huella espacial y dirección a nivel táctico-posicional | center tabs |
| **How: marcas**: rectángulos de celda (heatmap), vectores/arrows (passes, assists), puntos (goals, pressure) | small multiples para N jugadores seleccionados en un mismo SVG (Munzner small multiples) |
| **How: canales**: posición (x,y) — magnitud absoluta; color (heatmap intensity, counterpress flag en rojo) — canal de identidad+rango; grosor de línea (key-pass glow) — rango | |
| **Interacción**: hovering (tooltip player/min), pulsación de color por secondary attributes | |

### `PlayerScoring` (T2)

| Munzner | Implementación |
|---|---|
| **What**: tabla de features agregados con pesos editables por jugador | propio store local `playerWeights` |
| **Why**: **producir** — derivar un composite score sensible al rol (T2) | sliders |
| **How: marcas**: rectángulos deslizables (sliders), barra de composite score | |
| **Interacción**: ajuste de peso en tiempo real — cambio de stream inmediato, recalculo local | |

### `GroupComparison` + `PentagonChart` (T1)

| Munzner | Implementación |
|---|---|
| **What** | features agregados del grupo de jugadores seleccionados |
| **Why**: ** resumir ** comparativo — para scouting multivariado | |
| **How: marcas** | barras horizontales (`GroupComparison`) / pentagono radar (`PentagonChart`) |
| **How: canales** | longitud (barras) — magnitud; ángulo+radio (pentágono) — magnitud por eje; coloración por jugador (PentagonChart) | small multiples compare-friendly |

---

## 4. Mantra Shneiderman "Overview first, zoom + filter, details on demand"

Cumplido en:

- **Overview first**: `ProjectionScatter` muestra los 4,304 jugadores de un
  vistazo (o el cluster 3D v2 con rotación automática).
- **Zoom + filter**: zoom (wheel/botones), pan (Shift+drag), filter por
  `pos_group` (cinco toggles DEF/MID/FWD/etc), `timeLimit` (slider todo/N).
- **Details on demand**: tooltip en hover, lista de `KeyActionsPanel` para
  eventos top, pestañas Heatmap/Passes/Goals/Asists/Pressure/Jugadas con
  enfoque en el subconjunto seleccionado.

---

## 5. Facetado en múltiples vistas (Munzner §5)

- **Multiforma**: mismo dataset de jugadores se renderiza en scatter 2D/3D,
  pitch heatmap, bars GroupComparison, radar PentagonChart, lista KeyActions.
- **Overview + detail**: `ProjectionScatter` (contexto global) ↔ pestañas
  laterales con detalle por jugador seleccionado.
- **Small multiples**: `HeatmapPanel`, `GoalsPanel`, `AssistsPanel`,
  `DefensivePressurePanel` reciben `entries[]` y comparten un mismo SVG con
  color por jugador — comparación directa.
- **Linked highlighting**: hover en `KeyActionsPanel` fila resalta punto en
  pitch, y viceversa (Munzner "vistas coordinadas").

---

## 6. Reducción de ítems y atributos (Munzner §6)

| Técnica | Dónde |
|---|---|
| **Filtrado**: por `pos_group`, por `timeLimit` (todo / últimos N partidos), por `weight ≥ 2` en key-actions | sidebar Scatter + KeyActions SQL |
| **Agregación**: GroupComparison promedia features; PentagonChart compara agregados; HeatmapPanel agrega por celda grid | |
| **Reducción dimensional**: UMAP/PCA/t-SNE/MDS (2D) y AE+FCM embedding 10D → PCA2/PCA3 para visualización | projections.parquet + DEC labels |
| **Reducción temporal**: `TimeRangeSlider` → "all" o últimos N partidos | store `timeLimit` |

---

## 7. Notas de diseño y limitaciones

- **DEC v2 (k=8)**: entrenado reutilizando `autoencoder.pt` (Demir AE pretrain) y
  refinando sobre el latente con KL(P‖Q) como en `demir.md` Appendix B.
  Distribución de clusters: `[677, 584, 569, 313, 443, 405, 542, 771]`.
- **DEC v2 3D**: latente 10D → PCA3 → render ortográfico rotacional
  (yaw/pitch). Sin three.js: SVG con matriz de rotación + depth sort.
- **Proxies Demir**: dataset abierto de StatsBomb no incluye eventos de
  `Run/Acceleration`, así que esas features del paper no se incluyen. Sustituído
  por `Carry` (velocidad = dist/duration) en `tactical_features.py` ya existente.
- **Emre clustering**: implementado en Python puro (sin paquete R `fpc`):
  KMeans,PAM-linkage substituído por kmeans (sklearn-extra roto por numpy 2.1),
  Spectral omitido por coste O(n³), Bootstab proxy apagado por n=4304 inviable;
  upgrade paths documentados en `analisis_datos/emre_clustering.py`.
- **Sin GPU en training**: PyTorch CPU es suficiente para n=4304 / dim=57 /
  AE `D→40→20→10` (~30s por run). AMD RX 7600 no soporta CUDA; DirectML
  ahorraría ~10-15s y se descarta como YAGNI.

---

## 8. Cómo arrancar

```powershell
# Reentrar DEC por nueva K si cambias algo:
& "C:\Users\Usuario\AppData\Local\Programs\Python\Python312\python.exe" analisis_datos\dec_embedding.py --k 8 --out player_dec_labels_v2.parquet

# Backend
& "C:\Users\Usuario\AppData\Local\Programs\Python\Python312\python.exe" dashboard_final\backend\main.py

# Frontend (otra terminal)
npm run dev --prefix dashboard_final\frontend
# → http://localhost:3005
```

Para comparar DEC v2 vs v1: cambia el selector de algoritmo al botón "DEC v2";
overlay 3D aparece encima. Selecciona 2 jugadores; pestaña "Conjuntos" en el
sidebar derecho muestra el MembershipOverlap.