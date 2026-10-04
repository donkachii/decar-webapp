"""SKU convention (CLAUDE.md section 5).

    DCR-{MAKE}-{MODEL}-{GEN}{F|P}-{TYPE}-{POS}-{COND}[-U##]

These tables are locked: never rename a code once a part has been sold under it.
Add new codes, never edit old ones. Position "n/a" is XX so it can't be confused
with condition NA. The -U## unit suffix is required for every Belgium unit and
absent otherwise. The vehicle segment names the part's primary vehicle only; the
fitment table is the source of truth for what a part fits.
"""

import re
from urllib.parse import unquote

from app.domain.catalog import Condition, Make, PartType, Position

MAKE_CODES: dict[Make, str] = {
    "toyota": "TOY",
    "lexus": "LEX",
}

MODEL_CODES: dict[str, str] = {
    "Camry": "CAM",
    "Corolla": "COR",
    "Highlander": "HLN",
    "Sienna": "SIE",
    "RAV4": "RAV",
    "RX": "RX",
    "ES": "ES",
    "GX": "GX",
}

TYPE_CODES: dict[PartType, str] = {
    "headlight": "HL",
    "backlight": "BL",
    "foglamp": "FG",
    "front-bumper": "FB",
    "back-bumper": "RB",
    "foglamp-cover": "FC",
    "hood": "HD",
    "fender": "FD",
    "door": "DR",
    "front-grill": "GR",
    "mirror": "MR",
}

POSITION_CODES: dict[Position, str] = {
    "front": "F",
    "rear": "R",
    "front-left": "FL",
    "front-right": "FR",
    "rear-left": "RL",
    "rear-right": "RR",
    "left": "LH",
    "right": "RH",
    "inner-left": "IL",
    "inner-right": "IR",
    "outer-left": "OL",
    "outer-right": "OR",
    "n/a": "XX",
}

CONDITION_CODES: dict[Condition, str] = {
    "belgium-a": "BA",
    "belgium-b": "BB",
    "belgium-c": "BC",
    "new-genuine": "NG",
    "new-aftermarket": "NA",
}

# Same expression as the parts.sku_format check constraint in the migration.
SKU_REGEX = r"^DCR-(TOY|LEX)-[A-Z0-9]+-[A-Z0-9]+[FP]-[A-Z]{2}-[A-Z]{1,2}-(BA|BB|BC|NG|NA)(-U[0-9]{2})?$"
SKU_PATTERN = re.compile(SKU_REGEX)
UNIT_SUFFIX = re.compile(r"-U([0-9]{2})$")


def build_sku(
    *,
    make: Make,
    model: str,
    generation: str,
    facelift: bool,
    type: PartType,
    position: Position,
    condition: Condition,
    unit: int | None = None,
) -> str:
    model_code = MODEL_CODES.get(model)
    if model_code is None:
        raise ValueError(f"No SKU model code for {model}")
    segments = [
        "DCR",
        MAKE_CODES[make],
        model_code,
        f"{generation.upper()}{'F' if facelift else 'P'}",
        TYPE_CODES[type],
        POSITION_CODES[position],
        CONDITION_CODES[condition],
    ]
    if unit is not None:
        segments.append(f"U{unit:02d}")
    return "-".join(segments)


def is_valid_sku(sku: str) -> bool:
    return SKU_PATTERN.fullmatch(sku) is not None


def normalise_sku(raw: str) -> str | None:
    """Normalises a SKU from a URL or request body. None when it cannot be a SKU."""
    sku = unquote(raw).strip().upper()
    return sku if is_valid_sku(sku) else None
