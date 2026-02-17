"""Parse WRSR .ini building definition files and companion .bbox files.

The game stores building definitions as line-oriented text files with $-prefixed
directives.  Construction costs are either explicit ($COST_RESOURCE) or computed
automatically ($COST_RESOURCE_AUTO) from 3D bounding-box geometry.

This module is based on the logic in the reference parser at
reference/workers_and_resources/workers_and_resources.py and the game source
excerpt in cost_resource_auto.txt.
"""

import os
import struct
from dataclasses import dataclass, field

# Auto-cost lookup table.
# Each entry: (ground_weight, wall_weight, volume_weight,
#              workers, concrete, gravel, asphalt, bricks, boards,
#              steel, mcomponents, ecomponents, prefabpanels)
AUTO_DICT: dict[str, tuple[float, ...]] = {
    "ground":           (1, 0, 0.08,    150, 13, 10, 0, 0, 0, 0, 0, 0, 0),
    "ground_asphalt":   (1, 0, 0.08,    150, 13, 10, 8, 0, 0, 0, 0, 0, 0),
    "wall_concrete":    (0, 1, 0.3,     100, 22, 0, 0, 0, 0, 5, 0, 0, 0),
    "wall_panels":      (0, 1, 0.3,     65, 0, 0, 0, 0, 0, 1, 0, 0, 10),
    "wall_brick":       (0, 1, 0.3,     140, 0, 0, 0, 12, 4, 1.5, 0, 0, 0),
    "wall_steel":       (0, 1, 0.3,     90, 0, 0, 0, 0, 0, 8, 0, 0, 0),
    "wall_wood":        (0, 1, 0.3,     90, 0, 0, 0, 0, 10, 0, 0, 0, 0),
    "tech_steel":       (0, 0.25, 0.8,  170, 0, 0, 0, 0, 0, 6, 1.25, 0, 0),
    "techelectro_steel":(0, 0.25, 0.8,  190, 0, 0, 0, 0, 0, 5, 0.85, 0.55, 0),
    "electro_steel":    (0, 0.25, 0.8,  170, 0, 0, 0, 0, 0, 6, 0, 1.25, 0),
    "roof_woodbrick":   (1, 0, 0.05,    87, 0, 0, 0, 2, 10, 0, 0, 0, 0),
    "roof_steel":       (1, 0, 0.05,    95, 0, 0, 0, 0, 0, 7, 0, 0, 0),
    "roof_woodsteel":   (1, 0, 0.05,    85, 0, 0, 0, 0, 5, 3, 0, 0, 0),
    "roof_asphalt":     (1, 0, 0.05,    87, 0, 0, 8, 0, 0, 0, 0, 0, 0),
}

# Resource fields corresponding to auto_dict indices 3..12
RESOURCE_FIELDS = [
    "workers", "concrete", "gravel", "asphalt", "bricks",
    "boards", "steel", "mcomponents", "ecomponents", "prefabpanels",
]

# Category guesses based on $TYPE_ prefix or filename patterns
TYPE_CATEGORIES: dict[str, str] = {
    "RESIDENTIAL": "residential",
    "MINE": "industry",
    "FACTORY": "industry",
    "PRODUCTION": "industry",
    "FARM": "industry",
    "POWERPLANT": "power",
    "HEATING": "heating",
    "SCHOOL": "education",
    "UNIVERSITY": "education",
    "KINDERGARTEN": "education",
    "HOSPITAL": "health",
    "CHURCH": "religion",
    "MONUMENT": "monument",
    "SPORT": "sport",
    "SHOP": "commerce",
    "PUB": "commerce",
    "WAREHOUSE": "storage",
    "PARKING": "infrastructure",
    "STATION": "infrastructure",
    "ROAD": "infrastructure",
    "RAIL": "infrastructure",
    "AIRPORT": "infrastructure",
}


@dataclass
class BBoxShape:
    name: str
    xs: float
    ys: float
    zs: float


