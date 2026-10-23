-- Catalog, fitment, accounts, saved carts and orders: the schema the Python
-- backend's Alembic migrations 0001 to 0003 built, as one baseline.
--
-- A fresh database gets everything from here. A database Alembic already built
-- is marked as having it instead (see README.md, "Moving from Alembic"):
--   pnpm exec prisma migrate resolve --applied 0_init
--
-- Domain rules from CLAUDE.md section 3 are check constraints, so bad data can't
-- get in through a database dashboard either. Prisma can't express them, so
-- they live only here: when a domain tuple changes (a new part type, say), write
-- a migration that drops and re-adds the matching constraint. Runs on plain
-- Postgres, Neon and Supabase; the Supabase-only step at the end checks that its
-- roles exist first.

-- --- Catalog ------------------------------------------------------------------

CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generation" TEXT NOT NULL,
    "year_from" INTEGER NOT NULL,
    "year_to" INTEGER NOT NULL,
    "facelift" BOOLEAN NOT NULL,
    CONSTRAINT "vehicles_make_check" CHECK (make in ('toyota', 'lexus')),
    CONSTRAINT "vehicles_years_check" CHECK (year_from <= year_to),
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id"),
    -- Rule 1: the fitment key is make + model + generation + facelift.
    CONSTRAINT "vehicles_make_model_generation_facelift_key" UNIQUE ("make", "model", "generation", "facelift")
);

CREATE TABLE "parts" (
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "defects" TEXT[] NOT NULL DEFAULT '{}',
    "oem_number" TEXT,
    "variants" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "price_ngn" INTEGER NOT NULL,
    "stock_qty" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "stock_checked_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "shipping_class" TEXT NOT NULL,
    "images" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "parts_category_check" CHECK (category in ('lights', 'bumpers', 'body', 'mirrors')),
    CONSTRAINT "parts_type_check" CHECK (type in ('headlight', 'backlight', 'foglamp', 'front-bumper', 'back-bumper', 'foglamp-cover', 'hood', 'fender', 'door', 'front-grill', 'mirror')),
    CONSTRAINT "parts_position_check" CHECK (position in ('front', 'rear', 'front-left', 'front-right', 'rear-left', 'rear-right', 'left', 'right', 'inner-left', 'inner-right', 'outer-left', 'outer-right', 'n/a')),
    CONSTRAINT "parts_condition_check" CHECK (condition in ('belgium-a', 'belgium-b', 'belgium-c', 'new-genuine', 'new-aftermarket')),
    CONSTRAINT "parts_status_check" CHECK (status in ('available', 'reserved', 'sold')),
    CONSTRAINT "parts_shipping_class_check" CHECK (shipping_class in ('small', 'medium', 'bulky', 'oversized')),
    CONSTRAINT "parts_variants_check" CHECK (jsonb_typeof(variants) = 'object'),
    CONSTRAINT "parts_price_ngn_check" CHECK (price_ngn > 0),
    CONSTRAINT "parts_stock_qty_check" CHECK (stock_qty >= 0),
    -- Same expression as SKU_PATTERN in src/domain/sku.ts.
    CONSTRAINT "parts_sku_format" CHECK (sku ~ '^DCR-(TOY|LEX)-[A-Z0-9]+-[A-Z0-9]+[FP]-[A-Z]{2}-[A-Z]{1,2}-(BA|BB|BC|NG|NA)(-U[0-9]{2})?$'),
    CONSTRAINT "parts_type_in_category" CHECK (
        (category = 'lights' and type in ('headlight', 'backlight', 'foglamp'))
        or (category = 'bumpers' and type in ('front-bumper', 'back-bumper', 'foglamp-cover'))
        or (category = 'body' and type in ('hood', 'fender', 'door', 'front-grill'))
        or (category = 'mirrors' and type in ('mirror'))
    ),
    -- Rule 4: Belgium units are one-offs with their own unit suffix.
    CONSTRAINT "parts_belgium_is_one_off" CHECK (
        case when condition like 'belgium-%'
        then stock_qty <= 1 and sku ~ '-U[0-9]{2}$'
        else sku !~ '-U[0-9]{2}$' end
    ),
    -- Grade B and C units must list their defects in plain words.
    CONSTRAINT "parts_defects_listed" CHECK (condition not in ('belgium-b', 'belgium-c') or cardinality(defects) > 0),
    CONSTRAINT "parts_pkey" PRIMARY KEY ("sku")
);

