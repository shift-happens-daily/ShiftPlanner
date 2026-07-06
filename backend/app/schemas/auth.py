from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["manager", "employee"]


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class UserRead(BaseModel):
    id: int
    public_id: str
    full_name: str
    email: str
    role: Role
    employee_id: int | None = None
    company_id: int | None = None
    employee_status: str | None = None
    manager_status: Literal["pending", "active"] | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    role: Role


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)
    role: Role = "manager"


class RegisterResponse(UserRead):
    pass


class CurrentUserCompanyRead(BaseModel):
    id: int
    name: str
    invite_code: str


class CurrentUserBranchRead(BaseModel):
    id: int
    name: str


class CurrentUserBranchAssignmentRead(CurrentUserBranchRead):
    is_primary: bool


class CurrentUserPositionRead(BaseModel):
    id: int
    name: str


class CurrentUserResponse(UserRead):
    branch_id: int | None = None
    position_id: int | None = None
    company: CurrentUserCompanyRead | None = None
    branch: CurrentUserBranchRead | None = None
    branches: list[CurrentUserBranchAssignmentRead] = Field(default_factory=list)
    position: CurrentUserPositionRead | None = None


class LogoutResponse(BaseModel):
    detail: str
