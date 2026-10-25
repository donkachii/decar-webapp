# De Car Revolutionist API

Node.js (Express 5, TypeScript) backend for the storefront in `../frontend` and the phone app in `../mobile`: catalog, fitment, stock, orders, sign-in, Paystack and order emails. Prisma 7 talks to Postgres. Setup, deployment and the full command list are in the [root README](../README.md); the rules the code enforces are in [CLAUDE.md](../CLAUDE.md).

```bash
cp .env.example .env && createdb decar && pnpm install
pnpm migrate && pnpm seed
pnpm dev   # http://localhost:8000
```

## Where things are

| Path | What it holds |
|---|---|
| `src/server.ts`, `src/app.ts` | Starts Express; mounts the routers, CORS, JSON errors |
| `src/routes/` | `catalog`, `orders`, `accounts`, `admin`: the HTTP API, same paths and JSON as the clients expect |
| `src/services/` | Order and stock transactions, saved carts, Paystack, Google, email, Cloudinary, password hashes |
| `src/domain/` | Vocabulary and rules with no I/O: unions, locked SKU tables, delivery rates, checkout validation, labels |
| `src/schemas.ts` | Request bodies (zod) and the JSON shapes sent back |
| `prisma/schema.prisma` | The tables, with camelCase names over snake_case columns |
| `prisma/migrations/` | SQL migrations. `0_init` also holds what Prisma can't express: check constraints for CLAUDE.md section 3, the `updated_at` trigger, row-level security, the order number sequence |
| `src/seed.ts`, `seed/*.json` | The shop's catalog and its rule check (`pnpm seed --check`) |
| `src/photos.ts` | Uploads `../photos/` to Cloudinary and links `photos/parts/<SKU>/` folders (parts with photos added in `/admin` are left alone) |
| `src/services/photos.ts`, `src/domain/photos.ts` | Photos added in `/admin`: a part's photo list and the home page category tiles |

## Changing the schema

1. Edit `prisma/schema.prisma`.
2. `pnpm exec prisma migrate dev --name <what-changed>` writes a migration and applies it to your local database. Read the SQL before committing it.
3. A new part type, position or other domain value also needs its check constraint changed. Prisma doesn't know about them, so add the SQL by hand: `prisma migrate dev --create-only`, edit `migration.sql` (drop and re-add the constraint, as in `0_init`), then `prisma migrate dev`.

Deploys run `prisma migrate deploy`, which only applies migrations that are already written.

## Moving from Alembic (once per database)

The Python backend built its tables with Alembic. `0_init` creates exactly the same schema, so a database Alembic built is told it already has it instead of running it. Your data stays as it is.

```bash
# With DATABASE_URL (and DIRECT_URL, if DATABASE_URL is a pooler) pointing at that database:
pnpm exec prisma migrate resolve --applied 0_init   # "the tables are already there"
pnpm exec prisma migrate deploy                     # runs 1_retire_alembic: drops alembic_version
pnpm exec prisma migrate status                     # "Database schema is up to date!"
```

Do it for the live database before the first Node deploy, or that deploy's `prisma migrate deploy` stops with error P3005 ("The database schema is not empty") and the service doesn't start. It changes nothing when it stops. A fresh database needs none of this: `pnpm migrate` builds it.

## Notes

- Prisma's pg adapter reads and writes timestamps as UTC, so `src/db.ts` puts every connection in UTC. Hosted Postgres already is; a laptop's Postgres often isn't.
- Prisma has no `SELECT … FOR UPDATE`. The row locks in `src/services/orders.ts` and `carts.ts` are single raw statements; everything else goes through the typed client.
- Session tokens, app sign-in codes and password hashes use the same formats and `SESSION_SECRET` as the Python backend did, so existing sign-ins and password accounts carry over.
