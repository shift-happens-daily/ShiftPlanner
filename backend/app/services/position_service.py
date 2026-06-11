from app.repositories import mock_db
from app.schemas.position import PositionCreate, PositionRead


def list_positions() -> list[PositionRead]:
    return mock_db.list_positions()


def create_position(payload: PositionCreate) -> PositionRead:
    return mock_db.create_position(payload)
