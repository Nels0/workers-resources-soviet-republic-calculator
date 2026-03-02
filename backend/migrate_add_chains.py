"""
One-time migration: introduce project_chains and project_chain_members tables.

Run with:  uv run python backend/migrate_add_chains.py
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

    cur.execute("""
        CREATE TABLE IF NOT EXISTS project_chains (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id),
            name TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        )
    """)
    print("  Ensured project_chains table exists")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS project_chain_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chain_id TEXT NOT NULL REFERENCES project_chains(id),
            building_pos INTEGER NOT NULL,
            UNIQUE(chain_id, building_pos)
        )
    """)
    print("  Ensured project_chain_members table exists")

    conn.commit()
    conn.execute("PRAGMA foreign_keys = ON")
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DB_PATH
    migrate(db_path)
