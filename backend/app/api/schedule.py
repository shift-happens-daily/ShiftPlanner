from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_employee_user, get_current_user, require_role
from app.api.responses import (
    BAD_REQUEST_RESPONSE,
    FORBIDDEN_RESPONSE,
    NOT_FOUND_RESPONSE,
    UNAUTHORIZED_RESPONSE,
    VALIDATION_ERROR_RESPONSE,
)
from app.database import get_db
from app.schemas.auth import UserRead
from app.schemas.schedule import (
    ScheduleGenerateRequest,
    ScheduleRead,
    ScheduleRequirementCreate,
    ScheduleRequirementRead,
    ScheduleShiftUpdate,
    ShiftExchangeRequestCreate,
    ShiftExchangeRequestRead,
    ShiftExchangeRequestUpdate,
    ShiftRead,
)
from app.services import schedule_service

router = APIRouter()


@router.post(
    "/requirements",
    response_model=ScheduleRequirementRead,
    status_code=status.HTTP_201_CREATED,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_requirement(
    payload: ScheduleRequirementCreate,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> ScheduleRequirementRead:
    return schedule_service.create_requirement(db, payload)


@router.get(
    "/requirements",
    response_model=list[ScheduleRequirementRead],
    responses={**UNAUTHORIZED_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_requirements(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    _: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ScheduleRequirementRead]:
    return schedule_service.list_requirements(db, start_date=start_date, end_date=end_date)


@router.post(
    "/generate",
    response_model=ScheduleRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def generate_schedule(
    payload: ScheduleGenerateRequest | None = None,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> ScheduleRead:
    return schedule_service.generate_schedule(db, payload)


@router.get(
    "/my",
    response_model=list[ShiftRead],
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def get_my_schedule(
    current_user: UserRead = Depends(require_role("employee")),
    db: Session = Depends(get_db),
) -> list[ShiftRead]:
    ensure_employee_user(current_user)
    return schedule_service.list_my_schedule(db, current_user)


@router.post(
    "/exchange-requests",
    response_model=ShiftExchangeRequestRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        **BAD_REQUEST_RESPONSE,
        **UNAUTHORIZED_RESPONSE,
        **FORBIDDEN_RESPONSE,
        **NOT_FOUND_RESPONSE,
        **VALIDATION_ERROR_RESPONSE,
    },
)
def create_exchange_request(
    payload: ShiftExchangeRequestCreate,
    current_user: UserRead = Depends(require_role("employee")),
    db: Session = Depends(get_db),
) -> ShiftExchangeRequestRead:
    ensure_employee_user(current_user)
    return schedule_service.create_exchange_request(db, payload, current_user)


@router.get(
    "/exchange-requests",
    response_model=list[ShiftExchangeRequestRead],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def get_exchange_requests(
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> list[ShiftExchangeRequestRead]:
    return schedule_service.list_pending_exchange_requests(db)


@router.patch(
    "/exchange-requests/{exchange_request_id}",
    response_model=ShiftExchangeRequestRead,
    responses={
        **BAD_REQUEST_RESPONSE,
        **UNAUTHORIZED_RESPONSE,
        **FORBIDDEN_RESPONSE,
        **NOT_FOUND_RESPONSE,
        **VALIDATION_ERROR_RESPONSE,
    },
)
def update_exchange_request(
    exchange_request_id: int,
    payload: ShiftExchangeRequestUpdate,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> ShiftExchangeRequestRead:
    return schedule_service.update_exchange_request_status(db, exchange_request_id, payload)


@router.get(
    "/{schedule_id}",
    response_model=ScheduleRead,
    responses={**UNAUTHORIZED_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_schedule(
    schedule_id: int,
    _: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleRead:
    return schedule_service.get_schedule(db, schedule_id)


@router.patch(
    "/{schedule_id}/shifts/{shift_id}",
    response_model=ScheduleRead,
    responses={
        **BAD_REQUEST_RESPONSE,
        **UNAUTHORIZED_RESPONSE,
        **FORBIDDEN_RESPONSE,
        **NOT_FOUND_RESPONSE,
        **VALIDATION_ERROR_RESPONSE,
    },
)
def update_shift(
    schedule_id: int,
    shift_id: int,
    payload: ScheduleShiftUpdate,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> ScheduleRead:
    return schedule_service.update_shift(db, schedule_id, shift_id, payload)


@router.post(
    "/{schedule_id}/publish",
    response_model=ScheduleRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def publish_schedule(
    schedule_id: int,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> ScheduleRead:
    return schedule_service.publish_schedule(db, schedule_id)
