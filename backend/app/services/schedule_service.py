from datetime import date
from datetime import datetime
from datetime import time
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import text
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
    ScheduleListItemRead,
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
from . import schedule_solver


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

    _ensure_requirement_within_branch_working_hours(
        branch,
        shift_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
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

    _ensure_requirement_within_branch_working_hours(
        branch,
        shift_date=shift_date,
        start_time=start_time,
        end_time=end_time,
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

    branch = (
        company_repository.get_branch_by_id(db, payload.branch_id)
        if payload.branch_id is not None
        else company_repository.get_default_branch_for_company(db, current_user.company_id)
    )
    if branch is None or branch.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch does not belong to the authenticated user's company.",
        )

    positions = {item.id: item for item in position_repository.list_positions_by_company(db, current_user.company_id)}
    items: list[dict] = []
    current_date = payload.start_date
    while current_date <= payload.end_date:
        if current_date.weekday() in payload.weekdays:
            for template in payload.requirements:
                position = positions.get(template.position_id)
                if position is None:
                    foreign_position = position_repository.get_position_by_id(db, template.position_id)
                    if foreign_position is not None:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Position does not belong to the authenticated user's company.",
                        )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Position {template.position_id} was not found.",
                    )
                _ensure_requirement_within_branch_working_hours(
                    branch,
                    shift_date=current_date,
                    start_time=template.start_time,
                    end_time=template.end_time,
                )
                items.append(
                    {
                        "company_id": current_user.company_id,
                        "branch_id": branch.id,
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
    if start_date is None or end_date is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date and end_date are required for schedule generation.",
        )
    _validate_generation_period_http(start_date, end_date)

    branch_id = payload.branch_id if payload else None
    if branch_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="branch_id is required for schedule generation.",
        )

    branch = company_repository.get_branch_by_id(db, branch_id)
    if branch is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Branch {branch_id} was not found.",
        )
    if branch.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch does not belong to the authenticated user's company.",
        )

    _ensure_no_schedule_conflict(
        db,
        company_id=current_user.company_id,
        branch_id=branch.id,
        start_date=start_date,
        end_date=end_date,
    )

    try:
        result = schedule_solver.generate_schedule(
            db,
            company_id=current_user.company_id,
            branch_id=branch.id,
            start_date=start_date,
            end_date=end_date,
            commit=False,
        )
        db.commit()
    except schedule_solver.ScheduleDataError as exc:
        db.rollback()
        if str(exc).lower().startswith("schedule already exists"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception:
        db.rollback()
        raise

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not generated.")
    schedule = schedule_repository.get_schedule(db, result.schedule_id)
    return _build_schedule_read(db, result.schedule_id, schedule.status)


def _ensure_no_schedule_conflict(
    db: Session,
    *,
    company_id: int,
    branch_id: int,
    start_date: date,
    end_date: date,
) -> None:
    conflict = schedule_repository.find_active_schedule_conflict(
        db,
        company_id=company_id,
        branch_id=branch_id,
        start_date=start_date,
        end_date=end_date,
    )
    if conflict is None:
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            "Schedule already exists for this period. "
            f"Delete schedule {conflict['id']} "
            f"({conflict['start_date']} to {conflict['end_date']}) before creating a new one."
        ),
    )


def list_schedules(
    db: Session,
    current_user: UserRead,
    *,
    branch_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    schedule_status: str | None = None,
) -> list[ScheduleListItemRead]:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
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
            detail="end_date must be later than or equal to start_date.",
        )

    rows = schedule_repository.list_schedules(
        db,
        company_id=current_user.company_id,
        branch_id=branch_id,
        start_date=start_date,
        end_date=end_date,
        schedule_status=schedule_status,
    )
    return [ScheduleListItemRead(**row) for row in rows]


def get_schedule(db: Session, schedule_id: int, current_user: UserRead) -> ScheduleRead:
    schedule = schedule_repository.get_schedule(db, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not linked to a company.",
        )
    if schedule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Schedule does not belong to the authenticated user's company.",
        )
    if current_user.role == "employee" and schedule.status != "published":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees can only read published schedules.",
        )
    return _build_schedule_read(db, schedule.id, schedule.status)


def delete_schedule(db: Session, schedule_id: int, current_user: UserRead) -> None:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    schedule_repository.delete_schedule(db, schedule)


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


