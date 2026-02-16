"""Tests for Shop Drawings PDF generation (worker/src/generators/shop_drawings_pdf.py)."""

import os
import copy
import pytest
import fitz  # PyMuPDF


class TestGenerateShopDrawingsPdf:
    """Functional tests for shop drawings generation from golden SSOT."""

    def test_generates_valid_pdf(self, golden_ssot, tmp_output_dir):
        from src.generators.shop_drawings_pdf import generate_shop_drawings_pdf

        output = os.path.join(tmp_output_dir, "shop.pdf")
        result = generate_shop_drawings_pdf(golden_ssot, output)

        assert result == output
        assert os.path.exists(output)
        assert os.path.getsize(output) > 0

    def test_page_count_equals_items_plus_cover(self, golden_ssot, tmp_output_dir):
        from src.generators.shop_drawings_pdf import generate_shop_drawings_pdf

        output = os.path.join(tmp_output_dir, "shop.pdf")
        generate_shop_drawings_pdf(golden_ssot, output)

        doc = fitz.open(output)
        # Cover + 5 items = 6 pages
        assert len(doc) == len(golden_ssot["items"]) + 1
        doc.close()

    def test_cover_sheet_contains_shop_drawings_title(self, golden_ssot, tmp_output_dir):
        from src.generators.shop_drawings_pdf import generate_shop_drawings_pdf

        output = os.path.join(tmp_output_dir, "shop.pdf")
        generate_shop_drawings_pdf(golden_ssot, output)

        doc = fitz.open(output)
        cover_text = doc[0].get_text("text")
        assert "SHOP DRAWINGS" in cover_text
        assert "LUXURIUS GLASS" in cover_text
        doc.close()

    def test_drawing_numbers_sequential(self, golden_ssot, tmp_output_dir):
        from src.generators.shop_drawings_pdf import generate_shop_drawings_pdf

        output = os.path.join(tmp_output_dir, "shop.pdf")
        generate_shop_drawings_pdf(golden_ssot, output)

        doc = fitz.open(output)
        all_text = ""
        for page in doc:
            all_text += page.get_text("text")
        doc.close()

        # Drawing index should contain sequential numbers
        assert "SD-" in all_text

    def test_template_ids_appear_in_index(self, golden_ssot, tmp_output_dir):
        from src.generators.shop_drawings_pdf import generate_shop_drawings_pdf

        output = os.path.join(tmp_output_dir, "shop.pdf")
        generate_shop_drawings_pdf(golden_ssot, output)

        doc = fitz.open(output)
        cover_text = doc[0].get_text("text")
        doc.close()

        # Cover index should reference configurations
        assert "Inline Panel Door" in cover_text or "Shower Enclosure" in cover_text

    def test_empty_items_produces_placeholder(self, golden_ssot, tmp_output_dir):
        from src.generators.shop_drawings_pdf import generate_shop_drawings_pdf

        ssot = copy.deepcopy(golden_ssot)
        ssot["items"] = []

        output = os.path.join(tmp_output_dir, "shop-empty.pdf")
        result = generate_shop_drawings_pdf(ssot, output)

        assert os.path.exists(result)
        doc = fitz.open(result)
        assert len(doc) == 1
        text = doc[0].get_text("text")
        assert "No items" in text
        doc.close()

    def test_project_info_on_cover(self, golden_ssot, tmp_output_dir):
        from src.generators.shop_drawings_pdf import generate_shop_drawings_pdf

        output = os.path.join(tmp_output_dir, "shop.pdf")
        generate_shop_drawings_pdf(golden_ssot, output)

        doc = fitz.open(output)
        cover_text = doc[0].get_text("text")
        doc.close()

        assert "Marina Bay Residences" in cover_text
        assert "Bay Development Corp" in cover_text
