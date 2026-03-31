import os
import psycopg2
import psycopg2.pool
import psycopg2.extras
from contextlib import contextmanager
from pathlib import Path

from .seed import seed_data

SCHEMA_PATH = Path(__file__).parent / "schema.sql"

_pool: psycopg2.pool.ThreadedConnectionPool = None


class PgConn:
    """
    Drop-in wrapper over a psycopg2 connection that preserves the sqlite3-style
    conn.execute(sql, params) interface used throughout the codebase.
    All rows are returned as RealDictRow (dict-like), matching sqlite3.Row behaviour.
    """

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params=None):
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        return cur

    def executemany(self, sql: str, params_seq):
        cur = self._conn.cursor()
        psycopg2.extras.execute_batch(cur, sql, list(params_seq))
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


def init_db() -> None:
    global _pool

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Example: DATABASE_URL=postgresql://user:pass@localhost:5432/jobclawd"
        )

    _pool = psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=dsn)

    # Run DDL with autocommit so each CREATE TABLE is committed immediately.
    # Split on ";\n" to execute statements one by one (psycopg2 does not support
    # multi-statement execute in a single call).
    raw = _pool.getconn()
    raw.autocommit = True
    try:
        schema = SCHEMA_PATH.read_text()
        cur = raw.cursor()
        for stmt in schema.split(";\n"):
            stmt = stmt.strip()
            if stmt:
                cur.execute(stmt)
    finally:
        _pool.putconn(raw)

    # Seed reference data inside a regular transaction
    with get_db() as conn:
        seed_data(conn)


@contextmanager
def get_db():
    conn = _pool.getconn()
    conn.autocommit = False
    pg = PgConn(conn)
    try:
        yield pg
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)
