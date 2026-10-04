"""Admin-lite for the owner's phone. Every route checks the signed-in owner first."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.auth import require_admin
from app.db import SessionDep
from app.domain.sku import normalise_sku
from app.models import Order
from app.schemas import OrderOut, PartStatusIn
from app.services import orders

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
    responses={401: {"description": "Not signed in"}, 403: {"description": "Not in ADMIN_EMAILS"}},
)


def _sku(raw: str) -> str:
    sku = normalise_sku(raw)
    if sku is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No part with that SKU.")
    return sku


@router.get("/orders")
async def list_orders(session: SessionDep, limit: Annotated[int, Query(ge=1, le=200)] = 50) -> list[OrderOut]:
    rows = await session.scalars(select(Order).order_by(Order.created_at.desc()).limit(limit))
    return [OrderOut.model_validate(o) for o in rows]


@router.post("/parts/{sku}/status", status_code=status.HTTP_204_NO_CONTENT)
async def set_part_status(sku: str, body: PartStatusIn, session: SessionDep) -> None:
    """The "Mark as sold" and "Mark available" buttons. Stamps stock checked."""
    try:
        await orders.set_part_status(session, _sku(sku), body.status)
    except orders.UnknownSku as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No part with that SKU.") from error


@router.post("/parts/{sku}/checked", status_code=status.HTTP_204_NO_CONTENT)
async def mark_checked(sku: str, session: SessionDep) -> None:
    """The "Checked it now" button: the unit is on the shelf. Stamps stock checked."""
    try:
        await orders.touch_stock_check(session, _sku(sku))
    except orders.UnknownSku as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No part with that SKU.") from error


@router.post("/orders/{order_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
async def complete_order(order_id: uuid.UUID, session: SessionDep) -> None:
    """Handed over and paid: reserved units become sold."""
    await orders.complete_order(session, order_id)


@router.post("/orders/{order_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_order(order_id: uuid.UUID, session: SessionDep) -> None:
    """Buyer backed out: units go back on the shelf."""
    await orders.cancel_order(session, order_id)
