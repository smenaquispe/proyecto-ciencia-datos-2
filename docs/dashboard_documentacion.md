# StatsBomb Scout Analytics — Documentación Técnica

**Versión:** 1.0 | **Tecnología:** StatsBomb Open Data + DuckDB + FastAPI + Next.js  
**Propósito:** Herramienta de análisis táctico para scouting y dirección técnica de fútbol profesional

---

## 1. Tareas de Ciencia de Datos (Framework Evers et al., 2024)

El dashboard implementa las seis tareas analíticas definidas por Evers et al. en _"Visual analytics of soccer player performance using objective ratings"_ (Information Visualization, 2024). Cada tarea transforma datos crudos de StatsBomb en decisiones tácticas concretas.

---

### T1 — Cuantificación Objetiva del Rendimiento

**¿Qué resuelve?**  
Eliminar la subjetividad del análisis de jugadores. En lugar de depender de crónicas periodísticas o impresiones visuales, cada acción del jugador recibe una puntuación de 0 a 10 basada exclusivamente en métricas medibles extraídas de los eventos StatsBomb.

**Implementación en el dashboard:**  
El backend (`dashboard2/backend/main.py`) procesa los eventos StatsBomb para cada jugador en cada partido:

- **Pases:** Se evalúa la presión recibida al pasar (modelo de campo visual con semicírculos de 9m y 3m), la precisión de pase (via regresión logística en el paper, aquí simplificada por `pass_outcome`), y el avance posicional (coordenada `end_x > x`).
- **Duelos:** Se contabilizan duelos totales vs. regates exitosos como proxy de duelos ganados (dado que el campo `duel_outcome` no está disponible en los parquets procesados).
- **Tiros:** Se evalúan por precisión (tiros a puerta / total) y por proximidad al gol (distancia euclidiana como proxy del xG de StatsBomb).

**Cómo usarlo:**  
Al seleccionar un jugador en la vista de Formaciones (clic sobre el punto del campo), el Panel Derecho muestra las barras de puntuación 0-10 actualizadas en tiempo real para ese jugador en ese partido específico.

---

### T2 — Generación de Puntuaciones por Categoría y Overall

**¿Qué resuelve?**  
Agregar las acciones individuales (T1) en tres pilares tácticos comparables y en un score global único. Esto permite comparar jugadores de diferentes posiciones de forma justa.

**Fórmulas implementadas:**

```
pass_score  = (completion_rate + pressure_rating + direction_score + length_score) / 4
duel_score  = (win_rate + pressure_rating + area_score) / 3
shot_score  = (shot_accuracy + xg_score) / 2
overall     = (w_p × pass_score + w_d × duel_score + w_s × shot_score) / (w_p + w_d + w_s)
```

Donde `w_p`, `w_d`, `w_s` son los pesos ajustados en T3 (por defecto 1.0 cada uno).

**Implementación en el dashboard:**  
El pentágono de rendimiento (panel inferior izquierdo) visualiza hasta 11 métricas organizadas en forma de polígono de N-vértices. Las barras de T1/T2 en el Panel Derecho muestran los scores con código de color semáforo: verde ≥ 7.0 | amarillo 5.0-6.9 | naranja 3.0-4.9 | rojo < 3.0.

**Cómo usarlo:**  
Comparar visualmente la forma del polígono entre distintos jugadores: un polígono más grande indica mejor rendimiento global; la forma revela el perfil táctico (jugador defensivo vs. ofensivo, rematador vs. distribuidor).

---

### T3 — Ajuste Interactivo de Pesos por Posición o Rol

**¿Qué resuelve?**  
Un ojeador buscando un mediapunta necesita dar más peso a los pases; uno buscando un delantero centro, más a los tiros. T3 permite que el usuario adapte el modelo de evaluación a sus necesidades específicas sin modificar código.

**Implementación en el dashboard:**  
Los tres sliders en el Panel Derecho (sección "Pesos — T3") permiten ajustar los multiplicadores de cada categoría entre 0.0× y 2.0× con paso de 0.1. El Overall se recalcula en tiempo real en el cliente usando los pesos actuales:

