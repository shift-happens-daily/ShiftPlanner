import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal
from app.api import auth, companies, employees, imports, positions, reports, schedule
from app.services.schema_service import ensure_email_verification_schema

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]


def get_root_path() -> str:
    explicit_root_path = os.getenv("ROOT_PATH")
    if explicit_root_path is not None and explicit_root_path.strip():
        return explicit_root_path.strip().rstrip("/")

    public_api_base_url = os.getenv("PUBLIC_API_BASE_URL", "")
    parsed_path = urlparse(public_api_base_url).path.strip().rstrip("/")
    return parsed_path if parsed_path and parsed_path != "/" else ""


app = FastAPI(
    title="ShiftPlanner API",
    version="0.3.0",
    description="Stage 2 REST API for ShiftPlanner with JWT auth, RBAC, and PostgreSQL persistence.",
    root_path=get_root_path(),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    normalized_errors = []
    for error in exc.errors():
        location = [str(item) for item in error["loc"] if item != "body"]
        field = ".".join(location) if location else "body"
        normalized_errors.append({"field": field, "message": error["msg"]})
    return JSONResponse(status_code=422, content={"detail": normalized_errors})


app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(companies.router, prefix="/companies", tags=["Companies"])
app.include_router(positions.router, prefix="/positions", tags=["Positions"])
app.include_router(employees.router, prefix="/employees", tags=["Employees"])
app.include_router(imports.router, prefix="/imports", tags=["Imports"])
app.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])


@app.on_event("startup")
def ensure_runtime_schema() -> None:
    with SessionLocal() as session:
        ensure_email_verification_schema(session)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def database_health_check():
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return {"status": "ok"}
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "error"})
