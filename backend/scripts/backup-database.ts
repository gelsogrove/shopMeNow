/**
 * DATABASE BACKUP - Export current database to SQL file
 * 
 * Creates a timestamped backup in backend/backups/
 * Can be restored using: npm run db:restore backup-YYYY-MM-DD.sql
 * 
 * Usage: npm run db:backup
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

const BACKUP_DIR = path.join(__dirname, "../backups")
const DB_USER = process.env.POSTGRES_USER || "shopmefy"
const DB_NAME = process.env.POSTGRES_DB || "shopmefy"
const DB_HOST = process.env.POSTGRES_HOST || "localhost"
const DB_PORT = process.env.POSTGRES_PORT || "5434"

async function backupDatabase() {
  console.log("💾 DATABASE BACKUP STARTING...")
  console.log("=" .repeat(50))

  // Create backups directory if not exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    console.log(`✅ Created backups directory: ${BACKUP_DIR}`)
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const filename = `backup-${timestamp}.sql`
  const filepath = path.join(BACKUP_DIR, filename)

  try {
    console.log(`\n📦 Backing up database: ${DB_NAME}`)
    console.log(`📁 Destination: ${filepath}`)

    // Execute pg_dump via docker
    const command = `docker exec shop_db pg_dump -U ${DB_USER} -d ${DB_NAME} -F p -f /tmp/${filename} && docker cp shop_db:/tmp/${filename} ${filepath}`

    execSync(command, { stdio: "inherit" })

    const stats = fs.statSync(filepath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)

    console.log("\n" + "=".repeat(50))
    console.log("✅ BACKUP COMPLETED SUCCESSFULLY!")
    console.log(`   📁 File: ${filename}`)
    console.log(`   💾 Size: ${fileSizeMB} MB`)
    console.log(`   📂 Location: ${BACKUP_DIR}`)
    console.log("\n💡 To restore this backup, run:")
    console.log(`   npm run db:restore ${filename}`)

    // List all backups
    console.log("\n📋 Available backups:")
    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .reverse()
      .slice(0, 5) // Show last 5 backups

    backups.forEach((backup) => {
      const backupPath = path.join(BACKUP_DIR, backup)
      const backupStats = fs.statSync(backupPath)
      const sizeMB = (backupStats.size / (1024 * 1024)).toFixed(2)
      const date = new Date(backupStats.mtime).toLocaleString()
      console.log(`   - ${backup} (${sizeMB} MB, ${date})`)
    })
  } catch (error) {
    console.error("❌ Backup failed:", error)
    throw error
  }
}

backupDatabase()
  .then(() => {
    console.log("\n🎉 Done!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
