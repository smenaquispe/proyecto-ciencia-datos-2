from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_object_dtype,
    is_string_dtype,
)

BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
OUTPUT_DIR = BASE_DIR / "output"
FIG_DIR = OUTPUT_DIR / "figures"
TABLE_DIR = OUTPUT_DIR / "tables"

sns.set_theme(style="whitegrid", context="talk")
plt.rcParams["figure.dpi"] = 150

# =========================================================
# CONFIG: todas las tablas
# =========================================================

TABLES: dict[str, str | list[str]] = {
    "events_fact": "events/events_fact.parquet",
    "event_tactics_lineup": "events/event_tactics_lineup.parquet",
    "matches_fact": "matches/matches_fact.parquet",
    "match_lineup_players": "lineups/match_lineup_players.parquet",
    "player_match_position_fact": "lineups/player_match_position_fact.parquet",
    "competitions": "parquet/competitions.parquet",
    "three_sixty_events": "three_sixty/three_sixty_events.parquet",
    "three_sixty_freeze_frame": "three_sixty/three_sixty_freeze_frame.parquet",
    "competition_dim": "dimensions/competition_dim.parquet",
    "season_dim": "dimensions/season_dim.parquet",
    "team_dim": "dimensions/team_dim.parquet",
    "stadium_dim": "dimensions/stadium_dim.parquet",
    "manager_dim": "dimensions/manager_dim.parquet",
    "competition_team_group": "dimensions/competition_team_group.parquet",
    "team_group_dim": "dimensions/team_group_dim.parquet",
    "manager_team_match_bridge": "dimensions/manager_team_match_bridge.parquet",
}

# Tables > 50MB use DuckDB; small tables use pandas directly
LARGE_TABLES = {"events_fact", "three_sixty_events", "three_sixty_freeze_frame"}

GRANULARITY: dict[str, str] = {
    "events_fact": "1 fila = 1 evento de partido",
    "event_tactics_lineup": "1 fila = 1 jugador en formacion tactica de evento",
    "matches_fact": "1 fila = 1 partido",
    "match_lineup_players": "1 fila = 1 jugador alineado en un partido",
    "player_match_position_fact": "1 fila = 1 intervalo posicional de jugador en partido",
    "competitions": "1 fila = 1 competencia-temporada (crudo)",
    "three_sixty_events": "1 fila = 1 evento con area visible 360",
    "three_sixty_freeze_frame": "1 fila = 1 jugador en freeze frame 360",
    "competition_dim": "1 fila = 1 competencia (dimension)",
    "season_dim": "1 fila = 1 temporada (dimension)",
    "team_dim": "1 fila = 1 equipo (dimension)",
    "stadium_dim": "1 fila = 1 estadio (dimension)",
    "manager_dim": "1 fila = 1 manager (dimension)",
    "competition_team_group": "1 fila = 1 equipo en competencia con grupo",
    "team_group_dim": "1 fila = 1 equipo en competencia con grupo (dim)",
    "manager_team_match_bridge": "1 fila = 1 relacion manager-equipo-partido",
}


def save_csv(df: pd.DataFrame, name: str) -> None:
    out = TABLE_DIR / name
    df.to_csv(out, index=False)
    print(f"  Saved: {out}")


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    TABLE_DIR.mkdir(parents=True, exist_ok=True)


def get_parquet_path(name: str) -> Path:
    return PROCESSED_DIR / TABLES[name]


def load_small_table(name: str) -> pd.DataFrame:
    path = get_parquet_path(name)
    return pd.read_parquet(path)


def query_large(query: str) -> pd.DataFrame:
    conn = duckdb.connect()
    conn.execute("SET memory_limit='2GB'")
    result = conn.execute(query).fetchdf()
    conn.close()
    return result


