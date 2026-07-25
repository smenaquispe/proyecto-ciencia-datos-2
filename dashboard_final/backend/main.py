"""
Dashboard Final — StatsBomb Backend
API centrada en jugadores: proyecciones, clustering FCM,
perfiles históricos agregados, heatmaps y pases.
"""
from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Literal, Optional

_MEMB_RE = re.compile(r"m\d+")

import duckdb
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from clustering import fcm, pca2, pca3

BASE = Path(__file__).resolve().parent.parent.parent
PROCESSED = BASE / "data" / "processed"
ANALISIS = BASE / "analisis_datos"

FEATURES = [
    "shots_per90","shots_on_target_per90","goals_per90",
    "dribbles_per90","dribble_success_rate",
    "carries_per90","carry_distance_per90","carries_final_third_per90",
    "passes_per90","pass_completion_rate","progressive_passes_per90",
    "crosses_per90","through_balls_per90","pass_switches_per90",
    "pass_length_avg","pass_acc_under_pressure",
    "pressures_per90","ball_recoveries_per90","blocks_per90",
    "clearances_per90","duels_per90","duel_win_rate","under_pressure_rate",
]

app = FastAPI(title="StatsBomb Dashboard Final API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ─── Helpers ───────────────────────────────────────────────────────────────────

def _clean(records: list[dict]) -> list[dict]:
    return [
        {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in row.items()}
        for row in records
    ]

def df_to_records(df: pd.DataFrame) -> list[dict]:
    return _clean(df.to_dict(orient="records"))

# ─── Cached DataFrames ────────────────────────────────────────────────────────

_proj_df: pd.DataFrame | None = None
_feat_df: pd.DataFrame | None = None
_feat_scaled_df: pd.DataFrame | None = None
_emb_df: pd.DataFrame | None = None

def get_projections() -> pd.DataFrame:
    global _proj_df
    if _proj_df is None:
        _proj_df = pd.read_parquet(ANALISIS / "projections.parquet")
    return _proj_df

def get_feature_vector() -> pd.DataFrame:
    global _feat_df
    if _feat_df is None:
        _feat_df = pd.read_parquet(ANALISIS / "player_feature_vector.parquet")
    return _feat_df

def get_feature_vector_scaled() -> pd.DataFrame:
    global _feat_scaled_df
    if _feat_scaled_df is None:
        _feat_scaled_df = pd.read_parquet(ANALISIS / "player_feature_vector_scaled.parquet")
    return _feat_scaled_df

def get_embedding() -> pd.DataFrame:
    global _emb_df
    if _emb_df is None:
        path = ANALISIS / "player_embedding.parquet"
        if path.exists():
            _emb_df = pd.read_parquet(path)
        else:
            _emb_df = pd.DataFrame()
    return _emb_df

_dec_df: pd.DataFrame | None = None

def get_dec_labels() -> pd.DataFrame:
    global _dec_df
    if _dec_df is None:
        path = ANALISIS / "player_dec_labels.parquet"
        _dec_df = pd.read_parquet(path) if path.exists() else pd.DataFrame()
    return _dec_df

_dec_v2_df: pd.DataFrame | None = None

def get_dec_v2_labels() -> pd.DataFrame:
    """DEC v2 — k=8 sub-perfiles. PCA3 del latente para vista 3D."""
    global _dec_v2_df
    if _dec_v2_df is None:
        path = ANALISIS / "player_dec_labels_v2.parquet"
        _dec_v2_df = pd.read_parquet(path) if path.exists() else pd.DataFrame()
    return _dec_v2_df

_dec_v2_3d_df: pd.DataFrame | None = None

def get_dec_v2_3d() -> pd.DataFrame:
    """DEC v2 con (x,y,z) PCA3 precomputado por analisis_datos/precompute_3d.py.
    Ponytail: cero cómputo por request; fallback a PCA3 on-the-fly si falta parquet."""
    global _dec_v2_3d_df
    if _dec_v2_3d_df is None:
        path = ANALISIS / "player_dec_v2_3d.parquet"
        if path.exists():
            _dec_v2_3d_df = pd.read_parquet(path)
        else:
            _dec_v2_3d_df = pd.DataFrame()
    return _dec_v2_3d_df

# ─── DuckDB connection ────────────────────────────────────────────────────────

def get_conn() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect()
    conn.execute("SET memory_limit='4GB'")
    conn.execute("SET threads TO 4")
    views = {
        "competitions": PROCESSED / "parquet/competitions.parquet",
        "events":        PROCESSED / "events/events_fact.parquet",
        "matches":       PROCESSED / "matches/matches_fact.parquet",
        "lineups":       PROCESSED / "lineups/match_lineup_players.parquet",
        "positions":     PROCESSED / "lineups/player_match_position_fact.parquet",
        "team_dim":      PROCESSED / "dimensions/team_dim.parquet",
        "season_dim":    PROCESSED / "dimensions/season_dim.parquet",
    }
    for name, path in views.items():
        if path.exists():
            conn.execute(
                f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM read_parquet('{path.as_posix()}')"
            )
    return conn

# ─── 1. PROYECCIONES ──────────────────────────────────────────────────────────

@app.get("/api/projections")
def get_projections_endpoint(method: Literal["umap", "pca", "tsne", "mds"] = "umap"):
    d = get_projections()
    x_col, y_col = f"{method}_x", f"{method}_y"
    cols = [
        "player_id", "player_name", "dominant_position", "pos_group",
        "total_minutes", "matches_played", x_col, y_col,
    ] + FEATURES
    sub = d[cols].rename(columns={x_col: "x", y_col: "y"})
    return _clean(sub.to_dict("records"))

# ─── 2. FCM CLUSTERING ─────────────────────────────────────────────────────────

@app.get("/api/cluster/fcm")
def get_fcm_clusters(n_clusters: int = Query(default=5, ge=2, le=10)):
    d_scaled = get_feature_vector_scaled()
    d_proj = get_projections()

    # Align by player_id
    merged = d_scaled.merge(d_proj[["player_id", "pca_x", "pca_y"]], on="player_id", how="inner")
    if merged.empty:
        return {"players": [], "n_clusters": 0}

    X = merged.drop(columns=["player_id", "pca_x", "pca_y"]).select_dtypes(include=[np.number]).values
    c = min(n_clusters, len(merged))
    U, _ = fcm(X, c=c)

    clusters = U.argmax(axis=1)
    players = []
    for i, (_, row) in enumerate(merged.iterrows()):
        players.append({
            "player_id": int(row["player_id"]),
            "player_name": str(row.get("player_name", "")),
            "dominant_position": str(row.get("dominant_position", "")),
            "pos_group": str(row.get("pos_group", "")),
            "total_minutes": float(row.get("total_minutes", 0)),
            "matches_played": int(row.get("matches_played", 0)),
            "x": round(float(row["pca_x"]), 4),
            "y": round(float(row["pca_y"]), 4),
            "cluster": int(clusters[i]),
            "memberships": [round(float(v), 4) for v in U[i]],
        })

    return {"players": players, "n_clusters": c}

# ─── 2b. AE+FCM CLUSTERING ─────────────────────────────────────────────────────

@app.get("/api/cluster/aefcm")
def get_aefcm_clusters(n_clusters: int = Query(default=5, ge=2, le=10)):
    d_emb = get_embedding()
    if d_emb.empty:
        return {"players": [], "n_clusters": 0}
    d_proj = get_projections()

    meta_cols = ["player_id", "player_name", "dominant_position", "pos_group",
                 "total_minutes", "matches_played"]
    merged = d_emb.merge(d_proj[meta_cols], on="player_id", how="inner")
    if merged.empty:
        return {"players": [], "n_clusters": 0}

    emb_cols = [c for c in d_emb.columns if c.startswith("z")]
    Z = merged[emb_cols].values
    xy = pca2(Z)
    c = min(n_clusters, len(merged))
    U, _ = fcm(Z, c=c)

    clusters = U.argmax(axis=1)
    players = []
    for i, (_, row) in enumerate(merged.iterrows()):
        players.append({
            "player_id": int(row["player_id"]),
            "player_name": str(row.get("player_name", "")),
            "dominant_position": str(row.get("dominant_position", "")),
            "pos_group": str(row.get("pos_group", "")),
            "total_minutes": float(row.get("total_minutes", 0)),
            "matches_played": int(row.get("matches_played", 0)),
            "x": round(float(xy[i, 0]), 4),
            "y": round(float(xy[i, 1]), 4),
            "cluster": int(clusters[i]),
            "memberships": [round(float(v), 4) for v in U[i]],
        })

    return {"players": players, "n_clusters": c}

# ─── 2c. DEC CLUSTERING (Demir 2026) ──────────────────────────────────────────
# Labels precomputados por analisis_datos/dec_embedding.py (AE pretrain + KL).
# K fijo (=4) en entrenamiento; n_clusters aquí se ignora, sólo se reporta.

@app.get("/api/cluster/dec")
def get_dec_clusters():
    d = get_dec_labels()
    if d.empty:
        return {"players": [], "n_clusters": 0}
    d_proj = get_projections()
    meta = ["player_id", "player_name", "dominant_position", "pos_group",
            "total_minutes", "matches_played"]
    merged = d.merge(d_proj[meta], on="player_id", how="inner")
    if merged.empty:
        return {"players": [], "n_clusters": 0}

    z_cols = [c for c in d.columns if c.startswith("z")]
    m_cols = [c for c in d.columns if c.startswith("m")]
    xy = pca2(merged[z_cols].values)
    players = []
    for i, (_, row) in enumerate(merged.iterrows()):
        players.append({
            "player_id": int(row["player_id"]),
            "player_name": str(row.get("player_name", "")),
            "dominant_position": str(row.get("dominant_position", "")),
            "pos_group": str(row.get("pos_group", "")),
            "total_minutes": float(row.get("total_minutes", 0)),
            "matches_played": int(row.get("matches_played", 0)),
            "x": round(float(xy[i, 0]), 4),
            "y": round(float(xy[i, 1]), 4),
            "cluster": int(row["cluster"]),
            "memberships": [round(float(row[c]), 4) for c in m_cols],
        })
    return {"players": players, "n_clusters": len(m_cols)}

# ─── 2d. DEC v2 CLUSTERING (k=8 sub-perfiles, vista 3D) ────────────────────────

@app.get("/api/cluster/decv2")
def get_dec_v2_clusters():
    # Camino rápido: PCA3 precomputado por analisis_datos/precompute_3d.py
    pre = get_dec_v2_3d()
    if not pre.empty:
        m_cols = [c for c in pre.columns if _MEMB_RE.fullmatch(c)]
        players = []
        for _, row in pre.iterrows():
            players.append({
                "player_id": int(row["player_id"]),
                "player_name": str(row.get("player_name", "")),
                "dominant_position": str(row.get("dominant_position", "")),
                "pos_group": str(row.get("pos_group", "")),
                "total_minutes": float(row.get("total_minutes", 0)),
                "matches_played": int(row.get("matches_played", 0)),
                "x": float(row["x"]),
                "y": float(row["y"]),
                "z": float(row["z"]),
                "cluster": int(row["cluster"]),
                "memberships": [float(row[c]) for c in m_cols],
            })
        return {"players": players, "n_clusters": len(m_cols)}

    # Fallback on-the-fly si falta el parquet precomputado
    d = get_dec_v2_labels()
    if d.empty:
        return {"players": [], "n_clusters": 0}
    d_proj = get_projections()
    meta = ["player_id", "player_name", "dominant_position", "pos_group",
            "total_minutes", "matches_played"]
    merged = d.merge(d_proj[meta], on="player_id", how="inner")
    if merged.empty:
        return {"players": [], "n_clusters": 0}

    z_cols = [c for c in d.columns if c.startswith("z")]
    m_cols = [c for c in d.columns if c.startswith("m")]
    xyz = pca3(merged[z_cols].values)
    players = []
    for i, (_, row) in enumerate(merged.iterrows()):
        players.append({
            "player_id": int(row["player_id"]),
            "player_name": str(row.get("player_name", "")),
            "dominant_position": str(row.get("dominant_position", "")),
            "pos_group": str(row.get("pos_group", "")),
            "total_minutes": float(row.get("total_minutes", 0)),
            "matches_played": int(row.get("matches_played", 0)),
            "x": round(float(xyz[i, 0]), 4),
            "y": round(float(xyz[i, 1]), 4),
            "z": round(float(xyz[i, 2]), 4),
            "cluster": int(row["cluster"]),
            "memberships": [round(float(row[c]), 4) for c in m_cols],
        })
    return {"players": players, "n_clusters": len(m_cols)}

# ─── 3. JUGADORES ─────────────────────────────────────────────────────────────

@app.get("/api/players")
def list_players(search: Optional[str] = None, pos_group: Optional[str] = None):
    d = get_projections()
    if search:
        d = d[d["player_name"].str.contains(search, case=False, na=False)]
    if pos_group:
        d = d[d["pos_group"] == pos_group.upper()]
    cols = ["player_id", "player_name", "dominant_position", "pos_group", "total_minutes", "matches_played"]
    return _clean(d[cols].to_dict("records"))

# ─── 4. HISTORIAL DE PARTIDOS ─────────────────────────────────────────────────

@app.get("/api/players/{player_id}/matches")
def get_player_matches(player_id: int):
    conn = get_conn()
    df = conn.execute("""
        SELECT DISTINCT
            m.match_id,
            m.match_date,
            e.team_id,
            m.home_team_id,
            m.away_team_id,
            t.team_name,
            ht.team_name AS home_team_name,
            awt.team_name AS away_team_name,
            m.home_score,
            m.away_score,
            c.competition_name,
            c.season_name
        FROM events e
        JOIN matches m ON e.match_id = m.match_id
        LEFT JOIN team_dim t ON e.team_id = t.team_id
        LEFT JOIN team_dim ht ON m.home_team_id = ht.team_id
        LEFT JOIN team_dim awt ON m.away_team_id = awt.team_id
        LEFT JOIN competitions c ON m.competition_id = c.competition_id AND m.season_id = c.season_id
        WHERE e.player_id = $pid
        ORDER BY m.match_date DESC
    """, {"pid": player_id}).fetchdf()
    conn.close()

    # Compute opponent and score in Python
    records = []
    for _, r in df.iterrows():
        is_home = int(r["team_id"]) == int(r["home_team_id"])
        opp_name = str(r["away_team_name"] or "") if is_home else str(r["home_team_name"] or "")
        team_score = int(r["home_score"]) if is_home else int(r["away_score"])
        opp_score = int(r["away_score"]) if is_home else int(r["home_score"])
        records.append({
            "match_id": int(r["match_id"]),
            "match_date": str(r["match_date"])[:10],
            "team_id": int(r["team_id"]),
            "team_name": str(r["team_name"] or ""),
            "opponent_name": opp_name,
            "team_score": team_score,
            "opponent_score": opp_score,
            "competition_name": str(r["competition_name"] or ""),
            "season_name": str(r["season_name"] or ""),
        })

    return {"matches": records}

# ─── 5. PERFIL AGREGADO ───────────────────────────────────────────────────────

@app.get("/api/players/{player_id}/profile")
def get_player_profile(player_id: int, limit: str = "all"):
    if limit == "all":
        d = get_projections()
        row = d[d["player_id"] == player_id]
        if row.empty:
            return {"player": None}
        return {"player": _clean(row.to_dict("records"))[0]}

    n = int(limit)
    conn = get_conn()
    df = conn.execute("""
        WITH player_matches AS (
            SELECT DISTINCT e.match_id
            FROM events e
            JOIN matches m ON e.match_id = m.match_id
            WHERE e.player_id = $pid
            ORDER BY m.match_date DESC
            LIMIT $n
        )
        SELECT
            COUNT(*) AS total_events,
            SUM(CASE WHEN e.event_type_name = 'Pass' THEN 1 ELSE 0 END) AS total_passes,
            SUM(CASE WHEN e.event_type_name = 'Pass' AND e.pass_outcome IS NULL THEN 1 ELSE 0 END) AS completed_passes,
            ROUND(AVG(CASE WHEN e.event_type_name = 'Pass' THEN e.pass_length END), 2) AS avg_pass_length,
            SUM(CASE WHEN e.event_type_name = 'Shot' THEN 1 ELSE 0 END) AS total_shots,
            SUM(CASE WHEN e.event_type_name = 'Shot' AND e.shot_outcome IN ('Goal','Saved','Saved To Post') THEN 1 ELSE 0 END) AS shots_on_target,
            SUM(CASE WHEN e.event_type_name = 'Shot' AND e.shot_outcome = 'Goal' THEN 1 ELSE 0 END) AS goals,
            SUM(CASE WHEN e.event_type_name = 'Duel' THEN 1 ELSE 0 END) AS total_duels,
            SUM(CASE WHEN e.event_type_name = 'Dribble' THEN 1 ELSE 0 END) AS won_duels,
            SUM(CASE WHEN e.event_type_name = 'Pressure' THEN 1 ELSE 0 END) AS total_pressures,
            SUM(CASE WHEN e.event_type_name = 'Carry' THEN 1 ELSE 0 END) AS total_carries,
            COUNT(DISTINCT e.match_id) AS matches_played
        FROM events e
        JOIN player_matches pm ON e.match_id = pm.match_id
        WHERE e.player_id = $pid
    """, {"pid": player_id, "n": n}).fetchdf()
    conn.close()

    if df.empty or df["total_events"].iloc[0] == 0:
        return {"player": None}

    r = df.iloc[0]
    tp = int(r["total_passes"])
    cp = int(r["completed_passes"])
    ts = int(r["total_shots"])
    td = int(r["total_duels"])
    wd = int(r["won_duels"])
    mp = int(r["matches_played"])

    player_info = get_projections()
    info = player_info[player_info["player_id"] == player_id]
    pname = info["player_name"].iloc[0] if not info.empty else ""

    return {"player": _clean([{
        "player_id": player_id,
        "player_name": pname,
        "matches_played": mp,
        "total_events": int(r["total_events"]),
        "passes": {"total": tp, "completed": cp, "completion_rate": round(cp / tp * 10, 2) if tp else 0},
        "shots": {"total": ts, "on_target": int(r["shots_on_target"]), "goals": int(r["goals"])},
        "duels": {"total": td, "won": wd, "win_rate": round(wd / td * 10, 2) if td else 0},
        "pressures": int(r["total_pressures"]),
        "carries": int(r["total_carries"]),
        "avg_pass_length": float(r["avg_pass_length"]) if r["avg_pass_length"] else 0,
    }])[0]}

# ─── 6. HEATMAP AGREGADO ──────────────────────────────────────────────────────

@app.get("/api/players/{player_id}/heatmap")
def get_player_heatmap(
    player_id: int,
    limit: str = "all",
    cell_size: int = 5,
):
    conn = get_conn()
    if limit == "all":
        df = conn.execute("""
            SELECT x, y
            FROM events
            WHERE player_id = $pid
              AND x IS NOT NULL AND y IS NOT NULL
        """, {"pid": player_id}).fetchdf()
    else:
        n = int(limit)
        df = conn.execute("""
            WITH player_matches AS (
                SELECT DISTINCT e.match_id
                FROM events e
                JOIN matches m ON e.match_id = m.match_id
                WHERE e.player_id = $pid
                ORDER BY m.match_date DESC
                LIMIT $n
            )
            SELECT e.x, e.y
            FROM events e
            JOIN player_matches pm ON e.match_id = pm.match_id
            WHERE e.player_id = $pid AND e.x IS NOT NULL AND e.y IS NOT NULL
        """, {"pid": player_id, "n": n}).fetchdf()
    conn.close()

    if df.empty:
        return {"cells": [], "max_count": 0, "total_events": 0, "cell_size": cell_size}

    cols_n = math.ceil(120 / cell_size)
    rows_n = math.ceil(80 / cell_size)
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
        "cells": cells,
        "max_count": max_count,
        "total_events": len(df),
        "cell_size": cell_size,
    }

