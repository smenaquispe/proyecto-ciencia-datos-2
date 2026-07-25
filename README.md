# PROYECTO_STATSBOMB_V2

Pipeline de análisis de jugadores sobre [StatsBomb Open Data](https://github.com/statsbomb/open-data):
descarga → parquets → features/clustering → **dashboard_final** (FastAPI + Next.js).

> Todo lo generado (datos, parquets, modelos `.pt`, figuras) está en `.gitignore` y se regenera con este README.

## Requisitos

- **Python 3.12** (en Windows se ejecuta con `py`, no `python`)
- **Node.js 18+** (para el frontend)
- Dependencias Python:

```powershell
pip install -r dashboard_final/backend/requirements.txt
pip install requests umap-learn matplotlib seaborn scipy
```

- Ejecutar **todos los scripts desde la raíz del proyecto** (los de descarga usan rutas relativas).

## Estructura

```
config.py                 # URL base de StatsBomb open-data
download_scripts/         # Fase 1: descarga JSON y genera parquets
analisis_datos/           # Fase 2: features, proyecciones, clustering (parquets que consume la API)
dashboard_final/          # Fase 3: backend (FastAPI :8005) + frontend (Next.js :3005)
data/raw/                 # JSON descargados (ignorado por git)
data/processed/           # parquets tabulares (ignorado por git)
dashboard/, dashboard2..4/  # versiones antiguas, ignorar
```

## Fase 1 — Descarga y transformación a parquets

Cada script descarga los JSON a `data/raw/` y genera sus parquets en `data/processed/`.
Tienen *skip-if-exists*: se pueden re-ejecutar sin miedo; solo procesan lo que falte.

```powershell
py download_scripts/download_competitions.py          # 1. competitions.json -> processed/parquet/competitions.parquet
py download_scripts/download_matches.py               # 2. (lee 1) -> matches/matches_fact.parquet + dimensions/*.parquet
py download_scripts/download_events.py                # 3. (lee 2) -> events/events_fact.parquet  (~3.400 partidos, tarda)
py download_scripts/download_lineups.py               # 4. (lee 2) -> lineups/match_lineup_players.parquet + player_match_position_fact.parquet
py download_scripts/reprocess_events_with_player.py   # 5. OBLIGATORIO: reescribe events_fact.parquet añadiendo player_id y campos pass_*
py download_scripts/download_three_sixty.py           # 6. opcional, nada downstream lo usa
```

- El paso 3 es el largo (descarga ~3.400 archivos). Los pasos 3 y 4 son independientes entre sí.
- Sin el paso 5, la Fase 2 falla (faltan `player_id`, `pass_length`, `pass_outcome`, etc.).

## Fase 2 — Análisis (parquets que consume el dashboard)

En este orden (cada paso lee la salida del anterior):

```powershell
py analisis_datos/feature_vector.py              # 1. player_feature_vector.parquet (23 features per90, masculino, >=270 min)
py analisis_datos/transformaciones.py            # 2. player_feature_vector_scaled.parquet
py analisis_datos/reduccion_dimensionalidad.py   # 3. projections.parquet (PCA/t-SNE/UMAP/MDS; t-SNE tarda minutos)
py analisis_datos/tactical_features.py           # 4. player_tactical_features.parquet (zonas, red de pases, motifs)
py analisis_datos/build_enriched.py              # 5. player_enriched_scaled.parquet
py analisis_datos/autoencoder_embedding.py       # 6. player_embedding.parquet + autoencoder.pt (torch; CPU es suficiente)
py analisis_datos/dec_embedding.py --k 4 --out player_dec_labels.parquet      # 7. DEC k=4
py analisis_datos/dec_embedding.py --k 8 --out player_dec_labels_v2.parquet   # 8. DEC k=8
py analisis_datos/precompute_3d.py               # 9. player_dec_v2_3d.parquet (vista 3D instantanea en el dashboard)
```

Opcionales (benchmarks/figuras, el dashboard no los necesita):
`emre_clustering.py`, `compare_clustering.py`, `generar_casos.py`.

### Parquets que necesita el backend

| Archivo | Obligatorio | Lo genera |
|---|---|---|
| `data/processed/parquet/competitions.parquet` | Sí | Fase 1.1 |
| `data/processed/matches/matches_fact.parquet` | Sí | Fase 1.2 |
| `data/processed/events/events_fact.parquet` (reprocesado) | Sí | Fase 1.3 + 1.5 |
| `data/processed/lineups/*.parquet` | Sí | Fase 1.4 |
| `data/processed/dimensions/team_dim.parquet`, `season_dim.parquet` | Sí | Fase 1.2 |
| `analisis_datos/projections.parquet` | Sí (núcleo del dashboard) | Fase 2.3 |
| `analisis_datos/player_feature_vector.parquet` y `_scaled` | Sí | Fase 2.1–2.2 |
| `analisis_datos/player_embedding.parquet` | No (endpoint AE+FCM vacío) | Fase 2.6 |
| `analisis_datos/player_dec_labels*.parquet`, `player_dec_v2_3d.parquet` | No (endpoints DEC vacíos) | Fase 2.7–2.9 |

## Fase 3 — Arrancar el dashboard

Dos terminales:

```powershell
# Terminal 1 — API en http://localhost:8005  (docs: /docs, health: /api/health)
py dashboard_final/backend/main.py

# Terminal 2 — UI en http://localhost:3005
cd dashboard_final/frontend
npm install        # solo la primera vez
npm run dev
```

- El frontend llama a `http://localhost:8005` por defecto; para cambiarlo:
  `$env:NEXT_PUBLIC_API_URL="http://otro:8005"` antes de `npm run dev`.

## Troubleshooting

- **`python` no funciona** → usa `py` (el alias `python` abre la Microsoft Store).
- **La API devuelve listas vacías** → falta algún parquet; revisa la tabla de la Fase 2.
- **Error de columna `player_id` en Fase 2** → te saltaste el paso 1.5 (`reprocess_events_with_player.py`).
- **Puerto ocupado** → el backend usa el 8005 y el frontend el 3005; cierra procesos previos de uvicorn/next.
- **Re-descargar desde cero** → borra `data/raw/` y `data/processed/` y repite la Fase 1.

## Documentación adicional

- `docs/documentacion_tablas.md` — columnas y claves de todas las tablas/parquets.
- `docs/dashboard_tasks.md` — detalle de endpoints y pipeline offline.
- `demir.md`, `emre.md` — referencias teóricas (DEC, índices de validación de clustering).
