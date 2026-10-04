"""Part photos on Cloudinary. On only when CLOUDINARY_URL is set.

Uploads are signed with the API secret, so only the backend can add photos.
The site only reads the public delivery URLs stored in each part's `images`.
Every asset lives under the `decar/` folder.
"""

import hashlib
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import unquote, urlsplit

import httpx

API = "https://api.cloudinary.com/v1_1"
ROOT = "decar"

# Phone photos run to 4000 px and several MB. Cap what's stored; uploads are
# also stored as JPEG so HEIC photos work in browsers, next/image and OG images.
INCOMING_TRANSFORMATION = "c_limit,w_2000,h_2000"


class CloudinaryError(Exception):
    pass


@dataclass(frozen=True)
class Account:
    cloud_name: str
    api_key: str
    api_secret: str


def parse_cloudinary_url(url: str) -> Account:
    """Reads cloudinary://<api_key>:<api_secret>@<cloud_name>, as the console shows it."""
    url = url.strip().removeprefix("CLOUDINARY_URL=")
    parts = urlsplit(url)
    credentials, _, cloud_name = parts.netloc.rpartition("@")
    api_key, _, api_secret = credentials.partition(":")
    if parts.scheme != "cloudinary" or not (cloud_name and api_key and api_secret):
        raise CloudinaryError(
            "CLOUDINARY_URL should look like cloudinary://<api_key>:<api_secret>@<cloud_name>"
        )
    if api_secret.startswith("<") or "*" in api_secret:
        raise CloudinaryError("CLOUDINARY_URL still holds the placeholder secret; copy the real one.")
    return Account(cloud_name=cloud_name, api_key=unquote(api_key), api_secret=unquote(api_secret))


def sign(params: Mapping[str, str], api_secret: str) -> str:
    """Cloudinary's request signature: name=value pairs sorted by name, joined
    with &, the API secret appended, then SHA-1."""
    payload = "&".join(f"{name}={params[name]}" for name in sorted(params))
    return hashlib.sha1(f"{payload}{api_secret}".encode()).hexdigest()


def delivery_url(account: Account, public_id: str, version: int) -> str:
    """The URL stored in a part's images. A new version (photo replaced) is a new
    URL, so no cache ever serves the old photo."""
    return f"https://res.cloudinary.com/{account.cloud_name}/image/upload/v{version}/{public_id}.jpg"


async def upload(
    client: httpx.AsyncClient, account: Account, *, public_id: str, filename: str, data: bytes
) -> int:
    """Uploads one photo to public_id, replacing any photo already there. Returns its version."""
    params = {
        "public_id": public_id,
        # Places the photo in the Media Library folder on accounts in dynamic
        # folder mode; fixed-folder accounts take folders from the public_id.
        "asset_folder": public_id.rpartition("/")[0],
        "format": "jpg",
        "transformation": INCOMING_TRANSFORMATION,
        "overwrite": "true",
        "invalidate": "true",
        "timestamp": str(int(time.time())),
    }
    res = await client.post(
        f"{API}/{account.cloud_name}/image/upload",
        data={**params, "api_key": account.api_key, "signature": sign(params, account.api_secret)},
        files={"file": (filename, data)},
    )
    version = _body(res).get("version")
    if not res.is_success or not isinstance(version, int):
        raise CloudinaryError(f"Upload {public_id}: {_error(res)}")
    return version


async def uploaded_versions(client: httpx.AsyncClient, account: Account) -> dict[str, int]:
    """public_id → version for every photo already under decar/."""
    found: dict[str, int] = {}
    cursor: str | None = None
    while True:
        params = {"prefix": f"{ROOT}/", "max_results": "500"}
        if cursor:
            params["next_cursor"] = cursor
        res = await client.get(
            f"{API}/{account.cloud_name}/resources/image/upload",
            params=params,
            auth=(account.api_key, account.api_secret),
        )
        body = _body(res)
        resources = body.get("resources")
        if not res.is_success or not isinstance(resources, list):
            raise CloudinaryError(f"Listing photos: {_error(res)}")
        for r in resources:
            if not isinstance(r, dict):
                continue
            public_id, version = r.get("public_id"), r.get("version")
            if isinstance(public_id, str) and isinstance(version, int):
                found[public_id] = version
        cursor = body.get("next_cursor")
        if not isinstance(cursor, str):
            return found


def _body(res: httpx.Response) -> dict[str, Any]:
    try:
        body = res.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _error(res: httpx.Response) -> str:
    error = _body(res).get("error")
    message = error.get("message") if isinstance(error, dict) else None
    return message if isinstance(message, str) else f"HTTP {res.status_code}"
