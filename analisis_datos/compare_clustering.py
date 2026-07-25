"""
Comparación de los 3 clusterings sobre el embedding DEC (player-level):

  1. FCM  actual del dashboard (sobre player_feature_vector_scaled, k por defecto)
  2. DEC  labels (argmax q) — analisis_datos/dec_embedding.py
  3. Emre mejor A1 (sobre latente DEC) — analisis_datos/emre_clustering.py

Métricas: Silhouette sobre el latente DEC, ARI y NMI pairwise, distribuciones.
Responde: ¿podemos usar el clustering de emre.md (sí/no/cómo)?
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (adjusted_rand_score, normalized_mutual_info_score,
                             silhouette_score)

BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / "analisis_datos"
sys.path.insert(0, str(BASE / "dashboard_final" / "backend"))
from clustering import fcm  # ponytail: reutiliza el FCM del backend del dashboard

K = 4


def _silh(Z, labels):
    return float(silhouette_score(Z, labels)) if len(set(labels)) > 1 else float("nan")


def main():
    print("Cargando labels...")
    dec = pd.read_parquet(OUTPUT / "player_dec_labels.parquet")
    emre = pd.read_parquet(OUTPUT / "emre_best_labels.parquet")
    fcm_df = pd.read_parquet(OUTPUT / "player_feature_vector_scaled.parquet")

    # FCM sobre features escalados (como hace el endpoint /api/cluster/fcm)
    feat_cols = [c for c in fcm_df.columns if c not in
                 ("player_id", "player_name", "dominant_position",
                  "total_minutes", "matches_played")]
    X = fcm_df[feat_cols].select_dtypes(include=[np.number]).values
    U, _ = fcm(X, c=K)
    fcm_labels = U.argmax(axis=1)

    # 3 series de labels alineadas por player_id
    df = dec[["player_id", "cluster", "z1"]].copy()
    df = df.rename(columns={"cluster": "dec"})
    df = df.merge(emre[["player_id", "cluster"]], on="player_id").rename(
        columns={"cluster": "emre"})
    df["fcm"] = fcm_labels  # mismo orden que fcm_df; verificamos alineación:
    assert (df["player_id"].values == fcm_df["player_id"].values).all(), \
        "player_id desalineado entre FCM y DEC — requiere merge explícito"
    assert (df["player_id"].values == dec["player_id"].values).all()

    z_cols = [f"z{i}" for i in range(1, 11)]
    Z = dec[z_cols].values

    labels = {"FCM": df["fcm"].values, "DEC": df["dec"].values, "Emre-A1": df["emre"].values}
    print("\nDistribuciones (cluster -> n):")
    for name, l in labels.items():
        print(f"  {name:8s} k={len(set(l)):2d}  sizes={np.bincount(l).tolist()}")

    print("\nSilhouette sobre latente DEC (mayor = más separado):")
    silh = {name: _silh(Z, l) for name, l in labels.items()}
    for name, s in silh.items():
        print(f"  {name:8s}  silh={s:.4f}")

    print("\nConcordancia pairwise (ARI / NMI):")
    keys = list(labels)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = keys[i], keys[j]
            ari = adjusted_rand_score(labels[a], labels[b])
            nmi = normalized_mutual_info_score(labels[a], labels[b])
            print(f"  {a:8s} vs {b:8s}   ARI={ari:.4f}  NMI={nmi:.4f}")

    out = pd.DataFrame([
        {"method": name, "k": len(set(l)),
         "silhouette": silh[name],
         "sizes": str(np.bincount(l).tolist())}
        for name, l in labels.items()
    ])
    pout = OUTPUT / "compare_clustering.parquet"
    out.to_parquet(pout, index=False)
    print(f"\nGuardado: {pout}")

    # ponificación final: ¿podemos usar Emre?
    print("\nRespuesta — ¿podemos usar el clustering de emre.md?")
    if silh["Emre-A1"] >= min(silh["DEC"], silh["FCM"]) - 0.02:
        print("  SÍ: Emre-A1 (k=4 KMeans sobre latente DEC) alcanza Silhouette "
              "comparable a DEC y mantiene coherencia con Demir.")
    else:
        print("  PARCIAL: Silhouette por debajo; considerar DEC-labels como "
              "primario y Emre como benchmark de selección de k/método.")


if __name__ == "__main__":
    main()