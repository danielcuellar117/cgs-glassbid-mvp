"""Stage: EXTRACTING -- extract entities from relevant pages.

Revisits relevant pages (identified during ROUTING), extracts:
- Scope items (shower enclosures, vanity mirrors)
- Dimensions from callouts/schedules
- Quantities by unit type
- Assumptions/exclusions from notes

Creates Measurement Tasks for any missing dimensions.
"""

import os
import json
import re
import uuid

import fitz  # PyMuPDF
import structlog

from .. import config
from ..db import update_job_status, get_cursor
from ..storage import download_file

logger = structlog.get_logger()

# ─── Dimension patterns ──────────────────────────────────────────────────────

# Match patterns like: 36", 36 in, 3'-0", 36-1/2", 72 1/4"
DIM_PATTERN = re.compile(
    r"""
    (?:(\d+)\s*['\u2032]\s*-?\s*)?    # optional feet
    (\d+(?:\s*-?\s*\d+/\d+)?)\s*      # inches (with optional fraction)
    ["\u2033]?                          # optional inch symbol
    """,
    re.VERBOSE,
)

# Pattern for schedule-style entries: "Type A: 3'-0\" x 6'-8\""
SCHEDULE_DIM_PATTERN = re.compile(
    r"(\d+['\u2032]?\s*-?\s*\d*(?:\s*\d+/\d+)?[\"'\u2033]?)"
    r"\s*[xX×]\s*"
    r"(\d+['\u2032]?\s*-?\s*\d*(?:\s*\d+/\d+)?[\"'\u2033]?)",
)

# ─── Shower/Mirror detection keywords ────────────────────────────────────────

SHOWER_KEYWORDS = [
    "shower enclosure", "frameless shower", "glass enclosure",
    "shower door", "glass panel", "fixed panel", "inline panel",
    "neo-angle", "90 degree", "90°", "corner shower",
    "bypass", "sliding shower", "steam shower",
    "bathtub enclosure", "tub panel",
]

MIRROR_KEYWORDS = [
    "vanity mirror", "bathroom mirror", "mirror",
    "beveled mirror", "frameless mirror",
]

CONFIGURATION_KEYWORDS = {
    "inline-panel": ["inline panel", "fixed panel", "single panel"],
    "inline-panel-door": ["panel and door", "panel + door", "inline door"],
    "90-degree-corner": ["90 degree corner", "90° corner", "corner panel"],
    "90-degree-corner-door": ["90 degree corner door", "90° corner door", "corner door"],
    "neo-angle": ["neo-angle", "neo angle", "neoangle"],
    "frameless-sliding": ["sliding", "bypass", "bypass shower"],
    "bathtub-fixed-panel": ["bathtub panel", "tub panel", "tub fixed"],
    "bathtub-panel-door": ["bathtub door", "tub door", "bathtub panel door"],
    "vanity-mirror": ["vanity mirror", "rectangular mirror"],
    "vanity-mirror-custom": ["custom mirror", "shaped mirror", "mirror cutout"],
    "steam-shower": ["steam shower", "steam enclosure"],
    "custom-enclosure": ["wine cellar", "custom enclosure", "custom glass"],
}


def _parse_dimension_inches(text: str) -> float | None:
    """Parse a dimension string to inches. Returns None if unparseable."""
    text = text.strip().replace("\u2032", "'").replace("\u2033", '"')

    # Try feet-inches: 3'-6"
    m = re.match(r"(\d+)\s*[']\s*-?\s*(\d+(?:\s*\d+/\d+)?)\s*[\"]*", text)
    if m:
        feet = int(m.group(1))
        inches_str = m.group(2).strip()
        inches = _parse_inches(inches_str)
        if inches is not None:
            return feet * 12 + inches

    # Just inches: 36", 36 1/2"
    inches = _parse_inches(text.rstrip('"').rstrip("'").strip())
    return inches


