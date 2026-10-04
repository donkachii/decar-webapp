import re
from pathlib import Path

import httpx
import pytest

from app.photos import plan_photos
from app.services.cloudinary import (
    Account,
    CloudinaryError,
    delivery_url,
    parse_cloudinary_url,
    sign,
    upload,
    uploaded_versions,
)

SKU = "DCR-TOY-CAM-XV50F-HL-FR-BA-U01"
ACCOUNT = Account(cloud_name="decar", api_key="key", api_secret="secret")


def test_signature_matches_cloudinary_docs_example() -> None:
    # https://cloudinary.com/documentation/authentication_signatures
    params = {
        "timestamp": "1315060510",
        "public_id": "sample_image",
        "eager": "w_400,h_300,c_pad|w_260,h_200,c_crop",
    }
    assert sign(params, "abcd") == "bfd09f95f331f558cbd1320e67aa8d488770583e"


def test_cloudinary_url_as_the_console_shows_it() -> None:
    account = Account(cloud_name="decar", api_key="123456789012345", api_secret="aBc-dEf_123")
    assert parse_cloudinary_url("cloudinary://123456789012345:aBc-dEf_123@decar") == account
    # Pasting the whole console line, name included, still works.
    assert parse_cloudinary_url("CLOUDINARY_URL=cloudinary://123456789012345:aBc-dEf_123@decar") == account

    with pytest.raises(CloudinaryError, match="placeholder"):
        parse_cloudinary_url("cloudinary://123456789012345:<your_api_secret>@decar")
    with pytest.raises(CloudinaryError, match="should look like"):
        parse_cloudinary_url("https://res.cloudinary.com/decar")


def test_delivery_url_is_versioned_jpeg() -> None:
    assert (
        delivery_url(ACCOUNT, f"decar/parts/{SKU}/01", 1759500000)
        == f"https://res.cloudinary.com/decar/image/upload/v1759500000/decar/parts/{SKU}/01.jpg"
    )


@pytest.mark.anyio
async def test_upload_sends_a_signed_request() -> None:
    sent: dict[str, str] = {}

    def cloudinary(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://api.cloudinary.com/v1_1/decar/image/upload"
        body = request.read().decode("latin-1")
        sent.update(re.findall(r'name="(\w+)"\r\n\r\n([^\r]*)', body))
        assert 'name="file"; filename="01.jpg"' in body
        return httpx.Response(200, json={"public_id": sent["public_id"], "version": 7})

    async with httpx.AsyncClient(transport=httpx.MockTransport(cloudinary)) as client:
        public_id = f"decar/parts/{SKU}/01"
        version = await upload(client, ACCOUNT, public_id=public_id, filename="01.jpg", data=b"x")

    assert version == 7
    signed = {k: v for k, v in sent.items() if k not in ("api_key", "signature")}
    assert sent["api_key"] == "key"
    assert sent["signature"] == sign(signed, "secret")
    assert signed["asset_folder"] == f"decar/parts/{SKU}"
    assert signed["format"] == "jpg"


@pytest.mark.anyio
async def test_uploaded_versions_follows_pages_and_reports_errors() -> None:
    def cloudinary(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"].startswith("Basic ")
        assert request.url.params["prefix"] == "decar/"
        if "next_cursor" not in request.url.params:
            page = {"resources": [{"public_id": "decar/a", "version": 1}], "next_cursor": "p2"}
            return httpx.Response(200, json=page)
        return httpx.Response(200, json={"resources": [{"public_id": "decar/b", "version": 2}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(cloudinary)) as client:
        assert await uploaded_versions(client, ACCOUNT) == {"decar/a": 1, "decar/b": 2}

    def refused(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "Invalid api_key key"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(refused)) as client:
        with pytest.raises(CloudinaryError, match="Invalid api_key"):
            await uploaded_versions(client, ACCOUNT)


def test_plan_links_sku_folders_in_name_order(tmp_path: Path) -> None:
    files = [
        f"parts/{SKU}/02.jpg",
        f"parts/{SKU}/01.jpeg",
        "library/body/hood/toyota-corolla-2014-usa/01.jpg",
        "library/body/hood/index.csv",
        "library/mirrors/mirror/clip.mp4",
        ".DS_Store",
        "library/.DS_Store",
    ]
    for name in files:
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / name).write_bytes(b"x")

    plan = plan_photos(tmp_path)

    assert plan.errors == []
    assert plan.links == {SKU: [f"decar/parts/{SKU}/01", f"decar/parts/{SKU}/02"]}
    assert sorted(p.public_id for p in plan.photos) == [
        "decar/library/body/hood/toyota-corolla-2014-usa/01",
        f"decar/parts/{SKU}/01",
        f"decar/parts/{SKU}/02",
    ]


def test_plan_reports_layout_mistakes(tmp_path: Path) -> None:
    files = [
        "parts/DCR-TOY-CAMRY-01/01.jpg",
        "parts/loose.jpg",
        f"parts/{SKU}/extra/01.jpg",
        f"parts/{SKU}/03.jpg",
        f"parts/{SKU}/03.png",
        "library/WhatsApp Image.jpeg",
    ]
    for name in files:
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / name).write_bytes(b"x")

    errors = plan_photos(tmp_path).errors

    assert "parts/DCR-TOY-CAMRY-01/01.jpg: DCR-TOY-CAMRY-01 is not a valid SKU" in errors
    assert "parts/loose.jpg: part photos go directly in parts/<SKU>/" in errors
    assert f"parts/{SKU}/extra/01.jpg: part photos go directly in parts/<SKU>/" in errors
    assert f"decar/parts/{SKU}/03: two files share this name with different extensions" in errors
    assert "library/WhatsApp Image.jpeg: rename 'WhatsApp Image' (letters, digits, - and _ only)" in errors
