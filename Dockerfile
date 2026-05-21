# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

FROM base AS builder
WORKDIR /app

# Build-time placeholders so `next build` does not fail when secrets are
# only provided at runtime by Coolify.
ENV TURSO_DATABASE_URL="file:./build.db"
ENV TURSO_AUTH_TOKEN=""
ENV BETTER_AUTH_SECRET="build-placeholder-secret"
ENV BETTER_AUTH_URL="http://localhost:3000"
ENV GOOGLE_CLIENT_ID="build-placeholder-google-client-id"
ENV GOOGLE_CLIENT_SECRET="build-placeholder-google-client-secret"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /pnpm /pnpm
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV="production"
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED="1"

# Runtime binaries required by reposting and browser automation.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp directly (apt package is often outdated for YouTube).
RUN curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
      -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Install Chromium + Linux dependencies for Playwright-based automation routes.
RUN npx -y playwright@1.59.1 install --with-deps chromium

# Ensure runtime data path exists and can be mounted as persistent storage.
RUN mkdir -p /app/data /app/data/reposting /app/data/accounts

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
