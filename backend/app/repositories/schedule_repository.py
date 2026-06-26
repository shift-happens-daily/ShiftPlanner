from datetime import UTC, date, datetime

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session

from app.models import Absence, Branch, Employee, Position, Schedule, Shift, ShiftAssignment, ShiftExchangeRequest, ShiftRequirement, User


def create_requirement(
    db: Session,
    *,
    company_id: int,
    branch_id: int | None = None,
    position_id: int,
    shift_date: date,
    start_time,
    end_time,
    required_employees: int,
) -> ShiftRequirement:
    requirement = ShiftRequirement(
        company_id=company_id,
        branch_id=branch_id,
        position_id=position_id,
        shift_date=shift_date,
        start_time=start_time,
        end_time=end_time,
        required_employees=required_employees,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def update_requirement(
    db: Session,
    requirement: ShiftRequirement,
    *,
    branch_id: int,
    position_id: int,
    shift_date: date,
    start_time,
    end_time,
    required_employees: int,
) -> ShiftRequirement:
    requirement.branch_id = branch_id
    requirement.position_id = position_id
    requirement.shift_date = shift_date
    requirement.start_time = start_time
    requirement.end_time = end_time
    requirement.required_employees = required_employees

    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def list_requirements(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    position_id: int | None = None,
    company_id: int | None = None,
    branch_id: int | None = None,
) -> list[ShiftRequirement]:
    query = select(ShiftRequirement).order_by(ShiftRequirement.shift_date, ShiftRequirement.id)
    if company_id is not None:
        query = query.where(ShiftRequirement.company_id == company_id)
    if branch_id is not None:
        query = query.where(ShiftRequirement.branch_id == branch_id)
    if start_date is not None:
        query = query.where(ShiftRequirement.shift_date >= start_date)
    if end_date is not None:
        query = query.where(ShiftRequirement.shift_date <= end_date)
    if position_id is not None:
        query = query.where(ShiftRequirement.position_id == position_id)
    return list(db.scalars(query))


def create_requirements_bulk(db: Session, items: list[dict]) -> list[ShiftRequirement]:
    requirements = [
        ShiftRequirement(
            company_id=item["company_id"],
            branch_id=item.get("branch_id"),
            position_id=item["position_id"],
            shift_date=item["shift_date"],
            start_time=item["start_time"],
            end_time=item["end_time"],
            required_employees=item["required_employees"],
        )
        for item in items
    ]
    db.add_all(requirements)
    db.commit()
    return requirements


def create_schedule(
    db: Session,
    *,
    company_id: int,
    start_date: date,
    end_date: date,
    generated_shifts: list[dict],
) -> Schedule:
    existing_drafts = list(
        db.scalars(
            select(Schedule).where(
                Schedule.company_id == company_id,
                Schedule.start_date == start_date,
                Schedule.end_date == end_date,
                Schedule.status == "draft",
            )
        )
    )
    for existing_draft in existing_drafts:
        db.delete(existing_draft)
    db.flush()

    schedule = Schedule(company_id=company_id, start_date=start_date, end_date=end_date, status="draft")
    db.add(schedule)
    db.flush()

    for item in generated_shifts:
        shift = Shift(
            schedule_id=schedule.id,
            company_id=company_id,
            position_id=item["position_id"],
            shift_date=item["date"],
            start_time=item["start_time"],
            end_time=item["end_time"],
        )
        db.add(shift)
        db.flush()
        db.add(ShiftAssignment(shift_id=shift.id, employee_id=item["employee_id"], status="assigned"))

    db.commit()
    db.refresh(schedule)
    return schedule


def get_schedule(db: Session, schedule_id: int) -> Schedule | None:
    return db.get(Schedule, schedule_id)


def get_latest_schedule(
    db: Session,
    *,
    company_id: int,
    schedule_status: str | None = None,
) -> Schedule | None:
    query = select(Schedule).where(Schedule.company_id == company_id)
    if schedule_status is not None:
        query = query.where(Schedule.status == schedule_status)
    return db.scalars(query.order_by(Schedule.id.desc())).first()


def list_schedule_shift_rows(db: Session, schedule_id: int) -> list[dict]:
    return list(
        db.execute(
            select(
                Shift.id.label("shift_id"),
                Shift.shift_date,
                Shift.start_time,
                Shift.end_time,
                Position.id.label("position_id"),
                Position.name.label("position_name"),
                Employee.id.label("employee_id"),
                User.full_name.label("employee_name"),
                ShiftAssignment.id.label("assignment_id"),
            )
            .outerjoin(
                ShiftAssignment,
                (ShiftAssignment.shift_id == Shift.id) & (ShiftAssignment.status == "assigned"),
            )
            .outerjoin(Employee, Employee.id == ShiftAssignment.employee_id)
            .outerjoin(User, User.id == Employee.user_id)
            .join(Position, Position.id == Shift.position_id)
            .where(Shift.schedule_id == schedule_id)
            .order_by(Shift.id)
        ).mappings()
    )


def publish_schedule(db: Session, schedule: Schedule) -> Schedule:
    db.execute(
        update(Schedule)
        .where(
            Schedule.company_id == schedule.company_id,
            Schedule.id != schedule.id,
            Schedule.status == "published",
            Schedule.start_date <= schedule.end_date,
            Schedule.end_date >= schedule.start_date,
        )
        .values(status="archived")
    )
    schedule.status = "published"
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


def get_shift_row(db: Session, schedule_id: int, shift_id: int) -> dict | None:
    row = db.execute(
        select(
            Shift.id.label("shift_id"),
            Shift.position_id,
            Shift.shift_date,
            Shift.start_time,
            Shift.end_time,
            ShiftAssignment.id.label("assignment_id"),
            ShiftAssignment.employee_id,
        )
        .outerjoin(
            ShiftAssignment,
            (ShiftAssignment.shift_id == Shift.id) & (ShiftAssignment.status == "assigned"),
        )
        .where(Shift.schedule_id == schedule_id, Shift.id == shift_id)
    ).mappings().first()
    return None if row is None else dict(row)


def create_shift(
    db: Session,
    *,
    schedule_id: int,
    company_id: int,
    position_id: int,
    shift_date: date,
    start_time,
    end_time,
    employee_id: int | None = None,
) -> Shift:
    shift = Shift(
        schedule_id=schedule_id,
        company_id=company_id,
        position_id=position_id,
        shift_date=shift_date,
        start_time=start_time,
        end_time=end_time,
    )
    db.add(shift)
    db.flush()
    if employee_id is not None:
        db.add(ShiftAssignment(shift_id=shift.id, employee_id=employee_id, status="assigned"))
    db.commit()
    db.refresh(shift)
    return shift


def update_shift(
    db: Session,
    *,
    shift_id: int,
    position_id: int,
    shift_date: date,
    start_time,
    end_time,
    employee_id: int | None,
    replace_assignment: bool,
) -> Shift:
    shift = db.get(Shift, shift_id)
    shift.position_id = position_id
    shift.shift_date = shift_date
    shift.start_time = start_time
    shift.end_time = end_time

    if replace_assignment:
        db.execute(delete(ShiftAssignment).where(ShiftAssignment.shift_id == shift_id))
        if employee_id is not None:
            db.add(ShiftAssignment(shift_id=shift_id, employee_id=employee_id, status="assigned"))

    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


def remove_shift(db: Session, schedule_id: int, shift_id: int) -> None:
    db.execute(delete(ShiftAssignment).where(ShiftAssignment.shift_id == shift_id))
    db.execute(delete(Shift).where(Shift.schedule_id == schedule_id, Shift.id == shift_id))
    db.commit()


def reassign_shift(db: Session, assignment_id: int, employee_id: int) -> None:
    assignment = db.get(ShiftAssignment, assignment_id)
    assignment.employee_id = employee_id
    db.add(assignment)
    db.commit()


def has_overlapping_assignment(
    db: Session,
    *,
    schedule_id: int,
    employee_id: int,
    shift_date: date,
    start_time,
    end_time,
    exclude_shift_id: int | None = None,
) -> bool:
    query = (
        select(Shift.id)
        .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.id)
        .where(
            Shift.schedule_id == schedule_id,
            ShiftAssignment.employee_id == employee_id,
            ShiftAssignment.status == "assigned",
            Shift.shift_date == shift_date,
            Shift.start_time < end_time,
            Shift.end_time > start_time,
        )
        .limit(1)
    )
    if exclude_shift_id is not None:
        query = query.where(Shift.id != exclude_shift_id)
    return db.scalar(query) is not None


