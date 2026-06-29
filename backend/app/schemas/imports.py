from pydantic import BaseModel


class ImportRowErrorRead(BaseModel):
    row: int
    message: str


class RequirementsImportResultRead(BaseModel):
    created_count: int
    errors: list[ImportRowErrorRead]
