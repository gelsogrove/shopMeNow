# syntax=docker/dockerfile:1
# Multi-stage build for the eChatbot monorepo.
# Build context is the REPO ROOT (see deploy/docker-compose.yml: context: ..).
# Two final targets, selected via `target:` in deploy/docker-compose.yml:
#   app       -> backend API which also serves the built frontend + backoffice
#   scheduler -> background jobs worker
# No database is built here: DATABASE_URL in .env decides where both
# containers connect (Supabase, or the optional local-db compose profile).

FROM node:22 AS base
WORKDIR /app

# Dependency layer: cached until a package.json or the Prisma schema changes.
# The schema must be present before `npm ci` because @echatbot/database runs
# `prisma generate` in its postinstall hook.
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY apps/backoffice/package.json apps/backoffice/
COPY apps/scheduler/package.json apps/scheduler/
COPY packages/database/package.json packages/database/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/database/prisma packages/database/prisma
RUN npm ci

COPY . .
RUN npm run prisma:generate && npm run build -w @echatbot/database

# ---------------------------------------------------------------- app ------
FROM base AS app

# Vite inlines VITE_* values into the frontend bundle at BUILD time (they are
# not read at runtime). All four are optional. Google login / reCAPTCHA
# simply stay disabled when empty. VITE_BACKOFFICE_URL is only needed because
# LoginPage's "Go to backoffice" link falls back to the localhost:3002 dev
# port when unset — in this single-container deploy the backoffice SPA is
# served by this same app, but only under /backoffice (see app.ts), so the
# value must be the app's own public origin WITH that suffix, e.g.
# https://shop.example.com/backoffice. The customer frontend already falls
# back to same-origin `/api` when unset (apps/frontend/src/config.ts), but the
# backoffice does NOT — it unconditionally falls back to localhost:3001 (see
# apps/backoffice/src/services/api.ts), so VITE_API_URL must always be set
# for a Docker deploy, to the app's own public origin + /api/v1.
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_RECAPTCHA_SITE_KEY=
ARG VITE_BACKOFFICE_URL=
ARG VITE_API_URL=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_BACKOFFICE_URL=$VITE_BACKOFFICE_URL \
    VITE_API_URL=$VITE_API_URL

# tsc/vite on this monorepo exceed Node's default heap inside the container
# (exit 134 = V8 abort). Raised for the build only, reset for runtime below.
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN npm run build:backend && npm run build:frontend && npm run build:backoffice
ENV NODE_OPTIONS=

# NODE_ENV=production is what makes Express serve the two dist/ folders
# (apps/backend/src/app.ts). The working directory must stay /app (monorepo
# root) because the backend resolves them from process.cwd().
ENV NODE_ENV=production
EXPOSE 3001

# Migrations run here and ONLY here (not in the scheduler) so concurrent
# `migrate deploy` runs never race each other.
CMD ["sh", "-c", "npm run prisma:migrate:prod && node apps/backend/dist/src/index.js"]

# ---------------------------------------------------------- scheduler ------
FROM base AS scheduler

# Mirrors the heroku:scheduler build, but the shared/ compile runs AFTER
# build:scheduler because build:scheduler starts with `rm -rf dist`.
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN npm run build:scheduler \
  && cd shared && npx tsc translation-prompts.ts --outDir ../apps/scheduler/dist/shared --declaration --module commonjs --target ES2020 --esModuleInterop --skipLibCheck
ENV NODE_OPTIONS=

ENV NODE_ENV=production
# tsc pulls shared/translation-prompts.ts into the program, so the common
# root widens to the repo root and the entrypoint nests accordingly —
# same path Procfile.scheduler uses on Heroku.
CMD ["node", "apps/scheduler/dist/apps/scheduler/src/index.js"]
