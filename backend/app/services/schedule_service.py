from app.repositories import mock_db
from app.schemas.schedule import ScheduleGenerateRequest, ScheduleRead


def generate_schedule(payload: ScheduleGenerateRequest | None = None) -> ScheduleRead:
    return mock_db.create_schedule(start_date=payload.start_date if payload else None)
