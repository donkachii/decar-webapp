# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@frontend/AGENTS.md
@mobile/AGENTS.md

# De Car Revolutionist storefront

Read this before every task. It is the single source of truth for scope, data, design and rules.
If a request conflicts with this file, stop and ask before proceeding.

## Commands

Three apps: `frontend/` (Next.js), `backend/` (Node.js + Express + Prisma) and `mobile/` (Expo). Run each from its own folder.

```bash
# backend/  (pnpm; Node 22.12+; needs Postgres and backend/.env)
pnpm dev                                   # API on :8000, restarts on save
pnpm build && pnpm start                   # prisma generate + tsc into dist/, then run it
pnpm migrate                               # apply migrations (prisma migrate deploy)
pnpm exec prisma migrate dev --name …      # new migration from prisma/schema.prisma; always read the SQL
pnpm seed                                  # insert priced seed rows (never overwrites stock); drafts wait
pnpm seed --check                          # validate seed/*.json against section 3; run after any seed change
pnpm seed --prune                          # also delete parts/vehicles dropped from seed/ (never ones on an order)
pnpm photos --check                        # check ../photos/ (SKU folders, names); uploads nothing
pnpm photos                                # upload new photos to Cloudinary, link parts/<SKU>/ folders
pnpm lint && pnpm typecheck
pnpm test                                  # account, sign-in and domain tests; no database needed

# frontend/  (pnpm; needs the API running for pages, not for builds)
pnpm dev              # dev server on :3000
pnpm build            # production build (also type-checks)
pnpm lint             # ESLint
pnpm typecheck        # next typegen && tsc --noEmit (PageProps/LayoutProps are generated globals)
pnpm brand            # re-render favicon, header tile, app icons and splash from assets/brand/*.svg

# mobile/  (pnpm; Expo SDK 57; needs mobile/.env pointing at a reachable API)
pnpm start            # Expo dev server (Expo Go signs in through the live website, see mobile/README.md)
pnpm typecheck        # tsc --noEmit (typed routes come from .expo/types, written by `pnpm start`)
pnpm lint             # expo lint
npx expo-doctor       # dependency and config check
eas build --profile development --platform android   # dev build in the cloud (profiles in eas.json; cloud builds read env from eas.json, never .env)
```

## 1. The business (what we are actually building for)

- De Car Revolutionist sells **foreign-used genuine body parts for Japanese cars** (Toyota, Lexus, Honda, Nissan and the other Japanese makes; "Belgium" parts) plus some new stock.
- Physical shop: Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market, Abuja.
- Call or chat: 0816 645 6295 (the WhatsApp default) and 0901 539 6483. Facebook, Instagram and TikTok: De Car Revolutionist. Tagline: "Driving quality. Delivering confidence. Building a legacy."
- Customers: car owners, mechanics, panel beaters, dealers. Most arrive from Facebook, Instagram, TikTok and WhatsApp links.
- Core promise to the buyer: **the right part for your car, first time.**
- The site is where social traffic converts. Every product URL must preview well when pasted into WhatsApp.

## 2. Scope for v1 (deliberately minimal)

- Makes (decided 2026-10-23, replacing Toyota and Lexus only): **Japanese makes**: Toyota, Lexus, Honda, Acura, Nissan, Infiniti, Mazda, Mitsubishi, Subaru, Suzuki, Isuzu, Daihatsu. The owner may not stock every one; the car pickers show a make only once a car of that make is listed.
- Categories (4 only; subcategories are filters, not pages):
  - **Lights**: headlights, backlights, foglamps
  - **Bumpers**: front bumpers, back bumpers, foglamp covers
  - **Body**: hoods, fenders, doors, front grills
  - **Mirrors**: side mirrors
