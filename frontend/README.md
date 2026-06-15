# ShiftPlanner Frontend

## Overview

This is the React + Vite frontend for the ShiftPlanner application. The current UI implements the login/register flow, role-based dashboards for employee and manager, and mock screens for profile, company info, employees, shifts, schedule, and reports.

The frontend is not yet fully integrated with the backend API. It currently uses mocked auth state and mock data in UI components.

## Tech stack

- React 19
- Vite
- React Router DOM
- Axios
- date-fns
- xlsx

## Run locally

From `frontend/`:

```bash
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

## Environment

Create `frontend/.env` with:

```env
VITE_API_URL=http://localhost:8000
```

This value should point to the backend API.

## Current frontend state

- `frontend/src/context/AuthContext.jsx` currently mocks `login`, `register`, and `logout`.
- `frontend/src/services/` is empty and should contain API service wrappers.
- `Auth` page and the dashboard routes are ready for integration, but they do not call real backend endpoints yet.
- Several tabs use hard-coded mock data for employees, requirements, shifts, and reports.

## Expected backend contract

The frontend should work with the backend endpoints described below.

### Authentication

- `POST /auth/login`
  - accepts `{ email, password }`
  - returns `{ access_token, token_type, role }`
- `POST /auth/register`
  - accepts `{ name, email, password, role }`
  - returns a token or user info
- `GET /auth/me`
  - returns current user profile and context
- `POST /auth/logout`
  - invalidates current token

### User profile

The frontend expects `/auth/me` to return a user object with:

```json
{
  "id": 1,
  "email": "ivan@example.com",
  "role": "employee",
  "employee_id": 5,
  "company": {
    "id": 1,
    "name": "Coffee Bar Barnaul",
    "invite_code": "COFFEE123"
  },
  "branch": { "id": 1, "name": "Main Branch" },
  "position": { "id": 2, "name": "Barista" }
}
```

### Company and invite flow

Expected endpoints:

- `GET /companies/`
- `POST /companies/`
- `GET /companies/invite/{invite_code}`
- `POST /companies/join`

### Employees and positions

Expected endpoints:

- `GET /employees/`
- `POST /employees/`
- `GET /employees/{employee_id}/availability`
- `POST /employees/{employee_id}/availability`
- `GET /employees/{employee_id}/absences`
- `POST /employees/{employee_id}/absences`
- `DELETE /employees/{employee_id}/absences/{absence_id}`
- `GET /employees/{employee_id}/calendar-summary`
- `GET /employees/me/absences`
- `POST /employees/me/absences`
- `GET /employees/me/calendar-summary`
- `GET /employees/me/schedule`

### Scheduling

Expected endpoints:

- `GET /schedule/requirements`
- `POST /schedule/requirements`
- `POST /schedule/requirements/bulk`
- `POST /schedule/generate`
- `GET /schedule/{schedule_id}`
- `PATCH /schedule/{schedule_id}/shifts/{shift_id}`
- `POST /schedule/{schedule_id}/publish`
- `GET /schedule/my`
- `POST /schedule/exchange-requests`
- `GET /schedule/exchange-requests`
- `PATCH /schedule/exchange-requests/{exchange_request_id}`

### Reports and imports

Expected endpoints:

- `GET /reports/employees`
- `GET /reports/me`
- `POST /imports/requirements/xlsx`

## How frontend expects to use backend data

### Auth flow

1. User logs in or registers.
2. Save the returned bearer token in browser storage.
3. Call `GET /auth/me` and use the returned profile for UI state.
4. Use `role`, `employee_id`, `company`, `branch`, and `position` for navigation and permissions.

### Role-based UI

- Employee sees: Profile, Company, Shifts, Schedule.
- Manager sees: Profile, Company, Employees, Shifts, Schedule, Reports.

### Frontend integration points

- Replace `AuthContext` mock logic with real API calls.
- Implement `frontend/src/services/api.js` or similar service layer.
- Use `axios` with `Authorization: Bearer <token>` for protected routes.
- Load profile and role once after login, then keep it in context.
- Fetch list data for company, employees, requirements, shifts, and reports from backend endpoints.

## Notes for backend integration

- The frontend currently uses mock data and local storage in several screens. The backend should provide real data for these views.
- The app expects `VITE_API_URL` to be available at runtime.
- UI labels support Russian and English.
- The current design includes role-based pages at `/employee` and `/manager`.

## Development checklist

- [ ] Connect `AuthContext` to actual backend auth endpoints.
- [ ] Implement token storage and refresh handling if needed.
- [ ] Load `/auth/me` after login to populate user data.
- [ ] Replace mock employees and positions with backend responses.
- [ ] Replace mock schedule and shift data with real schedule endpoints.
- [ ] Replace reports mock data with `GET /reports/employees` and `GET /reports/me`.
- [ ] Add error handling for 401/403 responses.


