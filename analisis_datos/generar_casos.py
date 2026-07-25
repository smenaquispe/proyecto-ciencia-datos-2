"""
Genera gráficas estáticas para la Sección 5 (Casos 1-4) → img/punto5/
"""
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch
from mpl_toolkits.axes_grid1.inset_locator import mark_inset, zoomed_inset_axes
from sklearn.neighbors import NearestNeighbors
from pathlib import Path

PARQUET  = Path("analisis_datos/projections.parquet")
IMG_DIR  = Path("analisis_datos/img/punto5")
IMG_DIR.mkdir(parents=True, exist_ok=True)

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
KEY_FEATURES = [
    "passes_per90","progressive_passes_per90","pressures_per90",
    "duels_per90","shots_per90","dribbles_per90","clearances_per90","carries_per90",
    "pass_completion_rate","goals_per90",
]
POS_COLORS = {"GK":"#e5c07b","DEF":"#61afef","DM":"#56b6c2","MID":"#98c379","FWD":"#e06c75"}
BG, PANEL = "#1e2127", "#282c34"

df = pd.read_parquet(PARQUET)
coords = df[["umap_x","umap_y"]].values.astype(float)

# ── Compute cases (same logic as backend) ────────────────────────────────────
nn = NearestNeighbors(n_neighbors=2, n_jobs=-1).fit(coords)
dists, idxs = nn.kneighbors(coords)

c1i = int(np.argmin(dists[:,1]))
c1j = int(idxs[c1i,1])

rng = np.random.default_rng(42)
si  = rng.choice(len(df), 600, replace=False)
sd  = np.sqrt(((coords[si][:,None] - coords[si][None,:])**2).sum(2))
np.fill_diagonal(sd, 0)
fi,fj = np.unravel_index(sd.argmax(), sd.shape)
c2i,c2j = int(si[fi]), int(si[fj])

c3i = int(np.argmax(dists[:,1]))

gk_mask = df["pos_group"] == "GK"

# Euclidean distance in original 23D space (original feature values)
def feat_dist(i, j):
    a = df.iloc[i][FEATURES].fillna(0).values.astype(float)
    b = df.iloc[j][FEATURES].fillna(0).values.astype(float)
    return float(np.sqrt(((a-b)**2).sum()))

dist_c1_23d = feat_dist(c1i, c1j)
dist_c2_23d = feat_dist(c2i, c2j)

print(f"Caso 1: {df.iloc[c1i].player_name!r} vs {df.iloc[c1j].player_name!r}")
print(f"  UMAP dist={dists[c1i,1]:.6f}  23D dist={dist_c1_23d:.4f}")
print(f"Caso 2: {df.iloc[c2i].player_name!r} vs {df.iloc[c2j].player_name!r}")
print(f"  UMAP dist={sd[fi,fj]:.4f}  23D dist={dist_c2_23d:.4f}")
print(f"Caso 3: {df.iloc[c3i].player_name!r}  isolation={dists[c3i,1]:.4f}")
print(f"Caso 4: {gk_mask.sum()} porteros")

# ── Helper: full UMAP scatter base ────────────────────────────────────────────
def base_scatter(ax, alpha=0.25, size=4):
    for grp, col in POS_COLORS.items():
        mask = df["pos_group"] == grp
        ax.scatter(df.loc[mask,"umap_x"], df.loc[mask,"umap_y"],
                   c=col, s=size, alpha=alpha, linewidths=0)

def hl_point(ax, idx, label, color="#ffffff", size=120, zorder=10):
    x, y = df.iloc[idx]["umap_x"], df.iloc[idx]["umap_y"]
    ax.scatter([x],[y], c=color, s=size, zorder=zorder,
               edgecolors="#e5c07b", linewidths=1.8)
    ax.annotate(label, (x,y), fontsize=9, color="#e5c07b", fontweight="bold",
                xytext=(12,10), textcoords="offset points",
                arrowprops=dict(arrowstyle="-|>", color="#e5c07b", lw=1.2))

def style_ax(ax, title="", xlabel="UMAP 1", ylabel="UMAP 2"):
    ax.set_facecolor(PANEL)
    ax.tick_params(colors="#5c6370", labelsize=7)
    ax.spines[:].set_color("#3e4452")
    if title: ax.set_title(title, color="white", fontsize=10, pad=6)
    ax.set_xlabel(xlabel, color="#5c6370", fontsize=8)
    ax.set_ylabel(ylabel, color="#5c6370", fontsize=8)

# ─────────────────────────────────────────────────────────────────────────────
# CASO 1: Dos puntos cercanos — scatter general + zoom inset
# ─────────────────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5.5), facecolor=BG)

