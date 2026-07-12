# ShiftPlanner

<p align="center">
  <img src="pic\v1.svg" width="180" alt="ShiftPlanner Logo">
</p>

<p align="center">
  <strong>Smart employee shift scheduling platform</strong><br>
  Generate schedules in minutes, manage your workforce, and simplify shift planning.
</p>


## About

ShiftPlanner is a workforce scheduling platform designed to simplify employee shift management for businesses such as cafés, restaurants, retail stores, and other service companies.

Instead of manually assigning shifts every week, managers can define staffing requirements, employee availability, and workplace structure. The system then generates a schedule automatically while employees access their shifts through the web and mobile applications.

The project was developed as a university software engineering project following an MVP-first approach.

## Features

### 👨‍💼 Manager

- Company creation and management
- Employee management
- Branch management
- Position management
- Invite employees using invite codes
- Define shift requirements
- Import requirements from Excel (.xlsx)
- Generate schedules automatically
- Publish schedules
- View reports

### 👷 Employee

- Join company via invite code
- Select branch and position
- Set availability
- Request preferred days off
- View assigned shifts
- Access personal reports

### 🔐 Authentication

- JWT authentication
- Role-based authorization
- Secure password hashing

## Tech Stack

| Layer | Technologies |
|--------|--------------|
| **Frontend (Web)** | React |
| **Backend** | Python, FastAPI |
| **Database** | PostgreSQL |
| **Mobile (Android)** | Android Studio, Kotlin, Jetpack Compose |
| **Mobile (iOS)** | Swift |
| **Documentation** | Swagger / OpenAPI |
| **Infrastructure** | Docker, Docker Compose |

## Project Structure

```text
ShiftPlanner/
│
├── .github/     
│
├── backend/                 # FastAPI backend
│   ├── app/                 # Application source code
│   ├── db/                  # Database schema
│   ├── tests/               # Backend tests
│   ├── .env.example
│   ├── db-backend.md 
│   ├── Dockerfile
│   ├── front_back.md
│   ├── requirements.txt
│   ├── test_db.py
│   └── test_solver.py
│
├── frontend/                # React web application
│   ├── public/
│   ├── src/
│   ├── .dockerignore
│   ├── .env.development
│   ├── eslint.config.js
│   ├── index.html
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── vite.config.js
│   └── .env.example
│
├── mobile/
│   ├── android/             
│   ├── ios/           
│   └── README.md
│
├── nginx/                   # Reverse proxy configuration
│   ├── Dockerfile
│   ├── docker-entrypoint.d/
│   ├── renewal-hooks/ 
│   ├── default.conf
│   └── default.http.conf
│
├── pic/                     # Images and project assets
│
├── .gitignore
├── docker-compose.yml
├── docker-compose.override.yml
├── LICENSE
└── README.md
```

## 🚀 Quick Start

ShiftPlanner can be used in two ways:

- **Online:** Visit the production deployment at **https://shiftplanner.online**
- **Locally:** Run the project using Docker Compose.

### 1. Clone the repository

```bash
git clone https://github.com/shift-happens-daily/ShiftPlanner.git
cd ShiftPlanner
```

### 2. Configure environment variables

Create the required environment files from the provided templates:

```text
backend/.env.example  →  backend/.env
frontend/.env.example →  frontend/.env
```

Update the environment variables if necessary (database connection, JWT secret, API URL, etc.).

### 3. Start the application

Run all services with Docker Compose:

```bash
docker compose up --build
```

This will start:

- PostgreSQL database
- FastAPI backend
- React frontend
- Nginx reverse proxy

### 4. Access the application

Once the containers are running, the application will be available at:

| Service | URL |
|---------|-----|
| Web Application | http://localhost |
| Backend API | http://localhost/api |
| Swagger Documentation | http://localhost/api/docs |

### 5. Stop the application

To stop all running containers:

```bash
docker compose down
```

## Reproducibility Guide

This section describes how to reproduce the application from a clean checkout and verify that the main services are working.