- Vehicles come from the owner's labelled stock photos (decided 2026-10-05): the cars in `backend/seed/vehicles.json`. Add a car when stock for it is listed, never before.
- Out of scope for v1: dealer/trade accounts, reviews system, VIN decoding, multi-currency.
- Accounts (decided 2026-10-02): Google sign-in only. Optional for buyers (past orders, prefilled checkout), required for the owner's `/admin` (emails in `ADMIN_EMAILS`). Buyers can also use an email and password (decided 2026-10-06, "for now"): no email check and no password reset yet, so password accounts never pass the admin check and never take a Google account's email. Never required to buy. The backend runs the Google sign-in itself (decided 2026-10-03); there are no Supabase API keys anywhere. The phone app signs in natively and sends Google's ID token to `POST /auth/google/id-token` (decided 2026-10-05). Where it can't (Expo Go, iOS without an iOS OAuth client, Android `DEVELOPER_ERROR`), it signs in on the website in an in-app browser and redeems a one-time code with a PKCE verifier at `POST /auth/google/app-session` (decided 2026-10-06).

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
| `new-genuine` | New · Genuine | New OEM from the car's maker |
| `new-aftermarket` | New · Aftermarket | New, third-party manufactured |

Grade B and C units must list their defects in plain words and show them in photos.

## 5. Data model (source of truth; mirrored in `backend/src/domain/catalog.ts`, `backend/src/schemas.ts`, `backend/prisma/schema.prisma` and `frontend/lib/catalog/types.ts`)

```ts
type Make =
  | 'toyota' | 'lexus' | 'honda' | 'acura' | 'nissan' | 'infiniti'
  | 'mazda' | 'mitsubishi' | 'subaru' | 'suzuki' | 'isuzu' | 'daihatsu';

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

- Code tables for every segment live in `backend/src/domain/sku.ts` and are locked: add codes, never edit them. A new make also needs its code in both `SKU_PATTERN`s (backend and frontend) and a migration re-adding `vehicles_make_check` and `parts_sku_format` (as in `3_japanese_makes`). Position `n/a` is `XX` so it can't be confused with condition `NA`. The frontend only keeps the pattern (`frontend/lib/catalog/sku.ts`).
- `-U##` is required for every Belgium unit and forbidden otherwise (also a DB check constraint).
- The vehicle segment names the part's primary vehicle only. Fitment rows decide what a part fits (one unit may fit pre-facelift and facelift).
- Allowed positions per part type: `TYPE_POSITIONS` in `backend/src/domain/catalog.ts` (checks seed data) and `frontend/lib/catalog/zones.ts` (listing filters); change both. The damage-selector zone mapping lives in `zones.ts` only.

## 6. Architecture

- Two apps (decided 2026-10-03):
  - `frontend/`: Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui, pnpm. Renders pages; holds no secrets and no database access.
  - `backend/`: Node.js 22.12+, Express 5, TypeScript strict, Prisma 7 (with `@prisma/adapter-pg`), zod, pnpm (decided 2026-10-17, replacing FastAPI + SQLAlchemy + Alembic; same routes and JSON, same database). Owns the database, stock rules, orders, Google sign-in, Paystack and email.
- A third app (decided 2026-10-05): `mobile/`, the buyer's shop for iOS and Android. Expo SDK 57 + Expo Router, TypeScript strict, pnpm. Same scope, rules, copy and design tokens as the website; the owner's `/admin` stays on the website.
  - Database: Postgres. Local Postgres in development; Supabase Postgres in production, reached only through `DATABASE_URL`. Supabase is the database host, nothing more.
  - Part photos: Cloudinary (decided 2026-10-03), one secret `CLOUDINARY_URL` in `backend/.env`. Only the backend uploads (signed); parts store the public delivery URLs. The owner adds part and category photos in `/admin` (decided 2026-10-23): the browser shrinks each photo to JPEG, a server action sends it to the API, and the API uploads it.
