from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user, require_role
from app.api.responses import FORBIDDEN_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.schemas.auth import UserRead
from app.schemas.company import CompanyCreate, CompanyRead
from app.services import company_service

router = APIRouter()


@router.get(
    "/",
    response_model=list[CompanyRead],
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_companies(_: UserRead = Depends(get_current_user)) -> list[CompanyRead]:
    return company_service.list_companies()


@router.post(
    "/",
    response_model=CompanyRead,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_company(
    payload: CompanyCreate,
    _: UserRead = Depends(require_role("manager")),
) -> CompanyRead:
    return company_service.create_company(payload)
