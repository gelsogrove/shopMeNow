# Scripts

Utility scripts for development and deployment.

## Files

| Script | Description |
|--------|-------------|
| `deploy-all-heroku.sh` | Deploys the monorepo to all 3 Heroku apps (backend, scheduler, backoffice) in parallel |
| `heroku-setup.sh` | Adds Heroku git remotes. Run once after cloning the repo |
| `kill-ports.sh` | Kills processes on dev ports 3000 and 3001 |
| `publish.sh` | Smart publish: checks, builds, tests, and deploys safely to Heroku |
