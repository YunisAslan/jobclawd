"""Router: manage the caller's own OpenAI API key (BYOK)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from services.api_keys_service import save_key, get_status, remove_key
from utils.auth_utils import get_current_email

router = APIRouter(tags=["api-keys"])


class OpenAIKeyRequest(BaseModel):
    key: str


@router.get("/settings/openai-key")
async def openai_key_status(email: str = Depends(get_current_email)):
    return get_status(email)


@router.put("/settings/openai-key")
async def set_openai_key(body: OpenAIKeyRequest, email: str = Depends(get_current_email)):
    return await save_key(email, body.key)


@router.delete("/settings/openai-key")
async def delete_openai_key(email: str = Depends(get_current_email)):
    remove_key(email)
    return {"has_key": False, "key_hint": None}
