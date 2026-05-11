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

PARQUET_DIR = "data/processed/matches"
LOG_FILE = "logs.txt"

# =========================================================
# LOGGER
# =========================================================

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
# LEER TODOS LOS PARQUETS
# =========================================================

parquet_files = glob.glob(f"{PARQUET_DIR}/*.parquet")

if len(parquet_files) == 0:
    raise Exception("No se encontraron archivos parquet")

log(f"\nParquets encontrados: {len(parquet_files)}")

dfs = []

for file in parquet_files:

    try:

        df_temp = pd.read_parquet(file)

        log(f"Leído: {file} -> {df_temp.shape}")

        dfs.append(df_temp)

    except Exception as e:

        log(f"Error leyendo {file}: {e}")

# =========================================================
# DATAFRAME FINAL
# =========================================================

df = pd.concat(dfs, ignore_index=True)

log("\n================ DATASET GLOBAL ================")

log(f"Total registros: {len(df)}")
log(f"Total columnas: {len(df.columns)}")

# =========================================================
# FUNCIONES AUXILIARES
# =========================================================

def log_series(series):

    if isinstance(series, pd.Series):

        text = series.to_string()

    else:

        text = str(series)

    log(text)


def analyze_numeric(series):

    log("Tipo detectado: NUMERICO")

    log(f"Min: {series.min()}")
    log(f"Max: {series.max()}")
    log(f"Mean: {series.mean()}")
    log(f"Median: {series.median()}")
    log(f"Std: {series.std()}")


def analyze_datetime(series):

    log("Tipo detectado: DATETIME")

    log(f"Min fecha: {series.min()}")
    log(f"Max fecha: {series.max()}")


def analyze_string(series):

    log("Tipo detectado: STRING")

    unique_count = series.nunique(dropna=False)

    log(f"Valores únicos: {unique_count}")

    if unique_count <= 30:

        log("\nCategorias:")

        log_series(
            series.value_counts(
                dropna=False
            )
        )

    else:

        log("\nTop 10 valores:")

        log_series(
            series.value_counts(
                dropna=False
            ).head(10)
        )


def inspect_object_column(series, sample_size=5):

    non_null = series.dropna()

    if len(non_null) == 0:

        log("Todos son null")

        return

    first = non_null.iloc[0]

    log(f"python_type: {type(first)}")

    # =====================================================
    # DICT
    # =====================================================

    if isinstance(first, dict):

        log("object_type: dict")

        keys = list(first.keys())

        log(f"keys: {keys}")

        # =================================================
        # ANALISIS DE CADA KEY
        # =================================================

        for key in keys:

            log("\n" + "-" * 60)
            log(f"KEY: {key}")
            log("-" * 60)

            values = []

            for item in non_null:

                try:
                    values.append(item.get(key))
                except:
                    pass

            temp_series = pd.Series(values)

            log(f"Nulos: {temp_series.isnull().sum()}")

            # =============================================
            # NUMERICO
            # =============================================

            if is_numeric_dtype(temp_series):

                analyze_numeric(temp_series)

            # =============================================
            # DATETIME
            # =============================================

            elif is_datetime64_any_dtype(temp_series):

                analyze_datetime(temp_series)

            # =============================================
            # STRING
            # =============================================

            elif is_string_dtype(temp_series):

                analyze_string(temp_series)

            # =============================================
            # OBJETOS ANIDADOS
            # =============================================

            else:

                sample_non_null = temp_series.dropna()

                if len(sample_non_null) == 0:

                    log("Todos nulos")

                else:

                    nested_first = sample_non_null.iloc[0]

                    log(f"Nested type: {type(nested_first)}")

                    # =====================================
                    # DICT ANIDADO
                    # =====================================

                    if isinstance(nested_first, dict):

                        nested_keys = list(nested_first.keys())

                        log(f"Nested keys: {nested_keys}")

                        nested_samples = []

                        for x in sample_non_null.head(sample_size):

                            nested_samples.append(x)

                        log("\nEjemplos:")

                        for sample in nested_samples:

                            log(str(sample))

                    # =====================================
                    # ARRAY / LIST
                    # =====================================

                    elif isinstance(
                        nested_first,
                        (list, np.ndarray)
                    ):

                        log(
                            f"Array length ejemplo: {len(nested_first)}"
                        )

                        if len(nested_first) > 0:

                            log(
                                f"Tipo elemento: {type(nested_first[0])}"
                            )

                            log("\nPrimer elemento:")

                            log(str(nested_first[0]))

                    # =====================================
                    # OTRO
                    # =====================================

                    else:

                        log("\nEjemplos:")

                        log_series(
                            sample_non_null.head(sample_size)
                        )

    # =====================================================
    # LIST / ARRAY
    # =====================================================

    elif isinstance(first, (list, np.ndarray)):

        log("object_type: list_or_array")

        log(f"Sample length: {len(first)}")

        if len(first) > 0:

            log(f"Element type: {type(first[0])}")

            log("\nPrimer elemento:")

            log(str(first[0]))

    # =====================================================
    # TIME OBJECT
    # =====================================================

    elif "datetime.time" in str(type(first)):

        log("Tipo detectado: TIME")

        unique_count = series.nunique(dropna=False)

        log(f"Valores únicos: {unique_count}")

        log("\nCategorias:")

        log_series(series.value_counts(dropna=False))

    # =====================================================
    # OTRO
    # =====================================================

    else:

        log("object_type: other")

        log(f"Sample: {first}")


