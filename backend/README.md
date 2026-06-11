# ShiftPlanner Backend

This backend is a Stage 1 FastAPI mock API for ShiftPlanner. It exposes the frontend contract and Swagger documentation without using PostgreSQL or any persistent storage.

## Purpose

The current implementation is intended for:

- frontend integration against stable REST endpoints
- demoing the main user flow in Swagger
- preserving a clean `router -> service -> repository` structure for later database integration

All data is stored in memory and is reset when the process restarts.

## Stack

- Python
- FastAPI
- Pydantic
- Uvicorn
- in-memory mock repository

## Application Structure

```text
backend/
  app/
    api/            # FastAPI routers
    repositories/   # Mock in-memory storage
    schemas/        # Request and response models
    services/       # Business logic layer
    main.py         # App entry point
  .env.example
  Dockerfile
  requirements.txt
```

## Runtime Flow

The code follows this path for each request:

```text
HTTP request -> API router -> service -> mock repository -> response schema
```

This keeps the endpoint contracts stable while the repository can later be replaced by a PostgreSQL implementation.

## Main Components

### `app/main.py`

Creates the FastAPI application, loads environment variables, configures CORS, registers all routers, and exposes the health check endpoint.

Registered route groups:

- `/auth`
- `/companies`
- `/positions`
- `/employees`
- `/schedule`
- `/reports`

### `app/repositories/mock_db.py`

Contains the shared `MockDatabase` instance used by the services layer.

Behavior:

- stores companies, positions, employees, and generated schedules in memory
- seeds the app with one company, one position, and one employee
- generates incremental integer IDs
- generates invite codes for newly created companies
- validates `position_id` when creating an employee
- builds a mock schedule with a single shift

Seed data loaded on startup:

- company: `Demo Company`
- position: `Barista`
- employee: `Ivan Ivanov`

### `app/services/`

Each service is thin and delegates to the repository layer.

- `auth_service.py`: returns mock login and registration responses
- `company_service.py`: lists and creates companies
- `position_service.py`: lists and creates positions
- `employee_service.py`: lists and creates employees
- `schedule_service.py`: generates a mock draft schedule
- `report_service.py`: builds employee report rows from current in-memory employees

### `app/schemas/`

Pydantic models define both request bodies and response contracts used by Swagger.

Key models:

- `LoginRequest`, `LoginResponse`
- `RegisterRequest`, `RegisterResponse`
- `CompanyCreate`, `CompanyRead`
- `PositionCreate`, `PositionRead`
- `EmployeeCreate`, `EmployeeRead`
- `ScheduleGenerateRequest`, `ScheduleRead`, `ShiftRead`
- `EmployeeReportRead`

## API Endpoints

### Health

`GET /health`

Response:

```json
{
  "status": "ok"
}
```

### Auth

`POST /auth/login`

Request body is optional. If provided:

```json
{
  "email": "manager@example.com",
  "password": "secret"
}
```

Response:

```json
{
  "access_token": "mock-token",
  "token_type": "bearer",
  "role": "manager"
}
```

`POST /auth/register`

Request body is optional. If omitted, the endpoint returns default mock user data.

Example request:

```json
{
  "full_name": "Mock User",
  "email": "mock@example.com",
  "password": "secret",
  "role": "manager"
}
```

Response:

```json
{
  "id": 1,
  "full_name": "Mock User",
  "email": "mock@example.com",
  "role": "manager"
}
```

### Companies

`GET /companies/`

Returns all companies currently stored in memory.

Seed response includes:

```json
[
  {
    "id": 1,
    "name": "Demo Company",
    "invite_code": "FPPFPF"
  }
]
```

`POST /companies/`

Request:

```json
{
  "name": "Demo Company"
}
```

Response:

```json
{
  "id": 2,
  "name": "Demo Company",
  "invite_code": "CMP002"
}
```

### Positions

`GET /positions/`

Returns all positions currently stored in memory.

`POST /positions/`

Request:

```json
{
  "title": "Barista"
}
```

Response:

```json
{
  "id": 2,
  "title": "Barista"
}
```

### Employees

`GET /employees/`

Returns all employees with both `position_id` and `position_title`.

Seed response includes:

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

`POST /employees/`

Request:

```json
{
  "full_name": "Ivan Ivanov",
  "email": "ivan@example.com",
  "position_id": 1
}
```

Successful response:

```json
{
  "id": 2,
  "full_name": "Ivan Ivanov",
  "email": "ivan@example.com",
  "position_id": 1,
  "position_title": "Barista"
}
```

Error behavior:

- returns `404` if the referenced `position_id` does not exist

### Schedule

`POST /schedule/generate`

Request body is optional.

Example request with date:

```json
{
  "start_date": "2026-10-26"
}
```

If no body is provided, the mock schedule uses `2026-10-26`.

Response:

```json
{
  "id": 1,
  "status": "draft",
  "shifts": [
    {
      "employee_name": "Ivan Ivanov",
      "position": "Barista",
      "date": "2026-10-26",
      "start_time": "10:00:00",
      "end_time": "12:00:00"
    }
  ]
}
```

Current behavior:

- always creates a draft schedule
- always contains one mock shift
- uses the first employee stored in memory

### Reports

`GET /reports/employees`

Returns one report row per employee currently stored in memory.

Response:

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

The report values are mocked and not derived from real schedules.

## Environment Configuration

Create a `.env` file from `.env.example`.

Supported variables:

- `FRONTEND_ORIGINS`

Example:

```env
FRONTEND_ORIGINS=http://localhost:5173
```

You can provide multiple origins as a comma-separated list.

## Run Locally

From the `backend` directory:

```bash
python -m venv .venv
```

On Windows:

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create the environment file:

```bash
copy .env.example .env
```

Start the server:

```bash
uvicorn app.main:app --reload
```

## Local URLs

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI schema: `http://localhost:8000/openapi.json`
- Health check: `http://localhost:8000/health`

## Recommended Demo Flow

Use Swagger to run the API in this order:

1. `GET /health`
2. `POST /auth/login`
3. `POST /companies/`
4. `POST /positions/`
5. `POST /employees/`
6. `GET /employees/`
7. `POST /schedule/generate`
8. `GET /reports/employees`

## Current Limitations

- no PostgreSQL integration
- no SQLAlchemy models or migrations
- no real authentication or JWT validation
- no password hashing
- no persistent storage
- no role-based access control
- no real schedule generation logic
- report totals are static mock values

## Next Step

When the project moves to the next backend stage, the main replacement should be in the repository layer, while keeping the same routers, services, and response contracts where possible.
