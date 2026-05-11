"""Perfil detallado de parquets para responder preguntas de analisis de datos.

Este script no solo describe columnas: tambien intenta contestar, tabla por tabla,
las preguntas que normalmente se hacen antes de modelar o explorar una base:

1. Que representa cada registro.
2. Cuantos registros hay y si el volumen es manejable.
3. Si hay duplicados, nulos, clases Python en columnas object y tipos de datos.
4. Si los datos son discretos o continuos, sus rangos y valores unicos.
5. Si hay distribucion, correlacion, outliers y posibles problemas de calidad.

El objetivo es dejar trazabilidad clara de por que cada bloque existe y a que
pregunta responde.
"""

from __future__ import annotations

import math
import logging
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_object_dtype,
    is_string_dtype,
)


BASE_DIR = Path("data/processed")
LOG_FILE = Path("logs_parquet_questions.txt")


logging.basicConfig(
    filename=LOG_FILE,
    filemode="w",
    level=logging.INFO,
    format="%(message)s",
    encoding="utf-8",
)

logger = logging.getLogger("parquet_questions")


def log(message: str = "") -> None:
    """Escribe en el log para dejar evidencia del analisis."""

    logger.info(message)


def collect_parquets() -> list[Path]:
    """Reune todos los parquets procesados.

    Esto responde a la pregunta de si hay nuevas tablas: el analisis no depende
    de una lista manual, sino del contenido real de data/processed.
    """

    return sorted(path for path in BASE_DIR.rglob("*.parquet") if path.is_file())


def format_value_counts(series: pd.Series, max_rows: int = 15) -> str:
    if series.empty:
        return "<empty>"
    return series.head(max_rows).to_string()


def safe_type_name(value) -> str:
    if value is None:
        return "NoneType"
    return type(value).__name__


def python_type_counts(series: pd.Series) -> str:
    """Responde a la pregunta de que clases hay dentro de object.

    En pandas un dtype object puede mezclar dict, list, str, int, float, None,
    etc. Saber eso evita asumir que todo el contenido es texto plano.
    """

    non_null = series.dropna()
    if non_null.empty:
        return "all_null"
    counts = Counter(safe_type_name(value) for value in non_null)
    return ", ".join(f"{name}:{count}" for name, count in sorted(counts.items()))


def summarize_numeric(series: pd.Series) -> None:
    """Describe un numerico con estadisticos de tendencia central y dispersion.

    Esto responde a: rangos, distribucion, media, mediana, desviacion y si hay
    outliers potenciales.
    """

    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()

    log("Tipo detectado: NUMERICO")
    log(f"Min: {numeric.min()}")
    log(f"Max: {numeric.max()}")
    log(f"Mean: {numeric.mean()}")
    log(f"Median: {numeric.median()}")
    log(f"Std: {numeric.std()}")
    log(f"Describe:\n{numeric.describe().to_string()}")

    positive = valid[valid > 0]
    if len(positive) > 0:
        log(f"Geometric mean: {math.exp(np.log(positive).mean()):.6f}")
        log(f"Harmonic mean: {len(positive) / np.sum(1.0 / positive):.6f}")
    else:
        log("Geometric mean: no aplica (requiere valores positivos)")
        log("Harmonic mean: no aplica (requiere valores positivos)")


def summarize_datetime(series: pd.Series) -> None:
    """Resume fechas/horas para detectar granularidad temporal.

    Esto responde a si los datos tienen niveles de tiempo (dia, hora, minuto)
    y si el dataset es potencialmente dependiente del tiempo.
    """

    values = pd.to_datetime(series, errors="coerce")
    log("Tipo detectado: DATETIME")
    log(f"Min fecha: {values.min()}")
    log(f"Max fecha: {values.max()}")
    log(f"Unique dates: {values.nunique(dropna=False)}")
    log(f"Describe:\n{values.describe(datetime_is_numeric=True).to_string()}")