def create_manual_shift(
    db: Session,
    schedule_id: int,
    payload: ManualShiftCreate,
    current_user: UserRead,
) -> ScheduleRead:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    _ensure_draft_schedule(schedule)
    _ensure_shift_date_in_schedule(schedule, payload.date)
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
            enforce_position=False,
            enforce_availability=False,
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
    _ensure_draft_schedule(schedule)

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
        _ensure_shift_date_in_schedule(schedule, shift_date)
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
                enforce_position=False,
                enforce_availability=False,
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
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    _ensure_draft_schedule(schedule)
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
    _ensure_draft_schedule(schedule)
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
    schedule_branch_id = _get_schedule_branch_id(db, schedule.id)
    if requirement.branch_id != schedule_branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirement belongs to a different branch than this schedule.",
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
        enforce_position=False,
        enforce_availability=False,
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
    include_unavailable: bool = False,
    include_other_positions: bool = False,
) -> list[AvailableEmployeeRead]:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    _ensure_time_range(start_time, end_time)
    _validate_position_for_company(db, position_id, current_user.company_id)
    schedule_branch_id = _get_schedule_branch_id(db, schedule.id)
    if branch_id is not None:
        branch = company_repository.get_branch_by_id(db, branch_id)
        if branch is None or branch.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated user's company.",
            )
        if schedule_branch_id is not None and branch_id != schedule_branch_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requested branch does not match this schedule.",
            )
    effective_branch_id = schedule_branch_id if schedule_branch_id is not None else branch_id

    rows = schedule_repository.list_candidate_employee_rows(
        db,
        company_id=current_user.company_id,
        position_id=None if include_other_positions else position_id,
        branch_id=effective_branch_id,
    )
    available: list[AvailableEmployeeRead] = []
    unavailable_group: list[AvailableEmployeeRead] = []

    for row in rows:
        employee_id = row["employee_id"]
        # Always skip employees with absences or overlapping shifts — hard constraints
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
        availability_status = _get_employee_availability_status_for_date(
            db,
            employee_id=employee_id,
            shift_date=shift_date,
            start_time=start_time,
            end_time=end_time,
        )
        is_reachable = availability_status in {"available", "if_needed"}
        if not is_reachable and not include_unavailable:
            continue

        employee_read = AvailableEmployeeRead(
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
            availability_status=availability_status if is_reachable else "unavailable",
            assigned_hours=schedule_repository.sum_assigned_hours_for_employee(
                db,
                schedule_id=schedule.id,
                employee_id=employee_id,
            ),
        )
        if is_reachable:
            available.append(employee_read)
        else:
            unavailable_group.append(employee_read)

    available.sort(key=lambda item: (item.availability_status != "available", item.full_name, item.id))
    unavailable_group.sort(key=lambda item: item.full_name)
    return available + unavailable_group


def update_schedule_requirement(
    db: Session,
    schedule_id: int,
    requirement_id: int,
    payload: ScheduleRequirementUpdate,
    current_user: UserRead,
) -> ScheduleRead:
    schedule = _get_manager_schedule(db, schedule_id, current_user)
    _ensure_draft_schedule(schedule)
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
    schedule_branch_id = _get_schedule_branch_id(db, schedule.id)
    branch_id = payload.branch_id if payload.branch_id is not None else requirement.branch_id
    if branch_id != schedule_branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirement belongs to a different branch than this schedule.",
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
    schedule_repository.publish_schedule(db, schedule)
    return _build_schedule_read(db, schedule.id, schedule.status)


