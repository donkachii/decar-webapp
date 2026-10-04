# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@frontend/AGENTS.md

# De Car Revolutionist storefront

Read this before every task. It is the single source of truth for scope, data, design and rules.
If a request conflicts with this file, stop and ask before proceeding.

## Commands

Two apps: `frontend/` (Next.js) and `backend/` (FastAPI). Run each from its own folder.

```bash
# backend/  (uv; needs Postgres and backend/.env)
uv run uvicorn app.main:app --reload       # API on :8000, docs at /docs
uv run alembic upgrade head                # apply migrations
uv run alembic revision --autogenerate -m "…"   # new migration from app/models.py; always review it
uv run python -m app.seed                  # insert missing seed rows (never overwrites stock)
uv run python -m app.seed --check          # validate seed/*.json against section 3; run after any seed change
uv run python -m app.photos --check        # check ../photos/ (SKU folders, names); uploads nothing
uv run python -m app.photos                # upload new photos to Cloudinary, link parts/<SKU>/ folders
uv run pytest                              # domain + API tests (API tests need: createdb decar_test)
uv run ruff check . && uv run mypy app tests

# frontend/  (pnpm; needs the API running for pages, not for builds)
pnpm dev              # dev server on :3000
pnpm build            # production build (also type-checks)
pnpm lint             # ESLint
pnpm typecheck        # next typegen && tsc --noEmit (PageProps/LayoutProps are generated globals)
```

## 1. The business (what we are actually building for)

- De Car Revolutionist sells **foreign-used genuine Toyota and Lexus body parts** ("Belgium" parts) plus some new stock.
- Physical shop: Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market, Abuja.
- Customers: car owners, mechanics, panel beaters, dealers. Most arrive from Facebook, Instagram, TikTok and WhatsApp links.
- Core promise to the buyer: **the right part for your Toyota or Lexus, first time.**
- The site is where social traffic converts. Every product URL must preview well when pasted into WhatsApp.

## 2. Scope for v1 (deliberately minimal)

- Makes: **Toyota, Lexus only.**
- Categories (4 only; subcategories are filters, not pages):
  - **Lights**: headlights, backlights, foglamps
  - **Bumpers**: front bumpers, back bumpers, foglamp covers
  - **Body**: hoods, fenders, doors, front grills
  - **Mirrors**: side mirrors
- Placeholder vehicles until the owner confirms from his stock photos:
  Toyota Camry, Corolla, Highlander, Sienna, RAV4; Lexus RX, ES, GX.
- Out of scope for v1: dealer/trade accounts, reviews system, VIN decoding, multi-currency.
- Accounts (decided 2026-10-02): Google sign-in only. Optional for buyers (past orders, prefilled checkout), required for the owner's `/admin` (emails in `ADMIN_EMAILS`). Never required to buy. The FastAPI backend runs the Google sign-in itself (decided 2026-10-03); there are no Supabase API keys anywhere.

## 3. Non-negotiable domain rules

1. **Fitment key = make + model + generation code + facelift flag.** Never year alone. Never by shared platform (Lexus RX parts do NOT fit Toyota Highlander).
2. **Position is its own field**, not a boolean side. Doors need four positions; backlights need inner/outer.
3. **Variants are structured fields**, never prose (e.g. mirror: powerFold, heated, indicator, camera).
4. **Belgium units are one-offs**: quantity 1, own photos, own condition grade, own SKU suffix.
5. **Stock truth beats everything.** Every unit shows "Stock checked: <relative time>". The owner must be able to mark a unit sold in one tap from his phone.
6. Prices in NGN, formatted `₦185,000`. No hidden fees at checkout.

## 4. Condition grading (show on every card and product page)

| Code | Label shown to buyer | Meaning |
|---|---|---|
| `belgium-a` | Belgium · Grade A | Genuine, foreign-used, no visible defects |
| `belgium-b` | Belgium · Grade B | Genuine, foreign-used, minor cosmetic marks, fully functional |
| `belgium-c` | Belgium · Grade C | Genuine, foreign-used, visible wear or repair, priced accordingly |
| `new-genuine` | New · Genuine | New Toyota/Lexus OEM |
| `new-aftermarket` | New · Aftermarket | New, third-party manufactured |

Grade B and C units must list their defects in plain words and show them in photos.

## 5. Data model (source of truth; mirrored in `backend/app/domain/catalog.py`, `backend/app/schemas.py` and `frontend/lib/catalog/types.ts`)

