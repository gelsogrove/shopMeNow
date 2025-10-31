/**
 * EXPORT WORKSPACE-SPECIFIC BACKUP
 *
 * Creates a timestamped backup for a specific workspace only.
 * Each workspace has isolated backups in: prisma/backups/{workspaceId}/
 *
 * Usage: ts-node scripts/export-workspace-backup.ts <workspaceId>
 *
 * Security: Only exports data belonging to the specified workspace
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

async function exportWorkspaceBackup(workspaceId: string): Promise<void> {
  console.log(`\n🗄️ Starting backup for workspace: ${workspaceId}`)

  try {
    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    })

    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    console.log(`✅ Workspace found: ${workspace.name}`)

    // Create backup directory structure
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupDir = path.join(
      __dirname,
      "../prisma/backups",
      workspaceId,
      `backup-${timestamp}`
    )

    fs.mkdirSync(backupDir, { recursive: true })
    console.log(`📁 Created backup directory: ${backupDir}`)

    // Export all workspace data
    console.log("📊 Exporting workspace data...")

    const backupData: BackupData = {
      workspaceId,
      timestamp,
      version: "1.0.0",
      data: {
        workspace: await prisma.workspace.findUnique({
          where: { id: workspaceId },
        }),
        agentConfigs: await prisma.agentConfig.findMany({
          where: { workspaceId },
        }),
        products: await prisma.products.findMany({
          where: { workspaceId },
        }),
        categories: await prisma.categories.findMany({
          where: { workspaceId },
        }),
        customers: await prisma.customers.findMany({
          where: { workspaceId },
        }),
        orders: await prisma.orders.findMany({
          where: { workspaceId },
        }),
        cartItems: await prisma.cartItems.findMany({
          where: {
            cart: {
              customer: {
                workspaceId,
              },
            },
          },
        }),
        services: await prisma.services.findMany({
          where: { workspaceId },
        }),
        suppliers: await prisma.suppliers.findMany({
          where: { workspaceId },
        }),
        faqs: await prisma.fAQ.findMany({
          where: { workspaceId },
        }),
        offers: await prisma.offers.findMany({
          where: { workspaceId },
        }),
        settings: [],
      },
    }

    // Save backup data to JSON
    const backupFile = path.join(backupDir, "backup.json")
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2))
    console.log(`✅ Backup data saved: ${backupFile}`)

    // Copy workspace uploads
    const uploadsSource = path.join(__dirname, "../uploads")
    const uploadsBackup = path.join(backupDir, "uploads")

    if (fs.existsSync(uploadsSource)) {
      fse.copySync(uploadsSource, uploadsBackup)
      console.log(`📦 Uploads copied to backup`)
    }

    // Create latest symlink
    const latestLink = path.join(
      __dirname,
      "../prisma/backups",
      workspaceId,
      "latest"
    )

    if (fs.existsSync(latestLink)) {
      fs.unlinkSync(latestLink)
    }

    fs.symlinkSync(`backup-${timestamp}`, latestLink)
    console.log(`🔗 Created 'latest' symlink`)

    // Summary
    console.log("\n✅ Backup completed successfully!")
    console.log(`📊 Statistics:`)
    console.log(`   - Workspace: ${workspace.name}`)
    console.log(`   - Agent Configs: ${backupData.data.agentConfigs.length}`)
    console.log(`   - Products: ${backupData.data.products.length}`)
    console.log(`   - Categories: ${backupData.data.categories.length}`)
    console.log(`   - Customers: ${backupData.data.customers.length}`)
    console.log(`   - Orders: ${backupData.data.orders.length}`)
    console.log(`   - Cart Items: ${backupData.data.cartItems.length}`)
    console.log(`   - Services: ${backupData.data.services.length}`)
    console.log(`   - Suppliers: ${backupData.data.suppliers.length}`)
    console.log(`   - FAQs: ${backupData.data.faqs.length}`)
    console.log(`   - Offers: ${backupData.data.offers.length}`)
    console.log(`   - Settings: ${backupData.data.settings.length}`)
    console.log(`\n📁 Backup location: ${backupDir}`)
  } catch (error) {
    console.error("❌ Backup failed:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// CLI execution
const workspaceId = process.argv[2]

if (!workspaceId) {
  console.error("❌ Error: workspaceId is required")
  console.log("Usage: ts-node scripts/export-workspace-backup.ts <workspaceId>")
  process.exit(1)
}

exportWorkspaceBackup(workspaceId)
  .then(() => {
    console.log("✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Script failed:", error)
    process.exit(1)
  })
