"""Email and password sign-in next to Google: google_sub becomes optional and
every account needs a Google subject or a password hash. One password account
per email.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-06
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("users", "google_sub", existing_type=sa.Text(), nullable=True)
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))
    op.create_check_constraint(
        op.f("users_sign_in_check"), "users", "google_sub IS NOT NULL OR password_hash IS NOT NULL"
    )
    op.create_index(
        "users_password_email_key",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("password_hash IS NOT NULL"),
    )


def downgrade() -> None:
    # Password-only accounts can't exist without google_sub. Their orders keep
    # going (orders.user_id is ON DELETE SET NULL); their saved carts go.
    op.execute("DELETE FROM users WHERE google_sub IS NULL")
    op.drop_index("users_password_email_key", table_name="users")
    op.drop_constraint(op.f("users_sign_in_check"), "users", type_="check")
    op.drop_column("users", "password_hash")
    op.alter_column("users", "google_sub", existing_type=sa.Text(), nullable=False)
