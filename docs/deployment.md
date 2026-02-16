# Deployment Guide

## Prerequisites

- Ubuntu 22.04+ VPS with Docker and Docker Compose installed
- 8 cores, 24 GB RAM, 800 GB SSD, 600 Mbps (minimum)
- A reverse proxy (Caddy/Nginx) for SSL termination (recommended)

## First-Time Deploy

```bash
# 1. Clone the repository
git clone <repo-url> /opt/glassbid
cd /opt/glassbid

# 2. Configure environment
cp .env.example .env
# Edit .env with production secrets:
#   - POSTGRES_PASSWORD (strong random password)
#   - MINIO_SECRET_KEY (strong random password)
#   - Change CORS_ORIGIN to your domain

# 3. Build and start all services
docker compose up -d --build

# 4. Run database migrations (mandatory before first use)
docker compose exec app npx prisma migrate deploy

# 5. Seed the database with default data
docker compose exec app npx tsx prisma/seed.ts

# 6. Initialize MinIO buckets and lifecycle rules
docker compose exec minio bash /docker/init-minio.sh

# 7. Verify all services are healthy
docker compose ps
curl http://localhost:3000/health
```

## Update / Upgrade

```bash
cd /opt/glassbid
git pull

# Apply database migrations FIRST
docker compose exec app npx prisma migrate deploy

# Rebuild and restart services
docker compose up -d --build
```

## Rollback

```bash
git checkout <previous-tag>
docker compose up -d --build
# Note: DB rollback may require manual intervention
```

## Backup

### PostgreSQL
```bash
# Manual backup
docker compose exec postgres pg_dump -U glassbid glassbid > backup_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
0 2 * * * /opt/glassbid/docker/backup-postgres.sh
```

### Restore
```bash
docker compose exec -T postgres psql -U glassbid glassbid < backup_YYYYMMDD.sql
```

## Monitoring

- Health endpoint: `GET /health` (returns DB, disk, worker status)
- Worker heartbeat: checked via `worker_heartbeats` table in Postgres
- Disk pressure guard: worker pauses at 80%, emergency cleanup at 90%
- Structured JSON logs: `docker compose logs -f worker`

## Resource Limits

| Service  | Memory | CPUs |
|----------|--------|------|
| app      | 2 GB   | 1.5  |
| worker   | 6 GB   | 4    |
| postgres | 4 GB   | 1    |
| redis    | 256 MB | 0.25 |
| minio    | 1 GB   | 0.5  |
| tusd     | 512 MB | 0.25 |
| **Total**| ~14 GB | ~7.5 |

Leaves ~10 GB for OS, filesystem cache, and headroom.
