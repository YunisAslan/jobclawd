"""PDF -> DOCX conversion using pdf2docx.

The converted file is stored at uploads/cv/editable/{uuid}.docx so it
can be served via the API.
"""

import uuid
from pathlib import Path
from typing import Optional

CV_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"
EDITABLE_DIR = CV_DIR / "editable"
EDITABLE_DIR.mkdir(parents=True, exist_ok=True)


def convert_to_docx(source_cv_url: str) -> Optional[str]:
    """
    Convert the PDF at source_cv_url to DOCX using pdf2docx.
    Returns the new relative API URL or None on failure.
    """
    filename = source_cv_url.rstrip("/").split("/")[-1]
    source_path = CV_DIR / filename
    if not source_path.exists():
        return None

    if source_path.suffix.lower() != ".pdf":
        return None

    try:
        return _convert_pdf_with_pdf2docx(source_path)
    except Exception:
        return None


def _convert_pdf_with_pdf2docx(source_path: Path) -> Optional[str]:
    """Pure-Python PDF->DOCX via pdf2docx."""
    from pdf2docx import Converter  # type: ignore

    dest_name = f"{uuid.uuid4().hex}.docx"
    dest_path = EDITABLE_DIR / dest_name

    cv = Converter(str(source_path))
    try:
        cv.convert(str(dest_path), start=0, end=None)
    finally:
        cv.close()

    if dest_path.exists() and dest_path.stat().st_size > 0:
        _postprocess_converted_docx(dest_path)
        return f"/api/files/cv/editable/{dest_name}"
    return None


def _postprocess_converted_docx(docx_path: Path) -> None:
    """Strip gray backgrounds and fix links that pdf2docx adds incorrectly."""
    try:
        from docx import Document
        from docx.oxml.ns import qn
    except ImportError:
        return

    doc = Document(str(docx_path))

    # Collect shading colors to remove (grays that weren't in the original)
    _GRAY_FILLS = {"D9D9D9", "E6E6E6", "F2F2F2", "CCCCCC", "BFBFBF", "E7E6E6",
                   "EEECE1", "DDD9C3", "C4BC96", "EDEDED", "F5F5F5", "D6D6D6"}

    def _strip_shading(element):
        """Remove w:shd from element if its fill color is a known spurious gray."""
        for shd in element.findall(qn("w:shd")):
            fill = (shd.get(qn("w:fill")) or "").upper().lstrip("#")
            # Remove if gray, or if it's "auto" background that renders as gray
            if fill in _GRAY_FILLS or fill == "auto":
                element.remove(shd)

    # Process all paragraphs
    for para in doc.paragraphs:
        pPr = para._element.find(qn("w:pPr"))
        if pPr is not None:
            _strip_shading(pPr)
        # Also strip run-level shading (highlighted text backgrounds)
        for run in para.runs:
            rPr = run._element.find(qn("w:rPr"))
            if rPr is not None:
                _strip_shading(rPr)

    # Process table cells
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                tcPr = cell._element.find(qn("w:tcPr"))
                if tcPr is not None:
                    _strip_shading(tcPr)
                for para in cell.paragraphs:
                    pPr = para._element.find(qn("w:pPr"))
                    if pPr is not None:
                        _strip_shading(pPr)

    # Fix hyperlinks -- pdf2docx sometimes creates broken rIds
    rels = doc.part.rels
    for para in doc.paragraphs:
        for hyperlink in para._element.findall(qn("w:hyperlink")):
            rId = hyperlink.get(qn("r:id"))
            if rId and rId not in rels:
                # Broken rId -- try to extract URL from display text
                hyperlink.attrib.pop(qn("r:id"), None)

    doc.save(str(docx_path))
