import asyncio
from typing import Any

import httpx
import pytest
from sqlalchemy import select

from app.auth import create_session_token
from app.config import get_settings
from app.db import get_sessionmaker
from app.models import Part, User

pytestmark = pytest.mark.anyio

CAMRY_F = "toyota-camry-xv50-f"
BELGIUM_UNIT = "DCR-TOY-CAM-XV50F-HL-FR-BA-U01"  # one-off, ₦185,000, medium
NEW_STOCK = "DCR-TOY-CAM-XV50P-HL-FR-NA"  # 4 on the shelf, ₦78,000, medium


def checkout(*lines: tuple[str, int], **fields: str) -> dict[str, Any]:
    return {
        "name": "Ada Obi",
        "phone": "0803 123 4567",
        "delivery": "pickup",
        "payment": "pay-later",
        "lines": [{"sku": sku, "qty": qty} for sku, qty in lines],
        **fields,
    }


async def part(sku: str) -> Part:
    async with get_sessionmaker()() as session:
        found = await session.get(Part, sku)
        assert found is not None
        return found


async def signed_in(email: str) -> dict[str, str]:
    async with get_sessionmaker()() as session:
        user = User(google_sub=f"google-{email}", email=email, name="Test")
        session.add(user)
        await session.commit()
        return {"Authorization": f"Bearer {create_session_token(get_settings(), user.id)}"}


async def test_listing_filters_by_exact_vehicle(client: httpx.AsyncClient) -> None:
    """Rule 1: fitment is per generation + facelift, never shared platform."""
    vehicles = (await client.get("/vehicles")).json()
    assert len(vehicles) == 10

    rx = (await client.get("/parts", params={"vehicleId": "lexus-rx-al20-p"})).json()
    highlander = (await client.get("/parts", params={"vehicleId": "toyota-highlander-xu50-f"})).json()
    assert rx and highlander
    assert not {p["sku"] for p in rx} & {p["sku"] for p in highlander}

    lights = (await client.get("/parts", params={"vehicleId": CAMRY_F, "category": "lights"})).json()
    assert {p["category"] for p in lights} == {"lights"}
    statuses = [p["status"] for p in lights]
    assert statuses == sorted(statuses, key=["available", "reserved", "sold"].index)


async def test_part_json_matches_the_frontend_types(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"/parts/{BELGIUM_UNIT.lower()}")).json()
    assert body["sku"] == BELGIUM_UNIT
    assert body["priceNGN"] == 185000
    assert body["stockCheckedAt"].endswith("Z")
    assert {"stockQty", "shippingClass", "oemNumber", "defects", "variants"} <= body.keys()
    assert (await client.get("/parts/DCR-NOT-REAL")).status_code == 404


async def test_order_reserves_belgium_unit_and_reads_price_from_catalog(client: httpx.AsyncClient) -> None:
    res = await client.post(
        "/orders",
        json=checkout(
            (BELGIUM_UNIT, 1),
            (NEW_STOCK, 2),
            delivery="waybill",
            state="Lagos",
            park="Jibowu",
            vehicleId=CAMRY_F,
        ),
    )
    assert res.status_code == 201
    order = res.json()["order"]
    assert order["number"] == "DCR-00001"
    assert order["subtotalNGN"] == 185000 + 2 * 78000
    assert order["deliveryFeeNGN"] == 8000  # waybill, largest item medium
    assert order["totalNGN"] == order["subtotalNGN"] + 8000
    assert order["customerPhone"] == "+2348031234567"
    assert {i["name"] for i in order["items"]} == {
        "Camry 2015–2017 headlight, front-right",
        "Camry 2012–2014 headlight, front-right",
    }

    belgium, new = await part(BELGIUM_UNIT), await part(NEW_STOCK)
    assert (belgium.status, belgium.stock_qty) == ("reserved", 0)
    assert (new.status, new.stock_qty) == ("available", 2)

    second = await client.post("/orders", json=checkout((BELGIUM_UNIT, 1)))
    assert second.status_code == 409
    assert second.json()["unavailable"] == [BELGIUM_UNIT]


async def test_concurrent_checkouts_cannot_both_get_one_unit(client: httpx.AsyncClient) -> None:
    results = await asyncio.gather(
        *(client.post("/orders", json=checkout((BELGIUM_UNIT, 1))) for _ in range(4))
    )
    assert sorted(r.status_code for r in results) == [201, 409, 409, 409]


