"""Repository: CV structured parse cache keyed by cv_url.

The cv_url contains a UUID (e.g. /api/files/cv/abc123.pdf) so the content is
immutable — no TTL needed. We use ON CONFLICT DO NOTHING to avoid overwriting
a valid entry with an identical re-parse.
"""
import json
from typing import Optional

from db.database import get_db


def get_cv_parse(cv_url: str) -> Optional[dict]:
    """Return cached CVData dict + cv_name if present, else None."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT parsed_json, cv_name FROM cv_parse_cache WHERE cv_url = %s",
            (cv_url,),
        ).fetchone()

    if row is None:
        return None

    parsed = row["parsed_json"]
    if isinstance(parsed, str):
        parsed = json.loads(parsed)

    return {"data": parsed, "cv_name": row["cv_name"]}


def set_cv_parse(cv_url: str, parsed: dict, cv_name: str = "") -> None:
    """Insert a parse result. Does nothing if the URL is already cached."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO cv_parse_cache (cv_url, parsed_json, cv_name)
            VALUES (%s, %s::jsonb, %s)
            ON CONFLICT (cv_url) DO NOTHING
            """,
            (cv_url, json.dumps(parsed), cv_name),
        )
