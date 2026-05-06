from typing import Optional
from db.database import get_db


def insert_log(
    level: str,
    source: str,
    event: str,
    message: str,
    details: Optional[dict] = None,
) -> None:
    import json
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO admin_logs (level, source, event, message, details)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                level.upper(),
                source,
                event,
                message,
                json.dumps(details) if details else None,
            ),
        )


def get_logs(
    limit: int = 200,
    source: Optional[str] = None,
    level: Optional[str] = None,
    before_id: Optional[int] = None,
) -> list[dict]:
    conditions = []
    params: list = []

    if source:
        conditions.append("source = %s")
        params.append(source)
    if level:
        conditions.append("level = %s")
        params.append(level.upper())
    if before_id:
        conditions.append("id < %s")
        params.append(before_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(
            f"""
            SELECT id, created_at, level, source, event, message, details
            FROM admin_logs
            {where}
            ORDER BY id DESC
            LIMIT %s
            """,
            params,
        ).fetchall()

    return [
        {
            "id": r["id"],
            "created_at": r["created_at"].isoformat(),
            "level": r["level"],
            "source": r["source"],
            "event": r["event"],
            "message": r["message"],
            "details": r["details"],
        }
        for r in rows
    ]


def get_sources() -> list[str]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT source FROM admin_logs ORDER BY source"
        ).fetchall()
    return [r["source"] for r in rows]
