# Documentación de Tablas y Vistas — Proyecto StatsBomb

Base de datos: `statsbomb.duckdb`  
Motor: DuckDB  
Todas las entidades son **vistas** (`VIEW`) que leen archivos Parquet.  
Fecha de generación: 2026-05-24

---

## Índice

1. [competitions](#1-competitions)
2. [matches_fact](#2-matches_fact)
3. [events_fact](#3-events_fact)
4. [event_tactics_lineup](#4-event_tactics_lineup)
5. [match_lineup_players](#5-match_lineup_players)
6. [player_match_position_fact](#6-player_match_position_fact)
7. [manager_dim](#7-manager_dim)
8. [manager_team_match_bridge](#8-manager_team_match_bridge)
9. [season_dim](#9-season_dim)
10. [stadium_dim](#10-stadium_dim)
11. [team_dim](#11-team_dim)
12. [team_group_dim](#12-team_group_dim)
13. [three_sixty_events](#13-three_sixty_events)
14. [three_sixty_freeze_frame](#14-three_sixty_freeze_frame)
15. [Diagrama de relaciones](#15-diagrama-de-relaciones)

---

## 1. `competitions`

**Descripción:** Catálogo de competiciones y temporadas disponibles en el dataset. Cada fila representa una combinación única de competición y temporada.

**Fuente:** `data/processed/parquet/competitions.parquet`  
**Filas:** ~75

| Columna | Tipo | Descripción |
|---|---|---|
| `competition_id` | BIGINT | Identificador único de la competición |
| `season_id` | BIGINT | Identificador único de la temporada |
| `country_name` | VARCHAR | País o región al que pertenece la competición (ej. `Germany`, `Spain`, `International`) |
| `competition_name` | VARCHAR | Nombre de la competición (ej. `1. Bundesliga`, `La Liga`) |
| `competition_gender` | VARCHAR | Género de la competición: `male` o `female` |
| `competition_youth` | BOOLEAN | Indica si es una competición juvenil |
| `competition_international` | BOOLEAN | Indica si es una competición internacional |
| `season_name` | VARCHAR | Nombre de la temporada (ej. `2023/2024`, `2023`) |
| `match_updated` | TIMESTAMP | Última actualización de datos de partidos |
| `match_updated_360` | TIMESTAMP | Última actualización de datos 360° |
| `match_available_360` | TIMESTAMP | Fecha desde la que los datos 360° están disponibles |
| `match_available` | TIMESTAMP | Fecha desde la que los datos de partido están disponibles |

**Valores clave:**
- `competition_gender`: `male`, `female`
- `country_name`: Africa, Argentina, England, Europe, France, Germany, India, International, Italy, North and Central America, South America, Spain, United States of America

**Claves de unión:** `competition_id` → `matches_fact`, `team_group_dim`; `season_id` → `season_dim`, `matches_fact`

---

## 2. `matches_fact`

**Descripción:** Tabla de hechos principal de partidos. Cada fila representa un partido disputado con su resultado, equipos, estadio y contexto de competición.

**Fuente:** `data/processed/matches/matches_fact.parquet`  
**Filas:** ~3.464

| Columna | Tipo | Descripción |
|---|---|---|
| `match_id` | BIGINT | Identificador único del partido (clave primaria funcional) |
| `match_date` | TIMESTAMP | Fecha del partido |
| `kick_off` | TIME | Hora de inicio del partido |
| `match_datetime` | TIMESTAMP | Fecha y hora combinadas del partido |
| `competition_id` | BIGINT | FK → `competitions.competition_id` |
| `season_id` | BIGINT | FK → `season_dim.season_id` |
| `home_team_id` | BIGINT | FK → `team_dim.team_id` — equipo local |
| `away_team_id` | BIGINT | FK → `team_dim.team_id` — equipo visitante |
| `stadium_id` | DOUBLE | FK → `stadium_dim.id` |
| `home_score` | BIGINT | Goles del equipo local al final del partido |
| `away_score` | BIGINT | Goles del equipo visitante al final del partido |
| `match_week` | BIGINT | Jornada de la competición |
| `match_status` | VARCHAR | Estado de disponibilidad de datos: `available` |
| `match_status_360` | VARCHAR | Estado de datos 360°: `available`, `scheduled`, `processing`, `unscheduled` |
| `competition_stage_id` | BIGINT | Identificador de la fase de competición |
| `competition_stage_name` | VARCHAR | Nombre de la fase (ver valores posibles abajo) |

**Valores posibles `competition_stage_name`:**  
`Regular Season`, `Group Stage`, `1st Group Stage`, `Round of 16`, `Quarter-finals`, `Semi-finals`, `Final`, `3rd Place Final`, `Play-offs - Semi-Finals`, `Championship - Final`, `1st Round`, `Apertura`

**Claves de unión:** `match_id` → todas las tablas de hechos y puentes; `home_team_id` / `away_team_id` → `team_dim`; `stadium_id` → `stadium_dim`

---

## 3. `events_fact`

**Descripción:** Tabla de hechos de eventos. Registro granular de cada acción ocurrida en un partido (pases, disparos, duelos, portería, etc.). Es la tabla más grande del modelo.

**Fuente:** `data/processed/events/events_fact.parquet`  
**Filas:** ~12.185.465

| Columna | Tipo | Descripción |
|---|---|---|
| `event_id` | VARCHAR | Identificador UUID único del evento |
| `match_id` | BIGINT | FK → `matches_fact.match_id` |
| `index` | BIGINT | Número de secuencia del evento dentro del partido |
| `period` | BIGINT | Período del partido: 1=1ª parte, 2=2ª parte, 3-4=prórrogas, 5=penaltis |
| `timestamp` | VARCHAR | Tiempo del evento dentro del período (formato `HH:MM:SS.mmm`) |
| `minute` | BIGINT | Minuto del partido |
| `second` | BIGINT | Segundo dentro del minuto |
| `event_type_id` | BIGINT | Identificador numérico del tipo de evento |
| `event_type_name` | VARCHAR | Nombre del tipo de evento (ver tabla de tipos abajo) |
| `team_id` | BIGINT | FK → `team_dim.team_id` — equipo que ejecuta la acción |
| `team_name` | VARCHAR | Nombre del equipo (desnormalizado) |
| `possession` | BIGINT | Número de secuencia de la posesión dentro del partido |
| `possession_team_id` | BIGINT | FK → `team_dim.team_id` — equipo en posesión |
| `play_pattern_id` | BIGINT | Identificador del patrón de juego |
| `play_pattern_name` | VARCHAR | Nombre del patrón de juego (ver valores abajo) |
| `duration` | DOUBLE | Duración del evento en segundos |
| `under_pressure` | BOOLEAN | Indica si el evento ocurrió bajo presión del rival |
| `related_events` | VARCHAR | Lista JSON de UUIDs de eventos relacionados |
| `x` | DOUBLE | Coordenada X de inicio del evento en el campo (0–120) |
| `y` | DOUBLE | Coordenada Y de inicio del evento en el campo (0–80) |
| `end_x` | DOUBLE | Coordenada X de fin del evento (ej. destino del pase) |
| `end_y` | DOUBLE | Coordenada Y de fin del evento |

**Tipos de evento (`event_type_name`) con frecuencia:**

| Tipo de evento | Registros |
|---|---|
| Pass | 3.386.808 |
| Ball Receipt* | 3.166.415 |
| Carry | 2.631.852 |
| Pressure | 1.113.488 |
| Ball Recovery | 366.560 |
| Duel | 257.785 |
| Clearance | 158.962 |
| Block | 132.309 |
| Dribble | 122.013 |
| Goal Keeper | 106.546 |
| Foul Committed | 100.481 |
| Miscontrol | 99.349 |
| Foul Won | 95.569 |
| Dispossessed | 88.783 |
| Shot | 88.000 |
| Interception | 79.623 |
| Dribbled Past | 76.259 |
| Substitution | 21.508 |
| Half Start / Half End | 14.124 c/u |
| Injury Stoppage | 13.884 |
| 50/50 | 10.491 |
| Tactical Shift | 8.676 |
| Starting XI | 6.926 |
| Shield | 4.644 |
| Referee Ball-Drop | 4.249 |
| Player Off / Player On | ~3.300 c/u |
| Camera On / Off | ~2.600 / 693 |
| Bad Behaviour | 2.531 |
| Error | 1.703 |
| Offside | 1.235 |
| Own Goal For / Against | 337 c/u |

**Valores posibles `play_pattern_name`:**  
`Regular Play`, `From Free Kick`, `From Corner`, `From Goal Kick`, `From Throw In`, `From Keeper`, `From Kick Off`, `From Counter`, `Other`

**Nota sobre coordenadas:** El campo StatsBomb tiene dimensiones estándar de 120 × 80 unidades. La portería rival se ubica en x=120.

**Claves de unión:** `event_id` → `three_sixty_events.event_uuid`, `event_tactics_lineup.event_id`; `match_id` → `matches_fact`

---

## 4. `event_tactics_lineup`

**Descripción:** Alineación táctica registrada en eventos de tipo `Starting XI` y `Tactical Shift`. Detalla la formación y los jugadores con su posición asignada en un momento dado del partido.

**Fuente:** `data/processed/events/event_tactics_lineup.parquet`  
**Filas:** ~171.622

| Columna | Tipo | Descripción |
|---|---|---|
| `event_id` | VARCHAR | FK → `events_fact.event_id` — evento de alineación táctica |
| `match_id` | BIGINT | FK → `matches_fact.match_id` |
| `team_id` | BIGINT | FK → `team_dim.team_id` |
| `formation` | BIGINT | Formación táctica (ej. `433` = 4-3-3, `442` = 4-4-2) |
| `player_id` | BIGINT | Identificador del jugador |
| `player_name` | VARCHAR | Nombre del jugador |
| `position_id` | BIGINT | Identificador de la posición táctica |
| `position_name` | VARCHAR | Nombre de la posición (ej. `Goalkeeper`, `Right Back`, `Left Center Forward`) |
| `jersey_number` | BIGINT | Número de camiseta del jugador |

**Claves de unión:** `event_id` → `events_fact`; `match_id` → `matches_fact`; `team_id` → `team_dim`

---

## 5. `match_lineup_players`

**Descripción:** Lista de jugadores convocados o registrados en la alineación de cada partido. Incluye datos de nacionalidad y número de dorsal.

**Fuente:** `data/processed/lineups/match_lineup_players.parquet`  
**Filas:** ~131.901

| Columna | Tipo | Descripción |
|---|---|---|
| `match_id` | BIGINT | FK → `matches_fact.match_id` |
| `team_id` | BIGINT | FK → `team_dim.team_id` |
| `player_id` | BIGINT | Identificador único del jugador |
| `player_name` | VARCHAR | Nombre completo del jugador |
| `player_nickname` | VARCHAR | Apodo o nombre abreviado del jugador (puede ser NULL) |
| `jersey_number` | BIGINT | Número de camiseta en ese partido |
| `country_id` | DOUBLE | Identificador del país de nacionalidad del jugador |
| `country_name` | VARCHAR | País de nacionalidad del jugador |

**Claves de unión:** `match_id` → `matches_fact`; `team_id` → `team_dim`; `player_id` → `player_match_position_fact`

---

## 6. `player_match_position_fact`

**Descripción:** Tabla de hechos de posiciones de jugadores por partido. Registra cada intervalo de tiempo en que un jugador ocupó una posición específica, incluyendo sustituciones y cambios tácticos.

**Fuente:** `data/processed/lineups/player_match_position_fact.parquet`  
**Filas:** ~130.889

| Columna | Tipo | Descripción |
|---|---|---|
| `match_id` | BIGINT | FK → `matches_fact.match_id` |
| `team_id` | BIGINT | FK → `team_dim.team_id` |
| `player_id` | BIGINT | Identificador del jugador |
| `position_id` | BIGINT | Identificador de la posición táctica |
| `position` | VARCHAR | Nombre de la posición (ej. `Goalkeeper`, `Left Center Back`) |
| `from_time` | VARCHAR | Tiempo de inicio del intervalo en la posición (formato `MM:SS`) |
| `to_time` | VARCHAR | Tiempo de fin del intervalo (NULL si llegó hasta el final) |
| `from_period` | BIGINT | Período en que comenzó a jugar en esa posición |
| `to_period` | DOUBLE | Período en que terminó (NULL si llegó hasta el final) |
| `start_reason` | VARCHAR | Razón por la que el jugador entró en esa posición (ver valores abajo) |
| `end_reason` | VARCHAR | Razón por la que el jugador salió de esa posición (ver valores abajo) |

**Valores posibles `start_reason`:**  
`Starting XI`, `Substitution - On`, `Substitution - On (Tactical)`, `Substitution - On (Injury)`, `Substitution - On (Off Camera)`, `Tactical Shift`, `Player On`, `Player On (Off Camera)`

**Valores posibles `end_reason`:**  
`Final Whistle`, `Substitution - Off`, `Substitution - Off (Tactical)`, `Substitution - Off (Injury)`, `Substitution - Off (Off Camera)`, `Tactical Shift`, `Player Off`, `Player Off (Permanent)`, `Player Off (Off Camera)`, `Foul Committed (Red Card)`, `Foul Committed (Second Yellow)`, `Starting XI`, `Substitution - On`, `Substitution - On (Tactical)`, `Substitution - On (Injury)`, `Player On`

**Claves de unión:** `match_id` + `team_id` + `player_id` → `match_lineup_players`

---

## 7. `manager_dim`

**Descripción:** Dimensión de entrenadores. Contiene los datos biográficos de cada técnico registrado en el dataset.

**Fuente:** `data/processed/dimensions/manager_dim.parquet`  
**Filas:** ~557

| Columna | Tipo | Descripción |
|---|---|---|
| `manager_id` | BIGINT | Identificador único del entrenador |
| `manager_name` | VARCHAR | Nombre completo del entrenador |
| `dob` | VARCHAR | Fecha de nacimiento (formato `YYYY-MM-DD`) |
| `country_id` | BIGINT | Identificador del país de origen |
| `country_name` | VARCHAR | País de origen del entrenador |

**Claves de unión:** `manager_id` → `manager_team_match_bridge.manager_id`

---

## 8. `manager_team_match_bridge`

**Descripción:** Tabla puente que relaciona entrenadores con equipos y partidos. Permite saber qué técnico dirigió a qué equipo en cada partido, en calidad de local o visitante.

**Fuente:** `data/processed/dimensions/manager_team_match_bridge.parquet`  
**Filas:** ~6.774

| Columna | Tipo | Descripción |
|---|---|---|
| `match_id` | BIGINT | FK → `matches_fact.match_id` |
| `team_id` | BIGINT | FK → `team_dim.team_id` |
| `manager_id` | BIGINT | FK → `manager_dim.manager_id` |
| `role` | VARCHAR | Rol del equipo en el partido: `home` (local) o `away` (visitante) |

**Claves de unión:** `match_id` → `matches_fact`; `team_id` → `team_dim`; `manager_id` → `manager_dim`

---

## 9. `season_dim`

**Descripción:** Dimensión de temporadas. Catálogo simple que traduce el identificador numérico de temporada a su nombre textual.

**Fuente:** `data/processed/dimensions/season_dim.parquet`  
**Filas:** ~48

| Columna | Tipo | Descripción |
|---|---|---|
| `season_id` | BIGINT | Identificador único de la temporada |
| `season_name` | VARCHAR | Nombre de la temporada (ej. `2023/2024`, `2023`) |

**Claves de unión:** `season_id` → `competitions.season_id`, `matches_fact.season_id`

---

## 10. `stadium_dim`

**Descripción:** Dimensión de estadios. Contiene información de los recintos donde se disputaron los partidos.

**Fuente:** `data/processed/dimensions/stadium_dim.parquet`  
**Filas:** ~278

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | DOUBLE | Identificador único del estadio |
| `name` | VARCHAR | Nombre del estadio |
| `country_id` | DOUBLE | Identificador del país donde se ubica el estadio |
| `country_name` | VARCHAR | País donde se ubica el estadio |

**Claves de unión:** `id` → `matches_fact.stadium_id`

---

## 11. `team_dim`

**Descripción:** Dimensión de equipos. Catálogo de todos los equipos registrados en el dataset con su género y nacionalidad.

**Fuente:** `data/processed/dimensions/team_dim.parquet`  
**Filas:** ~312

| Columna | Tipo | Descripción |
|---|---|---|
| `team_id` | BIGINT | Identificador único del equipo |
| `team_name` | VARCHAR | Nombre del equipo |
| `gender` | VARCHAR | Género del equipo: `male` o `female` |
| `country_id` | BIGINT | Identificador del país de origen |
| `country_name` | VARCHAR | País de origen del equipo |

**Claves de unión:** `team_id` → `matches_fact` (home/away), `events_fact`, `event_tactics_lineup`, `match_lineup_players`, `player_match_position_fact`, `team_group_dim`, `manager_team_match_bridge`

---

## 12. `team_group_dim`

**Descripción:** Dimensión de grupos por competición y temporada. Indica el grupo (fase de grupos) al que pertenece cada equipo en cada edición de una competición. Para ligas regulares, el campo `group` suele ser `None`.

**Fuente:** `data/processed/dimensions/team_group_dim.parquet`  
**Filas:** ~954

| Columna | Tipo | Descripción |
|---|---|---|
| `competition_id` | BIGINT | FK → `competitions.competition_id` |
| `season_id` | BIGINT | FK → `season_dim.season_id` |
| `team_id` | BIGINT | FK → `team_dim.team_id` |
| `group` | VARCHAR | Nombre del grupo (ej. `Group A`). Valor `None` para ligas sin fase de grupos |

**Claves de unión:** `competition_id` + `season_id` → `competitions`; `team_id` → `team_dim`

---

## 13. `three_sixty_events`

**Descripción:** Datos de tracking 360° a nivel de evento. Almacena el área visible en cámara para cada evento con datos de posicionamiento tridimensional. Se vincula con `events_fact` mediante el UUID del evento.

**Fuente:** `data/processed/three_sixty/three_sixty_events.parquet`  
**Filas:** ~1.027.908

| Columna | Tipo | Descripción |
|---|---|---|
| `event_uuid` | VARCHAR | FK → `events_fact.event_id` — UUID del evento |
| `match_id` | BIGINT | FK → `matches_fact.match_id` |
| `visible_area` | VARCHAR | Polígono del área visible en cámara, almacenado como lista de coordenadas serializadas (ej. `[x1, y1, x2, y2, ...]`) |

**Nota:** No todos los partidos tienen datos 360°. El campo `match_status_360` en `matches_fact` indica la disponibilidad.

**Claves de unión:** `event_uuid` → `events_fact.event_id`; `match_id` → `matches_fact`

---

## 14. `three_sixty_freeze_frame`

**Descripción:** Posiciones individuales de jugadores capturadas en el fotograma congelado (freeze frame) de cada evento 360°. Cada fila representa un jugador visible en cámara en el instante del evento.

**Fuente:** `data/processed/three_sixty/three_sixty_freeze_frame.parquet`  
**Filas:** ~15.583.891

| Columna | Tipo | Descripción |
|---|---|---|
| `event_uuid` | VARCHAR | FK → `events_fact.event_id` y `three_sixty_events.event_uuid` |
| `match_id` | BIGINT | FK → `matches_fact.match_id` |
| `x` | DOUBLE | Coordenada X del jugador en el campo (sistema StatsBomb: 0–120) |
| `y` | DOUBLE | Coordenada Y del jugador en el campo (sistema StatsBomb: 0–80) |
| `teammate` | BOOLEAN | `TRUE` si el jugador pertenece al equipo que ejecuta la acción |
| `actor` | BOOLEAN | `TRUE` si este jugador es el ejecutor directo del evento |
| `keeper` | BOOLEAN | `TRUE` si el jugador es portero |

**Claves de unión:** `event_uuid` → `three_sixty_events.event_uuid`; `match_id` → `matches_fact`

---

## 15. Diagrama de relaciones

```
competitions (competition_id, season_id)
    │
    ├──────────────────────────────────────┐
    │                                      │
    ▼                                      ▼
matches_fact (match_id)            season_dim (season_id)
    │
    ├── home_team_id ──► team_dim (team_id)
    ├── away_team_id ──► team_dim (team_id)
    ├── stadium_id   ──► stadium_dim (id)
    ├── competition_id + season_id ──► team_group_dim
    │
    ├──► manager_team_match_bridge (match_id, team_id, manager_id)
    │         └── manager_id ──► manager_dim
    │
    ├──► match_lineup_players (match_id, team_id, player_id)
    │
    ├──► player_match_position_fact (match_id, team_id, player_id)
    │
    ├──► events_fact (match_id, event_id)
    │         ├── event_id ──► event_tactics_lineup
    │         ├── event_id ──► three_sixty_events (event_uuid)
    │         │                   └── event_uuid ──► three_sixty_freeze_frame
    │         └── team_id ──► team_dim
    │
    └──► three_sixty_events (match_id)
              └── event_uuid ──► three_sixty_freeze_frame
```

---

## Resumen de volumen de datos

| Tabla / Vista | Tipo | Filas aprox. |
|---|---|---|
| `competitions` | VIEW | 75 |
| `season_dim` | VIEW | 48 |
| `stadium_dim` | VIEW | 278 |
| `team_dim` | VIEW | 312 |
| `manager_dim` | VIEW | 557 |
| `team_group_dim` | VIEW | 954 |
| `matches_fact` | VIEW | 3.464 |
| `manager_team_match_bridge` | VIEW | 6.774 |
| `match_lineup_players` | VIEW | 131.901 |
| `player_match_position_fact` | VIEW | 130.889 |
| `event_tactics_lineup` | VIEW | 171.622 |
| `three_sixty_events` | VIEW | 1.027.908 |
| `events_fact` | VIEW | 12.185.465 |
| `three_sixty_freeze_frame` | VIEW | 15.583.891 |

---

## Notas generales

- **Sistema de coordenadas:** StatsBomb usa un campo de 120 × 80 unidades. El origen `(0, 0)` está en la esquina inferior izquierda desde la perspectiva del equipo local. La portería del equipo rival se ubica en `x = 120`.
- **Todas las entidades son VIEWs:** No hay tablas físicas en la base de datos. Los datos residen en archivos Parquet bajo `data/processed/`.
- **Datos 360°:** Solo disponibles para un subconjunto de partidos. Verificar `matches_fact.match_status_360 = 'available'` antes de unir con `three_sixty_events` o `three_sixty_freeze_frame`.
- **Claves surrogadas:** Los campos `*_id` son claves numéricas asignadas por StatsBomb. No son secuenciales ni autoincrement.
- **Desnormalización parcial:** Algunos campos como `team_name` en `events_fact` o `player_name` en `event_tactics_lineup` están desnormalizados para facilitar consultas sin necesidad de JOIN adicionales.
