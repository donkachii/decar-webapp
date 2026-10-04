from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(
        settings.sqlalchemy_url,
        pool_pre_ping=True,
        # Supabase's transaction pooler (port 6543) can't hold prepared
        # statements, so never prepare. Costs nothing on a direct connection.
        connect_args={"prepare_threshold": None},
        # Tests run each case on a fresh event loop; pooled connections would
        # outlive theirs.
        poolclass=NullPool if settings.app_env == "test" else None,
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
