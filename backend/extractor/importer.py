"""CLI tool to import WRSR building data into the SQLite database.

Usage:
    cd backend
    uv run python -m extractor.importer --game-dir /path/to/wrsr
    uv run python -m extractor.importer --buildings-dir /path/to/buildings_types
"""

import argparse
import os
import sys

# Ensure the backend package is importable when run as __main__
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import init_db, get_session
from app.models import Building, BuildingCost, Resource
from extractor.parser import parse_buildings_dir
from extractor.translations import (
    get_building_display_name,
    get_resource_display_name,
    load_translations,
)


RESOURCE_TYPES = {
    "workers": ("workforce", "workdays"),
    "concrete": ("material", "t"),
    "gravel": ("material", "t"),
    "asphalt": ("material", "t"),
    "bricks": ("material", "t"),
    "boards": ("material", "t"),
    "steel": ("material", "t"),
    "mcomponents": ("material", "t"),
    "ecomponents": ("material", "t"),
    "prefabpanels": ("material", "t"),
    "rawcoal": ("material", "t"),
    "coal": ("material", "t"),
    "rawiron": ("material", "t"),
    "iron": ("material", "t"),
    "rawbauxite": ("material", "t"),
    "aluminium": ("material", "t"),
    "oil": ("material", "t"),
    "fuel": ("material", "t"),
    "bitumen": ("material", "t"),
    "chemicals": ("material", "t"),
    "plastics": ("material", "t"),
    "fabric": ("material", "t"),
    "food": ("material", "t"),
    "meat": ("material", "t"),
    "crops": ("material", "t"),
    "wood": ("material", "t"),
    "rawgravel": ("material", "t"),
    "cement": ("material", "t"),
    "eletric": ("utility", "MW"),
    "heat": ("utility", "MW"),
    "water": ("utility", "m3"),
}


def get_or_create_resource(session, internal_name: str, translations) -> Resource:
    """Get existing resource by internal name or create a new one."""
    resource = session.query(Resource).filter_by(name=internal_name).first()
    if resource is None:
        rtype, unit = RESOURCE_TYPES.get(internal_name, ("material", "t"))
        display_name = get_resource_display_name(internal_name, translations)
        resource = Resource(name=display_name, type=rtype, unit=unit)
        session.add(resource)
        session.flush()
    return resource


def import_buildings(buildings_dir: str, game_dir: str | None = None) -> None:
    """Parse building files and import into the database."""
    init_db()

    translations = load_translations(game_dir) if game_dir else None
    if translations:
        print(f"Loaded {len(translations)} translation strings")
    else:
        print("No translations found; using fallback names")

    parsed = parse_buildings_dir(buildings_dir)
    if not parsed:
        print(f"No building .ini files found in {buildings_dir}")
        return

    session = get_session()
    try:
        # Clear existing data
        session.query(BuildingCost).delete()
        session.query(Building).delete()
        session.query(Resource).delete()
        session.flush()

        # Track resources by internal name to avoid duplicates
        resource_cache: dict[str, Resource] = {}

        imported = 0
        for pb in parsed:
            display_name = get_building_display_name(pb.name_id, pb.source_file, translations)
            building = Building(
                name=display_name,
                category=pb.category,
                source_file=pb.source_file,
                workers_needed=pb.workers_needed,
            )
            session.add(building)
            session.flush()

            for res_name, quantity in pb.construction_costs.items():
                if quantity <= 0:
                    continue
                if res_name not in resource_cache:
                    resource_cache[res_name] = get_or_create_resource(
                        session, res_name, translations
                    )
                resource = resource_cache[res_name]
                cost = BuildingCost(
                    building_id=building.id,
                    resource_id=resource.id,
                    quantity=round(quantity, 2),
                    phase="construction",
                )
                session.add(cost)

            imported += 1

        session.commit()
        print(f"Imported {imported} buildings from {buildings_dir}")
        print(f"Resources in DB: {session.query(Resource).count()}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="Import WRSR building data")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--buildings-dir",
        help="Path to buildings_types directory containing .ini files",
    )
    group.add_argument(
        "--game-dir",
        help="Path to WRSR game directory (will look for media_soviet/buildings_types/)",
    )
    args = parser.parse_args()

    game_dir = args.game_dir
    if game_dir:
        buildings_dir = os.path.join(game_dir, "media_soviet", "buildings_types")
        if not os.path.isdir(buildings_dir):
            buildings_dir = os.path.join(game_dir, "media", "buildings_types")
    else:
        buildings_dir = args.buildings_dir

    if not os.path.isdir(buildings_dir):
        print(f"Error: directory not found: {buildings_dir}", file=sys.stderr)
        sys.exit(1)

    import_buildings(buildings_dir, game_dir)


if __name__ == "__main__":
    main()
