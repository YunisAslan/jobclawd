"""FlareSolverr client — proxies requests through a self-hosted CF-bypass container.

Set FLARESOLVERR_URL env var (e.g. "http://flaresolverr:8191/v1") to enable.
Returns None when disabled or on any failure, so callers can fall back gracefully.
"""

import os
from typing import Optional

import httpx


FLARESOLVERR_URL = os.getenv("FLARESOLVERR_URL", "").strip()


async def fetch_html(url: str, max_timeout: int = 60000) -> Optional[str]:
    """Fetch a URL through FlareSolverr. Returns rendered HTML or None."""
    if not FLARESOLVERR_URL:
        return None

    payload = {
        "cmd": "request.get",
        "url": url,
        "maxTimeout": max_timeout,
    }

    try:
        async with httpx.AsyncClient(timeout=(max_timeout / 1000) + 15) as client:
            resp = await client.post(FLARESOLVERR_URL, json=payload)
        data = resp.json()
    except Exception:
        return None

    if data.get("status") != "ok":
        return None

    solution = data.get("solution") or {}
    if solution.get("status") != 200:
        return None

    html = solution.get("response", "")
    return html if html else None


def is_enabled() -> bool:
    return bool(FLARESOLVERR_URL)
