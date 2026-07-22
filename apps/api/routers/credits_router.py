"""Router: credit balance, available plans, and waitlist.

Paid purchases are disabled — payment processors currently restrict job-aggregation
platforms, so the frontend shows an informational modal instead of a checkout.
"""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

from repositories.credits_repo import get_credits
from repositories.waitlist_repo import add_to_waitlist
from utils.auth_utils import get_current_email

router = APIRouter(tags=["credits"])

_PLANS = [
    {
        "id": "starter",
        "name": "Starter",
        "credits": 20,
        "price_usd": 1.99,
        "popular": False,
        "description": "Good for a short job hunt",
    },
    {
        "id": "value",
        "name": "Value",
        "credits": 60,
        "price_usd": 4.99,
        "popular": True,
        "description": "Most popular for active seekers",
    },
    {
        "id": "power",
        "name": "Power",
        "credits": 150,
        "price_usd": 10.99,
        "popular": False,
        "description": "For serious, full-time job hunting",
    },
]


class WaitlistRequest(BaseModel):
    email: str


@router.get("/credits")
async def get_user_credits(email: str = Depends(get_current_email)):
    return get_credits(email)


@router.get("/credits/plans")
async def get_plans():
    return {"plans": _PLANS}


@router.post("/credits/waitlist")
async def join_waitlist(body: WaitlistRequest):
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Invalid email address.")
    already_on_list = not add_to_waitlist(email)
    return {"already_registered": already_on_list}
