from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def get_companies():
    return []


@router.post("/")
def create_company():
    return {
        "id": 1,
        "name": "Demo Company",
        "invite_code": "FPPFPF",
    }