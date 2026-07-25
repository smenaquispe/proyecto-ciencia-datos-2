"""
Construye variables tácticas para enriquecer el vector de características
antes del autoencoder: espaciales, red de pases, motifs, fases de juego.

Inspirado en "How Do Football Teams Play?" — embedding de estilo de juego.

Output: analisis_datos/player_tactical_features.parquet
"""
from __future__ import annotations

from pathlib import Path

import duckdb
import networkx as nx
import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent.parent
PROCESSED = BASE / "data" / "processed"
OUTPUT = BASE / "analisis_datos"
OUTPUT.mkdir(exist_ok=True)

MIN_MINUTES = 270
MIN_MATCHES = 3


# ─── DuckDB views ───────────────────────────────────────────────────────────

def _register_views(con: duckdb.DuckDBPyConnection) -> None:
    views: dict[str, Path] = {
        "events_fact": PROCESSED / "events/events_fact.parquet",
        "matches_fact": PROCESSED / "matches/matches_fact.parquet",
        "team_dim": PROCESSED / "dimensions/team_dim.parquet",
        "player_match_position": PROCESSED / "lineups/player_match_position_fact.parquet",
    }
    for name, path in views.items():
        if path.exists():
            con.execute(
                f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM read_parquet('{path.as_posix()}')"
            )

    # Create male_matches view (reused across queries)
    con.execute("""
        CREATE OR REPLACE VIEW male_matches AS
        SELECT DISTINCT mf.match_id
        FROM matches_fact mf
        JOIN team_dim td ON mf.home_team_id = td.team_id OR mf.away_team_id = td.team_id
        WHERE td.gender = 'male'
    """)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _classify_pass_direction(dx: float) -> str:
    if dx > 5:
        return "forward"
    if dx < -5:
        return "backward"
    return "lateral"


# ─── 1. CARACTERÍSTICAS ESPACIALES ──────────────────────────────────────────

