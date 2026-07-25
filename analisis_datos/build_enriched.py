"""
Mergea el vector de características original (23 vars) con las nuevas
variables tácticas (espaciales, red, motifs, fases) y aplica el mismo
preprocesamiento que transformaciones.py: imputación, log1p, StandardScaler.

Output: analisis_datos/player_enriched_scaled.parquet
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / "analisis_datos"

ORIGINAL_FEATURES = [
    "shots_per90", "shots_on_target_per90", "goals_per90",
    "dribbles_per90", "dribble_success_rate",
    "carries_per90", "carry_distance_per90", "carries_final_third_per90",
    "passes_per90", "pass_completion_rate", "progressive_passes_per90",
    "crosses_per90", "through_balls_per90", "pass_switches_per90",
    "pass_length_avg", "pass_acc_under_pressure",
    "pressures_per90", "ball_recoveries_per90", "blocks_per90",
    "clearances_per90", "duels_per90", "duel_win_rate",
    "under_pressure_rate",
]

# Variables que son ratios (0-1) en las tácticas
TACTICAL_RATIO_VARS = [
    "pct_passes_def", "pct_passes_mid", "pct_passes_att",
    "pct_passes_forward", "pct_passes_backward",
    "pct_carries_def", "pct_carries_mid", "pct_carries_att",
    "pct_duels_def", "pct_duels_mid", "pct_duels_att",
    "pass_diversity", "pct_ip", "pct_op",
]

META_COLS = ["player_id", "player_name", "dominant_position", "total_minutes", "matches_played"]


def build_enriched() -> pd.DataFrame:
    print("Cargando feature vector original...")
    orig = pd.read_parquet(OUTPUT / "player_feature_vector.parquet")

    print("Cargando tactical features...")
    tact = pd.read_parquet(OUTPUT / "player_tactical_features.parquet")

    # Merge on player_id - drop tactical columns that duplicate originals
    dup_cols = [c for c in tact.columns if c in orig.columns and c != "player_id"]
    tact_clean = tact.drop(columns=dup_cols)
    merged = orig.merge(tact_clean, on="player_id", how="left")
    print(f"Merge: {len(merged):,} filas, {len(merged.columns)} columnas")

    # Identify all feature columns (numeric, non-meta, non-minute)
    exclude_names = set(META_COLS + ["player_id", "minutes", "minutes_x", "minutes_y"])
    # Start with original features (guaranteed present)
    all_features = [c for c in ORIGINAL_FEATURES if c in merged.columns]
    # Add new tactical features not already included
    for c in merged.columns:
        if c not in all_features and c not in exclude_names and merged[c].dtype in (np.float64, np.float32, np.int64, np.int32):
            all_features.append(c)
    print(f"Features totales para escalado: {len(all_features)} ({len(ORIGINAL_FEATURES)} originales + {len(all_features)-len(ORIGINAL_FEATURES)} tacticas)")
    print(f"Features totales para escalado: {len(all_features)}")

    # Fill NaN/Inf in all feature columns with 0, clip extremes
    for var in all_features:
        merged[var] = merged[var].fillna(0).replace([np.inf, -np.inf], 0)
        # Clip to reasonable range (99.9 percentile)
        q99 = merged[var].quantile(0.999)
        q01 = merged[var].quantile(0.001)
        merged[var] = merged[var].clip(q01, q99)

    X = merged[all_features].copy()

    # Log1p for skewed variables
    skew = X.skew()
    skewed_vars = skew[skew > 2.0].index.tolist()
    print(f"Variables con log1p ({len(skewed_vars)}): {skewed_vars}")
    for var in skewed_vars:
        X[var] = np.log1p(X[var].clip(0))  # clip to 0 before log1p

    # StandardScaler
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(
        scaler.fit_transform(X),
        columns=all_features,
        index=merged.index,
    )

    result = pd.concat([merged[META_COLS], X_scaled], axis=1)
    out_path = OUTPUT / "player_enriched_scaled.parquet"
    result.to_parquet(out_path, index=False)
    print(f"\nGuardado: {out_path}")
    print(f"   {len(result):,} jugadores × {len(result.columns)} columnas")

    return result


if __name__ == "__main__":
    build_enriched()
