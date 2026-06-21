from pydantic import BaseModel, Field


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
    invite_code: str = Field(min_length=1)
    branch_id: int | None = Field(default=None, ge=1)
    position_id: int | None = Field(default=None, ge=1)
