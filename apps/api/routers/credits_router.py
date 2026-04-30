"""Router: credit balance, available plans, and fake purchase."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from repositories.credits_repo import add_credits, get_credits
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


class PurchaseRequest(BaseModel):
    plan_id: str


@router.get("/credits")
async def get_user_credits(email: str = Depends(get_current_email)):
    return get_credits(email)


@router.get("/credits/plans")
async def get_plans():
    return {"plans": _PLANS}


@router.post("/credits/purchase")
async def purchase_credits(
    body: PurchaseRequest,
    email: str = Depends(get_current_email),
):
    plan = next((p for p in _PLANS if p["id"] == body.plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan.")
    result = add_credits(email, plan["credits"])
    return {
        "credits": result["credits"],
        "max_credits": result["max_credits"],
        "added": plan["credits"],
        "plan": plan["name"],
    }