def delete_schedule_for_branch_week(
    db: Session,
    current_user: UserRead,
    *,
    branch_id: int,
    start_date: date,
    end_date: date,
) -> None:
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required.")
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )
    _validate_week_period_http(start_date, end_date)
    branch = company_repository.get_branch_by_id(db, branch_id)
    if branch is None or branch.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch does not belong to the authenticated user's company.",
        )

    result = db.execute(
        text(
            """
            DELETE FROM schedules
            WHERE company_id = :company_id
              AND branch_id = :branch_id
              AND start_date = :start_date
              AND end_date = :end_date
            """
        ),
        {
            "company_id": current_user.company_id,
            "branch_id": branch_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule was not found.")
    db.commit()


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
    rows = schedule_repository.list_published_shift_rows_for_employee_period(
        db,
        current_user.employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    employee_name = current_user.full_name or ""
    return [
        ShiftRead(
            id=row["shift_id"],
            employee_id=current_user.employee_id,
            employee_name=employee_name,
            position_id=row["position_id"],
            position=row["position_name"],
            date=row["shift_date"],
            start_time=row["start_time"],
            end_time=row["end_time"],
        )
        for row in rows
    ]


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
    schedule_branch_id = _get_schedule_branch_id(db, schedule_id)
    rows = schedule_repository.list_schedule_shift_rows(db, schedule_id)
    requirements = schedule_repository.list_requirements(
        db,
        schedule.start_date,
        schedule.end_date,
        company_id=schedule.company_id,
        branch_id=schedule_branch_id,
    )
    unfilled = list(unfilled_override) if unfilled_override is not None else []

    if unfilled_override is None:
        for requirement in requirements:
            position = position_repository.get_position_by_id(
                db,
                requirement.position_id,
            )

            relevant_shifts = [
                row
                for row in rows
                if row["position_id"] == requirement.position_id
                and row["employee_id"] is not None
                and row["shift_date"] == requirement.shift_date
                and _matches_requirement_branch(
                    row["employee_branch_id"],
                    requirement.branch_id,
                )
                and row["start_time"] < requirement.end_time
                and row["end_time"] > requirement.start_time
            ]

            uncovered_segments = _calculate_uncovered_requirement_segments(
                requirement_start=requirement.start_time,
                requirement_end=requirement.end_time,
                required_staff=requirement.required_employees,
                assigned_shifts=relevant_shifts,
            )

            for segment in uncovered_segments:
                unfilled.append(
                    {
                        "requirement_id": requirement.id,
                        "position_id": requirement.position_id,
                        "position_title": position.name if position else "",
                        "date": requirement.shift_date,
                        "start_time": segment["start_time"],
                        "end_time": segment["end_time"],
                        "missing_staff": segment["missing_staff"],
                    }
                )
    return ScheduleRead(
        id=schedule_id,
        branch_id=schedule_branch_id,
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

def _matches_requirement_branch(
    employee_branch_id: int | None,
    requirement_branch_id: int | None,
) -> bool:
    return employee_branch_id == requirement_branch_id

def _calculate_uncovered_requirement_segments(
    *,
    requirement_start: time,
    requirement_end: time,
    required_staff: int,
    assigned_shifts: list[dict],
) -> list[dict]:
    """
    Calculate uncovered parts of a staffing requirement.

    The calculation uses 30-minute slots because schedule generation
    also works with 30-minute slots.

    Example:
        Requirement: 09:00-18:00, required_staff=1
        Assigned:    12:30-18:00

        Result:
        [
            {
                "start_time": 09:00,
                "end_time": 12:30,
                "missing_staff": 1,
            }
        ]
    """
    requirement_slots = _time_slots_30_minutes(
        requirement_start,
        requirement_end,
    )

    if not requirement_slots:
        return []

    missing_by_slot: list[tuple[time, int]] = []

    for slot_start in requirement_slots:
        slot_end = _add_minutes(slot_start, 30)

        assigned_count = sum(
            1
            for shift in assigned_shifts
            if shift["start_time"] < slot_end
            and shift["end_time"] > slot_start
        )

        missing_staff = max(
            required_staff - assigned_count,
            0,
        )

        missing_by_slot.append(
            (slot_start, missing_staff)
        )

    segments: list[dict] = []
    current_start: time | None = None
    current_missing_staff = 0

    for slot_start, missing_staff in missing_by_slot:
        if missing_staff == current_missing_staff:
            continue

        if current_start is not None and current_missing_staff > 0:
            segments.append(
                {
                    "start_time": current_start,
                    "end_time": slot_start,
                    "missing_staff": current_missing_staff,
                }
            )

        if missing_staff > 0:
            current_start = slot_start
        else:
            current_start = None

        current_missing_staff = missing_staff

    if current_start is not None and current_missing_staff > 0:
        segments.append(
            {
                "start_time": current_start,
                "end_time": requirement_end,
                "missing_staff": current_missing_staff,
            }
        )

    return segments


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


def _ensure_draft_schedule(schedule) -> None:
    if schedule.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft schedules can be edited.",
        )


def _ensure_shift_date_in_schedule(schedule, shift_date: date) -> None:
    if shift_date < schedule.start_date or shift_date > schedule.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shift date is outside the schedule period.",
        )


def _validate_week_period_http(start_date: date, end_date: date) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be later than or equal to start_date.",
        )


def _validate_generation_period_http(start_date: date, end_date: date) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be later than or equal to start_date.",
        )