# ─── 7. RED DE PASES AGREGADA ─────────────────────────────────────────────────

def _classify_pass(dx: float, dy: float) -> str:
    adx, ady = abs(dx), abs(dy)
    if adx < 3 and ady < 3:
        return "short"
    if adx > 10 and adx >= ady * 1.2:
        return "forward_vertical" if dx > 0 else "back_vertical"
    if ady > 8 and ady > adx:
        return "lateral"
    if adx >= ady:
        return "diagonal_forward" if dx > 0 else "diagonal_back"
    return "lateral_short"

@app.get("/api/players/{player_id}/pass-network")
def get_player_pass_network(player_id: int, limit: str = "all"):
    conn = get_conn()
    if limit == "all":
        df = conn.execute("""
            SELECT x, y, end_x, end_y, pass_length, pass_outcome,
                   pass_switch, pass_cross, pass_through_ball,
                   under_pressure, pass_angle, pass_height, pass_body_part,
                   pass_recipient_name, minute, second, event_id,
                   possession, duration, play_pattern_name
            FROM events
            WHERE player_id = $pid
              AND event_type_name = 'Pass'
              AND x IS NOT NULL AND end_x IS NOT NULL
        """, {"pid": player_id}).fetchdf()
    else:
        n = int(limit)
        df = conn.execute("""
            WITH player_matches AS (
                SELECT DISTINCT e.match_id
                FROM events e
                JOIN matches m ON e.match_id = m.match_id
                WHERE e.player_id = $pid
                ORDER BY m.match_date DESC
                LIMIT $n
            )
            SELECT e.x, e.y, e.end_x, e.end_y, e.pass_length, e.pass_outcome,
                   e.pass_switch, e.pass_cross, e.pass_through_ball,
                   e.under_pressure, e.pass_angle, e.pass_height, e.pass_body_part,
                   e.pass_recipient_name, e.minute, e.second, e.event_id,
                   e.possession, e.duration, e.play_pattern_name
            FROM events e
            JOIN player_matches pm ON e.match_id = pm.match_id
            WHERE e.player_id = $pid
              AND e.event_type_name = 'Pass'
              AND e.x IS NOT NULL AND e.end_x IS NOT NULL
        """, {"pid": player_id, "n": n}).fetchdf()
    conn.close()

    if df.empty:
        return {"passes": [], "total": 0}

    df["dx"] = df["end_x"] - df["x"]
    df["dy"] = df["end_y"] - df["y"]
    df["distance"] = np.sqrt(df["dx"]**2 + df["dy"]**2).round(2)
    df["forward"] = df["dx"] > 0
    df["pass_type"] = df.apply(lambda r: _classify_pass(r["dx"], r["dy"]), axis=1)
    df["completed"] = df["pass_outcome"].isna()

    records = df.to_dict(orient="records")
    cleaned = [
        {k: (None if (isinstance(v, float) and np.isnan(v)) else v) for k, v in row.items()}
        for row in records
    ]

    return {"passes": cleaned, "total": len(df)}

