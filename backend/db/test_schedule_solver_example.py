"""
Smoke/integration test for the new slot-based ShiftPlanner solver.

Run from the project root after installing project dependencies and PostgreSQL:

    export TEST_DATABASE_URL='postgresql+psycopg://user:password@localhost:5432/shiftplanner_test'
    pytest -q test_schedule_solver_example.py

Expected: the solver creates one draft schedule for 2026-06-22..2026-06-28,
persists continuous shifts, writes slot audit rows, and records any uncovered demand.
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
        text("SELECT status, solver_status FROM schedules WHERE id = :id"),
        {"id": result.schedule_id},
    ).mappings().one()
    assert schedule_row["status"] == "draft"
    assert schedule_row["solver_status"] in {"optimal", "feasible"}

    assignment_count = db_session.execute(
        text("SELECT COUNT(*) FROM schedule_assignments WHERE schedule_id = :id"),
        {"id": result.schedule_id},
    ).scalar_one()
    assert assignment_count == len(result.assignments)

    slot_count = db_session.execute(
        text(
            """
            SELECT COUNT(*)
            FROM schedule_assignment_slots slots
            JOIN schedule_assignments assignments
              ON assignments.id = slots.schedule_assignment_id
            WHERE assignments.schedule_id = :id
            """
        ),
        {"id": result.schedule_id},
    ).scalar_one()
    assert slot_count == sum(len(item.slots) for item in result.assignments)

    bad_slot_statuses = db_session.execute(
        text(
            """
            SELECT COUNT(*)
            FROM schedule_assignment_slots slots
            JOIN schedule_assignments assignments
              ON assignments.id = slots.schedule_assignment_id
            WHERE assignments.schedule_id = :id
              AND slots.availability_status NOT IN ('available', 'if_needed')
            """
        ),
        {"id": result.schedule_id},
    ).scalar_one()
    assert bad_slot_statuses == 0

    # No employee should get more than one shift per day in this schema/model.
    duplicates = db_session.execute(
        text(
            """
            SELECT COUNT(*)
            FROM (
                SELECT employee_id, work_date, COUNT(*) AS shift_count
                FROM schedule_assignments
                WHERE schedule_id = :id
                GROUP BY employee_id, work_date
                HAVING COUNT(*) > 1
            ) AS duplicate_days
            """
        ),
        {"id": result.schedule_id},
    ).scalar_one()
    assert duplicates == 0
