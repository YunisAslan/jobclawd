"""Shared helpers for the simpler scrapers (RemoteOK, Remote.co, WWR, etc.)."""

from typing import Optional
import re
from datetime import datetime, timedelta, timezone

from models.schemas import LocationFilter
from db.database import get_db


_DATE_PRESETS = {
    "1d": 1,
    "today": 1,
    "past-24h": 1,
    "3d": 3,
    "7d": 7,
    "past-week": 7,
    "1m": 30,
    "past-month": 30,
}


def date_posted_cutoff(date_posted: Optional[str]) -> Optional[datetime]:
    days = _DATE_PRESETS.get((date_posted or "").lower())
    if not days:
        return None
    return datetime.now(timezone.utc) - timedelta(days=days)


def parse_iso_date(value: object) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(int(value), tz=timezone.utc)
        except Exception:
            return None
    s = str(value).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S GMT"):
        try:
            dt = datetime.strptime(s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            continue
    return None


def relative_to_iso(text: str) -> Optional[str]:
    """Convert phrases like '3 days ago', 'today', '1 hour ago' to an ISO date string."""
    if not text:
        return None
    t = text.strip().lower()
    now = datetime.now(timezone.utc)
    if "just" in t or "moment" in t or "now" in t or "today" in t:
        return now.isoformat()
    if "yesterday" in t:
        return (now - timedelta(days=1)).isoformat()
    m = re.search(r"(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago", t)
    if not m:
        return None
    n = int(m.group(1))
    unit = m.group(2)
    delta = {
        "minute": timedelta(minutes=n),
        "hour": timedelta(hours=n),
        "day": timedelta(days=n),
        "week": timedelta(weeks=n),
        "month": timedelta(days=n * 30),
        "year": timedelta(days=n * 365),
    }.get(unit)
    if not delta:
        return None
    return (now - delta).isoformat()


def resolve_location_label(location: Optional[LocationFilter]) -> Optional[str]:
    """Return a human-readable location label suitable for URL params (e.g. 'Berlin', 'Germany')."""
    if not location:
        return None
    if location.type == "region" and (location.value or "").lower() == "worldwide":
        return None

    val = None
    if location.values and len(location.values) > 0:
        val = location.values[0]
    elif location.value:
        val = location.value
    if not val:
        return None

    try:
        with get_db() as conn:
            if location.type == "country":
                row = conn.execute(
                    "SELECT name FROM countries WHERE code = %s", (val,)
                ).fetchone()
                if row:
                    return row["name"]
            elif location.type == "city":
                row = conn.execute(
                    "SELECT name FROM cities WHERE value = %s", (val,)
                ).fetchone()
                if row:
                    return row["name"]
    except Exception:
        pass

    if "-" in val:
        return val.split("-", 1)[1].title()
    return val.title()


def location_includes_remote(location: Optional[LocationFilter]) -> bool:
    """Detect 'Remote' / 'Worldwide' style locations."""
    if not location:
        return True
    if location.type == "region":
        return (location.value or "").lower() in ("worldwide", "remote", "")
    label = resolve_location_label(location) or ""
    return "remote" in label.lower()


def normalize_query(query: str) -> str:
    return re.sub(r"\s+", " ", (query or "").strip())


def matches_work_mode(filters: Optional[list[str]], modes_present: list[str]) -> bool:
    """Return True if any selected work mode matches the listing's known modes."""
    if not filters:
        return True
    selected = {m.lower() for m in filters}
    listed = {m.lower() for m in modes_present}
    return bool(selected & listed)


def matches_job_type(filters: Optional[list[str]], job_types_present: list[str]) -> bool:
    if not filters:
        return True
    selected = {m.lower() for m in filters}
    listed = {m.lower().replace(" ", "-") for m in job_types_present}
    return bool(selected & listed)


def basic_text_match(query: str, *texts: str) -> bool:
    """Loose keyword overlap fallback used when an API doesn't filter for us."""
    q = (query or "").lower().strip()
    if not q:
        return True
    haystack = " ".join((t or "").lower() for t in texts)
    if not haystack:
        return False
    tokens = [tok for tok in re.split(r"[\s,/&\-+]+", q) if len(tok) >= 2]
    if not tokens:
        return q in haystack
    return any(tok in haystack for tok in tokens)
