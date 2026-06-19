from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, schedule_repository, user_repository
from app.schemas.employee import (
    AbsenceCreate,
    AbsenceRead,
    AvailabilityRead,
    AvailabilityUpsert,
    EmployeeCalendarEmployeeRead,
    EmployeeCalendarPositionRead,
    EmployeeCalendarShiftRead,
    EmployeeCalendarSummaryRead,
    EmployeeCreate,
    EmployeePositionRead,
    EmployeeRead,
    EmployeeWorkloadRead,
)
from app.schemas.auth import UserRead
from app.services import auth_service


def list_employees(db: Session, current_user: UserRead) -> list[EmployeeRead]:
    if current_user.company_id is None:
        return []

    return [
        _build_employee_read(employee)
        for employee in employee_repository.list_employees_by_company(db, current_user.company_id)
    ]


def create_employee(db: Session, payload: EmployeeCreate) -> EmployeeRead:
    position = position_repository.get_position_by_id(db, payload.position_id)
    if position is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Position {payload.position_id} was not found.")
    if user_repository.get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email already exists.")

    branch = company_repository.get_default_branch_for_company(db, position.company_id)
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
        company_id=position.company_id,
        branch_id=branch.id if branch else None,
        position_id=position.id,
    )
    return _build_employee_read(employee)


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
    position = None
    if employee.position is not None:
        position = EmployeePositionRead(id=employee.position.id, name=employee.position.name)

    return EmployeeRead(
        id=employee.id,
        full_name=employee.user.full_name,
        email=employee.user.email,
        role=employee.user.role,
        position_id=employee.position_id,
        position_title=employee.position.name if employee.position is not None else "",
        position=position,
        availability=_build_availability_read(employee),
    )


def _build_availability_read(employee) -> AvailabilityRead:
    return AvailabilityRead(
        employee_id=employee.id,
        weekly_availability=[
            {
                "weekday": block.weekday,
                "start_time": block.start_time,
                "end_time": block.end_time,
            }
            for block in sorted(employee.availability_blocks, key=lambda item: (item.weekday, item.start_time))
        ],
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
