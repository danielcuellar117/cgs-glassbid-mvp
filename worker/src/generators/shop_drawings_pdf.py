"""Shop Drawings / Production Drawings PDF generator.

Generates a professional shop drawings document from SSOT with:
- Cover sheet with drawing index and revision history
- One drawing page per item (template-driven via ReportLab primitives)
- Title blocks, revision boxes, consistent numbering
"""

import os
import json
import importlib
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfgen.canvas import Canvas

import structlog

from .drawing_utils import (
    PAGE_WIDTH, PAGE_HEIGHT, MARGIN,
    PRIMARY_COLOR, SECONDARY_COLOR, LINE_COLOR, NOTE_COLOR,
    draw_title_block, draw_revision_box,
)

logger = structlog.get_logger()

# ─── Template Registry ───────────────────────────────────────────────────────

# Map configuration strings to template modules
TEMPLATE_MODULE_MAP = {
    "inline-panel": "tpl_02_inline_panel_door",
    "inline-panel-door": "tpl_02_inline_panel_door",
    "90-degree-corner": "tpl_04_90_degree_corner_door",
    "90-degree-corner-door": "tpl_04_90_degree_corner_door",
    "bathtub-fixed-panel": "tpl_07_bathtub_fixed_panel",
    "bathtub-panel-door": "tpl_07_bathtub_fixed_panel",
    "vanity-mirror": "tpl_09_vanity_mirror",
    "vanity-mirror-custom": "tpl_09_vanity_mirror",
}

# Also load from registry.json if available
_registry_path = os.path.join(
    os.path.dirname(__file__), "..", "..", "templates", "registry.json"
)

_template_modules: dict = {}


def _load_template_module(module_name: str):
    """Dynamically load a template module."""
    if module_name in _template_modules:
        return _template_modules[module_name]

    try:
        mod = importlib.import_module(
            f".templates.{module_name}", package="src.generators"
        )
        _template_modules[module_name] = mod
        return mod
    except ImportError as e:
        logger.warning(f"Template module not found: {module_name}", error=str(e))
        return None


def _get_template_for_item(item: dict):
    """Get the template draw function for an item."""
    config_str = item.get("configuration", "")
    template_id = item.get("templateId", "")

    # Try by configuration string
    module_name = TEMPLATE_MODULE_MAP.get(config_str)

    # Try registry.json
    if not module_name and os.path.exists(_registry_path):
        try:
            with open(_registry_path) as f:
                registry = json.load(f)
            for tpl in registry.get("templates", []):
                if tpl.get("templateId") == template_id:
                    module_name = tpl.get("module")
                    break
        except Exception:
            pass

    if not module_name:
        # Fallback based on category
        category = item.get("category", "")
        if category == "VANITY_MIRROR":
            module_name = "tpl_09_vanity_mirror"
        else:
            module_name = "tpl_02_inline_panel_door"  # Default

    return _load_template_module(module_name)


def _draw_cover_sheet(c: Canvas, ssot: dict, items: list) -> None:
    """Draw the cover sheet with project info and drawing index."""
    metadata = ssot.get("metadata", {})
    project_name = metadata.get("projectName", "Untitled Project")
    client_name = metadata.get("clientName", "")
    address = metadata.get("address", "")
    date = metadata.get("updatedAt", datetime.now().isoformat())[:10]

    # Title
    c.setFillColor(PRIMARY_COLOR)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - 2 * inch, "SHOP DRAWINGS")

    c.setFont("Helvetica", 14)
    c.setFillColor(SECONDARY_COLOR)
    c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - 2.5 * inch, "LUXURIUS GLASS")

    # Divider
    c.setStrokeColor(PRIMARY_COLOR)
    c.setLineWidth(2)
    c.line(2 * inch, PAGE_HEIGHT - 2.75 * inch, PAGE_WIDTH - 2 * inch, PAGE_HEIGHT - 2.75 * inch)

    # Project info
    c.setFont("Helvetica", 11)
    c.setFillColor(black)
    info_y = PAGE_HEIGHT - 3.3 * inch
    for label, value in [
        ("Project:", project_name),
        ("Client:", client_name),
        ("Address:", address),
        ("Date:", date),
        ("Total Drawings:", str(len(items))),
    ]:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * inch, info_y, label)
        c.setFont("Helvetica", 10)
        c.drawString(3.5 * inch, info_y, str(value))
        info_y -= 0.25 * inch

    # Drawing Index
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(PRIMARY_COLOR)
    index_y = info_y - 0.5 * inch
    c.drawString(MARGIN + 0.5 * inch, index_y, "DRAWING INDEX")

    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(0.5)
    c.line(MARGIN + 0.5 * inch, index_y - 5, PAGE_WIDTH - MARGIN - 0.5 * inch, index_y - 5)

    # Table header
    index_y -= 0.3 * inch
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(LINE_COLOR)
    c.drawString(MARGIN + 0.5 * inch, index_y, "DRAWING #")
    c.drawString(MARGIN + 2 * inch, index_y, "DESCRIPTION")
    c.drawString(MARGIN + 5 * inch, index_y, "UNIT")
    c.drawString(MARGIN + 6 * inch, index_y, "REV")

    # Index entries
    c.setFont("Helvetica", 8)
    c.setFillColor(black)
    for i, item in enumerate(items):
        index_y -= 0.2 * inch
        if index_y < MARGIN + inch:
            break  # Don't overflow page

        unit_id = item.get("unitId") or "General"
        cat = item.get("category", "").replace("_", " ").title()
        config = item.get("configuration", "").replace("-", " ").title()
        drawing_num = f"SD-{unit_id}-{i + 1:03d}"

        c.drawString(MARGIN + 0.5 * inch, index_y, drawing_num)
        c.drawString(MARGIN + 2 * inch, index_y, f"{cat} - {config}")
        c.drawString(MARGIN + 5 * inch, index_y, unit_id)
        c.drawString(MARGIN + 6 * inch, index_y, "0")