def load_numeric_sample(name: str, max_rows: int = 100_000) -> pd.DataFrame:
    """Load numeric columns via DuckDB with sampling for large tables."""
    path = get_parquet_path(name)
    # get schema first
    schema_query = f"DESCRIBE SELECT * FROM read_parquet('{path}')"
    conn = duckdb.connect()
    conn.execute("SET memory_limit='2GB'")
    schema = conn.execute(schema_query).fetchdf()
    conn.close()
    numeric_cols = schema[
        schema["column_type"].str.upper().isin(
            {"BIGINT", "INTEGER", "DOUBLE", "FLOAT", "REAL", "SMALLINT", "TINYINT", "HUGEINT"}
        )
    ]["column_name"].tolist()
    if not numeric_cols:
        return pd.DataFrame()
    cols_sql = ", ".join(numeric_cols)
    sql = f"SELECT {cols_sql} FROM read_parquet('{path}') TABLESAMPLE ({max_rows} ROWS)"
    return query_large(sql)


def get_shape(name: str) -> tuple[int, int]:
    path = get_parquet_path(name)
    sql = f"SELECT COUNT(*) AS cnt, COUNT(COLUMNS(*)) AS cols FROM read_parquet('{path}')"
    result = query_large(sql)
    return int(result["cnt"].iloc[0]), 0  # cols from schema


def get_schema(name: str) -> pd.DataFrame:
    path = get_parquet_path(name)
    sql = f"DESCRIBE SELECT * FROM read_parquet('{path}')"
    return query_large(sql)


def is_integer_like(series: pd.Series) -> bool:
    if is_bool_dtype(series):
        return False
    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return False
    return bool(np.allclose(valid, np.round(valid)))


def classify_quantity(series: pd.Series) -> str:
    if is_bool_dtype(series):
        return "discreta_bool"
    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return "sin_datos"
    if is_integer_like(series):
        return "discreta_entera"
    unique_ratio = valid.nunique() / len(valid)
    if unique_ratio <= 0.15:
        return "discreta_baja_cardinalidad"
    return "continua"


def detect_outliers_iqr(series: pd.Series) -> dict:
    if is_bool_dtype(series):
        return {"outlier_count": 0, "outlier_pct": 0.0, "lower": None, "upper": None}
    numeric = pd.to_numeric(series, errors="coerce").astype("float64")
    valid = numeric.dropna()
    if len(valid) < 4:
        return {"outlier_count": 0, "outlier_pct": 0.0, "lower": None, "upper": None}
    q1 = valid.quantile(0.25)
    q3 = valid.quantile(0.75)
    iqr = q3 - q1
    if pd.isna(iqr) or iqr == 0:
        return {"outlier_count": 0, "outlier_pct": 0.0, "lower": float(q1), "upper": float(q3)}
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    mask = (valid < lower) | (valid > upper)
    count = int(mask.sum())
    return {
        "outlier_count": count,
        "outlier_pct": round((count / len(valid)) * 100, 2),
        "lower": round(float(lower), 4),
        "upper": round(float(upper), 4),
    }


# =========================================================
# 1. RESUMEN GLOBAL
# =========================================================

def build_global_summary() -> pd.DataFrame:
    rows = []
    for name in TABLES:
        try:
            path = get_parquet_path(name)
            schema = get_schema(name)
            n_cols = len(schema)
            n_rows = get_shape(name)[0]

            null_conditions = " + ".join(
                f"SUM(CASE WHEN \"{r['column_name']}\" IS NULL THEN 1 ELSE 0 END)"
                for _, r in schema.iterrows()
            )
            total_nulls = int(query_large(
                f"SELECT {null_conditions} AS total_nulls FROM read_parquet('{path}')"
            ).iloc[0, 0])

            total_cells = n_rows * n_cols

            # approximate duplicate count
            try:
                dup_result = query_large(f"SELECT COUNT(*) - COUNT(DISTINCT *) AS dup FROM read_parquet('{path}')")
                dup = int(dup_result.iloc[0, 0])
            except Exception:
                dup = 0

            rows.append({
                "tabla": name,
                "granularidad": GRANULARITY.get(name, ""),
                "filas": n_rows,
                "columnas": n_cols,
                "nulos_total": total_nulls,
                "nulos_pct": round((total_nulls / total_cells) * 100, 2) if total_cells else 0,
                "duplicados": dup,
                "duplicados_pct": round((dup / n_rows) * 100, 2) if n_rows else 0,
                "error": "",
            })
        except Exception as e:
            rows.append({"tabla": name, "granularidad": "", "filas": None, "columnas": None,
                         "nulos_total": None, "nulos_pct": None, "duplicados": None,
                         "duplicados_pct": None, "error": str(e)})
    return pd.DataFrame(rows)


