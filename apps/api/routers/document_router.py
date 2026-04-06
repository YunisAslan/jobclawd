"""Router: Document session, parsing, and PDF generation.

POST /api/document/session                  - create edit session
GET  /api/document/session/{id}             - get session status
POST /api/document/convert-to-docx         - convert PDF to editable DOCX
POST /api/document/parse                   - parse CV into structured JSON
POST /api/document/generate                - generate PDF from structured JSON
GET  /api/document/export/{session_id}     - download final DOCX
GET  /api/files/cv/editable/{filename}     - serve editable DOCX files
"""

import asyncio
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from models.cv_schema import CVData
from models.schemas import (
    CreateSessionRequest,
    DocumentSessionResponse,
    DocumentSourceType,
    DocumentConversionStatus,
)
from services.document_session_service import (
    create_session,
    get_session,
    update_session,
    EDITABLE_DIR,
)
from services.document_conversion_service import convert_to_docx
from utils.auth_utils import get_current_email

router = APIRouter(tags=["document"])

# -- Editable file storage path -----------------------------------------------
_EDITABLE_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv" / "editable"
_EDITABLE_DIR.mkdir(parents=True, exist_ok=True)


# -- Request models ------------------------------------------------------------

class _ConvertRequest(BaseModel):
    session_id: str

class _ParseRequest(BaseModel):
    cv_url: str

class _GenerateRequest(BaseModel):
    data: CVData
    file_name: str | None = None


# -- Session endpoints ---------------------------------------------------------

@router.post("/document/session", response_model=DocumentSessionResponse)
async def create_document_session(
    request: CreateSessionRequest,
    email: str = Depends(get_current_email),
):
    """Create a new document editing session for the given CV URL."""
    session = create_session(
        cv_url=request.cv_url,
        user_email=email,
        user_name=email.split("@")[0],
    )
    return _session_to_response(session)


@router.get("/document/session/{session_id}", response_model=DocumentSessionResponse)
async def get_document_session(
    session_id: str,
    email: str = Depends(get_current_email),
):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return _session_to_response(session)


# -- Structured parsing --------------------------------------------------------

@router.post("/document/parse")
async def parse_cv_endpoint(
    request: _ParseRequest,
    email: str = Depends(get_current_email),
):
    """Parse a PDF/DOCX CV into structured CVData JSON."""
    from services.cv_parser_service import parse_cv
    from services.cv_extractor import CV_DIR

    cv_url = request.cv_url
    filename = cv_url.rstrip("/").split("/")[-1]

    # Check both regular and editable directories
    filepath = CV_DIR / filename
    if not filepath.exists():
        filepath = _EDITABLE_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="CV file not found.")

    data = parse_cv(filepath)
    if not data:
        raise HTTPException(status_code=400, detail="Could not parse CV content.")

    cv_name = filepath.stem.replace("-", " ").replace("_", " ").strip()
    return {"data": data.model_dump(), "cv_name": cv_name}


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


# -- PDF -> DOCX conversion ---------------------------------------------------

@router.post("/document/convert-to-docx", response_model=DocumentSessionResponse)
async def convert_session_to_docx(
    request: _ConvertRequest,
    background_tasks: BackgroundTasks,
    email: str = Depends(get_current_email),
):
    """Trigger PDF->DOCX conversion for a session.  Starts async, poll session for status."""
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["source_type"] != "pdf":
        raise HTTPException(status_code=400, detail="Session source is not a PDF.")
    if session["conversion_status"] == "pending":
        return _session_to_response(session)

    # Allow re-conversion: reset status, clear old editable file
    update_session(request.session_id, conversion_status="pending", editable_url=None)
    background_tasks.add_task(_do_conversion, request.session_id, session["cv_url"])
    return _session_to_response(get_session(request.session_id))


async def _do_conversion(session_id: str, cv_url: str):
    """Background task: run conversion and update session."""
    loop = asyncio.get_event_loop()
    editable_url = await loop.run_in_executor(None, convert_to_docx, cv_url)
    if editable_url:
        update_session(session_id, editable_url=editable_url, conversion_status="done")
    else:
        update_session(session_id, conversion_status="failed")


# -- Extract HTML from converted DOCX -----------------------------------------

@router.get("/document/extract-html/{session_id}")
async def extract_html(
    session_id: str,
    email: str = Depends(get_current_email),
):
    """Return HTML representation of the converted DOCX for editing."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    editable_url = session.get("editable_url")
    if not editable_url:
        raise HTTPException(status_code=400, detail="No editable file available yet.")

    filename = editable_url.rstrip("/").split("/")[-1]
    path = _EDITABLE_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Converted file not found.")

    # Use the HTML converter for faithful rendering
    try:
        from services.cv_html_converter import convert_docx_to_html
        html = convert_docx_to_html(path)
    except Exception:
        html = None

    if not html:
        # Fallback: plain text wrapped in <p> tags
        from services.cv_extractor import extract_cv_text as _extract_text
        import html as _html_mod
        # temporarily symlink-resolve to extract from editable dir
        text = None
        try:
            import zipfile
            from xml.etree import ElementTree as ET
            with zipfile.ZipFile(path) as z:
                xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = tree.findall(".//w:p", ns)
            lines = []
            for p in paragraphs:
                texts = p.findall(".//w:t", ns)
                line = "".join(t.text or "" for t in texts)
                if line.strip():
                    lines.append(line)
            text = "\n".join(lines) if lines else None
        except Exception:
            pass

        if not text:
            raise HTTPException(status_code=500, detail="Could not extract content from converted file.")
        html = "".join(f"<p>{_html_mod.escape(line)}</p>" for line in text.splitlines() if line.strip())

    return {"html": html, "cv_name": session.get("cv_name", "")}


# -- Export --------------------------------------------------------------------

@router.get("/document/export/{session_id}")
async def export_document(
    session_id: str,
    email: str = Depends(get_current_email),
):
    """Download the editable DOCX file for a session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    editable_url = session.get("editable_url")
    if not editable_url:
        raise HTTPException(status_code=400, detail="No editable file available yet.")

    filename = editable_url.rstrip("/").split("/")[-1]
    path = _EDITABLE_DIR / filename
    if not path.exists():
        # Fall back to original CV dir
        from services.document_session_service import CV_DIR as _CV_DIR
        path = _CV_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    display_name = f"{session.get('cv_name', 'cv')}.docx"
    return FileResponse(
        str(path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{display_name}"'},
    )


# -- Serve editable files -----------------------------------------------------

@router.get("/files/cv/editable/{filename}")
async def serve_editable_cv(filename: str):
    """Serve converted/editable DOCX files."""
    safe = "".join(c for c in filename if c.isalnum() or c in "-_.")
    if safe != filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    path = _EDITABLE_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(str(path))


# -- Helpers -------------------------------------------------------------------

def _session_to_response(session: dict) -> DocumentSessionResponse:
    return DocumentSessionResponse(
        session_id=session["session_id"],
        source_type=DocumentSourceType(session["source_type"]),
        preview_url=session["cv_url"],
        editable_url=session.get("editable_url"),
        requires_conversion=session["requires_conversion"],
        conversion_status=DocumentConversionStatus(session.get("conversion_status", "none")),
        cv_name=session.get("cv_name", ""),
    )
