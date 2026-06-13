from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import require_role
from app.api.responses import FORBIDDEN_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.database import get_db
from app.schemas.auth import UserRead
from app.schemas.report import EmployeeReportRead
from app.services import report_service

router = APIRouter()


@router.get(
    "/employees",
    response_model=list[EmployeeReportRead],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_employee_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> list[EmployeeReportRead]:
    return report_service.list_employee_reports(db, start_date=start_date, end_date=end_date)
