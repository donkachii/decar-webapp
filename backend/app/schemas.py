"""Request and response bodies.

JSON names match the TypeScript types in frontend/lib (camelCase, with NGN in
capitals: priceNGN, totalNGN), so the frontend reads responses as they are.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel

from app.domain.catalog import Category, Condition, Make, PartStatus, PartType, Position, ShippingClass
from app.domain.delivery import DeliveryOption, OrderStatus, PaymentMethod, PaymentStatus


def api_name(field: str) -> str:
    return to_camel(field).replace("Ngn", "NGN")


def iso_utc(value: datetime) -> str:
    """Same shape as JavaScript's toISOString(), so ISO strings sort correctly as text."""
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


UtcDatetime = Annotated[datetime, PlainSerializer(iso_utc, return_type=str)]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=api_name, populate_by_name=True, from_attributes=True)


# --- Catalog ----------------------------------------------------------------


class VehicleOut(ApiModel):
    id: str
    make: Make
    model: str
    generation: str
    year_from: int
    year_to: int
    facelift: bool


class PartOut(ApiModel):
    sku: str
    name: str
    category: Category
    type: PartType
    position: Position
    condition: Condition
    defects: list[str]
    oem_number: str | None
    variants: dict[str, str | bool]
    price_ngn: int
    stock_qty: int
    status: PartStatus
    stock_checked_at: UtcDatetime
    shipping_class: ShippingClass
    images: list[str]


class FitmentOut(ApiModel):
    part_sku: str
    vehicle_id: str
    notes: str | None


class FeaturesOut(ApiModel):
    google_sign_in: bool
    paystack: bool
    demo_admin: bool


# --- Orders -----------------------------------------------------------------


class OrderItemOut(ApiModel):
    sku: str
    name: str
    price_ngn: int
    qty: int


class OrderOut(ApiModel):
    id: uuid.UUID
    number: str
    user_id: uuid.UUID | None
    customer_name: str
    customer_phone: str
    customer_email: str | None
    vehicle_id: str | None
    delivery_option: DeliveryOption
    delivery_address: str | None
    delivery_state: str | None
    delivery_park: str | None
    delivery_fee_ngn: int
    subtotal_ngn: int
    total_ngn: int
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    paystack_reference: str | None
    status: OrderStatus
    notes: str | None
    created_at: UtcDatetime
    items: list[OrderItemOut]

    def public(self) -> "OrderOut":
        """What anyone holding the order link may see: phone masked, no email or account."""
        phone = self.customer_phone
        masked = f"{phone[:7]}•••{phone[-2:]}" if len(phone) > 6 else phone
        return self.model_copy(
            update={
                "customer_phone": masked,
                "customer_email": None,
                "user_id": None,
                "paystack_reference": None,
            }
        )


class CheckoutLineIn(ApiModel):
    sku: str = Field(max_length=64)
    qty: int


class CheckoutIn(ApiModel):
    """Raw checkout form. Validated by app.domain.checkout so errors map to form fields."""

    name: str = Field(default="", max_length=500)
    phone: str = Field(default="", max_length=100)
    email: str = Field(default="", max_length=320)
    delivery: str = Field(default="", max_length=20)
    address: str = Field(default="", max_length=1000)
    state: str = Field(default="", max_length=200)
    park: str = Field(default="", max_length=200)
    payment: str = Field(default="", max_length=20)
    notes: str = Field(default="", max_length=2000)
    vehicle_id: str | None = Field(default=None, max_length=64)
    lines: list[CheckoutLineIn] = Field(default_factory=list, max_length=100)


class CheckoutOut(ApiModel):
    order: OrderOut
    # Paystack page to send the buyer to. Null for pay-later, or when Paystack
    # couldn't start (the order page then offers "Pay now" again).
    payment_url: str | None


class CheckoutErrorOut(ApiModel):
    message: str
    field_errors: dict[str, str] | None = None
    unavailable: list[str] | None = None


class PaymentStartOut(ApiModel):
    payment_url: str | None


class PaystackVerifyIn(ApiModel):
    reference: str = Field(max_length=100)


class PaystackVerifyOut(ApiModel):
    order_id: uuid.UUID
    paid: bool


# --- Accounts ---------------------------------------------------------------


class UserOut(ApiModel):
    id: uuid.UUID
    email: str
    name: str | None


class MeOut(ApiModel):
    user: UserOut
    is_admin: bool


class GoogleUrlOut(ApiModel):
    url: str


class GoogleExchangeIn(ApiModel):
    code: str = Field(max_length=2000)


class GoogleIdTokenIn(ApiModel):
    id_token: str = Field(max_length=4096)


class SessionOut(ApiModel):
    token: str
    user: UserOut
    # Signing up and signing in are one Google flow; True when this one made the account.
    created: bool


class CartLineIn(ApiModel):
    sku: str = Field(max_length=64)
    qty: int = Field(ge=1, le=99)


class CartLineOut(ApiModel):
    sku: str
    qty: int


class SavedCartIn(ApiModel):
    lines: list[CartLineIn] = Field(max_length=50)


class SavedCartOut(ApiModel):
    """A signed-in buyer's cart, the same on the website and the phone. Prices are read at checkout."""

    lines: list[CartLineOut]


# --- Admin ------------------------------------------------------------------


class PartStatusIn(ApiModel):
    status: PartStatus
