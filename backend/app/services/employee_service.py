from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, schedule_repository, user_repository
from app.schemas.employee import (
    AbsenceCreate,
    AbsenceRead,
    AvailabilityRead,
    AvailabilityUpsert,
    EmployeeBranchAssignmentRead,
    EmployeeBranchRead,
    EmployeeBranchesUpdate,
    EmployeeBranchUpdate,
    EmployeeCalendarEmployeeRead,
    EmployeeCalendarPositionRead,
    EmployeeCalendarShiftRead,
    EmployeeCalendarSummaryRead,
    EmployeeCreate,
    EmployeePositionRead,
    EmployeePositionUpdate,
    EmployeeRead,
    EmployeeWorkloadRead,
    EmployeeWorkLimits,
)
from app.schemas.auth import UserRead
from app.services import auth_service

DEFAULT_MAX_HOURS_PER_WEEK = 40
DEFAULT_MAX_HOURS_PER_DAY = 8


def list_employees(db: Session, current_user: UserRead) -> list[EmployeeRead]:
    if current_user.company_id is None:
        if current_user.role == "manager":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager is not linked to a company.",
            )
        return []

    return [
        _build_employee_read(employee)
        for employee in employee_repository.list_employees_by_company(db, current_user.company_id)
    ]


def get_employee(db: Session, employee_id: int, current_user: UserRead) -> EmployeeRead:
    employee = _get_visible_employee_or_404(db, employee_id, current_user)
    return _build_employee_read(employee)


def get_work_limits(db: Session, employee_id: int, current_user: UserRead) -> EmployeeWorkLimits:
    employee = _get_company_employee_for_manager_or_404(db, employee_id, current_user)
    return _build_work_limits_read(employee)


def update_work_limits(
    db: Session,
    employee_id: int,
    payload: EmployeeWorkLimits,
    current_user: UserRead,
) -> EmployeeWorkLimits:
    employee = _get_company_employee_for_manager_or_404(db, employee_id, current_user)
    updated_employee = employee_repository.update_employee_work_limits(
        db,
        employee=employee,
        max_hours_per_week=payload.max_hours_per_week,
        max_hours_per_day=payload.max_hours_per_day,
    )
    return _build_work_limits_read(updated_employee)


def create_employee(db: Session, payload: EmployeeCreate, current_user: UserRead) -> EmployeeRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    position = position_repository.get_position_by_id(db, payload.position_id)
    if position is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Position {payload.position_id} was not found.")
    if position.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Position does not belong to the authenticated user's company.",
        )
    if user_repository.get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email already exists.")

    branch = company_repository.get_default_branch_for_company(db, current_user.company_id)
    user = user_repository.create_user(
        db,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=auth_service.create_placeholder_employee_password(),
        role="employee",
        is_registration_complete=False,
    )
    employee = employee_repository.create_employee(
        db,
        user_id=user.id,
        company_id=current_user.company_id,
        branch_id=branch.id if branch else None,
        position_id=position.id,
        is_active=True,
    )
    return _build_employee_read(employee)


def update_employee_position(
    db: Session,
    employee_id: int,
    payload: EmployeePositionUpdate,
    current_user: UserRead,
) -> EmployeeRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee was not found.",
        )
    if employee.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to the authenticated user's company.",
        )

    if payload.position_id is not None:
        position = position_repository.get_position_by_id(db, payload.position_id)
        if position is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position was not found.",
            )
        if position.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Position does not belong to the authenticated user's company.",
            )

    updated_employee = employee_repository.update_employee_position(
        db,
        employee=employee,
        position_id=payload.position_id,
    )
    return _build_employee_read(updated_employee)


def update_own_employee_position(
    db: Session,
    payload: EmployeePositionUpdate,
    current_user: UserRead,
) -> None:
    if current_user.employee_id is None or current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )

    employee = employee_repository.get_employee_by_id(db, current_user.employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )

    if payload.position_id is not None:
        position = position_repository.get_position_by_id(db, payload.position_id)
        if position is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position was not found.",
            )
        if position.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Position does not belong to the authenticated user's company.",
            )

    employee_repository.update_employee_position(
        db,
        employee=employee,
        position_id=payload.position_id,
    )


def delete_employee_from_company(db: Session, employee_id: int, current_user: UserRead) -> None:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee was not found.",
        )
    if employee.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to the authenticated user's company.",
        )

    employee_repository.delete_employee(db, employee)


def leave_company(db: Session, current_user: UserRead) -> None:
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )

    employee = employee_repository.get_employee_by_id(db, current_user.employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )

    employee_repository.delete_employee(db, employee)


