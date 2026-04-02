"""PDF → DOCX conversion using LibreOffice headless.

The converted file is stored at uploads/cv/editable/{uuid}.docx so it
can be served via the API and opened in ONLYOFFICE.
"""

import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Optional

CV_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"
EDITABLE_DIR = CV_DIR / "editable"
EDITABLE_DIR.mkdir(parents=True, exist_ok=True)

_LO_CANDIDATES = [
    "libreoffice",
    "soffice",
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/usr/local/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
]


def _find_libreoffice() -> Optional[str]:
    for c in _LO_CANDIDATES:
        if shutil.which(c):
            return c
        if Path(c).exists():
            return c
    return None


def convert_to_docx(source_cv_url: str, converter: str = "auto") -> Optional[str]:
    """
    Convert the file at source_cv_url to DOCX.
    converter: "auto" (LibreOffice → pdf2docx), "libreoffice", or "pdf2docx"
    Returns the new relative API URL or None on failure.
    """
    filename = source_cv_url.rstrip("/").split("/")[-1]
    source_path = CV_DIR / filename
    if not source_path.exists():
        return None

    if converter == "pdf2docx":
        if source_path.suffix.lower() == ".pdf":
            try:
                return _convert_pdf_with_pdf2docx(source_path)
            except Exception:
                pass
        return None

    if converter == "libreoffice":
        lo = _find_libreoffice()
        if lo:
            try:
                return _run_conversion(lo, source_path)
            except Exception:
                pass
        return None

    # auto: LibreOffice → pdf2docx fallback
    lo = _find_libreoffice()
    if lo:
        try:
            result = _run_conversion(lo, source_path)
            if result:
                return result
        except Exception:
            pass

    if source_path.suffix.lower() == ".pdf":
        try:
            return _convert_pdf_with_pdf2docx(source_path)
        except Exception:
            pass

    return None


def _run_conversion(lo_bin: str, source_path: Path) -> Optional[str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        src_copy = tmp / source_path.name
        shutil.copy2(source_path, src_copy)

        result = subprocess.run(
            [
                lo_bin,
                "--headless",
                "--norestore",
                "--nofirststartwizard",
                "--convert-to", "docx",
                "--outdir", str(tmp),
                str(src_copy),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            return None

        converted = list(tmp.glob("*.docx"))
        if not converted:
            return None

        dest_name = f"{uuid.uuid4().hex}.docx"
        dest_path = EDITABLE_DIR / dest_name
        shutil.copy2(converted[0], dest_path)

    return f"/api/files/cv/editable/{dest_name}"


def _convert_pdf_with_pdf2docx(source_path: Path) -> Optional[str]:
    """Pure-Python PDF→DOCX via pdf2docx (no LibreOffice needed)."""
    from pdf2docx import Converter  # type: ignore

    dest_name = f"{uuid.uuid4().hex}.docx"
    dest_path = EDITABLE_DIR / dest_name

    cv = Converter(str(source_path))
    try:
        cv.convert(str(dest_path), start=0, end=None)
    finally:
        cv.close()

    if dest_path.exists() and dest_path.stat().st_size > 0:
        return f"/api/files/cv/editable/{dest_name}"
    return None
