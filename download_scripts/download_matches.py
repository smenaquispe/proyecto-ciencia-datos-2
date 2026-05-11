import os
import requests
import pandas as pd
from config import STATS_BOMB_URL

# =========================
# RUTAS
# =========================

RAW_DIR = "data/raw/matches"

BASE_DIR = "data/processed"
MATCHES_DIR = f"{BASE_DIR}/matches"
DIM_DIR = f"{BASE_DIR}/dimensions"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(MATCHES_DIR, exist_ok=True)
os.makedirs(DIM_DIR, exist_ok=True)

# =========================
# COMPETITIONS
# =========================

def load_competitions():
    return pd.read_parquet("data/processed/parquet/competitions.parquet")

# =========================
# DOWNLOAD
# =========================

def download_matches(competition_id, season_id):

    url = f"{STATS_BOMB_URL}/matches/{competition_id}/{season_id}.json"
    json_path = f"{RAW_DIR}/{competition_id}_{season_id}.json"

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
# TRANSFORM
# =========================

def transform(json_path):

    df = pd.read_json(json_path)

    df["match_date"] = pd.to_datetime(df["match_date"], errors="coerce")

    df["kick_off"] = pd.to_datetime(
        df["kick_off"],
        format="%H:%M:%S.%f",
        errors="coerce"
    ).dt.time

    df["match_datetime"] = pd.to_datetime(
        df["match_date"].astype(str) + " " + df["kick_off"].astype(str),
        errors="coerce"
    )

    return df

# =========================
# CLEAN
# =========================

def clean(df):
    for col in df.columns:
        df[col] = df[col].apply(
            lambda x: x if isinstance(x, (int, float, str, pd.Timestamp))
            else str(x)
        )
    return df

# =========================
# COMPETITION - TEAM - GROUP
# =========================

def build_competition_team_group(df):

    comp = df["competition"].apply(safe).apply(pd.Series)
    season = df["season"].apply(safe).apply(pd.Series)

    home = df["home_team"].apply(safe).apply(pd.Series)
    away = df["away_team"].apply(safe).apply(pd.Series)

    home_df = pd.DataFrame({
        "competition_id": comp["competition_id"],
        "season_id": season["season_id"],
        "team_id": home.get("home_team_id"),
        "group": home.get("home_team_group")
    })

    away_df = pd.DataFrame({
        "competition_id": comp["competition_id"],
        "season_id": season["season_id"],
        "team_id": away.get("away_team_id"),
        "group": away.get("away_team_group")
    })

    df_out = pd.concat([home_df, away_df], ignore_index=True)

    df_out = df_out.dropna(subset=["team_id"])
    df_out = df_out.drop_duplicates()

    return df_out

# =========================
# TEAM DIM
# =========================

def build_team_dim(df):

    home = df["home_team"].apply(safe).apply(pd.Series)
    away = df["away_team"].apply(safe).apply(pd.Series)

    home = home.rename(columns={
        "home_team_id": "team_id",
        "home_team_name": "team_name",
        "home_team_gender": "gender"
    })

    away = away.rename(columns={
        "away_team_id": "team_id",
        "away_team_name": "team_name",
        "away_team_gender": "gender"
    })

    teams = pd.concat([home, away], ignore_index=True)

    teams["country_id"] = teams["country"].apply(lambda x: safe(x).get("id"))
    teams["country_name"] = teams["country"].apply(lambda x: safe(x).get("name"))

    teams = teams.drop(columns=["country", "managers", "home_team_group", "away_team_group"], errors="ignore")

    teams = teams.drop_duplicates()

    return teams

# =========================
# MANAGER DIM
# =========================

def build_manager_dim(df):

    rows = []

    for _, r in df.iterrows():
        for side in ["home_team", "away_team"]:

            team = safe(r.get(side))

            for m in team.get("managers", []):

                rows.append({
                    "manager_id": m.get("id"),
                    "manager_name": m.get("name"),
                    "dob": m.get("dob"),
                    "country_id": safe(m.get("country")).get("id"),
                    "country_name": safe(m.get("country")).get("name"),
                })

    return pd.DataFrame(rows)

# =========================
# MANAGER - TEAM - MATCH BRIDGE
# =========================

def build_manager_team_match_bridge(df):

    rows = []

    for _, r in df.iterrows():

        match_id = r["match_id"]

        for side in ["home_team", "away_team"]:

            team = safe(r.get(side))

            team_id = team.get("home_team_id") if side == "home_team" else team.get("away_team_id")

            for m in team.get("managers", []):

                rows.append({
                    "match_id": match_id,
                    "team_id": team_id,
                    "manager_id": m.get("id"),
                    "role": side.replace("_team", "")
                })

    return pd.DataFrame(rows)

# =========================
# STADIUM DIM
# =========================

