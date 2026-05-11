import os
import json
import requests
import pandas as pd
import glob
from config import STATS_BOMB_URL

RAW_DIR = "data/raw/lineups"
PARQUET_DIR = "data/processed/lineups"
MATCHES_PARQUET_DIR = "data/processed/matches"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PARQUET_DIR, exist_ok=True)


# =========================
# MATCH IDS
# =========================

def load_all_match_ids(parquet_dir=MATCHES_PARQUET_DIR):

    parquet_files = glob.glob(os.path.join(parquet_dir, "*.parquet"))

    if not parquet_files:
        raise ValueError("No matches parquet found")

    match_ids = set()

    for file in parquet_files:
        df = pd.read_parquet(file, columns=["match_id"])
        match_ids.update(df["match_id"].dropna().astype(int).tolist())

    return sorted(match_ids)


# =========================
# DOWNLOAD
# =========================

def download_lineups(match_id):

    url = f"{STATS_BOMB_URL}/lineups/{match_id}.json"
    json_path = f"{RAW_DIR}/{match_id}.json"

    if os.path.exists(json_path):
        return json_path

    r = requests.get(url)

    with open(json_path, "wb") as f:
        f.write(r.content)

    return json_path


# =========================
# SAFE
# =========================

def safe(x):
    return x if isinstance(x, dict) else {}


# =========================
# LOAD JSON
# =========================

def load_json(json_path):

    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


# =========================
# PLAYER DIM (MATCH SNAPSHOT)
# =========================

def extract_match_players(data, match_id):

    rows = []

    for team in data:

        team = safe(team)

        for player in team.get("lineup", []):

            player = safe(player)
            country = safe(player.get("country"))

            rows.append({
                "match_id": match_id,
                "team_id": team.get("team_id"),
                "player_id": player.get("player_id"),
                "player_name": player.get("player_name"),
                "player_nickname": player.get("player_nickname"),
                "jersey_number": player.get("jersey_number"),
                "country_id": country.get("id"),
                "country_name": country.get("name"),
            })

    return pd.DataFrame(rows)


# =========================
# POSITION FACT (TIME SERIES)
# =========================

def extract_player_positions(data, match_id):

    rows = []

    for team in data:

        team = safe(team)

        for player in team.get("lineup", []):

            player = safe(player)

            for pos in player.get("positions", []):

                pos = safe(pos)

                rows.append({
                    "match_id": match_id,
                    "team_id": team.get("team_id"),
                    "player_id": player.get("player_id"),

                    "position_id": pos.get("position_id"),
                    "position": pos.get("position"),

                    "from_time": pos.get("from"),
                    "to_time": pos.get("to"),

                    "from_period": pos.get("from_period"),
                    "to_period": pos.get("to_period"),

                    "start_reason": pos.get("start_reason"),
                    "end_reason": pos.get("end_reason"),
                })

    return pd.DataFrame(rows)


# =========================
# PROCESS MATCH
# =========================

def process_match(json_path):

    match_id = int(os.path.basename(json_path).replace(".json", ""))

    data = load_json(json_path)

    players_df = extract_match_players(data, match_id)
    positions_df = extract_player_positions(data, match_id)

    return players_df, positions_df


# =========================
# PIPELINE
# =========================

def run():

    match_ids = load_all_match_ids()

    all_players = []
    all_positions = []

    for match_id in match_ids:

        try:
            json_path = download_lineups(match_id)

            players_df, positions_df = process_match(json_path)

            all_players.append(players_df)
            all_positions.append(positions_df)

            print(f"OK lineups -> {match_id}")

        except Exception as e:
            print(f"ERROR {match_id}: {e}")

    # =========================
    # FINAL DATASETS
    # =========================

    players_final = pd.concat(all_players, ignore_index=True).drop_duplicates()
    positions_final = pd.concat(all_positions, ignore_index=True).drop_duplicates()

    # =========================
    # SAVE
    # =========================

    players_final.to_parquet(
        f"{PARQUET_DIR}/match_lineup_players.parquet",
        index=False
    )

    positions_final.to_parquet(
        f"{PARQUET_DIR}/player_match_position_fact.parquet",
        index=False
    )

    print("\nLINEUPS PIPELINE COMPLETED")


# =========================
# MAIN
# =========================

if __name__ == "__main__":
    run()