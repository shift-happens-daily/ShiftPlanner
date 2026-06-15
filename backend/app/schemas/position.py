from pydantic import BaseModel, Field


class PositionCreate(BaseModel):
    title: str = Field(min_length=1)


class PositionRead(BaseModel):
    id: int
    title: str