# =========================================================
# 2. PERFIL POR COLUMNA
# =========================================================

def profile_column(series: pd.Series) -> dict:
    n_total = len(series)
    n_nulls = int(series.isna().sum())
    null_pct = round((n_nulls / n_total) * 100, 2) if n_total else 0
    n_unique = int(series.nunique(dropna=False))

    info: dict = {
        "dtype": str(series.dtype),
        "nulos": n_nulls,
        "nulos_pct": null_pct,
        "unicos": n_unique,
    }

    if is_bool_dtype(series):
        info["tipo"] = "categorica_bool"
    elif is_numeric_dtype(series):
        info["tipo"] = classify_quantity(series)
        numeric = pd.to_numeric(series, errors="coerce").astype("float64")
        info["min"] = round(float(numeric.min()), 4) if not numeric.isna().all() else None
        info["max"] = round(float(numeric.max()), 4) if not numeric.isna().all() else None
        info["mean"] = round(float(numeric.mean()), 4) if not numeric.isna().all() else None
        info["median"] = round(float(numeric.median()), 4) if not numeric.isna().all() else None
        info["std"] = round(float(numeric.std()), 4) if not numeric.isna().all() else None
        info["p25"] = round(float(numeric.quantile(0.25)), 4) if not numeric.isna().all() else None
        info["p75"] = round(float(numeric.quantile(0.75)), 4) if not numeric.isna().all() else None
        outliers = detect_outliers_iqr(series)
        info.update(outliers)
        valid = numeric.dropna()
        if len(valid) > 2:
            info["skew"] = round(float(valid.skew()), 4)
            info["kurtosis"] = round(float(valid.kurtosis()), 4)
    elif is_string_dtype(series) or is_bool_dtype(series):
        info["tipo"] = "categorica"
    elif is_datetime64_any_dtype(series):
        info["tipo"] = "temporal"
    elif is_object_dtype(series):
        info["tipo"] = "object"
    else:
        info["tipo"] = "otro"

    return info