def _build_spatial(con: duckdb.DuckDBPyConnection, player_ids: list[int]) -> pd.DataFrame:
    pid_str = ",".join(map(str, player_ids))

    # Zone definitions: thirds of the pitch
    q = f"""
    WITH player_totals AS (
        SELECT
            p.player_id,
            SUM(CASE WHEN p.to_time IS NULL THEN
                CASE p.to_period WHEN 1 THEN 45.0 WHEN 2 THEN 90.0
                                 WHEN 3 THEN 105.0 WHEN 4 THEN 120.0 ELSE 90.0 END
            ELSE (
                CAST(SPLIT_PART(p.to_time,   ':', 1) AS DOUBLE)
              + CAST(SPLIT_PART(p.to_time,   ':', 2) AS DOUBLE) / 60.0
            ) - (
                CAST(SPLIT_PART(p.from_time, ':', 1) AS DOUBLE)
              + CAST(SPLIT_PART(p.from_time, ':', 2) AS DOUBLE) / 60.0
            ) END) AS minutes
        FROM player_match_position p
        JOIN male_matches mm ON p.match_id = mm.match_id
        WHERE p.player_id IN ({pid_str})
        GROUP BY p.player_id
    ),
    -- Passes by horizontal zone (def / mid / att)
    pass_zones AS (
        SELECT
            e.player_id,
            COUNT(*) AS total_passes,
            SUM(CASE WHEN e.x < 40 THEN 1 ELSE 0 END) AS passes_def,
            SUM(CASE WHEN e.x >= 40 AND e.x < 80 THEN 1 ELSE 0 END) AS passes_mid,
            SUM(CASE WHEN e.x >= 80 THEN 1 ELSE 0 END) AS passes_att,
            SUM(CASE WHEN e.end_x - e.x > 5 THEN 1 ELSE 0 END) AS passes_forward,
            SUM(CASE WHEN e.end_x - e.x < -5 THEN 1 ELSE 0 END) AS passes_backward,
            SUM(e.end_x - e.x) AS total_progression,
            SUM(CASE WHEN e.end_x >= 80 THEN 1 ELSE 0 END) AS passes_to_final_third,
            SUM(CASE WHEN e.end_x - e.x > 5 AND e.x < 80 THEN 1 ELSE 0 END) AS progressive_passes_spatial
        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.event_type_name = 'Pass'
          AND e.player_id IN ({pid_str})
          AND e.x IS NOT NULL AND e.end_x IS NOT NULL
        GROUP BY e.player_id
    ),
    -- Carries by zone
    carry_zones AS (
        SELECT
            e.player_id,
            COUNT(*) AS total_carries,
            SUM(CASE WHEN e.x < 40 THEN 1 ELSE 0 END) AS carries_def,
            SUM(CASE WHEN e.x >= 40 AND e.x < 80 THEN 1 ELSE 0 END) AS carries_mid,
            SUM(CASE WHEN e.x >= 80 THEN 1 ELSE 0 END) AS carries_att,
            SUM(e.end_x - e.x) AS carry_progression
        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.event_type_name = 'Carry'
          AND e.player_id IN ({pid_str})
          AND e.x IS NOT NULL AND e.end_x IS NOT NULL
        GROUP BY e.player_id
    ),
    -- Duels by zone
    duel_zones AS (
        SELECT
            e.player_id,
            COUNT(*) AS total_duels,
            SUM(CASE WHEN e.x < 40 THEN 1 ELSE 0 END) AS duels_def,
            SUM(CASE WHEN e.x >= 40 AND e.x < 80 THEN 1 ELSE 0 END) AS duels_mid,
            SUM(CASE WHEN e.x >= 80 THEN 1 ELSE 0 END) AS duels_att
        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.event_type_name = 'Duel'
          AND e.player_id IN ({pid_str})
          AND e.x IS NOT NULL
        GROUP BY e.player_id
    )
    SELECT
        pt.player_id,
        pt.minutes,
        -- Pass spatial distribution
        ROUND(COALESCE(pz.passes_def  * 1.0 / NULLIF(pz.total_passes, 0), 0), 3) AS pct_passes_def,
        ROUND(COALESCE(pz.passes_mid  * 1.0 / NULLIF(pz.total_passes, 0), 0), 3) AS pct_passes_mid,
        ROUND(COALESCE(pz.passes_att  * 1.0 / NULLIF(pz.total_passes, 0), 0), 3) AS pct_passes_att,
        -- Pass direction
        ROUND(COALESCE(pz.passes_forward  * 1.0 / NULLIF(pz.total_passes, 0), 0), 3) AS pct_passes_forward,
        ROUND(COALESCE(pz.passes_backward * 1.0 / NULLIF(pz.total_passes, 0), 0), 3) AS pct_passes_backward,
        -- Progression
        ROUND(COALESCE(pz.total_progression * 1.0 / NULLIF(pz.total_passes, 0), 0), 2)   AS avg_pass_progression,
        ROUND(COALESCE(pz.passes_to_final_third * 90.0 / pt.minutes, 0), 3)               AS passes_to_final_third_per90,
        ROUND(COALESCE(pz.progressive_passes_spatial * 90.0 / pt.minutes, 0), 3)         AS progressive_passes_spatial_per90,
        -- Carry zones
        ROUND(COALESCE(cz.carries_def * 1.0 / NULLIF(cz.total_carries, 0), 0), 3) AS pct_carries_def,
        ROUND(COALESCE(cz.carries_mid * 1.0 / NULLIF(cz.total_carries, 0), 0), 3) AS pct_carries_mid,
        ROUND(COALESCE(cz.carries_att * 1.0 / NULLIF(cz.total_carries, 0), 0), 3) AS pct_carries_att,
        ROUND(COALESCE(cz.carry_progression * 1.0 / NULLIF(cz.total_carries, 0), 0), 2) AS avg_carry_progression,
        -- Duel zones
        ROUND(COALESCE(dz.duels_def * 1.0 / NULLIF(dz.total_duels, 0), 0), 3) AS pct_duels_def,
        ROUND(COALESCE(dz.duels_mid * 1.0 / NULLIF(dz.total_duels, 0), 0), 3) AS pct_duels_mid,
        ROUND(COALESCE(dz.duels_att * 1.0 / NULLIF(dz.total_duels, 0), 0), 3) AS pct_duels_att
    FROM player_totals pt
    LEFT JOIN pass_zones pz  ON pt.player_id = pz.player_id
    LEFT JOIN carry_zones cz ON pt.player_id = cz.player_id
    LEFT JOIN duel_zones dz  ON pt.player_id = dz.player_id
    """
    return con.execute(q).df()


# ─── 2. RED DE PASES ────────────────────────────────────────────────────────

