#!/bin/bash
# Daily PostgreSQL backup script.
# Add to host crontab: 0 2 * * * /path/to/backup-postgres.sh

set -e

BACKUP_DIR="/backups/postgres"
CONTAINER_NAME="cgs-glassbid-mvp-postgres-1"
DB_NAME="${POSTGRES_DB:-glassbid}"
DB_USER="${POSTGRES_USER:-glassbid}"
RETENTION_DAYS=7

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/glassbid_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting PostgreSQL backup..."

docker exec "${CONTAINER_NAME}" \
  pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup saved to ${BACKUP_FILE}"

# Clean up backups older than retention period
find "${BACKUP_DIR}" -name "glassbid_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Old backups cleaned. Current backups:"
ls -lh "${BACKUP_DIR}"
