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
    demo: bool = False

class _SaveRequest(BaseModel):
    cv_url: str
    data: CVData
    cv_name: Optional[str] = None

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
    from services.api_keys_service import get_key, NO_KEY_DETAIL
    from repositories.cv_parse_cache_repo import get_cv_parse, set_cv_parse

    if request.demo:
        from demo.demo_data import DEMO_CV_DATA
        return {"data": DEMO_CV_DATA.model_dump(), "cv_name": "Demo CV"}

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
            # Run cached JSON through CVData so pre-structured-entries caches
            # (additional_sections shaped as list[str]) get coerced on read.
            normalized = CVData.model_validate(cached["data"]).model_dump()
            return {"data": normalized, "cv_name": cached["cv_name"] or cv_name}
    except Exception:
        pass

    # ── Parse (LLM) — requires the user's own OpenAI key ────────────────────────
    api_key = get_key(email) or ""
    if not api_key:
        raise HTTPException(status_code=403, detail=NO_KEY_DETAIL)

    data = await parse_cv(filepath, api_key)
    if not data:
        raise HTTPException(status_code=400, detail="Could not parse CV content.")

    parsed = data.model_dump()

    # ── Cache write ───────────────────────────────────────────────────────────
    try:
        set_cv_parse(cv_url, parsed, cv_name)
    except Exception:
        pass

    return {"data": parsed, "cv_name": cv_name}


# -- Save edited CV data back to parse cache -----------------------------------

@router.patch("/document/parse")
async def save_cv_endpoint(
    request: _SaveRequest,
    email: str = Depends(get_current_email),
):
    """Persist user-edited CVData back to the parse cache so edits survive page refreshes."""
    from repositories.cv_parse_cache_repo import update_cv_parse
    update_cv_parse(request.cv_url, request.data.model_dump(), request.cv_name or "")
    return {"ok": True}


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