# ─── 8. COMPARACIÓN DE GRUPO ──────────────────────────────────────────────────

class CompareRequest(BaseModel):
    player_ids: list[int]
    limit: str = "all"

@app.post("/api/players/compare")
def compare_players(req: CompareRequest):
    if not req.player_ids:
        return {"players": []}

    limit = req.limit
    results = []

    if limit == "all":
        proj = get_projections()
        for pid in req.player_ids:
            row = proj[proj["player_id"] == pid]
            if row.empty:
                continue
            r = row.iloc[0]
            results.append({
                "player_id": int(r["player_id"]),
                "player_name": str(r["player_name"]),
                "dominant_position": str(r["dominant_position"]),
                "pos_group": str(r["pos_group"]),
                "matches_played": int(r["matches_played"]),
                "total_minutes": float(r["total_minutes"]),
                **{f: float(r[f]) if pd.notna(r[f]) else 0 for f in FEATURES},
            })
    else:
        n = int(limit)
        conn = get_conn()
        for pid in req.player_ids:
            df = conn.execute("""
                WITH player_matches AS (
                    SELECT DISTINCT e.match_id
                    FROM events e
                    JOIN matches m ON e.match_id = m.match_id
                    WHERE e.player_id = $pid
                    ORDER BY m.match_date DESC
                    LIMIT $n
                )
                SELECT
                    COUNT(DISTINCT e.match_id) AS matches_played,
                    COUNT(*) AS total_events,
                    SUM(CASE WHEN e.event_type_name = 'Pass' THEN 1 ELSE 0 END) AS total_passes,
                    SUM(CASE WHEN e.event_type_name = 'Pass' AND e.pass_outcome IS NULL THEN 1 ELSE 0 END) AS completed_passes,
                    SUM(CASE WHEN e.event_type_name = 'Shot' THEN 1 ELSE 0 END) AS total_shots,
                    SUM(CASE WHEN e.event_type_name = 'Shot' AND e.shot_outcome = 'Goal' THEN 1 ELSE 0 END) AS goals,
                    SUM(CASE WHEN e.event_type_name = 'Duel' THEN 1 ELSE 0 END) AS total_duels,
                    SUM(CASE WHEN e.event_type_name = 'Dribble' THEN 1 ELSE 0 END) AS won_duels
                FROM events e
                JOIN player_matches pm ON e.match_id = pm.match_id
                WHERE e.player_id = $pid
            """, {"pid": pid, "n": n}).fetchdf()
            if df.empty:
                continue
            r = df.iloc[0]
            results.append({
                "player_id": pid,
                "matches_played": int(r["matches_played"]),
                "total_events": int(r["total_events"]),
                "total_passes": int(r["total_passes"]),
                "completed_passes": int(r["completed_passes"]),
                "total_shots": int(r["total_shots"]),
                "goals": int(r["goals"]),
                "total_duels": int(r["total_duels"]),
                "won_duels": int(r["won_duels"]),
            })
        conn.close()

    return {"players": results}

