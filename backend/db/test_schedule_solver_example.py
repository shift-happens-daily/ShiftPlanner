"""
Smoke/integration test for the new slot-based ShiftPlanner solver.

Run from the project root after installing project dependencies and PostgreSQL:

    export TEST_DATABASE_URL='postgresql+psycopg://user:password@localhost:5432/shiftplanner_test'
    pytest -q test_schedule_solver_example.py

Expected: the solver creates one draft schedule for 2026-06-22..2026-06-28
and persists continuous shifts plus shift assignments in the current schema.
"""

from __future__ import annotations

from pathlib import Path
from datetime import date
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services import schedule_solver

SCHEMA_SQL_PATH = Path("schema.sql")
DATASET_SQL_PATH = Path("complex_schedule_dataset.sql")


def _read_sql(path: Path) -> str:
    assert path.exists(), f"Missing SQL file: {path}"
    return path.read_text(encoding="utf-8")


@pytest.fixture()
def db_session():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set TEST_DATABASE_URL to run this integration test")

    engine = create_engine(database_url, future=True)
    Session = sessionmaker(bind=engine, future=True)

    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text(_read_sql(SCHEMA_SQL_PATH)))
        conn.execute(text(_read_sql(DATASET_SQL_PATH)))

    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_generate_schedule_with_complex_dataset(db_session):
    ids = db_session.execute(
        text(
            """
            SELECT companies.id AS company_id, branches.id AS branch_id
            FROM companies
            JOIN branches ON branches.company_id = companies.id
            WHERE companies.invite_code = 'COFFEE30'
              AND branches.name = 'Main Branch'
            """
        )
    ).mappings().one()

    result = schedule_solver.generate_schedule(
        db_session,
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        start_date=date(2026, 6, 22),
        end_date=date(2026, 6, 28),
        max_time_seconds=15,
        num_workers=4,
        commit=True,
    )

    assert result.schedule_id > 0
    assert result.solver_status in {"optimal", "feasible"}
    assert result.total_required_slots > 0

    schedule_row = db_session.execute(
        text("SELECT status FROM schedules WHERE id = :id"),
        {"id": result.schedule_id},
    ).mappings().one()
    assert schedule_row["status"] == "draft"

    assignment_count = db_session.execute(
        text(
            """
            SELECT COUNT(*)
            FROM shift_assignments sa
            JOIN shifts s ON s.id = sa.shift_id
            WHERE s.schedule_id = :id
            """
        ),
        {"id": result.schedule_id},
    ).scalar_one()
    assert assignment_count == len(result.assignments)

    # No employee should get more than one shift per day in this schema/model.
    duplicates = db_session.execute(
        text(
            """
            SELECT COUNT(*)
            FROM (
                SELECT sa.employee_id, s.shift_date, COUNT(*) AS shift_count
                FROM shift_assignments sa
                JOIN shifts s ON s.id = sa.shift_id
                WHERE s.schedule_id = :id
                GROUP BY sa.employee_id, s.shift_date
                HAVING COUNT(*) > 1
            ) AS duplicate_days
            """
        ),
        {"id": result.schedule_id},
    ).scalar_one()
    assert duplicates == 0
