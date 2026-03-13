"""Shared JWT auth dependency for protected endpoints."""
import os
from pathlib import Path
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException

ROOT_ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"

if ROOT_ENV_PATH.exists():
    load_dotenv(dotenv_path=ROOT_ENV_PATH)
    
JWT_SECRET = os.getenv("JWT_SECRET", "changeme-local-dev-only")


def get_current_email(authorization: Optional[str] = Header(default=None)) -> str:
    """Extract and validate JWT from Authorization header; return the user email."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        email: str = payload.get("sub", "")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token.")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


def get_optional_email(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    """Like get_current_email but returns None instead of raising for unauthenticated requests."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub") or None
    except jwt.InvalidTokenError:
        return None
