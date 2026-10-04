from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import case, select

from app.auth import SettingsDep
from app.db import SessionDep
from app.domain.catalog import Category, Condition, PartType, Position, ShippingClass
from app.domain.delivery import DELIVERY_RATES, DeliveryOption
from app.domain.sku import normalise_sku
from app.models import Fitment, Part, Vehicle
from app.schemas import FeaturesOut, FitmentOut, PartOut, VehicleOut

router = APIRouter(tags=["catalog"])

MAX_SKUS = 50

# Available units first, then most recently checked.
_listing_order = (
    case({"available": 0, "reserved": 1}, value=Part.status, else_=2),
    Part.stock_checked_at.desc(),
)


@router.get("/vehicles")
async def list_vehicles(session: SessionDep) -> list[VehicleOut]:
    rows = await session.scalars(select(Vehicle).order_by(Vehicle.make, Vehicle.model, Vehicle.year_from))
    return [VehicleOut.model_validate(v) for v in rows]


@router.get("/parts")
async def list_parts(
    session: SessionDep,
    category: Category | None = None,
    types: Annotated[list[PartType] | None, Query(alias="type")] = None,
    positions: Annotated[list[Position] | None, Query(alias="position")] = None,
    conditions: Annotated[list[Condition] | None, Query(alias="condition")] = None,
    vehicle_id: Annotated[str | None, Query(alias="vehicleId", max_length=64)] = None,
    include_sold: Annotated[bool, Query(alias="includeSold")] = False,
) -> list[PartOut]:
    """Listing filters. With vehicleId, only parts with a fitment row for that exact car (rule 1)."""
    query = select(Part).order_by(*_listing_order)
    if vehicle_id:
        query = query.where(Part.sku.in_(select(Fitment.part_sku).where(Fitment.vehicle_id == vehicle_id)))
    if not include_sold:
        query = query.where(Part.status != "sold")
    if category:
        query = query.where(Part.category == category)
    if types:
        query = query.where(Part.type.in_(types))
    if positions:
        query = query.where(Part.position.in_(positions))
    if conditions:
        query = query.where(Part.condition.in_(conditions))
    return [PartOut.model_validate(p) for p in await session.scalars(query)]


@router.get("/parts/by-sku")
async def parts_by_sku(
    session: SessionDep,
    skus: Annotated[list[str], Query(alias="sku", max_length=MAX_SKUS)],
) -> list[PartOut]:
    """Fresh price and status for cart lines. Unknown SKUs are left out."""
    wanted = {s for s in (normalise_sku(raw) for raw in skus) if s}
    if not wanted:
        return []
    rows = await session.scalars(select(Part).where(Part.sku.in_(wanted)))
    return [PartOut.model_validate(p) for p in rows]


@router.get("/parts/{sku}", responses={404: {"description": "No part with that SKU"}})
async def get_part(session: SessionDep, sku: str) -> PartOut:
    value = normalise_sku(sku)
    part = await session.get(Part, value) if value else None
    if part is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No part with that SKU.")
    return PartOut.model_validate(part)


@router.get("/fitment")
async def list_fitment(
    session: SessionDep,
    part_skus: Annotated[list[str] | None, Query(alias="partSku", max_length=MAX_SKUS)] = None,
    vehicle_id: Annotated[str | None, Query(alias="vehicleId", max_length=64)] = None,
) -> list[FitmentOut]:
    query = select(Fitment)
    if part_skus is not None:
        query = query.where(Fitment.part_sku.in_([s for s in map(normalise_sku, part_skus) if s]))
    if vehicle_id:
        query = query.where(Fitment.vehicle_id == vehicle_id)
    return [FitmentOut.model_validate(f) for f in await session.scalars(query)]


@router.get("/delivery/rates", tags=["orders"])
async def delivery_rates() -> dict[DeliveryOption, dict[ShippingClass, int]]:
    """One fee per order, set by the largest shipping class in it."""
    return DELIVERY_RATES


@router.get("/features", tags=["meta"])
async def features(settings: SettingsDep) -> FeaturesOut:
    """What the frontend should offer: Google sign-in, Paystack, demo admin."""
    return FeaturesOut(
        google_sign_in=settings.google_enabled,
        paystack=settings.paystack_enabled,
        demo_admin=settings.demo_admin,
    )
