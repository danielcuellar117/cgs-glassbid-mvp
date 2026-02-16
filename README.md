# Luxurius Glass Proposal MVP

An online system for processing architectural PDF sets, extracting frameless shower enclosure and vanity mirror scope, computing pricing, and generating professional Bid and Shop Drawing PDFs.

## Architecture

- **App** (Node.js / TypeScript / Fastify): BFF API + React SPA
- **Worker** (Python): PDF processing pipeline, PNG rendering, PDF generation
- **PostgreSQL 16**: Relational data + SSOT JSON + job queue (`FOR UPDATE SKIP LOCKED`)
- **MinIO**: S3-compatible object storage for uploads, page cache, and outputs
- **tusd**: Resumable upload server (TUS protocol)
- **Redis** (optional): SSE pub/sub and ephemeral cache

## Quick Start

```bash
# 1. Copy environment
cp .env.example .env

# 2. Start all services
docker compose up -d --build

# 3. Run database migrations
docker compose exec app npx prisma migrate deploy

# 4. Create MinIO buckets
docker compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin_secret
docker compose exec minio mc mb local/raw-uploads local/page-cache local/outputs

# 5. Verify
curl http://localhost:3000/health
```

## Project Structure

```
├── app/                  # Node.js BFF + frontend
│   ├── src/
│   │   ├── routes/       # Fastify route handlers
│   │   ├── lib/          # Shared utilities
│   │   └── server.ts     # Entry point
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   ├── package.json
│   └── Dockerfile
├── worker/               # Python worker
│   ├── src/
│   │   ├── main.py       # Poll loop entry point
│   │   ├── pipeline/     # Processing stages
│   │   ├── db.py         # Database access
│   │   └── storage.py    # MinIO client
│   ├── templates/        # Shop drawing template modules
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             # React SPA
├── tests/                # Test suite (mirrors project structure)
│   ├── fixtures/         # Golden SSOT, synthetic PDF
│   ├── app/              # App unit tests (Vitest)
│   ├── worker/           # Worker unit + integration tests (pytest)
│   ├── infra/            # Infrastructure tests (pytest)
│   └── e2e/              # Playwright E2E smoke test
├── docker-compose.yml
├── docker-compose.test.yml  # Isolated test stack
├── .env.example
├── .env.test             # Test environment variables
├── playwright.config.ts  # Playwright config
├── pytest.ini            # pytest config
└── .github/workflows/    # CI pipeline
```

## Testing

The project has a comprehensive test suite covering all components.

### Prerequisites

- **Node.js 20+** (for app tests and Playwright)
- **Python 3.12+** (for worker tests)
- **Docker** (for integration and E2E tests)

### Install Test Dependencies

```bash
# App (Vitest)
cd app && npm install && cd ..

# Worker (pytest)
pip install -r worker/requirements.txt

# E2E (Playwright) - from root
npm install
npx playwright install --with-deps chromium
```

### Running Tests

```bash
# ─── Unit Tests (no Docker needed) ───────────────────────
npm run test:unit              # Run all unit tests
npm run test:unit:app          # App only (Vitest, 44 tests)
npm run test:unit:worker       # Worker + infra (pytest, 130 tests)

# ─── Integration Tests (requires Docker) ─────────────────
npm run test:integration       # Spins up Docker, runs tests, tears down

# ─── E2E Smoke Test (requires full stack) ────────────────
docker compose -f docker-compose.test.yml up -d --build --wait
npm run test:e2e               # Playwright full-pipeline test
docker compose -f docker-compose.test.yml down -v

# ─── All Tests ───────────────────────────────────────────
npm run test:all               # unit + integration + e2e
```

### Test Structure

```
tests/
  fixtures/
    golden-ssot.json          # Golden SSOT fixture (5 items, $104,800)
    conftest.py               # Shared fixtures + synthetic PDF generator
  app/
    setup.ts                  # Vitest global setup (Prisma/MinIO mocks)
    src/routes/
      jobs.test.ts            # Job CRUD, file size limits, SSOT skeleton
      webhooks.test.ts        # Token validation, status transitions
      downloads.test.ts       # Presigned URLs, regeneration gate
      render-requests.test.ts # Deduplication, DPI defaults
      pricing.test.ts         # Pricebook CRUD, price overrides
  worker/
    conftest.py               # Worker-specific fixtures
    src/
      test_disk.py            # Disk pressure, temp cleanup
      generators/
        test_validation.py    # SSOT validation (5 error types)
        test_bid_pdf.py       # Bid PDF generation from golden SSOT
        test_shop_drawings_pdf.py  # Shop drawings generation
        test_drawing_utils.py # Dimension formatting
      pipeline/
        test_extract.py       # Dimension parsing, category detection
        test_index.py         # Page classification, relevance
        test_price.py         # Pricing formulas, breakdowns
    src/test_db.py            # DB claim logic (integration, needs Docker)
  infra/
    test_disk_pressure.py     # Threshold behavior, custom thresholds
    test_minio_lifecycle.py   # Cleanup functions, expired objects
  e2e/
    smoke.spec.ts             # Full pipeline: upload -> DONE
```

### Docker Test Infrastructure

`docker-compose.test.yml` provides an isolated environment:

| Service    | Test Port | Purpose                        |
|------------|-----------|--------------------------------|
| PostgreSQL | 5433      | Ephemeral DB (`glassbid_test`) |
| MinIO      | 9010/9011 | Ephemeral object storage       |
| Redis      | 6380      | Ephemeral cache                |
| tusd       | 8081      | Resumable uploads              |
| App        | 3001      | BFF API                        |
| Frontend   | 8090      | React SPA (for E2E)            |

All services use `tmpfs` for fast, ephemeral storage.

### CI (GitHub Actions)

The `.github/workflows/test.yml` workflow runs:
- **Unit tests**: On every push/PR (app + worker in parallel)
- **Integration tests**: On push to main and PRs (after unit tests)
- **E2E**: Manual trigger or nightly schedule

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 5433/9010/6380 already in use | Stop conflicting services or change ports in `docker-compose.test.yml` |
| Vitest `EADDRINUSE` error | Ensure no other app instance is running on port 3000 |
| pytest `ModuleNotFoundError: No module named 'src'` | Run pytest from the `worker/` directory |
| Integration tests fail to connect | Ensure Docker compose test stack is running and healthy |
| E2E timeout | Increase `timeout` in `playwright.config.ts` (default: 180s) |
| PDF generation tests slow | These use ReportLab at runtime; expected ~3-5s total |
| Docker memory issues | Ensure Docker has >= 4GB RAM allocated |

## Operational Runbook

See the implementation plan for full deploy, update, rollback, and backup procedures.
