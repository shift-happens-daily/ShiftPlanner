import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, RootModel, field_validator, model_validator

INVITE_CODE_PATTERN = re.compile(r"^[A-Z0-9]{16}$")
PUBLIC_ID_PATTERN = re.compile(r"^[A-Z0-9]{16}$")


class CompanyUserPublicIdRequest(BaseModel):
    user_public_id: str = Field(..., min_length=16, max_length=16)

    @field_validator("user_public_id")
    @classmethod
    def validate_user_public_id(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not PUBLIC_ID_PATTERN.fullmatch(normalized):
            raise ValueError("User public ID must be a 16-character alphanumeric code.")
        return normalized


class CompanyLinkUserRequest(CompanyUserPublicIdRequest):
    branch_id: int | None = None
    branch_ids: list[int] | None = None
    primary_branch_id: int | None = Field(default=None, ge=1)
    position_id: int | None = None


class LinkedEmployeePositionRead(BaseModel):
    id: int
    name: str


class LinkedEmployeeBranchRead(BaseModel):
    id: int
    name: str
    is_primary: bool


class LinkedEmployeeRead(BaseModel):
    id: int
    public_id: str
    full_name: str
    email: str
    branch_id: int | None = None
    position_id: int | None = None
    branches: list[LinkedEmployeeBranchRead] = Field(default_factory=list)
    position: LinkedEmployeePositionRead | None = None


class EmployeeRequestRead(BaseModel):
    id: int
    company_id: int
    user_id: int
    public_id: str
    full_name: str
    email: str
    branch_id: int | None = None
    position_id: int | None = None
    branches: list[LinkedEmployeeBranchRead] = Field(default_factory=list)
    position: LinkedEmployeePositionRead | None = None
    is_active: bool


class EmployeeRequestAcceptRequest(BaseModel):
    branch_id: int | None = Field(default=None, ge=1)
    branch_ids: list[int] | None = None
    primary_branch_id: int | None = Field(default=None, ge=1)
    position_id: int | None = Field(default=None, ge=1)


class CompanyJoinManagerRequest(BaseModel):
    invite_code: str

    @field_validator("invite_code", mode="before")
    @classmethod
    def validate_invite_code(cls, value: str) -> str:
        return normalize_invite_code(value)


class ManagerRequestRead(BaseModel):
    id: int
    company_id: int
    user_id: int
    public_id: str
    full_name: str
    email: str
    manager_role: Literal["owner", "manager"]
    membership_status: Literal["pending", "active", "declined"]


def normalize_invite_code(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Invite code must be a string.")
    normalized = value.strip().upper()
    if not INVITE_CODE_PATTERN.fullmatch(normalized):
        raise ValueError("Invite code must contain exactly 16 uppercase letters or digits.")
    return normalized


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1)


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    address: str | None = None


class CompanySummaryRead(BaseModel):
    id: int
    name: str


class CompanyRead(CompanySummaryRead):
    address: str | None = None
    invite_code: str
    invite_code_generated_at: datetime
    invite_code_expires_at: datetime | None = None


class BranchRead(BaseModel):
    id: int
    name: str
    address: str | None = None


class BranchCreate(BaseModel):
    name: str = Field(min_length=1)
    address: str | None = None


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    address: str | None = None


class WorkingHoursRange(BaseModel):
    start_slot: int = Field(ge=0, le=47)
    end_slot: int = Field(ge=1, le=48)

    @model_validator(mode="after")
    def validate_range(self) -> "WorkingHoursRange":
        if self.end_slot <= self.start_slot:
            raise ValueError("end_slot must be greater than start_slot.")
        return self


class BranchWorkingHoursRead(RootModel[dict[str, WorkingHoursRange]]):
    root: dict[str, WorkingHoursRange] = Field(default_factory=dict)

    @field_validator("root")
    @classmethod
    def validate_weekday_keys(cls, value: dict[str, WorkingHoursRange]) -> dict[str, WorkingHoursRange]:
        invalid = [key for key in value if key not in {"0", "1", "2", "3", "4", "5", "6"}]
        if invalid:
            raise ValueError("Working hours keys must be strings from '0' to '6'.")
        return value


class BranchWorkingHoursUpdate(BranchWorkingHoursRead):
    pass


class BranchResponse(BaseModel):
    id: int
    name: str
    address: str | None = None
    company_id: int
    working_hours_by_weekday: dict[str, WorkingHoursRange] = Field(default_factory=dict)


class PositionOptionRead(BaseModel):
    id: int
    name: str


class CompanyInvitePreviewRead(BaseModel):
    company_id: int
    company_name: str
    invite_code: str
    branches: list[BranchRead]
    positions: list[PositionOptionRead]


class CompanyJoinRequest(BaseModel):
    invite_code: str
    branch_id: int | None = Field(default=None, ge=1)
    branch_ids: list[int] | None = None
    primary_branch_id: int | None = Field(default=None, ge=1)
    position_id: int | None = Field(default=None, ge=1)

    @field_validator("invite_code", mode="before")
    @classmethod
    def validate_invite_code(cls, value: str) -> str:
        return normalize_invite_code(value)
