from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import employee_repository, report_repository
from app.schemas.auth import UserRead
from app.schemas.report import EmployeeReportRead, EmployeeSelfReportRead


def list_employee_reports(db: Session, start_date: date | None = None, end_date: date | None = None) -> list[EmployeeReportRead]:
    rows = report_repository.list_published_shift_rows(db, start_date=start_date, end_date=end_date)
    totals: dict[int, dict] = {}

    for row in rows:
        employee_id = row["employee_id"]
        duration = datetime.combine(date.min, row["end_time"]) - datetime.combine(date.min, row["start_time"])
        if employee_id not in totals:
            totals[employee_id] = {
                "full_name": row["employee_name"],
                "position": row["position_name"],
                "total_hours": 0.0,
                "total_shifts": 0,
            }
        totals[employee_id]["total_hours"] += duration.total_seconds() / 3600
        totals[employee_id]["total_shifts"] += 1

    return [
        EmployeeReportRead(
            employee_id=employee_id,
            full_name=data["full_name"],
            position=data["position"],
            total_hours=data["total_hours"],
            total_shifts=data["total_shifts"],
        )
        for employee_id, data in sorted(totals.items())
    ]


def get_my_report(db: Session, current_user: UserRead, start_date: date | None = None, end_date: date | None = None) -> EmployeeSelfReportRead:
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )
    employee = employee_repository.get_employee_by_id(db, current_user.employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")

    reports = list_employee_reports(db, start_date=start_date, end_date=end_date)
    report = next((item for item in reports if item.employee_id == current_user.employee_id), None)
    return EmployeeSelfReportRead(
        employee_id=employee.id,
        full_name=employee.user.full_name,
        total_hours=report.total_hours if report else 0.0,
        total_shifts=report.total_shifts if report else 0,
    )
