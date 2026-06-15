# ShiftPlanner Frontend

## Overview

React + Vite client for ShiftPlanner.

The frontend is now connected to the real FastAPI backend for:

- authentication
- role-based routing
- company invite join flow
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

Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:8000
```

The backend must be reachable from the browser at that URL.

## Language

- UI language is switched between Russian and English in the frontend and persisted in `localStorage` under `language`
- dashboard pages, auth screens, backend-integration tabs, and common API errors use the same selected language

## Run Locally

1. Start backend on `http://localhost:8000`.
2. In `frontend/` run:

```bash
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Demo Accounts

- `manager@example.com / manager123`
- `ivan@example.com / employee123`

Invite flow demo data:

- company: `Coffee Bar Barnaul`
- invite code: `COFFEE123`

## Integrated Pages

### Auth

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `POST /auth/logout`

Behavior:

- bearer token is stored in `localStorage` under `shiftplanner_token`
- protected requests attach `Authorization: Bearer <token>`
- app startup restores the session through `GET /auth/me`
- `401` clears local auth state and sends the user back through login

### Employee Dashboard

- `Profile`: current user data from `GET /auth/me`
- `Company`: joined company, branch, position, invite-code join flow
- `Shift Setup`: self availability, desired days off, absences, calendar summary
- `Schedule`: personal published shifts from `GET /schedule/my`, shift exchange request creation
- `Reports`: self workload from `GET /reports/me`

### Manager Dashboard

- `Profile`: current user data from `GET /auth/me`
- `Company`: company list from `GET /companies/`, company creation via `POST /companies/`
- `Employees`: positions, employee creation, availability, absences, employee summary
- `Shift Setup`: requirements list, single requirement creation, bulk requirement creation, XLSX import
- `Schedule`: generate draft schedule, reassign/remove shifts, publish schedule
- `Reports`: employee workload report for a selected date range

## Backend Endpoints Used

### Company

- `GET /companies/`
- `POST /companies/`
- `GET /companies/invite/{invite_code}`
- `POST /companies/join`

Visibility rules:

- employee company page uses `GET /auth/me` as the source of truth
- employees do not load or see the general company list
- `GET /companies/` is treated as a manager company-management list and no longer exposes `invite_code`
- invite details are shown only after explicit preview through `GET /companies/invite/{invite_code}`

### Positions and Employees

- `GET /positions/`
- `POST /positions/`
- `GET /employees/`
- `POST /employees/`
- `GET /employees/{employee_id}/availability`
- `POST /employees/{employee_id}/availability`
- `GET /employees/{employee_id}/absences`
- `POST /employees/{employee_id}/absences`
- `DELETE /employees/{employee_id}/absences/{absence_id}`
- `GET /employees/{employee_id}/calendar-summary`
- `GET /employees/me/absences`
- `GET /employees/me/calendar-summary`

### Schedule

- `GET /schedule/requirements`
- `POST /schedule/requirements`
- `POST /schedule/requirements/bulk`
- `POST /schedule/generate`
- `PATCH /schedule/{schedule_id}/shifts/{shift_id}`
- `POST /schedule/{schedule_id}/publish`
- `GET /schedule/my`
- `POST /schedule/exchange-requests`

### Reports and Import

- `GET /reports/employees`
- `GET /reports/me`
- `POST /imports/requirements/xlsx`

## Error Handling

- `401`: token is cleared and the app falls back to login
- `403`: shown as a localized permission error
- `404`: shown as a localized not-found error, including invalid invite code cases
- `422`: validation details are normalized into readable text
- network error: shown as a localized backend unavailable message
- common backend detail strings are mapped to localized frontend messages instead of being rendered raw

## Known Limitations

- Manager schedule screen works with the schedule returned by the current generation flow; it does not yet provide a separate UI to load an arbitrary historical schedule by ID.
- Exchange request approval endpoints exist in the backend, but the manager approval UI is not implemented yet.
- The manager profile still reflects backend reality: if `/auth/me` has no attached company for a manager, the frontend does not fake one.

## Verification

Commands run:

```bash
cd frontend
npm install
npm run lint
npm run build
```

```bash
cd backend
python -m compileall app
python -m pytest
```

Results:

- `npm run lint`: passed
- `npm run build`: passed
- `python -m compileall app`: passed
- `python -m pytest`: timed out in the current environment
