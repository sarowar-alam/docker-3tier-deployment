# Docker 3-Tier Deployment

> Docker and containerization learning documentation with a working Nginx demo.
> Part of the Ostad Batch-08 DevOps curriculum.

[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat&logo=nginx&logoColor=white)](https://nginx.org/)

---

## Overview

This repository contains:

- **[WhatiZDocker.md](./WhatiZDocker.md)** — Comprehensive Docker and containerization reference covering core concepts, architecture, commands, and Dockerfile fundamentals.
- **[nginx-demo/](./nginx-demo/)** — A practical working demo: a custom Nginx container serving a professional HTML documentation page.

---

## Repository Structure

```
docker-3tier-deployment/
├── nginx-demo/
│   ├── Dockerfile        # 4-line Nginx image definition
│   └── index.html        # Professional HTML page served by Nginx
├── WhatiZDocker.md       # Full Docker documentation (7 sections)
└── README.md
```

---

## Documentation — WhatiZDocker.md

The documentation covers:

| Section | Topic |
|---|---|
| 1 | Introduction to Containerization |
| 2 | What is Docker & Docker Architecture |
| 3 | Docker vs Virtual Machines |
| 4 | Docker Images vs Containers |
| 5 | Docker Commands Reference |
| 6 | Dockerfile Basics |
| 7 | Practical Demo — Custom Nginx HTML Page |

---

## Quick Start — Nginx Demo

The `nginx-demo` folder contains a ready-to-run Docker example. It builds a custom Nginx image that serves a professional HTML documentation page instead of the default "Welcome to nginx!" page.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Build and Run

```bash
# 1. Clone the repository
git clone https://github.com/sarowar-alam/docker-3tier-deployment.git
cd docker-3tier-deployment/nginx-demo

# 2. Build the Docker image
docker build -t custom-nginx-page .

# 3. Run the container
docker run -d -p 8080:80 --name my-nginx custom-nginx-page

# 4. Open in browser
# http://localhost:8080
```

### Verify

```bash
# Check the container is running
docker ps

# View Nginx logs
docker logs my-nginx
```

### Stop and Clean Up

```bash
docker stop my-nginx
docker rm my-nginx
docker rmi custom-nginx-page
```

---

## The Dockerfile

```dockerfile
FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

| Line | What it does |
|---|---|
| `FROM nginx:alpine` | Uses the official Nginx image on Alpine Linux (~10 MB) |
| `COPY index.html ...` | Replaces the default Nginx welcome page with the custom HTML |
| `EXPOSE 80` | Documents that the container listens on port 80 |
| `CMD [...]` | Starts Nginx in the foreground so the container stays alive |

---

## What You Will See

After running the container and opening `http://localhost:8080`, the browser loads a dark-themed, professional documentation page covering all Docker fundamentals — served entirely from inside the container.

---

## Topics Covered in Documentation

- What containerization is and why it replaced traditional VM-based deployments
- Docker's client-server architecture (`dockerd`, `containerd`, `runc`)
- Docker vs Virtual Machine performance and resource comparison
- Docker images vs containers — layered filesystem, Copy-on-Write, volumes
- 17 essential Docker CLI commands with examples
- Dockerfile instructions (`FROM`, `RUN`, `COPY`, `CMD`, `ENTRYPOINT`, `ENV`, `EXPOSE`, `ARG`, `VOLUME`, `USER`)
- Multi-stage builds for production-ready images
- Dockerfile best practices

---

## Author

**Md Sarowar Alam**
Ostad Batch-08 · DevOps Track · April 2026

---

## Repository

[https://github.com/sarowar-alam/docker-3tier-deployment](https://github.com/sarowar-alam/docker-3tier-deployment)