def summarize_string(series: pd.Series) -> None:
    """Resume categoricas/texto para responder a cardinalidad y clases.

    Esto ayuda a decidir si una columna es categorica, si requiere codificacion
    numerica y si hay demasiadas categorias.
    """

    values = series.astype("string")
    unique_count = values.nunique(dropna=False)

    log("Tipo detectado: STRING")
    log(f"Valores unicos: {unique_count}")
    log(f"Describe:\n{values.describe().to_string()}")

    if unique_count <= 30:
        log("Categorias:")
        log(format_value_counts(values.value_counts(dropna=False), max_rows=30))
    else:
        log("Top 15 valores:")
        log(format_value_counts(values.value_counts(dropna=False), max_rows=15))


def is_integer_like(series: pd.Series) -> bool:
    """Determina si un numerico se comporta como discreto.

    Una columna con numeros enteros o con pocos valores distintos suele ser
    discreta, aunque tecnicamente venga como float.
    """

    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return False
    return np.allclose(valid, np.round(valid))


def classify_quantity(series: pd.Series) -> str:
    """Clasifica una columna numerica como discreta o continua.

    Esto responde explicitamente a la pregunta de que datos son discretos y
    cuales continuos.
    """

    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return "sin_datos"

    unique_ratio = valid.nunique() / len(valid)

    if is_bool_dtype(series):
        return "discreta_bool"
    if is_integer_like(series):
        return "discreta_entera"
    if unique_ratio <= 0.15:
        return "discreta_baja_cardinalidad"
    return "continua"


def detect_outliers(series: pd.Series) -> dict[str, float | int | None]:
    """Usa IQR para marcar outliers potenciales.

    Esto no elimina nada: solo identifica si hay valores aislados que pueden
    ser errores de carga o eventos reales extremos.
    """

    numeric = pd.to_numeric(series, errors="coerce")
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
        "outlier_pct": (count / len(valid)) * 100,
        "lower": float(lower),
        "upper": float(upper),
    }


def summarize_object_values(series: pd.Series, sample_size: int = 5) -> None:
    """Explora columnas object para descubrir estructura real.

    Esto responde a: clases Python, si hay dict/list y si el contenido esta
    anidado. Muchos parquets nuevos usan objetos complejos, no solo texto.
    """

    non_null = series.dropna()
    if non_null.empty:
        log("All null")
        return

    log(f"Python classes: {python_type_counts(series)}")
    first_value = non_null.iloc[0]

    if isinstance(first_value, dict):
        keys = sorted({key for value in non_null if isinstance(value, dict) for key in value.keys()})
        log("Object type: dict")
        log(f"Keys: {keys}")

        for key in keys:
            values = [item.get(key) for item in non_null if isinstance(item, dict)]
            temp = pd.Series(values)
            log("")
            log(f"Nested key: {key}")
            log(f"Nulos: {temp.isnull().sum()} ({(temp.isnull().mean() * 100):.2f}%)")
            log(f"Python classes: {python_type_counts(temp)}")

            if is_numeric_dtype(temp):
                summarize_numeric(temp)
            elif is_datetime64_any_dtype(temp):
                summarize_datetime(temp)
            elif is_string_dtype(temp):
                summarize_string(temp)
            else:
                nested_non_null = temp.dropna()
                if nested_non_null.empty:
                    log("All nested values are null")
                else:
                    log(f"Nested sample type: {safe_type_name(nested_non_null.iloc[0])}")
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


def likely_key_columns(df: pd.DataFrame) -> list[str]:
    """Devuelve columnas que parecen identificar registros.

    Esto sirve para revisar duplicados de forma mas semantica que solo row-wise.
    """

    candidates: list[str] = []
    for column in df.columns:
        lower = column.lower()
        if lower.endswith("_id") or lower in {"id", "match_id", "event_id", "player_id", "team_id", "competition_id", "season_id"}:
            candidates.append(column)
    return candidates


