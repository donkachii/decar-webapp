# De Car Revolutionist storefront

Online shop for foreign-used genuine ("Belgium") and new body parts for Japanese cars from Shop C12/111, Zuba Spare Parts Market, Abuja.

Three apps:

| Folder | What | Stack |
|---|---|---|
| `backend/` | API: catalog, fitment, stock, orders, Google sign-in, Paystack, order emails ([backend/README.md](backend/README.md)) | Node.js, Express 5, TypeScript, Prisma 7, Postgres, pnpm |
| `frontend/` | The storefront and the owner's `/admin` page | Next.js 16, TypeScript, Tailwind v4, shadcn/ui, pnpm |
| `mobile/` | The buyer's shop as an iOS and Android app ([mobile/README.md](mobile/README.md)) | Expo SDK 57, Expo Router, TypeScript, pnpm |

The database is Postgres: your own locally, Supabase in production. The backend connects with one connection string (`DATABASE_URL`). There are no Supabase API keys, and the frontend holds no secrets at all.

## Run it locally

You need Postgres running locally (`brew install postgresql@18 && brew services start postgresql@18`), Node.js 22.12 or newer, and pnpm.

**1. Backend** (terminal 1)

```bash
cd backend
cp .env.example .env          # put your login name (`whoami`) in DATABASE_URL
createdb decar
pnpm install
pnpm migrate                  # tables, rules, order numbers
pnpm seed                     # the shop's catalog (priced parts only)
pnpm dev
```

The API runs on http://localhost:8000.

**2. Frontend** (terminal 2)

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

The shop runs on http://localhost:3000. Without Google keys, `/admin` opens in demo mode so you can try marking stock sold. That only happens with `APP_ENV=development`, never in production.

## Go live

### 1. Database on Supabase

