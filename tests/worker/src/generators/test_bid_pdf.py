"""Tests for Bid PDF generation (worker/src/generators/bid_pdf.py)."""

import os
import pytest
import fitz  # PyMuPDF


class TestGenerateBidPdf:
    """Functional tests for bid PDF generation from golden SSOT."""

    def test_generates_valid_pdf(self, golden_ssot, tmp_output_dir):
        from src.generators.bid_pdf import generate_bid_pdf

        output = os.path.join(tmp_output_dir, "bid.pdf")
        result = generate_bid_pdf(golden_ssot, output)

        assert result == output
        assert os.path.exists(output)
        assert os.path.getsize(output) > 0

    def test_pdf_has_multiple_pages(self, golden_ssot, tmp_output_dir):
        from src.generators.bid_pdf import generate_bid_pdf

        output = os.path.join(tmp_output_dir, "bid.pdf")
        generate_bid_pdf(golden_ssot, output)

        doc = fitz.open(output)
        assert len(doc) >= 4  # Cover + TOC + Content + Terms
        doc.close()

    def test_cover_page_contains_project_name(self, golden_ssot, tmp_output_dir):
        from src.generators.bid_pdf import generate_bid_pdf

        output = os.path.join(tmp_output_dir, "bid.pdf")
        generate_bid_pdf(golden_ssot, output)

        doc = fitz.open(output)
        cover_text = doc[0].get_text("text")
        assert "LUXURIUS GLASS" in cover_text
        assert "Marina Bay Residences" in cover_text
        doc.close()

    def test_pricing_total_appears(self, golden_ssot, tmp_output_dir):
        from src.generators.bid_pdf import generate_bid_pdf

        output = os.path.join(tmp_output_dir, "bid.pdf")
        generate_bid_pdf(golden_ssot, output)

        doc = fitz.open(output)
        all_text = ""
        for page in doc:
            all_text += page.get_text("text")
        doc.close()

        # $104,800.00 total should appear
        assert "104,800" in all_text

    def test_section_headers_present(self, golden_ssot, tmp_output_dir):
        from src.generators.bid_pdf import generate_bid_pdf

        output = os.path.join(tmp_output_dir, "bid.pdf")
        generate_bid_pdf(golden_ssot, output)

        doc = fitz.open(output)
        all_text = ""
        for page in doc:
            all_text += page.get_text("text")
        doc.close()

        assert "Executive Summary" in all_text
        assert "Scope of Work" in all_text
        assert "Pricing Breakdown" in all_text
        assert "Assumptions" in all_text

    def test_alternates_section_present(self, golden_ssot, tmp_output_dir):
        from src.generators.bid_pdf import generate_bid_pdf

        output = os.path.join(tmp_output_dir, "bid.pdf")
        generate_bid_pdf(golden_ssot, output)

        doc = fitz.open(output)
        all_text = ""
        for page in doc:
            all_text += page.get_text("text")
        doc.close()

        assert "Alternates" in all_text
        assert "ALT-1" in all_text

    def test_handles_empty_items_gracefully(self, golden_ssot, tmp_output_dir):
        from src.generators.bid_pdf import generate_bid_pdf
        import copy

        ssot = copy.deepcopy(golden_ssot)
        ssot["items"] = []
        ssot["pricing"]["lineItems"] = []
        ssot["pricing"]["subtotal"] = 0
        ssot["pricing"]["total"] = 0

        output = os.path.join(tmp_output_dir, "bid-empty.pdf")
        result = generate_bid_pdf(ssot, output)
        assert os.path.exists(result)
        assert os.path.getsize(result) > 0
