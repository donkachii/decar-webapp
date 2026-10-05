# De Car Revolutionist storefront

Online shop for foreign-used genuine ("Belgium") and new Toyota and Lexus body parts from Shop C12/111, Zuba Spare Parts Market, Abuja.

Three apps:

| Folder | What | Stack |
|---|---|---|
| `backend/` | API: catalog, fitment, stock, orders, Google sign-in, Paystack, order emails | FastAPI, SQLAlchemy 2 + Alembic, Postgres, uv |
| `frontend/` | The storefront and the owner's `/admin` page | Next.js 16, TypeScript, Tailwind v4, shadcn/ui, pnpm |
| `mobile/` | The buyer's shop as an iOS and Android app ([mobile/README.md](mobile/README.md)) | Expo SDK 57, Expo Router, TypeScript, pnpm |

The database is Postgres: your own locally, Supabase in production. The backend connects with one connection string (`DATABASE_URL`). There are no Supabase API keys, and the frontend holds no secrets at all.

## Run it locally

You need Postgres running locally (`brew install postgresql@18 && brew services start postgresql@18`), [uv](https://docs.astral.sh/uv/) and pnpm.

**1. Backend** (terminal 1)

```bash
cd backend
cp .env.example .env          # defaults work as they are
createdb decar
uv sync
uv run alembic upgrade head   # tables, rules, order numbers
uv run python -m app.seed      # the shop's catalog (priced parts only)
uv run uvicorn app.main:app --reload
```

The API runs on http://localhost:8000. Interactive docs are at http://localhost:8000/docs.

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
   uv run alembic upgrade head
   uv run python -m app.seed
   ```
   The migration also creates a public `part-photos` storage bucket (unused: photos live on Cloudinary) and locks the tables away from Supabase's auto-generated public API (row-level security with no policies), so only the backend can read or write them.

### 2. Backend hosting

Supabase hosts the database, not Python apps, so the API runs on a Python host such as Render, Railway or Fly.io. Point the service at the `backend/` folder:

- Build: `pip install uv && uv sync --no-dev`
- Start: `uv run --no-dev alembic upgrade head && uv run --no-dev uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment: everything in `backend/.env.example`, with `APP_ENV=production`, the Supabase `DATABASE_URL`, `FRONTEND_URL` set to the live shop URL, and a `SESSION_SECRET` from `python -c "import secrets; print(secrets.token_hex(32))"`.

### 3. Frontend hosting

Deploy `frontend/` to Vercel (set **Root Directory** to `frontend`). Set `NEXT_PUBLIC_SITE_URL` to the live URL, `API_URL` to the backend's URL, and `NEXT_PUBLIC_WHATSAPP_NUMBER` only if WhatsApp should go to a number other than 0816 645 6295. The build doesn't need the API running.

## Google sign-in

Optional for buyers (past orders, faster checkout) and required for the owner's `/admin` in production. Guest checkout always works. The backend talks to Google; the frontend never sees the client secret.

1. **Google Cloud Console → APIs & Services → OAuth consent screen.** Choose External and fill in the app name and support email.
2. **Credentials → Create credentials → OAuth client ID → Web application.** Add these authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-live-domain>/auth/callback`
3. In `backend/.env`, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS` (the owner's Google address; comma-separate several).
4. For the phone app, add an iOS and an Android OAuth client and list both in `GOOGLE_MOBILE_CLIENT_IDS`. See [mobile/README.md](mobile/README.md#google-sign-in).

## Order emails (no domain needed)

The backend sends emails through Gmail SMTP. The buyer gets a confirmation if they gave an email, and the shop gets a new-order alert.

1. Turn on 2-Step Verification for the Gmail account.
2. Create an app password: **Google Account → Security → App passwords**.
3. In `backend/.env`, set `GMAIL_USER`, `GMAIL_APP_PASSWORD` and optionally `OWNER_EMAIL` and `WHATSAPP_NUMBER`.

Gmail allows about 500 messages a day. Once you have a domain, swap `send_mail()` in `backend/app/services/email.py` for Resend or similar.

## Paystack (optional)

Set `PAYSTACK_SECRET_KEY` in `backend/.env` to turn on card and bank-transfer payment at checkout. Paystack sends buyers back to the frontend's `/api/paystack/callback`, which asks the backend to verify the amount before marking the order paid. Without the key, checkout offers pay at pickup or on delivery.

## Part photos (Cloudinary)

Photos live on Cloudinary. The backend uploads them and saves each photo's public URL in its part's `images`. The site only reads those URLs.

1. Create a free account at [cloudinary.com](https://cloudinary.com). In the console go to **Settings → API Keys** and copy the **API environment variable**, with the secret revealed. It looks like `cloudinary://123456789012345:abcDEF…@your-cloud-name`.
2. Paste it into `backend/.env` as `CLOUDINARY_URL=cloudinary://…`. Only the backend uses it; the frontend needs nothing.
3. Put a part's photos in `photos/parts/<SKU>/` at the repo root, named `01.jpg`, `02.jpg` … in display order. `01` is the card and WhatsApp preview photo. `photos/README.md` has the rules.
4. In `backend/`, run `uv run python -m app.photos --check`, then `uv run python -m app.photos`. It uploads only photos that aren't on Cloudinary yet, then links each SKU folder to its part. Run it again whenever you add photos.

To link parts in the live database, run the same command with the production connection string: `DATABASE_URL='<Supabase URI>' uv run python -m app.photos`.

## Commands

| Where | Command | What it does |
|---|---|---|
| `backend/` | `uv run uvicorn app.main:app --reload` | API dev server |
| `backend/` | `uv run alembic upgrade head` | Apply migrations |
| `backend/` | `uv run alembic revision --autogenerate -m "…"` | New migration from `app/models.py` (review it before applying) |
| `backend/` | `uv run python -m app.seed [--check] [--prune]` | Check `seed/*.json` against the domain rules; without `--check`, also insert priced parts that are missing. `--prune` deletes parts and vehicles no longer in `seed/` (never parts on an order) |
| `backend/` | `uv run python -m app.photos [--check]` | Upload `../photos/` to Cloudinary and link `photos/parts/<SKU>/` folders to their parts; `--check` uploads nothing |
| `backend/` | `uv run ruff check . && uv run mypy app` | Lint and strict type check |
| `frontend/` | `pnpm dev` / `pnpm build` | Dev server / production build |
| `frontend/` | `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `mobile/` | `pnpm start` | Expo dev server (open in Expo Go or a development build) |
| `mobile/` | `pnpm lint` / `pnpm typecheck` / `npx expo-doctor` | ESLint / TypeScript / dependency and config check |

## Going live with real stock

`backend/seed/` holds the real catalog and `photos/parts/<SKU>/` holds each part's photos. To put them on the live site, from `backend/` with `DATABASE_URL` pointing at the live database:

1. In `seed/parts.json`, set `priceNGN` and `stockQty` on each part you can sell. Leave a part's `null`s in to keep it off the site.
2. `uv run python -m app.seed --check` lists what is still a draft.
3. `uv run python -m app.seed --prune` deletes the old placeholder parts and vehicles and inserts the priced parts. Their "Stock checked" time is the moment they go in.
4. With `CLOUDINARY_URL` in `.env`: `uv run python -m app.photos`. It uploads the photos and links them to the parts that are now live; draft folders wait for the next run.

Repeat 1, 2, 3 (without `--prune` once the placeholders are gone) and 4 as more parts get prices.

## Still placeholder

- Prices and stock counts for the real catalog in `backend/seed/parts.json`. Its 27 parts come from the owner's labelled photos and are drafts (`"priceNGN": null`, `"stockQty": null`) until he fills both in; drafts never reach the site. See "Going live with real stock" below.
- Delivery rates in `backend/app/domain/delivery.py`.
- Lights and bumpers: the library has many photos of them, but none says which car they fit, so none are listed yet.
- Links to the Facebook, Instagram and TikTok pages: `/about` names the accounts but has no profile URLs yet.
