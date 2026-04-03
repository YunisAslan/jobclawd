"""Document session management.

A session ties a CV file to an edit workspace.  Sessions are stored
in memory (they are ephemeral -- the user just opens a new session if
the server restarts).

Key responsibilities:
- Create session from cv_url, determine source type (pdf/docx)
- Store reference to converted editable file (for PDF -> DOCX flows)
"""

import re
import time
import uuid
from pathlib import Path
from typing import Optional

_sessions: dict[str, dict] = {}   # session_id -> session data

CV_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"
EDITABLE_DIR = CV_DIR / "editable"
EDITABLE_DIR.mkdir(parents=True, exist_ok=True)


def create_session(cv_url: str, user_email: str, user_name: str = "") -> dict:
    """Create a new document editing session for the given CV URL."""
    session_id = uuid.uuid4().hex
    ext = Path(cv_url.rstrip("/").split("/")[-1]).suffix.lower()
    source_type = "pdf" if ext == ".pdf" else "docx"

    session = {
        "session_id": session_id,
        "cv_url": cv_url,
        "source_type": source_type,
        "editable_url": cv_url if source_type == "docx" else None,
        "requires_conversion": source_type == "pdf",
        "conversion_status": "none",
        "cv_name": _infer_cv_name(cv_url),
        "user_email": user_email,
        "user_name": user_name or user_email.split("@")[0],
    }

    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> Optional[dict]:
    return _sessions.get(session_id)


def update_session(session_id: str, **kwargs) -> Optional[dict]:
    session = _sessions.get(session_id)
    if session is None:
        return None
    session.update(kwargs)
    return session


def _infer_cv_name(cv_url: str) -> str:
    stem = Path(cv_url.rstrip("/").split("/")[-1]).stem
    # Remove uuid prefix if it looks like one (32 hex chars)
    clean = re.sub(r"^[0-9a-f]{32}", "", stem).strip("-_") or stem
    return clean or "CV"
