"""Saved carts: a signed-in buyer's cart lines, so the website and the phone app
show the same cart.

Each client keeps its own cart and saves every change here; on sign-in its
guest cart is merged in. Lines are SKU and quantity only and never reserve a
unit (CLAUDE.md section 7): checkout re-reads status and price as for a guest.
"""

import uuid
from collections.abc import Iterable
from typing import NamedTuple

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CartLine, Part, User

MAX_LINES = 50


class Line(NamedTuple):
    sku: str
    qty: int


async def get_cart(session: AsyncSession, user_id: uuid.UUID) -> list[Line]:
    rows = await session.execute(
        select(CartLine.sku, CartLine.qty).where(CartLine.user_id == user_id).order_by(CartLine.line_no)
    )
    return [Line(sku, qty) for sku, qty in rows]


async def replace_cart(session: AsyncSession, user_id: uuid.UUID, lines: Iterable[Line]) -> list[Line]:
    """The client's whole cart after a change. Last save wins."""
    await _lock(session, user_id)
    return await _write(session, user_id, lines)


async def merge_cart(session: AsyncSession, user_id: uuid.UUID, lines: Iterable[Line]) -> list[Line]:
    """A guest cart joining the account at sign-in: saved lines first, then new ones.

    A part in both keeps the larger quantity, so merging the same cart twice
    changes nothing.
    """
    await _lock(session, user_id)
    return await _write(session, user_id, [*await get_cart(session, user_id), *lines])


async def forget_ordered(session: AsyncSession, user_id: uuid.UUID, skus: Iterable[str]) -> None:
    """Drops ordered parts from the saved cart, in the caller's transaction."""
    await session.execute(delete(CartLine).where(CartLine.user_id == user_id, CartLine.sku.in_(list(skus))))


async def _lock(session: AsyncSession, user_id: uuid.UUID) -> None:
    # One save per account at a time, so the website and the phone can't interleave.
    await session.execute(select(User.id).where(User.id == user_id).with_for_update())


async def _write(session: AsyncSession, user_id: uuid.UUID, lines: Iterable[Line]) -> list[Line]:
    wanted: dict[str, int] = {}
    for sku, qty in lines:
        wanted[sku] = max(qty, wanted.get(sku, 0))
    # Parts no longer in the catalog drop out.
    listed = set(await session.scalars(select(Part.sku).where(Part.sku.in_(list(wanted)))))
    saved = [Line(sku, qty) for sku, qty in wanted.items() if sku in listed][:MAX_LINES]

    await session.execute(delete(CartLine).where(CartLine.user_id == user_id))
    if saved:
        await session.execute(
            insert(CartLine),
            [{"user_id": user_id, "sku": s, "qty": q, "line_no": n} for n, (s, q) in enumerate(saved)],
        )
    await session.commit()
    return saved