def build_stadium_dim(df):

    st = df["stadium"].apply(safe).apply(pd.Series)

    st["country_id"] = st["country"].apply(lambda x: safe(x).get("id"))
    st["country_name"] = st["country"].apply(lambda x: safe(x).get("name"))

    st = st.drop(columns=["country"], errors="ignore")

    return st

# =========================
# COMPETITION DIM
# =========================

def build_competition_dim(df):
    return df["competition"].apply(safe).apply(pd.Series)

# =========================
# SEASON DIM
# =========================

def build_season_dim(df):
    return df["season"].apply(safe).apply(pd.Series)

# =========================
# MATCH FACT
# =========================

def build_matches_fact(df):

    comp = df["competition"].apply(safe).apply(pd.Series)
    season = df["season"].apply(safe).apply(pd.Series)
    stadium = df["stadium"].apply(safe).apply(pd.Series)

    return pd.DataFrame({
        "match_id": df["match_id"],
        "match_date": df["match_date"],
        "kick_off": df["kick_off"],
        "match_datetime": df["match_datetime"],
        "competition_id": comp["competition_id"],
        "season_id": season["season_id"],
        "home_team_id": df["home_team"].apply(lambda x: safe(x).get("home_team_id")),
        "away_team_id": df["away_team"].apply(lambda x: safe(x).get("away_team_id")),
        "stadium_id": stadium["id"],
        "home_score": df["home_score"],
        "away_score": df["away_score"],
        "match_week": df["match_week"],
        "match_status": df["match_status"],
        "match_status_360": df["match_status_360"],
        "competition_stage_id": df["competition_stage"].apply(lambda x: safe(x).get("id")),
        "competition_stage_name": df["competition_stage"].apply(lambda x: safe(x).get("name"))
    })

# =========================
# PIPELINE
# =========================

def run():

    comps = load_competitions()

    all_team = []
    all_manager = []
    all_stadium = []
    all_comp = []
    all_season = []
    all_matches = []
    all_team_group = []
    all_manager_team_match = []

    for _, comp in comps.iterrows():

        comp_id = comp["competition_id"]
        season_id = comp["season_id"]

        print(f"Processing {comp_id}-{season_id}")

        json_path = download_matches(comp_id, season_id)
        df = transform(json_path)

        # =========================
        # BUILD
        # =========================
        team_dim = build_team_dim(df)
        manager_dim = build_manager_dim(df)
        stadium_dim = build_stadium_dim(df)
        comp_dim = build_competition_dim(df)
        season_dim = build_season_dim(df)
        matches_fact = build_matches_fact(df)

        team_group_dim = build_competition_team_group(df)
        manager_team_match_dim = build_manager_team_match_bridge(df)

        # =========================
        # ACCUMULATE
        # =========================
        all_team.append(team_dim)
        all_manager.append(manager_dim)
        all_stadium.append(stadium_dim)
        all_comp.append(comp_dim)
        all_season.append(season_dim)
        all_matches.append(matches_fact)
        all_team_group.append(team_group_dim)
        all_manager_team_match.append(manager_team_match_dim)

    # =========================
    # FINAL CONCAT
    # =========================

    team_final = clean(pd.concat(all_team)).drop_duplicates()
    manager_final = clean(pd.concat(all_manager)).drop_duplicates()
    stadium_final = clean(pd.concat(all_stadium)).drop_duplicates()
    comp_final = clean(pd.concat(all_comp)).drop_duplicates()
    season_final = clean(pd.concat(all_season)).drop_duplicates()
    team_group_final = clean(pd.concat(all_team_group)).drop_duplicates()
    manager_team_match_final = clean(pd.concat(all_manager_team_match)).drop_duplicates()
    matches_final = pd.concat(all_matches, ignore_index=True)

    # =========================
    # SAVE
    # =========================

    team_final.to_parquet(f"{DIM_DIR}/team_dim.parquet", index=False)
    manager_final.to_parquet(f"{DIM_DIR}/manager_dim.parquet", index=False)
    stadium_final.to_parquet(f"{DIM_DIR}/stadium_dim.parquet", index=False)
    comp_final.to_parquet(f"{DIM_DIR}/competition_dim.parquet", index=False)
    season_final.to_parquet(f"{DIM_DIR}/season_dim.parquet", index=False)

    team_group_final.to_parquet(f"{DIM_DIR}/competition_team_group.parquet", index=False)
    manager_team_match_final.to_parquet(f"{DIM_DIR}/manager_team_match_bridge.parquet", index=False)

    matches_final.to_parquet(f"{MATCHES_DIR}/matches_fact.parquet", index=False)

    print("\nPIPELINE COMPLETED SUCCESSFULLY")

# =========================
# MAIN
# =========================

if __name__ == "__main__":
    run()