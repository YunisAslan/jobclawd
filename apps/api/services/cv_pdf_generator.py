"""ReportLab-based PDF generator for structured CVData.

Takes a CVData object and produces a clean, professional, ATS-friendly
single-column PDF layout.
"""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from models.cv_schema import CVData


# ── Styles ───────────────────────────────────────────────────────────────────

_FONT = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
_FONT_ITALIC = "Helvetica-Oblique"

_COLOR_TEXT = colors.HexColor("#1a1a1a")
_COLOR_HEADING = colors.HexColor("#1a1a1a")
_COLOR_MUTED = colors.HexColor("#555555")
_COLOR_ACCENT = colors.HexColor("#2563eb")
_COLOR_LINE = colors.HexColor("#d1d5db")


def _build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "name": ParagraphStyle(
            "CVName", parent=base["Normal"],
            fontName=_FONT_BOLD, fontSize=18, leading=22,
            alignment=TA_CENTER, textColor=_COLOR_TEXT, spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "CVContact", parent=base["Normal"],
            fontName=_FONT, fontSize=9, leading=12,
            alignment=TA_CENTER, textColor=_COLOR_MUTED, spaceAfter=6,
        ),
        "summary": ParagraphStyle(
            "CVSummary", parent=base["Normal"],
            fontName=_FONT, fontSize=10, leading=14,
            alignment=TA_LEFT, textColor=_COLOR_TEXT,
            spaceAfter=8,
        ),
        "section_heading": ParagraphStyle(
            "CVSectionHeading", parent=base["Normal"],
            fontName=_FONT_BOLD, fontSize=11, leading=14,
            textColor=_COLOR_HEADING, spaceBefore=10, spaceAfter=4,
        ),
        "entry_title": ParagraphStyle(
            "CVEntryTitle", parent=base["Normal"],
            fontName=_FONT_BOLD, fontSize=10, leading=13,
            textColor=_COLOR_TEXT, spaceAfter=1,
        ),
        "entry_subtitle": ParagraphStyle(
            "CVEntrySubtitle", parent=base["Normal"],
            fontName=_FONT_ITALIC, fontSize=9, leading=12,
            textColor=_COLOR_MUTED, spaceAfter=2,
        ),
        "entry_date": ParagraphStyle(
            "CVEntryDate", parent=base["Normal"],
            fontName=_FONT, fontSize=9, leading=12,
            textColor=_COLOR_MUTED, alignment=TA_LEFT,
        ),
        "bullet": ParagraphStyle(
            "CVBullet", parent=base["Normal"],
            fontName=_FONT, fontSize=9.5, leading=13,
            textColor=_COLOR_TEXT, leftIndent=12, bulletIndent=0,
            spaceAfter=2, bulletFontName=_FONT, bulletFontSize=9.5,
        ),
        "body": ParagraphStyle(
            "CVBody", parent=base["Normal"],
            fontName=_FONT, fontSize=9.5, leading=13,
            textColor=_COLOR_TEXT, spaceAfter=2,
        ),
        "skill_category": ParagraphStyle(
            "CVSkillCategory", parent=base["Normal"],
            fontName=_FONT_BOLD, fontSize=9.5, leading=13,
            textColor=_COLOR_TEXT,
        ),
        "skill_items": ParagraphStyle(
            "CVSkillItems", parent=base["Normal"],
            fontName=_FONT, fontSize=9.5, leading=13,
            textColor=_COLOR_TEXT, spaceAfter=2,
        ),
    }


# ── Public API ───────────────────────────────────────────────────────────────

def generate_cv_pdf(data: CVData) -> BytesIO:
    """Generate a PDF from structured CVData. Returns a BytesIO buffer."""
    buf = BytesIO()
    styles = _build_styles()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
    )

    story: list = []

    # ── Personal Info / Header ──
    _render_header(story, data, styles)

    # ── Summary ──
    if data.personal_info.summary:
        story.append(Paragraph(data.personal_info.summary, styles["summary"]))
        story.append(Spacer(1, 4))

    # ── Experience ──
    if data.experience:
        _render_section_heading(story, "WORK EXPERIENCE", styles)
        for entry in data.experience:
            _render_experience_entry(story, entry, styles)

    # ── Education ──
    if data.education:
        _render_section_heading(story, "EDUCATION", styles)
        for entry in data.education:
            _render_education_entry(story, entry, styles)

    # ── Skills ──
    if data.skills:
        _render_section_heading(story, "SKILLS", styles)
        _render_skills(story, data, styles)

    # ── Languages ──
    if data.languages:
        _render_section_heading(story, "LANGUAGES", styles)
        items = []
        for lang in data.languages:
            if lang.level:
                items.append(f"{lang.language} — {lang.level}")
            else:
                items.append(lang.language)
        story.append(Paragraph(", ".join(items), styles["body"]))

    # ── Certifications ──
    if data.certifications:
        _render_section_heading(story, "CERTIFICATIONS", styles)
        for cert in data.certifications:
            parts = [cert.name]
            if cert.issuer:
                parts.append(f"— {cert.issuer}")
            if cert.date:
                parts.append(f"({cert.date})")
            story.append(Paragraph("  ".join(parts), styles["body"]))

    # ── Additional sections ──
    for section_name, items in data.additional_sections.items():
        display_name = section_name.upper() if section_name.islower() else section_name
        _render_section_heading(story, display_name, styles)
        for item in items:
            story.append(Paragraph(f"• {_esc(item)}", styles["bullet"]))

    doc.build(story)
    buf.seek(0)
    return buf


