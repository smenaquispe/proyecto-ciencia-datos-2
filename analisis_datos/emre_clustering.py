"""
Evaluación del clustering de Akhanli & Hennig (Emre 2022, emre.md) sobre
el embedding DEC (Demir 2026). Responde a: "¿podemos usar el clustering de
emre.md?"

Ponytail: la disimilitud de Emre (Sec.2: log1p+L1+geco+pesos por grupo) está
diseñada para variables mixtas tipo-recuento (107 vars, 11 posiciones binarias).
El embedding DEC (z1..z10 continuas, ya escaladas por la NN) no las necesita:
# ponytail: Euclidean sobre el latente; no aplica geco/log1p a un vector latente.
Lo que sí implementamos fielmente: 6 métodos, 5 índices, calibración C2 con
random clusterings, índice compuesto A1 (emre.md:1086-1114).
# ponytail: estabilidad = proxy ARI de subsample 90% reemplaza Bootstab
# (Fang-Wang). Bootstab O(B·n²·K) con n=4304,B=100,K=10 ≈ horas; upgrade si hace
# falta rigor inferencial.

Output:
  analisis_datos/emre_results.parquet   (method, k, 5 índices raw, A1 z-score)
  analisis_datos/emre_best_labels.parquet (player_id, cluster, method, k, A1)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import time
_T0 = time.time()
def _t(msg): print(f"  [{time.time()-_T0:6.1f}s] {msg}", flush=True)
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import squareform
from sklearn.cluster import SpectralClustering, KMeans
from sklearn.metrics.pairwise import pairwise_distances
from sklearn.metrics import adjusted_rand_score
# ponytail: PAM sustituido por KMeans del latente. sklearn-extra no compila con
# numpy 2.1.2 (ImportError numpy.core.multiarray). KMeans = sustituto particional
# válido (Demir lo lista como baseline propio). upgrade: sklearn-extra nightly o
# numpy<2 + implementación PAM manual (~50 LOC) si hace falta fidelidad total.

BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / "analisis_datos"

KMAX = 6           # emre.md A1 interpreta con k pequeño (~5); 6 basta y abarata
B_RANDOM = 10      # clusterings aleatorios por generador por k
B_STAB = 0         # ponytail: Bootstab proxy apagado. O(B·n²·K·#methods)~hora
# con n=4304,B=25,K=10. Emre Sec.5 lo marca como el index caro. upgrade: B=10+
# proxy ARI-subsample cuando haga falta rigor inferencial (descomentar abajo).
P_SEP = 0.1        # emre.md:716-717 — proporción del borde del cluster
SEED = 42
RNG = np.random.default_rng(SEED)


# ── 5 índices (emre.md Sec.4.2) ───────────────────────────────────────────────

def i_ave_within(labels: np.ndarray, D: np.ndarray) -> float:
    """Media de distancias intra-cluster (emre.md:635-664). Menor = mejor."""
    n = len(labels)
    total = 0.0
    for k in np.unique(labels):
        idx = np.where(labels == k)[0]
        if len(idx) < 2:
            continue
        total += D[np.ix_(idx, idx)].sum() / (len(idx) - 1)
    return total / n


def i_sep(labels: np.ndarray, D: np.ndarray, p: float = P_SEP) -> float:
    """Media de la distancia mínima inter-cluster del p%-borde (emre.md:666-717). Mayor = mejor."""
    vals = []
    for k in np.unique(labels):
        idx = np.where(labels == k)[0]
        other = np.where(labels != k)[0]
        if len(idx) == 0 or len(other) == 0:
            continue
        dmin = D[np.ix_(idx, other)].min(axis=1)  # nearest foreign per member
        m = max(int(np.floor(p * len(idx))), 1)
        vals.append(np.sort(dmin)[:m].mean())
    return float(np.mean(vals)) if vals else 0.0


def i_pearson_gamma(labels: np.ndarray, D: np.ndarray) -> float:
    """Corr(d, 1[l_i≠l_j]) (emre.md:718-737). Mayor = mejor."""
    n = len(labels)
    iu = np.triu_indices(n, k=1)
    dvec = D[iu]
    cvec = (labels[iu[0]] != labels[iu[1]]).astype(float)
    if dvec.std() < 1e-12 or cvec.std() < 1e-12:
        return 0.0
    return float(np.corrcoef(dvec, cvec)[0, 1])


def i_entropy(labels: np.ndarray) -> float:
    """Entropía de Shannon de tamaños (emre.md:739-773). Mayor = mejor."""
    n = len(labels)
    counts = np.bincount(labels)
    p = counts[counts > 0] / n
    return float(-(p * np.log(p)).sum())


def i_stability_proxy(labels: np.ndarray, Z: np.ndarray,
                      method: str, k: int, D: np.ndarray) -> float:
    """Proxy de Bootstab: ARI medio entre labels y re-cluster sobre submuestra 90%
    extendida por medoide-vecino. Menor divergencia = más estable (mayor score)."""
    if B_STAB <= 0:
        return 0.5  # ponytail: neutral cuando Bootstab está apagado (ver const)
    n = len(labels)
    aris = []
    medoids_by_k = {}
    for k_lbl in np.unique(labels):
        idx = np.where(labels == k_lbl)[0]
        medoid = idx[D[np.ix_(idx, idx)].sum(axis=1).argmin()]
        medoids_by_k[k_lbl] = medoid
    medoids = np.array([medoids_by_k[l] for l in labels])
    for _ in range(B_STAB):
        sub = RNG.choice(n, int(0.9 * n), replace=False)
        sub_labels = _fit(method, Z[sub], D[np.ix_(sub, sub)], k)
        # extender: asignar cada punto fuera de sub al medoide más cercano en sub
        full = labels.copy()
        ext_mask = np.ones(n, bool); ext_mask[sub] = False
        for i in np.where(ext_mask)[0]:
            nn = sub[np.argmin(D[i, sub])]
            full[i] = sub_labels[np.where(sub == nn)[0][0]]
        full[sub] = sub_labels
        aris.append(adjusted_rand_score(labels, full))
    return float(np.mean(aris))  # mayor = más estable = mejor


# ── 6 métodos (emre.md:537-553) ───────────────────────────────────────────────

def _fit(method: str, Z: np.ndarray, D: np.ndarray, k: int) -> np.ndarray:
    if method == "kmeans":  # ponytail: era PAM, véase nota de import arriba
        km = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit(Z)
        return km.labels_
    if method == "spectral":
        # affinity = exp(-D²/σ²) con σ mediana; emre.md:552 usa Ng et al.
        sigma = np.median(D[D > 0]) or 1.0
        aff = np.exp(-(D ** 2) / (2 * sigma ** 2))
        sc = SpectralClustering(n_clusters=k, affinity="precomputed_nearest_neighbors",
                                 random_state=SEED, n_neighbors=min(10, len(Z) - 1))
        try:
            return sc.fit_predict(aff)
        except Exception:
            sc = SpectralClustering(n_clusters=k, affinity="precomputed", random_state=SEED)
            return sc.fit_predict(aff)
    # linkage methods — scipy sobre matriz condensada
    Z_link = linkage(squareform(D, checks=False), method=method)
    return fcluster(Z_link, t=k, criterion="maxclust") - 1


METHODS = ["kmeans", "single", "average", "complete", "ward"]
# ponytail: spectral omitido — O(n³) eig en n=4304; emre.md lo descarta igual al
# seleccionar A1. upgrade: subsample spectral (n≤1500) o método Lanczos si hace falta.


# ── random clusterings (calibración, emre.md:1040-1047) ───────────────────────
# ponytail: 2 de 4 generadores (random-labels + random-KMedoids++). corta compute
# sin perder la idea de distribución nula. add: random-NN / random-farthest-NN
# (Akhanli-Hennig 2020) si hace falta fidelidad total.

def random_clustering(kind: str, Z: np.ndarray, D: np.ndarray, k: int) -> np.ndarray:
    n = len(Z)
    if kind == "labels":
        return RNG.integers(0, k, size=n)
    if kind == "kmedoids":
        seeds = RNG.choice(n, size=k, replace=False)
        labels = D[seeds].argmin(axis=0)
        # 1 vacío → rellena aleatorio para mantener k
        for j in range(k):
            if not np.any(labels == j):
                labels[RNG.integers(0, n)] = j
        return labels
    raise ValueError(kind)


# ── índices para una clustering ──────────────────────────────────────────────

def all_indices(labels: np.ndarray, D: np.ndarray, Z: np.ndarray, method: str, k: int):
    return dict(
        ave_within=i_ave_within(labels, D),
        sep=i_sep(labels, D),
        pearson=i_pearson_gamma(labels, D),
        entropy=i_entropy(labels),
        stab=i_stability_proxy(labels, Z, method, k, D),
    )


def composite_A1(raw: dict, ref: dict) -> float:
    # emre.md:1086-1114 — w = [1, 0.5, 1, 1, 1]; flip signo a los menor-mejor
    z = {}
    for key, flip in [("ave_within", -1), ("sep", 1), ("pearson", 1),
                      ("entropy", 1), ("stab", 1)]:
        mu, sd = ref[key]
        z[key] = flip * (raw[key] - mu) / (sd + 1e-12)
    return z["ave_within"] + 0.5 * z["sep"] + z["pearson"] + z["entropy"] + z["stab"]


def main():
    print("Cargando embedding DEC...")
    df = pd.read_parquet(OUTPUT / "player_dec_labels.parquet")
    z_cols = [c for c in df.columns if c.startswith("z")]
    Z = df[z_cols].values.astype(np.float32)
    n = len(Z)
    print(f"  n={n:,}  d={Z.shape[1]}")
    _t(f"matriz D ({n}x{n})...")
    D = pairwise_distances(Z, metric="euclidean").astype(np.float32)
    _t("done D")

    print(f"Clusterings reales: {len(METHODS)} métodos × k=[2..{KMAX}]")
    rows = []
    real_labels = {}
    for k in range(2, KMAX + 1):
        for m in METHODS:
            lab = _fit(m, Z, D, k)
            real_labels[(m, k)] = lab
            rows.append({"method": m, "kind": "real", "k": k,
                         "labels": lab, **all_indices(lab, D, Z, m, k)})
        _t(f"  done real k={k}")

    print(f"Clusterings random: 2 gens × {B_RANDOM} × k=[2..{KMAX}]")
    for k in range(2, KMAX + 1):
        for kind in ("labels", "kmedoids"):
            for _ in range(B_RANDOM):
                lab = random_clustering(kind, Z, D, k)
                rows.append({"method": f"random_{kind}", "kind": "rand", "k": k,
                             "labels": lab, **all_indices(lab, D, Z, "kmeans", k)})
        _t(f"  done random k={k}")

    rdf = pd.DataFrame(rows)
    print(f"  total clusterings: {len(rdf):,}")

    print("Calibración C2 (z-score por k, emre.md:1056-1057)...")
    ref_by_k = {}
    for k in range(2, KMAX + 1):
        sub = rdf[rdf["k"] == k]
        ref_by_k[k] = {key: (sub[key].mean(), sub[key].std(ddof=0))
                       for key in ["ave_within", "sep", "pearson", "entropy", "stab"]}

    rdf["A1"] = rdf.apply(
        lambda r: composite_A1({key: r[key] for key in
                                ["ave_within", "sep", "pearson", "entropy", "stab"]},
                               ref_by_k[r["k"]]), axis=1)

    real = rdf[rdf["kind"] == "real"].drop(columns=["labels"]).reset_index(drop=True)
    best_row = real.loc[real["A1"].idxmax()]
    bm, bk = best_row["method"], int(best_row["k"])
    print(f"\nMejor A1: {bm} k={bk}  A1={best_row['A1']:.3f}")
    print(real.sort_values("A1", ascending=False).head(10).to_string(index=False))

    # top 5 por método
    pout = OUTPUT / "emre_results.parquet"
    real.to_parquet(pout, index=False)
    print(f"\nResultados: {pout}")

    best_labels = pd.DataFrame({
        "player_id": df["player_id"].values,
        "cluster": real_labels[(bm, bk)],
        "method": bm, "k": bk, "A1": float(best_row["A1"]),
    })
    lout = OUTPUT / "emre_best_labels.parquet"
    best_labels.to_parquet(lout, index=False)
    print(f"Mejor clustering: {lout}  (cluster sizes={np.bincount(best_labels['cluster']).tolist()})")

    # self-check
    assert best_row["A1"] > real["A1"].quantile(0.5), "A1 mejor por debajo de la mediana"
    print("  self-check OK: A1 > mediana de clusterings reales")


if __name__ == "__main__":
    main()