import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Branch, Company


def list_companies(db: Session) -> list[Company]:
    return list(db.scalars(select(Company).order_by(Company.id)))


def create_company(
    db: Session,
    name: str,
    manager_user_id: int | None = None,
) -> Company:
    company = Company(
        name=name,
        invite_code=_generate_invite_code(),
        manager_user_id=manager_user_id,
    )

    db.add(company)
    db.commit()
    db.refresh(company)

    return company


def get_default_company(db: Session) -> Company:
    company = db.scalars(select(Company).order_by(Company.id)).first()

    if company is None:
        company = Company(
            name="Default Company",
            invite_code=_generate_invite_code(),
            manager_user_id=None,
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
        .where(Company.manager_user_id == manager_user_id)
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


def create_branch(db: Session, company_id: int, name: str) -> Branch:
    branch = Branch(company_id=company_id, name=name)

    db.add(branch)
    db.commit()
    db.refresh(branch)

    return branch


def delete_company(db: Session, company: Company) -> None:
    db.delete(company)
    db.commit()


def _generate_invite_code() -> str:
    return secrets.token_hex(3).upper()
