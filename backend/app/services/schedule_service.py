from datetime import date
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, schedule_repository
from app.schemas.auth import UserRead
from app.schemas.schedule import (
    AvailableEmployeeBranchRead,
    AvailableEmployeePositionRead,
    AvailableEmployeeRead,
    ManualShiftCreate,
    RequirementAssignRequest,
    ScheduleGenerateRequest,
    ScheduleRead,
    ScheduleRequirementBulkCreate,
    ScheduleRequirementBulkRead,
    ScheduleRequirementCreate,
    ScheduleRequirementRead,
    ScheduleRequirementUpdate,
    ScheduleShiftUpdate,
    ShiftExchangeRequestCreate,
    ShiftExchangeRequestRead,
    ShiftExchangeRequestUpdate,
    ShiftRead,
    UnfilledRequirementRead,
)


def list_requirements(
    db: Session,
    current_user: UserRead,
    start_date: date | None = None,
    end_date: date | None = None,
    position_id: int | None = None,
    branch_id: int | None = None,
) -> list[ScheduleRequirementRead]:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not linked to a company.",
        )

    if branch_id is not None:
        branch = company_repository.get_branch_by_id(db, branch_id)
        if branch is None or branch.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated user's company.",
            )

    if start_date is not None and end_date is not None and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_to must be later than or equal to date_from.",
        )

    requirements = schedule_repository.list_requirements(
        db,
        start_date=start_date,
        end_date=end_date,
        position_id=position_id,
        company_id=current_user.company_id,
        branch_id=branch_id,
    )
    return [
        _build_requirement_read(db, requirement)
        for requirement in requirements
    ]


def create_requirement(db: Session, payload: ScheduleRequirementCreate, current_user: UserRead) -> ScheduleRequirementRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    branch = None
    if payload.branch_id is None:
        branch = company_repository.get_default_branch_for_company(db, current_user.company_id)
        if branch is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager's company does not have a branch.",
            )
    else:
        branch = company_repository.get_branch_by_id(db, payload.branch_id)
        if branch is None or branch.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated user's company.",
            )

    position = position_repository.get_position_by_id(db, payload.position_id)
    if position is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Position {payload.position_id} was not found.")
    if position.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Position does not belong to the authenticated user's company.",
        )

    requirement = schedule_repository.create_requirement(
        db,
        company_id=current_user.company_id,
        branch_id=branch.id,
        position_id=payload.position_id,
        shift_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        required_employees=payload.required_count,
    )
    return _build_requirement_read(db, requirement)


def update_requirement(
    db: Session,
    requirement_id: int,
    payload: ScheduleRequirementUpdate,
    current_user: UserRead,
) -> ScheduleRequirementRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    requirement = schedule_repository.get_requirement_by_id(db, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    if requirement.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requirement does not belong to the authenticated user's company.",
        )

    branch_id = payload.branch_id if payload.branch_id is not None else requirement.branch_id
    if branch_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch is required.")
    branch = company_repository.get_branch_by_id(db, branch_id)
    if branch is None or branch.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch does not belong to the authenticated user's company.",
        )

    position_id = payload.position_id if payload.position_id is not None else requirement.position_id
    position = position_repository.get_position_by_id(db, position_id)
    if position is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Position {position_id} was not found.")
    if position.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Position does not belong to the authenticated user's company.",
        )

    shift_date = payload.date if payload.date is not None else requirement.shift_date
    start_time = payload.start_time if payload.start_time is not None else requirement.start_time
    end_time = payload.end_time if payload.end_time is not None else requirement.end_time
    required_employees = (
        payload.required_count
        if payload.required_count is not None
        else requirement.required_employees
    )

    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be later than start_time.",
        )

    updated_requirement = schedule_repository.update_requirement(
        db,
        requirement,
        branch_id=branch_id,
        position_id=position_id,
        shift_date=shift_date,
        start_time=start_time,
        end_time=end_time,
        required_employees=required_employees,
    )
    return _build_requirement_read(db, updated_requirement)


