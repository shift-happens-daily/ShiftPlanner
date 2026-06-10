from fastapi import APIRouter

router = APIRouter()


@router.post("/login")
def login():
    return {
        "access_token": "mock-token",
        "token_type": "bearer",
        "role": "manager"
    }


@router.post("/register")
def register():
    return {
        "id": 1,
        "full_name": "Mock User",
        "email": "mock@example.com",
        "role": "manager"
    }