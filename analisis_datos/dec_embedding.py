"""
Deep Embedded Clustering (DEC) — Demir et al. 2026.

Reusa el autoencoder YA entrenado (autoencoder.pt) como paso de pretraining
y añade el refinamiento KL que convierte un embedding de autoencoder en un
embedding de DEC. Demir: AE pretrain → K-Means init en latente → KL(P||Q).

Output:
  analisis_datos/player_dec_labels.parquet   (player_id, cluster, m1..mk, z1..z10)
  analisis_datos/dec_model.pt
"""
from __future__ import annotations

import sys
from pathlib import Path

# ponytail: K y out por argv — k=4 por defecto (Demir), k=8 v2 sub-perfiles
_K_DEFAULT = 4
def _args():
    k, out = _K_DEFAULT, None
    a = sys.argv[1:]
    i = 0
    while i < len(a):
        if a[i] == "--k" and i + 1 < len(a):
            k = int(a[i + 1]); i += 2
        elif a[i] == "--out" and i + 1 < len(a):
            out = a[i + 1]; i += 2
        else:
            i += 1
    return k, out

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.cluster import KMeans

BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / "analisis_datos"

SEED = 42
ALPHA = 1.0         # grados de libertad t-Student (demir.md:1651)
EPOCHS = 300        # ponytail: full-batch n=4300 convence en ~300; 3000 over-kill
LR = 1e-3
UPDATE_P_EVERY = 5  # Xie et al.: target P en snapshot cada T iters, no cada step


def _soft_q(Z: torch.Tensor, Mu: torch.Tensor) -> torch.Tensor:
    """q_ij = (1 + ||z_i - μ_j||²/α)^(-(α+1)/2) normalizado por fila. α=1 → 1/(1+d²)."""
    d2 = ((Z[:, None, :] - Mu[None, :, :]) ** 2).sum(dim=2)  # (n,k)
    q = (1.0 + d2 / ALPHA) ** (-(ALPHA + 1.0) / 2.0)
    return q / q.sum(dim=1, keepdim=True)


def _target_p(Q: torch.Tensor) -> torch.Tensor:
    """p_ij = q²/Σ_i q  normalizado por columna (demir.md:1656-1682)."""
    num = Q ** 2
    denom = num.sum(dim=0, keepdim=True) + 1e-12
    p = num / denom
    return p / p.sum(dim=1, keepdim=True)


def train_dec(K: int) -> tuple[np.ndarray, np.ndarray, dict]:
    print("Cargando features escalados y autoencoder pretrain...")
    df = pd.read_parquet(OUTPUT / "player_enriched_scaled.parquet")
    meta = ["player_id", "player_name", "dominant_position", "total_minutes", "matches_played"]
    feat_cols = [c for c in df.columns if c not in meta]
    X = df[feat_cols].values.astype(np.float32)
    n, D = X.shape
    print(f"  n={n:,}  D={D}  k={K}")

    sys.path.insert(0, str(OUTPUT))
    from autoencoder_embedding import Autoencoder  # reusa arquitectura + pesos pretrain

    torch.manual_seed(SEED); np.random.seed(SEED)
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  device={dev}")

    ae = Autoencoder(D, 10).to(dev)
    ae.load_state_dict(torch.load(OUTPUT / "autoencoder.pt", map_location=dev))
    encoder = ae.encoder  # ponytail: refinar solo el encoder, decoder se descarta

    Xt = torch.tensor(X, device=dev)
    with torch.no_grad():
        Z0 = encoder(Xt).cpu().numpy()

    print("K-Means init en latente...")
    km = KMeans(n_clusters=K, n_init=10, random_state=SEED).fit(Z0)
    Mu = torch.tensor(km.cluster_centers_, device=dev, dtype=torch.float32)

    opt = torch.optim.Adam(encoder.parameters(), lr=LR)

    Xt.requires_grad_(False)
    # ponytail: P fijo cada UPDATE_P_EVERY steps evita el chase inestable Q↔P
    P = None
    print(f"Refinamiento KL ({EPOCHS} épocas, P update cada {UPDATE_P_EVERY})...")
    for epoch in range(1, EPOCHS + 1):
        encoder.train()
        Z = encoder(Xt)                          # graph sobre encoder
        if P is None or epoch % UPDATE_P_EVERY == 1:
            with torch.no_grad():
                P = _target_p(_soft_q(Z.detach(), Mu))
        Q = _soft_q(Z, Mu)                       # q lleva grad → Z → encoder
        loss = (P * torch.log(P / (Q + 1e-12) + 1e-12)).sum()

        opt.zero_grad()
        loss.backward()
        opt.step()

        if epoch % 50 == 0 or epoch == 1:
            print(f"  época {epoch:4d}  KL={loss.item():.4f}")

    encoder.eval()
    with torch.no_grad():
        Zf = encoder(Xt)
        Qf = _soft_q(Zf, Mu).cpu().numpy()
        Zf_np = Zf.cpu().numpy()
    labels = Qf.argmax(axis=1)
    print(f"  distribución de clusters: {np.bincount(labels, minlength=K).tolist()}")
    return Zf_np, Qf, encoder.state_dict()


def main(k: int, out_name: str | None):
    Z, Q, state = train_dec(k)
    df = pd.read_parquet(OUTPUT / "player_enriched_scaled.parquet")

    out = pd.DataFrame({"player_id": df["player_id"].values})
    out["cluster"] = Q.argmax(axis=1)
    for j in range(Q.shape[1]):
        out[f"m{j+1}"] = Q[:, j].round(6)
    for i in range(Z.shape[1]):
        out[f"z{i+1}"] = Z[:, i].round(6)

    pout = OUTPUT / (out_name or f"player_dec_labels_k{k}.parquet")
    out.to_parquet(pout, index=False)
    print(f"\nGuardado: {pout}  ({len(out):,} filas, {out.shape[1]} cols)")

    # ponytail: self-check mínimo — q suma 1 por fila, k columnas
    assert np.allclose(Q.sum(1), 1.0, atol=1e-4), "q no normaliza"
    assert Q.shape == (len(df), k), f"shape q {Q.shape}"
    print(f"  self-check OK: q={Q.shape}, K={k}, normaliza 1/fila")


if __name__ == "__main__":
    k, out_name = _args()
    main(k, out_name)