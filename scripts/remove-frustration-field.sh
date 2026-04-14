#!/bin/bash
# Script to remove all frustrationEscalationInstructions references from codebase

set -e

echo "🧹 Removing frustrationEscalationInstructions from codebase..."

# Backend controllers - remove property lines
find apps/backend/src/interfaces/http/controllers -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions:/d' {} \;

# Backend services - remove property lines  
find apps/backend/src/services -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions:/d' {} \;
find apps/backend/src/application/services -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Backend domain/entities - remove getter
find apps/backend/src/domain -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Backend calling functions  
find apps/backend/src/domain/calling-functions -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Backend agents
find apps/backend/src/application/agents -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Backend repositories
find apps/backend/src/repositories -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Frontend components  
find apps/frontend/src -name "*.tsx" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;
find apps/frontend/src -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Backoffice
find apps/backoffice/src -name "*.tsx" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Tests
find apps/backend/__tests__ -name "*.ts" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;
find apps/frontend/__tests__ -name "*.tsx" -type f -exec sed -i '' '/frustrationEscalationInstructions/d' {} \;

# Seed file - remove from workspace creation
sed -i '' '/frustrationEscalationInstructions:/,/^[[:space:]]*$/d' packages/database/prisma/seed.ts

echo "✅ Removed all frustrationEscalationInstructions references"
echo "📝 Next: Run migration and generate Prisma client"
