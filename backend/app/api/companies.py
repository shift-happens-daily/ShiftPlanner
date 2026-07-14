from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_active_manager, require_manager, require_role
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
    BranchUpdate,
    BranchWorkingHoursRead,
    BranchWorkingHoursUpdate,
    CompanyCreate,
    CompanyJoinRequest,
    CompanyJoinManagerRequest,
    CompanyLinkUserRequest,
    CompanyRead,
    CompanySummaryRead,
    CompanyUpdate,
    CompanyUserPublicIdRequest,
    EmployeeRequestAcceptRequest,
    EmployeeRequestRead,
    LinkedEmployeeRead,
    ManagerRequestRead,
)
from app.services import company_service

router = APIRouter()

@router.post("/me/link-user", response_model=LinkedEmployeeRead)
def link_user_to_my_company(
    payload: CompanyLinkUserRequest,
    db: Session = Depends(get_db),
    current_user: UserRead = Depends(require_role("manager")),
):
    return company_service.link_user_to_manager_company(
        db=db,
        payload=payload,
        current_user=current_user,
    )


@router.post(
    "/me/invite-code/regenerate",
    response_model=CompanyRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def regenerate_my_company_invite_code(
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> CompanyRead:
    return company_service.regenerate_my_company_invite_code(db, current_user)


@router.post(
    "/me/manager-invite-code/regenerate",
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def regenerate_my_company_manager_invite_code(
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    company = company_service.regenerate_my_company_invite_code(db, current_user)
    return {"manager_invite_code": company.invite_code}


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


@router.post(
    "/join-as-manager",
    response_model=CurrentUserResponse,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def join_company_as_manager(
    payload: CompanyJoinManagerRequest,
    current_user: UserRead = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    return company_service.join_company_as_manager(db, payload, current_user)


@router.get(
    "/me/manager-requests",
    response_model=list[ManagerRequestRead],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def list_manager_requests(
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> list[ManagerRequestRead]:
    return company_service.list_manager_requests(db, current_user)


@router.get(
    "/me/managers",
    response_model=list[ManagerRequestRead],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def list_my_company_managers(
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> list[ManagerRequestRead]:
    return company_service.list_company_managers(db, current_user)


@router.post(
    "/me/manager-requests/{request_id}/accept",
    response_model=ManagerRequestRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def accept_manager_request(
    request_id: int,
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> ManagerRequestRead:
    return company_service.accept_manager_request(db, request_id, current_user)


@router.post(
    "/me/manager-requests/{request_id}/decline",
    response_model=ManagerRequestRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def decline_manager_request(
    request_id: int,
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> ManagerRequestRead:
    return company_service.decline_manager_request(db, request_id, current_user)


@router.post(
    "/me/managers/by-public-id",
    response_model=ManagerRequestRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def add_manager_by_public_id(
    payload: CompanyUserPublicIdRequest,
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> ManagerRequestRead:
    return company_service.add_manager_by_public_id(db, payload, current_user)


@router.get(
    "/me/employee-requests",
    response_model=list[EmployeeRequestRead],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def list_employee_requests(
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> list[EmployeeRequestRead]:
    return company_service.list_employee_requests(db, current_user)


@router.post(
    "/me/employee-requests/{request_id}/accept",
    response_model=EmployeeRequestRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def accept_employee_request(
    request_id: int,
    payload: EmployeeRequestAcceptRequest | None = None,
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> EmployeeRequestRead:
    return company_service.accept_employee_request(
        db,
        request_id,
        payload or EmployeeRequestAcceptRequest(),
        current_user,
    )


@router.post(
    "/me/employee-requests/{request_id}/decline",
    response_model=EmployeeRequestRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def decline_employee_request(
    request_id: int,
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> EmployeeRequestRead:
    return company_service.decline_employee_request(db, request_id, current_user)


@router.get(
    "/me",
    response_model=CompanyRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def get_my_company(
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> CompanyRead:
    return company_service.get_my_company(db, current_user)


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


@router.get(
    "/branches",
    response_model=list[BranchResponse],
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def list_my_company_branches(
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> list[BranchResponse]:
    return company_service.list_manager_company_branches(db, current_user)


@router.post(
    "/branches",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def create_my_company_branch(
    payload: BranchCreate,
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> BranchResponse:
    return company_service.create_manager_company_branch(db, payload, current_user)


@router.patch(
    "/branches/{branch_id}",
    response_model=BranchResponse,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def update_company_branch(
    branch_id: int,
    payload: BranchUpdate,
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> BranchResponse:
    return company_service.update_company_branch(db, branch_id, payload, current_user)


@router.delete(
    "/branches/{branch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def delete_company_branch(
    branch_id: int,
    current_user: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> Response:
    company_service.delete_company_branch(db, branch_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{company_id}/branches/{branch_id}/working-hours",
    response_model=BranchWorkingHoursRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE},
)
def get_branch_working_hours(
    company_id: int,
    branch_id: int,
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> BranchWorkingHoursRead:
    return company_service.get_branch_working_hours(db, company_id, branch_id, current_user)


@router.patch(
    "/{company_id}/branches/{branch_id}/working-hours",
    response_model=BranchWorkingHoursRead,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **NOT_FOUND_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def update_branch_working_hours(
    company_id: int,
    branch_id: int,
    payload: BranchWorkingHoursUpdate,
    current_user: UserRead = Depends(require_active_manager),
    db: Session = Depends(get_db),
) -> BranchWorkingHoursRead:
    return company_service.update_branch_working_hours(db, company_id, branch_id, payload, current_user)


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
    current_user: UserRead = Depends(require_manager),
    db: Session = Depends(get_db),
) -> list[BranchResponse]:
    return company_service.list_manager_company_branches(db, current_user, company_id)


@router.post(
    "/{company_id}/branches",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE, **NOT_FOUND_RESPONSE},
)
def create_company_branch(
    company_id: int,
    payload: BranchCreate,
    current_user: UserRead = Depends(require_manager),
    db: Session = Depends(get_db),
) -> BranchResponse:
    return company_service.create_manager_company_branch(db, payload, current_user, company_id)

