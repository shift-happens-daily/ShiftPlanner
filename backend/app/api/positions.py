from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user, require_role
from app.api.responses import FORBIDDEN_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.schemas.auth import UserRead
from app.schemas.position import PositionCreate, PositionRead
from app.services import position_service

router = APIRouter()


@router.get(
    "/",
    response_model=list[PositionRead],
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_positions(_: UserRead = Depends(get_current_user)) -> list[PositionRead]:
    return position_service.list_positions()


@router.post(
    "/",
    response_model=PositionRead,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_position(
    payload: PositionCreate,
    _: UserRead = Depends(require_role("manager")),
) -> PositionRead:
    return position_service.create_position(payload)
