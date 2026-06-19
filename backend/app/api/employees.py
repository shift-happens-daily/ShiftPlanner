from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import (
    ensure_employee_user,
    ensure_manager_or_employee_self,
    get_current_user,
    require_role,
)
from app.api.responses import (
    BAD_REQUEST_RESPONSE,
    FORBIDDEN_RESPONSE,
    NOT_FOUND_RESPONSE,
    UNAUTHORIZED_RESPONSE,
    VALIDATION_ERROR_RESPONSE,
)
from app.database import get_db
from app.schemas.auth import UserRead
from app.schemas.employee import (
    AbsenceCreate,
    AbsenceRead,
    AvailabilityRead,
    AvailabilityUpsert,
    EmployeeCalendarSummaryRead,
    EmployeeCreate,
    EmployeeRead,
)
from app.schemas.schedule import ShiftRead
from app.services import employee_service, schedule_service

router = APIRouter()


@router.get(
    "/",
    response_model=list[EmployeeRead],
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_employees(
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EmployeeRead]:
    return employee_service.list_employees(db, current_user)


@router.post(
    "/",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_employee(
    payload: EmployeeCreate,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> EmployeeRead:
    return employee_service.create_employee(db, payload)


@router.get(
    "/me/absences",
    response_model=list[AbsenceRead],
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_my_absences(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    current_user: UserRead = Depends(require_role("employee")),
    db: Session = Depends(get_db),
) -> list[AbsenceRead]:
    employee_id = ensure_employee_user(current_user)
    return employee_service.list_absences(db, employee_id, start_date=start_date, end_date=end_date)


@router.post(
    "/me/absences",
    response_model=AbsenceRead,
    status_code=status.HTTP_201_CREATED,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_my_absence(
    payload: AbsenceCreate,
    current_user: UserRead = Depends(require_role("employee")),
    db: Session = Depends(get_db),
) -> AbsenceRead:
    employee_id = ensure_employee_user(current_user)
    return employee_service.create_absence(db, employee_id, payload)


@router.get(
    "/me/calendar-summary",
    response_model=EmployeeCalendarSummaryRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_my_calendar_summary(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    current_user: UserRead = Depends(require_role("employee")),
    db: Session = Depends(get_db),
) -> EmployeeCalendarSummaryRead:
    employee_id = ensure_employee_user(current_user)
    return employee_service.get_calendar_summary(db, employee_id, start_date=start_date, end_date=end_date)


@router.get(
    "/{employee_id}/availability",
    response_model=AvailabilityRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_employee_availability(
    employee_id: int,
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AvailabilityRead:
    ensure_manager_or_employee_self(employee_id, current_user)
    return employee_service.get_availability(db, employee_id)


@router.post(
    "/{employee_id}/availability",
    response_model=AvailabilityRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def upsert_employee_availability(
    employee_id: int,
    payload: AvailabilityUpsert,
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AvailabilityRead:
    ensure_manager_or_employee_self(employee_id, current_user)
    return employee_service.upsert_availability(db, employee_id, payload)


@router.get(
    "/{employee_id}/absences",
    response_model=list[AbsenceRead],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_employee_absences(
    employee_id: int,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AbsenceRead]:
    ensure_manager_or_employee_self(employee_id, current_user)
    return employee_service.list_absences(db, employee_id, start_date=start_date, end_date=end_date)


@router.post(
    "/{employee_id}/absences",
    response_model=AbsenceRead,
    status_code=status.HTTP_201_CREATED,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_employee_absence(
    employee_id: int,
    payload: AbsenceCreate,
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AbsenceRead:
    ensure_manager_or_employee_self(employee_id, current_user)
    return employee_service.create_absence(db, employee_id, payload)


@router.delete(
    "/{employee_id}/absences/{absence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def delete_employee_absence(
    employee_id: int,
    absence_id: int,
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    ensure_manager_or_employee_self(employee_id, current_user)
    employee_service.delete_absence(db, employee_id, absence_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{employee_id}/calendar-summary",
    response_model=EmployeeCalendarSummaryRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_employee_calendar_summary(
    employee_id: int,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmployeeCalendarSummaryRead:
    ensure_manager_or_employee_self(employee_id, current_user)
    return employee_service.get_calendar_summary(db, employee_id, start_date=start_date, end_date=end_date)


@router.get(
    "/me/schedule",
    response_model=list[ShiftRead],
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def get_my_schedule_from_employee_route(
    current_user: UserRead = Depends(require_role("employee")),
    db: Session = Depends(get_db),
) -> list[ShiftRead]:
    ensure_employee_user(current_user)
    return schedule_service.list_my_schedule(db, current_user)