def create_bulk_requirements(
    db: Session,
    payload: ScheduleRequirementBulkCreate,
    current_user: UserRead,
) -> ScheduleRequirementBulkRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    positions = {item.id: item for item in position_repository.list_positions(db)}
    items: list[dict] = []
    current_date = payload.start_date
    while current_date <= payload.end_date:
        if current_date.weekday() in payload.weekdays:
            for template in payload.requirements:
                position = positions.get(template.position_id)
                if position is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Position {template.position_id} was not found.",
                    )
                if position.company_id != current_user.company_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Position does not belong to the authenticated user's company.",
                    )
                items.append(
                    {
                        "company_id": current_user.company_id,
                        "position_id": template.position_id,
                        "shift_date": current_date,
                        "start_time": template.start_time,
                        "end_time": template.end_time,
                        "required_employees": template.min_staff,
                    }
                )
        current_date += timedelta(days=1)

    requirements = schedule_repository.create_requirements_bulk(db, items)
    return ScheduleRequirementBulkRead(
        created_count=len(requirements),
        requirements=[_build_requirement_read(db, requirement) for requirement in requirements],
    )


def generate_schedule(
    db: Session,
    current_user: UserRead,
    payload: ScheduleGenerateRequest | None = None,
) -> ScheduleRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    start_date = payload.start_date if payload else None
    end_date = payload.end_date if payload else None
    requirements = schedule_repository.list_requirements(
        db,
        start_date=start_date,
        end_date=end_date,
        company_id=current_user.company_id,
    )

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
    schedule = schedule_repository.create_schedule(
        db,
        company_id=current_user.company_id,
        start_date=schedule_start,
        end_date=schedule_end,
        generated_shifts=generated_shifts,
    )
    return _build_schedule_read(db, schedule.id, schedule.status, unfilled)


def get_schedule(db: Session, schedule_id: int, current_user: UserRead) -> ScheduleRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not linked to a company.",
        )

    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    if schedule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Schedule does not belong to the authenticated user's company.",
        )
    if current_user.role == "employee" and schedule.status != "published":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees can only view published schedules.",
        )
    return _build_schedule_read(db, schedule.id, schedule.status)


def get_latest_schedule(
    db: Session,
    current_user: UserRead,
    schedule_status: str | None = None,
) -> ScheduleRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    schedule = schedule_repository.get_latest_schedule(
        db,
        company_id=current_user.company_id,
        schedule_status=schedule_status,
    )
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    return _build_schedule_read(db, schedule.id, schedule.status)


def list_schedules(
    db: Session,
    current_user: UserRead,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    schedule_status: str | None = None,
) -> list[ScheduleRead]:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )
    _ensure_date_range(start_date, end_date)

    schedules = schedule_repository.list_schedules(
        db,
        company_id=current_user.company_id,
        start_date=start_date,
        end_date=end_date,
        schedule_status=schedule_status,
    )
    return [_build_schedule_read(db, schedule.id, schedule.status) for schedule in schedules]


def create_manual_shift(
    db: Session,
    schedule_id: int,
    payload: ManualShiftCreate,
    current_user: UserRead,
) -> ScheduleRead:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    _validate_position_for_company(db, payload.position_id, current_user.company_id)
    if payload.employee_id is not None:
        _validate_employee_assignment(
            db,
            schedule_id=schedule.id,
            employee_id=payload.employee_id,
            position_id=payload.position_id,
            shift_date=payload.date,
            start_time=payload.start_time,
            end_time=payload.end_time,
        )

    schedule_repository.create_shift(
        db,
        schedule_id=schedule.id,
        company_id=schedule.company_id,
        position_id=payload.position_id,
        shift_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        employee_id=payload.employee_id,
    )
    return _build_schedule_read(db, schedule.id, schedule.status)


def update_shift(
    db: Session,
    schedule_id: int,
    shift_id: int,
    payload: ScheduleShiftUpdate,
    current_user: UserRead,
) -> ScheduleRead:
    schedule = _get_manager_schedule(db, schedule_id, current_user)

    shift_row = schedule_repository.get_shift_row(db, schedule_id, shift_id)
    if shift_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift was not found.")

    if payload.action == "remove":
        schedule_repository.remove_shift(db, schedule_id, shift_id)
    else:
        position_id = payload.position_id if payload.position_id is not None else shift_row["position_id"]
        shift_date = payload.date if payload.date is not None else shift_row["shift_date"]
        start_time = payload.start_time if payload.start_time is not None else shift_row["start_time"]
        end_time = payload.end_time if payload.end_time is not None else shift_row["end_time"]
        _ensure_time_range(start_time, end_time)
        _validate_position_for_company(db, position_id, current_user.company_id)

        replace_assignment = payload.action == "reassign" or "employee_id" in payload.model_fields_set
        employee_id = (
            payload.employee_id
            if replace_assignment
            else shift_row["employee_id"]
        )
        if employee_id is not None:
            _validate_employee_assignment(
                db,
                schedule_id=schedule.id,
                employee_id=employee_id,
                position_id=position_id,
                shift_date=shift_date,
                start_time=start_time,
                end_time=end_time,
                exclude_shift_id=shift_id,
            )
        schedule_repository.update_shift(
            db,
            shift_id=shift_id,
            position_id=position_id,
            shift_date=shift_date,
            start_time=start_time,
            end_time=end_time,
            employee_id=employee_id,
            replace_assignment=replace_assignment,
        )

    updated_schedule = schedule_repository.get_schedule(db, schedule_id)
    return _build_schedule_read(db, updated_schedule.id, updated_schedule.status)


