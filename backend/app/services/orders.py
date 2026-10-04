"""Stock and order transactions.

Placing an order (not adding to cart) reserves units. It locks the part rows,
re-reads status and price, and reserves in one transaction, so two buyers can
never both get the same Belgium unit.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import ColumnElement, func, literal, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalog import PartStatus, is_belgium
from app.domain.checkout import Checkout
from app.domain.delivery import delivery_fee
from app.domain.labels import part_title
from app.models import Order, OrderItem, Part, Vehicle, order_number_seq


@dataclass(frozen=True)
class Unavailable:
    skus: list[str]


class UnknownSku(Exception):
    pass


async def place_order(
    session: AsyncSession, checkout: Checkout, user_id: uuid.UUID | None
) -> Order | Unavailable:
    skus = sorted(line.sku for line in checkout.lines)
    # Lock in a fixed order so concurrent checkouts can't deadlock.
    locked = await session.scalars(
        select(Part).where(Part.sku.in_(skus)).order_by(Part.sku).with_for_update()
    )
    parts = {p.sku: p for p in locked}

    unavailable = [
        line.sku
        for line in checkout.lines
        if (part := parts.get(line.sku)) is None or part.status != "available" or part.stock_qty < line.qty
    ]
    if unavailable:
        await session.rollback()
        return Unavailable(unavailable)

    vehicle_id = checkout.vehicle_id
    if vehicle_id and await session.get(Vehicle, vehicle_id) is None:
        vehicle_id = None

    items = [
        OrderItem(
            sku=line.sku,
            name=part_title(parts[line.sku].name, parts[line.sku].position),
            price_ngn=parts[line.sku].price_ngn,
            qty=line.qty,
        )
        for line in checkout.lines
    ]
    subtotal = sum(i.price_ngn * i.qty for i in items)
    fee = delivery_fee(checkout.delivery, [p.shipping_class for p in parts.values()])
    number = await session.scalar(select(order_number_seq.next_value()))

    order = Order(
        number=f"DCR-{number:05d}",
        user_id=user_id,
        customer_name=checkout.name,
        customer_phone=checkout.phone,
        customer_email=checkout.email,
        vehicle_id=vehicle_id,
        delivery_option=checkout.delivery,
        delivery_address=checkout.address,
        delivery_state=checkout.state,
        delivery_park=checkout.park,
        delivery_fee_ngn=fee,
        subtotal_ngn=subtotal,
        total_ngn=subtotal + fee,
        payment_method=checkout.payment,
        payment_status="pending",
        status="new",
        notes=checkout.notes,
        items=items,
    )
    session.add(order)

    for line in checkout.lines:
        part = parts[line.sku]
        part.stock_qty -= line.qty
        if is_belgium(part.condition) or part.stock_qty == 0:
            part.status = "reserved"

    await session.commit()
    return order


async def get_order(session: AsyncSession, order_id: uuid.UUID) -> Order | None:
    return await session.get(Order, order_id)


async def _lock_new_order(session: AsyncSession, order_id: uuid.UUID) -> Order | None:
    order = await session.scalar(select(Order).where(Order.id == order_id).with_for_update())
    return order if order is not None and order.status == "new" else None


async def _lock_order_parts(session: AsyncSession, order: Order) -> dict[str, Part]:
    skus = sorted(i.sku for i in order.items)
    locked = await session.scalars(
        select(Part).where(Part.sku.in_(skus)).order_by(Part.sku).with_for_update()
    )
    return {p.sku: p for p in locked}


async def complete_order(session: AsyncSession, order_id: uuid.UUID) -> None:
    """Handed over and paid: reserved units become sold."""
    order = await _lock_new_order(session, order_id)
    if order is None:
        await session.rollback()
        return
    order.status = "completed"
    parts = await _lock_order_parts(session, order)
    reserved = [sku for sku, part in parts.items() if part.status == "reserved"]
    if reserved:
        await session.execute(
            update(Part).where(Part.sku.in_(reserved)).values(status="sold", stock_checked_at=func.now())
        )
    await session.commit()


async def cancel_order(session: AsyncSession, order_id: uuid.UUID) -> None:
    """Buyer backed out: units go back on the shelf."""
    order = await _lock_new_order(session, order_id)
    if order is None:
        await session.rollback()
        return
    order.status = "cancelled"
    parts = await _lock_order_parts(session, order)
    for item in order.items:
        part = parts.get(item.sku)
        if part is None or part.status == "sold":
            continue
        part.stock_qty = 1 if is_belgium(part.condition) else part.stock_qty + item.qty
        part.status = "available"
    await session.commit()


async def set_part_status(session: AsyncSession, sku: str, status: PartStatus) -> None:
    """Admin-lite: mark a unit sold or available. Always stamps stock_checked_at."""
    stock_qty: ColumnElement[int] = (
        literal(0)
        if status == "sold"
        else func.greatest(Part.stock_qty, 1)
        if status == "available"
        else Part.stock_qty.expression
    )
    updated = await session.scalar(
        update(Part)
        .where(Part.sku == sku)
        .values(status=status, stock_qty=stock_qty, stock_checked_at=func.now())
        .returning(Part.sku)
    )
    if updated is None:
        await session.rollback()
        raise UnknownSku(sku)
    await session.commit()


async def touch_stock_check(session: AsyncSession, sku: str) -> None:
    updated = await session.scalar(
        update(Part).where(Part.sku == sku).values(stock_checked_at=func.now()).returning(Part.sku)
    )
    if updated is None:
        await session.rollback()
        raise UnknownSku(sku)
    await session.commit()
