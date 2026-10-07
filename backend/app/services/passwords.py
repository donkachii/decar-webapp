"""Password hashes for email and password accounts.

scrypt from the standard library, so there is no extra dependency. Stored as
scrypt$<n>$<r>$<p>$<salt>$<hash> (base64), so the cost can rise later without
breaking old hashes. Hashing is deliberately slow and runs off the event loop.
"""

import base64
import hashlib
import hmac
import secrets
import unicodedata
from functools import lru_cache

from starlette.concurrency import run_in_threadpool

# About 32 MiB and a tenth of a second per hash on a small server.
N, R, P = 2**15, 8, 1
MAX_MEMORY = 64 * 1024 * 1024


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    # NFKC, so the same password typed on different keyboards hashes the same.
    secret = unicodedata.normalize("NFKC", password).encode("utf-8")
    return hashlib.scrypt(secret, salt=salt, n=n, r=r, p=p, maxmem=MAX_MEMORY, dklen=32)


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    return f"scrypt${N}${R}${P}${_b64(salt)}${_b64(_scrypt(password, salt, N, R, P))}"


def _verify(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = _scrypt(password, base64.b64decode(salt), int(n), int(r), int(p))
        return hmac.compare_digest(actual, base64.b64decode(digest))
    except ValueError:
        return False


@lru_cache
def _decoy() -> str:
    """A real hash to check when the email has no account.

    Then a wrong email takes as long as a wrong password, and timing doesn't
    tell which emails have accounts.
    """
    return _hash(secrets.token_urlsafe(16))


async def hash_password(password: str) -> str:
    return await run_in_threadpool(_hash, password)


async def verify_password(password: str, stored: str | None) -> bool:
    matches = await run_in_threadpool(_verify, password, stored or _decoy())
    return matches and stored is not None
