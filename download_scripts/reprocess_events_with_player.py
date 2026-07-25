"""
Reprocesa events_fact.parquet incluyendo player_id, player_name,
position_id y position_name que el script original omitió.

Uso:
    py download_scripts/reprocess_events_with_player.py

Genera:
    data/processed/events/events_fact.parquet   (reemplaza el existente)

Estrategia de rendimiento:
    - Procesamiento en paralelo con ProcessPoolExecutor
    - Escritura incremental en chunks para no saturar RAM
    - Progreso visible con barra de porcentaje
"""

import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import pandas as pd

# Force UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent
RAW_DIR    = ROOT / "data" / "raw"   / "events"
OUT_DIR    = ROOT / "data" / "processed" / "events"
OUT_FILE   = OUT_DIR / "events_fact.parquet"
BACKUP     = OUT_DIR / "events_fact_backup.parquet"

OUT_DIR.mkdir(parents=True, exist_ok=True)


# ── Helper ────────────────────────────────────────────────────────────────────
def safe(x):
    return x if isinstance(x, dict) else {}


# ── Per-file extractor (runs in subprocess) ───────────────────────────────────
def process_file(json_path: str) -> list[dict]:
    """
    Reads one match JSON and returns a list of row dicts.
    Includes player_id, player_name, position_id, position_name.
    """
    path = Path(json_path)
    match_id = int(path.stem)

    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return []

    rows = []
    for e in data:
        e = safe(e)

        # Location
        loc = e.get("location")
        x = loc[0] if isinstance(loc, list) else None
        y = loc[1] if isinstance(loc, list) else None

        # End location from carry / pass / shot
        end_x = end_y = None
        for sub_key in ("carry", "pass", "shot"):
            sub = safe(e.get(sub_key))
            el = sub.get("end_location")
            if isinstance(el, list):
                end_x, end_y = el[0], el[1]
                break

        shot        = safe(e.get("shot"))
        shot_outcome = safe(shot.get("outcome")).get("name")
        related     = e.get("related_events")
        player      = safe(e.get("player"))
        position    = safe(e.get("position"))

        # Pass-specific fields
        pas = safe(e.get("pass"))
        rows.append({
            "event_id":         e.get("id"),
            "match_id":         match_id,
            "index":            e.get("index"),
            "period":           e.get("period"),
            "timestamp":        e.get("timestamp"),
            "minute":           e.get("minute"),
            "second":           e.get("second"),
            "event_type_id":    safe(e.get("type")).get("id"),
            "event_type_name":  safe(e.get("type")).get("name"),
            # player / position
            "player_id":        player.get("id"),
            "player_name":      player.get("name"),
            "position_id":      position.get("id"),
            "position_name":    position.get("name"),
            # team / possession
            "team_id":          safe(e.get("team")).get("id"),
            "team_name":        safe(e.get("team")).get("name"),
            "possession":       e.get("possession"),
            "possession_team_id": safe(e.get("possession_team")).get("id"),
            "play_pattern_id":  safe(e.get("play_pattern")).get("id"),
            "play_pattern_name": safe(e.get("play_pattern")).get("name"),
            "duration":         e.get("duration"),
            "under_pressure":   e.get("under_pressure"),
            "counterpress":     e.get("counterpress"),
            "related_events":   json.dumps(related) if isinstance(related, list) else None,
            "shot_outcome":     shot_outcome,
            "x":  x,
            "y":  y,
            "end_x": end_x,
            "end_y": end_y,
            # pass-specific enrichment
            "pass_length":          pas.get("length"),
            "pass_angle":           pas.get("angle"),
            "pass_height":          safe(pas.get("height")).get("name"),
            "pass_body_part":       safe(pas.get("body_part")).get("name"),
            "pass_outcome":         safe(pas.get("outcome")).get("name"),   # None = Complete
            "pass_switch":          pas.get("switch"),
            "pass_cross":           pas.get("cross"),
            "pass_through_ball":    pas.get("through_ball"),
            "pass_recipient_id":    safe(pas.get("recipient")).get("id"),
            "pass_recipient_name":  safe(pas.get("recipient")).get("name"),
        })

    return rows


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    files = sorted(RAW_DIR.glob("*.json"))
    total = len(files)
    print(f"Archivos a procesar: {total}")
    print(f"Salida: {OUT_FILE}")

    # Backup existing
    if OUT_FILE.exists():
        import shutil
        shutil.copy2(OUT_FILE, BACKUP)
        print(f"Backup guardado en {BACKUP.name}")

    WORKERS   = min(os.cpu_count() or 4, 8)
    CHUNK_SZ  = 300          # files per write batch
    print(f"Workers: {WORKERS}  ·  Chunk: {CHUNK_SZ} archivos")

    import pyarrow as pa
    import pyarrow.parquet as pq

    t0      = time.time()
    done    = 0
    writer  = None   # ParquetWriter opened on first batch
    schema  = None

    CHUNK_SZ = 200   # files per batch (balance memory vs speed)
    file_chunks = [files[i:i + CHUNK_SZ] for i in range(0, total, CHUNK_SZ)]

    for chunk in file_chunks:
        batch_rows: list[dict] = []

        with ProcessPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(process_file, str(f)): f for f in chunk}
            for fut in as_completed(futures):
                try:
                    rows = fut.result()
                    batch_rows.extend(rows)
                except Exception as exc:
                    print(f"\n  ERROR {futures[fut].name}: {exc}")
                done += 1

        if not batch_rows:
            continue

        df = pd.DataFrame(batch_rows)

        # Cast numeric columns
        for col in ("player_id", "position_id", "event_type_id",
                     "team_id", "possession", "possession_team_id",
                     "play_pattern_id", "index", "period", "minute", "second"):
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        table = pa.Table.from_pandas(df, preserve_index=False)

        if writer is None:
            schema = table.schema
            writer = pq.ParquetWriter(OUT_FILE, schema, compression="snappy")

        # Align schema
        table = table.cast(schema)
        writer.write_table(table)

        elapsed   = time.time() - t0
        pct       = done / total * 100
        remaining = (elapsed / done * (total - done)) if done else 0
        bar = "#" * int(pct / 2) + "-" * (50 - int(pct / 2))
        print(
            f"\r[{bar}] {pct:5.1f}%  {done}/{total}  "
            f"elapsed={elapsed:.0f}s  ETA={remaining:.0f}s",
            end="", flush=True
        )

    if writer:
        writer.close()

    print()
    elapsed = time.time() - t0

    # Final stats
    final = pd.read_parquet(OUT_FILE)
    print(f"\n{'='*60}")
    print(f"COMPLETADO en {elapsed:.0f}s")
    print(f"Filas totales : {len(final):,}")
    print(f"Columnas      : {list(final.columns)}")
    print(f"player_id OK  : {final['player_id'].notna().sum():,} eventos con jugador")
    print(f"player_id NULL: {final['player_id'].isna().sum():,} (Starting XI / Half Start, esperado)")
    print(f"Archivo       : {OUT_FILE}  ({OUT_FILE.stat().st_size/1024**2:.1f} MB)")

    # Sanity check
    sample = final[final["player_id"].notna() & (final["event_type_name"] == "Pass")].head(3)
    print("\nMuestra de pases con player_id:")
    print(sample[["event_id", "match_id", "minute", "player_id", "player_name",
                   "position_name", "x", "y", "end_x", "end_y"]].to_string(index=False))


if __name__ == "__main__":
    main()
