"""Worker main entry point.

Implements the dual poll loop as specified in the plan:
- Loop A (high priority): render_requests -- lightweight PNG renders
- Loop B (lower priority): main jobs -- full pipeline stages

Only claims a new main job when the render queue is empty.
"""

import os
import sys
import time
import signal
import resource
import json
import traceback

import structlog

from . import config
from . import db
from .disk import is_disk_pressure, cleanup_orphan_temp_dirs, cleanup_job_temp
from .storage import ensure_buckets
from .pipeline import (
    run_indexing,
    run_routing,
    run_extraction,
    run_pricing,
    run_generation,
)
from .renderer import process_render_request as _render_request
from .cleanup import run_daily_cleanup

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# Graceful shutdown
_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    logger.info("Received signal, shutting down gracefully", signal=signum)
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


# ─── Pipeline Dispatch ───────────────────────────────────────────────────────

# Map from current job status to the pipeline stage function to run
STATUS_TO_STAGE = {
    "UPLOADED": [run_indexing, run_routing, run_extraction],
    "REVIEWED": [run_pricing],
    "PRICED": [run_generation],
}

BACKOFF_SECONDS = [30, 120, 600]


def get_memory_usage_mb() -> float:
    """Get current process memory usage in MB."""
    try:
        usage = resource.getrusage(resource.RUSAGE_SELF)
        return usage.ru_maxrss / 1024  # Linux: KB -> MB
    except Exception:
        return 0.0


def get_disk_usage_pct() -> float:
    """Get disk usage percentage."""
    from .disk import get_disk_usage_pct as _get
    return _get()


def process_render_request(render_req: dict) -> None:
    """Process a single render request (PNG generation via PyMuPDF)."""
    _render_request(render_req)


def process_main_job(job: dict) -> None:
    """Process a main job through its pipeline stages."""
    job_id = job["id"]
    status = job["status"]
    stages = STATUS_TO_STAGE.get(status, [])

    if not stages:
        logger.warning("No stages for job status", job_id=job_id, status=status)
        return

    logger.info(
        "Processing main job",
        job_id=job_id, status=status, stages=len(stages),
    )

    try:
        for stage_fn in stages:
            if _shutdown:
                logger.info("Shutdown requested, pausing job", job_id=job_id)
                # Release lock so another worker can pick it up
                db.update_job_status(
                    job_id, status, clear_lock=True,
                )
                return

            # Reload job state before each stage
            # (in case SSOT was updated during a previous stage)
            stage_fn(job)

            # Refresh job dict with latest ssot after stage
            # (stages update ssot via db, so we re-read)
            from .db import get_cursor
            with get_cursor() as (cur, conn):
                cur.execute(
                    "SELECT ssot, status FROM jobs WHERE id = %s", (job_id,)
                )
                row = cur.fetchone()
                if row:
                    ssot = row["ssot"]
                    if isinstance(ssot, str):
                        ssot = json.loads(ssot)
                    job["ssot"] = ssot
                    job["status"] = row["status"]

            # If job moved to NEEDS_REVIEW, stop processing
            if job["status"] == "NEEDS_REVIEW":
                logger.info("Job needs review, pausing", job_id=job_id)
                return

    except Exception as e:
        logger.error(
            "Job processing failed",
            job_id=job_id, error=str(e), traceback=traceback.format_exc(),
        )
        retry_count = job.get("retry_count", 0)
        max_retries = job.get("max_retries", 3)

        if retry_count < max_retries:
            backoff = BACKOFF_SECONDS[min(retry_count, len(BACKOFF_SECONDS) - 1)]
            db.increment_retry(job_id, backoff)
            logger.info(
                "Job scheduled for retry",
                job_id=job_id, retry=retry_count + 1, backoff=backoff,
            )
        else:
            error_code = type(e).__name__.upper()
            db.mark_job_failed(job_id, str(e), error_code)
            logger.error("Job permanently failed", job_id=job_id)

    finally:
        cleanup_job_temp(job_id)


