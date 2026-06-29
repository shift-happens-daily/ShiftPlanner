from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee, Position, Shift, ShiftRequirement


def list_positions(db: Session, company_id: int | None = None) -> list[Position]:
    query = select(Position).order_by(Position.id)
    if company_id is not None:
        query = query.where(Position.company_id == company_id)
    return list(db.scalars(query))


def create_position(db: Session, title: str, company_id: int) -> Position:
    position = Position(name=title, company_id=company_id)
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


def get_position_by_id(db: Session, position_id: int) -> Position | None:
    return db.get(Position, position_id)


def position_is_in_use(db: Session, position_id: int) -> bool:
    employee_id = db.scalar(
        select(Employee.id)
        .where(Employee.position_id == position_id)
        .limit(1)
    )
    if employee_id is not None:
        return True

    requirement_id = db.scalar(
        select(ShiftRequirement.id)
        .where(ShiftRequirement.position_id == position_id)
        .limit(1)
    )
    if requirement_id is not None:
        return True

    shift_id = db.scalar(
        select(Shift.id)
        .where(Shift.position_id == position_id)
        .limit(1)
    )
    return shift_id is not None


def delete_position(db: Session, position: Position) -> None:
    db.delete(position)
    db.commit()


def list_positions_by_company(db, company_id: int):
    return db.query(Position).filter(Position.company_id == company_id).all()
