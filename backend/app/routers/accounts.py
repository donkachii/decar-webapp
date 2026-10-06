from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    SettingsDep,
    SignedInUser,
    app_return_allowed,
    create_app_code,
    create_session_token,
    is_admin,
    redeem_app_code,
)
from app.config import Settings
from app.db import SessionDep
from app.models import Order, User
from app.schemas import (
    AppCodeOut,
    AppSessionIn,
    CartLineOut,
    GoogleAppCodeIn,
    GoogleExchangeIn,
    GoogleIdTokenIn,
    GoogleUrlOut,
    MeOut,
    OrderOut,
    SavedCartIn,
    SavedCartOut,
    SessionOut,
    UserOut,
)
from app.services import carts, google

router = APIRouter(tags=["accounts"])


def _require_google(settings: SettingsDep) -> None:
    if not settings.google_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in isn't set up.")


@router.get("/auth/google/url", responses={400: {"description": "appReturn is not the app"}})
async def google_url(
    settings: SettingsDep,
    state: Annotated[str, Query(min_length=16, max_length=200)],
    app_return: Annotated[str | None, Query(alias="appReturn", max_length=500)] = None,
) -> GoogleUrlOut:
    """Where to send the buyer. The frontend keeps `state` in a cookie and checks it on return.

    `appReturn` marks a phone-app sign-in in the browser: the address the website
    will hand the app's one-time code to, checked here before the buyer leaves.
    """
    _require_google(settings)
    if app_return is not None and not app_return_allowed(settings, app_return):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That address can't receive a sign-in.")
    return GoogleUrlOut(url=google.authorization_url(settings, state))


@router.post("/auth/google/exchange", responses={400: {"description": "Google rejected the sign-in"}})
async def google_exchange(body: GoogleExchangeIn, session: SessionDep, settings: SettingsDep) -> SessionOut:
    """Trades Google's one-time code for an API session token."""
    _require_google(settings)
    try:
        identity = await google.exchange_code(settings, body.code)
    except google.GoogleSignInError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google sign-in didn't finish.") from error
    return await _sign_in(session, settings, identity)


@router.post("/auth/google/id-token", responses={400: {"description": "Google rejected the sign-in"}})
async def google_id_token(body: GoogleIdTokenIn, session: SessionDep, settings: SettingsDep) -> SessionOut:
    """The phone app's sign-in: Google signed the buyer in on the phone and gave the app an ID token."""
    _require_google(settings)
    try:
        identity = await google.verify_id_token(settings, body.id_token)
    except google.GoogleSignInError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google sign-in didn't finish.") from error
    return await _sign_in(session, settings, identity)


@router.post("/auth/google/app-code", responses={400: {"description": "Google rejected the sign-in"}})
async def google_app_code(body: GoogleAppCodeIn, session: SessionDep, settings: SettingsDep) -> AppCodeOut:
    """The website's callback for a phone-app sign-in in the browser.

    Trades Google's code like /auth/google/exchange, but returns a one-time code
    for the app instead of the session token: it travels in a URL, so it is only
    worth anything with the verifier the app kept.
    """
    _require_google(settings)
    try:
        identity = await google.exchange_code(settings, body.code)
    except google.GoogleSignInError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google sign-in didn't finish.") from error
    user, created = await _save_account(session, identity)
    return AppCodeOut(code=create_app_code(settings, user.id, body.challenge, created))


@router.post("/auth/google/app-session", responses={400: {"description": "Invalid or expired code"}})
async def google_app_session(body: AppSessionIn, session: SessionDep, settings: SettingsDep) -> SessionOut:
    """The phone app trades its one-time code and verifier for an API session token."""
    _require_google(settings)
    redeemed = redeem_app_code(settings, body.code, body.verifier)
    user = await session.get(User, redeemed[0]) if redeemed else None
    if redeemed is None or user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google sign-in didn't finish.")
    return _session_out(settings, user, created=redeemed[1])


async def _sign_in(session: AsyncSession, settings: Settings, identity: google.GoogleIdentity) -> SessionOut:
    """Creates or refreshes the account by Google subject and issues an API session token."""
    user, created = await _save_account(session, identity)
    return _session_out(settings, user, created)


def _session_out(settings: Settings, user: User, created: bool) -> SessionOut:
    return SessionOut(
        token=create_session_token(settings, user.id),
        user=UserOut.model_validate(user),
        created=created,
    )


async def _save_account(session: AsyncSession, identity: google.GoogleIdentity) -> tuple[User, bool]:
    """Creates or refreshes the account by Google subject. True when this made it."""
    existing = await session.scalar(select(User.id).where(User.google_sub == identity.sub))
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
    return user, existing is None


@router.get("/me", responses={401: {"description": "Not signed in"}})
async def me(user: SignedInUser, settings: SettingsDep) -> MeOut:
    return MeOut(user=UserOut.model_validate(user), is_admin=is_admin(settings, user))


@router.get("/me/orders", responses={401: {"description": "Not signed in"}})
async def my_orders(user: SignedInUser, session: SessionDep) -> list[OrderOut]:
    rows = await session.scalars(
        select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc())
    )
    return [OrderOut.model_validate(o) for o in rows]


def _cart_out(lines: list[carts.Line]) -> SavedCartOut:
    return SavedCartOut(lines=[CartLineOut(sku=line.sku, qty=line.qty) for line in lines])


def _lines(body: SavedCartIn) -> list[carts.Line]:
    return [carts.Line(line.sku, line.qty) for line in body.lines]


@router.get("/me/cart", responses={401: {"description": "Not signed in"}})
async def my_cart(user: SignedInUser, session: SessionDep) -> SavedCartOut:
    """The cart saved to this account, so the website and the phone app show the same one."""
    return _cart_out(await carts.get_cart(session, user.id))


@router.put("/me/cart", responses={401: {"description": "Not signed in"}})
async def save_my_cart(body: SavedCartIn, user: SignedInUser, session: SessionDep) -> SavedCartOut:
    """Replaces the saved cart after a change on either client. Parts no longer listed drop out."""
    return _cart_out(await carts.replace_cart(session, user.id, _lines(body)))


@router.post("/me/cart/merge", responses={401: {"description": "Not signed in"}})
async def merge_my_cart(body: SavedCartIn, user: SignedInUser, session: SessionDep) -> SavedCartOut:
    """Adds a guest cart to the account's at sign-in. Never reserves a unit."""
    return _cart_out(await carts.merge_cart(session, user.id, _lines(body)))
