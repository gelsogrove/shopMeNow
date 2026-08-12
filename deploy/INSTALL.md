# eChatbot — Installation Guide (Docker)

This guide explains how to install the eChatbot platform from the delivered
Docker images. No Node.js, npm or source-code knowledge is required on the
target machine — only Docker.

For day-to-day operation once installed (start/stop, logs, updates,
troubleshooting), see [RUN.md](./RUN.md).

## What you should have received

| File | Purpose |
|------|---------|
| `echatbot-images.tar.gz` | The two application Docker images (app + scheduler) |
| `docker-compose.yml` | Describes how the containers run together |
| `.env.example` | Template of every configuration variable |
| `INSTALL.md` | This guide |
| `RUN.md` | Day-to-day operations guide |

Secrets (API keys, database URL, passwords) are **never** part of the package.
They are provided separately through a secure channel, or they are your own.

## Prerequisites

- Docker Engine 24+ with the Compose plugin (or Docker Desktop on Mac/Windows).
  Verify with: `docker --version` and `docker compose version`
- A PostgreSQL database reachable from this machine — normally a
  **Supabase** project (its connection string is your `DATABASE_URL`).
  If you prefer a database on this same machine, see
  [RUN.md → Running a local database](./RUN.md#running-a-local-database-instead-of-supabase).
- Outbound internet access (the platform calls OpenRouter, WhatsApp providers,
  Cloudinary, PayPal, SMTP).

## Step 1 — Create the installation folder

```bash
mkdir echatbot && cd echatbot
# copy the delivered files into this folder:
#   echatbot-images.tar.gz, docker-compose.yml, .env.example, INSTALL.md, RUN.md
```

## Step 2 — Load the Docker images

```bash
docker load -i echatbot-images.tar.gz
```

Verify both images are present:

```bash
docker image ls | grep echatbot
# echatbot-app         latest ...
# echatbot-scheduler   latest ...
```

## Step 3 — Create your configuration file

```bash
cp .env.example .env
```

Open `.env` with any editor and fill in the values. The essential ones:

| Variable | What it is |
|----------|-----------|
| `DATABASE_URL` | Your Supabase (or Postgres) connection string |
| `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY` | Random secrets — generate with `openssl rand -hex 32` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your admin login |
| `OPENROUTER_API_KEY` | LLM provider key (chatbot responses) |
| `SMTP_*` | Outgoing e-mail |
| `VITE_BACKOFFICE_URL` | This app's own origin **+ `/backoffice`** (e.g. `https://shop.example.com/backoffice`, or `https://localhost/backoffice` for a local test). Without it, the "Go to backoffice" link falls back to a dev-only URL and breaks |
| PayPal / Cloudinary / WhatsApp provider keys | Fill the ones you use |

Notes:

- `.env` stays on this machine only. Do not commit it, mail it or copy it
  into images.
- The `DATABASE_URL` host must be reachable **from inside a container**:
  a Supabase URL works as-is; `localhost` does **not** refer to this machine
  from inside Docker.

## Step 4 — Start the platform

```bash
docker compose up -d
```

What happens on first start:

1. The **app** container runs the database migrations (creates/updates all
   tables on the database pointed to by `DATABASE_URL`), then starts the API.
2. The **scheduler** container starts the background jobs (campaigns, queues,
   cleanups, reminders). It talks only to the database — it has no exposed
   port and never calls the app directly.

## Step 5 — Verify

```bash
docker compose ps        # both "running"
docker compose logs -f app
```

Then open in a browser:

- **Frontend**: http://localhost:3001
- **Backoffice**: http://localhost:3001/backoffice

(Replace `localhost` with the server's address when installing remotely.
For a public installation put a reverse proxy with HTTPS — nginx, Caddy or
Traefik — in front of port 3001.)

Installation is complete. For starting/stopping, updates, backups and
troubleshooting, continue with [RUN.md](./RUN.md).

---

## For the maintainer — building and exporting the package

(Reference for whoever prepares a delivery; customers can ignore this.)

One command from the repo root:

```bash
npm run deploy:docker
```

It builds both images, exports them to `deploy/echatbot-images.tar.gz` and
copies `.env.example` next to them. The whole package to deliver is then the
content of the `deploy/` folder:

```
echatbot-images.tar.gz   docker-compose.yml   .env.example   INSTALL.md   RUN.md
```

Secrets travel separately (password manager / secure channel), never inside
the package. Equivalent manual steps, run inside `deploy/`:

```bash
docker compose build
docker save echatbot-app:latest echatbot-scheduler:latest | gzip > echatbot-images.tar.gz
cp ../.env.example .env.example
```
