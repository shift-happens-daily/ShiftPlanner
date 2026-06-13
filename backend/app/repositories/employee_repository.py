from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Employee, EmployeeAvailability, EmployeeDesiredDayOff, User


def list_employees(db: Session) -> list[Employee]:
    return list(
        db.scalars(
            select(Employee)
            .options(
                joinedload(Employee.user),
                joinedload(Employee.position),
                selectinload(Employee.availability_blocks),
                selectinload(Employee.desired_days_off),
            )
            .order_by(Employee.id)
        )
    )


def get_employee_by_id(db: Session, employee_id: int) -> Employee | None:
    return db.scalars(
        select(Employee)
        .options(
            joinedload(Employee.user),
            joinedload(Employee.position),
            selectinload(Employee.availability_blocks),
            selectinload(Employee.desired_days_off),
        )
        .where(Employee.id == employee_id)
    ).first()


def get_employee_by_email(db: Session, email: str) -> Employee | None:
    return db.scalars(
        select(Employee)
        .join(Employee.user)
        .options(joinedload(Employee.user), joinedload(Employee.position))
        .where(User.email.ilike(email))
    ).first()


def get_employee_by_user_id(db: Session, user_id: int) -> Employee | None:
    return db.scalars(
        select(Employee)
        .options(joinedload(Employee.user), joinedload(Employee.position))
        .where(Employee.user_id == user_id)
    ).first()


def create_employee(
    db: Session,
    *,
    user_id: int,
    company_id: int,
    branch_id: int | None,
    position_id: int,
) -> Employee:
    employee = Employee(
        user_id=user_id,
        company_id=company_id,
        branch_id=branch_id,
        position_id=position_id,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return get_employee_by_id(db, employee.id)


def replace_availability(
    db: Session,
    *,
    employee_id: int,
    blocks: list[dict],
    desired_days_off: list[int],
) -> Employee:
    db.execute(delete(EmployeeAvailability).where(EmployeeAvailability.employee_id == employee_id))
    db.execute(delete(EmployeeDesiredDayOff).where(EmployeeDesiredDayOff.employee_id == employee_id))

    for block in blocks:
        db.add(
            EmployeeAvailability(
                employee_id=employee_id,
                weekday=block["weekday"],
                start_time=block["start_time"],
                end_time=block["end_time"],
            )
        )

    for weekday in desired_days_off:
        db.add(EmployeeDesiredDayOff(employee_id=employee_id, weekday=weekday))

    db.commit()
    return get_employee_by_id(db, employee_id)


def list_employees_by_position(db: Session, position_id: int) -> list[Employee]:
    return list(
        db.scalars(
            select(Employee)
            .options(joinedload(Employee.user), joinedload(Employee.position))
            .where(Employee.position_id == position_id, Employee.is_active.is_(True))
            .order_by(Employee.id)
        )
    )
