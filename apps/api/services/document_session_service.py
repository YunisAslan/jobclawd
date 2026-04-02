"""Document session management.

A session ties a CV file to an edit workspace.  Sessions are stored
in memory (they are ephemeral — the user just opens a new session if
the server restarts).

Key responsibilities:
- Create session from cv_url, determine source type (pdf/docx)
- Build ONLYOFFICE editor config with JWT-signed token
- Store reference to converted editable file (for PDF → DOCX flows)
"""

import os
import time
import uuid
from pathlib import Path
from typing import Optional

_sessions: dict[str, dict] = {}   # session_id → session data

CV_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"
EDITABLE_DIR = CV_DIR / "editable"
EDITABLE_DIR.mkdir(parents=True, exist_ok=True)

_ONLYOFFICE_JWT_SECRET = os.getenv("ONLYOFFICE_JWT_SECRET", "onlyoffice_dev_secret")
# URL ONLYOFFICE server uses to reach this API (inside Docker network)
_API_INTERNAL_URL = os.getenv("ONLYOFFICE_API_INTERNAL_URL", "http://localhost:8000")
# URL the browser uses to reach ONLYOFFICE
_OO_BROWSER_URL = os.getenv("ONLYOFFICE_DOCUMENT_SERVER_URL", "http://localhost:8080")


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
        "created_at": time.time(),
        "doc_key": f"{session_id}_{int(time.time())}",
    }

    # Build ONLYOFFICE config for DOCX immediately
    if source_type == "docx":
        session["onlyoffice_config"] = _build_oo_config(session)

    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> Optional[dict]:
    return _sessions.get(session_id)


def update_session(session_id: str, **kwargs) -> Optional[dict]:
    session = _sessions.get(session_id)
    if session is None:
        return None
    session.update(kwargs)
    # Rebuild ONLYOFFICE config when editable_url becomes available
    if "editable_url" in kwargs and kwargs["editable_url"]:
        session["doc_key"] = f"{session_id}_{int(time.time())}"
        session["onlyoffice_config"] = _build_oo_config(session)
    return session


def _build_oo_config(session: dict) -> Optional[dict]:
    """Build a JWT-signed ONLYOFFICE editor configuration dict."""
    editable_url = session.get("editable_url")
    if not editable_url:
        return None

    # Convert relative API path to absolute URL accessible from ONLYOFFICE container
    internal_doc_url = _to_internal_url(editable_url)
    callback_url = f"{_API_INTERNAL_URL}/api/document/callback/{session['session_id']}"

    config: dict = {
        "documentType": "word",
        "document": {
            "fileType": "docx",
            "key": session["doc_key"],
            "title": session.get("cv_name", "CV") + ".docx",
            "url": internal_doc_url,
            "permissions": {
                "edit": True,
                "download": True,
                "print": True,
                "review": False,
                "comment": False,
            },
        },
        "editorConfig": {
            "callbackUrl": callback_url,
            "mode": "edit",
            "lang": "en",
            "user": {
                "id": session.get("user_email", "user"),
                "name": session.get("user_name", "User"),
            },
            "customization": {
                "autosave": True,
                "forcesave": False,
                "compactToolbar": False,
                "hideRightMenu": True,
                "toolbar": True,
                "statusBar": False,
                "chat": False,
                "comments": False,
                "zoom": 100,
                "logo": {"visible": False},
                "plugins": False,
            },
        },
        "type": "desktop",
        "height": "100%",
        "width": "100%",
    }

    # Always sign the config — ONLYOFFICE enables JWT by default and auto-generates a secret
    config["token"] = _sign_config(config)
    # Add browser-accessible server URL for the frontend script tag
    config["_server_url"] = _OO_BROWSER_URL

    return config


def _to_internal_url(cv_url: str) -> str:
    """Convert a /api/... relative URL to the internal absolute URL."""
    if cv_url.startswith("http"):
        return cv_url
    return f"{_API_INTERNAL_URL}{cv_url}"


def _sign_config(config: dict) -> str:
    """JWT-sign an ONLYOFFICE config dict.  Returns empty string if PyJWT unavailable."""
    try:
        import jwt as _jwt  # type: ignore
        return _jwt.encode(config, _ONLYOFFICE_JWT_SECRET, algorithm="HS256")
    except Exception:
        return ""


def _infer_cv_name(cv_url: str) -> str:
    stem = Path(cv_url.rstrip("/").split("/")[-1]).stem
    # Remove uuid prefix if it looks like one (32 hex chars)
    import re
    clean = re.sub(r"^[0-9a-f]{32}", "", stem).strip("-_") or stem
    return clean or "CV"
