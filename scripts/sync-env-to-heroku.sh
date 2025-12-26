#!/bin/bash
# 🔄 Sync .env to Heroku Config
# Copia tutte le variabili dal file .env locale a Heroku
# Usage: ./scripts/sync-env-to-heroku.sh [app-name]

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 eChatbot - Sync .env to Heroku${NC}"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${RED}❌ Error: .env file not found!${NC}"
  echo "Please create .env file first (copy from .env.example)"
  exit 1
fi

# Get app name
if [ -z "$1" ]; then
  read -p "Enter Heroku app name: " APP_NAME
else
  APP_NAME=$1
fi

if [ -z "$APP_NAME" ]; then
  echo -e "${RED}❌ Error: App name required!${NC}"
  exit 1
fi

# Verify app exists
if ! heroku apps:info -a "$APP_NAME" &> /dev/null; then
  echo -e "${RED}❌ Error: App '$APP_NAME' not found!${NC}"
  echo "Create it first with: heroku create $APP_NAME"
  exit 1
fi

echo -e "${GREEN}✅ Found Heroku app: $APP_NAME${NC}"
echo ""

# Variables to SKIP (managed by Heroku addons or should be different in production)
SKIP_VARS=(
  "PORT"                    # Heroku sets this automatically
  "DATABASE_URL"            # From Postgres addon
  "BUCKETEER_AWS_ACCESS_KEY_ID"    # From Bucketeer addon
  "BUCKETEER_AWS_SECRET_ACCESS_KEY" # From Bucketeer addon
  "BUCKETEER_AWS_REGION"    # From Bucketeer addon
  "BUCKETEER_BUCKET_NAME"   # From Bucketeer addon
  "UPLOADS_DIR"             # Only for local dev
  "UPLOADS_URL"             # Only for local dev
)

# Variables to WARN about (should be changed for production)
WARN_VARS=(
  "ADMIN_PASSWORD"
  "JWT_SECRET"
  "SMTP_PASS"
  "OPENROUTER_API_KEY"
  "WHATSAPP_ACCESS_TOKEN"
  "GOOGLE_CLIENT_SECRET"
  "AWS_SECRET_ACCESS_KEY"
)

# Read .env file and prepare config vars
declare -A config_vars
skipped_count=0
warning_count=0

echo -e "${BLUE}📖 Reading .env file...${NC}"
echo ""

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
    continue
  fi
  
  # Remove leading/trailing whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  
  # Remove quotes from value
  value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
  
  # Skip empty values
  if [[ -z $value ]]; then
    continue
  fi
  
  # Check if should skip
  skip=false
  for skip_var in "${SKIP_VARS[@]}"; do
    if [[ "$key" == "$skip_var" ]]; then
      echo -e "${YELLOW}⏭️  Skipping $key (managed by Heroku/addon)${NC}"
      ((skipped_count++))
      skip=true
      break
    fi
  done
  
  if [ "$skip" = true ]; then
    continue
  fi
  
  # Check if should warn
  for warn_var in "${WARN_VARS[@]}"; do
    if [[ "$key" == "$warn_var" ]]; then
      echo -e "${YELLOW}⚠️  Warning: $key contains sensitive data${NC}"
      ((warning_count++))
      break
    fi
  done
  
  # Add to config
  config_vars["$key"]="$value"
  
done < .env

echo ""
echo -e "${GREEN}✅ Found ${#config_vars[@]} variables to sync${NC}"
echo -e "${YELLOW}⏭️  Skipped $skipped_count variables (Heroku-managed)${NC}"

if [ $warning_count -gt 0 ]; then
  echo -e "${YELLOW}⚠️  $warning_count sensitive variables detected${NC}"
fi

echo ""

# Confirm before proceeding
echo -e "${YELLOW}⚠️  This will UPDATE Heroku config for app: $APP_NAME${NC}"
echo "Variables to set:"
for key in "${!config_vars[@]}"; do
  # Mask sensitive values
  if [[ " ${WARN_VARS[@]} " =~ " ${key} " ]]; then
    echo "  - $key=***MASKED***"
  else
    value="${config_vars[$key]}"
    if [ ${#value} -gt 50 ]; then
      echo "  - $key=${value:0:50}..."
    else
      echo "  - $key=$value"
    fi
  fi
done

echo ""
read -p "Continue? (y/n): " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
  echo -e "${RED}❌ Aborted${NC}"
  exit 0
fi

# Set variables on Heroku
echo ""
echo -e "${BLUE}🚀 Syncing to Heroku...${NC}"
echo ""

success_count=0
fail_count=0

for key in "${!config_vars[@]}"; do
  value="${config_vars[$key]}"
  
  if heroku config:set "$key=$value" -a "$APP_NAME" &> /dev/null; then
    echo -e "${GREEN}✅ Set $key${NC}"
    ((success_count++))
  else
    echo -e "${RED}❌ Failed to set $key${NC}"
    ((fail_count++))
  fi
done

# Summary
echo ""
echo "================================"
echo -e "${GREEN}✅ Sync complete!${NC}"
echo "  - Success: $success_count variables"
if [ $fail_count -gt 0 ]; then
  echo -e "  - ${RED}Failed: $fail_count variables${NC}"
fi
echo ""

# Show current config
echo -e "${BLUE}📋 Current Heroku config:${NC}"
heroku config -a "$APP_NAME"

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "1. Verify NODE_ENV=production (not from .env)"
echo "2. Verify DATABASE_URL is set (from Postgres addon)"
echo "3. Verify Bucketeer vars are set (from addon)"
echo "4. Verify FRONTEND_URL matches your Heroku domain"
echo ""
echo -e "${GREEN}✅ All done!${NC}"
