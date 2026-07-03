"""Service: process Gumroad sale Pings — verify against the API, map to credits, grant.

Security model: a Ping is untrusted form data. We never credit based on the Ping body
alone — we re-fetch the sale from the Gumroad API using our secret access token and
credit only from the authoritative response. This makes spoofed Pings harmless.
"""
import os

import httpx

from repositories.gumroad_repo import credit_if_new

_ACCESS_TOKEN = os.getenv("GUMROAD_ACCESS_TOKEN", "").strip()
_SELLER_ID = os.getenv("GUMROAD_SELLER_ID", "").strip()
_API_BASE = "https://api.gumroad.com/v2"

# Map a product to the credits it grants. Primary: product permalink (short code).
# Fallback: unit price in cents — resilient if a permalink is ever changed.
_PERMALINK_CREDITS = {
    "jobclawd-value-20": 20,   # Starter
    "jobclawd-value-60": 60,   # Value
    "jobclawd-power-150": 150,  # Power
}
_PRICE_CREDITS = {
    199: 20,
    499: 60,
    1099: 150,
}


def _credits_for(permalink: str, price_cents: int) -> int:
    if permalink and permalink in _PERMALINK_CREDITS:
        return _PERMALINK_CREDITS[permalink]
    return _PRICE_CREDITS.get(price_cents, 0)


async def _verify_sale(sale_id: str) -> dict | None:
    """Fetch the authoritative sale from Gumroad. Returns the sale dict, or None if
    it cannot be verified. Raises on transient/server errors so the caller can 500
    and let Gumroad retry."""
    if not _ACCESS_TOKEN:
        print("[Gumroad] GUMROAD_ACCESS_TOKEN not set — cannot verify sales.")
        return None

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{_API_BASE}/sales/{sale_id}",
            params={"access_token": _ACCESS_TOKEN},
        )

    if resp.status_code == 200:
        data = resp.json()
        return data.get("sale") if data.get("success") else None
    if resp.status_code in (401, 403, 404):
        return None  # definitively not verifiable — do not retry
    resp.raise_for_status()  # 5xx etc. → bubble up → 500 → Gumroad retries
    return None


def _extract_permalink(sale: dict, form: dict) -> str:
    permalink = (sale.get("permalink") or "").strip()
    if permalink:
        return permalink
    raw = (sale.get("product_permalink") or form.get("permalink") or "").strip()
    return raw.rstrip("/").split("/")[-1] if raw else ""


async def process_ping(form: dict) -> dict:
    """Handle a Gumroad Ping. Returns a status dict:
      status = credited | duplicate | skipped | ignored | rejected
    'rejected' means the caller should respond 403; everything else is a 200 ack.
    """
    sale_id = (form.get("sale_id") or "").strip()
    if not sale_id:
        return {"status": "ignored", "reason": "no sale_id"}

    seller_id = (form.get("seller_id") or "").strip()
    if _SELLER_ID and seller_id and seller_id != _SELLER_ID:
        return {"status": "rejected", "reason": "seller mismatch"}

    sale = await _verify_sale(sale_id)
    if sale is None:
        return {"status": "rejected", "reason": "sale not verified"}

    # Never credit a refunded / disputed / charged-back sale.
    if sale.get("refunded") or sale.get("disputed") or sale.get("chargebacked"):
        return {"status": "skipped", "reason": "refunded or disputed"}

    email = (sale.get("email") or form.get("email") or "").strip().lower()
    if not email:
        return {"status": "ignored", "reason": "no email"}

    permalink = _extract_permalink(sale, form)
    try:
        price_cents = int(sale.get("price") or form.get("price") or 0)
    except (TypeError, ValueError):
        price_cents = 0

    credits = _credits_for(permalink, price_cents)
    if credits <= 0:
        print(f"[Gumroad] Unknown product (permalink={permalink!r}, price={price_cents}) — not credited.")
        return {"status": "ignored", "reason": "unknown product"}

    granted = credit_if_new(sale_id, email, permalink, credits)
    if granted:
        print(f"[Gumroad] Granted {credits} credits to {email} (sale {sale_id}).")
        return {"status": "credited", "email": email, "credits": credits}
    return {"status": "duplicate", "email": email, "credits": credits}
