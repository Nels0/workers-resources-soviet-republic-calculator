"""
One-time migration: add productivity columns to projects and project_buildings tables.

Run with:  uv run python backend/migrate_add_productivity.py
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "wrsr.db"


def migrate(db_path: Path = DB_PATH):
    print(f"Migrating {db_path} ...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(projects)")
    cols = {row[1] for row in cur.fetchall()}
    if 'productivity' not in cols:
        cur.execute("ALTER TABLE projects ADD COLUMN productivity FLOAT DEFAULT 1.0")
        print("  Added projects.productivity column")
    else:
        print("  projects.productivity already exists, skipping")

    cur.execute("PRAGMA table_info(project_buildings)")
    cols = {row[1] for row in cur.fetchall()}
    if 'productivity' not in cols:
        cur.execute("ALTER TABLE project_buildings ADD COLUMN productivity FLOAT")
        print("  Added project_buildings.productivity column")
    else:
        print("  project_buildings.productivity already exists, skipping")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == '__main__':
    migrate()
