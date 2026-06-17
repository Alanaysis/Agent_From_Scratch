# IRG - Intelligent Robot Guide
# Multi-stage build for production

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy root package files
COPY package.json package-lock.json ./

# Copy GUI package files
COPY gui/package.json gui/package-lock.json ./gui/

# Install dependencies
RUN npm ci --ignore-scripts
RUN cd gui && npm ci --ignore-scripts

# Copy source code
COPY . .

# Build CLI
RUN npm run build

# Build GUI (Next.js)
RUN cd gui && npm run build

# Stage 2: Production
FROM node:18-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    git \
    bash

# Copy built artifacts
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/gui/.next ./gui/.next
COPY --from=builder /app/gui/package.json ./gui/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/gui/node_modules ./gui/node_modules
COPY --from=builder /app/package.json ./

# Create .irg directory for runtime data
RUN mkdir -p /root/.irg

# Expose ports
# 3001: GUI (Next.js dev)
# 3002: HTTP API
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/api/sessions || exit 1

# Default command: run CLI in interactive mode
CMD ["node", "bin/irg.js"]
