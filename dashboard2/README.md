# StatsBomb Football Explorer — Dashboard 2

Dashboard interactivo de análisis de fútbol con selección por país, alineaciones, heatmaps y pases.

## Cómo arrancar

### Opción 1 — Script automático

```powershell
cd "D:\CIENCIA DE DATOS\PROYECTO_STATSBOMB_V2\dashboard2"
.\start.ps1
```

### Opción 2 — Manual (dos terminales)

**Terminal 1 — Backend (FastAPI):**
```powershell
cd "D:\CIENCIA DE DATOS\PROYECTO_STATSBOMB_V2\dashboard2\backend"
py -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 — Frontend (Next.js):**
```powershell
cd "D:\CIENCIA DE DATOS\PROYECTO_STATSBOMB_V2\dashboard2\frontend"
npm run dev -- --port 3001
```

Luego abre **http://localhost:3001**

## Flujo de uso

1. **Selecciona un país** → haz clic en uno de los círculos del mapa SVG
2. **Elige liga y temporada** → selector desplegable
3. **Selecciona un partido** → dropdown con resultado y estadio
4. **Haz clic en un jugador** del campo (o en la lista lateral)
5. El **heatmap** muestra su distribución de posiciones
6. El **mapa de pases** muestra sus pases con flechas por tipo
7. Usa el **slider de tiempo** para filtrar por rango de minutos y ver la evolución

## Stack técnico

| Capa       | Tecnología                       |
|------------|----------------------------------|
| Frontend   | Next.js 16, TypeScript, Tailwind |
| Estado     | Zustand                          |
| Gráficos   | SVG nativo + Canvas              |
| Backend    | FastAPI + Uvicorn                |
| Base datos | DuckDB + Parquet                 |

## Endpoints de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servicio |
| GET | `/api/countries` | Países con partidos disponibles |
| GET | `/api/competitions?country_name=Spain` | Ligas por país |
| GET | `/api/matches?competition_id=11&season_id=90` | Partidos |
| GET | `/api/match/{id}/lineup` | Alineación inicial Starting XI |
| GET | `/api/match/{id}/events-summary` | Resumen eventos por minuto |
| GET | `/api/match/{id}/player/{pid}/heatmap` | Heatmap de posiciones |
| GET | `/api/match/{id}/player/{pid}/passes` | Pases del jugador |
| GET | `/api/match/{id}/positions?minute_from=0&minute_to=5` | Eventos en rango |
