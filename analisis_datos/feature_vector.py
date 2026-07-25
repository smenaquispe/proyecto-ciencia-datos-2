"""
Vector de características para scouting de jugadores — StatsBomb.

Una fila por jugador masculino con >= min_minutes minutos jugados.
Todas las métricas de eventos se normalizan por 90 minutos.
"""

import duckdb
import pandas as pd
from pathlib import Path

DATA_DIR = Path("data/processed")


def _register_views(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(f"""
        CREATE VIEW IF NOT EXISTS events_fact AS
            SELECT * FROM read_parquet('{DATA_DIR}/events/events_fact.parquet');
        CREATE VIEW IF NOT EXISTS team_dim AS
            SELECT * FROM read_parquet('{DATA_DIR}/dimensions/team_dim.parquet');
        CREATE VIEW IF NOT EXISTS matches_fact AS
            SELECT * FROM read_parquet('{DATA_DIR}/matches/matches_fact.parquet');
        CREATE VIEW IF NOT EXISTS player_match_position AS
            SELECT * FROM read_parquet('{DATA_DIR}/lineups/player_match_position_fact.parquet');
    """)


def justify_gender_exclusion() -> pd.DataFrame:
    """
    Compara métricas clave entre fútbol masculino y femenino.
    Sirve de justificación cuantitativa para excluir competiciones femeninas
    del vector de características, ya que los dos contextos producen
    distribuciones incomparables en las variables clave.
    """
    con = duckdb.connect()
    _register_views(con)

    query = """
    SELECT
        td.gender,
        COUNT(DISTINCT e.player_id)                                              AS n_jugadores,
        ROUND(AVG(CASE WHEN e.event_type_name = 'Pass'
                       THEN e.pass_length END), 2)                               AS avg_longitud_pase_m,
        ROUND(STDDEV(CASE WHEN e.event_type_name = 'Pass'
                          THEN e.pass_length END), 2)                            AS std_longitud_pase,
        ROUND(AVG(CASE WHEN e.event_type_name = 'Carry'
                       THEN SQRT(POWER(COALESCE(e.end_x, e.x) - e.x, 2)
                                + POWER(COALESCE(e.end_y, e.y) - e.y, 2))
                  END), 2)                                                       AS avg_distancia_conduccion_m,
        ROUND(COUNT(CASE WHEN e.event_type_name = 'Shot' THEN 1 END) * 1.0
              / NULLIF(COUNT(DISTINCT e.player_id), 0), 2)                       AS remates_por_jugador
    FROM events_fact e
    JOIN team_dim td ON e.team_id = td.team_id
    WHERE e.player_id IS NOT NULL
      AND td.gender IN ('male', 'female')
    GROUP BY td.gender
    ORDER BY td.gender
    """

    df = con.execute(query).df()
    con.close()
    return df


def build_feature_vector(min_minutes: int = 270) -> pd.DataFrame:
    """
    Genera el vector de características final.

    Filtros aplicados:
      - Solo partidos de equipos masculinos (team_dim.gender = 'male').
      - Jugadores con total_minutes >= min_minutes (default 270 = 3 partidos).

    Columnas del resultado:
      player_id, player_name, dominant_position, total_minutes, matches_played,
      y ~22 métricas por 90 min / ratios.
    """
    con = duckdb.connect()
    _register_views(con)

    query = f"""
    WITH

    -- 1. Partidos masculinos
    male_matches AS (
        SELECT DISTINCT mf.match_id
        FROM matches_fact mf
        JOIN team_dim td ON mf.home_team_id = td.team_id
        WHERE td.gender = 'male'
    ),

    -- 2. Minutos jugados por jugador-partido
    player_minutes_raw AS (
        SELECT
            p.player_id,
            p.match_id,
            CASE
                WHEN p.to_time IS NULL THEN
                    CASE p.to_period
                        WHEN 1 THEN 45.0
                        WHEN 2 THEN 90.0
                        WHEN 3 THEN 105.0
                        WHEN 4 THEN 120.0
                        ELSE 90.0
                    END
                ELSE (
                    CAST(SPLIT_PART(p.to_time,   ':', 1) AS DOUBLE)
                  + CAST(SPLIT_PART(p.to_time,   ':', 2) AS DOUBLE) / 60.0
                ) - (
                    CAST(SPLIT_PART(p.from_time, ':', 1) AS DOUBLE)
                  + CAST(SPLIT_PART(p.from_time, ':', 2) AS DOUBLE) / 60.0
                )
            END AS minutes
        FROM player_match_position p
        JOIN male_matches mm ON p.match_id = mm.match_id
        WHERE p.player_id IS NOT NULL
    ),

    player_totals AS (
        SELECT
            player_id,
            ROUND(SUM(minutes), 1)      AS total_minutes,
            COUNT(DISTINCT match_id)    AS matches_played
        FROM player_minutes_raw
        WHERE minutes > 0
        GROUP BY player_id
        HAVING total_minutes >= {min_minutes}
    ),

    -- 3. Posición dominante (moda)
    pos_count AS (
        SELECT
            p.player_id,
            p.position,
            COUNT(*) AS n,
            ROW_NUMBER() OVER (PARTITION BY p.player_id ORDER BY COUNT(*) DESC) AS rn
        FROM player_match_position p
        JOIN male_matches mm ON p.match_id = mm.match_id
        WHERE p.player_id IS NOT NULL AND p.position IS NOT NULL
        GROUP BY p.player_id, p.position
    ),
    dominant_position AS (
        SELECT player_id, position AS dominant_position
        FROM pos_count WHERE rn = 1
    ),

    -- 4. Agregaciones de eventos por jugador
    event_agg AS (
        SELECT
            e.player_id,
            MAX(e.player_name) AS player_name,

            -- Remates
            COUNT(CASE WHEN e.event_type_name = 'Shot'                                   THEN 1 END) AS shots,
            COUNT(CASE WHEN e.event_type_name = 'Shot'
                        AND e.shot_outcome IN ('Goal','Saved')                           THEN 1 END) AS shots_on_target,
            COUNT(CASE WHEN e.event_type_name = 'Shot'
                        AND e.shot_outcome = 'Goal'                                      THEN 1 END) AS goals,

            -- Regates (dribbles)
            COUNT(CASE WHEN e.event_type_name = 'Dribble'                                THEN 1 END) AS dribbles,
            COUNT(CASE WHEN e.event_type_name = 'Dribble'
                        AND e.pass_outcome = 'Complete'                                  THEN 1 END) AS dribbles_completed,

            -- Conducciones (carries)
            COUNT(CASE WHEN e.event_type_name = 'Carry'                                  THEN 1 END) AS carries,
            SUM  (CASE WHEN e.event_type_name = 'Carry'
                       THEN SQRT(POWER(COALESCE(e.end_x, e.x) - e.x, 2)
                                + POWER(COALESCE(e.end_y, e.y) - e.y, 2))
                       ELSE 0 END)                                                                   AS carry_distance,
            COUNT(CASE WHEN e.event_type_name = 'Carry' AND e.end_x >= 80               THEN 1 END) AS carries_final_third,

            -- Pases
            COUNT(CASE WHEN e.event_type_name = 'Pass'                                   THEN 1 END) AS passes,
            COUNT(CASE WHEN e.event_type_name = 'Pass'
                        AND (e.pass_outcome IS NULL OR e.pass_outcome = 'Complete')      THEN 1 END) AS passes_completed,
            COUNT(CASE WHEN e.event_type_name = 'Pass'
                        AND e.end_x > (e.x + 10)                                        THEN 1 END) AS progressive_passes,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.pass_cross = TRUE           THEN 1 END) AS crosses,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.pass_through_ball = TRUE    THEN 1 END) AS through_balls,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.pass_switch = TRUE          THEN 1 END) AS pass_switches,
            AVG  (CASE WHEN e.event_type_name = 'Pass' THEN e.pass_length END)                       AS pass_length_avg,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.under_pressure = TRUE       THEN 1 END) AS passes_under_pressure,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.under_pressure = TRUE
                        AND (e.pass_outcome IS NULL OR e.pass_outcome = 'Complete')      THEN 1 END) AS passes_completed_under_pressure,

            -- Defensa
            COUNT(CASE WHEN e.event_type_name = 'Pressure'                               THEN 1 END) AS pressures,
            COUNT(CASE WHEN e.event_type_name = 'Ball Recovery'                          THEN 1 END) AS ball_recoveries,
            COUNT(CASE WHEN e.event_type_name = 'Block'                                  THEN 1 END) AS blocks,
            COUNT(CASE WHEN e.event_type_name = 'Clearance'                              THEN 1 END) AS clearances,
            COUNT(CASE WHEN e.event_type_name = 'Duel'                                   THEN 1 END) AS duels,
            COUNT(CASE WHEN e.event_type_name = 'Duel'
                        AND e.pass_outcome IN ('Won','Success')                          THEN 1 END) AS duels_won,

            -- Acciones bajo presión (todas)
            COUNT(CASE WHEN e.under_pressure = TRUE                                      THEN 1 END) AS events_under_pressure,
            COUNT(*)                                                                                  AS total_events

        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.player_id IS NOT NULL
        GROUP BY e.player_id
    )

    -- 5. Normalizar por 90 y calcular ratios
    SELECT
        ea.player_id,
        ea.player_name,
        dp.dominant_position,
        pt.total_minutes,
        pt.matches_played,

        -- Métricas ofensivas (por 90)
        ROUND(ea.shots              * 90.0 / pt.total_minutes, 3) AS shots_per90,
        ROUND(ea.shots_on_target    * 90.0 / pt.total_minutes, 3) AS shots_on_target_per90,
        ROUND(ea.goals              * 90.0 / pt.total_minutes, 3) AS goals_per90,
        ROUND(ea.dribbles           * 90.0 / pt.total_minutes, 3) AS dribbles_per90,
        ROUND(CASE WHEN ea.dribbles > 0
              THEN ea.dribbles_completed * 1.0 / ea.dribbles END, 3) AS dribble_success_rate,

        -- Conducción
        ROUND(ea.carries            * 90.0 / pt.total_minutes, 3) AS carries_per90,
        ROUND(ea.carry_distance     * 90.0 / pt.total_minutes, 3) AS carry_distance_per90,
        ROUND(ea.carries_final_third* 90.0 / pt.total_minutes, 3) AS carries_final_third_per90,

        -- Pase
        ROUND(ea.passes             * 90.0 / pt.total_minutes, 3) AS passes_per90,
        ROUND(CASE WHEN ea.passes > 0
              THEN ea.passes_completed * 1.0 / ea.passes END, 3)  AS pass_completion_rate,
        ROUND(ea.progressive_passes * 90.0 / pt.total_minutes, 3) AS progressive_passes_per90,
        ROUND(ea.crosses            * 90.0 / pt.total_minutes, 3) AS crosses_per90,
        ROUND(ea.through_balls      * 90.0 / pt.total_minutes, 3) AS through_balls_per90,
        ROUND(ea.pass_switches      * 90.0 / pt.total_minutes, 3) AS pass_switches_per90,
        ROUND(ea.pass_length_avg, 2)                               AS pass_length_avg,
        ROUND(CASE WHEN ea.passes_under_pressure > 0
              THEN ea.passes_completed_under_pressure * 1.0
                 / ea.passes_under_pressure END, 3)                AS pass_acc_under_pressure,

        -- Defensa
        ROUND(ea.pressures          * 90.0 / pt.total_minutes, 3) AS pressures_per90,
        ROUND(ea.ball_recoveries    * 90.0 / pt.total_minutes, 3) AS ball_recoveries_per90,
        ROUND(ea.blocks             * 90.0 / pt.total_minutes, 3) AS blocks_per90,
        ROUND(ea.clearances         * 90.0 / pt.total_minutes, 3) AS clearances_per90,
        ROUND(ea.duels              * 90.0 / pt.total_minutes, 3) AS duels_per90,
        ROUND(CASE WHEN ea.duels > 0
              THEN ea.duels_won * 1.0 / ea.duels END, 3)          AS duel_win_rate,

        -- Ratio de presión recibida
        ROUND(CASE WHEN ea.total_events > 0
              THEN ea.events_under_pressure * 1.0 / ea.total_events END, 3) AS under_pressure_rate

    FROM event_agg ea
    JOIN player_totals pt          ON ea.player_id = pt.player_id
    LEFT JOIN dominant_position dp ON ea.player_id = dp.player_id
    ORDER BY pt.total_minutes DESC
    """

    df = con.execute(query).df()
    con.close()
    return df


def build_match_feature_vector(min_minutes: int = 30) -> pd.DataFrame:
    """
    Vector de características por jugador-partido (granularidad partido).

    Cada fila = un jugador en un partido específico.
    Columnas clave (metadatos, no entran a PCA): player_id, player_name, match_id.
    Útil para: análisis de rendimiento por partido, evolución temporal,
    comparación de actuaciones individuales en el dashboard.

    min_minutes: minutos mínimos jugados en ese partido para incluir la fila
    (evita filas de jugadores que entraron solo 2-3 minutos).
    """
    con = duckdb.connect()
    _register_views(con)

    query = f"""
    WITH
    male_matches AS (
        SELECT DISTINCT mf.match_id
        FROM matches_fact mf
        JOIN team_dim td ON mf.home_team_id = td.team_id
        WHERE td.gender = 'male'
    ),

    -- Minutos por jugador por partido
    match_minutes AS (
        SELECT
            p.player_id,
            p.match_id,
            SUM(CASE
                WHEN p.to_time IS NULL THEN
                    CASE p.to_period
                        WHEN 1 THEN 45.0 WHEN 2 THEN 90.0
                        WHEN 3 THEN 105.0 WHEN 4 THEN 120.0
                        ELSE 90.0
                    END
                ELSE (
                    CAST(SPLIT_PART(p.to_time,   ':', 1) AS DOUBLE)
                  + CAST(SPLIT_PART(p.to_time,   ':', 2) AS DOUBLE) / 60.0
                ) - (
                    CAST(SPLIT_PART(p.from_time, ':', 1) AS DOUBLE)
                  + CAST(SPLIT_PART(p.from_time, ':', 2) AS DOUBLE) / 60.0
                )
            END) AS minutes_played,
            -- Posición principal en ese partido
            MODE() WITHIN GROUP (ORDER BY p.position) AS match_position
        FROM player_match_position p
        JOIN male_matches mm ON p.match_id = mm.match_id
        WHERE p.player_id IS NOT NULL
        GROUP BY p.player_id, p.match_id
        HAVING minutes_played >= {min_minutes}
    ),

    event_agg AS (
        SELECT
            e.player_id,
            e.match_id,
            MAX(e.player_name) AS player_name,

            COUNT(CASE WHEN e.event_type_name = 'Shot'                                   THEN 1 END) AS shots,
            COUNT(CASE WHEN e.event_type_name = 'Shot' AND e.shot_outcome IN ('Goal','Saved') THEN 1 END) AS shots_on_target,
            COUNT(CASE WHEN e.event_type_name = 'Shot' AND e.shot_outcome = 'Goal'        THEN 1 END) AS goals,
            COUNT(CASE WHEN e.event_type_name = 'Dribble'                                THEN 1 END) AS dribbles,
            COUNT(CASE WHEN e.event_type_name = 'Dribble' AND e.pass_outcome = 'Complete' THEN 1 END) AS dribbles_completed,
            COUNT(CASE WHEN e.event_type_name = 'Carry'                                  THEN 1 END) AS carries,
            SUM  (CASE WHEN e.event_type_name = 'Carry'
                       THEN SQRT(POWER(COALESCE(e.end_x, e.x) - e.x, 2)
                                + POWER(COALESCE(e.end_y, e.y) - e.y, 2))
                       ELSE 0 END)                                                                   AS carry_distance,
            COUNT(CASE WHEN e.event_type_name = 'Carry' AND e.end_x >= 80               THEN 1 END) AS carries_final_third,
            COUNT(CASE WHEN e.event_type_name = 'Pass'                                   THEN 1 END) AS passes,
            COUNT(CASE WHEN e.event_type_name = 'Pass'
                        AND (e.pass_outcome IS NULL OR e.pass_outcome = 'Complete')      THEN 1 END) AS passes_completed,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.end_x > (e.x + 10)         THEN 1 END) AS progressive_passes,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.pass_cross = TRUE           THEN 1 END) AS crosses,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.pass_through_ball = TRUE    THEN 1 END) AS through_balls,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.pass_switch = TRUE          THEN 1 END) AS pass_switches,
            AVG  (CASE WHEN e.event_type_name = 'Pass' THEN e.pass_length END)                       AS pass_length_avg,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.under_pressure = TRUE       THEN 1 END) AS passes_under_pressure,
            COUNT(CASE WHEN e.event_type_name = 'Pass' AND e.under_pressure = TRUE
                        AND (e.pass_outcome IS NULL OR e.pass_outcome = 'Complete')      THEN 1 END) AS passes_completed_under_pressure,
            COUNT(CASE WHEN e.event_type_name = 'Pressure'                               THEN 1 END) AS pressures,
            COUNT(CASE WHEN e.event_type_name = 'Ball Recovery'                          THEN 1 END) AS ball_recoveries,
            COUNT(CASE WHEN e.event_type_name = 'Block'                                  THEN 1 END) AS blocks,
            COUNT(CASE WHEN e.event_type_name = 'Clearance'                              THEN 1 END) AS clearances,
            COUNT(CASE WHEN e.event_type_name = 'Duel'                                   THEN 1 END) AS duels,
            COUNT(CASE WHEN e.event_type_name = 'Duel' AND e.pass_outcome IN ('Won','Success') THEN 1 END) AS duels_won,
            COUNT(CASE WHEN e.under_pressure = TRUE                                      THEN 1 END) AS events_under_pressure,
            COUNT(*)                                                                                  AS total_events
        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.player_id IS NOT NULL
        GROUP BY e.player_id, e.match_id
    )

    SELECT
        -- Metadatos (no entran a PCA)
        ea.player_id,
        ea.player_name,
        ea.match_id,
        mm.match_position,
        mm.minutes_played,

        -- Mismas 22 métricas normalizadas por 90
        ROUND(ea.shots              * 90.0 / mm.minutes_played, 3) AS shots_per90,
        ROUND(ea.shots_on_target    * 90.0 / mm.minutes_played, 3) AS shots_on_target_per90,
        ROUND(ea.goals              * 90.0 / mm.minutes_played, 3) AS goals_per90,
        ROUND(ea.dribbles           * 90.0 / mm.minutes_played, 3) AS dribbles_per90,
        ROUND(CASE WHEN ea.dribbles > 0
              THEN ea.dribbles_completed * 1.0 / ea.dribbles END, 3) AS dribble_success_rate,
        ROUND(ea.carries            * 90.0 / mm.minutes_played, 3) AS carries_per90,
        ROUND(ea.carry_distance     * 90.0 / mm.minutes_played, 3) AS carry_distance_per90,
        ROUND(ea.carries_final_third* 90.0 / mm.minutes_played, 3) AS carries_final_third_per90,
        ROUND(ea.passes             * 90.0 / mm.minutes_played, 3) AS passes_per90,
        ROUND(CASE WHEN ea.passes > 0
              THEN ea.passes_completed * 1.0 / ea.passes END, 3)   AS pass_completion_rate,
        ROUND(ea.progressive_passes * 90.0 / mm.minutes_played, 3) AS progressive_passes_per90,
        ROUND(ea.crosses            * 90.0 / mm.minutes_played, 3) AS crosses_per90,
        ROUND(ea.through_balls      * 90.0 / mm.minutes_played, 3) AS through_balls_per90,
        ROUND(ea.pass_switches      * 90.0 / mm.minutes_played, 3) AS pass_switches_per90,
        ROUND(ea.pass_length_avg, 2)                                AS pass_length_avg,
        ROUND(CASE WHEN ea.passes_under_pressure > 0
              THEN ea.passes_completed_under_pressure * 1.0
                 / ea.passes_under_pressure END, 3)                 AS pass_acc_under_pressure,
        ROUND(ea.pressures          * 90.0 / mm.minutes_played, 3) AS pressures_per90,
        ROUND(ea.ball_recoveries    * 90.0 / mm.minutes_played, 3) AS ball_recoveries_per90,
        ROUND(ea.blocks             * 90.0 / mm.minutes_played, 3) AS blocks_per90,
        ROUND(ea.clearances         * 90.0 / mm.minutes_played, 3) AS clearances_per90,
        ROUND(ea.duels              * 90.0 / mm.minutes_played, 3) AS duels_per90,
        ROUND(CASE WHEN ea.duels > 0
              THEN ea.duels_won * 1.0 / ea.duels END, 3)           AS duel_win_rate,
        ROUND(CASE WHEN ea.total_events > 0
              THEN ea.events_under_pressure * 1.0 / ea.total_events END, 3) AS under_pressure_rate

    FROM event_agg ea
    JOIN match_minutes mm ON ea.player_id = mm.player_id AND ea.match_id = mm.match_id
    ORDER BY ea.player_id, ea.match_id
    """

    df = con.execute(query).df()
    con.close()
    return df


if __name__ == "__main__":
    print("=== Justificación exclusión fútbol femenino ===")
    gender_df = justify_gender_exclusion()
    print(gender_df.to_string(index=False))

    print("\n=== Vector por jugador (>= 270 min acumulados) ===")
    fv = build_feature_vector(min_minutes=270)
    print(f"Jugadores incluidos : {len(fv):,}")
    print(f"Features            : {len(fv.columns) - 5}")
    out_player = Path("analisis_datos/player_feature_vector.parquet")
    fv.to_parquet(out_player, index=False)
    print(f"Guardado en: {out_player}")

    print("\n=== Vector por jugador-partido (>= 30 min en el partido) ===")
    fv_match = build_match_feature_vector(min_minutes=30)
    print(f"Filas (jugador-partido) : {len(fv_match):,}")
    out_match = Path("analisis_datos/player_match_feature_vector.parquet")
    fv_match.to_parquet(out_match, index=False)
    print(f"Guardado en: {out_match}")