# ─── 9. GOLES (coordenadas) ──────────────────────────────────────────────────

@app.get("/api/players/{player_id}/goals")
def get_player_goals(player_id: int, limit: str = "all"):
    conn = get_conn()
    if limit == "all":
        df = conn.execute("""
            SELECT e.x, e.y, e.end_x, e.end_y, e.minute, e.second,
                   e.match_id, e.shot_outcome,
                   m.match_date, c.competition_name
            FROM events e
            LEFT JOIN matches m ON e.match_id = m.match_id
            LEFT JOIN competitions c ON m.competition_id = c.competition_id AND m.season_id = c.season_id
            WHERE e.player_id = $pid
              AND e.event_type_name = 'Shot'
              AND e.shot_outcome = 'Goal'
              AND e.x IS NOT NULL AND e.y IS NOT NULL
            ORDER BY m.match_date DESC, e.minute
        """, {"pid": player_id}).fetchdf()
    else:
        n = int(limit)
        df = conn.execute("""
            WITH player_matches AS (
                SELECT DISTINCT e.match_id
                FROM events e
                JOIN matches m ON e.match_id = m.match_id
                WHERE e.player_id = $pid
                ORDER BY m.match_date DESC
                LIMIT $n
            )
            SELECT e.x, e.y, e.end_x, e.end_y, e.minute, e.second,
                   e.match_id, e.shot_outcome
            FROM events e
            JOIN player_matches pm ON e.match_id = pm.match_id
            WHERE e.player_id = $pid
              AND e.event_type_name = 'Shot'
              AND e.shot_outcome = 'Goal'
              AND e.x IS NOT NULL AND e.y IS NOT NULL
            ORDER BY e.minute
        """, {"pid": player_id, "n": n}).fetchdf()
    conn.close()
    if df.empty:
        return {"goals": [], "total": 0}
    return {"goals": df_to_records(df), "total": len(df)}


