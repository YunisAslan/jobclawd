import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .seed import seed_data

DB_PATH = Path(__file__).parent.parent / "jobclawd.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def init_db() -> None:
    schema = SCHEMA_PATH.read_text()
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(schema)
        # Seed default settings if not present
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('autopilot_enabled', 'false')"
        )
        seed_data(conn)
        conn.commit()


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