```typescript
const weighted = (pass_s × w.pass + duel_s × w.duel + shot_s × w.shot) / (w.pass + w.duel + w.shot)
```

Los pesos ajustados también se propagan a la vista Ranking (T4), actualizando el ordenamiento de todos los jugadores del partido simultáneamente.

**Cómo usarlo:**

- **Scouting de pivote defensivo:** Pases × 1.5 | Duelos × 1.8 | Tiros × 0.3
- **Scouting de extremo atacante:** Pases × 0.8 | Duelos × 1.0 | Tiros × 1.5
- **Análisis general:** Pesos iguales (1.0 × 1.0 × 1.0)

---

### T4 — Comparativa de Jugadores y Benchmarking

**¿Qué resuelve?**  
Contextualizar el rendimiento de un jugador frente al resto del partido. Un score de 6.5 en pases es diferente si la media del partido es 4.0 que si es 7.5.

**Implementación en el dashboard:**  
La tabla **Ranking del partido** (panel superior derecho) muestra todos los jugadores del partido con sus scores. Características:

- Ordenable por cualquier columna (Overall, Pases, Duelos, Tiros, N.Pases, N.Tiros) con clic en el encabezado
- Filtraba por equipo (Local / Visitante / Todos)
- El jugador seleccionado queda resaltado con su color de equipo (verde = local, naranja = visitante)
- Mini-barras proporcionales para comparación visual instantánea
- Hover sobre una fila → resalta ese jugador en el campo de formaciones (interactividad cruzada)
- Los pesos de T3 se aplican al Overall de toda la tabla en tiempo real

**Cómo usarlo:**  
Ordenar por Overall descendente para identificar los jugadores con mejor rendimiento; filtrar por equipo rival para analizar amenazas; combinar con T3 para un ranking adaptado al perfil buscado.

---

### T5 — Análisis Detallado de Situaciones de Juego

**¿Qué resuelve?**  
 Ir más allá de los números y ver el "por qué" de cada puntuación. Visualizar dónde actúa el jugador, qué pases elige y desde dónde le presionan.

**Implementación en el dashboard — tres capas de profundidad:**

**Capa 1: Formaciones (panel superior izquierdo)**  
Ambos equipos sobre el mismo campo SVG. Cada equipo ocupa su mitad: local en la izquierda (GK ≈ x=8), visitante en la derecha (GK ≈ x=112). Las posiciones provienen de las tácticas de Starting XI del evento StatsBomb.

**Capa 2: Mapa de calor (panel central izquierdo)**  
Cuadrícula de celdas de 5×5 metros que acumula todos los eventos con coordenadas del jugador en el rango de minutos seleccionado. El centroide ponderado (círculo pequeño sobre el mapa) indica la zona de mayor actividad.

**Capa 3: Red de pases (panel central derecho)**  
Flechas coloreadas semánticamente: verde = completado en progresión | azul = completado en retroceso | amarillo = bajo presión | rojo punteado = incompleto. Los puntos rojos con líneas punteadas indican el origen de la presión cuando se activa el filtro "Bajo presión".

**Filtros disponibles:** Todos | Completados | Incompletos | Bajo presión | Adelante | Atrás

**Cómo usarlo:**

1. Seleccionar un jugador en el campo → se activan las tres vistas simultáneamente
2. Ajustar el slider de minutos (Panel Derecho) para analizar fases específicas del partido (ej. min 0-45 vs 45-90)
3. Usar el filtro "Bajo presión" para entender cómo se comporta el jugador cuando es presionado y de dónde viene esa presión

---

### T6 — Filtrado Multivariante Avanzado (Coordenadas Paralelas)

**¿Qué resuelve?**  
Los datos de pases tienen múltiples dimensiones simultáneas. Una simple tabla o un mapa no puede mostrar correlaciones entre zona de inicio, longitud, ángulo, presión y resultado al mismo tiempo. Las coordenadas paralelas permiten identificar patrones ocultos: "¿los pases cortos desde campo propio bajo presión terminan siendo incompletos?"

**Implementación en el dashboard:**  
El panel inferior derecho implementa coordenadas paralelas interactivas con:

