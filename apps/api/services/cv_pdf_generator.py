"""ReportLab-based PDF generator for structured CVData.

Takes a CVData object and produces a clean, professional, ATS-friendly
single-column PDF layout.
"""

import base64
from io import BytesIO

from PIL import Image as PILImage

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from models.cv_schema import CVData


# ── Circular photo flowable ───────────────────────────────────────────────────

class CircularPhoto(Flowable):
    """Renders an image clipped to a circle of the given diameter."""

    def __init__(self, img_buf: BytesIO, diameter: float):
        super().__init__()
        self._buf = img_buf
        self.width = diameter
        self.height = diameter
        self._r = diameter / 2

    def draw(self):
        from reportlab.lib.utils import ImageReader
        self._buf.seek(0)
        reader = ImageReader(self._buf)
        c = self.canv
        c.saveState()
        p = c.beginPath()
        p.circle(self._r, self._r, self._r)
        c.clipPath(p, stroke=0, fill=0)
        c.drawImage(reader, 0, 0, width=self.width, height=self.height, mask="auto")
        c.restoreState()


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
            alignment=TA_LEFT, textColor=_COLOR_TEXT, spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "CVContact", parent=base["Normal"],
            fontName=_FONT, fontSize=9, leading=12,
            alignment=TA_LEFT, textColor=_COLOR_MUTED, spaceAfter=6,
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


_BUILTIN_SECTIONS = ["personal_info", "experience", "education", "skills", "languages", "certifications"]


def _effective_order(data: CVData) -> list[str]:
    """Return the final section render order.

    Priority: stored section_order → default order + additional sections.
    personal_info is always first. Any section present in data but missing
    from the stored order is appended at the end so nothing is silently dropped.
    """
    stored = [s for s in (data.section_order or []) if s]

    if not stored:
        stored = list(_BUILTIN_SECTIONS)
        stored += list(data.additional_sections.keys())

    # personal_info must be first (it is the document header)
    if "personal_info" in stored:
        stored.remove("personal_info")
    order = ["personal_info"] + stored

    # Append anything present in data that isn't already listed
    seen = set(order)
    for key in _BUILTIN_SECTIONS:
        if key not in seen:
            order.append(key)
            seen.add(key)
    for key in data.additional_sections:
        if key not in seen:
            order.append(key)
            seen.add(key)

    return order


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

    for section_key in _effective_order(data):
        if section_key == "personal_info":
            _render_header(story, data, styles)
            if data.personal_info.summary:
                story.append(Paragraph(data.personal_info.summary, styles["summary"]))
                story.append(Spacer(1, 4))

        elif section_key == "experience" and data.experience:
            _render_section_heading(story, "WORK EXPERIENCE", styles)
            for entry in data.experience:
                _render_experience_entry(story, entry, styles)

        elif section_key == "education" and data.education:
            _render_section_heading(story, "EDUCATION", styles)
            for entry in data.education:
                _render_education_entry(story, entry, styles)

        elif section_key == "skills" and data.skills:
            _render_section_heading(story, "SKILLS", styles)
            _render_skills(story, data, styles)

        elif section_key == "languages" and data.languages:
            _render_section_heading(story, "LANGUAGES", styles)
            for lang in data.languages:
                if not lang.language and not lang.level:
                    continue
                text = f"{_esc(lang.language)}: {_esc(lang.level)}" if lang.level else _esc(lang.language)
                story.append(Paragraph(f"• {text}", styles["bullet"]))

        elif section_key == "certifications" and data.certifications:
            _render_section_heading(story, "CERTIFICATIONS", styles)
            for cert in data.certifications:
                name_frag = _linked(cert.name, cert.link) if cert.name else ""
                parts = [name_frag] if name_frag else []
                if cert.issuer:
                    parts.append(f"— {_esc(cert.issuer)}")
                if cert.date:
                    parts.append(f"({_esc(cert.date)})")
                if parts:
                    story.append(Paragraph("  ".join(parts), styles["body"]))

        elif section_key in data.additional_sections:
            entries = data.additional_sections[section_key]
            if entries:
                _render_section_heading(story, section_key.upper(), styles)
                for entry in entries:
                    _render_additional_entry(story, entry, styles)

    doc.build(story)
    buf.seek(0)
    return buf


