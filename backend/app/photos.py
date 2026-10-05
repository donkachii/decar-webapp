"""Part photos: upload the photos/ folder to Cloudinary and link each part to its own photos.

    uv run python -m app.photos --check     check the folder and SKUs, upload nothing
    uv run python -m app.photos             upload new photos, then link parts to them
    uv run python -m app.photos --replace   upload every photo again (after editing one)

The folder sits at the repo root, beside backend/ and frontend/:

    photos/parts/<SKU>/01.jpg, 02.jpg …   one folder per part, named by its SKU.
                                           Sorted by name; the first is the card photo.
    photos/library/…                       everything else. Uploaded, never linked.

Each photo goes to Cloudinary as decar/<its path without the extension>, so the
Media Library mirrors this folder. Linking sets a part's images to its folder's
photos; parts without a folder keep theirs. Folders for draft parts (in seed/
without a price or stock count yet) are skipped until the part is live. Files that aren't photos (notes,
videos) are ignored. Needs CLOUDINARY_URL, except for --check.
"""

import argparse
import asyncio
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.db import get_sessionmaker
from app.domain.sku import is_valid_sku
from app.models import Part
from app.seed import load_seed
from app.services import cloudinary
from app.services.cloudinary import Account, CloudinaryError

PHOTOS_DIR = Path(__file__).resolve().parents[2] / "photos"
EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"})
# Names become URL paths: keep them plain so links paste cleanly into WhatsApp.
SAFE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*")
PARALLEL_UPLOADS = 4


@dataclass(frozen=True)
class Photo:
    path: Path
    public_id: str


@dataclass
class Plan:
    photos: list[Photo] = field(default_factory=list)
    links: dict[str, list[str]] = field(default_factory=dict)  # SKU → public ids, card photo first
    errors: list[str] = field(default_factory=list)


def plan_photos(root: Path) -> Plan:
    """Every photo under root with its Cloudinary public id, and the part it belongs to."""
    plan = Plan()
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if path.is_dir() or path.suffix.lower() not in EXTENSIONS:
            continue
        if any(part.startswith(".") for part in rel.parts):
            continue
        segments = [*rel.parent.parts, path.stem]
        bad = next((s for s in segments if not SAFE_NAME.fullmatch(s)), None)
        if bad is not None:
            plan.errors.append(f"{rel}: rename {bad!r} (letters, digits, - and _ only)")
            continue
        public_id = "/".join([cloudinary.ROOT, *segments])
        if rel.parts[0] == "parts":
            if len(rel.parts) != 3:
                plan.errors.append(f"{rel}: part photos go directly in parts/<SKU>/")
                continue
            sku = rel.parts[1]
            if not is_valid_sku(sku):
                plan.errors.append(f"{rel}: {sku} is not a valid SKU")
                continue
            plan.links.setdefault(sku, []).append(public_id)
        plan.photos.append(Photo(path, public_id))

    clashes = [pid for pid, n in Counter(p.public_id for p in plan.photos).items() if n > 1]
    plan.errors.extend(f"{pid}: two files share this name with different extensions" for pid in clashes)
    return plan


def skip_folders(plan: Plan, skus: list[str]) -> None:
    """Leaves these parts' folders out of the upload and the linking."""
    skipped = {pid for sku in skus for pid in plan.links.pop(sku)}
    plan.photos = [p for p in plan.photos if p.public_id not in skipped]


async def known_skus(skus: list[str]) -> set[str]:
    async with get_sessionmaker()() as session:
        return set((await session.scalars(select(Part.sku).where(Part.sku.in_(skus)))).all())


async def upload_missing(account: Account, photos: list[Photo], *, replace: bool) -> dict[str, int]:
    """Uploads photos not on Cloudinary yet (all of them with replace). Returns
    public_id → version for every photo."""
    async with httpx.AsyncClient(timeout=120) as client:
        versions = await cloudinary.uploaded_versions(client, account)
        todo = [p for p in photos if replace or p.public_id not in versions]
        slots = asyncio.Semaphore(PARALLEL_UPLOADS)

        async def send(photo: Photo) -> None:
            async with slots:
                data = await asyncio.to_thread(photo.path.read_bytes)
                versions[photo.public_id] = await cloudinary.upload(
                    client, account, public_id=photo.public_id, filename=photo.path.name, data=data
                )
                print(f"  ↑ {photo.public_id}")

        async with asyncio.TaskGroup() as group:
            for photo in todo:
                group.create_task(send(photo))
    print(f"✓ {len(todo)} uploaded, {len(photos) - len(todo)} already on Cloudinary")
    return versions


async def link_parts(account: Account, links: dict[str, list[str]], versions: dict[str, int]) -> list[str]:
    """Sets each linked part's images to its folder's photos. Returns the SKUs that changed."""
    changed: list[str] = []
    async with get_sessionmaker()() as session:
        parts = (await session.scalars(select(Part).where(Part.sku.in_(list(links))))).all()
        for part in parts:
            images = [cloudinary.delivery_url(account, pid, versions[pid]) for pid in links[part.sku]]
            if part.images != images:
                part.images = images
                changed.append(part.sku)
        await session.commit()
    return sorted(changed)


async def run(root: Path, *, check: bool, replace: bool) -> None:
    plan = plan_photos(root)
    # Every SKU folder must name a real part before anything uploads, so a typo
    # never leaves photos on Cloudinary that nothing links to. Folders for draft
    # parts (in seed/ but not priced yet) wait until the part goes live.
    if plan.links:
        missing = set(plan.links) - await known_skus(list(plan.links))
        waiting = sorted(missing & {p.sku for p in load_seed().drafts})
        plan.errors.extend(
            f"parts/{sku}: no part with this SKU in the database; add the part first"
            for sku in sorted(missing - set(waiting))
        )
        if waiting:
            skip_folders(plan, waiting)
            print(f"… {len(waiting)} draft part folder(s) skipped until the part has a price and stock count")
    if plan.errors:
        raise SystemExit(f"✗ {len(plan.errors)} problem(s):\n  " + "\n  ".join(plan.errors))

    linked = sum(map(len, plan.links.values()))
    summary = f"{len(plan.photos)} photos, {linked} of them for {len(plan.links)} parts"
    if check:
        print(f"✓ {summary}. Nothing uploaded.")
        return

    settings = get_settings()
    if not settings.cloudinary_enabled:
        raise SystemExit("✗ Set CLOUDINARY_URL in backend/.env first (see .env.example).")
    account = cloudinary.parse_cloudinary_url(settings.cloudinary_url)
    print(f"{summary} → Cloudinary account {account.cloud_name}")
    versions = await upload_missing(account, plan.photos, replace=replace)
    changed = await link_parts(account, plan.links, versions)
    print(f"✓ Linked {len(changed)} part(s)" + "".join(f"\n  {sku}" for sku in changed))


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--check", action="store_true", help="check the folder and SKUs, upload nothing")
    parser.add_argument("--replace", action="store_true", help="upload photos already on Cloudinary again")
    parser.add_argument("--dir", type=Path, default=PHOTOS_DIR, help=f"photos folder (default {PHOTOS_DIR})")
    args = parser.parse_args()

    if not args.dir.is_dir():
        sys.exit(f"✗ No photos folder at {args.dir}")
    try:
        asyncio.run(run(args.dir, check=args.check, replace=args.replace))
    except* (CloudinaryError, httpx.HTTPError) as failed:
        # Photos that made it are skipped next time, so just run it again.
        sys.exit("✗ " + "\n✗ ".join(str(e) or type(e).__name__ for e in failed.exceptions))


if __name__ == "__main__":
    main()
