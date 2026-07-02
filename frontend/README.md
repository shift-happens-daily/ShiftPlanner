````md
# ShiftPlanner Frontend

## Overview

React + Vite client for ShiftPlanner.

The frontend is connected to the real FastAPI backend and supports:

- authentication
- role-based routing
- company creation
- company invite join flow
- database-based company membership
- manager employee/position management
- availability and absences
- schedule requirements
- schedule generation and publishing
- reports
- XLSX requirement import

## Tech Stack

- React 19
- Vite
- React Router DOM
- Axios
- `xlsx`

## Environment

Production builds use:

```env
VITE_API_URL=https://shiftplanner.online/api
```

Local development uses `frontend/.env.development`:

```env
VITE_API_URL=http://localhost:8000
```

The backend must be reachable from the browser at that URL.

## Run Locally

1. Start the backend on `http://localhost:8000`.
2. In `frontend/` run:

```bash
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Language

The UI language can be switched between Russian and English.

The selected language is persisted in `localStorage` under:

```text
language
```

The selected language is used across:

* auth screens
* dashboard pages
* backend-integrated tabs
* common API error messages

## Authentication

Authentication is handled through the backend API.

Used endpoints:

* `POST /auth/login`
* `POST /auth/register`
* `GET /auth/me`
* `POST /auth/logout`

Behavior:

* bearer token is stored in `localStorage` under `shiftplanner_token`
* protected API requests attach `Authorization: Bearer <token>`
* app startup restores the session through `GET /auth/me`
* `401` clears local auth state and redirects the user to login

## Company Data Source

Company data is no longer stored or restored from frontend `localStorage`.

The frontend uses `GET /auth/me` as the source of truth for the current user's company data.

For managers:

```text
/auth/me -> company
```

The manager company is stored in the database through `companies.manager_user_id`.

For employees:

```text
/auth/me -> company, branch, position
```

The employee company membership is stored in the database through the `employees` table.

This means:

* manager company survives page reloads because it is stored in the database
* employee company/branch/position survives page reloads because it is stored in the database
* after database reset, old companies do not reappear from frontend storage
* if `/auth/me` returns no company, the frontend does not fake one

## Demo Accounts

Demo accounts are available only if the backend seed data is applied.

Default seed accounts:

* `manager@example.com / manager123`
* `ivan@example.com / employee123`

Default invite flow demo data:

* company: `Coffee Bar Barnaul`
* invite code: `COFFEE123`

If the database was reset without applying `seed.sql`, create new users and a new company manually through the UI.

## Integrated Pages

### Auth

The auth pages support:

* login
* registration
* logout
* session restore through `GET /auth/me`

### Employee Dashboard

Employee dashboard tabs:

* `Profile`: current user data from `GET /auth/me`
* `Company`: joined company, branch, position, invite-code join flow
* `Shift Setup`: self availability, desired days off, absences, calendar summary
* `Schedule`: personal published shifts from `GET /schedule/my`, shift exchange request creation
* `Reports`: self workload from `GET /reports/me`

### Manager Dashboard

Manager dashboard tabs:

* `Profile`: current user data from `GET /auth/me`
* `Company`: current company from `GET /auth/me`, company creation, invite code, branch creation
* `Employees`: position creation, employee creation, availability, absences, employee summary
* `Shift Setup`: requirements list, single requirement creation, bulk requirement creation, XLSX import
* `Schedule`: generate draft schedule, reassign/remove shifts, publish schedule
* `Reports`: employee workload report for a selected date range

## Backend Endpoints Used

### Company

* `GET /companies/`
* `POST /companies/`
* `GET /companies/invite/{invite_code}`
* `POST /companies/join`
* `GET /companies/{company_id}/branches`
* `POST /companies/{company_id}/branches`
* `DELETE /companies/{company_id}`

Company visibility rules:

* current company is loaded from `GET /auth/me`
* manager company is attached through `companies.manager_user_id`
* employee company is attached through the `employees` table
* employees do not load or see the general company list
* `GET /companies/` is treated as a manager company-management list
* invite details are shown only after explicit preview through `GET /companies/invite/{invite_code}`

### Positions and Employees

* `GET /positions/`
* `POST /positions/`
* `GET /employees/`
* `POST /employees/`
* `GET /employees/{employee_id}/availability`
* `POST /employees/{employee_id}/availability`
* `GET /employees/{employee_id}/absences`
* `POST /employees/{employee_id}/absences`
* `DELETE /employees/{employee_id}/absences/{absence_id}`
* `GET /employees/{employee_id}/calendar-summary`
* `GET /employees/me/absences`
* `GET /employees/me/calendar-summary`

Position behavior:

* manager-created positions are attached to the current manager company
* the current company is taken from `GET /auth/me`
* positions are filtered by `company_id` on the frontend

### Schedule

* `GET /schedule/requirements`
* `POST /schedule/requirements`
* `POST /schedule/requirements/bulk`
* `POST /schedule/generate`
* `PATCH /schedule/{schedule_id}/shifts/{shift_id}`
* `POST /schedule/{schedule_id}/publish`
* `GET /schedule/my`
* `POST /schedule/exchange-requests`

### Reports and Import

* `GET /reports/employees`
* `GET /reports/me`
* `POST /imports/requirements/xlsx`

## Error Handling

Common API errors are normalized and localized.

Behavior:

* `401`: token is cleared and the app returns to login
* `403`: shown as a localized permission error
* `404`: shown as a localized not-found error, including invalid invite code cases
* `422`: validation details are normalized into readable text
* network error: shown as a localized backend unavailable message
* common backend detail strings are mapped to localized frontend messages instead of being rendered raw

## Database Reset Notes

After backend schema changes, reset the database from the project root:

```bash
docker exec shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
```

Then apply schema:

```bash
Get-Content backend/db/schema.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Apply seed data only if demo accounts are needed:

```bash
Get-Content backend/db/seed.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Frontend local storage can be cleared during debugging:

```js
localStorage.clear()
```

This clears token and UI language as well, so the user will need to log in again.

## Known Limitations

* Manager schedule screen works with the schedule returned by the current generation flow; it does not yet provide a separate UI to load an arbitrary historical schedule by ID.
* Exchange request approval endpoints exist in the backend, but the manager approval UI is not implemented yet.
* The frontend depends on `GET /auth/me` for current company state. If `/auth/me` does not return a company for a manager or employee, the frontend will show the account as not attached to a company.
* Demo accounts and demo invite codes exist only when backend seed data is applied.

## Verification

Frontend commands:

```bash
cd frontend
npm install
npm run lint
npm run build
```

Backend commands:

```bash
cd backend
python -m compileall app
python -m pytest
```

Expected results:

* `npm run lint`: passed
* `npm run build`: passed
* `python -m compileall app`: passed
* `python -m pytest`: may depend on the local environment and database state

```
```
