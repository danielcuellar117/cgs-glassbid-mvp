"""Stage: PRICING -- apply pricing rules to extracted items.

Loads the active pricebook version, applies formula-based rules to all items,
computes line items with breakdowns, and snapshots the pricing into SSOT.
"""

import json
import uuid
from datetime import datetime, timezone

import structlog

from ..db import update_job_status, get_cursor

logger = structlog.get_logger()


def _get_active_pricebook():
    """Load the latest active pricebook version and its rules."""
    with get_cursor() as (cur, conn):
        cur.execute(
            """
            SELECT id, version, effective_date, notes
            FROM pricebook_versions
            ORDER BY version DESC
            LIMIT 1
            """
        )
        pricebook = cur.fetchone()
        if not pricebook:
            return None, []

        cur.execute(
            """
            SELECT id, name, category, formula_json, applies_to, is_active
            FROM pricing_rules
            WHERE pricebook_version_id = %s AND is_active = true
            """,
            (pricebook["id"],),
        )
        rules = cur.fetchall()
        return dict(pricebook), [dict(r) for r in rules]


def _evaluate_formula(formula: dict, item: dict) -> float:
    """Evaluate a simple pricing formula against an item.

    Supported formula types:
    - {"type": "unit_price", "unitPrice": 150.0}
    - {"type": "per_sqft", "rate": 25.0}
    - {"type": "fixed", "amount": 500.0}
    """
    formula_type = formula.get("type", "unit_price")

    if formula_type == "unit_price":
        return float(formula.get("unitPrice", 0))

    if formula_type == "per_sqft":
        rate = float(formula.get("rate", 0))
        dims = item.get("dimensions", {})
        width = dims.get("width", {}).get("value") or 0
        height = dims.get("height", {}).get("value") or 0
        sqft = (width * height) / 144.0  # inches to sqft
        return rate * sqft

    if formula_type == "fixed":
        return float(formula.get("amount", 0))

    return 0.0


def _rule_applies(rule: dict, item: dict) -> bool:
    """Check if a pricing rule applies to an item."""
    applies_to = rule.get("applies_to")
    if not applies_to:
        return True  # Universal rule

    # Check category match
    category = applies_to.get("category")
    if category and item.get("category") != category:
        return False

    # Check configuration match
    configuration = applies_to.get("configuration")
    if configuration and item.get("configuration") != configuration:
        return False

    return True


def _compute_breakdown(item: dict, unit_price: float, rules: list[dict]) -> dict:
    """Compute price breakdown (glass, hardware, labor, other)."""
    # Default split based on industry norms
    glass_pct = 0.40
    hardware_pct = 0.25
    labor_pct = 0.30
    other_pct = 0.05

    # Adjust based on category
    if item.get("category") == "VANITY_MIRROR":
        glass_pct = 0.55
        hardware_pct = 0.10
        labor_pct = 0.25
        other_pct = 0.10

    return {
        "glass": round(unit_price * glass_pct, 2),
        "hardware": round(unit_price * hardware_pct, 2),
        "labor": round(unit_price * labor_pct, 2),
        "other": round(unit_price * other_pct, 2),
    }


def run_pricing(job: dict) -> None:
    """Apply pricing rules to all items and compute totals.

    1. Load active pricebook version
    2. For each item, find matching rules and compute price
    3. Build line items with breakdowns
    4. Snapshot rules into SSOT
    """
    job_id = job["id"]
    logger.info("Starting PRICING stage", job_id=job_id)

    update_job_status(job_id, "PRICING", clear_lock=False)

    ssot = job.get("ssot", {})
    if isinstance(ssot, str):
        ssot = json.loads(ssot)

    items = ssot.get("items", [])

    # Load pricebook
    pricebook, rules = _get_active_pricebook()

    line_items = []
    subtotal = 0.0

    for item in items:
        item_id = item.get("itemId")
        category = item.get("category", "UNKNOWN")
        qty = item.get("quantityPerUnit", 1)

        # Check for manual override from previous pricing
        existing_line = None
        if ssot.get("pricing", {}).get("lineItems"):
            existing_line = next(
                (li for li in ssot["pricing"]["lineItems"]
                 if li.get("itemId") == item_id and li.get("manualOverride")),
                None,
            )

        if existing_line and existing_line.get("manualOverride"):
            # Preserve manual override
            line_items.append(existing_line)
            subtotal += float(existing_line.get("totalPrice", 0))
            continue

        # Find applicable rule
        unit_price = 0.0
        applied_rule = None

        if rules:
            for rule in rules:
                if _rule_applies(rule, item):
                    formula = rule.get("formula_json", {})
                    if isinstance(formula, str):
                        formula = json.loads(formula)
                    unit_price = _evaluate_formula(formula, item)
                    applied_rule = rule
                    break

        # If no rule found, use a default based on category
        if unit_price == 0 and not applied_rule:
            if category == "SHOWER_ENCLOSURE":
                # Estimate from dimensions
                dims = item.get("dimensions", {})
                w = dims.get("width", {}).get("value") or 36
                h = dims.get("height", {}).get("value") or 72
                sqft = (w * h) / 144.0
                unit_price = sqft * 45.0  # $45/sqft default
            elif category == "VANITY_MIRROR":
                dims = item.get("dimensions", {})
                w = dims.get("width", {}).get("value") or 30
                h = dims.get("height", {}).get("value") or 36
                sqft = (w * h) / 144.0
                unit_price = sqft * 35.0  # $35/sqft default

        total_price = round(unit_price * qty, 2)
        breakdown = _compute_breakdown(item, unit_price, rules)

        # Build description
        config = item.get("configuration", "").replace("-", " ").title()
        location = item.get("location", "")
        desc_parts = [category.replace("_", " ").title()]
        if config:
            desc_parts.append(f"({config})")
        if location:
            desc_parts.append(f"at {location}")

        line_item = {
            "itemId": item_id,
            "description": " ".join(desc_parts),
            "unitPrice": round(unit_price, 2),
            "quantity": qty,
            "totalPrice": total_price,
            "breakdown": breakdown,
            "manualOverride": False,
            "overrideReason": None,
        }
        line_items.append(line_item)
        subtotal += total_price

    # Compute totals
    tax_rate = 0.0  # Tax can be configured later
    tax = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax, 2)

    # Snapshot pricing into SSOT
    pricing = {
        "pricebookVersionId": pricebook["id"] if pricebook else None,
        "pricebookSnapshotDate": (
            pricebook["effective_date"].isoformat() if pricebook and pricebook.get("effective_date") else None
        ),
        "rules": [
            {
                "ruleId": r["id"],
                "name": r["name"],
                "category": r["category"],
                "formula": r["formula_json"],
                "appliesTo": r["applies_to"],
            }
            for r in rules
        ] if rules else [],
        "lineItems": line_items,
        "subtotal": round(subtotal, 2),
        "tax": round(tax, 2),
        "total": round(total, 2),
    }

    ssot["pricing"] = pricing

    update_job_status(
        job_id, "PRICED", clear_lock=False, ssot=ssot,
        stage_progress={
            "stage": "pricing",
            "status": "complete",
            "line_items": len(line_items),
            "total": total,
        },
    )
    logger.info(
        "PRICING complete",
        job_id=job_id,
        line_items=len(line_items),
        subtotal=subtotal,
        total=total,
    )