def dataset_description(parquet_path: Path, df: pd.DataFrame) -> str:
    """Describe que representa un registro segun la tabla.

    Esto responde a la pregunta de interpretacion del registro/fila.
    Cada parquet tiene una granularidad distinta y un registro significa algo
    diferente segun su tabla.
    """

    name = parquet_path.name
    description_map = {
        "matches_fact.parquet": "Una fila representa un partido.",
        "events_fact.parquet": "Una fila representa un evento de partido.",
        "event_tactics_lineup.parquet": "Una fila representa un jugador incluido en la formacion tactica de un evento.",
        "match_lineup_players.parquet": "Una fila representa un jugador de la alineacion de un partido.",
        "player_match_position_fact.parquet": "Una fila representa un intervalo de posicion de un jugador en un partido.",
        "three_sixty_events.parquet": "Una fila representa un evento con area visible de 360 grados.",
        "three_sixty_freeze_frame.parquet": "Una fila representa un jugador dentro de un freeze frame de 360 grados.",
        "competition_dim.parquet": "Una fila representa una competencia.",
        "season_dim.parquet": "Una fila representa una temporada.",
        "team_dim.parquet": "Una fila representa un equipo.",
        "stadium_dim.parquet": "Una fila representa un estadio.",
        "manager_dim.parquet": "Una fila representa un manager.",
        "competition_team_group.parquet": "Una fila representa un equipo dentro de una competencia y temporada con su grupo.",
        "manager_team_match_bridge.parquet": "Una fila representa la relacion manager-equipo-partido.",
        "competitions.parquet": "Una fila representa una fila cruda de competiciones con metadatos de disponibilidad y actualizacion.",
    }
    return description_map.get(name, f"Una fila representa una observacion en {name}.")


def table_granularity(parquet_path: Path) -> str:
    """Explica el nivel de granularidad de la tabla.

    Esto responde a si hay niveles como partido, evento, jugador, intervalo de
    tiempo, dimension, puente, etc.
    """

    name = parquet_path.name
    if name in {"matches_fact.parquet"}:
        return "Granularidad a nivel partido."
    if name in {"events_fact.parquet", "three_sixty_events.parquet"}:
        return "Granularidad a nivel evento."
    if name in {"event_tactics_lineup.parquet", "three_sixty_freeze_frame.parquet", "manager_team_match_bridge.parquet", "competition_team_group.parquet"}:
        return "Granularidad relacional o de detalle por evento/equipo/jugador."
    if name in {"match_lineup_players.parquet", "player_match_position_fact.parquet"}:
        return "Granularidad a nivel jugador-partido; una tabla captura estado o intervalo del jugador en el partido."
    if name.endswith("_dim.parquet"):
        return "Granularidad de dimension: una fila por entidad principal."
    return "Granularidad variable segun la tabla."


def analyze_column(series: pd.Series) -> dict[str, object]:
    """Analiza una columna y devuelve un resumen estructurado.

    El resumen alimenta el informe para contestar las preguntas de tipo,
    cardinalidad, nulos, distribucion, outliers y clases Python.
    """

    nulls = int(series.isna().sum())
    null_pct = (nulls / len(series) * 100) if len(series) else 0.0
    duplicates = int(series.duplicated().sum())
    unique_count = int(series.nunique(dropna=False))

    summary: dict[str, object] = {
        "dtype": str(series.dtype),
        "nulls": nulls,
        "null_pct": null_pct,
        "duplicates": duplicates,
        "unique_count": unique_count,
        "python_classes": python_type_counts(series),
    }

    log(f"Pandas dtype: {series.dtype}")
    log(f"Nulos: {nulls} ({null_pct:.2f}%)")
    log(f"Duplicados en columna: {duplicates}")
    log(f"Valores unicos: {unique_count}")
    log(f"Python classes: {summary['python_classes']}")

    if is_bool_dtype(series):
        log("Tipo detectado: BOOL")
        log(format_value_counts(series.value_counts(dropna=False), max_rows=10))
        summary["kind"] = "categorical_bool"

    elif is_numeric_dtype(series):
        summary["kind"] = classify_quantity(series)
        summarize_numeric(series)
        outliers = detect_outliers(series)
        summary["outliers"] = outliers
        log(
            f"Outliers IQR: {outliers['outlier_count']} "
            f"({outliers['outlier_pct']:.2f}%), limits=({outliers['lower']}, {outliers['upper']})"
        )

    elif is_datetime64_any_dtype(series):
        summary["kind"] = "temporal"
        summarize_datetime(series)

    elif is_string_dtype(series):
        summary["kind"] = "categorical_text"
        summarize_string(series)

    elif is_object_dtype(series):
        summary["kind"] = "object_nested"
        summarize_object_values(series)

    else:
        summary["kind"] = "unknown"
        log("Tipo desconocido")

    non_null = series.dropna()
    if not non_null.empty:
        log("Samples:")
        log(format_value_counts(non_null.astype(str), max_rows=5))

    return summary


