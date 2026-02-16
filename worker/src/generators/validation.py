"""QA validation gate -- validates SSOT before PDF generation.

Checks: math correctness, range validity, consistency,
completeness, template mapping, and duplicate detection.
"""

import structlog

logger = structlog.get_logger()


class ValidationError:
    def __init__(self, code: str, message: str, item_id: str = None):
        self.code = code
        self.message = message
        self.item_id = item_id

    def to_dict(self):
        d = {"code": self.code, "message": self.message}
        if self.item_id:
            d["itemId"] = self.item_id
        return d


def validate_ssot_for_generation(ssot: dict) -> list[ValidationError]:
    """Run all QA validations. Returns list of errors (empty = pass)."""
    errors = []

    items = ssot.get("items", [])
    pricing = ssot.get("pricing", {})
    line_items = pricing.get("lineItems", [])

    # ─── Math check ──────────────────────────────────────────────
    computed_subtotal = sum(li.get("totalPrice", 0) for li in line_items)
    declared_subtotal = pricing.get("subtotal", 0)
    if abs(computed_subtotal - declared_subtotal) > 0.01:
        errors.append(ValidationError(
            "MATH_ERROR",
            f"Sum of line item totals ({computed_subtotal:.2f}) != declared subtotal ({declared_subtotal:.2f})",
        ))

    # ─── Range checks ────────────────────────────────────────────
    for item in items:
        item_id = item.get("itemId", "unknown")
        category = item.get("category", "")
        dims = item.get("dimensions", {})

        for dim_key in ["width", "height"]:
            dim = dims.get(dim_key, {})
            val = dim.get("value")
            if val is not None:
                if category == "SHOWER_ENCLOSURE":
                    if val < 6 or val > 240:
                        errors.append(ValidationError(
                            "RANGE_ERROR",
                            f"Shower {dim_key} ({val}\") out of range [6, 240]",
                            item_id,
                        ))
                elif category == "VANITY_MIRROR":
                    if val < 6 or val > 120:
                        errors.append(ValidationError(
                            "RANGE_ERROR",
                            f"Mirror {dim_key} ({val}\") out of range [6, 120]",
                            item_id,
                        ))

    # ─── Consistency: every item has a pricing line item ──────────
    item_ids = {item.get("itemId") for item in items}
    priced_ids = {li.get("itemId") for li in line_items}

    missing_pricing = item_ids - priced_ids
    for mid in missing_pricing:
        errors.append(ValidationError(
            "CONSISTENCY_ERROR",
            f"Item {mid} has no corresponding pricing line item",
            mid,
        ))

    orphan_pricing = priced_ids - item_ids
    for oid in orphan_pricing:
        errors.append(ValidationError(
            "CONSISTENCY_ERROR",
            f"Pricing line item {oid} has no corresponding item",
            oid,
        ))

    # ─── Completeness: no null dimensions unless flagged TBV ─────
    for item in items:
        item_id = item.get("itemId", "unknown")
        flags = item.get("flags", [])
        dims = item.get("dimensions", {})

        for dim_key in ["width", "height"]:
            dim = dims.get(dim_key, {})
            if dim.get("value") is None:
                if "TO_BE_VERIFIED_IN_FIELD" not in flags:
                    errors.append(ValidationError(
                        "COMPLETENESS_ERROR",
                        f"Item {item_id} has null {dim_key} without TBV flag",
                        item_id,
                    ))

    # ─── Template match ──────────────────────────────────────────
    for item in items:
        config = item.get("configuration", "")
        if config == "unknown" or not config:
            errors.append(ValidationError(
                "TEMPLATE_ERROR",
                f"Item {item.get('itemId')} has no configuration mapping",
                item.get("itemId"),
            ))

    # ─── Duplicate check ─────────────────────────────────────────
    seen = set()
    for item in items:
        key = (item.get("unitId"), item.get("location"), item.get("category"))
        qty = item.get("quantityPerUnit", 1)
        if key in seen and qty <= 1:
            errors.append(ValidationError(
                "DUPLICATE_WARNING",
                f"Possible duplicate: {key}",
                item.get("itemId"),
            ))
        seen.add(key)

    if errors:
        logger.warning(
            "SSOT validation failed",
            error_count=len(errors),
            errors=[e.to_dict() for e in errors],
        )
    else:
        logger.info("SSOT validation passed")

    return errors
