"""
Sección 3 — Aplicación de reducción de dimensionalidad.
PCA, t-SNE, UMAP, MDS -> imágenes en img/punto3/
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE, MDS
import umap
from pathlib import Path
import time

PARQUET = Path("analisis_datos/player_feature_vector_scaled.parquet")
IMG_DIR = Path("analisis_datos/img/punto3")
IMG_DIR.mkdir(parents=True, exist_ok=True)

FEATURES = [
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

# ── Agrupación de posiciones en 5 categorías ─────────────────────────────────
POS_MAP = {
    "Goalkeeper":              ("GK",  "#e5c07b"),
    "Right Center Back":       ("DEF", "#61afef"),
    "Left Center Back":        ("DEF", "#61afef"),
    "Center Back":             ("DEF", "#61afef"),
    "Right Back":              ("DEF", "#61afef"),
    "Left Back":               ("DEF", "#61afef"),
    "Right Wing Back":         ("DEF", "#61afef"),
    "Left Wing Back":          ("DEF", "#61afef"),
    "Right Defensive Midfield":("DM",  "#56b6c2"),
    "Left Defensive Midfield": ("DM",  "#56b6c2"),
    "Center Defensive Midfield":("DM", "#56b6c2"),
    "Right Center Midfield":   ("MID", "#98c379"),
    "Left Center Midfield":    ("MID", "#98c379"),
    "Right Midfield":          ("MID", "#98c379"),
    "Left Midfield":           ("MID", "#98c379"),
    "Center Attacking Midfield":("MID","#98c379"),
    "Right Attacking Midfield":("MID", "#98c379"),
    "Left Attacking Midfield": ("MID", "#98c379"),
    "Center Forward":          ("FWD", "#e06c75"),
    "Right Wing":              ("FWD", "#e06c75"),
    "Left Wing":               ("FWD", "#e06c75"),
    "Right Center Forward":    ("FWD", "#e06c75"),
    "Left Center Forward":     ("FWD", "#e06c75"),
}
GROUP_COLORS = {"GK": "#e5c07b", "DEF": "#61afef", "DM": "#56b6c2",
                "MID": "#98c379", "FWD": "#e06c75"}

# ── Cargar datos ──────────────────────────────────────────────────────────────
df = pd.read_parquet(PARQUET)
X = df[FEATURES].values
pos_groups = df["dominant_position"].map(lambda p: POS_MAP.get(p, ("MID", "#98c379"))[0])
colors = pos_groups.map(GROUP_COLORS).values
print(f"Jugadores: {len(X):,}  Features: {X.shape[1]}")

# ── Helpers ───────────────────────────────────────────────────────────────────
BG = "#1e2127"
PANEL = "#282c34"
ALPHA = 0.45
SIZE = 6

def make_legend(ax):
    patches = [mpatches.Patch(color=c, label=g) for g, c in GROUP_COLORS.items()]
    ax.legend(handles=patches, loc="upper right", fontsize=8,
              facecolor=PANEL, edgecolor="none", labelcolor="white")

def scatter_2d(ax, coords, title):
    ax.set_facecolor(PANEL)
    ax.scatter(coords[:, 0], coords[:, 1], c=colors, s=SIZE, alpha=ALPHA, linewidths=0)
    ax.set_title(title, fontsize=10, color="white", pad=6)
    ax.tick_params(colors="white", labelsize=7)
    ax.spines[:].set_color("#3e4452")
    make_legend(ax)

# ─────────────────────────────────────────────────────────────────────────────
# 1. PCA — todos los componentes para varianza, luego proyección 2D
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1/4] PCA ...")
t0 = time.time()
pca_full = PCA(n_components=len(FEATURES), random_state=42)
pca_full.fit(X)
var_exp = pca_full.explained_variance_ratio_
var_cum = np.cumsum(var_exp)

pca2d = PCA(n_components=2, random_state=42)
X_pca = pca2d.fit_transform(X)
print(f"  PC1={var_exp[0]*100:.1f}%  PC2={var_exp[1]*100:.1f}%  acumulada 2D={var_cum[1]*100:.1f}%  ({time.time()-t0:.1f}s)")

# Scree plot
fig, axes = plt.subplots(1, 2, figsize=(14, 5), facecolor=BG)
axes[0].set_facecolor(PANEL)
axes[0].bar(range(1, len(var_exp)+1), var_exp*100, color="#61afef", alpha=0.8)
axes[0].plot(range(1, len(var_exp)+1), var_cum*100, "o-", color="#e5c07b", markersize=4, linewidth=1.5)
axes[0].axhline(50, color="#e06c75", linestyle="--", linewidth=1, alpha=0.7)
axes[0].axhline(80, color="#98c379", linestyle="--", linewidth=1, alpha=0.7)
axes[0].text(len(var_exp)-1, 51, "50%", color="#e06c75", fontsize=8, ha="right")
axes[0].text(len(var_exp)-1, 81, "80%", color="#98c379", fontsize=8, ha="right")
axes[0].set_xlabel("Componente principal", color="white", fontsize=9)
axes[0].set_ylabel("Varianza explicada (%)", color="white", fontsize=9)
axes[0].set_title("Varianza explicada por componente (barras) y acumulada (línea)", fontsize=10, color="white")
axes[0].tick_params(colors="white", labelsize=8)
axes[0].spines[:].set_color("#3e4452")

scatter_2d(axes[1], X_pca,
           f"PCA — PC1={var_exp[0]*100:.1f}%  PC2={var_exp[1]*100:.1f}%  (acum. {var_cum[1]*100:.1f}%)")
axes[1].set_xlabel("PC1", color="white", fontsize=9)
axes[1].set_ylabel("PC2", color="white", fontsize=9)

plt.tight_layout()
plt.savefig(IMG_DIR / "01_pca_varianza_scatter.png", dpi=150, facecolor=BG)
plt.close()
print("  -> 01_pca_varianza_scatter.png")

# Tabla de varianza por componente
print("\n  Varianza por componente:")
for i, (v, vc) in enumerate(zip(var_exp, var_cum), 1):
    marker = " <<<" if vc >= 0.5 and (i == 1 or var_cum[i-2] < 0.5) else ""
    print(f"  PC{i:02d}: {v*100:5.2f}%  acum={vc*100:6.2f}%{marker}")

# ─────────────────────────────────────────────────────────────────────────────
# 2. t-SNE
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2/4] t-SNE (perplexity=30) ...")
t0 = time.time()
tsne = TSNE(n_components=2, perplexity=30, learning_rate="auto",
            init="pca", max_iter=1000, random_state=42, n_jobs=-1)
X_tsne = tsne.fit_transform(X)
print(f"  KL divergence={tsne.kl_divergence_:.4f}  ({time.time()-t0:.1f}s)")

fig, ax = plt.subplots(figsize=(10, 8), facecolor=BG)
scatter_2d(ax, X_tsne, "t-SNE — perplexity=30, n_iter=1000, init=pca")
ax.set_xlabel("Dim 1", color="white", fontsize=9)
ax.set_ylabel("Dim 2", color="white", fontsize=9)
plt.tight_layout()
plt.savefig(IMG_DIR / "02_tsne_scatter.png", dpi=150, facecolor=BG)
plt.close()
print("  -> 02_tsne_scatter.png")

# ─────────────────────────────────────────────────────────────────────────────
# 3. UMAP
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3/4] UMAP (n_neighbors=15, min_dist=0.1) ...")
t0 = time.time()
reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, n_components=2,
                    random_state=42, n_jobs=-1)
X_umap = reducer.fit_transform(X)
print(f"  ({time.time()-t0:.1f}s)")

fig, ax = plt.subplots(figsize=(10, 8), facecolor=BG)
scatter_2d(ax, X_umap, "UMAP — n_neighbors=15, min_dist=0.1")
ax.set_xlabel("UMAP 1", color="white", fontsize=9)
ax.set_ylabel("UMAP 2", color="white", fontsize=9)
plt.tight_layout()
plt.savefig(IMG_DIR / "03_umap_scatter.png", dpi=150, facecolor=BG)
plt.close()
print("  -> 03_umap_scatter.png")

# ─────────────────────────────────────────────────────────────────────────────
# 4. MDS — subsample 2000 (O(n²), lento con >3000)
# ─────────────────────────────────────────────────────────────────────────────
print("\n[4/4] MDS (n=2000 subsample) ...")
t0 = time.time()
rng = np.random.default_rng(42)
idx_mds = rng.choice(len(X), size=2000, replace=False)
X_mds_in = X[idx_mds]
colors_mds = colors[idx_mds]

mds = MDS(n_components=2, metric=True, n_init=1, max_iter=300,
          random_state=42, normalized_stress="auto", n_jobs=-1)
X_mds = mds.fit_transform(X_mds_in)
print(f"  stress={mds.stress_:.2f}  ({time.time()-t0:.1f}s)")

fig, ax = plt.subplots(figsize=(10, 8), facecolor=BG)
ax.set_facecolor(PANEL)
ax.scatter(X_mds[:, 0], X_mds[:, 1], c=colors_mds, s=SIZE+2, alpha=ALPHA, linewidths=0)
ax.set_title(f"MDS — métrico, n=2000 (subsample), stress={mds.stress_:.0f}", fontsize=10, color="white", pad=6)
ax.tick_params(colors="white", labelsize=7)
ax.spines[:].set_color("#3e4452")
patches = [mpatches.Patch(color=c, label=g) for g, c in GROUP_COLORS.items()]
ax.legend(handles=patches, loc="upper right", fontsize=8,
          facecolor=PANEL, edgecolor="none", labelcolor="white")
ax.set_xlabel("MDS 1", color="white", fontsize=9)
ax.set_ylabel("MDS 2", color="white", fontsize=9)
plt.tight_layout()
plt.savefig(IMG_DIR / "04_mds_scatter.png", dpi=150, facecolor=BG)
plt.close()
print("  -> 04_mds_scatter.png")

# ─────────────────────────────────────────────────────────────────────────────
# 5. Panel comparativo 2×2
# ─────────────────────────────────────────────────────────────────────────────
print("\nGenerando panel comparativo 2×2 ...")
fig, axes = plt.subplots(2, 2, figsize=(18, 14), facecolor=BG)
axes = axes.flatten()

scatter_2d(axes[0], X_pca,  f"PCA  (PC1={var_exp[0]*100:.1f}%, PC2={var_exp[1]*100:.1f}%, acum={var_cum[1]*100:.1f}%)")
axes[0].set_xlabel("PC1", color="white", fontsize=9)
axes[0].set_ylabel("PC2", color="white", fontsize=9)

scatter_2d(axes[1], X_tsne, "t-SNE  (perplexity=30, n_iter=1000)")
axes[1].set_xlabel("Dim 1", color="white", fontsize=9)
axes[1].set_ylabel("Dim 2", color="white", fontsize=9)

scatter_2d(axes[2], X_umap, "UMAP  (n_neighbors=15, min_dist=0.1)")
axes[2].set_xlabel("UMAP 1", color="white", fontsize=9)
axes[2].set_ylabel("UMAP 2", color="white", fontsize=9)

axes[3].set_facecolor(PANEL)
axes[3].scatter(X_mds[:, 0], X_mds[:, 1], c=colors_mds, s=SIZE+2, alpha=ALPHA, linewidths=0)
axes[3].set_title(f"MDS  (métrico, n=2000 subsample)", fontsize=10, color="white", pad=6)
axes[3].tick_params(colors="white", labelsize=7)
axes[3].spines[:].set_color("#3e4452")
patches = [mpatches.Patch(color=c, label=g) for g, c in GROUP_COLORS.items()]
axes[3].legend(handles=patches, loc="upper right", fontsize=8,
               facecolor=PANEL, edgecolor="none", labelcolor="white")
axes[3].set_xlabel("MDS 1", color="white", fontsize=9)
axes[3].set_ylabel("MDS 2", color="white", fontsize=9)

fig.suptitle("Comparación de técnicas de reducción de dimensionalidad — 4.304 jugadores, 23 features",
             fontsize=13, color="white", y=1.01)
plt.tight_layout()
plt.savefig(IMG_DIR / "00_comparacion_4tecnicas.png", dpi=150, facecolor=BG, bbox_inches="tight")
plt.close()
print("  -> 00_comparacion_4tecnicas.png")

# ─────────────────────────────────────────────────────────────────────────────
# Resumen para el reporte
# ─────────────────────────────────────────────────────────────────────────────
print("\n\n=== RESUMEN PARA EL REPORTE ===")
print(f"\nPCA:")
for i in range(len(FEATURES)):
    print(f"  PC{i+1:02d}: {var_exp[i]*100:.2f}%  acum={var_cum[i]*100:.2f}%")
print(f"\nt-SNE: KL divergence = {tsne.kl_divergence_:.4f}")
print(f"MDS:   stress = {mds.stress_:.2f}")
print(f"\nImagenes guardadas en: {IMG_DIR}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. Guardar projections.parquet (todas las proyecciones + features originales)
# ─────────────────────────────────────────────────────────────────────────────
print("\nGuardando projections.parquet ...")
orig = pd.read_parquet(Path("analisis_datos/player_feature_vector.parquet"))

META_COLS = ["player_id", "player_name", "dominant_position", "total_minutes", "matches_played"]
proj = df[META_COLS].copy()
proj["pos_group"] = pos_groups.values
proj["pca_x"]  = X_pca[:, 0];   proj["pca_y"]  = X_pca[:, 1]
proj["tsne_x"] = X_tsne[:, 0];  proj["tsne_y"] = X_tsne[:, 1]
proj["umap_x"] = X_umap[:, 0];  proj["umap_y"] = X_umap[:, 1]
mds_xarr = np.full(len(df), np.nan); mds_yarr = np.full(len(df), np.nan)
mds_xarr[idx_mds] = X_mds[:, 0];  mds_yarr[idx_mds] = X_mds[:, 1]
proj["mds_x"] = mds_xarr;          proj["mds_y"] = mds_yarr

# Merge original (non-scaled) feature values, aligned by player_id
proj = proj.merge(orig[["player_id"] + FEATURES], on="player_id", how="left")
out_proj = Path("analisis_datos/projections.parquet")
proj.to_parquet(out_proj, index=False)
print(f"  {out_proj}: {len(proj):,} filas, {len(proj.columns)} columnas")
