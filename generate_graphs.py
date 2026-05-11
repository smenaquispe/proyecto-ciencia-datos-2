from __future__ import annotations

import math
from pathlib import Path

import duckdb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "statsbomb.duckdb"
OUTPUT_DIR = BASE_DIR / "output"
FIG_DIR = OUTPUT_DIR / "figures"
TABLE_DIR = OUTPUT_DIR / "tables"

sns.set_theme(style="whitegrid", context="talk")


TABLES = {
    "events_fact": "data/processed/events/events_fact.parquet",
    "matches_fact": "data/processed/matches/matches_fact.parquet",
    "match_lineup_players": "data/processed/lineups/match_lineup_players.parquet",
    "player_match_position_fact": "data/processed/lineups/player_match_position_fact.parquet",
    "manager_team_match_bridge": "data/processed/dimensions/manager_team_match_bridge.parquet",
    "competitions": "data/processed/parquet/competitions.parquet",
    "three_sixty_events": "data/processed/three_sixty/three_sixty_events.parquet",
    "three_sixty_freeze_frame": "data/processed/three_sixty/three_sixty_freeze_frame.parquet",
}


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    TABLE_DIR.mkdir(parents=True, exist_ok=True)


def connect() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect(str(DB_PATH))
    conn.execute("SET memory_limit='2GB'")
    return conn


def register_views(conn: duckdb.DuckDBPyConnection) -> None:
    for view_name, parquet_path in TABLES.items():
        conn.execute(
            f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_parquet('{parquet_path}')"
        )


def get_numeric_columns(conn: duckdb.DuckDBPyConnection, table_sql: str) -> list[str]:
    info = conn.execute(f"DESCRIBE SELECT * FROM {table_sql}").fetchdf()
    numeric_types = {"BIGINT", "INTEGER", "DOUBLE", "FLOAT", "REAL", "SMALLINT", "TINYINT", "HUGEINT"}
    return [row.column_name for row in info.itertuples() if str(row.column_type).upper() in numeric_types]


def save_df(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False)


def plot_histogram_from_sql(
    conn: duckdb.DuckDBPyConnection,
    table_sql: str,
    column: str,
    out_path: Path,
    bins: int = 30,
    title: str | None = None,
) -> None:
    stats = conn.execute(
        f"SELECT MIN({column}) AS min_v, MAX({column}) AS max_v FROM {table_sql} WHERE {column} IS NOT NULL"
    ).fetchone()
    min_v, max_v = stats
    if min_v is None or max_v is None:
        return

    if float(max_v) == float(min_v):
        data = conn.execute(
            f"SELECT {column} AS value, COUNT(*) AS freq FROM {table_sql} WHERE {column} IS NOT NULL GROUP BY 1 ORDER BY 1"
        ).fetchdf()
        plt.figure(figsize=(10, 5))
        plt.bar(data["value"].astype(str), data["freq"], color="#2a9d8f")
        plt.xticks(rotation=45, ha="right")
        plt.title(title or f"Distribucion de {column}")
        plt.tight_layout()
        plt.savefig(out_path, dpi=180)
        plt.close()
        return

    width = (float(max_v) - float(min_v)) / bins
    width = width if width > 0 else 1.0
    data = conn.execute(
        f"""
        SELECT
            LEAST({bins - 1}, CAST(FLOOR((CAST({column} AS DOUBLE) - {float(min_v)}) / {width}) AS INTEGER)) AS bin_id,
            COUNT(*) AS freq
        FROM {table_sql}
        WHERE {column} IS NOT NULL
        GROUP BY 1
        ORDER BY 1
        """
    ).fetchdf()

    if data.empty:
        return

    bin_edges = np.linspace(float(min_v), float(max_v), bins + 1)
    labels = [f"{bin_edges[i]:.2f}-{bin_edges[i + 1]:.2f}" for i in range(len(bin_edges) - 1)]
    data["label"] = data["bin_id"].clip(0, bins - 1).astype(int).map(lambda i: labels[i])

    plt.figure(figsize=(12, 5))
    sns.barplot(data=data, x="label", y="freq", color="#2a9d8f")
    plt.xticks(rotation=60, ha="right")
    plt.xlabel(column)
    plt.ylabel("frecuencia")
    plt.title(title or f"Distribucion de {column}")
    plt.tight_layout()
    plt.savefig(out_path, dpi=180)
    plt.close()


def plot_boxplot_from_sql(
    conn: duckdb.DuckDBPyConnection,
    table_sql: str,
    column: str,
    out_path: Path,
    title: str | None = None,
) -> None:
    data = conn.execute(
        f"SELECT {column} AS value FROM {table_sql} WHERE {column} IS NOT NULL"
    ).fetchdf()
    if data.empty:
        return
    plt.figure(figsize=(10, 3.8))
    sns.boxplot(x=data["value"], color="#e76f51")
    plt.title(title or f"Boxplot de {column}")
    plt.xlabel(column)
    plt.tight_layout()
    plt.savefig(out_path, dpi=180)
    plt.close()


