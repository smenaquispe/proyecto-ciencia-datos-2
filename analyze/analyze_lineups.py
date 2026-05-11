import os
import glob
import pandas as pd
import numpy as np
import logging

from pandas.api.types import (
    is_numeric_dtype,
    is_string_dtype,
    is_object_dtype,
    is_datetime64_any_dtype
)

# =========================================================
# CONFIG
# =========================================================

PLAYERS_DIR = "data/processed/lineups/lineups_players.parquet"
POSITIONS_DIR = "data/processed/lineups/player_positions.parquet"

LOG_FILE = "logs_lineups.txt"

logging.basicConfig(
    filename=LOG_FILE,
    filemode="w",
    level=logging.INFO,
    format="%(message)s",
    encoding="utf-8"
)

logger = logging.getLogger()

def log(msg=""):
    logger.info(msg)

# =========================================================
# LEER DATASETS YA LIMPIOS
# =========================================================

players_df = pd.read_parquet(PLAYERS_DIR)
positions_df = pd.read_parquet(POSITIONS_DIR)

log("\n================ DATASET PLAYERS ================")
log(f"Shape: {players_df.shape}")
log(f"Columns: {players_df.columns.tolist()}")

log("\n================ DATASET POSITIONS ================")
log(f"Shape: {positions_df.shape}")
log(f"Columns: {positions_df.columns.tolist()}")

# =========================================================
# ANALISIS GENERAL FUNCTION
# =========================================================

def analyze_column(series):

    log(f"Tipo: {series.dtype}")
    log(f"Nulos: {series.isnull().sum()}")

    if is_numeric_dtype(series):
        log("NUMERICO")
        log(f"Min: {series.min()}")
        log(f"Max: {series.max()}")
        log(f"Mean: {series.mean()}")

    elif is_string_dtype(series):
        log("STRING")
        log(series.value_counts().head(10).to_string())

# =========================================================
# ANALISIS PLAYERS
# =========================================================

log("\n================ PLAYERS PROFILING ================")

for col in players_df.columns:
    log("\n" + "="*50)
    log(f"COLUMNA: {col}")
    log("="*50)
    analyze_column(players_df[col])

# =========================================================
# ANALISIS POSITIONS
# =========================================================

log("\n================ POSITIONS PROFILING ================")

for col in positions_df.columns:
    log("\n" + "="*50)
    log(f"COLUMNA: {col}")
    log("="*50)
    analyze_column(positions_df[col])

# =========================================================
# ANALISIS FUTBOLÍSTICO
# =========================================================

log("\n================ INSIGHTS FUTBOL ================")

# jugadores más usados
log("\nTOP PLAYERS")
log(players_df["player_name"].value_counts().head(15).to_string())

# equipos
log("\nTEAMS")
log(players_df["team_name"].value_counts().to_string())

# posiciones más usadas
log("\nPOSITIONS")
log(positions_df["position"].value_counts().head(15).to_string())

# razones de cambios
log("\nSTART REASONS")
log(positions_df["start_reason"].value_counts().to_string())

log(f"\nLOGS GUARDADOS EN: {LOG_FILE}")