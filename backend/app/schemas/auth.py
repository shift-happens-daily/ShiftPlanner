from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    role: str


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)
    role: str = "manager"


class RegisterResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
