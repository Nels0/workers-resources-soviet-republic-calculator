"""
One-time migration: introduce countries + country_resource_prices tables,
add country_id to projects, migrate project prices to the Default country,
and drop the old project_resource_prices table.

Run with:  uv run python backend/migrate_add_countries.py
"""

import sqlite3
import sys
from pathlib import Path

DEFAULT_COUNTRY_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_COUNTRY_NAME = "Default"

DB_PATH = Path(__file__).parent / "data" / "wrsr.db"


def migrate(db_path: Path = DB_PATH):
    print(f"Migrating {db_path} ...")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()

    # 1. Create countries table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS countries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Create country_resource_prices table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS country_resource_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country_id TEXT NOT NULL REFERENCES countries(id),
            resource_id INTEGER NOT NULL REFERENCES resources(id),
            price REAL NOT NULL DEFAULT 0.0,
            UNIQUE(country_id, resource_id)
        )
    """)

    # 3. Add country_id column to projects (idempotent)
    try:
        cur.execute("ALTER TABLE projects ADD COLUMN country_id TEXT REFERENCES countries(id)")
        print("  Added country_id column to projects")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  country_id column already exists, skipping")
        else:
            raise

    # 4. Insert Default country (idempotent)
    cur.execute(
        "INSERT OR IGNORE INTO countries (id, name) VALUES (?, ?)",
        (DEFAULT_COUNTRY_ID, DEFAULT_COUNTRY_NAME),
    )

    # 5. Assign all unassigned projects to Default country
    cur.execute(
        "UPDATE projects SET country_id = ? WHERE country_id IS NULL",
        (DEFAULT_COUNTRY_ID,),
    )
    print(f"  Assigned orphan projects to country '{DEFAULT_COUNTRY_NAME}'")

    # 6. Migrate project_resource_prices → country_resource_prices (if table exists)
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='project_resource_prices'"
    )
    if cur.fetchone():
        # For each (project → country) pair, migrate prices.
        # If a resource already has a price for that country (from a prior project),
        # keep the existing value (INSERT OR IGNORE).
        cur.execute("""
            INSERT OR IGNORE INTO country_resource_prices (country_id, resource_id, price)
            SELECT p.country_id, prp.resource_id, prp.price
            FROM project_resource_prices prp
            JOIN projects p ON p.id = prp.project_id
            WHERE p.country_id IS NOT NULL
        """)
        migrated = cur.rowcount
        print(f"  Migrated {migrated} price rows to country_resource_prices")

        # 7. Drop old table
        cur.execute("DROP TABLE project_resource_prices")
        print("  Dropped project_resource_prices table")
    else:
        print("  project_resource_prices table not found — nothing to migrate")

    conn.commit()
    conn.execute("PRAGMA foreign_keys = ON")
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DB_PATH
    migrate(db_path)