def _draw_item_page(c: Canvas, item: dict, ssot: dict, seq: int) -> None:
    """Draw a single item's shop drawing page."""
    metadata = ssot.get("metadata", {})
    unit_id = item.get("unitId") or "General"
    drawing_num = f"SD-{unit_id}-{seq:03d}"
    project_name = metadata.get("projectName", "Untitled")
    client_name = metadata.get("clientName", "")
    date = metadata.get("updatedAt", datetime.now().isoformat())[:10]

    # Title block
    draw_title_block(
        c,
        drawing_num=drawing_num,
        project_name=project_name,
        client_name=client_name,
        date=date,
        revision="0",
        scale="NTS",
        drawn_by="System",
    )

    # Revision box
    draw_revision_box(c, revisions=[
        {"rev": "0", "date": date, "description": "Initial"},
    ])

    # Get template and draw
    template_mod = _get_template_for_item(item)

    drawing_config = {
        "page_width": PAGE_WIDTH,
        "page_height": PAGE_HEIGHT,
        "margins": MARGIN,
        "title_block_height": 1.2 * inch,
        "company_name": "Luxurius Glass",
    }

    if template_mod and hasattr(template_mod, "draw"):
        try:
            template_mod.draw(c, item, drawing_config)
        except Exception as e:
            logger.error(
                "Template draw failed",
                item_id=item.get("itemId"),
                template=template_mod.__name__,
                error=str(e),
            )
            # Draw error placeholder
            c.setFont("Helvetica-Bold", 14)
            c.setFillColor(HexColor("#e53e3e"))
            c.drawCentredString(
                PAGE_WIDTH / 2, PAGE_HEIGHT / 2,
                f"DRAWING ERROR: {str(e)[:60]}",
            )
    else:
        # No template available
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(NOTE_COLOR)
        c.drawCentredString(
            PAGE_WIDTH / 2, PAGE_HEIGHT / 2,
            f"Template not available for configuration: {item.get('configuration', 'unknown')}",
        )


def generate_shop_drawings_pdf(ssot: dict, output_path: str) -> str:
    """Generate the Shop Drawings PDF from SSOT.

    Args:
        ssot: The complete SSOT JSON dict.
        output_path: Local file path to write the PDF.

    Returns:
        The output file path.
    """
    logger.info("Generating Shop Drawings PDF", output_path=output_path)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    items = ssot.get("items", [])
    if not items:
        logger.warning("No items to generate shop drawings for")
        # Still generate a placeholder PDF
        c = Canvas(output_path, pagesize=letter)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT / 2, "No items to draw")
        c.save()
        return output_path

    c = Canvas(output_path, pagesize=letter)

    # Page 1: Cover sheet
    _draw_cover_sheet(c, ssot, items)
    c.showPage()

    # Drawing pages: one per item
    for seq, item in enumerate(items, 1):
        _draw_item_page(c, item, ssot, seq)
        c.showPage()

    c.save()

    logger.info(
        "Shop Drawings PDF generated",
        output_path=output_path,
        items=len(items),
        pages=len(items) + 1,
    )
    return output_path
