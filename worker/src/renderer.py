"""PNG renderer for PDF pages using PyMuPDF.

Handles both thumbnail and measurement-quality renders with
pixel clamping and file size guardrails.
"""

import os
import json
import io

import fitz  # PyMuPDF
import structlog

from . import config
from .db import (
    complete_render_request,
    fail_render_request,
    get_cursor,
)
from .storage import download_file, upload_bytes

logger = structlog.get_logger()

MAX_PNG_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def _get_source_pdf_path(job_id: str, project_id: str = None) -> str:
    """Get or download the source PDF to local temp."""
    temp_dir = os.path.join(config.TEMP_DIR, job_id)
    local_pdf = os.path.join(temp_dir, "source.pdf")

    if os.path.exists(local_pdf):
        return local_pdf

    # Look up storage_objects for the actual key
    source_key = None
    try:
        with get_cursor() as (cur, conn):
            cur.execute(
                """
                SELECT key FROM storage_objects
                WHERE job_id = %s AND bucket = 'raw-uploads'
                LIMIT 1
                """,
                (job_id,),
            )
            row = cur.fetchone()
            if row:
                source_key = row["key"]
    except Exception:
        pass

    if not source_key:
        # Fallback: try to find project_id from jobs table
        if not project_id:
            try:
                with get_cursor() as (cur, conn):
                    cur.execute(
                        "SELECT project_id FROM jobs WHERE id = %s", (job_id,)
                    )
                    row = cur.fetchone()
                    if row:
                        project_id = row["project_id"]
            except Exception:
                pass
        source_key = f"{project_id}/{job_id}/source.pdf"

    os.makedirs(temp_dir, exist_ok=True)
    download_file(config.BUCKET_RAW_UPLOADS, source_key, local_pdf)
    return local_pdf


def _clamp_dpi(page_width_pts: float, page_height_pts: float, requested_dpi: int) -> int:
    """Clamp DPI so the resulting image stays within MAX_RENDER_PIXELS.

    PyMuPDF uses 72 DPI as its base (1 point = 1/72 inch).
    At `dpi`, the image will be (width_pts/72 * dpi) x (height_pts/72 * dpi) pixels.
    """
    max_pixels = config.MAX_RENDER_PIXELS
    max_dpi = config.MAX_RENDER_DPI

    dpi = min(requested_dpi, max_dpi)

    width_px = page_width_pts / 72.0 * dpi
    height_px = page_height_pts / 72.0 * dpi
    longest = max(width_px, height_px)

    if longest > max_pixels:
        scale_factor = max_pixels / longest
        dpi = int(dpi * scale_factor)
        logger.info(
            "DPI clamped",
            requested=requested_dpi, clamped=dpi,
            max_pixels=max_pixels,
        )

    return max(dpi, 36)  # Minimum sensible DPI


def render_page_to_png(
    job_id: str,
    page_num: int,
    dpi: int,
    kind: str,
) -> bytes:
    """Render a single PDF page to PNG bytes.

    Returns PNG bytes. Falls back to JPEG if PNG exceeds 10 MB.
    """
    local_pdf = _get_source_pdf_path(job_id)
    doc = fitz.open(local_pdf)

    try:
        if page_num >= len(doc):
            raise ValueError(f"Page {page_num} out of range (total: {len(doc)})")

        page = doc[page_num]

        # Clamp DPI based on page dimensions
        actual_dpi = _clamp_dpi(page.rect.width, page.rect.height, dpi)
        zoom = actual_dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)

        pix = page.get_pixmap(matrix=mat, alpha=False)
        png_bytes = pix.tobytes("png")

        # File size guard: if PNG > 10 MB, fall back to JPEG
        if len(png_bytes) > MAX_PNG_SIZE_BYTES:
            logger.warning(
                "PNG too large, falling back to JPEG",
                size=len(png_bytes), page=page_num, dpi=actual_dpi,
            )
            png_bytes = pix.tobytes("jpeg")

        logger.info(
            "Rendered page",
            job_id=job_id, page=page_num, dpi=actual_dpi,
            kind=kind, size=len(png_bytes),
        )
        return png_bytes

    finally:
        doc.close()


def process_render_request(render_req: dict) -> None:
    """Process a single render request: render PDF page to PNG, upload to MinIO."""
    req_id = render_req["id"]
    job_id = render_req["job_id"]
    page_num = render_req["page_num"]
    kind = render_req["kind"]
    dpi = render_req.get("dpi", config.PNG_THUMB_DPI if kind == "THUMB" else config.PNG_MEASURE_DPI)

    logger.info(
        "Processing render request",
        req_id=req_id, job_id=job_id, page_num=page_num, kind=kind, dpi=dpi,
    )

    try:
        png_bytes = render_page_to_png(job_id, page_num, dpi, kind)

        # Determine output key and content type
        prefix = "thumb" if kind == "THUMB" else "measure"

        # Check if fell back to JPEG
        is_jpeg = len(png_bytes) > 0 and png_bytes[0:3] == b"\xff\xd8\xff"
        ext = "jpg" if is_jpeg else "png"
        content_type = "image/jpeg" if is_jpeg else "image/png"

        output_key = f"{job_id}/{prefix}-{page_num:04d}.{ext}"

        # Upload to MinIO page-cache bucket
        upload_bytes(
            config.BUCKET_PAGE_CACHE,
            output_key,
            png_bytes,
            content_type=content_type,
        )

        complete_render_request(req_id, output_key)
        logger.info("Render request complete", req_id=req_id, output_key=output_key)

    except Exception as e:
        logger.error("Render request failed", req_id=req_id, error=str(e))
        fail_render_request(req_id)
