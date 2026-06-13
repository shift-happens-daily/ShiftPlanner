from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, schedule_repository
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


def list_requirements(db: Session, start_date: date | None = None, end_date: date | None = None) -> list[ScheduleRequirementRead]:
    requirements = schedule_repository.list_requirements(db, start_date=start_date, end_date=end_date)
    return [
        ScheduleRequirementRead(
            id=requirement.id,
            position_id=requirement.position_id,
            position_title=position_repository.get_position_by_id(db, requirement.position_id).name,
            date=requirement.shift_date,
            min_staff=requirement.required_employees,
            start_time=requirement.start_time,
            end_time=requirement.end_time,
        )
        for requirement in requirements
    ]


def create_requirement(db: Session, payload: ScheduleRequirementCreate) -> ScheduleRequirementRead:
    position = position_repository.get_position_by_id(db, payload.position_id)
    if position is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Position {payload.position_id} was not found.")
    requirement = schedule_repository.create_requirement(
        db,
        company_id=position.company_id,
        position_id=payload.position_id,
        shift_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        required_employees=payload.min_staff,
    )
    return ScheduleRequirementRead(
        id=requirement.id,
        position_id=requirement.position_id,
        position_title=position.name,
        date=requirement.shift_date,
        min_staff=requirement.required_employees,
        start_time=requirement.start_time,
        end_time=requirement.end_time,
    )


def generate_schedule(db: Session, payload: ScheduleGenerateRequest | None = None) -> ScheduleRead:
    start_date = payload.start_date if payload else None
    end_date = payload.end_date if payload else None
    requirements = schedule_repository.list_requirements(db, start_date=start_date, end_date=end_date)
    default_company = company_repository.get_default_company(db)

    generated_shifts: list[dict] = []
    unfilled: list[dict] = []

    for requirement in requirements:
        employee = next(iter(employee_repository.list_employees_by_position(db, requirement.position_id)), None)
        position = position_repository.get_position_by_id(db, requirement.position_id)
        position_title = position.name if position else ""

        if employee is None:
            unfilled.append(
                {
                    "requirement_id": requirement.id,
                    "position_id": requirement.position_id,
                    "position_title": position_title,
                    "date": requirement.shift_date,
                    "start_time": requirement.start_time,
                    "end_time": requirement.end_time,
                    "missing_staff": requirement.required_employees,
                }
            )
            continue

        generated_shifts.append(
            {
                "employee_id": employee.id,
                "employee_name": employee.user.full_name,
                "position_id": requirement.position_id,
                "position_name": position_title,
                "date": requirement.shift_date,
                "start_time": requirement.start_time,
                "end_time": requirement.end_time,
            }
        )

        if requirement.required_employees > 1:
            unfilled.append(
                {
                    "requirement_id": requirement.id,
                    "position_id": requirement.position_id,
                    "position_title": position_title,
                    "date": requirement.shift_date,
                    "start_time": requirement.start_time,
                    "end_time": requirement.end_time,
                    "missing_staff": requirement.required_employees - 1,
                }
            )

    schedule_start = start_date or (min((item.shift_date for item in requirements), default=date.today()))
    schedule_end = end_date or (max((item.shift_date for item in requirements), default=schedule_start))
    company_id = requirements[0].company_id if requirements else default_company.id
    schedule = schedule_repository.create_schedule(
        db,
        company_id=company_id,
        start_date=schedule_start,
        end_date=schedule_end,
        generated_shifts=generated_shifts,
    )
    return _build_schedule_read(db, schedule.id, schedule.status, unfilled)


def get_schedule(db: Session, schedule_id: int) -> ScheduleRead:
    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    return _build_schedule_read(db, schedule.id, schedule.status)


def update_shift(db: Session, schedule_id: int, shift_id: int, payload: ScheduleShiftUpdate) -> ScheduleRead:
    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")

    shift_row = schedule_repository.get_shift_row(db, schedule_id, shift_id)
    if shift_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift was not found.")

    if payload.action == "remove":
        schedule_repository.remove_shift(db, schedule_id, shift_id)
    else:
        employee = employee_repository.get_employee_by_id(db, payload.employee_id)
        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
        if employee.position_id != shift_row["position_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee does not match the required position for this shift.",
            )
        schedule_repository.reassign_shift(db, shift_row["assignment_id"], employee.id)

    updated_schedule = schedule_repository.get_schedule(db, schedule_id)
    return _build_schedule_read(db, updated_schedule.id, updated_schedule.status)


