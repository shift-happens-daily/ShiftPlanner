from fastapi import APIRouter

from app.schemas.report import EmployeeReportRead
from app.services import report_service

router = APIRouter()


@router.get("/employees", response_model=list[EmployeeReportRead])
def get_employee_report() -> list[EmployeeReportRead]:
    return report_service.list_employee_reports()
