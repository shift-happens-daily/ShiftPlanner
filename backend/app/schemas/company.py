import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

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
    position_id: int | None = None


class LinkedEmployeePositionRead(BaseModel):
    id: int
    name: str


class LinkedEmployeeRead(BaseModel):
    id: int
    public_id: str
    full_name: str
    email: str
    branch_id: int | None = None
    position_id: int | None = None
    position: LinkedEmployeePositionRead | None = None

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


class BranchResponse(BaseModel):
    id: int
    name: str
    address: str | None = None
    company_id: int


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
    position_id: int | None = Field(default=None, ge=1)

    @field_validator("invite_code", mode="before")
    @classmethod
    def validate_invite_code(cls, value: str) -> str:
        return normalize_invite_code(value)
