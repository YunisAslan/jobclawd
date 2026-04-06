"""Structured PDF → HTML converter for CV files.

Uses pdfplumber character-level data to detect:
- Headings (larger or bold text matching known section keywords)
- Bullet/list items (with continuation line merging)
- Section structure
- Contact info grouping

Produces clean, editable HTML with semantic tags.
"""

import html as _html
import re
from pathlib import Path
from typing import Optional


# Bullet-like prefixes in CVs (includes Wingdings \uf0b7 and other private-use bullets)
_BULLET_RE = re.compile(
    r"^(?:[•◦◆▪▸►●○■\-–—~\uf0b7\uf0a7\uf076\uf0d8\uf0fc]|\*|\d+[.)]\s|[a-zA-Z][.)]\s)\s*"
)

# Section heading keywords common in CVs (lowercase, stripped of colons)
_HEADING_KEYWORDS = {
    "work experience", "experience", "professional experience", "employment",
    "employment history", "career history",
    "education", "academic background", "qualifications", "education and training",
    "skills", "technical skills", "core skills", "technologies", "tech stack",
    "key skills", "competencies", "core competencies", "digital skills",
    "projects", "personal projects", "side projects",
    "certifications", "certificates", "courses", "licenses",
    "languages", "language skills", "mother tongue", "other languages",
    "achievements", "awards", "honors",
    "summary", "profile", "professional summary", "objective",
    "about me", "personal information", "personal details",
    "references", "publications", "interests", "hobbies",
    "volunteer", "volunteering", "training",
    "contact", "contact information", "contact details",
    "professional experience", "additional information",
}


def convert_pdf_to_html(filepath: Path) -> Optional[str]:
    """Convert a PDF file to structured HTML suitable for CV editing."""
    try:
        import pdfplumber
    except ImportError:
        return None

    try:
        lines_data = _extract_lines_with_style(filepath)
        if not lines_data:
            return None
        merged = _merge_continuation_lines(lines_data)
        return _build_html(merged)
    except Exception:
        return None


def _extract_lines_with_style(filepath: Path) -> list[dict]:
    """Extract lines with font size and bold info from PDF."""
    import pdfplumber

    all_lines: list[dict] = []

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            chars = page.chars
            if not chars:
                text = page.extract_text()
                if text:
                    for line in text.splitlines():
                        if line.strip():
                            all_lines.append({
                                "text": line.strip(),
                                "size": 11.0,
                                "bold": False,
                                "x0": 0.0,
                            })
                continue

            # Group characters into lines by y-coordinate (top)
            line_groups: dict[float, list] = {}
            for c in chars:
                y = round(c["top"], 1)
                matched = None
                for existing_y in line_groups:
                    if abs(existing_y - y) < 3:
                        matched = existing_y
                        break
                key = matched if matched is not None else y
                if key not in line_groups:
                    line_groups[key] = []
                line_groups[key].append(c)

            for y in sorted(line_groups.keys()):
                group = sorted(line_groups[y], key=lambda c: c["x0"])
                text = "".join(c.get("text", "") for c in group).strip()
                if not text:
                    continue

                sizes = [c.get("size", 11) for c in group if c.get("text", "").strip()]
                fonts = [c.get("fontname", "") for c in group if c.get("text", "").strip()]

                avg_size = sum(sizes) / len(sizes) if sizes else 11.0
                bold = any("bold" in f.lower() for f in fonts) if fonts else False
                x0 = group[0].get("x0", 0.0) if group else 0.0

                all_lines.append({
                    "text": text,
                    "size": round(avg_size, 1),
                    "bold": bold,
                    "x0": round(x0, 1),
                })

    return all_lines


def _merge_continuation_lines(lines: list[dict]) -> list[dict]:
    """Merge lines that are continuations of the previous line.

    A continuation is detected when:
    - The line starts lowercase or with a common continuation pattern
    - The line doesn't start with a bullet or heading pattern
    - The previous line doesn't end with a period, colon, or similar terminator
    """
    if not lines:
        return lines

    merged: list[dict] = [lines[0]]

    for i in range(1, len(lines)):
        cur = lines[i]
        prev = merged[-1]
        text = cur["text"]

        # Skip empty
        if not text.strip():
            continue

        # Check if this is a continuation of the previous line
        is_bullet = bool(_BULLET_RE.match(text))
        starts_lower = text[0].islower() if text else False
        prev_text = prev["text"].rstrip()
        prev_ends_incomplete = (
            prev_text
            and not prev_text.endswith((".", ":", ";", "!", "?"))
            and not prev_text.endswith("</li>")
        )
        # Same font size, not a bullet, starts lowercase or prev line is incomplete
        same_size = abs(cur["size"] - prev["size"]) < 1.5

        if (
            not is_bullet
            and same_size
            and not _is_heading_text(text, cur["size"], cur["bold"], _guess_body_size(lines))
            and (starts_lower or (prev_ends_incomplete and not text[0].isupper()))
        ):
            # Merge into previous
            prev["text"] = prev["text"].rstrip() + " " + text.lstrip()
        else:
            merged.append(cur)

    return merged


def _guess_body_size(lines: list[dict]) -> float:
    """Find the most common font size (= body text size)."""
    size_counts: dict[float, int] = {}
    for line in lines:
        s = line["size"]
        size_counts[s] = size_counts.get(s, 0) + len(line["text"])
    return max(size_counts, key=size_counts.get) if size_counts else 11.0


def _build_html(lines: list[dict]) -> str:
    """Convert extracted lines into structured HTML."""
    if not lines:
        return ""

    body_size = _guess_body_size(lines)

    html_parts: list[str] = []
    i = 0
    in_list = False

    while i < len(lines):
        line = lines[i]
        text = line["text"]
        size = line["size"]
        bold = line["bold"]

        is_heading = _is_heading_text(text, size, bold, body_size)
        bullet_match = _BULLET_RE.match(text)
        is_bullet = bullet_match is not None

        if is_heading:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            heading_text = _html.escape(text.rstrip(":").strip())
            tag = "h1" if i == 0 and size > body_size + 2 else "h2"
            html_parts.append(f"<{tag}>{heading_text}</{tag}>")
        elif is_bullet:
            clean = _BULLET_RE.sub("", text).strip()
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            html_parts.append(f"<li>{_html.escape(clean)}</li>")
        else:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            escaped = _html.escape(text)
            if bold and size >= body_size:
                html_parts.append(f"<p><strong>{escaped}</strong></p>")
            else:
                html_parts.append(f"<p>{escaped}</p>")

        i += 1

    if in_list:
        html_parts.append("</ul>")

    return "\n".join(html_parts)


def _is_heading_text(text: str, size: float, bold: bool, body_size: float) -> bool:
    """Determine if a line is a section heading."""
    stripped = text.strip().rstrip(":")

    if len(stripped) > 60:
        return False

    if not stripped or not any(c.isalpha() for c in stripped):
        return False

    lower = stripped.lower()

    # Known heading keywords — exact match
    if lower in _HEADING_KEYWORDS:
        return True

    # Significantly larger than body text AND short
    if size > body_size + 3 and len(stripped.split()) <= 6:
        return True

    # Bold + ALL CAPS + matches a known heading keyword
    if bold and stripped.isupper() and lower in _HEADING_KEYWORDS:
        return True

    return False
