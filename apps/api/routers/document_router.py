"""Router: Document session, ONLYOFFICE integration, PDF→DOCX conversion.

POST /api/document/session                  – create edit session
GET  /api/document/session/{id}             – get session status
POST /api/document/convert-to-docx         – convert PDF to editable DOCX
POST /api/document/callback/{session_id}   – ONLYOFFICE save callback
POST /api/document/export/{session_id}     – download final DOCX
GET  /api/files/cv/editable/{filename}     – serve editable DOCX files
"""

import asyncio
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from models.schemas import (
    CreateSessionRequest,
    DocumentCallbackRequest,
    DocumentConvertRequest,
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

# ── Editable file storage path ──────────────────────────────────────────────
_EDITABLE_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv" / "editable"
_EDITABLE_DIR.mkdir(parents=True, exist_ok=True)


# ── Session endpoints ────────────────────────────────────────────────────────

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


# ── PDF → DOCX conversion ────────────────────────────────────────────────────

@router.post("/document/convert-to-docx", response_model=DocumentSessionResponse)
async def convert_session_to_docx(
    request: DocumentConvertRequest,
    background_tasks: BackgroundTasks,
    email: str = Depends(get_current_email),
):
    """Trigger PDF→DOCX conversion for a session.  Starts async, poll session for status."""
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["source_type"] != "pdf":
        raise HTTPException(status_code=400, detail="Session source is not a PDF.")
    if session["conversion_status"] in ("done", "pending"):
        return _session_to_response(session)

    # Mark pending immediately
    update_session(request.session_id, conversion_status="pending")
    background_tasks.add_task(_do_conversion, request.session_id, session["cv_url"], request.converter)
    return _session_to_response(get_session(request.session_id))


async def _do_conversion(session_id: str, cv_url: str, converter: str = "auto"):
    """Background task: run conversion and update session."""
    loop = asyncio.get_event_loop()
    editable_url = await loop.run_in_executor(None, convert_to_docx, cv_url, converter)
    if editable_url:
        update_session(session_id, editable_url=editable_url, conversion_status="done")
    else:
        update_session(session_id, conversion_status="failed")


# ── ONLYOFFICE save callback ─────────────────────────────────────────────────

@router.post("/document/callback/{session_id}")
async def onlyoffice_callback(
    session_id: str,
    payload: DocumentCallbackRequest,
):
    """
    ONLYOFFICE calls this endpoint when the user saves the document.
    Status 2 = document is ready; we download it and overwrite the editable file.
    """
    # Always return 0 (success) even on error — otherwise ONLYOFFICE retries endlessly
    try:
        await _handle_callback(session_id, payload)
    except Exception as exc:
        print(f"[Document] Callback error for session {session_id}: {exc}")
    return JSONResponse({"error": 0})


async def _handle_callback(session_id: str, payload: DocumentCallbackRequest):
    """Status 2 = ready to save; download and store the updated file."""
    if payload.status != 2 or not payload.url:
        return

    session = get_session(session_id)
    if not session:
        return

    editable_url = session.get("editable_url")
    if not editable_url:
        return

    # Download the saved document from ONLYOFFICE
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(payload.url)
        response.raise_for_status()
        saved_bytes = response.content

    # Persist to the editable file path
    filename = editable_url.rstrip("/").split("/")[-1]
    dest = _EDITABLE_DIR / filename
    dest.write_bytes(saved_bytes)

    # Bump doc_key so ONLYOFFICE reloads fresh on next open
    import time
    update_session(session_id, doc_key=f"{session_id}_{int(time.time())}")


# ── Export ───────────────────────────────────────────────────────────────────

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


# ── Serve editable files ─────────────────────────────────────────────────────

@router.get("/files/cv/editable/{filename}")
async def serve_editable_cv(filename: str):
    """Serve converted/editable DOCX files.  No auth — ONLYOFFICE needs direct access."""
    safe = "".join(c for c in filename if c.isalnum() or c in "-_.")
    if safe != filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    path = _EDITABLE_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(str(path))


# ── Helpers ──────────────────────────────────────────────────────────────────

def _session_to_response(session: dict) -> DocumentSessionResponse:
    return DocumentSessionResponse(
        session_id=session["session_id"],
        source_type=DocumentSourceType(session["source_type"]),
        preview_url=session["cv_url"],
        editable_url=session.get("editable_url"),
        requires_conversion=session["requires_conversion"],
        conversion_status=DocumentConversionStatus(session.get("conversion_status", "none")),
        cv_name=session.get("cv_name", ""),
        onlyoffice_config=session.get("onlyoffice_config"),
    )