def count_assigned_shifts_for_requirement_slot(
    db: Session,
    *,
    schedule_id: int,
    position_id: int,
    shift_date: date,
    start_time,
    end_time,
) -> int:
    return db.scalar(
        select(func.count(ShiftAssignment.id))
        .join(Shift, Shift.id == ShiftAssignment.shift_id)
        .where(
            Shift.schedule_id == schedule_id,
            Shift.position_id == position_id,
            Shift.shift_date == shift_date,
            Shift.start_time == start_time,
            Shift.end_time == end_time,
            ShiftAssignment.status == "assigned",
        )
    ) or 0


def employee_has_absence_on_date(db: Session, *, employee_id: int, shift_date: date) -> bool:
    return db.scalar(
        select(Absence.id)
        .where(
            Absence.employee_id == employee_id,
            Absence.start_date <= shift_date,
            Absence.end_date >= shift_date,
        )
        .limit(1)
    ) is not None


def get_employee_availability_status(
    db: Session,
    *,
    employee_id: int,
    weekday: int,
    start_time,
    end_time,
) -> str | None:
    rows = list(
        db.execute(
            text(
                """
                SELECT availability_status
                FROM employee_availability
                WHERE employee_id = :employee_id
                  AND weekday = :weekday
                  AND start_time <= :start_time
                  AND end_time >= :end_time
                """
            ),
            {
                "employee_id": employee_id,
                "weekday": weekday,
                "start_time": start_time,
                "end_time": end_time,
            },
        ).mappings()
    )
    statuses = {row["availability_status"] for row in rows}
    if "available" in statuses:
        return "available"
    if "if_needed" in statuses:
        return "if_needed"
    return None


