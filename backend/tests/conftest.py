"""API tests run against a real Postgres database, because the stock rules live
in row locks and check constraints. Domain tests need no database.

    createdb decar_test
    uv run pytest

TEST_DATABASE_URL overrides the default. Its database name must end in _test:
every API test wipes it.
"""

import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from urllib.parse import urlparse

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://localhost:5432/decar_test")

# Before any app import reads settings. Blank values beat a developer's .env,
# so tests never send email or call Google, Paystack or Cloudinary.
os.environ.update(
    APP_ENV="test",
    DATABASE_URL=TEST_DATABASE_URL,
    ADMIN_EMAILS="owner@example.com",
    GOOGLE_CLIENT_ID="",
    GOOGLE_CLIENT_SECRET="",
    PAYSTACK_SECRET_KEY="",
    CLOUDINARY_URL="",
    GMAIL_USER="",
    GMAIL_APP_PASSWORD="",
    SESSION_SECRET="",
)

import httpx  # noqa: E402
import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402

from alembic import command  # noqa: E402
from app.config import sqlalchemy_url  # noqa: E402
from app.db import get_sessionmaker  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import insert_seed, load_seed  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def migrated() -> Iterator[None]:
    """Fresh schema from the Alembic migrations, once per run."""
    if not urlparse(TEST_DATABASE_URL).path.endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must name a database ending in _test; the tests wipe it.")
    url = sqlalchemy_url(TEST_DATABASE_URL)
    try:
        create_engine(url).connect().close()
    except OperationalError:
        pytest.skip(f"No test database at {TEST_DATABASE_URL}. Run: createdb decar_test")
    config = Config(str(BACKEND / "alembic.ini"))
    config.attributes["database_url"] = url
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    yield


@pytest.fixture
async def client(migrated: None) -> AsyncIterator[httpx.AsyncClient]:
    """The API over the seed catalog, reset before every test."""
    async with get_sessionmaker()() as session:
        await session.execute(text("truncate order_items, orders, fitment, parts, vehicles, users"))
        await session.execute(text("alter sequence order_number_seq restart"))
        await session.commit()
    await insert_seed(load_seed())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client