def _build_network(con: duckdb.DuckDBPyConnection, player_ids: list[int]) -> pd.DataFrame:
    pid_str = ",".join(map(str, player_ids))

    # Get all pass edges per match+team
    edges = con.execute(f"""
        SELECT e.match_id, e.team_id, e.player_id, e.pass_recipient_id
        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.event_type_name = 'Pass'
          AND e.player_id IN ({pid_str})
          AND e.pass_recipient_id IS NOT NULL
    """).df()

    if edges.empty:
        cols = [
            "player_id", "degree_centrality", "eigenvector_centrality",
            "unique_recipients", "total_passes_network", "pass_diversity",
            "avg_pass_sequence_length", "participation_rate",
        ]
        return pd.DataFrame(columns=cols)

    # Aggregate per player across all matches
    player_matches = edges.groupby(["match_id", "team_id"])

    data: list[dict] = []

    for (match_id, team_id), group in player_matches:
        if len(group) < 2:
            continue
        G = nx.DiGraph()
        for _, row in group.iterrows():
            pid = int(row["player_id"])
            rid = int(row["pass_recipient_id"])
            if G.has_edge(pid, rid):
                G[pid][rid]["weight"] += 1
            else:
                G.add_edge(pid, rid, weight=1)
        n = G.number_of_nodes()
        if n == 0:
            continue
        # Degree centrality (directed)
        deg_out = G.out_degree()
        deg_in = G.in_degree()
        max_deg = n - 1 if n > 1 else 1
        for node in G.nodes():
            data.append({
                "player_id": int(node),
                "match_id": int(match_id),
                "team_id": int(team_id),
                "degree_centrality": (deg_out[node] + deg_in[node]) / (2 * max_deg),
                "num_recipients_match": deg_out[node],
                "num_senders_match": deg_in[node],
                "passes_match": deg_out[node],  # total passes by this player in this match
                "n_players_team": n,
            })

    df = pd.DataFrame(data)
    if df.empty:
        cols = [
            "player_id", "degree_centrality", "eigenvector_centrality",
            "unique_recipients", "total_passes_network", "pass_diversity",
            "avg_pass_sequence_length", "participation_rate",
        ]
        return pd.DataFrame(columns=cols)

    agg = df.groupby("player_id").agg(
        degree_centrality=("degree_centrality", "mean"),
        avg_num_recipients=("num_recipients_match", "mean"),
        avg_num_senders=("num_senders_match", "mean"),
        avg_passes=("passes_match", "mean"),
        avg_team_size=("n_players_team", "mean"),
        num_matches_network=("match_id", "nunique"),
    ).reset_index()

    # Global pass diversity per player
    total_per_player = edges.groupby("player_id")["pass_recipient_id"].agg(
        total_passes="count",
        unique_recipients="nunique",
    ).reset_index()
    # diversity = 1 - Herfindahl per player
    recipient_counts = edges.groupby(["player_id", "pass_recipient_id"]).size().reset_index(name="cnt")
    recipient_counts["p_i"] = recipient_counts.groupby("player_id")["cnt"].transform(lambda x: x / x.sum())
    diversity = recipient_counts.groupby("player_id").apply(
        lambda g: 1 - ((g["p_i"] ** 2).sum()), include_groups=False
    ).reset_index(name="pass_diversity")

    result = agg.merge(total_per_player, on="player_id", how="left")
    result = result.merge(diversity, on="player_id", how="left")

    result["unique_recipients_per90"] = (
        result["unique_recipients"] / result["num_matches_network"].clip(1) * MIN_MATCHES
    )

    return result[["player_id", "degree_centrality", "pass_diversity",
                    "unique_recipients_per90", "avg_num_recipients", "avg_num_senders"]]


# ─── 3. MOTIFS ──────────────────────────────────────────────────────────────

def _detect_motifs(seq: list[int]) -> dict[int, dict[str, int]]:
    """From a list of player_ids (touch sequence), count ABAB/ABCB/ABCD
    occurrences per player."""
    counts: dict[int, dict[str, int]] = {}
    if len(seq) < 4:
        return counts
    for i in range(len(seq) - 3):
        a, b, c, d = seq[i], seq[i + 1], seq[i + 2], seq[i + 3]
        motif: str | None = None
        if a == c and b == d and a != b:
            motif = "ABAB"
        elif a != b and b == d and a != c and c != b:
            motif = "ABCB"
        elif len({a, b, c, d}) == 4:
            motif = "ABCD"
        if motif:
            for pid in {a, b, c, d}:
                counts.setdefault(pid, {"abab": 0, "abcb": 0, "abcd": 0})[motif.lower()] += 1
    return counts