def plot_category_bar(
    conn: duckdb.DuckDBPyConnection,
    table_sql: str,
    column: str,
    out_path: Path,
    top_n: int = 20,
    title: str | None = None,
) -> None:
    data = conn.execute(
        f"""
        SELECT {column} AS category, COUNT(*) AS freq
        FROM {table_sql}
        WHERE {column} IS NOT NULL
        GROUP BY 1
        ORDER BY freq DESC, category
        LIMIT {top_n}
        """
    ).fetchdf()
    if data.empty:
        return
    plt.figure(figsize=(12, max(5, 0.35 * len(data) + 2)))
    sns.barplot(data=data, y="category", x="freq", color="#457b9d")
    plt.xlabel("frecuencia")
    plt.ylabel(column)
    plt.title(title or f"Frecuencias de {column}")
    plt.tight_layout()
    plt.savefig(out_path, dpi=180)
    plt.close()


def plot_corr_heatmap(
    conn: duckdb.DuckDBPyConnection,
    table_sql: str,
    columns: list[str],
    out_path: Path,
    title: str,
) -> None:
    if len(columns) < 2:
        return
    cols_sql = ", ".join(columns)
    corr_df = conn.execute(
        f"SELECT {cols_sql} FROM {table_sql} WHERE "
        + " AND ".join(f"{col} IS NOT NULL" for col in columns)
    ).fetchdf().corr(numeric_only=True)
    if corr_df.empty:
        return
    plt.figure(figsize=(max(8, 0.85 * len(columns)), max(6, 0.75 * len(columns))))
    sns.heatmap(corr_df, annot=True, fmt=".2f", cmap="RdBu_r", center=0, vmin=-1, vmax=1, square=True)
    plt.title(title)
    plt.tight_layout()
    plt.savefig(out_path, dpi=180)
    plt.close()


def write_summary_tables(conn: duckdb.DuckDBPyConnection, table_name: str, table_sql: str) -> None:
    describe_df = conn.execute(f"SUMMARIZE {table_sql}").fetchdf()
    save_df(describe_df, TABLE_DIR / f"{table_name}_summarize.csv")

    numeric_cols = get_numeric_columns(conn, table_sql)
    if len(numeric_cols) >= 2:
        cols_sql = ", ".join(numeric_cols)
        corr_df = conn.execute(
            f"SELECT {cols_sql} FROM {table_sql} WHERE "
            + " AND ".join(f"{col} IS NOT NULL" for col in numeric_cols)
        ).fetchdf().corr(numeric_only=True)
        corr_df.to_csv(TABLE_DIR / f"{table_name}_correlation.csv")


def build_events_report(conn: duckdb.DuckDBPyConnection) -> None:
    table_sql = "events_fact"
    write_summary_tables(conn, "events_fact", table_sql)

    for col in ["duration", "minute", "second", "x", "y"]:
        plot_histogram_from_sql(conn, table_sql, col, FIG_DIR / f"events_{col}_hist.png", title=f"Distribucion de {col} en eventos")
        plot_boxplot_from_sql(conn, table_sql, col, FIG_DIR / f"events_{col}_boxplot.png", title=f"Boxplot de {col} en eventos")

    for col in ["event_type_name", "play_pattern_name", "team_name"]:
        plot_category_bar(conn, table_sql, col, FIG_DIR / f"events_{col}_bar.png", top_n=20, title=f"Frecuencias de {col} en eventos")

    plot_corr_heatmap(
        conn,
        table_sql,
        ["index", "period", "minute", "second", "event_type_id", "team_id", "possession", "possession_team_id", "play_pattern_id", "duration", "x", "y"],
        FIG_DIR / "events_correlation_heatmap.png",
        "Correlacion entre features numericas de eventos",
    )


def build_matches_report(conn: duckdb.DuckDBPyConnection) -> None:
    table_sql = "matches_fact"
    write_summary_tables(conn, "matches_fact", table_sql)

    for col in ["home_score", "away_score", "match_week", "competition_stage_id"]:
        plot_histogram_from_sql(conn, table_sql, col, FIG_DIR / f"matches_{col}_hist.png", title=f"Distribucion de {col} en partidos")
        plot_boxplot_from_sql(conn, table_sql, col, FIG_DIR / f"matches_{col}_boxplot.png", title=f"Boxplot de {col} en partidos")

    for col in ["match_status_360", "competition_id", "season_id"]:
        plot_category_bar(conn, table_sql, col, FIG_DIR / f"matches_{col}_bar.png", top_n=20, title=f"Frecuencias de {col} en partidos")

    plot_corr_heatmap(
        conn,
        table_sql,
        ["competition_id", "season_id", "home_team_id", "away_team_id", "stadium_id", "home_score", "away_score", "match_week", "competition_stage_id"],
        FIG_DIR / "matches_correlation_heatmap.png",
        "Correlacion entre features numericas de partidos",
    )


