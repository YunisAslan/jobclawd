"""Service: per-user OpenAI API keys — validate, encrypt, store, resolve.

Every AI feature uses the requesting user's own key. The global OPENAI_API_KEY
env var is no longer used for user-triggered AI operations.
"""
import os
from typing import Optional

import httpx
from fastapi import Depends, HTTPException

from repositories.api_keys_repo import set_key, get_key_row, delete_key
from utils.auth_utils import get_current_email
from utils.crypto import encrypt, decrypt

_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

NO_KEY_DETAIL = {
    "code": "NO_API_KEY",
    "message": "Add your OpenAI API key to use AI features.",
}


async def validate_openai_key(key: str) -> bool:
    """Return True if the key is accepted by OpenAI (cheap /models probe)."""
    key = (key or "").strip()
    if not key.startswith("sk-"):
        return False
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{_OPENAI_BASE_URL}/models",
                headers={"Authorization": f"Bearer {key}"},
            )
        return resp.status_code == 200
    except Exception:
        return False


async def save_key(email: str, key: str) -> dict:
    """Validate the key against OpenAI, then store it encrypted. Raises 422 if invalid."""
    key = (key or "").strip()
    if not await validate_openai_key(key):
        raise HTTPException(
            status_code=422,
            detail="That OpenAI API key was rejected. Check it and try again.",
        )
    hint = f"…{key[-4:]}" if len(key) >= 4 else "…"
    set_key(email, encrypt(key), hint)
    return {"has_key": True, "key_hint": hint}


def get_key(email: str) -> Optional[str]:
    """Return the user's decrypted OpenAI key, or None if absent/undecryptable."""
    row = get_key_row(email)
    if not row:
        return None
    return decrypt(row["openai_key"])


def get_status(email: str) -> dict:
    """Return whether the user has a key set, plus a safe display hint."""
    row = get_key_row(email)
    if not row:
        return {"has_key": False, "key_hint": None}
    return {"has_key": True, "key_hint": row.get("key_hint")}


def remove_key(email: str) -> None:
    delete_key(email)


def require_openai_key(email: str = Depends(get_current_email)) -> str:
    """FastAPI dependency: resolve the caller's OpenAI key or raise 403 NO_API_KEY."""
    key = get_key(email)
    if not key:
        raise HTTPException(status_code=403, detail=NO_KEY_DETAIL)
    return key
