from __future__ import annotations

from pathlib import Path
from typing import Optional

import duckdb
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"

TABLES = {
    "events": "events/events_fact.parquet",
    "matches": "matches/matches_fact.parquet",
    "competitions": "parquet/competitions.parquet",
}

app = FastAPI(title="StatsBomb Dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect()
    conn.execute("SET memory_limit='4GB'")
    conn.execute("SET threads TO 4")
    for name, path in TABLES.items():
        full = PROCESSED_DIR / path
        conn.execute(
            f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM read_parquet('{full}')"
        )
    return conn


# ─────────────────────────────────────────────
# PASS CLASSIFICATION
# ─────────────────────────────────────────────

VERTICAL_THRESHOLD = 10.0
HORIZONTAL_THRESHOLD = 8.0

PASS_LABELS = {
    "vertical_ofensiva":   "Vertical Ofensiva",
    "vertical_defensiva":  "Vertical Defensiva",
    "horizontal":          "Horizontal",
    "diagonal_ofensiva":   "Diagonal Ofensiva",
    "diagonal_defensiva":  "Diagonal Defensiva",
    "horizontal_corta":    "Horizontal Corta",
    "corta":               "Corta",
}

PASS_COLORS = {
    "vertical_ofensiva":   "#ef4444",
    "vertical_defensiva":  "#f97316",
    "horizontal":          "#3b82f6",
    "diagonal_ofensiva":   "#a855f7",
    "diagonal_defensiva":  "#64748b",
    "horizontal_corta":    "#94a3b8",
    "corta":               "#e2e8f0",
}


def classify_pass(dx: float, dy: float) -> str:
    adx, ady = abs(dx), abs(dy)
    if adx < 3 and ady < 3:
        return "corta"
    if adx > VERTICAL_THRESHOLD and adx >= ady * 1.2:
        return "vertical_ofensiva" if dx > 0 else "vertical_defensiva"
    if ady > HORIZONTAL_THRESHOLD and ady > adx:
        return "horizontal"
    if adx >= ady:
        return "diagonal_ofensiva" if dx > 0 else "diagonal_defensiva"
    return "horizontal_corta"


def add_pass_type(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["dx"] = df["end_x"] - df["x"]
    df["dy"] = df["end_y"] - df["y"]
    df["distance"] = np.sqrt(df["dx"] ** 2 + df["dy"] ** 2)
    df["pass_type"] = df.apply(lambda r: classify_pass(r["dx"], r["dy"]), axis=1)
    return df


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def build_where(team_id, match_id, competition_id, season_id, prefix=""):
    clauses, params = [], {}
    if team_id:
        clauses.append(f"{prefix}team_id = $team_id")
        params["team_id"] = team_id
    if match_id:
        clauses.append(f"{prefix}match_id = $match_id")
        params["match_id"] = match_id
    return clauses, params


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/matches")
def get_matches():
    conn = get_conn()
    df = conn.execute("""
        SELECT m.match_id, m.match_date, m.competition_id, m.season_id,
               m.home_team_id, m.away_team_id, m.home_score, m.away_score,
               m.match_week, m.match_status_360,
               c.competition_name, c.country_name, c.season_name
        FROM matches m
        LEFT JOIN competitions c ON m.competition_id = c.competition_id
            AND m.season_id = c.season_id
        ORDER BY m.match_date DESC
    """).fetchdf()
    conn.close()
    return {"matches": df.to_dict(orient="records")}


@app.get("/api/passes")
def get_passes(
    match_id: Optional[int] = None,
    team_id: Optional[int] = None,
    limit: int = Query(default=6000, le=20000),
):
    conn = get_conn()
    extra_clauses, params = build_where(team_id, match_id, None, None)
    where = ["event_type_name = 'Pass'", "x IS NOT NULL", "end_x IS NOT NULL"] + extra_clauses

    sql = f"""
        SELECT event_id, match_id, team_id, team_name, x, y, end_x, end_y,
               minute, second, possession, play_pattern_name
        FROM events
        WHERE {' AND '.join(where)}
        ORDER BY match_id, minute, second
        LIMIT {limit}
    """
    df = conn.execute(sql, params).fetchdf()
    conn.close()

    if df.empty:
        return {"passes": []}
    return {"passes": add_pass_type(df).to_dict(orient="records")}


@app.get("/api/shots")
def get_shots(
    match_id: Optional[int] = None,
    team_id: Optional[int] = None,
    limit: int = Query(default=3000, le=10000),
):
    conn = get_conn()
    extra_clauses, params = build_where(team_id, match_id, None, None)
    where = ["event_type_name = 'Shot'", "x IS NOT NULL"] + extra_clauses

    df = conn.execute(f"""
        SELECT event_id, match_id, team_id, team_name, x, y, end_x, end_y,
               minute, second, play_pattern_name
        FROM events
        WHERE {' AND '.join(where)}
        ORDER BY match_id, minute, second
        LIMIT {limit}
    """, params).fetchdf()
    conn.close()
    return {"shots": df.to_dict(orient="records")}


@app.get("/api/teams")
def get_teams():
    conn = get_conn()
    df = conn.execute("""
        SELECT DISTINCT team_id, team_name
        FROM events
        WHERE team_id IS NOT NULL
        ORDER BY team_name
    """).fetchdf()
    conn.close()
    return {"teams": df.to_dict(orient="records")}


@app.get("/api/competitions")
def get_competitions():
    conn = get_conn()
    df = conn.execute("""
        SELECT DISTINCT competition_id, competition_name, country_name, season_name, season_id
        FROM competitions
        ORDER BY competition_name, season_name
    """).fetchdf()
    conn.close()
    return {"competitions": df.to_dict(orient="records")}


# ─────────────────────────────────────────────
# HYPOTHESIS 1 – filtered
# ─────────────────────────────────────────────

@app.get("/api/hypothesis/passes")
def hypothesis_passes(
    team_id: Optional[int] = None,
    match_id: Optional[int] = None,
):
    conn = get_conn()

    extra_clauses, params = build_where(team_id, match_id, None, None)

    # All passes (with filter)
    pass_where = (
        ["event_type_name = 'Pass'", "x IS NOT NULL", "end_x IS NOT NULL"]
        + extra_clauses
    )
    passes_raw = conn.execute(
        f"""
        SELECT x, y, end_x, end_y, match_id, team_id, event_id,
               possession, play_pattern_name
        FROM events
        WHERE {' AND '.join(pass_where)}
        """,
        params,
    ).fetchdf()

    passes = add_pass_type(passes_raw)
    total = len(passes)

    type_counts = passes["pass_type"].value_counts().to_dict()

    # Pass by zone
    def get_zone(x):
        if x < 40: return "defensivo"
        if x < 80: return "medio"
        return "ofensivo"

    passes["zone"] = passes["x"].apply(get_zone)

    # Shots (with filter)
    shot_where = ["event_type_name = 'Shot'"] + extra_clauses
    shots = conn.execute(
        f"""
        SELECT event_id, match_id, team_id, x, y, minute, possession
        FROM events
        WHERE {' AND '.join(shot_where)}
        """,
        params,
    ).fetchdf()

    # Goals from match table (global – always whole-dataset for efficiency context)
    match_goals = conn.execute("""
        SELECT match_id, home_team_id AS team_id, home_score AS goals FROM matches
        UNION ALL
        SELECT match_id, away_team_id, away_score FROM matches
    """).fetchdf()

    conn.close()

    # Match-level aggregation
    match_pass_stats = (
        passes.groupby(["match_id", "team_id", "pass_type"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )
    merged = match_pass_stats.merge(match_goals, on=["match_id", "team_id"], how="left")
    merged["goals"] = merged["goals"].fillna(0)

    cols = [c for c in type_counts if c in merged.columns]
    correlation, efficiency = {}, {}
    for col in cols:
        if merged[col].sum() > 0:
            r = merged[col].corr(merged["goals"])
            correlation[col] = round(float(r), 4)
            tp = int(merged[col].sum())
            tg = int(merged.loc[merged[col] > 0, "goals"].sum())
            efficiency[col] = {
                "goals_per_pass": round(tg / tp, 6),
                "pases": tp,
                "goles_asociados": tg,
                "label": PASS_LABELS.get(col, col),
                "color": PASS_COLORS.get(col, "#94a3b8"),
            }

    baseline = efficiency.get("horizontal", {}).get("goals_per_pass", 1e-9)
    for v in efficiency.values():
        v["vs_horizontal"] = round(v["goals_per_pass"] / baseline, 2) if baseline else 0

    shots["zone"] = shots["x"].apply(get_zone)

    # Pass-type breakdown by zone
    zone_breakdown = (
        passes.groupby(["zone", "pass_type"])
        .size()
        .unstack(fill_value=0)
        .to_dict()
    )

    return {
        "total_passes": total,
        "total_shots": len(shots),
        "pass_type_counts": {
            k: {
                "count": v,
                "pct": round(v / total * 100, 2),
                "label": PASS_LABELS.get(k, k),
                "color": PASS_COLORS.get(k, "#94a3b8"),
            }
            for k, v in sorted(type_counts.items(), key=lambda x: -x[1])
        },
        "zone_breakdown": zone_breakdown,
        "shots_by_zone": shots["zone"].value_counts().to_dict(),
        "pass_type_goal_correlation": correlation,
        "pass_efficiency": efficiency,
        "model": {
            "vertical_threshold_yards": VERTICAL_THRESHOLD,
            "horizontal_threshold_yards": HORIZONTAL_THRESHOLD,
            "pitch_length": 120,
            "pitch_width": 80,
            "rule_vertical": "abs(dx) > 10 y abs(dx) >= abs(dy)*1.2 y dx > 0",
            "rule_horizontal": "abs(dy) > 8 y abs(dy) > abs(dx)",
        },
        "filters_applied": {
            "team_id": team_id,
            "match_id": match_id,
        },
    }


# ─────────────────────────────────────────────
# TEAMS GOAL COMPARISON
# ─────────────────────────────────────────────

@app.get("/api/teams/goal-comparison")
def teams_goal_comparison(top_n: int = Query(default=8, le=20)):
    """
    Top N teams by total goals scored vs bottom N, broken down by pass type.
    Returns two lists: top_scorers and bottom_scorers.
    Each item has team name, total goals, and pass-type efficiency.
    """
    conn = get_conn()

    # Total goals per team across all matches (home + away)
    # Goals per team: home + away, then join names from events
    raw_goals = conn.execute("""
        SELECT home_team_id AS team_id, SUM(home_score) AS goals, COUNT(*) AS matches
        FROM matches GROUP BY home_team_id
        UNION ALL
        SELECT away_team_id, SUM(away_score), COUNT(*) FROM matches GROUP BY away_team_id
    """).fetchdf()
    agg = raw_goals.groupby("team_id").agg(
        total_goals=("goals","sum"), matches=("matches","sum")
    ).reset_index()
    team_names = conn.execute(
        "SELECT DISTINCT team_id, team_name FROM events WHERE team_id IS NOT NULL"
    ).fetchdf()
    team_goals = (
        agg.merge(team_names, on="team_id")
           .sort_values("total_goals", ascending=False)
    )

    conn.close()

    top_teams    = team_goals.head(top_n)
    bottom_teams = team_goals.tail(top_n).sort_values("total_goals")
    all_teams    = pd.concat([top_teams, bottom_teams]).drop_duplicates("team_id")
    team_ids     = all_teams["team_id"].tolist()

    # Now get passes for those teams
    conn2 = get_conn()
    ids_str = ",".join(str(i) for i in team_ids)
    passes_raw = conn2.execute(f"""
        SELECT x, y, end_x, end_y, match_id, team_id
        FROM events
        WHERE event_type_name = 'Pass'
          AND x IS NOT NULL AND end_x IS NOT NULL
          AND team_id IN ({ids_str})
    """).fetchdf()
    conn2.close()

    passes = add_pass_type(passes_raw)

    # Pass type counts per team
    team_pass_counts = (
        passes.groupby(["team_id", "pass_type"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )

    pass_cols = [c for c in PASS_LABELS if c in team_pass_counts.columns]

    # Merge with goals
    merged = team_pass_counts.merge(
        all_teams[["team_id", "team_name", "total_goals", "matches"]],
        on="team_id",
        how="inner",
    )

    # Compute total passes per team and percentage breakdown
    merged["total_passes"] = merged[pass_cols].sum(axis=1)
    for col in pass_cols:
        merged[f"{col}_pct"] = (merged[col] / merged["total_passes"] * 100).round(1)

    rows = []
    for _, row in merged.iterrows():
        rows.append({
            "team_id":      int(row["team_id"]),
            "team_name":    row["team_name"],
            "total_goals":  int(row["total_goals"]),
            "matches":      int(row["matches"]),
            "goals_per_match": round(row["total_goals"] / max(row["matches"], 1), 2),
            "total_passes": int(row["total_passes"]),
            "pass_breakdown": {
                col: {
                    "count": int(row[col]),
                    "pct":   float(row[f"{col}_pct"]),
                    "label": PASS_LABELS[col],
                    "color": PASS_COLORS[col],
                }
                for col in pass_cols
            },
        })

    # Sort by goals_per_match (average per game, not total)
    rows.sort(key=lambda r: -r["goals_per_match"])
    top    = rows[:top_n]
    bottom = list(reversed(rows[-top_n:]))  # lowest avg first

    return {
        "top_scorers":    top,
        "bottom_scorers": bottom,
        "pass_types":     [{"key": k, "label": PASS_LABELS[k], "color": PASS_COLORS[k]} for k in pass_cols],
    }


# ─────────────────────────────────────────────
# HYPOTHESIS 3 – Corridor analysis (flanks vs centre)
# ─────────────────────────────────────────────

@app.get("/api/hypothesis/corridors")
def hypothesis_corridors():
    """
    Hypothesis 3: Pass progression through the centre is more effective
    than through the flanks in generating goals.

    Methodology:
    - Pitch width (y) divided in 3 corridors:
        Left flank:  y < 26.7 (first third of 80 yd)
        Centre:      26.7 <= y <= 53.3
        Right flank: y > 53.3
    - Progressive pass = pass with end_x > 80 (reaches final third)
    - For each team-match: count progressive passes per corridor → correlate with goals
    - Shot analysis: where shots originate based on the corridor of passes
      in the same possession
    """
    conn = get_conn()

    # 1) Corridor overview: totals, progression rate, avg movement
    corridor_stats = conn.execute("""
        SELECT
            CASE
                WHEN y < 26.7  THEN 'flanco_izq'
                WHEN y <= 53.3 THEN 'centro'
                ELSE                'flanco_der'
            END AS corridor,
            COUNT(*) AS total_passes,
            SUM(CASE WHEN end_x > 80 THEN 1 ELSE 0 END) AS progressive_to_final_third,
            SUM(CASE WHEN (end_x - x) > 0 THEN 1 ELSE 0 END) AS forward_passes,
            ROUND(AVG(end_x - x), 2) AS avg_dx,
            ROUND(AVG(SQRT((end_x-x)*(end_x-x)+(end_y-y)*(end_y-y))), 2) AS avg_distance,
            SUM(CASE WHEN end_x > 80 AND end_y BETWEEN 18 AND 62 THEN 1 ELSE 0 END) AS arrive_penalty_zone,
            SUM(CASE WHEN end_x > 80 AND end_y BETWEEN 30 AND 50 THEN 1 ELSE 0 END) AS arrive_central_channel
        FROM events
        WHERE event_type_name = 'Pass'
          AND x IS NOT NULL AND end_x IS NOT NULL
        GROUP BY 1
        ORDER BY 1
    """).fetchdf()

    # 2) Shots by possession corridor (avg y of all passes in the possession)
    shots_by_corridor = conn.execute("""
        WITH pass_avg_y AS (
            SELECT match_id, possession, team_id,
                   AVG(y) AS avg_pass_y
            FROM events
            WHERE event_type_name = 'Pass' AND y IS NOT NULL
            GROUP BY match_id, possession, team_id
        ),
        shots AS (
            SELECT match_id, possession, team_id, x AS shot_x, y AS shot_y
            FROM events
            WHERE event_type_name = 'Shot' AND x IS NOT NULL
        )
        SELECT
            CASE
                WHEN pc.avg_pass_y < 26.7  THEN 'flanco_izq'
                WHEN pc.avg_pass_y <= 53.3 THEN 'centro'
                ELSE                            'flanco_der'
            END AS pass_corridor,
            COUNT(*) AS shots,
            ROUND(AVG(s.shot_x), 2) AS avg_shot_x,
            ROUND(AVG(s.shot_y), 2) AS avg_shot_y,
            SUM(CASE WHEN s.shot_x > 100 THEN 1 ELSE 0 END) AS shots_danger_zone,
            SUM(CASE WHEN s.shot_y BETWEEN 30 AND 50 THEN 1 ELSE 0 END) AS shots_central_goal
        FROM shots s
        JOIN pass_avg_y pc
            ON s.match_id = pc.match_id
           AND s.possession = pc.possession
           AND s.team_id = pc.team_id
        GROUP BY 1
        ORDER BY shots DESC
    """).fetchdf()

    # 3) Progressive passes per corridor per team-match → correlate with goals
    prog_team_match = conn.execute("""
        SELECT
            e.match_id, e.team_id,
            SUM(CASE WHEN e.y < 26.7  AND e.end_x > 80 AND e.event_type_name='Pass' THEN 1 ELSE 0 END) AS prog_flanco_izq,
            SUM(CASE WHEN e.y BETWEEN 26.7 AND 53.3 AND e.end_x > 80 AND e.event_type_name='Pass' THEN 1 ELSE 0 END) AS prog_centro,
            SUM(CASE WHEN e.y > 53.3  AND e.end_x > 80 AND e.event_type_name='Pass' THEN 1 ELSE 0 END) AS prog_flanco_der,
            SUM(CASE WHEN e.event_type_name='Pass' THEN 1 ELSE 0 END) AS total_passes,
            SUM(CASE WHEN e.event_type_name='Shot' THEN 1 ELSE 0 END) AS total_shots
        FROM events e
        GROUP BY e.match_id, e.team_id
    """).fetchdf()

    match_goals_df = conn.execute("""
        SELECT match_id, home_team_id AS team_id, home_score AS goals FROM matches
        UNION ALL
        SELECT match_id, away_team_id, away_score FROM matches
    """).fetchdf()
    conn.close()

    merged = prog_team_match.merge(match_goals_df, on=["match_id","team_id"], how="inner")
    merged["goals"] = merged["goals"].fillna(0)
    merged["prog_flancos"] = merged["prog_flanco_izq"] + merged["prog_flanco_der"]

    # Correlations at match-team level
    corr_centro  = round(float(merged["prog_centro"].corr(merged["goals"])), 4)
    corr_flancos = round(float(merged["prog_flancos"].corr(merged["goals"])), 4)
    corr_izq     = round(float(merged["prog_flanco_izq"].corr(merged["goals"])), 4)
    corr_der     = round(float(merged["prog_flanco_der"].corr(merged["goals"])), 4)
    corr_c_shots = round(float(merged["prog_centro"].corr(merged["total_shots"])), 4)
    corr_f_shots = round(float(merged["prog_flancos"].corr(merged["total_shots"])), 4)

    # Per-team aggregation (>= 10 matches)
    team_names_df = conn.execute(
        "SELECT DISTINCT team_id, team_name FROM events WHERE team_id IS NOT NULL"
    ) if False else None

    # Use already-fetched names from prog_team_match data
    from pathlib import Path as _Path
    import duckdb as _duckdb
    _conn2 = _duckdb.connect()
    _conn2.execute("SET memory_limit='2GB'")
    _events_path = PROCESSED_DIR / "events/events_fact.parquet"
    _conn2.execute(f"CREATE VIEW events AS SELECT * FROM read_parquet('{_events_path}')")
    team_names_df = _conn2.execute(
        "SELECT DISTINCT team_id, team_name FROM events WHERE team_id IS NOT NULL"
    ).fetchdf()
    _conn2.close()

    team_agg = merged.groupby("team_id").agg(
        matches=("match_id","count"),
        avg_prog_centro=("prog_centro","mean"),
        avg_prog_flancos=("prog_flancos","mean"),
        avg_prog_izq=("prog_flanco_izq","mean"),
        avg_prog_der=("prog_flanco_der","mean"),
        avg_goals=("goals","mean"),
        avg_shots=("total_shots","mean"),
    ).reset_index()
    team_agg = team_agg.merge(team_names_df, on="team_id")
    team_agg = team_agg[team_agg["matches"] >= 10].copy()

    team_agg["pct_prog_centro"] = (
        team_agg["avg_prog_centro"]
        / (team_agg["avg_prog_centro"] + team_agg["avg_prog_flancos"]).clip(lower=0.01)
        * 100
    ).round(1)
    team_agg["avg_goals"]   = team_agg["avg_goals"].round(3)
    team_agg["avg_prog_centro"]   = team_agg["avg_prog_centro"].round(2)
    team_agg["avg_prog_flancos"]  = team_agg["avg_prog_flancos"].round(2)

    corr_team_centro  = round(float(team_agg["avg_prog_centro"].corr(team_agg["avg_goals"])), 4)
    corr_team_flancos = round(float(team_agg["avg_prog_flancos"].corr(team_agg["avg_goals"])), 4)

    # Zone breakdown: passes by origin-corridor × zone × whether they reach final third
    zone_breakdown = []
    for corridor_key, y_cond in [("flanco_izq","y < 26.7"), ("centro","y BETWEEN 26.7 AND 53.3"), ("flanco_der","y > 53.3")]:
        for zone_key, x_cond in [("defensivo","x <= 40"), ("medio","x > 40 AND x <= 80"), ("ofensivo","x > 80")]:
            row = corridor_stats  # reuse already-computed aggregated stats; just store summary
            zone_breakdown.append({
                "corridor": corridor_key,
                "zone":     zone_key,
            })

    # Clean corridor_stats for JSON
    cs = corridor_stats.copy()
    cs["progression_rate"] = (cs["progressive_to_final_third"] / cs["total_passes"] * 100).round(1)
    cs["penalty_arrival_rate"] = (cs["arrive_penalty_zone"] / cs["progressive_to_final_third"].clip(lower=1) * 100).round(1)

    return {
        "hypothesis": "Hipótesis 3: la progresión por el centro es más efectiva que por los flancos para generar goles.",
        "verdict": {
            "centre_more_effective": corr_team_centro > corr_team_flancos,
            "corr_match_centro_goals":  corr_centro,
            "corr_match_flancos_goals": corr_flancos,
            "corr_team_centro_goals":   corr_team_centro,
            "corr_team_flancos_goals":  corr_team_flancos,
            "corr_match_centro_shots":  corr_c_shots,
            "corr_match_flancos_shots": corr_f_shots,
        },
        "corridor_stats": cs.to_dict(orient="records"),
        "shots_by_corridor": shots_by_corridor.to_dict(orient="records"),
        "team_profiles": team_agg.to_dict(orient="records"),
        "model": {
            "pitch_y_range": "0–80 yards",
            "left_flank":    "y < 26.7",
            "centre":        "26.7 ≤ y ≤ 53.3",
            "right_flank":   "y > 53.3",
            "progressive":   "end_x > 80 (pase que llega al tercio final)",
        },
    }


# ─────────────────────────────────────────────
# HYPOTHESIS 2 – Counter-attack vs Possession
# ─────────────────────────────────────────────

@app.get("/api/hypothesis/counter")
def hypothesis_counter():
    """
    Hypothesis 2: Teams that build up play elaborately (high pass count per possession)
    score more goals and win more than counter-attacking teams (From Counter pattern, few passes).

    Methodology:
    - Classify each team-match by % of passes from 'From Counter' pattern
    - Compute win rate, avg goals, shots by style group
    - Analyze possession chain stats (avg passes, shot rate) per play pattern
    - Return per-team aggregated profile for scatter plot
    """
    conn = get_conn()

    # 1) Possession chain stats by play pattern (all dataset)
    chain_stats = conn.execute("""
        SELECT
            play_pattern_name,
            COUNT(DISTINCT match_id || '-' || CAST(team_id AS VARCHAR) || '-' || CAST(possession AS VARCHAR)) AS total_possessions,
            SUM(CASE WHEN event_type_name='Pass' THEN 1 ELSE 0 END) AS total_passes,
            SUM(CASE WHEN event_type_name='Shot' THEN 1 ELSE 0 END) AS total_shots,
            ROUND(SUM(CASE WHEN event_type_name='Pass' THEN 1 ELSE 0 END) * 1.0 /
                  NULLIF(COUNT(DISTINCT match_id || '-' || CAST(team_id AS VARCHAR) || '-' || CAST(possession AS VARCHAR)),0), 2) AS avg_passes,
            ROUND(SUM(CASE WHEN event_type_name='Shot' THEN 1 ELSE 0 END) * 100.0 /
                  NULLIF(COUNT(DISTINCT match_id || '-' || CAST(team_id AS VARCHAR) || '-' || CAST(possession AS VARCHAR)),0), 2) AS shot_rate_pct
        FROM events
        GROUP BY 1 ORDER BY avg_passes DESC
    """).fetchdf()

    # 2) Team-match style profile
    team_match = conn.execute("""
        SELECT
            e.match_id,
            e.team_id,
            e.team_name,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.play_pattern_name='From Counter'  THEN 1 ELSE 0 END) AS passes_counter,
            SUM(CASE WHEN e.event_type_name='Pass' AND e.play_pattern_name='Regular Play'  THEN 1 ELSE 0 END) AS passes_regular,
            SUM(CASE WHEN e.event_type_name='Pass' THEN 1 ELSE 0 END)                                         AS total_passes,
            SUM(CASE WHEN e.event_type_name='Shot' AND e.play_pattern_name='From Counter'  THEN 1 ELSE 0 END) AS shots_counter,
            SUM(CASE WHEN e.event_type_name='Shot' THEN 1 ELSE 0 END)                                         AS total_shots
        FROM events e
        GROUP BY e.match_id, e.team_id, e.team_name
    """).fetchdf()

    # 3) Match results
    match_scores = conn.execute("""
        SELECT match_id, home_team_id, away_team_id, home_score, away_score
        FROM matches
    """).fetchdf()
    conn.close()

    # Build result rows per team per match
    result_rows = []
    for _, m in match_scores.iterrows():
        for side in ["home", "away"]:
            tid = m[f"{side}_team_id"]
            my  = m[f"{side}_score"]
            opp = m["away_score" if side == "home" else "home_score"]
            result = "win" if my > opp else ("draw" if my == opp else "loss")
            result_rows.append({
                "match_id": m["match_id"], "team_id": tid,
                "my_goals": int(my), "opp_goals": int(opp), "result": result,
            })
    results_df = pd.DataFrame(result_rows)
    merged = team_match.merge(results_df, on=["match_id", "team_id"], how="inner")

    # Classify style
    merged["counter_pct"] = (
        merged["passes_counter"] / merged["total_passes"].clip(lower=1) * 100
    )
    merged["style"] = merged["counter_pct"].apply(
        lambda x: "contragolpe" if x > 5 else ("mixto" if x > 1 else "elaborado")
    )

    # 4) Win-rate by style
    style_results = (
        merged.groupby(["style", "result"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )
    # ensure all columns exist
    for col in ["win", "draw", "loss"]:
        if col not in style_results.columns:
            style_results[col] = 0
    style_results["total"] = style_results[["win", "draw", "loss"]].sum(axis=1)
    style_results["win_pct"]  = (style_results["win"]  / style_results["total"] * 100).round(1)
    style_results["draw_pct"] = (style_results["draw"] / style_results["total"] * 100).round(1)
    style_results["loss_pct"] = (style_results["loss"] / style_results["total"] * 100).round(1)
    style_results["avg_goals"] = (
        merged.groupby("style")["my_goals"].mean().round(3).values
    )
    style_results["avg_shots_counter"] = (
        merged.groupby("style")["shots_counter"].mean().round(3).values
    )
    style_results["avg_total_shots"] = (
        merged.groupby("style")["total_shots"].mean().round(3).values
    )

    # 5) Per-team aggregated profile (for scatter)
    team_profile = (
        merged.groupby(["team_id", "team_name"])
        .agg(
            matches=("match_id", "count"),
            wins=("result", lambda x: (x == "win").sum()),
            draws=("result", lambda x: (x == "draw").sum()),
            losses=("result", lambda x: (x == "loss").sum()),
            avg_counter_pct=("counter_pct", "mean"),
            avg_goals=("my_goals", "mean"),
            avg_shots_counter=("shots_counter", "mean"),
            avg_total_passes=("total_passes", "mean"),
            avg_total_shots=("total_shots", "mean"),
        )
        .reset_index()
    )
    team_profile["win_rate"] = (team_profile["wins"] / team_profile["matches"] * 100).round(1)
    # Only include teams with >= 5 matches for meaningful stats
    team_profile = team_profile[team_profile["matches"] >= 5].copy()
    team_profile["avg_counter_pct"] = team_profile["avg_counter_pct"].round(2)
    team_profile["avg_goals"]       = team_profile["avg_goals"].round(3)
    team_profile["avg_total_passes"] = team_profile["avg_total_passes"].round(1)

    # 6) Correlation counter_pct vs win_rate, goals
    corr_win  = round(float(team_profile["avg_counter_pct"].corr(team_profile["win_rate"])), 4)
    corr_goal = round(float(team_profile["avg_counter_pct"].corr(team_profile["avg_goals"])), 4)

    # 7) Counter attack efficiency: goals per counter shot vs regular shot
    total_counter_shots = int(merged["shots_counter"].sum())
    total_regular_shots = int(merged["total_shots"].sum()) - total_counter_shots
    goals_when_counter  = int(merged.loc[merged["shots_counter"] > 0, "my_goals"].sum())
    goals_when_regular  = int(merged.loc[merged["shots_counter"] == 0, "my_goals"].sum())

    return {
        "hypothesis": (
            "Hipótesis 2: Los equipos que construyen jugadas con más pases "
            "(juego elaborado) son más eficaces que los que juegan a contragolpe."
        ),
        "verdict": {
            "confirmed": corr_goal < 0,   # negative = more counter → fewer goals → hypothesis confirmed
            "corr_counter_vs_winrate": corr_win,
            "corr_counter_vs_goals":   corr_goal,
        },
        "chain_stats": chain_stats.to_dict(orient="records"),
        "style_breakdown": style_results.to_dict(orient="records"),
        "team_profiles": team_profile.to_dict(orient="records"),
        "global_counters": {
            "total_counter_shots": total_counter_shots,
            "total_regular_shots": total_regular_shots,
        },
    }


# ─────────────────────────────────────────────────────────────
# HYPOTHESIS 3 – Defensive line height vs risk/reward
# ─────────────────────────────────────────────────────────────

@app.get("/api/hypothesis/defensive-line")
def hypothesis_defensive_line():
    """
    H3: Teams that use a high defensive line generate more offensive
    opportunities but also concede more goals than teams with a low line.

    Proxy for defensive line height:
      avg_pressure_x — the average x-coordinate where a team applies
      'Pressure' events. Higher x = pressing higher up the pitch =
      higher defensive line. StatsBomb pitch: x ∈ [0,120].

    Methodology:
      1. events_fact → group by (match_id, team_id)
         → avg(x) of Pressure events, zone pressure counts, shots, passes
      2. matches_fact → derive goals scored/conceded + result per team-match
      3. Classify defensive line: alta (top third), media, baja (bottom third)
         by tertiles of avg_pressure_x
      4. Compute mean stats, win rate, correlations per group and per team
    """
    conn = get_conn()

    # ── 1) team-match defensive profile ──────────────────────────
    raw = conn.execute("""
        SELECT
            e.match_id,
            e.team_id,
            e.team_name,
            AVG(CASE WHEN event_type_name='Pressure'    AND x IS NOT NULL THEN x END) AS avg_pressure_x,
            AVG(CASE WHEN event_type_name='Clearance'   AND x IS NOT NULL THEN x END) AS avg_clearance_x,
            AVG(CASE WHEN event_type_name='Ball Recovery' AND x IS NOT NULL THEN x END) AS avg_recovery_x,
            -- pressure by zone
            SUM(CASE WHEN event_type_name='Pressure' AND x <= 40  AND x IS NOT NULL THEN 1 ELSE 0 END) AS press_def_third,
            SUM(CASE WHEN event_type_name='Pressure' AND x >  40  AND x <= 80 AND x IS NOT NULL THEN 1 ELSE 0 END) AS press_mid_third,
            SUM(CASE WHEN event_type_name='Pressure' AND x >  80  AND x IS NOT NULL THEN 1 ELSE 0 END) AS press_att_third,
            SUM(CASE WHEN event_type_name='Pressure' AND x IS NOT NULL THEN 1 ELSE 0 END) AS total_pressure,
            -- offensive
            SUM(CASE WHEN event_type_name='Shot'  THEN 1 ELSE 0 END) AS shots_for,
            SUM(CASE WHEN event_type_name='Pass'  AND end_x > 80 AND x IS NOT NULL THEN 1 ELSE 0 END) AS prog_passes,
            SUM(CASE WHEN event_type_name='Offside' THEN 1 ELSE 0 END) AS offsides_won,
            -- high-line risk: defensive actions conceded high up pitch
            SUM(CASE WHEN event_type_name IN ('Ball Recovery','Duel') AND x > 60 AND x IS NOT NULL THEN 1 ELSE 0 END) AS high_turnovers
        FROM events e
        GROUP BY e.match_id, e.team_id, e.team_name
    """).fetchdf()

    goals_df = conn.execute("""
        SELECT match_id, home_team_id AS team_id,
               home_score AS scored, away_score AS conceded
        FROM matches
        UNION ALL
        SELECT match_id, away_team_id, away_score, home_score FROM matches
    """).fetchdf()

    match_info = conn.execute(
        "SELECT match_id, home_team_id, away_team_id, home_score, away_score FROM matches"
    ).fetchdf()
    conn.close()

    m = raw.merge(goals_df, on=["match_id","team_id"], how="inner")
    m["scored"]    = m["scored"].fillna(0)
    m["conceded"]  = m["conceded"].fillna(0)
    m["pct_press_att"] = (m["press_att_third"] / m["total_pressure"].clip(lower=1) * 100).round(2)
    m["pct_press_def"] = (m["press_def_third"] / m["total_pressure"].clip(lower=1) * 100).round(2)

    # result per team-match
    result_rows = []
    for _, row in match_info.iterrows():
        for side in ["home", "away"]:
            tid = row[f"{side}_team_id"]
            s   = row[f"{side}_score"]
            c   = row["away_score" if side == "home" else "home_score"]
            result_rows.append({
                "match_id": row["match_id"],
                "team_id":  tid,
                "result":   "win" if s > c else ("draw" if s == c else "loss"),
            })
    results = pd.DataFrame(result_rows)
    m = m.merge(results, on=["match_id","team_id"], how="left")

    valid = m.dropna(subset=["avg_pressure_x"]).copy()

    # ── 2) classify by tertiles ───────────────────────────────────
    q33 = float(valid["avg_pressure_x"].quantile(0.33))
    q67 = float(valid["avg_pressure_x"].quantile(0.67))
    valid["def_line"] = valid["avg_pressure_x"].apply(
        lambda x: "alta" if x > q67 else ("media" if x > q33 else "baja")
    )

    # ── 3) group stats ───────────────────────────────────────────
    metric_cols = ["scored","conceded","shots_for","prog_passes",
                   "pct_press_att","pct_press_def","high_turnovers","offsides_won"]
    grp = valid.groupby("def_line")[metric_cols].mean().round(3).reset_index()
    grp["n"] = valid.groupby("def_line").size().values
    grp["win_rate"] = (
        valid.groupby("def_line")["result"]
        .apply(lambda x: round((x == "win").mean() * 100, 1))
        .values
    )
    grp["loss_rate"] = (
        valid.groupby("def_line")["result"]
        .apply(lambda x: round((x == "loss").mean() * 100, 1))
        .values
    )
    grp["draw_rate"] = (
        valid.groupby("def_line")["result"]
        .apply(lambda x: round((x == "draw").mean() * 100, 1))
        .values
    )

    # ── 4) match-level correlations ───────────────────────────────
    corr_match = {
        "pressure_x_vs_scored":    round(float(valid["avg_pressure_x"].corr(valid["scored"])),    4),
        "pressure_x_vs_conceded":  round(float(valid["avg_pressure_x"].corr(valid["conceded"])),  4),
        "pressure_x_vs_shots":     round(float(valid["avg_pressure_x"].corr(valid["shots_for"])), 4),
        "pressure_x_vs_turnovers": round(float(valid["avg_pressure_x"].corr(valid["high_turnovers"])), 4),
    }

    # ── 5) team-level aggregation ─────────────────────────────────
    team_agg = valid.groupby(["team_id","team_name"]).agg(
        matches=("match_id","count"),
        avg_pressure_x=("avg_pressure_x","mean"),
        avg_clearance_x=("avg_clearance_x","mean"),
        avg_scored=("scored","mean"),
        avg_conceded=("conceded","mean"),
        avg_shots=("shots_for","mean"),
        avg_prog_passes=("prog_passes","mean"),
        avg_offsides=("offsides_won","mean"),
        avg_pct_press_att=("pct_press_att","mean"),
        avg_pct_press_def=("pct_press_def","mean"),
        avg_turnovers=("high_turnovers","mean"),
    ).reset_index()
    team_agg = team_agg[team_agg["matches"] >= 10].copy()

    for col in ["avg_pressure_x","avg_clearance_x","avg_scored","avg_conceded",
                "avg_shots","avg_prog_passes","avg_offsides",
                "avg_pct_press_att","avg_pct_press_def","avg_turnovers"]:
        team_agg[col] = team_agg[col].round(3)

    # win rate per team
    team_wr = (valid.groupby(["team_id","team_name"])["result"]
               .apply(lambda x: round((x == "win").mean() * 100, 1))
               .reset_index(name="win_rate"))
    team_agg = team_agg.merge(team_wr, on=["team_id","team_name"], how="left")

    # team def_line classification
    tq33 = float(team_agg["avg_pressure_x"].quantile(0.33))
    tq67 = float(team_agg["avg_pressure_x"].quantile(0.67))
    team_agg["def_line"] = team_agg["avg_pressure_x"].apply(
        lambda x: "alta" if x > tq67 else ("media" if x > tq33 else "baja")
    )

    corr_team = {
        "pressure_x_vs_scored":   round(float(team_agg["avg_pressure_x"].corr(team_agg["avg_scored"])),   4),
        "pressure_x_vs_conceded": round(float(team_agg["avg_pressure_x"].corr(team_agg["avg_conceded"])), 4),
        "pressure_x_vs_shots":    round(float(team_agg["avg_pressure_x"].corr(team_agg["avg_shots"])),    4),
        "pressure_x_vs_winrate":  round(float(team_agg["avg_pressure_x"].corr(team_agg["win_rate"])),     4),
    }

    # ── 6) pressure x distribution for histogram ─────────────────
    hist_data = []
    for def_line_group in ["alta", "media", "baja"]:
        subset = valid[valid["def_line"] == def_line_group]["avg_pressure_x"]
        hist_data.append({
            "def_line": def_line_group,
            "min":    round(float(subset.min()),   2),
            "q25":    round(float(subset.quantile(0.25)), 2),
            "median": round(float(subset.median()), 2),
            "q75":    round(float(subset.quantile(0.75)), 2),
            "max":    round(float(subset.max()),   2),
            "mean":   round(float(subset.mean()),  2),
        })

    # hypothesis verdict
    high_conceded = float(grp[grp["def_line"] == "alta"]["conceded"].iloc[0])
    low_conceded  = float(grp[grp["def_line"] == "baja"]["conceded"].iloc[0])
    high_scored   = float(grp[grp["def_line"] == "alta"]["scored"].iloc[0])
    low_scored    = float(grp[grp["def_line"] == "baja"]["scored"].iloc[0])
    hyp_part1_confirmed = high_scored  > low_scored    # more offense ✓
    hyp_part2_confirmed = high_conceded > low_conceded  # more conceded?

    # ── 7) all match-team rows for interactive filtering ─────────
    # Keep a compact version for the frontend to filter by def_line
    match_rows = []
    for _, row in valid.iterrows():
        match_rows.append({
            "match_id":       int(row["match_id"]),
            "team_id":        int(row["team_id"]),
            "team_name":      row["team_name"],
            "avg_pressure_x": round(float(row["avg_pressure_x"]), 2),
            "def_line":       row["def_line"],
            "scored":         int(row["scored"]),
            "conceded":       int(row["conceded"]),
            "result":         row["result"] if pd.notna(row["result"]) else "unknown",
            "shots_for":      int(row["shots_for"]),
            "prog_passes":    int(row["prog_passes"]),
            "pct_press_att":  round(float(row["pct_press_att"]), 1),
            "pct_press_def":  round(float(row["pct_press_def"]), 1),
        })

    return {
        "hypothesis": (
            "H3: Los equipos con línea defensiva alta generan más oportunidades "
            "ofensivas pero también conceden más goles."
        ),
        "verdict": {
            "part1_more_offense_confirmed": hyp_part1_confirmed,
            "part2_more_conceded_confirmed": hyp_part2_confirmed,
            "fully_confirmed": hyp_part1_confirmed and hyp_part2_confirmed,
            "high_scored":    round(high_scored,   3),
            "low_scored":     round(low_scored,    3),
            "high_conceded":  round(high_conceded, 3),
            "low_conceded":   round(low_conceded,  3),
        },
        "thresholds": {
            "q33": round(q33, 1),
            "q67": round(q67, 1),
            "mean": round(float(valid["avg_pressure_x"].mean()), 1),
            "std":  round(float(valid["avg_pressure_x"].std()),  1),
        },
        "group_stats":     grp.to_dict(orient="records"),
        "corr_match":      corr_match,
        "corr_team":       corr_team,
        "team_profiles":   team_agg.to_dict(orient="records"),
        "dist_by_group":   hist_data,
        "match_rows":      match_rows,
        "model": {
            "proxy":         "avg_pressure_x — average x of Pressure events per team-match",
            "pitch_x_range": "0–120 yards (0 = own goal, 120 = opponent goal)",
            "def_line_alta":  f"avg_pressure_x > {round(q67,1)} (top tertile)",
            "def_line_media": f"{round(q33,1)} ≤ avg_pressure_x ≤ {round(q67,1)} (middle tertile)",
            "def_line_baja":  f"avg_pressure_x < {round(q33,1)} (bottom tertile)",
            "total_match_team_obs": len(valid),
            "teams_ge10_matches": len(team_agg),
        },
    }


# ─────────────────────────────────────────────
# HEATMAP endpoint – pressure density per team
# ─────────────────────────────────────────────

@app.get("/api/defensive-line/heatmap")
def defensive_line_heatmap(
    team_id: Optional[int] = None,
    match_id: Optional[int] = None,
    cell_size: int = Query(default=6, ge=3, le=15),
):
    """
    Returns a grid-based pressure heatmap for a team (or all teams).
    Each cell covers cell_size × cell_size yards.
    Pitch: x ∈ [0,120], y ∈ [0,80].
    """
    conn = get_conn()

    where_parts = ["event_type_name = 'Pressure'", "x IS NOT NULL", "y IS NOT NULL"]
    params: dict = {}
    if team_id:
        where_parts.append("team_id = $team_id")
        params["team_id"] = team_id
    if match_id:
        where_parts.append("match_id = $match_id")
        params["match_id"] = match_id

    df = conn.execute(
        f"SELECT x, y, match_id FROM events WHERE {' AND '.join(where_parts)}",
        params,
    ).fetchdf()
    conn.close()

    if df.empty:
        return {"cells": [], "max_count": 0, "total_events": 0,
                "avg_pressure_x": None, "cell_size": cell_size}

    # Build grid
    import math
    cols = math.ceil(120 / cell_size)
    rows = math.ceil(80  / cell_size)

    df["cx"] = (df["x"] // cell_size).astype(int).clip(0, cols - 1)
    df["cy"] = (df["y"] // cell_size).astype(int).clip(0, rows - 1)

    grid = df.groupby(["cx", "cy"]).size().reset_index(name="count")
    max_count = int(grid["count"].max())

    cells = [
        {
            "cx": int(r.cx), "cy": int(r.cy),
            "x0": int(r.cx * cell_size), "y0": int(r.cy * cell_size),
            "count": int(r.count),
            "intensity": round(r.count / max_count, 4) if max_count else 0,
        }
        for r in grid.itertuples()
    ]

    return {
        "cells":          cells,
        "max_count":      max_count,
        "total_events":   len(df),
        "avg_pressure_x": round(float(df["x"].mean()), 2),
        "cell_size":      cell_size,
        "grid_cols":      cols,
        "grid_rows":      rows,
    }


# ─────────────────────────────────────────────
# MATCHES endpoint – list of matches by def_line / team
# ─────────────────────────────────────────────

@app.get("/api/defensive-line/matches")
def defensive_line_matches(
    def_line: Optional[str] = None,
    team_id:  Optional[int] = None,
    limit:    int = Query(default=200, le=500),
):
    """
    Returns match rows where a team used the specified defensive line style,
    with avg_pressure_x, result, and score.
    Includes match metadata (date, competition) from matches table.
    """
    conn = get_conn()

    # Build team-match profiles with classification
    raw = conn.execute("""
        SELECT
            e.match_id, e.team_id, e.team_name,
            AVG(CASE WHEN event_type_name='Pressure' AND x IS NOT NULL THEN x END) AS avg_pressure_x,
            SUM(CASE WHEN event_type_name='Pressure' AND x >  80 AND x IS NOT NULL THEN 1 ELSE 0 END) AS press_att,
            SUM(CASE WHEN event_type_name='Pressure' AND x IS NOT NULL THEN 1 ELSE 0 END) AS total_press,
            SUM(CASE WHEN event_type_name='Shot' THEN 1 ELSE 0 END) AS shots_for
        FROM events e
        GROUP BY e.match_id, e.team_id, e.team_name
    """).fetchdf()

    goals_df = conn.execute("""
        SELECT match_id, home_team_id AS team_id, home_score AS scored, away_score AS conceded,
               match_date
        FROM matches
        UNION ALL
        SELECT match_id, away_team_id, away_score, home_score, match_date FROM matches
    """).fetchdf()

    match_meta = conn.execute("""
        SELECT m.match_id, m.match_date, m.competition_id, m.season_id,
               c.competition_name, c.country_name, c.season_name,
               m.home_score, m.away_score, m.home_team_id, m.away_team_id
        FROM matches m
        LEFT JOIN competitions c ON m.competition_id = c.competition_id
            AND m.season_id = c.season_id
    """).fetchdf()
    conn.close()

    m = raw.merge(goals_df[["match_id","team_id","scored","conceded"]], on=["match_id","team_id"], how="inner")
    m = m.merge(match_meta[["match_id","match_date","competition_name","country_name",
                              "season_name","home_score","away_score","home_team_id","away_team_id"]],
                on="match_id", how="left")

    m["scored"]   = m["scored"].fillna(0)
    m["conceded"] = m["conceded"].fillna(0)
    m["result"]   = m.apply(lambda r: "win" if r.scored > r.conceded else ("draw" if r.scored == r.conceded else "loss"), axis=1)
    m["pct_att"]  = (m["press_att"] / m["total_press"].clip(lower=1) * 100).round(1)

    # Classify
    valid = m.dropna(subset=["avg_pressure_x"]).copy()
    q33 = float(valid["avg_pressure_x"].quantile(0.33))
    q67 = float(valid["avg_pressure_x"].quantile(0.67))
    valid["def_line"] = valid["avg_pressure_x"].apply(
        lambda x: "alta" if x > q67 else ("media" if x > q33 else "baja")
    )

    # Apply filters
    if team_id:
        valid = valid[valid["team_id"] == team_id]
    if def_line and def_line in ("alta", "media", "baja"):
        valid = valid[valid["def_line"] == def_line]

    valid = valid.sort_values("avg_pressure_x", ascending=(def_line == "baja")).head(limit)

    rows = []
    for _, r in valid.iterrows():
        # Determine opponent
        is_home = r["home_team_id"] == r["team_id"]
        opp_id  = r["away_team_id"] if is_home else r["home_team_id"]
        rows.append({
            "match_id":        int(r["match_id"]),
            "match_date":      str(r["match_date"])[:10] if pd.notna(r["match_date"]) else "",
            "competition":     r["competition_name"] if pd.notna(r.get("competition_name")) else "",
            "season":          r["season_name"] if pd.notna(r.get("season_name")) else "",
            "team_id":         int(r["team_id"]),
            "team_name":       r["team_name"],
            "scored":          int(r["scored"]),
            "conceded":        int(r["conceded"]),
            "result":          r["result"],
            "avg_pressure_x":  round(float(r["avg_pressure_x"]), 1),
            "def_line":        r["def_line"],
            "pct_press_att":   float(r["pct_att"]),
            "shots_for":       int(r["shots_for"]),
        })

    return {
        "matches":    rows,
        "total":      len(rows),
        "thresholds": {"q33": round(q33,1), "q67": round(q67,1)},
    }
