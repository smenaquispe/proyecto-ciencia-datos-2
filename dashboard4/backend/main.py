"""Dashboard 4 — Reducción de dimensionalidad. Puerto 8004."""
from pathlib import Path
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sklearn.neighbors import NearestNeighbors

BASE    = Path(__file__).resolve().parent.parent.parent
PARQUET = BASE / "analisis_datos" / "projections.parquet"

FEATURES = [
    "shots_per90","shots_on_target_per90","goals_per90",
    "dribbles_per90","dribble_success_rate",
    "carries_per90","carry_distance_per90","carries_final_third_per90",
    "passes_per90","pass_completion_rate","progressive_passes_per90",
    "crosses_per90","through_balls_per90","pass_switches_per90",
    "pass_length_avg","pass_acc_under_pressure",
    "pressures_per90","ball_recoveries_per90","blocks_per90",
    "clearances_per90","duels_per90","duel_win_rate",
    "under_pressure_rate",
]

app = FastAPI(title="Dashboard 4 — Reducción de Dimensionalidad")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

_df: pd.DataFrame | None = None

def _load() -> pd.DataFrame:
    global _df
    if _df is None:
        _df = pd.read_parquet(PARQUET)
    return _df

def _clean(records: list[dict]) -> list[dict]:
    return [
        {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in row.items()}
        for row in records
    ]


@app.get("/api/players")
def players(method: str = "umap"):
    d = _load()
    x_col, y_col = f"{method}_x", f"{method}_y"
    cols = [
        "player_id", "player_name", "dominant_position", "pos_group",
        "total_minutes", "matches_played", x_col, y_col,
    ] + FEATURES
    sub = d[cols].rename(columns={x_col: "x", y_col: "y"})
    return _clean(sub.to_dict("records"))


@app.get("/api/cases")
def cases():
    d = _load()
    coords = d[["umap_x", "umap_y"]].values.astype(float)

    nn = NearestNeighbors(n_neighbors=2, n_jobs=-1).fit(coords)
    dists, idxs = nn.kneighbors(coords)

    def _info(i: int) -> dict:
        r = d.iloc[int(i)]
        return {
            "player_id":         str(r.player_id),
            "player_name":       str(r.player_name),
            "pos_group":         str(r.pos_group),
            "dominant_position": str(r.dominant_position),
            "total_minutes":     float(r.total_minutes),
            "umap_x":            float(r.umap_x),
            "umap_y":            float(r.umap_y),
            "features": {
                f: (None if pd.isna(r[f]) else round(float(r[f]), 3))
                for f in FEATURES
            },
        }

    # Case 1: closest pair (min nearest-neighbor distance)
    c1i = int(np.argmin(dists[:, 1]))
    c1j = int(idxs[c1i, 1])

    # Case 2: most distant pair (sample 600 for O(n²) safety)
    rng = np.random.default_rng(42)
    si  = rng.choice(len(d), 600, replace=False)
    sd  = np.sqrt(((coords[si][:, None] - coords[si][None, :]) ** 2).sum(2))
    np.fill_diagonal(sd, 0)
    fi, fj = np.unravel_index(sd.argmax(), sd.shape)
    c2i, c2j = int(si[fi]), int(si[fj])

    # Case 3: most isolated point (max nearest-neighbor distance)
    c3i = int(np.argmax(dists[:, 1]))

    # Case 4: GK cluster (most distinct and compact cluster)
    gk_ids = d[d.pos_group == "GK"]["player_id"].astype(str).tolist()

    return {
        "case1": {
            "player_a":  _info(c1i),
            "player_b":  _info(c1j),
            "distance":  float(dists[c1i, 1]),
        },
        "case2": {
            "player_a":  _info(c2i),
            "player_b":  _info(c2j),
            "distance":  float(sd[fi, fj]),
        },
        "case3": {
            "player":    _info(c3i),
            "isolation": float(dists[c3i, 1]),
        },
        "case4": {
            "player_ids": gk_ids,
        },
    }


# Serve frontend (must be last — catches everything not matched above)
FRONTEND = Path(__file__).parent.parent / "frontend"
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="static")
