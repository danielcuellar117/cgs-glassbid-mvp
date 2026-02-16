#!/bin/bash
# MinIO initialization script: create required buckets and set lifecycle rules.
# Run after MinIO is healthy: docker compose exec minio bash /docker/init-minio.sh

set -e

# Wait for MinIO to be ready
until mc alias set local http://localhost:9000 "${MINIO_ROOT_USER:-minioadmin}" "${MINIO_ROOT_PASSWORD:-minioadmin_secret}" 2>/dev/null; do
  echo "Waiting for MinIO..."
  sleep 2
done

echo "Creating buckets..."
mc mb --ignore-existing local/raw-uploads
mc mb --ignore-existing local/page-cache
mc mb --ignore-existing local/outputs

echo "Setting lifecycle rules..."

# raw-uploads: expire after 14 days
mc ilm rule add local/raw-uploads --expire-days 14

# page-cache: expire after 14 days
mc ilm rule add local/page-cache --expire-days 14

# outputs: expire after 30 days
mc ilm rule add local/outputs --expire-days 30

echo "MinIO initialization complete."
mc ls local/