def profile_table_via_duckdb(name: str) -> pd.DataFrame | None:
    """Profile a large table via DuckDB aggregate queries."""
    path = get_parquet_path(name)
    schema = get_schema(name)

    rows = []
    for _, row in schema.iterrows():
        col = row["column_name"]
        dtype = row["column_type"]
        col_quoted = f'"{col}"'

        basic = query_large(f"""
            SELECT
                COUNT(*) AS n_total,
                SUM(CASE WHEN {col_quoted} IS NULL THEN 1 ELSE 0 END) AS n_nulls,
                COUNT(DISTINCT {col_quoted}) AS n_unique
            FROM read_parquet('{path}')
        """)
        n_total = int(basic["n_total"].iloc[0])
        n_nulls = int(basic["n_nulls"].iloc[0])
        n_unique = int(basic["n_unique"].iloc[0])
        null_pct = round((n_nulls / n_total) * 100, 2) if n_total else 0

        info: dict = {
            "tabla": name,
            "columna": col,
            "dtype": dtype,
            "nulos": n_nulls,
            "nulos_pct": null_pct,
            "unicos": n_unique,
        }

        dtype_upper = dtype.upper()
        if dtype_upper in {"BIGINT", "INTEGER", "DOUBLE", "FLOAT", "REAL", "SMALLINT", "TINYINT", "HUGEINT"}:
            info["tipo"] = "discreta_entera" if dtype_upper in {"BIGINT", "INTEGER", "SMALLINT", "TINYINT", "HUGEINT"} else "continua"
            stats = query_large(f"""
                SELECT
                    MIN({col_quoted}) AS min_v,
                    MAX({col_quoted}) AS max_v,
                    AVG({col_quoted}) AS mean_v,
                    MEDIAN({col_quoted}) AS median_v,
                    STDDEV_SAMP({col_quoted}) AS std_v,
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY {col_quoted}) AS p25,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY {col_quoted}) AS p75
                FROM read_parquet('{path}')
                WHERE {col_quoted} IS NOT NULL
            """)
            info["min"] = round(float(stats["min_v"].iloc[0]), 4) if stats["min_v"].iloc[0] is not None else None
            info["max"] = round(float(stats["max_v"].iloc[0]), 4) if stats["max_v"].iloc[0] is not None else None
            info["mean"] = round(float(stats["mean_v"].iloc[0]), 4) if stats["mean_v"].iloc[0] is not None else None
            info["median"] = round(float(stats["median_v"].iloc[0]), 4) if stats["median_v"].iloc[0] is not None else None
            info["std"] = round(float(stats["std_v"].iloc[0]), 4) if stats["std_v"].iloc[0] is not None else None
            info["p25"] = round(float(stats["p25"].iloc[0]), 4) if stats["p25"].iloc[0] is not None else None
            info["p75"] = round(float(stats["p75"].iloc[0]), 4) if stats["p75"].iloc[0] is not None else None
            # outliers via IQR on sample
            sample = query_large(f"""
                SELECT {col_quoted} AS v FROM read_parquet('{path}')
                WHERE {col_quoted} IS NOT NULL
                USING SAMPLE 100000
            """)
            if not sample.empty:
                outlier_info = detect_outliers_iqr(sample["v"])
                info.update(outlier_info)
        elif dtype_upper in {"VARCHAR", "TEXT", "STRING", "BOOLEAN"}:
            info["tipo"] = "categorica"
        elif "TIMESTAMP" in dtype_upper or "DATE" in dtype_upper:
            info["tipo"] = "temporal"
        else:
            info["tipo"] = "otro"

        rows.append(info)

    return pd.DataFrame(rows)


# =========================================================
# 3. VISUALIZACIONES
# =========================================================

def plot_histogram(series: pd.Series, col: str, table_name: str) -> None:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if len(numeric) < 10 or numeric.nunique() <= 1:
        return
    fig, ax = plt.subplots(figsize=(10, 4))
    sns.histplot(numeric, bins=30, kde=True, color="#2a9d8f", ax=ax)
    ax.set_title(f"Distribucion de {col} - {table_name}")
    ax.set_xlabel(col)
    ax.set_ylabel("frecuencia")
    plt.tight_layout()
    out = FIG_DIR / f"{table_name}_{col}_hist.png"
    plt.savefig(out, dpi=150)
    plt.close()


def plot_boxplot(series: pd.Series, col: str, table_name: str) -> None:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if len(numeric) < 10 or numeric.nunique() <= 1:
        return
    fig, ax = plt.subplots(figsize=(10, 2.5))
    sns.boxplot(x=numeric, color="#e76f51", ax=ax)
    ax.set_title(f"Boxplot de {col} - {table_name}")
    ax.set_xlabel(col)
    plt.tight_layout()
    out = FIG_DIR / f"{table_name}_{col}_boxplot.png"
    plt.savefig(out, dpi=150)
    plt.close()


def plot_category_bars(series: pd.Series, col: str, table_name: str, top_n: int = 20) -> None:
    counts = series.value_counts(dropna=False).head(top_n)
    if counts.empty:
        return
    fig, ax = plt.subplots(figsize=(10, max(4, 0.3 * len(counts) + 1.5)))
    sns.barplot(y=counts.index, x=counts.values, color="#457b9d", ax=ax)
    ax.set_title(f"Frecuencias de {col} - {table_name}")
    ax.set_xlabel("frecuencia")
    ax.set_ylabel(col)
    plt.tight_layout()
    out = FIG_DIR / f"{table_name}_{col}_bar.png"
    plt.savefig(out, dpi=150)
    plt.close()


