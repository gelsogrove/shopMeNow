/**
 * DATABASE BACKUP SCRIPT
 * 
 * Questo script:
 * 1. LEGGE il database PostgreSQL attuale
 * 2. ESPORTA tutti i dati in file JSON nella cartella backups/
 * 3. NON modifica il database
 * 
 * Uso: npm run db:backup
 * 
 * Output:
 * - backups/YYYY-MM-DD_HH-mm-ss/categories.json
 * - backups/YYYY-MM-DD_HH-mm-ss/products.json
 * - backups/YYYY-MM-DD_HH-mm-ss/services.json
 * - backups/YYYY-MM-DD_HH-mm-ss/faqs.json
 * - backups/YYYY-MM-DD_HH-mm-ss/offers.json
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0]
  const backupDir = path.join(__dirname, "..", "backups", timestamp)

  console.log("🔄 Creating backup directory:", backupDir)
  fs.mkdirSync(backupDir, { recursive: true })

  try {
    // Get all workspaces
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, name: true },
    })

    console.log(`\n📦 Found ${workspaces.length} workspace(s)`)

    for (const workspace of workspaces) {
      console.log(`\n🏢 Backing up workspace: ${workspace.name}`)

      const workspaceDir = path.join(backupDir, workspace.id)
      fs.mkdirSync(workspaceDir, { recursive: true })

      // 1. CATEGORIES
      const categories = await prisma.categories.findMany({
        where: { workspaceId: workspace.id },
        select: {
          name: true,
          description: true,
          isActive: true,
          slug: true,
        },
      })
      fs.writeFileSync(
        path.join(workspaceDir, "categories.json"),
        JSON.stringify(categories, null, 2)
      )
      console.log(`   ✅ Categories: ${categories.length}`)

      // 2. PRODUCTS
      const products = await prisma.products.findMany({
        where: { workspaceId: workspace.id },
        include: { category: true },
      })

      const productsExport = products.map((p) => ({
        name: p.name,
        ProductCode: p.ProductCode,
        description: p.description,
        formato: p.formato,
        price: p.price,
        stock: p.stock,
        isActive: p.isActive,
        categoryName: p.category?.name || "Unknown",
        imageUrl: p.imageUrl,
        slug: p.slug,
      }))

      fs.writeFileSync(
        path.join(workspaceDir, "products.json"),
        JSON.stringify(productsExport, null, 2)
      )
      console.log(`   ✅ Products: ${products.length}`)

      // 3. SERVICES
      const services = await prisma.services.findMany({
        where: { workspaceId: workspace.id },
        select: {
          name: true,
          code: true,
          description: true,
          price: true,
          isActive: true,
          imageUrl: true,
        },
      })
      fs.writeFileSync(
        path.join(workspaceDir, "services.json"),
        JSON.stringify(services, null, 2)
      )
      console.log(`   ✅ Services: ${services.length}`)

      // 4. FAQs
      const faqs = await prisma.fAQs.findMany({
        where: { workspaceId: workspace.id },
        select: {
          question: true,
          answer: true,
          category: true,
          language: true,
          isActive: true,
        },
      })
      fs.writeFileSync(
        path.join(workspaceDir, "faqs.json"),
        JSON.stringify(faqs, null, 2)
      )
      console.log(`   ✅ FAQs: ${faqs.length}`)

      // 5. OFFERS
      const offers = await prisma.offers.findMany({
        where: { workspaceId: workspace.id },
        select: {
          name: true,
          description: true,
          discountType: true,
          discountValue: true,
          validFrom: true,
          validUntil: true,
          isActive: true,
        },
      })
      fs.writeFileSync(
        path.join(workspaceDir, "offers.json"),
        JSON.stringify(offers, null, 2)
      )
      console.log(`   ✅ Offers: ${offers.length}`)

      // 6. WORKSPACE SETTINGS
      const workspaceSettings = await prisma.workspaces.findUnique({
        where: { id: workspace.id },
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
          currency: true,
          language: true,
          timezone: true,
          welcomeMessage: true,
        },
      })
      fs.writeFileSync(
        path.join(workspaceDir, "settings.json"),
        JSON.stringify(workspaceSettings, null, 2)
      )
      console.log(`   ✅ Settings saved`)
    }

    // Create summary file
    const summary = {
      timestamp: new Date().toISOString(),
      workspaces: workspaces.map((w) => w.name),
      backupPath: backupDir,
    }
    fs.writeFileSync(
      path.join(backupDir, "summary.json"),
      JSON.stringify(summary, null, 2)
    )

    console.log(`\n✅ BACKUP COMPLETED!`)
    console.log(`📁 Location: ${backupDir}`)
    console.log(`\n💡 To restore this backup, use: npm run db:restore ${timestamp}`)
  } catch (error) {
    console.error("❌ Backup failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backupDatabase()