- Only the Next.js server calls the API (`frontend/lib/api/client.ts`, `API_URL`); the browser never does. The phone app calls it directly (`mobile/src/lib/api.ts`) and holds no secrets either. Anything priced, reserved or validated is decided by the API.
- Server components by default; client boundaries small and late (cart drawer, vehicle selector, damage selector, gallery).
- **All catalog access goes through `frontend/lib/catalog/` behind an interface** (`getParts`, `getPart`, `getVehicles`, `getFitment`), implemented by `api-source.ts` over the backend API. Swapping backends means writing another `CatalogSource`; it must not touch UI components.
- Cart: client store with persistence, exposed through `lib/cart/`. Cart lines store `sku`, never copied price; price is re-read at checkout. A signed-in buyer's cart is also saved to their account, so the website and the phone app show the same cart (decided 2026-10-05). Saving never reserves a unit.
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
- Guest checkout always works. Never force signup; signing in is optional.
- In the cart, each line re-checks fitment against the selected vehicle: "Fits your Camry 2015–2017" or "Not confirmed for your vehicle". (A selected vehicle is a generation + facelift with a year range, never a single year.)
- Belgium units: adding to cart does NOT reserve the unit in v1. Show "One unit available" and re-check status at checkout.
- Delivery options, priced by shippingClass:
  1. Pick up at Zuba Market shop
  2. Abuja delivery
  3. Interstate waybill (we load at the park, buyer collects at destination park)
- Payment v1: Paystack (card/transfer, on only when `PAYSTACK_SECRET_KEY` is set in `backend/.env`) + pay on pickup/delivery. A "Complete order on WhatsApp" button sends a prefilled message with SKUs.
- Placing an order (not adding to cart) reserves units, inside `placeOrder` in `backend/src/services/orders.ts`: one Prisma interactive transaction that locks the part rows (raw `SELECT … FOR UPDATE`, in SKU order) and re-reads status and price. Admin "Mark completed" turns reserved units sold; "Cancel order" puts them back.
- Order emails: Gmail SMTP from the API (`backend/src/services/email.ts`, nodemailer), sent after the response so they never block or fail an order. No domain yet; swap `sendMail()` for Resend later.
- "Usually replaced together" block on product pages (e.g. front bumper → matching foglamp covers for the same vehicle).

## 8. Design system

Direction: **inspection-bay precision, in the shop's own colours.** Navy ink, tan for anything you can act on, wine for the brand's ground; the workshop is honest and well lit. The site should feel like a clean, well-organised parts bay, not a showroom and not a market stall.

### Colour tokens

The brand colours (navy, wine, tan) come from the logo sheet (decided 2026-10-05); the greys and semantic colours stay.

```css
--color-primer:   #8B9196;  /* primer grey: dividers, icons; text on navy or wine only */
--color-bay:      #ECEEF0;  /* page background, cool light grey */
--color-paper:    #FFFFFF;  /* cards, product image wells */
--color-navy:     #051632;  /* primary text, outlines, dark controls */
--color-wine:     #4E1526;  /* brand ground: logo tile, footer, Belgium grade badges */
--color-tan:      #D6AE73;  /* the ONLY action colour: add to cart, selected vehicle, active filters */
--color-fit:      #1E7A4C;  /* semantic only: fit confirmed */
--color-warn:     #B4441C;  /* semantic only: not confirmed, sold */
```

Do not introduce other accent colours. Tan means "you can act here"; wine is the brand, never an action or a warning.

### Logo

- Main logo (decided 2026-10-05): white artwork on wine. Masters in `frontend/assets/brand/`, white on transparent: `mark.svg` (swoosh, car, gear) and `logo.svg` (mark plus "De Car Revolutionist" in Montserrat ExtraBold).
- Small places (favicon, site header, share images, app home screen) use the mark on a wine tile; the app icon and splash use the full logo.

### Type

- **Barlow Condensed** (600, 700) for headings, prices, category names.
- **Barlow** (400, 500, 600) for body and UI. Tabular numerals for prices and part numbers.
- One family, two widths. No monospace. Sentence case everywhere. No all-caps eyebrow labels.

