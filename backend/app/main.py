import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, companies, employees, positions, reports, schedule

load_dotenv()

frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app = FastAPI(
    title="ShiftPlanner API",
    version="0.2.0",
    description="Stage 2 mock REST API for ShiftPlanner with JWT auth and in-memory business logic.",
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
app.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
