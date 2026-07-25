"""
StatsBomb Dashboard 2 — FastAPI Backend
Endpoints para: países, competiciones, temporadas, partidos,
alineaciones, heatmap de jugador, pases por minuto.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

import duckdb
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR      = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"

app = FastAPI(title="StatsBomb Dashboard 2 API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── helpers ─────────────────────────────────────────────────────────────────

def _clean(records: list[dict]) -> list[dict]:
    """Replace float NaN / numpy NaN with None so JSON serialization never fails."""
    out = []
    for row in records:
        out.append({
            k: (None if isinstance(v, float) and np.isnan(v) else v)
            for k, v in row.items()
        })
    return out


def df_to_records(df: pd.DataFrame) -> list[dict]:
    """Convert a DataFrame to JSON-safe records (NaN → None)."""
    return _clean(df.to_dict(orient="records"))


def get_conn() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect()
    conn.execute("SET memory_limit='4GB'")
    conn.execute("SET threads TO 4")
    views = {
        "competitions":   PROCESSED_DIR / "parquet/competitions.parquet",
        "matches":        PROCESSED_DIR / "matches/matches_fact.parquet",
        "events":         PROCESSED_DIR / "events/events_fact.parquet",
        "lineups":        PROCESSED_DIR / "lineups/match_lineup_players.parquet",
        "positions":      PROCESSED_DIR / "lineups/player_match_position_fact.parquet",
        "tactics":        PROCESSED_DIR / "events/event_tactics_lineup.parquet",
        "team_dim":       PROCESSED_DIR / "dimensions/team_dim.parquet",
        "stadium_dim":    PROCESSED_DIR / "dimensions/stadium_dim.parquet",
    }
    for name, path in views.items():
        if path.exists():
            conn.execute(
                f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM read_parquet('{path.as_posix()}')"
            )
    return conn


# ─── PAÍSES ──────────────────────────────────────────────────────────────────

@app.get("/api/countries")
def get_countries():
    """
    Lista de países con al menos un partido disponible.
    Incluye latitude/longitude aproximadas para pintarlas en el mapa.
    """
    COUNTRY_COORDS: dict[str, tuple[float, float]] = {
        "Africa":                       (2.0, 21.0),
        "Argentina":                    (-38.4, -63.6),
        "England":                      (52.3, -1.8),
        "Europe":                       (54.5, 15.3),
        "France":                       (46.2, 2.2),
        "Germany":                      (51.2, 10.4),
        "India":                        (20.6, 78.9),
        "International":                (0.0, 0.0),
        "Italy":                        (41.9, 12.6),
        "North and Central America":    (23.6, -102.5),
        "South America":                (-8.8, -55.5),
        "Spain":                        (40.5, -3.7),
        "United States of America":     (37.1, -95.7),
    }

    conn = get_conn()
    rows = conn.execute("""
        SELECT c.country_name,
               COUNT(DISTINCT m.match_id) AS matches,
               COUNT(DISTINCT c.competition_id) AS competitions
        FROM competitions c
        JOIN matches m ON c.competition_id = m.competition_id AND c.season_id = m.season_id
        GROUP BY c.country_name
        ORDER BY c.country_name
    """).fetchall()
    conn.close()

    result = []
    for country_name, matches, comps in rows:
        lat, lng = COUNTRY_COORDS.get(country_name, (0.0, 0.0))
        result.append({
            "country_name": country_name,
            "matches": matches,
            "competitions": comps,
            "lat": lat,
            "lng": lng,
        })
    return {"countries": result}


# ─── COMPETICIONES POR PAÍS ───────────────────────────────────────────────────

@app.get("/api/competitions")
def get_competitions(country_name: Optional[str] = None):
    conn = get_conn()
    where = "WHERE c.country_name = $country" if country_name else ""
    params = {"country": country_name} if country_name else {}
    rows = conn.execute(f"""
        SELECT DISTINCT
            c.competition_id,
            c.competition_name,
            c.country_name,
            c.season_id,
            c.season_name,
            c.competition_gender
        FROM competitions c
        {where}
        ORDER BY c.competition_name, c.season_name DESC
    """, params).fetchdf()
    conn.close()
    return {"competitions": df_to_records(rows)}


# ─── PARTIDOS POR COMPETICIÓN + TEMPORADA ────────────────────────────────────

@app.get("/api/matches")
def get_matches(
    competition_id: Optional[int] = None,
    season_id:      Optional[int] = None,
    country_name:   Optional[str] = None,
):
    conn = get_conn()
    clauses = []
    params: dict = {}

    if competition_id:
        clauses.append("m.competition_id = $competition_id")
        params["competition_id"] = competition_id
    if season_id:
        clauses.append("m.season_id = $season_id")
        params["season_id"] = season_id
    if country_name:
        clauses.append("c.country_name = $country_name")
        params["country_name"] = country_name

    where = "WHERE " + " AND ".join(clauses) if clauses else ""

    df = conn.execute(f"""
        SELECT
            m.match_id,
            m.match_date,
            m.kick_off,
            m.competition_id,
            m.season_id,
            m.home_team_id,
            m.away_team_id,
            m.home_score,
            m.away_score,
            m.match_week,
            m.match_status_360,
            m.competition_stage_name,
            c.competition_name,
            c.country_name,
            c.season_name,
            ht.team_name AS home_team_name,
            awt.team_name AS away_team_name,
            s.name AS stadium_name
        FROM matches m
        LEFT JOIN competitions c
            ON m.competition_id = c.competition_id AND m.season_id = c.season_id
        LEFT JOIN team_dim ht  ON m.home_team_id = ht.team_id
        LEFT JOIN team_dim awt ON m.away_team_id = awt.team_id
        LEFT JOIN stadium_dim s ON m.stadium_id = s.id
        {where}
        ORDER BY m.match_date DESC
        LIMIT 500
    """, params).fetchdf()
    conn.close()

    df["match_date"] = df["match_date"].astype(str)
    df["kick_off"]   = df["kick_off"].astype(str)
    return {"matches": df_to_records(df)}


# ─── ALINEACIÓN INICIAL (Starting XI) ────────────────────────────────────────

POSITION_COORDS: dict[str, tuple[float, float]] = {
    # x ∈ [0,120] (izquierda=defensa propia, derecha=ataque), y ∈ [0,80]
    # Retornamos coordenadas normalizadas [0,1] para el frontend
    "Goalkeeper":               (0.07, 0.50),
    "Right Back":               (0.20, 0.80),
    "Right Center Back":        (0.20, 0.63),
    "Center Back":              (0.20, 0.50),
    "Left Center Back":         (0.20, 0.37),
    "Left Back":                (0.20, 0.20),
    "Right Wing Back":          (0.35, 0.83),
    "Left Wing Back":           (0.35, 0.17),
    "Right Defensive Midfield": (0.38, 0.68),
    "Center Defensive Midfield":(0.38, 0.50),
    "Left Defensive Midfield":  (0.38, 0.32),
    "Right Midfield":           (0.50, 0.75),
    "Right Center Midfield":    (0.50, 0.65),
    "Center Midfield":          (0.50, 0.50),
    "Left Center Midfield":     (0.50, 0.35),
    "Left Midfield":            (0.50, 0.25),
    "Right Wing":               (0.68, 0.85),
    "Right Attacking Midfield": (0.65, 0.67),
    "Center Attacking Midfield":(0.65, 0.50),
    "Left Attacking Midfield":  (0.65, 0.33),
    "Left Wing":                (0.68, 0.15),
    "Right Center Forward":     (0.80, 0.65),
    "Center Forward":           (0.80, 0.50),
    "Left Center Forward":      (0.80, 0.35),
    "Secondary Striker":        (0.72, 0.50),
}


@app.get("/api/match/{match_id}/lineup")
def get_match_lineup(match_id: int):
    """
    Retorna las alineaciones iniciales (Starting XI) de ambos equipos
    con coordenadas de posición para pintarlas en el campo.
    """
    conn = get_conn()

    # Obtener eventos Starting XI y sus tácticas (solo primer evento por equipo)
    df = conn.execute("""
        WITH ranked_events AS (
            SELECT
                e.event_id,
                e.team_id,
                e.index,
                ROW_NUMBER() OVER (PARTITION BY e.team_id ORDER BY e.index) AS rn
            FROM events e
            WHERE e.match_id = $mid AND e.event_type_name = 'Starting XI'
        )
        SELECT
            t.team_id,
            t.formation,
            t.player_id,
            t.player_name,
            t.position_id,
            t.position_name,
            t.jersey_number,
            td.team_name
        FROM tactics t
        JOIN team_dim td ON t.team_id = td.team_id
        JOIN ranked_events re ON t.event_id = re.event_id AND re.rn = 1
        WHERE t.match_id = $mid
        ORDER BY t.team_id, t.position_id
    """, {"mid": match_id}).fetchdf()

    # Info del partido
    match_info = conn.execute("""
        SELECT m.match_id, m.home_team_id, m.away_team_id,
               m.home_score, m.away_score, m.match_date,
               ht.team_name AS home_team_name,
               awt.team_name AS away_team_name,
               c.competition_name, c.season_name
        FROM matches m
        LEFT JOIN team_dim ht  ON m.home_team_id = ht.team_id
        LEFT JOIN team_dim awt ON m.away_team_id = awt.team_id
        LEFT JOIN competitions c
            ON m.competition_id = c.competition_id AND m.season_id = c.season_id
        WHERE m.match_id = $mid
        LIMIT 1
    """, {"mid": match_id}).fetchdf()
    conn.close()

    if df.empty:
        return {"lineup": [], "match": {}}

    teams = {}
    for _, row in df.iterrows():
        tid = int(row["team_id"])
        if tid not in teams:
            teams[tid] = {
                "team_id":   tid,
                "team_name": row["team_name"],
                "formation": int(row["formation"]) if pd.notna(row["formation"]) else None,
                "players":   [],
            }
        pos = row["position_name"]
        px, py = POSITION_COORDS.get(pos, (0.5, 0.5))
        teams[tid]["players"].append({
            "player_id":     int(row["player_id"]),
            "player_name":   row["player_name"],
            "jersey_number": int(row["jersey_number"]) if pd.notna(row["jersey_number"]) else 0,
            "position_id":   int(row["position_id"]),
            "position_name": pos,
            "px": px,
            "py": py,
        })

    match_dict = {}
    if not match_info.empty:
        r = match_info.iloc[0]
        match_dict = {
            "match_id":        int(r["match_id"]),
            "home_team_id":    int(r["home_team_id"]),
            "away_team_id":    int(r["away_team_id"]),
            "home_team_name":  r["home_team_name"],
            "away_team_name":  r["away_team_name"],
            "home_score":      int(r["home_score"]),
            "away_score":      int(r["away_score"]),
            "match_date":      str(r["match_date"])[:10],
            "competition_name": r["competition_name"],
            "season_name":     r["season_name"],
        }

    return {
        "match": match_dict,
        "teams": list(teams.values()),
    }


# ─── HEATMAP DE JUGADOR ───────────────────────────────────────────────────────

@app.get("/api/match/{match_id}/player/{player_id}/heatmap")
def get_player_heatmap(
    match_id:    int,
    player_id:   int,
    minute_from: int = 0,
    minute_to:   int = 999,
    cell_size:   int = 5,
):
    """
    Heatmap de posiciones de un jugador en un partido usando player_id real.
    Incluye TODOS los tipos de eventos con coordenadas (pass, carry, pressure, etc.)
    """
    import math

    conn = get_conn()
    df = conn.execute("""
        SELECT e.x, e.y, e.minute, e.second, e.event_type_name
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id = $pid
          AND e.x IS NOT NULL AND e.y IS NOT NULL
          AND e.minute BETWEEN $mfrom AND $mto
        ORDER BY e.minute, e.second
    """, {"mid": match_id, "pid": player_id, "mfrom": minute_from, "mto": minute_to}).fetchdf()

    conn.close()

    if df.empty:
        return {"cells": [], "max_count": 0, "total_events": 0, "cell_size": cell_size}

    cols_n = math.ceil(120 / cell_size)
    rows_n = math.ceil(80  / cell_size)
    df["cx"] = (df["x"] // cell_size).astype(int).clip(0, cols_n - 1)
    df["cy"] = (df["y"] // cell_size).astype(int).clip(0, rows_n - 1)

    grid = df.groupby(["cx", "cy"]).size().reset_index(name="count")
    max_count = int(grid["count"].max()) if not grid.empty else 1

    cells = [
        {
            "cx": int(r.cx), "cy": int(r.cy),
            "x0": float(r.cx * cell_size), "y0": float(r.cy * cell_size),
            "count": int(r.count),
            "intensity": round(r.count / max_count, 4),
        }
        for r in grid.itertuples()
    ]

    return {
        "cells":        cells,
        "max_count":    max_count,
        "total_events": len(df),
        "cell_size":    cell_size,
    }


# ─── PASES DE UN JUGADOR ─────────────────────────────────────────────────────

def _classify_pass(dx: float, dy: float) -> str:
    adx, ady = abs(dx), abs(dy)
    if adx < 3 and ady < 3:          return "short"
    if adx > 10 and adx >= ady*1.2:  return "forward_vertical" if dx > 0 else "back_vertical"
    if ady > 8 and ady > adx:        return "lateral"
    if adx >= ady:                   return "diagonal_forward" if dx > 0 else "diagonal_back"
    return "lateral_short"


@app.get("/api/match/{match_id}/player/{player_id}/passes")
def get_player_passes(
    match_id:    int,
    player_id:   int,
    minute_from: int = 0,
    minute_to:   int = 999,
):
    """
    Pases del jugador con todos los campos enriquecidos:
    length, angle, height, body_part, outcome, recipient, pressure info.
    """
    conn = get_conn()
    df = conn.execute("""
        SELECT
            e.event_id,
            e.index      AS event_index,
            e.possession,
            e.minute,
            e.second,
            e.x, e.y,
            e.end_x, e.end_y,
            e.under_pressure,
            e.counterpress,
            e.duration,
            e.play_pattern_name,
            e.team_id,
            e.team_name,
            e.player_name,
            e.position_name,
            e.pass_length,
            e.pass_angle,
            e.pass_height,
            e.pass_body_part,
            e.pass_outcome,
            e.pass_switch,
            e.pass_cross,
            e.pass_through_ball,
            e.pass_recipient_id,
            e.pass_recipient_name
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id = $pid
          AND e.event_type_name = 'Pass'
          AND e.x IS NOT NULL
          AND e.end_x IS NOT NULL
          AND e.minute BETWEEN $mfrom AND $mto
        ORDER BY e.minute, e.second
    """, {"mid": match_id, "pid": player_id, "mfrom": minute_from, "mto": minute_to}).fetchdf()

    if df.empty:
        conn.close()
        return {"passes": [], "total": 0}

    # Pressure events from opposing team — to find pressure sources
    team_id_val = int(df["team_id"].iloc[0]) if not df.empty else None
    pressure_df = pd.DataFrame()
    if team_id_val:
        pressure_df = conn.execute("""
            SELECT
                e.index      AS event_index,
                e.possession,
                e.minute,
                e.second,
                e.x          AS press_x,
                e.y          AS press_y,
                e.player_name AS presser_name,
                e.player_id   AS presser_id
            FROM events e
            WHERE e.match_id = $mid
              AND e.event_type_name = 'Pressure'
              AND e.team_id != $tid
            ORDER BY e.minute, e.second
        """, {"mid": match_id, "tid": team_id_val}).fetchdf()
    conn.close()

    # Derived columns
    df["dx"]       = df["end_x"] - df["x"]
    df["dy"]       = df["end_y"] - df["y"]
    df["distance"] = np.sqrt(df["dx"]**2 + df["dy"]**2).round(2)
    df["forward"]  = df["dx"] > 0
    df["pass_type"] = df.apply(lambda r: _classify_pass(r["dx"], r["dy"]), axis=1)
    df["completed"] = df["pass_outcome"].isna()   # None = Complete in StatsBomb

    # Find closest pressure source for each pass
    press_x_list, press_y_list, presser_list, press_dist_list = [], [], [], []

    if not pressure_df.empty:
        # Index pressure by possession for fast lookup
        press_by_poss: dict[int, pd.DataFrame] = {}
        for poss_val, grp in pressure_df.groupby("possession"):
            press_by_poss[int(poss_val)] = grp

        for _, row in df.iterrows():
            poss = int(row["possession"])
            px, py = row["x"], row["y"]
            pidx   = row["event_index"]

            candidates = press_by_poss.get(poss, pd.DataFrame())
            if candidates.empty:
                press_x_list.append(None); press_y_list.append(None)
                presser_list.append(None); press_dist_list.append(None)
                continue

            # Closest by index distance (same possession)
            candidates = candidates.copy()
            candidates["idx_dist"] = (candidates["event_index"] - pidx).abs()
            best = candidates.loc[candidates["idx_dist"].idxmin()]

            bx, by = float(best["press_x"]), float(best["press_y"])
            d = round(float(np.sqrt((px - bx)**2 + (py - by)**2)), 1)

            press_x_list.append(bx)
            press_y_list.append(by)
            presser_list.append(str(best["presser_name"]))
            press_dist_list.append(d)
    else:
        n = len(df)
        press_x_list = [None]*n; press_y_list = [None]*n
        presser_list = [None]*n; press_dist_list = [None]*n

    df["pressure_source_x"]    = press_x_list
    df["pressure_source_y"]    = press_y_list
    df["presser_name"]         = presser_list
    df["pressure_distance"]    = press_dist_list

    # Clean up: replace NaN/NaT with None so JSON serialization never sees float('nan')
    # df.where keeps NaN in float columns — use object conversion instead
    records = df.to_dict(orient="records")
    cleaned = [
        {
            k: (None if (isinstance(v, float) and np.isnan(v)) else v)
            for k, v in row.items()
        }
        for row in records
    ]

    return {"passes": cleaned, "total": len(df)}


# ─── EVENTOS POR MINUTO (para el slider) ─────────────────────────────────────

@app.get("/api/match/{match_id}/events-summary")
def get_match_events_summary(match_id: int):
    """
    Resumen de eventos por minuto para dibujar el timeline scrubber.
    Retorna: max_minute, períodos, número de eventos por minuto.
    """
    conn = get_conn()
    df = conn.execute("""
        SELECT
            minute,
            period,
            COUNT(*) AS event_count,
            SUM(CASE WHEN event_type_name = 'Shot' THEN 1 ELSE 0 END)  AS shots,
            SUM(CASE WHEN event_type_name = 'Goal Keeper' THEN 1 ELSE 0 END) AS gk_actions,
            SUM(CASE WHEN event_type_name = 'Pass' THEN 1 ELSE 0 END)  AS passes
        FROM events
        WHERE match_id = $mid
        GROUP BY minute, period
        ORDER BY minute
    """, {"mid": match_id}).fetchdf()

    # Jugadores del partido
    players = conn.execute("""
        SELECT l.player_id, l.player_name, l.team_id, t.team_name, l.jersey_number
        FROM lineups l
        JOIN team_dim t ON l.team_id = t.team_id
        WHERE l.match_id = $mid
        ORDER BY l.team_id, l.jersey_number
    """, {"mid": match_id}).fetchdf()

    conn.close()

    max_minute = int(df["minute"].max()) if not df.empty else 90

    return {
        "max_minute":       max_minute,
        "events_by_minute": df_to_records(df),
        "players":          df_to_records(players),
    }


# ─── POSICIONES EN UN RANGO DE MINUTOS (360 aproximado) ──────────────────────

@app.get("/api/match/{match_id}/positions")
def get_match_positions(
    match_id:    int,
    minute_from: int = Query(default=0,  ge=0),
    minute_to:   int = Query(default=5,  ge=0),
):
    """
    Eventos con coordenadas para ambos equipos en un rango de minutos.
    Usado para animar la posición de jugadores en el campo en el slider.
    """
    conn = get_conn()
    df = conn.execute("""
        SELECT
            e.event_id,
            e.team_id,
            e.team_name,
            e.minute,
            e.second,
            e.x,
            e.y,
            e.event_type_name,
            e.play_pattern_name
        FROM events e
        WHERE e.match_id = $mid
          AND e.x IS NOT NULL AND e.y IS NOT NULL
          AND e.minute BETWEEN $mfrom AND $mto
        ORDER BY e.minute, e.second, e.team_id
        LIMIT 5000
    """, {"mid": match_id, "mfrom": minute_from, "mto": minute_to}).fetchdf()
    conn.close()

    return {"events": df_to_records(df)}


# ─── GRAPH DATA para selector de grafo ───────────────────────────────────────

@app.get("/api/graph/country")
def get_graph_country(country_name: str):
    """
    Retorna el árbol completo para el grafo interactivo:
    competiciones → temporadas → equipos (con número de partidos).
    """
    conn = get_conn()
    rows = conn.execute("""
        SELECT
            c.competition_id,
            c.competition_name,
            c.season_id,
            c.season_name,
            c.competition_gender,
            COUNT(DISTINCT m.match_id) AS matches
        FROM competitions c
        JOIN matches m ON c.competition_id = m.competition_id AND c.season_id = m.season_id
        WHERE c.country_name = $country
        GROUP BY 1,2,3,4,5
        ORDER BY c.competition_name, c.season_name DESC
    """, {"country": country_name}).fetchdf()
    conn.close()

    # Group: competition → seasons
    comps: dict = {}
    for _, r in rows.iterrows():
        cid = int(r.competition_id)
        if cid not in comps:
            comps[cid] = {
                "id": f"comp-{cid}",
                "competition_id": cid,
                "label": r.competition_name,
                "gender": r.competition_gender,
                "seasons": [],
            }
        comps[cid]["seasons"].append({
            "id": f"season-{cid}-{int(r.season_id)}",
            "season_id": int(r.season_id),
            "label": r.season_name,
            "matches": int(r.matches),
        })

    return {"competitions": list(comps.values())}


@app.get("/api/graph/teams")
def get_graph_teams(competition_id: int, season_id: int):
    """
    Retorna equipos que jugaron en esa competición/temporada con conteo de partidos.
    """
    conn = get_conn()
    rows = conn.execute("""
        SELECT td.team_id, td.team_name,
               COUNT(DISTINCT m.match_id) AS matches
        FROM matches m
        JOIN team_dim td ON td.team_id = m.home_team_id OR td.team_id = m.away_team_id
        WHERE m.competition_id = $cid AND m.season_id = $sid
          AND (m.home_team_id = td.team_id OR m.away_team_id = td.team_id)
        GROUP BY td.team_id, td.team_name
        ORDER BY td.team_name
    """, {"cid": competition_id, "sid": season_id}).fetchdf()
    conn.close()

    return {
        "teams": [
            {"team_id": int(r.team_id), "label": r.team_name, "matches": int(r.matches)}
            for _, r in rows.iterrows()
        ]
    }


@app.get("/api/graph/opponents")
def get_graph_opponents(competition_id: int, season_id: int, team_id: int):
    """
    Retorna los partidos de un equipo en esa competición/temporada,
    mostrando rivales y resultado.
    """
    conn = get_conn()
    rows = conn.execute("""
        SELECT
            m.match_id,
            m.match_date,
            m.home_team_id,
            m.away_team_id,
            ht.team_name AS home_name,
            awt.team_name AS away_name,
            m.home_score,
            m.away_score,
            m.match_status_360,
            m.competition_stage_name
        FROM matches m
        JOIN team_dim ht  ON m.home_team_id = ht.team_id
        JOIN team_dim awt ON m.away_team_id = awt.team_id
        WHERE m.competition_id = $cid
          AND m.season_id = $sid
          AND (m.home_team_id = $tid OR m.away_team_id = $tid)
        ORDER BY m.match_date
    """, {"cid": competition_id, "sid": season_id, "tid": team_id}).fetchdf()
    conn.close()

    result = []
    for _, r in rows.iterrows():
        is_home = int(r.home_team_id) == team_id
        opp_id   = int(r.away_team_id) if is_home else int(r.home_team_id)
        opp_name = r.away_name if is_home else r.home_name
        my_score = int(r.home_score) if is_home else int(r.away_score)
        op_score = int(r.away_score) if is_home else int(r.home_score)
        result_str = "W" if my_score > op_score else ("D" if my_score == op_score else "L")
        result.append({
            "match_id":   int(r.match_id),
            "match_date": str(r.match_date)[:10],
            "opponent_id":   opp_id,
            "opponent_name": opp_name,
            "is_home":    is_home,
            "my_score":   my_score,
            "opp_score":  op_score,
            "result":     result_str,
            "has_360":    r.match_status_360 == "available",
            "stage":      r.competition_stage_name,
        })

    return {"matches": result}


# ─── RATINGS DE JUGADOR (basado en Evers et al. 2024) ────────────────────────
#
# Implementamos los scores del paper "Visual analytics of soccer player
# performance using objective ratings" (Information Visualization, 2024).
#
# Scores de PASES (solo pases completados):
#   - pressure_rating    : presión que enfrentó el pasador (0-10)
#   - completion_rate    : % pases completados → normalizado 0-10
#   - direction_score    : equilibrio ofensivo vs. defensivo (0-10)
#   - length_score       : longitud media normalizada al campo (0-10)
#   - pressure_change    : cuánto mejoró la situación del receptor (0-10)
#   - pass_score         : media ponderada de los anteriores
#
# Scores de DUELOS (ganados vs. perdidos):
#   - duel_win_rate      : % duelos ganados → 0-10
#   - duel_pressure      : presión media en duelos → 0-10
#   - duel_score         : media de los anteriores
#
# Scores de TIROS:
#   - shot_accuracy      : proporción en puerta → 0-10
#   - shot_xg            : promedio xG del evento statsbomb → 0-10
#   - shot_score         : media de los anteriores
#
# overall_score = (wp*pass + wd*duel + ws*shot) / (wp+wd+ws)

def _clamp(v: float, lo: float = 0.0, hi: float = 10.0) -> float:
    """Clamp a value to [lo, hi] and round to 2dp."""
    return round(float(np.clip(v, lo, hi)), 2)


def _pressure_rating(pressure_dist: "pd.Series") -> float:
    """
    Convierte distancias de presión a rating 0-10.
    Distancias cortas = presión alta = rating alto (más difícil).
    """
    if pressure_dist.empty:
        return 0.0
    p_vals = pressure_dist.dropna()
    if p_vals.empty:
        return 0.0
    # Normalizar: distancia 0 → presión 10, distancia 30+ → presión 0
    pressures = np.clip(1.0 - p_vals / 30.0, 0, 1) * 10
    return _clamp(float(pressures.mean()))


def _rescale_0_10(series: "pd.Series") -> "pd.Series":
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series([5.0] * len(series), index=series.index)
    return (series - mn) / (mx - mn) * 10


@app.get("/api/match/{match_id}/player/{player_id}/ratings")
def get_player_ratings(match_id: int, player_id: int):
    """
    Scores objetivos del jugador basados en Evers et al. (2024).
    Retorna ratings de pases, duelos y tiros con breakdown detallado.
    """
    conn = get_conn()

    # ── Pases ────────────────────────────────────────────────────────────────
    passes_df = conn.execute("""
        SELECT
            e.x, e.y, e.end_x, e.end_y,
            e.pass_outcome,
            e.pass_length,
            e.pass_angle,
            e.under_pressure,
            e.duration,
            e.pass_switch,
            e.pass_cross,
            e.pass_through_ball
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id = $pid
          AND e.event_type_name = 'Pass'
          AND e.x IS NOT NULL
    """, {"mid": match_id, "pid": player_id}).fetchdf()

    # ── Duelos ────────────────────────────────────────────────────────────────
    # duel_outcome no existe en el parquet; usamos Dribble como proxy de duelo ganado
    duels_df = conn.execute("""
        SELECT e.x, e.y, e.under_pressure
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id = $pid
          AND e.event_type_name = 'Duel'
          AND e.x IS NOT NULL
    """, {"mid": match_id, "pid": player_id}).fetchdf()

    dribbles_won_df = conn.execute("""
        SELECT e.x, e.y
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id = $pid
          AND e.event_type_name = 'Dribble'
          AND e.x IS NOT NULL
    """, {"mid": match_id, "pid": player_id}).fetchdf()

    # ── Tiros ────────────────────────────────────────────────────────────────
    # shot_statsbomb_xg no existe; usamos distancia al gol como proxy
    shots_df = conn.execute("""
        SELECT
            e.x, e.y,
            e.shot_outcome,
            e.under_pressure,
            SQRT(POWER(120 - e.x, 2) + POWER(40 - e.y, 2)) AS dist_to_goal
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id = $pid
          AND e.event_type_name = 'Shot'
          AND e.x IS NOT NULL
    """, {"mid": match_id, "pid": player_id}).fetchdf()

    # ── Presiones recibidas (equipo contrario) ────────────────────────────────
    pressure_df = conn.execute("""
        SELECT e.x AS press_x, e.y AS press_y
        FROM events e
        WHERE e.match_id = $mid
          AND e.event_type_name = 'Pressure'
          AND e.player_id != $pid
          AND e.x IS NOT NULL
    """, {"mid": match_id, "pid": player_id}).fetchdf()

    conn.close()

    # ── Calcular scores de PASES ──────────────────────────────────────────────
    pass_scores: dict = {}
    if passes_df.empty:
        pass_scores = {
            "total": 0, "completed": 0, "completion_rate": 0,
            "pressure_rating": 0, "direction_score": 0,
            "length_score": 0, "special_passes": 0, "pass_score": 0,
        }
    else:
        total_passes     = len(passes_df)
        completed_passes = int(passes_df["pass_outcome"].isna().sum())
        completion_rate  = _clamp(completed_passes / total_passes * 10) if total_passes else 0

        # Presión: cercanía de rivales al pasador
        pres_rating = 0.0
        if not pressure_df.empty and total_passes > 0:
            dists = []
            for _, row in passes_df.iterrows():
                dx_p = pressure_df["press_x"] - row["x"]
                dy_p = pressure_df["press_y"] - row["y"]
                d    = np.sqrt(dx_p**2 + dy_p**2).min()
                dists.append(float(d))
            pres_rating = _pressure_rating(pd.Series(dists))

        # Dirección: % pases hacia adelante (campo rival)
        passes_df["dx"] = passes_df["end_x"] - passes_df["x"]
        fwd_ratio   = float((passes_df["dx"] > 0).mean())
        direction_score = _clamp(fwd_ratio * 10)

        # Longitud media normalizada (campo = 120 yd)
        lengths = passes_df["pass_length"].dropna()
        avg_len = float(lengths.mean()) if not lengths.empty else 0
        length_score = _clamp(avg_len / 40.0 * 10)

        # Pases especiales — normalizado vs total de pases
        special_count = int(
            passes_df["pass_switch"].fillna(False).astype(bool).sum() +
            passes_df["pass_cross"].fillna(False).astype(bool).sum() +
            passes_df["pass_through_ball"].fillna(False).astype(bool).sum()
        )
        special = special_count

        pass_score = _clamp(
            (completion_rate + pres_rating + direction_score + length_score) / 4
        )

        pass_scores = {
            "total":            total_passes,
            "completed":        completed_passes,
            "completion_rate":  completion_rate,
            "pressure_rating":  pres_rating,
            "direction_score":  direction_score,
            "length_score":     length_score,
            "special_passes":   special,
            "pass_score":       pass_score,
        }

    # ── Calcular scores de DUELOS ─────────────────────────────────────────────
    duel_scores: dict = {}
    if duels_df.empty:
        duel_scores = {
            "total": 0, "won": 0, "win_rate": 0,
            "pressure_rating": 0, "area_score": 0, "duel_score": 0,
        }
    else:
        total_duels = len(duels_df)
        # Proxy duelos ganados = número de Dribbles exitosos del mismo jugador
        won_duels = len(dribbles_won_df)
        win_rate  = _clamp(won_duels / max(total_duels, 1) * 10)

        area_vals = (
            ((duels_df["x"] - 60).abs() / 60) *
            (1 - (duels_df["y"] - 40).abs() / 40)
        )
        area_score = _clamp(float(area_vals.mean()) * 10)

        # Presión en duelos
        pres_d = 0.0
        if not pressure_df.empty:
            dists = []
            for _, row in duels_df.iterrows():
                dx_p = pressure_df["press_x"] - row["x"]
                dy_p = pressure_df["press_y"] - row["y"]
                d    = np.sqrt(dx_p**2 + dy_p**2).min()
                dists.append(float(d))
            pres_d = _pressure_rating(pd.Series(dists))

        duel_score = _clamp((win_rate + pres_d + area_score) / 3)

        duel_scores = {
            "total":            total_duels,
            "won":              won_duels,
            "win_rate":         win_rate,
            "pressure_rating":  pres_d,
            "area_score":       area_score,
            "duel_score":       duel_score,
        }

    # ── Calcular scores de TIROS ──────────────────────────────────────────────
    shot_scores: dict = {}
    if shots_df.empty:
        shot_scores = {
            "total": 0, "on_target": 0, "goals": 0,
            "shot_accuracy": 0, "xg_score": 0, "shot_score": 0,
        }
    else:
        total_shots  = len(shots_df)
        on_target    = int(shots_df["shot_outcome"].isin({"Goal", "Saved", "Saved To Post"}).sum())
        goals        = int((shots_df["shot_outcome"] == "Goal").sum())
        shot_accuracy = _clamp(on_target / total_shots * 10) if total_shots else 0

        avg_dist = float(shots_df["dist_to_goal"].dropna().mean()) if not shots_df["dist_to_goal"].dropna().empty else 50
        xg_score  = _clamp(max(0.0, (1 - avg_dist / 50)) * 10)

        shot_score = _clamp((shot_accuracy + xg_score) / 2)

        shot_scores = {
            "total":          total_shots,
            "on_target":      on_target,
            "goals":          goals,
            "shot_accuracy":  shot_accuracy,
            "xg_score":       xg_score,
            "shot_score":     shot_score,
        }

    # ── Overall score (pesos iguales por defecto) ─────────────────────────────
    wp = wd = ws = 1.0
    overall = round(
        (wp * pass_scores["pass_score"] + wd * duel_scores["duel_score"] + ws * shot_scores["shot_score"])
        / (wp + wd + ws), 2
    )

    return {
        "passes":  pass_scores,
        "duels":   duel_scores,
        "shots":   shot_scores,
        "overall": overall,
    }


@app.get("/api/match/{match_id}/players-ranking")
def get_players_ranking(match_id: int):
    """
    Ranking de todos los jugadores del partido con sus scores.
    Usado para la vista comparativa (Fig. 4 del paper).
    """
    conn = get_conn()

    # Todos los jugadores que tuvieron eventos en el partido
    players_df = conn.execute("""
        SELECT DISTINCT
            e.player_id,
            e.player_name,
            e.team_id,
            e.team_name
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id IS NOT NULL
          AND e.player_name IS NOT NULL
        ORDER BY e.team_id, e.player_name
    """, {"mid": match_id}).fetchdf()

    if players_df.empty:
        conn.close()
        return {"players": []}

    # Scores agregados por jugador en una sola consulta
    # NOTA: duel_outcome y shot_statsbomb_xg no existen en el parquet.
    # Proxy duelos ganados: Dribble (exitoso) vs Dispossessed/DribbledPast.
    # Proxy xG: distancia al gol (x cercano a 120 = más peligroso).
    scores_df = conn.execute("""
        SELECT
            e.player_id,
            e.team_id,
            -- Pases
            SUM(CASE WHEN e.event_type_name='Pass' THEN 1 ELSE 0 END)          AS total_passes,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_outcome IS NULL
                     THEN 1 ELSE 0 END)                                         AS completed_passes,
            AVG(CASE WHEN e.event_type_name='Pass' THEN e.pass_length END)      AS avg_pass_length,
            -- Duelos: total=Duel events, ganados=Dribble (proxy exitoso)
            SUM(CASE WHEN e.event_type_name='Duel' THEN 1 ELSE 0 END)          AS total_duels,
            SUM(CASE WHEN e.event_type_name='Dribble' THEN 1 ELSE 0 END)       AS won_duels,
            -- Tiros
            SUM(CASE WHEN e.event_type_name='Shot' THEN 1 ELSE 0 END)          AS total_shots,
            SUM(CASE WHEN e.event_type_name='Shot'
                      AND e.shot_outcome IN ('Goal','Saved','Saved To Post')
                     THEN 1 ELSE 0 END)                                         AS on_target_shots,
            -- xG proxy: avg distancia al gol para tiros (120=línea de gol, 40=eje Y centro)
            AVG(CASE WHEN e.event_type_name='Shot'
                     THEN SQRT(POWER(120 - e.x, 2) + POWER(40 - e.y, 2))
                     END)                                                        AS avg_shot_dist
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id IS NOT NULL
        GROUP BY e.player_id, e.team_id
    """, {"mid": match_id}).fetchdf()

    conn.close()

    # Merge
    merged = players_df.merge(scores_df, on=["player_id", "team_id"], how="left").fillna(0)

    result = []
    for _, r in merged.iterrows():
        tp  = int(r["total_passes"])
        cp  = int(r["completed_passes"])
        al  = float(r["avg_pass_length"]) if r["avg_pass_length"] else 0
        td  = int(r["total_duels"])
        wd_ = int(r["won_duels"])
        ts  = int(r["total_shots"])
        ot  = int(r["on_target_shots"])
        # xG proxy: distancia corta al gol = mayor peligro (max ~50 yd → score 10)
        avg_dist = float(r["avg_shot_dist"]) if r["avg_shot_dist"] else 50
        xg_proxy = round(max(0.0, (1 - avg_dist / 50)) * 10, 2)

        pass_score  = round((cp / tp * 10 if tp else 0) * 0.6 + min(al/40,1)*10*0.4, 2)
        duel_score  = round(wd_ / max(td, 1) * 10, 2)
        shot_score  = round((ot / ts * 10 if ts else 0) * 0.6 + xg_proxy * 0.4, 2)
        overall     = round((pass_score + duel_score + shot_score) / 3, 2)

        result.append({
            "player_id":    int(r["player_id"]),
            "player_name":  r["player_name"],
            "team_id":      int(r["team_id"]),
            "team_name":    r["team_name"],
            "total_passes": tp,
            "completed_passes": cp,
            "total_duels":  td,
            "won_duels":    wd_,
            "total_shots":  ts,
            "on_target":    ot,
            "pass_score":   pass_score,
            "duel_score":   duel_score,
            "shot_score":   shot_score,
            "overall_score": overall,
        })

    # Ordenar por overall score ascendente (para la barra chart del paper)
    result.sort(key=lambda x: x["overall_score"])
    return {"players": result}


# ─── PASSES-ONLY: alias de /passes con player_id real (retrocompatibilidad) ───

@app.get("/api/match/{match_id}/player/{player_id}/passes-only")
def get_player_passes_only(
    match_id:    int,
    player_id:   int,
    minute_from: int = 0,
    minute_to:   int = 999,
):
    """Alias de /passes — ahora ambos usan player_id real del parquet."""
    return get_player_passes(match_id, player_id, minute_from, minute_to)


# ─── PASES BAJO PRESIÓN CON ORIGEN DE PRESIÓN ────────────────────────────────

@app.get("/api/match/{match_id}/player/{player_id}/pressure-passes")
def get_pressure_passes(match_id: int, player_id: int):
    """
    Todos los pases del jugador que ocurrieron bajo presión, enriquecidos con:
    - Posición exacta del/los presionador(es) en ese momento
    - Nombre del presionador
    - Distancia de presión
    - Outcome del pase
    - Radio de presión (círculo de influencia)
    Usado para el PressurePassMap del frontend.
    """
    conn = get_conn()

    # Pases del jugador bajo presión
    passes_df = conn.execute("""
        SELECT
            e.event_id,
            e.index      AS event_index,
            e.possession,
            e.minute, e.second,
            e.x, e.y,
            e.end_x, e.end_y,
            e.pass_outcome,
            e.pass_length,
            e.pass_angle,
            e.pass_body_part,
            e.pass_height,
            e.pass_recipient_name,
            e.duration,
            e.team_id,
            e.under_pressure
        FROM events e
        WHERE e.match_id = $mid
          AND e.player_id = $pid
          AND e.event_type_name = 'Pass'
          AND e.under_pressure = TRUE
          AND e.x IS NOT NULL
        ORDER BY e.minute, e.second
    """, {"mid": match_id, "pid": player_id}).fetchdf()

    if passes_df.empty:
        conn.close()
        return {"pressure_passes": [], "total": 0}

    team_id_val = int(passes_df["team_id"].iloc[0])

    # Todos los eventos de presión del equipo contrario
    pressure_df = conn.execute("""
        SELECT
            e.index      AS event_index,
            e.possession,
            e.minute, e.second,
            e.x          AS press_x,
            e.y          AS press_y,
            e.player_id  AS presser_id,
            e.player_name AS presser_name,
            e.duration   AS press_duration
        FROM events e
        WHERE e.match_id = $mid
          AND e.event_type_name = 'Pressure'
          AND e.team_id != $tid
          AND e.x IS NOT NULL
        ORDER BY e.minute, e.second
    """, {"mid": match_id, "tid": team_id_val}).fetchdf()

    conn.close()

    # Para cada pase bajo presión, buscar TODOS los presionadores en el mismo
    # momento (misma posesión, índice de evento cercano, ventana ±5 índices)
    result = []
    for _, row in passes_df.iterrows():
        poss  = int(row["possession"])
        pidx  = int(row["event_index"])
        px, py = float(row["x"]), float(row["y"])

        completed = row["pass_outcome"] is None or (
            isinstance(row["pass_outcome"], float) and np.isnan(row["pass_outcome"])
        )

        # Presionadores en la misma posesión, ventana de ±8 eventos
        pressurors = []
        if not pressure_df.empty:
            same_poss = pressure_df[pressure_df["possession"] == poss].copy()
            if not same_poss.empty:
                same_poss["idx_dist"] = (same_poss["event_index"] - pidx).abs()
                near = same_poss[same_poss["idx_dist"] <= 8]
                for _, pr in near.iterrows():
                    bx = float(pr["press_x"])
                    by = float(pr["press_y"])
                    d  = round(float(np.sqrt((px - bx)**2 + (py - by)**2)), 2)
                    pressurors.append({
                        "presser_id":   int(pr["presser_id"]) if not pd.isna(pr["presser_id"]) else None,
                        "presser_name": str(pr["presser_name"]) if pr["presser_name"] else "Desconocido",
                        "press_x":      bx,
                        "press_y":      by,
                        "distance":     d,
                    })
                # Ordenar por distancia (el más cercano primero)
                pressurors.sort(key=lambda x: x["distance"])

        result.append({
            "event_id":       str(row["event_id"]),
            "minute":         int(row["minute"]),
            "second":         int(row["second"]),
            "x":              px,
            "y":              py,
            "end_x":          float(row["end_x"]) if not pd.isna(row["end_x"]) else None,
            "end_y":          float(row["end_y"]) if not pd.isna(row["end_y"]) else None,
            "completed":      completed,
            "pass_length":    float(row["pass_length"]) if not pd.isna(row["pass_length"]) else None,
            "pass_body_part": str(row["pass_body_part"]) if row["pass_body_part"] else None,
            "pass_height":    str(row["pass_height"]) if row["pass_height"] else None,
            "recipient_name": str(row["pass_recipient_name"]) if row["pass_recipient_name"] else None,
            "pressurors":     pressurors,
            "pressure_count": len(pressurors),
            "min_pressure_dist": pressurors[0]["distance"] if pressurors else None,
            "closest_presser":   pressurors[0]["presser_name"] if pressurors else None,
        })

    return {"pressure_passes": result, "total": len(result)}


# ─── PATRONES POR POSICIÓN (resumen agregado del partido) ─────────────────────

@app.get("/api/match/{match_id}/position-patterns")
def get_position_patterns(match_id: int):
    """
    Agrega métricas por posición para todos los jugadores del partido.
    Permite ver qué patrones tienen los jugadores según su posición táctica.
    Retorna scores promedio y conteos para cada grupo posicional.
    """
    conn = get_conn()

    # Eventos de pases, duelos y tiros agrupados por jugador y posición
    # Nota: duel_outcome y shot_statsbomb_xg no existen en el parquet
    df = conn.execute("""
        SELECT
            e.player_id,
            e.player_name,
            e.position_name,
            e.team_id,
            e.event_type_name,
            e.x, e.y, e.end_x, e.end_y,
            e.pass_outcome,
            e.pass_length,
            e.under_pressure,
            e.shot_outcome,
            e.pass_switch,
            e.pass_cross,
            e.pass_through_ball,
            -- xG proxy: distancia al gol para tiros
            CASE WHEN e.event_type_name = 'Shot'
                 THEN SQRT(POWER(120 - e.x, 2) + POWER(40 - e.y, 2))
                 ELSE NULL END AS dist_to_goal
        FROM events e
        WHERE e.match_id = $mid
          AND e.event_type_name IN ('Pass', 'Duel', 'Shot', 'Dribble')
          AND e.player_id IS NOT NULL
          AND e.position_name IS NOT NULL
          AND e.x IS NOT NULL
        ORDER BY e.player_id, e.minute
    """, {"mid": match_id}).fetchdf()

    conn.close()

    if df.empty:
        return {"positions": []}

    # Agrupar por posición → calcular métricas agregadas
    positions_data = {}

    for pos_name, grp in df.groupby("position_name"):
        passes   = grp[grp["event_type_name"] == "Pass"]
        duels    = grp[grp["event_type_name"] == "Duel"]
        shots    = grp[grp["event_type_name"] == "Shot"]
        dribbles = grp[grp["event_type_name"] == "Dribble"]   # proxy duelos ganados

        tp = len(passes)
        cp = int(passes["pass_outcome"].isna().sum()) if tp else 0
        td = len(duels)
        wd = len(dribbles)   # proxy: dribble exitoso = duelo ganado
        ts = len(shots)
        ot = int(shots["shot_outcome"].isin({"Goal", "Saved", "Saved To Post"}).sum()) if ts else 0
        goals = int((shots["shot_outcome"] == "Goal").sum()) if ts else 0

        # Pases hacia adelante
        if tp:
            passes = passes.copy()
            passes["dx"] = passes["end_x"] - passes["x"]
            fwd_ratio = float((passes["dx"] > 0).mean())
            avg_len = float(passes["pass_length"].dropna().mean()) if not passes["pass_length"].dropna().empty else 0
            pressure_ratio = float(passes["under_pressure"].fillna(False).astype(bool).mean())
            special = int(
                passes["pass_switch"].fillna(False).astype(bool).sum() +
                passes["pass_cross"].fillna(False).astype(bool).sum() +
                passes["pass_through_ball"].fillna(False).astype(bool).sum()
            )
        else:
            fwd_ratio = 0; avg_len = 0; pressure_ratio = 0; special = 0

        # xG proxy: distancia media al gol (menor = mejor)
        dist_vals = shots["dist_to_goal"].dropna() if ts else pd.Series(dtype=float)
        avg_dist  = float(dist_vals.mean()) if not dist_vals.empty else 50
        xg_score  = round(max(0.0, (1 - avg_dist / 50)) * 10, 2)

        # Scores 0-10
        completion_score  = round(cp / tp * 10, 2) if tp else 0
        direction_score   = round(fwd_ratio * 10, 2)
        length_score      = round(min(avg_len / 40.0, 1.0) * 10, 2) if avg_len else 0
        pressure_score    = round(pressure_ratio * 10, 2)
        duel_score        = round(wd / max(td, 1) * 10, 2)
        shot_accuracy     = round(ot / ts * 10, 2) if ts else 0
        pass_score        = round((completion_score + direction_score + length_score) / 3, 2)
        shot_score        = round((shot_accuracy + xg_score) / 2, 2) if ts else 0
        overall           = round((pass_score + duel_score + shot_score) / 3, 2)

        # Grupo posicional granular usando el mapa canónico
        pos_group = classify_position(pos_name)

        # Jugadores únicos en esta posición
        n_players = int(grp["player_id"].nunique())
        player_names = list(grp.drop_duplicates("player_id")["player_name"].head(3))

        positions_data[pos_name] = {
            "position_name":    pos_name,
            "position_group":   pos_group,
            "n_players":        n_players,
            "player_names":     player_names,
            # Pases
            "total_passes":     tp,
            "completed_passes": cp,
            "completion_score": completion_score,
            "direction_score":  direction_score,
            "length_score":     length_score,
            "pressure_score":   pressure_score,
            "special_passes":   special,
            "pass_score":       pass_score,
            # Duelos
            "total_duels":      td,
            "won_duels":        wd,
            "duel_score":       duel_score,
            # Tiros
            "total_shots":      ts,
            "on_target":        ot,
            "goals":            goals,
            "shot_accuracy":    shot_accuracy,
            "xg_score":         xg_score,
            "shot_score":       shot_score,
            # General
            "overall_score":    overall,
        }

    return {"positions": list(positions_data.values())}


# ─── GLOBAL: ESTADÍSTICAS DE JUGADOR EN TODA LA BASE DE DATOS ────────────────

# ── Taxonomía de posiciones (25 → 9 grupos tácticos granulares) ──────────────
#
# Portero         : Goalkeeper
# Defensa Central : Center Back, Left Center Back, Right Center Back
# Lateral         : Left Back, Right Back, Left Wing Back, Right Wing Back
# MF Defensivo    : Center Defensive Midfield, Left Defensive Midfield, Right Defensive Midfield
# MF Central      : Center Midfield, Left Center Midfield, Right Center Midfield
# MF Atacante     : Center Attacking Midfield, Left Attacking Midfield, Right Attacking Midfield
# Extremo         : Left Wing, Right Wing, Left Midfield, Right Midfield
# Delantero       : Center Forward, Left Center Forward, Right Center Forward, Secondary Striker

POSITION_MAP: dict[str, str] = {
    "Goalkeeper":               "Portero",
    "Center Back":              "Defensa Central",
    "Left Center Back":         "Defensa Central",
    "Right Center Back":        "Defensa Central",
    "Left Back":                "Lateral",
    "Right Back":               "Lateral",
    "Left Wing Back":           "Lateral",
    "Right Wing Back":          "Lateral",
    "Center Defensive Midfield":  "MF Defensivo",
    "Left Defensive Midfield":    "MF Defensivo",
    "Right Defensive Midfield":   "MF Defensivo",
    "Center Midfield":            "MF Central",
    "Left Center Midfield":       "MF Central",
    "Right Center Midfield":      "MF Central",
    "Center Attacking Midfield":  "MF Atacante",
    "Left Attacking Midfield":    "MF Atacante",
    "Right Attacking Midfield":   "MF Atacante",
    "Left Wing":                  "Extremo",
    "Right Wing":                 "Extremo",
    "Left Midfield":              "Extremo",
    "Right Midfield":             "Extremo",
    "Center Forward":             "Delantero",
    "Left Center Forward":        "Delantero",
    "Right Center Forward":       "Delantero",
    "Secondary Striker":          "Delantero",
}

# SQL fragment: position_name IN (...) per group
POSITION_GROUP_SQL: dict[str, str] = {
    "Portero":          "position_name IN ('Goalkeeper')",
    "Defensa Central":  "position_name IN ('Center Back','Left Center Back','Right Center Back')",
    "Lateral":          "position_name IN ('Left Back','Right Back','Left Wing Back','Right Wing Back')",
    "MF Defensivo":     "position_name IN ('Center Defensive Midfield','Left Defensive Midfield','Right Defensive Midfield')",
    "MF Central":       "position_name IN ('Center Midfield','Left Center Midfield','Right Center Midfield')",
    "MF Atacante":      "position_name IN ('Center Attacking Midfield','Left Attacking Midfield','Right Attacking Midfield')",
    "Extremo":          "position_name IN ('Left Wing','Right Wing','Left Midfield','Right Midfield')",
    "Delantero":        "position_name IN ('Center Forward','Left Center Forward','Right Center Forward','Secondary Striker')",
}


def classify_position(pos: str) -> str:
    return POSITION_MAP.get(pos, "Otro")


@app.get("/api/global/player-stats")
def get_global_player_stats(
    position_group: Optional[str] = None,
    min_matches: int = 3,
    limit: int = 50,
):
    """
    Agrega estadísticas de TODOS los jugadores en toda la base de datos.
    Permite comparar a un jugador contra la media de su subposición táctica.

    position_group: Portero | Defensa Central | Lateral | MF Defensivo |
                    MF Central | MF Atacante | Extremo | Delantero
    """
    conn = get_conn()

    # Classify position group in SQL — filter BEFORE LIMIT using exact IN list
    pos_filter_sql = ""
    params: dict = {"min_matches": min_matches}
    if position_group and position_group != "Todos":
        cond = POSITION_GROUP_SQL.get(position_group, "1=1")
        pos_filter_sql = f"AND ({cond})"

    df = conn.execute(f"""
        SELECT
            e.player_id,
            e.player_name,
            e.position_name,
            SUM(CASE WHEN e.event_type_name='Pass' THEN 1 ELSE 0 END)                          AS total_passes,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_outcome IS NULL THEN 1 ELSE 0 END) AS completed_passes,
            AVG(CASE WHEN e.event_type_name='Pass' THEN e.pass_length END)                      AS avg_pass_length,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.end_x > e.x THEN 1 ELSE 0 END)        AS fwd_passes,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_switch=TRUE THEN 1 ELSE 0 END)   AS switches,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_cross=TRUE THEN 1 ELSE 0 END)    AS crosses,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_through_ball=TRUE THEN 1 ELSE 0 END) AS through_balls,
            SUM(CASE WHEN e.event_type_name='Shot' THEN 1 ELSE 0 END)                          AS total_shots,
            SUM(CASE WHEN e.event_type_name='Shot' AND e.shot_outcome='Goal' THEN 1 ELSE 0 END) AS goals,
            SUM(CASE WHEN e.event_type_name='Shot'
                      AND e.shot_outcome IN ('Goal','Saved','Saved To Post') THEN 1 ELSE 0 END) AS on_target,
            AVG(CASE WHEN e.event_type_name='Shot'
                     THEN SQRT(POWER(120-e.x,2)+POWER(40-e.y,2)) END)                          AS avg_shot_dist,
            SUM(CASE WHEN e.event_type_name='Dribble' THEN 1 ELSE 0 END)                       AS dribbles,
            SUM(CASE WHEN e.under_pressure=TRUE THEN 1 ELSE 0 END)                             AS under_pressure_total,
            COUNT(DISTINCT e.match_id)                                                          AS matches
        FROM events e
        WHERE e.player_id IS NOT NULL
          AND e.player_name IS NOT NULL
          AND e.position_name IS NOT NULL
          AND e.position_name != 'Substitute'
          {pos_filter_sql}
        GROUP BY e.player_id, e.player_name, e.position_name
        HAVING COUNT(DISTINCT e.match_id) >= $min_matches
        ORDER BY total_passes DESC
        LIMIT 500
    """, params).fetchdf()

    conn.close()

    if df.empty:
        return {"players": [], "position_averages": {}}

    # Classify position group using the canonical map
    df["position_group"] = df["position_name"].apply(classify_position)

    # Compute per-match metrics and normalized scores
    df["passes_pm"]    = (df["total_passes"]    / df["matches"]).round(2)
    df["goals_pm"]     = (df["goals"]           / df["matches"]).round(3)
    df["shots_pm"]     = (df["total_shots"]     / df["matches"]).round(2)
    df["dribbles_pm"]  = (df["dribbles"]        / df["matches"]).round(2)
    df["completion_pct"] = np.where(df["total_passes"] > 0,
        (df["completed_passes"] / df["total_passes"] * 100).round(1), 0)
    df["shot_acc_pct"] = np.where(df["total_shots"] > 0,
        (df["on_target"] / df["total_shots"] * 100).round(1), 0)
    df["fwd_pass_pct"] = np.where(df["total_passes"] > 0,
        (df["fwd_passes"] / df["total_passes"] * 100).round(1), 0)
    df["xg_proxy"]     = (np.clip(1 - df["avg_shot_dist"].fillna(50) / 50, 0, 1) * 10).round(2)

    # Normalize scores 0-10 per position group
    for col, maxval in [
        ("passes_pm", 120), ("goals_pm", 1.0), ("shots_pm", 8),
        ("dribbles_pm", 10), ("completion_pct", 100), ("shot_acc_pct", 100),
    ]:
        norm_col = col + "_score"
        df[norm_col] = np.clip(df[col] / maxval * 10, 0, 10).round(2)

    # Compute position averages
    pos_avg = df.groupby("position_group").agg({
        "passes_pm": "mean", "goals_pm": "mean", "shots_pm": "mean",
        "dribbles_pm": "mean", "completion_pct": "mean", "shot_acc_pct": "mean",
        "fwd_pass_pct": "mean", "xg_proxy": "mean",
        "passes_pm_score": "mean", "goals_pm_score": "mean",
        "shots_pm_score": "mean", "dribbles_pm_score": "mean",
        "completion_pct_score": "mean", "shot_acc_pct_score": "mean",
    }).round(2).reset_index()

    position_averages = {}
    for _, r in pos_avg.iterrows():
        position_averages[r["position_group"]] = {
            k: (None if isinstance(v, float) and np.isnan(v) else v)
            for k, v in r.items() if k != "position_group"
        }

    # Sort by most relevant metric per tactical group
    SORT_METRIC: dict[str, str] = {
        "Portero":         "completion_pct",   # porteros: precisión de pase
        "Defensa Central": "completion_pct",
        "Lateral":         "passes_pm",        # laterales: volumen de pases
        "MF Defensivo":    "passes_pm",
        "MF Central":      "passes_pm",
        "MF Atacante":     "goals_pm",
        "Extremo":         "dribbles_pm",      # extremos: regates
        "Delantero":       "goals_pm",
    }
    sort_col = SORT_METRIC.get(position_group or "", "goals_pm")
    top_df = df.sort_values(sort_col, ascending=False).head(limit)

    records = []
    for _, r in top_df.iterrows():
        records.append({
            "player_id":     int(r["player_id"]) if not pd.isna(r["player_id"]) else None,
            "player_name":   r["player_name"],
            "position_name": r["position_name"],
            "position_group": r["position_group"],
            "matches":       int(r["matches"]),
            # Raw counts
            "total_passes":  int(r["total_passes"]),
            "completed_passes": int(r["completed_passes"]),
            "total_shots":   int(r["total_shots"]),
            "goals":         int(r["goals"]),
            "on_target":     int(r["on_target"]),
            "dribbles":      int(r["dribbles"]),
            "switches":      int(r["switches"]) if not pd.isna(r["switches"]) else 0,
            "crosses":       int(r["crosses"]) if not pd.isna(r["crosses"]) else 0,
            "through_balls": int(r["through_balls"]) if not pd.isna(r["through_balls"]) else 0,
            # Per-match
            "passes_pm":     float(r["passes_pm"]),
            "goals_pm":      float(r["goals_pm"]),
            "shots_pm":      float(r["shots_pm"]),
            "dribbles_pm":   float(r["dribbles_pm"]),
            # Percentages
            "completion_pct": float(r["completion_pct"]),
            "shot_acc_pct":   float(r["shot_acc_pct"]),
            "fwd_pass_pct":   float(r["fwd_pass_pct"]),
            "xg_proxy":       float(r["xg_proxy"]),
            # Scores 0-10
            "passes_pm_score":      float(r["passes_pm_score"]),
            "goals_pm_score":       float(r["goals_pm_score"]),
            "shots_pm_score":       float(r["shots_pm_score"]),
            "dribbles_pm_score":    float(r["dribbles_pm_score"]),
            "completion_pct_score": float(r["completion_pct_score"]),
            "shot_acc_pct_score":   float(r["shot_acc_pct_score"]),
        })

    return {
        "players":            _clean(records),
        "position_averages":  position_averages,
    }


@app.get("/api/global/player-profile")
def get_global_player_profile(player_name: str, min_matches: int = 1):
    """
    Perfil completo de un jugador en toda la base de datos:
    - Estadísticas agregadas totales
    - Heatmap de eventos (todos los matches)
    - Distribución de tiros (origen x,y + outcome)
    - Pases-gol (pre-shot passes: los pases que preceden a un gol)
    - Recorrido por el campo (zonas de mayor actividad)
    - Comparativa contra media de su posición principal
    """
    conn = get_conn()

    # ── Stats globales del jugador ─────────────────────────────────────────────
    stats = conn.execute("""
        SELECT
            e.player_name,
            e.position_name,
            COUNT(DISTINCT e.match_id)                                                          AS matches,
            SUM(CASE WHEN e.event_type_name='Pass' THEN 1 ELSE 0 END)                          AS total_passes,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_outcome IS NULL THEN 1 ELSE 0 END) AS completed_passes,
            AVG(CASE WHEN e.event_type_name='Pass' THEN e.pass_length END)                      AS avg_pass_length,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.end_x > e.x THEN 1 ELSE 0 END)        AS fwd_passes,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_cross=TRUE THEN 1 ELSE 0 END)    AS crosses,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_through_ball=TRUE THEN 1 ELSE 0 END) AS through_balls,
            SUM(CASE WHEN e.event_type_name='Shot' THEN 1 ELSE 0 END)                          AS total_shots,
            SUM(CASE WHEN e.event_type_name='Shot' AND e.shot_outcome='Goal' THEN 1 ELSE 0 END) AS goals,
            SUM(CASE WHEN e.event_type_name='Shot'
                      AND e.shot_outcome IN ('Goal','Saved','Saved To Post') THEN 1 ELSE 0 END) AS on_target,
            SUM(CASE WHEN e.event_type_name='Dribble' THEN 1 ELSE 0 END)                       AS dribbles,
            SUM(CASE WHEN e.under_pressure=TRUE THEN 1 ELSE 0 END)                             AS under_pressure_events
        FROM events e
        WHERE e.player_name = $pname
          AND e.position_name IS NOT NULL
          AND e.position_name != 'Substitute'
        GROUP BY e.player_name, e.position_name
        ORDER BY matches DESC
        LIMIT 1
    """, {"pname": player_name}).fetchdf()

    if stats.empty:
        conn.close()
        return {"error": f"Player '{player_name}' not found"}

    # ── Heatmap de presencia en el campo (grid 6x5) ────────────────────────────
    heatmap = conn.execute("""
        SELECT
            CAST(e.x / 20 AS INTEGER) AS cx,
            CAST(e.y / 16 AS INTEGER) AS cy,
            COUNT(*) AS cnt
        FROM events e
        WHERE e.player_name = $pname
          AND e.x IS NOT NULL AND e.y IS NOT NULL
          AND e.event_type_name IN ('Pass','Carry','Dribble','Shot','Duel','Pressure')
        GROUP BY cx, cy
        ORDER BY cnt DESC
    """, {"pname": player_name}).fetchdf()

    # ── Tiros: origen y outcome ─────────────────────────────────────────────────
    shots = conn.execute("""
        SELECT
            e.x, e.y,
            e.shot_outcome,
            e.match_id,
            e.minute,
            SQRT(POWER(120-e.x,2)+POWER(40-e.y,2)) AS dist_to_goal
        FROM events e
        WHERE e.player_name = $pname
          AND e.event_type_name = 'Shot'
          AND e.x IS NOT NULL
        ORDER BY e.match_id, e.minute
    """, {"pname": player_name}).fetchdf()

    # ── Pre-shot passes: pases que dentro de 3 eventos preceden un gol ─────────
    # Encontrar primero los eventos de gol del jugador
    goal_events = conn.execute("""
        SELECT e.match_id, e.index AS goal_idx
        FROM events e
        WHERE e.player_name = $pname
          AND e.event_type_name = 'Shot'
          AND e.shot_outcome = 'Goal'
    """, {"pname": player_name}).fetchdf()

    assist_passes = pd.DataFrame()
    if not goal_events.empty and len(goal_events) <= 600:
        # Pase inmediatamente anterior al gol (pase-gol o pase que lleva al gol)
        conds = " OR ".join([
            f"(e.match_id={int(r.match_id)} AND e.index BETWEEN {int(r.goal_idx)-3} AND {int(r.goal_idx)-1})"
            for _, r in goal_events.iterrows()
        ])
        assist_passes = conn.execute(f"""
            SELECT e.x, e.y, e.end_x, e.end_y, e.player_name, e.event_type_name, e.match_id, e.minute
            FROM events e
            WHERE ({conds})
              AND e.event_type_name = 'Pass'
              AND e.x IS NOT NULL
        """).fetchdf()

    # ── Media de la posición principal ────────────────────────────────────────
    main_pos = str(stats.iloc[0]["position_name"])
    pos_avg = conn.execute("""
        SELECT
            AVG(CASE WHEN ev.event_type_name='Pass' THEN 1.0 ELSE 0 END)*100 AS pass_rate,
            SUM(CASE WHEN ev.event_type_name='Pass' AND ev.pass_outcome IS NULL THEN 1 ELSE 0 END) * 1.0 /
                NULLIF(SUM(CASE WHEN ev.event_type_name='Pass' THEN 1 ELSE 0 END),0) * 100 AS completion_pct,
            SUM(CASE WHEN ev.event_type_name='Shot' AND ev.shot_outcome='Goal' THEN 1 ELSE 0 END) * 1.0 /
                NULLIF(COUNT(DISTINCT ev.match_id),0) AS goals_pm,
            SUM(CASE WHEN ev.event_type_name='Shot' THEN 1 ELSE 0 END) * 1.0 /
                NULLIF(COUNT(DISTINCT ev.match_id),0) AS shots_pm,
            SUM(CASE WHEN ev.event_type_name='Pass' THEN 1 ELSE 0 END) * 1.0 /
                NULLIF(COUNT(DISTINCT ev.match_id),0) AS passes_pm,
            SUM(CASE WHEN ev.event_type_name='Dribble' THEN 1 ELSE 0 END) * 1.0 /
                NULLIF(COUNT(DISTINCT ev.match_id),0) AS dribbles_pm
        FROM events ev
        WHERE ev.position_name = $pos
          AND ev.player_name != $pname
          AND ev.player_id IS NOT NULL
    """, {"pos": main_pos, "pname": player_name}).fetchdf()

    conn.close()

    # ── Construir respuesta ────────────────────────────────────────────────────
    r = stats.iloc[0]
    m = int(r["matches"])

    def safe(v, d=0):
        return float(v) if v is not None and not (isinstance(v, float) and np.isnan(v)) else d

    player_stats = {
        "player_name":      r["player_name"],
        "position_name":    r["position_name"],
        "position_group":   classify_position(str(r["position_name"])),
        "matches":          m,
        "total_passes":     int(r["total_passes"]),
        "completed_passes": int(r["completed_passes"]),
        "completion_pct":   round(int(r["completed_passes"]) / max(int(r["total_passes"]),1)*100, 1),
        "avg_pass_length":  round(safe(r["avg_pass_length"]), 1),
        "fwd_passes":       int(r["fwd_passes"]),
        "fwd_pass_pct":     round(int(r["fwd_passes"]) / max(int(r["total_passes"]),1)*100, 1),
        "crosses":          int(r["crosses"]) if not pd.isna(r["crosses"]) else 0,
        "through_balls":    int(r["through_balls"]) if not pd.isna(r["through_balls"]) else 0,
        "total_shots":      int(r["total_shots"]),
        "goals":            int(r["goals"]),
        "on_target":        int(r["on_target"]),
        "dribbles":         int(r["dribbles"]),
        "under_pressure_events": int(r["under_pressure_events"]),
        # Per match
        "passes_pm":   round(int(r["total_passes"]) / max(m,1), 1),
        "goals_pm":    round(int(r["goals"]) / max(m,1), 3),
        "shots_pm":    round(int(r["total_shots"]) / max(m,1), 2),
        "dribbles_pm": round(int(r["dribbles"]) / max(m,1), 2),
        "shot_acc_pct": round(int(r["on_target"]) / max(int(r["total_shots"]),1)*100, 1),
    }

    # Heatmap
    heatmap_cells = [
        {"cx": int(h.cx), "cy": int(h.cy), "count": int(h.cnt)}
        for _, h in heatmap.iterrows()
    ]
    max_hm = max((c["count"] for c in heatmap_cells), default=1)
    for c in heatmap_cells:
        c["intensity"] = round(c["count"] / max_hm, 3)

    # Shots
    shot_records = []
    for _, s in shots.iterrows():
        shot_records.append({
            "x": float(s["x"]), "y": float(s["y"]),
            "outcome": str(s["shot_outcome"]) if s["shot_outcome"] else "Unknown",
            "dist_to_goal": round(float(s["dist_to_goal"]), 1),
            "minute": int(s["minute"]),
        })

    # Assist passes
    assist_records = df_to_records(assist_passes) if not assist_passes.empty else []

    # Position average
    pa = pos_avg.iloc[0] if not pos_avg.empty else None
    position_avg = {
        "completion_pct": round(safe(pa["completion_pct"]), 1) if pa is not None else 0,
        "goals_pm":       round(safe(pa["goals_pm"]), 3)       if pa is not None else 0,
        "shots_pm":       round(safe(pa["shots_pm"]), 2)       if pa is not None else 0,
        "passes_pm":      round(safe(pa["passes_pm"]), 1)      if pa is not None else 0,
        "dribbles_pm":    round(safe(pa["dribbles_pm"]), 2)    if pa is not None else 0,
    }

    return {
        "player":          player_stats,
        "heatmap":         heatmap_cells,
        "shots":           shot_records,
        "assist_passes":   assist_records,
        "position_average": position_avg,
    }


# ─── SHOT MAP ────────────────────────────────────────────────────────────────

@app.get("/api/match/{match_id}/shot-map")
def get_shot_map(match_id: int):
    """Todos los tiros de ambos equipos en un partido con coordenadas y outcome."""
    conn = get_conn()
    df = conn.execute("""
        SELECT
            e.player_id, e.player_name, e.team_id, e.team_name,
            e.x, e.y, e.minute, e.second,
            e.shot_outcome, e.under_pressure,
            SQRT(POWER(120 - e.x, 2) + POWER(40 - e.y, 2)) AS dist_to_goal
        FROM events e
        WHERE e.match_id = $mid
          AND e.event_type_name = 'Shot'
          AND e.x IS NOT NULL
        ORDER BY e.minute, e.second
    """, {"mid": match_id}).fetchdf()
    conn.close()
    return {"shots": df_to_records(df)}


# ─── FUZZY C-MEANS CLUSTERING ─────────────────────────────────────────────────

def _fcm(X: np.ndarray, c: int = 4, m: float = 2.0, max_iter: int = 150, eps: float = 1e-6):
    """Fuzzy C-Means — returns U (n×c membership) and cluster centers (c×features)."""
    n = X.shape[0]
    rng = np.random.default_rng(42)
    U = rng.dirichlet(np.ones(c), size=n)        # n×c, rows sum to 1
    for _ in range(max_iter):
        Um = U.T ** m                             # c×n
        centers = (Um @ X) / Um.sum(axis=1, keepdims=True)   # c×features
        dists = np.linalg.norm(X[:, None, :] - centers[None], axis=2)  # n×c
        dists = np.maximum(dists, 1e-10)
        inv = dists ** (-2.0 / (m - 1))
        U_new = inv / inv.sum(axis=1, keepdims=True)
        if np.max(np.abs(U_new - U)) < eps:
            break
        U = U_new
    return U, centers


def _pca2(X: np.ndarray) -> np.ndarray:
    """Manual PCA to 2D (symmetric eigh, no sklearn needed)."""
    Xc = X - X.mean(axis=0)
    cov = Xc.T @ Xc / max(len(Xc) - 1, 1)
    _, vecs = np.linalg.eigh(cov)      # ascending eigenvalues
    return Xc @ vecs[:, -2:][:, ::-1] # top-2 eigenvecs, descending


@app.get("/api/match/{match_id}/fcm")
def get_player_fcm(match_id: int, n_clusters: int = Query(default=4, ge=2, le=8)):
    """Fuzzy C-Means on [pass_score, duel_score, shot_score] + PCA-2D for scatter coords."""
    conn = get_conn()
    players_df = conn.execute("""
        SELECT DISTINCT e.player_id, e.player_name, e.team_id, e.team_name
        FROM events e
        WHERE e.match_id=$mid AND e.player_id IS NOT NULL AND e.player_name IS NOT NULL
        ORDER BY e.team_id, e.player_name
    """, {"mid": match_id}).fetchdf()
    scores_df = conn.execute("""
        SELECT e.player_id, e.team_id,
            SUM(CASE WHEN e.event_type_name='Pass' THEN 1 ELSE 0 END)          AS tp,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.pass_outcome IS NULL
                     THEN 1 ELSE 0 END)                                         AS cp,
            AVG(CASE WHEN e.event_type_name='Pass' THEN e.pass_length END)      AS al,
            SUM(CASE WHEN e.event_type_name='Duel' THEN 1 ELSE 0 END)          AS td,
            SUM(CASE WHEN e.event_type_name='Dribble' THEN 1 ELSE 0 END)       AS wd,
            SUM(CASE WHEN e.event_type_name='Shot' THEN 1 ELSE 0 END)          AS ts,
            SUM(CASE WHEN e.event_type_name='Shot'
                      AND e.shot_outcome IN ('Goal','Saved','Saved To Post')
                     THEN 1 ELSE 0 END)                                         AS ot,
            AVG(CASE WHEN e.event_type_name='Shot'
                     THEN SQRT(POWER(120-e.x,2)+POWER(40-e.y,2)) END)          AS sd
        FROM events e WHERE e.match_id=$mid AND e.player_id IS NOT NULL
        GROUP BY e.player_id, e.team_id
    """, {"mid": match_id}).fetchdf()
    conn.close()

    merged = players_df.merge(scores_df, on=["player_id", "team_id"], how="left").fillna(0)
    rows = []
    for _, r in merged.iterrows():
        tp, cp = int(r["tp"]), int(r["cp"])
        al = float(r["al"]) if r["al"] else 0
        td, wd = int(r["td"]), int(r["wd"])
        ts, ot = int(r["ts"]), int(r["ot"])
        sd = float(r["sd"]) if r["sd"] else 50
        xg = max(0.0, (1 - sd / 50)) * 10
        ps = (cp / tp * 10 if tp else 0) * 0.6 + min(al / 40, 1) * 10 * 0.4
        ds = wd / max(td, 1) * 10
        ss = (ot / ts * 10 if ts else 0) * 0.6 + xg * 0.4
        rows.append({
            "player_id": int(r["player_id"]), "player_name": r["player_name"],
            "team_id": int(r["team_id"]), "team_name": r["team_name"],
            "pass_score": round(ps, 2), "duel_score": round(ds, 2),
            "shot_score": round(ss, 2), "overall_score": round((ps + ds + ss) / 3, 2),
        })

    if not rows:
        return {"players": [], "n_clusters": n_clusters}

    X = np.array([[r["pass_score"], r["duel_score"], r["shot_score"]] for r in rows])
    c = min(n_clusters, len(rows))
    U, _ = _fcm(X, c=c)
    coords = _pca2(X) if len(rows) >= 3 else X[:, :2].copy()

    for i in range(2):
        span = float(coords[:, i].max() - coords[:, i].min())
        if span > 0:
            coords[:, i] = (coords[:, i] - coords[:, i].min()) / span * 2 - 1

    clusters = U.argmax(axis=1)
    for i, row in enumerate(rows):
        row["x"] = round(float(coords[i, 0]), 4)
        row["y"] = round(float(coords[i, 1]), 4)
        row["cluster"] = int(clusters[i])
        row["memberships"] = [round(float(v), 4) for v in U[i]]

    return {"players": rows, "n_clusters": c}


# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