def _parse_inches(text: str) -> float | None:
    """Parse inches string like '36', '36 1/2', '36-1/2'."""
    text = text.strip()
    if not text:
        return None

    # Whole + fraction: "36 1/2" or "36-1/2"
    m = re.match(r"(\d+)\s*[-\s]\s*(\d+)/(\d+)", text)
    if m:
        whole = int(m.group(1))
        num = int(m.group(2))
        den = int(m.group(3))
        if den == 0:
            return None
        return whole + num / den

    # Just fraction: "1/2"
    m = re.match(r"(\d+)/(\d+)", text)
    if m:
        num = int(m.group(1))
        den = int(m.group(2))
        if den == 0:
            return None
        return num / den

    # Just number
    try:
        return float(text)
    except ValueError:
        return None


def _detect_category(text: str) -> str | None:
    """Detect if text refers to a shower or mirror."""
    text_lower = text.lower()
    for kw in SHOWER_KEYWORDS:
        if kw in text_lower:
            return "SHOWER_ENCLOSURE"
    for kw in MIRROR_KEYWORDS:
        if kw in text_lower:
            return "VANITY_MIRROR"
    return None


def _detect_configuration(text: str) -> str | None:
    """Detect the configuration type from text."""
    text_lower = text.lower()
    for config_key, keywords in CONFIGURATION_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return config_key
    return None


def _extract_dimensions_from_text(text: str) -> dict:
    """Extract width/height/depth dimensions from a text block."""
    dims = {"width": None, "height": None, "depth": None}

    # Look for WxH patterns
    matches = SCHEDULE_DIM_PATTERN.findall(text)
    if matches:
        w, h = matches[0]
        dims["width"] = _parse_dimension_inches(w)
        dims["height"] = _parse_dimension_inches(h)
        return dims

    # Look for individual labeled dimensions
    text_lower = text.lower()

    for label, key in [("width", "width"), ("w:", "width"), ("w =", "width"),
                        ("height", "height"), ("h:", "height"), ("h =", "height"),
                        ("depth", "depth"), ("d:", "depth"), ("d =", "depth"),
                        ("return", "depth")]:
        pattern = re.compile(
            re.escape(label) + r"\s*[:=]?\s*(\d+['\u2032]?\s*-?\s*\d*(?:\s*\d+/\d+)?[\"'\u2033]?)",
            re.IGNORECASE,
        )
        m = pattern.search(text)
        if m:
            val = _parse_dimension_inches(m.group(1))
            if val and 3 <= val <= 240:  # Sanity range
                dims[key] = val

    return dims


def _extract_items_from_page(
    doc: fitz.Document, page_num: int, text: str
) -> list[dict]:
    """Extract scope items from a single page."""
    items = []
    text_lower = text.lower()

    # Split text into blocks/sections
    blocks = text.split("\n\n")
    if not blocks:
        blocks = [text]

    for block in blocks:
        category = _detect_category(block)
        if not category:
            continue

        configuration = _detect_configuration(block)
        dims = _extract_dimensions_from_text(block)

        # Build dimension entries with source info
        dim_entries = {}
        for key in ["width", "height", "depth"]:
            val = dims.get(key)
            if val is not None:
                dim_entries[key] = {
                    "value": val,
                    "unit": "in",
                    "source": "DIMENSION_CALLOUT",
                    "confidence": 0.7,
                }
            else:
                dim_entries[key] = {
                    "value": None,
                    "unit": "in",
                    "source": "FIELD_VERIFY",
                    "confidence": 0.0,
                }

        # Detect glass type
        glass_type = "3/8 clear tempered"  # Default
        if "1/2" in block.lower():
            glass_type = "1/2 clear tempered"
        if "frosted" in block.lower():
            glass_type = glass_type.replace("clear", "frosted")
        if "low iron" in block.lower() or "starphire" in block.lower():
            glass_type = glass_type.replace("clear", "low iron")

        flags = []
        needs_width = dim_entries["width"]["value"] is None
        needs_height = dim_entries["height"]["value"] is None

        if needs_width or needs_height:
            flags.append("NEEDS_REVIEW")

        item = {
            "itemId": str(uuid.uuid4()),
            "category": category,
            "unitId": "",
            "location": "",
            "configuration": configuration or "unknown",
            "templateId": "",
            "dimensions": dim_entries,
            "glassType": glass_type,
            "hardware": [],
            "flags": flags,
            "notes": "",
            "sourcePages": [page_num],
            "quantityPerUnit": 1,
        }
        items.append(item)

    return items


