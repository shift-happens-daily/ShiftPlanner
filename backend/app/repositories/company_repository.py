import secrets
import string
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Branch, Company, CompanyManager, EmployeeBranch, ShiftRequirement


def list_companies(db: Session) -> list[Company]:
    return list(db.scalars(select(Company).order_by(Company.id)))


def create_company(
    db: Session,
    name: str,
    manager_user_id: int | None = None,
) -> Company:
    company = Company(
        name=name,
        invite_code=_generate_unique_invite_code(db),
        invite_code_generated_at=datetime.now(UTC).replace(tzinfo=None),
        invite_code_expires_at=None,
    )

    db.add(company)
    db.flush()
    if manager_user_id is not None:
        db.add(CompanyManager(company_id=company.id, user_id=manager_user_id, manager_role="owner"))
    db.commit()
    db.refresh(company)

    return company


def update_company(
    db: Session,
    company: Company,
    *,
    name: str | None = None,
    address: str | None = None,
) -> Company:
    if name is not None:
        company.name = name
    company.address = address

    db.add(company)
    db.commit()
    db.refresh(company)

    return company


def regenerate_invite_code(db: Session, company: Company) -> Company:
    company.invite_code = _generate_unique_invite_code(db)
    company.invite_code_generated_at = datetime.now(UTC).replace(tzinfo=None)
    company.invite_code_expires_at = None
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def get_default_company(db: Session) -> Company:
    company = db.scalars(select(Company).order_by(Company.id)).first()

    if company is None:
        company = Company(
            name="Default Company",
            invite_code=_generate_unique_invite_code(db),
            invite_code_generated_at=datetime.now(UTC).replace(tzinfo=None),
            invite_code_expires_at=None,
        )
        db.add(company)
        db.commit()
        db.refresh(company)

    return company


def get_company_by_id(db: Session, company_id: int) -> Company | None:
    return db.get(Company, company_id)


def get_company_by_invite_code(db: Session, invite_code: str) -> Company | None:
    return db.scalars(
        select(Company).where(Company.invite_code == invite_code)
    ).first()


def get_company_by_manager_user_id(
    db: Session,
    manager_user_id: int,
) -> Company | None:
    return db.scalars(
        select(Company)
        .join(CompanyManager, CompanyManager.company_id == Company.id)
        .where(CompanyManager.user_id == manager_user_id)
        .order_by(Company.id.desc())
    ).first()


def get_default_branch_for_company(db: Session, company_id: int) -> Branch | None:
    return db.scalars(
        select(Branch)
        .where(Branch.company_id == company_id)
        .order_by(Branch.id)
    ).first()


def list_branches_for_company(db: Session, company_id: int) -> list[Branch]:
    return list(
        db.scalars(
            select(Branch)
            .where(Branch.company_id == company_id)
            .order_by(Branch.id)
        )
    )


def list_branches_by_company(db: Session, company_id: int) -> list[Branch]:
    return list_branches_for_company(db, company_id)


def get_branch_by_id(db: Session, branch_id: int) -> Branch | None:
    return db.get(Branch, branch_id)


def create_branch(db: Session, company_id: int, name: str, address: str | None = None) -> Branch:
    branch = Branch(company_id=company_id, name=name, address=address)

    db.add(branch)
    db.commit()
    db.refresh(branch)

    return branch


def update_branch(
    db: Session,
    branch: Branch,
    *,
    name: str,
    address: str | None,
) -> Branch:
    branch.name = name
    branch.address = address
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


def branch_is_in_use(db: Session, branch_id: int) -> bool:
    employee_id = db.scalar(
        select(EmployeeBranch.employee_id)
        .where(EmployeeBranch.branch_id == branch_id)
        .limit(1)
    )
    if employee_id is not None:
        return True

    requirement_id = db.scalar(
        select(ShiftRequirement.id)
        .where(ShiftRequirement.branch_id == branch_id)
        .limit(1)
    )
    return requirement_id is not None


def delete_branch(db: Session, branch: Branch) -> None:
    db.delete(branch)
    db.commit()


def delete_company(db: Session, company: Company) -> None:
    db.delete(company)
    db.commit()


def _generate_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(16))


def _generate_unique_invite_code(db: Session, max_attempts: int = 20) -> str:
    for _ in range(max_attempts):
        invite_code = _generate_invite_code()
        existing_id = db.scalar(
            select(Company.id)
            .where(Company.invite_code == invite_code)
            .limit(1)
        )
        if existing_id is None:
            return invite_code

    raise RuntimeError("Could not generate a unique company invite code.")