1. Create a project at [supabase.com](https://supabase.com) in the region closest to Nigeria (for example `eu-west-2`, London).
2. **Connect** (top bar) → **Session pooler** → copy the URI and put your database password in it. This is the backend's `DATABASE_URL`. It's the only thing the backend needs from Supabase.
3. From `backend/`, with that `DATABASE_URL` set, run once:
   ```bash
   pnpm migrate
   pnpm seed
   ```
   The migration also locks the tables away from Supabase's auto-generated public API (row-level security with no policies), so only the backend can read or write them.

### 2. Backend hosting

Supabase hosts the database, not Node apps, so the API runs on a Node host such as Render (`render.yaml` at the repo root), Railway or Fly.io. Point the service at the `backend/` folder:

- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm exec prisma migrate deploy && node dist/server.js`
- Environment: everything in `backend/.env.example`, with `APP_ENV=production`, the Supabase `DATABASE_URL`, `FRONTEND_URL` set to the live shop URL, and a `SESSION_SECRET` from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. If `DATABASE_URL` is a transaction-mode pooler (Neon's `-pooler` host, Supabase's port 6543), also set `DIRECT_URL` to the direct URI: migrations can't run through one.

A database the Python backend's Alembic built needs a one-time step before the first Node deploy: [Moving from Alembic](backend/README.md#moving-from-alembic-once-per-database). Keep the same `SESSION_SECRET`, so buyers stay signed in.

### 3. Frontend hosting

Deploy `frontend/` to Vercel (set **Root Directory** to `frontend`). Set `NEXT_PUBLIC_SITE_URL` to the live URL, `API_URL` to the backend's URL, and `NEXT_PUBLIC_WHATSAPP_NUMBER` only if WhatsApp should go to a number other than 0816 645 6295. The build doesn't need the API running.

## Accounts

Optional for buyers (past orders, faster checkout, the same cart on the website and the phone). Guest checkout always works.

**Email and password** needs no setup: `/signin` on the website and the Account tab in the app. Passwords are stored as scrypt hashes. There is no email check and no password reset yet, so a password account never gets into `/admin` and can't use an email that already signs in with Google.

## Google sign-in

Optional for buyers and required for the owner's `/admin` in production. The backend talks to Google; the frontend never sees the client secret.

1. **Google Cloud Console → APIs & Services → OAuth consent screen.** Choose External and fill in the app name and support email.
2. **Credentials → Create credentials → OAuth client ID → Web application.** Add these authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-live-domain>/auth/callback`
3. In `backend/.env`, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS` (the owner's Google address; comma-separate several).
4. The phone app works with just the Web client: without native sign-in it signs in through the website in an in-app browser. For native sign-in, add an iOS and an Android OAuth client and list both in `GOOGLE_MOBILE_CLIENT_IDS`. See [mobile/README.md](mobile/README.md#google-sign-in).

## The owner's admin (`/admin`)

A phone page for keeping stock true and handling orders. In production it needs Google sign-in with an address in `ADMIN_EMAILS`; password accounts never get in. Locally without Google keys it opens in demo mode (see [Run it locally](#run-it-locally)).

- **Stock**: search by SKU or name, filter by status, longest since checked first. **Mark as sold**, **Mark available** and **Checked it now** each reset the unit's "Stock checked" time.
- **Orders**: **Mark completed** turns the order's reserved units sold. **Cancel order** puts them back on sale.

It doesn't add parts, change prices, stock counts, names or defects, or handle photos. Those go through `backend/seed/parts.json` and `photos/`, run from a computer with this repo: see [Going live with real stock](#going-live-with-real-stock).

## Order emails (no domain needed)

The backend sends emails through Gmail SMTP. The buyer gets a confirmation if they gave an email, and the shop gets a new-order alert.

1. Turn on 2-Step Verification for the Gmail account.
2. Create an app password: **Google Account → Security → App passwords**.
3. In `backend/.env`, set `GMAIL_USER`, `GMAIL_APP_PASSWORD` and optionally `OWNER_EMAIL` and `WHATSAPP_NUMBER`.

Gmail allows about 500 messages a day. Once you have a domain, swap `sendMail()` in `backend/src/services/email.ts` for Resend or similar.

## Paystack (optional)

Set `PAYSTACK_SECRET_KEY` in `backend/.env` to turn on card and bank-transfer payment at checkout. Paystack sends buyers back to the frontend's `/api/paystack/callback`, which asks the backend to verify the amount before marking the order paid. Without the key, checkout offers pay at pickup or on delivery.

## Part photos (Cloudinary)

Photos live on Cloudinary. The backend uploads them and saves each photo's public URL in its part's `images`. The site only reads those URLs.

1. Create a free account at [cloudinary.com](https://cloudinary.com). In the console go to **Settings → API Keys** and copy the **API environment variable**, with the secret revealed. It looks like `cloudinary://123456789012345:abcDEF…@your-cloud-name`.
2. Paste it into `backend/.env` as `CLOUDINARY_URL=cloudinary://…`, and into the API's environment on Render for the live site. Only the backend uses it; the frontend needs nothing.

### From the phone: `/admin` → Photos

- **Category photos** are the four tiles under "Shop by part" on the home page. Upload a wide photo for each (the tile shows a 4:3 crop). "Use a part's photo" goes back to showing a part in stock.
- **Part photos**: tap a part, then "Add photos" to take them with the camera or pick them from the gallery. New photos go at the end; "Make card photo" moves one to the front (cards, the product page and WhatsApp previews use it). "Remove" takes a photo off the part; Cloudinary keeps a copy.
- The browser shrinks each photo before it uploads, so it's quick on mobile data. Belgium units need photos of that exact unit, and grade B and C units need photos of each listed defect; the page lists them.

### Many photos at once: `pnpm photos`

1. Put a part's photos in `photos/parts/<SKU>/` at the repo root, named `01.jpg`, `02.jpg` … in display order. `01` is the card and WhatsApp preview photo. `photos/README.md` has the rules.
2. In `backend/`, run `pnpm photos --check`, then `pnpm photos`. It uploads only photos that aren't on Cloudinary yet, then links each SKU folder to its part. Run it again whenever you add photos.

To link parts in the live database, run the same command with the production connection string: `DATABASE_URL='<Supabase URI>' pnpm photos`. A part that has photos added in `/admin` is left as it is, so the command never drops them.

### Photos not showing

Run `pnpm photos --check` in `backend/` first, then match what you see:

| What you see | Why | Fix |
|---|---|---|
| A line drawing instead of a photo | No photos are linked to that part, so its `images` still point at `/parts/<type>.svg`. `curl localhost:8000/parts/<SKU>` shows them. | Add photos in `/admin` → Photos, or put them in `photos/parts/<SKU>/` and run `pnpm photos`. |
| "Photo uploads are off" in `/admin` | The API has no `CLOUDINARY_URL`. | Steps 1 and 2 above, then restart the API (or redeploy on Render). |
| A photographed part isn't on the site at all | It's a draft: `priceNGN` or `stockQty` is `null` in `seed/parts.json`. `--check` prints `… N draft part folder(s) skipped`. | Set both, then follow [Going live with real stock](#going-live-with-real-stock). |
| `✗ Set CLOUDINARY_URL in backend/.env first` | There's no Cloudinary key. | Steps 1 and 2 above. |
| `parts/<SKU>: no part with this SKU in the database` | The folder name has a typo, or the part isn't in the database yet. Nothing uploads until every folder matches. | Rename the folder, or add the part first. |
| Photos on your machine, drawings on the live site | The command linked your local database. | Run it again with the live `DATABASE_URL`, as above. Photos already on Cloudinary aren't uploaded twice. |

## Commands

| Where | Command | What it does |
|---|---|---|
| `backend/` | `pnpm dev` | API dev server (restarts on save) |
| `backend/` | `pnpm build` / `pnpm start` | Production build into `dist/` / run it |
| `backend/` | `pnpm migrate` | Apply migrations (`prisma migrate deploy`) |
| `backend/` | `pnpm exec prisma migrate dev --name …` | New migration from `prisma/schema.prisma` (read the SQL before committing it) |
| `backend/` | `pnpm seed [--check] [--prune]` | Check `seed/*.json` against the domain rules; without `--check`, also insert priced parts that are missing. `--prune` deletes parts and vehicles no longer in `seed/` (never parts on an order) |
| `backend/` | `pnpm photos [--check]` | Upload `../photos/` to Cloudinary and link `photos/parts/<SKU>/` folders to their parts; `--check` uploads nothing |
| `backend/` | `pnpm lint` / `pnpm typecheck` | ESLint / strict TypeScript |
| `backend/` | `pnpm test` | Account, sign-in and domain tests (no database needed) |
| `frontend/` | `pnpm dev` / `pnpm build` | Dev server / production build |
| `frontend/` | `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `mobile/` | `pnpm start` | Expo dev server (open in Expo Go or a development build) |
| `mobile/` | `pnpm lint` / `pnpm typecheck` / `npx expo-doctor` | ESLint / TypeScript / dependency and config check |

## Going live with real stock

`backend/seed/` holds the real catalog and `photos/parts/<SKU>/` holds each part's photos. To put them on the live site, from `backend/` with `DATABASE_URL` pointing at the live database:

1. In `seed/parts.json`, set `priceNGN` and `stockQty` on each part you can sell. Leave a part's `null`s in to keep it off the site.
2. `pnpm seed --check` lists what is still a draft.
3. `pnpm seed --prune` deletes the old placeholder parts and vehicles and inserts the priced parts. Their "Stock checked" time is the moment they go in.
4. With `CLOUDINARY_URL` in `.env`: `pnpm photos`. It uploads the photos and links them to the parts that are now live; draft folders wait for the next run.

Repeat 1, 2, 3 (without `--prune` once the placeholders are gone) and 4 as more parts get prices.

## Still placeholder

- Prices and stock counts for the real catalog in `backend/seed/parts.json`. Its 27 parts come from the owner's labelled photos and are drafts (`"priceNGN": null`, `"stockQty": null`) until he fills both in; drafts never reach the site. See [Going live with real stock](#going-live-with-real-stock) above.
- Delivery rates in `backend/src/domain/delivery.ts`.
- Lights and bumpers: the library has many photos of them, but none says which car they fit, so none are listed yet.
- Links to the Facebook, Instagram and TikTok pages: `/about` names the accounts but has no profile URLs yet.
