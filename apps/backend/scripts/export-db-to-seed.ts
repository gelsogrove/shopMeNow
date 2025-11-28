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

import { AgentType, PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as fse from "fs-extra"
import * as path from "path"

const prisma = new PrismaClient()

// Mapping from AgentType to filename
const AGENT_FILENAME_MAP: Partial<Record<AgentType, string>> = {
  ROUTER: "router-agent.md",
  PRODUCT_SEARCH: "product-search.md",
  CART_MANAGEMENT: "cart-management.md",
  ORDER_TRACKING: "order-tracking.md",
  CUSTOMER_SUPPORT: "customer-support.md",
  PROFILE_MANAGEMENT: "profile-management.md",
  NOTIFICATIONS: "notifications.md",
  SAFETY_TRANSLATION: "safety-translation.md",
}

const AGENT_DESCRIPTIONS: Partial<Record<AgentType, string>> = {
  ROUTER:
    "Router Agent - Handles FAQ matching and intent classification to route messages to specialist agents",
  PRODUCT_SEARCH:
    "Product and Services Agent - Handles product searches with QueryPlanner and semantic matching",
  CART_MANAGEMENT:
    "Cart Management Agent - Handles add to cart, remove, view cart, and checkout operations",
  ORDER_TRACKING:
    "Order Tracking Agent - Handles order viewing, tracking, and status updates",
  CUSTOMER_SUPPORT:
    "Customer Support Agent - Handles frustration detection and escalation to human operators",
  PROFILE_MANAGEMENT:
    "Profile Management Agent - Handles customer profile updates and preferences",
  NOTIFICATIONS:
    "Notifications Agent - Handles notification preferences and delivery",
  SAFETY_TRANSLATION:
    "Safety & Translation Agent - Filters inappropriate content and translates to customer language",
}

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

/**
 * Export agent prompts to markdown files
 */
async function exportPromptsToMarkdown(workspaceId: string): Promise<void> {
  const promptsDir = path.join(__dirname, "../../docs/prompts")

  // Ensure directory exists
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true })
  }

  const agentTypes: AgentType[] = [
    "ROUTER",
    "PRODUCT_SEARCH",
    "CART_MANAGEMENT",
    "ORDER_TRACKING",
    "CUSTOMER_SUPPORT",
    "PROFILE_MANAGEMENT",
    "NOTIFICATIONS",
    "SAFETY_TRANSLATION",
  ]

  let exportCount = 0

  for (const agentType of agentTypes) {
    const agent = await prisma.agentConfig.findFirst({
      where: {
        workspaceId,
        type: agentType,
        isActive: true,
      },
    })

    if (!agent) {
      console.log(`   ⚠️  Agent ${agentType} not found, skipping...`)
      continue
    }

    const filename = AGENT_FILENAME_MAP[agentType]
    if (!filename) {
      console.log(`   ⚠️  No filename mapping for ${agentType}, skipping...`)
      continue
    }

    const filePath = path.join(promptsDir, filename)

    // Format markdown content
    const mdContent = `# ${agent.name}

**Type**: ${agent.type}  
**Model**: ${agent.model}  
**Temperature**: ${agent.temperature}  
**Max Tokens**: ${agent.maxTokens}  
**Order**: ${agent.order}  
**Last Updated**: ${new Date().toISOString()}

---

## Description

${agent.description || AGENT_DESCRIPTIONS[agentType] || "No description available"}

---

## System Prompt

${agent.systemPrompt}

---

## Available Functions

${agent.availableFunctions ? "```json\n" + JSON.stringify(agent.availableFunctions, null, 2) + "\n```" : "_No functions defined_"}

---

_This file is auto-generated from the database. To update:_
1. _Modify the prompt in the UI (AgentPage) or via API_
2. _Run \`npm run db:export\` to sync this file_
3. _Commit the updated .md file to Git_
`

    fs.writeFileSync(filePath, mdContent, "utf-8")
    console.log(`   ✅ ${filename}`)
    exportCount++
  }

  console.log(`   📝 Exported ${exportCount} agent prompts`)
}

