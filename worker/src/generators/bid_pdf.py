"""Bid / Breakdown PDF generator using ReportLab.

Generates a professional bid document from the SSOT JSON with:
- Cover page
- Table of contents
- Executive summary
- Scope of work (grouped by unit type)
- Pricing breakdown table
- Assumptions and exclusions
- Alternates
- Terms and conditions
"""

import os
import io
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.platypus.flowables import HRFlowable

import structlog

logger = structlog.get_logger()

# ─── Colors ──────────────────────────────────────────────────────────────────
PRIMARY = HexColor("#1a365d")
SECONDARY = HexColor("#2b6cb0")
ACCENT = HexColor("#e2e8f0")
LIGHT_BG = HexColor("#f7fafc")
BORDER = HexColor("#cbd5e0")


def _get_styles():
    """Create custom paragraph styles for the bid document."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=28,
        textColor=PRIMARY,
        alignment=TA_CENTER,
        spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        name="CoverSubtitle",
        fontName="Helvetica",
        fontSize=14,
        textColor=SECONDARY,
        alignment=TA_CENTER,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="SectionTitle",
        fontName="Helvetica-Bold",
        fontSize=16,
        textColor=PRIMARY,
        spaceBefore=20,
        spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        name="SubSection",
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=SECONDARY,
        spaceBefore=12,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="BodyText2",
        fontName="Helvetica",
        fontSize=10,
        textColor=black,
        spaceAfter=4,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        name="TableHeader",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=white,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="TableCell",
        fontName="Helvetica",
        fontSize=9,
        textColor=black,
    ))
    styles.add(ParagraphStyle(
        name="TableCellRight",
        fontName="Helvetica",
        fontSize=9,
        textColor=black,
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name="FooterText",
        fontName="Helvetica",
        fontSize=8,
        textColor=HexColor("#718096"),
        alignment=TA_CENTER,
    ))

    return styles


def _build_cover_page(ssot: dict, styles) -> list:
    """Build the cover page elements."""
    metadata = ssot.get("metadata", {})
    elements = []

    elements.append(Spacer(1, 2 * inch))
    elements.append(Paragraph("LUXURIUS GLASS", styles["CoverTitle"]))
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph("Bid / Breakdown", styles["CoverSubtitle"]))
    elements.append(Spacer(1, 0.5 * inch))

    elements.append(HRFlowable(width="60%", thickness=2, color=PRIMARY))
    elements.append(Spacer(1, 0.3 * inch))

    project_name = metadata.get("projectName", "Untitled Project")
    client_name = metadata.get("clientName", "")
    address = metadata.get("address", "")
    date = metadata.get("updatedAt", datetime.now().isoformat())[:10]

    info_data = [
        ["Project:", project_name],
        ["Client:", client_name],
        ["Address:", address],
        ["Date:", date],
    ]

    info_table = Table(info_data, colWidths=[1.5 * inch, 4 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (0, -1), SECONDARY),
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)

    elements.append(PageBreak())
    return elements


def _build_toc(ssot: dict, styles) -> list:
    """Build table of contents."""
    elements = []
    elements.append(Paragraph("Table of Contents", styles["SectionTitle"]))
    elements.append(Spacer(1, 0.2 * inch))

    sections = [
        "1. Executive Summary",
        "2. Scope of Work",
        "3. Pricing Breakdown",
        "4. Assumptions and Exclusions",
    ]
    if ssot.get("alternates"):
        sections.append("5. Alternates")
    sections.append(f"{len(sections) + 1}. Terms and Conditions")

    for section in sections:
        elements.append(Paragraph(f"  {section}", styles["BodyText2"]))

    elements.append(PageBreak())
    return elements


def _build_executive_summary(ssot: dict, styles) -> list:
    """Build executive summary section."""
    elements = []
    elements.append(Paragraph("1. Executive Summary", styles["SectionTitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 0.1 * inch))

    pricing = ssot.get("pricing", {})
    total = pricing.get("total", 0)
    items_count = len(ssot.get("items", []))

    elements.append(Paragraph(
        f"This proposal covers the supply and installation of frameless glass "
        f"enclosures and mirrors for the referenced project. The scope includes "
        f"<b>{items_count} item(s)</b> with a total project value of "
        f"<b>${total:,.2f}</b>.",
        styles["BodyText2"],
    ))
    elements.append(Spacer(1, 0.2 * inch))

    # Summary table
    categories = {}
    for item in ssot.get("items", []):
        cat = item.get("category", "OTHER").replace("_", " ").title()
        categories[cat] = categories.get(cat, 0) + item.get("quantityPerUnit", 1)

    if categories:
        summary_data = [["Category", "Quantity"]]
        for cat, qty in categories.items():
            summary_data.append([cat, str(qty)])

        t = Table(summary_data, colWidths=[4 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_BG]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(t)

    elements.append(Spacer(1, 0.3 * inch))
    return elements


def _build_scope_of_work(ssot: dict, styles) -> list:
    """Build scope of work section grouped by unit type."""
    elements = []
    elements.append(Paragraph("2. Scope of Work", styles["SectionTitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 0.1 * inch))

    items = ssot.get("items", [])
    if not items:
        elements.append(Paragraph("No items extracted.", styles["BodyText2"]))
        return elements

    # Group by unit type
    by_unit = {}
    for item in items:
        unit_id = item.get("unitId") or "General"
        if unit_id not in by_unit:
            by_unit[unit_id] = []
        by_unit[unit_id].append(item)

    for unit_id, unit_items in by_unit.items():
        elements.append(Paragraph(f"Unit: {unit_id}", styles["SubSection"]))

        table_data = [["#", "Category", "Configuration", "Dimensions", "Glass", "Qty"]]

        for i, item in enumerate(unit_items, 1):
            cat = item.get("category", "").replace("_", " ").title()
            config = item.get("configuration", "").replace("-", " ").title()
            dims = item.get("dimensions", {})
            w = dims.get("width", {}).get("value")
            h = dims.get("height", {}).get("value")
            dim_str = ""
            if w and h:
                dim_str = f'{w:.0f}" x {h:.0f}"'
            elif w:
                dim_str = f'{w:.0f}" W'
            elif h:
                dim_str = f'{h:.0f}" H'
            else:
                dim_str = "TBV"

            flags = item.get("flags", [])
            if "TO_BE_VERIFIED_IN_FIELD" in flags:
                dim_str += " *"

            glass = item.get("glassType", "")
            qty = str(item.get("quantityPerUnit", 1))

            table_data.append([str(i), cat, config, dim_str, glass, qty])

        t = Table(
            table_data,
            colWidths=[0.4 * inch, 1.5 * inch, 1.5 * inch, 1.2 * inch, 1.5 * inch, 0.5 * inch],
        )
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (-1, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_BG]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 0.15 * inch))

    elements.append(Paragraph(
        "<i>* TBV = To Be Verified In Field</i>",
        styles["BodyText2"],
    ))
    elements.append(Spacer(1, 0.2 * inch))
    return elements


def _build_pricing_table(ssot: dict, styles) -> list:
    """Build the pricing breakdown table."""
    elements = []
    elements.append(Paragraph("3. Pricing Breakdown", styles["SectionTitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 0.1 * inch))

    pricing = ssot.get("pricing", {})
    line_items = pricing.get("lineItems", [])

    table_data = [["#", "Description", "Qty", "Unit Price", "Total"]]

    for i, li in enumerate(line_items, 1):
        desc = li.get("description", "")
        qty = str(li.get("quantity", 1))
        unit_price = f"${li.get('unitPrice', 0):,.2f}"
        total = f"${li.get('totalPrice', 0):,.2f}"
        table_data.append([str(i), desc, qty, unit_price, total])

    # Totals
    table_data.append(["", "", "", "Subtotal:", f"${pricing.get('subtotal', 0):,.2f}"])
    if pricing.get("tax", 0) > 0:
        table_data.append(["", "", "", "Tax:", f"${pricing.get('tax', 0):,.2f}"])
    table_data.append(["", "", "", "TOTAL:", f"${pricing.get('total', 0):,.2f}"])

    t = Table(
        table_data,
        colWidths=[0.4 * inch, 3.2 * inch, 0.5 * inch, 1.2 * inch, 1.2 * inch],
    )

    n_items = len(line_items)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, n_items), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, n_items), [white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        # Totals formatting
        ("FONTNAME", (3, n_items + 1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (3, n_items + 1), (-1, n_items + 1), 1, BORDER),
        ("LINEABOVE", (-2, -1), (-1, -1), 2, PRIMARY),
        ("FONTSIZE", (-2, -1), (-1, -1), 11),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3 * inch))
    return elements


def _build_assumptions(ssot: dict, styles) -> list:
    """Build assumptions and exclusions section."""
    elements = []
    elements.append(Paragraph("4. Assumptions and Exclusions", styles["SectionTitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 0.1 * inch))

    assumptions = ssot.get("assumptions", [])
    exclusions = ssot.get("exclusions", [])

    if assumptions:
        elements.append(Paragraph("Assumptions:", styles["SubSection"]))
        for a in assumptions:
            elements.append(Paragraph(f"• {a}", styles["BodyText2"]))
        elements.append(Spacer(1, 0.15 * inch))

    if exclusions:
        elements.append(Paragraph("Exclusions:", styles["SubSection"]))
        for e in exclusions:
            elements.append(Paragraph(f"• {e}", styles["BodyText2"]))
        elements.append(Spacer(1, 0.15 * inch))

    if not assumptions and not exclusions:
        elements.append(Paragraph("No assumptions or exclusions noted.", styles["BodyText2"]))

    elements.append(Spacer(1, 0.2 * inch))
    return elements


def _build_alternates(ssot: dict, styles) -> list:
    """Build alternates section if any exist."""
    alternates = ssot.get("alternates", [])
    if not alternates:
        return []

    elements = []
    elements.append(Paragraph("5. Alternates", styles["SectionTitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 0.1 * inch))

    table_data = [["Alt #", "Description", "Add/Deduct"]]
    for alt in alternates:
        impact = alt.get("priceImpact", 0)
        sign = "+" if impact >= 0 else ""
        table_data.append([
            alt.get("id", ""),
            alt.get("description", ""),
            f"{sign}${impact:,.2f}",
        ])

    t = Table(table_data, colWidths=[0.8 * inch, 4 * inch, 1.5 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3 * inch))
    return elements


def _build_terms(styles) -> list:
    """Build terms and conditions (boilerplate)."""
    elements = []
    elements.append(Paragraph("Terms and Conditions", styles["SectionTitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 0.1 * inch))

    terms = [
        "This proposal is valid for 30 days from the date of issue.",
        "Prices are based on standard glass types and hardware finishes as specified.",
        "Any changes to scope, dimensions, or specifications after acceptance may result in price adjustments.",
        "Payment terms: 50% deposit upon acceptance, balance due upon completion of installation.",
        "Lead time: 4-6 weeks from deposit and approved shop drawings.",
        "Warranty: 1-year limited warranty on materials and workmanship.",
        "Field measurements to be taken and confirmed prior to fabrication.",
        "Building access and site conditions must be suitable for installation.",
    ]

    for i, term in enumerate(terms, 1):
        elements.append(Paragraph(f"{i}. {term}", styles["BodyText2"]))
        elements.append(Spacer(1, 0.05 * inch))

    return elements


def generate_bid_pdf(ssot: dict, output_path: str) -> str:
    """Generate the Bid / Breakdown PDF from SSOT.

    Args:
        ssot: The complete SSOT JSON dict.
        output_path: Local file path to write the PDF.

    Returns:
        The output file path.
    """
    logger.info("Generating Bid PDF", output_path=output_path)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    styles = _get_styles()

    metadata = ssot.get("metadata", {})
    project_name = metadata.get("projectName", "Untitled")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=f"Bid Breakdown - {project_name}",
        author="Luxurius Glass",
    )

    elements = []
    elements.extend(_build_cover_page(ssot, styles))
    elements.extend(_build_toc(ssot, styles))
    elements.extend(_build_executive_summary(ssot, styles))
    elements.extend(_build_scope_of_work(ssot, styles))

    elements.append(PageBreak())
    elements.extend(_build_pricing_table(ssot, styles))
    elements.extend(_build_assumptions(ssot, styles))
    elements.extend(_build_alternates(ssot, styles))

    elements.append(PageBreak())
    elements.extend(_build_terms(styles))

    doc.build(elements)

    logger.info("Bid PDF generated", output_path=output_path, pages="multi")
    return output_path
