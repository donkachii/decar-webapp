"""Database tables. The Alembic migrations create these; check constraints mirror
the domain rules in CLAUDE.md section 3, so bad data can't get in through the
Supabase table editor either.
"""

import uuid
from collections.abc import Iterable
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    Sequence,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.domain.catalog import (
    CATEGORIES,
    CATEGORY_TYPES,
    CONDITIONS,
    MAKES,
    PART_STATUSES,
    PART_TYPES,
    POSITIONS,
    SHIPPING_CLASSES,
    Category,
    Condition,
    Make,
    PartStatus,
    PartType,
    Position,
    ShippingClass,
)
from app.domain.delivery import (
    DELIVERY_OPTIONS,
    ORDER_STATUSES,
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    DeliveryOption,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
)
from app.domain.sku import SKU_REGEX

# Postgres's own default names, so migrations and the table editor agree.
NAMING_CONVENTION = {
    "pk": "%(table_name)s_pkey",
    "fk": "%(table_name)s_%(column_0_name)s_fkey",
    "uq": "%(table_name)s_%(column_0_N_name)s_key",
    "ix": "%(table_name)s_%(column_0_N_name)s_idx",
    "ck": "%(table_name)s_%(constraint_name)s",
}


def one_of(column: str, values: Iterable[str]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} in ({quoted})"


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    # Domain unions are plain text columns guarded by check constraints, not
    # native enums: adding a part type is a one-line constraint change.
    type_annotation_map = {  # noqa: RUF012
        datetime: DateTime(timezone=True),
        str: Text(),
        Make: Text(),
        Category: Text(),
        PartType: Text(),
        Position: Text(),
        Condition: Text(),
        ShippingClass: Text(),
        PartStatus: Text(),
        DeliveryOption: Text(),
        PaymentMethod: Text(),
        PaymentStatus: Text(),
        OrderStatus: Text(),
    }


class Vehicle(Base):
    __tablename__ = "vehicles"
    __table_args__ = (
        # Rule 1: the fitment key is make + model + generation + facelift. Never year alone.
        UniqueConstraint("make", "model", "generation", "facelift"),
        CheckConstraint(one_of("make", MAKES), name="make_check"),
        CheckConstraint("year_from <= year_to", name="years_check"),
    )

    id: Mapped[str] = mapped_column(primary_key=True)  # 'toyota-camry-xv50-f'
    make: Mapped[Make]
    model: Mapped[str]  # 'Camry'
    generation: Mapped[str]  # 'XV50'
    year_from: Mapped[int]
    year_to: Mapped[int]
    facelift: Mapped[bool]


_type_in_category = " or ".join(
    f"(category = '{category}' and {one_of('type', types)})" for category, types in CATEGORY_TYPES.items()
)


