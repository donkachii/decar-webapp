"""Saved carts: a signed-in buyer's cart lines, shared by the website and the phone app.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-05
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cart_lines",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("sku", sa.Text(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.CheckConstraint("qty > 0", name=op.f("cart_lines_qty_check")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("cart_lines_user_id_fkey"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["sku"], ["parts.sku"], name=op.f("cart_lines_sku_fkey"), onupdate="CASCADE", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "sku", name=op.f("cart_lines_pkey")),
    )

    # Same lock-down as every other table (see 0001): only the API reads and writes.
    op.execute("alter table public.cart_lines enable row level security")
    op.execute(
        """
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'anon') then
            revoke all on public.cart_lines from anon, authenticated;
          end if;
        end $$
        """
    )


def downgrade() -> None:
    op.drop_table("cart_lines")
