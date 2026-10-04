"""Paystack card and bank-transfer payments. On only when PAYSTACK_SECRET_KEY is set;
without it checkout offers pay-on-collection only.
"""

import logging
import secrets

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import Order

API = "https://api.paystack.co"
log = logging.getLogger(__name__)


class PaystackError(Exception):
    pass


def _headers(settings: Settings) -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.paystack_secret_key}"}


def new_reference(order_number: str) -> str:
    return f"{order_number}-{secrets.token_hex(4)}"


async def initialize_payment(
    settings: Settings, *, email: str, amount_ngn: int, reference: str, order_number: str
) -> str:
    """Starts a payment and returns the Paystack page to send the buyer to."""
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{API}/transaction/initialize",
            headers=_headers(settings),
            json={
                "email": email,
                "amount": amount_ngn * 100,  # kobo
                "currency": "NGN",
                "reference": reference,
                "callback_url": f"{settings.frontend_origin}/api/paystack/callback",
                "metadata": {"order_number": order_number},
            },
        )
    body = res.json()
    url = body.get("data", {}).get("authorization_url") if isinstance(body, dict) else None
    if not res.is_success or not isinstance(url, str):
        raise PaystackError(f"Paystack: {body.get('message') if isinstance(body, dict) else res.status_code}")
    return url


async def verify_payment(settings: Settings, reference: str, expected_ngn: int) -> bool:
    """Confirms with Paystack that the payment succeeded for the expected amount."""
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(f"{API}/transaction/verify/{reference}", headers=_headers(settings))
    body = res.json()
    data = body.get("data") if isinstance(body, dict) else None
    if not res.is_success or not isinstance(data, dict):
        return False
    return (
        data.get("status") == "success"
        and data.get("currency") == "NGN"
        and data.get("amount") == expected_ngn * 100
    )


async def start_payment(session: AsyncSession, settings: Settings, order: Order) -> str | None:
    """Gives the order a fresh reference and returns the Paystack page, or None if it can't start."""
    if not settings.paystack_enabled or not order.customer_email:
        return None
    try:
        reference = new_reference(order.number)
        order.paystack_reference = reference
        await session.commit()
        return await initialize_payment(
            settings,
            email=order.customer_email,
            amount_ngn=order.total_ngn,
            reference=reference,
            order_number=order.number,
        )
    except (httpx.HTTPError, PaystackError, ValueError):
        log.exception("[paystack] could not start payment for %s", order.number)
        return None


async def confirm_payment(session: AsyncSession, settings: Settings, reference: str) -> Order | None:
    """Marks the order paid if Paystack confirms the full amount. None for an unknown reference."""
    order = await session.scalar(select(Order).where(Order.paystack_reference == reference))
    if order is None:
        return None
    if order.payment_status != "paid" and settings.paystack_enabled:
        try:
            paid = await verify_payment(settings, reference, order.total_ngn)
        except (httpx.HTTPError, ValueError):
            log.exception("[paystack] could not verify %s", reference)
            paid = False
        if paid:
            order.payment_status = "paid"
            await session.commit()
    return order
