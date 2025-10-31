/**
 * RESTORE WORKSPACE-SPECIFIC BACKUP
 *
 * Restores a workspace from its latest backup.
 * Only affects the specified workspace - other workspaces remain untouched.
 *
 * Usage: ts-node scripts/restore-workspace-backup.ts <workspaceId>
 *
 * Security: Only restores data for the specified workspace
 * WARNING: This will DELETE and REPLACE all current workspace data!
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as fse from "fs-extra"
import * as path from "path"

const prisma = new PrismaClient()

interface BackupData {
  workspaceId: string
  timestamp: string
  version: string
  data: {
    workspace: any
    agentConfigs: any[]
    products: any[]
    categories: any[]
    customers: any[]
    orders: any[]
    cartItems: any[]
    services: any[]
    suppliers: any[]
    faqs: any[]
    offers: any[]
    settings: any[]
  }
}

async function restoreWorkspaceBackup(workspaceId: string): Promise<void> {
  console.log(`\n📥 Starting restore for workspace: ${workspaceId}`)

  try {
    // Find latest backup
    const backupBaseDir = path.join(__dirname, "../prisma/backups", workspaceId)
    const latestLink = path.join(backupBaseDir, "latest")

    if (!fs.existsSync(latestLink)) {
      throw new Error(`No backup found for workspace ${workspaceId}`)
    }

    const backupDir = fs.realpathSync(latestLink)
    const backupFile = path.join(backupDir, "backup.json")

    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`)
    }

    console.log(`📁 Loading backup from: ${backupDir}`)

    // Load backup data
    const backupData: BackupData = JSON.parse(
      fs.readFileSync(backupFile, "utf-8")
    )

    console.log(`📊 Backup info:`)
    console.log(`   - Created: ${backupData.timestamp}`)
    console.log(`   - Version: ${backupData.version}`)

    // Verify workspace ID matches
    if (backupData.workspaceId !== workspaceId) {
      throw new Error(
        `Backup workspace ID mismatch! Expected ${workspaceId}, got ${backupData.workspaceId}`
      )
    }

    console.log(
      `\n⚠️  WARNING: This will DELETE all current data for workspace: ${workspaceId}`
    )
    console.log(`Press Ctrl+C within 3 seconds to cancel...`)

    // 3 second delay for safety
    await new Promise((resolve) => setTimeout(resolve, 3000))

    console.log(`\n🗑️  Deleting current workspace data...`)

    // Delete all workspace data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete in correct order (respecting foreign keys)
      await tx.cartItems.deleteMany({
        where: {
          cart: {
            customer: {
              workspaceId,
            },
          },
        },
      })
      console.log(`   ✓ Cart items deleted`)

      await tx.carts.deleteMany({
        where: {
          customer: {
            workspaceId,
          },
        },
      })
      console.log(`   ✓ Carts deleted`)

      await tx.orders.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Orders deleted`)

      await tx.customers.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Customers deleted`)

      await tx.products.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Products deleted`)

      await tx.categories.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Categories deleted`)

      await tx.services.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Services deleted`)

      await tx.suppliers.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Suppliers deleted`)

      await tx.fAQ.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ FAQs deleted`)

      await tx.offers.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Offers deleted`)

      await tx.agentConfig.deleteMany({ where: { workspaceId } })
      console.log(`   ✓ Agent configs deleted`)

      console.log(`\n📦 Restoring data from backup...`)

      // Restore data
      if (backupData.data.agentConfigs.length > 0) {
        await tx.agentConfig.createMany({ data: backupData.data.agentConfigs })
        console.log(
          `   ✓ Agent configs: ${backupData.data.agentConfigs.length}`
        )
      }

      if (backupData.data.categories.length > 0) {
        await tx.categories.createMany({ data: backupData.data.categories })
        console.log(`   ✓ Categories: ${backupData.data.categories.length}`)
      }

      if (backupData.data.suppliers.length > 0) {
        await tx.suppliers.createMany({ data: backupData.data.suppliers })
        console.log(`   ✓ Suppliers: ${backupData.data.suppliers.length}`)
      }

      if (backupData.data.products.length > 0) {
        await tx.products.createMany({ data: backupData.data.products })
        console.log(`   ✓ Products: ${backupData.data.products.length}`)
      }

      if (backupData.data.services.length > 0) {
        await tx.services.createMany({ data: backupData.data.services })
        console.log(`   ✓ Services: ${backupData.data.services.length}`)
      }

      if (backupData.data.customers.length > 0) {
        await tx.customers.createMany({ data: backupData.data.customers })
        console.log(`   ✓ Customers: ${backupData.data.customers.length}`)
      }

      if (backupData.data.orders.length > 0) {
        await tx.orders.createMany({ data: backupData.data.orders })
        console.log(`   ✓ Orders: ${backupData.data.orders.length}`)
      }

      if (backupData.data.faqs.length > 0) {
        await tx.fAQ.createMany({ data: backupData.data.faqs })
        console.log(`   ✓ FAQs: ${backupData.data.faqs.length}`)
      }

      if (backupData.data.offers.length > 0) {
        await tx.offers.createMany({ data: backupData.data.offers })
        console.log(`   ✓ Offers: ${backupData.data.offers.length}`)
      }

      // Cart items need special handling (restore after carts)
      // Note: We're not restoring carts/cart items as they're session-specific
      console.log(`   ⚠️  Cart items skipped (session-specific data)`)
    })

    // Restore uploads
    const uploadsBackup = path.join(backupDir, "uploads")
    const uploadsTarget = path.join(__dirname, "../uploads")

    if (fs.existsSync(uploadsBackup)) {
      // Backup current uploads first
      const uploadsBackupCurrent = path.join(
        __dirname,
        `../uploads-backup-${Date.now()}`
      )
      if (fs.existsSync(uploadsTarget)) {
        fse.copySync(uploadsTarget, uploadsBackupCurrent)
        console.log(
          `\n📸 Current uploads backed up to: ${uploadsBackupCurrent}`
        )
      }

      // Restore uploads
      fse.copySync(uploadsBackup, uploadsTarget)
      console.log(`📦 Uploads restored`)
    }

    console.log(`\n✅ Restore completed successfully!`)
    console.log(`📊 Restored:`)
    console.log(`   - Agent Configs: ${backupData.data.agentConfigs.length}`)
    console.log(`   - Products: ${backupData.data.products.length}`)
    console.log(`   - Categories: ${backupData.data.categories.length}`)
    console.log(`   - Customers: ${backupData.data.customers.length}`)
    console.log(`   - Orders: ${backupData.data.orders.length}`)
    console.log(`   - Services: ${backupData.data.services.length}`)
    console.log(`   - Suppliers: ${backupData.data.suppliers.length}`)
    console.log(`   - FAQs: ${backupData.data.faqs.length}`)
    console.log(`   - Offers: ${backupData.data.offers.length}`)
  } catch (error) {
    console.error("❌ Restore failed:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// CLI execution
const workspaceId = process.argv[2]

if (!workspaceId) {
  console.error("❌ Error: workspaceId is required")
  console.log(
    "Usage: ts-node scripts/restore-workspace-backup.ts <workspaceId>"
  )
  process.exit(1)
}

restoreWorkspaceBackup(workspaceId)
  .then(() => {
    console.log("✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Script failed:", error)
    process.exit(1)
  })
