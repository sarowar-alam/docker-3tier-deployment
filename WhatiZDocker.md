# Containerization & Docker — Concepts and Reference

**Date:** April 27, 2026

---

## Table of Contents

1. [Introduction to Containerization](#1-introduction-to-containerization)
2. [What is Docker & Docker Architecture](#2-what-is-docker--docker-architecture)
3. [Docker vs Virtual Machines](#3-docker-vs-virtual-machines)
4. [Docker Images vs Containers](#4-docker-images-vs-containers)
5. [Docker Commands Reference](#5-docker-commands-reference)
6. [Dockerfile Basics](#6-dockerfile-basics)
7. [Practical Demo — Custom Nginx HTML Page](#7-practical-demo--custom-nginx-html-page)

---

## 1. Introduction to Containerization

### Background

Traditional software deployment went through two phases:

- **Bare-metal servers** — one application per physical server. Simple, but wasteful and expensive.
- **Virtual Machines (VMs)** — multiple isolated OS instances on one physical host. Better utilization, but still resource-heavy.

The core problem that persisted through both approaches was **environment inconsistency** — an application that worked on a developer's machine would fail in staging or production due to differences in OS, runtime versions, libraries, or configuration.

### Limitations of Virtual Machines

| Limitation | Description |
|---|---|
| **Environment drift** | Different OS versions or packages across dev, staging, and prod environments |
| **Slow startup** | VMs take 1–5 minutes to boot a full guest OS |
| **High resource usage** | Each VM bundles a complete OS, consuming GBs of disk and hundreds of MBs of RAM |
| **Low density** | A typical host can run 10–20 VMs before resource contention becomes a problem |
| **Slow delivery** | Building and shipping VM images is slow, making CI/CD pipelines sluggish |

### What is Containerization?

Containerization is a method of packaging an application together with its runtime, libraries, dependencies, and configuration into a single self-contained unit called a **container**.

Containers share the **host operating system kernel** — they do not carry their own OS. This makes them significantly lighter than VMs.

```
Without Containers                  With Containers
──────────────────                  ────────────────
App A requires Node 14              App A → Container A  (Node 14 isolated)
App B requires Node 18     →        App B → Container B  (Node 18 isolated)
Conflict on shared host             Both run on the same host without conflict
```

### Benefits of Containerization

| Benefit | Explanation |
|---|---|
| **Portability** | Containers run consistently across any environment that supports a container runtime |
| **Isolation** | Each container has its own filesystem, network stack, and process space |
| **Immutability** | A container image built once runs identically in dev, staging, and production |
| **Efficiency** | Containers are lightweight and start in milliseconds |
| **Scalability** | Individual services can be scaled independently in a microservices architecture |

---

## 2. What is Docker & Docker Architecture

### What is Docker?

Docker is an open-source platform for building, distributing, and running containerized applications. It was released in 2013 and became the industry standard for containerization by providing a consistent developer experience across platforms.

Docker wraps Linux kernel features — **namespaces** (process isolation) and **cgroups** (resource control) — into a user-friendly toolset.

> Docker standardizes the container workflow: build an image from a `Dockerfile`, push it to a registry, pull it anywhere, and run it as a container.

---

### Docker Architecture

Docker follows a **client-server architecture**. The client sends commands to the Docker daemon, which carries out the actual work.

```
┌──────────────────────────────────────────────────────┐
│                   DOCKER CLIENT                      │
│       docker build  |  docker run  |  docker pull    │
└─────────────────────┬────────────────────────────────┘
                      │  REST API (Unix socket / TCP)
                      ▼
┌──────────────────────────────────────────────────────┐
│                DOCKER DAEMON  (dockerd)              │
│                                                      │
│   Image Management     Container Lifecycle           │
│   Network Management   Volume Management             │
│                                                      │
│              containerd  →  runc                     │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│                 DOCKER REGISTRY                      │
│     Docker Hub  |  AWS ECR  |  GCR  |  Private       │
└──────────────────────────────────────────────────────┘
```

### Core Components

**Docker Client**
The command-line interface (`docker`) that users interact with. It sends API requests to the Docker daemon over a Unix socket or TCP connection.

**Docker Daemon (`dockerd`)**
The background service responsible for managing Docker objects — images, containers, networks, and volumes. It listens for client requests and delegates container execution to the runtime layer.

**containerd**
An industry-standard container runtime (a CNCF project). It manages the full container lifecycle including image transfer, storage, and execution. The daemon delegates to `containerd` rather than handling execution directly.

**runc**
A lightweight, OCI-compliant runtime that `containerd` uses to actually create and run containers. It interfaces with the Linux kernel (namespaces, cgroups) to set up container isolation.

**Docker Image**
A read-only, layered filesystem template built from a `Dockerfile`. Each instruction in the `Dockerfile` produces one layer. Layers are cached and shared across images to minimize storage and rebuild time.

**Docker Container**
A running instance of an image. The container adds a thin writable layer on top of the image layers and executes the application process.

**Docker Registry**
A storage and distribution service for Docker images. Docker Hub is the default public registry. Private registries (AWS ECR, GCR, Azure ACR, Harbor) are used in enterprise environments.

---

### Image Layer Example

```
Layer 4: COPY src/ ./src/        ← application source code
Layer 3: RUN npm install         ← application dependencies
Layer 2: WORKDIR /app            ← working directory
Layer 1: FROM node:18-alpine     ← base OS and runtime
```

Layers are cached by content hash. If `package.json` has not changed, `RUN npm install` is not re-executed on rebuild — significantly improving build performance.

---

## 3. Docker vs Virtual Machines

### Architectural Difference

The fundamental difference is where isolation occurs:

- **Virtual Machines** virtualize hardware. Each VM runs a full guest OS on top of a hypervisor.
- **Containers** virtualize the operating system. Containers share the host OS kernel and isolate at the process level.

```
VIRTUAL MACHINES                        CONTAINERS
─────────────────                       ──────────
┌───────────────────────┐               ┌───────────────────────┐
│  App A    │  App B    │               │  App A    │  App B    │
├───────────┼───────────┤               ├───────────┼───────────┤
│ Guest OS  │ Guest OS  │               │   Libs    │   Libs    │
├───────────┴───────────┤               ├───────────────────────┤
│      Hypervisor       │               │    Docker Engine      │
├───────────────────────┤               ├───────────────────────┤
│       Host OS         │               │       Host OS         │
├───────────────────────┤               ├───────────────────────┤
│    Infrastructure     │               │    Infrastructure     │
└───────────────────────┘               └───────────────────────┘
Full OS per VM                          Shared kernel, isolated processes
```

### Comparison Table

| Metric | Virtual Machine | Docker Container |
|---|---|---|
| **Startup time** | 1–5 minutes | Under 1 second |
| **Image size** | 1–50 GB (includes full OS) | 5–500 MB (app and libs only) |
| **Memory overhead** | 512 MB – 4 GB per VM | Typically 10–100 MB per container |
| **CPU overhead** | 5–15% (hypervisor layer) | ~1–3% (near-native performance) |
| **Host density** | 10–30 VMs per host | Hundreds to thousands per host |
| **Isolation** | Strong — full OS boundary | Process-level — shared kernel |
| **Portability** | Tied to hypervisor type | Runs on any Docker-compatible host |
| **Security boundary** | Hardware-level | Kernel-level |
| **Data persistence** | VM disk image | Docker volumes or bind mounts |
| **Startup model** | Full OS boot each time | Reuses cached image layers |

### When to Use Each

| Scenario | Recommended Approach |
|---|---|
| Applications requiring a different OS (e.g., Windows on Linux host) | Virtual Machine |
| Hard multi-tenant isolation (financial services, regulated workloads) | Virtual Machine |
| Microservices, APIs, and web applications | Container |
| CI/CD build and test environments | Container |
| Kubernetes-orchestrated workloads | Container |
| Legacy applications requiring full OS customization | Virtual Machine |
| Development environment parity across teams | Container |

### VMs and Containers Together

In modern cloud infrastructure, both technologies are used together. Kubernetes clusters run on VMs (EC2 nodes, GCE instances) which themselves host multiple containers:

```
Cloud Infrastructure
└── Virtual Machine (Kubernetes Node)
    └── kubelet
        ├── Container A  (Pod 1)
        ├── Container B  (Pod 1)
        └── Container C  (Pod 2)
```

This model combines OS-level isolation from VMs with the density and speed benefits of containers.

---

## 4. Docker Images vs Containers

Understanding the distinction between images and containers is fundamental to working with Docker effectively.

> **Analogy:** An image is a **template** (like a class in OOP). A container is a **running instance** of that template (like an object). One image can produce many independent containers.

---

### Docker Image

A Docker image is a **read-only, immutable snapshot** of a filesystem and its configuration. It contains everything required to run an application: OS base libraries, runtime, dependencies, application code, and the default startup command.

Images are built in layers using a Union Filesystem (OverlayFS). Each `Dockerfile` instruction creates one layer. Layers are:

- **Cached** — unchanged layers are reused on subsequent builds
- **Shared** — multiple images sharing the same base layer use one copy on disk
- **Immutable** — a layer cannot be modified after it is created

```
┌──────────────────────────────────────┐
│  Layer 4: COPY src/ ./src/           │  ← read-only
├──────────────────────────────────────┤
│  Layer 3: RUN npm install            │  ← read-only (cached if unchanged)
├──────────────────────────────────────┤
│  Layer 2: WORKDIR /app               │  ← read-only
├──────────────────────────────────────┤
│  Layer 1: FROM node:18-alpine        │  ← read-only (shared base layer)
└──────────────────────────────────────┘
```

#### Image Naming

```
[registry/]repository[:tag]

docker.io/nginx:1.25-alpine          ← public image from Docker Hub
myrepo/backend:v2.1.0                ← custom image with version tag
```

- **Registry** — the server where the image is stored (default: `docker.io`)
- **Repository** — the image name or namespace
- **Tag** — the version identifier (avoid using `latest` in production; use explicit version tags)

#### Common Image Commands

```bash
docker build -t myapp:1.0 .          # Build image from Dockerfile in current directory
docker images                         # List locally available images
docker pull nginx:1.25-alpine         # Pull image from registry
docker push myrepo/myapp:1.0          # Push image to registry
docker rmi myapp:1.0                  # Remove a local image
docker history myapp:1.0              # Show layers of an image
```

---

### Docker Container

A Docker container is a **running (or stopped) instance of an image**. When a container is created, Docker takes the read-only image layers and adds a thin **writable container layer** on top. All changes made at runtime (logs, temporary files, state) go into this layer.

```
┌──────────────────────────────────────┐
│  Container Layer  (writable)         │  ← unique per container; lost on docker rm
├──────────────────────────────────────┤
│  Layer 4: COPY src/ ./src/           │  ← read-only (shared from image)
├──────────────────────────────────────┤
│  Layer 3: RUN npm install            │  ← read-only (shared from image)
├──────────────────────────────────────┤
│  Layer 2: WORKDIR /app               │  ← read-only (shared from image)
├──────────────────────────────────────┤
│  Layer 1: FROM node:18-alpine        │  ← read-only (shared from image)
└──────────────────────────────────────┘
```

#### Container Lifecycle

```
Image ──► [docker run] ──► Running ──► [docker stop] ──► Stopped ──► [docker rm] ──► Deleted
                               │
                        [docker restart]
                               │
                           Running
```

#### Common Container Commands

```bash
docker run -d -p 3000:3000 myapp:1.0     # Create and start a container (detached mode)
docker ps                                  # List running containers
docker ps -a                               # List all containers including stopped
docker stop <id>                           # Send SIGTERM to gracefully stop
docker rm <id>                             # Remove a stopped container
docker exec -it <id> sh                    # Open an interactive shell inside a container
docker logs <id>                           # View stdout/stderr output
docker inspect <id>                        # Display full container metadata
docker stats                               # Monitor live resource usage
```

---

### Image vs Container — Comparison

| Aspect | Docker Image | Docker Container |
|---|---|---|
| **Definition** | Read-only layered filesystem template | Running instance of an image |
| **State** | Static and immutable | Dynamic — has live process state |
| **Created by** | `docker build` or `docker pull` | `docker run` or `docker create` |
| **Writability** | Not writable | Writable container layer on top |
| **Lifecycle** | Persists until explicitly deleted | Created → Running → Stopped → Deleted |
| **Multiplicity** | One image → many containers | Each container is independent |
| **Data persistence** | Read-only; no runtime state | Writable layer is lost on `docker rm` |
| **Portability** | Fully portable across environments | Tied to the host it runs on |

---

### Copy-on-Write

When a running container needs to modify a file that exists in a read-only image layer, Docker uses **Copy-on-Write (CoW)**:

1. Docker copies the file from the image layer up into the writable container layer.
2. The container modifies the copy.
3. The original image layer remains unchanged.
4. Other containers using the same image are not affected.

This mechanism keeps container startup fast (no up-front file duplication) and disk usage low when many containers share the same base image.

---

### Data Persistence with Volumes

The writable container layer is discarded when a container is removed. To persist data across container restarts or replacements, use **Docker volumes**.

```bash
# Named volume — managed by Docker
docker run -v mydata:/app/data myapp:1.0

# Bind mount — maps a host directory into the container
docker run -v /host/path:/app/data myapp:1.0
```

Volumes live outside the container layer and survive `docker rm`. They are the standard approach for databases, file uploads, and any stateful data.

---

### End-to-End Example

The following illustrates how images and containers relate in a real workflow:

```
Dockerfile (backend)
────────────────────
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/
CMD ["node", "src/server.js"]

  docker build -t backend:1.0 .
           │
           ▼
    backend:1.0  ← IMAGE (artifact, stored in registry, versioned)
           │
  docker run -d -p 5000:5000 backend:1.0
           │
           ▼
  backend-container  ← CONTAINER (running Node.js process on the host)
```

The **image** is the build artifact — versioned, stored, and deployed.
The **container** is the runtime process — started, stopped, and replaced as needed.

---

## Summary

| Concept | Description |
|---|---|
| **Containerization** | Packaging an application with its dependencies into a portable, isolated unit |
| **Docker** | A platform for building, shipping, and running containers |
| **Docker Daemon** | Background service that manages images, containers, networks, and volumes |
| **Docker Image** | Read-only, layered template used to create containers |
| **Docker Container** | A running instance of an image with an additional writable layer |
| **VM vs Container** | VMs virtualize hardware with a full guest OS; containers share the host kernel |
| **Copy-on-Write** | Modified files are copied to the container layer, leaving the image untouched |
| **Docker Volume** | Persistent storage that exists outside the container lifecycle |

---

## 5. Docker Commands Reference

This section covers the most commonly used Docker commands. Each entry includes the syntax, purpose, and a practical example.

---

### Image Commands

#### `docker build`

Builds a Docker image from a `Dockerfile`.

```bash
docker build [OPTIONS] PATH
```

| Option | Description |
|---|---|
| `-t name:tag` | Assign a name and tag to the image |
| `-f filename` | Specify a custom Dockerfile path |
| `--no-cache` | Build without using cached layers |

**Example:**
```bash
docker build -t myapp:1.0 .
docker build -t myapp:1.0 -f docker/Dockerfile .
```

**When to use:** Every time you modify your application or `Dockerfile` and need to produce a new image.

---

#### `docker images`

Lists all Docker images stored locally.

```bash
docker images [OPTIONS]
```

**Example:**
```bash
docker images
docker images --filter "dangling=true"   # list untagged (unused) images
```

**When to use:** To check which images are available on your machine before running or debugging containers.

---

#### `docker pull`

Downloads an image from a registry (Docker Hub by default).

```bash
docker pull [REGISTRY/]IMAGE[:TAG]
```

**Example:**
```bash
docker pull node:18-alpine
docker pull nginx:1.25
```

**When to use:** To fetch a base image or a pre-built application image from a registry before building or running.

---

#### `docker push`

Uploads a locally built image to a registry.

```bash
docker push [REGISTRY/]IMAGE[:TAG]
```

**Example:**
```bash
docker push myrepo/myapp:1.0
```

**When to use:** After building and testing an image locally, push it to a registry so it can be deployed to other environments or shared with a team.

---

#### `docker rmi`

Removes one or more images from local storage.

```bash
docker rmi IMAGE [IMAGE...]
```

**Example:**
```bash
docker rmi myapp:1.0
docker rmi $(docker images -q --filter "dangling=true")   # remove all dangling images
```

**When to use:** To free up disk space by removing old or unused images.

---

### Container Lifecycle Commands

#### `docker run`

Creates and starts a new container from an image. This is the most commonly used Docker command.

```bash
docker run [OPTIONS] IMAGE [COMMAND]
```

| Option | Description |
|---|---|
| `-d` | Run in detached mode (background) |
| `-p host:container` | Map a host port to a container port |
| `--name` | Assign a name to the container |
| `-e KEY=VALUE` | Set an environment variable |
| `-v host:container` | Mount a volume or bind mount |
| `--rm` | Automatically remove container when it stops |
| `--network` | Connect container to a specific network |

**Example:**
```bash
# Run a web app in the background, map port 3000
docker run -d -p 3000:3000 --name myapp myapp:1.0

# Run with environment variables and auto-remove on exit
docker run --rm -e NODE_ENV=production myapp:1.0

# Run an interactive shell inside a container
docker run -it node:18-alpine sh
```

**When to use:** Any time you want to start a container from an image.

---

#### `docker ps`

Lists running containers.

```bash
docker ps [OPTIONS]
```

| Option | Description |
|---|---|
| `-a` | Show all containers, including stopped ones |
| `-q` | Show only container IDs |

**Example:**
```bash
docker ps          # running containers only
docker ps -a       # all containers
```

**When to use:** To check what is currently running, or to find a container ID for further commands.

---

#### `docker stop`

Gracefully stops a running container by sending a `SIGTERM` signal, allowing the process to shut down cleanly.

```bash
docker stop CONTAINER [CONTAINER...]
```

**Example:**
```bash
docker stop myapp
docker stop abc123def456
```

**When to use:** To stop a container without forcing it — preferred over `docker kill` in most situations.

---

#### `docker start`

Starts a stopped container without creating a new one.

```bash
docker start CONTAINER [CONTAINER...]
```

**Example:**
```bash
docker start myapp
```

**When to use:** To restart a previously stopped container while retaining its configuration, volumes, and network settings.

---

#### `docker restart`

Stops and then starts a container in a single command.

```bash
docker restart CONTAINER [CONTAINER...]
```

**Example:**
```bash
docker restart myapp
```

**When to use:** To apply configuration changes or recover a container that has become unresponsive.

---

#### `docker rm`

Removes one or more stopped containers.

```bash
docker rm CONTAINER [CONTAINER...]
```

| Option | Description |
|---|---|
| `-f` | Force remove a running container |

**Example:**
```bash
docker rm myapp
docker rm $(docker ps -aq)   # remove all stopped containers
```

**When to use:** To clean up containers that are no longer needed.

---

### Debugging & Monitoring Commands

#### `docker logs`

Fetches the stdout and stderr output from a container.

```bash
docker logs [OPTIONS] CONTAINER
```

| Option | Description |
|---|---|
| `-f` | Follow log output in real time |
| `--tail N` | Show the last N lines |
| `--since` | Show logs since a timestamp (e.g., `10m`, `2024-01-01`) |

**Example:**
```bash
docker logs myapp
docker logs -f myapp                  # stream live logs
docker logs --tail 50 myapp           # last 50 lines
```

**When to use:** To troubleshoot application errors, monitor startup, or inspect runtime output.

---

#### `docker exec`

Runs a command inside a running container.

```bash
docker exec [OPTIONS] CONTAINER COMMAND
```

| Option | Description |
|---|---|
| `-i` | Keep stdin open |
| `-t` | Allocate a pseudo-TTY (terminal) |

**Example:**
```bash
docker exec -it myapp sh              # open an interactive shell
docker exec myapp cat /etc/hosts      # run a single command
docker exec -it mydb psql -U postgres # connect to a database inside a container
```

**When to use:** To inspect or interact with a running container — inspect files, run database queries, or debug issues without stopping the container.

---

#### `docker inspect`

Returns detailed metadata about a container or image in JSON format.

```bash
docker inspect CONTAINER|IMAGE
```

**Example:**
```bash
docker inspect myapp
docker inspect myapp:1.0

# Extract a specific field using --format
docker inspect --format '{{.NetworkSettings.IPAddress}}' myapp
```

**When to use:** To check a container's IP address, environment variables, volume mounts, network configuration, or restart policy.

---

#### `docker stats`

Displays a live stream of CPU, memory, network, and disk usage for running containers.

```bash
docker stats [CONTAINER...]
```

**Example:**
```bash
docker stats                # monitor all running containers
docker stats myapp          # monitor a specific container
```

**When to use:** To identify resource bottlenecks or verify that a container is not consuming more CPU or memory than expected.

---

### Volume Commands

#### `docker volume`

Manages Docker volumes for persistent data storage.

```bash
docker volume COMMAND
```

| Subcommand | Description |
|---|---|
| `create` | Create a named volume |
| `ls` | List all volumes |
| `inspect` | Show detailed information about a volume |
| `rm` | Remove a volume |
| `prune` | Remove all unused volumes |

**Example:**
```bash
docker volume create mydata
docker volume ls
docker volume inspect mydata
docker volume rm mydata

# Use a volume when running a container
docker run -d -v mydata:/app/data myapp:1.0
```

**When to use:** When your container needs to persist data beyond its own lifecycle — databases, file uploads, configuration files.

---

### Network Commands

#### `docker network`

Manages Docker networks that allow containers to communicate with each other.

```bash
docker network COMMAND
```

| Subcommand | Description |
|---|---|
| `create` | Create a custom network |
| `ls` | List all networks |
| `inspect` | Show details of a network |
| `connect` | Connect a container to a network |
| `disconnect` | Disconnect a container from a network |
| `rm` | Remove a network |

**Example:**
```bash
# Create an isolated bridge network
docker network create mynetwork

# Run two containers on the same network so they can talk to each other
docker run -d --name backend --network mynetwork backend:1.0
docker run -d --name frontend --network mynetwork frontend:1.0

# The frontend container can now reach the backend using its container name as hostname
# e.g., http://backend:5000
```

**When to use:** When running multiple containers that need to communicate, such as a web application connecting to a database container. Containers on the same network can resolve each other by container name.

---

### Quick Reference Table

| Command | Purpose |
|---|---|
| `docker build -t name:tag .` | Build an image from a Dockerfile |
| `docker images` | List local images |
| `docker pull image:tag` | Download image from registry |
| `docker push image:tag` | Upload image to registry |
| `docker rmi image:tag` | Remove a local image |
| `docker run -d -p 80:80 image` | Create and start a container |
| `docker ps` | List running containers |
| `docker ps -a` | List all containers |
| `docker stop name` | Gracefully stop a container |
| `docker start name` | Start a stopped container |
| `docker restart name` | Restart a container |
| `docker rm name` | Remove a stopped container |
| `docker logs -f name` | Stream container logs |
| `docker exec -it name sh` | Open a shell in a container |
| `docker inspect name` | Show full container/image metadata |
| `docker stats` | Monitor live resource usage |
| `docker volume create v` | Create a named volume |
| `docker network create n` | Create a custom network |

---

## 6. Dockerfile Basics

### What is a Dockerfile?

A `Dockerfile` is a plain text file that contains a set of instructions for building a Docker image. Each instruction defines a step in the build process — starting from a base image, installing dependencies, copying application code, and configuring how the container runs.

Docker reads the `Dockerfile` top to bottom and executes each instruction to produce a layered image.

### Why Dockerfiles Matter

- **Reproducibility** — the same `Dockerfile` produces the same image on any machine
- **Version control** — `Dockerfiles` are checked into source control alongside application code
- **Automation** — CI/CD pipelines use `Dockerfiles` to build and publish images automatically
- **Transparency** — every change to the image is explicit and traceable

---

### Standard Dockerfile Structure

```dockerfile
# 1. Base image
FROM base-image:tag

# 2. Build arguments (optional)
ARG APP_VERSION=1.0

# 3. Environment variables
ENV NODE_ENV=production

# 4. Working directory
WORKDIR /app

# 5. Copy dependency manifests first (for layer caching)
COPY package*.json ./

# 6. Install dependencies
RUN npm install --omit=dev

# 7. Copy application source
COPY . .

# 8. Expose the port the app listens on
EXPOSE 3000

# 9. Define the default user (non-root for security)
USER node

# 10. Default startup command
CMD ["node", "src/server.js"]
```

---

### Dockerfile Instructions

#### `FROM`

Specifies the base image to build from. Every `Dockerfile` must begin with a `FROM` instruction.

```dockerfile
FROM node:18-alpine
FROM python:3.11-slim
FROM nginx:1.25-alpine
```

Choose a minimal base image (e.g., `-alpine`, `-slim`) to reduce image size and attack surface.

---

#### `WORKDIR`

Sets the working directory inside the container for all subsequent instructions. Creates the directory if it does not exist.

```dockerfile
WORKDIR /app
```

All `COPY`, `RUN`, and `CMD` instructions after this point operate relative to `/app`.

---

#### `COPY`

Copies files or directories from the build context (your local machine) into the image.

```dockerfile
COPY package*.json ./
COPY src/ ./src/
COPY . .
```

**Best practice:** Copy dependency manifests (`package.json`, `requirements.txt`) before copying source code. This allows Docker to cache the dependency installation layer, so re-running `RUN npm install` is skipped if dependencies have not changed.

---

#### `ADD`

Similar to `COPY` but with additional capabilities: it can extract `.tar` archives automatically and fetch files from URLs.

```dockerfile
ADD app.tar.gz /app/
```

**Recommendation:** Prefer `COPY` for straightforward file copying. Use `ADD` only when you specifically need archive extraction.

---

#### `RUN`

Executes a shell command during the image build. The result is committed as a new layer.

```dockerfile
RUN npm install --omit=dev
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
```

**Best practice:** Chain related commands with `&&` in a single `RUN` instruction to avoid creating unnecessary intermediate layers.

---

#### `CMD`

Defines the default command to run when a container starts. Can be overridden at runtime by passing a command to `docker run`.

```dockerfile
CMD ["node", "src/server.js"]
CMD ["python", "app.py"]
```

Use the **exec form** (`["command", "arg"]`) rather than the shell form (`command arg`) to avoid shell signal handling issues.

---

#### `ENTRYPOINT`

Defines the fixed executable that always runs when the container starts. Unlike `CMD`, it cannot be overridden by passing a different command to `docker run` — only additional arguments can be passed.

```dockerfile
ENTRYPOINT ["python", "app.py"]
```

**`CMD` vs `ENTRYPOINT`:**

| | `CMD` | `ENTRYPOINT` |
|---|---|---|
| Overridable at runtime | Yes — fully replaceable | No — only arguments change |
| Typical use | Default command, flexible | Fixed executable, e.g., a script |
| Combined use | Acts as default arguments to `ENTRYPOINT` | Defines the executable |

---

#### `ENV`

Sets environment variables that are available both during the build and at runtime.

```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
```

**When to use:** For runtime configuration that remains constant across all deployments. For sensitive values (passwords, tokens), pass them at runtime with `docker run -e` rather than hardcoding in the `Dockerfile`.

---

#### `EXPOSE`

Documents which port the application inside the container listens on. This is informational — it does not actually publish the port to the host.

```dockerfile
EXPOSE 3000
EXPOSE 8080
```

Port publishing to the host is done with `-p` in `docker run`.

---

#### `ARG`

Defines a build-time variable that can be passed during `docker build` using `--build-arg`. Unlike `ENV`, `ARG` values are not available at runtime.

```dockerfile
ARG APP_VERSION=1.0
ARG BUILD_DATE
```

```bash
docker build --build-arg APP_VERSION=2.0 -t myapp:2.0 .
```

**When to use:** For values that should vary per build (version numbers, build timestamps) but should not be present in the running container.

---

#### `VOLUME`

Declares a mount point for persistent or shared data. Docker creates a managed volume for this path if no volume is explicitly mounted at runtime.

```dockerfile
VOLUME ["/app/data"]
```

This is informational and is often omitted in favour of explicit `-v` mounts in `docker run` or `docker-compose.yml`.

---

#### `USER`

Sets the user that subsequent instructions and the container process run as. By default, containers run as `root`, which is a security risk.

```dockerfile
USER node
USER 1001
```

**Best practice:** Always switch to a non-root user before the final `CMD` or `ENTRYPOINT` instruction, especially for production images.

---

### Dockerfile Examples

#### Example 1 — Node.js Application

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy dependency manifest first to leverage layer cache
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY src/ ./src/

EXPOSE 3000

USER node

CMD ["node", "src/server.js"]
```

---

#### Example 2 — Python Application

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

EXPOSE 8000

CMD ["python", "app.py"]
```

---

#### Example 3 — Nginx Static Frontend

```dockerfile
# Stage 1 — Build the React app
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2 — Serve with Nginx
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

This uses a **multi-stage build** — the first stage compiles the application, and the second stage produces a minimal production image containing only the built static files and Nginx. The build tools (Node.js, `node_modules`) are not included in the final image.

---

### How Docker Builds an Image from a Dockerfile

When you run `docker build`, Docker processes the `Dockerfile` step by step:

```
Step 1: docker build -t myapp:1.0 .
        │
        ▼
Step 2: Docker reads the Dockerfile top to bottom
        │
        ▼
Step 3: Each instruction creates a new read-only layer
        │
        ├── FROM node:18-alpine     → pull or reuse base layer
        ├── WORKDIR /app            → set working directory
        ├── COPY package*.json ./   → copy files into layer
        ├── RUN npm install         → execute command, commit result as layer
        ├── COPY src/ ./src/        → copy source code into layer
        └── CMD ["node", ...]       → store default command in image metadata
        │
        ▼
Step 4: Layers are cached by content hash
        If a layer has not changed since the last build, Docker reuses it
        Only layers after the first change are rebuilt
        │
        ▼
Step 5: Final image is tagged as myapp:1.0
        Ready to push to a registry or run as a container
```

#### Layer Caching Strategy

The order of instructions in a `Dockerfile` directly affects build performance:

```dockerfile
# Inefficient — source code changes invalidate the npm install layer
COPY . .
RUN npm install

# Efficient — npm install only reruns when package.json changes
COPY package*.json ./
RUN npm install
COPY . .
```

Place instructions that change infrequently (installing system packages, copying dependency manifests, installing dependencies) **before** instructions that change often (copying application source code).

---

### Dockerfile Best Practices

| Practice | Reason |
|---|---|
| Use a specific image tag (e.g., `node:18-alpine`) | Avoid unexpected breaking changes from `latest` |
| Use minimal base images (`-alpine`, `-slim`) | Reduce image size and attack surface |
| Copy dependency files before source code | Maximise layer cache efficiency |
| Chain `RUN` commands with `&&` | Reduce the number of layers |
| Use `.dockerignore` | Exclude `node_modules`, `.git`, logs from the build context |
| Run as a non-root user | Improve container security |
| Use multi-stage builds for compiled apps | Keep production images small and clean |
| Avoid storing secrets in the image | Pass sensitive values at runtime via environment variables |

---

## 7. Practical Demo — Custom Nginx HTML Page

### Overview

This section walks through a complete, practical example of building and running a custom Nginx container that serves a professional HTML page instead of the default "Welcome to nginx!" page.

It demonstrates a fundamental Docker workflow:

1. Write a `Dockerfile`
2. Prepare a custom file to include in the image
3. Build the image
4. Run the container
5. Access the result in a browser

This is a common pattern used in real deployments: package a static website, a documentation page, or a frontend build artifact inside an Nginx container and serve it as a standalone unit.

---

### Why Nginx?

Nginx is a high-performance, lightweight web server widely used in production to serve static files, act as a reverse proxy, and front application servers. Its official Docker image (`nginx:alpine`) is under 10 MB, starts in milliseconds, and requires zero configuration to serve HTML files.

It is the standard choice for:

- Serving built frontend applications (React, Vue, Angular)
- Hosting static documentation or HTML reports
- Acting as a reverse proxy in front of a backend API
- Demonstration and learning environments

---

### How Nginx Serves Files

By default, the official `nginx` Docker image serves files from the directory:

```
/usr/share/nginx/html/
```

The file served at the root URL (`/`) is:

```
/usr/share/nginx/html/index.html
```

This is the file that produces the default "Welcome to nginx!" page. Replacing this file with your own `index.html` is all that is required to serve a custom page — no additional Nginx configuration needed for basic static content.

---

### Project Structure

```
nginx-demo/
├── Dockerfile
└── index.html
```

The `index.html` is a professional standalone HTML page that presents Docker and containerization concepts in a clean, readable format — rendering the content of this document visually for presentation or demo purposes.

---

### The Dockerfile

```dockerfile
FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Line-by-Line Explanation

**`FROM nginx:alpine`**
Uses the official Nginx image built on Alpine Linux as the base. Alpine is a minimal Linux distribution — the resulting image is small (under 10 MB) and has a reduced attack surface compared to full OS-based images.

**`COPY index.html /usr/share/nginx/html/index.html`**
Copies the custom `index.html` from the build context (your local `nginx-demo/` directory) into the container, overwriting the default Nginx welcome page at its standard serving path.

**`EXPOSE 80`**
Declares that the container listens on port 80 (standard HTTP). This is informational — the actual port mapping to the host is done with `-p` in `docker run`.

**`CMD ["nginx", "-g", "daemon off;"]`**
Starts Nginx in the foreground. The `daemon off;` directive prevents Nginx from backgrounding itself, which is required for Docker to keep the container process alive. If Nginx were to daemonize, the container would immediately exit.

---

### Building and Running

#### Step 1 — Navigate to the project directory

```bash
cd nginx-demo
```

#### Step 2 — Build the image

```bash
docker build -t custom-nginx-page .
```

Docker reads the `Dockerfile`, pulls the `nginx:alpine` base layer (or reuses it from cache), copies `index.html` into the image, and tags the result as `custom-nginx-page:latest`.

Expected output:

```
[+] Building 1.2s (7/7) FINISHED
 => [internal] load build definition from Dockerfile
 => [internal] load .dockerignore
 => [internal] load metadata for docker.io/library/nginx:alpine
 => [1/2] FROM docker.io/library/nginx:alpine
 => [2/2] COPY index.html /usr/share/nginx/html/index.html
 => exporting to image
 => => naming to docker.io/library/custom-nginx-page:latest
```

#### Step 3 — Run the container

```bash
docker run -d -p 8080:80 --name my-nginx custom-nginx-page
```

| Flag | Purpose |
|---|---|
| `-d` | Run in detached mode (background) |
| `-p 8080:80` | Map port 8080 on the host to port 80 inside the container |
| `--name my-nginx` | Assign a memorable name to the container |
| `custom-nginx-page` | The image to create the container from |

#### Step 4 — Verify the container is running

```bash
docker ps
```

Expected output:

```
CONTAINER ID   IMAGE               COMMAND                  CREATED         STATUS         PORTS                  NAMES
a3f9d12bc001   custom-nginx-page   "/docker-entrypoint.…"   5 seconds ago   Up 4 seconds   0.0.0.0:8080->80/tcp   my-nginx
```

The `STATUS` column shows `Up` and the port mapping `0.0.0.0:8080->80/tcp` confirms host port 8080 is forwarded to container port 80.

#### Step 5 — Check logs

```bash
docker logs my-nginx
```

Nginx logs startup messages and each HTTP request. This is useful for confirming the server started correctly and for debugging access issues.

#### Step 6 — Open in browser

```
http://localhost:8080
```

Instead of the default "Welcome to nginx!" page, your custom HTML page loads — serving the Docker and containerization documentation in a clean, professional HTML format.

---

### What is Happening Under the Hood

```
Browser                    Host Machine              Container
───────                    ────────────              ─────────
GET http://localhost:8080
        │
        ▼
        localhost:8080 ──── port mapping ────► container:80
                                                     │
                                               Nginx receives request
                                                     │
                                               Serves /usr/share/nginx/html/index.html
                                                     │
        ◄──────────────── HTTP 200 OK + HTML ────────┘
        │
Browser renders custom HTML page
```

The browser's request hits port 8080 on the host. Docker's port mapping (`-p 8080:80`) forwards the traffic to port 80 inside the container. Nginx serves the `index.html` that was baked into the image during the build step.

---

### Stopping and Cleaning Up

```bash
# Stop the running container
docker stop my-nginx

# Remove the container
docker rm my-nginx

# Remove the image (optional)
docker rmi custom-nginx-page
```

---

### About the Custom index.html

The `index.html` file in the `nginx-demo/` directory is a self-contained HTML page styled for professional presentation. It renders the core content of this documentation — covering containerization, Docker architecture, VM comparisons, and image vs container concepts — in a clean, readable layout suitable for demos, technical presentations, and learning sessions.

The page uses only inline CSS and requires no external dependencies, making it fully portable and functional inside the container without any internet access.
