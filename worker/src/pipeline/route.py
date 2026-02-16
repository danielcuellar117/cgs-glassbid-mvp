"""Stage: ROUTING -- determine which pages are relevant.

Analyzes the page index and marks pages containing shower/mirror info,
schedules, and notes. Creates eager render requests for relevant pages.
"""

import json
import structlog

from ..db import update_job_status, get_cursor

logger = structlog.get_logger()

# Classifications that are always relevant
RELEVANT_CLASSIFICATIONS = {"SCHEDULE", "DETAIL", "NOTES", "ELEVATION"}


def run_routing(job: dict) -> None:
    """Analyze page index and determine relevant pages.

    1. Review all page classifications from INDEXING
    2. Mark pages as relevant based on classification + keyword relevance
    3. Create eager render requests for relevant pages (THUMB)
    """
    job_id = job["id"]
    logger.info("Starting ROUTING stage", job_id=job_id)

    update_job_status(job_id, "ROUTING", clear_lock=False)

    ssot = job.get("ssot", {})
    if isinstance(ssot, str):
        ssot = json.loads(ssot)

    page_index = ssot.get("pageIndex", [])
    if not page_index:
        logger.warning("No page index found, nothing to route", job_id=job_id)
        update_job_status(
            job_id, "ROUTED", clear_lock=False, ssot=ssot,
            stage_progress={"stage": "routing", "status": "complete", "relevant_pages": 0},
        )
        return

    # Determine relevant pages
    relevant_pages = []
    for page in page_index:
        is_relevant = False

        # Relevant if classification suggests content
        if page.get("classification") in RELEVANT_CLASSIFICATIONS:
            is_relevant = True

        # Relevant if keywords detected
        if page.get("relevantTo") and len(page["relevantTo"]) > 0:
            is_relevant = True

        # Floor plans may have shower/mirror layouts
        if page.get("classification") == "FLOOR_PLAN" and page.get("relevantTo"):
            is_relevant = True

        if is_relevant:
            relevant_pages.append(page["pageNum"])

    logger.info(
        "Routing complete",
        job_id=job_id,
        total_pages=len(page_index),
        relevant_count=len(relevant_pages),
    )

    # Create eager render requests for relevant pages (thumbnails)
    try:
        with get_cursor() as (cur, conn):
            for page_num in relevant_pages:
                cur.execute(
                    """
                    INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at)
                    VALUES (gen_random_uuid(), %s, %s, 'THUMB', %s, 'PENDING', NOW())
                    ON CONFLICT (job_id, page_num, kind) DO NOTHING
                    """,
                    (job_id, page_num, 72),
                )
            conn.commit()
        logger.info(
            "Created eager render requests",
            job_id=job_id, count=len(relevant_pages),
        )
    except Exception as e:
        logger.warning("Could not create render requests", error=str(e))

    # Store routing results in SSOT
    ssot["routing"] = {
        "relevantPages": relevant_pages,
        "totalPages": len(page_index),
    }

    update_job_status(
        job_id, "ROUTED", clear_lock=False, ssot=ssot,
        stage_progress={
            "stage": "routing",
            "status": "complete",
            "relevant_pages": len(relevant_pages),
        },
    )