def update_employee_branch(
    db: Session,
    employee_id: int,
    payload: EmployeeBranchUpdate,
    current_user: UserRead,
) -> EmployeeRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    if employee.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to the authenticated user's company.",
        )

    if payload.branch_id is not None:
        branch = company_repository.get_branch_by_id(db, payload.branch_id)
        if branch is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch was not found.")
        if branch.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated user's company.",
            )

    updated_employee = employee_repository.update_employee_branch(
        db,
        employee=employee,
        branch_id=payload.branch_id,
    )
    return _build_employee_read(updated_employee)


def list_employee_branches(
    db: Session,
    employee_id: int,
    current_user: UserRead,
) -> list[EmployeeBranchAssignmentRead]:
    employee = _get_visible_employee_or_404(db, employee_id, current_user)
    return _build_employee_branches_read(employee)


def replace_employee_branches(
    db: Session,
    employee_id: int,
    payload: EmployeeBranchesUpdate,
    current_user: UserRead,
) -> list[EmployeeBranchAssignmentRead]:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    if employee.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to the authenticated user's company.",
        )

    _validate_branch_assignment(
        db,
        company_id=current_user.company_id,
        branch_ids=payload.branch_ids,
        primary_branch_id=payload.primary_branch_id,
    )

    updated_employee = employee_repository.update_employee_branches(
        db,
        employee=employee,
        branch_ids=payload.branch_ids,
        primary_branch_id=payload.primary_branch_id,
    )
    return _build_employee_branches_read(updated_employee)


def get_availability(db: Session, employee_id: int) -> AvailabilityRead:
    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    return _build_availability_read(employee)


def upsert_availability(db: Session, employee_id: int, payload: AvailabilityUpsert) -> AvailabilityRead:
    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    updated_employee = employee_repository.replace_availability(
        db,
        employee_id=employee_id,
        blocks=[block.model_dump() for block in payload.weekly_availability],
        daily_blocks=[block.model_dump() for block in payload.daily_availability] or None,
        desired_days_off=payload.desired_days_off,
    )
    return _build_availability_read(updated_employee)