def correlation_analysis(df: pd.DataFrame) -> None:
    """Busca correlaciones y covarianzas entre variables numericas.

    Esto responde a si hay relacion entre features y si aparecen variables muy
    redundantes. Solo se aplica a columnas con informacion numerica util.
    """

    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.shape[1] < 2:
        log("No hay suficientes columnas numericas para correlacion.")
        return

    corr = numeric_df.corr(numeric_only=True)
    cov = numeric_df.cov(numeric_only=True)

    log("Correlacion entre features numericas:")
    log(corr.round(4).to_string())
    log("Covarianza entre features numericas:")
    log(cov.round(4).to_string())

    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    strong = upper.stack().sort_values(key=lambda s: s.abs(), ascending=False).head(10)

    if not strong.empty:
        log("Top correlaciones absolutas:")
        log(strong.to_string())


def inspect_distributions(df: pd.DataFrame) -> None:
    """Resume distribucion con describe() y frecuencias.

    Esto responde a la pregunta de si los datos siguen alguna distribucion.
    No hace un test formal; deja el descriptor numerico y la forma de la cola.
    """

    for column in df.columns:
        series = df[column]
        if is_numeric_dtype(series):
            log("")
            log(f"Distribucion numerica de {column}:")
            log(pd.to_numeric(series, errors="coerce").describe().to_string())
        elif is_string_dtype(series) or is_bool_dtype(series):
            counts = series.value_counts(dropna=False)
            if len(counts) <= 20:
                log("")
                log(f"Distribucion categorica de {column}:")
                log(counts.to_string())


def detect_supervised_candidate(df: pd.DataFrame) -> None:
    """Busca una posible columna de salida si el problema fuera supervisado.

    Esto responde a la pregunta de cual podria ser la salida y si parece
    binaria, multiclase o continua.
    """

    candidates = []
    for column in df.columns:
        lower = column.lower()
        if lower in {"target", "label", "class", "outcome", "result", "status", "match_status", "match_status_360"} or lower.endswith("_status"):
            candidates.append(column)

    if not candidates:
        log("No se detecto una columna de salida obvia para aprendizaje supervisado.")
        return

    log("Posibles columnas de salida supervisada:")
    for column in candidates:
        series = df[column]
        unique_count = series.nunique(dropna=False)
        kind = "binaria" if unique_count == 2 else "multiclase" if unique_count > 2 else "degenerada"
        log(f"- {column}: {kind}, valores unicos={unique_count}")


