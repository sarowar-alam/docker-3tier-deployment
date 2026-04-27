# VitalTrack Docker Deployment Guide

**Application:** VitalTrack — BMI & Health Metrics Tracker  
**Stack:** React + Vite · Node.js + Express · PostgreSQL  
**Deployment:** Docker (no Compose) · Ubuntu 24.04 · AWS EC2

---

## Table of Contents

1. [Environment Overview](#1-environment-overview)
2. [Analyzing Backend for Containerization](#2-analyzing-backend-for-containerization)
3. [Creating Dockerfile for Backend](#3-creating-dockerfile-for-backend)
4. [Analyzing Frontend for Containerization](#4-analyzing-frontend-for-containerization)
5. [Creating Dockerfile for Frontend](#5-creating-dockerfile-for-frontend)
6. [Creating Database Container](#6-creating-database-container)
7. [Building Images](#7-building-images)
8. [Running Containers Locally](#8-running-containers-locally)
9. [Testing Containers](#9-testing-containers)
10. [AWS EC2 Deployment](#10-aws-ec2-deployment)
11. [EC2 Security Group Configuration](#11-ec2-security-group-configuration)
12. [Accessing the Application via Public IP](#12-accessing-the-application-via-public-ip)
13. [Final Verification Checklist](#13-final-verification-checklist)

---

## 1. Environment Overview

### Deployment Targets

| Environment | OS | Purpose |
|---|---|---|
| **Local** | Ubuntu 24.04 LTS | Development and smoke-testing |
| **Production** | AWS EC2 Ubuntu 24.04 LTS | Live deployment, public access |

### Deployment Strategy

Docker only — no Docker Compose. Each tier is an independent container connected through a custom Docker bridge network (`vitaltrack-net`). A single public port (`80`) is exposed through the Nginx-fronted frontend container. All internal communication stays within the Docker network.

### Three-Tier Architecture

```
Internet
    │
    │  Port 80 (public)
    ▼
┌───────────────────────────────┐
│  FRONTEND  (Nginx + React)    │   nginx:1.27-alpine
│  /              → dist/       │   Serves static React build
│  /api/*         → proxy       │
└───────────────┬───────────────┘
                │  http://backend:3000  (internal Docker DNS)
                │  Port 3000 (private, Docker network only)
                ▼
┌───────────────────────────────┐
│  BACKEND  (Node.js + Express) │   node:20-alpine
│  POST /api/measurements       │   BMI/BMR business logic
│  GET  /api/measurements       │   REST API
│  GET  /api/measurements/trends│
│  GET  /health                 │
└───────────────┬───────────────┘
                │  postgresql://db:5432  (internal Docker DNS)
                │  Port 5432 (private, Docker network only)
                ▼
┌───────────────────────────────┐
│  DATABASE  (PostgreSQL 14)    │   postgres:14-alpine
│  bmidb · bmi_user             │   measurements table
│  Volume: vitaltrack-pgdata    │   persistent storage
└───────────────────────────────┘
```

---

## 2. Analyzing Backend for Containerization

### Directory Structure

```
backend/
├── src/
│   ├── server.js       ← entry point
│   ├── routes.js       ← API endpoint handlers
│   ├── db.js           ← PostgreSQL connection pool
│   └── calculations.js ← BMI / BMR logic
├── migrations/
│   ├── 001_create_measurements.sql
│   └── 002_add_measurement_date.sql
├── package.json
└── ecosystem.config.js  (PM2 config — NOT used in container)
```

### Startup Command Detection

`package.json` defines:
```json
"scripts": {
  "start": "node src/server.js",
  "dev":   "nodemon src/server.js"
}
```
**Container command:** `node src/server.js` — the `start` script, executed directly without npm for proper signal forwarding.

### Dependency Analysis

| Package | Role | Production? |
|---|---|---|
| `express` | HTTP server framework | Yes |
| `pg` | PostgreSQL driver | Yes |
| `cors` | Cross-origin headers | Yes |
| `body-parser` | JSON body parsing | Yes |
| `dotenv` | Env var loading | Yes |
| `nodemon` | Dev auto-restart | **No** (`devDependencies`) |

`npm ci --omit=dev` excludes nodemon from the container image.

### Production Environment Variables

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://bmi_user:bmi_pass@db:5432/bmidb` |
| `NODE_ENV` | Runtime mode (controls CORS) | `production` |
| `FRONTEND_URL` | CORS allowed origin | `http://<EC2_PUBLIC_IP>` |
| `PORT` | Server port (default: 3000) | `3000` |

---

## 3. Creating Dockerfile for Backend

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache dumb-init
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=appuser:appgroup package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=appuser:appgroup src/ src/
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
```

### Key Decisions

**`node:20-alpine`** — Alpine Linux base is ~50MB vs ~200MB for the Debian-based image. Contains only the minimum OS packages required to run Node.

**`dumb-init`** — Node.js is not designed to run as PID 1. Without a proper init process, `SIGTERM` from `docker stop` is not forwarded correctly, preventing graceful shutdown. `dumb-init` acts as a lightweight init that correctly propagates signals.

**Non-root user** — Running as `appuser` reduces the blast radius of any container escape. If the process is compromised, the attacker has no root privileges.

**Layer caching** — `COPY package.json` then `RUN npm ci` is committed as a separate layer. Docker only re-runs `npm ci` when `package.json` changes, not on every source code edit. This cuts rebuild time significantly.

**`--omit=dev`** — Strips devDependencies (nodemon, etc.) from the production image, reducing attack surface and image size.

**`COPY src/ src/`** — Only the source directory is copied; `ecosystem.config.js` (PM2 config for bare-metal) and migration files are excluded via `.dockerignore`. Migrations are handled by the database container.

---

## 4. Analyzing Frontend for Containerization

### Build Output Detection

Vite's default output directory is `dist/`. Confirmed by `vite.config.js` (no custom `build.outDir`):

```js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000' } }
  }
  // no build.outDir → defaults to dist/
});
```

`npm run build` → `vite build` → output at `frontend/dist/`.

### Why Not Serve with Vite Dev Server?

The Vite dev server (`vite preview`) is for local development only — it is single-threaded, has no production-grade request handling, and exposes source maps and HMR endpoints. **Nginx** is used instead:

- Handles static files with zero-copy `sendfile()`
- Supports reverse proxying to the backend container
- Provides gzip compression, cache headers, and security headers
- Industry standard for serving SPAs in production

### API Proxy Strategy

In development, Vite proxied `/api` to `localhost:3000`. In production there is no Vite dev server. Nginx takes over this responsibility:

```nginx
location /api/ {
    proxy_pass http://backend:3000;
}
```

`backend` is the container name. Docker's embedded DNS resolves it to the backend container's internal IP on `vitaltrack-net`. This means the browser always calls the frontend on port 80 — it never contacts the backend directly.

---

## 5. Creating Dockerfile for Frontend

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

### Multi-Stage Build Explained

| Stage | Base Image | What Happens | Kept in Final Image? |
|---|---|---|---|
| `builder` | `node:20-alpine` | Installs all deps, runs `vite build`, outputs `dist/` | **No** — discarded |
| (final) | `nginx:1.27-alpine` | Copies only `dist/` and `nginx.conf` | **Yes** |

The final image contains zero Node.js, zero npm, zero source code. It is ~25MB and contains only Nginx and the compiled static files. This is the correct production approach — the build toolchain never ships to production.

**`npm ci`** — Used instead of `npm install` in the build stage. `npm ci` installs exactly the versions locked in `package-lock.json`, producing a deterministic build. `npm install` may silently update minor versions.

---

## 6. Creating Database Container

```dockerfile
FROM postgres:14-alpine
ENV POSTGRES_USER=bmi_user
ENV POSTGRES_DB=bmidb
# POSTGRES_PASSWORD is intentionally NOT baked in — pass at runtime:
#   -e POSTGRES_PASSWORD=<your_password>
COPY backend/migrations/001_create_measurements.sql /docker-entrypoint-initdb.d/
COPY backend/migrations/002_add_measurement_date.sql /docker-entrypoint-initdb.d/
EXPOSE 5432
```

### How Postgres Auto-Migration Works

The official `postgres` image executes all files placed in `/docker-entrypoint-initdb.d/` **alphabetically** on the very first startup (when the data directory is empty). On subsequent starts the directory is ignored — the data already exists in the volume.

Migration execution order:
1. `001_create_measurements.sql` — creates the `measurements` table and indexes
2. `002_add_measurement_date.sql` — idempotent column addition (`IF NOT EXISTS`)

### Why the Build Context is `app/`

```bash
docker build -t vitaltrack-db -f app/database/Dockerfile app/
#                                                          ^^^
#                                                      build context
```

The `COPY` instruction in the Dockerfile resolves paths relative to the build context, not the Dockerfile location. By setting the context to `app/`, the Dockerfile can reach `backend/migrations/` which sits outside the `database/` folder.

### Persistent Storage

The database container uses a named Docker volume:

```bash
-v vitaltrack-pgdata:/var/lib/postgresql/data
```

Named volumes survive `docker stop`, `docker rm`, and host reboots. Data is only lost if the volume itself is explicitly deleted with `docker volume rm vitaltrack-pgdata`.

### Why Port 5432 Is Not Exposed Publicly

PostgreSQL should never be reachable from the internet. The backend container resolves `db:5432` via Docker's internal DNS within `vitaltrack-net`. No `-p 5432:5432` flag is used — the port is not mapped to the host, making it unreachable from outside the Docker network regardless of firewall rules.

---

## 7. Building Images

Run all build commands from the **repository root** (the directory containing `app/`).

```bash
# Create the isolated Docker network first
# All three containers will communicate through this network
docker network create vitaltrack-net

# Build database image
# Build context is app/ so the Dockerfile can COPY backend/migrations/
docker build -t vitaltrack-db -f app/database/Dockerfile app/

# Build backend image
# Build context is app/backend/ (contains package.json and src/)
docker build -t vitaltrack-backend app/backend

# Build frontend image (multi-stage — takes longer on first run)
# Build context is app/frontend/ (contains package.json, src/, nginx.conf)
docker build -t vitaltrack-frontend app/frontend
```

### Why a Custom Docker Network Is Required

When containers are started with `--network vitaltrack-net`, Docker's embedded DNS server allows each container to resolve other containers by name:

- `backend` resolves to the backend container's internal IP
- `db` resolves to the database container's internal IP

Without a custom network, containers on the default bridge network cannot resolve each other by name — only by IP address, which changes on every restart. A custom network also provides network-level isolation: containers outside `vitaltrack-net` cannot reach the backend or database.

### Verify Images Were Built

```bash
docker images | grep vitaltrack
```

Expected output:
```
vitaltrack-frontend   latest   xxxxxxxxxxxx   ...   ~25MB
vitaltrack-backend    latest   xxxxxxxxxxxx   ...   ~85MB
vitaltrack-db         latest   xxxxxxxxxxxx   ...   ~50MB
```

---

## 8. Running Containers Locally

Start containers in order: **database → backend → frontend**. The backend will exit-fail if PostgreSQL is not ready when it starts.

```bash
# ── 1. Database ───────────────────────────────────────────────
# No -p flag: port 5432 is internal only
# POSTGRES_PASSWORD passed at runtime — not baked into the image
docker run -d \
  --name db \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e POSTGRES_PASSWORD=<your_password> \
  -v vitaltrack-pgdata:/var/lib/postgresql/data \
  vitaltrack-db

# Wait until PostgreSQL is actually accepting connections.
# pg_isready is deterministic — safer than a fixed sleep.
echo "Waiting for PostgreSQL to be ready..."
until docker exec db pg_isready -U bmi_user -d bmidb -q; do
  sleep 2
done
echo "PostgreSQL is ready."

# ── 2. Backend ────────────────────────────────────────────────
# No -p flag: port 3000 is internal only
# DATABASE_URL password must match POSTGRES_PASSWORD above
# DATABASE_URL host must be "db" (container name) — NOT localhost
docker run -d \
  --name backend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e DATABASE_URL="postgresql://bmi_user:<your_password>@db:5432/bmidb" \
  -e NODE_ENV=production \
  -e FRONTEND_URL="http://localhost" \
  vitaltrack-backend

# ── 3. Frontend ───────────────────────────────────────────────
# -p 80:80 is the ONLY public port in the entire stack
docker run -d \
  --name frontend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -p 80:80 \
  vitaltrack-frontend
```

Access locally at: **http://localhost**

### What Stays Private

| Container | Port | Exposed to Host? | Exposed to Internet? |
|---|---|---|---|
| `db` | 5432 | No | No |
| `backend` | 3000 | No | No |
| `frontend` | 80 | Yes (`-p 80:80`) | Yes (via EC2 Security Group) |

---

## 9. Testing Containers

### Check All Containers Are Running

```bash
docker ps
```

All three containers should show `STATUS: Up`:
```
CONTAINER ID   IMAGE                 STATUS         PORTS
xxxxxxxxxxxx   vitaltrack-frontend   Up X seconds   0.0.0.0:80->80/tcp
xxxxxxxxxxxx   vitaltrack-backend    Up X seconds
xxxxxxxxxxxx   vitaltrack-db         Up X seconds
```

### Check Logs

```bash
# Database initialisation (look for "database system is ready to accept connections")
docker logs db

# Backend startup (look for "✅ Database connected successfully")
docker logs backend

# Nginx access log (check for request traffic)
docker logs frontend
```

### API Verification

```bash
# Health check — should return {"status":"ok","environment":"production"}
curl http://localhost/health

# Fetch all measurements — should return {"rows":[]} on fresh install
curl http://localhost/api/measurements

# Submit a test measurement
curl -X POST http://localhost/api/measurements \
  -H "Content-Type: application/json" \
  -d '{"weightKg":75,"heightCm":175,"age":30,"sex":"male","activity":"moderate"}'
```

### Database Verification

```bash
# Connect to PostgreSQL inside the container
docker exec -it db psql -U bmi_user -d bmidb

# Inside psql:
\dt                          -- list tables (should show: measurements)
SELECT COUNT(*) FROM measurements;
\q
```

### Browser Test

Open **http://localhost** — the VitalTrack dashboard should load and the form should submit measurements successfully.

---

## 10. AWS EC2 Deployment

### Step 1 — Launch EC2 Instance

- **AMI:** Ubuntu Server 24.04 LTS (64-bit x86)
- **Instance type:** t3.small or larger (2 vCPU / 2GB RAM minimum)
- **Storage:** 20GB gp3
- **Key pair:** Download `.pem` file for SSH access
- **Assign Elastic IP** — prevents the public IP from changing on stop/start

### Step 2 — Install Docker on EC2

```bash
# SSH into the instance
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker apt repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Start Docker and add ubuntu user to docker group
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
newgrp docker

# Verify
docker --version
```

### Step 3 — Upload Project Code

**Option A — Git (recommended)**
```bash
sudo apt-get install -y git
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

**Option B — SCP from local machine**
```bash
# Run from your local machine
scp -i your-key.pem -r ./app ubuntu@<EC2_PUBLIC_IP>:~/vitaltrack/
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd ~/vitaltrack
```

### Step 4 — Build and Run on EC2

```bash
# Network
docker network create vitaltrack-net

# Build all images
docker build -t vitaltrack-db      -f app/database/Dockerfile app/
docker build -t vitaltrack-backend  app/backend
docker build -t vitaltrack-frontend app/frontend

# Database (internal only)
# POSTGRES_PASSWORD passed at runtime — not baked into the image
docker run -d \
  --name db \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e POSTGRES_PASSWORD=<your_password> \
  -v vitaltrack-pgdata:/var/lib/postgresql/data \
  vitaltrack-db

# Wait until PostgreSQL is actually accepting connections.
# pg_isready is deterministic — safe on cold EC2 starts with empty volumes.
echo "Waiting for PostgreSQL to be ready..."
until docker exec db pg_isready -U bmi_user -d bmidb -q; do
  sleep 2
done
echo "PostgreSQL is ready."

# Backend (internal only, FRONTEND_URL set to EC2 public IP)
# DATABASE_URL password must match POSTGRES_PASSWORD exactly
# DATABASE_URL host must be "db" (container name) — NOT localhost
docker run -d \
  --name backend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -e DATABASE_URL="postgresql://bmi_user:<your_password>@db:5432/bmidb" \
  -e NODE_ENV=production \
  -e FRONTEND_URL="http://<EC2_PUBLIC_IP>" \
  vitaltrack-backend

# Frontend (only public port)
docker run -d \
  --name frontend \
  --network vitaltrack-net \
  --restart=unless-stopped \
  -p 80:80 \
  vitaltrack-frontend
```

Replace `<EC2_PUBLIC_IP>` with your actual Elastic IP address (e.g. `54.123.45.67`).

---

## 11. EC2 Security Group Configuration

Configure inbound rules in the AWS Console under **EC2 → Security Groups → Inbound rules**.

| Port | Protocol | Source | Purpose | Required? |
|---|---|---|---|---|
| 22 | TCP | Your IP only | SSH access | Yes |
| 80 | TCP | 0.0.0.0/0, ::/0 | Public web traffic | Yes |
| 3000 | — | — | Backend API | **Keep closed** |
| 5432 | — | — | PostgreSQL | **Keep closed** |

### Why Backend and Database Ports Must Stay Closed

**Port 3000 (Backend):** The Express API has no authentication layer — anyone who can reach it can read and write all health measurements. Nginx handles all external traffic and proxies `/api/` to the backend through the internal Docker network.

**Port 5432 (Database):** Direct PostgreSQL access bypasses all application-level validation. Exposing the database port to the internet is a critical security risk. The backend connects to it via `db:5432` on the internal Docker network — this path never touches the host network or the internet.

The network topology enforces these restrictions at the infrastructure level: only the frontend container maps a host port (`-p 80:80`). The backend and database containers have no host port mapping at all.

---

## 12. Accessing the Application via Public IP

Once all containers are running and the EC2 Security Group allows port 80:

```
http://<EC2_PUBLIC_IP>
```

**Traffic flow:**

```
Browser
  │  http://<EC2_PUBLIC_IP>/
  ▼
EC2 host:80
  │  mapped to frontend container port 80
  ▼
Nginx (frontend container)
  │  static files → serves React app directly
  │
  │  /api/* requests
  ▼
Express backend (backend container, port 3000, internal)
  │  SQL queries
  ▼
PostgreSQL (db container, port 5432, internal)
```

The browser only ever communicates with port 80. From the browser's perspective, the frontend and API are the same server. Nginx transparently routes API calls to the backend through the Docker network.

**Important:** Use an AWS **Elastic IP** attached to your EC2 instance. Without it, the public IP changes every time the instance is stopped and restarted, which would invalidate the `FRONTEND_URL` CORS setting in the backend container.

---

## 13. Final Verification Checklist

```bash
# 1. All three containers running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Backend connected to database
docker logs backend | grep "Database connected"

# 3. Frontend Nginx started successfully
docker logs frontend | grep "nginx"

# 4. Health endpoint responds
curl -s http://<EC2_PUBLIC_IP>/health | python3 -m json.tool

# 5. API returns data
curl -s http://<EC2_PUBLIC_IP>/api/measurements | python3 -m json.tool

# 6. Nginx proxy routes correctly (should NOT return 502)
curl -I http://<EC2_PUBLIC_IP>/api/measurements

# 7. Database has the measurements table
docker exec db psql -U bmi_user -d bmidb -c "\dt"

# 8. Browser test
# Open http://<EC2_PUBLIC_IP> — dashboard loads, form submits, chart renders
```

### Expected Healthy State

| Check | Expected Result |
|---|---|
| `docker ps` | 3 containers, all `Up` |
| `docker logs backend` | `✅ Database connected successfully` |
| `GET /health` | `{"status":"ok","environment":"production"}` |
| `GET /api/measurements` | `[]` or array of records |
| Browser dashboard | Renders, form submits without errors |
| `docker exec db psql ... \dt` | Shows `measurements` table |

---

## File Reference

```
app/
├── backend/
│   ├── Dockerfile          ← node:20-alpine, non-root, dumb-init
│   ├── .dockerignore       ← excludes node_modules, .env, ecosystem.config.js
│   ├── src/                ← application source
│   ├── migrations/         ← SQL used by database container
│   └── package.json
├── frontend/
│   ├── Dockerfile          ← multi-stage: node:20-alpine → nginx:1.27-alpine
│   ├── .dockerignore       ← excludes node_modules, dist, .env
│   ├── nginx.conf          ← SPA routing + /api/ proxy to backend container
│   ├── src/
│   └── package.json
├── database/
│   └── Dockerfile          ← postgres:14-alpine, migrations auto-loaded
└── README.md               ← this file
```

---

## Project Lead

**MD Sarowar Alam**  
Lead DevOps Engineer, WPP Production  
📧 Email: [sarowar@hotmail.com](mailto:sarowar@hotmail.com)  
🔗 LinkedIn: https://www.linkedin.com/in/sarowar/

---
