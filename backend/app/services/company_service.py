from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, user_repository
from app.schemas.auth import CurrentUserResponse, UserRead
from app.schemas.company import (
    BranchCreate,
    BranchResponse,
    BranchUpdate,
    CompanyCreate,
    CompanyJoinRequest,
    CompanyLinkUserRequest,
    CompanyRead,
    CompanySummaryRead,
    CompanyUpdate,
    CompanyUserPublicIdRequest,
    EmployeeRequestAcceptRequest,
    EmployeeRequestRead,
    LinkedEmployeePositionRead,
    LinkedEmployeeRead,
    ManagerInviteCodeRead,
    ManagerRequestRead,
    normalize_invite_code,
)


def _role_value(user: UserRead) -> str:
    return getattr(user.role, "value", user.role)


def _list_branches(db: Session, company_id: int):
    if hasattr(company_repository, "list_branches_by_company"):
        return company_repository.list_branches_by_company(db, company_id)

    return company_repository.list_branches_for_company(db, company_id)


def _list_positions(db: Session, company_id: int):
    if hasattr(position_repository, "list_positions_by_company"):
        return position_repository.list_positions_by_company(db, company_id)

    return position_repository.list_positions(db, company_id)


def list_companies(db: Session) -> list[CompanySummaryRead]:
    return [
        CompanySummaryRead(id=company.id, name=company.name)
        for company in company_repository.list_companies(db)
    ]


def _build_company_read(company) -> CompanyRead:
    return CompanyRead(
        id=company.id,
        name=company.name,
        address=company.address,
        invite_code=company.invite_code or "",
        invite_code_generated_at=company.invite_code_generated_at,
        invite_code_expires_at=company.invite_code_expires_at,
    )


def _build_manager_invite_code_read(company) -> ManagerInviteCodeRead:
    return ManagerInviteCodeRead(
        manager_invite_code=company.manager_invite_code or "",
        manager_invite_code_generated_at=company.manager_invite_code_generated_at,
        manager_invite_code_expires_at=company.manager_invite_code_expires_at,
    )


def _build_manager_request_read(membership) -> ManagerRequestRead:
    return ManagerRequestRead(
        id=membership.id,
        company_id=membership.company_id,
        user_id=membership.user_id,
        public_id=membership.user.public_id,
        full_name=membership.user.full_name,
        email=membership.user.email,
        manager_role=membership.manager_role,
        membership_status=membership.membership_status,
        created_at=membership.created_at,
        updated_at=membership.updated_at,
    )


def _build_employee_request_read(employee) -> EmployeeRequestRead:
    position = None
    if employee.position is not None:
        position = LinkedEmployeePositionRead(id=employee.position.id, name=employee.position.name)
    return EmployeeRequestRead(
        id=employee.id,
        company_id=employee.company_id,
        user_id=employee.user_id,
        public_id=employee.user.public_id,
        full_name=employee.user.full_name,
        email=employee.user.email,
        branch_id=employee.branch_id,
        position_id=employee.position_id,
        position=position,
        is_active=employee.is_active,
    )


def create_company(db: Session, payload: CompanyCreate, current_user: UserRead) -> CompanyRead:
    company = company_repository.create_company(
        db=db,
        name=payload.name,
        manager_user_id=current_user.id,
    )

    return _build_company_read(company)


