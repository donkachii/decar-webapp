# De Car Revolutionist API

FastAPI backend for the storefront in `../frontend`: catalog, fitment, stock, orders, Google sign-in, Paystack and order emails. Setup, deployment and the full command list are in the [root README](../README.md); the rules the code enforces are in [CLAUDE.md](../CLAUDE.md).

```bash
cp .env.example .env && createdb decar && uv sync
uv run alembic upgrade head && uv run python -m app.seed
uv run uvicorn app.main:app --reload   # http://localhost:8000/docs
uv run pytest                          # API tests need: createdb decar_test
```
