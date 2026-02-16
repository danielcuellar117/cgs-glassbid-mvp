"""Worker test conftest -- shared fixtures for worker tests."""

import json
import os
import sys

# Add worker/src to path so we can import worker modules as `src.xxx`
WORKER_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "worker")
if WORKER_DIR not in sys.path:
    sys.path.insert(0, WORKER_DIR)

# Override worker config for tests before any worker import
os.environ.setdefault("DATABASE_URL", "postgresql://glassbid:glassbid_secret@localhost:5433/glassbid_test")
os.environ.setdefault("MINIO_ENDPOINT", "localhost")
os.environ.setdefault("MINIO_PORT", "9010")
os.environ.setdefault("MINIO_ACCESS_KEY", "testadmin")
os.environ.setdefault("MINIO_SECRET_KEY", "testadmin_secret")
os.environ.setdefault("MINIO_USE_SSL", "false")
os.environ.setdefault("TEMP_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "tmp-test"))
os.environ.setdefault("DISK_PRESSURE_THRESHOLD_PCT", "80")

import pytest

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")
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
    """Generate a small synthetic multi-page PDF for testing."""
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
    c.drawCentredString(W / 2, H - 270, "Sheet Index")
    c.showPage()

    # Page 1: Floor Plan
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "FLOOR PLAN - LEVEL 3")
    c.setFont("Helvetica", 11)
    c.drawString(72, H - 120, "Master Bath: frameless shower enclosure")
    c.showPage()

    # Page 2: Schedule
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "GLASS & MIRROR SCHEDULE")
    c.setFont("Helvetica", 10)
    c.drawString(72, H - 120, 'SHOWER ENCLOSURE - Inline Panel + Door  36" x 78"')
    c.drawString(72, H - 140, 'VANITY MIRROR  48" x 36"  1/4 mirror')
    c.showPage()

    # Page 3: Notes
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "GENERAL NOTES")
    c.setFont("Helvetica", 10)
    lines = [
        "ASSUMPTIONS:",
        "- All glass is tempered safety glass per code requirements",
        "- Field measurements to be taken before fabrication",
        "",
        "EXCLUSIONS:",
        "- Tile work, waterproofing, or any other trades' work",
        "- Electrical work for lighting or heated mirrors",
    ]
    y = H - 120
    for line in lines:
        c.drawString(72, y, line)
        y -= 16
    c.showPage()

    # Page 4: Detail
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 72, "SHOWER DETAIL - SD-5")
    c.setFont("Helvetica", 10)
    c.drawString(72, H - 120, "Typical detail for inline panel door")
    c.drawString(72, H - 140, "Glass: 1/2 low iron tempered")
    c.showPage()

    # Page 5: Irrelevant
    c.setFont("Helvetica", 12)
    c.drawString(72, H - 72, "MECHANICAL SYSTEMS - HVAC ductwork")
    c.showPage()

    c.save()
    return pdf_path