def plot_correlation_heatmap(df: pd.DataFrame, table_name: str) -> None:
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.shape[1] < 2:
        return
    if numeric_df.dropna().empty:
        return
    corr = numeric_df.corr(numeric_only=True)
    if corr.empty:
        return
    fig, ax = plt.subplots(figsize=(max(8, 0.85 * len(corr.columns)), max(6, 0.75 * len(corr.columns))))
    mask = np.triu(np.ones_like(corr, dtype=bool), k=1)
    sns.heatmap(corr, mask=mask, annot=True, fmt=".2f", cmap="RdBu_r", center=0,
                vmin=-1, vmax=1, square=True, ax=ax, cbar_kws={"shrink": 0.75})
    ax.set_title(f"Correlacion - {table_name}")
    plt.tight_layout()
    out = FIG_DIR / f"{table_name}_correlation_heatmap.png"
    plt.savefig(out, dpi=150)
    plt.close()
    corr.to_csv(TABLE_DIR / f"{table_name}_correlation.csv")


def plot_missing_heatmap(df: pd.DataFrame, table_name: str) -> None:
    if df.shape[1] < 2:
        return
    null_matrix = df.isnull()
    if null_matrix.sum().sum() == 0:
        return
    fig, ax = plt.subplots(figsize=(max(8, 0.5 * df.shape[1]), 4))
    sns.heatmap(null_matrix.T, cbar=False, cmap="viridis", ax=ax)
    ax.set_title(f"Valores nulos por columna - {table_name}")
    ax.set_xlabel("filas")
    ax.set_ylabel("columnas")
    plt.tight_layout()
    out = FIG_DIR / f"{table_name}_missing_heatmap.png"
    plt.savefig(out, dpi=150)
    plt.close()


# =========================================================
# 4. TABLA GRANDE CON DUCKDB
# =========================================================

def analyze_large_table(name: str) -> pd.DataFrame | None:
    """Full EDA for large tables using DuckDB."""
    print(f"=== (LARGE) ANALYZING: {name} ===")
    path = get_parquet_path(name)
    schema = get_schema(name)

    # shape
    count_result = query_large(f"SELECT COUNT(*) AS cnt FROM read_parquet('{path}')")
    n_rows = int(count_result["cnt"].iloc[0])
    n_cols = len(schema)
    print(f"  Shape: ({n_rows}, {n_cols})")
    print(f"  Granularidad: {GRANULARITY.get(name, '')}")

    # profile via DuckDB
    prof = profile_table_via_duckdb(name)
    if prof is not None:
        prof.to_csv(TABLE_DIR / f"{name}_profile.csv", index=False)
        print(f"  Profile: {TABLE_DIR / f'{name}_profile.csv'}")

    # sample for visualizations
    sample = query_large(f"SELECT * FROM read_parquet('{path}') USING SAMPLE 50000")

    # missing heatmap
    plot_missing_heatmap(sample, name)

    # univariate plots on sample
    for col in sample.columns:
        series = sample[col]
        if is_numeric_dtype(series):
            plot_histogram(series, col, name)
            plot_boxplot(series, col, name)
        elif is_string_dtype(series) or is_bool_dtype(series):
            if series.nunique(dropna=False) <= 50:
                plot_category_bars(series, col, name)

    # correlation heatmap on sample
    plot_correlation_heatmap(sample, name)

    # SUMMARIZE
    try:
        summ = query_large(f"SUMMARIZE SELECT * FROM read_parquet('{path}')")
        summ.to_csv(TABLE_DIR / f"{name}_summarize.csv", index=False)
    except Exception:
        pass

    print()

    return prof


# =========================================================
# 5. TABLA PEQUENA CON PANDAS
# =========================================================

