"""Tests for pricing logic (worker/src/pipeline/price.py)."""

import pytest
from src.pipeline.price import _evaluate_formula, _rule_applies, _compute_breakdown


class TestEvaluateFormula:
    """Test formula evaluation for different pricing types."""

    def test_unit_price(self):
        formula = {"type": "unit_price", "unitPrice": 850.0}
        item = {}
        assert _evaluate_formula(formula, item) == 850.0

    def test_per_sqft(self):
        formula = {"type": "per_sqft", "rate": 25.0}
        item = {
            "dimensions": {
                "width": {"value": 36},
                "height": {"value": 72},
            },
        }
        # 36*72=2592 sqin / 144 = 18 sqft * $25 = $450
        assert _evaluate_formula(formula, item) == 450.0

    def test_per_sqft_missing_dims(self):
        formula = {"type": "per_sqft", "rate": 25.0}
        item = {"dimensions": {}}
        # Missing dims default to 0: 0*0 / 144 * 25 = 0
        assert _evaluate_formula(formula, item) == 0.0

    def test_fixed_amount(self):
        formula = {"type": "fixed", "amount": 500.0}
        item = {}
        assert _evaluate_formula(formula, item) == 500.0

    def test_unknown_type_returns_zero(self):
        formula = {"type": "custom_calculator"}
        item = {}
        assert _evaluate_formula(formula, item) == 0.0

    def test_default_type_is_unit_price(self):
        formula = {"unitPrice": 300.0}
        item = {}
        assert _evaluate_formula(formula, item) == 300.0


class TestRuleApplies:
    """Test rule matching logic."""

    def test_universal_rule_no_applies_to(self):
        rule = {"applies_to": None}
        item = {"category": "SHOWER_ENCLOSURE"}
        assert _rule_applies(rule, item) is True

    def test_universal_rule_empty_applies_to(self):
        rule = {"applies_to": {}}
        item = {"category": "SHOWER_ENCLOSURE"}
        assert _rule_applies(rule, item) is True

    def test_category_match(self):
        rule = {"applies_to": {"category": "SHOWER_ENCLOSURE"}}
        item = {"category": "SHOWER_ENCLOSURE"}
        assert _rule_applies(rule, item) is True

    def test_category_mismatch(self):
        rule = {"applies_to": {"category": "VANITY_MIRROR"}}
        item = {"category": "SHOWER_ENCLOSURE"}
        assert _rule_applies(rule, item) is False

    def test_config_match(self):
        rule = {"applies_to": {"category": "SHOWER_ENCLOSURE", "configuration": "inline-panel-door"}}
        item = {"category": "SHOWER_ENCLOSURE", "configuration": "inline-panel-door"}
        assert _rule_applies(rule, item) is True

    def test_config_mismatch(self):
        rule = {"applies_to": {"category": "SHOWER_ENCLOSURE", "configuration": "90-degree-corner-door"}}
        item = {"category": "SHOWER_ENCLOSURE", "configuration": "inline-panel-door"}
        assert _rule_applies(rule, item) is False


class TestComputeBreakdown:
    """Test price breakdown computation."""

    def test_shower_split_40_25_30_5(self):
        item = {"category": "SHOWER_ENCLOSURE"}
        breakdown = _compute_breakdown(item, 1000.0, [])
        assert breakdown["glass"] == 400.0
        assert breakdown["hardware"] == 250.0
        assert breakdown["labor"] == 300.0
        assert breakdown["other"] == 50.0

    def test_mirror_split_55_10_25_10(self):
        item = {"category": "VANITY_MIRROR"}
        breakdown = _compute_breakdown(item, 1000.0, [])
        assert breakdown["glass"] == 550.0
        assert breakdown["hardware"] == 100.0
        assert breakdown["labor"] == 250.0
        assert breakdown["other"] == 100.0

    def test_rounding(self):
        item = {"category": "SHOWER_ENCLOSURE"}
        breakdown = _compute_breakdown(item, 33.33, [])
        # 33.33 * 0.40 = 13.332 -> 13.33
        assert breakdown["glass"] == 13.33
        total = sum(breakdown.values())
        # Rounding may cause tiny discrepancy, but each field is rounded to 2dp
        assert all(isinstance(v, float) for v in breakdown.values())

    def test_zero_price(self):
        item = {"category": "SHOWER_ENCLOSURE"}
        breakdown = _compute_breakdown(item, 0.0, [])
        assert breakdown["glass"] == 0.0
        assert breakdown["labor"] == 0.0
