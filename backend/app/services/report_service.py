from datetime import date, datetime

from app.repositories import mock_db
from app.schemas.report import EmployeeReportRead


def list_employee_reports(start_date: date | None = None, end_date: date | None = None) -> list[EmployeeReportRead]:
    published_schedules = mock_db.list_published_schedules()
    employees = mock_db.list_employees()

    totals = {employee["id"]: {"hours": 0.0, "shifts": 0} for employee in employees}

    for schedule in published_schedules:
        for shift in schedule["shifts"]:
            if start_date and shift["date"] < start_date:
                continue
            if end_date and shift["date"] > end_date:
                continue
            duration = datetime.combine(date.min, shift["end_time"]) - datetime.combine(date.min, shift["start_time"])
            totals[shift["employee_id"]]["hours"] += duration.total_seconds() / 3600
            totals[shift["employee_id"]]["shifts"] += 1

    reports = []
    for employee in employees:
        employee_total = totals[employee["id"]]
        reports.append(
            EmployeeReportRead(
                employee_id=employee["id"],
                employee_name=employee["full_name"],
                position=mock_db.get_position_title(employee["position_id"]),
                total_hours=employee_total["hours"],
                total_shifts=employee_total["shifts"],
            )
        )
    return reports
