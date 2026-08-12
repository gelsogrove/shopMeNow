# eChatbot — Day-to-Day Operations (Docker)

Commands for running an already-installed eChatbot platform: starting,
stopping, checking logs, updating and backing up data.

Not installed yet? See [INSTALL.md](./INSTALL.md) first.

All commands below run from the folder that contains `docker-compose.yml`
and `.env`.

## Start / stop

```bash
# start everything (data is NOT lost — it lives in the database)
docker compose up -d

# stop everything
docker compose down

# restart after an .env change
docker compose down && docker compose up -d
```

## Status and logs

```bash
docker compose ps          # both containers should be "running"
docker compose logs -f app
docker compose logs -f scheduler
```

## Installing an update

When you receive a new `echatbot-images.tar.gz`:

```bash
docker load -i echatbot-images.tar.gz
docker compose up -d
```

Compose restarts only what changed; migrations for the new version run
automatically at startup.

## Switching to a different Supabase (or Postgres) database

The default setup points `DATABASE_URL` at a Supabase project. To point it at
a **different** database (e.g. moving from a test project to the customer's
own), only one variable changes — it is read at runtime, not baked into the
images, so no rebuild is needed:

1. In `.env`, replace `DATABASE_URL` with the new project's connection
   string (Supabase dashboard → Project Settings → Database → Connection
   string; use the pooled "Transaction" connection, port 5432 or 6543):
   ```
   DATABASE_URL="postgresql://<user>:<password>@<host>.pooler.supabase.com:5432/postgres"
   ```
2. Restart:
   ```bash
   docker compose down && docker compose up -d
   ```

On a **fresh, empty** database, Prisma migrations run cleanly on first start.
If you point at a database that already has its own migration history from a
different source, migrations can conflict — see `P3009` below.

## Running a local database (instead of Supabase)

The compose file ships with an optional Postgres service, disabled by default.

1. In `.env` set:
   `DATABASE_URL=postgresql://echatbotfy:echatbotfy@postgres:5432/echatbotfy`
2. Start with the `local-db` profile:
   ```bash
   docker compose --profile local-db up -d
   ```

Data persists in a Docker volume across restarts and updates. It is deleted
only by `down -v` or an explicit `docker volume rm` — never run those unless
you mean to erase the database. Schedule a daily backup:

```bash
docker exec $(docker ps -qf name=postgres) pg_dump -U echatbotfy echatbotfy > backup_$(date +%F).sql
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| App container exits immediately / keeps restarting | `docker compose logs app` — usually a wrong `DATABASE_URL` or an unreachable database |
| `P1001: Can't reach database server` | Database host/port/firewall; from Supabase use the pooled connection string; `localhost` never refers to the host machine from inside a container |
| `P3009: migrate found failed migrations` | A previous migration attempt was left in a failed state. Inspect it and resolve with `prisma migrate resolve --applied <name>` or `--rolled-back <name>` depending on whether its changes are already present in the database — do this deliberately, it changes migration history |
| Frontend loads but API calls fail | The browser must reach port 3001 of the server (firewall / proxy config) |
| Scheduler logs show provider errors | The corresponding API key in `.env` is missing or invalid |