- **15 dimensiones disponibles** agrupadas en 4 categorías:
  - _Posición:_ Inicio X, Lateral inicio, Destino X, Lateral destino
  - _Calidad:_ Longitud, Ángulo, Distancia real, Dirección, Completado
  - _Presión:_ Dist. presión, Bajo presión, Centro, Cambio de juego
  - _Tiempo:_ Minuto, Duración

- **Ejes dinámicos:** clic en cualquier chip activa/desactiva ese eje. El mínimo es 2 ejes; no hay límite máximo.

- **Brushing interactivo:** arrastrar sobre cualquier eje crea un filtro de rango. Los filtros se combinan: si se filtra en "Longitud > 20m" Y "Bajo presión = Sí", solo quedan los pases largos bajo presión.

- **Enlace cruzado:** el conjunto filtrado en paralelas afecta inmediatamente a la Red de Pases (T5), que resalta solo los pases que cumplen los filtros activos.

**Cómo usarlo:**

1. Definir los ejes relevantes para la pregunta táctica
2. Filtrar en "Dirección = Adelante" + "Dist. Presión < 5m" para ver los pases progresivos bajo alta presión
3. Observar si los pases filtrados son mayoritariamente completados o incompletos
4. El mismo subconjunto aparece resaltado en el mapa de pases para verificar desde qué zonas del campo se producen

---

## 2. Guía de Usuario

### Flujo de trabajo recomendado

```
1. SELECCIONAR PARTIDO
   Sidebar izquierdo → País → Competición → Temporada → Partido

2. EXPLORAR FORMACIONES
   Panel superior izquierdo muestra ambos equipos en sus mitades
   → Comparar formaciones, identificar jugadores clave

3. ANALIZAR JUGADOR
   Clic sobre cualquier jugador en el campo
   → Activa: Calor + Pases + Pentágono + Panel derecho

4. CONTEXTUALIZAR
   Ranking (panel superior derecho) → comparar con el resto
   Ajustar pesos T3 según el perfil buscado

5. PROFUNDIZAR
   Coordenadas paralelas → filtrar comportamientos específicos
   Filtro "Bajo presión" en Pases → ver origen de presión
   Slider de minutos → analizar por fases del partido
```

### Controles de interfaz

| Control                    | Ubicación                         | Función                               |
| -------------------------- | --------------------------------- | ------------------------------------- |
| Clic sobre jugador         | Campo formaciones / Lista sidebar | Selecciona jugador activo             |
| Arrastrar divisores grises | Entre paneles                     | Redimensiona paneles                  |
| Slider minutos             | Panel derecho                     | Filtra por rango temporal             |
| Chips de ejes              | Coordenadas paralelas             | Añade/elimina dimensiones             |
| Arrastrar sobre eje        | Coordenadas paralelas             | Crea filtro de rango (brush)          |
| Filtros de pases           | Red de pases                      | Filtra tipo de pase visible           |
| Sol/Luna (esquina)         | Barra superior                    | Alterna tema oscuro/claro             |
| Sliders de pesos           | Panel derecho                     | Ajusta importancia de categorías (T3) |
| Clic en encabezado         | Tabla de ranking                  | Ordena por esa columna                |

---

## 3. Pipeline de Ciencia de Datos

