from fastapi import APIRouter

from app.schemas.schedule import ScheduleGenerateRequest, ScheduleRead
from app.services import schedule_service

router = APIRouter()


@router.post("/generate", response_model=ScheduleRead)
def generate_schedule(payload: ScheduleGenerateRequest | None = None) -> ScheduleRead:
    return schedule_service.generate_schedule(payload)
