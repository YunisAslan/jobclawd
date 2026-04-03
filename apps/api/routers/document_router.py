"""Router: Document session and PDF->DOCX conversion.

POST /api/document/session                  - create edit session
GET  /api/document/session/{id}             - get session status
POST /api/document/convert-to-docx         - convert PDF to editable DOCX
GET  /api/document/export/{session_id}     - download final DOCX
GET  /api/files/cv/editable/{filename}     - serve editable DOCX files
"""

import asyncio
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

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


# -- Inline request model for convert endpoint --------------------------------

class _ConvertRequest(BaseModel):
    session_id: str


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
