from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, schedule_repository
from app.schemas.auth import UserRead
from app.schemas.schedule import (
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
from app.services import schedule_solver


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


def create_bulk_requirements(db: Session, payload: ScheduleRequirementBulkCreate) -> ScheduleRequirementBulkRead:
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
                items.append(
                    {
                        "company_id": position.company_id,
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


def generate_schedule(db: Session, payload: ScheduleGenerateRequest | None = None) -> ScheduleRead:
    if payload and payload.start_date:
        schedule_start = payload.start_date
        schedule_end = payload.end_date or schedule_start + timedelta(days=6)
    elif payload and payload.end_date:
        schedule_start = schedule_end = payload.end_date
    else:
        schedule_start = date.today()
        schedule_end = schedule_start + timedelta(days=6)
    company = company_repository.get_default_company(db)
    branch = company_repository.get_default_branch_for_company(db, company.id)
    if branch is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The company must have a branch before generating a schedule.",
        )

    try:
        result = schedule_solver.generate_schedule(
            db,
            company_id=company.id,
            branch_id=branch.id,
            start_date=schedule_start,
            end_date=schedule_end,
        )
    except schedule_solver.ScheduleDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return _build_solver_schedule_read(db, result.schedule_id)


def _build_solver_schedule_read(db: Session, schedule_id: int) -> ScheduleRead:
    schedule_status = db.execute(
        text("SELECT status FROM schedules WHERE id = :schedule_id"),
        {"schedule_id": schedule_id},
    ).scalar_one()
    shift_rows = db.execute(
        text(
            """
            SELECT
                assignments.id AS shift_id,
                assignments.employee_id,
                users.full_name AS employee_name,
                assignments.position_id,
                positions.name AS position_name,
                assignments.work_date AS shift_date,
                assignments.start_time,
                assignments.end_time
            FROM schedule_assignments AS assignments
            JOIN employees ON employees.id = assignments.employee_id
            JOIN users ON users.id = employees.user_id
            JOIN positions ON positions.id = assignments.position_id
            WHERE assignments.schedule_id = :schedule_id
            ORDER BY assignments.work_date, assignments.start_time, assignments.id
            """
        ),
        {"schedule_id": schedule_id},
    ).mappings()
    uncovered_rows = db.execute(
        text(
            """
            SELECT
                uncovered.id,
                uncovered.work_date,
                uncovered.slot_time,
                uncovered.position_id,
                positions.name AS position_title,
                uncovered.uncovered_count
            FROM uncovered_slots AS uncovered
            JOIN positions ON positions.id = uncovered.position_id
            WHERE uncovered.schedule_id = :schedule_id
            ORDER BY uncovered.work_date, uncovered.slot_time, uncovered.id
            """
        ),
        {"schedule_id": schedule_id},
    ).mappings()

    return ScheduleRead(
        id=schedule_id,
        status="published" if schedule_status == "published" else "draft",
        shifts=[_build_shift_read(dict(row)) for row in shift_rows],
        conflicts=[],
        unfilled_requirements=[
            UnfilledRequirementRead(
                requirement_id=row["id"],
                position_id=row["position_id"],
                position_title=row["position_title"],
                date=row["work_date"],
                start_time=row["slot_time"],
                end_time=_add_minutes(row["slot_time"], schedule_solver.SLOT_MINUTES),
                missing_staff=row["uncovered_count"],
            )
            for row in uncovered_rows
        ],
    )


def _add_minutes(value: time, minutes: int) -> time:
    return (datetime.combine(date.min, value) + timedelta(minutes=minutes)).time()


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

def delete_requirement(db: Session, requirement_id: int) -> None:
    requirement = schedule_repository.get_requirement_by_id(db, requirement_id)

    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    schedule_repository.delete_requirement(db, requirement)