def _build_motifs(con: duckdb.DuckDBPyConnection, player_ids: list[int]) -> pd.DataFrame:
    pid_str = ",".join(map(str, player_ids))

    # Get ordered pass sequences per possession
    passes = con.execute(f"""
        SELECT e.match_id, e.possession, e.index, e.player_id, e.pass_recipient_id
        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.event_type_name = 'Pass'
          AND e.player_id IN ({pid_str})
          AND e.pass_recipient_id IS NOT NULL
          AND e.possession IS NOT NULL
        ORDER BY e.match_id, e.possession, e.index
    """).df()

    if passes.empty:
        return pd.DataFrame(columns=["player_id",
                                     "abab_per90", "abcb_per90", "abcd_per90",
                                     "total_motifs_per90"])

    # Build possession-level sequences
    seqs: list[list[int]] = []
    for (mid, poss), group in passes.groupby(["match_id", "possession"], sort=False):
        seq: list[int] = [int(group.iloc[0]["player_id"])]
        for _, row in group.iterrows():
            rid = int(row["pass_recipient_id"])
            if rid != seq[-1]:
                seq.append(rid)
        if len(seq) >= 4:
            seqs.append(seq)

    if not seqs:
        return pd.DataFrame(columns=["player_id",
                                     "abab_per90", "abcb_per90", "abcd_per90",
                                     "total_motifs_per90"])

    # Aggregate motif counts per player
    totals: dict[int, dict[str, int]] = {}
    for s in seqs:
        counts = _detect_motifs(s)
        for pid, motifs in counts.items():
            if pid not in totals:
                totals[pid] = {"abab": 0, "abcb": 0, "abcd": 0}
            for k, v in motifs.items():
                totals[pid][k] += v

    df = pd.DataFrame.from_dict(totals, orient="index")
    df.index.name = "player_id"
    df = df.reset_index()
    df["total_motifs"] = df["abab"] + df["abcb"] + df["abcd"]

    return df


# ─── 4. FASES DE JUEGO ──────────────────────────────────────────────────────

def _build_phases(con: duckdb.DuckDBPyConnection, player_ids: list[int]) -> pd.DataFrame:
    pid_str = ",".join(map(str, player_ids))

    q = f"""
    WITH player_totals AS (
        SELECT
            p.player_id,
            SUM(CASE WHEN p.to_time IS NULL THEN
                CASE p.to_period WHEN 1 THEN 45.0 WHEN 2 THEN 90.0
                                 WHEN 3 THEN 105.0 WHEN 4 THEN 120.0 ELSE 90.0 END
            ELSE (
                CAST(SPLIT_PART(p.to_time,   ':', 1) AS DOUBLE)
              + CAST(SPLIT_PART(p.to_time,   ':', 2) AS DOUBLE) / 60.0
            ) - (
                CAST(SPLIT_PART(p.from_time, ':', 1) AS DOUBLE)
              + CAST(SPLIT_PART(p.from_time, ':', 2) AS DOUBLE) / 60.0
            ) END) AS minutes
        FROM player_match_position p
        JOIN male_matches mm ON p.match_id = mm.match_id
        WHERE p.player_id IN ({pid_str})
        GROUP BY p.player_id
    ),
    phase_counts AS (
        SELECT
            e.player_id,
            COUNT(*) AS total_actions,
            SUM(CASE WHEN e.possession_team_id = e.team_id THEN 1 ELSE 0 END) AS ip_actions,
            SUM(CASE WHEN e.possession_team_id != e.team_id THEN 1 ELSE 0 END) AS op_actions,
            SUM(CASE WHEN e.counterpress = TRUE AND e.possession_team_id = e.team_id
                     THEN 1 ELSE 0 END) AS transition_off,
            SUM(CASE WHEN e.counterpress = TRUE AND e.possession_team_id != e.team_id
                     THEN 1 ELSE 0 END) AS transition_def,
            SUM(CASE WHEN e.event_type_name IN ('Pass','Carry','Dribble','Shot')
                      AND e.possession_team_id = e.team_id THEN 1 ELSE 0 END) AS offensive_ip,
            SUM(CASE WHEN e.event_type_name IN ('Pressure','Ball Recovery','Block','Clearance','Duel')
                      AND e.possession_team_id != e.team_id THEN 1 ELSE 0 END) AS defensive_op,
            SUM(CASE WHEN e.event_type_name = 'Pressure'
                      AND e.possession_team_id != e.team_id THEN 1 ELSE 0 END) AS pressures_op,
            SUM(CASE WHEN e.event_type_name = 'Ball Recovery'
                      AND e.possession_team_id != e.team_id THEN 1 ELSE 0 END) AS recoveries_op,
            SUM(CASE WHEN e.event_type_name = 'Pass'
                      AND e.possession_team_id = e.team_id THEN 1 ELSE 0 END) AS passes_ip,
            SUM(CASE WHEN e.event_type_name = 'Carry'
                      AND e.possession_team_id = e.team_id THEN 1 ELSE 0 END) AS carries_ip
        FROM events_fact e
        JOIN male_matches mm ON e.match_id = mm.match_id
        WHERE e.player_id IN ({pid_str})
          AND e.possession_team_id IS NOT NULL
        GROUP BY e.player_id
    )
    SELECT
        p.player_id,
        p.minutes,
        ROUND(COALESCE(pc.ip_actions * 1.0 / NULLIF(pc.total_actions, 0), 0), 3) AS pct_ip,
        ROUND(COALESCE(pc.op_actions * 1.0 / NULLIF(pc.total_actions, 0), 0), 3) AS pct_op,
        ROUND(COALESCE(pc.transition_off * 90.0 / p.minutes, 0), 3) AS transition_off_per90,
        ROUND(COALESCE(pc.transition_def * 90.0 / p.minutes, 0), 3) AS transition_def_per90,
        ROUND(COALESCE(pc.offensive_ip * 90.0 / p.minutes, 0), 3) AS offensive_actions_per90,
        ROUND(COALESCE(pc.defensive_op * 90.0 / p.minutes, 0), 3) AS defensive_actions_per90,
        ROUND(COALESCE(pc.pressures_op * 90.0 / p.minutes, 0), 3) AS pressures_op_per90,
        ROUND(COALESCE(pc.recoveries_op * 90.0 / p.minutes, 0), 3) AS recoveries_op_per90,
        ROUND(COALESCE(pc.passes_ip * 90.0 / p.minutes, 0), 3) AS passes_ip_per90,
        ROUND(COALESCE(pc.carries_ip * 90.0 / p.minutes, 0), 3) AS carries_ip_per90
    FROM player_totals p
    LEFT JOIN phase_counts pc ON p.player_id = pc.player_id
    """
    return con.execute(q).df()