def sum_assigned_hours_for_employee(db: Session, *, schedule_id: int, employee_id: int) -> float:
    rows = db.execute(
        select(Shift.shift_date, Shift.start_time, Shift.end_time)
        .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.id)
        .where(
            Shift.schedule_id == schedule_id,
            ShiftAssignment.employee_id == employee_id,
            ShiftAssignment.status == "assigned",
        )
    ).mappings()
    total = 0.0
    for row in rows:
        duration = datetime.combine(date.min, row["end_time"]) - datetime.combine(date.min, row["start_time"])
        total += duration.total_seconds() / 3600
    return total


def list_candidate_employee_rows(
    db: Session,
    *,
    company_id: int,
    position_id: int,
    branch_id: int | None = None,
) -> list[dict]:
    query = (
        select(
            Employee.id.label("employee_id"),
            User.full_name,
            Position.id.label("position_id"),
            Position.name.label("position_name"),
            Branch.id.label("branch_id"),
            Branch.name.label("branch_name"),
        )
        .join(User, User.id == Employee.user_id)
        .join(Position, Position.id == Employee.position_id)
        .outerjoin(Branch, Branch.id == Employee.branch_id)
        .where(
            Employee.company_id == company_id,
            Employee.position_id == position_id,
            Employee.is_active.is_(True),
        )
        .order_by(User.full_name, Employee.id)
    )
    if branch_id is not None:
        query = query.where(Employee.branch_id == branch_id)
    return list(db.execute(query).mappings())


def get_latest_published_schedule_for_employee(db: Session, employee_id: int) -> Schedule | None:
    employee = db.get(Employee, employee_id)
    if employee is None:
        return None
    return db.scalars(
        select(Schedule)
        .where(Schedule.company_id == employee.company_id, Schedule.status == "published")
        .order_by(Schedule.id.desc())
    ).first()


def list_published_shift_rows_for_employee(db: Session, employee_id: int) -> list[dict]:
    schedule = get_latest_published_schedule_for_employee(db, employee_id)
    if schedule is None:
        return []
    return list(
        db.execute(
            select(
                Shift.id.label("shift_id"),
                Shift.shift_date,
                Shift.start_time,
                Shift.end_time,
                Position.id.label("position_id"),
                Position.name.label("position_name"),
                Employee.id.label("employee_id"),
                User.full_name.label("employee_name"),
            )
            .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.id)
            .join(Employee, Employee.id == ShiftAssignment.employee_id)
            .join(User, User.id == Employee.user_id)
            .join(Position, Position.id == Shift.position_id)
            .where(
                Shift.schedule_id == schedule.id,
                ShiftAssignment.employee_id == employee_id,
                ShiftAssignment.status == "assigned",
            )
            .order_by(Shift.shift_date, Shift.start_time, Shift.id)
        ).mappings()
    )


def list_published_shift_rows_for_employee_period(
    db: Session,
    employee_id: int,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    query = (
        select(
            Shift.id.label("shift_id"),
            Shift.schedule_id,
            Shift.shift_date,
            Shift.start_time,
            Shift.end_time,
            ShiftAssignment.status,
            Position.id.label("position_id"),
            Position.name.label("position_name"),
        )
        .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.id)
        .join(Schedule, Schedule.id == Shift.schedule_id)
        .join(Position, Position.id == Shift.position_id)
        .where(
            ShiftAssignment.employee_id == employee_id,
            ShiftAssignment.status == "assigned",
            Schedule.status == "published",
        )
        .order_by(Shift.shift_date, Shift.start_time, Shift.id)
    )
    if start_date is not None:
        query = query.where(Shift.shift_date >= start_date)
    if end_date is not None:
        query = query.where(Shift.shift_date <= end_date)
    return list(db.execute(query).mappings())