### Requirements

- Git
- Docker Desktop with Docker Compose
- At least 4 GB of free memory for the application containers

### Reproduce the application with Docker Compose

1. Clone the repository and enter the project directory:

```bash
git clone https://github.com/shift-happens-daily/ShiftPlanner.git
cd ShiftPlanner
```

2. Build and start all services:

```bash
docker compose up --build -d
```

The compose file starts PostgreSQL, the FastAPI backend, the React frontend, and the Nginx reverse proxy. On the first database startup, `backend/db/schema.sql` and `backend/db/seed.sql` are applied automatically.

3. Check the container status:

```bash
docker compose ps
```

All services should have a running or healthy status.

4. Check the health endpoints:

```text
http://localhost/api/health
http://localhost/api/health/db
```

Both endpoints should return a successful response with `"status": "ok"`.

5. Open the following URLs:

| Resource | URL |
|----------|-----|
| Web application | http://localhost |
| Swagger UI | http://localhost/api/docs |
| OpenAPI schema | http://localhost/api/openapi.json |
| Backend health | http://localhost/api/health |
| Detailed API reference | [backend/api_documentation.md](backend/api_documentation.md) |

### Demo accounts

The seed data provides the following accounts:

| Role | Email | Password |
|------|-------|----------|
| Manager | `manager@example.com` | `manager123` |
| Employee | `ivan@example.com` | `employee123` |

The seeded company is `Coffee Bar Barnaul` and its invite code is `COFFEE123`.

### Basic verification scenario

The following scenario confirms that authentication, company data, schedules, and reports are connected:

1. Sign in as the manager using the seeded manager account.
2. Open the manager dashboard and verify the company, employees, positions, and branches.
3. Create or load schedule requirements for a date range.
4. Generate a schedule, review its shifts, and publish it.
5. Open the Reports page and verify the employee workload.
6. Sign in as the employee.
7. Open the personal schedule and verify the published shifts.
8. Open the personal report and verify the total shifts and total hours.

### Recreate the database from scratch

The schema and seed scripts are executed automatically only when PostgreSQL starts with an empty data volume. To remove the existing local database and recreate it:

```bash
docker compose down -v
docker compose up --build -d
```

The `-v` option deletes the local PostgreSQL volume and all data stored in it. After the second command, the database is initialized again from `backend/db/schema.sql` and `backend/db/seed.sql`.

### Backend verification

For a local Python verification outside the backend container, run the following commands from the repository root. The backend tests require a running PostgreSQL instance and a `DATABASE_URL` that points to it:

```bash
cd backend
python -m compileall app
python -m pytest
```

### Frontend verification

To verify that the frontend can be built independently:

```bash
cd frontend
npm ci
npm run build
npm run lint
```

The expected result is a successful production build and no ESLint errors.

### Collecting evidence of reproducibility

For a reproducibility report, record the following information:

- Git commit or tag used for the run: `git rev-parse HEAD`
- Docker and Docker Compose versions: `docker version` and `docker compose version`
- Output of `docker compose ps`
- Responses from `/api/health` and `/api/health/db`
- Result of the manager and employee verification scenario
- Results of `python -m pytest`, `npm run build`, and `npm run lint`

## 🌐 Live Demo

ShiftPlanner is publicly available and can be accessed using the links below.

| Service | Link |
|---------|------|
| 🌍 **Web Application** | https://shiftplanner.online |
| 📱 **Mobile Application** | In progress |

You can explore the application directly in your browser without setting up a local development environment.

## Team

| Name | Role | GitHub Account Link|
|------|------|------|
| Karina Krotova | Team Lead / Product Manager / Database |https://github.com/karmihkr|
| Ksenia Minaeva | Fullstack |https://github.com/ks0Vibe|
| Albina Fadeeva | Scheduling Algorithm | https://github.com/Albiiina |
| Fidan Akhmedova | Frontend | https://github.com/fifidadan | 
| Victoriya Gorbacheva | Mobile Development | https://github.com/froggyriia |

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
