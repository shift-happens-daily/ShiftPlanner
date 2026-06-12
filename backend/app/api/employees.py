from fastapi import APIRouter, Depends, status

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
from app.schemas.auth import UserRead
from app.schemas.employee import AvailabilityRead, AvailabilityUpsert, EmployeeCreate, EmployeeRead
from app.schemas.schedule import ShiftRead
from app.services import employee_service, schedule_service

router = APIRouter()


@router.get(
    "/",
    response_model=list[EmployeeRead],
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_employees(_: UserRead = Depends(get_current_user)) -> list[EmployeeRead]:
    return employee_service.list_employees()


@router.post(
    "/",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_employee(
    payload: EmployeeCreate,
    _: UserRead = Depends(require_role("manager")),
) -> EmployeeRead:
    return employee_service.create_employee(payload)


@router.get(
    "/{employee_id}/availability",
    response_model=AvailabilityRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def get_employee_availability(
    employee_id: int,
    current_user: UserRead = Depends(get_current_user),
) -> AvailabilityRead:
    ensure_manager_or_employee_self(employee_id, current_user)
    return employee_service.get_availability(employee_id)


@router.post(
    "/{employee_id}/availability",
    response_model=AvailabilityRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def upsert_employee_availability(
    employee_id: int,
    payload: AvailabilityUpsert,
    current_user: UserRead = Depends(get_current_user),
) -> AvailabilityRead:
    ensure_manager_or_employee_self(employee_id, current_user)
    return employee_service.upsert_availability(employee_id, payload)


@router.get(
    "/me/schedule",
    response_model=list[ShiftRead],
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def get_my_schedule_from_employee_route(
    current_user: UserRead = Depends(require_role("employee")),
) -> list[ShiftRead]:
    ensure_employee_user(current_user)
    return schedule_service.list_my_schedule(current_user)