async function exportToSeed() {
  console.log("🔄 EXPORTING DATABASE TO SEED FILES")
  console.log("=".repeat(50))

  // 🛡️ BACKUP AUTOMATICO DEI FILE DATA ESISTENTI
  const dataDir = path.join(__dirname, "../prisma/data")
  const backupDir = path.join(__dirname, "../prisma/data-backup")
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0]
  const backupDirWithDate = `${backupDir}-${timestamp}`

  if (fs.existsSync(dataDir)) {
    console.log(`\n🛡️ CREATING BACKUP OF EXISTING DATA FILES...`)
    await fse.copy(dataDir, backupDirWithDate)
    console.log(`   ✅ Backup created: ${backupDirWithDate}`)
  }

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

    // ==================== CATEGORIES ====================
    console.log("📂 Exporting categories...")
    const categories = await prisma.categories.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const categoriesContent = `/**
 * Categories Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export
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
    (cat: any) => `  {
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

    // ==================== SUPPLIERS ====================
    console.log("🏭 Exporting suppliers...")
    const suppliers: any[] = await (prisma as any).suppliers.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const suppliersContent = `/**
 * Suppliers Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface SupplierData {
  companyName: string
  description: string | null
  website: string | null
  phone: string | null
  email: string | null
  contactName: string | null
  region: string | null
  country: string | null
  logoUrl: string | null
  isActive?: boolean
}

export const suppliers: SupplierData[] = [
${suppliers
  .map(
    (sup: any) => `  {
    companyName: ${formatValue(sup.companyName)},
    description: ${formatValue(sup.description)},
    website: ${formatValue(sup.website)},
    phone: ${formatValue(sup.phone)},
    email: ${formatValue(sup.email)},
    contactName: ${formatValue(sup.contactName)},
    region: ${formatValue(sup.region)},
    country: ${formatValue(sup.country)},
    logoUrl: ${formatValue(sup.logoUrl)},
    isActive: ${formatValue(sup.isActive)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "suppliers.ts"), suppliersContent)
    console.log(`   ✅ Exported ${suppliers.length} suppliers`)

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
 * DO NOT EDIT MANUALLY - Use npm run db:export
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
    (p: any) => `  {
    name: ${formatValue(p.name)},
    ProductCode: ${formatValue(p.productCode)},
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
 * DO NOT EDIT MANUALLY - Use npm run db:export
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
    (s: any) => `  {
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
 * DO NOT EDIT MANUALLY - Use npm run db:export
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
    (faq: any) => `  {
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
      include: {
        category: true, // Include single category relation (legacy)
        categories: true, // Include many-to-many relation
      },
    })

    const offersContent = `/**
 * Offers Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface OfferData {
  name: string
  description: string
  type: string | null
  value: number | null
  validFrom: Date | null
  validUntil: Date | null
  isActive: boolean
  categoryId?: string | null
  categoryName?: string | null
  categoryNames?: string[]
}

export const offers: OfferData[] = [
${offers
  .map(
    (offer: any) => `  {
    name: ${formatValue(offer.name)},
    description: ${formatValue(offer.description)},
    type: null,
    value: ${formatValue(offer.discountPercent)},
    validFrom: ${formatValue(offer.startDate)},
    validUntil: ${formatValue(offer.endDate)},
    isActive: ${formatValue(offer.isActive)},
    categoryId: ${formatValue(offer.categoryId)},
    categoryName: ${formatValue(offer.category?.name)},
    categoryNames: ${formatValue(offer.categories?.map((c: any) => c.name) || [])},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "offers.ts"), offersContent)
    console.log(`   ✅ Exported ${offers.length} offers`)

    // ==================== CAMPAIGNS ====================
    console.log("📢 Exporting campaigns...")
    const campaigns: any[] = await prisma.campaign.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const campaignsContent = `/**
 * Campaigns Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface CampaignData {
  name: string
  messagePreview: string
  frequency: string
  isActive: boolean
  targetType: string
  customerIds?: string[]
  templateName?: string | null
  templateParams?: any | null
  lastRunAt?: Date | null
}

export const campaigns: CampaignData[] = [
${campaigns
  .map(
    (campaign: any) => `  {
    name: ${formatValue(campaign.name)},
    messagePreview: ${formatValue(campaign.messagePreview)},
    frequency: ${formatValue(campaign.frequency)},
    isActive: ${formatValue(campaign.isActive)},
    targetType: ${formatValue(campaign.targetType)},
    customerIds: ${formatValue(campaign.customerIds || [])},
    templateName: ${formatValue(campaign.templateName)},
    templateParams: ${formatValue(campaign.templateParams)},
    lastRunAt: ${formatValue(campaign.lastRunAt)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "campaigns.ts"), campaignsContent)
    console.log(`   ✅ Exported ${campaigns.length} campaigns`)

    // ==================== SALES REPRESENTATIVES ====================
    console.log("👔 Exporting sales representatives...")
    const salesReps: any[] = await prisma.sales.findMany({
      where: { workspaceId: mainWorkspace.id },
      orderBy: { createdAt: "asc" },
    })

    const salesRepsContent = `/**
 * Sales Representatives Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface SalesRepData {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  isActive: boolean
}

export const salesReps: SalesRepData[] = [
${salesReps
  .map(
    (rep: any) => `  {
    firstName: ${formatValue(rep.firstName)},
    lastName: ${formatValue(rep.lastName)},
    email: ${formatValue(rep.email)},
    phone: ${formatValue(rep.phone)},
    isActive: ${formatValue(rep.isActive)},
  }`
  )
  .join(",\n")}
]
`

    fs.writeFileSync(path.join(dataDir, "salesReps.ts"), salesRepsContent)
    console.log(`   ✅ Exported ${salesReps.length} sales representatives`)

    // ==================== WORKSPACE SETTINGS ====================
    console.log("⚙️  Exporting workspace settings...")

    const workspaceSettings = {
      name: mainWorkspace.name,
      url: mainWorkspace.url,
      whatsappPhoneNumber: mainWorkspace.whatsappPhoneNumber,
      notificationEmail: mainWorkspace.notificationEmail,
      welcomeMessages: mainWorkspace.welcomeMessages,
      wipMessages: mainWorkspace.wipMessages,
      afterRegistrationMessages: mainWorkspace.afterRegistrationMessages,
      debugMode: mainWorkspace.debugMode,
    }

    const workspaceSettingsContent = `/**
 * Workspace Settings Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface WorkspaceSettingsData {
  name: string
  url?: string | null
  whatsappPhoneNumber?: string | null
  notificationEmail?: string | null
  welcomeMessages?: any
  wipMessages?: any
  afterRegistrationMessages?: any
  debugMode?: boolean
}

export const workspaceSettings: WorkspaceSettingsData = ${JSON.stringify(workspaceSettings, null, 2)}
`

    fs.writeFileSync(
      path.join(dataDir, "workspaceSettings.ts"),
      workspaceSettingsContent
    )
    console.log(`   ✅ Exported workspace settings`)

    // ==================== AGENT PROMPT ====================
    console.log("🤖 Exporting agent prompt...")
    const activePrompt = await (prisma as any).agentConfig.findFirst({
      where: { workspaceId: mainWorkspace.id, isActive: true },
      orderBy: { createdAt: "desc" },
    })

    if (activePrompt) {
      const agentPromptContent = `/**
 * Agent Prompt Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY - Use npm run db:export
 */

export interface AgentPromptData {
  name: string
  content: string
  model: string
  temperature: number
  maxTokens: number
}

export const agentPrompt: AgentPromptData = {
  name: ${formatValue(activePrompt.name)},
  content: ${formatValue(activePrompt.content)},
  model: ${formatValue(activePrompt.model)},
  temperature: ${formatValue(activePrompt.temperature)},
  maxTokens: ${formatValue(activePrompt.max_tokens)},
}
`

      fs.writeFileSync(path.join(dataDir, "agentPrompt.ts"), agentPromptContent)
      const contentLength = activePrompt.content
        ? activePrompt.content.length
        : 0
      console.log(`   ✅ Exported agent prompt (${contentLength} chars)`)
    } else {
      console.log(`   ⚠️  No active agent config found, skipping prompt export`)
    }

    // ========================================
    // BACKUP IMMAGINI
    // ========================================
    console.log("\n📸 BACKUP UPLOADS...")

    const uploadsDir = path.join(__dirname, "..", "uploads")
    const uploadsBackupDir = path.join(
      __dirname,
      "..",
      "prisma",
      "uploads-backup"
    )

    // Cancella vecchio backup e crea nuovo
    if (fs.existsSync(uploadsBackupDir)) {
      await fse.remove(uploadsBackupDir)
      console.log("   🗑️  Removed old uploads backup")
    }

    // Copia uploads → uploads-backup
    if (fs.existsSync(uploadsDir)) {
      await fse.copy(uploadsDir, uploadsBackupDir)
      console.log(`   ✅ Backed up uploads to prisma/uploads-backup/`)

      // Conta files
      const productImages = fs.existsSync(
        path.join(uploadsBackupDir, "products")
      )
        ? fs.readdirSync(path.join(uploadsBackupDir, "products")).length
        : 0
      const serviceImages = fs.existsSync(
        path.join(uploadsBackupDir, "services")
      )
        ? fs.readdirSync(path.join(uploadsBackupDir, "services")).length
        : 0
      const supplierImages = fs.existsSync(
        path.join(uploadsBackupDir, "suppliers")
      )
        ? fs.readdirSync(path.join(uploadsBackupDir, "suppliers")).length
        : 0

      console.log(`   📷 Product images: ${productImages}`)
      console.log(`   🔧 Service images: ${serviceImages}`)
      console.log(`   🏭 Supplier images: ${supplierImages}`)
    } else {
      console.log("   ⚠️  No uploads directory found")
    }

    console.log("\n" + "=".repeat(50))
    // ==================== EXPORT AGENT PROMPTS TO MARKDOWN ====================
    console.log("\n📝 Exporting agent prompts to markdown files...")
    await exportPromptsToMarkdown(mainWorkspace.id)

    console.log("\n✅ EXPORT COMPLETED SUCCESSFULLY!")
    console.log("\n📁 Files updated in: prisma/data/")
    console.log("   - categories.ts")
    console.log("   - suppliers.ts")
    console.log("   - products.ts")
    console.log("   - services.ts")
    console.log("   - faqs.ts")
    console.log("   - offers.ts")
    console.log("   - campaigns.ts")
    console.log("   - salesReps.ts")
    console.log("   - workspaceSettings.ts")
    console.log("   - agentPrompt.ts")
    console.log("\n📁 Prompts exported to: docs/prompts/")
    console.log("   - router-agent.md")
    console.log("   - product-search.md")
    console.log("   - cart-management.md")
    console.log("   - order-tracking.md")
    console.log("   - customer-support.md")
    console.log("   - safety-translation.md")
    console.log("\n📁 Images backed up in: prisma/uploads-backup/")
    console.log("   - products/")
    console.log("   - services/")
    console.log("   - suppliers/")
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
