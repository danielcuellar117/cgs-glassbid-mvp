"""Database access layer using psycopg2 and raw SQL.

The worker uses Postgres as its job queue via FOR UPDATE SKIP LOCKED.
Prisma Migrate owns the schema; the worker reads/writes via SQL only.
"""

import json
import contextlib
from datetime import datetime, timezone
from typing import Any, Optional

import psycopg2
import psycopg2.extras
import structlog

from . import config

logger = structlog.get_logger()

psycopg2.extras.register_uuid()


def get_connection():
    """Create a new database connection."""
    return psycopg2.connect(config.DATABASE_URL)


@contextlib.contextmanager
def get_cursor(autocommit: bool = False):
    """Context manager for DB cursor with auto-close."""
    conn = get_connection()
    conn.autocommit = autocommit
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur, conn
    finally:
        conn.close()


# ─── Job Queue ───────────────────────────────────────────────────────────────


def claim_main_job(worker_id: str) -> Optional[dict]:
    """Claim the next available main job using FOR UPDATE SKIP LOCKED.

    Returns the job row dict or None if no job available.
    """
    conn = get_connection()
    try:
        conn.autocommit = False
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, project_id, status, ssot, stage_progress,
                       retry_count, max_retries
                FROM jobs
                WHERE status IN ('UPLOADED', 'REVIEWED', 'PRICED')
                  AND (locked_at IS NULL
                       OR locked_at < NOW() - INTERVAL '10 minutes')
                  AND (next_run_at IS NULL OR next_run_at <= NOW())
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
                """
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return None

            cur.execute(
                """
                UPDATE jobs
                SET locked_at = NOW(), locked_by = %s
                WHERE id = %s
                """,
                (worker_id, row["id"]),
            )
            conn.commit()
            return dict(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def claim_render_request(worker_id: str) -> Optional[dict]:
    """Claim the next pending render request."""
    conn = get_connection()
    try:
        conn.autocommit = False
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, job_id, page_num, kind, dpi
                FROM render_requests
                WHERE status = 'PENDING'
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
                """
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return None

            # No locking columns on render_requests; just mark in-progress
            # by returning the row. Actual status update happens after render.
            conn.commit()
            return dict(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─── Job Status Updates ──────────────────────────────────────────────────────


def update_job_status(
    job_id: str,
    new_status: str,
    *,
    stage_progress: Optional[dict] = None,
    error_message: Optional[str] = None,
    error_code: Optional[str] = None,
    clear_lock: bool = True,
    ssot: Optional[dict] = None,
) -> None:
    """Update a job's status and optionally its SSOT, progress, or error info."""
    with get_cursor() as (cur, conn):
        fields = ["status = %s", "updated_at = NOW()"]
        params: list[Any] = [new_status]

        if clear_lock:
            fields.append("locked_at = NULL")
            fields.append("locked_by = NULL")

        if stage_progress is not None:
            fields.append("stage_progress = %s")
            params.append(json.dumps(stage_progress))

        if error_message is not None:
            fields.append("error_message = %s")
            params.append(error_message)

        if error_code is not None:
            fields.append("error_code = %s")
            params.append(error_code)

        if ssot is not None:
            fields.append("ssot = %s")
            params.append(json.dumps(ssot))

        params.append(job_id)
        cur.execute(
            f"UPDATE jobs SET {', '.join(fields)} WHERE id = %s",
            params,
        )
        conn.commit()


def mark_job_failed(
    job_id: str, error_message: str, error_code: str
) -> None:
    """Mark a job as FAILED with error details."""
    update_job_status(
        job_id,
        "FAILED",
        error_message=error_message,
        error_code=error_code,
    )


def increment_retry(job_id: str, backoff_seconds: int) -> None:
    """Increment retry count and set next_run_at for backoff."""
    with get_cursor() as (cur, conn):
        cur.execute(
            """
            UPDATE jobs
            SET retry_count = retry_count + 1,
                next_run_at = NOW() + %s * INTERVAL '1 second',
                locked_at = NULL,
                locked_by = NULL
            WHERE id = %s
            """,
            (backoff_seconds, job_id),
        )
        conn.commit()


# ─── Render Request Updates ──────────────────────────────────────────────────


def complete_render_request(request_id: str, output_key: str) -> None:
    """Mark a render request as DONE with the output MinIO key."""
    with get_cursor() as (cur, conn):
        cur.execute(
            """
            UPDATE render_requests
            SET status = 'DONE', output_key = %s, completed_at = NOW()
            WHERE id = %s
            """,
            (output_key, request_id),
        )
        conn.commit()


def fail_render_request(request_id: str) -> None:
    """Mark a render request as FAILED."""
    with get_cursor() as (cur, conn):
        cur.execute(
            """
            UPDATE render_requests
            SET status = 'FAILED', completed_at = NOW()
            WHERE id = %s
            """,
            (request_id,),
        )
        conn.commit()


# ─── Worker Heartbeat ────────────────────────────────────────────────────────


def upsert_heartbeat(
    worker_id: str,
    status: str = "IDLE",
    current_job_id: Optional[str] = None,
    memory_usage_mb: Optional[float] = None,
    disk_usage_pct: Optional[float] = None,
) -> None:
    """Upsert the worker heartbeat row."""
    with get_cursor() as (cur, conn):
        cur.execute(
            """
            INSERT INTO worker_heartbeats
                (worker_id, last_heartbeat_at, status, current_job_id,
                 memory_usage_mb, disk_usage_pct, updated_at)
            VALUES (%s, NOW(), %s, %s, %s, %s, NOW())
            ON CONFLICT (worker_id) DO UPDATE SET
                last_heartbeat_at = NOW(),
                status = EXCLUDED.status,
                current_job_id = EXCLUDED.current_job_id,
                memory_usage_mb = EXCLUDED.memory_usage_mb,
                disk_usage_pct = EXCLUDED.disk_usage_pct,
                updated_at = NOW()
            """,
            (worker_id, status, current_job_id, memory_usage_mb, disk_usage_pct),
        )
        conn.commit()