```ts
type Make = 'toyota' | 'lexus';

interface Vehicle {
  id: string;              // 'toyota-camry-xv50-f'
  make: Make;
  model: string;           // 'Camry'
  generation: string;      // 'XV50'
  yearFrom: number;
  yearTo: number;
  facelift: boolean;
}

type Category = 'lights' | 'bumpers' | 'body' | 'mirrors';
type PartType =
  | 'headlight' | 'backlight' | 'foglamp'
  | 'front-bumper' | 'back-bumper' | 'foglamp-cover'
  | 'hood' | 'fender' | 'door' | 'front-grill'
  | 'mirror';

type Position =
  | 'front' | 'rear'
  | 'front-left' | 'front-right' | 'rear-left' | 'rear-right'
  | 'left' | 'right'
  | 'inner-left' | 'inner-right' | 'outer-left' | 'outer-right'
  | 'n/a';

type Condition = 'belgium-a' | 'belgium-b' | 'belgium-c' | 'new-genuine' | 'new-aftermarket';
type ShippingClass = 'small' | 'medium' | 'bulky' | 'oversized';

interface Part {
  sku: string;             // see SKU convention
  name: string;
  category: Category;
  type: PartType;
  position: Position;
  condition: Condition;
  defects?: string[];      // required for belgium-b and belgium-c
  oemNumber?: string;
  variants: Record<string, string | boolean>; // e.g. { lamp: 'led', drl: true }
  priceNGN: number;
  stockQty: number;        // 1 for Belgium units
  status: 'available' | 'reserved' | 'sold';
  stockCheckedAt: string;  // ISO date
  shippingClass: ShippingClass;
  images: string[];        // real photos of THIS unit, first image on light grey
}

interface Fitment {
  partSku: string;
  vehicleId: string;
  notes?: string;          // 'needs fog lamp holes', 'no parking sensor holes'
}
```

### SKU convention (lock this; never rename)

```
DCR-{MAKE}-{MODEL}-{GEN}{F|P}-{TYPE}-{POS}-{COND}[-U##]
DCR-TOY-CAM-XV50F-HL-FR-BA-U01   Camry XV50 facelift headlight, front-right, Belgium A, unit 01
DCR-LEX-RX-AL20P-FB-F-NA         Lexus RX AL20 pre-facelift front bumper, new aftermarket
```

- Code tables for every segment live in `backend/app/domain/sku.py` and are locked: add codes, never edit them. Position `n/a` is `XX` so it can't be confused with condition `NA`. The frontend only keeps the pattern (`frontend/lib/catalog/sku.ts`).
- `-U##` is required for every Belgium unit and forbidden otherwise (also a DB check constraint).
- The vehicle segment names the part's primary vehicle only. Fitment rows decide what a part fits (one unit may fit pre-facelift and facelift).
- Allowed positions per part type: `TYPE_POSITIONS` in `backend/app/domain/catalog.py` (checks seed data) and `frontend/lib/catalog/zones.ts` (listing filters); change both. The damage-selector zone mapping lives in `zones.ts` only.

## 6. Architecture

- Two apps (decided 2026-10-03):
  - `frontend/`: Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui, pnpm. Renders pages; holds no secrets and no database access.
  - `backend/`: FastAPI, Python 3.12+, SQLAlchemy 2 (async, psycopg 3) + Alembic, uv. Owns the database, stock rules, orders, Google sign-in, Paystack and email.
  - Database: Postgres. Local Postgres in development; Supabase Postgres in production, reached only through `DATABASE_URL`. Supabase is the database host, nothing more.
  - Part photos: Cloudinary (decided 2026-10-03), one secret `CLOUDINARY_URL` in `backend/.env`. Only the backend uploads (signed); parts store the public delivery URLs.
- Only the Next.js server calls the API (`frontend/lib/api/client.ts`, `API_URL`); the browser never does. Anything priced, reserved or validated is decided by the API.
- Server components by default; client boundaries small and late (cart drawer, vehicle selector, damage selector, gallery).
- **All catalog access goes through `frontend/lib/catalog/` behind an interface** (`getParts`, `getPart`, `getVehicles`, `getFitment`), implemented by `api-source.ts` over the FastAPI backend. Swapping backends means writing another `CatalogSource`; it must not touch UI components.
- Cart: client store with persistence, exposed through `lib/cart/` so it can move to a server cart later. Cart lines store `sku`, never copied price; price is re-read at checkout.
- Selected vehicle persists across pages (cookie) and filters every listing.
- Routes:
  - `/` home
  - `/shop/[category]` listing with filters (vehicle, type, position, condition)
  - `/part/[sku]` product page
  - `/vehicle/[vehicleId]` all parts for one car
  - `/cart`, `/checkout` (checkout can be a WhatsApp handoff in v1)
- Every `/part/[sku]` page needs `generateMetadata` with an OG image of the part, title with model and position, and price.

## 7. Cart and checkout rules

