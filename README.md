# De Car Revolutionist storefront

Online shop for foreign-used genuine ("Belgium") and new Toyota and Lexus body parts from Shop C12/111, Zuba Spare Parts Market, Abuja.

Two apps:

| Folder | What | Stack |
|---|---|---|
| `backend/` | API: catalog, fitment, stock, orders, Google sign-in, Paystack, order emails | FastAPI, SQLAlchemy 2 + Alembic, Postgres, uv |
| `frontend/` | The storefront and the owner's `/admin` page | Next.js 16, TypeScript, Tailwind v4, shadcn/ui, pnpm |

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
uv run python -m app.seed     # 10 placeholder vehicles, 36 parts
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

Deploy `frontend/` to Vercel (set **Root Directory** to `frontend`). Set `NEXT_PUBLIC_SITE_URL` to the live URL, `API_URL` to the backend's URL and `NEXT_PUBLIC_WHATSAPP_NUMBER`. The build doesn't need the API running.

## Google sign-in

Optional for buyers (past orders, faster checkout) and required for the owner's `/admin` in production. Guest checkout always works. The backend talks to Google; the frontend never sees the client secret.

1. **Google Cloud Console → APIs & Services → OAuth consent screen.** Choose External and fill in the app name and support email.
2. **Credentials → Create credentials → OAuth client ID → Web application.** Add these authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-live-domain>/auth/callback`
3. In `backend/.env`, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS` (the owner's Google address; comma-separate several).

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
| `backend/` | `uv run python -m app.seed [--check]` | Check `seed/*.json` against the domain rules; without `--check`, also insert missing rows |
| `backend/` | `uv run python -m app.photos [--check]` | Upload `../photos/` to Cloudinary and link `photos/parts/<SKU>/` folders to their parts; `--check` uploads nothing |
| `backend/` | `uv run pytest` | Tests. The API tests need `createdb decar_test` |
| `backend/` | `uv run ruff check . && uv run mypy app tests` | Lint and strict type check |
| `frontend/` | `pnpm dev` / `pnpm build` | Dev server / production build |
| `frontend/` | `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |

## Still placeholder

- Vehicles, parts, prices and grades in `backend/seed/` until the owner confirms them from his stock.
- Delivery rates in `backend/app/domain/delivery.py`.
- Part images are line drawings until a part gets a `photos/parts/<SKU>/` folder (see "Part photos"). `photos/library/` holds the owner's first batch of photos, sorted by type and the model written on them but not yet matched to parts.
- The mission, vision and values text on `/about`.
