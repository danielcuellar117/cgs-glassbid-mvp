"""Tests for drawing utilities (worker/src/generators/drawing_utils.py)."""

import pytest
from src.generators.drawing_utils import format_dimension


class TestFormatDimension:
    """Test format_dimension conversion."""

    def test_none_returns_tbv(self):
        assert format_dimension(None) == "TBV"

    def test_12_inches_to_feet(self):
        assert format_dimension(12) == "1'-0\""

    def test_36_inches(self):
        assert format_dimension(36) == "3'-0\""

    def test_78_inches(self):
        assert format_dimension(78) == "6'-6\""

    def test_fractional_inches(self):
        result = format_dimension(36.5)
        assert result == "3'-0.5\""

    def test_less_than_12_whole(self):
        assert format_dimension(6) == '6"'

    def test_less_than_12_fractional(self):
        assert format_dimension(6.5) == '6.5"'

    def test_zero(self):
        assert format_dimension(0) == '0"'

    def test_24_inches(self):
        assert format_dimension(24) == "2'-0\""

    def test_11_inches(self):
        assert format_dimension(11) == '11"'

    def test_large_value(self):
        result = format_dimension(240)
        assert result == "20'-0\""