async def test_checkout_errors_map_to_fields(client: httpx.AsyncClient) -> None:
    res = await client.post(
        "/orders", json=checkout((NEW_STOCK, 1), name="A", phone="123", delivery="abuja", payment="paystack")
    )
    assert res.status_code == 422
    body = res.json()
    assert body["message"] == "Check the highlighted fields."
    assert set(body["fieldErrors"]) == {"name", "phone", "address", "payment", "email"}

    empty = await client.post("/orders", json=checkout())
    assert empty.json() == {"message": "Your cart is empty."}


async def test_cancel_puts_units_back_and_complete_marks_them_sold(client: httpx.AsyncClient) -> None:
    owner = await signed_in("owner@example.com")

    first = (await client.post("/orders", json=checkout((BELGIUM_UNIT, 1), (NEW_STOCK, 3)))).json()["order"]
    assert (await client.post(f"/admin/orders/{first['id']}/cancel", headers=owner)).status_code == 204
    assert ((await part(BELGIUM_UNIT)).status, (await part(BELGIUM_UNIT)).stock_qty) == ("available", 1)
    assert (await part(NEW_STOCK)).stock_qty == 4

    second = (await client.post("/orders", json=checkout((BELGIUM_UNIT, 1)))).json()["order"]
    assert (await client.post(f"/admin/orders/{second['id']}/complete", headers=owner)).status_code == 204
    assert (await part(BELGIUM_UNIT)).status == "sold"

    # Completing twice, or cancelling a completed order, changes nothing.
    assert (await client.post(f"/admin/orders/{second['id']}/cancel", headers=owner)).status_code == 204
    assert (await part(BELGIUM_UNIT)).status == "sold"


async def test_admin_needs_the_owner(client: httpx.AsyncClient) -> None:
    """Rule 5: the owner marks units sold from his phone; nobody else can."""
    path = f"/admin/parts/{BELGIUM_UNIT}/status"
    assert (await client.post(path, json={"status": "sold"})).status_code == 401
    buyer = await signed_in("buyer@example.com")
    assert (await client.post(path, json={"status": "sold"}, headers=buyer)).status_code == 403
    forged = {"Authorization": "Bearer not-a-real-token"}
    assert (await client.post(path, json={"status": "sold"}, headers=forged)).status_code == 401

    before = (await part(BELGIUM_UNIT)).stock_checked_at
    owner = await signed_in("Owner@Example.com")
    assert (await client.post(path, json={"status": "sold"}, headers=owner)).status_code == 204
    sold = await part(BELGIUM_UNIT)
    assert (sold.status, sold.stock_qty) == ("sold", 0)
    assert sold.stock_checked_at > before

    listing = (await client.get("/parts", params={"vehicleId": CAMRY_F})).json()
    assert BELGIUM_UNIT not in {p["sku"] for p in listing}


async def test_signed_in_orders_and_public_order_page(client: httpx.AsyncClient) -> None:
    buyer = await signed_in("buyer@example.com")
    me = (await client.get("/me", headers=buyer)).json()
    assert me["isAdmin"] is False

    placed = await client.post(
        "/orders", json=checkout((NEW_STOCK, 1), email="Buyer@Example.com"), headers=buyer
    )
    order = placed.json()["order"]
    assert order["userId"] == me["user"]["id"]
    assert order["customerEmail"] == "buyer@example.com"

    mine = (await client.get("/me/orders", headers=buyer)).json()
    assert [o["id"] for o in mine] == [order["id"]]
    assert (await client.get("/me/orders")).status_code == 401

    public = (await client.get(f"/orders/{order['id']}")).json()
    assert public["customerPhone"] == "+234803•••67"
    assert public["customerEmail"] is None
    assert public["userId"] is None


async def test_google_sign_in_is_off_without_keys(client: httpx.AsyncClient) -> None:
    features = (await client.get("/features")).json()
    assert features == {"googleSignIn": False, "paystack": False, "demoAdmin": False}
    assert (await client.get("/auth/google/url", params={"state": "x" * 32})).status_code == 503


async def test_users_are_upserted_by_google_subject(client: httpx.AsyncClient) -> None:
    await signed_in("buyer@example.com")
    async with get_sessionmaker()() as session:
        users = (await session.scalars(select(User))).all()
    assert [u.email for u in users] == ["buyer@example.com"]