# ─── Startup ─────────────────────────────────────────────────────────────────


def startup() -> None:
    """Startup tasks: ensure buckets, clean orphan temps."""
    logger.info(
        "Worker starting",
        worker_id=config.WORKER_ID,
        mode=config.WORKER_MODE,
        poll_interval=config.POLL_INTERVAL_SECONDS,
    )

    # Ensure temp dir exists
    os.makedirs(config.TEMP_DIR, exist_ok=True)

    # Ensure MinIO buckets
    try:
        ensure_buckets()
    except Exception as e:
        logger.warning("Could not ensure buckets (MinIO may not be ready)", error=str(e))

    # Clean orphan temp dirs from crashed previous runs
    try:
        from .db import get_cursor
        with get_cursor() as (cur, conn):
            cur.execute(
                "SELECT id FROM jobs WHERE locked_at IS NOT NULL"
            )
            locked_ids = {row["id"] for row in cur.fetchall()}
        cleanup_orphan_temp_dirs(locked_ids)
    except Exception as e:
        logger.warning("Could not clean orphan temps", error=str(e))

    # Initial heartbeat
    try:
        db.upsert_heartbeat(config.WORKER_ID, "IDLE")
    except Exception as e:
        logger.warning("Could not write initial heartbeat", error=str(e))


# ─── Main Loop ───────────────────────────────────────────────────────────────


def main_loop() -> None:
    """Dual poll loop as specified in the plan.

    Loop A: render_requests (high priority, every tick)
    Loop B: main jobs (lower priority, only when render queue is empty)
    Also runs daily cleanup every 24 hours.
    """
    last_cleanup = 0.0  # epoch
    CLEANUP_INTERVAL = 24 * 60 * 60  # 24 hours

    while not _shutdown:
        try:
            mem_mb = get_memory_usage_mb()
            disk_pct = get_disk_usage_pct()

            # Update heartbeat
            db.upsert_heartbeat(
                config.WORKER_ID,
                "IDLE",
                memory_usage_mb=mem_mb,
                disk_usage_pct=disk_pct,
            )

            # Disk pressure guard: check before claiming any work
            if is_disk_pressure():
                logger.warning("Skipping poll cycle due to disk pressure")
                time.sleep(config.POLL_INTERVAL_SECONDS * 5)
                continue

            # ─── Loop A: Render requests (high priority) ─────────────
            render_processed = False
            if config.WORKER_MODE in ("full", "render_only"):
                render_req = db.claim_render_request(config.WORKER_ID)
                if render_req:
                    render_processed = True
                    db.upsert_heartbeat(
                        config.WORKER_ID, "PROCESSING",
                        memory_usage_mb=mem_mb, disk_usage_pct=disk_pct,
                    )
                    process_render_request(render_req)

            # ─── Loop B: Main jobs (only if no renders pending) ──────
            if config.WORKER_MODE == "full" and not render_processed:
                job = db.claim_main_job(config.WORKER_ID)
                if job:
                    db.upsert_heartbeat(
                        config.WORKER_ID, "PROCESSING",
                        current_job_id=job["id"],
                        memory_usage_mb=mem_mb, disk_usage_pct=disk_pct,
                    )
                    process_main_job(job)

            # ─── Daily cleanup ────────────────────────────────────────
            now = time.time()
            if now - last_cleanup > CLEANUP_INTERVAL:
                try:
                    run_daily_cleanup()
                    last_cleanup = now
                except Exception as e:
                    logger.error("Daily cleanup error", error=str(e))

        except Exception as e:
            logger.error("Poll loop error", error=str(e), traceback=traceback.format_exc())

        time.sleep(config.POLL_INTERVAL_SECONDS)


def main():
    startup()
    main_loop()
    logger.info("Worker shut down cleanly")


if __name__ == "__main__":
    main()
