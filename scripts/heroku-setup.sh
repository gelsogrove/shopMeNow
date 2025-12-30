#!/bin/bash
# 🚀 Heroku Setup - eChatbot (3 Apps)
# Script COMPLETO per setup iniziale di tutte le 3 app Heroku

set -e  # Exit on error

echo "🚀 eChatbot - Heroku Setup Completo (3 Apps)"
echo "=============================================="
echo ""

# 1. Login
echo "📝 Step 1/8: Login to Heroku"
heroku login

# 2. Crea 3 app
echo ""
echo "🏗️ Step 2/8: Create 3 Heroku apps"
echo "──────────────────────────────────────────────────────"
read -p "App name principale (Backend+Frontend) [echatbot-app]: " APP_NAME
APP_NAME=${APP_NAME:-echatbot-app}

BACKOFFICE_NAME="${APP_NAME%-app}-backoffice"
SCHEDULER_NAME="${APP_NAME%-app}-scheduler"

echo "Creo 3 app:"
echo "  1. $APP_NAME (Backend + Frontend monolith)"
echo "  2. $BACKOFFICE_NAME (Admin Panel)"
echo "  3. $SCHEDULER_NAME (Worker)"
echo ""

heroku create $APP_NAME
heroku create $BACKOFFICE_NAME
heroku create $SCHEDULER_NAME

# 3. Aggiungi remote Git
echo ""
echo "🔗 Step 3/8: Add Git remotes"
git remote add heroku-app https://git.heroku.com/${APP_NAME}.git || echo "Remote heroku-app già esiste"
git remote add heroku-backoffice https://git.heroku.com/${BACKOFFICE_NAME}.git || echo "Remote heroku-backoffice già esiste"
git remote add heroku-scheduler https://git.heroku.com/${SCHEDULER_NAME}.git || echo "Remote heroku-scheduler già esiste"

echo "✅ Git remotes configurati!"

# 4. Database condiviso
echo ""
echo "🗄️ Step 4/8: Add PostgreSQL database (condiviso tra le 3 app)"
heroku addons:create heroku-postgresql:mini -a $APP_NAME

echo "⏳ Waiting for database to provision..."
sleep 15

# Condividi DATABASE_URL con tutte le app
DATABASE_URL=$(heroku config:get DATABASE_URL -a $APP_NAME)
heroku config:set DATABASE_URL="$DATABASE_URL" -a $BACKOFFICE_NAME
heroku config:set DATABASE_URL="$DATABASE_URL" -a $SCHEDULER_NAME

echo "✅ Database condiviso tra tutte le 3 app!"

# 5. Security config
echo ""
echo "🔐 Step 5/8: Configure security"
JWT_SECRET=$(openssl rand -hex 64)
APP_URL="https://${APP_NAME}.herokuapp.com"

# Configura APP principale (Backend + Frontend)
heroku config:set \
  NODE_ENV=production \
  JWT_SECRET="$JWT_SECRET" \
  FRONTEND_URL="$APP_URL" \
  VITE_API_URL="$APP_URL" \
  -a $APP_NAME

# Configura Backoffice
heroku config:set \
  VITE_API_URL="$APP_URL" \
  -a $BACKOFFICE_NAME

# Configura Scheduler
heroku config:set \
  API_URL="$APP_URL" \
  -a $SCHEDULER_NAME

echo "✅ Configurazione base completata!"

# 6. Storage (Cloudinary)
echo ""
echo "☁️ Step 6/8: Storage Setup"
echo "──────────────────────────────────────────────────────"
echo "⚠️  CLOUDINARY MANUALE:"
echo "1. Sign up: https://cloudinary.com/users/register/free"
echo "2. Get credentials: https://cloudinary.com/console"
echo "3. Run: heroku config:set -a $APP_NAME CLOUDINARY_URL='cloudinary://...'"

# 7. LLM (OpenRouter)
echo ""
echo "🤖 Step 7/8: OpenRouter API Key (LLM)"
read -p "OpenRouter API Key (leave empty to skip): " OPENROUTER_KEY
if [ ! -z "$OPENROUTER_KEY" ]; then
  heroku config:set OPENROUTER_API_KEY="$OPENROUTER_KEY" -a $APP_NAME
  echo "✅ OpenRouter configurato!"
fi

# 8. Email (optional)
echo ""
echo "📧 Step 8/8: Email Configuration (optional)"
read -p "Configure email now? (y/n) [n]: " CONFIGURE_EMAIL
if [ "$CONFIGURE_EMAIL" = "y" ]; then
  read -p "SMTP Host (e.g., smtp.gmail.com): " EMAIL_HOST
  read -p "SMTP Port (e.g., 587): " EMAIL_PORT
  read -p "Email User: " EMAIL_USER
  read -sp "Email Password: " EMAIL_PASSWORD
  echo ""
  read -p "From address: " EMAIL_FROM
  
  heroku config:set \
    EMAIL_HOST="$EMAIL_HOST" \
    EMAIL_PORT="$EMAIL_PORT" \
    EMAIL_USER="$EMAIL_USER" \
    EMAIL_PASSWORD="$EMAIL_PASSWORD" \
    EMAIL_FROM="$EMAIL_FROM" \
    -a $APP_NAME
  
  echo "✅ Email configurato!"
fi

# Summary
echo ""
echo "🎉 ✅ SETUP COMPLETATO!"
echo "=============================================="
echo ""
echo "📋 Riepilogo:"
echo "  🌐 App principale: https://${APP_NAME}.herokuapp.com"
echo "  🌐 Backoffice:     https://${BACKOFFICE_NAME}.herokuapp.com"
echo "  🌐 Scheduler:      ${SCHEDULER_NAME} (worker, no URL)"
echo ""
echo "📝 Prossimi step:"
echo "  1. Deploy: ./scripts/deploy-all-heroku.sh"
echo "  2. Migrations: heroku run 'npx prisma migrate deploy' -a $APP_NAME"
echo "  3. Seed: heroku run 'npm run prisma:seed:production' -a $APP_NAME"
echo "  4. Verifica: heroku open -a $APP_NAME"
echo ""
echo "📊 Monitora logs:"
echo "  heroku logs --tail -a $APP_NAME"
echo "  heroku logs --tail -a $BACKOFFICE_NAME"
echo "  heroku logs --tail -a $SCHEDULER_NAME"

# 10. Summary
echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review config: heroku config -a $APP_NAME"
echo "  2. Deploy: git push heroku main"
echo "  3. View logs: heroku logs --tail -a $APP_NAME"
echo "  4. Open app: heroku open -a $APP_NAME"
echo ""
echo "🔗 App URL: $APP_URL"
echo "📊 Dashboard: https://dashboard.heroku.com/apps/$APP_NAME"
echo ""
echo "💰 Monthly cost: ~$10 (Dyno $5 + Postgres $5)"
echo ""