def _extract_assumptions(text: str) -> tuple[list[str], list[str]]:
    """Extract assumptions and exclusions from text."""
    assumptions = []
    exclusions = []
    text_lower = text.lower()

    in_assumptions = False
    in_exclusions = False

    for line in text.split("\n"):
        line_stripped = line.strip()
        line_lower = line_stripped.lower()

        if "assumption" in line_lower:
            in_assumptions = True
            in_exclusions = False
            continue
        if "exclusion" in line_lower:
            in_exclusions = True
            in_assumptions = False
            continue

        if line_stripped and (line_stripped.startswith("-") or line_stripped.startswith("•")
                             or line_stripped.startswith("·") or re.match(r"^\d+[\.\)]\s", line_stripped)):
            clean = re.sub(r"^[-•·\d\.\)]+\s*", "", line_stripped).strip()
            if clean:
                if in_assumptions:
                    assumptions.append(clean)
                elif in_exclusions:
                    exclusions.append(clean)

    return assumptions, exclusions


def run_extraction(job: dict) -> None:
    """Extract scope items, dimensions, and quantities from relevant pages.

    1. Get relevant pages from SSOT routing info
    2. Re-open PDF from local temp (or re-download)
    3. For each relevant page, extract entities
    4. Create measurement tasks for missing dimensions
    5. Set confidence scores and flags
    """
    job_id = job["id"]
    project_id = job.get("project_id")
    logger.info("Starting EXTRACTING stage", job_id=job_id)

    update_job_status(job_id, "EXTRACTING", clear_lock=False)

    ssot = job.get("ssot", {})
    if isinstance(ssot, str):
        ssot = json.loads(ssot)

    # Check idempotency
    if ssot.get("items") and len(ssot["items"]) > 0:
        logger.info("EXTRACTING: items already exist, skipping", job_id=job_id)
        has_flags = any("NEEDS_REVIEW" in item.get("flags", []) for item in ssot["items"])
        next_status = "NEEDS_REVIEW" if has_flags else "EXTRACTED"
        update_job_status(
            job_id, next_status, clear_lock=has_flags,
            stage_progress={"stage": "extracting", "status": "complete_skipped"},
        )
        return

    # Get relevant pages
    routing = ssot.get("routing", {})
    relevant_pages = routing.get("relevantPages", [])
    page_index = ssot.get("pageIndex", [])

    if not relevant_pages:
        # If no routing info, use all non-irrelevant pages
        relevant_pages = [
            p["pageNum"] for p in page_index
            if p.get("classification") != "IRRELEVANT"
        ]

    # Get source PDF
    temp_dir = os.path.join(config.TEMP_DIR, job_id)
    local_pdf = os.path.join(temp_dir, "source.pdf")

    if not os.path.exists(local_pdf):
        # Re-download
        source_key = f"{project_id}/{job_id}/source.pdf"
        try:
            with get_cursor() as (cur, conn):
                cur.execute(
                    "SELECT key FROM storage_objects WHERE job_id = %s AND bucket = 'raw-uploads' LIMIT 1",
                    (job_id,),
                )
                row = cur.fetchone()
                if row:
                    source_key = row["key"]
        except Exception:
            pass
        os.makedirs(temp_dir, exist_ok=True)
        download_file(config.BUCKET_RAW_UPLOADS, source_key, local_pdf)

    # Extract from relevant pages
    all_items = []
    all_assumptions = []
    all_exclusions = []

    try:
        doc = fitz.open(local_pdf)

        for page_num in relevant_pages:
            if page_num >= len(doc):
                continue

            page = doc[page_num]
            text = page.get_text("text")

            # Extract items
            items = _extract_items_from_page(doc, page_num, text)
            all_items.extend(items)

            # Extract assumptions/exclusions from NOTES pages
            page_info = next(
                (p for p in page_index if p["pageNum"] == page_num), None
            )
            if page_info and page_info.get("classification") == "NOTES":
                assumptions, exclusions = _extract_assumptions(text)
                all_assumptions.extend(assumptions)
                all_exclusions.extend(exclusions)

            # Progress update
            update_job_status(
                job_id, "EXTRACTING", clear_lock=False,
                stage_progress={
                    "stage": "extracting",
                    "pages_processed": relevant_pages.index(page_num) + 1,
                    "total_pages": len(relevant_pages),
                    "items_found": len(all_items),
                },
            )

        doc.close()

    except Exception as e:
        logger.error("Extraction failed", job_id=job_id, error=str(e))
        raise

    # Deduplicate assumptions/exclusions
    all_assumptions = list(dict.fromkeys(all_assumptions))
    all_exclusions = list(dict.fromkeys(all_exclusions))

    # Update SSOT
    ssot["items"] = all_items
    ssot["assumptions"] = all_assumptions
    ssot["exclusions"] = all_exclusions

    # Create Measurement Tasks for items with missing dimensions
    measurement_tasks = []
    has_flags = False

    for item in all_items:
        for dim_key in ["width", "height", "depth"]:
            dim = item.get("dimensions", {}).get(dim_key, {})
            if dim.get("value") is None and dim_key != "depth":
                # Width and height are required; depth is optional for many configs
                task = {
                    "taskId": str(uuid.uuid4()),
                    "itemId": item["itemId"],
                    "dimensionKey": dim_key,
                    "status": "PENDING",
                    "pageNum": item["sourcePages"][0] if item["sourcePages"] else 0,
                    "calibration": None,
                    "measuredValue": None,
                    "measuredBy": None,
                    "measuredAt": None,
                }
                measurement_tasks.append(task)

                if "NEEDS_REVIEW" not in item["flags"]:
                    item["flags"].append("NEEDS_REVIEW")
                has_flags = True

    ssot["measurementTasks"] = measurement_tasks

    # Persist measurement tasks to DB
    try:
        with get_cursor() as (cur, conn):
            for task in measurement_tasks:
                cur.execute(
                    """
                    INSERT INTO measurement_tasks
                        (id, job_id, item_id, dimension_key, status, page_num, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        task["taskId"], job_id, task["itemId"],
                        task["dimensionKey"], task["status"], task["pageNum"],
                    ),
                )
            conn.commit()
    except Exception as e:
        logger.warning("Could not persist measurement tasks to DB", error=str(e))

    # Create measurement render requests for pages with tasks
    task_pages = set(t["pageNum"] for t in measurement_tasks)
    try:
        with get_cursor() as (cur, conn):
            for page_num in task_pages:
                cur.execute(
                    """
                    INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at)
                    VALUES (gen_random_uuid(), %s, %s, 'MEASURE', %s, 'PENDING', NOW())
                    ON CONFLICT (job_id, page_num, kind) DO NOTHING
                    """,
                    (job_id, page_num, config.PNG_MEASURE_DPI),
                )
            conn.commit()
    except Exception as e:
        logger.warning("Could not create measurement render requests", error=str(e))

    next_status = "NEEDS_REVIEW" if has_flags else "EXTRACTED"
    update_job_status(
        job_id, next_status,
        clear_lock=has_flags,  # Release lock if waiting for human review
        ssot=ssot,
        stage_progress={
            "stage": "extracting",
            "status": "complete",
            "items_found": len(all_items),
            "measurement_tasks": len(measurement_tasks),
        },
    )
    logger.info(
        "EXTRACTING complete",
        job_id=job_id,
        items=len(all_items),
        tasks=len(measurement_tasks),
        assumptions=len(all_assumptions),
        next_status=next_status,
    )
