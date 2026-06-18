from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_manager, require_role
from app.api.responses import (
    BAD_REQUEST_RESPONSE,
    FORBIDDEN_RESPONSE,
    NOT_FOUND_RESPONSE,
    UNAUTHORIZED_RESPONSE,
    VALIDATION_ERROR_RESPONSE,
)
from app.database import get_db
from app.schemas.auth import CurrentUserResponse, UserRead
from app.schemas.company import (
    BranchCreate,
    BranchResponse,
    CompanyCreate,
    CompanyJoinRequest,
    CompanyRead,
    CompanySummaryRead,
    CompanyUpdate,
)
from app.services import company_service

router = APIRouter()


@router.get(
    "/",
    response_model=list[CompanySummaryRead],
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_companies(
    _: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CompanySummaryRead]:
    return company_service.list_companies(db)


@router.post(
    "/",
    response_model=CompanyRead,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_company(
    payload: CompanyCreate,
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> CompanyRead:
    return company_service.create_company(db, payload, current_user)


@router.get("/invite/{invite_code}")
def preview_invite_code(
    invite_code: str,
    db: Session = Depends(get_db),
):
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


@router.patch(
    "/me",
    response_model=CompanyRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def update_my_company(
    payload: CompanyUpdate,
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> CompanyRead:
    return company_service.update_my_company(db, payload, current_user)


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def delete_company(
    company_id: int,
    _: UserRead = Depends(require_manager),
    db: Session = Depends(get_db),
) -> None:
    company_service.delete_company(db, company_id)


@router.get(
    "/{company_id}/branches",
    response_model=list[BranchResponse],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def list_company_branches(
    company_id: int,
    _: UserRead = Depends(require_manager),
    db: Session = Depends(get_db),
) -> list[BranchResponse]:
    return company_service.list_company_branches(db, company_id)


@router.post(
    "/{company_id}/branches",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE, **NOT_FOUND_RESPONSE},
)
def create_company_branch(
    company_id: int,
    payload: BranchCreate,
    _: UserRead = Depends(require_manager),
    db: Session = Depends(get_db),
) -> BranchResponse:
    return company_service.create_company_branch(db, company_id, payload.name)

