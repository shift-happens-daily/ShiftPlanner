from pydantic import BaseModel, Field


class PositionCreate(BaseModel):
    title: str = Field(min_length=1)
    company_id: int | None = Field(default=None, ge=1)


class PositionRead(BaseModel):
    id: int
    title: str
    company_id: int | None = None

