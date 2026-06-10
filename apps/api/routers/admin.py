"""
Admin router — /api/admin/*

Credentials:
  username : oklama
  password : K9xN#m2pLv7fJr

Protected by a short-lived JWT signed with ADMIN_JWT_SECRET.
"""

import hashlib
import os
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from repositories.admin_logs_repo import get_logs, get_sources
from repositories.waitlist_repo import get_waitlist, get_waitlist_count

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)

# ── Credentials (password stored as SHA-256 hex) ─────────────────────────────

_ADMIN_USERNAME = "oklama"
_ADMIN_PASSWORD_HASH = hashlib.sha256("K9xN#m2pLv7fJr".encode()).hexdigest()
_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "jobclawd-admin-secret-xK9nM2pLv7")
_JWT_ALGO = "HS256"
_TOKEN_TTL_HOURS = 8


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _make_token() -> str:
    import time
    payload = {"sub": _ADMIN_USERNAME, "exp": int(time.time()) + _TOKEN_TTL_HOURS * 3600}
    return jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGO)


def _verify_token(credentials: Optional[HTTPAuthorizationCredentials]) -> None:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        jwt.decode(credentials.credentials, _JWT_SECRET, algorithms=[_JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Endpoints ────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/admin/login")
def admin_login(body: LoginRequest):
    if body.username != _ADMIN_USERNAME or _hash(body.password) != _ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": _make_token()}


@router.get("/admin/logs")
def admin_logs(
    limit: int = Query(200, ge=1, le=500),
    source: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    before_id: Optional[int] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    _verify_token(credentials)
    return {
        "logs": get_logs(limit=limit, source=source, level=level, before_id=before_id)
    }


@router.get("/admin/logs/sources")
def admin_log_sources(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    _verify_token(credentials)
    return {"sources": get_sources()}


@router.get("/admin/waitlist")
def admin_waitlist(
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    _verify_token(credentials)
    return {
        "entries": get_waitlist(limit=limit, offset=offset),
        "total": get_waitlist_count(),
    }
