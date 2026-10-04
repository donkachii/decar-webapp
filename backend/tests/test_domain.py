import pytest

from app.domain.checkout import Checkout, clean_lines, normalise_phone, validate_checkout
from app.domain.delivery import delivery_fee
from app.domain.labels import format_ngn, part_title, vehicle_label
from app.domain.sku import build_sku, normalise_sku
from app.schemas import CheckoutIn, CheckoutLineIn


def test_sku_examples_from_claude_md() -> None:
    assert (
        build_sku(
            make="toyota",
            model="Camry",
            generation="XV50",
            facelift=True,
            type="headlight",
            position="front-right",
            condition="belgium-a",
            unit=1,
        )
        == "DCR-TOY-CAM-XV50F-HL-FR-BA-U01"
    )
    assert (
        build_sku(
            make="lexus",
            model="RX",
            generation="AL20",
            facelift=False,
            type="front-bumper",
            position="front",
            condition="new-aftermarket",
        )
        == "DCR-LEX-RX-AL20P-FB-F-NA"
    )


def test_position_na_is_xx_not_na() -> None:
    sku = build_sku(
        make="toyota",
        model="Camry",
        generation="XV50",
        facelift=True,
        type="hood",
        position="n/a",
        condition="new-aftermarket",
    )
    assert sku == "DCR-TOY-CAM-XV50F-HD-XX-NA"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("dcr-toy-cam-xv50f-hl-fr-ba-u01", "DCR-TOY-CAM-XV50F-HL-FR-BA-U01"),
        ("DCR-TOY-CAM-XV50F-HL-FR-BA-U01%20", "DCR-TOY-CAM-XV50F-HL-FR-BA-U01"),
        ("DCR-TOY-CAM-XV50F-HL-FR-BA-U1", None),
        ("../etc/passwd", None),
    ],
)
def test_normalise_sku(raw: str, expected: str | None) -> None:
    assert normalise_sku(raw) == expected


def test_part_title_adds_position_only_when_it_tells_you_something() -> None:
    assert part_title("Camry 2015–2017 headlight", "front-right") == "Camry 2015–2017 headlight, front-right"
    assert part_title("Camry 2015–2017 front bumper", "front") == "Camry 2015–2017 front bumper"
    assert part_title("Lexus ES backlight", "inner-right") == "Lexus ES backlight, inner right"


def test_labels() -> None:
    assert vehicle_label("toyota", "Camry", 2015, 2017) == "Toyota Camry 2015–2017"
    assert format_ngn(185000) == "₦185,000"


def test_delivery_fee_is_set_by_the_largest_item() -> None:
    assert delivery_fee("abuja", ["small", "bulky", "medium"]) == 8000
    assert delivery_fee("pickup", ["oversized"]) == 0
    assert delivery_fee("waybill", []) == 0


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0803 123 4567", "+2348031234567"),
        ("803 123 4567", "+2348031234567"),
        ("+234 803 123 4567", "+2348031234567"),
        ("2348031234567", "+2348031234567"),
        ("12345", None),
    ],
)
def test_normalise_phone(raw: str, expected: str | None) -> None:
    assert normalise_phone(raw) == expected


def test_clean_lines_drops_bad_lines_and_merges_duplicates() -> None:
    lines = clean_lines(
        [
            CheckoutLineIn(sku="dcr-toy-cam-xv50f-hl-fr-ba-u01", qty=1),
            CheckoutLineIn(sku="nonsense", qty=1),
            CheckoutLineIn(sku="DCR-TOY-CAM-XV50P-HL-FR-NA", qty=0),
            CheckoutLineIn(sku="DCR-TOY-CAM-XV50P-HL-FR-NA", qty=21),
            CheckoutLineIn(sku="DCR-TOY-CAM-XV50F-HL-FR-BA-U01", qty=2),
        ]
    )
    assert [(line.sku, line.qty) for line in lines] == [("DCR-TOY-CAM-XV50F-HL-FR-BA-U01", 2)]


def test_checkout_keeps_only_the_address_fields_for_the_chosen_delivery() -> None:
    result = validate_checkout(
        CheckoutIn(
            name="Ada Obi",
            phone="08031234567",
            delivery="pickup",
            address="Somewhere in Wuse",
            payment="pay-later",
            lines=[CheckoutLineIn(sku="DCR-TOY-CAM-XV50P-HL-FR-NA", qty=1)],
        ),
        paystack_enabled=False,
    )
    assert isinstance(result, Checkout)
    assert result.address is None
    assert result.phone == "+2348031234567"