class Part(Base):
    __tablename__ = "parts"
    __table_args__ = (
        CheckConstraint(one_of("category", CATEGORIES), name="category_check"),
        CheckConstraint(one_of("type", PART_TYPES), name="type_check"),
        CheckConstraint(one_of("position", POSITIONS), name="position_check"),
        CheckConstraint(one_of("condition", CONDITIONS), name="condition_check"),
        CheckConstraint(one_of("status", PART_STATUSES), name="status_check"),
        CheckConstraint(one_of("shipping_class", SHIPPING_CLASSES), name="shipping_class_check"),
        CheckConstraint("jsonb_typeof(variants) = 'object'", name="variants_check"),
        CheckConstraint("price_ngn > 0", name="price_ngn_check"),
        CheckConstraint("stock_qty >= 0", name="stock_qty_check"),
        CheckConstraint(f"sku ~ '{SKU_REGEX}'", name="sku_format"),
        CheckConstraint(_type_in_category, name="type_in_category"),
        # Rule 4: Belgium units are one-offs with their own unit suffix.
        CheckConstraint(
            "case when condition like 'belgium-%' "
            "then stock_qty <= 1 and sku ~ '-U[0-9]{2}$' "
            "else sku !~ '-U[0-9]{2}$' end",
            name="belgium_is_one_off",
        ),
        # Grade B and C units must list their defects in plain words.
        CheckConstraint(
            "condition not in ('belgium-b', 'belgium-c') or cardinality(defects) > 0",
            name="defects_listed",
        ),
    )

    sku: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    category: Mapped[Category] = mapped_column(index=True)
    type: Mapped[PartType]
    # Rule 2: position is its own field, never a boolean side.
    position: Mapped[Position]
    condition: Mapped[Condition]
    defects: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    oem_number: Mapped[str | None]
    # Rule 3: variants are structured fields, never prose.
    variants: Mapped[dict[str, str | bool]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    price_ngn: Mapped[int]
    stock_qty: Mapped[int]
    status: Mapped[PartStatus] = mapped_column(server_default="available", index=True)
    # Rule 5: stock truth. Every write that touches stock stamps this.
    stock_checked_at: Mapped[datetime] = mapped_column(server_default=func.now())
    shipping_class: Mapped[ShippingClass]
    images: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    # Kept current by the parts_touch_updated_at trigger, so dashboard edits count too.
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Fitment(Base):
    __tablename__ = "fitment"

    part_sku: Mapped[str] = mapped_column(
        ForeignKey("parts.sku", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True
    )
    vehicle_id: Mapped[str] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    notes: Mapped[str | None]  # 'needs fog lamp holes', 'no parking sensor holes'


class User(Base):
    """A Google account that has signed in. Buyers are optional; the owner needs one for /admin."""

    __tablename__ = "users"
    __mapper_args__ = {"eager_defaults": True}  # noqa: RUF012

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    google_sub: Mapped[str] = mapped_column(unique=True)
    email: Mapped[str]
    name: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_sign_in_at: Mapped[datetime] = mapped_column(server_default=func.now())


order_number_seq = Sequence("order_number_seq", metadata=Base.metadata)


class Order(Base):
    __tablename__ = "orders"
    __mapper_args__ = {"eager_defaults": True}  # noqa: RUF012
    __table_args__ = (
        CheckConstraint(one_of("delivery_option", DELIVERY_OPTIONS), name="delivery_option_check"),
        CheckConstraint(one_of("payment_method", PAYMENT_METHODS), name="payment_method_check"),
        CheckConstraint(one_of("payment_status", PAYMENT_STATUSES), name="payment_status_check"),
        CheckConstraint(one_of("status", ORDER_STATUSES), name="status_check"),
        CheckConstraint("delivery_fee_ngn >= 0", name="delivery_fee_ngn_check"),
        CheckConstraint("subtotal_ngn >= 0", name="subtotal_ngn_check"),
        CheckConstraint("total_ngn >= 0", name="total_ngn_check"),
        Index("orders_created_at_idx", text("created_at desc")),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    number: Mapped[str] = mapped_column(unique=True)  # 'DCR-00012'
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    customer_name: Mapped[str]
    customer_phone: Mapped[str]
    customer_email: Mapped[str | None]
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"))
    delivery_option: Mapped[DeliveryOption]
    delivery_address: Mapped[str | None]
    delivery_state: Mapped[str | None]
    delivery_park: Mapped[str | None]
    delivery_fee_ngn: Mapped[int]
    subtotal_ngn: Mapped[int]
    total_ngn: Mapped[int]
    payment_method: Mapped[PaymentMethod]
    payment_status: Mapped[PaymentStatus] = mapped_column(server_default="pending")
    paystack_reference: Mapped[str | None] = mapped_column(unique=True)
    status: Mapped[OrderStatus] = mapped_column(server_default="new")
    notes: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    items: Mapped[list["OrderItem"]] = relationship(lazy="selectin", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("price_ngn >= 0", name="price_ngn_check"),
        CheckConstraint("qty > 0", name="qty_check"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), primary_key=True)
    sku: Mapped[str] = mapped_column(ForeignKey("parts.sku", onupdate="CASCADE"), primary_key=True)
    name: Mapped[str]  # snapshot at order time
    price_ngn: Mapped[int]  # snapshot at order time, read from the catalog, never the cart
    qty: Mapped[int]
