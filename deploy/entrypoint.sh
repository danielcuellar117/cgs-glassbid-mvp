#!/bin/bash
set -e

echo "=== CGS GlassBid — Starting ==="

# ── 1. Remove default nginx site if it exists ──────────────
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# ── 2. Run Prisma migrations ──────────────────────────────
echo "Running Prisma migrations..."
cd /app
npx prisma migrate deploy
echo "Migrations complete."

# ── 3. Seed admin user (idempotent) ──────────────────────
echo "Seeding database..."
npx prisma db seed || echo "Seed skipped or already applied."
echo "Seed complete."

# ── 4. Start supervisord (all processes) ─────────────────
echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/glassbid.conf
