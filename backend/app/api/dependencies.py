from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import Role, UserRead
from app.services import auth_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserRead:
    return auth_service.get_current_user(db, token)


def require_role(role: Role):
    def dependency(current_user: UserRead = Depends(get_current_user)) -> UserRead:
        if current_user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"The '{role}' role is required for this action.",
            )
        return current_user

    return dependency


def require_manager(current_user: UserRead = Depends(get_current_user)) -> UserRead:
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")
    return current_user


def require_active_manager(current_user: UserRead = Depends(get_current_user)) -> UserRead:
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active manager company membership required.",
        )
    return current_user


def ensure_manager_or_employee_self(employee_id: int, current_user: UserRead) -> None:
    if current_user.role == "manager":
        return
    if current_user.employee_id == employee_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this employee resource.",
    )


def ensure_employee_user(current_user: UserRead) -> int:
    if current_user.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The 'employee' role is required for this action.",
        )
    if current_user.employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee account is not linked to an employee profile.",
        )
    if current_user.employee_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee membership is pending manager approval.",
        )
    return current_user.employee_id