# ─── 10. ASISTENCIAS (pases previos a gol) ────────────────────────────────────

@app.get("/api/players/{player_id}/assists")
def get_player_assists(player_id: int, limit: str = "all"):
    conn = get_conn()
    if limit == "all":
        df = conn.execute("""
            WITH shots AS (
                SELECT e.event_id, e.match_id, e.index AS shot_index,
                       e.x AS shot_x, e.y AS shot_y, e.minute, e.second
                FROM events e
                WHERE e.event_type_name = 'Shot'
                  AND e.shot_outcome = 'Goal'
                  AND e.player_id = $pid
            ),
            assists AS (
                SELECT p.x, p.y, p.end_x, p.end_y, p.minute, p.second,
                       p.match_id, p.pass_recipient_name,
                       s.shot_x, s.shot_y
                FROM events p
                JOIN shots s ON p.match_id = s.match_id
                  AND p.index BETWEEN s.shot_index - 3 AND s.shot_index - 1
                WHERE p.player_id = $pid
                  AND p.event_type_name = 'Pass'
                  AND p.pass_outcome IS NULL
                  AND p.x IS NOT NULL AND p.y IS NOT NULL
            )
            SELECT * FROM assists
            ORDER BY minute
        """, {"pid": player_id}).fetchdf()
    else:
        n = int(limit)
        df = conn.execute("""
            WITH player_matches AS (
                SELECT DISTINCT e.match_id
                FROM events e
                JOIN matches m ON e.match_id = m.match_id
                WHERE e.player_id = $pid
                ORDER BY m.match_date DESC
                LIMIT $n
            ),
            shots AS (
                SELECT e.event_id, e.match_id, e.index AS shot_index,
                       e.x AS shot_x, e.y AS shot_y, e.minute, e.second
                FROM events e
                JOIN player_matches pm ON e.match_id = pm.match_id
                WHERE e.event_type_name = 'Shot'
                  AND e.shot_outcome = 'Goal'
                  AND e.player_id = $pid
            ),
            assists AS (
                SELECT p.x, p.y, p.end_x, p.end_y, p.minute, p.second,
                       p.match_id, p.pass_recipient_name,
                       s.shot_x, s.shot_y
                FROM events p
                JOIN player_matches pm ON p.match_id = pm.match_id
                JOIN shots s ON p.match_id = s.match_id
                  AND p.index BETWEEN s.shot_index - 3 AND s.shot_index - 1
                WHERE p.player_id = $pid
                  AND p.event_type_name = 'Pass'
                  AND p.pass_outcome IS NULL
                  AND p.x IS NOT NULL AND p.y IS NOT NULL
            )
            SELECT * FROM assists
            ORDER BY minute
        """, {"pid": player_id, "n": n}).fetchdf()
    conn.close()
    if df.empty:
        return {"assists": [], "total": 0}
    return {"assists": df_to_records(df), "total": len(df)}


