import logging
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from pandas.api.types import (
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_object_dtype,
    is_string_dtype,
)


BASE_DIR = Path("data/processed")
LOG_FILE = Path("logs_parquet_audit.txt")


logging.basicConfig(
    filename=LOG_FILE,
    filemode="w",
    level=logging.INFO,
    format="%(message)s",
    encoding="utf-8",
)

logger = logging.getLogger("parquet_audit")


def log(message: str = "") -> None:
    logger.info(message)


def format_series(series: pd.Series, max_rows: int = 15) -> str:
    if series.empty:
        return "<empty>"
    return series.head(max_rows).to_string()


def safe_type_name(value) -> str:
    if value is None:
        return "NoneType"
    return type(value).__name__


def get_python_type_counts(series: pd.Series) -> str:
    non_null = series.dropna()
    if non_null.empty:
        return "all_null"
    counts = Counter(safe_type_name(value) for value in non_null)
    return ", ".join(f"{name}:{count}" for name, count in sorted(counts.items()))


def describe_numeric(series: pd.Series) -> None:
    numeric = pd.to_numeric(series, errors="coerce")
    log("Tipo detectado: NUMERIC")
    log(f"Min: {numeric.min()}")
    log(f"Max: {numeric.max()}")
    log(f"Mean: {numeric.mean()}")
    log(f"Median: {numeric.median()}")
    log(f"Std: {numeric.std()}")
    log(f"Zero count: {(numeric == 0).sum()}")


def describe_datetime(series: pd.Series) -> None:
    values = pd.to_datetime(series, errors="coerce")
    log("Tipo detectado: DATETIME")
    log(f"Min date: {values.min()}")
    log(f"Max date: {values.max()}")
    log(f"Unique dates: {values.nunique(dropna=False)}")


def describe_string(series: pd.Series) -> None:
    values = series.astype("string")
    log("Tipo detectado: STRING")
    log(f"Unique values: {values.nunique(dropna=False)}")
    log("Top values:")
    log(format_series(values.value_counts(dropna=False), max_rows=20))


def summarize_object_values(series: pd.Series, sample_size: int = 5) -> None:
    non_null = series.dropna()

    if non_null.empty:
        log("All null")
        return

    log(f"Python classes: {get_python_type_counts(series)}")

    first_value = non_null.iloc[0]

    if isinstance(first_value, dict):
        keys = sorted({key for value in non_null for key in getattr(value, "keys", lambda: [])()})
        log("Object type: dict")
        log(f"Keys: {keys}")

        for key in keys:
            values = []
            for item in non_null:
                if isinstance(item, dict):
                    values.append(item.get(key))

            temp = pd.Series(values)
            log("")
            log(f"Nested key: {key}")
            log(f"Nulos: {temp.isnull().sum()} ({(temp.isnull().mean() * 100):.2f}%)")
            log(f"Python classes: {get_python_type_counts(temp)}")

            if is_numeric_dtype(temp):
                describe_numeric(temp)
            elif is_datetime64_any_dtype(temp):
                describe_datetime(temp)
            elif is_string_dtype(temp):
                describe_string(temp)
            else:
                nested_non_null = temp.dropna()
                if nested_non_null.empty:
                    log("All nested values are null")
                else:
                    nested_first = nested_non_null.iloc[0]
                    log(f"Nested sample type: {safe_type_name(nested_first)}")
                    log("Samples:")
                    for sample in nested_non_null.head(sample_size):
                        log(str(sample))

    elif isinstance(first_value, (list, tuple, np.ndarray, set)):
        log("Object type: list_like")
        log(f"Sample length: {len(first_value)}")
        sample_element = next(iter(first_value), None) if len(first_value) else None
        log(f"Sample element type: {safe_type_name(sample_element)}")
        log("Samples:")
        for sample in non_null.head(sample_size):
            log(str(sample))

    else:
        log("Object type: other")
        log(f"Sample: {first_value}")


def analyze_column(series: pd.Series) -> None:
    nulls = int(series.isna().sum())
    null_pct = (nulls / len(series) * 100) if len(series) else 0
    duplicates = int(series.duplicated().sum())
    non_null = series.dropna()

    log(f"Pandas dtype: {series.dtype}")
    log(f"Nulos: {nulls} ({null_pct:.2f}%)")
    log(f"Duplicados en columna: {duplicates}")
    log(f"Valores unicos: {series.nunique(dropna=False)}")
    log(f"Python classes: {get_python_type_counts(series)}")

    if is_numeric_dtype(series):
        describe_numeric(series)
    elif is_datetime64_any_dtype(series):
        describe_datetime(series)
    elif is_string_dtype(series):
        describe_string(series)
    elif is_object_dtype(series):
        summarize_object_values(series)
    else:
        log("Tipo desconocido")

    if not non_null.empty:
        log("Samples:")
        log(format_series(non_null.astype(str), max_rows=5))


def analyze_dataframe(df: pd.DataFrame, parquet_path: Path) -> None:
    log("")
    log("=" * 90)
    log(f"DATASET: {parquet_path.as_posix()}")
    log("=" * 90)
    log(f"Shape: {df.shape}")
    log(f"Columnas: {len(df.columns)}")

    duplicate_rows = int(df.duplicated().sum())
    duplicate_pct = (duplicate_rows / len(df) * 100) if len(df) else 0
    log(f"Duplicados de fila completa: {duplicate_rows} ({duplicate_pct:.2f}%)")

    if len(df) > 0:
        log("Columnas y tipos:")
        log(", ".join(f"{column}:{dtype}" for column, dtype in df.dtypes.items()))

    for column in df.columns:
        log("")
        log("-" * 90)
        log(f"COLUMNA: {column}")
        log("-" * 90)
        analyze_column(df[column])


def collect_parquets() -> list[Path]:
    return sorted(
        path for path in BASE_DIR.rglob("*.parquet")
        if path.is_file()
    )


def run() -> None:
    parquet_files = collect_parquets()

    if not parquet_files:
        raise FileNotFoundError("No se encontraron archivos parquet en data/processed")

    log("================ PARQUET AUDIT ================")
    log(f"Parquets encontrados: {len(parquet_files)}")

    for parquet_path in parquet_files:
        try:
            df = pd.read_parquet(parquet_path)
            analyze_dataframe(df, parquet_path)
        except Exception as exc:
            log("")
            log("=" * 90)
            log(f"ERROR leyendo {parquet_path.as_posix()}: {exc}")

    log("")
    log(f"LOG GUARDADO EN: {LOG_FILE.as_posix()}")


if __name__ == "__main__":
    run()