def analyze_small_table(name: str) -> None:
    """Full EDA for small tables (loaded entirely into pandas)."""
    print(f"=== ANALYZING: {name} ===")
    try:
        df = load_small_table(name)
    except Exception as e:
        print(f"  ERROR: {e}\n")
        return

    print(f"  Shape: {df.shape}")
    print(f"  Granularidad: {GRANULARITY.get(name, '')}")

    # profile
    prof_rows = []
    for col in df.columns:
        info = profile_column(df[col])
        info["tabla"] = name
        info["columna"] = col
        prof_rows.append(info)
    prof = pd.DataFrame(prof_rows)
    prof.to_csv(TABLE_DIR / f"{name}_profile.csv", index=False)

    # describe
    try:
        desc = df.describe(include="all").T.reset_index()
        desc.to_csv(TABLE_DIR / f"{name}_describe.csv", index=False)
    except Exception:
        pass

    # SUMMARIZE via DuckDB
    path = get_parquet_path(name)
    try:
        summ = query_large(f"SUMMARIZE SELECT * FROM read_parquet('{path}')")
        summ.to_csv(TABLE_DIR / f"{name}_summarize.csv", index=False)
    except Exception:
        pass

    # missing heatmap
    plot_missing_heatmap(df, name)

    # univariate plots
    for col in df.columns:
        series = df[col]
        if is_numeric_dtype(series):
            plot_histogram(series, col, name)
            plot_boxplot(series, col, name)
        elif is_string_dtype(series) or is_bool_dtype(series):
            if series.nunique(dropna=False) <= 50:
                plot_category_bars(series, col, name)
        elif is_datetime64_any_dtype(series):
            plot_histogram(series.astype("int64"), col, name)

    # correlation heatmap
    plot_correlation_heatmap(df, name)

    print()


# =========================================================
# 6. MISSINGS GLOBAL
# =========================================================

def build_missing_summary() -> pd.DataFrame:
    rows = []
    for name in TABLES:
        path = get_parquet_path(name)
        try:
            schema = get_schema(name)
            for _, row in schema.iterrows():
                col = row["column_name"]
                col_quoted = f'"{col}"'
                null_info = query_large(f"""
                    SELECT COUNT(*) AS n_total,
                           SUM(CASE WHEN {col_quoted} IS NULL THEN 1 ELSE 0 END) AS n_nulls
                    FROM read_parquet('{path}')
                """)
                n_nulls = int(null_info["n_nulls"].iloc[0])
                n_total = int(null_info["n_total"].iloc[0])
                if n_nulls > 0:
                    rows.append({
                        "tabla": name,
                        "columna": col,
                        "nulos": n_nulls,
                        "nulos_pct": round((n_nulls / n_total) * 100, 2) if n_total else 0,
                    })
        except Exception:
            continue

    if not rows:
        return pd.DataFrame(columns=["tabla", "columna", "nulos", "nulos_pct"])
    return pd.DataFrame(rows).sort_values("nulos_pct", ascending=False)


# =========================================================
# 7. RUN
# =========================================================

def run() -> None:
    ensure_dirs()

    # ---- Global summary ----
    print("=" * 70)
    print("GLOBAL SUMMARY")
    print("=" * 70)
    global_df = build_global_summary()
    save_csv(global_df, "00_global_summary.csv")
    print(global_df.to_string(index=False))
    print()

    # ---- Missing summary ----
    print("=" * 70)
    print("MISSING SUMMARY")
    print("=" * 70)
    missing_df = build_missing_summary()
    save_csv(missing_df, "00_missing_summary.csv")
    if not missing_df.empty:
        print(missing_df.head(40).to_string(index=False))
    else:
        print("No missing values detected.")
    print()

    # ---- Per-table analysis ----
    for name in TABLES:
        if name in LARGE_TABLES:
            analyze_large_table(name)
        else:
            analyze_small_table(name)

    # ---- Summary of generated files ----
    figures = sorted(FIG_DIR.glob(f"*.png"))
    tables = sorted(TABLE_DIR.glob(f"*.csv"))
    print(f"\n{'=' * 70}")
    print(f"GENERATED: {len(figures)} figures, {len(tables)} tables")
    print(f"  Figures: {FIG_DIR}")
    print(f"  Tables:  {TABLE_DIR}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    run()
