import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL


def _database_url() -> str | URL:
    return os.environ.get("DATABASE_URL") or URL.create(
        drivername="postgresql+psycopg",
        username="postgres",
        password="1792",
        host="localhost",
        port=5433,
        database="shiftplanner_test",
    )


def test_database_connection() -> None:
    engine = create_engine(_database_url())
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM employees"))
        assert result.scalar() >= 0
