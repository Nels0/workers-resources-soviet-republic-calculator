"""Parse WRSR .btf translation files.

BTF files are binary with the following structure:
- Header (12 bytes):
    - uint32 BE: entry count
    - uint32 BE: (unused here)
    - uint32 BE: (unused here)
- Index (10 bytes per entry):
    - uint32 BE: string ID
    - uint32 BE: character offset into string table
    - uint16 BE: character length
- String table: UTF-16 BE encoded strings, null-separated
"""

import os
import struct


def parse_btf(path: str) -> dict[int, str]:
    """Parse a .btf file and return a dict of ID -> string."""
    with open(path, "rb") as f:
        data = f.read()

    count = struct.unpack(">I", data[0:4])[0]
    index_end = 12 + count * 10

    lookup: dict[int, str] = {}
    for i in range(count):
        pos = 12 + i * 10
        eid = struct.unpack(">I", data[pos : pos + 4])[0]
        eoff = struct.unpack(">I", data[pos + 4 : pos + 8])[0]
        elen = struct.unpack(">H", data[pos + 8 : pos + 10])[0]
        byte_off = index_end + eoff * 2
        byte_len = elen * 2
        s = data[byte_off : byte_off + byte_len].decode("utf-16-be", errors="replace")
        lookup[eid] = s

    return lookup


def load_translations(game_dir: str, lang: str = "English") -> dict[int, str]:
    """Load translations from the game directory."""
    btf_path = os.path.join(game_dir, "media_soviet", f"soviet{lang}.btf")
    if not os.path.exists(btf_path):
        return {}
    return parse_btf(btf_path)


# Map from internal resource name to translation ID
RESOURCE_NAME_IDS: dict[str, int] = {
    "gravel": 500,
    "crops": 501,
    "food": 502,
    "wood": 503,
    "boards": 504,
    "oil": 505,
    "fuel": 506,
    "chemicals": 507,
    "coal": 508,
    "iron": 509,
    "fabric": 510,
    "prefabpanels": 511,
    "alcohol": 512,
    "bitumen": 513,
    "meat": 514,
    "clothes": 515,
    "cement": 516,
    "steel": 517,
    "bricks": 519,
    "livestock": 520,
    "workers": 521,
    "rawgravel": 522,
    "rawcoal": 523,
    "rawiron": 524,
    "asphalt": 525,
    "concrete": 526,
    "ecomponents": 527,
    "eletronics": 528,
    "eletric": 529,
    "mcomponents": 530,
    "plastics": 531,
    "uranium": 534,
    "yellowcake": 535,
    "uf6": 536,
    "nuclearfuel": 537,
    "nuclearfuelburned": 538,
    "rawbauxite": 539,
    "bauxite": 540,
    "alumina": 541,
    "aluminium": 542,
    "water": 543,
    "usagewater": 544,
    "heat": -1,  # no known ID; use fallback
}


def get_resource_display_name(
    internal_name: str, translations: dict[int, str] | None = None
) -> str:
    """Get the in-game display name for a resource."""
    if translations and internal_name in RESOURCE_NAME_IDS:
        tid = RESOURCE_NAME_IDS[internal_name]
        if tid in translations:
            return translations[tid]
    # Fallback: prettify internal name
    return internal_name.replace("_", " ").title()


def get_building_display_name(
    name_id: int | None, filename: str, translations: dict[int, str] | None = None
) -> str:
    """Get the in-game display name for a building."""
    if translations and name_id and name_id in translations:
        return translations[name_id]
    # Fallback: prettify filename
    return filename.removesuffix(".ini").replace("_", " ").title()
