#!/bin/bash

# 🚀 PRODUCTION DEPLOYMENT SCRIPT
# Interactive guided deployment to Heroku with safety checks
# Author: Andrea Gelso
# Usage: bash scripts/deploy-production.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 PRODUCTION DEPLOYMENT WIZARD${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to ask yes/no questions
ask_yes_no() {
    local prompt="$1"
    local response
    while true; do
        read -p "$(echo -e ${YELLOW}${prompt}${NC} [y/n]: )" response
        case $response in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo -e "${RED}Please answer yes (y) or no (n).${NC}";;
        esac
    done
}

# 1. CHECK GIT STATUS
echo -e "${BLUE}📋 STEP 1: Checking git status...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes:${NC}"
    git status --short
    echo ""
    
    if ask_yes_no "Do you want to commit these changes?"; then
        read -p "$(echo -e ${YELLOW}Enter commit message:${NC} )" commit_msg
        
        if [ -z "$commit_msg" ]; then
            echo -e "${RED}❌ Commit message cannot be empty. Aborting.${NC}"
            exit 1
        fi
        
        git add -A
        git commit -m "$commit_msg"
        echo -e "${GREEN}✅ Changes committed${NC}"
    else
        if ask_yes_no "Do you want to RESET and discard all changes? (DANGER)"; then
            echo -e "${RED}⚠️  WARNING: This will permanently delete uncommitted changes!${NC}"
            if ask_yes_no "Are you ABSOLUTELY SURE?"; then
                git reset --hard HEAD
                git clean -fd
                echo -e "${GREEN}✅ Repository reset to last commit${NC}"
            else
                echo -e "${YELLOW}❌ Reset cancelled. Please commit or stash changes manually.${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}❌ Please commit or stash changes before deploying.${NC}"
            exit 1
        fi
    fi
else
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
fi
echo ""

# 2. CHECK BRANCH
echo -e "${BLUE}📋 STEP 2: Checking current branch...${NC}"
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo -e "Current branch: ${GREEN}${current_branch}${NC}"

if [ "$current_branch" != "main" ]; then
    echo -e "${YELLOW}⚠️  You are not on 'main' branch!${NC}"
    if ! ask_yes_no "Do you want to deploy from '${current_branch}' anyway?"; then
        echo -e "${YELLOW}❌ Deployment cancelled. Switch to main branch first.${NC}"
        exit 1
    fi
fi
echo ""

# 3. DATABASE MIGRATION CHECK
echo -e "${BLUE}📋 STEP 3: Database migration check...${NC}"
if ask_yes_no "Do you need to run Prisma MIGRATE in production?"; then
    echo -e "${YELLOW}⚠️  This will modify production database schema!${NC}"
    if ask_yes_no "Are you SURE you want to run migrations in production?"; then
        echo -e "${BLUE}📝 Generating migration SQL...${NC}"
        cd apps/backend
        npx prisma migrate diff \
          --from-schema-datamodel prisma/schema.prisma \
          --to-schema-datasource prisma/schema.prisma \
          --script > migration-preview.sql 2>/dev/null || true
        
        if [ -f migration-preview.sql ] && [ -s migration-preview.sql ]; then
            echo -e "${YELLOW}Preview of SQL changes:${NC}"
            cat migration-preview.sql
            echo ""
            
            if ask_yes_no "Execute these migrations on Heroku database?"; then
                heroku run -a echatbot-app "cd apps/backend && npx prisma migrate deploy"
                echo -e "${GREEN}✅ Migrations executed in production${NC}"
            else
                echo -e "${YELLOW}⏭️  Migrations skipped${NC}"
            fi
            rm -f migration-preview.sql
        else
            echo -e "${GREEN}✅ Database schema is up to date${NC}"
        fi
        cd ../..
    else
        echo -e "${YELLOW}⏭️  Migrations skipped${NC}"
    fi
else
    echo -e "${GREEN}✅ No migrations needed${NC}"
fi
echo ""

# 4. PRISMA GENERATE
echo -e "${BLUE}📋 STEP 4: Prisma client generation...${NC}"
if ask_yes_no "Do you need to regenerate Prisma client?"; then
    cd apps/backend
    npx prisma generate
    cd ../..
    echo -e "${GREEN}✅ Prisma client regenerated${NC}"
else
    echo -e "${GREEN}✅ Using existing Prisma client${NC}"
fi
echo ""