def list_absences(
    db: Session,
    employee_id: int,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[AbsenceRead]:
    employee = _get_employee_or_404(db, employee_id)
    absences = employee_repository.list_absences(db, employee_id=employee.id, start_date=start_date, end_date=end_date)
    return [_build_absence_read(absence) for absence in absences]


def create_absence(db: Session, employee_id: int, payload: AbsenceCreate) -> AbsenceRead:
    employee = _get_employee_or_404(db, employee_id)
    absence = employee_repository.create_absence(
        db,
        employee_id=employee.id,
        absence_type=payload.absence_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        comment=payload.comment,
    )
    return _build_absence_read(absence)


def delete_absence(db: Session, employee_id: int, absence_id: int) -> None:
    _get_employee_or_404(db, employee_id)
    absence = employee_repository.get_absence_by_id(db, absence_id)
    if absence is None or absence.employee_id != employee_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Absence was not found.")
    employee_repository.delete_absence(db, absence)


def get_calendar_summary(
    db: Session,
    employee_id: int,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
) -> EmployeeCalendarSummaryRead:
    employee = _get_employee_or_404(db, employee_id)
    absences = employee_repository.list_absences(db, employee_id=employee.id, start_date=start_date, end_date=end_date)
    shifts = schedule_repository.list_published_shift_rows_for_employee_period(
        db,
        employee.id,
        start_date=start_date,
        end_date=end_date,
    )
    total_hours = 0.0
    for shift in shifts:
        duration = datetime.combine(date.min, shift["end_time"]) - datetime.combine(date.min, shift["start_time"])
        total_hours += duration.total_seconds() / 3600

    position = None
    if employee.position is not None:
        position = EmployeeCalendarPositionRead(id=employee.position.id, name=employee.position.name)

    return EmployeeCalendarSummaryRead(
        employee=EmployeeCalendarEmployeeRead(
            id=employee.id,
            full_name=employee.user.full_name,
            position=position,
        ),
        availability=[
            {
                "weekday": block.weekday,
                "start_time": block.start_time,
                "end_time": block.end_time,
                "availability_status": block.availability_status,
            }
            for block in sorted(employee.availability_blocks, key=lambda item: (item.weekday, item.start_time))
        ],
        desired_days_off=sorted(day.weekday for day in employee.desired_days_off),
        absences=[_build_absence_read(absence) for absence in absences],
        shifts=[
            EmployeeCalendarShiftRead(
                shift_id=shift["shift_id"],
                schedule_id=shift["schedule_id"],
                date=shift["shift_date"],
                start_time=shift["start_time"],
                end_time=shift["end_time"],
                status=shift["status"],
            )
            for shift in shifts
        ],
        workload=EmployeeWorkloadRead(total_shifts=len(shifts), total_hours=total_hours),
    )


def _build_employee_read(employee) -> EmployeeRead:
    branch = None
    if employee.branch is not None:
        branch = EmployeeBranchRead(id=employee.branch.id, name=employee.branch.name)

    position = None
    if employee.position is not None:
        position = EmployeePositionRead(id=employee.position.id, name=employee.position.name)

    return EmployeeRead(
        id=employee.id,
        public_id=employee.user.public_id,
        full_name=employee.user.full_name,
        email=employee.user.email,
        role=employee.user.role,
        branch_id=employee.branch_id,
        position_id=employee.position_id,
        position_title=employee.position.name if employee.position is not None else "",
        max_hours_per_week=_work_limit_or_default(employee.max_hours_per_week, DEFAULT_MAX_HOURS_PER_WEEK),
        max_hours_per_day=_work_limit_or_default(employee.max_hours_per_day, DEFAULT_MAX_HOURS_PER_DAY),
        branch=branch,
        branches=_build_employee_branches_read(employee),
        position=position,
        availability=_build_availability_read(employee),
    )


def _build_work_limits_read(employee) -> EmployeeWorkLimits:
    return EmployeeWorkLimits(
        max_hours_per_week=_work_limit_or_default(employee.max_hours_per_week, DEFAULT_MAX_HOURS_PER_WEEK),
        max_hours_per_day=_work_limit_or_default(employee.max_hours_per_day, DEFAULT_MAX_HOURS_PER_DAY),
    )


def _work_limit_or_default(value: int | None, default: int) -> int:
    return value if value is not None else default


def _build_employee_branches_read(employee) -> list[EmployeeBranchAssignmentRead]:
    return [
        EmployeeBranchAssignmentRead(
            id=link.branch.id,
            name=link.branch.name,
            is_primary=link.is_primary,
        )
        for link in sorted(employee.branch_links, key=lambda item: (not item.is_primary, item.branch_id))
        if link.branch is not None
    ]


def _build_availability_read(employee) -> AvailabilityRead:
    weekly_blocks = []
    daily_blocks = []
    for block in employee.availability_blocks:
        payload = {
            "start_time": block.start_time,
            "end_time": block.end_time,
            "availability_status": block.availability_status,
        }
        if block.availability_date is not None:
            daily_blocks.append({"date": block.availability_date, **payload})
        else:
            weekly_blocks.append({"weekday": block.weekday, **payload})

    return AvailabilityRead(
        employee_id=employee.id,
        weekly_availability=sorted(weekly_blocks, key=lambda item: (item["weekday"], item["start_time"])),
        daily_availability=sorted(daily_blocks, key=lambda item: (item["date"], item["start_time"])),
        desired_days_off=sorted(day.weekday for day in employee.desired_days_off),
    )


def _build_absence_read(absence) -> AbsenceRead:
    return AbsenceRead(
        id=absence.id,
        employee_id=absence.employee_id,
        absence_type=absence.absence_type,
        start_date=absence.start_date,
        end_date=absence.end_date,
        comment=absence.comment,
    )


def _get_employee_or_404(db: Session, employee_id: int):
    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    return employee


def _get_visible_employee_or_404(db: Session, employee_id: int, current_user: UserRead):
    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    if current_user.role == "manager":
        if current_user.company_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager is not linked to a company.",
            )
        if employee.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employee does not belong to the authenticated user's company.",
            )
        return employee
    if current_user.employee_id == employee_id and current_user.employee_status in (None, "active"):
        return employee
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this employee resource.",
    )


def _get_company_employee_for_manager_or_404(db: Session, employee_id: int, current_user: UserRead):
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    employee = employee_repository.get_employee_by_id(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    if employee.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to the authenticated user's company.",
        )
    return employee


def _validate_branch_assignment(
    db: Session,
    *,
    company_id: int,
    branch_ids: list[int],
    primary_branch_id: int,
) -> None:
    if len(set(branch_ids)) != len(branch_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Branch IDs must be unique.",
        )
    if primary_branch_id not in branch_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primary branch must be included in branch_ids.",
        )

    for branch_id in branch_ids:
        branch = company_repository.get_branch_by_id(db, branch_id)
        if branch is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch was not found.")
        if branch.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated user's company.",
            )
