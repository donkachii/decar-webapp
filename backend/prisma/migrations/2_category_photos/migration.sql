-- The owner's photo for each category tile on the home page (/admin > Photos).
-- Without a row, the tile shows the first in-stock part photo in the category.
CREATE TABLE "category_photos" (
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "category_photos_category_check" CHECK (category in ('lights', 'bumpers', 'body', 'mirrors')),
    CONSTRAINT "category_photos_pkey" PRIMARY KEY ("category")
);

-- Locked away from Supabase's public Data API, like every table (see 0_init).
ALTER TABLE "category_photos" ENABLE ROW LEVEL SECURITY;

DO $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.category_photos from anon, authenticated;
  end if;
end $$;
