"""Placeholder catalog: 10 vehicles, 36 parts and their fitment, in seed/*.json.

    uv run python -m app.seed --check   validate against CLAUDE.md section 3
    uv run python -m app.seed           validate, then insert what's missing

Inserts skip rows that already exist, so re-running never overwrites live stock
status or prices.
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from pydantic.alias_generators import to_camel
from sqlalchemy.dialects.postgresql import insert

from app.db import get_sessionmaker
from app.domain.catalog import (
    CATEGORY_TYPES,
    CONDITIONS,
    TYPE_POSITIONS,
    Category,
    Condition,
    Make,
    PartStatus,
    PartType,
    Position,
    ShippingClass,
    is_belgium,
)
from app.domain.sku import MODEL_CODES, UNIT_SUFFIX, build_sku, is_valid_sku
from app.models import Fitment, Part, Vehicle

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


class SeedModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class SeedVehicle(SeedModel):
    id: str
    make: Make
    model: str
    generation: str
    year_from: int
    year_to: int
    facelift: bool


class SeedPart(SeedModel):
    sku: str
    name: str
    category: Category
    type: PartType
    position: Position
    condition: Condition
    defects: list[str] = Field(default_factory=list)
    oem_number: str | None = None
    variants: dict[str, str | bool]
    price_ngn: int = Field(alias="priceNGN")
    stock_qty: int
    status: PartStatus
    stock_checked_at: datetime
    shipping_class: ShippingClass
    images: list[str]


class SeedFitment(SeedModel):
    part_sku: str
    vehicle_id: str
    notes: str | None = None


class Seed(BaseModel):
    vehicles: list[SeedVehicle]
    parts: list[SeedPart]
    fitment: list[SeedFitment]


def load_seed(directory: Path = SEED_DIR) -> Seed:
    def read(name: str) -> object:
        return json.loads((directory / name).read_text(encoding="utf-8"))

    return Seed(
        vehicles=TypeAdapter(list[SeedVehicle]).validate_python(read("vehicles.json")),
        parts=TypeAdapter(list[SeedPart]).validate_python(read("parts.json")),
        fitment=TypeAdapter(list[SeedFitment]).validate_python(read("fitment.json")),
    )


def check_seed(seed: Seed) -> list[str]:
    """Every problem found, in plain words. Empty when the seed follows the rules."""
    errors: list[str] = []
    vehicle_ids = {v.id for v in seed.vehicles}
    skus: set[str] = set()

    for v in seed.vehicles:
        expected = f"{v.make}-{v.model.lower()}-{v.generation.lower()}-{'f' if v.facelift else 'p'}"
        if v.id != expected:
            errors.append(f"Vehicle {v.id}: id should be {expected}")
        if v.model not in MODEL_CODES:
            errors.append(f"Vehicle {v.id}: no SKU model code for {v.model}")
        if v.year_from > v.year_to:
            errors.append(f"Vehicle {v.id}: yearFrom after yearTo")

    fits = {(f.part_sku, f.vehicle_id) for f in seed.fitment}

    for p in seed.parts:
        if p.sku in skus:
            errors.append(f"{p.sku}: duplicate SKU")
        skus.add(p.sku)

        if not is_valid_sku(p.sku):
            errors.append(f"{p.sku}: does not match the SKU pattern")
        if p.type not in CATEGORY_TYPES[p.category]:
            errors.append(f"{p.sku}: {p.type} is not in {p.category}")
        if p.position not in TYPE_POSITIONS[p.type]:
            errors.append(f"{p.sku}: {p.type} cannot be {p.position}")

        belgium = is_belgium(p.condition)
        unit = UNIT_SUFFIX.search(p.sku)
        if belgium and not unit:
            errors.append(f"{p.sku}: Belgium units need a -U## suffix")
        if not belgium and unit:
            errors.append(f"{p.sku}: only Belgium units take a -U## suffix")
        if belgium and p.stock_qty > 1:
            errors.append(f"{p.sku}: Belgium units are one-offs (stockQty ≤ 1)")
        if p.condition in ("belgium-b", "belgium-c") and not p.defects:
            errors.append(f"{p.sku}: grade B and C units must list defects")
        if p.status == "sold" and p.stock_qty != 0:
            errors.append(f"{p.sku}: sold units have stockQty 0")
        if p.status == "available" and p.stock_qty < 1:
            errors.append(f"{p.sku}: available units need stock")
        if p.price_ngn <= 0:
            errors.append(f"{p.sku}: price must be above zero")
        if not p.images:
            errors.append(f"{p.sku}: needs at least one image")

        # The SKU's vehicle segment must name a real vehicle, and the part must fit it.
        primary = next(
            (
                v
                for v in seed.vehicles
                if v.model in MODEL_CODES
                and build_sku(
                    make=v.make,
                    model=v.model,
                    generation=v.generation,
                    facelift=v.facelift,
                    type=p.type,
                    position=p.position,
                    condition=p.condition,
                    unit=int(unit.group(1)) if unit else None,
                )
                == p.sku
            ),
            None,
        )
        if primary is None:
            errors.append(f"{p.sku}: no vehicle produces this SKU from its type, position and condition")
        elif (p.sku, primary.id) not in fits:
            errors.append(f"{p.sku}: has no fitment row for its own vehicle {primary.id}")

    seen: set[tuple[str, str]] = set()
    for f in seed.fitment:
        if f.part_sku not in skus:
            errors.append(f"Fitment {f.part_sku}: unknown part")
        if f.vehicle_id not in vehicle_ids:
            errors.append(f"Fitment {f.part_sku}: unknown vehicle {f.vehicle_id}")
        if (f.part_sku, f.vehicle_id) in seen:
            errors.append(f"Fitment {f.part_sku}|{f.vehicle_id}: duplicate row")
        seen.add((f.part_sku, f.vehicle_id))

    errors.extend(
        f"No part uses condition {c}" for c in CONDITIONS if not any(p.condition == c for p in seed.parts)
    )
    return errors


async def insert_seed(seed: Seed) -> None:
    async with get_sessionmaker()() as session:
        await session.execute(
            insert(Vehicle).values([v.model_dump() for v in seed.vehicles]).on_conflict_do_nothing()
        )
        await session.execute(
            insert(Part).values([p.model_dump() for p in seed.parts]).on_conflict_do_nothing()
        )
        await session.execute(
            insert(Fitment).values([f.model_dump() for f in seed.fitment]).on_conflict_do_nothing()
        )
        await session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--check", action="store_true", help="validate only, don't touch the database")
    args = parser.parse_args()

    seed = load_seed()
    errors = check_seed(seed)
    if errors:
        print(f"✗ {len(errors)} problem(s):\n  " + "\n  ".join(errors), file=sys.stderr)
        sys.exit(1)
    summary = f"{len(seed.vehicles)} vehicles, {len(seed.parts)} parts, {len(seed.fitment)} fitment rows"
    if args.check:
        print(f"✓ {summary}")
        return
    asyncio.run(insert_seed(seed))
    print(f"✓ Seeded {summary} (existing rows left as they are)")


if __name__ == "__main__":
    main()
