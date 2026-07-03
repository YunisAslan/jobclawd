"""Router: credit balance, available plans, waitlist, and the Gumroad purchase webhook."""
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

from repositories.credits_repo import get_credits
from repositories.waitlist_repo import add_to_waitlist
from services.gumroad_service import process_ping
from utils.auth_utils import get_current_email

router = APIRouter(tags=["credits"])

# Gumroad checkout links per plan (base URL — the frontend appends email + wanted=true).
_CHECKOUT = {
    "starter": "https://jobclawd.gumroad.com/l/jobclawd-value-20",
    "value": "https://jobclawd.gumroad.com/l/jobclawd-value-60",
    "power": "https://jobclawd.gumroad.com/l/jobclawd-power-150",
}

_PLANS = [
    {
        "id": "starter",
        "name": "Starter",
        "credits": 20,
        "price_usd": 1.99,
        "popular": False,
        "description": "Good for a short job hunt",
        "checkout_url": _CHECKOUT["starter"],
    },
    {
        "id": "value",
        "name": "Value",
        "credits": 60,
        "price_usd": 4.99,
        "popular": True,
        "description": "Most popular for active seekers",
        "checkout_url": _CHECKOUT["value"],
    },
    {
        "id": "power",
        "name": "Power",
        "credits": 150,
        "price_usd": 10.99,
        "popular": False,
        "description": "For serious, full-time job hunting",
        "checkout_url": _CHECKOUT["power"],
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


@router.post("/credits/gumroad-webhook")
async def gumroad_webhook(request: Request):
    """Receive Gumroad sale Pings (form-encoded). Verifies each sale against the
    Gumroad API and grants credits to the buyer's email exactly once."""
    form = dict(await request.form())
    result = await process_ping(form)
    if result.get("status") == "rejected":
        raise HTTPException(status_code=403, detail=result.get("reason", "rejected"))
    return result
