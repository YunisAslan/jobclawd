"""Router: User profile persistence + file uploads.

GET  /profile                   — load profile for authenticated user
POST /profile                   — save profile for authenticated user
POST /profile/cv/upload         — upload CV (PDF / DOCX), returns { name, url }
POST /profile/avatar/upload     — upload avatar image (PNG / JPG / WEBP), returns { url }
GET  /files/cv/{filename}       — serve an uploaded CV file
GET  /files/avatar/{filename}   — serve an uploaded avatar image
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

CV_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"
CV_DIR.mkdir(parents=True, exist_ok=True)

AVATAR_DIR = Path(__file__).resolve().parent.parent / "uploads" / "avatar"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


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
            detail="Unsupported file type. Allowed: PDF, DOCX.",
        )
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    (CV_DIR / safe_name).write_bytes(content)

    display_name = Path(file.filename or "CV").stem
    return {"name": display_name, "url": f"/api/files/cv/{safe_name}"}


@router.post("/profile/avatar/upload")
async def upload_avatar(
    file: UploadFile = File(...),
    email: str = Depends(get_current_email),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PNG, JPG, WEBP.",
        )
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB).")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    (AVATAR_DIR / safe_name).write_bytes(content)

    url = f"/api/files/avatar/{safe_name}"

    # Persist avatar_url in profile
    data = get_profile(email) or {}
    data["avatar_url"] = url
    data["email"] = email
    save_profile(email, data)

    return {"url": url}


def _serve_file(directory: Path, filename: str) -> FileResponse:
    """Shared helper to safely serve an uploaded file."""
    safe = "".join(c for c in filename if c.isalnum() or c in "-_.")
    if safe != filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    path = directory / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(str(path))


@router.get("/files/cv/{filename}")
async def serve_cv(filename: str):
    return _serve_file(CV_DIR, filename)


@router.get("/files/avatar/{filename}")
async def serve_avatar(filename: str):
    return _serve_file(AVATAR_DIR, filename)
