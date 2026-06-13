from sqlalchemy.orm import Session

from app.repositories import company_repository
from app.schemas.company import CompanyCreate, CompanyRead


def list_companies(db: Session) -> list[CompanyRead]:
    return [
        CompanyRead(id=company.id, name=company.name, invite_code=company.invite_code or "")
        for company in company_repository.list_companies(db)
    ]


def create_company(db: Session, payload: CompanyCreate) -> CompanyRead:
    company = company_repository.create_company(db, payload.name)
    return CompanyRead(id=company.id, name=company.name, invite_code=company.invite_code or "")