# ─── 11. PRESIÓN DEFENSIVA ────────────────────────────────────────────────────

@app.get("/api/players/{player_id}/defensive-pressure")
def get_player_defensive_pressure(player_id: int, limit: str = "all"):
    conn = get_conn()
    if limit == "all":
        df = conn.execute("""
            SELECT e.x, e.y, e.minute, e.second, e.match_id,
                   e.counterpress
            FROM events e
            WHERE e.player_id = $pid
              AND e.event_type_name = 'Pressure'
              AND e.x IS NOT NULL AND e.y IS NOT NULL
            ORDER BY e.minute
        """, {"pid": player_id}).fetchdf()
    else:
        n = int(limit)
        df = conn.execute("""
            WITH player_matches AS (
                SELECT DISTINCT e.match_id
                FROM events e
                JOIN matches m ON e.match_id = m.match_id
                WHERE e.player_id = $pid
                ORDER BY m.match_date DESC
                LIMIT $n
            )
            SELECT e.x, e.y, e.minute, e.second, e.match_id,
                   e.counterpress
            FROM events e
            JOIN player_matches pm ON e.match_id = pm.match_id
            WHERE e.player_id = $pid
              AND e.event_type_name = 'Pressure'
              AND e.x IS NOT NULL AND e.y IS NOT NULL
            ORDER BY e.minute
        """, {"pid": player_id, "n": n}).fetchdf()
    conn.close()
    if df.empty:
        return {"pressures": [], "total": 0}
    return {"pressures": df_to_records(df), "total": len(df)}


