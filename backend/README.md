# ShiftPlanner Backend

This backend is a Stage 2 FastAPI mock API for ShiftPlanner. It keeps all data in memory, but now includes stateful authentication, role-based access control, scheduling resources, and live report calculation.

## What Stage 2 Adds

- JWT-based login with in-memory active token tracking
- password hashing with `passlib` and `bcrypt`
- role-aware users: `manager` and `employee`
- protected routes with Swagger `Authorize` support
- employee availability management
- schedule requirements management
- mock schedule generation
- manual shift reassignment and removal
- schedule publishing
- employee personal schedule endpoints
- shift exchange requests
- reports derived from published schedules
- normalized `422` validation errors

## Stack

- Python
- FastAPI
- Pydantic
- Uvicorn
- `python-jose`
- `passlib` + `bcrypt`
- in-memory mock repository

## Architecture

```text
HTTP request
  -> API router
  -> auth / RBAC dependency
  -> service layer
  -> MockDatabase
  -> response schema
```

Project layout:

```text
backend/
  app/
    api/
    repositories/
    schemas/
    services/
    main.py
  .env.example
  Dockerfile
  requirements.txt
```

## In-Memory Model

`MockDatabase` stores:

- companies
- positions
- employees
- users
- employee availability records
- schedule requirements
- generated schedules
- active JWT tokens
- shift exchange requests

All data is reset on process restart.

## Seeded Demo Data

On startup the backend creates:

- company: `Demo Company`
- position: `Barista`
- employee: `Ivan Ivanov`
- manager user: `manager@example.com` / `manager123`
- employee user: `ivan@example.com` / `employee123`

## Authentication

### Login

`POST /auth/login`

Request:

```json
{
  "email": "manager@example.com",
  "password": "manager123"
}
```

Response:

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer",
  "role": "manager"
}
```

### Register

`POST /auth/register`

Request:

```json
{
  "full_name": "Anna Petrova",
  "email": "anna@example.com",
  "password": "employee12",
  "role": "employee"
}
```

If the email matches an existing employee record and the role is `employee`, the user is linked to that employee profile automatically.

### Logout

`POST /auth/logout`

The token is removed from the in-memory active token store and becomes invalid immediately.

## Authorization Rules

Manager-only endpoints:

- `POST /companies/`
- `POST /positions/`
- `POST /employees/`
- `POST /schedule/requirements`
- `POST /schedule/generate`
- `PATCH /schedule/{id}/shifts/{shift_id}`
- `POST /schedule/{id}/publish`
- `GET /schedule/exchange-requests`
- `PATCH /schedule/exchange-requests/{id}`
- `GET /reports/employees`

Employee-only endpoints:

- `GET /schedule/my`
- `GET /employees/me/schedule`
- `POST /schedule/exchange-requests`

Manager or employee-self endpoints:

- `GET /employees/{id}/availability`
- `POST /employees/{id}/availability`

All protected routes return `401` without a valid token. Role violations return `403`.

## Validation and Error Shape

Validation errors are normalized to:

```json
{
  "detail": [
    {
      "field": "payload_or_query_field",
      "message": "human-readable validation message"
    }
  ]
}
```

Business errors use:

```json
{
  "detail": "human-readable message"
}
```

## API Overview

### Health

`GET /health`

Response:

```json
{
  "status": "ok"
}
```

### Companies

`GET /companies/`

Returns all companies for any authenticated user.

`POST /companies/`

Manager creates a company.

Request:

```json
{
  "name": "North Branch"
}
```

### Positions

`GET /positions/`

`POST /positions/`

Request:

```json
{
  "title": "Cashier"
}
```

### Employees

`GET /employees/`

Returns employees with embedded availability data.

`POST /employees/`

Request:

```json
{
  "full_name": "Anna Petrova",
  "email": "anna@example.com",
  "position_id": 2
}
```

### Employee Availability

`GET /employees/{employee_id}/availability`

`POST /employees/{employee_id}/availability`

Request:

```json
{
  "weekly_availability": [
    {
      "weekday": 0,
      "start_time": "09:00:00",
      "end_time": "18:00:00"
    }
  ],
  "desired_days_off": [5, 6]
}
```

`weekday` uses Python weekday numbering:

- `0` = Monday
- `6` = Sunday

### Schedule Requirements

`POST /schedule/requirements`

Request:

```json
{
  "position_id": 1,
  "date": "2026-06-15",
  "min_staff": 2,
  "start_time": "10:00:00",
  "end_time": "18:00:00"
}
```

`GET /schedule/requirements?start_date=2026-06-01&end_date=2026-06-30`

### Schedule Generation

`POST /schedule/generate`

Optional request body:

```json
{
  "start_date": "2026-06-15",
  "end_date": "2026-06-21"
}
```

Generation behavior:

- requirements are processed in memory
- the backend creates a simple mock shift using the first employee found for the required position
- availability is stored in the backend but is not used by schedule generation
- conflict detection is not applied during generation
- if no employee exists for the required position, the requirement is returned as unfilled
- if `min_staff > 1`, only one mock shift is created and the remaining staff count stays unfilled

Response includes:

- `shifts`
- `conflicts`
- `unfilled_requirements`

### Schedule Management

`GET /schedule/{schedule_id}`

Returns a generated schedule by ID.

`PATCH /schedule/{schedule_id}/shifts/{shift_id}`

Request to reassign:

```json
{
  "action": "reassign",
  "employee_id": 3
}
```

Request to remove:

```json
{
  "action": "remove"
}
```

`POST /schedule/{schedule_id}/publish`

Transitions a schedule from `draft` to `published`.

### Employee Schedule View

`GET /schedule/my`

Returns shifts from the latest published schedule for the authenticated employee.

`GET /employees/me/schedule`

Alias of the same employee-facing schedule view.

### Shift Exchange Requests

`POST /schedule/exchange-requests`

Employee request:

```json
{
  "shift_id": 1,
  "note": "Need a swap"
}
```

`GET /schedule/exchange-requests`

Manager sees pending requests only.

`PATCH /schedule/exchange-requests/{exchange_request_id}`

Request:

```json
{
  "status": "approved"
}
```

When a request is approved or rejected, the manager handles the follow-up manually.

### Reports

`GET /reports/employees`

Optional query params:

- `start_date`
- `end_date`

The report is calculated from published shifts only:

- `total_shifts` = count of published shifts in the selected period
- `total_hours` = sum of shift durations in hours

## Environment Variables

Example `.env`:

```env
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

`FRONTEND_ORIGINS` accepts a comma-separated list.

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

Create `.env`:

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

1. Login as manager with `manager@example.com` / `manager123`.
2. Create a position if needed.
3. Create an employee.
4. Set that employee's availability.
5. Create schedule requirements.
6. Generate a draft schedule.
7. Publish the schedule.
8. Login as employee and open `/schedule/my`.
9. Create a shift exchange request.
10. Return as manager and approve or reject it.
11. Open `/reports/employees`.

## Current Limitations

- no PostgreSQL integration
- no SQLAlchemy models or migrations
- no persistent storage
- no refresh tokens
- no real company scoping or multi-tenant isolation
- no automated shift reassignment after exchange approval
- no real schedule generation algorithm

## Verification Done

The current implementation was smoke-tested with the FastAPI test client for:

- manager login
- employee login
- protected route access
- requirement creation
- schedule generation
- schedule publish
- employee schedule view
- exchange request creation and approval
- live report calculation
- logout invalidation
