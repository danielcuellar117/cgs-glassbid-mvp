"""Stage: GENERATING -- produce Bid PDF + Shop Drawings PDF.

Runs QA validation, then generates both PDFs via ReportLab,
uploads them to MinIO, and records in SSOT.
"""

import os
import json
import uuid
import hashlib
from datetime import datetime, timezone

import structlog

from .. import config
from ..db import update_job_status, get_cursor
from ..storage import upload_file
from ..generators.validation import validate_ssot_for_generation
from ..generators.bid_pdf import generate_bid_pdf

logger = structlog.get_logger()


def _compute_sha256(file_path: str) -> str:
    """Compute SHA256 hash of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def run_generation(job: dict) -> None:
    """Generate Bid PDF and Shop Drawings PDF from SSOT.

    1. Run QA validation
    2. Generate Bid PDF via ReportLab
    3. Generate Shop Drawings PDF (Phase 5; placeholder for now)
    4. Upload to MinIO
    5. Record outputs in SSOT
    """
    job_id = job["id"]
    project_id = job.get("project_id")
    logger.info("Starting GENERATING stage", job_id=job_id)

    update_job_status(job_id, "GENERATING", clear_lock=False)

    ssot = job.get("ssot", {})
    if isinstance(ssot, str):
        ssot = json.loads(ssot)

    # ─── QA Validation Gate ──────────────────────────────────────
    errors = validate_ssot_for_generation(ssot)

    # Filter out warnings (non-blocking)
    blocking_errors = [e for e in errors if "WARNING" not in e.code]

    if blocking_errors:
        error_list = [e.to_dict() for e in blocking_errors]
        logger.warning(
            "Generation blocked by validation errors",
            job_id=job_id, errors=error_list,
        )
        update_job_status(
            job_id, "PRICED",  # Revert to PRICED so user can fix issues
            error_message=f"Validation failed: {len(blocking_errors)} error(s)",
            error_code="VALIDATION_ERROR",
            ssot=ssot,
            stage_progress={
                "stage": "generating",
                "status": "validation_failed",
                "errors": error_list,
            },
        )
        return

    # ─── Determine version ───────────────────────────────────────
    existing_outputs = ssot.get("outputs", [])
    bid_version = 1
    shop_version = 1
    for out in existing_outputs:
        if out.get("type") == "BID_PDF":
            bid_version = max(bid_version, out.get("version", 0) + 1)
        if out.get("type") == "SHOP_DRAWINGS_PDF":
            shop_version = max(shop_version, out.get("version", 0) + 1)

    temp_dir = os.path.join(config.TEMP_DIR, job_id)
    os.makedirs(temp_dir, exist_ok=True)

    # ─── Generate Bid PDF ────────────────────────────────────────
    bid_filename = f"bid-v{bid_version}.pdf"
    bid_local_path = os.path.join(temp_dir, bid_filename)
    bid_minio_key = f"{project_id}/{job_id}/{bid_filename}"

    try:
        generate_bid_pdf(ssot, bid_local_path)
        bid_sha256 = _compute_sha256(bid_local_path)
        bid_size = os.path.getsize(bid_local_path)

        upload_file(
            config.BUCKET_OUTPUTS, bid_minio_key, bid_local_path,
            content_type="application/pdf",
        )

        bid_output = {
            "outputId": str(uuid.uuid4()),
            "type": "BID_PDF",
            "version": bid_version,
            "bucket": config.BUCKET_OUTPUTS,
            "key": bid_minio_key,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sha256": bid_sha256,
        }

        # Register in storage_objects
        try:
            with get_cursor() as (cur, conn):
                cur.execute(
                    """
                    INSERT INTO storage_objects
                        (id, job_id, bucket, key, size_bytes, sha256, content_type, ttl_policy, expires_at, created_at)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, 'application/pdf', '30d', NOW() + INTERVAL '30 days', NOW())
                    """,
                    (job_id, config.BUCKET_OUTPUTS, bid_minio_key, bid_size, bid_sha256),
                )
                conn.commit()
        except Exception as e:
            logger.warning("Could not register storage object", error=str(e))

        logger.info("Bid PDF generated", job_id=job_id, key=bid_minio_key)

    except Exception as e:
        logger.error("Bid PDF generation failed", job_id=job_id, error=str(e))
        raise

    # ─── Generate Shop Drawings PDF (Phase 5 placeholder) ────────
    # Will be implemented in Phase 5 with ReportLab templates
    shop_output = None
    try:
        from ..generators.shop_drawings_pdf import generate_shop_drawings_pdf

        shop_filename = f"shop-drawings-v{shop_version}.pdf"
        shop_local_path = os.path.join(temp_dir, shop_filename)
        shop_minio_key = f"{project_id}/{job_id}/{shop_filename}"

        generate_shop_drawings_pdf(ssot, shop_local_path)
        shop_sha256 = _compute_sha256(shop_local_path)
        shop_size = os.path.getsize(shop_local_path)

        upload_file(
            config.BUCKET_OUTPUTS, shop_minio_key, shop_local_path,
            content_type="application/pdf",
        )

        shop_output = {
            "outputId": str(uuid.uuid4()),
            "type": "SHOP_DRAWINGS_PDF",
            "version": shop_version,
            "bucket": config.BUCKET_OUTPUTS,
            "key": shop_minio_key,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sha256": shop_sha256,
        }

        try:
            with get_cursor() as (cur, conn):
                cur.execute(
                    """
                    INSERT INTO storage_objects
                        (id, job_id, bucket, key, size_bytes, sha256, content_type, ttl_policy, expires_at, created_at)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, 'application/pdf', '30d', NOW() + INTERVAL '30 days', NOW())
                    """,
                    (job_id, config.BUCKET_OUTPUTS, shop_minio_key, shop_size, shop_sha256),
                )
                conn.commit()
        except Exception as e:
            logger.warning("Could not register shop drawings storage object", error=str(e))

        logger.info("Shop Drawings PDF generated", job_id=job_id, key=shop_minio_key)

    except ImportError:
        logger.info("Shop Drawings generator not yet implemented (Phase 5)")
    except Exception as e:
        logger.warning("Shop Drawings generation failed (non-blocking)", error=str(e))

    # ─── Update SSOT outputs ─────────────────────────────────────
    outputs = [o for o in existing_outputs if o.get("type") not in ("BID_PDF", "SHOP_DRAWINGS_PDF")]
    outputs.append(bid_output)
    if shop_output:
        outputs.append(shop_output)
    ssot["outputs"] = outputs

    update_job_status(
        job_id, "DONE", ssot=ssot,
        stage_progress={
            "stage": "generating",
            "status": "complete",
            "outputs": [bid_minio_key] + ([shop_output["key"]] if shop_output else []),
        },
    )
    logger.info("GENERATING complete -- job DONE", job_id=job_id)