- Add to cart opens a slide-in drawer; no page navigation.
- Guest checkout always works. Never force signup; Google sign-in is optional.
- In the cart, each line re-checks fitment against the selected vehicle: "Fits your Camry 2015–2017" or "Not confirmed for your vehicle". (A selected vehicle is a generation + facelift with a year range, never a single year.)
- Belgium units: adding to cart does NOT reserve the unit in v1. Show "One unit available" and re-check status at checkout.
- Delivery options, priced by shippingClass:
  1. Pick up at Zuba Market shop
  2. Abuja delivery
  3. Interstate waybill (we load at the park, buyer collects at destination park)
- Payment v1: Paystack (card/transfer, on only when `PAYSTACK_SECRET_KEY` is set in `backend/.env`) + pay on pickup/delivery. A "Complete order on WhatsApp" button sends a prefilled message with SKUs.
- Placing an order (not adding to cart) reserves units, inside `place_order` in `backend/app/services/orders.py`: one transaction that locks the part rows (`SELECT … FOR UPDATE`, in SKU order) and re-reads status and price. Admin "Mark completed" turns reserved units sold; "Cancel order" puts them back.
- Order emails: Gmail SMTP from the API (`backend/app/services/email.py`), sent as a FastAPI background task so they never block or fail an order. No domain yet; swap `send_mail()` for Resend later.
- "Usually replaced together" block on product pages (e.g. front bumper → matching foglamp covers for the same vehicle).

## 8. Design system

Direction: **inspection-bay precision.** Parts arrive in grey primer; indicators are amber; the workshop is honest and well lit. The site should feel like a clean, well-organised parts bay, not a showroom and not a market stall.

### Colour tokens

```css
--color-primer:   #8B9196;  /* primer grey: secondary text, dividers */
--color-bay:      #ECEEF0;  /* page background, cool light grey */
--color-paper:    #FFFFFF;  /* cards, product image wells */
--color-graphite: #23272B;  /* primary text */
--color-amber:    #E39A0B;  /* the ONLY action colour: add to cart, selected vehicle, active filters */
--color-fit:      #1E7A4C;  /* semantic only: fit confirmed */
--color-warn:     #B4441C;  /* semantic only: not confirmed, sold */
```

Do not introduce other accent colours. Amber means "you can act here."

### Type

- **Barlow Condensed** (600, 700) for headings, prices, category names.
- **Barlow** (400, 500, 600) for body and UI. Tabular numerals for prices and part numbers.
- One family, two widths. No monospace. Sentence case everywhere. No all-caps eyebrow labels.

### Layout and motion

- Mobile first. Design at 360px wide, then scale up.
- Product images always on `--color-paper`, square, consistent framing.
- Spend boldness in ONE place: the **damage selector**, a line-drawn car silhouette (top view) where tapping a zone (front-left, front, front-right, left side, right side, rear-left, rear, rear-right) filters to parts for that zone on the selected vehicle.
- Motion only in response to user actions (drawer open, zone selected, added to cart). No scroll-triggered entrance animations.

### Copy rules

- Hero: "The right part for your Toyota or Lexus. First time."
- Sub: "Genuine Belgium and new body parts from Zuba Market, checked for fit before they leave the shop."
- Buttons say exactly what happens: "Add to cart", "Choose your car", "Mark as sold".
- Mission, vision and values live on `/about` only.

## 9. Performance budget (hard limits)

- Home page under 1 MB transferred on first load.
- LCP under 2.5 s on throttled Fast 3G, mid-range Android profile.
- Images: AVIF/WebP via next/image, explicit sizes, lazy below the fold.
- No WebGL, no video autoplay on any path to purchase.

## 10. Build order

1. Seed data: 8 vehicles, ~30 parts across all 4 categories and all 5 conditions, with fitment rows.
2. `lib/catalog` interface + seed adapter.
3. Vehicle selector + persisted selection.
4. Listing page with filters.
5. Product page (gallery, condition panel, position, variants, fitment notes, replaced-together).
6. Cart store + drawer + cart page with fitment re-check.
7. Checkout v1 (delivery options, WhatsApp handoff, Paystack placeholder).
8. Damage selector on home.
9. Admin-lite: phone-friendly page to mark units sold and update stockCheckedAt (protect it).
10. OG images, metadata, performance pass.

## 11. Definition of done for any task

- Types compile in strict mode; no `any`.
- Works at 360px and with keyboard only; visible focus states.
- No colour outside the token list.
- Copy follows section 8 rules.
- If a domain rule in section 3 was touched, explain how it still holds.
- Backend: `uv run ruff check . && uv run mypy app tests && uv run pytest` pass.

## 12. How the code fits together

Backend (`backend/app/`):

