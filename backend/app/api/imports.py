from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import require_role
from app.api.responses import BAD_REQUEST_RESPONSE, FORBIDDEN_RESPONSE, UNAUTHORIZED_RESPONSE
from app.database import get_db
from app.schemas.auth import UserRead
from app.schemas.imports import RequirementsImportResultRead
from app.services import import_service

router = APIRouter()


@router.post(
    "/requirements/xlsx",
    response_model=RequirementsImportResultRead,
    responses={**BAD_REQUEST_RESPONSE, **UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
async def import_requirements_xlsx(
    file: UploadFile = File(...),
    _: UserRead = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> RequirementsImportResultRead:
    content = await file.read()
    return import_service.import_requirements_xlsx(db, content)
