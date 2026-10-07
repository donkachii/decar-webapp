"""Email and password accounts: the rules and the words the sign-in forms show.
Messages follow the copy rules in CLAUDE.md section 8.

An email and password proves nothing about who owns the address, so these
accounts never pass the admin check (app.auth.is_admin) and never take over a
Google account's address.
"""

from app.domain.checkout import EMAIL

PASSWORD_MIN = 8
PASSWORD_MAX = 128

BAD_EMAIL = "Check the email address."
SHORT_PASSWORD = f"Use a password of at least {PASSWORD_MIN} characters."
LONG_PASSWORD = f"Use a password of at most {PASSWORD_MAX} characters."
TAKEN = "An account with this email already exists. Sign in instead."
GOOGLE_ACCOUNT = "This email has an account that signs in with Google. Use the Google button instead."
WRONG = "That email and password don't match an account."


def normalise_email(raw: str) -> str:
    return raw.strip().lower()


def sign_up_problem(email: str, password: str) -> str | None:
    """What's wrong with a new account's email and password, in the form's words. None if nothing."""
    if not EMAIL.match(email):
        return BAD_EMAIL
    if len(password) < PASSWORD_MIN:
        return SHORT_PASSWORD
    if len(password) > PASSWORD_MAX:
        return LONG_PASSWORD
    return None