# ── Render helpers ───────────────────────────────────────────────────────────

def _resolve_linkedin(value: str) -> str:
    v = value.strip()
    if v.startswith("http://") or v.startswith("https://"):
        return v
    if v.startswith("linkedin.com"):
        return f"https://{v}"
    handle = v.removeprefix("in/")
    return f"https://linkedin.com/in/{handle}"


def _resolve_portfolio(value: str) -> str:
    v = value.strip()
    if v.startswith("http://") or v.startswith("https://"):
        return v
    if "." in v:
        return f"https://{v}"
    return ""


def _contact_fragment(label: str, href: str | None) -> str:
    """Return a ReportLab XML fragment — linked if href provided."""
    esc_label = _esc(label)
    if href:
        esc_href = href.replace("&", "&amp;").replace('"', "&quot;")
        return f'<a href="{esc_href}" color="#2563eb">{esc_label}</a>'
    return esc_label


def _render_header(story: list, data: CVData, styles: dict):
    info = data.personal_info

    # Build contact fragments — use explicit link if set, otherwise auto-resolve
    fragments: list[str] = []
    if info.phone:
        href = info.phone_link.strip() if info.phone_link else f"tel:{info.phone.replace(' ', '')}"
        fragments.append(_contact_fragment(info.phone, href))
    if info.email:
        href = info.email_link.strip() if info.email_link else f"mailto:{info.email}"
        fragments.append(_contact_fragment(info.email, href))
    if info.location:
        fragments.append(_contact_fragment(info.location, None))
    if info.linkedin:
        href = info.linkedin_link.strip() if info.linkedin_link else _resolve_linkedin(info.linkedin)
        fragments.append(_contact_fragment(info.linkedin, href))
    if info.portfolio:
        href = info.portfolio_link.strip() if info.portfolio_link else _resolve_portfolio(info.portfolio)
        fragments.append(_contact_fragment(info.portfolio, href or None))

    contact_parts = fragments  # kept for length check below

    name_para = Paragraph(_esc(info.full_name), styles["name"]) if info.full_name else None
    contact_para = (
        Paragraph("  |  ".join(contact_parts), styles["contact"]) if contact_parts else None
    )

    if info.photo:
        try:
            raw = info.photo
            if "," in raw:
                raw = raw.split(",", 1)[1]
            decoded = base64.b64decode(raw)

            # Use Pillow to normalise any format → JPEG for ReportLab
            pil_img = PILImage.open(BytesIO(decoded))
            if pil_img.mode not in ("RGB", "L"):
                pil_img = pil_img.convert("RGB")
            jpeg_buf = BytesIO()
            pil_img.save(jpeg_buf, format="JPEG", quality=90)
            jpeg_buf.seek(0)

            photo_img = CircularPhoto(jpeg_buf, diameter=0.75 * inch)

            # Two-column layout: text left, photo right
            text_cells = []
            if name_para:
                text_cells.append(name_para)
            if contact_para:
                text_cells.append(contact_para)

            from reportlab.platypus import KeepTogether
            text_col = text_cells if text_cells else [Spacer(1, 1)]

            t = Table([[text_col, photo_img]], colWidths=["82%", "18%"])
            t.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            story.append(t)
        except Exception:
            # Fallback to no-photo layout
            if name_para:
                story.append(name_para)
            if contact_para:
                story.append(contact_para)
    else:
        if name_para:
            story.append(name_para)
        if contact_para:
            story.append(contact_para)

    story.append(Spacer(1, 2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_COLOR_LINE))
    story.append(Spacer(1, 4))


