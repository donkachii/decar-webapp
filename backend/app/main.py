from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.db import SessionDep
from app.routers import accounts, admin, catalog, orders


def create_app() -> FastAPI:
    settings = get_settings()
    settings.check_production()

    app = FastAPI(
        title="De Car Revolutionist API",
        version="0.1.0",
        summary="Catalog, fitment, orders, stock and Google sign-in for the storefront.",
    )
    # The Next.js server is the main caller; CORS only matters if a browser calls the API directly.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(catalog.router)
    app.include_router(orders.router)
    app.include_router(accounts.router)
    app.include_router(admin.router)

    @app.get("/health", tags=["meta"])
    async def health(session: SessionDep) -> dict[str, bool]:
        await session.execute(text("select 1"))
        return {"ok": True}

    return app


app = create_app()
