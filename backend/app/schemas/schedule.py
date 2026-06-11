from datetime import date, time

from pydantic import BaseModel


class ScheduleGenerateRequest(BaseModel):
    start_date: date | None = None


class ShiftRead(BaseModel):
    employee_name: str
    position: str
    date: date
    start_time: time
    end_time: time


class ScheduleRead(BaseModel):
    id: int
    status: str
    shifts: list[ShiftRead]
