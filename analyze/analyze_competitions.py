import pandas as pd
import numpy as np
from pandas.api.types import (
    is_numeric_dtype,
    is_string_dtype,
    is_object_dtype,
    is_datetime64_any_dtype
)

# =========================
# LEER PARQUET
# =========================

df = pd.read_parquet(
    "data/processed/parquet/competitions.parquet"
)

# =========================
# FUNCIÓN PARA ANALIZAR OBJETOS
# =========================

def inspect_object_column(series, sample_size=3):

    non_null = series.dropna()

    if len(non_null) == 0:
        return {
            "object_type": "all_null"
        }

    first = non_null.iloc[0]

    result = {
        "python_type": str(type(first))
    }

    # =========================
    # DICT
    # =========================

    if isinstance(first, dict):

        result["object_type"] = "dict"
        result["keys"] = list(first.keys())

        sample_values = {}

        for key in first.keys():
            values = []

            for item in non_null.head(sample_size):
                try:
                    values.append(item.get(key))
                except:
                    pass

            sample_values[key] = values

        result["sample_values"] = sample_values

    # =========================
    # LIST / ARRAY
    # =========================

    elif isinstance(first, (list, np.ndarray)):

        result["object_type"] = "list_or_array"
        result["sample_length"] = len(first)

        if len(first) > 0:
            result["element_type"] = str(type(first[0]))

    # =========================
    # OTRO OBJETO
    # =========================

    else:

        result["object_type"] = "other"
        result["sample"] = str(first)

    return result

# =========================
# ANALISIS COMPLETO
# =========================

def analyze_competitions():

    print("\n================ DATASET PROFILING ================\n")

    print(f"Dataset: competitions.parquet")
    print(f"Filas: {len(df)}")
    print(f"Columnas: {len(df.columns)}")

    for column in df.columns:

        print("=" * 70)
        print(f"COLUMNA: {column}")
        print("=" * 70)

        series = df[column]

        # -------------------------
        # Tipo
        # -------------------------

        print(f"Tipo pandas: {series.dtype}")

        # -------------------------
        # Nulos
        # -------------------------

        nulls = series.isnull().sum()
        null_pct = (nulls / len(series)) * 100

        print(f"Nulos: {nulls} ({null_pct:.2f}%)")

        # =========================
        # NUMERICAS
        # =========================

        if is_numeric_dtype(series):

            print("Tipo detectado: NUMERICO")

            print(f"Min: {series.min()}")
            print(f"Max: {series.max()}")
            print(f"Mean: {series.mean()}")
            print(f"Median: {series.median()}")
            print(f"Std: {series.std()}")

        # =========================
        # STRINGS
        # =========================

        elif is_string_dtype(series):

            print("Tipo detectado: STRING")

            unique_count = series.nunique()

            print(f"Valores únicos: {unique_count}")

            if unique_count <= 20:

                print("\nCategorias:")

                print(series.value_counts(dropna=False))

            else:

                print("\nTop 10 valores:")

                print(series.value_counts(dropna=False).head(10))

        # =========================
        # DATETIME
        # =========================

        elif is_datetime64_any_dtype(series):

            print("Tipo detectado: DATETIME")

            print(f"Min fecha: {series.min()}")
            print(f"Max fecha: {series.max()}")

        # =========================
        # OBJECTS
        # =========================

        elif is_object_dtype(series):

            print("Tipo detectado: OBJECT")        

            info = inspect_object_column(series)

            for key, value in info.items():
                print(f"{key}: {value}")

        # =========================
        # OTROS
        # =========================

        else:

            print("Tipo desconocido")        

        print("\n") 

if __name__ == "__main__":
    print("\n\n")
    print("=" * 70)
    print("ANALISIS COMPETICIONES")
    print("=" * 70)
    print("\n\n")        
    analyze_competitions()