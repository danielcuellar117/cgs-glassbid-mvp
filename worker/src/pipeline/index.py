"""Stage: INDEXING -- classify each page of the PDF.

Downloads the full PDF from MinIO to a local temp file, then iterates
page-by-page with PyMuPDF. Each page is classified by content heuristics.
"""

import os
import json
import re

import fitz  # PyMuPDF
import structlog

from .. import config
from ..db import update_job_status
from ..storage import download_file

logger = structlog.get_logger()

# ─── Page classification keywords ────────────────────────────────────────────

CLASSIFICATION_KEYWORDS = {
    "FLOOR_PLAN": [
        "floor plan", "plan view", "layout", "unit plan",
        "reflected ceiling", "furniture plan",
    ],
    "ELEVATION": [
        "elevation", "interior elevation", "wall elevation",
        "section", "detail elevation",
    ],
    "SCHEDULE": [
        "schedule", "door schedule", "window schedule",
        "finish schedule", "hardware schedule", "fixture schedule",
    ],
    "DETAIL": [
        "detail", "enlarged", "section detail", "typical detail",
        "shower detail", "glass detail", "mirror detail",
    ],
    "NOTES": [
        "general notes", "specifications", "notes", "abbreviations",
        "symbols", "legend", "assumptions", "exclusions",
    ],
    "TITLE": [
        "title sheet", "cover sheet", "cover page", "index",
        "sheet index", "drawing index",
    ],
}

# Keywords that indicate relevance to showers/mirrors
RELEVANCE_KEYWORDS = {
    "showers": [
        "shower", "enclosure", "frameless", "glass panel",
        "shower door", "shower screen", "steam shower",
    ],
    "mirrors": [
        "mirror", "vanity mirror", "bathroom mirror",
    ],
    "assumptions": [
        "assumption", "exclusion", "general note", "note",
        "specification", "scope",
    ],
}


def classify_page(text: str, page_num: int, total_pages: int) -> tuple[str, float]:
    """Classify a page based on its text content.

    Returns (classification, confidence).
    """
    text_lower = text.lower()

    # Title sheet heuristic: first or second page
    if page_num <= 1:
        for kw in CLASSIFICATION_KEYWORDS["TITLE"]:
            if kw in text_lower:
                return "TITLE", 0.85

    # Check each classification
    best_class = "IRRELEVANT"
    best_score = 0.0

    for cls, keywords in CLASSIFICATION_KEYWORDS.items():
        score = 0.0
        for kw in keywords:
            if kw in text_lower:
                score += 1.0 / len(keywords)
        if score > best_score:
            best_score = score
            best_class = cls

    # If no strong signal, fall back to IRRELEVANT
    if best_score < 0.1:
        return "IRRELEVANT", 0.3

    confidence = min(0.95, 0.4 + best_score * 0.6)
    return best_class, round(confidence, 2)


def detect_relevance(text: str) -> list[str]:
    """Detect what the page is relevant to (showers, mirrors, assumptions)."""
    text_lower = text.lower()
    relevant = []

    for category, keywords in RELEVANCE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                relevant.append(category)
                break

    return relevant


def run_indexing(job: dict) -> None:
    """Index all pages in the PDF -- classify each page type.

    1. Download PDF from MinIO to local temp file
    2. Open with PyMuPDF (fitz)
    3. Iterate page-by-page, classify each
    4. Write pageIndex to SSOT
    """
    job_id = job["id"]
    project_id = job.get("project_id")
    logger.info("Starting INDEXING stage", job_id=job_id)

    update_job_status(job_id, "INDEXING", clear_lock=False)

    ssot = job.get("ssot", {})
    if isinstance(ssot, str):
        ssot = json.loads(ssot)

    # Check for idempotency: if pageIndex already populated, skip
    existing_index = ssot.get("pageIndex", [])
    if existing_index and len(existing_index) > 0:
        logger.info("INDEXING: pageIndex already exists, skipping", job_id=job_id)
        update_job_status(
            job_id, "INDEXED", clear_lock=False,
            stage_progress={"stage": "indexing", "status": "complete_skipped"},
        )
        return

    # Determine source PDF path in MinIO
    source_key = f"{project_id}/{job_id}/source.pdf"

    # Also check storage_objects for the actual key
    from ..db import get_cursor
    actual_key = source_key
    try:
        with get_cursor() as (cur, conn):
            cur.execute(
                "SELECT key FROM storage_objects WHERE job_id = %s AND bucket = 'raw-uploads' LIMIT 1",
                (job_id,)
            )
            row = cur.fetchone()
            if row:
                actual_key = row["key"]
    except Exception:
        pass

    # Download to temp
    temp_dir = os.path.join(config.TEMP_DIR, job_id)
    os.makedirs(temp_dir, exist_ok=True)
    local_pdf = os.path.join(temp_dir, "source.pdf")

    try:
        download_file(config.BUCKET_RAW_UPLOADS, actual_key, local_pdf)
    except Exception as e:
        logger.error("Failed to download PDF", job_id=job_id, error=str(e))
        raise

    # Open and process page-by-page
    page_index = []
    try:
        doc = fitz.open(local_pdf)
        total_pages = len(doc)

        logger.info("PDF opened", job_id=job_id, pages=total_pages)

        # Update SSOT metadata
        metadata = ssot.get("metadata", {})
        metadata["pageCount"] = total_pages
        ssot["metadata"] = metadata

        for page_num in range(total_pages):
            page = doc[page_num]
            text = page.get_text("text")

            classification, confidence = classify_page(text, page_num, total_pages)
            relevant_to = detect_relevance(text)

            page_entry = {
                "pageNum": page_num,
                "classification": classification,
                "confidence": confidence,
                "relevantTo": relevant_to,
            }
            page_index.append(page_entry)

            # Progress update every 50 pages
            if (page_num + 1) % 50 == 0:
                update_job_status(
                    job_id, "INDEXING", clear_lock=False,
                    stage_progress={
                        "stage": "indexing",
                        "current_page": page_num + 1,
                        "total_pages": total_pages,
                    },
                )
                logger.debug(
                    "Indexing progress",
                    job_id=job_id,
                    page=page_num + 1,
                    total=total_pages,
                )

        doc.close()

    except Exception as e:
        logger.error("PyMuPDF processing failed", job_id=job_id, error=str(e))
        raise

    ssot["pageIndex"] = page_index

    update_job_status(
        job_id, "INDEXED", clear_lock=False, ssot=ssot,
        stage_progress={
            "stage": "indexing",
            "status": "complete",
            "total_pages": len(page_index),
        },
    )
    logger.info(
        "INDEXING complete",
        job_id=job_id,
        pages_indexed=len(page_index),
        relevant=[p for p in page_index if p["relevantTo"]],
    )
