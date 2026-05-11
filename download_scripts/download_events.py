import os
import json
import requests
import pandas as pd
import glob
from config import STATS_BOMB_URL

RAW_DIR = "data/raw/events"
PARQUET_DIR = "data/processed/events"
MATCHES_PARQUET_DIR = "data/processed/matches"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PARQUET_DIR, exist_ok=True)


# =========================
# MATCH IDS
# =========================

def load_all_match_ids(parquet_dir=MATCHES_PARQUET_DIR):

    files = glob.glob(os.path.join(parquet_dir, "*.parquet"))

    match_ids = set()

    for f in files:
        df = pd.read_parquet(f, columns=["match_id"])
        match_ids.update(df["match_id"].dropna().astype(int).tolist())

    return sorted(match_ids)


# =========================
# DOWNLOAD
# =========================

def download_events(match_id):

    url = f"{STATS_BOMB_URL}/events/{match_id}.json"
    path = f"{RAW_DIR}/{match_id}.json"

    if os.path.exists(path):
        return path

    r = requests.get(url)

    with open(path, "wb") as f:
        f.write(r.content)

    return path


# =========================
# SAFE
# =========================

def safe(x):
    return x if isinstance(x, dict) else {}


# =========================
# LOAD JSON
# =========================

def load_json(path):

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# =========================
# EVENTS FACT
# =========================

def extract_events(data, match_id):

    def extract_end_location(event: dict) -> tuple:
        """Return (end_x, end_y) from carry/pass/shot end_location when present."""

        carry = safe(event.get("carry"))
        if isinstance(carry.get("end_location"), list):
            end_loc = carry.get("end_location")
            return end_loc[0], end_loc[1]

        pas = safe(event.get("pass"))
        if isinstance(pas.get("end_location"), list):
            end_loc = pas.get("end_location")
            return end_loc[0], end_loc[1]

        shot = safe(event.get("shot"))
        if isinstance(shot.get("end_location"), list):
            end_loc = shot.get("end_location")
            return end_loc[0], end_loc[1]

        return None, None

    rows = []

    for e in data:

        e = safe(e)

        end_x, end_y = extract_end_location(e)
        shot = safe(e.get("shot"))
        shot_outcome = safe(shot.get("outcome")).get("name")
        related_events = e.get("related_events")

        rows.append({
            "event_id": e.get("id"),
            "match_id": match_id,
            "index": e.get("index"),
            "period": e.get("period"),
            "timestamp": e.get("timestamp"),
            "minute": e.get("minute"),
            "second": e.get("second"),

            "event_type_id": safe(e.get("type")).get("id"),
            "event_type_name": safe(e.get("type")).get("name"),

            "team_id": safe(e.get("team")).get("id"),
            "team_name": safe(e.get("team")).get("name"),

            "possession": e.get("possession"),
            "possession_team_id": safe(e.get("possession_team")).get("id"),

            "play_pattern_id": safe(e.get("play_pattern")).get("id"),
            "play_pattern_name": safe(e.get("play_pattern")).get("name"),

            "duration": e.get("duration"),

            "under_pressure": e.get("under_pressure"),
            "related_events": json.dumps(related_events) if isinstance(related_events, list) else None,
            "shot_outcome": shot_outcome,

            # coordinates
            "x": (e.get("location")[0] if isinstance(e.get("location"), list) else None),
            "y": (e.get("location")[1] if isinstance(e.get("location"), list) else None),

            "end_x": end_x,
            "end_y": end_y,
        })

    return pd.DataFrame(rows)


# =========================
# TACTICS LINEUP (🔥 IMPORTANT)
# =========================

def extract_tactics_lineup(data, match_id):

    rows = []

    for e in data:

        e = safe(e)

        tactics = e.get("tactics")

        if not tactics:
            continue

        formation = tactics.get("formation")

        team_id = safe(e.get("team")).get("id")

        for p in tactics.get("lineup", []):

            p = safe(p)

            player = safe(p.get("player"))
            position = safe(p.get("position"))

            rows.append({
                "event_id": e.get("id"),
                "match_id": match_id,
                "team_id": team_id,

                "formation": formation,

                "player_id": player.get("id"),
                "player_name": player.get("name"),

                "position_id": position.get("id"),
                "position_name": position.get("name"),

                "jersey_number": p.get("jersey_number"),
            })

    return pd.DataFrame(rows)


# =========================
# PROCESS MATCH
# =========================

def process_match(path):

    match_id = int(os.path.basename(path).replace(".json", ""))

    data = load_json(path)

    events_df = extract_events(data, match_id)
    lineup_df = extract_tactics_lineup(data, match_id)

    return events_df, lineup_df


# =========================
# PIPELINE
# =========================

def run():

    match_ids = load_all_match_ids()

    all_events = []
    all_lineups = []

    for m in match_ids:

        try:
            path = download_events(m)

            events_df, lineup_df = process_match(path)

            all_events.append(events_df)
            all_lineups.append(lineup_df)

            print(f"OK events -> {m}")

        except Exception as e:
            print(f"ERROR {m}: {e}")

    # =========================
    # FINAL
    # =========================

    events_final = pd.concat(all_events, ignore_index=True).drop_duplicates()
    lineup_final = pd.concat(all_lineups, ignore_index=True).drop_duplicates()

    # =========================
    # SAVE
    # =========================

    events_final.to_parquet(
        f"{PARQUET_DIR}/events_fact.parquet",
        index=False
    )

    lineup_final.to_parquet(
        f"{PARQUET_DIR}/event_tactics_lineup.parquet",
        index=False
    )

    print("\nEVENTS PIPELINE COMPLETED")


# =========================
# MAIN
# =========================

if __name__ == "__main__":
    run()