from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, position_repository
from app.schemas.auth import UserRead
from app.schemas.position import PositionCreate, PositionRead


def list_positions(db: Session, current_user: UserRead) -> list[PositionRead]:
    if current_user.company_id is None:
        if current_user.role == "manager":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager is not linked to a company.",
            )
        return []

    return [
        PositionRead(
            id=position.id,
            title=position.name,
            company_id=position.company_id,
        )
        for position in position_repository.list_positions(db, current_user.company_id)
    ]


def create_position(db: Session, payload: PositionCreate, current_user: UserRead) -> PositionRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    company_id = current_user.company_id

    position = position_repository.create_position(
        db,
        payload.title,
        company_id,
    )

    return PositionRead(
        id=position.id,
        title=position.name,
    )


def delete_position(db: Session, position_id: int, current_user: UserRead) -> None:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    position = position_repository.get_position_by_id(db, position_id)
    if position is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Position not found.",
        )
    if position.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Position does not belong to the authenticated user's company.",
        )
    if position_repository.position_is_in_use(db, position.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Position cannot be deleted while it is assigned to employees, requirements, or shifts.",
        )

    position_repository.delete_position(db, position)
