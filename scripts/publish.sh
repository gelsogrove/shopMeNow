#!/bin/bash

# 🚀 eChatbot Smart Publish Script
# Checks, builds, tests, and deploys safely to Heroku

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 eChatbot Smart Publish Script      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Step 1: Verify we're on main branch
echo -e "${YELLOW}[1/8] Verifying branch...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}❌ ERROR: You must be on 'main' branch, currently on '$CURRENT_BRANCH'${NC}"
    exit 1
fi
echo -e "${GREEN}✅ On main branch${NC}\n"

# Step 2: Check for uncommitted changes
echo -e "${YELLOW}[2/8] Checking for changes...${NC}"
if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
else
    echo -e "${RED}❌ ERROR: You have uncommitted changes. Stash or commit them first.${NC}"
    git status
    exit 1
fi
echo ""

# Step 3: Run linter (ESLint)
echo -e "${YELLOW}[3/8] Running linter...${NC}"
if npm run lint 2>&1; then
    echo -e "${GREEN}✅ Lint passed${NC}\n"
else
    echo -e "${RED}❌ LINT FAILED${NC}"
    echo -e "${RED}Fix lint errors and try again${NC}"
    exit 1
fi

# Step 4: Run tests
echo -e "${YELLOW}[4/8] Running unit tests...${NC}"
if npm run test:unit 2>&1; then
    echo -e "${GREEN}✅ Tests passed${NC}\n"
else
    echo -e "${RED}❌ TESTS FAILED${NC}"
    echo -e "${RED}Fix test failures and try again${NC}"
    exit 1
fi

# Step 5: Generate Prisma client
echo -e "${YELLOW}[5/8] Generating Prisma client...${NC}"
if npm run prisma:generate 2>&1; then
    echo -e "${GREEN}✅ Prisma generated${NC}\n"
else
    echo -e "${RED}❌ PRISMA GENERATION FAILED${NC}"
    exit 1
fi

# Step 6: Build all packages
echo -e "${YELLOW}[6/8] Building all packages...${NC}"
if npm run build 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}\n"
else
    echo -e "${RED}❌ BUILD FAILED${NC}"
    echo -e "${RED}Fix build errors and try again${NC}"
    exit 1
fi

# Step 7: Commit any generated changes (Prisma files, etc)
echo -e "${YELLOW}[7/8] Checking for generated files...${NC}"
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Found generated changes, committing...${NC}"
    git add -A
    git commit -m "chore: update generated files (prisma, build artifacts)"
    echo -e "${GREEN}✅ Generated files committed${NC}\n"
else
    echo -e "${GREEN}✅ No new generated files${NC}\n"
fi

# Step 8: Push to Heroku
echo -e "${YELLOW}[8/8] Pushing to Heroku...${NC}"
if git push heroku main 2>&1; then
    echo -e "${GREEN}✅ Deployed to Heroku successfully!${NC}\n"
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  🎉 PUBLISH COMPLETE!                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}❌ HEROKU PUSH FAILED${NC}"
    echo -e "${RED}Check Heroku logs: heroku logs --tail${NC}"
    exit 1
fi