# ─── MAIN ───────────────────────────────────────────────────────────────────

def build_tactical_features() -> pd.DataFrame:
    con = duckdb.connect()
    _register_views(con)
    con.execute("SET memory_limit='4GB'")
    con.execute("SET threads TO 4")

    # Get valid player IDs from the existing feature vector (same population)
    existing = pd.read_parquet(OUTPUT / "player_feature_vector.parquet")
    player_ids = existing["player_id"].tolist()
    print(f"Jugadores a procesar: {len(player_ids):,}")

    print("\n--- Características espaciales ---")
    spatial = _build_spatial(con, player_ids)
    print(f"  {len(spatial)} filas, {len(spatial.columns)} columnas")

    print("\n--- Red de pases ---")
    network = _build_network(con, player_ids)
    print(f"  {len(network)} filas, {len(network.columns)} columnas")

    print("\n--- Motifs ---")
    motifs = _build_motifs(con, player_ids)
    print(f"  {len(motifs)} filas, {len(motifs.columns)} columnas")

    con.close()

    print("\n--- Fases de juego ---")
    # Phases needs player minutes; rebuild connection if needed
    con2 = duckdb.connect()
    _register_views(con2)
    con2.execute("SET memory_limit='4GB'")
    phases = _build_phases(con2, player_ids)
    con2.close()
    print(f"  {len(phases)} filas, {len(phases.columns)} columnas")

    # Merge all
    result = existing[["player_id", "total_minutes"]].copy()
    for name, df in [("spatial", spatial), ("network", network),
                     ("motifs", motifs), ("phases", phases)]:
        if df.empty or "player_id" not in df.columns:
            print(f"  [WARN] {name}: vacio o sin player_id, se omite")
            continue
        # Aggregar por player_id (red y motifs pueden tener multiples filas por jugador)
        if df["player_id"].duplicated().any():
            before = len(result.columns)
            num_cols = [c for c in df.columns if c != "player_id" and df[c].dtype in (float, int)]
            df = df.groupby("player_id")[num_cols].mean().reset_index()
            print(f"  [INFO] {name}: agregado a {len(df)} filas (desde {len(df)} raw)")
        result = result.merge(df, on="player_id", how="left")
        print(f"  [OK] {name} mergeado -> {len(result.columns)} columnas totales")

    result = result.fillna(0)
    result = result.drop(columns=["minutes"], errors="ignore")

    out = OUTPUT / "player_tactical_features.parquet"
    result.to_parquet(out, index=False)
    print(f"\nGuardado: {out}")
    print(f"   {len(result):,} jugadores x {len(result.columns)} columnas")

    print(f"\nColumnas:\n{', '.join(result.columns)}")
    return result


if __name__ == "__main__":
    build_tactical_features()