def delete_shift(db: Session, schedule_id: int, shift_id: int, current_user: UserRead) -> None:
    _get_manager_schedule(db, schedule_id, current_user)
    shift_row = schedule_repository.get_shift_row(db, schedule_id, shift_id)
    if shift_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift was not found.")
    schedule_repository.remove_shift(db, schedule_id, shift_id)


def assign_requirement(
    db: Session,
    schedule_id: int,
    requirement_id: int,
    payload: RequirementAssignRequest,
    current_user: UserRead,
) -> ScheduleRead:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    requirement = schedule_repository.get_requirement_by_id(db, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    if requirement.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requirement does not belong to the authenticated user's company.",
        )
    if requirement.shift_date < schedule.start_date or requirement.shift_date > schedule.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirement date is outside the schedule period.",
        )

    assigned_count = schedule_repository.count_assigned_shifts_for_requirement_slot(
        db,
        schedule_id=schedule.id,
        position_id=requirement.position_id,
        shift_date=requirement.shift_date,
        start_time=requirement.start_time,
        end_time=requirement.end_time,
    )
    if assigned_count >= requirement.required_employees:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirement is already fully filled.",
        )

    _validate_employee_assignment(
        db,
        schedule_id=schedule.id,
        employee_id=payload.employee_id,
        position_id=requirement.position_id,
        shift_date=requirement.shift_date,
        start_time=requirement.start_time,
        end_time=requirement.end_time,
    )
    schedule_repository.create_shift(
        db,
        schedule_id=schedule.id,
        company_id=schedule.company_id,
        position_id=requirement.position_id,
        shift_date=requirement.shift_date,
        start_time=requirement.start_time,
        end_time=requirement.end_time,
        employee_id=payload.employee_id,
    )
    return _build_schedule_read(db, schedule.id, schedule.status)


def list_available_employees(
    db: Session,
    schedule_id: int,
    current_user: UserRead,
    *,
    shift_date: date,
    start_time,
    end_time,
    position_id: int,
    branch_id: int | None = None,
) -> list[AvailableEmployeeRead]:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    _ensure_time_range(start_time, end_time)
    _validate_position_for_company(db, position_id, current_user.company_id)
    if branch_id is not None:
        branch = company_repository.get_branch_by_id(db, branch_id)
        if branch is None or branch.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated user's company.",
            )

    rows = schedule_repository.list_candidate_employee_rows(
        db,
        company_id=current_user.company_id,
        position_id=position_id,
        branch_id=branch_id,
    )
    available: list[AvailableEmployeeRead] = []
    for row in rows:
        employee_id = row["employee_id"]
        if schedule_repository.employee_has_absence_on_date(db, employee_id=employee_id, shift_date=shift_date):
            continue
        if schedule_repository.has_overlapping_assignment(
            db,
            schedule_id=schedule.id,
            employee_id=employee_id,
            shift_date=shift_date,
            start_time=start_time,
            end_time=end_time,
        ):
            continue
        availability_status = schedule_repository.get_employee_availability_status(
            db,
            employee_id=employee_id,
            weekday=shift_date.weekday(),
            start_time=start_time,
            end_time=end_time,
        )
        if availability_status not in {"available", "if_needed"}:
            continue
        available.append(
            AvailableEmployeeRead(
                id=employee_id,
                full_name=row["full_name"],
                position=AvailableEmployeePositionRead(
                    id=row["position_id"],
                    name=row["position_name"],
                ),
                branch=(
                    AvailableEmployeeBranchRead(id=row["branch_id"], name=row["branch_name"])
                    if row["branch_id"] is not None
                    else None
                ),
                availability_status=availability_status,
                assigned_hours=schedule_repository.sum_assigned_hours_for_employee(
                    db,
                    schedule_id=schedule.id,
                    employee_id=employee_id,
                ),
            )
        )
    return sorted(available, key=lambda item: (item.availability_status != "available", item.full_name, item.id))


