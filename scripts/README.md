## Scripts

Quick guide to the maintenance scripts in this folder.

### deploy-all-heroku.sh
- Purpose: Deploy all three Heroku apps (app/backoffice/scheduler).
- Use when: You want a full release after a successful `npm run build`.
- Requires: Heroku remotes `heroku-app`, `heroku-backoffice`, `heroku-scheduler`.

### heroku-setup.sh
- Purpose: One-time setup for Heroku (create apps, database, base config).
- Use when: First-time infrastructure bootstrap.
- Note: Interactive; creates three apps and shared DB.

### sync-env-to-heroku.sh
- Purpose: Sync local `.env` variables to a Heroku app config.
- Use when: You add or change env vars locally and need them on Heroku.
- Note: Skips Heroku-managed vars like `DATABASE_URL`.

### kill-ports.sh
- Purpose: Free local dev ports used by the monorepo.
- Use when: Local dev processes are stuck on ports.
