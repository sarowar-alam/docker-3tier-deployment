# ──────────────────────────────────────────────────────────────
# VitalTrack — Frontend Production Dockerfile (Multi-Stage)
#
# Stage 1 (builder): Compile React + Vite → produces dist/
# Stage 2 (serve):   Nginx serves dist/ as static files
#
# Final image contains ONLY Nginx + dist/ — no Node, no source.
# ──────────────────────────────────────────────────────────────

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Layer cache: install deps first, copy source after
COPY package.json package-lock.json* ./
# npm cache clean is omitted: builder stage is discarded after COPY --from,
# so cleaning the cache adds build time with zero benefit to the final image.
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build
# Output: /app/dist/

# ── Stage 2: Serve ──────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy production Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled React app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# HEALTHCHECK proxies through the /health endpoint which is forwarded to backend.
# If Nginx itself is broken, wget on localhost will fail.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