- `domain/`: the vocabulary and rules with no I/O: unions and `TYPE_POSITIONS` (`catalog.py`), locked SKU tables (`sku.py`), delivery options and the only copy of the placeholder rates (`delivery.py`), checkout validation with the form's error copy (`checkout.py`), plain-text labels (`labels.py`).
- `models.py`: SQLAlchemy tables. Check constraints mirror section 3, built from the `domain/` tuples. Domain unions are `text` columns, not native enums.
- `backend/alembic/versions/` (outside `app/`): migrations. They run on plain Postgres and Supabase; Supabase-only steps (revoking `anon`/`authenticated`, the `part-photos` bucket, unused since photos moved to Cloudinary) check that their roles and schemas exist. RLS is on with no policies, so Supabase's public Data API exposes nothing; the API connects as the table owner.
- `schemas.py`: JSON in and out. Field names match the frontend TS types (`priceNGN`, `stockCheckedAt`); datetimes serialise like JS `toISOString()`.
- `services/`: `orders.py` (place/complete/cancel/mark sold, all locked transactions), `paystack.py`, `email.py`, `google.py`, `cloudinary.py` (signed upload, listing, versioned `.jpg` delivery URLs).
- `auth.py`: after Google sign-in the API issues its own 30-day session JWT (`SESSION_SECRET`). `require_admin` checks `ADMIN_EMAILS`; with `APP_ENV=development` and no Google keys it allows everyone (demo mode, never in production).
- `routers/`: `catalog.py` (vehicles, parts, fitment, delivery rates, `/features`), `orders.py` (checkout, order page, Paystack), `accounts.py` (Google sign-in, `/me`), `admin.py`.
- `seed.py` + `seed/*.json`: the placeholder catalog and its rule check. Inserts never overwrite existing rows.
- `photos.py` + repo-root `photos/` (gitignored): every photo uploads to Cloudinary as `decar/<path>`. Only `photos/parts/<SKU>/` folders link: the part's `images` become those photos in name order (`01.jpg` is the card and OG photo). `photos/library/` is unsorted stock, uploaded but never shown; most of it is supplier photos of new stock, never valid for a Belgium unit (rule 4). The frontend's `remotePatterns` allows only `res.cloudinary.com/*/image/upload/*/decar/**`.
- `GET /orders/{id}` is public by unguessable id, so it masks the phone and drops the email. `/me/orders` and `/admin/orders` return full orders.

Frontend (`frontend/`):

- `lib/api/client.ts`: the only `fetch` to the API (`cache: "no-store"`; stock truth). Sends the session cookie as a Bearer token when asked.
- `lib/catalog/`: domain types, display labels, SKU pattern, zones, "replaced together" rules, and the `CatalogSource` interface (`api-source.ts`). UI never imports a source directly.
- `lib/orders/`: order types, delivery labels, `deliveryFee(option, classes, rates)` with rates passed in from `GET /delivery/rates`, and `api.ts` for checkout, order page, Paystack and admin order calls.
- `lib/cart/`: persisted Zustand store holding `{ sku, qty }` only, plus `useCartDetails()`, which POSTs SKUs to `/api/cart` for live price, status and fitment.
- `lib/auth.ts` + `lib/features.ts`: who is signed in (`GET /me`) and what the API has switched on (`GET /features`: Google sign-in, Paystack, demo admin). Sign-in: `app/actions/auth.ts` gets Google's URL from the API with a `state` kept in the `dcr_oauth` cookie; `/auth/callback` checks it, trades the code at the API and stores the token in the httpOnly `dcr_session` cookie.
- Selected vehicle: `dcr_vehicle` cookie. `proxy.ts` also sets it from `?vehicle=<id>` so shared links reproduce the view; `?vehicle=all` shows every car without changing the cookie.
- Admin (`/admin`): server actions call the API with the owner's session; the API refuses anyone not in `ADMIN_EMAILS`.
- Design-token enforcement: `frontend/app/globals.css` sets `--color-*: initial`, so Tailwind's default palette does not exist. Amber never appears as text on light grounds and always carries graphite text. Primer is for rules, icons and text on graphite only (it fails contrast as text on bay/paper). Focus is a global graphite outline (paper on `.on-dark`).
- Fonts: Barlow has no ₦. `frontend/assets/fonts/naira-*.woff` is a one-glyph subset loaded first in the stack with `unicode-range: U+20A6`. Never replace it with a next/font/google family (that emits every subset and takes over Latin text). The same files feed `next/og` images.
- Year ranges contain U+2060 word joiners (`yearRange`, `partTitle`) so "2015–2017" never wraps. Run text through `plainText()` before it leaves the page (WhatsApp, OG images, metadata, emails, stored order names).