# ─── 12. JUGADAS IMPORTANTES (top por peso táctico) ─────────────────────────────
# ponytail: peso = CASE WHEN; StatsBomb no expone "key_pass" column directa, así
# que passthrough/cross/switch + Pression+counterpress + ball recovery + shots.
# upgrade: añadir shield.play_pattern / 360 frame context si hace falta escenario.

_KEY_ACTIONS_SQL_ALL = """
    WITH w AS (
        SELECT e.event_id, e.match_id, e.index AS ev_index, e.minute, e.second,
               e.event_type_name, e.shot_outcome, e.x, e.y, e.end_x, e.end_y,
               e.pass_recipient_name, e.pass_through_ball, e.pass_cross,
               e.pass_switch, e.counterpress, e.team_name AS pteam,
               CASE
                 WHEN e.event_type_name = 'Shot' AND e.shot_outcome = 'Goal' THEN 5
                 WHEN e.event_type_name = 'Shot'
                      AND e.shot_outcome IN ('Saved','Saved To Post','Saved Towards Goal') THEN 3
                 WHEN e.event_type_name = 'Shot' THEN 1
                 WHEN e.event_type_name = 'Ball Recovery' THEN 3
                 WHEN e.event_type_name = 'Interception' THEN 3
                 WHEN e.event_type_name = 'Pressure' AND e.counterpress = TRUE THEN 3
                 WHEN e.event_type_name = 'Pass' AND e.pass_through_ball = TRUE THEN 3
                 WHEN e.event_type_name = 'Pass' AND e.pass_cross = TRUE THEN 2
                 WHEN e.event_type_name = 'Pass' AND e.pass_switch = TRUE THEN 2
                 WHEN e.event_type_name = 'Clearance' THEN 2
                 WHEN e.event_type_name = 'Block' THEN 2
                 ELSE 0
               END AS weight
        FROM events e
        WHERE e.player_id = $pid
    )
    SELECT w.weight, w.match_id, w.ev_index, w.minute, w.second,
           w.event_type_name, w.shot_outcome, w.x, w.y, w.end_x, w.end_y,
           w.pass_recipient_name, w.pass_through_ball, w.pass_cross,
           w.pass_switch, w.counterpress, w.pteam,
           m.match_date, m.home_team_id AS home_id, m.away_team_id AS away_id,
           m.home_score, m.away_score,
           th.team_name AS home_team, ta.team_name AS away_team,
           c.competition_name, sd.season_name
    FROM w
    JOIN matches m ON w.match_id = m.match_id
    LEFT JOIN team_dim th ON m.home_team_id = th.team_id
    LEFT JOIN team_dim ta ON m.away_team_id = ta.team_id
    LEFT JOIN competitions c ON m.competition_id = c.competition_id
                              AND m.season_id = c.season_id
    LEFT JOIN season_dim sd ON m.season_id = sd.season_id
    WHERE w.weight >= 2
    ORDER BY w.weight DESC, m.match_date DESC, w.minute
    LIMIT $n
"""