# Left: full UMAP
ax = axes[0]; ax.set_facecolor(PANEL)
base_scatter(ax, alpha=0.15)
hl_point(ax, c1i, "A", size=120)
hl_point(ax, c1j, "B", size=120)
# draw circle around both
cx = (df.iloc[c1i]["umap_x"] + df.iloc[c1j]["umap_x"]) / 2
cy = (df.iloc[c1i]["umap_y"] + df.iloc[c1j]["umap_y"]) / 2
circle = plt.Circle((cx,cy), 1.2, fill=False, edgecolor="#e5c07b", lw=1.5, linestyle="--", zorder=8)
ax.add_patch(circle)
style_ax(ax, f"Caso 1: Vista global (dist UMAP={dists[c1i,1]:.4f})")

# Right: zoomed into neighborhood of the two points
ax2 = axes[1]; ax2.set_facecolor(PANEL)
base_scatter(ax2, alpha=0.4, size=6)
hl_point(ax2, c1i, f"A: {df.iloc[c1i]['player_name'].split()[-1]}", size=160)
hl_point(ax2, c1j, f"B: {df.iloc[c1j]['player_name'].split()[-1]}", size=160)
pad = 1.8
ax2.set_xlim(cx-pad, cx+pad); ax2.set_ylim(cy-pad, cy+pad)
style_ax(ax2, "Caso 1: Zoom — vecindad inmediata")

fig.suptitle(
    f"Caso 1: Dos puntos cercanos — Arambarri Rosa vs Mouhsine\n"
    f"Posición: DM vs MID | 23D dist={dist_c1_23d:.3f}",
    color="white", fontsize=10
)
plt.tight_layout()
plt.savefig(IMG_DIR/"01_caso1_scatter.png", dpi=150, facecolor=BG)
plt.close()
print("01_caso1_scatter.png")

# Feature comparison: Caso 1
fig, ax = plt.subplots(figsize=(11, 5), facecolor=BG); ax.set_facecolor(PANEL)
feats = KEY_FEATURES[:8]
a_vals = [df.iloc[c1i][f] or 0 for f in feats]
b_vals = [df.iloc[c1j][f] or 0 for f in feats]
x = np.arange(len(feats)); w = 0.36
ax.bar(x-w/2, a_vals, w, color="#61afef", alpha=0.85, label=df.iloc[c1i]["player_name"].split()[-1])
ax.bar(x+w/2, b_vals, w, color="#e06c75", alpha=0.85, label=df.iloc[c1j]["player_name"].split()[-1])
ax.set_xticks(x)
ax.set_xticklabels([f.replace("_per90","").replace("_"," ") for f in feats], rotation=35, ha="right", fontsize=9, color="#abb2bf")
ax.tick_params(colors="#5c6370", labelsize=8)
ax.spines[:].set_color("#3e4452")
ax.set_ylabel("Valor original", color="#5c6370", fontsize=9)
ax.set_title("Caso 1 — Comparación de features: Arambarri Rosa vs Mouhsine", color="white", fontsize=10)
ax.legend(fontsize=9, facecolor=PANEL, edgecolor="#3e4452", labelcolor="white")
plt.tight_layout()
plt.savefig(IMG_DIR/"02_caso1_comparacion.png", dpi=150, facecolor=BG)
plt.close()
print("02_caso1_comparacion.png")

# ─────────────────────────────────────────────────────────────────────────────
# CASO 2: Dos puntos lejanos
# ─────────────────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5.5), facecolor=BG)

ax = axes[0]; ax.set_facecolor(PANEL)
base_scatter(ax, alpha=0.15)
hl_point(ax, c2i, "A (GK)", size=140)
hl_point(ax, c2j, "B (LB)", size=140)
# draw arrow between them
x1,y1 = df.iloc[c2i]["umap_x"], df.iloc[c2i]["umap_y"]
x2,y2 = df.iloc[c2j]["umap_x"], df.iloc[c2j]["umap_y"]
ax.annotate("", xy=(x2,y2), xytext=(x1,y1),
            arrowprops=dict(arrowstyle="<->", color="#e5c07b", lw=1.5, alpha=0.6))
style_ax(ax, f"Caso 2: Vista global (dist UMAP={sd[fi,fj]:.2f})")

# Right: feature comparison
ax2 = axes[1]; ax2.set_facecolor(PANEL)
feats = KEY_FEATURES[:8]
a_vals = [df.iloc[c2i][f] or 0 for f in feats]
b_vals = [df.iloc[c2j][f] or 0 for f in feats]
x = np.arange(len(feats)); w = 0.36
ax2.bar(x-w/2, a_vals, w, color="#e5c07b", alpha=0.85,
        label=f"A: {df.iloc[c2i]['player_name'].split()[-1]} ({df.iloc[c2i]['pos_group']})")
