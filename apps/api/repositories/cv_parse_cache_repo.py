"""Repository: CV structured parse cache keyed by cv_url.

The cv_url contains a UUID (e.g. /api/files/cv/abc123.pdf) so the content is
immutable. However, the *shape* of the parsed JSON can change when the schema
evolves (e.g. the move to structured `additional_sections`), so each cache row
is stamped with a `schema_version` and reads below the current version are
treated as cache misses so the caller re-parses.
"""
import json
from typing import Optional

from db.database import get_db

# Bump this whenever the CVData schema or the LLM extraction prompt changes
# in a way that should invalidate previously-cached parses.
CURRENT_SCHEMA_VERSION = 3


def get_cv_parse(cv_url: str) -> Optional[dict]:
    """Return cached CVData dict + cv_name if present and at the current schema
    version. Stale-version rows return None so the caller re-parses with the
    current prompt/schema."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT parsed_json, cv_name, schema_version FROM cv_parse_cache WHERE cv_url = %s",
            (cv_url,),
        ).fetchone()

    if row is None:
        return None

    if (row["schema_version"] or 0) < CURRENT_SCHEMA_VERSION:
        return None

    parsed = row["parsed_json"]
    if isinstance(parsed, str):
        parsed = json.loads(parsed)

    return {"data": parsed, "cv_name": row["cv_name"]}


def set_cv_parse(cv_url: str, parsed: dict, cv_name: str = "") -> None:
    """Insert (or overwrite a stale-version) parse result."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO cv_parse_cache (cv_url, parsed_json, cv_name, schema_version)
            VALUES (%s, %s::jsonb, %s, %s)
            ON CONFLICT (cv_url) DO UPDATE SET
                parsed_json    = EXCLUDED.parsed_json,
                cv_name        = EXCLUDED.cv_name,
                schema_version = EXCLUDED.schema_version
            WHERE cv_parse_cache.schema_version < EXCLUDED.schema_version
            """,
            (cv_url, json.dumps(parsed), cv_name, CURRENT_SCHEMA_VERSION),
        )


def update_cv_parse(cv_url: str, parsed: dict, cv_name: str = "") -> None:
    """Upsert a parse result, overwriting any existing entry (used to persist user edits)."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO cv_parse_cache (cv_url, parsed_json, cv_name, schema_version)
            VALUES (%s, %s::jsonb, %s, %s)
            ON CONFLICT (cv_url) DO UPDATE SET
                parsed_json    = EXCLUDED.parsed_json,
                cv_name        = EXCLUDED.cv_name,
                schema_version = EXCLUDED.schema_version
            """,
            (cv_url, json.dumps(parsed), cv_name, CURRENT_SCHEMA_VERSION),
        )
