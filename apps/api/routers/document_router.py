"""Router: CV parsing and PDF generation.

The new model flow: PDF/DOCX → extract text → LLM parses to JSON → user edits
JSON via structured editor → generate clean PDF from JSON.

No more PDF→DOCX conversion or HTML editing.

POST /api/document/parse    - parse CV into structured JSON (LLM-based)
POST /api/document/generate - generate PDF from structured JSON
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from models.cv_schema import CVData
from utils.auth_utils import get_current_email

router = APIRouter(tags=["document"])

# -- CV file storage path -----------------------------------------------------
_CV_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"


# -- Request models ------------------------------------------------------------

class _ParseRequest(BaseModel):
    cv_url: str

class _GenerateRequest(BaseModel):
    data: CVData
    file_name: Optional[str] = None


# -- Structured parsing (LLM-based) -------------------------------------------

@router.post("/document/parse")
async def parse_cv_endpoint(
    request: _ParseRequest,
    email: str = Depends(get_current_email),
):
    """Parse a PDF/DOCX CV into structured CVData JSON using LLM extraction."""
    from services.cv_parser_service import parse_cv
    from repositories.cv_parse_cache_repo import get_cv_parse, set_cv_parse

    cv_url = request.cv_url
    filename = cv_url.rstrip("/").split("/")[-1]

    filepath = _CV_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="CV file not found.")

    cv_name = filepath.stem.replace("-", " ").replace("_", " ").strip()

    # ── Cache lookup ──────────────────────────────────────────────────────────
    try:
        cached = get_cv_parse(cv_url)
        if cached:
            return {"data": cached["data"], "cv_name": cached["cv_name"] or cv_name}
    except Exception:
        pass

    # ── Parse ─────────────────────────────────────────────────────────────────
    data = await parse_cv(filepath)
    if not data:
        raise HTTPException(status_code=400, detail="Could not parse CV content.")

    parsed = data.model_dump()

    # ── Cache write ───────────────────────────────────────────────────────────
    try:
        set_cv_parse(cv_url, parsed, cv_name)
    except Exception:
        pass

    return {"data": parsed, "cv_name": cv_name}


# -- PDF generation from structured data ---------------------------------------

@router.post("/document/generate")
async def generate_cv_endpoint(
    request: _GenerateRequest,
    email: str = Depends(get_current_email),
):
    """Generate a clean PDF from structured CVData."""
    from services.cv_pdf_generator import generate_cv_pdf

    try:
        buf = generate_cv_pdf(request.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    file_name = request.file_name or "cv"
    if not file_name.endswith(".pdf"):
        file_name += ".pdf"

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )
