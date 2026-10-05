"""Google sign-in (OpenID Connect).

Website: the frontend sends the buyer to authorization_url(); Google redirects
back to the frontend's /auth/callback, which hands the code to exchange_code()
here. Only the API holds the client secret.

Phone app: Google signs the buyer in on the phone and gives the app an ID
token, which verify_id_token() checks against the configured client IDs.
"""

from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlencode

import httpx
import jwt
from starlette.concurrency import run_in_threadpool

from app.config import Settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("https://accounts.google.com", "accounts.google.com")


class GoogleSignInError(Exception):
    pass


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    name: str | None


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(JWKS_URL, cache_keys=True)


def authorization_url(settings: Settings, state: str) -> str:
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
    )
    return f"{AUTH_URL}?{query}"


def _verify_id_token(settings: Settings, id_token: str) -> GoogleIdentity:
    key = _jwks().get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        key.key,
        algorithms=["RS256"],
        audience=settings.google_audiences,
        options={"require": ["iss", "sub", "aud", "exp"]},
    )
    if claims.get("iss") not in ISSUERS:
        raise GoogleSignInError("Unexpected issuer")
    email = claims.get("email")
    if not isinstance(email, str) or claims.get("email_verified") is not True:
        raise GoogleSignInError("Google account has no verified email")
    name = claims.get("name")
    return GoogleIdentity(
        sub=str(claims["sub"]), email=email.lower(), name=name if isinstance(name, str) else None
    )


async def exchange_code(settings: Settings, code: str) -> GoogleIdentity:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.HTTPError as error:
        raise GoogleSignInError("Could not reach Google") from error
    body = res.json() if res.content else {}
    id_token = body.get("id_token") if isinstance(body, dict) else None
    if not res.is_success or not isinstance(id_token, str):
        raise GoogleSignInError(f"Google rejected the code: {res.status_code}")
    return await verify_id_token(settings, id_token)


async def verify_id_token(settings: Settings, id_token: str) -> GoogleIdentity:
    try:
        # PyJWKClient fetches Google's keys with blocking I/O.
        return await run_in_threadpool(_verify_id_token, settings, id_token)
    except jwt.PyJWTError as error:
        raise GoogleSignInError("Invalid ID token") from error
