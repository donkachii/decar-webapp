from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.auth import SettingsDep, SignedInUser, create_session_token, is_admin
from app.db import SessionDep
from app.models import Order, User
from app.schemas import GoogleExchangeIn, GoogleUrlOut, MeOut, OrderOut, SessionOut, UserOut
from app.services import google

router = APIRouter(tags=["accounts"])


def _require_google(settings: SettingsDep) -> None:
    if not settings.google_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in isn't set up.")


@router.get("/auth/google/url")
async def google_url(
    settings: SettingsDep, state: Annotated[str, Query(min_length=16, max_length=200)]
) -> GoogleUrlOut:
    """Where to send the buyer. The frontend keeps `state` in a cookie and checks it on return."""
    _require_google(settings)
    return GoogleUrlOut(url=google.authorization_url(settings, state))


@router.post("/auth/google/exchange", responses={400: {"description": "Google rejected the sign-in"}})
async def google_exchange(body: GoogleExchangeIn, session: SessionDep, settings: SettingsDep) -> SessionOut:
    """Trades Google's one-time code for an API session token."""
    _require_google(settings)
    try:
        identity = await google.exchange_code(settings, body.code)
    except google.GoogleSignInError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google sign-in didn't finish.") from error

    user = await session.scalar(
        insert(User)
        .values(google_sub=identity.sub, email=identity.email, name=identity.name)
        .on_conflict_do_update(
            index_elements=[User.google_sub],
            set_={"email": identity.email, "name": identity.name, "last_sign_in_at": func.now()},
        )
        .returning(User)
    )
    await session.commit()
    if user is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not save the account.")
    return SessionOut(token=create_session_token(settings, user.id), user=UserOut.model_validate(user))


@router.get("/me", responses={401: {"description": "Not signed in"}})
async def me(user: SignedInUser, settings: SettingsDep) -> MeOut:
    return MeOut(user=UserOut.model_validate(user), is_admin=is_admin(settings, user))


@router.get("/me/orders", responses={401: {"description": "Not signed in"}})
async def my_orders(user: SignedInUser, session: SessionDep) -> list[OrderOut]:
    rows = await session.scalars(
        select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc())
    )
    return [OrderOut.model_validate(o) for o in rows]
