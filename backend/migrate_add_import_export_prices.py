"""One-time migration: add import_price and export_price columns to country_resource_prices.

Run with:  uv run python backend/migrate_add_import_export_prices.py
"""

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "wrsr.db"


def migrate(db_path: Path = DB_PATH):
    print(f"Migrating {db_path} ...")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(country_resource_prices)")
    cols = {row[1] for row in cur.fetchall()}

    if "import_price" not in cols:
        cur.execute("ALTER TABLE country_resource_prices ADD COLUMN import_price REAL DEFAULT 0")
        cur.execute("UPDATE country_resource_prices SET import_price = price")
        print("  Added import_price column (initialized from price)")
    else:
        print("  import_price column already exists, skipping")

    if "export_price" not in cols:
        cur.execute("ALTER TABLE country_resource_prices ADD COLUMN export_price REAL DEFAULT 0")
        print("  Added export_price column (default 0)")
    else:
        print("  export_price column already exists, skipping")

    conn.commit()
    conn.execute("PRAGMA foreign_keys = ON")
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DB_PATH
    migrate(db_path)
