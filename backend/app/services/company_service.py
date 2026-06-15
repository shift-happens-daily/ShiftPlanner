from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories import company_repository, employee_repository, position_repository
from app.schemas.auth import CurrentUserResponse, UserRead
from app.schemas.company import BranchRead, CompanyCreate, CompanyInvitePreviewRead, CompanyJoinRequest, CompanyRead, CompanySummaryRead, PositionOptionRead


def list_companies(db: Session) -> list[CompanySummaryRead]:
    return [
        CompanySummaryRead(id=company.id, name=company.name)
        for company in company_repository.list_companies(db)
    ]


def create_company(db: Session, payload: CompanyCreate) -> CompanyRead:
    company = company_repository.create_company(db, payload.name)
    return CompanyRead(id=company.id, name=company.name, invite_code=company.invite_code or "")


def preview_invite_code(db: Session, invite_code: str) -> CompanyInvitePreviewRead:
    company = company_repository.get_company_by_invite_code(db, invite_code)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company invite code not found.")

    branches = company_repository.list_branches_for_company(db, company.id)
    positions = position_repository.list_positions(db, company.id)
    return CompanyInvitePreviewRead(
        company_id=company.id,
        company_name=company.name,
        invite_code=company.invite_code or "",
        branches=[BranchRead(id=branch.id, name=branch.name) for branch in branches],
        positions=[PositionOptionRead(id=position.id, name=position.name) for position in positions],
    )


def join_company_by_invite(db: Session, payload: CompanyJoinRequest, current_user: UserRead) -> CurrentUserResponse:
    if current_user.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managers cannot join a company as employees.",
        )

    company = company_repository.get_company_by_invite_code(db, payload.invite_code)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company invite code not found.")

    branch_id = payload.branch_id
    if branch_id is not None:
        branch = company_repository.get_branch_by_id(db, branch_id)
        if branch is None or branch.company_id != company.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch does not belong to company.")
    else:
        branch = company_repository.get_default_branch_for_company(db, company.id)
        branch_id = branch.id if branch else None

    position_id = payload.position_id
    if position_id is not None:
        position = position_repository.get_position_by_id(db, position_id)
        if position is None or position.company_id != company.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Position does not belong to company.")

    employee = employee_repository.get_employee_by_user_id(db, current_user.id)
    if employee is None:
        employee_repository.create_employee(
            db,
            user_id=current_user.id,
            company_id=company.id,
            branch_id=branch_id,
            position_id=position_id,
        )
    else:
        employee_repository.update_employee_membership(
            db,
            employee=employee,
            company_id=company.id,
            branch_id=branch_id,
            position_id=position_id,
        )

    from app.services import auth_service

    return auth_service.get_current_user_profile(db, current_user)
