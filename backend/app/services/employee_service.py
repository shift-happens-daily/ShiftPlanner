from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, user_repository
from app.schemas.employee import AvailabilityRead, AvailabilityUpsert, EmployeeCreate, EmployeeRead
from app.services import auth_service


def list_employees(db: Session) -> list[EmployeeRead]:
    return [_build_employee_read(employee) for employee in employee_repository.list_employees(db)]


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


def _build_employee_read(employee) -> EmployeeRead:
    return EmployeeRead(
        id=employee.id,
        full_name=employee.user.full_name,
        email=employee.user.email,
        position_id=employee.position_id or 0,
        position_title=employee.position.name if getattr(employee, "position", None) is not None else "",
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
