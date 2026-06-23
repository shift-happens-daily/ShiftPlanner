from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import require_role
from app.api.responses import BAD_REQUEST_RESPONSE, FORBIDDEN_RESPONSE, NOT_FOUND_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.database import get_db
from app.schemas.auth import UserRead
from app.schemas.report import EmployeeReportRead, EmployeeSelfReportRead
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
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> list[EmployeeReportRead]:
    if current_user.company_id is None:
        return []
    return report_service.list_employee_reports(
        db,
        start_date=start_date,
        end_date=end_date,
        company_id=current_user.company_id,
    )


@router.get(
    "/me",
    response_model=EmployeeSelfReportRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_my_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    current_user: UserRead = Depends(require_role("employee")),
    db: Session = Depends(get_db),
) -> EmployeeSelfReportRead:
    return report_service.get_my_report(db, current_user, start_date=start_date, end_date=end_date)
