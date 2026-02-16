"""TPL-04: 90-Degree Corner + Door.

Draws a plan view and elevation of a 90-degree corner shower enclosure
with two panels meeting at a right angle and a hinged door.
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
    """Draw 90-degree corner + door shop drawing."""
    dims = item.get("dimensions", {})
    panel_a = dims.get("width", {}).get("value") or 36
    panel_b = dims.get("depth", {}).get("value") or 36
    height = dims.get("height", {}).get("value") or 78
    glass_type = item.get("glassType", "3/8 clear tempered")
    flags = item.get("flags", [])
    is_tbv = "TO_BE_VERIFIED_IN_FIELD" in flags

    door_w = 24  # Default door width

    # Scale
    max_dim = max(panel_a, panel_b + door_w)
    scale = min(
        (DRAWING_AREA_WIDTH * 0.5) / max_dim,
        (DRAWING_AREA_HEIGHT * 0.5) / height,
    )

    cx = DRAWING_AREA_LEFT + DRAWING_AREA_WIDTH * 0.4
    cy = DRAWING_AREA_BOTTOM + DRAWING_AREA_HEIGHT * 0.55

    # ─── Plan View (top-down) ────────────────────────────────────
    plan_cx = DRAWING_AREA_LEFT + DRAWING_AREA_WIDTH * 0.25
    plan_cy = cy + DRAWING_AREA_HEIGHT * 0.2

    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(LINE_COLOR)
    canvas.drawCentredString(plan_cx, plan_cy + panel_a * scale * 0.5 + 15, "PLAN VIEW")

    canvas.setStrokeColor(LINE_COLOR)
    canvas.setLineWidth(1.5)

    # Wall lines (corner)
    corner_x = plan_cx - panel_a * scale * 0.4
    corner_y = plan_cy - panel_b * scale * 0.4

    # Panel A (horizontal)
    pa_w = panel_a * scale
    canvas.line(corner_x, corner_y, corner_x + pa_w, corner_y)

    # Panel B (vertical)
    pb_h = panel_b * scale
    canvas.line(corner_x, corner_y, corner_x, corner_y + pb_h)

    # Glass panels (thicker lines with glass thickness)
    glass_t = 3  # visual thickness
    canvas.setLineWidth(2)
    canvas.setStrokeColor(HexColor("#2b6cb0"))

    # Panel A glass
    canvas.line(corner_x + 2, corner_y + glass_t, corner_x + pa_w, corner_y + glass_t)

    # Panel B glass
    canvas.line(corner_x + glass_t, corner_y + 2, corner_x + glass_t, corner_y + pb_h)

    # Door (at end of panel B)
    dw_s = door_w * scale
    canvas.setLineWidth(1.5)
    canvas.setStrokeColor(LINE_COLOR)
    door_y = corner_y + pb_h
    canvas.line(corner_x + glass_t, door_y, corner_x + glass_t + dw_s, door_y)

    # Door swing arc
    canvas.setLineWidth(0.5)
    canvas.setDash(4, 2)
    canvas.arc(
        corner_x + glass_t - dw_s, door_y - dw_s,
        corner_x + glass_t + dw_s, door_y + dw_s,
        270, 90,
    )
    canvas.setDash()

    # ─── Elevation View ──────────────────────────────────────────
    elev_cx = DRAWING_AREA_LEFT + DRAWING_AREA_WIDTH * 0.7
    elev_cy = cy

    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(LINE_COLOR)
    canvas.drawCentredString(elev_cx, elev_cy + height * scale * 0.5 + 15, "ELEVATION - PANEL A")

    canvas.setStrokeColor(LINE_COLOR)
    canvas.setLineWidth(1.5)

    h_s = height * scale
    canvas.rect(elev_cx - pa_w / 2, elev_cy - h_s / 2, pa_w, h_s, fill=0)

    # ─── Dimensions ──────────────────────────────────────────────
    # Panel A (plan)
    draw_dimension_line(
        canvas,
        corner_x, corner_y, corner_x + pa_w, corner_y,
        format_dimension(panel_a),
        offset=-0.25 * inch,
    )

    # Panel B (plan)
    draw_dimension_line(
        canvas,
        corner_x, corner_y, corner_x, corner_y + pb_h,
        format_dimension(panel_b),
        offset=-0.25 * inch,
    )

    # Height (elevation)
    if height:
        draw_dimension_line(
            canvas,
            elev_cx + pa_w / 2, elev_cy - h_s / 2,
            elev_cx + pa_w / 2, elev_cy + h_s / 2,
            format_dimension(height),
            offset=0.25 * inch,
        )

    # ─── Annotations ─────────────────────────────────────────────
    draw_glass_annotation(canvas, elev_cx - 20, elev_cy, glass_type)

    draw_hardware_callout(
        canvas,
        corner_x + glass_t, corner_y + pb_h, 1,
        "Hinge",
    )

    # Corner clamp
    draw_hardware_callout(
        canvas,
        corner_x + glass_t, corner_y + glass_t, 2,
        "90° Corner Clamp",
    )

    notes = [
        f"Glass: {glass_type}",
        "90° corner configuration",
        "All dimensions in inches",
    ]
    if is_tbv:
        notes.append("* TBV dimensions to be verified in field")
    draw_notes_zone(canvas, notes)
