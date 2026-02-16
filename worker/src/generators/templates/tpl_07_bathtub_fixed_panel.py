"""TPL-07: Bathtub Fixed Panel.

Draws a simple elevation of a fixed glass panel for a bathtub,
mounted with U-channel at the base.
"""

from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor

from ..drawing_utils import (
    DRAWING_AREA_LEFT, DRAWING_AREA_BOTTOM,
    DRAWING_AREA_WIDTH, DRAWING_AREA_HEIGHT,
    LINE_COLOR, NOTE_COLOR,
    draw_dimension_line, draw_hardware_callout,
    draw_glass_annotation, draw_tbv_placeholder,
    draw_notes_zone, format_dimension,
)


def draw(canvas: Canvas, item: dict, config: dict) -> None:
    """Draw bathtub fixed panel shop drawing."""
    dims = item.get("dimensions", {})
    panel_w = dims.get("width", {}).get("value") or 30
    panel_h = dims.get("height", {}).get("value") or 60
    glass_type = item.get("glassType", "3/8 clear tempered")
    flags = item.get("flags", [])
    is_tbv = "TO_BE_VERIFIED_IN_FIELD" in flags

    # Scale
    scale = min(
        (DRAWING_AREA_WIDTH * 0.4) / panel_w,
        (DRAWING_AREA_HEIGHT * 0.5) / (panel_h + 18),  # +18 for tub height
    )

    cx = DRAWING_AREA_LEFT + DRAWING_AREA_WIDTH / 2
    cy = DRAWING_AREA_BOTTOM + DRAWING_AREA_HEIGHT * 0.5

    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(LINE_COLOR)
    canvas.drawCentredString(cx, cy + (panel_h + 18) * scale / 2 + 15, "ELEVATION VIEW")

    pw = panel_w * scale
    ph = panel_h * scale
    tub_h = 18 * scale  # Standard tub height ~18"

    panel_x = cx - pw / 2
    tub_y = cy - (ph + tub_h) / 2
    panel_y = tub_y + tub_h

    # ─── Tub outline ─────────────────────────────────────────────
    canvas.setStrokeColor(NOTE_COLOR)
    canvas.setLineWidth(1)
    canvas.setDash(6, 3)
    canvas.rect(panel_x - 10, tub_y, pw + 20, tub_h, fill=0)
    canvas.setDash()

    canvas.setFont("Helvetica", 6)
    canvas.setFillColor(NOTE_COLOR)
    canvas.drawCentredString(cx, tub_y + tub_h / 2 - 3, "BATHTUB")

    # ─── Glass panel ─────────────────────────────────────────────
    canvas.setStrokeColor(LINE_COLOR)
    canvas.setLineWidth(2)
    canvas.rect(panel_x, panel_y, pw, ph, fill=0)

    # U-channel at base
    canvas.setFillColor(HexColor("#a0aec0"))
    canvas.setStrokeColor(LINE_COLOR)
    canvas.setLineWidth(1)
    channel_h = 4
    canvas.rect(panel_x - 2, panel_y - channel_h / 2, pw + 4, channel_h, fill=1, stroke=1)

    # ─── Dimensions ──────────────────────────────────────────────
    if panel_w:
        draw_dimension_line(
            canvas,
            panel_x, panel_y + ph, panel_x + pw, panel_y + ph,
            format_dimension(panel_w),
            offset=0.25 * inch,
        )
    elif is_tbv:
        draw_tbv_placeholder(canvas, panel_x, panel_y + ph + 10, panel_x + pw, panel_y + ph + 10)

    if panel_h:
        draw_dimension_line(
            canvas,
            panel_x + pw, panel_y, panel_x + pw, panel_y + ph,
            format_dimension(panel_h),
            offset=0.25 * inch,
        )
    elif is_tbv:
        draw_tbv_placeholder(canvas, panel_x + pw + 10, panel_y, panel_x + pw + 10, panel_y + ph)

    # ─── Annotations ─────────────────────────────────────────────
    draw_glass_annotation(canvas, cx - 25, panel_y + ph / 2, glass_type)

    draw_hardware_callout(canvas, panel_x + pw / 2, panel_y, 1, "U-Channel")

    notes = [
        f"Glass: {glass_type}",
        "Mounted with U-channel at tub deck",
        "All dimensions in inches",
    ]
    if is_tbv:
        notes.append("* TBV dimensions to be verified in field")
    draw_notes_zone(canvas, notes)
