"""Catalog, fitment, orders and accounts.

Domain rules from CLAUDE.md section 3 are enforced as check constraints, so bad
data can't get in through the Supabase table editor either. Runs on plain
Postgres (local dev, tests) and on Supabase: the Supabase-only steps at the end
check that their roles and schemas exist first.

Revision ID: 0001
Revises:
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("vehicles", "parts", "fitment", "users", "orders", "order_items")


def upgrade() -> None:
    # --- Catalog ----------------------------------------------------------------

    op.create_table(
        "vehicles",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("make", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("generation", sa.Text(), nullable=False),
        sa.Column("year_from", sa.Integer(), nullable=False),
        sa.Column("year_to", sa.Integer(), nullable=False),
        sa.Column("facelift", sa.Boolean(), nullable=False),
        sa.CheckConstraint("make in ('toyota', 'lexus')", name=op.f("vehicles_make_check")),
        sa.CheckConstraint("year_from <= year_to", name=op.f("vehicles_years_check")),
        sa.PrimaryKeyConstraint("id", name=op.f("vehicles_pkey")),
        # Rule 1: the fitment key is make + model + generation + facelift.
        sa.UniqueConstraint(
            "make", "model", "generation", "facelift", name=op.f("vehicles_make_model_generation_facelift_key")
        ),
    )

    op.create_table(
        "parts",
        sa.Column("sku", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("position", sa.Text(), nullable=False),
        sa.Column("condition", sa.Text(), nullable=False),
        sa.Column("defects", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("oem_number", sa.Text(), nullable=True),
        sa.Column("variants", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("price_ngn", sa.Integer(), nullable=False),
        sa.Column("stock_qty", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), server_default="available", nullable=False),
        sa.Column("stock_checked_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("shipping_class", sa.Text(), nullable=False),
        sa.Column("images", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("category in ('lights', 'bumpers', 'body', 'mirrors')", name=op.f("parts_category_check")),
        sa.CheckConstraint(
            "type in ('headlight', 'backlight', 'foglamp', 'front-bumper', 'back-bumper', 'foglamp-cover', "
            "'hood', 'fender', 'door', 'front-grill', 'mirror')",
            name=op.f("parts_type_check"),
        ),
        sa.CheckConstraint(
            "position in ('front', 'rear', 'front-left', 'front-right', 'rear-left', 'rear-right', 'left', "
            "'right', 'inner-left', 'inner-right', 'outer-left', 'outer-right', 'n/a')",
            name=op.f("parts_position_check"),
        ),
        sa.CheckConstraint(
            "condition in ('belgium-a', 'belgium-b', 'belgium-c', 'new-genuine', 'new-aftermarket')",
            name=op.f("parts_condition_check"),
        ),
        sa.CheckConstraint("status in ('available', 'reserved', 'sold')", name=op.f("parts_status_check")),
        sa.CheckConstraint(
            "shipping_class in ('small', 'medium', 'bulky', 'oversized')", name=op.f("parts_shipping_class_check")
        ),
        sa.CheckConstraint("jsonb_typeof(variants) = 'object'", name=op.f("parts_variants_check")),
        sa.CheckConstraint("price_ngn > 0", name=op.f("parts_price_ngn_check")),
        sa.CheckConstraint("stock_qty >= 0", name=op.f("parts_stock_qty_check")),
        sa.CheckConstraint(
            "sku ~ '^DCR-(TOY|LEX)-[A-Z0-9]+-[A-Z0-9]+[FP]-[A-Z]{2}-[A-Z]{1,2}-(BA|BB|BC|NG|NA)(-U[0-9]{2})?$'",
            name=op.f("parts_sku_format"),
        ),
        sa.CheckConstraint(
            "(category = 'lights' and type in ('headlight', 'backlight', 'foglamp')) "
            "or (category = 'bumpers' and type in ('front-bumper', 'back-bumper', 'foglamp-cover')) "
            "or (category = 'body' and type in ('hood', 'fender', 'door', 'front-grill')) "
            "or (category = 'mirrors' and type in ('mirror'))",
            name=op.f("parts_type_in_category"),
        ),
        # Rule 4: Belgium units are one-offs with their own unit suffix.
        sa.CheckConstraint(
            "case when condition like 'belgium-%' "
            "then stock_qty <= 1 and sku ~ '-U[0-9]{2}$' "
            "else sku !~ '-U[0-9]{2}$' end",
            name=op.f("parts_belgium_is_one_off"),
        ),
        # Grade B and C units must list their defects in plain words.
        sa.CheckConstraint(
            "condition not in ('belgium-b', 'belgium-c') or cardinality(defects) > 0",
            name=op.f("parts_defects_listed"),
        ),
        sa.PrimaryKeyConstraint("sku", name=op.f("parts_pkey")),
    )
    op.create_index("parts_category_idx", "parts", ["category"])
    op.create_index("parts_status_idx", "parts", ["status"])

    # Dashboard edits bump updated_at too, not just the API.
    op.execute(
        """
        create function public.touch_updated_at() returns trigger
        language plpgsql set search_path = '' as $$
        begin
          new.updated_at = now();
          return new;
        end $$
        """
    )
    op.execute(
        "create trigger parts_touch_updated_at before update on public.parts "
        "for each row execute function public.touch_updated_at()"
    )

    op.create_table(
        "fitment",
        sa.Column("part_sku", sa.Text(), nullable=False),
        sa.Column("vehicle_id", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["part_sku"], ["parts.sku"], name=op.f("fitment_part_sku_fkey"), onupdate="CASCADE", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], name=op.f("fitment_vehicle_id_fkey"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("part_sku", "vehicle_id", name=op.f("fitment_pkey")),
    )
    op.create_index("fitment_vehicle_id_idx", "fitment", ["vehicle_id"])

    # --- Accounts ---------------------------------------------------------------

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("google_sub", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_sign_in_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("users_pkey")),
        sa.UniqueConstraint("google_sub", name=op.f("users_google_sub_key")),
    )

    # --- Orders -----------------------------------------------------------------

    op.execute(sa.schema.CreateSequence(sa.Sequence("order_number_seq")))

    op.create_table(
        "orders",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("number", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("customer_name", sa.Text(), nullable=False),
        sa.Column("customer_phone", sa.Text(), nullable=False),
        sa.Column("customer_email", sa.Text(), nullable=True),
        sa.Column("vehicle_id", sa.Text(), nullable=True),
        sa.Column("delivery_option", sa.Text(), nullable=False),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("delivery_state", sa.Text(), nullable=True),
        sa.Column("delivery_park", sa.Text(), nullable=True),
        sa.Column("delivery_fee_ngn", sa.Integer(), nullable=False),
        sa.Column("subtotal_ngn", sa.Integer(), nullable=False),
        sa.Column("total_ngn", sa.Integer(), nullable=False),
        sa.Column("payment_method", sa.Text(), nullable=False),
        sa.Column("payment_status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("paystack_reference", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), server_default="new", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("delivery_option in ('pickup', 'abuja', 'waybill')", name=op.f("orders_delivery_option_check")),
        sa.CheckConstraint("payment_method in ('paystack', 'pay-later')", name=op.f("orders_payment_method_check")),
        sa.CheckConstraint("payment_status in ('pending', 'paid', 'failed')", name=op.f("orders_payment_status_check")),
        sa.CheckConstraint("status in ('new', 'completed', 'cancelled')", name=op.f("orders_status_check")),
        sa.CheckConstraint("delivery_fee_ngn >= 0", name=op.f("orders_delivery_fee_ngn_check")),
        sa.CheckConstraint("subtotal_ngn >= 0", name=op.f("orders_subtotal_ngn_check")),
        sa.CheckConstraint("total_ngn >= 0", name=op.f("orders_total_ngn_check")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("orders_user_id_fkey"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], name=op.f("orders_vehicle_id_fkey"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("orders_pkey")),
        sa.UniqueConstraint("number", name=op.f("orders_number_key")),
        sa.UniqueConstraint("paystack_reference", name=op.f("orders_paystack_reference_key")),
    )
    op.create_index("orders_created_at_idx", "orders", [sa.literal_column("created_at desc")])
    op.create_index("orders_user_id_idx", "orders", ["user_id"])

    op.create_table(
        "order_items",
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("sku", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("price_ngn", sa.Integer(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.CheckConstraint("price_ngn >= 0", name=op.f("order_items_price_ngn_check")),
        sa.CheckConstraint("qty > 0", name=op.f("order_items_qty_check")),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name=op.f("order_items_order_id_fkey"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sku"], ["parts.sku"], name=op.f("order_items_sku_fkey"), onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("order_id", "sku", name=op.f("order_items_pkey")),
    )

    # --- Lock the tables away from Supabase's public Data API ---------------------
    # Only the FastAPI backend reads and writes, over its own connection (as the
    # table owner, which bypasses RLS). RLS with no policies means Supabase's
    # auto-generated REST and GraphQL APIs return nothing, even with a leaked key.

    for table in TABLES:
        op.execute(f"alter table public.{table} enable row level security")
    op.execute(
        f"""
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'anon') then
            revoke all on {", ".join(f"public.{t}" for t in TABLES)} from anon, authenticated;
            revoke all on sequence public.order_number_seq from anon, authenticated;
          end if;
        end $$
        """
    )

    # --- Photo bucket (Supabase only) ---------------------------------------------
    # Real unit photos: public read, uploaded through the Supabase dashboard.
    op.execute(
        """
        do $$
        begin
          if to_regclass('storage.buckets') is not null then
            insert into storage.buckets (id, name, public)
            values ('part-photos', 'part-photos', true)
            on conflict (id) do nothing;
          end if;
        end $$
        """
    )


def downgrade() -> None:
    op.drop_table("order_items")
    op.drop_table("orders")
    op.execute(sa.schema.DropSequence(sa.Sequence("order_number_seq")))
    op.drop_table("users")
    op.drop_table("fitment")
    op.execute("drop trigger if exists parts_touch_updated_at on public.parts")
    op.execute("drop function if exists public.touch_updated_at()")
    op.drop_table("parts")
    op.drop_table("vehicles")
