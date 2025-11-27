/**
 * SEED DATABASE WITH TEST DATA
 *
 * This seed script:
 * 1. Creates workspace, users, and admin
 * 2. Imports data from prisma/data/ (exported by npm run db:export)
 * 3. Creates test customers and chat sessions
 *
 * Usage: npm run seed
 *
 * IMPORTANT: Uses data from prisma/data/ (upd  console.log(`✅ Created ${faqs.length} FAQs`)

  // 11. Create Campaigns
  console.log("📣 Creating campaigns...")

  for (const campaign of campaigns) {y db:export)
 */

import { config } from "dotenv"
config() // Load environment variables from .env file

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { campaigns } from "./data/campaigns"
import { categories } from "./data/categories"
import { defaultAgents } from "./data/defaultAgents"
import { defaultFAQs } from "./data/defaultFAQs"
import { faqs } from "./data/faqs"
import { offers } from "./data/offers"
import { pricingConfigData } from "./data/pricingConfig"
import { products } from "./data/products"
import { services } from "./data/services"
import { suppliers } from "./data/suppliers"
import { workspaceSettings } from "./data/workspaceSettings"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting database seed...")

  // 1. Clear existing data (in correct order to avoid FK constraints)
  console.log("🧹 Cleaning existing data...")

  // Delete all child tables with FK dependencies first
  await prisma.orderItems.deleteMany()
  await prisma.cartItems.deleteMany()
  await prisma.message.deleteMany()
  await prisma.chatSession.deleteMany()
  await prisma.passwordReset.deleteMany()
  // await prisma.otpToken.deleteMany() // ❌ REMOVED - table dropped
  await prisma.registrationToken.deleteMany()
  await prisma.secureToken.deleteMany()
  await prisma.customerFeedback.deleteMany()
  await prisma.campaignSent.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.billing.deleteMany()
  await prisma.billingTransaction.deleteMany() // ✅ Feature 185: Billing transactions
  await prisma.usage.deleteMany()
  await prisma.adminSession.deleteMany()
  await prisma.shortUrls.deleteMany()
  await prisma.registrationAttempts.deleteMany()
  await prisma.carts.deleteMany()
  await prisma.orders.deleteMany()
  await prisma.customers.deleteMany()
  // ❌ CHUNKS TABLES REMOVED
  // await prisma.documentChunks.deleteMany()
  // await prisma.fAQChunks.deleteMany()
  // await prisma.serviceChunks.deleteMany()
  // await prisma.productChunks.deleteMany()
  await prisma.documents.deleteMany()
  await prisma.fAQ.deleteMany()
  await prisma.offers.deleteMany()
  await prisma.services.deleteMany()
  // ✅ Feature 179: Delete pivot tables before parent tables
  await prisma.productTransportType.deleteMany()
  await prisma.productCertification.deleteMany()
  await prisma.products.deleteMany()
  await prisma.productSearch.deleteMany()
  await prisma.suppliers.deleteMany()
  await prisma.categories.deleteMany()
  await prisma.sales.deleteMany()
  await prisma.languages.deleteMany()
  await prisma.agentConfig.deleteMany()
  await prisma.gdprContent.deleteMany()
  await prisma.whatsappSettings.deleteMany()
  await prisma.paymentDetails.deleteMany()
  await prisma.searchConversations.deleteMany() // 🆕 Delete before workspace
  // ✅ Feature 178 & 179: Delete certification and transport type tables
  await prisma.certification.deleteMany()
  await prisma.transportType.deleteMany()

  // Delete user-related tables
  await prisma.workspaceInvitation.deleteMany() // Must delete before users (foreign key)
  await prisma.userWorkspace.deleteMany()
  await prisma.user.deleteMany()

  // ✅ Feature 185: Delete plan configurations before workspace
  await prisma.planConfiguration.deleteMany()

  // Finally delete workspace
  await prisma.workspace.deleteMany()

  console.log("✅ Database cleaned")

  // 2. Create Admin User
  console.log("👤 Creating admin user...")

  const adminEmail = process.env.ADMIN_EMAIL || "andrea_gelsomino@hotmail.com"
  const adminPassword = process.env.ADMIN_PASSWORD || "Venezia44"
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashedPassword,
      firstName: "Alessandro",
      lastName: "Romano",
      status: "ACTIVE",
      role: "ADMIN",
      twoFactorEnabled: false, // ❌ 2FA disabled by default - enable via Settings UI
      twoFactorEnabledAt: null,
      recoveryCodes: [], // Recovery codes generated when 2FA is enabled
      // 🧾 Billing Information (Andrea's requirement - sample data)
      companyName: "ShopME Italia S.r.l.",
      vatNumber: "IT12345678901",
      website: "https://www.shopme.it",
      billingPhone: "+39 06 1234567",
      billingAddress: "Via Roma 123, 00100 Roma, Italia",
    },
  })

  console.log(`✅ Admin user created: ${adminEmail}`)
  console.log(`📧 Email: ${adminEmail}`)
  console.log(`🔑 Password: ${adminPassword}`)
  console.log(`⚙️  2FA: Disabled (enable via Settings UI)\n`)

  // 3. Create Main Workspace
  console.log("🏢 Creating workspace...")

  // ⚠️ CRITICAL: Use FIXED workspace ID to match webhook configuration
  const FIXED_WORKSPACE_ID = "cm9hjgq9v00014qk8fsdy4ujv"

  const workspace = await prisma.workspace.create({
    data: {
      id: FIXED_WORKSPACE_ID, // ✅ Fixed ID for consistency
      name: workspaceSettings.name,
      slug: "altro-gusto",
      whatsappPhoneNumber:
        workspaceSettings.whatsappPhoneNumber || "+34654728753",
      notificationEmail:
        workspaceSettings.notificationEmail || "info@altrogusto.com",
      isActive: true,
      language: "ENG",
      currency: "EUR",
      businessType: "ECOMMERCE",
      description: "Italian Gourmet Food E-commerce",
      url: workspaceSettings.url || "https://altrogusto.com",
      channelStatus: true, // ✅ Feature 126: Chatbot enabled by default
      whatsappQueueEnabled: true, // ✅ Queue enabled by default
      debugMode:
        workspaceSettings.debugMode !== undefined
          ? workspaceSettings.debugMode
          : true,
      welcomeMessage: workspaceSettings.welcomeMessages, // ✅ Simple string, no JSON.stringify()
      wipMessage: workspaceSettings.wipMessages, // ✅ Simple string, no JSON.stringify()
      afterRegistrationMessages: JSON.stringify(
        workspaceSettings.afterRegistrationMessages
      ),
      ownerId: adminUser.id, // ✅ Feature 184: Set workspace owner for team management
      // ✅ Feature 185: Subscription & Billing - Start with FREE_TRIAL
      planType: "FREE_TRIAL",
      creditBalance: 29.0, // €29 initial credit
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      planStartedAt: new Date(),
    },
  })

  console.log(`✅ Workspace created: ${workspace.name} (${workspace.id})`)

  // 3.5. Create WhatsApp Settings
  console.log("📱 Creating WhatsApp settings...")

  await prisma.whatsappSettings.create({
    data: {
      workspaceId: workspace.id,
      phoneNumber: workspaceSettings.whatsappPhoneNumber || "+34654728753",
      apiKey: process.env.WHATSAPP_API_KEY || "dummy-api-key",
      webhookUrl:
        process.env.WHATSAPP_WEBHOOK_URL || "https://shopme.com/webhook",
      adminEmail: "andrea_gelsomino@hotmail.com", // ✅ Email per notifiche operatore
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: process.env.SMTP_USER || "noreply@shopme.com",
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: "ShopME <noreply@shopme.com>",
    },
  })

  console.log(
    `✅ WhatsApp settings created with admin email: andrea_gelsomino@hotmail.com`
  )

  // 4. Associate Admin with Workspace
  await prisma.userWorkspace.create({
    data: {
      userId: adminUser.id,
      workspaceId: workspace.id,
      role: "SUPER_ADMIN", // ✅ Feature 184: Creator is SUPER_ADMIN
    },
  })

  console.log("✅ Admin associated with workspace as SUPER_ADMIN")

  // 5. Create Languages
  console.log("🌐 Creating languages...")

  const languages = [
    { code: "IT", name: "Italiano", isDefault: true },
    { code: "ENG", name: "English", isDefault: false },
    { code: "ESP", name: "Español", isDefault: false },
    { code: "PRT", name: "Português", isDefault: false },
  ]

  for (const lang of languages) {
    await prisma.languages.create({
      data: {
        code: lang.code,
        name: lang.name,
        isDefault: lang.isDefault,
        isActive: true,
        workspaceId: workspace.id,
      },
    })
  }

  console.log(`✅ Created ${languages.length} languages`)

  // 6. Create Pricing Configuration (Single Source of Truth)
  console.log("💰 Creating pricing configuration...")

  for (const pricing of pricingConfigData) {
    await prisma.pricingConfig.upsert({
      where: { key: pricing.key },
      update: {
        type: pricing.type,
        value: pricing.value,
        description: pricing.description,
        isActive: pricing.isActive,
      },
      create: {
        type: pricing.type,
        key: pricing.key,
        value: pricing.value,
        description: pricing.description,
        isActive: pricing.isActive,
      },
    })
  }

  console.log(
    `✅ Created/Updated ${pricingConfigData.length} pricing configurations`
  )
  console.log(
    `   - Plans: ${pricingConfigData.filter((p) => p.type === "PLAN").length}`
  )
  console.log(
    `   - Usage: ${pricingConfigData.filter((p) => p.type === "USAGE").length}`
  )
  console.log(
    `   - Thresholds: ${pricingConfigData.filter((p) => p.type === "THRESHOLD").length}`
  )

  // 7. Create Categories
  console.log("📂 Creating categories...")

  const categoryMap = new Map<string, string>()

  for (const cat of categories) {
    const category = await prisma.categories.create({
      data: {
        name: cat.name,
        description: cat.description,
        slug: cat.name.toLowerCase().replace(/\s+/g, "-"),
        workspace: {
          connect: { id: workspace.id },
        },
      },
    })
    categoryMap.set(cat.name, category.id)
  }

  console.log(`✅ Created ${categories.length} categories`)

  // 7.5 Create Suppliers
  console.log("🏭 Creating suppliers...")

  const supplierMap = new Map<string, string>()
  const createdSuppliers = []

  for (const sup of suppliers) {
    const supplier = await prisma.suppliers.create({
      data: {
        companyName: sup.companyName,
        description: sup.description,
        website: sup.website,
        phone: sup.phone,
        email: sup.email,
        contactName: sup.contactName,
        region: sup.region,
        country: sup.country,
        logoUrl: sup.logoUrl,
        workspace: {
          connect: { id: workspace.id },
        },
      },
    })
    createdSuppliers.push(supplier)
    supplierMap.set(sup.companyName, supplier.id)
  }

  console.log(`✅ Created ${suppliers.length} suppliers`)

  // 6.5 Create Certifications (Feature 178)
  console.log("🔖 Creating certifications...")

  const certificationNames = [
    "Bio",
    "Vegan",
    "Gluten-Free",
    "Halal",
    "Whole-Grain",
    "DOP",
    "IGP",
    "IGT",
  ]

  const certificationMap = new Map<string, string>()

  for (const certName of certificationNames) {
    const certification = await prisma.certification.create({
      data: {
        name: certName,
        workspaceId: workspace.id,
      },
    })
    certificationMap.set(certName, certification.id)
  }

  console.log(`✅ Created ${certificationNames.length} certifications`)

  // 6.6 Create Transport Types (Feature 179)
  console.log("🚚 Creating transport types...")

  const transportTypeNames = [
    "Ambient Temperature", // Temperatura ambiente
    "Refrigerated",        // Refrigerato
    "Frozen",              // Congelato
  ]

  const transportTypeMap = new Map<string, string>()

  for (const typeName of transportTypeNames) {
    const transportType = await prisma.transportType.create({
      data: {
        name: typeName,
        workspaceId: workspace.id,
      },
    })
    transportTypeMap.set(typeName, transportType.id)
  }

  console.log(`✅ Created ${transportTypeNames.length} transport types`)

  // Mapping: category name → supplier company name
  const categoryToSupplier: Record<string, string> = {
    Pasta: "Pastificio Gragnano",
    "Cured Meats": "Salumificio Toscano",
    Cheeses: "Latticini del Sud",
    Condiments: "Oleificio Pugliese",
    Desserts: "Dolciaria Siciliana",
    Beverages: "Bevande Premium Italia",
    Specialties: "Specialità Regionali",
    Preserves: "Conserve Calabresi",
    "Frozen Products": "Surgelati Naturali",
  }

  // 7. Create Products
  console.log("📦 Creating products...")

  for (const prod of products) {
    const categoryId = categoryMap.get(prod.categoryName)
    if (!categoryId) {
      console.warn(
        `⚠️  Category not found for product: ${prod.name} (${prod.categoryName})`
      )
      continue
    }

    // Get supplier ID based on category
    const supplierCompanyName = categoryToSupplier[prod.categoryName]
    const supplierId = supplierCompanyName
      ? supplierMap.get(supplierCompanyName)
      : createdSuppliers[0].id // fallback to first supplier

    // Distribute boolean certifications based on product category and name
    const isOrganic =
      prod.name.toLowerCase().includes("organic") ||
      prod.name.toLowerCase().includes("bio")
    const isVegan =
      prod.name.toLowerCase().includes("vegan") ||
      prod.name.toLowerCase().includes("vegano")
    const isGlutenFree =
      prod.name.toLowerCase().includes("gluten-free") ||
      prod.name.toLowerCase().includes("senza glutine") ||
      prod.name.toLowerCase().includes("rice")
    const isHalal = prod.categoryName === "Cured Meats" && prod.stock > 30 // Some meats are halal certified
    const isWholeGrain =
      prod.name.toLowerCase().includes("whole") ||
      prod.name.toLowerCase().includes("integrale") ||
      prod.name.toLowerCase().includes("integral")

    // DOP certification (Protected Designation of Origin) - Feature 123
    // ✅ Check ONLY if "DOP", "IGP", or "IGT" is explicitly in the product name
    const isDOP =
      prod.name.toLowerCase().includes("dop") ||
      prod.name.toLowerCase().includes("igp") || // Indicazione Geografica Protetta
      prod.name.toLowerCase().includes("igt") // Indicazione Geografica Tipica

    // Build certifications array based on boolean fields
    const certificationNames: string[] = []
    if (isOrganic) certificationNames.push("Bio")
    if (isVegan) certificationNames.push("Vegan")
    if (isGlutenFree) certificationNames.push("Gluten-Free")
    if (isHalal) certificationNames.push("Halal")
    if (isWholeGrain) certificationNames.push("Whole-Grain")
    if (isDOP) certificationNames.push("DOP")

    // ✅ Read region and transportType from source data (products.ts)
    const region = prod.region || null
    const transportType = prod.transportType || "Temperatura ambiente"

    // ✅ Feature 178: Create product with many-to-many certifications
    const product = await prisma.products.create({
      data: {
        name: prod.name,
        productCode: prod.ProductCode || `PROD-${Date.now()}`,
        description: prod.description,
        formato: prod.formato,
        price: prod.price,
        stock: prod.stock,
        status: prod.status as any,
        slug: prod.slug,
        categoryId: categoryId,
        supplierId: supplierId,
        workspaceId: workspace.id,
        imageUrl: prod.imageUrl || [],
        transportType: transportType,
        region: region,
        certifications: [], // ⚠️ DEPRECATED: Keep empty array for backward compatibility
      },
    })

    // ✅ Feature 178: Create ProductCertification pivot records
    for (const certName of certificationNames) {
      const certificationId = certificationMap.get(certName)
      if (certificationId) {
        await prisma.productCertification.create({
          data: {
            productId: product.id,
            certificationId: certificationId,
          },
        })
      }
    }

    // ✅ Feature 179: Create ProductTransportType pivot record
    // Map Italian transport types to English
    const transportTypeMapping: Record<string, string> = {
      "Temperatura ambiente": "Ambient Temperature",
      "Trasporto refrigerato": "Refrigerated",
      "Refrigerato": "Refrigerated",
      "Trasporto congelato": "Frozen",
      "Congelato": "Frozen",
    }

    const englishTransportType = transportTypeMapping[transportType] || "Ambient Temperature"
    const transportTypeId = transportTypeMap.get(englishTransportType)

    if (transportTypeId) {
      await prisma.productTransportType.create({
        data: {
          productId: product.id,
          transportTypeId: transportTypeId,
        },
      })
    }
  }

  console.log(`✅ Created ${products.length} products`)

  // 8. Create Services
  console.log("🛠️  Creating services...")

  for (const svc of services) {
    await prisma.services.create({
      data: {
        name: svc.name,
        code: svc.code,
        description: svc.description,
        price: svc.price,
        isActive: svc.isActive,
        workspaceId: workspace.id,
        imageUrl: svc.imageUrl || [],
      },
    })
  }

  console.log(`✅ Created ${services.length} services`)

  // 9. Create Offers
  console.log("🎯 Creating offers...")

  // Get first category as fallback
  const firstCategoryId = Array.from(categoryMap.values())[0]

  for (const offer of offers) {
    // Find category by name from export data
    let categoryId = firstCategoryId // Default fallback

    if ((offer as any).categoryName) {
      const foundId = categoryMap.get((offer as any).categoryName)
      if (foundId) {
        categoryId = foundId
        console.log(
          `  ✅ Offer "${offer.name}" → Category "${(offer as any).categoryName}"`
        )
      } else {
        console.log(
          `  ⚠️  Category "${(offer as any).categoryName}" not found, using fallback`
        )
      }
    }

    await prisma.offers.create({
      data: {
        name: offer.name,
        description: offer.description,
        discountPercent: offer.value || 10,
        startDate: offer.validFrom ? new Date(offer.validFrom) : new Date(),
        endDate: offer.validUntil
          ? new Date(offer.validUntil)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: offer.isActive,
        categoryId: categoryId,
        workspaceId: workspace.id,
      },
    })
  }

  console.log(`✅ Created ${offers.length} offers`)

  // 10. Create FAQs (from defaultFAQs with keywords + category)
  console.log("❓ Creating FAQs...")

  const defaultFaqList = defaultFAQs(workspace.id)
  for (const faq of defaultFaqList) {
    await prisma.fAQ.create({
      data: {
        workspaceId: faq.workspaceId,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords,
        category: faq.category,
        order: faq.order,
        isActive: faq.isActive,
      },
    })
  }

  console.log(`✅ Created ${defaultFaqList.length} FAQs (5 categories)`)

  // 10. Create Campaigns
  console.log("📢 Creating campaigns...")

  for (const campaign of campaigns) {
    await prisma.campaign.create({
      data: {
        workspaceId: workspace.id,
        name: campaign.name,
        messagePreview: campaign.messagePreview,
        frequency: campaign.frequency as any,
        isActive: campaign.isActive,
        targetType: campaign.targetType as any,
        customerIds: campaign.customerIds || [],
        templateName: campaign.templateName,
        templateParams: campaign.templateParams,
        lastRunAt: campaign.lastRunAt ? new Date(campaign.lastRunAt) : null,
      },
    })
  }

  console.log(`✅ Created ${campaigns.length} campaigns`)

  // 12. Create Agent Configurations (Multi-Agent System)
  // Agents load their prompts from docs/prompts/*.md via defaultAgents()
  console.log("🤖 Creating agent configurations...") // Use defaultAgents from data file (includes all 6 agents with prompts)
  const agentConfigs = defaultAgents(workspace.id)
  console.log(
    `📄 Preparing ${agentConfigs.length} agents (ROUTER + 5 specialists + SAFETY)`
  )

  for (const config of agentConfigs) {
    await prisma.agentConfig.create({
      data: {
        workspaceId: config.workspaceId,
        name: config.name,
        type: config.type,
        description: config.description,
        icon: config.icon,
        systemPrompt: config.systemPrompt,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        order: config.order,
        isActive: config.isActive,
        availableFunctions: config.availableFunctions || null,
      },
    })
  }

  console.log(
    `✅ Created ${agentConfigs.length} agents (ROUTER + specialists + SAFETY)`
  )

  // 13. Create Sales Representatives
  console.log("👔 Creating sales representatives...")

  // First, create admin user as sales rep (Alessandro Romano)
  const adminSalesRep = await prisma.sales.create({
    data: {
      firstName: "Alessandro",
      lastName: "Romano",
      email: "andrea_gelsomino@hotmail.com", // Admin email
      phone: "+39 333 890 1234",
      workspaceId: workspace.id,
      isActive: true,
    },
  })

  const salesReps = [
    {
      firstName: "Marco",
      lastName: "Bianchi",
      email: "marco.bianchi@altrogusto.com",
      phone: "+393331234567",
    },
    {
      firstName: "Laura",
      lastName: "Conti",
      email: "laura.conti@altrogusto.com",
      phone: "+393337654321",
    },
    {
      firstName: "Giuseppe",
      lastName: "Ferretti",
      email: "giuseppe.ferretti@altrogusto.com",
      phone: "+393339876543",
    },
    {
      firstName: "Francesca",
      lastName: "Moretti",
      email: "francesca.moretti@altrogusto.com",
      phone: "+393334567890",
    },
  ]

  const createdSalesReps = [adminSalesRep] // Start with admin sales rep
  for (const rep of salesReps) {
    const salesRep = await prisma.sales.create({
      data: {
        ...rep,
        workspaceId: workspace.id,
        isActive: true,
      },
    })
    createdSalesReps.push(salesRep)
  }

  console.log(
    `✅ Created ${createdSalesReps.length} sales representatives (including admin)`
  )

  // 13. Create Test Customers with Historical Dates (distributed over months)
  console.log("👥 Creating test customers with historical dates...")

  const testCustomers = [
    {
      name: "Mario Rossi",
      email: "mario.rossi@test.com",
      phone: "+390212345678",
      language: "IT",
      company: "Rossi Limited S.r.l.",
      shippingAddress: {
        street: "Via Roma 123",
        city: "Milano",
        zip: "20100",
        country: "Italia",
      },
      createdAt: new Date(2025, 3, 5), // April 5, 2025
    },
    {
      name: "João Silva",
      email: "joao.silva@test.com",
      phone: "+351123456789",
      language: "PRT",
      company: "Silva & Filhos Lda",
      shippingAddress: {
        street: "Rua Augusta 456",
        city: "Lisboa",
        zip: "1100-053",
        country: "Portugal",
      },
      createdAt: new Date(2025, 4, 12), // May 12, 2025
    },
    {
      name: "Maria Garcia",
      email: "maria.garcia@test.com",
      phone: "+34666777888",
      language: "ESP",
      company: "Garcia Imports S.L.",
      shippingAddress: {
        street: "Calle Mayor 789",
        city: "Madrid",
        zip: "28013",
        country: "España",
      },
      createdAt: new Date(2025, 5, 8), // June 8, 2025
    },
    {
      name: "John Smith",
      email: "john.smith@test.com",
      phone: "+44123456789",
      language: "ENG",
      company: "Smith & Co Ltd",
      shippingAddress: {
        street: "Baker Street 221B",
        city: "London",
        zip: "NW1 6XE",
        country: "United Kingdom",
      },
      createdAt: new Date(2025, 6, 15), // July 15, 2025
    },
  ]

  for (let i = 0; i < testCustomers.length; i++) {
    const customer = testCustomers[i]
    // Assign unique sales rep to each customer
    const assignedSalesRep = createdSalesReps[i]

    await prisma.customers.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        language: customer.language,
        company: customer.company,
        address: JSON.stringify(customer.shippingAddress), // 📦 Indirizzo (serializzato come JSON)
        workspaceId: workspace.id,
        salesId: assignedSalesRep.id,
        isActive: true,
        // 🚨 First 2 customers are APPROVED (for testing), last 2 are BLOCKED (simulating new registrations)
        isBlacklisted: i >= 2, // Mario (0) and João (1) are approved, Maria (2) and John (3) are blocked
        activeChatbot: true,
        currency: "EUR",
        discount: 10, // 🎯 10% discount per tutti i clienti
        createdAt: customer.createdAt,
        updatedAt: customer.createdAt,
      },
    })
  }

  console.log(
    `✅ Created ${testCustomers.length} test customers (distributed Apr-Jul 2025)`
  )

  // � CREATE CHAT SESSIONS WITH MESSAGE HISTORY
  console.log("\n💬 Creating chat sessions with message history...")

  const allCustomers = await prisma.customers.findMany({
    where: { workspaceId: workspace.id },
  })

  console.log(`\n💬 Creating chat sessions with message history...`)
  console.log(`   Found ${allCustomers.length} customers`)

  // Italian customer - Mario Rossi
  const italianCustomer = allCustomers.find(
    (c: any) => c.language === "IT" || c.language === "it"
  )
  if (italianCustomer) {
    console.log(
      `   Creating chat for: ${italianCustomer.name} (${italianCustomer.language})`
    )
    const chatSession1 = await prisma.chatSession.create({
      data: {
        customerId: italianCustomer.id,
        workspaceId: workspace.id,
        status: "active",
        context: {
          language: "it",
          customerName: italianCustomer.name,
        },
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession1.id,
        direction: "INBOUND",
        content: "Ciao!",
        type: "TEXT",
        createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession1.id,
        direction: "OUTBOUND",
        content: "Ciao! Benvenuto in Bell'Italia. Come posso aiutarti oggi?",
        type: "TEXT",
        aiGenerated: true,
        metadata: {
          agentSelected: "CHATBOT_DUAL_LLM",
          sentBy: "AI",
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 4), // 4 minutes ago
      },
    })

    // 💬 Create conversation messages for chat history
    await prisma.conversationMessage.createMany({
      data: [
        {
          conversationId: chatSession1.id,
          workspaceId: workspace.id,
          customerId: italianCustomer.id,
          role: "user",
          content: "Ciao! Vorrei sapere quali formaggi avete disponibili",
          createdAt: new Date(Date.now() - 1000 * 60 * 10),
        },
        {
          conversationId: chatSession1.id,
          workspaceId: workspace.id,
          customerId: italianCustomer.id,
          role: "assistant",
          content:
            "Ciao! Abbiamo una vasta selezione di formaggi italiani:\n\n🧀 **Parmigiano Reggiano DOP** - €18.50/kg\n🧀 **Pecorino Romano DOP** - €16.90/kg\n🧀 **Gorgonzola Dolce** - €14.50/kg\n\nVuoi aggiungere qualcosa al carrello?",
          debugInfo: JSON.stringify({
            agentSelected: "PRODUCT_SEARCH",
            steps: [
              { agentType: "Router", decision: "PRODUCT_SEARCH" },
              { agentType: "PRODUCT_SEARCH", response: "..." },
            ],
          }),
          createdAt: new Date(Date.now() - 1000 * 60 * 9),
        },
        {
          conversationId: chatSession1.id,
          workspaceId: workspace.id,
          customerId: italianCustomer.id,
          role: "user",
          content: "Sì, vorrei 1kg di Parmigiano Reggiano",
          createdAt: new Date(Date.now() - 1000 * 60 * 8),
        },
        {
          conversationId: chatSession1.id,
          workspaceId: workspace.id,
          customerId: italianCustomer.id,
          role: "assistant",
          content:
            "✅ Perfetto! Ho aggiunto al carrello:\n\n**Parmigiano Reggiano DOP**\nQuantità: 1 kg\nPrezzo: €18.50\n\nVuoi procedere con l'ordine?",
          debugInfo: JSON.stringify({
            agentSelected: "CART",
            functionCalled: "AddToCart",
          }),
          createdAt: new Date(Date.now() - 1000 * 60 * 7),
        },
      ],
    })
  } else {
    console.log(`   ⚠️  Italian customer not found!`)
  }

  // Spanish customer - Maria Garcia
  const spanishCustomer = allCustomers.find(
    (c: any) => c.language === "ESP" || c.language === "es"
  )
  if (spanishCustomer) {
    console.log(
      `   Creating chat for: ${spanishCustomer.name} (${spanishCustomer.language})`
    )
    const chatSession2 = await prisma.chatSession.create({
      data: {
        customerId: spanishCustomer.id,
        workspaceId: workspace.id,
        status: "active",
        context: {
          language: "es",
          customerName: spanishCustomer.name,
        },
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession2.id,
        direction: "INBOUND",
        content: "¡Hola!",
        type: "TEXT",
        createdAt: new Date(Date.now() - 1000 * 60 * 1), // 1 minute ago
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession2.id,
        direction: "OUTBOUND",
        content: "¡Hola, mucho gusto conocerte! ¿Cómo puedo ayudarte?",
        type: "TEXT",
        aiGenerated: true,
        metadata: {
          agentSelected: "CHATBOT_DUAL_LLM",
          sentBy: "AI",
        },
        createdAt: new Date(), // Now
      },
    })

    // 💬 Create conversation messages
    await prisma.conversationMessage.createMany({
      data: [
        {
          conversationId: chatSession2.id,
          workspaceId: workspace.id,
          customerId: spanishCustomer.id,
          role: "user",
          content: "Hola, ¿dónde está mi pedido?",
          createdAt: new Date(Date.now() - 1000 * 60 * 15),
        },
        {
          conversationId: chatSession2.id,
          workspaceId: workspace.id,
          customerId: spanishCustomer.id,
          role: "assistant",
          content:
            "¡Hola! Tu pedido está en tránsito 🚚\n\n📦 **Pedido #ORD-001**\nEstado: En camino\nEntrega estimada: Mañana\n\n¿Necesitas algo más?",
          debugInfo: JSON.stringify({
            agentSelected: "ORDER_TRACKING",
          }),
          createdAt: new Date(Date.now() - 1000 * 60 * 14),
        },
      ],
    })
  } else {
    console.log(`   ⚠️  Spanish customer not found!`)
  }

  // Portuguese customer - João Silva
  const portugueseCustomer = allCustomers.find(
    (c: any) => c.language === "PRT" || c.language === "pt"
  )
  if (portugueseCustomer) {
    console.log(
      `   Creating chat for: ${portugueseCustomer.name} (${portugueseCustomer.language})`
    )
    const chatSession3 = await prisma.chatSession.create({
      data: {
        customerId: portugueseCustomer.id,
        workspaceId: workspace.id,
        status: "active",
        context: {
          language: "pt",
          customerName: portugueseCustomer.name,
        },
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession3.id,
        direction: "INBOUND",
        content: "Olá!",
        type: "TEXT",
        createdAt: new Date(Date.now() - 1000 * 30), // 30 seconds ago
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession3.id,
        direction: "OUTBOUND",
        content: "Olá, prazer em conhecê-lo! Como posso ajudá-lo?",
        type: "TEXT",
        aiGenerated: true,
        metadata: {
          agentSelected: "CHATBOT_DUAL_LLM",
          sentBy: "AI",
        },
        createdAt: new Date(Date.now() - 1000 * 15), // 15 seconds ago
      },
    })

    // 💬 Create conversation messages
    await prisma.conversationMessage.createMany({
      data: [
        {
          conversationId: chatSession3.id,
          workspaceId: workspace.id,
          customerId: portugueseCustomer.id,
          role: "user",
          content: "Olá! Tem alguma promoção hoje?",
          createdAt: new Date(Date.now() - 1000 * 60 * 20),
        },
        {
          conversationId: chatSession3.id,
          workspaceId: workspace.id,
          customerId: portugueseCustomer.id,
          role: "assistant",
          content:
            "Olá! Sim, temos ofertas especiais:\n\n🎉 **Oferta da Semana**:\n- Azeite Toscano: -20%\n- Prosciutto di Parma: -15%\n\nQuer aproveitar?",
          debugInfo: JSON.stringify({
            agentSelected: "PRODUCT_SEARCH",
          }),
          createdAt: new Date(Date.now() - 1000 * 60 * 19),
        },
      ],
    })
  } else {
    console.log(`   ⚠️  Portuguese customer not found!`)
  }

  // English customer - John Smith
  const englishCustomer = allCustomers.find(
    (c: any) => c.language === "ENG" || c.language === "en"
  )
  if (englishCustomer) {
    console.log(
      `   Creating chat for: ${englishCustomer.name} (${englishCustomer.language})`
    )
    const chatSession4 = await prisma.chatSession.create({
      data: {
        customerId: englishCustomer.id,
        workspaceId: workspace.id,
        status: "active",
        context: {
          language: "en",
          customerName: englishCustomer.name,
        },
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession4.id,
        direction: "INBOUND",
        content: "Hello!",
        type: "TEXT",
        createdAt: new Date(Date.now() - 1000 * 60 * 2), // 2 minutes ago
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: chatSession4.id,
        direction: "OUTBOUND",
        content: "Hello! Welcome to Bell'Italia. How can I help you today?",
        type: "TEXT",
        aiGenerated: true,
        metadata: {
          agentSelected: "CHATBOT_DUAL_LLM",
          sentBy: "AI",
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 1), // 1 minute ago
      },
    })

    // 💬 Create conversation messages - WITH 500 MESSAGES FOR TESTING INFINITE SCROLL
    console.log(`   Creating 500 messages for John Smith to test infinite scroll...`)
    
    const messages = []
    const baseTime = Date.now() - 1000 * 60 * 60 * 24 * 30 // Start from 30 days ago
    
    // Generate 500 messages alternating between user and assistant
    for (let i = 0; i < 500; i++) {
      const isUserMessage = i % 2 === 0
      const messageTime = new Date(baseTime + (i * 1000 * 60 * 5)) // Each message 5 minutes apart
      
      messages.push({
        conversationId: chatSession4.id,
        workspaceId: workspace.id,
        customerId: englishCustomer.id,
        role: isUserMessage ? "user" : "assistant",
        content: isUserMessage 
          ? `Customer message #${i + 1}: Can I ask a question about your products?`
          : `Assistant response #${i + 1}: Of course! Feel free to ask me anything. I'm here to help you with product information, shipping details, and more.`,
        debugInfo: isUserMessage ? undefined : JSON.stringify({
          agentSelected: "GENERAL_INQUIRY",
          tokensUsed: Math.floor(Math.random() * 100) + 20,
        }),
        createdAt: messageTime,
      })
    }
    
    await prisma.conversationMessage.createMany({
      data: messages,
    })
    
    console.log(`   ✅ Created 500 messages for John Smith`)

  } else {
    console.log(`   ⚠️  English customer not found!`)
  }

  console.log(`✅ Created chat sessions with welcome messages`)

  //  CREATE HISTORICAL ORDERS (1 year of data)
  console.log("\n📦 Creating historical orders...")

  const customersList = await prisma.customers.findMany({
    where: { workspaceId: workspace.id },
  })

  const productsList = await prisma.products.findMany({
    where: { workspaceId: workspace.id, isActive: true },
    take: 10,
  })

  if (productsList.length > 0 && customersList.length > 0) {
    // Helper function to create order with items
    async function createOrder(
      orderCode: string,
      customerId: string,
      total: number,
      status:
        | "PENDING"
        | "CONFIRMED"
        | "PROCESSING"
        | "DELIVERED"
        | "CANCELLED",
      date: Date,
      productIds: string[],
      quantities: number[]
    ) {
      const order = await prisma.orders.create({
        data: {
          orderCode,
          customerId,
          workspaceId: workspace.id,
          status,
          totalAmount: total,
          createdAt: date,
        },
      })

      for (let i = 0; i < productIds.length; i++) {
        const product = await prisma.products.findUnique({
          where: { id: productIds[i] },
        })
        if (product) {
          await prisma.orderItems.create({
            data: {
              orderId: order.id,
              productId: product.id,
              quantity: quantities[i],
              unitPrice: product.price,
              totalPrice: product.price * quantities[i],
            },
          })
        }
      }

      // 💰 BILLING: Removed from seed - workspaces start at €0.00
      // Real billing will be created when users actually use the system

      return order
    }

    // Create 10 orders per month for last 6 months (Apr-Sep 2025)
    const months = [
      { month: 4, year: 2025, days: [5, 8, 12, 15, 18, 22, 25, 28] },
      { month: 5, year: 2025, days: [3, 7, 11, 14, 19, 23, 26, 30] },
      { month: 6, year: 2025, days: [2, 6, 10, 13, 17, 21, 24, 28] },
      { month: 7, year: 2025, days: [1, 5, 9, 12, 16, 20, 23, 27] },
      { month: 8, year: 2025, days: [4, 8, 11, 15, 19, 22, 26, 29] },
      { month: 9, year: 2025, days: [2, 6, 10, 15, 19, 23, 27, 30] },
    ]

    let orderCount = 1
    for (const { month, year, days } of months) {
      for (const day of days) {
        const customer = customersList[orderCount % customersList.length]
        const numProducts = Math.floor(Math.random() * 3) + 1
        const selectedProducts = []
        const quantities = []

        for (let i = 0; i < numProducts; i++) {
          const prod =
            productsList[Math.floor(Math.random() * productsList.length)]
          selectedProducts.push(prod.id)
          quantities.push(Math.floor(Math.random() * 3) + 1)
        }

        const total = Math.floor(Math.random() * 150) + 30
        const statuses: ("DELIVERED" | "CONFIRMED" | "PROCESSING")[] = [
          "DELIVERED",
          "DELIVERED",
          "DELIVERED",
          "CONFIRMED",
        ]
        const status = statuses[Math.floor(Math.random() * statuses.length)]

        await createOrder(
          `ORD-${String(orderCount).padStart(3, "0")}-${year}-${month}`,
          customer.id,
          total,
          status,
          new Date(year, month - 1, day),
          selectedProducts,
          quantities
        )

        orderCount++
      }
    }

    console.log(
      `✅ Created ${orderCount - 1} historical orders with sales records`
    )
  } else {
    console.log(
      "⚠️  No products or customers found, skipping historical orders"
    )
  }

  // 10. Create Product Searches for Top 10 Analytics
  console.log("\n🔍 Creating product search history...")

  if (productsList.length > 0 && customersList.length > 0) {
    // Top 10 most searched products with realistic distribution
    const topProducts = [
      { name: "Mozzarella di Bufala", searches: 156 },
      { name: "Parmigiano Reggiano 24 mesi", searches: 134 },
      { name: "Prosciutto di Parma", searches: 112 },
      { name: "Panettone Artigianale", searches: 98 },
      { name: "Olio Extra Vergine Toscano", searches: 87 },
      { name: "Aceto Balsamico di Modena", searches: 76 },
      { name: "Tartufo Nero", searches: 64 },
      { name: "Pasta Artigianale", searches: 52 },
      { name: "Gorgonzola DOP", searches: 41 },
      { name: "Limoncello di Sorrento", searches: 35 },
    ]

    let totalSearches = 0

    for (const product of topProducts) {
      for (let i = 0; i < product.searches; i++) {
        // Distribute searches over last 30 days with more recent activity
        const daysAgo = Math.floor(Math.random() * 30)
        const hoursAgo = Math.floor(Math.random() * 24)
        const searchDate = new Date()
        searchDate.setDate(searchDate.getDate() - daysAgo)
        searchDate.setHours(searchDate.getHours() - hoursAgo)

        // Random customer or anonymous (70% with customer, 30% anonymous)
        const hasCustomer = Math.random() > 0.3
        const customer = hasCustomer
          ? customersList[Math.floor(Math.random() * customersList.length)]
          : null

        await prisma.productSearch.create({
          data: {
            query: product.name,
            workspaceId: workspace.id,
            customerId: customer?.id,
            createdAt: searchDate,
          },
        })

        totalSearches++
      }
    }

    console.log(`✅ Created ${totalSearches} product search records`)
    console.log(
      `   - Top searched: ${topProducts[0].name} (${topProducts[0].searches} searches)`
    )
    console.log(
      `   - Distribution: Last 30 days with realistic hourly patterns`
    )
  } else {
    console.log("⚠️  No products or customers found, skipping product searches")
  }

  // 8. Create MESSAGE billing (€0.15 per message/interaction)
  console.log("\n� Creating message billing (LLM usage)...")

  // Re-fetch all customers for message billing
  const customersForMessages = await prisma.customers.findMany({
    where: { workspaceId: workspace.id },
  })

  // Use pricing from database (with fallback for seed)
  const messageCost =
    pricingConfigData.find((p) => p.key === "MESSAGE")?.value ?? 0.15
  let messageBillingRecords = 0
  let totalMessages = 0

  if (customersForMessages.length > 0) {
    // Generate realistic message interactions across different months
    // Each entry represents total messages for one customer in one month
    const monthsToSimulate = [
      { month: 4, year: 2025, messagesPerCustomer: [12, 18, 8, 15, 22, 10, 8] }, // April - 93 messages total
      { month: 5, year: 2025, messagesPerCustomer: [8, 10, 15, 8, 12, 18, 6] }, // May - 77 messages
      {
        month: 6,
        year: 2025,
        messagesPerCustomer: [20, 15, 25, 12, 18, 16, 12],
      }, // June - 118 messages
      {
        month: 7,
        year: 2025,
        messagesPerCustomer: [16, 12, 20, 15, 22, 8, 15],
      }, // July - 108 messages
      { month: 8, year: 2025, messagesPerCustomer: [12, 8, 15, 12, 18, 10, 8] }, // August - 83 messages
      {
        month: 9,
        year: 2025,
        messagesPerCustomer: [25, 20, 30, 15, 22, 18, 12],
      }, // September - 142 messages
      {
        month: 10,
        year: 2025,
        messagesPerCustomer: [35, 30, 40, 22, 32, 28, 18],
      }, // October - 205 messages
    ]

    for (const monthData of monthsToSimulate) {
      for (
        let i = 0;
        i < customersForMessages.length &&
        i < monthData.messagesPerCustomer.length;
        i++
      ) {
        const customer = customersForMessages[i]
        const numMessages = monthData.messagesPerCustomer[i]

        if (numMessages > 0) {
          // Use last day of conversations (around day 25-28) as the billing date
          const lastMessageDay = 25 + Math.floor(Math.random() * 3)
          const billingDate = new Date(
            monthData.year,
            monthData.month - 1,
            lastMessageDay
          )
          const totalCost = numMessages * messageCost

          // 💰 BILLING: Removed from seed - workspaces start at €0.00
          // await prisma.billing.create(...)
          
          messageBillingRecords++
          totalMessages += numMessages
        }
      }
    }
  }

  console.log(`⚠️  Billing records skipped in seed (workspaces start at €0.00)`)
  console.log(`   - Message billing: ${messageBillingRecords} records (would be €${(messageCost * totalMessages).toFixed(2)})`)
  console.log(`   - Real billing will be created when users actually use the system`)

  // 9. Monthly channel billing - skipped in seed
  console.log("\n💳 Skipping monthly channel billing (workspaces start at €0.00)...")

  const monthlyChannelCost =
    pricingConfigData.find((p) => p.key === "MONTHLY_CHANNEL_COST")?.value ?? 49
  let channelBillingCount = 0

  // Generate for same months as messages (April-October 2025)
  const billingMonths = [
    { month: 4, year: 2025 },
    { month: 5, year: 2025 },
    { month: 6, year: 2025 },
    { month: 7, year: 2025 },
    { month: 8, year: 2025 },
    { month: 9, year: 2025 },
    { month: 10, year: 2025 },
  ]

  for (const monthData of billingMonths) {
    // 💰 BILLING: Removed from seed - workspaces start at €0.00
    // Create MONTHLY_CHANNEL billing on the 1st day of each month
    const channelDate = new Date(monthData.year, monthData.month - 1, 1)

    // await prisma.billing.create(...)

    channelBillingCount++
  }

  console.log(`⚠️  Monthly channel billing SKIPPED (workspaces start at €0.00)`)
  console.log(`   - Would create: ${channelBillingCount} records over ${channelBillingCount} months`)
  console.log(`   - Would cost: €${(monthlyChannelCost * channelBillingCount).toFixed(2)} total`)
  console.log(`   - Real billing starts when workspace is activated`)

  // 10. Create PUSH_CAMPAIGN billing (€1.00) for advertising push notifications
  console.log("\n� Creating push campaign billing (advertising)...")

  // Re-fetch all customers for push billing
  const customersForPush = await prisma.customers.findMany({
    where: { workspaceId: workspace.id },
  })

  const pushCampaignCost =
    pricingConfigData.find((p) => p.key === "PUSH_CAMPAIGN")?.value ?? 1.0
  let pushCampaignCount = 0

  if (customersForPush.length >= 3) {
    // Simulate advertising campaigns sent to customers
    const pushCampaigns = []

    // Campaign 1: Spring Sale - first 3 customers
    pushCampaigns.push({
      month: 5,
      year: 2025,
      day: 15,
      customers: customersForPush.slice(0, 3).map((c) => c.id),
      campaign: "Spring Sale 2025",
    })

    // Campaign 2: Summer Offers - next 3 (or loop back if needed)
    if (customersForPush.length >= 6) {
      pushCampaigns.push({
        month: 6,
        year: 2025,
        day: 20,
        customers: customersForPush.slice(3, 6).map((c) => c.id),
        campaign: "Summer Offers",
      })
    } else {
      pushCampaigns.push({
        month: 6,
        year: 2025,
        day: 20,
        customers: customersForPush
          .slice(0, Math.min(3, customersForPush.length))
          .map((c) => c.id),
        campaign: "Summer Offers",
      })
    }

    // Campaign 3: Mid-Year Promo - select subset
    pushCampaigns.push({
      month: 7,
      year: 2025,
      day: 10,
      customers: [
        customersForPush[0].id,
        customersForPush[Math.min(2, customersForPush.length - 1)].id,
      ],
      campaign: "Mid-Year Promo",
    })

    // Campaign 4: Back to School
    pushCampaigns.push({
      month: 8,
      year: 2025,
      day: 25,
      customers: customersForPush
        .slice(1, Math.min(4, customersForPush.length))
        .map((c) => c.id),
      campaign: "Back to School",
    })

    // Campaign 5: Autumn Collection - all available customers
    pushCampaigns.push({
      month: 9,
      year: 2025,
      day: 18,
      customers: customersForPush.map((c) => c.id),
      campaign: "Autumn Collection Launch",
    })

    for (const campaign of pushCampaigns) {
      const campaignDate = new Date(
        campaign.year,
        campaign.month - 1,
        campaign.day
      )
      for (const customerId of campaign.customers) {
        // 💰 BILLING: Removed from seed - workspaces start at €0.00
        // await prisma.billing.create(...)
        
        pushCampaignCount++
      }
    }
  }

  console.log(`⚠️  Skipped ${pushCampaignCount} push campaign billing records`)
  console.log(`   - Would be: €${(pushCampaignCost * pushCampaignCount).toFixed(2)}`)
  console.log(`   - Real billing created when campaigns are sent`)

  // 10. Create GDPR Content in 4 languages
  console.log("\n📋 Creating GDPR content in 4 languages...")
  
  const fs = require("fs")
  const path = require("path")
  const gdprLanguages = ["it", "en", "es", "pt"]
  const gdprContentMap = new Map<string, string>()

  // Use path relative to backend root (where seed.ts is located)
  const gdprDir = path.join(__dirname, "..", "docs", "prompts", "gdpr")

  for (const lang of gdprLanguages) {
    const filePath = path.join(gdprDir, `gdpr-${lang}.md`)
    try {
      const content = fs.readFileSync(filePath, "utf-8")
      gdprContentMap.set(lang, content)
      console.log(`   ✓ Loaded GDPR content for language: ${lang}`)
    } catch (error) {
      console.warn(`⚠️  Could not read GDPR file for language '${lang}' at ${filePath}`)
      gdprContentMap.set(lang, `# GDPR Content - ${lang.toUpperCase()}\n\nContent not available.`)
    }
  }

  // Create GDPR content entry for workspace (one row with all 4 languages)
  // First delete any existing entry
  await prisma.gdprContent.deleteMany({
    where: {
      workspaceId: workspace.id,
    },
  })

  // Create one row with all 4 languages in separate columns
  await prisma.gdprContent.create({
    data: {
      workspaceId: workspace.id,
      gdpr_ita: gdprContentMap.get("it") || "# GDPR - Italiano\n\nContent not available.",
      gdpr_eng: gdprContentMap.get("en") || "# GDPR - English\n\nContent not available.",
      gdpr_esp: gdprContentMap.get("es") || "# GDPR - Español\n\nContent not available.",
      gdpr_prt: gdprContentMap.get("pt") || "# GDPR - Português\n\nContent not available.",
    },
  })

  console.log(`✅ Created GDPR content in 4 languages (it, en, es, pt)`)

  console.log("\n🎉 Database seed completed successfully!")
  console.log(`\n📊 Summary:`)
  console.log(`   - Workspace: ${workspace.name}`)
  console.log(`   - Admin: ${adminEmail}`)
  console.log(`   - Categories: ${categories.length}`)
  console.log(`   - Products: ${products.length}`)
  console.log(`   - Services: ${services.length}`)
  console.log(`   - Offers: ${offers.length}`)
  console.log(`   - FAQs: ${faqs.length}`)
  console.log(`   - Campaigns: ${campaigns.length}`)
  console.log(`   - Sales Representatives: 5`)
  console.log(`   - Test Customers: 4 (distributed Apr-Jul 2025)`)
  console.log(`   - Historical Orders: ~48 orders (Apr-Sep 2025)`)
  console.log(`   - Product Searches: 855 searches (Top 10 products)`)
  console.log(`   - 💰 Billing: SKIPPED (workspaces start at €0.00)`)
  console.log(`       • Would track: ${messageBillingRecords} message records (€${(messageCost * totalMessages).toFixed(2)})`)
  console.log(`       • Would track: ${channelBillingCount} channel months (€${(monthlyChannelCost * channelBillingCount).toFixed(2)})`)
  console.log(`       • Would track: ${pushCampaignCount} push campaigns (€${(pushCampaignCost * pushCampaignCount).toFixed(2)})`)
  console.log(`       • Real billing starts when workspace is used in production`)

  // 📬 CREATE WHATSAPP QUEUE TEST MESSAGES
  console.log("\n📬 Creating WhatsApp queue test messages...")

  // Get first 3 customers for test messages
  const queueCustomers = allCustomers.slice(0, 3)

  if (queueCustomers.length >= 3) {
    // 1 sent message (with deliveredAt)
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId: workspace.id,
        customerId: queueCustomers[2].id,
        phoneNumber: queueCustomers[2].phone || "+34612345678",
        messageContent: "¡Hola! Tu pedido ha sido enviado con éxito.",
        status: "sent",
        deliveredAt: new Date(Date.now() - 120000), // 2 minutes ago
        createdAt: new Date(Date.now() - 180000), // 3 minutes ago
      },
    })

    // 2 error messages
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId: workspace.id,
        customerId: queueCustomers[0].id,
        phoneNumber: queueCustomers[0].phone || "+393331234567",
        messageContent: "Messaggio bloccato per sicurezza",
        status: "error",
        errorMessage: "Safety validation failed",
        createdAt: new Date(Date.now() - 300000), // 5 minutes ago
      },
    })

    await prisma.whatsAppQueue.create({
      data: {
        workspaceId: workspace.id,
        customerId: queueCustomers[1].id,
        phoneNumber: "invalid-phone",
        messageContent: "Test message with invalid phone",
        status: "error",
        errorMessage: "Invalid phone number format",
        createdAt: new Date(Date.now() - 240000), // 4 minutes ago
      },
    })

    console.log("✅ Created 3 WhatsApp queue test messages:")
    console.log("   - 1 sent message (with deliveredAt)")
    console.log("   - 2 error messages (safety validation + invalid phone)")
  } else {
    console.log("⚠️  Not enough customers to create queue messages")
  }

  // ============================================================================
  // 🆕 Feature 185: Create Plan Configurations
  // ============================================================================
  console.log("\n💳 Creating plan configurations...")

  const planConfigurations = [
    {
      planType: "FREE_TRIAL" as const,
      displayName: "Free Trial",
      monthlyFee: 0,
      maxChannels: 1,
      maxProducts: 50,
      maxCustomers: 50,
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
      lowBalanceThreshold: 5.00,
      trialDays: 14,
      initialCredit: 29.00,
      features: JSON.stringify([
        "14 giorni di prova gratuita",
        "€29 di credito iniziale",
        "1 canale WhatsApp",
        "50 prodotti",
        "50 clienti",
      ]),
    },
    {
      planType: "BASIC" as const,
      displayName: "Basic",
      monthlyFee: 29.00,
      maxChannels: 1,
      maxProducts: 50,
      maxCustomers: 50,
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
      lowBalanceThreshold: 5.00,
      trialDays: 0,
      initialCredit: 0,
      features: JSON.stringify([
        "1 canale WhatsApp",
        "50 prodotti",
        "50 clienti",
        "Multi-language support",
        "Analytics dashboard",
      ]),
    },
    {
      planType: "PREMIUM" as const,
      displayName: "Premium",
      monthlyFee: 49.00,
      maxChannels: 2,
      maxProducts: 100,
      maxCustomers: 100,
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
      lowBalanceThreshold: 5.00,
      trialDays: 0,
      initialCredit: 0,
      features: JSON.stringify([
        "2 canali WhatsApp",
        "100 prodotti",
        "100 clienti",
        "Multi-language support",
        "Analytics avanzati",
        "Brand customization",
        "Priority support",
      ]),
    },
    {
      planType: "ENTERPRISE" as const,
      displayName: "Enterprise",
      monthlyFee: 149.00, // Base price, actual is custom
      maxChannels: 999, // Unlimited
      maxProducts: 9999, // Unlimited
      maxCustomers: 9999, // Unlimited
      messageCost: 0.08, // Volume discount
      orderCost: 0.80, // Volume discount
      pushCost: 0.80, // Volume discount
      lowBalanceThreshold: 10.00,
      trialDays: 0,
      initialCredit: 0,
      features: JSON.stringify([
        "Canali illimitati",
        "Prodotti illimitati",
        "Clienti illimitati",
        "Sconti volume sui costi",
        "Server dedicato",
        "CRM integrato",
        "Support 24/7",
        "Account manager dedicato",
      ]),
    },
  ]

  for (const plan of planConfigurations) {
    await prisma.planConfiguration.create({
      data: plan,
    })
  }

  console.log(`✅ Created ${planConfigurations.length} plan configurations`)

  // Create initial billing transaction for FREE_TRIAL credit
  await prisma.billingTransaction.create({
    data: {
      workspaceId: workspace.id,
      type: "INITIAL_CREDIT",
      amount: 29.00,
      balanceAfter: 29.00,
      description: "Initial Free Trial credit",
    },
  })

  console.log("✅ Created initial billing transaction (+€29 trial credit)")

  console.log(`\n✅ Ready to use!`)
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
