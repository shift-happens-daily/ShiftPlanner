from app.repositories import mock_db
from app.schemas.company import CompanyCreate, CompanyRead


def list_companies() -> list[CompanyRead]:
    return [CompanyRead(**company) for company in mock_db.list_companies()]


def create_company(payload: CompanyCreate) -> CompanyRead:
    return CompanyRead(**mock_db.create_company(payload))
