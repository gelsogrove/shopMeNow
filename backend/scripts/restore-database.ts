/**
 * DATABASE RESTORE - Restore database from backup file
 * 
 * Restores a backup created with npm run db:backup
 * 
 * Usage: npm run db:restore backup-2025-10-15.sql
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

const BACKUP_DIR = path.join(__dirname, "../backups")
const DB_USER = process.env.POSTGRES_USER || "shopmefy"
const DB_NAME = process.env.POSTGRES_DB || "shopmefy"

async function restoreDatabase() {
  const backupFile = process.argv[2]

  if (!backupFile) {
    console.error("❌ Error: Please specify a backup file")
    console.log("\n📋 Available backups:")

    if (fs.existsSync(BACKUP_DIR)) {
      const backups = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .reverse()

      if (backups.length === 0) {
        console.log("   No backups found. Create one with: npm run db:backup")
      } else {
        backups.forEach((backup) => {
          console.log(`   - ${backup}`)
        })
        console.log("\n💡 Usage: npm run db:restore backup-YYYY-MM-DD.sql")
      }
    } else {
      console.log("   No backups directory found")
    }

    process.exit(1)
  }

  const filepath = path.join(BACKUP_DIR, backupFile)

  if (!fs.existsSync(filepath)) {
    console.error(`❌ Backup file not found: ${filepath}`)
    process.exit(1)
  }

  console.log("🔄 DATABASE RESTORE STARTING...")
  console.log("=" .repeat(50))
  console.log(`📁 Restoring from: ${backupFile}`)
  console.log("\n⚠️  WARNING: This will OVERWRITE the current database!")
  console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...")

  // Wait 5 seconds before proceeding
  await new Promise((resolve) => setTimeout(resolve, 5000))

  try {
    console.log("\n🗑️  Dropping and recreating database...")

    // Copy backup file to container and restore
    const command = `docker cp ${filepath} shop_db:/tmp/${backupFile} && docker exec shop_db psql -U ${DB_USER} -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" && docker exec shop_db psql -U ${DB_USER} -d postgres -c "CREATE DATABASE ${DB_NAME};" && docker exec shop_db psql -U ${DB_USER} -d ${DB_NAME} -f /tmp/${backupFile}`

    execSync(command, { stdio: "inherit" })

    console.log("\n" + "=".repeat(50))
    console.log("✅ RESTORE COMPLETED SUCCESSFULLY!")
    console.log(`   Database ${DB_NAME} restored from ${backupFile}`)
  } catch (error) {
    console.error("❌ Restore failed:", error)
    throw error
  }
}

restoreDatabase()
  .then(() => {
    console.log("\n🎉 Done!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
