"""The shop's catalog: vehicles, parts and their fitment, in seed/*.json.

    uv run python -m app.seed --check   validate against CLAUDE.md section 3
    uv run python -m app.seed           validate, then insert what's missing
    uv run python -m app.seed --prune   also delete parts and vehicles no longer in seed/*.json

A part with a null priceNGN or stockQty is a draft: checked, but kept off the
site until the owner fills both in. Only vehicles that a live part fits are
inserted, so the car picker never offers a car with nothing on the shelf.
Inserts skip rows that already exist, so re-running never overwrites live stock
status or prices. Parts on an order are never pruned.
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.db import get_sessionmaker
from app.domain.catalog import (
    CATEGORY_TYPES,
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
from app.models import Fitment, OrderItem, Part, Vehicle

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
    # Null in a draft: the owner hasn't priced or counted it yet.
    price_ngn: int | None = Field(alias="priceNGN")
    stock_qty: int | None
    status: PartStatus
    # Null means "when it goes live": filling in price and count is the stock check.
    stock_checked_at: datetime | None = None
    shipping_class: ShippingClass
    images: list[str]

    @property
    def is_draft(self) -> bool:
        return self.price_ngn is None or self.stock_qty is None


class SeedFitment(SeedModel):
    part_sku: str
    vehicle_id: str
    notes: str | None = None


class Seed(BaseModel):
    vehicles: list[SeedVehicle]
    parts: list[SeedPart]
    fitment: list[SeedFitment]

    @property
    def drafts(self) -> list[SeedPart]:
        return [p for p in self.parts if p.is_draft]


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
        if belgium and p.stock_qty is not None and p.stock_qty > 1:
            errors.append(f"{p.sku}: Belgium units are one-offs (stockQty ≤ 1)")
        if p.condition in ("belgium-b", "belgium-c") and not p.defects:
            errors.append(f"{p.sku}: grade B and C units must list defects")
        if p.stock_qty is not None:
            if p.status == "sold" and p.stock_qty != 0:
                errors.append(f"{p.sku}: sold units have stockQty 0")
            if p.status == "available" and p.stock_qty < 1:
                errors.append(f"{p.sku}: available units need stock")
        if p.price_ngn is not None and p.price_ngn <= 0:
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

    return errors


def live_rows(seed: Seed) -> tuple[list[SeedVehicle], list[SeedPart], list[SeedFitment]]:
    """What goes in the database: priced parts, their fitment, and the vehicles they fit."""
    parts = [p for p in seed.parts if not p.is_draft]
    skus = {p.sku for p in parts}
    fitment = [f for f in seed.fitment if f.part_sku in skus]
    fitted = {f.vehicle_id for f in fitment}
    return [v for v in seed.vehicles if v.id in fitted], parts, fitment


async def insert_seed(seed: Seed) -> None:
    vehicles, parts, fitment = live_rows(seed)
    if not parts:
        return
    async with get_sessionmaker()() as session:
        await session.execute(
            insert(Vehicle).values([v.model_dump() for v in vehicles]).on_conflict_do_nothing()
        )
        # exclude_none: a null stockCheckedAt takes the column default, now().
        await session.execute(
            insert(Part).values([p.model_dump(exclude_none=True) for p in parts]).on_conflict_do_nothing()
        )
        await session.execute(
            insert(Fitment).values([f.model_dump() for f in fitment]).on_conflict_do_nothing()
        )
        await session.commit()


async def prune(seed: Seed) -> tuple[list[str], list[str], list[str]]:
    """Deletes parts and vehicles that seed/*.json no longer lists (fitment goes
    with them). Parts on an order stay, so order history keeps its links; mark
    those sold in /admin. Returns (parts deleted, parts kept, vehicles deleted)."""
    skus = {p.sku for p in seed.parts}
    vehicle_ids = {v.id for v in seed.vehicles}
    async with get_sessionmaker()() as session:
        stale = set((await session.scalars(select(Part.sku).where(Part.sku.not_in(skus)))).all())
        ordered = set((await session.scalars(select(OrderItem.sku).where(OrderItem.sku.in_(stale)))).all())
        doomed = sorted(stale - ordered)
        if doomed:
            await session.execute(delete(Part).where(Part.sku.in_(doomed)))
        gone = (
            await session.scalars(delete(Vehicle).where(Vehicle.id.not_in(vehicle_ids)).returning(Vehicle.id))
        ).all()
        await session.commit()
    return doomed, sorted(ordered), sorted(gone)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--check", action="store_true", help="validate only, don't touch the database")
    parser.add_argument(
        "--prune", action="store_true", help="also delete parts and vehicles no longer in seed/*.json"
    )
    parser.add_argument("--dir", type=Path, default=SEED_DIR, help=f"catalog folder (default {SEED_DIR})")
    args = parser.parse_args()

    seed = load_seed(args.dir)
    errors = check_seed(seed)
    if errors:
        print(f"✗ {len(errors)} problem(s):\n  " + "\n  ".join(errors), file=sys.stderr)
        sys.exit(1)
    vehicles, parts, fitment = live_rows(seed)
    summary = f"{len(vehicles)} vehicles, {len(parts)} parts, {len(fitment)} fitment rows"
    if seed.drafts:
        print(f"… {len(seed.drafts)} draft part(s) stay off the site until priceNGN and stockQty are set:")
        print("  " + "\n  ".join(p.sku for p in seed.drafts))
    if args.check:
        print(f"✓ {summary} ready to go live")
        return

    async def run() -> None:
        if args.prune:
            deleted, kept, vehicles_gone = await prune(seed)
            print(f"✓ Pruned {len(deleted)} part(s) and {len(vehicles_gone)} vehicle(s) no longer in seed/")
            if kept:
                print(
                    "  Kept because they are on an order (mark them sold in /admin):\n  " + "\n  ".join(kept)
                )
        await insert_seed(seed)

    asyncio.run(run())
    print(f"✓ Seeded {summary} (existing rows left as they are)")


if __name__ == "__main__":
    main()
