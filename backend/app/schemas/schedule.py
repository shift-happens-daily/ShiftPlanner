from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Date = date


class ScheduleRequirementCreate(BaseModel):
    branch_id: int | None = Field(default=None, ge=1)
    position_id: int = Field(ge=1)
    date: date
    min_staff: int | None = Field(default=None, ge=1)
    required_count: int | None = Field(default=None, ge=1)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_time_range(self) -> "ScheduleRequirementCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time.")
        if self.required_count is None and self.min_staff is None:
            raise ValueError("required_count or min_staff is required.")
        if self.required_count is None:
            self.required_count = self.min_staff
        if self.min_staff is None:
            self.min_staff = self.required_count
        return self


class ScheduleRequirementRead(ScheduleRequirementCreate):
    id: int
    position_title: str
    required_count: int


class ScheduleRequirementUpdate(BaseModel):
    branch_id: int | None = Field(default=None, ge=1)
    position_id: int | None = Field(default=None, ge=1)
    date: Date | None = None
    min_staff: int | None = Field(default=None, ge=1)
    required_count: int | None = Field(default=None, ge=1)
    start_time: time | None = None
    end_time: time | None = None

    @model_validator(mode="after")
    def sync_staff_fields(self) -> "ScheduleRequirementUpdate":
        if self.required_count is None and self.min_staff is not None:
            self.required_count = self.min_staff
        if self.min_staff is None and self.required_count is not None:
            self.min_staff = self.required_count
        return self


class ScheduleRequirementTemplateCreate(BaseModel):
    position_id: int = Field(ge=1)
    min_staff: int = Field(ge=1)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_time_range(self) -> "ScheduleRequirementTemplateCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time.")
        return self


class ScheduleRequirementBulkCreate(BaseModel):
    start_date: date
    end_date: date
    weekdays: list[int] = Field(min_length=1)
    requirements: list[ScheduleRequirementTemplateCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_bulk_payload(self) -> "ScheduleRequirementBulkCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be later than or equal to start_date.")
        invalid_days = [day for day in self.weekdays if day < 0 or day > 6]
        if invalid_days:
            raise ValueError("weekdays must contain values between 0 and 6.")
        return self


class ScheduleRequirementBulkRead(BaseModel):
    created_count: int
    requirements: list[ScheduleRequirementRead]


class ScheduleGenerateRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_period(self) -> "ScheduleGenerateRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be later than or equal to start_date.")
        return self


class ShiftRead(BaseModel):
    id: int
    employee_id: int | None = None
    employee_name: str | None = None
    position_id: int
    position: str
    date: date
    start_time: time
    end_time: time


class ScheduleConflictRead(BaseModel):
    employee_id: int
    employee_name: str
    date: date
    conflicting_shift_ids: list[int]
    message: str


class UnfilledRequirementRead(BaseModel):
    requirement_id: int
    position_id: int
    position_title: str
    date: date
    start_time: time
    end_time: time
    missing_staff: int


class ScheduleRead(BaseModel):
    id: int
    start_date: date
    end_date: date
    status: Literal["draft", "published", "archived"]
    start_date: date
    end_date: date
    shifts: list[ShiftRead]
    conflicts: list[ScheduleConflictRead]
    unfilled_requirements: list[UnfilledRequirementRead]


class ManualShiftCreate(BaseModel):
    date: date
    start_time: time
    end_time: time
    position_id: int = Field(ge=1)
    employee_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_time_range(self) -> "ManualShiftCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time.")
        if self.start_time.minute % 5 != 0 or self.end_time.minute % 5 != 0:
            raise ValueError("start_time and end_time must be aligned to 5-minute steps.")
        return self


class ScheduleShiftUpdate(BaseModel):
    action: Literal["reassign", "remove"] | None = None
    date: Date | None = None
    start_time: time | None = None
    end_time: time | None = None
    position_id: int | None = Field(default=None, ge=1)
    employee_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_update(self) -> "ScheduleShiftUpdate":
        if self.action == "reassign" and self.employee_id is None:
            raise ValueError("employee_id is required when action is 'reassign'.")
        if self.start_time is not None and self.start_time.minute % 5 != 0:
            raise ValueError("start_time must be aligned to 5-minute steps.")
        if self.end_time is not None and self.end_time.minute % 5 != 0:
            raise ValueError("end_time must be aligned to 5-minute steps.")
        return self


class RequirementAssignRequest(BaseModel):
    employee_id: int = Field(ge=1)


class AvailableEmployeePositionRead(BaseModel):
    id: int
    name: str


class AvailableEmployeeBranchRead(BaseModel):
    id: int
    name: str


class AvailableEmployeeRead(BaseModel):
    id: int
    full_name: str
    position: AvailableEmployeePositionRead
    branch: AvailableEmployeeBranchRead | None = None
    availability_status: Literal["available", "if_needed"]
    assigned_hours: float = 0.0


class ShiftExchangeRequestCreate(BaseModel):
    shift_id: int = Field(ge=1)
    note: str = Field(min_length=1)


class ShiftExchangeRequestUpdate(BaseModel):
    status: Literal["approved", "rejected"]


class ShiftExchangeRequestRead(BaseModel):
    id: int
    shift_id: int
    employee_id: int
    employee_name: str
    note: str
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime
    updated_at: datetime
