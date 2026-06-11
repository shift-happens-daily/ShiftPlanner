from pydantic import BaseModel, Field


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
