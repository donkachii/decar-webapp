from typing import Literal, get_args

from app.domain.catalog import ShippingClass

DeliveryOption = Literal["pickup", "abuja", "waybill"]
PaymentMethod = Literal["paystack", "pay-later"]
PaymentStatus = Literal["pending", "paid", "failed"]
OrderStatus = Literal["new", "completed", "cancelled"]

DELIVERY_OPTIONS: tuple[DeliveryOption, ...] = get_args(DeliveryOption)
PAYMENT_METHODS: tuple[PaymentMethod, ...] = get_args(PaymentMethod)
PAYMENT_STATUSES: tuple[PaymentStatus, ...] = get_args(PaymentStatus)
ORDER_STATUSES: tuple[OrderStatus, ...] = get_args(OrderStatus)

DELIVERY_LABELS: dict[DeliveryOption, str] = {
    "pickup": "Pick up at Zuba Market shop",
    "abuja": "Abuja delivery",
    "waybill": "Interstate waybill",
}

# PLACEHOLDER rates until the owner confirms them. One fee per order, set by the
# largest item, because one trip carries everything. The frontend reads these
# from GET /delivery/rates, so this is the only copy.
DELIVERY_RATES: dict[DeliveryOption, dict[ShippingClass, int]] = {
    "pickup": {"small": 0, "medium": 0, "bulky": 0, "oversized": 0},
    "abuja": {"small": 3000, "medium": 5000, "bulky": 8000, "oversized": 12000},
    "waybill": {"small": 5000, "medium": 8000, "bulky": 15000, "oversized": 25000},
}

_CLASS_RANK: dict[ShippingClass, int] = {"small": 0, "medium": 1, "bulky": 2, "oversized": 3}


def largest_shipping_class(classes: list[ShippingClass]) -> ShippingClass | None:
    return max(classes, key=_CLASS_RANK.__getitem__, default=None)


def delivery_fee(option: DeliveryOption, classes: list[ShippingClass]) -> int:
    largest = largest_shipping_class(classes)
    return DELIVERY_RATES[option][largest] if largest else 0