CREATE INDEX "parts_category_idx" ON "parts"("category");
CREATE INDEX "parts_status_idx" ON "parts"("status");

-- Dashboard edits bump updated_at too, not just the API.
CREATE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
        begin
          new.updated_at = now();
          return new;
        end $$;

CREATE TRIGGER parts_touch_updated_at BEFORE UPDATE ON public.parts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE "fitment" (
    "part_sku" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "fitment_pkey" PRIMARY KEY ("part_sku", "vehicle_id"),
    CONSTRAINT "fitment_part_sku_fkey" FOREIGN KEY ("part_sku") REFERENCES "parts"("sku") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fitment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE
);

CREATE INDEX "fitment_vehicle_id_idx" ON "fitment"("vehicle_id");

-- --- Accounts -----------------------------------------------------------------

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "google_sub" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "last_sign_in_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- scrypt (src/services/passwords.ts). Null for Google accounts.
    "password_hash" TEXT,
    CONSTRAINT "users_sign_in_check" CHECK (google_sub IS NOT NULL OR password_hash IS NOT NULL),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_google_sub_key" UNIQUE ("google_sub")
);

-- One password account per email. Google accounts may share an email with one.
CREATE UNIQUE INDEX "users_password_email_key" ON "users"("email") WHERE (password_hash IS NOT NULL);

-- A signed-in buyer's saved cart, shared by the website and the phone app.
CREATE TABLE "cart_lines" (
    "user_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    CONSTRAINT "cart_lines_qty_check" CHECK (qty > 0),
    CONSTRAINT "cart_lines_pkey" PRIMARY KEY ("user_id", "sku"),
    CONSTRAINT "cart_lines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "cart_lines_sku_fkey" FOREIGN KEY ("sku") REFERENCES "parts"("sku") ON DELETE CASCADE ON UPDATE CASCADE
);

-- --- Orders -------------------------------------------------------------------

CREATE SEQUENCE "order_number_seq";

CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" TEXT NOT NULL,
    "user_id" UUID,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT,
    "vehicle_id" TEXT,
    "delivery_option" TEXT NOT NULL,
    "delivery_address" TEXT,
    "delivery_state" TEXT,
    "delivery_park" TEXT,
    "delivery_fee_ngn" INTEGER NOT NULL,
    "subtotal_ngn" INTEGER NOT NULL,
    "total_ngn" INTEGER NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "paystack_reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "orders_delivery_option_check" CHECK (delivery_option in ('pickup', 'abuja', 'waybill')),
    CONSTRAINT "orders_payment_method_check" CHECK (payment_method in ('paystack', 'pay-later')),
    CONSTRAINT "orders_payment_status_check" CHECK (payment_status in ('pending', 'paid', 'failed')),
    CONSTRAINT "orders_status_check" CHECK (status in ('new', 'completed', 'cancelled')),
    CONSTRAINT "orders_delivery_fee_ngn_check" CHECK (delivery_fee_ngn >= 0),
    CONSTRAINT "orders_subtotal_ngn_check" CHECK (subtotal_ngn >= 0),
    CONSTRAINT "orders_total_ngn_check" CHECK (total_ngn >= 0),
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_number_key" UNIQUE ("number"),
    CONSTRAINT "orders_paystack_reference_key" UNIQUE ("paystack_reference"),
    CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL
);

CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

CREATE TABLE "order_items" (
    "order_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_ngn" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    CONSTRAINT "order_items_price_ngn_check" CHECK (price_ngn >= 0),
    CONSTRAINT "order_items_qty_check" CHECK (qty > 0),
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("order_id", "sku"),
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
    CONSTRAINT "order_items_sku_fkey" FOREIGN KEY ("sku") REFERENCES "parts"("sku") ON UPDATE CASCADE
);

-- --- Lock the tables away from Supabase's public Data API ----------------------
-- Only the API reads and writes, over its own connection (as the table owner,
-- which bypasses RLS). RLS with no policies means Supabase's auto-generated REST
-- and GraphQL APIs return nothing, even with a leaked key. Harmless elsewhere.

ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fitment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

DO $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.vehicles, public.parts, public.fitment, public.users,
      public.cart_lines, public.orders, public.order_items from anon, authenticated;
    revoke all on sequence public.order_number_seq from anon, authenticated;
  end if;
end $$;
