"""Shared pytest fixtures for the entire test suite.

Provides:
- Golden SSOT JSON loader
- Synthetic vector PDF generator (ReportLab)
- Temp directory management
- UTC timezone pinning
"""

import json
import os
import tempfile

import pytest

FIXTURES_DIR = os.path.dirname(os.path.abspath(__file__))
GOLDEN_SSOT_PATH = os.path.join(FIXTURES_DIR, "golden-ssot.json")


@pytest.fixture(autouse=True)
def _pin_utc(monkeypatch):
    """Pin timezone to UTC for deterministic tests."""
    monkeypatch.setenv("TZ", "UTC")


@pytest.fixture
def golden_ssot() -> dict:
    """Load the golden SSOT fixture."""
    with open(GOLDEN_SSOT_PATH) as f:
        return json.load(f)


@pytest.fixture
def golden_ssot_path() -> str:
    """Return the path to the golden SSOT fixture file."""
    return GOLDEN_SSOT_PATH


@pytest.fixture
def tmp_output_dir(tmp_path):
    """Provide a temporary output directory for generated files."""
    out = tmp_path / "output"
    out.mkdir()
    return str(out)


@pytest.fixture
def synthetic_pdf_path(tmp_path) -> str:
    """Generate a small synthetic multi-page PDF for testing.

    Pages:
      0: Title page with 'GLASS BID SET', 'cover sheet'
      1: Floor plan with 'shower', 'master bath', 'floor plan'
      2: Schedule with dimension callouts '36" x 78"' and 'SHOWER ENCLOSURE'
      3: Notes page with 'ASSUMPTIONS:' and 'EXCLUSIONS:' sections
      4: Detail page with 'shower detail', '1/2 low iron'
      5: Irrelevant filler page
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen.canvas import Canvas

    pdf_path = str(tmp_path / "synthetic-test.pdf")
    c = Canvas(pdf_path, pagesize=letter)
    W, H = letter

    # Page 0: Title / Cover Sheet
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(W / 2, H - 200, "GLASS BID SET")
    c.setFont("Helvetica", 14)
    c.drawCentredString(W / 2, H - 240, "Cover Sheet")
    c.drawCentredString(W / 2, H - 270, "Marina Bay Residences - Tower A")
    c.drawCentredString(W / 2, H - 300, "Sheet Index")
    c.showPage()

    # Page 1: Floor Plan
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "FLOOR PLAN - LEVEL 3")
    c.setFont("Helvetica", 11)
    c.drawString(72, H - 120, "Unit Plan - Type A - 2BR/2BA")
    c.drawString(72, H - 145, "Master Bath: frameless shower enclosure")
    c.drawString(72, H - 170, "Guest Bath: bathtub panel")
    c.drawString(72, H - 195, "Reflected ceiling plan view")
    c.showPage()

    # Page 2: Schedule
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "GLASS & MIRROR SCHEDULE")
    c.setFont("Helvetica", 10)
    y = H - 120
    schedule_entries = [
        'Type A Master Bath: SHOWER ENCLOSURE - Inline Panel + Door  36" x 78"  3/8 clear tempered',
        'Type A Guest Bath: SHOWER ENCLOSURE - Bathtub Fixed Panel  30" x 60"  3/8 clear tempered',
        'Type C Master Bath: SHOWER ENCLOSURE - 90 Degree Corner Door  42" x 78"  1/2 low iron tempered',
        'Type A Master Bath: VANITY MIRROR - Rectangular  48" x 36"  1/4 mirror polished edge',
        'Type B Bathroom: VANITY MIRROR  30" x 36"  1/4 mirror polished edge',
        'Hardware Schedule: Hinges, Handles, Corner Clamps per detail',
        'Fixture Schedule reference SD-5',
    ]
    for entry in schedule_entries:
        c.drawString(72, y, entry)
        y -= 18
    c.showPage()

    # Page 3: Notes
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "GENERAL NOTES")
    c.setFont("Helvetica", 10)
    y = H - 120
    notes_text = [
        "ASSUMPTIONS:",
        "- All glass is tempered safety glass per code requirements",
        "- Hardware finish to be confirmed during shop drawing approval",
        "- Field measurements to be taken before fabrication",
        "- Standard installation height of 78\" for shower enclosures",
        "",
        "EXCLUSIONS:",
        "- Tile work, waterproofing, or any other trades' work",
        "- Electrical work for lighting or heated mirrors",
        "- Plumbing modifications",
        "- Removal or disposal of existing fixtures",
        "",
        "Specifications and abbreviations reference",
        "Legend: TBV = To Be Verified",
    ]
    for line in notes_text:
        c.drawString(72, y, line)
        y -= 16
    c.showPage()

    # Page 4: Detail
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "SHOWER DETAIL - SD-5")
    c.setFont("Helvetica", 10)
    c.drawString(72, H - 120, "Typical detail for inline panel door configuration")
    c.drawString(72, H - 140, "Glass: 1/2 low iron tempered")
    c.drawString(72, H - 160, "Section detail showing header channel")
    c.drawString(72, H - 180, "Enlarged view of hinge connection")
    c.showPage()

    # Page 5: Irrelevant filler
    c.setFont("Helvetica", 12)
    c.drawString(72, H - 72, "MECHANICAL SYSTEMS")
    c.drawString(72, H - 100, "HVAC ductwork layout - not related to glass scope")
    c.drawString(72, H - 120, "Plumbing riser diagram")
    c.showPage()

    c.save()
    return pdf_path