def get_my_company(db: Session, current_user: UserRead) -> CompanyRead:
    company_id = _manager_company_id(current_user)
    company = company_repository.get_company_by_id(db, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found.")

    return _build_company_read(company)


def update_my_company(db: Session, payload: CompanyUpdate, current_user: UserRead) -> CompanyRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    company = company_repository.get_company_by_id(db, current_user.company_id)

    if company is None or not _is_owner_manager(db, current_user.company_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company owner can update this company.",
        )

    updated_company = company_repository.update_company(
        db,
        company,
        name=payload.name,
        address=payload.address if "address" in payload.model_fields_set else company.address,
    )

    return _build_company_read(updated_company)


def regenerate_my_company_invite_code(db: Session, current_user: UserRead) -> CompanyRead:
    company_id = _manager_company_id(current_user)
    company = company_repository.get_company_by_id(db, company_id)
    if company is None or not _is_owner_manager(db, company_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company owner can regenerate invite codes.",
        )

    updated_company = company_repository.regenerate_invite_code(db, company)
    return _build_company_read(updated_company)


def regenerate_my_company_manager_invite_code(
    db: Session,
    current_user: UserRead,
) -> ManagerInviteCodeRead:
    company_id = _manager_company_id(current_user)
    company = company_repository.get_company_by_id(db, company_id)
    if company is None or not _is_owner_manager(db, company_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company owner can regenerate manager invite codes.",
        )

    updated_company = company_repository.regenerate_manager_invite_code(db, company)
    return _build_manager_invite_code_read(updated_company)


def preview_invite_code(db: Session, invite_code: str):
    try:
        normalized_invite_code = normalize_invite_code(invite_code)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invite code must contain exactly 16 uppercase letters or digits.",
        ) from exc

    company = company_repository.get_company_by_invite_code(db, normalized_invite_code)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company invite code not found.",
        )

    branches = _list_branches(db, company.id)
    positions = _list_positions(db, company.id)

    return {
        "company_id": company.id,
        "company_name": company.name,
        "invite_code": company.invite_code or "",
        "branches": [
            {
                "id": branch.id,
                "name": branch.name,
                "address": branch.address,
            }
            for branch in branches
        ],
        "positions": [
            {
                "id": position.id,
                "name": position.name,
            }
            for position in positions
        ],
    }


def list_company_branches(db: Session, company_id: int) -> list[BranchResponse]:
    company = company_repository.get_company_by_id(db, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    return [
        BranchResponse(
            id=branch.id,
            name=branch.name,
            address=branch.address,
            company_id=branch.company_id,
        )
        for branch in _list_branches(db, company_id)
    ]


def create_company_branch(
    db: Session,
    company_id: int,
    name: str,
    address: str | None = None,
) -> BranchResponse:
    company = company_repository.get_company_by_id(db, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    branch_name = name.strip()

    if not branch_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Branch name is required.",
        )

    branch = company_repository.create_branch(
        db=db,
        company_id=company_id,
        name=branch_name,
        address=address,
    )

    return BranchResponse(
        id=branch.id,
        name=branch.name,
        address=branch.address,
        company_id=branch.company_id,
    )


def list_manager_company_branches(
    db: Session,
    current_user: UserRead,
    requested_company_id: int | None = None,
) -> list[BranchResponse]:
    company_id = _manager_company_id(current_user, requested_company_id)
    return list_company_branches(db, company_id)


def create_manager_company_branch(
    db: Session,
    payload: BranchCreate,
    current_user: UserRead,
    requested_company_id: int | None = None,
) -> BranchResponse:
    company_id = _manager_company_id(current_user, requested_company_id)
    return create_company_branch(db, company_id, payload.name, payload.address)


def update_company_branch(
    db: Session,
    branch_id: int,
    payload: BranchUpdate,
    current_user: UserRead,
) -> BranchResponse:
    company_id = _manager_company_id(current_user)
    branch = company_repository.get_branch_by_id(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found.")
    if branch.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch does not belong to the authenticated user's company.",
        )

    branch_name = payload.name.strip() if payload.name is not None else branch.name
    if not branch_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Branch name is required.",
        )
    address = payload.address if "address" in payload.model_fields_set else branch.address
    updated_branch = company_repository.update_branch(
        db,
        branch,
        name=branch_name,
        address=address,
    )
    return BranchResponse(
        id=updated_branch.id,
        name=updated_branch.name,
        address=updated_branch.address,
        company_id=updated_branch.company_id,
    )


def delete_company_branch(db: Session, branch_id: int, current_user: UserRead) -> None:
    company_id = _manager_company_id(current_user)
    branch = company_repository.get_branch_by_id(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found.")
    if branch.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch does not belong to the authenticated user's company.",
        )
    if company_repository.branch_is_in_use(db, branch.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Branch cannot be deleted while it is assigned to employees or requirements.",
        )

    company_repository.delete_branch(db, branch)


def _manager_company_id(current_user: UserRead, requested_company_id: int | None = None) -> int:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )
    if requested_company_id is not None and requested_company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company does not belong to the authenticated manager.",
        )
    return current_user.company_id


def _is_owner_manager(db: Session, company_id: int, user_id: int) -> bool:
    return company_repository.is_owner_or_first_manager(db, company_id=company_id, user_id=user_id)


def _require_owner_manager(db: Session, current_user: UserRead) -> int:
    company_id = _manager_company_id(current_user)
    if not _is_owner_manager(db, company_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company owner or first manager can manage manager requests.",
        )
    return company_id


