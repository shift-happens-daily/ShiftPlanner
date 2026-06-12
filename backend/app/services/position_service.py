from app.repositories import mock_db
from app.schemas.position import PositionCreate, PositionRead


def list_positions() -> list[PositionRead]:
    return [PositionRead(**position) for position in mock_db.list_positions()]


def create_position(payload: PositionCreate) -> PositionRead:
    return PositionRead(**mock_db.create_position(payload))
