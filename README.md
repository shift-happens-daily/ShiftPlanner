<p align="center">
  <a href="https://shiftplanner.online">
    <img src="./pic/wide_logo.jpg" alt="ShiftPlanner Logo">
  </a>
</p>

<a id="readme-top"></a>

<p align="center">
  <strong>Shift happens. Schedules don't.</strong><br>
</p>

<p align="center">
  <a href="https://shiftplanner.online/api/docs">
    <img src="https://img.shields.io/badge/API-Swagger-85EA2D?style=for-the-badge&logo=swagger" alt="API Docs">
  </a>
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="MIT License">
  </a>
  <a href="https://github.com/shift-happens-daily/ShiftPlanner">
    <img src="https://img.shields.io/badge/%E2%AD%90-Star%20on%20GitHub-black?style=for-the-badge&logo=github" alt="Star on GitHub">
  </a>
</p>


<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about">About The Project</a>
      <ul>
        <li><a href="#track">Track</a></li>
        <li><a href="#tech-stack">Tech Stack</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#goals">Goals</a></li>
      </ul>
    </li>
    <li><a href="#how-to-run">How to Run</a></li>
    <li>
      <a href="#development">Development</a>
      <ul>
        <li><a href="#project-structure">Project Structure</a></li>
        <li><a href="#kanban-board">Kanban Board</a></li>
        <li><a href="#git-workflow">Git workflow</a></li>
      </ul>
    </li>
    <li><a href="#live-demo">Live Demo</a></li>
    <li><a href="#team">Team</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

<a id="about"></a>
## 🚀 About The Project

ShiftPlanner is a workforce scheduling platform designed to simplify employee shift management for businesses such as cafés, restaurants, retail stores, and other service companies.

Instead of manually assigning shifts every week, managers can define staffing requirements, employee availability, and workplace structure. The system then generates a schedule automatically while employees access their shifts through the web and mobile applications.

The project was developed as a university software engineering project following an MVP-first approach.

<a id="track"></a>

### 💡 Startup Track
ShiftPlanner was developed within the **Startup Track** because it focuses on solving a real business problem and validating the product with potential users.

The team followed an MVP-first approach, gathered feedback from service businesses, and prepared the platform for pilot testing, demonstrating clear business value and growth potential.

<a id="tech-stack"></a>

### 🛠️ Tech Stack

- [![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
- [![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
- [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
- [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
- [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
- [![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org/)
- [![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white)](https://kotlinlang.org/)
- [![Jetpack Compose](https://img.shields.io/badge/Jetpack%20Compose-4285F4?style=for-the-badge&logo=jetpackcompose&logoColor=white)](https://developer.android.com/jetpack/compose)
- [![Swift](https://img.shields.io/badge/Swift-FA7343?style=for-the-badge&logo=swift&logoColor=white)](https://www.swift.org/)

<a id="features"></a>

### ✨ Features
#### 👨‍💼 Manager

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

#### 👷 Employee

- Join company via invite code
- Select branch and position
- Set availability
- Request preferred days off
- View assigned shifts
- Access personal reports

#### 🔐 Authentication

- JWT authentication
- Role-based authorization
- Secure password hashing

<a id="goals"></a>

### 🎯 Goals

ShiftPlanner aims to simplify workforce scheduling for service businesses by reducing the time managers spend creating schedules and improving communication between managers and employees.

ShiftPlanner helps businesses:
- automate employee shift scheduling;
- minimize manual planning and scheduling conflicts;
- provide employees with transparent access to schedules and availability management;
- support businesses with multiple branches and positions;
- validate the product with real users and continuously improve it based on their feedback.

<a id="how-to-run"></a>

## ⚡ How to Run

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

<a id="development"></a>

## 🛠️ Development
<a id="project-structure"></a>

### 📁 Project Structure
<details>
<summary>Show project structure</summary>

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
</details>

### [Kanban board](https://github.com/orgs/shift-happens-daily/projects/1)
- **Backlog** - tasks not yet taken into work.
- **Ready** - tasks clearly defined and ready for development.
- **In Progress** - tasks currently being worked on.
- **Code Review** - Pull Request has been submitted and awaiting review.
- **Testing** - need to check manually or test.
- **Done** - completed and tested tasks.
  
<a id="git-workflow"></a>

### 🌿 Git Workflow

#### Branches

- `main` – production-ready branch containing stable releases.
- `dev` – main development branch where completed features are merged.
- `feature/*` – used for developing new features.

#### Rules

- **Issues:** every new feature or bug is tracked as a GitHub Issue.
- **Labelling:** issues are categorized using labels such as `feature`, `bug`, and `enhancement`.
- **Assigning:** each issue is assigned to a responsible team member.
- **Branches:** created from `dev` with descriptive names (e.g., `feature/mobile-auth`, `fix/schedule-ui`).
- **Commit messages:** written in the imperative mood (e.g., `Add employee availability validation`).
- **Pull Requests:** created for all completed tasks and linked to the corresponding issue.
- **Code Reviews:** every pull request is reviewed by at least one teammate before merging.
- **Merging:** pull requests are merged into `dev`; stable releases are later merged into `main`.
- **Closing Issues:** issues are closed after the related pull request has been merged.

<a id="live-demo"></a>

## 🌐 Live Demo

ShiftPlanner is publicly available and can be accessed using the links below.

| Service | Link |
|---------|------|
| 🌍 **Web Application** | https://shiftplanner.online |
| 📱 **Mobile Application** | In progress |

You can explore the application directly in your browser without setting up a local development environment.

<a id="team"></a>

## 👥 Team

| Member  | Role |
|------|------|
| [Karina Krotova](https://github.com/karmihkr) | Team Lead / Product Manager / Database|
| [Ksenia Minaeva](https://github.com/ks0Vibe) | Fullstack |
| [Albina Fadeeva](https://github.com/Albiiina) | Scheduling Algorithm |
| [Fidan Akhmedova](https://github.com/fifidadan) | Frontend | 
| [Victoriya Gorbacheva](https://github.com/froggyriia) | Mobile Development |

<a id="license"></a>

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
<p align="right">(<a href="#readme-top">back to top</a>)</p>

