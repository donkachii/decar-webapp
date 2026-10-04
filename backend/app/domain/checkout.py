"""Checkout validation. Messages are shown next to form fields, so they follow
the copy rules in CLAUDE.md section 8.
"""

import re
from dataclasses import dataclass

from app.domain.delivery import DELIVERY_OPTIONS, DeliveryOption, PaymentMethod
from app.domain.sku import normalise_sku
from app.schemas import CheckoutIn, CheckoutLineIn

MAX_LINES = 30
MAX_QTY = 20
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@dataclass(frozen=True)
class Line:
    sku: str
    qty: int


@dataclass(frozen=True)
class Checkout:
    name: str
    phone: str
    email: str | None
    delivery: DeliveryOption
    address: str | None
    state: str | None
    park: str | None
    payment: PaymentMethod
    notes: str | None
    vehicle_id: str | None
    lines: list[Line]


@dataclass(frozen=True)
class CheckoutErrors:
    message: str
    field_errors: dict[str, str]


def normalise_phone(raw: str) -> str | None:
    """0803 123 4567, 803 123 4567, +234 803 123 4567 → +2348031234567"""
    digits = re.sub(r"[^\d+]", "", raw)
    if re.fullmatch(r"\+234\d{10}", digits):
        return digits
    if re.fullmatch(r"234\d{10}", digits):
        return f"+{digits}"
    if re.fullmatch(r"0\d{10}", digits):
        return f"+234{digits[1:]}"
    if re.fullmatch(r"[789]\d{9}", digits):
        return f"+234{digits}"
    return None


def clean_lines(raw: list[CheckoutLineIn]) -> list[Line]:
    """Valid SKUs only, one line per SKU (the last one wins), quantities 1 to 20."""
    lines: dict[str, int] = {}
    for item in raw[:MAX_LINES]:
        sku = normalise_sku(item.sku)
        if sku and 1 <= item.qty <= MAX_QTY:
            lines[sku] = item.qty
    return [Line(sku, qty) for sku, qty in lines.items()]


def _delivery(value: str) -> DeliveryOption | None:
    for option in DELIVERY_OPTIONS:
        if option == value:
            return option
    return None


def validate_checkout(form: CheckoutIn, *, paystack_enabled: bool) -> Checkout | CheckoutErrors:
    name = form.name.strip()
    phone = normalise_phone(form.phone.strip())
    email = form.email.strip().lower()
    delivery = _delivery(form.delivery.strip())
    address = form.address.strip()
    state = form.state.strip()
    park = form.park.strip()
    payment = form.payment.strip()
    notes = form.notes.strip()[:500]
    lines = clean_lines(form.lines)

    if not lines:
        return CheckoutErrors("Your cart is empty.", {})

    errors: dict[str, str] = {}
    if not 2 <= len(name) <= 80:
        errors["name"] = "Enter your name."
    if not phone:
        errors["phone"] = "Enter a Nigerian phone number, like 0803 123 4567."
    if email and not EMAIL.match(email):
        errors["email"] = "Check the email address."
    if delivery is None:
        errors["delivery"] = "Choose how you want to get your parts."
    if delivery == "abuja" and len(address) < 5:
        errors["address"] = "Enter the delivery address in Abuja."
    if delivery == "waybill" and len(state) < 2:
        errors["state"] = "Enter the destination state."
    if delivery == "waybill" and len(park) < 2:
        errors["park"] = "Enter the park where you'll collect it."
    if payment not in ("paystack", "pay-later"):
        errors["payment"] = "Choose how you want to pay."
    if payment == "paystack" and not paystack_enabled:
        errors["payment"] = "Card payment isn't available yet. Choose to pay later."
    if payment == "paystack" and not email:
        errors["email"] = "Paystack needs an email address for your receipt."

    if errors or phone is None or delivery is None:
        return CheckoutErrors("Check the highlighted fields.", errors)

    return Checkout(
        name=name,
        phone=phone,
        email=email or None,
        delivery=delivery,
        address=address if delivery == "abuja" else None,
        state=state if delivery == "waybill" else None,
        park=park if delivery == "waybill" else None,
        payment="paystack" if payment == "paystack" else "pay-later",
        notes=notes or None,
        vehicle_id=form.vehicle_id or None,
        lines=lines,
    )
