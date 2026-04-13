"""CV content extraction — extract text from uploaded PDF, DOCX, and DOC files."""

import re
import shutil
import subprocess
import tempfile
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
    elif ext == ".doc":
        return _extract_doc(filepath)
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


def _extract_doc(filepath: Path) -> Optional[str]:
    """Best-effort extraction from legacy DOC files using installed system tools."""
    extractors = (
        ["antiword", str(filepath)],
        ["catdoc", str(filepath)],
        ["textutil", "-convert", "txt", "-stdout", str(filepath)],
    )

    for cmd in extractors:
        if not shutil.which(cmd[0]):
            continue
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False)
            if result.returncode == 0:
                normalized = _normalize_text(result.stdout.splitlines())
                if normalized:
                    return normalized
        except Exception:
            continue

    office_cmd = shutil.which("soffice") or shutil.which("lowriter")
    if office_cmd:
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                result = subprocess.run(
                    [
                        office_cmd,
                        "--headless",
                        "--convert-to",
                        "txt:Text",
                        "--outdir",
                        temp_dir,
                        str(filepath),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    check=False,
                )
                if result.returncode == 0:
                    txt_path = Path(temp_dir) / f"{filepath.stem}.txt"
                    if txt_path.exists():
                        normalized = _normalize_text(txt_path.read_text(errors="ignore").splitlines())
                        if normalized:
                            return normalized
        except Exception:
            pass

    return None


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

