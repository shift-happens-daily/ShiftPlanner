from datetime import date, datetime

from sqlalchemy.orm import Session

from app.repositories import report_repository
from app.schemas.report import EmployeeReportRead


def list_employee_reports(db: Session, start_date: date | None = None, end_date: date | None = None) -> list[EmployeeReportRead]:
    rows = report_repository.list_published_shift_rows(db, start_date=start_date, end_date=end_date)
    totals: dict[int, dict] = {}

    for row in rows:
        employee_id = row["employee_id"]
        duration = datetime.combine(date.min, row["end_time"]) - datetime.combine(date.min, row["start_time"])
        if employee_id not in totals:
            totals[employee_id] = {
                "employee_name": row["employee_name"],
                "position": row["position_name"],
                "total_hours": 0.0,
                "total_shifts": 0,
            }
        totals[employee_id]["total_hours"] += duration.total_seconds() / 3600
        totals[employee_id]["total_shifts"] += 1

    return [
        EmployeeReportRead(
            employee_id=employee_id,
            employee_name=data["employee_name"],
            position=data["position"],
            total_hours=data["total_hours"],
            total_shifts=data["total_shifts"],
        )
        for employee_id, data in sorted(totals.items())
    ]
