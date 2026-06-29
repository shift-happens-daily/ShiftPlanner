from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AvailabilityBlock(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    availability_status: Literal["available", "if_needed", "unavailable"] = "available"

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


class EmployeePositionRead(BaseModel):
    id: int
    name: str


class EmployeeBranchRead(BaseModel):
    id: int
    name: str


class EmployeeBranchAssignmentRead(EmployeeBranchRead):
    is_primary: bool


class EmployeePositionUpdate(BaseModel):
    position_id: int | None = Field(ge=1)


class EmployeeBranchUpdate(BaseModel):
    branch_id: int | None = Field(ge=1)


class EmployeeBranchesUpdate(BaseModel):
    branch_ids: list[int] = Field(min_length=1)
    primary_branch_id: int = Field(ge=1)


class EmployeeRead(BaseModel):
    id: int
    public_id: str
    full_name: str
    email: str
    role: Literal["manager", "employee"]
    branch_id: int | None
    position_id: int | None
    position_title: str
    branch: EmployeeBranchRead | None = None
    branches: list[EmployeeBranchAssignmentRead] = Field(default_factory=list)
    position: EmployeePositionRead | None = None
    availability: AvailabilityRead | None = None


AbsenceType = Literal["vacation", "sick_leave", "other"]


class AbsenceCreate(BaseModel):
    absence_type: AbsenceType
    start_date: date
    end_date: date
    comment: str | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "AbsenceCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be later than or equal to start_date.")
        return self


class AbsenceRead(AbsenceCreate):
    id: int
    employee_id: int


class EmployeeCalendarPositionRead(BaseModel):
    id: int
    name: str


class EmployeeCalendarEmployeeRead(BaseModel):
    id: int
    full_name: str
    position: EmployeeCalendarPositionRead | None = None


class EmployeeCalendarShiftRead(BaseModel):
    shift_id: int
    schedule_id: int
    date: date
    start_time: time
    end_time: time
    status: str


class EmployeeWorkloadRead(BaseModel):
    total_shifts: int
    total_hours: float


class EmployeeCalendarSummaryRead(BaseModel):
    employee: EmployeeCalendarEmployeeRead
    availability: list[AvailabilityBlock]
    desired_days_off: list[int]
    absences: list[AbsenceRead]
    shifts: list[EmployeeCalendarShiftRead]
    workload: EmployeeWorkloadRead