def publish_schedule(db: Session, schedule_id: int) -> ScheduleRead:
    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    if schedule.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft schedules can be published.")
    published_schedule = schedule_repository.publish_schedule(db, schedule_id)
    return _build_schedule_read(db, published_schedule.id, published_schedule.status)


def list_my_schedule(db: Session, current_user: UserRead) -> list[ShiftRead]:
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )
    rows = schedule_repository.list_published_shift_rows_for_employee(db, current_user.employee_id)
    return [_build_shift_read(row) for row in rows]


def create_exchange_request(db: Session, payload: ShiftExchangeRequestCreate, current_user: UserRead) -> ShiftExchangeRequestRead:
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )
    assignment = schedule_repository.get_shift_assignment_for_employee(db, payload.shift_id, current_user.employee_id)
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift was not found.")
    exchange_request = schedule_repository.create_exchange_request(
        db,
        shift_assignment_id=assignment.id,
        requested_by_employee_id=current_user.employee_id,
        note=payload.note,
    )
    row = schedule_repository.build_exchange_request_read_row(db, exchange_request.id)
    return ShiftExchangeRequestRead(**row)


def list_pending_exchange_requests(db: Session) -> list[ShiftExchangeRequestRead]:
    return [ShiftExchangeRequestRead(**row) for row in schedule_repository.list_pending_exchange_requests(db)]


def update_exchange_request_status(
    db: Session,
    exchange_request_id: int,
    payload: ShiftExchangeRequestUpdate,
) -> ShiftExchangeRequestRead:
    exchange_request = schedule_repository.get_exchange_request(db, exchange_request_id)
    if exchange_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exchange request was not found.")
    if exchange_request.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending requests can be updated.")

    schedule_repository.update_exchange_request_status(db, exchange_request_id, payload.status)
    row = schedule_repository.build_exchange_request_read_row(db, exchange_request_id)
    return ShiftExchangeRequestRead(**row)


def _build_schedule_read(
    db: Session,
    schedule_id: int,
    status_value: str,
    unfilled_override: list[dict] | None = None,
) -> ScheduleRead:
    schedule = schedule_repository.get_schedule(db, schedule_id)
    rows = schedule_repository.list_schedule_shift_rows(db, schedule_id)
    requirements = schedule_repository.list_requirements(db, schedule.start_date, schedule.end_date)
    unfilled = list(unfilled_override) if unfilled_override is not None else []

    if unfilled_override is None:
        for requirement in requirements:
            assigned_count = sum(
                1
                for row in rows
                if row["position_id"] == requirement.position_id
                and row["shift_date"] == requirement.shift_date
                and row["start_time"] == requirement.start_time
                and row["end_time"] == requirement.end_time
            )
            if assigned_count < requirement.required_employees:
                position = position_repository.get_position_by_id(db, requirement.position_id)
                unfilled.append(
                    {
                        "requirement_id": requirement.id,
                        "position_id": requirement.position_id,
                        "position_title": position.name if position else "",
                        "date": requirement.shift_date,
                        "start_time": requirement.start_time,
                        "end_time": requirement.end_time,
                        "missing_staff": requirement.required_employees - assigned_count,
                    }
                )
    return ScheduleRead(
        id=schedule_id,
        status="published" if status_value == "published" else "draft",
        shifts=[_build_shift_read(row) for row in rows],
        conflicts=[],
        unfilled_requirements=[UnfilledRequirementRead(**item) for item in unfilled],
    )


def _build_shift_read(row: dict) -> ShiftRead:
    return ShiftRead(
        id=row["shift_id"],
        employee_id=row["employee_id"],
        employee_name=row["employee_name"],
        position_id=row["position_id"],
        position=row["position_name"],
        date=row["shift_date"],
        start_time=row["start_time"],
        end_time=row["end_time"],
    )
