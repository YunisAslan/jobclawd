from db.database import get_db


def get_answers(email: str) -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            "SELECT id, question, answer FROM screening_answers WHERE email = %s ORDER BY id",
            (email,),
        ).fetchall()
    return [dict(r) for r in rows]


def upsert_answer(email: str, question: str, answer: str) -> dict:
    with get_db() as db:
        row = db.execute(
            "INSERT INTO screening_answers (email, question, answer) VALUES (%s, %s, %s) "
            "ON CONFLICT (email, question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = NOW() "
            "RETURNING id, question, answer",
            (email, question, answer),
        ).fetchone()
    return dict(row)


def delete_answer(email: str, answer_id: int) -> bool:
    with get_db() as db:
        row = db.execute(
            "DELETE FROM screening_answers WHERE id = %s AND email = %s RETURNING id",
            (answer_id, email),
        ).fetchone()
    return row is not None
