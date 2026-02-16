"""TPL-09: Vanity Mirror (rectangular, simple).

Draws an elevation of a rectangular vanity mirror with edge type
and optional bevel details.
"""

from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor

from ..drawing_utils import (
    DRAWING_AREA_LEFT, DRAWING_AREA_BOTTOM,
    DRAWING_AREA_WIDTH, DRAWING_AREA_HEIGHT,
    LINE_COLOR, NOTE_COLOR, SECONDARY_COLOR,
    draw_dimension_line, draw_hardware_callout,
    draw_tbv_placeholder, draw_notes_zone, format_dimension,
)


def draw(canvas: Canvas, item: dict, config: dict) -> None:
    """Draw vanity mirror shop drawing."""
    dims = item.get("dimensions", {})
    mirror_w = dims.get("width", {}).get("value") or 30
    mirror_h = dims.get("height", {}).get("value") or 36
    edge_type = item.get("glassType", "Polished edge")  # Reuse field for edge type
    flags = item.get("flags", [])
    is_tbv = "TO_BE_VERIFIED_IN_FIELD" in flags

    # Scale
    scale = min(
        (DRAWING_AREA_WIDTH * 0.4) / mirror_w,
        (DRAWING_AREA_HEIGHT * 0.45) / mirror_h,
    )

    cx = DRAWING_AREA_LEFT + DRAWING_AREA_WIDTH / 2
    cy = DRAWING_AREA_BOTTOM + DRAWING_AREA_HEIGHT * 0.55

    mw = mirror_w * scale
    mh = mirror_h * scale
    mx = cx - mw / 2
    my = cy - mh / 2

    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(LINE_COLOR)
    canvas.drawCentredString(cx, my + mh + 15, "MIRROR ELEVATION")

    # ─── Mirror body ─────────────────────────────────────────────
    # Outer frame/edge
    canvas.setStrokeColor(LINE_COLOR)
    canvas.setLineWidth(2)
    canvas.rect(mx, my, mw, mh, fill=0)

    # Inner reflection detail (subtle cross-hatching for mirror effect)
    canvas.setStrokeColor(HexColor("#e2e8f0"))
    canvas.setLineWidth(0.3)
    # Diagonal reflection lines
    for i in range(0, int(mw + mh), 15):
        x1 = mx + min(i, mw)
        y1 = my + max(0, i - mw)
        x2 = mx + max(0, i - mh)
        y2 = my + min(i, mh)
        canvas.line(x1, y1, x2, y2)

    # Edge detail (if beveled, show bevel lines)
    if "bevel" in edge_type.lower():
        canvas.setStrokeColor(SECONDARY_COLOR)
        canvas.setLineWidth(0.5)
        bevel = 5
        canvas.rect(mx + bevel, my + bevel, mw - 2 * bevel, mh - 2 * bevel, fill=0)

    # ─── Dimensions ──────────────────────────────────────────────
    if mirror_w:
        draw_dimension_line(
            canvas,
            mx, my + mh, mx + mw, my + mh,
            format_dimension(mirror_w),
            offset=0.25 * inch,
        )
    elif is_tbv:
        draw_tbv_placeholder(canvas, mx, my + mh + 10, mx + mw, my + mh + 10)

    if mirror_h:
        draw_dimension_line(
            canvas,
            mx + mw, my, mx + mw, my + mh,
            format_dimension(mirror_h),
            offset=0.25 * inch,
        )
    elif is_tbv:
        draw_tbv_placeholder(canvas, mx + mw + 10, my, mx + mw + 10, my + mh)

    # ─── Annotations ─────────────────────────────────────────────
    draw_hardware_callout(canvas, mx, my + mh / 2, 1, f"Edge: {edge_type}")

    # Mounting detail
    canvas.setFont("Helvetica", 6)
    canvas.setFillColor(NOTE_COLOR)
    canvas.drawCentredString(cx, my - 15, "MOUNTING: J-CLIP / ADHESIVE (TBD)")

    notes = [
        f"Edge type: {edge_type}",
        "Mirror: 1/4\" standard unless noted",
        "All dimensions in inches",
    ]
    if is_tbv:
        notes.append("* TBV dimensions to be verified in field")
    draw_notes_zone(canvas, notes)
