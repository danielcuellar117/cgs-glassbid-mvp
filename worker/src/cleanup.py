"""Daily cleanup runner for retention policy enforcement.

Deletes expired objects from MinIO and their corresponding DB records.
Also handles stale uploads, orphan temp dirs, and disk pressure emergency cleanup.
"""

import os
import shutil
from datetime import datetime, timezone

import structlog

from . import config
from .db import get_cursor
from .storage import get_client

logger = structlog.get_logger()


def cleanup_expired_storage_objects() -> int:
    """Delete expired storage objects from MinIO and the DB.

    Returns the number of objects cleaned up.
    """
    count = 0
    client = get_client()

    try:
        with get_cursor() as (cur, conn):
            cur.execute(
                """
                SELECT id, bucket, key, job_id
                FROM storage_objects
                WHERE expires_at IS NOT NULL AND expires_at < NOW()
                LIMIT 500
                """
            )
            expired = cur.fetchall()

            for obj in expired:
                try:
                    client.remove_object(obj["bucket"], obj["key"])
                except Exception as e:
                    logger.warning(
                        "Failed to delete MinIO object",
                        bucket=obj["bucket"], key=obj["key"], error=str(e),
                    )

                cur.execute("DELETE FROM storage_objects WHERE id = %s", (obj["id"],))
                count += 1

            conn.commit()

    except Exception as e:
        logger.error("Expired object cleanup failed", error=str(e))

    logger.info("Expired storage cleanup complete", deleted=count)
    return count


def cleanup_stale_uploads() -> int:
    """Clean up incomplete uploads (no progress for 24h).

    Detects jobs still in CREATED or UPLOADING state where
    created_at < NOW() - 24 hours.
    """
    count = 0
    client = get_client()

    try:
        with get_cursor() as (cur, conn):
            cur.execute(
                """
                SELECT j.id AS job_id, j.project_id, so.id AS so_id, so.bucket, so.key
                FROM jobs j
                LEFT JOIN storage_objects so ON so.job_id = j.id
                WHERE j.status IN ('CREATED', 'UPLOADING')
                  AND j.created_at < NOW() - INTERVAL '24 hours'
                LIMIT 100
                """
            )
            stale = cur.fetchall()

            for row in stale:
                # Delete MinIO object if exists
                if row.get("bucket") and row.get("key"):
                    try:
                        client.remove_object(row["bucket"], row["key"])
                    except Exception:
                        pass

                    cur.execute("DELETE FROM storage_objects WHERE id = %s", (row["so_id"],))

                # Mark job as FAILED
                cur.execute(
                    """
                    UPDATE jobs
                    SET status = 'FAILED',
                        error_code = 'UPLOAD_ABANDONED',
                        error_message = 'Upload abandoned after 24h of inactivity'
                    WHERE id = %s
                    """,
                    (row["job_id"],),
                )
                count += 1

            conn.commit()

    except Exception as e:
        logger.error("Stale upload cleanup failed", error=str(e))

    logger.info("Stale upload cleanup complete", cleaned=count)
    return count


def cleanup_old_ssot_and_audit() -> int:
    """Delete SSOT and audit logs older than 180 days.

    Sets ssot to '{}' for completed jobs older than retention period.
    Deletes audit_log entries older than 180 days.
    """
    count = 0
    try:
        with get_cursor() as (cur, conn):
            # Clear SSOT for old completed jobs
            cur.execute(
                """
                UPDATE jobs
                SET ssot = '{}'
                WHERE status = 'DONE'
                  AND updated_at < NOW() - INTERVAL '180 days'
                  AND ssot != '{}'
                """
            )
            count += cur.rowcount

            # Delete old audit logs
            cur.execute(
                """
                DELETE FROM audit_log
                WHERE timestamp < NOW() - INTERVAL '180 days'
                """
            )
            count += cur.rowcount

            conn.commit()
    except Exception as e:
        logger.error("SSOT/audit cleanup failed", error=str(e))

    logger.info("SSOT/audit cleanup complete", affected=count)
    return count


def emergency_page_cache_cleanup() -> int:
    """Emergency cleanup: delete page-cache objects ahead of schedule.

    Called when disk usage exceeds 90%.
    """
    count = 0
    client = get_client()

    try:
        with get_cursor() as (cur, conn):
            cur.execute(
                """
                SELECT id, bucket, key FROM storage_objects
                WHERE bucket = 'page-cache'
                ORDER BY created_at ASC
                LIMIT 200
                """
            )
            objects = cur.fetchall()

            for obj in objects:
                try:
                    client.remove_object(obj["bucket"], obj["key"])
                except Exception:
                    pass
                cur.execute("DELETE FROM storage_objects WHERE id = %s", (obj["id"],))
                count += 1

            conn.commit()
    except Exception as e:
        logger.error("Emergency cleanup failed", error=str(e))

    logger.info("Emergency page-cache cleanup complete", deleted=count)
    return count


def run_daily_cleanup() -> dict:
    """Run all daily cleanup tasks.

    Returns a summary of actions taken.
    """
    logger.info("Starting daily cleanup run")

    results = {
        "expired_objects": cleanup_expired_storage_objects(),
        "stale_uploads": cleanup_stale_uploads(),
        "old_ssot_audit": cleanup_old_ssot_and_audit(),
    }

    # Check for disk pressure
    from .disk import get_disk_usage_pct
    disk_pct = get_disk_usage_pct()
    results["disk_usage_pct"] = disk_pct

    if disk_pct >= 90:
        results["emergency_cleanup"] = emergency_page_cache_cleanup()
    else:
        results["emergency_cleanup"] = 0

    logger.info("Daily cleanup complete", results=results)
    return results
