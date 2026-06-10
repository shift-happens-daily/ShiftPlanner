from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, companies, positions, employees, schedule, reports

app = FastAPI(
    title="ShiftPlanner API",
    version="0.1.0",
    description="REST API for ShiftPlanner"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(companies.router, prefix="/companies", tags=["Companies"])
app.include_router(positions.router, prefix="/positions", tags=["Positions"])
app.include_router(employees.router, prefix="/employees", tags=["Employees"])
app.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])


@app.get("/health")
def health_check():
    return {"status": "ok"}