def build_lineups_report(conn: duckdb.DuckDBPyConnection) -> None:
    table_sql = "match_lineup_players"
    write_summary_tables(conn, "match_lineup_players", table_sql)

    for col in ["jersey_number", "country_id"]:
        plot_histogram_from_sql(conn, table_sql, col, FIG_DIR / f"lineups_{col}_hist.png", title=f"Distribucion de {col} en alineaciones")
        plot_boxplot_from_sql(conn, table_sql, col, FIG_DIR / f"lineups_{col}_boxplot.png", title=f"Boxplot de {col} en alineaciones")

    for col in ["country_name"]:
        plot_category_bar(conn, table_sql, col, FIG_DIR / f"lineups_{col}_bar.png", top_n=20, title=f"Frecuencias de {col} en alineaciones")

    plot_corr_heatmap(
        conn,
        table_sql,
        ["match_id", "team_id", "player_id", "jersey_number", "country_id"],
        FIG_DIR / "lineups_correlation_heatmap.png",
        "Correlacion entre features numericas de alineaciones",
    )


def build_positions_report(conn: duckdb.DuckDBPyConnection) -> None:
    table_sql = "player_match_position_fact"
    write_summary_tables(conn, "player_match_position_fact", table_sql)

    for col in ["position_id", "from_period", "to_period"]:
        plot_histogram_from_sql(conn, table_sql, col, FIG_DIR / f"positions_{col}_hist.png", title=f"Distribucion de {col} en posiciones")
        plot_boxplot_from_sql(conn, table_sql, col, FIG_DIR / f"positions_{col}_boxplot.png", title=f"Boxplot de {col} en posiciones")

    for col in ["position", "start_reason", "end_reason"]:
        plot_category_bar(conn, table_sql, col, FIG_DIR / f"positions_{col}_bar.png", top_n=20, title=f"Frecuencias de {col} en posiciones")

    plot_corr_heatmap(
        conn,
        table_sql,
        ["match_id", "team_id", "player_id", "position_id", "from_period", "to_period"],
        FIG_DIR / "positions_correlation_heatmap.png",
        "Correlacion entre features numericas de posiciones",
    )


def build_manager_bridge_report(conn: duckdb.DuckDBPyConnection) -> None:
    table_sql = "manager_team_match_bridge"
    write_summary_tables(conn, "manager_team_match_bridge", table_sql)

    for col in ["match_id", "team_id", "manager_id"]:
        plot_histogram_from_sql(conn, table_sql, col, FIG_DIR / f"manager_bridge_{col}_hist.png", title=f"Distribucion de {col} en manager-team-match bridge")

    plot_category_bar(conn, table_sql, "role", FIG_DIR / "manager_bridge_role_bar.png", top_n=10, title="Frecuencias de role en manager-team-match bridge")

    plot_corr_heatmap(
        conn,
        table_sql,
        ["match_id", "team_id", "manager_id"],
        FIG_DIR / "manager_bridge_correlation_heatmap.png",
        "Correlacion entre features numericas del bridge manager-equipo-partido",
    )


def build_tracking_report(conn: duckdb.DuckDBPyConnection) -> None:
    table_sql = "three_sixty_freeze_frame"
    write_summary_tables(conn, "three_sixty_freeze_frame", table_sql)

    for col in ["x", "y"]:
        plot_histogram_from_sql(conn, table_sql, col, FIG_DIR / f"tracking_{col}_hist.png", title=f"Distribucion espacial de {col}")
        plot_boxplot_from_sql(conn, table_sql, col, FIG_DIR / f"tracking_{col}_boxplot.png", title=f"Boxplot espacial de {col}")

    sample_df = conn.execute(
        f"SELECT x, y, teammate, actor, keeper FROM {table_sql} WHERE x IS NOT NULL AND y IS NOT NULL LIMIT 200000"
    ).fetchdf()
    if not sample_df.empty:
        plt.figure(figsize=(8, 6))
        sns.scatterplot(data=sample_df, x="x", y="y", hue="teammate", alpha=0.25, s=10, palette="viridis", legend=False)
        plt.title("Nube espacial de freeze frames")
        plt.tight_layout()
        plt.savefig(FIG_DIR / "tracking_xy_scatter.png", dpi=180)
        plt.close()


def main() -> None:
    ensure_dirs()
    conn = connect()
    register_views(conn)

    build_events_report(conn)
    build_matches_report(conn)
    build_lineups_report(conn)
    build_positions_report(conn)
    build_manager_bridge_report(conn)
    build_tracking_report(conn)

    conn.close()
    print(f"Figures saved to: {FIG_DIR}")
    print(f"Summary tables saved to: {TABLE_DIR}")


if __name__ == "__main__":
    main()