# ── Render helpers ───────────────────────────────────────────────────────────

def _render_header(story: list, data: CVData, styles: dict):
    info = data.personal_info

    if info.full_name:
        story.append(Paragraph(_esc(info.full_name), styles["name"]))

    contact_parts: list[str] = []
    if info.phone:
        contact_parts.append(info.phone)
    if info.email:
        contact_parts.append(info.email)
    if info.location:
        contact_parts.append(info.location)
    if info.linkedin:
        contact_parts.append(info.linkedin)
    if info.portfolio:
        contact_parts.append(info.portfolio)

    if contact_parts:
        story.append(Paragraph("  |  ".join(_esc(p) for p in contact_parts), styles["contact"]))

    story.append(Spacer(1, 2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_COLOR_LINE))
    story.append(Spacer(1, 4))


def _render_section_heading(story: list, title: str, styles: dict):
    story.append(Spacer(1, 2))
    story.append(Paragraph(_esc(title), styles["section_heading"]))
    story.append(HRFlowable(width="100%", thickness=0.4, color=_COLOR_LINE))
    story.append(Spacer(1, 3))


def _render_experience_entry(story: list, entry, styles: dict):
    # Title line with date on the right
    title = entry.title or entry.company
    subtitle_parts = []
    if entry.company and entry.title:
        subtitle_parts.append(entry.company)
    if entry.location:
        subtitle_parts.append(entry.location)

    date_str = ""
    if entry.start_date:
        date_str = entry.start_date
        if entry.end_date:
            date_str += f" — {entry.end_date}"

    # Title + date as a table for alignment
    if date_str:
        title_para = Paragraph(f"<b>{_esc(title)}</b>", styles["entry_title"])
        date_para = Paragraph(_esc(date_str), styles["entry_date"])
        t = Table([[title_para, date_para]], colWidths=["70%", "30%"])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        story.append(t)
    else:
        story.append(Paragraph(f"<b>{_esc(title)}</b>", styles["entry_title"]))

    if subtitle_parts:
        story.append(Paragraph(_esc(", ".join(subtitle_parts)), styles["entry_subtitle"]))

    for bullet in entry.bullets:
        story.append(Paragraph(f"• {_esc(bullet)}", styles["bullet"]))

    story.append(Spacer(1, 4))


def _render_education_entry(story: list, entry, styles: dict):
    title = entry.institution or entry.degree
    date_str = ""
    if entry.start_date:
        date_str = entry.start_date
        if entry.end_date:
            date_str += f" — {entry.end_date}"

    if date_str:
        title_para = Paragraph(f"<b>{_esc(title)}</b>", styles["entry_title"])
        date_para = Paragraph(_esc(date_str), styles["entry_date"])
        t = Table([[title_para, date_para]], colWidths=["70%", "30%"])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        story.append(t)
    else:
        story.append(Paragraph(f"<b>{_esc(title)}</b>", styles["entry_title"]))

    if entry.degree and entry.institution:
        story.append(Paragraph(_esc(entry.degree), styles["entry_subtitle"]))
    if entry.field_of_study:
        story.append(Paragraph(_esc(entry.field_of_study), styles["entry_subtitle"]))

    for detail in entry.details:
        story.append(Paragraph(f"• {_esc(detail)}", styles["bullet"]))

    story.append(Spacer(1, 4))


def _render_skills(story: list, data: CVData, styles: dict):
    for group in data.skills:
        if group.category:
            text = f"<b>{_esc(group.category)}:</b>  {_esc(', '.join(group.items))}"
        else:
            text = _esc(", ".join(group.items))
        story.append(Paragraph(text, styles["skill_items"]))


def _esc(text: str) -> str:
    """Escape XML special chars for ReportLab Paragraph."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
