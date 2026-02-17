# ============================================================
# CGS GlassBid MVP — Single-container production build
# Combines: frontend (nginx) + BFF (node) + worker (python) + tusd
# Managed by supervisord
# ============================================================

# ── Stage 1: Build Frontend ─────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ── Stage 2: Build BFF (Fastify/TypeScript) ─────────────────
FROM node:22-slim AS app-builder
WORKDIR /build

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY app/package.json app/package-lock.json* ./
RUN npm install

COPY app/prisma ./prisma/
RUN npx prisma generate

COPY app/tsconfig.json ./
COPY app/src ./src/
RUN npx tsc

# ── Stage 3: Get tusd binary ────────────────────────────────
FROM tusproject/tusd:v2 AS tusd-bin

# ── Stage 4: Runtime ────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Install system dependencies: nginx, node 22, supervisor, curl
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        nginx \
        curl \
        openssl \
        libpq-dev \
        supervisor \
        gnupg \
        ca-certificates \
        musl && \
    # Install Node.js 22
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    # Cleanup
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Copy tusd binary ──────────────────────────────────────
COPY --from=tusd-bin /usr/local/bin/tusd /usr/local/bin/tusd
RUN chmod +x /usr/local/bin/tusd

# ── Copy frontend static files ────────────────────────────
COPY --from=frontend-builder /build/dist /usr/share/nginx/html

# ── Copy BFF application ──────────────────────────────────
WORKDIR /app
COPY --from=app-builder /build/node_modules ./node_modules/
COPY --from=app-builder /build/dist ./dist/
COPY --from=app-builder /build/prisma ./prisma/
COPY app/package.json ./
COPY app/prisma/seed.ts ./prisma/seed.ts

# ── Copy Worker application ───────────────────────────────
WORKDIR /worker
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/src/ ./src/
COPY worker/templates/ ./templates/

RUN mkdir -p /data/worker-tmp

# ── Copy deploy configs ──────────────────────────────────
COPY deploy/nginx.conf /etc/nginx/sites-available/default
COPY deploy/supervisord.conf /etc/supervisor/conf.d/glassbid.conf
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Environment defaults ─────────────────────────────────
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/worker

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:80/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