### Layout and motion

- Mobile first. Design at 360px wide, then scale up.
- Product images always on `--color-paper`, square, consistent framing.
- Grounds (decided 2026-10-23, after Nightkidz's dark storefront): the home page is navy throughout; the header is navy on every page; shop, vehicle and about pages open with a navy title band and keep the bay ground below it; product, cart and checkout stay on bay. `/admin` is unchanged.
- Spend boldness in TWO places: the **home hero** (decided 2026-10-23: the showcase clip in a framed window that opens to the full stage as you scroll) and the **damage selector**, a line-drawn car silhouette (top view) where tapping a zone (front-left, front, front-right, left side, right side, rear-left, rear, rear-right) filters to parts for that zone on the selected vehicle.
- Motion only in response to user actions (drawer open, zone selected, added to cart, navigation). The home hero is the one exception (decided 2026-10-23): its headline lights up letter by letter on load (`.lit`), its subline and buttons fade in after it (`.rise`), and on large screens scrolling through it opens the video window (GSAP scrub). No scroll-triggered entrance animations anywhere else. No decorative effects either (decided 2026-10-23, after a pass that removed them): no cursor trails, magnetic buttons, cursor spotlights, pixel or scan reveals, hover tilts or lifts, faded grid backgrounds, viewfinder corner marks, or giant faded wordmarks. Everything respects `prefers-reduced-motion`.

### Copy rules

- Hero: "The right part for your Toyota, Lexus, Honda or Nissan. First time."
- Sub: "Genuine Belgium and new body parts from Zuba Market, checked for fit before they leave the shop."
- Buttons say exactly what happens: "Add to cart", "Choose your car", "Mark as sold".
- Mission, vision and values live on `/about` only.

## 9. Performance budget (hard limits)

- Home page under 1 MB transferred on first load.
- LCP under 2.5 s on throttled Fast 3G, mid-range Android profile.
- Images: AVIF/WebP via next/image, explicit sizes, lazy below the fold.
- No WebGL, no video autoplay on any path to purchase. One exception (decided 2026-10-23): the home hero's muted showcase clip (`frontend/public/hero/`, ~1.5 MB desktop, ~0.8 MB phone). Only its poster loads with the page; the clip starts after the load event, never with reduced motion, Save-Data or a 3G-or-slower connection, pauses off screen, and has a pause button. Measured 2026-10-23: ~370 KB at load, LCP 1.9 s on Fast 3G with 4x CPU.

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
- Backend: `pnpm lint && pnpm typecheck && pnpm test` pass.

## 12. How the code fits together

Backend (`backend/src/`):

- `domain/`: the vocabulary and rules with no I/O: unions as `as const` tuples and `TYPE_POSITIONS` (`catalog.ts`), locked SKU tables (`sku.ts`), delivery options and the only copy of the placeholder rates (`delivery.ts`), checkout validation with the form's error copy (`checkout.ts`), plain-text labels (`labels.ts`). The frontend keeps its own copy of the unions; the backend deploys alone (Render builds only `backend/`), so it never imports from `frontend/`.
- `../prisma/schema.prisma`: the tables. Models are camelCase over snake_case columns (`@map`); domain unions are `text` columns, not native enums. The partial unique index on password accounts' email needs the `partialIndexes` preview feature.
- `../prisma/migrations/`: SQL migrations. `0_init` is the schema Alembic built, byte for byte, and also holds what Prisma can't express: check constraints mirroring section 3, the `parts_touch_updated_at` trigger, RLS with no policies (Supabase's public Data API exposes nothing; the API connects as the table owner), the Supabase-only `anon`/`authenticated` revokes (skipped where those roles don't exist) and `order_number_seq`. A new domain value means a hand-written migration that drops and re-adds its constraint. A database Alembic built is baselined once with `prisma migrate resolve --applied 0_init` (`backend/README.md`).
- `db.ts`: one Prisma client over a `pg` pool. Every connection is set to UTC in `onConnect`, because Prisma's pg adapter reads and writes `timestamptz` as UTC wall-clock time and drops the offset.
- `schemas.ts`: zod request bodies and the JSON sent back. Field names match the frontend TS types (`priceNGN`, `stockCheckedAt`); datetimes are `toISOString()`. Validation failures are 422 and other errors are `{ "detail": "…" }`, as the clients expect (`http.ts`).
- `services/`: `orders.ts` (place/complete/cancel/mark sold, all locked transactions; Prisma has no row locks, so each lock is one raw `SELECT … FOR UPDATE`), `carts.ts` (saved carts), `paystack.ts`, `email.ts`, `google.ts` (jose verifies ID tokens), `cloudinary.ts` (signed upload, listing, versioned `.jpg` delivery URLs), `photos.ts` (a part's photo list under a row lock, category tile photos; rules in `domain/photos.ts`), `passwords.ts` (scrypt, the Python backend's format, two hashes at a time).
- `auth.ts`: after any sign-in the API issues its own 30-day session JWT (`SESSION_SECRET`, HS256, the same claims the Python backend used, so existing sessions carry over). `requireAdmin` checks `ADMIN_EMAILS`, for Google accounts only; with `APP_ENV=development` and no Google keys it allows everyone (demo mode, never in production). It also signs the phone app's 5-minute browser sign-in codes (own audience, bound to a PKCE challenge; a token with an audience is never read as a session) and decides where they may go (`decar://`, and Expo Go's `exp://`, which in production must be `exp://<private IPv4>:<port>/--/auth`).
- `routes/`: `catalog.ts` (vehicles, parts, fitment, `/categories/photos`, delivery rates, `/features`), `orders.ts` (checkout, order page, Paystack), `accounts.ts` (Google sign-in, `/me`, `/me/cart`; sign-in responses carry `created`, so the app's "Sign up with Google" can say whether it made the account; `/auth/google/app-code` and `/auth/google/app-session` are the app's browser sign-in; `/auth/password/sign-up` and `/sign-in` are email and password, with their rules and form copy in `domain/accounts.ts` and scrypt hashes in `services/passwords.ts`), `admin.ts` (stock, orders, photos: an upload's body is the photo itself, read by `express.raw`).
- `seed.ts` + `../seed/*.json`: the shop's real catalog and its rule check. A part with a null `priceNGN` or `stockQty` is a draft: checked, never inserted, so nothing goes live unpriced. Only vehicles a live part fits are inserted. Inserts never overwrite existing rows; `--prune` deletes rows dropped from `seed/` but keeps parts on an order.
- `photos.ts` + repo-root `photos/` (gitignored): every photo uploads to Cloudinary as `decar/<path>`. Only `photos/parts/<SKU>/` folders link: the part's `images` become those photos in name order (`01.jpg` is the card and OG photo). Folders for draft parts are skipped until the part is live, and parts with photos added in `/admin` (named `admin-…`, only on Cloudinary) are never relinked. `photos/library/` is unsorted stock, uploaded but never shown; most of it is supplier photos of new stock, never valid for a Belgium unit (rule 4). The frontend's `remotePatterns` allows only `res.cloudinary.com/*/image/upload/*/decar/**`.
- `GET /orders/{id}` is public by unguessable id, so it masks the phone and drops the email. `/me/orders` and `/admin/orders` return full orders.
- Saved carts (`cart_lines`, `services/carts.ts`): one row per SKU per account, quantities only. `PUT /me/cart` replaces the cart (last save wins), `POST /me/cart/merge` adds a guest cart at sign-in (a part in both keeps the larger quantity), parts dropped from the catalog fall out, and placing an order removes the ordered parts.

Frontend (`frontend/`):

- `lib/api/client.ts`: the only `fetch` to the API (`cache: "no-store"`; stock truth). Sends the session cookie as a Bearer token when asked.
- `lib/catalog/`: domain types, display labels, SKU pattern, zones, "replaced together" rules, side grouping (`sides.ts`), and the `CatalogSource` interface (`api-source.ts`). UI never imports a source directly.
- Part cards: new stock sold by side (left and right fenders) shares one card with a side picker; each side keeps its own SKU, price and stock (rule 2). Belgium units never group. Photos fill card wells (`cover`); the product gallery shows the whole part (`contain`). `/parts/*.svg` drawings stand in until a part has photos.
- `lib/orders/`: order types, delivery labels, `deliveryFee(option, classes, rates)` with rates passed in from `GET /delivery/rates`, and `api.ts` for checkout, order page, Paystack and admin order calls.
- `lib/cart/`: persisted Zustand store holding `{ sku, qty }` only, plus `useCartDetails()`, which POSTs SKUs to `/api/cart` for live price, status and fitment.
- Saved cart: `lib/cart/sync.ts` holds the rules both apps share. Save every change while signed in, re-read the account's cart when the buyer comes back, and merge a guest cart in at sign-in. Signing out empties the device's cart, but the account keeps it. It has no package imports because the phone app uses it too. On the website, `components/cart-sync.tsx` (in the root layout) runs it through `/api/cart/saved`, which forwards the session cookie. It re-reads when the tab becomes visible and when the cart drawer or `/cart` opens.
- `lib/auth.ts` + `lib/features.ts`: who is signed in (`GET /me`) and what the API has switched on (`GET /features`: Google sign-in, Paystack, demo admin). Sign-in: `app/actions/auth.ts` gets Google's URL from the API with a `state` kept in the `dcr_oauth` cookie; `/auth/callback` checks it, trades the code at the API and stores the token in the httpOnly `dcr_session` cookie. Email and password: `components/password-form.tsx` on `/signin` posts to the `passwordAuth` server action, which sets the same cookie. The phone app's browser sign-in starts at `/auth/app` instead; its cookie carries the app's return address and PKCE challenge, and `/auth/callback` sends the app a one-time code, never a token, and sets no session cookie.
- Selected vehicle: `dcr_vehicle` cookie. `proxy.ts` also sets it from `?vehicle=<id>` so shared links reproduce the view; `?vehicle=all` shows every car without changing the cookie.
- Admin (`/admin`): server actions call the API with the owner's session; the API refuses anyone not in `ADMIN_EMAILS`. Tabs: Stock, Photos, Orders. Photos sets the home page category tiles (`category_photos`; without one, a tile shows a part in stock) and links to `/admin/photos/[sku]`, where photos are added, made the card photo or removed (removed photos stay on Cloudinary). `components/photo-upload.tsx` shrinks each photo to at most 2000 px JPEG in the browser and sends one per action call: `serverActions.bodySizeLimit` is 4 MB, under Vercel's 4.5 MB request cap. The upload buttons show only when `/features` reports `photoUploads` (`CLOUDINARY_URL` set).
- Design-token enforcement: `frontend/app/globals.css` sets `--color-*: initial`, so Tailwind's default palette does not exist. Tan never appears as text on light grounds and always carries navy text (8.7:1). Wine carries paper text (14.4:1). Primer is for rules, icons and text on navy or wine only (it fails contrast as text on bay/paper; on wine it is exactly 4.5:1, so never lighten wine). Focus is a global navy outline (paper on `.on-dark`, which the wine footer uses).
- Logo files: `scripts/brand-assets.mjs` (`pnpm brand`) renders every one from the `assets/brand/` masters and adds the wine ground: `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `public/brand/mark-tile.svg` (site header, OG images) and the icons, splash and `mark-tile.png` in `mobile/assets/images/`. Never edit the outputs by hand; commit what it writes.
- Motion (section 8): `components/hero.tsx` is the home hero. `hero-motion.tsx` holds the only GSAP. ScrollTrigger scrubs two CSS variables on the section element, `--open` and `--lift`. `.hero-stage` and `.hero-copy` in `globals.css` derive the window's insets and the headline's fade from them. GSAP never holds the hero's children, so re-renders can't detach the animation from what's on screen. The stage is CSS-sticky, not GSAP-pinned. `hero-video.tsx` loads the clip. Elsewhere: `photo-loupe.tsx` (magnifier on the product photo for checking a unit's marks; mouse only) and `nav-progress.tsx` (a bar while a slow page loads). Page transitions are React `<ViewTransition>`: the layout crossfades pages, and a card photo travels to its product page under the shared name `part-<sku>`, so a SKU's card may appear only once per page. The header stays still (`site-header` in `globals.css`).
- The hero clip is cut from the owner's `decar-parts-showcase-branded.mp4` (repo root, not committed): 8.0–31.7 s, with the logo intro and the cards naming Kia cut out, fading in and out of navy. The poster is the frame at 8.7 s (`assets/hero/poster.jpg`), and the clip starts at `#t=0.7` to match it. Re-cut with ffmpeg as H.264 `-crf 29 -preset veryslow -movflags +faststart -an`, at 1280×720 and 854×480.
- Fonts: Barlow has no ₦. `frontend/assets/fonts/naira-*.woff` is a one-glyph subset loaded first in the stack with `unicode-range: U+20A6`. Never replace it with a next/font/google family (that emits every subset and takes over Latin text). The same files feed `next/og` images.
- Year ranges contain U+2060 word joiners (`yearRange`, `partTitle`) so "2015–2017" never wraps. Run text through `plainText()` before it leaves the page (WhatsApp, OG images, metadata, emails, stored order names).

Mobile (`mobile/`, details in `mobile/README.md`):

- `src/lib/domain.ts` re-exports the website's pure modules from `../frontend/lib` (catalog types, labels, zones, sides, related, SKU, format, filters' `parseList`, order types, delivery fees) instead of copying them; `metro.config.js` watches that folder. Those frontend files must stay free of Next.js, `server-only` and package imports, or the app stops building.
- `src/lib/api.ts` is the only `fetch` to the API. The session token from Google sign-in lives in SecureStore (`src/lib/token.ts`); cart (`{ sku, qty }` only), selected car and orders placed on the phone persist in AsyncStorage.
- Saved cart: `src/lib/cart-sync.ts` runs the website's `lib/cart/sync.ts` against `/me/cart` once `GET /me` names the account. It re-reads when the app comes to the foreground and on the Cart tab (focus and pull-to-refresh).
- Stock truth: part queries are never fresh (TanStack Query `staleTime: 0`); screens re-read on focus, on returning to the foreground and on pull-to-refresh.
- "Add to cart" slides up `components/cart-sheet.tsx` over the current screen; the Cart tab is the full cart. Paystack opens in an in-app browser and returns to the website's callback, which confirms payment; the order screen re-reads the order when the app is active again.
- `src/theme.ts` holds the section 8 tokens and nothing else. Barlow has no ₦; the system font draws that glyph.
- Sign-in lives on the Account tab (`src/lib/session.ts`): email and password always, Google whenever the API has it on. Native sign-in needs a development or store build and `EXPO_PUBLIC_GOOGLE_*` client IDs; the backend accepts ID tokens for `GOOGLE_CLIENT_ID` plus `GOOGLE_MOBILE_CLIENT_IDS`. Otherwise it opens the website's `/auth/app` with `expo-web-browser` and comes back to `decar://auth` (`exp://…/--/auth` in Expo Go); `src/app/+native-intent.tsx` keeps the router from navigating to that address. Google only returns to https or localhost, so Expo Go on a phone signs in through the live website and API, or a local website on an https tunnel (`mobile/README.md`).
