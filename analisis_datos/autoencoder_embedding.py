"""
Autoencoder para reducir la dimensionalidad del vector enriquecido
(original 23 + tácticas ~35 = ~58 vars → 10 dims latentes).

Inspirado en el paper "How Do Football Teams Play?" — pero usando
el bottleneck como embedding para Fuzzy C-Means en lugar de DEC.

Output:
  - analisis_datos/player_embedding.parquet  (player_id + z1..z10)
  - analisis_datos/autoencoder.pt             (state_dict)
  - analisis_datos/autoencoder_reconstruction_error.txt
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / "analisis_datos"

SEED = 42
LATENT_DIM = 10
EPOCHS = 300
BATCH_SIZE = 128
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-5


# ─── Autoencoder architecture ───────────────────────────────────────────────

class Autoencoder(nn.Module):
    def __init__(self, input_dim: int, latent_dim: int = LATENT_DIM):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 40),
            nn.ReLU(),
            nn.Linear(40, 20),
            nn.ReLU(),
            nn.Linear(20, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 20),
            nn.ReLU(),
            nn.Linear(20, 40),
            nn.ReLU(),
            nn.Linear(40, input_dim),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z = self.encoder(x)
        x_hat = self.decoder(z)
        return x_hat, z

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        return self.encoder(x)


def train_autoencoder() -> Autoencoder:
    print("Cargando datos enriquecidos escalados...")
    df = pd.read_parquet(OUTPUT / "player_enriched_scaled.parquet")

    META_COLS = ["player_id", "player_name", "dominant_position", "total_minutes", "matches_played"]
    feature_cols = [c for c in df.columns if c not in META_COLS]
    X = df[feature_cols].values.astype(np.float32)
    input_dim = X.shape[1]
    print(f"Input dim: {input_dim}, Jugadores: {len(df):,}")

    # Set seeds
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    X_tensor = torch.tensor(X, dtype=torch.float32, device=device)
    dataset = TensorDataset(X_tensor)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = Autoencoder(input_dim, LATENT_DIM).to(device)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)

    best_loss = float("inf")
    patience = 20
    no_improve = 0

    print(f"\nEntrenando autoencoder ({EPOCHS} épocas max)...")
    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = 0.0
        for batch in loader:
            x_batch = batch[0]
            x_hat, _ = model(x_batch)
            loss = criterion(x_hat, x_batch)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(x_batch)

        avg_loss = total_loss / len(df)
        if avg_loss < best_loss:
            best_loss = avg_loss
            no_improve = 0
            best_state = model.state_dict().copy()
        else:
            no_improve += 1

        if epoch % 25 == 0 or epoch == 1:
            print(f"  Época {epoch:3d}/{EPOCHS}  loss = {avg_loss:.6f}  (best = {best_loss:.6f})")

        if no_improve >= patience:
            print(f"  Early stopping en época {epoch}")
            break

    # Load best model
    model.load_state_dict(best_state)

    # Compute reconstruction error
    model.eval()
    with torch.no_grad():
        x_hat_full, z_full = model(X_tensor)
        recon_loss = criterion(x_hat_full, X_tensor).item()
        print(f"\nReconstruction error (MSE): {recon_loss:.6f}")

    # Extract embeddings
    embeddings = z_full.cpu().numpy()

    # Save embedding parquet
    emb_cols = [f"z{i+1}" for i in range(LATENT_DIM)]
    emb_df = pd.DataFrame(embeddings, columns=emb_cols)
    emb_df.insert(0, "player_id", df["player_id"].values)
    emb_out = OUTPUT / "player_embedding.parquet"
    emb_df.to_parquet(emb_out, index=False)
    print(f"Embeddings guardados: {emb_out}  ({len(emb_df):,} x {LATENT_DIM})")

    # Save model
    model_out = OUTPUT / "autoencoder.pt"
    torch.save(model.state_dict(), model_out)
    print(f"Modelo guardado: {model_out}")

    # Save reconstruction error
    err_out = OUTPUT / "autoencoder_reconstruction_error.txt"
    err_out.write_text(f"{recon_loss:.6f}\n")
    print(f"Error guardado: {err_out}")

    return model


if __name__ == "__main__":
    train_autoencoder()
