/**
 * EXPORT DATABASE TO SEED FILES
 *
 * Questo script:
 * 1. LEGGE il database attuale (prodotti, categorie, servizi, etc.)
 * 2. SOVRASCRIVE i file .ts in prisma/data/
 * 3. COPIA le immagini in prisma/uploads-backup/
 * 4. Il prossimo npm run seed userà questi dati aggiornati
 *
 * Uso: npm run db:export
 *
 * ATTENZIONE: Questo SOVRASCRIVE i file TypeScript e le immagini!
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as fse from "fs-extra"
import * as path from "path"

const prisma = new PrismaClient()

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return "null"
  }
  if (typeof value === "string") {
    return `"${value.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
  }
  if (typeof value === "number") {
    return value.toString()
  }
  if (typeof value === "boolean") {
    return value.toString()
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return `[${value.map((v) => formatValue(v)).join(", ")}]`
  }
  if (value instanceof Date) {
    return `new Date("${value.toISOString()}")`
  }
  return JSON.stringify(value)
}

async function exportToSeed() {
  console.log("🔄 EXPORTING DATABASE TO SEED FILES")
  console.log("=".repeat(50))

  try {
    // Get main workspace
    const mainWorkspace = await prisma.workspace.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    })

    if (!mainWorkspace) {
      console.error("❌ No active workspace found!")
      process.exit(1)
    }

    console.log(`\n🏢 Workspace: ${mainWorkspace.name}`)
    console.log(`📋 Workspace ID: ${mainWorkspace.id}\n`)

    const dataDir = path.join(__dirname, "..", "prisma", "data")

    // ==================== CATEGORIES ====================
    console.log("📂 Exporting categories...")
    const categories = await prisma.categories.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const categoriesContent = `/**
 * Categories Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export-to-seed
 */

export interface CategoryData {
  name: string
  description: string
  slug: string
  isActive?: boolean
}

export const categories: CategoryData[] = [
${categories
  .map(
    (cat) => `  {
    name: ${formatValue(cat.name)},
    description: ${formatValue(cat.description)},
    slug: ${formatValue(cat.slug)},
    isActive: ${formatValue(cat.isActive)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "categories.ts"), categoriesContent)
    console.log(`   ✅ Exported ${categories.length} categories`)

    // ==================== PRODUCTS ====================
    console.log("📦 Exporting products...")
    const products: any[] = await prisma.products.findMany({
      where: { workspaceId: mainWorkspace.id },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    })

    const productsContent = `/**
 * Product Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export-to-seed
 */

export interface ProductData {
  name: string
  ProductCode?: string
  description: string
  formato: string
  price: number
  stock: number
  status: string
  slug: string
  categoryName: string
  imageUrl?: string[]
}

export const products: ProductData[] = [
${products
  .map(
    (p) => `  {
    name: ${formatValue(p.name)},
    ProductCode: ${formatValue(p.ProductCode)},
    description: ${formatValue(p.description)},
    formato: ${formatValue(p.formato)},
    price: ${formatValue(p.price)},
    stock: ${formatValue(p.stock)},
    status: ${formatValue(p.status)},
    slug: ${formatValue(p.slug)},
    categoryName: ${formatValue(p.category?.name || "Unknown")},
    imageUrl: ${formatValue(p.imageUrl)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "products.ts"), productsContent)
    console.log(`   ✅ Exported ${products.length} products`)

    // ==================== SERVICES ====================
    console.log("🔧 Exporting services...")
    const services: any[] = await prisma.services.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const servicesContent = `/**
 * Services Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export-to-seed
 */

export interface ServiceData {
  name: string
  code: string
  description: string
  price: number
  isActive: boolean
  imageUrl?: string[]
}

export const services: ServiceData[] = [
${services
  .map(
    (s) => `  {
    name: ${formatValue(s.name)},
    code: ${formatValue(s.code)},
    description: ${formatValue(s.description)},
    price: ${formatValue(s.price)},
    isActive: ${formatValue(s.isActive)},
    imageUrl: ${formatValue(s.imageUrl)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "services.ts"), servicesContent)
    console.log(`   ✅ Exported ${services.length} services`)

    // ==================== FAQs ====================
    console.log("❓ Exporting FAQs...")
    const faqs: any[] = await prisma.fAQ.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const faqsContent = `/**
 * FAQs Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export-to-seed
 */

export interface FAQData {
  question: string
  answer: string
  category: string
  language: string
  isActive: boolean
}

export const faqs: FAQData[] = [
${faqs
  .map(
    (faq) => `  {
    question: ${formatValue(faq.question)},
    answer: ${formatValue(faq.answer)},
    category: ${formatValue(faq.category)},
    language: ${formatValue(faq.language)},
    isActive: ${formatValue(faq.isActive)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "faqs.ts"), faqsContent)
    console.log(`   ✅ Exported ${faqs.length} FAQs`)

    // ==================== OFFERS ====================
    console.log("🎁 Exporting offers...")
    const offers: any[] = await prisma.offers.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const offersContent = `/**
 * Offers Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export-to-seed
 */

export interface OfferData {
  name: string
  description: string
  type: string
  value: number
  validFrom: Date
  validUntil: Date
  isActive: boolean
}

export const offers: OfferData[] = [
${offers
  .map(
    (offer) => `  {
    name: ${formatValue(offer.name)},
    description: ${formatValue(offer.description)},
    type: ${formatValue(offer.type)},
    value: ${formatValue(offer.value)},
    validFrom: ${formatValue(offer.validFrom)},
    validUntil: ${formatValue(offer.validUntil)},
    isActive: ${formatValue(offer.isActive)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "offers.ts"), offersContent)
    console.log(`   ✅ Exported ${offers.length} offers`)

    // ========================================
    // 6. BACKUP IMMAGINI
    // ========================================
    console.log("\n6️⃣ BACKUP UPLOADS...")

    const uploadsDir = path.join(__dirname, "..", "uploads")
    const backupDir = path.join(__dirname, "..", "prisma", "uploads-backup")

    // Cancella vecchio backup e crea nuovo
    if (fs.existsSync(backupDir)) {
      await fse.remove(backupDir)
      console.log("   🗑️  Removed old backup")
    }

    // Copia uploads → uploads-backup
    if (fs.existsSync(uploadsDir)) {
      await fse.copy(uploadsDir, backupDir)
      console.log(`   ✅ Backed up uploads to prisma/uploads-backup/`)

      // Conta files
      const productImages = fs.existsSync(path.join(backupDir, "products"))
        ? fs.readdirSync(path.join(backupDir, "products")).length
        : 0
      const serviceImages = fs.existsSync(path.join(backupDir, "services"))
        ? fs.readdirSync(path.join(backupDir, "services")).length
        : 0

      console.log(`   📷 Product images: ${productImages}`)
      console.log(`   📷 Service images: ${serviceImages}`)
    } else {
      console.log("   ⚠️  No uploads directory found")
    }

    console.log("\n" + "=".repeat(50))
    console.log("✅ EXPORT COMPLETED SUCCESSFULLY!")
    console.log("\n📁 Files updated in: prisma/data/")
    console.log("   - categories.ts")
    console.log("   - products.ts")
    console.log("   - services.ts")
    console.log("   - faqs.ts")
    console.log("   - offers.ts")
    console.log("\n📁 Images backed up in: prisma/uploads-backup/")
    console.log("\n💡 Next time you run 'npm run seed', it will:")
    console.log("   1. Use these updated data files")
    console.log("   2. Restore images from uploads-backup/")
  } catch (error) {
    console.error("❌ Export failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

exportToSeed()
