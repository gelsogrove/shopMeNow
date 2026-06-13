#!/bin/bash

# heroku-setup.sh — Adds all Heroku git remotes for the monorepo
# Run once after cloning the repo.

set -e

echo "🔧 Setting up Heroku git remotes..."

# Remove existing if present (safe re-run)
git remote remove heroku-app       2>/dev/null || true
git remote remove heroku-scheduler 2>/dev/null || true

git remote add heroku-app       https://git.heroku.com/echatbot-app.git
git remote add heroku-scheduler https://git.heroku.com/echatbot-scheduler.git

echo "✅ Heroku remotes configured:"
git remote -v | grep heroku
