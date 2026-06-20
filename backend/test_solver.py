"""Generate and print the seeded seven-day example schedule.

Run from the backend directory:

    python test_solver.py

The script uses DATABASE_URL when provided. Its fallback matches the root
docker-compose PostgreSQL service exposed on localhost:5432.
"""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import date

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.services.schedule_solver import generate_schedule


DATABASE_URL = (
    "postgresql+psycopg://postgres:1792@localhost:5433/shiftplanner_test"
)
START_DATE = date(2026, 6, 22)
END_DATE = date(2026, 6, 28)


def main() -> None:
    engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)

    with Session(engine) as db:
        result = generate_schedule(
            db,
            company_id=1,
            branch_id=1,
            start_date=START_DATE,
            end_date=END_DATE,
            max_time_seconds=60,
            num_workers=min(os.cpu_count() or 4, 8),
            commit=True,
        )

        rows = db.execute(
            text(
                """
                SELECT
                    schedule_assignments.work_date,
                    schedule_assignments.start_time,
                    schedule_assignments.end_time,
                    users.full_name AS employee_name,
                    professions.name AS profession_name,
                    COUNT(*) FILTER (
                        WHERE schedule_assignment_slots.availability_source = 'possible'
                    ) AS possible_slot_count
                FROM schedule_assignments
                JOIN employees
                  ON employees.id = schedule_assignments.employee_id
                JOIN users
                  ON users.id = employees.user_id
                JOIN professions
                  ON professions.id = schedule_assignments.profession_id
                JOIN schedule_assignment_slots
                  ON schedule_assignment_slots.schedule_assignment_id =
                     schedule_assignments.id
                WHERE schedule_assignments.schedule_id = :schedule_id
                GROUP BY
                    schedule_assignments.id,
                    users.full_name,
                    professions.name
                ORDER BY
                    schedule_assignments.work_date,
                    schedule_assignments.start_time,
                    professions.name,
                    users.full_name
                """
            ),
            {"schedule_id": result.schedule_id},
        ).mappings()

        schedule_by_date = defaultdict(list)
        for row in rows:
            schedule_by_date[row["work_date"]].append(row)

        print(
            f"Schedule {result.schedule_id}: {START_DATE} through {END_DATE} "
            f"({result.solver_status})"
        )
        print(
            f"Coverage: {result.total_required_slots - result.total_uncovered_slots}"
            f"/{result.total_required_slots} employee-slots; "
            f"uncovered={result.total_uncovered_slots}"
        )

        for work_date in sorted(schedule_by_date):
            print(f"\n{work_date:%A, %Y-%m-%d}")
            for row in schedule_by_date[work_date]:
                fallback = (
                    f", possible slots={row['possible_slot_count']}"
                    if row["possible_slot_count"]
                    else ""
                )
                print(
                    f"  {row['start_time']:%H:%M}-{row['end_time']:%H:%M}  "
                    f"{row['profession_name']:<10} {row['employee_name']}"
                    f"{fallback}"
                )

        if result.uncovered_slots:
            print("\nUncovered demand:")
            for item in result.uncovered_slots:
                print(
                    f"  {item.key.work_date} {item.key.slot_time:%H:%M} "
                    f"profession={item.key.profession_id}: "
                    f"{item.uncovered_count}/{item.required_count} "
                    f"({item.reason})"
                )


if __name__ == "__main__":
    main()
