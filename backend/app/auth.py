"""Sessions and access checks.

After Google sign-in the API issues its own session token (a signed JWT). The
frontend keeps it in an httpOnly cookie and sends it back as a Bearer token.
Buyers never need one to check out; the owner needs one, with an email in
ADMIN_EMAILS, for every /admin route.
"""

import base64
import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlsplit

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings
from app.db import SessionDep
from app.models import User

SESSION_DAYS = 30
ISSUER = "dcr-api"

SettingsDep = Annotated[Settings, Depends(get_settings)]
_bearer = HTTPBearer(auto_error=False)


def create_session_token(settings: Settings, user_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    claims = {"sub": str(user_id), "iss": ISSUER, "iat": now, "exp": now + timedelta(days=SESSION_DAYS)}
    return jwt.encode(claims, settings.signing_secret, algorithm="HS256")


def read_session_token(settings: Settings, token: str) -> uuid.UUID | None:
    try:
        claims = jwt.decode(
            token,
            settings.signing_secret,
            algorithms=["HS256"],
            issuer=ISSUER,
            options={"require": ["sub", "iss", "exp"]},
        )
        return uuid.UUID(str(claims["sub"]))
    except (jwt.PyJWTError, ValueError):
        return None


# --- Phone-app sign-in through the browser ---------------------------------
#
# Builds without native Google sign-in (Expo Go, iOS without an iOS OAuth
# client) sign in on the website in an in-app browser. The website's callback
# sends the app a short-lived code rather than the session token, and only the
# app can redeem it: the code is bound to the PKCE challenge of a verifier the
# app never sends through the browser.

APP_SCHEME = "decar"  # mobile/app.config.ts
APP_CODE_AUDIENCE = "dcr-app-sign-in"  # session tokens carry no audience, so neither passes as the other
APP_CODE_MINUTES = 5


def app_return_allowed(settings: Settings, url: str) -> bool:
    """Where a browser sign-in may hand its code: the app, plus Expo Go (exp://) outside production."""
    schemes = {APP_SCHEME} if settings.app_env == "production" else {APP_SCHEME, "exp", "exps"}
    return urlsplit(url).scheme.lower() in schemes


def pkce_challenge(verifier: str) -> str:
    """S256: unpadded base64url of the verifier's SHA-256."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def create_app_code(settings: Settings, user_id: uuid.UUID, challenge: str, created: bool) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "iss": ISSUER,
        "aud": APP_CODE_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=APP_CODE_MINUTES),
        "chal": challenge,
        "created": created,
    }
    return jwt.encode(claims, settings.signing_secret, algorithm="HS256")


def redeem_app_code(settings: Settings, code: str, verifier: str) -> tuple[uuid.UUID, bool] | None:
    """The account and whether the sign-in made it. None for a forged, expired or stolen code."""
    try:
        claims = jwt.decode(
            code,
            settings.signing_secret,
            algorithms=["HS256"],
            issuer=ISSUER,
            audience=APP_CODE_AUDIENCE,
            options={"require": ["sub", "iss", "aud", "exp", "chal"]},
        )
        user_id = uuid.UUID(str(claims["sub"]))
    except (jwt.PyJWTError, ValueError):
        return None
    if not hmac.compare_digest(str(claims["chal"]), pkce_challenge(verifier)):
        return None
    return user_id, claims.get("created") is True


def is_admin(settings: Settings, user: User | None) -> bool:
    return user is not None and user.email.lower() in settings.admin_email_set


async def current_user(
    session: SessionDep,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User | None:
    """The signed-in buyer or owner. None for guests and for expired or forged tokens."""
    if credentials is None:
        return None
    user_id = read_session_token(settings, credentials.credentials)
    return await session.get(User, user_id) if user_id else None


CurrentUser = Annotated[User | None, Depends(current_user)]


async def require_user(user: CurrentUser) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in first.")
    return user


async def require_admin(user: CurrentUser, settings: SettingsDep) -> User | None:
    """The owner. In local dev without Google sign-in, anyone (demo mode)."""
    if settings.demo_admin:
        return user
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in first.")
    if not is_admin(settings, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to manage stock.")
    return user


SignedInUser = Annotated[User, Depends(require_user)]
AdminUser = Annotated[User | None, Depends(require_admin)]
