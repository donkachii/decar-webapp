from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

SITE_NAME = "De Car Revolutionist"
SITE_ADDRESS = "Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market, Abuja"

# Signs session tokens when APP_ENV is development or test and SESSION_SECRET is
# empty, so a fresh clone runs without any setup. Production refuses to start.
_DEV_SESSION_SECRET = "dev-only-session-secret-not-for-production"


def sqlalchemy_url(url: str) -> str:
    """Accepts the URI Supabase shows (postgresql://…) and selects the psycopg driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "production", "test"] = "production"

    # The only database setting. Locally: your own Postgres. Deployed: the
    # Supabase connection string (Project > Connect). No Supabase API keys.
    database_url: str = "postgresql://localhost:5432/decar"

    # Public URL of the Next.js frontend, no trailing slash. Used for the Google
    # redirect, the Paystack callback, CORS and links in emails.
    frontend_url: str = "http://localhost:3000"

    session_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    admin_emails: str = ""

    gmail_user: str = ""
    gmail_app_password: str = ""
    owner_email: str = ""

    paystack_secret_key: str = ""

    # Part photos. Cloudinary console > Settings > API Keys > "API environment
    # variable": cloudinary://<api_key>:<api_secret>@<cloud_name>
    cloudinary_url: str = ""

    # Shop WhatsApp number, international format, digits only (2348012345678).
    whatsapp_number: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        return sqlalchemy_url(self.database_url)

    @property
    def frontend_origin(self) -> str:
        return self.frontend_url.rstrip("/")

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.frontend_origin}/auth/callback"

    @property
    def admin_email_set(self) -> frozenset[str]:
        return frozenset(e.strip().lower() for e in self.admin_emails.split(",") if e.strip())

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def paystack_enabled(self) -> bool:
        return bool(self.paystack_secret_key)

    @property
    def cloudinary_enabled(self) -> bool:
        return bool(self.cloudinary_url)

    @property
    def demo_admin(self) -> bool:
        """Local dev without Google sign-in opens /admin to anyone. Never in production."""
        return self.app_env == "development" and not self.google_enabled

    @property
    def signing_secret(self) -> str:
        if self.session_secret:
            return self.session_secret
        if self.app_env != "production":
            return _DEV_SESSION_SECRET
        raise RuntimeError("SESSION_SECRET is not set. See backend/.env.example.")

    def check_production(self) -> None:
        if self.app_env != "production":
            return
        if len(self.session_secret) < 32:
            raise RuntimeError("SESSION_SECRET must be at least 32 characters in production.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