El pipeline transforma los datos crudos de StatsBomb (JSON) en métricas analíticas listos para visualización, siguiendo una arquitectura ETL → Warehouse → API.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE DE DATOS                            │
│                                                                 │
│  [StatsBomb API] ──► [Descarga JSON] ──► [Transformación ETL]  │
│                                                  │              │
│                               ┌──────────────────▼────────┐    │
│                               │   DuckDB + Parquet        │    │
│                               │   (Star Schema)           │    │
│                               │                           │    │
│                               │  Hechos:                  │    │
│                               │  · events_fact  (12.2M)   │    │
│                               │  · matches_fact  (3.4K)   │    │
│                               │                           │    │
│                               │  Dimensiones:             │    │
│                               │  · team_dim    (312)      │    │
│                               │  · stadium_dim  (278)     │    │
│                               │  · competition  (75)      │    │
│                               │  · season_dim   (48)      │    │
│                               └──────────────────┬────────┘    │
│                                                  │              │
│                               ┌──────────────────▼────────┐    │
│                               │   Cálculo de métricas    │    │
│                               │   (Evers et al. 2024)    │    │
│                               │                           │    │
│                               │  · pass_score             │    │
│                               │  · duel_score             │    │
│                               │  · shot_score             │    │
│                               │  · pressure_rating        │    │
│                               └──────────────────┬────────┘    │
│                                                  │              │
│                               ┌──────────────────▼────────┐    │
│                               │   FastAPI (puerto 8001)   │    │
│                               │   REST API endpoints      │    │
│                               └──────────────────┬────────┘    │
│                                                  │              │
│                               ┌──────────────────▼────────┐    │
│                               │   Next.js 16 Frontend     │    │
│                               │   (puerto 3002)           │    │
│                               └───────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Etapa 1: Ingesta de Datos (download_scripts/)

Los scripts de descarga consumen la API pública de StatsBomb Open Data:

```python
BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
```

**Orden de ejecución:**

1. `download_competitions.py` → `competitions.parquet` (75 competiciones)
2. `download_matches.py` → `matches_fact.parquet` + dimensiones (3,464 partidos)
3. `download_events.py` → `events_fact.parquet` (12.2M eventos)
4. `download_lineups.py` → `match_lineup_players.parquet` (131.9K registros)
5. `download_three_sixty.py` → datos de tracking 360° (1M + 15.6M eventos)

**Transformaciones clave en ETL:**

- Aplanamiento de JSONs anidados (StatsBomb usa diccionarios profundamente anidados)
- Normalización de coordenadas: el campo es 120×80 unidades (aproximación en metros)
- Extracción de campos específicos: `end_location`, `pass_outcome`, `under_pressure`, `shot_outcome`
- Enriquecimiento de eventos con `player_id` desde `match_lineup_players` (script `reprocess_events_with_player.py`)

### Etapa 2: Almacenamiento (DuckDB + Parquet)

El modelo de datos sigue un esquema estrella. Todos los datos residen en archivos Parquet en `data/processed/`. DuckDB crea vistas sobre estos archivos para cada consulta, sin necesidad de importar datos:

```sql
CREATE OR REPLACE VIEW events AS
SELECT * FROM read_parquet('data/processed/events/events_fact.parquet')
```

**Por qué Parquet + DuckDB en lugar de PostgreSQL:**

- Parquet permite compresión columnar (los 12.2M eventos ocupan ~2GB en Parquet vs ~8GB en CSV)
- DuckDB ejecuta SQL analítico en memoria sin servidor, ideal para análisis exploratorio
- Sin costo de infraestructura: la base de datos es un archivo en disco

### Etapa 3: Cálculo de Métricas (backend/main.py)

El backend recibe una petición por jugador/partido y ejecuta las siguientes consultas SQL sobre DuckDB:

```sql
-- Ejemplo: métricas de pase para un jugador en un partido
SELECT
    e.x, e.y, e.end_x, e.end_y,
    e.pass_outcome,
    e.pass_length,
    e.under_pressure
FROM events e
WHERE e.match_id = :mid
  AND e.player_id = :pid
  AND e.event_type_name = 'Pass'
```

Luego aplica las fórmulas de Evers et al. en Python/NumPy:

```python
completion_rate  = completed_passes / total_passes × 10
pressure_rating  = clip(1 - distance_to_presser / 30, 0, 1) × 10
direction_score  = forward_passes / total_passes × 10
length_score     = mean(pass_length) / 40 × 10
pass_score       = mean([completion_rate, pressure_rating, direction_score, length_score])
```

### Etapa 4: API REST (FastAPI)

El backend expone endpoints RESTful con CORS habilitado:

