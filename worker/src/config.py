"""Worker configuration from environment variables."""

import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://glassbid:glassbid_secret@postgres:5432/glassbid",
)

MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "minio")
MINIO_PORT = int(os.environ.get("MINIO_PORT", "9000"))
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin_secret")
MINIO_USE_SSL = os.environ.get("MINIO_USE_SSL", "false").lower() == "true"

POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "2"))
WORKER_ID = os.environ.get("WORKER_ID", "worker-1")
WORKER_MODE = os.environ.get("WORKER_MODE", "full")  # "full" or "render_only"

MAX_MEMORY_MB = int(os.environ.get("MAX_MEMORY_MB", "5120"))
TEMP_DIR = os.environ.get("TEMP_DIR", "/data/worker-tmp")
DISK_PRESSURE_THRESHOLD_PCT = int(
    os.environ.get("DISK_PRESSURE_THRESHOLD_PCT", "80")
)

PNG_THUMB_DPI = int(os.environ.get("PNG_THUMB_DPI", "72"))
PNG_MEASURE_DPI = int(os.environ.get("PNG_MEASURE_DPI", "200"))
MAX_RENDER_PIXELS = int(os.environ.get("MAX_RENDER_PIXELS", "8000"))
MAX_RENDER_DPI = int(os.environ.get("MAX_RENDER_DPI", "400"))

# Buckets
BUCKET_RAW_UPLOADS = "raw-uploads"
BUCKET_PAGE_CACHE = "page-cache"
BUCKET_OUTPUTS = "outputs"
