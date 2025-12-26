#!/bin/bash
# 🚀 Heroku Deploy - Quick Start Script
# Esegui questo script dopo aver installato Heroku CLI

set -e  # Exit on error

echo "🚀 eChatbot - Heroku Deployment"
echo "================================"
echo ""

# 1. Login
echo "📝 Step 1: Login to Heroku"
heroku login

# 2. Crea app
echo ""
echo "🏗️ Step 2: Create Heroku app"
read -p "Enter app name (e.g., echatbot-production): " APP_NAME
heroku create $APP_NAME

# 3. Addons
echo ""
echo "🗄️ Step 3: Add PostgreSQL database"
heroku addons:create heroku-postgresql:mini -a $APP_NAME

echo ""
echo "📦 Step 4: Add Bucketeer storage"
heroku addons:create bucketeer:micro -a $APP_NAME

# Wait for addons to provision
echo "⏳ Waiting for addons to provision..."
sleep 10

# 4. Copy Bucketeer vars to AWS_* format
echo ""
echo "🔑 Step 5: Configure storage credentials"
BUCKETEER_KEY=$(heroku config:get BUCKETEER_AWS_ACCESS_KEY_ID -a $APP_NAME)
BUCKETEER_SECRET=$(heroku config:get BUCKETEER_AWS_SECRET_ACCESS_KEY -a $APP_NAME)
BUCKETEER_REGION=$(heroku config:get BUCKETEER_AWS_REGION -a $APP_NAME)
BUCKETEER_BUCKET=$(heroku config:get BUCKETEER_BUCKET_NAME -a $APP_NAME)

heroku config:set \
  AWS_ACCESS_KEY_ID="$BUCKETEER_KEY" \
  AWS_SECRET_ACCESS_KEY="$BUCKETEER_SECRET" \
  AWS_REGION="$BUCKETEER_REGION" \
  AWS_S3_BUCKET="$BUCKETEER_BUCKET" \
  -a $APP_NAME

# 5. Security config
echo ""
echo "🔐 Step 6: Configure security"
JWT_SECRET=$(openssl rand -hex 64)
heroku config:set \
  NODE_ENV=production \
  JWT_SECRET="$JWT_SECRET" \
  -a $APP_NAME

# 6. URLs
echo ""
echo "🌐 Step 7: Configure URLs"
APP_URL="https://${APP_NAME}.herokuapp.com"
heroku config:set \
  FRONTEND_URL="$APP_URL" \
  -a $APP_NAME

# 7. Admin user
echo ""
echo "👤 Step 8: Configure admin user"
read -p "Admin email: " ADMIN_EMAIL
read -sp "Admin password: " ADMIN_PASSWORD
echo ""
heroku config:set \
  ADMIN_EMAIL="$ADMIN_EMAIL" \
  ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -a $APP_NAME

# 8. OpenRouter (optional)
echo ""
read -p "OpenRouter API Key (leave empty to skip): " OPENROUTER_KEY
if [ ! -z "$OPENROUTER_KEY" ]; then
  heroku config:set OPENROUTER_API_KEY="$OPENROUTER_KEY" -a $APP_NAME
fi

# 9. Email (optional)
echo ""
read -p "Configure email? (y/n): " CONFIGURE_EMAIL
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
fi

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
echo "💰 Monthly cost: ~$15 (Dyno $5 + Postgres $5 + Bucketeer $5)"
echo ""