| Endpoint                               | Método | Propósito                                 |
| -------------------------------------- | ------ | ----------------------------------------- |
| `/api/countries`                       | GET    | Lista de países con coordenadas           |
| `/api/competitions`                    | GET    | Competiciones por país                    |
| `/api/matches`                         | GET    | Partidos por competición/temporada        |
| `/api/match/{id}/lineup`               | GET    | Alineaciones + posiciones SVG             |
| `/api/match/{id}/player/{pid}/heatmap` | GET    | Densidad posicional (celdas 5×5m)         |
| `/api/match/{id}/player/{pid}/passes`  | GET    | Pases enriquecidos con presión            |
| `/api/match/{id}/player/{pid}/ratings` | GET    | Scores T1/T2 (Evers et al.)               |
| `/api/match/{id}/players-ranking`      | GET    | Todos los jugadores del partido rankeados |
| `/api/match/{id}/shot-map`             | GET    | Mapa de tiros de ambos equipos            |

---

## 4. Pipeline de Visualización

El pipeline de visualización transforma los datos del backend en representaciones interactivas, directamente vinculadas a cada tarea de ciencia de datos (T1-T6).

```
┌────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE DE VISUALIZACIÓN                           │
│                                                                        │
│  Selección del usuario (Sidebar)                                       │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────┐    /api/match/{id}/lineup                             │
│  │ Formaciones │◄──────────────────────────── T5 (situacional)        │
│  │ (SVG Pitch) │    Ambos equipos en sus mitades del campo             │
│  │             │    Clic → activa jugador → dispara fetch paralelo     │
│  └──────┬──────┘                                                      │
│         │ selecciona jugador                                           │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐      │
│  │           FETCH PARALELO (Promise.all)                      │      │
│  │  /ratings  ─────────────────────────► Panel Derecho (T1/T2) │      │
│  │  /passes   ─────────────────────────► Red de Pases (T5)     │      │
│  │            ─────────────────────────► Paralelas (T6)        │      │
│  │  /heatmap  ─────────────────────────► Mapa de Calor (T5)    │      │
│  └─────────────────────────────────────────────────────────────┘      │
│                                                                        │
│  Interactividad cruzada:                                               │
│                                                                        │
│  Paralelas (brush) ──► filteredPassIds ──► Red de Pases (highlight)  │
│  Ranking (hover)   ──► hoveredPlayerId ──► Formaciones (highlight)    │
│  Pesos T3 (slider) ──► weighted_score  ──► Ranking + Panel (update)  │
│  Ejes pentágono    ──► polygon_shape   ──► Pentágono (redibuja)       │
│  Slider minutos    ──► minuteRange     ──► Re-fetch passes + heatmap  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Vista de Formaciones → T5

**Qué visualiza:** Las 11 posiciones de cada equipo sobre el campo de juego SVG (120×80 unidades).

**Transformación clave:** Las coordenadas normalizadas `px ∈ [0,1]` (donde 0 = portería propia, 1 = portería rival) del backend se escalan para que cada equipo ocupe su mitad:

```
homeX(px) = 5 + px × 49       → máximo x ≈ 54 (mitad izquierda)
awayX(px) = 115 − px × 49     → mínimo x ≈ 66 (mitad derecha)
```

**Vinculación con tareas:** T5 (visualización situacional de posiciones), interactúa con T4 (hover desde ranking resalta jugador en campo).

### 4.2 Mapa de Calor → T5

**Qué visualiza:** Densidad de eventos (pases, conducciones, duelos, tiros) del jugador en el campo. Cada celda de 5×5m acumula la cantidad de eventos, normalizada al máximo.

**Codificación visual:**

- Intensidad del color = frecuencia de presencia (escala logarítmica implícita por `intensity / max_intensity`)
- Color = verde (#00d68f) para local, naranja (#ff6b35) para visitante
- Círculo = centroide ponderado (media ponderada por intensidad)

**Filtro temporal:** El slider de minutos en el Panel Derecho re-lanza la petición `/heatmap?minute_from=X&minute_to=Y`, permitiendo comparar la primera con la segunda mitad.

### 4.3 Red de Pases → T5 + T6

**Qué visualiza:** Cada pase como una flecha desde el punto de origen (x, y) hasta el destino (end_x, end_y).

**Codificación semántica:**
| Color | Significado |
|-------|-------------|
| Verde sólido | Completado en progresión (forward=true) |
| Azul | Completado en retroceso |
| Amarillo | Bajo presión (completed) |
| Rojo punteado | Incompleto |

**Vinculación con T6:** Cuando el filtro de Coordenadas Paralelas está activo (`filteredPassIds.size > 0`), solo los pases en el conjunto filtrado se muestran con color completo; el resto se atenúa.

**Presión (capa adicional):** Con filtro "Bajo presión" activo, se dibuja:

- Punto rojo en `(pressure_source_x, pressure_source_y)` = posición del presionador
- Línea punteada roja desde el presionador al pasador = dirección de la presión

### 4.4 Ranking del Partido → T4

**Qué visualiza:** Tabla ordenable de todos los jugadores del partido con sus scores T1/T2.

**Actualizaciones reactivas:**

- Los pesos T3 se aplican client-side → el ordenamiento cambia sin nueva petición al servidor
- El hover sobre una fila → `setHoveredPlayerId(id)` → el campo de formaciones resalta ese jugador
- El clic selecciona al jugador y activa todas las vistas

### 4.5 Pentágono de Rendimiento → T1 + T2 (configurable)

**Qué visualiza:** Radar/pentágono con N ejes (mínimo 3, configurable desde 11 métricas disponibles). Cada eje representa un score 0-10 de Evers et al.

**Métricas disponibles para los ejes:**
| Eje | Fórmula | Interpretación táctica |
|-----|---------|----------------------|
| Score Pases | media(precisión, presión, dirección, longitud) | Calidad distribución |
| Precisión | completados/total × 10 | Fiabilidad bajo presión |
| Dirección | pases_adelante/total × 10 | Perfil ofensivo/defensivo |
| Longitud | media(pass_length)/40 × 10 | Variedad de registro |
| Presión Pases | f(distancia_presionador) × 10 | Resistencia a la presión |
| Score Duelos | media(tasa_ganados, zona, presión_duel) | Capacidad 1 vs 1 |
| Tasa Ganados | dribbles/duels × 10 | Efectividad en duelo |
| Zona Duelo | f(x, y) × 10 | Dónde gana duelos |
| Score Tiros | media(precisión_tiro, xG) | Peligrosidad |
| Precisión Tiro | a_puerta/total × 10 | Eficacia finalizadora |
| xG Proxy | (1 - dist/50) × 10 | Calidad de las ocasiones |

**Referencia gris punteada:** Hexágono interno al 50% = media teórica de 5.0/10 en todos los ejes.

### 4.6 Coordenadas Paralelas → T6

**Qué visualiza:** Cada pase como una polilínea que cruza N ejes verticales. La posición vertical en cada eje indica el valor de esa dimensión.

**Interacción de brush:**

1. Usuario arrastra sobre un eje → crea rectángulo de selección (brush)
2. El sistema filtra todas las polilíneas que NO pasan por el rango del brush
3. Las líneas activas (pasan por todos los brushes activos) se muestran con color semántico
4. Las líneas inactivas se atenúan al mínimo
5. El conjunto activo se emite al store como `filteredPassIds` → actualiza Red de Pases

**Rendimiento:** Las líneas se dibujan sobre un `<canvas>` (renderizado GPU) mientras que los ejes, etiquetas y brushes usan `<svg>` (interactivo). Esto permite renderizar miles de pases sin degradación.

---

## 5. Hipótesis de Investigación Soportadas

El dashboard también da soporte visual a las 4 hipótesis de investigación del proyecto:

| Hipótesis                               | Metric clave                   | Vista relevante                      |
| --------------------------------------- | ------------------------------ | ------------------------------------ |
| H1: ¿Más posesión = más goles?          | passes_pm, completion_rate     | Ranking + T2                         |
| H2: ¿Ventaja de campo local?            | overall_score por equipo       | Ranking filtrado                     |
| H3: ¿Línea defensiva alta = más riesgo? | heatmap CB (coordenada X alta) | Calor + Paralelas                    |
| H4: ¿Pases progresivos generan goles?   | direction_score + shot_score   | Pentágono + Paralelas (dir=Adelante) |

---

_Documentación generada para StatsBomb Scout Analytics v1.0 — Junio 2026_