def _validate_not_expired(expires_at, *, detail: str) -> None:
    if expires_at is None:
        return
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def link_user_to_manager_company(
    db: Session,
    payload: CompanyLinkUserRequest,
    current_user: UserRead,
) -> LinkedEmployeeRead:
    company_id = _manager_company_id(current_user)
    target_user = user_repository.get_user_by_public_id(db, payload.user_public_id)
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User public ID not found.",
        )
    if target_user.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only employee users can be linked to a company.",
        )

    employee = employee_repository.get_employee_by_user_id(db, target_user.id)
    if employee is not None and employee.company_id == company_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already linked to this company.",
        )

    if payload.branch_id is not None:
        branch = company_repository.get_branch_by_id(db, payload.branch_id)
        if branch is None or branch.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated manager's company.",
            )

    if payload.position_id is not None:
        position = position_repository.get_position_by_id(db, payload.position_id)
        if position is None or position.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Position does not belong to the authenticated manager's company.",
            )

    if employee is None:
        linked_employee = employee_repository.create_employee(
            db=db,
            user_id=target_user.id,
            company_id=company_id,
            branch_id=payload.branch_id,
            position_id=payload.position_id,
            is_active=False,
        )
    else:
        linked_employee = employee_repository.update_employee_membership(
            db=db,
            employee=employee,
            company_id=company_id,
            branch_id=payload.branch_id,
            position_id=payload.position_id,
            is_active=False,
        )

    return LinkedEmployeeRead(
        id=linked_employee.id,
        public_id=linked_employee.user.public_id,
        full_name=linked_employee.user.full_name,
        email=linked_employee.user.email,
        branch_id=linked_employee.branch_id,
        position_id=linked_employee.position_id,
        position=(
            LinkedEmployeePositionRead(
                id=linked_employee.position.id,
                name=linked_employee.position.name,
            )
            if linked_employee.position is not None
            else None
        ),
    )


def join_company_by_invite(
    db: Session,
    payload: CompanyJoinRequest,
    current_user: UserRead,
) -> CurrentUserResponse:
    if _role_value(current_user) != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managers cannot join a company as employees.",
        )

    company = company_repository.get_company_by_invite_code(db, payload.invite_code)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company invite code not found.",
        )


    _validate_not_expired(
        company.invite_code_expires_at,
        detail="Company invite code has expired.",
    )

    if payload.branch_id is not None:
        branch = company_repository.get_branch_by_id(db, payload.branch_id)
        if branch is None or branch.company_id != company.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch does not belong to company.",
            )

    if payload.position_id is not None:
        position = position_repository.get_position_by_id(db, payload.position_id)
        if position is None or position.company_id != company.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Position does not belong to company.",
            )

    employee = employee_repository.get_employee_by_user_id(db, current_user.id)
    if employee is not None and employee.company_id == company.id and employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee is already active in this company.",
        )

    if employee is None:
        employee_repository.create_employee(
            db=db,
            user_id=current_user.id,
            company_id=company.id,
            branch_id=payload.branch_id,
            position_id=payload.position_id,
            is_active=False,
        )
    else:
        employee_repository.update_employee_membership(
            db=db,
            employee=employee,
            company_id=company.id,
            branch_id=payload.branch_id,
            position_id=payload.position_id,
            is_active=False,
        )

    from app.services import auth_service

    return auth_service.get_current_user_profile(db, current_user)


def join_company_as_manager_by_invite(
    db: Session,
    payload: CompanyJoinRequest,
    current_user: UserRead,
) -> CurrentUserResponse:
    if _role_value(current_user) != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can join a company as managers.",
        )

    company = company_repository.get_company_by_manager_invite_code(db, payload.invite_code)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manager invite code not found.",
        )

    _validate_not_expired(
        company.manager_invite_code_expires_at,
        detail="Manager invite code has expired.",
    )

    existing_active_company = company_repository.get_company_by_manager_user_id(db, current_user.id)
    if existing_active_company is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Manager already has an active company membership.",
        )

    membership = company_repository.get_manager_membership(db, company.id, current_user.id)
    if membership is not None and membership.membership_status == "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Manager is already active in this company.",
        )

    company_repository.create_or_update_manager_membership(
        db,
        company_id=company.id,
        user_id=current_user.id,
        manager_role="manager",
        membership_status="pending",
    )

    from app.services import auth_service

    return auth_service.get_current_user_profile(db, current_user)


