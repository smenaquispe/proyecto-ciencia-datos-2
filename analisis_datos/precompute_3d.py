"""
Precomputa (x,y,z) del embedding DEC v2 una sola vez y los persiste a parquet.
Ahorra la PCA3 + merge en cada reinicio del backend.

Output: analisis_datos/player_dec_v2_3d.parquet
  columnas: player_id, x, y, z, cluster, m1..m8, player_name,
            dominant_position, pos_group, total_minutes, matches_played

Uso:
    python analisis_datos/precompute_3d.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / "analisis_datos"

sys.path.insert(0, str(BASE / "dashboard_final" / "backend"))
from clustering import pca3  # mismo PCA3 que el endpoint


def main():
    print("Cargando labels DEC v2 + projections metadata...")
    d = pd.read_parquet(OUTPUT / "player_dec_labels_v2.parquet")
    proj = pd.read_parquet(OUTPUT / "projections.parquet")
    meta = ["player_id", "player_name", "dominant_position", "pos_group",
            "total_minutes", "matches_played"]
    merged = d.merge(proj[meta], on="player_id", how="inner")

    z_cols = [c for c in d.columns if c.startswith("z")]
    m_cols = [c for c in d.columns if c.startswith("m")]

    print(f"  n={len(merged):,} z={len(z_cols)} memberships={len(m_cols)}")
    print("PCA3 del latente (10D -> 3D)...")
    xyz = pca3(merged[z_cols].values)

    out = merged[["player_id"]].copy()
    out["x"] = xyz[:, 0].round(6)
    out["y"] = xyz[:, 1].round(6)
    out["z"] = xyz[:, 2].round(6)
    out["cluster"] = merged["cluster"].astype(int)
    for c in m_cols:
        out[c] = merged[c].astype(float).round(6)
    for c in meta[1:]:
        out[c] = merged[c]

    pout = OUTPUT / "player_dec_v2_3d.parquet"
    out.to_parquet(pout, index=False)
    print(f"\nGuardado: {pout}  ({len(out):,} filas, {out.shape[1]} cols)")
    print(f"  Cluster sizes: {np.bincount(out['cluster']).tolist()}")

    # ponytail: self-check
    assert out[["x", "y", "z"]].notna().all().all(), "NaN en PCA3"
    assert (out[m_cols].sum(axis=1) - 1.0).abs().max() < 1e-3, "memberships no suman 1"
    print("  self-check OK")


if __name__ == "__main__":
    main()