ax2.bar(x+w/2, b_vals, w, color="#61afef", alpha=0.85,
        label=f"B: {df.iloc[c2j]['player_name'].split()[-1]} ({df.iloc[c2j]['pos_group']})")
ax2.set_xticks(x)
ax2.set_xticklabels([f.replace("_per90","").replace("_"," ") for f in feats], rotation=35, ha="right", fontsize=9, color="#abb2bf")
ax2.tick_params(colors="#5c6370", labelsize=8)
ax2.spines[:].set_color("#3e4452")
ax2.set_ylabel("Valor original", color="#5c6370", fontsize=9)
ax2.set_title("Caso 2 — Comparación de features", color="white", fontsize=10)
ax2.legend(fontsize=8, facecolor=PANEL, edgecolor="#3e4452", labelcolor="white")
fig.suptitle(
    f"Caso 2: Dos puntos lejanos — Arlauskis (GK) vs Marcelo Vieira (LB)\n"
    f"23D dist={dist_c2_23d:.2f}",
    color="white", fontsize=10
)
plt.tight_layout()
plt.savefig(IMG_DIR/"03_caso2_scatter_comparacion.png", dpi=150, facecolor=BG)
plt.close()
print("03_caso2_scatter_comparacion.png")

# ─────────────────────────────────────────────────────────────────────────────
# CASO 3: Outlier — vista global + zoom
# ─────────────────────────────────────────────────────────────────────────────
ox, oy = df.iloc[c3i]["umap_x"], df.iloc[c3i]["umap_y"]
fig, axes = plt.subplots(1, 2, figsize=(14, 5.5), facecolor=BG)

ax = axes[0]; ax.set_facecolor(PANEL)
base_scatter(ax, alpha=0.15)
ax.scatter([ox],[oy], c="#e06c75", s=150, zorder=10, edgecolors="#fff", linewidths=2)
ax.annotate(f"Assou-Ekotto\n(LB aislado)", (ox,oy), fontsize=8, color="#e06c75",
            xytext=(20,-30), textcoords="offset points",
            arrowprops=dict(arrowstyle="-|>", color="#e06c75", lw=1.2))
style_ax(ax, "Caso 3: Vista global — outlier marcado en rojo")

ax2 = axes[1]; ax2.set_facecolor(PANEL)
base_scatter(ax2, alpha=0.3, size=6)
ax2.scatter([ox],[oy], c="#e06c75", s=200, zorder=10, edgecolors="#fff", linewidths=2.5)
ax2.annotate("Assou-Ekotto", (ox,oy), fontsize=9, color="#e06c75", fontweight="bold",
             xytext=(15,12), textcoords="offset points",
             arrowprops=dict(arrowstyle="-|>", color="#e06c75", lw=1.5))
pad = 3.5
ax2.set_xlim(ox-pad, ox+pad); ax2.set_ylim(oy-pad, oy+pad)
# nearest neighbor arrow
nn_idx = int(idxs[c3i,1])
nx, ny = df.iloc[nn_idx]["umap_x"], df.iloc[nn_idx]["umap_y"]
ax2.annotate("", xy=(nx,ny), xytext=(ox,oy),
             arrowprops=dict(arrowstyle="->", color="#5c6370", lw=1.2, linestyle="dashed"))
ax2.text((ox+nx)/2, (oy+ny)/2, f"d={dists[c3i,1]:.2f}", color="#5c6370", fontsize=8)
style_ax(ax2, f"Caso 3: Zoom — dist vecino={dists[c3i,1]:.4f}")

fig.suptitle(
    f"Caso 3: Punto atípico — Benoît Assou-Ekotto (Left Back)\n"
    f"Aislamiento: {dists[c3i,1]:.4f} | Válido pero extremo",
    color="white", fontsize=10
)
plt.tight_layout()
plt.savefig(IMG_DIR/"04_caso3_outlier.png", dpi=150, facecolor=BG)
plt.close()
print("04_caso3_outlier.png")

# ─────────────────────────────────────────────────────────────────────────────
# CASO 4: Cluster de porteros
# ─────────────────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5.5), facecolor=BG)

ax = axes[0]; ax.set_facecolor(PANEL)
# non-GK (faded)
non_gk = df[~gk_mask]
for grp, col in POS_COLORS.items():
    if grp == "GK": continue
    m = non_gk["pos_group"]==grp
    ax.scatter(non_gk.loc[m,"umap_x"], non_gk.loc[m,"umap_y"], c=col, s=3, alpha=0.08, linewidths=0)