def update_schedule_requirement(
    db: Session,
    schedule_id: int,
    requirement_id: int,
    payload: ScheduleRequirementUpdate,
    current_user: UserRead,
) -> ScheduleRead:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    requirement = schedule_repository.get_requirement_by_id(db, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    if requirement.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requirement does not belong to the authenticated user's company.",
        )
    shift_date = payload.date if payload.date is not None else requirement.shift_date
    if shift_date < schedule.start_date or shift_date > schedule.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirement date is outside the schedule period.",
        )
    update_requirement(db, requirement_id, payload, current_user)
    return _build_schedule_read(db, schedule.id, schedule.status)


def publish_schedule(db: Session, schedule_id: int, current_user: UserRead) -> ScheduleRead:
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required.")
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    if schedule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Schedule does not belong to the authenticated manager's company.",
        )
    if schedule.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft schedules can be published.")
    published_schedule = schedule_repository.publish_schedule(db, schedule)
    return _build_schedule_read(db, published_schedule.id, published_schedule.status)


def delete_schedule(db: Session, schedule_id: int, current_user: UserRead) -> None:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    if schedule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Schedule does not belong to the authenticated manager's company.",
        )

    schedule_repository.delete_schedule(db, schedule)


def list_my_schedule(
    db: Session,
    current_user: UserRead,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[ShiftRead]:
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )
    _ensure_date_range(start_date, end_date)
    rows = schedule_repository.list_published_shift_rows_for_employee_period(
        db,
        current_user.employee_id,
        start_date=start_date,
        end_date=end_date,
    )
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
    requirements = schedule_repository.list_requirements(
        db,
        schedule.start_date,
        schedule.end_date,
        company_id=schedule.company_id,
    )
    unfilled = list(unfilled_override) if unfilled_override is not None else []

    if unfilled_override is None:
        for requirement in requirements:
            assigned_count = sum(
                1
                for row in rows
                if row["position_id"] == requirement.position_id
                and row["employee_id"] is not None
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
        start_date=schedule.start_date,
        end_date=schedule.end_date,
        status=status_value,
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


def _get_manager_schedule(db: Session, schedule_id: int, current_user: UserRead):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required.")
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )
    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    if schedule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Schedule does not belong to the authenticated manager's company.",
        )
    return schedule


def _validate_position_for_company(db: Session, position_id: int, company_id: int) -> None:
    position = position_repository.get_position_by_id(db, position_id)
    if position is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Position {position_id} was not found.")
    if position.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Position does not belong to the authenticated user's company.",
        )


def _validate_employee_assignment(
    db: Session,
    *,
    schedule_id: int,
    employee_id: int,
    position_id: int,
    shift_date: date,
    start_time,
    end_time,
    exclude_shift_id: int | None = None,
) -> None:
    schedule = schedule_repository.get_schedule(db, schedule_id)
    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    if employee.company_id != schedule.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to the authenticated user's company.",
        )
    if not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee is inactive.",
        )
    if not employee_repository.employee_has_position(db, employee.id, position_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee does not match the required position for this shift.",
        )
    if schedule_repository.has_overlapping_assignment(
        db,
        schedule_id=schedule_id,
        employee_id=employee_id,
        shift_date=shift_date,
        start_time=start_time,
        end_time=end_time,
        exclude_shift_id=exclude_shift_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee already has an overlapping shift.",
        )


def _ensure_time_range(start_time, end_time) -> None:
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be later than start_time.",
        )
    if start_time.minute % 5 != 0 or end_time.minute % 5 != 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_time and end_time must be aligned to 5-minute steps.",
        )


def _ensure_date_range(start_date: date | None, end_date: date | None) -> None:
    if start_date is not None and end_date is not None and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_to must be later than or equal to date_from.",
        )


def _build_requirement_read(db: Session, requirement) -> ScheduleRequirementRead:
    position = position_repository.get_position_by_id(db, requirement.position_id)
    return ScheduleRequirementRead(
        id=requirement.id,
        branch_id=requirement.branch_id,
        position_id=requirement.position_id,
        position_title=position.name if position else "",
        date=requirement.shift_date,
        min_staff=requirement.required_employees,
        required_count=requirement.required_employees,
        start_time=requirement.start_time,
        end_time=requirement.end_time,
    )

def delete_requirement(db: Session, requirement_id: int, current_user: UserRead) -> None:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    requirement = schedule_repository.get_requirement_by_id(db, requirement_id)

    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if requirement.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requirement does not belong to the authenticated user's company.",
        )

    schedule_repository.delete_requirement(db, requirement)
