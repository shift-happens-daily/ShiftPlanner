from datetime import date

from fastapi import HTTPException, status

from app.repositories import mock_db
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
    UnfilledRequirementRead,
)


def list_requirements(start_date: date | None = None, end_date: date | None = None) -> list[ScheduleRequirementRead]:
    requirements = mock_db.list_schedule_requirements(start_date=start_date, end_date=end_date)
    return [ScheduleRequirementRead(**requirement) for requirement in requirements]


def create_requirement(payload: ScheduleRequirementCreate) -> ScheduleRequirementRead:
    try:
        requirement = mock_db.create_schedule_requirement(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ScheduleRequirementRead(**requirement)


def generate_schedule(payload: ScheduleGenerateRequest | None = None) -> ScheduleRead:
    start_date = payload.start_date if payload else None
    end_date = payload.end_date if payload else None
    requirements = mock_db.list_schedule_requirements(start_date=start_date, end_date=end_date)

    shifts: list[dict] = []
    unfilled: list[dict] = []

    for requirement in requirements:
        employee = next(
            (
                item
                for item in mock_db.list_employees()
                if item["position_id"] == requirement["position_id"]
            ),
            None,
        )

        if employee is None:
            unfilled.append(
                {
                    "requirement_id": requirement["id"],
                    "position_id": requirement["position_id"],
                    "position_title": requirement["position_title"],
                    "date": requirement["date"],
                    "start_time": requirement["start_time"],
                    "end_time": requirement["end_time"],
                    "missing_staff": requirement["min_staff"],
                }
            )
            continue

        shifts.append(
            mock_db.build_shift(
                employee_id=employee["id"],
                employee_name=employee["full_name"],
                position_id=requirement["position_id"],
                position_name=requirement["position_title"],
                shift_date=requirement["date"],
                start_time=requirement["start_time"],
                end_time=requirement["end_time"],
            )
        )

        if requirement["min_staff"] > 1:
            unfilled.append(
                {
                    "requirement_id": requirement["id"],
                    "position_id": requirement["position_id"],
                    "position_title": requirement["position_title"],
                    "date": requirement["date"],
                    "start_time": requirement["start_time"],
                    "end_time": requirement["end_time"],
                    "missing_staff": requirement["min_staff"] - 1,
                }
            )

    schedule = mock_db.create_schedule(shifts=shifts, unfilled_requirements=unfilled)
    return _build_schedule_read(schedule)


def get_schedule(schedule_id: int) -> ScheduleRead:
    schedule = mock_db.get_schedule_by_id(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    return _build_schedule_read(schedule)


def update_shift(schedule_id: int, shift_id: int, payload: ScheduleShiftUpdate) -> ScheduleRead:
    schedule = mock_db.get_schedule_by_id(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")

    shift = mock_db.get_shift(schedule_id=schedule_id, shift_id=shift_id)
    if shift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift was not found.")

    if payload.action == "remove":
        mock_db.remove_shift(schedule_id=schedule_id, shift_id=shift_id)
    else:
        employee = mock_db.get_employee_by_id(payload.employee_id)
        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
        if employee["position_id"] != shift["position_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee does not match the required position for this shift.",
            )
        mock_db.reassign_shift(
            schedule_id=schedule_id,
            shift_id=shift_id,
            employee_id=employee["id"],
            employee_name=employee["full_name"],
        )

    updated_schedule = mock_db.get_schedule_by_id(schedule_id)
    return _build_schedule_read(updated_schedule)


def publish_schedule(schedule_id: int) -> ScheduleRead:
    schedule = mock_db.get_schedule_by_id(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    if schedule["status"] != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft schedules can be published.")

    published_schedule = mock_db.publish_schedule(schedule_id)
    return _build_schedule_read(published_schedule)


def list_my_schedule(current_user: UserRead) -> list[ShiftRead]:
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )
    shifts = mock_db.list_current_published_shifts_for_employee(current_user.employee_id)
    return [ShiftRead(**shift) for shift in shifts]


def create_exchange_request(payload: ShiftExchangeRequestCreate, current_user: UserRead) -> ShiftExchangeRequestRead:
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )

    shift = mock_db.find_shift_across_schedules(payload.shift_id)
    if shift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift was not found.")
    if shift["employee_id"] != current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create exchange requests for your own shifts.",
        )

    exchange_request = mock_db.create_exchange_request(
        shift_id=payload.shift_id,
        employee_id=current_user.employee_id,
        employee_name=shift["employee_name"],
        note=payload.note,
    )
    return ShiftExchangeRequestRead(**exchange_request)


def list_pending_exchange_requests() -> list[ShiftExchangeRequestRead]:
    requests = mock_db.list_exchange_requests(status_filter="pending")
    return [ShiftExchangeRequestRead(**request) for request in requests]


def update_exchange_request_status(
    exchange_request_id: int,
    payload: ShiftExchangeRequestUpdate,
) -> ShiftExchangeRequestRead:
    exchange_request = mock_db.get_exchange_request_by_id(exchange_request_id)
    if exchange_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exchange request was not found.")
    if exchange_request["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be updated.")

    updated_request = mock_db.update_exchange_request_status(exchange_request_id, payload.status)
    return ShiftExchangeRequestRead(**updated_request)


def _build_schedule_read(schedule: dict) -> ScheduleRead:
    return ScheduleRead(
        id=schedule["id"],
        status=schedule["status"],
        shifts=[ShiftRead(**shift) for shift in schedule["shifts"]],
        conflicts=[],
        unfilled_requirements=[UnfilledRequirementRead(**item) for item in schedule["unfilled_requirements"]],
    )