def get_shift_assignment_for_employee(db: Session, shift_id: int, employee_id: int) -> ShiftAssignment | None:
    return db.scalars(
        select(ShiftAssignment).where(
            ShiftAssignment.shift_id == shift_id,
            ShiftAssignment.employee_id == employee_id,
            ShiftAssignment.status == "assigned",
        )
    ).first()


def create_exchange_request(
    db: Session,
    *,
    shift_assignment_id: int,
    requested_by_employee_id: int,
    note: str,
) -> ShiftExchangeRequest:
    exchange_request = ShiftExchangeRequest(
        shift_assignment_id=shift_assignment_id,
        requested_by_employee_id=requested_by_employee_id,
        note=note,
        status="pending",
        updated_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(exchange_request)
    db.commit()
    db.refresh(exchange_request)
    return exchange_request


def list_pending_exchange_requests(db: Session) -> list[dict]:
    return list(
        db.execute(
            select(
                ShiftExchangeRequest.id,
                Shift.id.label("shift_id"),
                Employee.id.label("employee_id"),
                User.full_name.label("employee_name"),
                ShiftExchangeRequest.note,
                ShiftExchangeRequest.status,
                ShiftExchangeRequest.created_at,
                ShiftExchangeRequest.updated_at,
            )
            .join(ShiftAssignment, ShiftAssignment.id == ShiftExchangeRequest.shift_assignment_id)
            .join(Shift, Shift.id == ShiftAssignment.shift_id)
            .join(Employee, Employee.id == ShiftExchangeRequest.requested_by_employee_id)
            .join(User, User.id == Employee.user_id)
            .where(ShiftExchangeRequest.status == "pending")
            .order_by(ShiftExchangeRequest.id)
        ).mappings()
    )


def get_exchange_request(db: Session, exchange_request_id: int) -> ShiftExchangeRequest | None:
    return db.get(ShiftExchangeRequest, exchange_request_id)


def build_exchange_request_read_row(db: Session, exchange_request_id: int) -> dict | None:
    row = db.execute(
        select(
            ShiftExchangeRequest.id,
            Shift.id.label("shift_id"),
            Employee.id.label("employee_id"),
            User.full_name.label("employee_name"),
            ShiftExchangeRequest.note,
            ShiftExchangeRequest.status,
            ShiftExchangeRequest.created_at,
            ShiftExchangeRequest.updated_at,
        )
        .join(ShiftAssignment, ShiftAssignment.id == ShiftExchangeRequest.shift_assignment_id)
        .join(Shift, Shift.id == ShiftAssignment.shift_id)
        .join(Employee, Employee.id == ShiftExchangeRequest.requested_by_employee_id)
        .join(User, User.id == Employee.user_id)
        .where(ShiftExchangeRequest.id == exchange_request_id)
    ).mappings().first()
    return None if row is None else dict(row)


def update_exchange_request_status(db: Session, exchange_request_id: int, status_value: str) -> ShiftExchangeRequest:
    exchange_request = db.get(ShiftExchangeRequest, exchange_request_id)
    exchange_request.status = status_value
    exchange_request.updated_at = datetime.now(UTC).replace(tzinfo=None)
    db.add(exchange_request)
    db.commit()
    db.refresh(exchange_request)
    return exchange_request


def list_published_shift_rows(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    company_id: int | None = None,
) -> list[dict]:
    query = (
        select(
            Employee.id.label("employee_id"),
            User.full_name.label("employee_name"),
            Position.name.label("position_name"),
            Shift.shift_date,
            Shift.start_time,
            Shift.end_time,
        )
        .join(ShiftAssignment, ShiftAssignment.employee_id == Employee.id)
        .join(Shift, Shift.id == ShiftAssignment.shift_id)
        .join(Schedule, Schedule.id == Shift.schedule_id)
        .join(User, User.id == Employee.user_id)
        .join(Position, Position.id == Shift.position_id)
        .where(Schedule.status == "published", ShiftAssignment.status == "assigned")
    )
    if start_date is not None:
        query = query.where(Shift.shift_date >= start_date)
    if end_date is not None:
        query = query.where(Shift.shift_date <= end_date)
    if company_id is not None:
        query = query.where(Schedule.company_id == company_id)
    return list(db.execute(query).mappings())


def get_requirement_by_id(db: Session, requirement_id: int):
    return db.query(ShiftRequirement).filter(
        ShiftRequirement.id == requirement_id
    ).first()


def delete_requirement(db: Session, requirement):
    db.delete(requirement)
    db.commit()
