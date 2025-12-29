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

# Wait for addons to provision
echo "⏳ Waiting for database to provision..."
sleep 10

# 4. Cloudinary setup (manual)
echo ""
echo "☁️ Step 4: Cloudinary Storage Setup"
echo "──────────────────────────────────────────────────────"
echo "⚠️  MANUAL STEP REQUIRED:"
echo "1. Sign up at https://cloudinary.com/users/register/free"
echo "2. Get credentials from https://cloudinary.com/console"
echo "3. Run: heroku config:set -a $APP_NAME \\"
echo "     CLOUDINARY_CLOUD_NAME='your_cloud_name' \\"
echo "     CLOUDINARY_API_KEY='your_api_key' \\"
echo "     CLOUDINARY_API_SECRET='your_api_secret' \\"
echo "     CLOUDINARY_URL='cloudinary://api_key:api_secret@cloud_name'"
echo "──────────────────────────────────────────────────────"
echo ""
read -p "Press ENTER after setting Cloudinary credentials..."

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
