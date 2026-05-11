import os
import requests
from config import STATS_BOMB_URL
import pandas as pd

def download_raw_competitions():
    # Crear carpeta
    os.makedirs("data/raw", exist_ok=True)

    # URL RAW
    url = f"{STATS_BOMB_URL}/competitions.json"

    if os.path.exists("data/raw/competitions.json"):
        print("El archivo competitions.json ya existe. No se descarga.")
        return

    # Descargar
    response = requests.get(url)

    # Guardar
    with open("data/raw/competitions.json", "wb") as f:
        f.write(response.content)

    print("competitions.json descargado correctamente")

def transform_raw_competitions(json_path):
    os.makedirs("data/processed/parquet", exist_ok=True)

    df_competitions = pd.read_json(json_path)

    # =========================
    # PARSE DE FECHAS
    # =========================

    df_competitions["match_updated"] = pd.to_datetime(
        df_competitions["match_updated"],
        errors="coerce"
    )

    df_competitions["match_available"] = pd.to_datetime(
        df_competitions["match_updated"],
        errors="coerce"
    )


    df_competitions["match_updated_360"] = pd.to_datetime(
        df_competitions["match_updated_360"],
        errors="coerce"
    )

    df_competitions["match_available_360"] = pd.to_datetime(
        df_competitions["match_available_360"],
        errors="coerce"
    )

    # =========================
    # GUARDAR PARQUET
    # =========================

    parquet_path = "data/processed/parquet/competitions.parquet"
    df_competitions.to_parquet(parquet_path, index=False)
    print(f"Parquet guardado en: {parquet_path}")




if __name__ == "__main__":
    if os.path.exists("data/raw/competitions.json"):
        print("El archivo competitions.json ya existe. No se descarga.")
        json_path = "data/raw/competitions.json"
    else:
        json_path = download_raw_competitions()

    if os.path.exists("data/processed/parquet/competitions.parquet"):
        print("El archivo competitions.parquet ya existe. No se transforma.")
    else:
        transform_raw_competitions(json_path)