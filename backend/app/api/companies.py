from fastapi import APIRouter, status

from app.schemas.company import CompanyCreate, CompanyRead
from app.services import company_service

router = APIRouter()


@router.get("/", response_model=list[CompanyRead])
def get_companies() -> list[CompanyRead]:
    return company_service.list_companies()


@router.post("/", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate) -> CompanyRead:
    return company_service.create_company(payload)