_KEY_ACTIONS_SQL_N = """
    WITH player_matches AS (
        SELECT DISTINCT e.match_id
        FROM events e
        JOIN matches m ON e.match_id = m.match_id
        WHERE e.player_id = $pid
        ORDER BY m.match_date DESC
        LIMIT $n
    )
"""  # ponytail: para modo limit, el filtrado de top-N se hace tras memory

@app.get("/api/players/{player_id}/key-actions")
def get_player_key_actions(player_id: int, limit: str = "all", n: int = Query(default=20, ge=5, le=80)):
    conn = get_conn()
    top_n = n if limit == "all" else n
    sql = _KEY_ACTIONS_SQL_ALL.replace("$n", str(top_n))
    df = conn.execute(sql, {"pid": player_id}).fetchdf()
    conn.close()
    if df.empty:
        return {"actions": [], "total": 0}

    # Construir scoreline legible relativo al equipo del jugador
    def _score(home_id, away_id, pt_id, hs, as_):
        # jugador juega para pteam name; derivamos side por home/away id == pteam name... fallback hs-as
        return f"{int(hs)}-{int(as_)}"
    df["score"] = df.apply(lambda r: _score(r["home_id"], r["away_id"], r["pteam"], r["home_score"], r["away_score"]), axis=1)
    df["opponent"] = df.apply(
        lambda r: r["away_team"] if r["pteam"] == r["home_team"] else r["home_team"], axis=1)

    keep = ["weight","match_id","ev_index","minute","second","event_type_name",
            "shot_outcome","x","y","end_x","end_y","pass_recipient_name",
            "pass_through_ball","pass_cross","pass_switch","counterpress",
            "pteam","match_date","home_team","away_team","home_score","away_score",
            "score","opponent","competition_name","season_name"]
    return {"actions": df_to_records(df[keep]), "total": len(df)}


# ─── HEALTH ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