# =========================================================
# ANALISIS COMPLETO
# =========================================================

log("\n================ DATASET PROFILING ================\n")

for column in df.columns:

    log("\n")
    log("=" * 70)
    log(f"COLUMNA: {column}")
    log("=" * 70)

    series = df[column]

    # =====================================================
    # TIPO PANDAS
    # =====================================================

    log(f"Tipo pandas: {series.dtype}")

    # =====================================================
    # NULOS
    # =====================================================

    nulls = series.isnull().sum()

    null_pct = (nulls / len(series)) * 100

    log(f"Nulos: {nulls} ({null_pct:.2f}%)")

    # =====================================================
    # NUMERICOS
    # =====================================================

    if is_numeric_dtype(series):

        analyze_numeric(series)

    # =====================================================
    # DATETIME
    # =====================================================

    elif is_datetime64_any_dtype(series):

        analyze_datetime(series)

    # =====================================================
    # STRING
    # =====================================================

    elif is_string_dtype(series):

        analyze_string(series)

    # =====================================================
    # OBJECT
    # =====================================================

    elif is_object_dtype(series):

        log("Tipo detectado: OBJECT")

        inspect_object_column(series)

    # =====================================================
    # OTRO
    # =====================================================

    else:

        log("Tipo desconocido")

# =========================================================
# ANALISIS ESPECIAL DE ENTIDADES
# =========================================================

ENTITY_COLUMNS = [
    "competition",
    "season",
    "home_team",
    "away_team",
    "competition_stage",
    "stadium",
    "referee",
    "metadata"
]

log("\n\n================ ANALISIS ENTIDADES ================\n")

for entity_col in ENTITY_COLUMNS:

    if entity_col not in df.columns:
        continue

    log("\n")
    log("#" * 80)
    log(f"ENTIDAD: {entity_col}")
    log("#" * 80)

    entity_series = df[entity_col].dropna()

    if len(entity_series) == 0:
        continue

    first = entity_series.iloc[0]

    if not isinstance(first, dict):
        continue

    entity_df = pd.json_normalize(entity_series)

    log("\nSHAPE:")
    log(str(entity_df.shape))

    log("\nCOLUMNAS:")
    log(str(entity_df.columns.tolist()))

    log("\nHEAD:")
    log(entity_df.head().to_string())

    # =====================================================
    # ANALISIS COLUMNA POR COLUMNA
    # =====================================================

    for col in entity_df.columns:

        log("\n")
        log("-" * 60)
        log(f"COLUMNA ENTITY: {col}")
        log("-" * 60)

        s = entity_df[col]

        log(f"Tipo: {s.dtype}")

        nulls = s.isnull().sum()

        log(f"Nulos: {nulls}")

        # =================================================
        # NUMERICOS
        # =================================================

        if is_numeric_dtype(s):

            analyze_numeric(s)

        # =================================================
        # DATETIME
        # =================================================

        elif is_datetime64_any_dtype(s):

            analyze_datetime(s)

        # =================================================
        # STRING
        # =================================================

        elif is_string_dtype(s):

            analyze_string(s)

        # =================================================
        # OBJECT
        # =================================================

        elif is_object_dtype(s):

            inspect_object_column(s)

# =========================================================
# INFO GENERAL
# =========================================================

log("\n\n================ INFO GENERAL ================\n")

from io import StringIO

buffer = StringIO()
df.info(buf=buffer)

log(buffer.getvalue())

log("\n================ SHAPE ================\n")

log(str(df.shape))

log("\n================ COLUMNAS ================\n")

log(str(df.columns.tolist()))

log(f"\n\nLogs guardados en: {LOG_FILE}")