@dataclass
class ParsedBuilding:
    name: str
    source_file: str
    name_id: int | None = None
    category: str = ""
    workers_needed: int = 0
    construction_costs: dict[str, float] = field(default_factory=dict)
    production: dict[str, float] = field(default_factory=dict)
    consumption: dict[str, float] = field(default_factory=dict)


def parse_bbox(path: str) -> dict[str, BBoxShape]:
    """Parse a .bbox binary file into a dict of shape name -> dimensions."""
    shapes: dict[str, BBoxShape] = {}
    try:
        with open(path, "rb") as f:
            data = f.read(4)
            if len(data) < 4:
                return shapes
            numshapes = struct.unpack("I", data)[0]
            for _ in range(numshapes):
                chunk = f.read(540)
                if len(chunk) < 540:
                    break
                name_bytes, _index, xmin, ymin, zmin, xmax, ymax, zmax = struct.unpack(
                    "512sIffffff", chunk
                )
                name = name_bytes[: name_bytes.find(b"\0")].decode("ascii", errors="replace")
                xs = xmax - xmin
                ys = ymax - ymin
                zs = zmax - zmin
                if name:
                    shapes[name] = BBoxShape(name, xs, ys, zs)
    except (OSError, struct.error):
        pass
    return shapes


def _compute_auto_costs(
    auto_type: str, weight: float, nodes: set[str], shapes: dict[str, BBoxShape]
) -> dict[str, float]:
    """Compute resource costs for a $COST_RESOURCE_AUTO directive."""
    if auto_type not in AUTO_DICT:
        return {}

    mul = weight * 0.5
    volume = 0.0
    ground = 0.0
    walls = 0.0

    for node_name in nodes:
        if node_name in shapes:
            s = shapes[node_name]
            volume += s.xs * s.ys * s.zs
            ground += s.xs * s.zs
            walls += 2.0 * (s.xs + s.zs) * s.ys

    ground /= 300.0
    walls /= 300.0
    volume /= 3000.0

    a = AUTO_DICT[auto_type]
    factor = ground * a[0] + walls * a[1] + volume * a[2]

    costs: dict[str, float] = {}
    for i, resource_name in enumerate(RESOURCE_FIELDS):
        value = mul * factor * a[i + 3]
        if value > 0:
            costs[resource_name] = value
    return costs


def _guess_category(types_found: list[str], filename: str) -> str:
    """Guess a building category from $TYPE_ lines and filename."""
    for t in types_found:
        upper = t.upper().removeprefix("$TYPE_")
        for key, cat in TYPE_CATEGORIES.items():
            if key in upper:
                return cat
    fn = filename.upper()
    for key, cat in TYPE_CATEGORIES.items():
        if key in fn:
            return cat
    return "other"


def _prettify_name(filename: str) -> str:
    """Turn 'coal_mine.ini' into 'Coal Mine'."""
    stem = filename.removesuffix(".ini")
    # Split trailing numbers: 'airplaneparking_30' -> 'Airplane Parking 30'
    return stem.replace("_", " ").title()


