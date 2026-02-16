"""Tests for page indexing (worker/src/pipeline/index.py)."""

import pytest
from src.pipeline.index import classify_page, detect_relevance


class TestClassifyPage:
    """Test classify_page keyword-based classification."""

    def test_title_on_first_page(self):
        text = "Cover Sheet - Drawing Index"
        cls, conf = classify_page(text, page_num=0, total_pages=50)
        assert cls == "TITLE"
        assert conf >= 0.4

    def test_title_on_second_page(self):
        text = "Sheet Index - Table of Contents"
        cls, conf = classify_page(text, page_num=1, total_pages=50)
        assert cls == "TITLE"

    def test_title_keyword_not_on_first_pages(self):
        text = "Cover Sheet"
        cls, conf = classify_page(text, page_num=10, total_pages=50)
        # Not on page 0-1, so TITLE heuristic doesn't apply.
        # Still could match if keywords score highest.
        assert cls in ("TITLE", "IRRELEVANT")

    def test_floor_plan(self):
        text = "Floor Plan - Level 3 Layout"
        cls, conf = classify_page(text, page_num=5, total_pages=50)
        assert cls == "FLOOR_PLAN"
        assert conf >= 0.4

    def test_elevation(self):
        text = "Interior Elevation - Master Bath"
        cls, conf = classify_page(text, page_num=10, total_pages=50)
        assert cls == "ELEVATION"

    def test_schedule(self):
        text = "Glass Schedule - Door Schedule Reference"
        cls, conf = classify_page(text, page_num=15, total_pages=50)
        assert cls == "SCHEDULE"

    def test_detail(self):
        text = "Typical Detail - Shower Detail SD-5 Enlarged"
        cls, conf = classify_page(text, page_num=20, total_pages=50)
        assert cls == "DETAIL"

    def test_notes(self):
        text = "General Notes and Specifications"
        cls, conf = classify_page(text, page_num=25, total_pages=50)
        assert cls == "NOTES"

    def test_irrelevant_page(self):
        # Pure noise text with no matching classification keywords
        text = "This page is intentionally blank for printing purposes"
        cls, conf = classify_page(text, page_num=30, total_pages=50)
        assert cls == "IRRELEVANT"
        assert conf == 0.3

    def test_confidence_capped_at_095(self):
        # Even with many matches, confidence should not exceed 0.95
        text = " ".join([
            "floor plan", "plan view", "layout", "unit plan",
            "reflected ceiling", "furniture plan",
        ])
        cls, conf = classify_page(text, page_num=5, total_pages=50)
        assert conf <= 0.95

    def test_low_score_falls_to_irrelevant(self):
        text = "Page intentionally left blank"
        cls, conf = classify_page(text, page_num=40, total_pages=50)
        assert cls == "IRRELEVANT"


class TestDetectRelevance:
    """Test detect_relevance keyword matching."""

    def test_shower_keywords(self):
        relevant = detect_relevance("Frameless shower enclosure detail")
        assert "showers" in relevant

    def test_mirror_keywords(self):
        relevant = detect_relevance("Vanity mirror specification")
        assert "mirrors" in relevant

    def test_assumptions_keywords(self):
        relevant = detect_relevance("General notes and assumptions section")
        assert "assumptions" in relevant

    def test_multiple_categories(self):
        relevant = detect_relevance("Shower enclosure and vanity mirror schedule with assumptions")
        assert "showers" in relevant
        assert "mirrors" in relevant
        assert "assumptions" in relevant

    def test_no_matches(self):
        relevant = detect_relevance("HVAC ductwork riser diagram")
        assert relevant == []

    def test_case_insensitive(self):
        relevant = detect_relevance("SHOWER ENCLOSURE SPECIFICATION")
        assert "showers" in relevant
