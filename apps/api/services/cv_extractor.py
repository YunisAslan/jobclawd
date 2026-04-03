"""CV content extraction — extract text from uploaded PDF and DOCX files."""

import html as _html
import re
import zipfile
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

CV_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"


def extract_cv_text(cv_url: str) -> Optional[str]:
    """
    Extract plain text from a CV file given its URL path
    (e.g. "/api/files/cv/abc123.pdf").
    Returns None if the file cannot be read or parsed.
    """
    filename = cv_url.rstrip("/").split("/")[-1]
    filepath = CV_DIR / filename

    if not filepath.exists():
        return None

    ext = filepath.suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(filepath)
    elif ext == ".docx":
        return _extract_docx(filepath)
    return None


def _extract_pdf(filepath: Path) -> Optional[str]:
    """Extract text from PDF using pdfplumber."""
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts) if text_parts else None
    except Exception:
        return None


def _extract_docx(filepath: Path) -> Optional[str]:
    """Extract text from DOCX, including tables/headers/footers XML fallback."""
    text = _extract_docx_with_python_docx(filepath)
    if text:
        return text
    return _extract_docx_from_xml(filepath)


def _extract_docx_with_python_docx(filepath: Path) -> Optional[str]:
    try:
        import docx

        doc = docx.Document(str(filepath))
        text_parts: list[str] = []

        for para in doc.paragraphs:
            value = para.text.strip()
            if value:
                text_parts.append(value)

        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    text_parts.append(" | ".join(cells))

        normalized = _normalize_text(text_parts)
        return normalized if normalized else None
    except Exception:
        return None


def _extract_docx_from_xml(filepath: Path) -> Optional[str]:
    try:
        text_parts: list[str] = []
        with zipfile.ZipFile(filepath) as archive:
            for name in sorted(archive.namelist()):
                if not name.startswith("word/") or not name.endswith(".xml"):
                    continue
                xml_bytes = archive.read(name)
                root = ET.fromstring(xml_bytes)
                chunks = [node.text for node in root.iter() if _is_text_node(node.tag) and node.text]
                text = " ".join(chunk.strip() for chunk in chunks if chunk.strip())
                if text:
                    text_parts.append(text)

        normalized = _normalize_text(text_parts)
        return normalized if normalized else None
    except Exception:
        return None


def _is_text_node(tag: str) -> bool:
    return tag.endswith("}t") or tag == "t"


def _normalize_text(parts: list[str]) -> Optional[str]:
    lines = []
    seen = set()

    for part in parts:
        cleaned = re.sub(r"\s+", " ", part).strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        lines.append(cleaned)

    return "\n".join(lines) if lines else None


def extract_cv_html(cv_url: str) -> Optional[str]:
    """
    Extract HTML content from a CV file given its URL path
    (e.g. "/api/files/cv/abc123.docx").
    For DOCX: uses faithful converter preserving fonts, colors, sizes, images.
    For PDF: wraps plain text lines in <p> tags.
    Returns None if the file cannot be read or parsed.
    """
    filename = cv_url.rstrip("/").split("/")[-1]
    filepath = CV_DIR / filename

    if not filepath.exists():
        return None

    ext = filepath.suffix.lower()

    if ext == ".docx":
        # python-docx based converter
        from services.cv_html_converter import convert_docx_to_html
        result = convert_docx_to_html(filepath)
        if result:
            return result

        # Fallback: wrap plain text in <p> tags
        text = extract_cv_text(cv_url)
        if not text:
            return None
        return "".join(
            f"<p>{_html.escape(line)}</p>"
            for line in text.splitlines()
            if line.strip()
        )

    if ext == ".pdf":
        text = _extract_pdf(filepath)
        if not text:
            return None
        return "".join(
            f"<p>{_html.escape(line)}</p>"
            for line in text.splitlines()
            if line.strip()
        )

    return None