def add_manager_by_public_id(
    db: Session,
    payload: CompanyUserPublicIdRequest,
    current_user: UserRead,
) -> ManagerRequestRead:
    company_id = _require_owner_manager(db, current_user)
    target_user = user_repository.get_user_by_public_id(db, payload.user_public_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User public ID not found.")
    if target_user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only manager users can be added as company managers.",
        )
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner is already active in this company.",
        )

    active_company = company_repository.get_company_by_manager_user_id(db, target_user.id)
    if active_company is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Manager already has an active company membership.",
        )

    membership = company_repository.get_manager_membership(db, company_id, target_user.id)
    if membership is not None and membership.membership_status == "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Manager is already active in this company.",
        )

    membership = company_repository.create_or_update_manager_membership(
        db,
        company_id=company_id,
        user_id=target_user.id,
        manager_role="manager",
        membership_status="pending",
    )
    return _build_manager_request_read(membership)


def list_manager_requests(db: Session, current_user: UserRead) -> list[ManagerRequestRead]:
    company_id = _require_owner_manager(db, current_user)
    return [
        _build_manager_request_read(membership)
        for membership in company_repository.list_pending_manager_memberships(db, company_id)
    ]


def accept_manager_request(db: Session, request_id: int, current_user: UserRead) -> ManagerRequestRead:
    company_id = _require_owner_manager(db, current_user)
    membership = company_repository.get_manager_membership_by_id(db, request_id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager request not found.")
    if membership.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager request belongs to another company.")
    if membership.membership_status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager request is not pending.")

    active_company = company_repository.get_company_by_manager_user_id(db, membership.user_id)
    if active_company is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Manager already has an active company membership.",
        )

    updated = company_repository.update_manager_membership_status(
        db,
        membership,
        membership_status="active",
    )
    return _build_manager_request_read(updated)


def decline_manager_request(db: Session, request_id: int, current_user: UserRead) -> ManagerRequestRead:
    company_id = _require_owner_manager(db, current_user)
    membership = company_repository.get_manager_membership_by_id(db, request_id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager request not found.")
    if membership.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager request belongs to another company.")
    if membership.membership_status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager request is not pending.")

    updated = company_repository.update_manager_membership_status(
        db,
        membership,
        membership_status="declined",
    )
    return _build_manager_request_read(updated)


def list_employee_requests(db: Session, current_user: UserRead) -> list[EmployeeRequestRead]:
    company_id = _manager_company_id(current_user)
    return [
        _build_employee_request_read(employee)
        for employee in employee_repository.list_pending_employees_by_company(db, company_id)
    ]


def accept_employee_request(
    db: Session,
    request_id: int,
    payload: EmployeeRequestAcceptRequest,
    current_user: UserRead,
) -> EmployeeRequestRead:
    company_id = _manager_company_id(current_user)
    employee = employee_repository.get_employee_by_id(db, request_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee request not found.")
    if employee.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee request belongs to another company.")
    if employee.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee request is not pending.")

    branch_id = payload.branch_id if "branch_id" in payload.model_fields_set else employee.branch_id
    position_id = payload.position_id if "position_id" in payload.model_fields_set else employee.position_id

    if branch_id is not None:
        branch = company_repository.get_branch_by_id(db, branch_id)
        if branch is None or branch.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch does not belong to the authenticated manager's company.",
            )

    if position_id is not None:
        position = position_repository.get_position_by_id(db, position_id)
        if position is None or position.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Position does not belong to the authenticated manager's company.",
            )

    updated = employee_repository.update_employee_membership(
        db,
        employee=employee,
        company_id=company_id,
        branch_id=branch_id,
        position_id=position_id,
        is_active=True,
    )
    return _build_employee_request_read(updated)


def decline_employee_request(db: Session, request_id: int, current_user: UserRead) -> EmployeeRequestRead:
    company_id = _manager_company_id(current_user)
    employee = employee_repository.get_employee_by_id(db, request_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee request not found.")
    if employee.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee request belongs to another company.")
    if employee.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee request is not pending.")

    response = _build_employee_request_read(employee)
    employee_repository.delete_employee(db, employee)
    return response

def delete_company(db: Session, company_id: int) -> None:
    company = company_repository.get_company_by_id(db, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    if hasattr(employee_repository, "delete_employees_by_company"):
        employee_repository.delete_employees_by_company(db, company_id)

    company_repository.delete_company(db, company)

