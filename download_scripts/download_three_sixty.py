import os
import json
import requests
import pandas as pd
import glob
from config import STATS_BOMB_URL

# =========================
# PATHS
# =========================

RAW_DIR = "data/raw/three_sixty"
PARQUET_DIR = "data/processed/three_sixty"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PARQUET_DIR, exist_ok=True)

# =========================
# LOAD MATCH IDS
# =========================

def load_all_match_ids(raw_dir=RAW_DIR):
    files = glob.glob(os.path.join(raw_dir, "*.json"))
    match_ids = []

    for f in files:
        try:
            match_ids.append(int(os.path.basename(f).replace(".json", "")))
        except:
            continue

    return sorted(match_ids)

# =========================
# DOWNLOAD
# =========================

def download_three_sixty(match_id):

    url = f"{STATS_BOMB_URL}/three-sixty/{match_id}.json"
    path = f"{RAW_DIR}/{match_id}.json"

    if os.path.exists(path):
        return path

    r = requests.get(url)

    if r.status_code != 200:
        raise Exception(f"No 360 data for match {match_id}")

    with open(path, "wb") as f:
        f.write(r.content)

    return path

# =========================
# LOAD JSON
# =========================

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# =========================
# EVENTS TABLE (SAFE)
# =========================

def extract_events_360(data, match_id):

    rows = []

    for e in data:

        # 🔥 FIX: NO lists/dicts in final table
        visible_area = e.get("visible_area")

        rows.append({
            "event_uuid": e.get("event_uuid"),
            "match_id": match_id,

            # safe flatten (no list issues later)
            "visible_area": json.dumps(visible_area) if visible_area is not None else None
        })

    return pd.DataFrame(rows)

# =========================
# FREEZE FRAME TABLE (NORMALIZED - BEST PRACTICE)
# =========================

def extract_freeze_frame(data, match_id):

    rows = []

    for e in data:

        event_uuid = e.get("event_uuid")

        for p in e.get("freeze_frame", []):

            loc = p.get("location") or [None, None]

            rows.append({
                "event_uuid": event_uuid,
                "match_id": match_id,

                "x": loc[0],
                "y": loc[1],

                "teammate": p.get("teammate"),
                "actor": p.get("actor"),
                "keeper": p.get("keeper"),
            })

    return pd.DataFrame(rows)

# =========================
# PROCESS MATCH
# =========================

def process_match(path):

    match_id = int(os.path.basename(path).replace(".json", ""))

    data = load_json(path)

    events_df = extract_events_360(data, match_id)
    freeze_df = extract_freeze_frame(data, match_id)

    return events_df, freeze_df

# =========================
# PIPELINE
# =========================

def run():

    match_ids = load_all_match_ids()

    all_events = []
    all_freeze = []

    for m in match_ids:

        try:
            path = download_three_sixty(m)

            events_df, freeze_df = process_match(path)

            all_events.append(events_df)
            all_freeze.append(freeze_df)

            print(f"OK 360 -> {m}")

        except Exception as e:
            print(f"SKIP {m}: {e}")

    # =========================
    # CONCAT SAFE
    # =========================

    events_final = pd.concat(all_events, ignore_index=True)
    freeze_final = pd.concat(all_freeze, ignore_index=True)

    # =========================
    # CLEAN (only for safety)
    # =========================

    events_final = events_final.drop_duplicates()
    freeze_final = freeze_final.drop_duplicates()

    # =========================
    # SAVE
    # =========================

    events_final.to_parquet(
        f"{PARQUET_DIR}/three_sixty_events.parquet",
        index=False
    )

    freeze_final.to_parquet(
        f"{PARQUET_DIR}/three_sixty_freeze_frame.parquet",
        index=False
    )

    print("\n360 PIPELINE COMPLETED SUCCESSFULLY")

# =========================
# MAIN
# =========================

if __name__ == "__main__":
    run()