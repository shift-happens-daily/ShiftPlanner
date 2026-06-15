from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_role
from app.api.responses import BAD_REQUEST_RESPONSE, FORBIDDEN_RESPONSE, NOT_FOUND_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.database import get_db
from app.schemas.auth import CurrentUserResponse, UserRead
from app.schemas.company import CompanyCreate, CompanyInvitePreviewRead, CompanyJoinRequest, CompanyRead
from app.services import company_service

router = APIRouter()


@router.get(
    "/",
    response_model=list[CompanyRead],
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_companies(
    _: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CompanyRead]:
    return company_service.list_companies(db)


@router.post(
    "/",
    response_model=CompanyRead,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_company(
    payload: CompanyCreate,
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> CompanyRead:
    return company_service.create_company(db, payload)


@router.get(
    "/invite/{invite_code}",
    response_model=CompanyInvitePreviewRead,
    responses={**UNAUTHORIZED_RESPONSE, **NOT_FOUND_RESPONSE},
)
def preview_company_invite(
    invite_code: str,
    _: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CompanyInvitePreviewRead:
    return company_service.preview_invite_code(db, invite_code)


@router.post(
    "/join",
    response_model=CurrentUserResponse,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def join_company(
    payload: CompanyJoinRequest,
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    return company_service.join_company_by_invite(db, payload, current_user)