def parse_building(ini_path: str, bbox_path: str | None = None, source_file: str | None = None) -> ParsedBuilding:
    """Parse a single WRSR building .ini file.

    If bbox_path is provided (or inferred from ini_path), auto-cost
    calculations will use the 3D geometry.  Without it, only explicit
    $COST_RESOURCE entries are captured.

    source_file overrides the default (basename of ini_path) for display
    and disambiguation purposes (e.g. 'dlc3/airport_terminal_small').
    """
    if bbox_path is None:
        bbox_path = ini_path.rsplit(".", 1)[0] + ".bbox"

    shapes = parse_bbox(bbox_path) if os.path.exists(bbox_path) else {}
    filename = os.path.basename(ini_path)
    sf = source_file if source_file is not None else filename

    building = ParsedBuilding(
        name=_prettify_name(sf),
        source_file=sf,
    )

    types_found: list[str] = []
    # Track per-phase auto costs
    autos: dict[str, float] = {}
    nodes: set[str] = set()

    def flush_autos():
        for auto_type, weight in autos.items():
            auto_costs = _compute_auto_costs(auto_type, weight, nodes, shapes)
            for res, val in auto_costs.items():
                building.construction_costs[res] = building.construction_costs.get(res, 0) + val

    with open(ini_path, "r", errors="replace") as f:
        for line in f:
            parts = line.split()
            if not parts:
                continue

            cmd = parts[0]

            if cmd == "$NAME" and len(parts) >= 2:
                try:
                    building.name_id = int(parts[1])
                except ValueError:
                    pass
            elif cmd.startswith("$TYPE_"):
                types_found.append(cmd)
            elif cmd == "$WORKERS_NEEDED" and len(parts) >= 2:
                building.workers_needed = int(parts[1])
            elif cmd == "$PRODUCTION" and len(parts) >= 3:
                building.production[parts[1]] = float(parts[2])
            elif cmd == "$CONSUMPTION" and len(parts) >= 3:
                building.consumption[parts[1]] = float(parts[2])
            elif cmd == "$CONSUMPTION_PER_SECOND" and len(parts) >= 3:
                building.consumption[parts[1]] = float(parts[2])
            elif cmd == "$COST_WORK":
                # New construction phase — flush previous autos
                flush_autos()
                autos = {}
                nodes = set()
            elif cmd == "$COST_RESOURCE_AUTO" and len(parts) >= 3:
                auto_type = parts[1].strip(",")
                weight = float(parts[2].strip(","))
                autos[auto_type] = weight
            elif cmd == "$COST_RESOURCE" and len(parts) >= 3:
                res_name = parts[1]
                amount = float(parts[2])
                building.construction_costs[res_name] = (
                    building.construction_costs.get(res_name, 0) + amount
                )
            elif cmd == "$COST_WORK_BUILDING_NODE" and len(parts) >= 2:
                nodes.add(parts[1])
            elif cmd == "$COST_WORK_BUILDING_KEYWORD" and len(parts) >= 2:
                keyword = parts[1].lstrip("$")
                if keyword == "all":
                    nodes.update(shapes.keys())
                else:
                    for k in shapes:
                        if k.startswith(keyword):
                            nodes.add(k)
            elif cmd == "$COST_WORK_BUILDING_ALL":
                nodes.update(shapes.keys())

        # Flush any remaining autos from the last phase
        flush_autos()

    building.category = _guess_category(types_found, sf)
    return building


def parse_buildings_dir(buildings_dir: str) -> list[ParsedBuilding]:
    """Parse all .ini files in a buildings directory."""
    results: list[ParsedBuilding] = []
    for filename in sorted(os.listdir(buildings_dir)):
        if not filename.endswith(".ini"):
            continue
        # Skip crop fields (zero cost)
        if filename.startswith("field_"):
            continue
        ini_path = os.path.join(buildings_dir, filename)
        try:
            building = parse_building(ini_path)
            results.append(building)
        except Exception as exc:
            print(f"Warning: failed to parse {filename}: {exc}")
    return results


def parse_dlc_buildings_dir(dlc_buildings_dir: str, dlc_name: str) -> list[ParsedBuilding]:
    """Parse DLC buildings from a nested directory structure.

    Each building is in its own subdirectory containing building.ini.
    source_file is set to '{dlc_name}/{subdir_name}'.
    """
    results: list[ParsedBuilding] = []
    for subdir in sorted(os.listdir(dlc_buildings_dir)):
        subdir_path = os.path.join(dlc_buildings_dir, subdir)
        if not os.path.isdir(subdir_path):
            continue
        ini_path = os.path.join(subdir_path, "building.ini")
        if not os.path.exists(ini_path):
            continue
        bbox_path = os.path.join(subdir_path, "building.bbox")
        source_file = f"{dlc_name}/{subdir}"
        try:
            building = parse_building(ini_path, bbox_path, source_file=source_file)
            results.append(building)
        except Exception as exc:
            print(f"Warning: failed to parse {source_file}: {exc}")
    return results