# 5. BUILD CHECK
echo -e "${BLUE}📋 STEP 5: Build verification...${NC}"
if ask_yes_no "Test build locally before deploy?"; then
    echo -e "${BLUE}🔨 Building backend...${NC}"
    cd apps/backend
    if npm run build; then
        echo -e "${GREEN}✅ Backend builds successfully${NC}"
    else
        echo -e "${RED}❌ Backend build failed!${NC}"
        cd ../..
        exit 1
    fi
    cd ../..
    
    echo -e "${BLUE}🔨 Building frontend...${NC}"
    cd apps/frontend
    if npm run build; then
        echo -e "${GREEN}✅ Frontend builds successfully${NC}"
    else
        echo -e "${RED}❌ Frontend build failed!${NC}"
        cd ../..
        exit 1
    fi
    cd ../..
    
    echo -e "${BLUE}🔨 Building scheduler...${NC}"
    cd apps/scheduler
    if npm run build; then
        echo -e "${GREEN}✅ Scheduler builds successfully${NC}"
    else
        echo -e "${RED}❌ Scheduler build failed!${NC}"
        cd ../..
        exit 1
    fi
    cd ../..
else
    echo -e "${YELLOW}⏭️  Local builds skipped${NC}"
fi
echo ""

# 6. RUN TESTS
echo -e "${BLUE}📋 STEP 6: Running tests...${NC}"
if ask_yes_no "Run all tests before deploy?"; then
    # Backend tests
    echo -e "${BLUE}🧪 Running backend unit tests...${NC}"
    cd apps/backend
    if npm run test:unit; then
        echo -e "${GREEN}✅ Backend tests passed${NC}"
    else
        echo -e "${RED}❌ Backend tests failed!${NC}"
        cd ../..
        if ! ask_yes_no "Continue anyway? (NOT RECOMMENDED)"; then
            echo -e "${RED}❌ Deployment cancelled due to test failures${NC}"
            exit 1
        fi
    fi
    cd ../..
    
    # Frontend tests
    echo -e "${BLUE}🧪 Running frontend tests...${NC}"
    cd apps/frontend
    if npm test -- --run; then
        echo -e "${GREEN}✅ Frontend tests passed${NC}"
    else
        echo -e "${RED}❌ Frontend tests failed!${NC}"
        cd ../..
        if ! ask_yes_no "Continue anyway? (NOT RECOMMENDED)"; then
            echo -e "${RED}❌ Deployment cancelled due to test failures${NC}"
            exit 1
        fi
    fi
    cd ../..
    
    # Scheduler tests
    echo -e "${BLUE}🧪 Running scheduler tests...${NC}"
    cd apps/scheduler
    if npm test; then
        echo -e "${GREEN}✅ Scheduler tests passed${NC}"
    else
        echo -e "${RED}❌ Scheduler tests failed!${NC}"
        cd ../..
        if ! ask_yes_no "Continue anyway? (NOT RECOMMENDED)"; then
            echo -e "${RED}❌ Deployment cancelled due to test failures${NC}"
            exit 1
        fi
    fi
    cd ../..
    
    echo -e "${GREEN}✅ All tests completed${NC}"
else
    echo -e "${YELLOW}⏭️  Tests skipped${NC}"
fi
echo ""

# 7. ENVIRONMENT CHECK
echo -e "${BLUE}📋 STEP 7: Environment check...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ .env file exists${NC}"

# Check critical env vars (without showing values)
required_vars=("DATABASE_URL" "OPENROUTER_API_KEY" "JWT_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing environment variables:${NC}"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi
echo -e "${GREEN}✅ Critical environment variables present${NC}"
echo ""

# 8. HEROKU CHECK
echo -e "${BLUE}📋 STEP 8: Heroku connection check...${NC}"
if heroku apps:info -a echatbot-app &>/dev/null; then
    echo -e "${GREEN}✅ Connected to Heroku app: echatbot-app${NC}"
else
    echo -e "${RED}❌ Cannot connect to Heroku app${NC}"
    exit 1
fi
echo ""

# 9. DEPLOYMENT CONFIRMATION
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  FINAL CONFIRMATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}You are about to deploy to PRODUCTION:${NC}"
echo -e "  • App: ${GREEN}echatbot-app${NC}"
echo -e "  • Branch: ${GREEN}${current_branch}${NC}"
echo -e "  • Last commit: ${GREEN}$(git log -1 --pretty=format:'%h - %s')${NC}"
echo ""

if ! ask_yes_no "🚀 DEPLOY TO PRODUCTION NOW?"; then
    echo -e "${YELLOW}❌ Deployment cancelled by user${NC}"
    exit 0
fi

# 10. DEPLOY
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 DEPLOYING TO PRODUCTION...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

git push heroku ${current_branch}:main

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETED!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 11. POST-DEPLOYMENT
if ask_yes_no "View Heroku logs now?"; then
    heroku logs -a echatbot-app --tail
fi

echo ""
echo -e "${BLUE}📝 Deployment summary:${NC}"
echo -e "  • Time: ${GREEN}$(date)${NC}"
echo -e "  • Branch: ${GREEN}${current_branch}${NC}"
echo -e "  • Commit: ${GREEN}$(git log -1 --pretty=format:'%h - %s')${NC}"
echo -e "  • App URL: ${GREEN}https://echatbot-app-1cba28556df2.herokuapp.com/${NC}"
echo ""
echo -e "${GREEN}🎉 Have a great day, Andrea!${NC}"
