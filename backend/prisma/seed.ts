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

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { campaigns } from "./data/campaigns"
import { categories } from "./data/categories"
import { faqs } from "./data/faqs"
import { offers } from "./data/offers"
import { products } from "./data/products"
import { services } from "./data/services"
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
  await prisma.otpToken.deleteMany()
  await prisma.registrationToken.deleteMany()
  await prisma.secureToken.deleteMany()
  await prisma.customerFeedback.deleteMany()
  await prisma.campaignSent.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.billing.deleteMany()
  await prisma.usage.deleteMany()
  await prisma.adminSession.deleteMany()
  await prisma.shortUrls.deleteMany()
  await prisma.registrationAttempts.deleteMany()
  await prisma.carts.deleteMany()
  await prisma.orders.deleteMany()
  await prisma.customers.deleteMany()
  await prisma.documentChunks.deleteMany()
  await prisma.fAQChunks.deleteMany()
  await prisma.serviceChunks.deleteMany()
  await prisma.productChunks.deleteMany()
  await prisma.documents.deleteMany()
  await prisma.fAQ.deleteMany()
  await prisma.offers.deleteMany()
  await prisma.services.deleteMany()
  await prisma.products.deleteMany()
  await prisma.productSearch.deleteMany()
  await prisma.categories.deleteMany()
  await prisma.sales.deleteMany()
  await prisma.languages.deleteMany()
  await prisma.prompts.deleteMany()
  await prisma.agentConfig.deleteMany()
  await prisma.gdprContent.deleteMany()
  await prisma.whatsappSettings.deleteMany()
  await prisma.paymentDetails.deleteMany()

  // Delete user-related tables
  await prisma.userWorkspace.deleteMany()
  await prisma.user.deleteMany()

  // Finally delete workspace
  await prisma.workspace.deleteMany()

  console.log("✅ Database cleaned")

  // 2. Create Admin User
  console.log("👤 Creating admin user...")

  const adminEmail = process.env.ADMIN_EMAIL || "admin@shopme.com"
  const adminPassword = process.env.ADMIN_PASSWORD || "venezia44"
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashedPassword,
      firstName: "Admin",
      lastName: "ShopME",
      status: "ACTIVE",
      role: "ADMIN",
    },
  })

  console.log(`✅ Admin user created: ${adminEmail}`)

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
      debugMode:
        workspaceSettings.debugMode !== undefined
          ? workspaceSettings.debugMode
          : true,
      welcomeMessages: workspaceSettings.welcomeMessages,
      wipMessages: workspaceSettings.wipMessages,
      afterRegistrationMessages: workspaceSettings.afterRegistrationMessages,
    },
  })

  console.log(`✅ Workspace created: ${workspace.name} (${workspace.id})`)

  // 4. Associate Admin with Workspace
  await prisma.userWorkspace.create({
    data: {
      userId: adminUser.id,
      workspaceId: workspace.id,
      role: "OWNER",
    },
  })

  console.log("✅ Admin associated with workspace")

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

  // 6. Create Categories
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

    await prisma.products.create({
      data: {
        name: prod.name,
        ProductCode: prod.ProductCode || `PROD-${Date.now()}`,
        description: prod.description,
        formato: prod.formato,
        price: prod.price,
        stock: prod.stock,
        status: prod.status as any,
        slug: prod.slug,
        categoryId: categoryId,
        workspaceId: workspace.id,
        imageUrl: prod.imageUrl || [],
      },
    })
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

  // 10. Create FAQs
  console.log("❓ Creating FAQs...")

  for (const faq of faqs) {
    await prisma.fAQ.create({
      data: {
        question: faq.question,
        answer: faq.answer,
        workspaceId: workspace.id,
      },
    })
  }

  console.log(`✅ Created ${faqs.length} FAQs`)

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

  // 12. Create Prompt (for LLM Service)
  console.log("🤖 Creating prompt...")

  // 📖 Read prompt from docs/prompt_agent.md
  const fs = require("fs")
  const path = require("path")
  const promptPath = path.join(__dirname, "../../docs/prompt_agent.md")

  let agentPrompt =
    "You are a helpful AI assistant for an Italian gourmet food e-commerce store."

  try {
    if (fs.existsSync(promptPath)) {
      agentPrompt = fs.readFileSync(promptPath, "utf8")
      console.log(
        `  ✅ Loaded prompt from docs/prompt_agent.md (${agentPrompt.length} chars)`
      )
    } else {
      console.warn(
        `  ⚠️  File not found: ${promptPath} - using placeholder prompt`
      )
    }
  } catch (error: any) {
    console.warn(
      `  ⚠️  Error reading prompt file: ${error.message} - using placeholder`
    )
  }

  await prisma.prompts.create({
    data: {
      workspaceId: workspace.id,
      name: "SofiA - Main Agent Prompt",
      content: agentPrompt,
      isActive: true,
      model: "openai/gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1000,
    },
  })

  console.log("✅ Prompt created in Prompts table")

  // 13. Create Sales Representatives
  console.log("👔 Creating sales representatives...")

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
    {
      firstName: "Alessandro",
      lastName: "Romano",
      email: "alessandro.romano@altrogusto.com",
      phone: "+393338901234",
    },
  ]

  const createdSalesReps = []
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

  console.log(`✅ Created ${createdSalesReps.length} sales representatives`)

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
        content: "Ciao! Benvenuto in Altro Gusto. Come posso aiutarti oggi?",
        type: "TEXT",
        aiGenerated: true,
        metadata: {
          agentSelected: "CHATBOT_DUAL_LLM",
          sentBy: "AI",
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 4), // 4 minutes ago
      },
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
        content: "Hello! Welcome to Altro Gusto. How can I help you today?",
        type: "TEXT",
        aiGenerated: true,
        metadata: {
          agentSelected: "CHATBOT_DUAL_LLM",
          sentBy: "AI",
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 1), // 1 minute ago
      },
    })
  } else {
    console.log(`   ⚠️  English customer not found!`)
  }

  console.log(`✅ Created chat sessions with welcome messages`)

  // �📦 CREATE HISTORICAL ORDERS (1 year of data)
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

  // 11. Create LLM Billing Data (Historical Costs)
  console.log("\n💰 Creating LLM billing history...")

  // Monthly LLM costs matching the report data (April-October 2025)
  const billingData = [
    {
      month: 4,
      year: 2025,
      amount: 1.25,
      description: "GPT-4-mini usage - April 2025",
    },
    {
      month: 5,
      year: 2025,
      amount: 3.68,
      description: "GPT-4-mini usage - May 2025",
    },
    {
      month: 6,
      year: 2025,
      amount: 6.12,
      description: "GPT-4-mini usage - June 2025",
    },
    {
      month: 7,
      year: 2025,
      amount: 5.64,
      description: "GPT-4-mini usage - July 2025",
    },
    {
      month: 8,
      year: 2025,
      amount: 4.34,
      description: "GPT-4-mini usage - August 2025",
    },
    {
      month: 9,
      year: 2025,
      amount: 7.84,
      description: "GPT-4-mini usage - September 2025",
    },
    {
      month: 10,
      year: 2025,
      amount: 12.67,
      description: "GPT-4-mini usage - October 2025",
    },
  ]

  let totalBillingAmount = 0

  for (const billing of billingData) {
    // Create billing record on the 1st day of each month
    const billingDate = new Date(billing.year, billing.month - 1, 1)

    await prisma.billing.create({
      data: {
        workspaceId: workspace.id,
        amount: billing.amount,
        type: "MESSAGE", // Represents LLM usage costs
        description: billing.description,
        currentCharge: billing.amount,
        previousTotal: totalBillingAmount,
        newTotal: totalBillingAmount + billing.amount,
        createdAt: billingDate,
      },
    })

    totalBillingAmount += billing.amount
  }

  console.log(`✅ Created ${billingData.length} LLM billing records`)
  console.log(
    `   - Total LLM costs: €${totalBillingAmount.toFixed(2)} (Apr-Oct 2025)`
  )
  console.log(
    `   - Average: €${(totalBillingAmount / billingData.length).toFixed(2)}/month`
  )
  console.log(`   - Peak: €12.67 (October 2025)`)

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
  console.log(`   - LLM Billing: 7 months, €41.54 total costs`)
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
