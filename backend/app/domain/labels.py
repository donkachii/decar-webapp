"""Plain-text labels for text that leaves the API: order item names and emails.

The frontend has richer display labels (word joiners, hints) in
frontend/lib/catalog/labels.ts. Text produced here is already plain.
"""

from app.domain.catalog import Make, Position

POSITION_LABELS: dict[Position, str] = {
    "front": "Front",
    "rear": "Rear",
    "front-left": "Front-left",
    "front-right": "Front-right",
    "rear-left": "Rear-left",
    "rear-right": "Rear-right",
    "left": "Left",
    "right": "Right",
    "inner-left": "Inner left",
    "inner-right": "Inner right",
    "outer-left": "Outer left",
    "outer-right": "Outer right",
    "n/a": "Not applicable",
}

MAKE_LABELS: dict[Make, str] = {"toyota": "Toyota", "lexus": "Lexus"}


def part_title(name: str, position: Position) -> str:
    """'Camry 2015–2017 headlight, front-right'. Front, rear and n/a are implied by the name."""
    if position in ("n/a", "front", "rear"):
        return name
    return f"{name}, {POSITION_LABELS[position].lower()}"


def vehicle_label(make: Make, model: str, year_from: int, year_to: int) -> str:
    """'Toyota Camry 2015–2017'"""
    return f"{MAKE_LABELS[make]} {model} {year_from}–{year_to}"


def format_ngn(amount: int) -> str:
    """₦185,000"""
    return f"₦{amount:,}"
