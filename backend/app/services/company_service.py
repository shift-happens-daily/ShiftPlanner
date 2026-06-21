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
    LinkedEmployeePositionRead,
    LinkedEmployeeRead,
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


def create_company(db: Session, payload: CompanyCreate, current_user: UserRead) -> CompanyRead:
    company = company_repository.create_company(
        db=db,
        name=payload.name,
        manager_user_id=current_user.id,
    )

    return _build_company_read(company)


def get_my_company(db: Session, current_user: UserRead) -> CompanyRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    company = company_repository.get_company_by_id(db, current_user.company_id)
    if company is None or company.manager_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to this company.",
        )

    return _build_company_read(company)


def update_my_company(db: Session, payload: CompanyUpdate, current_user: UserRead) -> CompanyRead:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to a company.",
        )

    company = company_repository.get_company_by_id(db, current_user.company_id)

    if company is None or company.manager_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to this company.",
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
    if company is None or company.manager_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager is not linked to this company.",
        )

    updated_company = company_repository.regenerate_invite_code(db, company)
    return _build_company_read(updated_company)


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
        )
    else:
        linked_employee = employee_repository.update_employee_membership(
            db=db,
            employee=employee,
            company_id=company_id,
            branch_id=payload.branch_id,
            position_id=payload.position_id,
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


    if company.invite_code_expires_at is not None:
        expires_at = company.invite_code_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
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

    if employee is None:
        employee_repository.create_employee(
            db=db,
            user_id=current_user.id,
            company_id=company.id,
            branch_id=payload.branch_id,
            position_id=payload.position_id,
        )
    else:
        employee_repository.update_employee_membership(
            db=db,
            employee=employee,
            company_id=company.id,
            branch_id=payload.branch_id,
            position_id=payload.position_id,
        )

    from app.services import auth_service

    return auth_service.get_current_user_profile(db, current_user)

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

