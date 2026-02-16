"""Disk usage monitoring and pressure guard."""

import os
import shutil
import structlog

from . import config

logger = structlog.get_logger()


def get_disk_usage_pct() -> float:
    """Get disk usage percentage for the TEMP_DIR volume."""
    try:
        usage = shutil.disk_usage(config.TEMP_DIR)
        pct = (usage.used / usage.total) * 100
        return round(pct, 1)
    except Exception as e:
        logger.warning("Could not read disk usage", error=str(e))
        return 0.0


def is_disk_pressure() -> bool:
    """Check if disk usage exceeds the pressure threshold."""
    pct = get_disk_usage_pct()
    if pct >= config.DISK_PRESSURE_THRESHOLD_PCT:
        logger.warning(
            "Disk pressure detected",
            usage_pct=pct,
            threshold=config.DISK_PRESSURE_THRESHOLD_PCT,
        )
        return True
    return False


def cleanup_orphan_temp_dirs(locked_job_ids: set) -> None:
    """On startup, clean up orphan temp directories from crashed runs.

    Deletes any TEMP_DIR/{jobId}/ directory whose jobId is not currently
    locked in the database.
    """
    temp_dir = config.TEMP_DIR
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir, exist_ok=True)
        return

    for entry in os.listdir(temp_dir):
        entry_path = os.path.join(temp_dir, entry)
        if os.path.isdir(entry_path) and entry not in locked_job_ids:
            logger.info("Cleaning orphan temp dir", path=entry_path)
            shutil.rmtree(entry_path, ignore_errors=True)


def cleanup_job_temp(job_id: str) -> None:
    """Delete the temp directory for a specific job."""
    job_dir = os.path.join(config.TEMP_DIR, job_id)
    if os.path.exists(job_dir):
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.info("Cleaned up temp dir", path=job_dir)
