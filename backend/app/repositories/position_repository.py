from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Position


def list_positions(db: Session) -> list[Position]:
    return list(db.scalars(select(Position).order_by(Position.id)))


def create_position(db: Session, title: str, company_id: int) -> Position:
    position = Position(name=title, company_id=company_id)
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


def get_position_by_id(db: Session, position_id: int) -> Position | None:
    return db.get(Position, position_id)
