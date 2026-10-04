"""Domain vocabulary. Mirrors CLAUDE.md section 5; change both together.

The frontend keeps the same unions in frontend/lib/catalog/types.ts. The API is
the authority: anything priced, reserved or validated is decided here.
"""

from typing import Literal, get_args

Make = Literal["toyota", "lexus"]
Category = Literal["lights", "bumpers", "body", "mirrors"]
PartType = Literal[
    "headlight",
    "backlight",
    "foglamp",
    "front-bumper",
    "back-bumper",
    "foglamp-cover",
    "hood",
    "fender",
    "door",
    "front-grill",
    "mirror",
]
Position = Literal[
    "front",
    "rear",
    "front-left",
    "front-right",
    "rear-left",
    "rear-right",
    "left",
    "right",
    "inner-left",
    "inner-right",
    "outer-left",
    "outer-right",
    "n/a",
]
Condition = Literal["belgium-a", "belgium-b", "belgium-c", "new-genuine", "new-aftermarket"]
ShippingClass = Literal["small", "medium", "bulky", "oversized"]
PartStatus = Literal["available", "reserved", "sold"]

MAKES: tuple[Make, ...] = get_args(Make)
CATEGORIES: tuple[Category, ...] = get_args(Category)
PART_TYPES: tuple[PartType, ...] = get_args(PartType)
POSITIONS: tuple[Position, ...] = get_args(Position)
CONDITIONS: tuple[Condition, ...] = get_args(Condition)
SHIPPING_CLASSES: tuple[ShippingClass, ...] = get_args(ShippingClass)
PART_STATUSES: tuple[PartStatus, ...] = get_args(PartStatus)

CATEGORY_TYPES: dict[Category, tuple[PartType, ...]] = {
    "lights": ("headlight", "backlight", "foglamp"),
    "bumpers": ("front-bumper", "back-bumper", "foglamp-cover"),
    "body": ("hood", "fender", "door", "front-grill"),
    "mirrors": ("mirror",),
}

# Rule 2: position is its own field. Which positions each part type may use, so
# a door can never be "front" and a hood never "front-left". Outer = body-mounted,
# inner = boot-lid-mounted; one-piece backlights use rear-left/right.
TYPE_POSITIONS: dict[PartType, tuple[Position, ...]] = {
    "headlight": ("front-left", "front-right"),
    "backlight": ("outer-left", "outer-right", "inner-left", "inner-right", "rear-left", "rear-right"),
    "foglamp": ("front-left", "front-right"),
    "front-bumper": ("front",),
    "back-bumper": ("rear",),
    "foglamp-cover": ("front-left", "front-right"),
    "hood": ("front",),
    "fender": ("front-left", "front-right"),
    "door": ("front-left", "front-right", "rear-left", "rear-right"),
    "front-grill": ("front",),
    "mirror": ("left", "right"),
}


def is_belgium(condition: str) -> bool:
    """Rule 4: Belgium units are one-offs with their own photos, grade and SKU suffix."""
    return condition.startswith("belgium-")
