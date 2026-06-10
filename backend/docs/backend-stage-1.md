Ниже можно вставить в `docs/backend-stage-1.md` или в README.

# Backend Stage 1 Documentation

## Goal

The goal of the first backend stage is to create a working FastAPI REST API skeleton without a real database connection.

At this stage, the backend should provide mock endpoints that allow the frontend team to start integration and allow the project team to demonstrate the main user flow through Swagger.

The backend should not depend on PostgreSQL yet. All data can be stored temporarily in memory or returned as static mock responses.

---

## Tech Stack

* Python
* FastAPI
* REST API
* Uvicorn
* Pydantic
* Mock in-memory repositories
* Swagger / OpenAPI documentation

---

## Stage 1 Scope

### Included

The first backend stage should include:

* FastAPI project setup
* Application structure
* Health check endpoint
* Swagger documentation
* Mock authentication endpoints
* Mock company endpoints
* Mock position endpoints
* Mock employee endpoints
* Mock schedule endpoint
* Mock employee report endpoint
* CORS configuration for frontend
* Basic README instructions for running the backend

### Not Included

The first backend stage does not include:

* PostgreSQL integration
* SQLAlchemy models
* Alembic migrations
* Real authentication
* Password hashing
* JWT validation
* Real schedule generation algorithm
* Persistent data storage
* Role-based access control
* Production-ready error handling

---

## Required Backend Structure

The backend should have the following structure:

```text
backend/
  app/
    __init__.py
    main.py

    api/
      __init__.py
      auth.py
      companies.py
      positions.py
      employees.py
      schedule.py
      reports.py

    schemas/
      __init__.py
      auth.py
      company.py
      position.py
      employee.py
      schedule.py
      report.py

    services/
      __init__.py

    repositories/
      __init__.py
      mock_db.py

  .env.example
  Dockerfile
  README.md
  requirements.txt
```

---

## Required Endpoints

### Health Check

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

## Auth API

### Login

```http
POST /auth/login
```

Temporary mock response:

```json
{
  "access_token": "mock-token",
  "token_type": "bearer",
  "role": "manager"
}
```

### Register

```http
POST /auth/register
```

Temporary mock response:

```json
{
  "id": 1,
  "full_name": "Mock User",
  "email": "mock@example.com",
  "role": "manager"
}
```

---

## Companies API

### Get Companies

```http
GET /companies/
```

Expected response:

```json
[
  {
    "id": 1,
    "name": "Demo Company",
    "invite_code": "FPPFPF"
  }
]
```

### Create Company

```http
POST /companies/
```

Request body:

```json
{
  "name": "Demo Company"
}
```

Expected response:

```json
{
  "id": 1,
  "name": "Demo Company",
  "invite_code": "FPPFPF"
}
```

---

## Positions API

### Get Positions

```http
GET /positions/
```

Expected response:

```json
[
  {
    "id": 1,
    "title": "Barista"
  }
]
```

### Create Position

```http
POST /positions/
```

Request body:

```json
{
  "title": "Barista"
}
```

Expected response:

```json
{
  "id": 1,
  "title": "Barista"
}
```

---

## Employees API

### Get Employees

```http
GET /employees/
```

Expected response:

```json
[
  {
    "id": 1,
    "full_name": "Ivan Ivanov",
    "email": "ivan@example.com",
    "position_id": 1,
    "position_title": "Barista"
  }
]
```

### Create Employee

```http
POST /employees/
```

Request body:

```json
{
  "full_name": "Ivan Ivanov",
  "email": "ivan@example.com",
  "position_id": 1
}
```

Expected response:

```json
{
  "id": 1,
  "full_name": "Ivan Ivanov",
  "email": "ivan@example.com",
  "position_id": 1,
  "position_title": "Barista"
}
```

---

## Schedule API

### Generate Schedule

```http
POST /schedule/generate
```

Temporary mock response:

```json
{
  "id": 1,
  "status": "draft",
  "shifts": [
    {
      "employee_name": "Ivan Ivanov",
      "position": "Barista",
      "date": "2026-10-26",
      "start_time": "10:00",
      "end_time": "12:00"
    }
  ]
}
```

---

## Reports API

### Employee Report

```http
GET /reports/employees
```

Expected response:

```json
[
  {
    "employee_name": "Ivan Ivanov",
    "position": "Barista",
    "total_hours": 120,
    "total_shifts": 20
  }
]
```

---

## Main Demo Scenario

By the end of Stage 1, the backend should support the following demo scenario through Swagger:

1. Open Swagger at `/docs`.
2. Check that `/health` returns status `ok`.
3. Call `/auth/login` and receive a mock token.
4. Create a company.
5. Create a position.
6. Create an employee.
7. Get the employee list.
8. Generate a mock schedule.
9. Open the employee report.

This scenario is enough to demonstrate that the backend API is running and ready for frontend integration.

---

## Success Criteria

Stage 1 is complete when:

* The backend starts successfully with Uvicorn.
* Swagger is available at `/docs`.
* `/health` returns `{ "status": "ok" }`.
* All required routers are visible in Swagger.
* Mock endpoints return valid JSON responses.
* Frontend can send requests to the backend.
* The backend does not require a real database to run.
* The API structure can later be connected to PostgreSQL without changing endpoint contracts.

---

## Run Locally

From the `backend` directory:

```bash
python -m venv .venv
```

Activate virtual environment on Windows:

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the backend:

```bash
uvicorn app.main:app --reload
```

Swagger will be available at:

```text
http://localhost:8000/docs
```

Health check:

```text
http://localhost:8000/health
```

---

## Notes for Future Stages

In the next stages, mock repositories should be replaced with real database repositories.

The recommended transition is:

```text
router -> service -> mock repository
```

Later:

```text
router -> service -> PostgreSQL repository
```

This allows the frontend API contract to stay stable while the internal backend implementation changes.
