from sqlalchemy.orm import Session

from app.repositories import company_repository, position_repository
from app.schemas.position import PositionCreate, PositionRead


def list_positions(db: Session) -> list[PositionRead]:
    return [PositionRead(id=position.id, title=position.name) for position in position_repository.list_positions(db)]


def create_position(db: Session, payload: PositionCreate) -> PositionRead:
    company = company_repository.get_default_company(db)
    position = position_repository.create_position(db, payload.title, company.id)
    return PositionRead(id=position.id, title=position.name)
