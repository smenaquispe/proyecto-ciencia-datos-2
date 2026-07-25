"""
Análisis de transformaciones para la sección 2 de la Evidencia 3.
Genera gráficas y parquet transformado listo para PCA/UMAP.
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from sklearn.preprocessing import StandardScaler

PARQUET     = Path("analisis_datos/player_feature_vector.parquet")
OUT_PARQUET = Path("analisis_datos/player_feature_vector_scaled.parquet")
IMG_DIR     = Path("analisis_datos/img")
IMG_DIR.mkdir(exist_ok=True)

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

RATIO_VARS = [
    "dribble_success_rate", "pass_completion_rate", "pass_acc_under_pressure",
    "duel_win_rate", "under_pressure_rate",
]

META_COLS = ["player_id", "player_name", "dominant_position", "total_minutes", "matches_played"]

SKEW_THRESHOLD = 2.0

# ── 1. Cargar y analizar estado original ────────────────────────────────────
df = pd.read_parquet(PARQUET)
print(f"Jugadores: {len(df):,}   Features: {len(FEATURES)}")

missing_before = df[FEATURES].isna().sum()
skewness_before = df[FEATURES].skew()

print("\n=== Valores faltantes (antes de imputación) ===")
print(missing_before[missing_before > 0].to_string())

print("\n=== Skewness por variable ===")
print(skewness_before.sort_values(ascending=False).round(2).to_string())

# ── 2. Imputar NaN en ratios con 0 ──────────────────────────────────────────
# Ocurre cuando el jugador nunca realizó esa acción (denominador = 0)
df_work = df[FEATURES].copy()
df_work[RATIO_VARS] = df_work[RATIO_VARS].fillna(0)

# ── 3. log1p para variables muy sesgadas (skew > umbral) ────────────────────
skewed_vars = skewness_before[skewness_before > SKEW_THRESHOLD].index.tolist()
print(f"\nVariables con log1p ({len(skewed_vars)}): {skewed_vars}")

df_log = df_work.copy()
for var in skewed_vars:
    df_log[var] = np.log1p(df_work[var])

skewness_after_log = df_log.skew()

# ── 4. StandardScaler ────────────────────────────────────────────────────────
scaler = StandardScaler()
X_scaled = pd.DataFrame(
    scaler.fit_transform(df_log),
    columns=FEATURES,
    index=df.index,
)

# Guardar parquet transformado
result = pd.concat([df[META_COLS], X_scaled], axis=1)
result.to_parquet(OUT_PARQUET, index=False)
print(f"\nParquet transformado guardado: {OUT_PARQUET}")

# ── GRÁFICA 1: Escalas originales (box plot) ─────────────────────────────────
plt.style.use("dark_background")
fig, ax = plt.subplots(figsize=(18, 6))
df_work.boxplot(ax=ax, rot=90, patch_artist=True,
                boxprops=dict(facecolor='#61afef', alpha=0.7),
                medianprops=dict(color='#e5c07b', linewidth=2),
                flierprops=dict(marker='.', markersize=2, alpha=0.3))
ax.set_title("Escala original de las features (antes de transformación)", fontsize=13, color='white')
ax.set_ylabel("Valor", color='white')
ax.tick_params(colors='white')
plt.tight_layout()
plt.savefig(IMG_DIR / "01_escala_original.png", dpi=150, facecolor='#1e2127')
plt.close()
print("Gráfica 1 guardada: 01_escala_original.png")

# ── GRÁFICA 2: Distribuciones sesgadas antes/después de log1p ────────────────
n = len(skewed_vars)
if n > 0:
    cols = min(n, 8)
    fig, axes = plt.subplots(2, cols, figsize=(cols * 3.2, 6), facecolor='#1e2127')
    if cols == 1:
        axes = axes.reshape(2, 1)
    for i, var in enumerate(skewed_vars[:cols]):
        skew_orig = skewness_before[var]
        skew_log  = skewness_after_log[var]
        axes[0, i].hist(df_work[var].dropna(), bins=60, color='#e06c75', edgecolor='none')
        axes[0, i].set_title(f"{var}\nskew={skew_orig:.2f}", fontsize=7.5, color='white')
        axes[0, i].tick_params(colors='white', labelsize=6)
        axes[0, i].set_facecolor('#282c34')
        axes[1, i].hist(df_log[var].dropna(), bins=60, color='#98c379', edgecolor='none')
        axes[1, i].set_title(f"log1p → skew={skew_log:.2f}", fontsize=7.5, color='white')
        axes[1, i].tick_params(colors='white', labelsize=6)
        axes[1, i].set_facecolor('#282c34')
    fig.suptitle("Distribuciones sesgadas: original (rojo) vs log1p (verde)", fontsize=11, color='white')
    plt.tight_layout()
    plt.savefig(IMG_DIR / "02_distribucion_log1p.png", dpi=150, facecolor='#1e2127')
    plt.close()
    print("Gráfica 2 guardada: 02_distribucion_log1p.png")

# ── GRÁFICA 3: Missing values antes de imputación ────────────────────────────
missing_nz = missing_before[missing_before > 0].sort_values(ascending=False)
if len(missing_nz) > 0:
    fig, ax = plt.subplots(figsize=(10, 4), facecolor='#1e2127')
    ax.set_facecolor('#282c34')
    missing_nz.plot.bar(ax=ax, color='#e5c07b', edgecolor='none')
    # annotate percentages
    total = len(df)
    for p in ax.patches:
        pct = p.get_height() / total * 100
        ax.annotate(f"{pct:.1f}%", (p.get_x() + p.get_width() / 2, p.get_height()),
                    ha='center', va='bottom', fontsize=9, color='white')
    ax.set_title("Valores faltantes por variable (NaN = jugador sin esa acción registrada)", fontsize=11, color='white')
    ax.set_ylabel("Cantidad de NaN", color='white')
    ax.tick_params(colors='white')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig(IMG_DIR / "03_missing_values.png", dpi=150, facecolor='#1e2127')
    plt.close()
    print("Gráfica 3 guardada: 03_missing_values.png")

# ── GRÁFICA 4: Escala después de StandardScaler ──────────────────────────────
fig, ax = plt.subplots(figsize=(18, 6), facecolor='#1e2127')
ax.set_facecolor('#282c34')
X_scaled.boxplot(ax=ax, rot=90, patch_artist=True,
                 boxprops=dict(facecolor='#98c379', alpha=0.7),
                 medianprops=dict(color='#e5c07b', linewidth=2),
                 flierprops=dict(marker='.', markersize=2, alpha=0.3))
ax.axhline(0, color='#e06c75', linestyle='--', alpha=0.6, linewidth=1)
ax.set_title("Features después de transformación completa (z-scores)", fontsize=13, color='white')
ax.set_ylabel("z-score", color='white')
ax.tick_params(colors='white')
plt.tight_layout()
plt.savefig(IMG_DIR / "04_escala_transformada.png", dpi=150, facecolor='#1e2127')
plt.close()
print("Gráfica 4 guardada: 04_escala_transformada.png")

# ── GRÁFICA 5: Heatmap de correlaciones (valores originales) ─────────────────
fig, ax = plt.subplots(figsize=(15, 13), facecolor='#1e2127')
ax.set_facecolor('#1e2127')
corr = df_work.corr()
mask = np.zeros_like(corr, dtype=bool)
mask[np.triu_indices_from(mask)] = True  # solo triángulo inferior
sns.heatmap(corr, ax=ax, mask=mask, cmap='RdBu_r', center=0, vmin=-1, vmax=1,
            square=True, linewidths=0.3, annot=True, fmt=".1f",
            annot_kws={"size": 6}, cbar_kws={"shrink": 0.7})
ax.set_title("Correlaciones entre features (valores originales)", fontsize=13, color='white')
ax.tick_params(colors='white', labelsize=8)
plt.tight_layout()
plt.savefig(IMG_DIR / "05_correlacion.png", dpi=150, facecolor='#1e2127')
plt.close()
print("Gráfica 5 guardada: 05_correlacion.png")

# ── TABLA RESUMEN para el markdown ──────────────────────────────────────────
print("\n\n=== TABLA DE TRANSFORMACIONES PARA MARKDOWN ===\n")
print("| Característica | Tipo | Transformación | Justificación |")
print("|---|---|---|---|")

for var in FEATURES:
    n_nan   = missing_before[var]
    skew    = skewness_before[var]
    is_ratio = var in RATIO_VARS

    tipo = "Ratio (0–1)" if is_ratio else "Numérica"

    steps = []
    justif = []

    if n_nan > 0:
        pct = n_nan / len(df) * 100
        steps.append(f"Imputar NaN → 0")
        justif.append(f"NaN ({pct:.1f}%) = jugador sin esa acción; 0 es el valor real, no faltante")

    if skew > SKEW_THRESHOLD:
        steps.append(f"log1p")
        justif.append(f"Distribución sesgada a la derecha (skew={skew:.1f}); log1p reduce asimetría preservando ceros")

    steps.append("StandardScaler")
    if is_ratio:
        justif.append("Estandarizar para equiparar escala con métricas per90 en la distancia euclidiana")
    else:
        justif.append("Escalas muy distintas entre variables (e.g. passes_per90 ~ 50 vs goals_per90 ~ 0.1)")

    print(f"| `{var}` | {tipo} | {' + '.join(steps)} | {'; '.join(justif)} |")

print("\n\n=== ESTADÍSTICAS DESCRIPTIVAS POST-TRANSFORMACIÓN ===")
desc = X_scaled.describe().round(3)
print(desc[["mean", "std", "min", "max"]].to_string())
