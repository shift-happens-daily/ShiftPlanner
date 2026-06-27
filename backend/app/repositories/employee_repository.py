from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Absence, Employee, EmployeeAvailability, EmployeeDesiredDayOff, User


def _employee_options():
    return (
        joinedload(Employee.user),
        joinedload(Employee.company),
        joinedload(Employee.branch),
        joinedload(Employee.position),
        selectinload(Employee.availability_blocks),
        selectinload(Employee.desired_days_off),
    )


def list_employees(db: Session) -> list[Employee]:
    return list(
        db.scalars(
            select(Employee)
            .options(*_employee_options())
            .order_by(Employee.id)
        )
    )


def list_employees_by_company(db: Session, company_id: int) -> list[Employee]:
    return list(
        db.scalars(
            select(Employee)
            .options(*_employee_options())
            .where(Employee.company_id == company_id)
            .order_by(Employee.id)
        )
    )


def get_employee_by_id(db: Session, employee_id: int) -> Employee | None:
    return db.scalars(
        select(Employee)
        .options(*_employee_options())
        .where(Employee.id == employee_id)
    ).first()


def get_employee_by_email(db: Session, email: str) -> Employee | None:
    return db.scalars(
        select(Employee)
        .join(Employee.user)
        .options(*_employee_options())
        .where(User.email.ilike(email))
    ).first()


def get_employee_by_user_id(db: Session, user_id: int) -> Employee | None:
    return db.scalars(
        select(Employee)
        .options(*_employee_options())
        .where(Employee.user_id == user_id)
    ).first()


def create_employee(
    db: Session,
    *,
    user_id: int,
    company_id: int,
    branch_id: int | None,
    position_id: int | None,
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


def update_employee_membership(
    db: Session,
    *,
    employee: Employee,
    company_id: int,
    branch_id: int | None,
    position_id: int | None,
) -> Employee:
    employee.company_id = company_id
    employee.branch_id = branch_id
    employee.position_id = position_id

    db.add(employee)
    db.commit()
    db.refresh(employee)

    return get_employee_by_id(db, employee.id)


def update_employee_position(
    db: Session,
    *,
    employee: Employee,
    position_id: int | None,
) -> Employee:
    employee.position_id = position_id
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return get_employee_by_id(db, employee.id)


def update_employee_branch(
    db: Session,
    *,
    employee: Employee,
    branch_id: int | None,
) -> Employee:
    employee.branch_id = branch_id
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return get_employee_by_id(db, employee.id)


def delete_employees_by_company(db: Session, company_id: int) -> None:
    employees = list(
        db.scalars(
            select(Employee).where(Employee.company_id == company_id)
        )
    )

    for employee in employees:
        db.delete(employee)

    db.flush()


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
                availability_status=block.get("availability_status", "available"),
            )
        )

    for weekday in desired_days_off:
        db.add(EmployeeDesiredDayOff(employee_id=employee_id, weekday=weekday))

    db.commit()
    db.expire_all()

    return get_employee_by_id(db, employee_id)


def list_employees_by_position(db: Session, position_id: int) -> list[Employee]:
    return list(
        db.scalars(
            select(Employee)
            .options(*_employee_options())
            .where(Employee.position_id == position_id, Employee.is_active.is_(True))
            .order_by(Employee.id)
        )
    )


def list_absences(
    db: Session,
    *,
    employee_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[Absence]:
    query = (
        select(Absence)
        .where(Absence.employee_id == employee_id)
        .order_by(Absence.start_date, Absence.id)
    )

    if start_date is not None:
        query = query.where(Absence.end_date >= start_date)

    if end_date is not None:
        query = query.where(Absence.start_date <= end_date)

    return list(db.scalars(query))


def create_absence(
    db: Session,
    *,
    employee_id: int,
    absence_type: str,
    start_date: date,
    end_date: date,
    comment: str | None,
) -> Absence:
    absence = Absence(
        employee_id=employee_id,
        absence_type=absence_type,
        start_date=start_date,
        end_date=end_date,
        comment=comment,
    )

    db.add(absence)
    db.commit()
    db.refresh(absence)

    return absence


def get_absence_by_id(db: Session, absence_id: int) -> Absence | None:
    return db.get(Absence, absence_id)


def delete_absence(db: Session, absence: Absence) -> None:
    db.delete(absence)
    db.commit()

