FROM node:20-slim

LABEL maintainer="Ralph Perez"
LABEL description="FireClaw — Security proxy protecting AI agents from prompt injection"
LABEL license="AGPL-3.0-or-later"

WORKDIR /app

# Copy package files and install production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY fireclaw.mjs sanitizer.mjs patterns.json config.yaml ./
COPY client/ ./client/
COPY dashboard/ ./dashboard/

# Create data directory for runtime state
RUN mkdir -p data logs

EXPOSE 8420

CMD ["node", "fireclaw.mjs"]
