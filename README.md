# VitalTrack — BMI & Health Metrics Tracker

A production-ready, containerized three-tier web application for tracking BMI, BMR, and daily calorie needs with interactive trend visualization. Deployed on AWS EC2 using Docker without Docker Compose.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Application Workflow](#5-application-workflow)
6. [API Reference](#6-api-reference)
7. [Database Schema](#7-database-schema)
8. [Environment Variables](#8-environment-variables)
9. [Prerequisites](#9-prerequisites)
10. [Local Development Setup](#10-local-development-setup)
11. [Docker Build & Run](#11-docker-build--run)
12. [Testing](#12-testing)
13. [Production Deployment on AWS EC2](#13-production-deployment-on-aws-ec2)
14. [Security Best Practices Applied](#14-security-best-practices-applied)
15. [Monitoring & Logging](#15-monitoring--logging)
16. [Troubleshooting](#16-troubleshooting)
17. [Future Improvements](#17-future-improvements)
18. [Contributing](#18-contributing)
19. [License](#19-license)

---

## 1. Project Overview

VitalTrack is a full-stack health metrics dashboard that lets users log body measurements and receive instant calculations of:

- **BMI** (Body Mass Index) with category classification
- **BMR** (Basal Metabolic Rate) using the Mifflin-St Jeor equation
- **Daily Calorie Target** adjusted for activity level
- **30-day BMI trend chart** with Chart.js visualization

The application is architected as three independent tiers, each running in its own Docker container on a private Docker bridge network. Only port 80 (Nginx) is publicly exposed.

---

## 2. Architecture Overview

```
Internet
    │
    │  Port 80 (public — EC2 Security Group allows 0.0.0.0/0)
    ▼
┌───────────────────────────────────────┐
│  TIER 1 — FRONTEND                    │
│  nginx:1.27-alpine                    │
│  Serves compiled React SPA (dist/)    │
│  Reverse-proxies /api/* → backend     │
│  Container: frontend                  │
└───────────────┬───────────────────────┘
                │  http://backend:3000 (Docker internal DNS)
                │  Port 3000 — private, not mapped to host
                ▼
┌───────────────────────────────────────┐
│  TIER 2 — BACKEND / API               │
│  node:20-alpine + Express             │
│  REST API — BMI/BMR calculations      │
│  PostgreSQL connection pool (pg)      │
│  Container: backend                   │
└───────────────┬───────────────────────┘
                │  postgresql://db:5432 (Docker internal DNS)
                │  Port 5432 — private, not mapped to host
                ▼
┌───────────────────────────────────────┐
│  TIER 3 — DATABASE                    │
│  postgres:14-alpine                   │
│  Auto-migration on first start        │
│  Named volume: vitaltrack-pgdata      │
│  Container: db                        │
└───────────────────────────────────────┘

Docker Network: vitaltrack-net (bridge)
```

### Why No Docker Compose?

This project deliberately uses raw `docker run` commands to demonstrate low-level container lifecycle management, explicit dependency ordering with `pg_isready` health polling, and a clear understanding of every flag passed to each container.

### Port Exposure Summary

| Container  | Internal Port | Host Mapping | Internet Accessible |
|------------|---------------|--------------|---------------------|
| `frontend` | 80            | `-p 80:80`   | Yes (port 80)       |
| `backend`  | 3000          | None         | No                  |
| `db`       | 5432          | None         | No                  |

---

## 3. Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 18.2 | UI framework |
| Vite | 5.0 | Build tool & dev server |
| Axios | 1.4 | HTTP client |
| Chart.js | 4.4 | Trend chart rendering |
| react-chartjs-2 | 5.2 | Chart.js React wrapper |
| Nginx | 1.27-alpine | Production static file server + reverse proxy |

### Backend

| Technology | Version | Role |
|---|---|---|
| Node.js | 20-alpine | Runtime |
| Express | 4.18 | HTTP framework |
| pg | 8.10 | PostgreSQL driver (connection pool) |
| cors | 2.8 | Cross-origin request handling |
| body-parser | 1.20 | JSON request body parsing |
| dotenv | 16.0 | Environment variable loading |
| dumb-init | latest | PID 1 signal forwarding in container |

### Database

| Technology | Version | Role |
|---|---|---|
| PostgreSQL | 14-alpine | Relational database |

### Infrastructure

| Technology | Role |
|---|---|
| Docker | Container runtime |
| Docker bridge network | Inter-container communication |
| Docker named volume | Persistent PostgreSQL data |
| AWS EC2 (Ubuntu 24.04) | Production host |
| AWS Security Groups | Network-level firewall |

---

## 4. Repository Structure

```
three-tier-web-app-docker-01/
├── .gitignore
├── README.md                        ← this file
├── WhatiZDocker.md                  ← Docker learning notes
│
├── nginx-demo/                      ← standalone Nginx demo
│   ├── Dockerfile
│   └── index.html
│
└── app/                             ← main application
    ├── README.md                    ← Docker deployment guide (detailed)
    │
    ├── backend/
    │   ├── Dockerfile               ← node:20-alpine, non-root, dumb-init
    │   ├── .dockerignore
    │   ├── .env.example             ← template — copy to .env for local dev
    │   ├── ecosystem.config.js      ← PM2 config (bare-metal only, not used in Docker)
    │   ├── package.json
    │   ├── package-lock.json
    │   ├── migrations/
    │   │   ├── 001_create_measurements.sql
    │   │   └── 002_add_measurement_date.sql
    │   └── src/
    │       ├── server.js            ← Express app entry point
    │       ├── routes.js            ← API route handlers
    │       ├── db.js                ← PostgreSQL connection pool
    │       └── calculations.js     ← BMI / BMR / calorie logic
    │
    ├── frontend/
    │   ├── Dockerfile               ← multi-stage: node builder → nginx:1.27-alpine
    │   ├── .dockerignore
    │   ├── nginx.conf               ← SPA routing + /api/ proxy + security headers
    │   ├── vite.config.js
    │   ├── package.json
    │   ├── package-lock.json
    │   ├── index.html
    │   └── src/
    │       ├── main.jsx
    │       ├── App.jsx              ← main dashboard, KPI cards, state management
    │       ├── api.js               ← Axios instance with interceptors
    │       ├── index.css
    │       └── components/
    │           ├── Navbar.jsx
    │           ├── MeasurementForm.jsx
    │           ├── TrendChart.jsx
    │           └── Icons.jsx
    │
    └── database/
        ├── Dockerfile               ← postgres:14-alpine + migrations
        └── setup-database.sh        ← bare-metal PostgreSQL setup script
```

---

## 5. Application Workflow

### User Flow

```
User fills form (weight, height, age, sex, activity level)
    │
    ▼
Browser POST /api/measurements
    │
    ▼
Nginx receives request on port 80
    │  location /api/ → proxy_pass http://backend:3000
    ▼
Express backend (routes.js)
    │  1. Validates input fields
    │  2. Calls calculateMetrics() → BMI, BMI category, BMR, daily calories
    │  3. INSERTs row into measurements table
    │  4. Returns created measurement as JSON
    ▼
React UI updates KPI cards:
    - BMI value + category badge (Underweight / Normal / Overweight / Obese)
    - BMR (kcal/day at rest)
    - Daily calorie target (BMR × activity multiplier)
    │
    ▼
Browser GET /api/measurements/trends
    │  Backend queries 30-day window, returns avg BMI per day
    ▼
Chart.js renders BMI trend line
```

### BMI & BMR Formulas

**BMI:**
$$\text{BMI} = \frac{\text{weight (kg)}}{\text{height (m)}^2}$$

| Range | Category |
|---|---|
| < 18.5 | Underweight |
| 18.5 – 24.9 | Normal |
| 25 – 29.9 | Overweight |
| ≥ 30 | Obese |

**BMR — Mifflin-St Jeor equation:**
- Male: `BMR = 10W + 6.25H − 5A + 5`
- Female: `BMR = 10W + 6.25H − 5A − 161`

*(W = weight kg, H = height cm, A = age years)*

**Daily Calories = BMR × Activity Multiplier**

| Activity Level | Multiplier |
|---|---|
| Sedentary | 1.20 |
| Light | 1.375 |
| Moderate | 1.55 |
| Active | 1.725 |
| Very Active | 1.90 |

---

## 6. API Reference

Base URL (production): `http://<EC2_PUBLIC_IP>/api`  
Base URL (local dev): `http://localhost:3000/api`

### `GET /health`

Health check — does not require the `/api` prefix.

```
GET http://localhost/health
```

Response `200 OK`:
```json
{ "status": "ok", "environment": "production" }
```

---

### `POST /api/measurements`

Create a new measurement and receive calculated metrics.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `weightKg` | number | Yes | Weight in kilograms (> 0, < 1000) |
| `heightCm` | number | Yes | Height in centimetres (> 0, < 300) |
| `age` | integer | Yes | Age in years (> 0, < 150) |
| `sex` | string | Yes | `"male"` or `"female"` |
| `activity` | string | No | `"sedentary"`, `"light"`, `"moderate"`, `"active"`, `"very_active"` |
| `measurementDate` | string | No | ISO date `"YYYY-MM-DD"` — defaults to today |

**Example:**

```bash
curl -X POST http://localhost/api/measurements \
  -H "Content-Type: application/json" \
  -d '{"weightKg":75,"heightCm":175,"age":30,"sex":"male","activity":"moderate"}'
```

Response `201 Created`:
```json
{
  "measurement": {
    "id": 1,
    "weight_kg": "75.00",
    "height_cm": "175.00",
    "age": 30,
    "sex": "male",
    "activity_level": "moderate",
    "bmi": "24.5",
    "bmi_category": "Normal",
    "bmr": 1776,
    "daily_calories": 2753,
    "measurement_date": "2026-04-27",
    "created_at": "2026-04-27T10:00:00.000Z"
  }
}
```

---

### `GET /api/measurements`

Retrieve all measurements, ordered by date descending.

```bash
curl http://localhost/api/measurements
```

Response `200 OK`:
```json
{ "rows": [ { ...measurement }, ... ] }
```

---

### `GET /api/measurements/trends`

Retrieve the 30-day BMI trend (average BMI per day).

```bash
curl http://localhost/api/measurements/trends
```

Response `200 OK`:
```json
{ "rows": [ { "day": "2026-04-27", "avg_bmi": "24.5" }, ... ] }
```

---

## 7. Database Schema

**Table:** `measurements`

| Column | Type | Constraints |
|---|---|---|
| `id` | SERIAL | PRIMARY KEY |
| `weight_kg` | NUMERIC(5,2) | NOT NULL, CHECK > 0 and < 1000 |
| `height_cm` | NUMERIC(5,2) | NOT NULL, CHECK > 0 and < 300 |
| `age` | INTEGER | NOT NULL, CHECK > 0 and < 150 |
| `sex` | VARCHAR(10) | NOT NULL, CHECK IN ('male', 'female') |
| `activity_level` | VARCHAR(30) | CHECK IN ('sedentary', 'light', 'moderate', 'active', 'very_active') |
| `bmi` | NUMERIC(4,1) | NOT NULL |
| `bmi_category` | VARCHAR(30) | |
| `bmr` | INTEGER | |
| `daily_calories` | INTEGER | |
| `measurement_date` | DATE | NOT NULL, DEFAULT CURRENT_DATE |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Indexes:**
- `idx_measurements_measurement_date` on `measurement_date DESC`
- `idx_measurements_created_at` on `created_at DESC`
- `idx_measurements_bmi` on `bmi`

**Migration files** (executed automatically on first container start):

| File | Description |
|---|---|
| `001_create_measurements.sql` | Creates the `measurements` table and indexes |
| `002_add_measurement_date.sql` | Idempotent column addition (`IF NOT EXISTS`) |

---

## 8. Environment Variables

### Backend (`app/backend/.env`)

Copy `app/backend/.env.example` to `app/backend/.env` for local development.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string. Host must be `db` inside Docker, `localhost` for bare-metal. |
| `NODE_ENV` | No | `development` | Set to `production` in containers. Controls CORS policy. |
| `FRONTEND_URL` | No | `http://localhost` | CORS allowed origin in production. Set to `http://<EC2_PUBLIC_IP>`. |
| `PORT` | No | `3000` | HTTP port for the Express server. |

**Example `.env` (local development only — never commit):**

```env
PORT=3000
DATABASE_URL=postgresql://bmi_user:strongpassword@localhost:5432/bmidb
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

> **Important:** The `.env` file is excluded from both `.gitignore` and `.dockerignore`. It is never committed to Git and never copied into the Docker image.

### Database (runtime flags — not in image)

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | **Required at runtime.** Passed via `-e POSTGRES_PASSWORD=<value>`. Not baked into the image to avoid exposure via `docker history`. |
| `POSTGRES_USER` | Pre-set in image: `bmi_user` |
| `POSTGRES_DB` | Pre-set in image: `bmidb` |

> **Password consistency rule:** The password in `POSTGRES_PASSWORD` and the password in `DATABASE_URL` must be identical.

---

## 9. Prerequisites

### For Docker deployment (recommended)

| Requirement | Minimum Version |
|---|---|
| Docker Engine | 24.0+ |
| Operating System | Ubuntu 22.04+ or macOS 13+ or Windows 11 (WSL2) |

### For local development (without Docker)

| Requirement | Minimum Version |
|---|---|
| Node.js | 20 LTS |
| npm | 10+ |
| PostgreSQL | 14+ |

### Install Docker on Ubuntu 24.04

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

---

## 10. Local Development Setup

Run each tier individually without Docker — best for rapid iteration on the frontend or backend.

### Step 1 — Start PostgreSQL

Using the provided setup script (installs and configures PostgreSQL on bare-metal):

```bash
cd app/database
sudo bash setup-database.sh
```

Or, if PostgreSQL is already installed:

```bash
sudo -u postgres psql -c "CREATE USER bmi_user WITH PASSWORD 'strongpassword';"
sudo -u postgres psql -c "CREATE DATABASE bmidb OWNER bmi_user;"
psql -U bmi_user -d bmidb -f app/backend/migrations/001_create_measurements.sql
psql -U bmi_user -d bmidb -f app/backend/migrations/002_add_measurement_date.sql
```

### Step 2 — Start the Backend

```bash
cd app/backend
cp .env.example .env
# Edit .env: set DATABASE_URL, keep NODE_ENV=development
npm install
npm run dev          # nodemon auto-restarts on file changes
```

Backend runs at `http://localhost:3000`.

### Step 3 — Start the Frontend

```bash
cd app/frontend
npm install
npm run dev          # Vite dev server with HMR
```

Frontend runs at `http://localhost:5173`. Vite proxies `/api` requests to `http://localhost:3000` automatically (configured in `vite.config.js`).

---

## 11. Docker Build & Run

All commands are run from the **repository root** (the directory containing `app/`).

### Step 1 — Create the Docker Network

```bash
docker network create vitaltrack-net
```

This creates an isolated bridge network. Docker's embedded DNS server resolves container names (e.g., `backend`, `db`) to internal IPs within this network.

### Step 2 — Build All Images

```bash
# Database — build context must be app/ so COPY can reach backend/migrations/
docker build -t vitaltrack-db -f app/database/Dockerfile app/

# Backend
docker build -t vitaltrack-backend app/backend

# Frontend (multi-stage — Node builder is discarded, final image is ~25MB)
docker build -t vitaltrack-frontend app/frontend
```

Verify:

```bash
docker images | grep vitaltrack
```

### Step 3 — Run the Containers (start order: db → backend → frontend)

```bash
# ── 1. Database ───────────────────────────────────────────────
docker run -d \
  --name db \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e POSTGRES_PASSWORD=<your_password> \
  -v vitaltrack-pgdata:/var/lib/postgresql/data \
  vitaltrack-db

# Wait for PostgreSQL to be ready (deterministic — no fixed sleep)
echo "Waiting for PostgreSQL..."
until docker exec db pg_isready -U bmi_user -d bmidb -q; do sleep 2; done
echo "PostgreSQL is ready."

# ── 2. Backend ────────────────────────────────────────────────
# DATABASE_URL password must match POSTGRES_PASSWORD exactly
# DATABASE_URL host must be "db" (container name) — never "localhost"
docker run -d \
  --name backend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e DATABASE_URL="postgresql://bmi_user:<your_password>@db:5432/bmidb" \
  -e NODE_ENV=production \
  -e FRONTEND_URL="http://localhost" \
  vitaltrack-backend

# ── 3. Frontend ───────────────────────────────────────────────
docker run -d \
  --name frontend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -p 80:80 \
  vitaltrack-frontend
```

Access the app at **http://localhost**

### Stopping and Cleaning Up

```bash
# Stop and remove containers
docker rm -f frontend backend db

# Remove the network
docker network rm vitaltrack-net

# Remove the volume (WARNING: deletes all data permanently)
docker volume rm vitaltrack-pgdata
```

---

## 12. Testing

### Container Health Checks

All three images have built-in `HEALTHCHECK` instructions. Docker monitors them automatically:

```bash
docker ps
# STATUS column should show "(healthy)" for all three containers
```

### API Health Check

```bash
curl -s http://localhost/health
# Expected: {"status":"ok","environment":"production"}
```

### API Smoke Tests

```bash
# Fetch all measurements (empty array on fresh install)
curl -s http://localhost/api/measurements

# Submit a test measurement
curl -s -X POST http://localhost/api/measurements \
  -H "Content-Type: application/json" \
  -d '{"weightKg":75,"heightCm":175,"age":30,"sex":"male","activity":"moderate"}' \
  | python3 -m json.tool

# Fetch 30-day BMI trends
curl -s http://localhost/api/measurements/trends
```

### Database Verification

```bash
# Connect to psql inside the container
docker exec -it db psql -U bmi_user -d bmidb

# Inside psql:
\dt                               -- should list: measurements
SELECT COUNT(*) FROM measurements;
SELECT * FROM measurements LIMIT 3;
\q
```

### Log Inspection

```bash
# Database — look for "database system is ready to accept connections"
docker logs db

# Backend — look for "✅ Database connected successfully"
docker logs backend

# Frontend (Nginx access log)
docker logs frontend

# Follow logs in real time
docker logs -f backend
```

---

## 13. Production Deployment on AWS EC2

### Infrastructure Requirements

| Resource | Specification |
|---|---|
| AMI | Ubuntu Server 24.04 LTS (64-bit x86) |
| Instance type | t3.small minimum (2 vCPU, 2 GB RAM) |
| Storage | 20 GB gp3 |
| Elastic IP | Required — prevents IP change on stop/start |
| Security Group | See table below |

### EC2 Security Group — Inbound Rules

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | Your IP only | SSH access |
| 80 | TCP | 0.0.0.0/0, ::/0 | Public web traffic |
| 3000 | — | **Keep closed** | Backend must not be directly reachable |
| 5432 | — | **Keep closed** | Database must not be directly reachable |

### Deployment Steps

```bash
# 1. SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# 2. Install Docker (see Section 9)

# 3. Clone the repository
sudo apt-get install -y git
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# 4. Create Docker network
docker network create vitaltrack-net

# 5. Build images
docker build -t vitaltrack-db      -f app/database/Dockerfile app/
docker build -t vitaltrack-backend  app/backend
docker build -t vitaltrack-frontend app/frontend

# 6. Run containers
docker run -d \
  --name db \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e POSTGRES_PASSWORD=<your_password> \
  -v vitaltrack-pgdata:/var/lib/postgresql/data \
  vitaltrack-db

echo "Waiting for PostgreSQL..."
until docker exec db pg_isready -U bmi_user -d bmidb -q; do sleep 2; done
echo "PostgreSQL is ready."

docker run -d \
  --name backend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e DATABASE_URL="postgresql://bmi_user:<your_password>@db:5432/bmidb" \
  -e NODE_ENV=production \
  -e FRONTEND_URL="http://<EC2_PUBLIC_IP>" \
  vitaltrack-backend

docker run -d \
  --name frontend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -p 80:80 \
  vitaltrack-frontend

# 7. Verify
docker ps
curl http://localhost/health
```

Replace `<EC2_PUBLIC_IP>` with the actual Elastic IP (e.g., `54.123.45.67`).

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild affected images
docker build -t vitaltrack-backend app/backend

# Replace the running container (zero-downtime requires a load balancer;
# this is a simple replacement approach)
docker rm -f backend
docker run -d \
  --name backend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e DATABASE_URL="postgresql://bmi_user:<your_password>@db:5432/bmidb" \
  -e NODE_ENV=production \
  -e FRONTEND_URL="http://<EC2_PUBLIC_IP>" \
  vitaltrack-backend
```

---

## 14. Security Best Practices Applied

| Practice | Where Applied |
|---|---|
| **Non-root container user** | Backend runs as `appuser` (not root). Created via `addgroup`/`adduser` in the Dockerfile. |
| **Minimal base images** | All images use `-alpine` variants (~50–110 MB vs ~200–400 MB for Debian). Smaller attack surface. |
| **No credentials in images** | `POSTGRES_PASSWORD` is never baked into the database image. Verified clean via `docker history vitaltrack-db`. |
| **`.dockerignore`** | Excludes `.env`, `node_modules`, `ecosystem.config.js`, `logs/`, `.git` from all build contexts. |
| **`.gitignore`** | Excludes `.env`, `node_modules`, `dist/`, `build/` from version control. |
| **Production dependencies only** | `npm ci --omit=dev` in the backend image strips nodemon and other dev tools. |
| **Multi-stage frontend build** | The Node.js builder stage (with npm, source files) is discarded. Final image contains only Nginx + `dist/`. |
| **`dumb-init` as PID 1** | Proper UNIX signal forwarding — `SIGTERM` from `docker stop` reaches the Node process and allows graceful shutdown. |
| **Nginx security headers** | `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`. `X-XSS-Protection` intentionally omitted (deprecated and exploitable). |
| **No public database port** | Port 5432 has no `-p` mapping. Unreachable from host or internet. |
| **No public backend port** | Port 3000 has no `-p` mapping. All external API access goes through Nginx. |
| **CORS restricted in production** | `FRONTEND_URL` env var explicitly whitelists only the EC2 public IP. |
| **Health checks on all containers** | `HEALTHCHECK` in all three Dockerfiles. Docker and `--restart` use them for automatic recovery. |
| **Input validation in API** | Backend validates required fields and positive number constraints before any database operation. |
| **Parameterized SQL queries** | `db.query(text, params)` uses `$1, $2, ...` placeholders — fully protected against SQL injection. |

---

## 15. Monitoring & Logging

### Container Logs

Docker captures stdout/stderr from all processes:

```bash
# View logs
docker logs db
docker logs backend
docker logs frontend

# Follow in real time
docker logs -f backend

# Show last 50 lines
docker logs --tail 50 backend
```

**What to look for:**

| Container | Healthy log entry |
|---|---|
| `db` | `database system is ready to accept connections` |
| `backend` | `✅ Database connected successfully` |
| `frontend` | (Nginx access log entries, no error lines) |

### Health Check Status

```bash
docker inspect --format='{{.State.Health.Status}}' db
docker inspect --format='{{.State.Health.Status}}' backend
docker inspect --format='{{.State.Health.Status}}' frontend
# Expected: healthy
```

### Resource Usage

```bash
docker stats --no-stream
```

### No External Monitoring Configured

This deployment does not currently include Prometheus, Grafana, CloudWatch, or any centralized logging stack. See [Future Improvements](#17-future-improvements) for planned additions.

---

## 16. Troubleshooting

### Container exits immediately after start

```bash
docker logs <container-name>
docker inspect <container-name> --format='{{.State.ExitCode}}'
```

Common causes:

| Exit Code | Likely Cause | Fix |
|---|---|---|
| 1 | Backend: `DATABASE_URL` wrong password or host | Ensure password matches `POSTGRES_PASSWORD`, host is `db` not `localhost` |
| 1 | Database: `POSTGRES_PASSWORD` not set | Pass `-e POSTGRES_PASSWORD=<value>` |
| 128 | Port 80 already in use | `sudo lsof -i :80` to find the conflicting process |

---

### `docker build` fails: `path "app/" not found`

You are not in the repository root. The build context path `app/` is relative to your current directory:

```bash
# Wrong
cd app/database && docker build ...

# Correct — must be at repo root
cd /path/to/three-tier-web-app-docker-01
docker build -t vitaltrack-db -f app/database/Dockerfile app/
```

---

### Backend container healthy but returns `502 Bad Gateway` from Nginx

The backend container started after Nginx resolved the `proxy_pass http://backend:3000` hostname. Restart the frontend container:

```bash
docker restart frontend
```

---

### `curl http://localhost/health` returns `connection refused`

Check that the frontend container is running and has port 80 mapped:

```bash
docker ps
# Should show: 0.0.0.0:80->80/tcp for the frontend container
```

If not running, check `docker logs frontend`.

---

### Database migrations not running

Migrations only execute on the **first** start when the volume is empty. If the container was previously run with the same volume, the data directory already exists and migrations are skipped.

To force re-run:

```bash
# WARNING: this deletes all data
docker rm -f db
docker volume rm vitaltrack-pgdata
docker run -d --name db ... vitaltrack-db
```

---

### Wrong password — backend can't connect

The most common mistake is a mismatch between `POSTGRES_PASSWORD` and the password in `DATABASE_URL`. They must be identical. Also verify it is the letter **o** not the digit **0** in any custom password.

```bash
docker logs backend | grep -E "connected|failed"
```

---

### `docker exec db pg_isready` returns `no response`

The database container is still initializing. Re-run the `until pg_isready` loop:

```bash
until docker exec db pg_isready -U bmi_user -d bmidb -q; do
  echo "Waiting..."; sleep 2
done
```

---

## 17. Future Improvements

| Improvement | Notes |
|---|---|
| **GitHub Actions CI/CD** | Automate image builds and EC2 deployment on push to `main`. Add a self-hosted runner on EC2 for zero-egress deployments. |
| **Docker Swarm native secrets** | Replace `-e POSTGRES_PASSWORD=...` (visible in `docker inspect`) with `docker secret create db_password` + `POSTGRES_PASSWORD_FILE`. Requires Swarm mode. |
| **HTTPS / TLS** | Add Let's Encrypt via Certbot or AWS Certificate Manager + ALB. Redirect all HTTP to HTTPS in Nginx. |
| **Reverse proxy / ALB** | Place an Application Load Balancer or a second Nginx in front to enable blue/green deployments without downtime. |
| **Health metrics endpoint** | Expose Prometheus-format `/metrics` from the backend for scraping by a Prometheus + Grafana stack. |
| **Centralized logging** | Ship container logs to CloudWatch Logs, Loki, or ELK stack for persistent, searchable logs. |
| **Database backups** | Schedule `pg_dump` inside a cron container and upload dumps to S3. |
| **Rate limiting** | Add `limit_req_zone` in Nginx config to protect the API from abuse. |
| **User authentication** | JWT-based auth to associate measurements with individual users. |
| **Docker Compose support** | Add `docker-compose.yml` for developer convenience (without removing the raw Docker instructions). |
| **Multi-region / HA** | Migrate to RDS (managed PostgreSQL) and use multiple EC2 instances behind an ALB for high availability. |

---

## 18. Contributing

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes. Follow the existing code style.

3. Test your changes locally using the Docker build and run instructions in [Section 11](#11-docker-build--run).

4. Ensure no `.env` files, `node_modules/`, or `dist/` directories are committed:
   ```bash
   git status   # review staged files before committing
   ```

5. Open a Pull Request against `main` with a clear description of the change.

### Code Style

- **Backend:** vanilla Node.js, no linter configured. Keep route handlers concise; put business logic in `calculations.js`.
- **Frontend:** functional React components with hooks. No Redux — component-level state via `useState`/`useEffect`.
- **SQL:** always use `IF NOT EXISTS` in migrations to keep them idempotent.

---

## 19. License

This project is for educational purposes as part of a DevOps / full-stack development course. No license is currently specified.

---

*For detailed Docker deployment instructions, image architecture decisions, and EC2-specific steps, see [app/README.md](app/README.md).*

---

## Project Lead

**MD Sarowar Alam**  
Lead DevOps Engineer, WPP Production  
📧 Email: [sarowar@hotmail.com](mailto:sarowar@hotmail.com)  
🔗 LinkedIn: https://www.linkedin.com/in/sarowar/

---

## AI Assistant

**Claude Sonnet 4.6** by [Anthropic](https://www.anthropic.com/)  
Used for architecture design, Dockerfile authoring, deployment documentation, and troubleshooting guidance throughout this project.

---
