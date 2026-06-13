from datetime import time

from pydantic import BaseModel, Field, model_validator


class AvailabilityBlock(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_time_range(self) -> "AvailabilityBlock":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time.")
        return self


class AvailabilityUpsert(BaseModel):
    weekly_availability: list[AvailabilityBlock] = Field(default_factory=list)
    desired_days_off: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_days_off(self) -> "AvailabilityUpsert":
        invalid_days = [day for day in self.desired_days_off if day < 0 or day > 6]
        if invalid_days:
            raise ValueError("desired_days_off must contain values between 0 and 6.")
        return self


class AvailabilityRead(AvailabilityUpsert):
    employee_id: int


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    position_id: int = Field(ge=1)


class EmployeeRead(BaseModel):
    id: int
    full_name: str
    email: str
    position_id: int
    position_title: str
    availability: AvailabilityRead | None = None
