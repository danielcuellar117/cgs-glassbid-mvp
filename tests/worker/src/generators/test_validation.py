"""Tests for SSOT validation gate (worker/src/generators/validation.py)."""

import copy
import pytest
from src.generators.validation import validate_ssot_for_generation, ValidationError


class TestMathError:
    """MATH_ERROR: sum(lineItem.totalPrice) must equal pricing.subtotal."""

    def test_golden_ssot_passes(self, golden_ssot):
        errors = validate_ssot_for_generation(golden_ssot)
        math_errors = [e for e in errors if e.code == "MATH_ERROR"]
        assert len(math_errors) == 0

    def test_mismatched_subtotal_triggers_math_error(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["pricing"]["subtotal"] = 99999.99
        errors = validate_ssot_for_generation(ssot)
        math_errors = [e for e in errors if e.code == "MATH_ERROR"]
        assert len(math_errors) == 1
        assert "99999.99" in math_errors[0].message

    def test_empty_line_items_with_zero_subtotal_passes(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["pricing"]["lineItems"] = []
        ssot["pricing"]["subtotal"] = 0
        ssot["items"] = []
        errors = validate_ssot_for_generation(ssot)
        math_errors = [e for e in errors if e.code == "MATH_ERROR"]
        assert len(math_errors) == 0


class TestRangeWarning:
    """RANGE_WARNING: shower dims [6,240], mirror dims [6,120]."""

    def test_golden_ssot_has_no_range_warnings(self, golden_ssot):
        errors = validate_ssot_for_generation(golden_ssot)
        range_errors = [e for e in errors if e.code == "RANGE_WARNING"]
        assert len(range_errors) == 0

    def test_shower_width_below_minimum(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["items"][0]["dimensions"]["width"]["value"] = 5
        errors = validate_ssot_for_generation(ssot)
        range_errors = [e for e in errors if e.code == "RANGE_WARNING"]
        assert any("width" in e.message and "5" in e.message for e in range_errors)

    def test_shower_width_at_boundary_passes(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["items"][0]["dimensions"]["width"]["value"] = 6
        ssot["items"][0]["dimensions"]["height"]["value"] = 240
        errors = validate_ssot_for_generation(ssot)
        range_errors = [e for e in errors if e.code == "RANGE_WARNING" and e.item_id == "item-001"]
        assert len(range_errors) == 0

    def test_shower_above_max(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["items"][0]["dimensions"]["height"]["value"] = 241
        errors = validate_ssot_for_generation(ssot)
        range_errors = [e for e in errors if e.code == "RANGE_WARNING" and "241" in e.message]
        assert len(range_errors) == 1

    def test_mirror_above_120(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        # item-004 is a VANITY_MIRROR
        ssot["items"][3]["dimensions"]["width"]["value"] = 121
        errors = validate_ssot_for_generation(ssot)
        range_errors = [e for e in errors if e.code == "RANGE_WARNING" and e.item_id == "item-004"]
        assert len(range_errors) == 1


class TestConsistencyError:
    """CONSISTENCY_ERROR: every item has a pricing line item and vice versa."""

    def test_golden_ssot_is_consistent(self, golden_ssot):
        errors = validate_ssot_for_generation(golden_ssot)
        cons_errors = [e for e in errors if e.code == "CONSISTENCY_ERROR"]
        assert len(cons_errors) == 0

    def test_orphan_item_missing_pricing(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["items"].append({
            "itemId": "orphan-item",
            "category": "SHOWER_ENCLOSURE",
            "configuration": "inline-panel-door",
            "dimensions": {"width": {"value": 36}, "height": {"value": 78}},
            "flags": [],
        })
        errors = validate_ssot_for_generation(ssot)
        cons_errors = [e for e in errors if e.code == "CONSISTENCY_ERROR"]
        assert any("orphan-item" in e.message for e in cons_errors)

    def test_orphan_pricing_line_item(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["pricing"]["lineItems"].append({
            "itemId": "ghost-item",
            "totalPrice": 500,
        })
        # Adjust subtotal to avoid MATH_ERROR
        ssot["pricing"]["subtotal"] += 500
        errors = validate_ssot_for_generation(ssot)
        cons_errors = [e for e in errors if e.code == "CONSISTENCY_ERROR"]
        assert any("ghost-item" in e.message for e in cons_errors)


class TestCompletenessError:
    """COMPLETENESS_ERROR: null dimensions without TBV flag."""

    def test_null_dim_without_tbv_flag(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["items"][0]["dimensions"]["width"]["value"] = None
        ssot["items"][0]["flags"] = []
        errors = validate_ssot_for_generation(ssot)
        comp_errors = [e for e in errors if e.code == "COMPLETENESS_ERROR" and e.item_id == "item-001"]
        assert len(comp_errors) == 1

    def test_null_dim_with_tbv_flag_passes(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        ssot["items"][0]["dimensions"]["width"]["value"] = None
        ssot["items"][0]["flags"] = ["TO_BE_VERIFIED_IN_FIELD"]
        errors = validate_ssot_for_generation(ssot)
        comp_errors = [e for e in errors if e.code == "COMPLETENESS_ERROR" and e.item_id == "item-001"]
        assert len(comp_errors) == 0


class TestDuplicateWarning:
    """DUPLICATE_WARNING: same (unitId, location, category) with qty <= 1."""

    def test_golden_ssot_no_duplicates(self, golden_ssot):
        errors = validate_ssot_for_generation(golden_ssot)
        dup_errors = [e for e in errors if e.code == "DUPLICATE_WARNING"]
        assert len(dup_errors) == 0

    def test_duplicate_detected(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        dup = copy.deepcopy(ssot["items"][0])
        dup["itemId"] = "dup-item"
        ssot["items"].append(dup)
        # Add matching pricing to avoid CONSISTENCY_ERROR
        ssot["pricing"]["lineItems"].append({
            "itemId": "dup-item",
            "totalPrice": ssot["pricing"]["lineItems"][0]["totalPrice"],
        })
        ssot["pricing"]["subtotal"] += ssot["pricing"]["lineItems"][0]["totalPrice"]
        errors = validate_ssot_for_generation(ssot)
        dup_errors = [e for e in errors if e.code == "DUPLICATE_WARNING"]
        assert len(dup_errors) >= 1

    def test_qty_greater_1_not_flagged(self, golden_ssot):
        ssot = copy.deepcopy(golden_ssot)
        dup = copy.deepcopy(ssot["items"][0])
        dup["itemId"] = "dup-item"
        dup["quantityPerUnit"] = 5
        ssot["items"].append(dup)
        ssot["pricing"]["lineItems"].append({
            "itemId": "dup-item",
            "totalPrice": ssot["pricing"]["lineItems"][0]["totalPrice"],
        })
        ssot["pricing"]["subtotal"] += ssot["pricing"]["lineItems"][0]["totalPrice"]
        errors = validate_ssot_for_generation(ssot)
        dup_errors = [e for e in errors if e.code == "DUPLICATE_WARNING"]
        # The duplicate at qty > 1 should still be flagged because
        # the first item has qty=1 and they share the same key.
        # But the second check sees the key already in `seen`.
        # Actually: the code checks `if key in seen and qty <= 1`,
        # so qty=5 item won't be flagged.
        assert all(e.item_id != "dup-item" for e in dup_errors)
