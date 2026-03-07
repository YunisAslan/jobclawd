"""Router: User profile persistence + CV file upload.

GET  /profile                   — load profile for authenticated user
POST /profile                   — save profile for authenticated user
POST /profile/cv/upload         — upload CV (PDF / DOC / DOCX), returns { name, url }
GET  /files/cv/{filename}       — serve an uploaded CV file
"""
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from models.schemas import UserProfile
from repositories.profile_repo import get_profile, save_profile
from utils.auth_utils import get_current_email

router = APIRouter(tags=["profile"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/profile")
async def get_user_profile(email: str = Depends(get_current_email)):
    data = get_profile(email)
    if data is None:
        return UserProfile(name="", email=email).model_dump()
    data["email"] = email  # always authoritative from JWT
    return data


@router.post("/profile")
async def save_user_profile(
    profile: UserProfile,
    email: str = Depends(get_current_email),
):
    data = profile.model_dump()
    data["email"] = email
    save_profile(email, data)
    return {"success": True}


@router.post("/profile/cv/upload")
async def upload_cv(
    file: UploadFile = File(...),
    email: str = Depends(get_current_email),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, DOC, DOCX.",
        )
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    (UPLOADS_DIR / safe_name).write_bytes(content)

    display_name = Path(file.filename or "CV").stem
    return {"name": display_name, "url": f"/api/files/cv/{safe_name}"}


@router.get("/files/cv/{filename}")
async def serve_cv(filename: str, email: str = Depends(get_current_email)):
    # Prevent path traversal — only allow safe chars
    safe = "".join(c for c in filename if c.isalnum() or c in "-_.")
    if safe != filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    path = UPLOADS_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(str(path))
