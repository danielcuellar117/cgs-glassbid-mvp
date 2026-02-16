"""MinIO storage client for the worker."""

import os
from typing import Optional

from minio import Minio
import structlog

from . import config

logger = structlog.get_logger()

_client: Optional[Minio] = None


def get_client() -> Minio:
    """Get or create the MinIO client singleton."""
    global _client
    if _client is None:
        _client = Minio(
            f"{config.MINIO_ENDPOINT}:{config.MINIO_PORT}",
            access_key=config.MINIO_ACCESS_KEY,
            secret_key=config.MINIO_SECRET_KEY,
            secure=config.MINIO_USE_SSL,
        )
    return _client


def download_file(bucket: str, key: str, local_path: str) -> None:
    """Download an object from MinIO to a local file path (streamed)."""
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    client = get_client()
    client.fget_object(bucket, key, local_path)
    logger.info("Downloaded file", bucket=bucket, key=key, local_path=local_path)


def upload_file(
    bucket: str, key: str, local_path: str, content_type: str = "application/octet-stream"
) -> None:
    """Upload a local file to MinIO."""
    client = get_client()
    client.fput_object(bucket, key, local_path, content_type=content_type)
    logger.info("Uploaded file", bucket=bucket, key=key, local_path=local_path)


def upload_bytes(
    bucket: str,
    key: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> None:
    """Upload bytes directly to MinIO."""
    import io

    client = get_client()
    stream = io.BytesIO(data)
    client.put_object(bucket, key, stream, len(data), content_type=content_type)
    logger.info("Uploaded bytes", bucket=bucket, key=key, size=len(data))


def ensure_buckets() -> None:
    """Ensure all required buckets exist."""
    client = get_client()
    for bucket in [
        config.BUCKET_RAW_UPLOADS,
        config.BUCKET_PAGE_CACHE,
        config.BUCKET_OUTPUTS,
    ]:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
            logger.info("Created bucket", bucket=bucket)
