from pydantic import BaseModel, Field


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1)


class CompanyRead(BaseModel):
    id: int
    name: str
    invite_code: str