# GK highlighted
gk = df[gk_mask]
ax.scatter(gk["umap_x"], gk["umap_y"], c="#e5c07b", s=12, alpha=0.9,
           zorder=5, edgecolors="#1e2127", linewidths=0.3)
ax.annotate(f"Cluster GK\n({gk_mask.sum()} porteros)",
            (gk["umap_x"].mean(), gk["umap_y"].mean()),
            fontsize=9, color="#e5c07b", fontweight="bold",
            xytext=(30, 15), textcoords="offset points",
            arrowprops=dict(arrowstyle="-|>", color="#e5c07b", lw=1.2))
style_ax(ax, "Caso 4: Cluster de porteros (amarillo)")

# Right: GK vs global profile comparison
ax2 = axes[1]; ax2.set_facecolor(PANEL)
feats_c4 = ["passes_per90","dribbles_per90","clearances_per90","shots_per90",
            "pressures_per90","carries_per90","duels_per90","goals_per90"]
gk_avg  = [df.loc[gk_mask, f].fillna(0).mean() for f in feats_c4]
all_avg = [df[f].fillna(0).mean() for f in feats_c4]
x = np.arange(len(feats_c4)); w = 0.36
ax2.bar(x-w/2, gk_avg,  w, color="#e5c07b", alpha=0.85, label="Media GK (n=312)")
ax2.bar(x+w/2, all_avg, w, color="#3d4557", alpha=0.85, label="Media global (n=4304)")
ax2.set_xticks(x)
ax2.set_xticklabels([f.replace("_per90","").replace("_"," ") for f in feats_c4],
                    rotation=35, ha="right", fontsize=9, color="#abb2bf")
ax2.tick_params(colors="#5c6370", labelsize=8)
ax2.spines[:].set_color("#3e4452")
ax2.set_ylabel("Media por 90 min", color="#5c6370", fontsize=9)
ax2.set_title("Caso 4 — Perfil GK vs Media global", color="white", fontsize=10)
ax2.legend(fontsize=9, facecolor=PANEL, edgecolor="#3e4452", labelcolor="white")

fig.suptitle("Caso 4: Cluster de porteros — el más compacto y separado en UMAP",
             color="white", fontsize=10)
plt.tight_layout()
plt.savefig(IMG_DIR/"05_caso4_cluster.png", dpi=150, facecolor=BG)
plt.close()
print("05_caso4_cluster.png")

# ─────────────────────────────────────────────────────────────────────────────
# Print summary table for the markdown
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== RESUMEN PARA MARKDOWN ===")
print(f"\nCASO 1:")
print(f"  A: {df.iloc[c1i]['player_name']} ({df.iloc[c1i]['dominant_position']}) — {df.iloc[c1i]['total_minutes']:.0f} min")
print(f"  B: {df.iloc[c1j]['player_name']} ({df.iloc[c1j]['dominant_position']}) — {df.iloc[c1j]['total_minutes']:.0f} min")
print(f"  dist UMAP={dists[c1i,1]:.6f}  dist 23D={dist_c1_23d:.4f}")
for f in KEY_FEATURES[:8]:
    a,b = df.iloc[c1i][f], df.iloc[c1j][f]
    diff = abs(a-b)/(max(abs(a),abs(b),0.001))*100
    print(f"    {f}: A={a:.3f}  B={b:.3f}  diff={diff:.1f}%")

print(f"\nCASO 2:")
print(f"  A: {df.iloc[c2i]['player_name']} ({df.iloc[c2i]['dominant_position']}) — {df.iloc[c2i]['total_minutes']:.0f} min")
print(f"  B: {df.iloc[c2j]['player_name']} ({df.iloc[c2j]['dominant_position']}) — {df.iloc[c2j]['total_minutes']:.0f} min")
print(f"  dist UMAP={sd[fi,fj]:.4f}  dist 23D={dist_c2_23d:.4f}")

print(f"\nCASO 3:")
print(f"  {df.iloc[c3i]['player_name']} ({df.iloc[c3i]['dominant_position']})")
print(f"  {df.iloc[c3i]['total_minutes']:.0f} min | isolation={dists[c3i,1]:.4f}")
for f in KEY_FEATURES[:8]:
    print(f"    {f}: {df.iloc[c3i][f]:.3f}")

print(f"\nCASO 4: {gk_mask.sum()} GK")
for f in feats_c4:
    mg = df.loc[gk_mask,f].fillna(0).mean()
    ma = df[f].fillna(0).mean()
    print(f"    {f}: GK={mg:.3f}  global={ma:.3f}  delta={mg-ma:+.3f}")
