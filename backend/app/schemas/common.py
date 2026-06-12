from pydantic import BaseModel


class ErrorDetailItem(BaseModel):
    field: str
    message: str


class ValidationErrorResponse(BaseModel):
    detail: list[ErrorDetailItem]


class MessageResponse(BaseModel):
    detail: str