def analyze_dataframe(df: pd.DataFrame, parquet_path: Path) -> None:
    """Analiza una tabla completa y contesta las preguntas del usuario.

    Cada bloque tiene una finalidad clara:
    - que representa el registro
    - cuantos registros hay
    - si hay duplicados
    - tipos, nulos y cardinalidad
    - distribuciones y outliers
    - correlacion y posible salida supervisada
    """

    log("")
    log("=" * 110)
    log(f"DATASET: {parquet_path.as_posix()}")
    log("=" * 110)
    log(f"Registro representa: {dataset_description(parquet_path, df)}")
    log(f"Granularidad: {table_granularity(parquet_path)}")
    log(f"Shape: {df.shape}")
    log(f"Cantidad de registros: {len(df)}")
    log(f"Cantidad de columnas: {len(df.columns)}")

    if len(df) == 0:
        log("Dataset vacio; no es posible analizar distribuciones ni duplicados.")
        return

    duplicate_rows = int(df.duplicated().sum())
    duplicate_pct = (duplicate_rows / len(df)) * 100 if len(df) else 0.0
    log(f"Duplicados de fila completa: {duplicate_rows} ({duplicate_pct:.2f}%)")

    key_columns = likely_key_columns(df)
    if key_columns:
        log(f"Columnas candidatas a clave: {key_columns}")
        for column in key_columns[:5]:
            key_duplicates = int(df[column].duplicated().sum())
            log(f"Duplicados en {column}: {key_duplicates}")

    log("Tipos por columna:")
    log(", ".join(f"{column}:{dtype}" for column, dtype in df.dtypes.items()))

    object_columns = [column for column in df.columns if is_object_dtype(df[column])]
    if object_columns:
        log(f"Columnas object detectadas: {object_columns}")

    numeric_columns = [column for column in df.columns if is_numeric_dtype(df[column])]
    categorical_columns = [column for column in df.columns if is_string_dtype(df[column]) or is_bool_dtype(df[column])]
    temporal_columns = [column for column in df.columns if is_datetime64_any_dtype(df[column])]

    log(f"Columnas numericas: {numeric_columns}")
    log(f"Columnas categoricas/texto: {categorical_columns}")
    log(f"Columnas temporales: {temporal_columns}")

    if numeric_columns:
        log("\nRangos, cardinalidad y si son discretas o continuas:")
        for column in numeric_columns:
            series = df[column]
            numeric = pd.to_numeric(series, errors="coerce")
            log(f"{column}: kind={classify_quantity(series)}, unique={numeric.nunique(dropna=False)}, min={numeric.min()}, max={numeric.max()}")

    if categorical_columns:
        log("\nCategorias y necesidad potencial de codificacion numerica:")
        for column in categorical_columns:
            unique_count = df[column].nunique(dropna=False)
            needs_encoding = unique_count <= max(50, int(len(df) * 0.2))
            log(f"{column}: unique={unique_count}, needs_encoding={needs_encoding}")

    for column in df.columns:
        log("")
        log("-" * 110)
        log(f"COLUMNA: {column}")
        log("-" * 110)
        analyze_column(df[column])

    log("\nAnalisis de distribuciones:")
    inspect_distributions(df)

    log("\nAnalisis de correlacion y covarianza:")
    correlation_analysis(df)

    log("\nAnalisis supervisado potencial:")
    detect_supervised_candidate(df)

    log("\nChequeo de nulos globales:")
    null_summary = df.isna().sum().sort_values(ascending=False)
    log(null_summary.to_string())


def run() -> None:
    """Ejecuta el analisis completo sobre todos los parquets procesados."""

    parquet_files = collect_parquets()

    if not parquet_files:
        raise FileNotFoundError("No se encontraron archivos parquet en data/processed")

    log("================ ANALISIS DE PREGUNTAS SOBRE PARQUETS ================")
    log(f"Parquets encontrados: {len(parquet_files)}")

    for parquet_path in parquet_files:
        try:
            df = pd.read_parquet(parquet_path)
            analyze_dataframe(df, parquet_path)
        except Exception as exc:
            log("")
            log("=" * 110)
            log(f"ERROR leyendo {parquet_path.as_posix()}: {exc}")

    log("")
    log(f"LOG GUARDADO EN: {LOG_FILE.as_posix()}")


if __name__ == "__main__":
    run()