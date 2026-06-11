from fastapi import APIRouter, status

from app.schemas.position import PositionCreate, PositionRead
from app.services import position_service

router = APIRouter()


@router.get("/", response_model=list[PositionRead])
def get_positions() -> list[PositionRead]:
    return position_service.list_positions()


@router.post("/", response_model=PositionRead, status_code=status.HTTP_201_CREATED)
def create_position(payload: PositionCreate) -> PositionRead:
    return position_service.create_position(payload)
