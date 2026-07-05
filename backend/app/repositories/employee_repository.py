from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Absence, Employee, EmployeeAvailability, EmployeeBranch, EmployeeDesiredDayOff, EmployeePosition, User


def _employee_options():
    return (
        joinedload(Employee.user),
        joinedload(Employee.company),
        selectinload(Employee.branch_links).joinedload(EmployeeBranch.branch),
        selectinload(Employee.position_links).joinedload(EmployeePosition.position),
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
            .where(Employee.company_id == company_id, Employee.is_active.is_(True))
            .order_by(Employee.id)
        )
    )


def list_pending_employees_by_company(db: Session, company_id: int) -> list[Employee]:
    return list(
        db.scalars(
            select(Employee)
            .options(*_employee_options())
            .where(Employee.company_id == company_id, Employee.is_active.is_(False))
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
    branch_ids: list[int] | None = None,
    primary_branch_id: int | None = None,
    is_active: bool = True,
) -> Employee:
    employee = Employee(
        user_id=user_id,
        company_id=company_id,
        is_active=is_active,
    )

    db.add(employee)
    db.flush()
    if branch_ids is None:
        _replace_employee_branch(db, employee.id, branch_id)
    else:
        replace_employee_branches(db, employee_id=employee.id, branch_ids=branch_ids, primary_branch_id=primary_branch_id)
    _replace_employee_position(db, employee.id, position_id)
    db.commit()
    db.expire_all()

    return get_employee_by_id(db, employee.id)


def update_employee_membership(
    db: Session,
    *,
    employee: Employee,
    company_id: int,
    branch_id: int | None,
    position_id: int | None,
    branch_ids: list[int] | None = None,
    primary_branch_id: int | None = None,
    is_active: bool | None = None,
) -> Employee:
    employee.company_id = company_id
    if is_active is not None:
        employee.is_active = is_active

    db.add(employee)
    db.flush()
    if branch_ids is None:
        _replace_employee_branch(db, employee.id, branch_id)
    else:
        replace_employee_branches(db, employee_id=employee.id, branch_ids=branch_ids, primary_branch_id=primary_branch_id)
    _replace_employee_position(db, employee.id, position_id)
    db.commit()
    db.expire_all()

    return get_employee_by_id(db, employee.id)


def update_employee_status(
    db: Session,
    *,
    employee: Employee,
    is_active: bool,
) -> Employee:
    employee.is_active = is_active
    db.add(employee)
    db.commit()
    db.expire_all()
    return get_employee_by_id(db, employee.id)


def update_employee_work_limits(
    db: Session,
    *,
    employee: Employee,
    max_hours_per_week: int,
    max_hours_per_day: int,
) -> Employee:
    employee.max_hours_per_week = max_hours_per_week
    employee.max_hours_per_day = max_hours_per_day
    db.add(employee)
    db.commit()
    db.expire_all()
    return get_employee_by_id(db, employee.id)


def update_employee_position(
    db: Session,
    *,
    employee: Employee,
    position_id: int | None,
) -> Employee:
    db.add(employee)
    db.flush()
    _replace_employee_position(db, employee.id, position_id)
    db.commit()
    db.expire_all()
    return get_employee_by_id(db, employee.id)


def update_employee_branch(
    db: Session,
    *,
    employee: Employee,
    branch_id: int | None,
) -> Employee:
    db.add(employee)
    db.flush()
    _replace_employee_branch(db, employee.id, branch_id)
    db.commit()
    db.expire_all()
    return get_employee_by_id(db, employee.id)


def update_employee_branches(
    db: Session,
    *,
    employee: Employee,
    branch_ids: list[int],
    primary_branch_id: int,
) -> Employee:
    db.add(employee)
    db.flush()
    replace_employee_branches(
        db,
        employee_id=employee.id,
        branch_ids=branch_ids,
        primary_branch_id=primary_branch_id,
    )
    db.commit()
    db.expire_all()
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


def delete_employee(db: Session, employee: Employee) -> None:
    db.delete(employee)
    db.commit()


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

    return get_employee_by_id(db, employee_id)


def list_employees_by_position(db: Session, position_id: int) -> list[Employee]:
    return list(
        db.scalars(
            select(Employee)
            .join(EmployeePosition, EmployeePosition.employee_id == Employee.id)
            .options(*_employee_options())
            .where(EmployeePosition.position_id == position_id, Employee.is_active.is_(True))
            .order_by(Employee.id)
        )
    )


def employee_has_position(db: Session, employee_id: int, position_id: int) -> bool:
    return db.scalar(
        select(EmployeePosition.id)
        .where(EmployeePosition.employee_id == employee_id, EmployeePosition.position_id == position_id)
        .limit(1)
    ) is not None


def _replace_employee_branch(db: Session, employee_id: int, branch_id: int | None) -> None:
    branch_ids = [] if branch_id is None else [branch_id]
    replace_employee_branches(db, employee_id=employee_id, branch_ids=branch_ids, primary_branch_id=branch_id)


def replace_employee_branches(
    db: Session,
    *,
    employee_id: int,
    branch_ids: list[int],
    primary_branch_id: int | None,
) -> None:
    db.execute(delete(EmployeeBranch).where(EmployeeBranch.employee_id == employee_id))
    for branch_id in branch_ids:
        db.add(
            EmployeeBranch(
                employee_id=employee_id,
                branch_id=branch_id,
                is_primary=primary_branch_id is not None and branch_id == primary_branch_id,
            )
        )


def _replace_employee_position(db: Session, employee_id: int, position_id: int | None) -> None:
    db.execute(delete(EmployeePosition).where(EmployeePosition.employee_id == employee_id))
    if position_id is not None:
        db.add(EmployeePosition(employee_id=employee_id, position_id=position_id, is_primary=True))


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


def delete_employee(db: Session, employee: Employee) -> None:
    db.delete(employee)
    db.commit()

