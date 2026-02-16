"""TPL-02: Inline Panel + Door (fixed panel + swing door).

Draws a plan view and elevation of an inline shower enclosure
with a fixed panel and a hinged swing door.
"""

from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor

from ..drawing_utils import (
    DRAWING_AREA_LEFT, DRAWING_AREA_BOTTOM,
    DRAWING_AREA_WIDTH, DRAWING_AREA_HEIGHT,
    LINE_COLOR, DIM_COLOR, NOTE_COLOR,
    draw_dimension_line, draw_hardware_callout,
    draw_glass_annotation, draw_tbv_placeholder,
    draw_notes_zone, format_dimension,
)


def draw(canvas: Canvas, item: dict, config: dict) -> None:
    """Draw inline panel + door shop drawing."""
    dims = item.get("dimensions", {})
    panel_w = dims.get("width", {}).get("value")
    door_w_raw = dims.get("depth", {}).get("value")  # depth used as door width
    height = dims.get("height", {}).get("value")
    glass_type = item.get("glassType", "3/8 clear tempered")
    hardware = item.get("hardware", [])
    flags = item.get("flags", [])
    is_tbv = "TO_BE_VERIFIED_IN_FIELD" in flags

    # If no separate door width, estimate from configuration
    if door_w_raw is None and panel_w:
        door_w_raw = min(panel_w * 0.55, 36)  # Max 36" door

    # Drawing scale: fit into drawing area
    total_width = (panel_w or 36) + (door_w_raw or 24)
    total_height = height or 72

    scale_x = (DRAWING_AREA_WIDTH * 0.6) / total_width
    scale_y = (DRAWING_AREA_HEIGHT * 0.5) / total_height
    scale = min(scale_x, scale_y)

    # Center the drawing
    cx = DRAWING_AREA_LEFT + DRAWING_AREA_WIDTH / 2
    cy = DRAWING_AREA_BOTTOM + DRAWING_AREA_HEIGHT * 0.55

    # ─── Elevation View ──────────────────────────────────────────

    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(LINE_COLOR)
    canvas.drawCentredString(cx, cy + total_height * scale / 2 + 15, "ELEVATION VIEW")

    # Panel (left)
    pw = (panel_w or 36) * scale
    dw = (door_w_raw or 24) * scale
    h = (total_height) * scale

    panel_x = cx - (pw + dw) / 2
    panel_y = cy - h / 2

    canvas.setStrokeColor(LINE_COLOR)
    canvas.setLineWidth(1.5)

    # Fixed panel
    canvas.rect(panel_x, panel_y, pw, h, fill=0)

    # Hatch pattern for fixed panel (diagonal lines)
    canvas.setLineWidth(0.3)
    canvas.setStrokeColor(HexColor("#a0aec0"))
    step = 8
    for i in range(int(pw / step) + int(h / step) + 1):
        x_start = panel_x + i * step
        y_start = panel_y
        x_end = panel_x
        y_end = panel_y + i * step
        # Clip to panel bounds
        if x_start > panel_x + pw:
            y_start += (x_start - panel_x - pw)
            x_start = panel_x + pw
        if y_end > panel_y + h:
            x_end += (y_end - panel_y - h)
            y_end = panel_y + h
        if y_start < panel_y + h and x_end < panel_x + pw:
            canvas.line(x_start, y_start, x_end, y_end)

    # Door
    canvas.setStrokeColor(LINE_COLOR)
    canvas.setLineWidth(1.5)
    door_x = panel_x + pw
    canvas.rect(door_x, panel_y, dw, h, fill=0)

    # Door swing arc (quarter circle)
    canvas.setLineWidth(0.5)
    canvas.setDash(4, 2)
    canvas.arc(door_x - dw, panel_y, door_x + dw, panel_y + 2 * dw, 0, 90)
    canvas.setDash()

    # ─── Dimension lines ─────────────────────────────────────────
    canvas.setLineWidth(0.5)

    # Panel width
    if panel_w:
        draw_dimension_line(
            canvas,
            panel_x, panel_y, panel_x + pw, panel_y,
            format_dimension(panel_w),
            offset=-0.25 * inch,
        )
    elif is_tbv:
        draw_tbv_placeholder(canvas, panel_x, panel_y - 0.2 * inch, panel_x + pw, panel_y - 0.2 * inch)

    # Door width
    if door_w_raw:
        draw_dimension_line(
            canvas,
            door_x, panel_y, door_x + dw, panel_y,
            format_dimension(door_w_raw),
            offset=-0.25 * inch,
        )

    # Height
    if height:
        draw_dimension_line(
            canvas,
            panel_x + pw + dw, panel_y,
            panel_x + pw + dw, panel_y + h,
            format_dimension(height),
            offset=0.25 * inch,
        )
    elif is_tbv:
        draw_tbv_placeholder(
            canvas,
            panel_x + pw + dw + 0.15 * inch, panel_y,
            panel_x + pw + dw + 0.15 * inch, panel_y + h,
        )

    # Total width
    total_w = (panel_w or 36) + (door_w_raw or 24)
    draw_dimension_line(
        canvas,
        panel_x, panel_y + h, panel_x + pw + dw, panel_y + h,
        format_dimension(total_w),
        offset=0.3 * inch,
    )

    # ─── Glass annotation ────────────────────────────────────────
    draw_glass_annotation(canvas, panel_x + pw / 2 - 20, panel_y + h / 2, glass_type)

    # ─── Hardware callouts ───────────────────────────────────────
    hw_items = hardware or []
    hinge_type = item.get("dimensions", {}).get("hinge_type") or "Standard"
    callout_y = panel_y + h * 0.7

    draw_hardware_callout(canvas, door_x, callout_y, 1, f"Hinge: {hinge_type}")
    if hw_items:
        for i, hw in enumerate(hw_items[:2]):
            draw_hardware_callout(
                canvas,
                door_x + dw * 0.5, callout_y - (i + 1) * 20,
                i + 2,
                f"{hw.get('type', 'Hardware')}: {hw.get('finish', '')}",
            )

    # ─── Notes ───────────────────────────────────────────────────
    notes = [
        f"Glass: {glass_type}",
        "All dimensions in inches unless noted",
    ]
    if item.get("notes"):
        notes.append(item["notes"])
    if is_tbv:
        notes.append("* Dimensions marked TBV to be verified in field")

    draw_notes_zone(canvas, notes)

    canvas.restoreState()