def _get_schedule_branch_id(db: Session, schedule_id: int) -> int | None:
    return db.execute(
        text("SELECT branch_id FROM schedules WHERE id = :schedule_id"),
        {"schedule_id": schedule_id},
    ).scalar_one_or_none()


def _get_default_branch_id_for_company(db: Session, company_id: int) -> int:
    branch = company_repository.get_default_branch_for_company(db, company_id)
    if branch is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company does not have a branch.",
        )
    return branch.id


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
    enforce_position: bool = True,
    enforce_availability: bool = True,
) -> None:
    schedule = schedule_repository.get_schedule(db, schedule_id)
    _ensure_draft_schedule(schedule)
    _ensure_shift_date_in_schedule(schedule, shift_date)
    _ensure_time_range(start_time, end_time)
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
    schedule_branch_id = _get_schedule_branch_id(db, schedule_id)
    if employee.branch_id != schedule_branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee does not belong to this schedule's branch.",
        )
    if enforce_position and employee.position_id != position_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee does not match the required position for this shift.",
        )
    if schedule_repository.employee_has_absence_on_date(db, employee_id=employee_id, shift_date=shift_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee is absent on this date.",
        )
    if enforce_availability:
        availability_status = _get_employee_availability_status_for_date(
            db,
            employee_id=employee_id,
            shift_date=shift_date,
            start_time=start_time,
            end_time=end_time,
        )
        if availability_status not in {"available", "if_needed"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee is not available for this exact date and time.",
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


def _ensure_requirement_within_branch_working_hours(
    branch,
    *,
    shift_date: date,
    start_time: time,
    end_time: time,
) -> None:
    working_hours = branch.working_hours_by_weekday or {}
    weekday_hours = working_hours.get(str(shift_date.weekday()))
    if weekday_hours is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Branch is closed on this weekday.",
        )

    start_slot = _time_to_half_hour_slot(start_time)
    end_slot = _time_to_half_hour_slot(end_time)
    if start_slot is None or end_slot is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Requirement times must be aligned to 30-minute slots.",
        )

    working_start = weekday_hours.get("start_slot")
    working_end = weekday_hours.get("end_slot")
    if working_start is None or working_end is None or start_slot < working_start or end_slot > working_end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Requirement time must be within branch working hours for this date.",
        )


def _time_to_half_hour_slot(value: time) -> int | None:
    if value.second != 0 or value.microsecond != 0 or value.minute not in {0, 30}:
        return None
    return value.hour * 2 + value.minute // 30


def _get_employee_availability_status_for_date(
    db: Session,
    *,
    employee_id: int,
    shift_date: date,
    start_time,
    end_time,
) -> str | None:
    rows = list(
        db.execute(
            text(
                """
                SELECT start_time, end_time, availability_status
                FROM employee_availability
                WHERE employee_id = :employee_id
                  AND (
                    availability_date = :availability_date
                    OR (
                      availability_date IS NULL
                      AND weekday = :weekday
                    )
                  )
                  AND start_time < :end_time
                  AND end_time > :start_time
                ORDER BY availability_date NULLS LAST, start_time, end_time, id
                """
            ),
            {
                "employee_id": employee_id,
                "availability_date": shift_date,
                "weekday": shift_date.weekday(),
                "start_time": start_time,
                "end_time": end_time,
            },
        ).mappings()
    )
    if not rows:
        return None
    if any(row["availability_status"] == "unavailable" for row in rows):
        return "unavailable"

    slot_statuses: list[str] = []
    current = start_time
    while current < end_time:
        slot_end = min(_add_minutes(current, 30), end_time)
        covering_statuses = {
            row["availability_status"]
            for row in rows
            if row["start_time"] <= current and row["end_time"] >= slot_end
        }
        if "available" in covering_statuses:
            slot_statuses.append("available")
        elif "if_needed" in covering_statuses:
            slot_statuses.append("if_needed")
        else:
            return None
        current = slot_end

    if all(item == "available" for item in slot_statuses):
        return "available"
    return "if_needed"


def _add_minutes(value, minutes: int):
    return (datetime.combine(date.min, value) + timedelta(minutes=minutes)).time()

def _time_slots_30_minutes(
    start_time: time,
    end_time: time,
) -> list[time]:
    slots: list[time] = []
    current = start_time

    while current < end_time:
        slots.append(current)
        current = _add_minutes(current, 30)

    return slots


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
