#!/bin/bash

###############################################################################
# Database Backup Script - Widget Migration Support
# 
# Purpose: Create automated backup before widget migration starts
# Usage: npm run backup:db-widget
# 
# Safety checks:
# - Verifies database connection
# - Checks disk space (requires 500MB free)
# - Creates timestamped backup
# - Validates backup integrity
# - Logs all operations
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./apps/backend/prisma/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/widget_migration_backup_${TIMESTAMP}.sql"
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Database configuration (from .env)
DB_HOST="${DATABASE_URL:-localhost}"
DB_NAME="${DB_NAME:-echatbot_dev}"
DB_USER="${DB_USER:-postgres}"

echo -e "${YELLOW}🔄 Database Backup Script - Widget Migration${NC}"
echo "=========================================="

# Step 1: Create backup directory
if [ ! -d "$BACKUP_DIR" ]; then
  echo -e "${YELLOW}📁 Creating backup directory: $BACKUP_DIR${NC}"
  mkdir -p "$BACKUP_DIR"
fi

# Step 2: Check disk space (require 500MB free)
REQUIRED_SPACE=$((500 * 1024)) # 500MB in KB
AVAILABLE_SPACE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
  echo -e "${RED}❌ ERROR: Insufficient disk space${NC}" | tee -a "$LOG_FILE"
  echo "Required: 500MB, Available: $((AVAILABLE_SPACE / 1024))MB" | tee -a "$LOG_FILE"
  exit 1
fi

# Step 3: Verify database connection
echo -e "${YELLOW}🔗 Verifying database connection...${NC}"
if ! psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
  echo -e "${RED}❌ ERROR: Cannot connect to database${NC}" | tee -a "$LOG_FILE"
  echo "Check DATABASE_URL and database server status" | tee -a "$LOG_FILE"
  exit 1
fi
echo -e "${GREEN}✅ Database connection verified${NC}"

# Step 4: Create backup
echo -e "${YELLOW}💾 Creating backup to: $BACKUP_FILE${NC}"
{
  echo "-- Widget Migration Backup"
  echo "-- Created: $(date)"
  echo "-- Database: $DB_NAME"
  echo ""
  pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" --verbose
} > "$BACKUP_FILE" 2>&1

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ ERROR: Backup file not created${NC}" | tee -a "$LOG_FILE"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}✅ Backup created: $BACKUP_SIZE${NC}"

# Step 5: Validate backup integrity
echo -e "${YELLOW}🔍 Validating backup integrity...${NC}"
if head -5 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
  echo -e "${GREEN}✅ Backup integrity verified${NC}"
else
  echo -e "${RED}❌ ERROR: Backup file appears corrupted${NC}" | tee -a "$LOG_FILE"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Step 6: Create restore command
RESTORE_CMD="psql -h $DB_HOST -U $DB_USER $DB_NAME < $BACKUP_FILE"
echo ""
echo -e "${GREEN}✅ Backup Complete!${NC}"
echo "=========================================="
echo "📊 Backup Details:"
echo "  Location: $BACKUP_FILE"
echo "  Size: $BACKUP_SIZE"
echo "  Timestamp: $(date)"
echo ""
echo "📋 To restore this backup:"
echo "  $RESTORE_CMD"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Keep this backup safe until migration is complete!${NC}"

# Step 7: Save restore command to file
RESTORE_FILE="${BACKUP_DIR}/restore_${TIMESTAMP}.sh"
cat > "$RESTORE_FILE" << EOF
#!/bin/bash
# Restore script for backup: $TIMESTAMP
# Usage: bash $RESTORE_FILE

echo "Restoring backup from: $BACKUP_FILE"
echo "Warning: This will overwrite current database data!"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ \$REPLY =~ ^[Yy]$ ]]; then
  $RESTORE_CMD
  echo "✅ Restore complete!"
else
  echo "❌ Restore cancelled"
  exit 1
fi
EOF

chmod +x "$RESTORE_FILE"
echo "🔧 Restore script created: $RESTORE_FILE"

# Step 8: Cleanup old backups (keep last 5)
echo ""
echo -e "${YELLOW}🧹 Cleaning up old backups (keeping last 5)...${NC}"
cd "$BACKUP_DIR"
ls -t widget_migration_backup_*.sql 2>/dev/null | tail -n +6 | xargs -r rm -f
echo -e "${GREEN}✅ Cleanup complete${NC}"

echo ""
echo -e "${GREEN}🎉 Database backup ready for widget migration!${NC}"
