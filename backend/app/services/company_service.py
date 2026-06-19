from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository
from app.schemas.auth import CurrentUserResponse, UserRead
from app.schemas.company import (
    BranchResponse,
    CompanyCreate,
    CompanyJoinRequest,
    CompanyRead,
    CompanySummaryRead,
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


def create_company(db: Session, payload: CompanyCreate, current_user: UserRead) -> CompanyRead:
    company = company_repository.create_company(
        db=db,
        name=payload.name,
        manager_user_id=current_user.id,
    )

    return CompanyRead(
        id=company.id,
        name=company.name,
        invite_code=company.invite_code or "",
    )


def preview_invite_code(db: Session, invite_code: str):
    company = company_repository.get_company_by_invite_code(db, invite_code)

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
            company_id=branch.company_id,
        )
        for branch in _list_branches(db, company_id)
    ]


def create_company_branch(db: Session, company_id: int, name: str) -> BranchResponse:
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
    )

    return BranchResponse(
        id=branch.id,
        name=branch.name,
        company_id=branch.company_id,
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

    branch = None
    position = None

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
            branch_id=branch.id if branch else None,
            position_id=position.id if position else None,
        )
    else:
        employee_repository.update_employee_membership(
            db=db,
            employee=employee,
            company_id=company.id,
            branch_id=branch.id if branch else None,
            position_id=position.id if position else None,
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

