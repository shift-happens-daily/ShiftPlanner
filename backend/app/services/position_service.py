from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, position_repository
from app.schemas.position import PositionCreate, PositionRead


def list_positions(db: Session) -> list[PositionRead]:
    return [
        PositionRead(
            id=position.id,
            title=position.name,
            company_id=position.company_id,
        )
        for position in position_repository.list_positions(db)
    ]


def create_position(db: Session, payload: PositionCreate) -> PositionRead:
    company_id = getattr(payload, "company_id", None)

    if company_id is None:
        company = company_repository.get_default_company(db)
        company_id = company.id
    else:
        company = company_repository.get_company_by_id(db, company_id)

        if company is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found.",
            )

    position = position_repository.create_position(
    db,
    payload.title,
    company_id,
)

    return PositionRead(
        id=position.id,
        title=position.name,
    )