def _render_section_heading(story: list, title: str, styles: dict):
    story.append(Spacer(1, 2))
    story.append(Paragraph(_esc(title), styles["section_heading"]))
    story.append(HRFlowable(width="100%", thickness=0.4, color=_COLOR_LINE))
    story.append(Spacer(1, 3))


def _linked(label: str, href: str | None) -> str:
    """Return a ReportLab XML fragment — hyperlink if href, else plain text."""
    esc_label = _esc(label)
    if href and href.strip():
        esc_href = href.strip().replace("&", "&amp;").replace('"', "&quot;")
        return f'<a href="{esc_href}" color="#2563eb">{esc_label}</a>'
    return esc_label


def _title_date_row(story: list, title_html: str, date_str: str, styles: dict):
    if date_str:
        title_para = Paragraph(title_html, styles["entry_title"])
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
        story.append(Paragraph(title_html, styles["entry_title"]))


def _render_experience_entry(story: list, entry, styles: dict):
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

    link = getattr(entry, "link", "") or ""
    title_html = f"<b>{_linked(title, link)}</b>"
    _title_date_row(story, title_html, date_str, styles)

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

    link = getattr(entry, "link", "") or ""
    title_html = f"<b>{_linked(title, link)}</b>"
    _title_date_row(story, title_html, date_str, styles)

    if entry.degree and entry.institution:
        subtitle_parts = [_esc(entry.degree)]
        if entry.field_of_study:
            subtitle_parts.append(_esc(entry.field_of_study))
        story.append(Paragraph(" · ".join(subtitle_parts), styles["entry_subtitle"]))
    elif entry.field_of_study:
        story.append(Paragraph(_esc(entry.field_of_study), styles["entry_subtitle"]))

    for detail in entry.details:
        story.append(Paragraph(f"• {_esc(detail)}", styles["bullet"]))

    story.append(Spacer(1, 4))


def _render_additional_entry(story: list, entry, styles: dict):
    """Render a structured AdditionalEntry preserving the original layout.

    Two modes are inferred from the data shape:

    Flat item  (no sub-bullets AND no subtitle):
        Rendered as a plain bullet with the date inline in parentheses —
        e.g. "• Professional Customer Service Association (08/2019 – PRESENT)".
        No bold, no right-aligned date column.

    Titled entry (has sub-bullets OR subtitle):
        Bold title with right-aligned date (same table layout as Experience),
        italic subtitle beneath, then indented bullets.
        e.g. "Dean's List   |   12/2018 and 05/2019"
             "  ABC College"
             "  • Completed 12 or more letter-graded units…"
    """
    title = (entry.title or "").strip()
    subtitle = (entry.subtitle or "").strip()
    date_str = (entry.date or "").strip()
    link = getattr(entry, "link", "") or ""
    bullets = entry.bullets or []

    # No data at all — legacy fallback
    if not title and not subtitle and not date_str and not bullets:
        return

    # Legacy flat-bullet (only bullets, no title/subtitle/date)
    if not title and not subtitle and not date_str:
        for bullet in bullets:
            story.append(Paragraph(f"• {_esc(bullet)}", styles["bullet"]))
        return

    has_detail = bool(bullets) or bool(subtitle)

    if not has_detail:
        # ── Flat list item ── plain bullet, date inline in parens
        title_frag = _linked(title, link) if title else ""
        date_frag = f" ({_esc(date_str)})" if date_str else ""
        text = f"• {title_frag}{date_frag}" if title_frag else f"• {date_frag.strip()}"
        story.append(Paragraph(text, styles["bullet"]))
    else:
        # ── Titled entry ── bold + right-aligned date + subtitle + bullets
        if title:
            title_html = f"<b>{_linked(title, link)}</b>"
            _title_date_row(story, title_html, date_str, styles)
        elif date_str:
            story.append(Paragraph(_esc(date_str), styles["entry_date"]))

        if subtitle:
            story.append(Paragraph(_esc(subtitle), styles["entry_subtitle"]))

        for bullet in bullets:
            story.append(Paragraph(f"• {_esc(bullet)}", styles["bullet"]))

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
