from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_role
from app.api.responses import FORBIDDEN_RESPONSE, NOT_FOUND_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.database import get_db
from app.schemas.auth import UserRead
from app.schemas.position import PositionCreate, PositionRead
from app.services import position_service

router = APIRouter()


@router.get(
    "/",
    response_model=list[PositionRead],
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_positions(
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PositionRead]:
    return position_service.list_positions(db, current_user)


@router.post(
    "/",
    response_model=PositionRead,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_position(
    payload: PositionCreate,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> PositionRead:
    return position_service.create_position(db, payload)


@router.delete(
    "/{position_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def delete_position(
    position_id: int,
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> Response:
    position_service.delete_position(db, position_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

