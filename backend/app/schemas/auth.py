from typing import Literal
from pydantic import BaseModel, Field

Role = Literal["manager", "employee"]


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

class UserRead(BaseModel):
    id: int
    full_name: str
    email: str
    role: Role
    employee_id: int | None = None


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


class LogoutResponse(BaseModel):
    detail: str
