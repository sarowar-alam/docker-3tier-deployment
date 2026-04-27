# ──────────────────────────────────────────────────────────────
# VitalTrack — Backend Production Dockerfile
# Base: node:20-alpine (minimal attack surface, ~50MB)
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine

# Install dumb-init: proper PID 1 signal handling for Node in containers
RUN apk add --no-cache dumb-init

# Create non-root application user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Set NODE_ENV before npm install so packages can act on it at install time
ENV NODE_ENV=production

# ── Layer cache optimisation ──
# COPY --chown avoids a separate chown layer (no duplicate inode metadata).
# npm ci uses package-lock.json for deterministic, reproducible installs.
# package-lock.json* glob handles the case where the lockfile is absent.
COPY --chown=appuser:appgroup package.json package-lock.json* ./

# Install production dependencies only (excludes nodemon, etc.)
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source after dependencies are cached
COPY --chown=appuser:appgroup src/ src/

USER appuser

EXPOSE 3000

# HEALTHCHECK allows Docker (and --restart) to detect a broken backend
# and restart it automatically. start-period gives Node time to connect to DB.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# dumb-init forwards signals correctly to Node (enables graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
