from app.repositories import mock_db
from app.schemas.report import EmployeeReportRead


def list_employee_reports() -> list[EmployeeReportRead]:
    return [
        EmployeeReportRead(
            employee_name=employee.full_name,
            position=employee.position_title,
            total_hours=120,
            total_shifts=20,
        )
        for employee in mock_db.list_employees()
    ]
