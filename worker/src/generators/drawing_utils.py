"""Shared drawing utilities for shop drawing templates.

Provides reusable drawing primitives: title blocks, revision boxes,
dimension leaders, hardware callout bubbles, etc.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfgen.canvas import Canvas

# ─── Constants ───────────────────────────────────────────────────────────────

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 0.5 * inch
TITLE_BLOCK_HEIGHT = 1.2 * inch
REVISION_BOX_WIDTH = 2 * inch
REVISION_BOX_HEIGHT = 0.8 * inch

DRAWING_AREA_LEFT = MARGIN
DRAWING_AREA_BOTTOM = MARGIN + TITLE_BLOCK_HEIGHT + 0.2 * inch
DRAWING_AREA_RIGHT = PAGE_WIDTH - MARGIN
DRAWING_AREA_TOP = PAGE_HEIGHT - MARGIN - REVISION_BOX_HEIGHT - 0.2 * inch
DRAWING_AREA_WIDTH = DRAWING_AREA_RIGHT - DRAWING_AREA_LEFT
DRAWING_AREA_HEIGHT = DRAWING_AREA_TOP - DRAWING_AREA_BOTTOM

PRIMARY_COLOR = HexColor("#1a365d")
SECONDARY_COLOR = HexColor("#2b6cb0")
LINE_COLOR = HexColor("#2d3748")
DIM_COLOR = HexColor("#e53e3e")
NOTE_COLOR = HexColor("#718096")


def draw_title_block(
    c: Canvas,
    drawing_num: str,
    project_name: str,
    client_name: str,
    date: str,
    revision: str = "0",
    scale: str = "NTS",
    drawn_by: str = "System",
) -> None:
    """Draw the title block in the bottom-right corner."""
    x = PAGE_WIDTH - MARGIN - 4 * inch
    y = MARGIN
    w = 4 * inch
    h = TITLE_BLOCK_HEIGHT

    # Background
    c.setFillColor(PRIMARY_COLOR)
    c.rect(x, y, w, h, fill=1, stroke=0)

    # Company name
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x + 0.15 * inch, y + h - 0.25 * inch, "LUXURIUS GLASS")

    # Drawing number (large)
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(x + w - 0.15 * inch, y + h - 0.25 * inch, drawing_num)

    # Divider line
    c.setStrokeColor(white)
    c.setLineWidth(0.5)
    c.line(x + 0.1 * inch, y + h - 0.35 * inch, x + w - 0.1 * inch, y + h - 0.35 * inch)

    # Info fields
    c.setFont("Helvetica", 7)
    fields = [
        ("PROJECT:", project_name),
        ("CLIENT:", client_name),
        ("DATE:", date),
        ("SCALE:", scale),
        ("DRAWN:", drawn_by),
        ("REV:", revision),
    ]

    col1_x = x + 0.15 * inch
    col2_x = x + 2 * inch
    row_y = y + h - 0.55 * inch

    for i, (label, value) in enumerate(fields):
        col = col1_x if i % 2 == 0 else col2_x
        row = row_y - (i // 2) * 0.22 * inch

        c.setFont("Helvetica-Bold", 6)
        c.drawString(col, row, label)
        c.setFont("Helvetica", 7)
        c.drawString(col + 0.55 * inch, row, str(value)[:30])


def draw_revision_box(
    c: Canvas,
    revisions: list[dict] = None,
) -> None:
    """Draw the revision box in the top-right corner.

    Each revision: {"rev": "1", "date": "2024-01-15", "description": "Initial"}
    """
    x = PAGE_WIDTH - MARGIN - REVISION_BOX_WIDTH
    y = PAGE_HEIGHT - MARGIN - REVISION_BOX_HEIGHT

    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(0.75)
    c.rect(x, y, REVISION_BOX_WIDTH, REVISION_BOX_HEIGHT, fill=0)

    # Header
    c.setFillColor(PRIMARY_COLOR)
    c.rect(x, y + REVISION_BOX_HEIGHT - 0.2 * inch, REVISION_BOX_WIDTH, 0.2 * inch, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(x + REVISION_BOX_WIDTH / 2, y + REVISION_BOX_HEIGHT - 0.16 * inch, "REVISIONS")

    # Column headers
    c.setFillColor(LINE_COLOR)
    c.setFont("Helvetica-Bold", 5)
    c.drawString(x + 0.05 * inch, y + REVISION_BOX_HEIGHT - 0.35 * inch, "REV")
    c.drawString(x + 0.35 * inch, y + REVISION_BOX_HEIGHT - 0.35 * inch, "DATE")
    c.drawString(x + 1.0 * inch, y + REVISION_BOX_HEIGHT - 0.35 * inch, "DESCRIPTION")

    if revisions:
        c.setFont("Helvetica", 5)
        for i, rev in enumerate(revisions[:3]):  # Max 3 rows
            row_y = y + REVISION_BOX_HEIGHT - 0.5 * inch - i * 0.12 * inch
            c.drawString(x + 0.05 * inch, row_y, str(rev.get("rev", "")))
            c.drawString(x + 0.35 * inch, row_y, str(rev.get("date", ""))[:10])
            c.drawString(x + 1.0 * inch, row_y, str(rev.get("description", ""))[:20])


def draw_dimension_line(
    c: Canvas,
    x1: float, y1: float,
    x2: float, y2: float,
    label: str,
    offset: float = 0.3 * inch,
    color=None,
) -> None:
    """Draw a dimension line with leader lines and centered label.

    Draws a line between two points with extension lines and a centered dimension text.
    """
    import math

    if color is None:
        color = DIM_COLOR

    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(0.5)

    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx * dx + dy * dy)

    if length < 0.01:
        c.restoreState()
        return

    # Normal direction for offset
    nx = -dy / length * offset
    ny = dx / length * offset

    # Extension lines
    c.line(x1, y1, x1 + nx, y1 + ny)
    c.line(x2, y2, x2 + nx, y2 + ny)

    # Dimension line
    dim_x1, dim_y1 = x1 + nx, y1 + ny
    dim_x2, dim_y2 = x2 + nx, y2 + ny
    c.line(dim_x1, dim_y1, dim_x2, dim_y2)

    # Arrowheads (small ticks)
    tick_len = 3
    angle = math.atan2(dy, dx)
    for px, py in [(dim_x1, dim_y1), (dim_x2, dim_y2)]:
        c.line(
            px - tick_len * math.cos(angle + math.pi / 4),
            py - tick_len * math.sin(angle + math.pi / 4),
            px + tick_len * math.cos(angle + math.pi / 4),
            py + tick_len * math.sin(angle + math.pi / 4),
        )

    # Label
    mid_x = (dim_x1 + dim_x2) / 2
    mid_y = (dim_y1 + dim_y2) / 2

    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(mid_x, mid_y + 3, label)

    c.restoreState()


def draw_hardware_callout(
    c: Canvas,
    x: float, y: float,
    number: int,
    label: str,
) -> None:
    """Draw a hardware callout bubble with number."""
    c.saveState()

    # Circle
    radius = 8
    c.setStrokeColor(SECONDARY_COLOR)
    c.setFillColor(white)
    c.setLineWidth(1)
    c.circle(x, y, radius, fill=1, stroke=1)

    # Number
    c.setFillColor(SECONDARY_COLOR)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(x, y - 2.5, str(number))

    # Leader line + label
    c.setStrokeColor(NOTE_COLOR)
    c.setLineWidth(0.5)
    c.line(x + radius, y, x + radius + 15, y)
    c.setFont("Helvetica", 6)
    c.setFillColor(NOTE_COLOR)
    c.drawString(x + radius + 18, y - 2, label[:35])

    c.restoreState()


def draw_notes_zone(
    c: Canvas,
    notes: list[str],
    x: float = None,
    y: float = None,
) -> None:
    """Draw a notes section at the bottom-left of the drawing area."""
    if x is None:
        x = DRAWING_AREA_LEFT
    if y is None:
        y = DRAWING_AREA_BOTTOM + 0.1 * inch

    c.saveState()
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(LINE_COLOR)
    c.drawString(x, y + len(notes) * 10 + 5, "NOTES:")

    c.setFont("Helvetica", 6)
    c.setFillColor(NOTE_COLOR)
    for i, note in enumerate(notes):
        c.drawString(x + 5, y + (len(notes) - i - 1) * 10, f"{i + 1}. {note[:80]}")

    c.restoreState()


def draw_glass_annotation(
    c: Canvas,
    x: float, y: float,
    glass_type: str,
) -> None:
    """Draw a glass type annotation box."""
    c.saveState()

    c.setStrokeColor(NOTE_COLOR)
    c.setFillColor(HexColor("#f7fafc"))
    c.setLineWidth(0.5)
    c.roundRect(x - 2, y - 4, len(glass_type) * 4 + 8, 12, 2, fill=1, stroke=1)

    c.setFont("Helvetica", 5)
    c.setFillColor(NOTE_COLOR)
    c.drawString(x + 2, y - 1, glass_type)

    c.restoreState()


def draw_tbv_placeholder(
    c: Canvas,
    x1: float, y1: float,
    x2: float, y2: float,
    label: str = "TBV",
) -> None:
    """Draw a 'To Be Verified' placeholder (dashed line + TBV label)."""
    c.saveState()

    c.setStrokeColor(DIM_COLOR)
    c.setLineWidth(0.75)
    c.setDash(3, 3)
    c.line(x1, y1, x2, y2)

    mid_x = (x1 + x2) / 2
    mid_y = (y1 + y2) / 2
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(DIM_COLOR)
    c.drawCentredString(mid_x, mid_y + 5, label)

    c.restoreState()


def format_dimension(value: float | None, unit: str = "in") -> str:
    """Format a dimension value for display.

    Converts decimal inches to feet-inches notation if >= 12".
    """
    if value is None:
        return "TBV"

    if value >= 12:
        feet = int(value // 12)
        inches = value % 12
        if inches == 0:
            return f"{feet}'-0\""
        if inches == int(inches):
            return f"{feet}'-{int(inches)}\""
        return f"{feet}'-{inches:.1f}\""

    if value == int(value):
        return f'{int(value)}"'
    return f'{value:.1f}"'
