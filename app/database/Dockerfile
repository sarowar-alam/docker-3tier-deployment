# ──────────────────────────────────────────────────────────────
# VitalTrack — Database Dockerfile
#
# Build context: app/   (one level above this file)
# Command:  docker build -t vitaltrack-db -f app/database/Dockerfile app/
#
# Why build context = app/?
# Migrations live in app/backend/migrations/ — the COPY instruction
# below needs to reach them. Docker build context controls what files
# are accessible during the build.
# ──────────────────────────────────────────────────────────────
FROM postgres:14-alpine

# POSTGRES_USER and POSTGRES_DB are set here as safe defaults.
# POSTGRES_PASSWORD is intentionally NOT baked into the image —
# baking a password into an image layer exposes it via docker history.
# Pass it at runtime: -e POSTGRES_PASSWORD=<your_password>
ENV POSTGRES_USER=bmi_user
ENV POSTGRES_DB=bmidb

# Copy SQL migrations into the Postgres init directory.
# postgres:alpine auto-executes all *.sql files in this directory
# in alphabetical order on the FIRST container start (fresh volume).
# Subsequent starts skip this step — data is already in the volume.
COPY backend/migrations/001_create_measurements.sql /docker-entrypoint-initdb.d/001_create_measurements.sql
COPY backend/migrations/002_add_measurement_date.sql /docker-entrypoint-initdb.d/002_add_measurement_date.sql

# HEALTHCHECK uses pg_isready (bundled with postgres image).
# Docker and --restart policies use this to determine actual DB readiness.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U bmi_user -d bmidb || exit 1

EXPOSE 5432
