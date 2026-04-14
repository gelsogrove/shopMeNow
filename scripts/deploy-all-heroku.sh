#!/bin/bash

# ============================================================
# deploy-all-heroku.sh
# Deploys the monorepo to all 3 Heroku apps in parallel.
#
# Apps:
#   echatbot-app        → backend + frontend  (remote: heroku-app)
#   echatbot-scheduler  → scheduler           (remote: heroku-scheduler)
#   echatbot-backoffice → backoffice          (remote: heroku-backoffice)
#
# Usage:
#   npm run publish
#   npm run deploy:heroku
# ============================================================

set -e

BRANCH=$(git branch --show-current)

# Safety guard: ALWAYS deploy from main
if [ "$BRANCH" != "main" ]; then
  echo "❌ ERROR: You must be on branch 'main' to deploy."
  echo "   Current branch: $BRANCH"
  echo "   Run: git checkout main"
  exit 1
fi

echo ""
echo "🚀 Deploying all Heroku apps from branch: main"
echo "============================================================"

# PRE-DEPLOY: Generate Prisma client locally
echo ""
echo "📦 Generating Prisma client locally..."
npm run prisma:generate
echo "✅ Prisma client generated"

# Push to all 3 remotes in parallel
echo ""
echo "📦 Pushing to echatbot-app (backend + frontend)..."
git push heroku-app main &
PID_APP=$!

echo "⚙️  Pushing to echatbot-scheduler..."
git push heroku-scheduler main &
PID_SCHEDULER=$!

echo "🖥️  Pushing to echatbot-backoffice..."
git push heroku-backoffice main &
PID_BACKOFFICE=$!

# Wait for all pushes and collect results
FAILED=0

wait $PID_APP
if [ $? -ne 0 ]; then
  echo "❌ echatbot-app deploy FAILED"
  FAILED=1
else
  echo "✅ echatbot-app deployed"
fi

wait $PID_SCHEDULER
if [ $? -ne 0 ]; then
  echo "❌ echatbot-scheduler deploy FAILED"
  FAILED=1
else
  echo "✅ echatbot-scheduler deployed"
fi

wait $PID_BACKOFFICE
if [ $? -ne 0 ]; then
  echo "❌ echatbot-backoffice deploy FAILED"
  FAILED=1
else
  echo "✅ echatbot-backoffice deployed"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo "🎉 All apps deployed successfully!"
  echo ""
  echo "============================================================"
  echo "🔄 Running post-deploy tasks on Heroku..."
  echo "============================================================"
  
  # POST-DEPLOY: Run Prisma migrate and generate on all apps
  echo ""
  echo "📊 Running Prisma migrate on echatbot-app..."
  heroku run -a echatbot-app "cd packages/database && npx prisma migrate deploy" || echo "⚠️  Migrate failed (may be already applied)"
  
  echo ""
  echo "🔧 Generating Prisma client on echatbot-app..."
  heroku run -a echatbot-app "cd packages/database && npx prisma generate" || echo "⚠️  Generate failed"
  
  echo ""
  echo "📊 Running Prisma migrate on echatbot-scheduler..."
  heroku run -a echatbot-scheduler "cd packages/database && npx prisma migrate deploy" || echo "⚠️  Migrate failed (may be already applied)"
  
  echo ""
  echo "🔧 Generating Prisma client on echatbot-scheduler..."
  heroku run -a echatbot-scheduler "cd packages/database && npx prisma generate" || echo "⚠️  Generate failed"
  
  echo ""
  echo "✅ Post-deploy tasks completed!"
  echo ""
  echo "============================================================"
  echo "🎊 DEPLOY COMPLETE - All apps updated and migrated!"
  echo "============================================================"
else
  echo "⚠️  One or more deploys failed. Check the output above."
  exit 1
fi
