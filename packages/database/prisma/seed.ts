/**
 * SEED DATABASE WITH TEST DATA
 *
 * This seed script:
 * 1. Creates workspace, users, and admin
 * 2. Imports data from prisma/data/
 * 3. Creates test customers and chat sessions
 *
 * ⚠️  DESTRUCTIVE OPERATION - BLOCKED IN PRODUCTION
 *
 * Usage: npm run seed
 */

import { config } from "dotenv"
config() // Load environment variables from .env file

import { PrismaClient } from "@echatbot/database"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as bcrypt from "bcrypt"
import { campaigns } from "./data/campaigns"
import { categories } from "./data/categories"
import { defaultAgents } from "./data/defaultAgents"
import { defaultFAQs } from "./data/defaultFAQs"
import { faqs } from "./data/faqs"
import { offers } from "./data/offers"
import { platformConfigData } from "./data/platformConfig"
import { pricingConfigData } from "./data/pricingConfig"
import { products } from "./data/products"
import { services } from "./data/services"
import { workspaceSettings } from "./data/workspaceSettings"

// Initialize the PostgreSQL adapter for Prisma 7 with SSL config for Heroku
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('amazonaws.com') || process.env.DATABASE_URL?.includes('heroku')
    ? { rejectUnauthorized: false }
    : false
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

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
    await prisma.monthlyInvoice.deleteMany() // ✅ Feature 197: Monthly invoices
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
    await prisma.twoFactorResetToken.deleteMany() // ✅ Feature 189: Delete 2FA reset tokens before users (FK constraint)
    await prisma.user.deleteMany()

    // ✅ Feature 185: Delete plan configurations before workspace
    await prisma.planConfiguration.deleteMany()

    // Finally delete workspace
    await prisma.workspace.deleteMany()

  console.log("✅ Database cleaned")

  // 2. Create Admin User
  console.log("👤 Creating admin user...")

  const adminEmail = process.env.ADMIN_EMAIL || "admin@echatbot.ai"
  const adminPassword = process.env.ADMIN_PASSWORD || "venezia44"
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashedPassword,
      firstName: "Alessandro",
      lastName: "Romano",
      status: "ACTIVE",
      role: "ADMIN",
      planType: "ENTERPRISE", // ✅ Enterprise plan (full feature set)
      creditBalance: 186.90, // ✅ Reflects final balance from billing history
      isDeveloperUser: true, // ✅ Developer User - skip 2FA for testing
      twoFactorEnabled: false, // ❌ 2FA disabled by default - enable via Settings UI
      twoFactorEnabledAt: null,
      recoveryCodes: [], // Recovery codes generated when 2FA is enabled
      // 🧾 Billing Information (Andrea's requirement - sample data)
      companyName: "eChatbot Italia S.r.l.",
      vatNumber: "IT12345678901",
      website: "https://www.echatbot.it",
      billingPhone: "+39 06 1234567",
      billingAddress: "Via Roma 123, 00100 Roma, Italia",
    },
  })

  console.log(`✅ Admin user created: ${adminEmail}`)
  console.log(`📧 Email: ${adminEmail}`)
  console.log(`🔑 Password: ${adminPassword}`)
  console.log(`🔧 isDeveloperUser: true (Skip 2FA for testing)\n`)

  // 2.5. Create Platform Admin User (for Backoffice access)
  console.log("👤 Creating platform admin user...")

  const platformAdminEmail = "gelsogrove@gmail.com"
  const platformAdminPassword = process.env.PLATFORM_ADMIN_PASSWORD || "Venezia44"
  const platformAdminHashedPassword = await bcrypt.hash(platformAdminPassword, 10)

  const platformAdminUser = await prisma.user.create({
    data: {
      email: platformAdminEmail,
      passwordHash: platformAdminHashedPassword,
      firstName: "Andrea",
      lastName: "Gelsomino",
      status: "ACTIVE",
      role: "ADMIN",
      planType: "PREMIUM", // ✅ Premium plan (not free trial)
      isPlatformAdmin: true, // ✅ Platform Admin - can access backoffice + skip 2FA
      isDeveloperUser: false, // ❌ Not a developer (can't be both)
      twoFactorEnabled: false,
      twoFactorEnabledAt: null,
      recoveryCodes: [],
      companyName: "eChatbot Platform",
      vatNumber: null,
      website: "https://www.echatbot.it",
      billingPhone: null,
      billingAddress: null,
    },
  })

  console.log(`✅ Platform admin user created: ${platformAdminEmail}`)
  console.log(`📧 Email: ${platformAdminEmail}`)
  console.log(`🔑 Password: ${platformAdminPassword}`)
  console.log(`🔐 isPlatformAdmin: true (Backoffice access + Skip 2FA)\n`)

  // 2.7. Create E-commerce Workspace for Admin User (BellItalia VIP)
    console.log("🏢 Creating E-commerce workspace (BellItalia VIP) for admin user...")

    const ecommerceWorkspace = await prisma.workspace.create({
      data: {
        name: "BellItalia VIP",
        slug: "bell-italia-vip",
      whatsappPhoneNumber: "+34654728751",
      notificationEmail: "info@bellitalia.com",
      isActive: true,
      language: "ENG",
      currency: "EUR",
      description: "Italian Gourmet Food E-commerce - VIP Channel",
      url: "https://bellitalia.com/vip",
      channelStatus: true,
      debugMode: true,
      welcomeMessage: `Ciao, piacere di conoscerti! 👋
Mi chiamo SofIA e sono l'assistenza virtuale di BellItalia.
Siamo un importatore di prodotti italiani.

Come posso aiutarti oggi?
Stai cercando un prodotto in particolare oppure hai una domanda specifica da farmi?

Con questo servizio puoi:
• chiedere informazioni su un ordine
• effettuare un ordine
• cercare un prodotto
• farmi una domanda
• scaricare una fattura
• sapere dove si trova il tuo ordine
• verificare la disponibilità dei prodotti in tempo reale

Sono qui per aiutarti 😊`,
      wipMessage: "Sorry, I'm currently being improved. Please try again later.",
      ownerId: adminUser.id,
      // ✅ PREMIUM plan
      planType: "PREMIUM",
      creditBalance: 100.0,
      trialEndsAt: null, // No trial - paid plan
      planStartedAt: new Date(),
      // ✅ E-COMMERCE workspace
      sellsProductsAndServices: true,
      hasSalesAgents: true,
      hasHumanSupport: true,
      humanSupportInstructions:
        "Ciao {{nameUser}}, mi sto mettendo in contatto con l'agente {{agentName}}. Ti richiamera' al piu' presto (tel: {{agentPhone}} - email: {{agentEmail}}). Disattivo il chatbot finche' non ricevi risposta.",
      // 🆕 Feature 203: Custom escalation triggers
      frustrationEscalationInstructions: `Chiama IMMEDIATAMENTE l'operatore (contactOperator) quando il cliente:
- Si lamenta che la MERCE È ARRIVATA SCADUTA (prodotto scaduto, data scadenza passata)
- Si lamenta che la MERCE È ARRIVATA ROTTA/DANNEGGIATA (pacco danneggiato, prodotto rotto, bottiglia rotta)
- Vuole MODIFICARE UN ORDINE già effettuato (cambiare prodotti, cambiare quantità, cambiare indirizzo)
- Vuole CANCELLARE UN ORDINE (annullare ordine, disdire ordine)
- Chiede ESPLICITAMENTE di parlare con un OPERATORE UMANO (operatore, assistenza umana, persona reale)

⚠️ IMPORTANTE: 
- Prima controlla SEMPRE nelle FAQ se esiste una risposta predefinita
- Se la FAQ risponde al problema, usa quella risposta SENZA chiamare l'operatore
- Chiama l'operatore SOLO per i casi sopra elencati quando NON c'è risposta FAQ
- Per tutti gli altri casi, rispondi normalmente senza escalation`,
      operatorContactMethod: "EMAIL",
      toneOfVoice: "FRIENDLY",
      botIdentityResponse: "I'm the BellItalia VIP virtual assistant, here to help you discover and purchase authentic Italian gourmet products!",
      chatbotName: "Sofia",
      businessType: "food",
    },
  })

  console.log(`✅ E-commerce workspace created: ${ecommerceWorkspace.name} (${ecommerceWorkspace.id})`)

  // Associate admin user with e-commerce workspace
  await prisma.userWorkspace.create({
    data: {
      userId: adminUser.id,
      workspaceId: ecommerceWorkspace.id,
      role: "SUPER_ADMIN",
    },
  })

  // Create WhatsApp settings for e-commerce workspace
  await prisma.whatsappSettings.create({
    data: {
      workspaceId: ecommerceWorkspace.id,
      phoneNumber: "+34654728751",
      apiKey: process.env.WHATSAPP_API_KEY || "dummy-api-key",
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "https://echatbot.ai/webhook",
      adminEmail: adminEmail,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: process.env.SMTP_USER || "noreply@echatbot.ai",
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: "eChatbot <noreply@echatbot.ai>",
    },
  })

  // Create languages for e-commerce workspace
  for (const lang of [
    { code: "IT", name: "Italiano", isDefault: true },
    { code: "ENG", name: "English", isDefault: false },
    { code: "ESP", name: "Español", isDefault: false },
    { code: "PRT", name: "Português", isDefault: false },
  ]) {
    await prisma.languages.create({
      data: {
        code: lang.code,
        name: lang.name,
        isDefault: lang.isDefault,
        isActive: true,
        workspaceId: ecommerceWorkspace.id,
      },
    })
  }

  // 2.8. Create Informational Workspace for Admin User (BellItalia)
  console.log("🏢 Creating Informational workspace (BellItalia) for admin user...")

  const infoWorkspace = await prisma.workspace.create({
    data: {
      name: "BellItalia",
      slug: "bell-italia",
      whatsappPhoneNumber: "+34654728752",
      notificationEmail: "info@bellitalia.com",
      isActive: true,
      language: "ENG",
      currency: "EUR",
      description: "Italian Gourmet Food - Information Channel",
      url: "https://bellitalia.com",
      channelStatus: true,
      debugMode: true,
      welcomeMessage: "Welcome to BellItalia! Ask me anything about our products and services.",
      wipMessage: "Sorry, I'm currently being improved. Please try again later.",
      ownerId: adminUser.id,
      planType: "PREMIUM",
      creditBalance: 171.0,
      trialEndsAt: null,
      planStartedAt: new Date(),
      sellsProductsAndServices: false,
      hasSalesAgents: false,
      hasHumanSupport: true,
      humanSupportInstructions:
        "Ciao {{nameUser}}, mi sto mettendo in contatto con il nostro operatore. Ti rispondera' al piu' presto. Disattivo il chatbot finche' non ricevi assistenza.",
      // 🆕 Feature 203: Custom escalation triggers (informational version)
      frustrationEscalationInstructions: `Chiama l'operatore (contactOperator) quando il cliente:
- Ha URGENZA di informazioni che non trovi nella knowledge base
- È FRUSTRATO perché non riesce a trovare le informazioni richieste
- Chiede ESPLICITAMENTE di parlare con un OPERATORE UMANO
- Ha una SITUAZIONE COMPLESSA che richiede assistenza personalizzata

⚠️ IMPORTANTE: Prima verifica SEMPRE se la risposta è nelle FAQ o nella knowledge base`,
      operatorContactMethod: "EMAIL",
      toneOfVoice: "PROFESSIONAL",
      botIdentityResponse: "I'm the BellItalia assistant, here to provide information about our Italian gourmet products!",
      chatbotName: "Marco",
      businessType: "food",
    },
  })

  console.log(`✅ Informational workspace created: ${infoWorkspace.name} (${infoWorkspace.id})`)

  // Associate admin user with informational workspace
  await prisma.userWorkspace.create({
    data: {
      userId: adminUser.id,
      workspaceId: infoWorkspace.id,
      role: "SUPER_ADMIN",
    },
  })

  // Create WhatsApp settings for informational workspace
  await prisma.whatsappSettings.create({
    data: {
      workspaceId: infoWorkspace.id,
      phoneNumber: "+34654728752",
      apiKey: process.env.WHATSAPP_API_KEY || "dummy-api-key",
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "https://echatbot.ai/webhook",
      adminEmail: adminEmail,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: process.env.SMTP_USER || "noreply@echatbot.ai",
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: "eChatbot <noreply@echatbot.ai>",
    },
  })

  // Create demo customers for informational workspace (multilingual)
  console.log("👥 Creating informational customers for multi-language tests...")
  const infoDemoCustomers = [
    {
      name: "Luca Informazioni",
      email: "luca.info@bellitalia.com",
      phone: "+39 06 1234 5671",
      language: "IT",
      company: "Trattoria Milano",
      address: "Via Torino 18, Milano",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    },
    {
      name: "Emily Johnson",
      email: "emily.johnson@foodbuyers.uk",
      phone: "+44 20 1234 8899",
      language: "ENG",
      company: "London Catering Co.",
      address: "221B Baker Street, London",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    },
    {
      name: "Carlos López",
      email: "carlos.logistica@sevilla.es",
      phone: "+34 622 89 45 11",
      language: "ESP",
      company: "Tapas Sur",
      address: "Calle Feria 45, Sevilla",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9),
    },
    {
      name: "Ana Silva",
      email: "ana.silva@porto-rest.pt",
      phone: "+351 965 778 201",
      language: "PRT",
      company: "Porto Delights",
      address: "Rua das Flores 12, Porto",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    },
  ]

  const createdInfoCustomers: {
    record: any
    template: (typeof infoDemoCustomers)[number]
  }[] = []

  for (const customer of infoDemoCustomers) {
    const created = await prisma.customers.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        language: customer.language,
        company: customer.company,
        address: customer.address,
        workspaceId: infoWorkspace.id,
        isActive: true,
        activeChatbot: true,
        currency: "EUR",
        discount: 0,
        push_notifications_consent: true,
        push_notifications_consent_at: new Date(),
        createdAt: customer.createdAt,
        updatedAt: customer.createdAt,
      },
    })
    createdInfoCustomers.push({ record: created, template: customer })
  }

  console.log(
    `✅ Created ${createdInfoCustomers.length} informational customers with multilingual profiles`
  )

  // Create small chat history per language for informational workspace
  const infoChatSamples = [
    {
      language: "IT",
      inbound: "Ciao, vorrei sapere come spedite i prodotti freschi.",
      assistant:
        "Ciao! Per i prodotti freschi usiamo trasporto refrigerato dedicato con consegne 48h in tutta Italia.",
      history: [
        {
          role: "user",
          content: "Effettuate consegne refrigerate anche il lunedì?",
          minutesAgo: 180,
        },
        {
          role: "assistant",
          content:
            "Sì, i mezzi refrigerati partono ogni lunedì e giovedì da Barcellona verso il Nord Italia.",
          minutesAgo: 179,
        },
      ],
    },
    {
      language: "ENG",
      inbound: "Hello, do you have tracking for informational shipments?",
      assistant:
        "Yes, every parcel includes a tracking link so you can follow the delivery in real time.",
      history: [
        {
          role: "user",
          content: "Can you send brochures directly to my clients in London?",
          minutesAgo: 200,
        },
        {
          role: "assistant",
          content:
            "Of course, we can drop-ship samples or brochures directly to your customer with neutral packaging.",
          minutesAgo: 199,
        },
      ],
    },
    {
      language: "ESP",
      inbound:
        "Hola, necesito información sobre envíos combinados de ambiente y refrigerado.",
      assistant:
        "Podemos preparar pedidos mixtos: agrupamos los productos ambiente y enviamos la parte refrigerada en un segundo pallet.",
      history: [
        {
          role: "user",
          content: "¿Trabajan con entregas en Sevilla dentro de franjas horarias?",
          minutesAgo: 165,
        },
        {
          role: "assistant",
          content:
            "Sí, podemos coordinar franjas de mañana o tarde con nuestros transportistas locales.",
          minutesAgo: 164,
        },
      ],
    },
    {
      language: "PRT",
      inbound: "Olá! Gostaria de saber se enviam com camiões frigoríficos.",
      assistant:
        "Olá! Trabalhamos com camiões frigoríficos certificados e entregamos em Portugal continental duas vezes por semana.",
      history: [
        {
          role: "user",
          content:
            "Conseguem entregar diretamente aos meus restaurantes com prova de entrega?",
          minutesAgo: 140,
        },
        {
          role: "assistant",
          content:
            "Sim, fornecemos POD digital assinada e podemos enviar a cópia por e-mail assim que o motorista conclui a entrega.",
          minutesAgo: 139,
        },
      ],
    },
  ]

  for (const chatData of infoChatSamples) {
    const customer = createdInfoCustomers.find(
      (c) => c.template.language === chatData.language
    )
    if (!customer) {
      console.log(`   ⚠️ No informational customer for language ${chatData.language}`)
      continue
    }

    const session = await prisma.chatSession.create({
      data: {
        customerId: customer.record.id,
        workspaceId: infoWorkspace.id,
        status: "active",
        context: {
          language: chatData.language.toLowerCase(),
          customerName: customer.record.name,
        },
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: session.id,
        direction: "INBOUND",
        content: chatData.inbound,
        type: "TEXT",
        createdAt: new Date(Date.now() - 1000 * 60 * 3),
      },
    })

    await prisma.message.create({
      data: {
        chatSessionId: session.id,
        direction: "OUTBOUND",
        content: chatData.assistant,
        type: "TEXT",
        aiGenerated: true,
        metadata: {
          agentSelected: "CUSTOMER_SUPPORT",
          workspace: "BellItalia Info",
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 2),
      },
    })

    await prisma.conversationMessage.createMany({
      data: chatData.history.map((entry, index) => ({
        conversationId: session.id,
        workspaceId: infoWorkspace.id,
        customerId: customer.record.id,
        role: entry.role as "user" | "assistant",
        content: entry.content,
        createdAt: new Date(
          Date.now() - 1000 * 60 * (entry.minutesAgo ?? 60) + index * 500
        ),
      })),
    })
  }

  // Create agent configs for e-commerce workspace (ALL agents including PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING)
  // ✅ NOTE: systemPrompt is NOT stored in DB - loaded from template files at runtime
  const ecommerceAgents = defaultAgents(ecommerceWorkspace.id)
  for (const config of ecommerceAgents) {
    await prisma.agentConfig.create({
      data: {
        workspaceId: config.workspaceId,
        name: config.name,
        type: config.type,
        description: config.description,
        icon: config.icon,
        systemPrompt: "", // ✅ Empty - loaded from files at runtime
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        order: config.order,
        isActive: config.isActive,
        availableFunctions: config.availableFunctions || null,
      },
    })
  }

  console.log(`✅ E-commerce workspace configured with ${ecommerceAgents.length} agents`)

  // Create languages for informational workspace
  for (const lang of [
    { code: "IT", name: "Italiano", isDefault: true },
    { code: "ENG", name: "English", isDefault: false },
    { code: "ESP", name: "Español", isDefault: false },
    { code: "PRT", name: "Português", isDefault: false },
  ]) {
    await prisma.languages.create({
      data: {
        code: lang.code,
        name: lang.name,
        isDefault: lang.isDefault,
        isActive: true,
        workspaceId: infoWorkspace.id,
      },
    })
  }

  // Create agent configs for informational workspace (EXCLUDES PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING)
  // ✅ NOTE: systemPrompt is NOT stored in DB - loaded from template files at runtime
  const ECOMMERCE_ONLY_TYPES = ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"]
  const infoAgents = defaultAgents(infoWorkspace.id).filter(
    (agent) => !ECOMMERCE_ONLY_TYPES.includes(agent.type)
  )
  for (const config of infoAgents) {
    await prisma.agentConfig.create({
      data: {
        workspaceId: config.workspaceId,
        name: config.name,
        type: config.type,
        description: config.description,
        icon: config.icon,
        systemPrompt: "", // ✅ Empty - loaded from files at runtime
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        order: config.order,
        isActive: config.isActive,
        availableFunctions: config.availableFunctions || null,
      },
    })
  }

  // Create FAQs for informational workspace (BellItalia)
  const infoFAQs = [
    { category: "Products", question: "What kinds of products does BellItalia offer?", answer: "We provide a wide variety of Italian and Mediterranean food products — from artisanal items made by exclusive producers to well-known brand names — ideal for restaurants, pizzerias, distributors and large distribution." },
    { category: "Customers", question: "Who can buy from BellItalia (restaurants / shops / individuals)?", answer: "Our catalogue is designed mainly for professional clients — pizzerias, restaurants, distributors and GDO (large retailers)." },
    { category: "Products", question: "How many products do you have in your catalogue?", answer: "We offer more than 600 references in our catalogue of authentic Italian products." },
    { category: "Products", question: "Do you supply fresh products (like fresh cheese or tomatoes)?", answer: "Yes — among our offerings there are fresh Italian cheeses and tomatoes, as part of our authentic Italian ingredients." },
    { category: "Products", question: "Do you offer pasta products?", answer: "Yes — for example, we distribute traditional Italian pasta such as tagliatelle." },
    { category: "Customers", question: "Do you supply to pizzerias and help them with Italian pizza ingredients?", answer: "Absolutely — we offer specialized selections for pizzerias, helping them with high-quality Italian ingredients to craft their pizzas." },
    { category: "Delivery", question: "Do you deliver all over Spain or only locally?", answer: "We provide logistic solutions across the Iberian Peninsula, serving both local businesses and large distribution clients." },
    { category: "Contact", question: "How can I contact you to place an order or ask for information?", answer: "You can contact us via phone at +34 93 15 91 221, via WhatsApp at +34 602 25 17 06, or by email at info@bellitalia.com." },
    { category: "Products", question: "Can I request your catalog in PDF?", answer: "Yes — our catalogue is downloadable as a PDF with all our product references." },
    { category: "Customers", question: "Is your service suitable for big distribution companies / retailers?", answer: "Yes — we have a business area dedicated to 'GDO' (large distribution), offering tailored logistic and supply solutions for large retailers." },
    { category: "Customers", question: "If I own a restaurant, can you support my supply needs?", answer: "Definitely — we work with restaurants to supply high-quality Italian products, with a reliable and professional service." },
    { category: "Products", question: "Are your products only Italian or also Mediterranean more broadly?", answer: "We offer primarily Italian products but also Mediterranean-style foods and beverages, aimed at clients who value quality and tradition." },
    { category: "Company", question: "What makes BellItalia unique compared to other distributors?", answer: "Our strengths are the variety of unique products (from artisanal to branded), fast and reliable delivery, and specialized professional service." },
    { category: "Customers", question: "Can I become a distributor with BellItalia if I have a wholesale business?", answer: "Yes — there is a section for distributors: we offer a reliable product range, logistic support and collaboration adapted to distributors' needs." },
    { category: "Customers", question: "Do you ship to grocery stores or supermarkets?", answer: "Yes — through our 'GDO' line, we supply to large distribution channels, ensuring products suitable for retail shelves." },
    { category: "Delivery", question: "How quickly can you deliver orders?", answer: "We emphasize fast and reliable shipping as one of our main qualities." },
    { category: "Orders", question: "Are there any minimum order quantities / requirements?", answer: "For details like minimum orders or logistic conditions, we recommend contacting us directly — you can reach us by phone, WhatsApp or email." },
    { category: "Products", question: "Do you only supply food, or also beverages and wines?", answer: "We supply food products, beverages, and Mediterranean/Italian wines." },
    { category: "Customers", question: "I'm a small restaurant — can I still place an order?", answer: "Yes — BellItalia works with restaurants of different sizes and tailors service to their specific needs." },
    { category: "Contact", question: "How long does it take to get a response when I contact you?", answer: "Once you send a message via our contact form, we commit to responding within 24 hours." },
    { category: "Transport", question: "Do you offer refrigerated transport for dairy products?", answer: "Yes, we maintain the cold chain between 2–4 °C using certified refrigerated carriers so cheeses and fresh products arrive safely." },
    { category: "Transport", question: "How do you ship frozen goods to ensure -18 °C stability?", answer: "Frozen SKUs travel in -18 °C trucks with temperature probes and seals; if the seal is broken the shipment is replaced." },
    { category: "Transport", question: "Can ambient and refrigerated goods travel in the same delivery?", answer: "We consolidate ambient items on one pallet and refrigerate the rest, dispatching both pallets on the same route so you receive everything together." },
    { category: "Transport", question: "What is the average transit time from Barcelona to Northern Italy?", answer: "Transit to Milan/Turin averages 48–72 hours with two departures per week; Central Spain deliveries remain within 24–48 hours." },
    { category: "Transport", question: "Do you provide ADR-certified carriers for wine or spirits pallets?", answer: "Yes, for alcohol shipments we work with ADR partners able to move wine or spirits under the correct documentation." },
    { category: "Transport", question: "Can you arrange tail-lift trucks for pallet deliveries?", answer: "When clients lack a dock we can send trucks equipped with tail-lift to unload pallets safely at street level." },
    { category: "Transport", question: "Is it possible to request temperature data loggers with each shipment?", answer: "We can include a data logger and share the temperature report along with the POD for full traceability." },
    { category: "Transport", question: "Do you deliver on Saturdays for urgent restocks?", answer: "Saturday morning deliveries are available in the main metropolitan areas with a small surcharge to cover weekend shifts." },
    { category: "Transport", question: "How do you handle customs paperwork for Canary Islands or non-EU destinations?", answer: "Our logistics team prepares phytosanitary certificates and customs declarations for Canary Islands, Andorra or extra-EU routes." },
    { category: "Transport", question: "Can you drop-ship directly to my restaurant customers?", answer: "Yes, we can ship directly to your final customer with neutral packing slips while you receive the invoice and tracking." },
    { category: "Transport", question: "Do you consolidate multiple orders to reduce transport cost?", answer: "Whenever purchase orders share the same route we consolidate them onto the same pallet to optimize freight cost per unit." },
    { category: "Transport", question: "Is tracking available for the transport service?", answer: "Every shipment includes real-time tracking — parcel links for small boxes and GPS checkpoints for palletized loads." },
    { category: "Transport", question: "How far in advance should refrigerated transport be booked during holidays?", answer: "During peak weeks (Christmas/Easter) we recommend booking cold-chain space 4–5 days ahead to guarantee capacity." },
    { category: "Transport", question: "Can you handle deliveries with restricted time windows?", answer: "We frequently deliver to malls, airports and cruise terminals with strict slots — just share the window when placing the order." },
    { category: "Transport", question: "Do you provide digital proof of delivery or signed CMR?", answer: "Yes, the driver uploads the signed POD/CMR immediately and we forward the PDF to your logistics contact." },
    { category: "Transport", question: "Are there surcharges for Balearic Islands or remote areas?", answer: "Balearic Islands and remote mountain towns have a transparent surcharge which we quote before confirming the shipment." },
    { category: "Transport", question: "Can I use my own carrier while you prepare the pallets?", answer: "Of course — we can palletize, label and load your appointed carrier once a pickup slot is agreed." },
    { category: "Transport", question: "Do you insure shipments against temperature excursions?", answer: "All refrigerated and frozen shipments are insured; if a temperature excursion occurs we trigger a replacement immediately." },
    { category: "Transport", question: "What is the maximum weight per pallet you can ship?", answer: "Standard pallets can reach roughly 900 kg; above that threshold we split the goods into multiple pallets for safety." },
    { category: "Transport", question: "Do you offer dual-compartment trucks for mixed frozen and ambient goods?", answer: "Yes, we collaborate with carriers operating dual-compartment vehicles so frozen and ambient products travel together without risk." },
  ]

  for (const faq of infoFAQs) {
    await prisma.fAQ.create({
      data: {
        workspaceId: infoWorkspace.id,
        question: faq.question,
        answer: faq.answer,
        isActive: true,
        category: faq.category,
      },
    })
  }

  // 2.9. Create Enterprise support workspace for eChatbot
  console.log("🏢 Creating Enterprise support workspace (eChatbot HQ)...")

  const supportWorkspace = await prisma.workspace.create({
    data: {
      name: "eChatbot HQ",
      slug: "echatbot-hq",
      whatsappPhoneNumber: "+34654728753",
      notificationEmail: "hello@echatbot.ai",
      isActive: true,
      language: "ENG",
      currency: "EUR",
      description: "eChatbot Enterprise Support - product education channel",
      url: "https://echatbot.ai/support",
      channelStatus: true,
      welcomeMessage:
        "Hi! I'm your eChatbot product assistant. Ask me anything about plans, integrations or onboarding.",
      wipMessage:
        "Our assistants are being updated. If you need immediate help please write to support@echatbot.ai.",
      ownerId: adminUser.id,
      planType: "ENTERPRISE",
      creditBalance: 500,
      trialEndsAt: null,
      planStartedAt: new Date(),
      sellsProductsAndServices: false,
      hasSalesAgents: false,
      hasHumanSupport: true,
      humanSupportInstructions:
        "Ciao {{nameUser}}, ti metto subito in contatto con un consulente eChatbot. Riceverai risposta entro 15 minuti da {{agentName}} (tel: {{agentPhone}} / email: {{agentEmail}}).",
      // 🆕 Feature 203: Custom escalation triggers (enterprise support)
      frustrationEscalationInstructions: `Contatta IMMEDIATAMENTE un consulente umano quando il cliente:
- Ha problemi TECNICI con la piattaforma (bug, errori, malfunzionamenti)
- Vuole UPGRADE o DOWNGRADE del piano
- Ha domande sulla FATTURAZIONE o pagamenti
- Richiede INTEGRAZIONI personalizzate o API custom
- Chiede ESPLICITAMENTE di parlare con un CONSULENTE UMANO

⚠️ Prima verifica SEMPRE nella documentazione/FAQ se esiste già una risposta`,
      operatorContactMethod: "EMAIL",
      toneOfVoice: "PROFESSIONAL",
      botIdentityResponse:
        "I'm the eChatbot product specialist. I can explain pricing, automation features, integrations and connect you with a human consultant anytime.",
    },
  })

  console.log(
    `✅ Enterprise support workspace created: ${supportWorkspace.name} (${supportWorkspace.id})`
  )

  await prisma.userWorkspace.create({
    data: {
      userId: adminUser.id,
      workspaceId: supportWorkspace.id,
      role: "SUPER_ADMIN",
    },
  })

  await prisma.whatsappSettings.create({
    data: {
      workspaceId: supportWorkspace.id,
      phoneNumber: "+34654728753",
      apiKey: process.env.WHATSAPP_API_KEY || "dummy-api-key",
      webhookUrl:
        process.env.WHATSAPP_WEBHOOK_URL || "https://echatbot.ai/webhook",
      adminEmail: adminEmail,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: process.env.SMTP_USER || "noreply@echatbot.ai",
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: "eChatbot <noreply@echatbot.ai>",
    },
  })

  for (const lang of [
    { code: "ENG", name: "English", isDefault: true },
    { code: "IT", name: "Italiano", isDefault: false },
    { code: "ESP", name: "Español", isDefault: false },
  ]) {
    await prisma.languages.create({
      data: {
        code: lang.code,
        name: lang.name,
        isDefault: lang.isDefault,
        isActive: true,
        workspaceId: supportWorkspace.id,
      },
    })
  }

  const supportAgents = defaultAgents(supportWorkspace.id).filter(
    (agent) =>
      !["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"].includes(
        agent.type
      )
  )
  for (const config of supportAgents) {
    await prisma.agentConfig.create({
      data: {
        workspaceId: config.workspaceId,
        name: config.name,
        type: config.type,
        description: config.description,
        icon: config.icon,
        systemPrompt: "",
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        order: config.order,
        isActive: config.isActive,
        availableFunctions: config.availableFunctions || null,
      },
    })
  }

  const supportFAQs = [
    {
      category: "Pricing",
      question: "What plans does eChatbot offer and how is pricing calculated?",
      answer:
        "We offer Starter, Premium and Enterprise plans. Pricing is usage-based: a monthly platform fee plus credits for WhatsApp conversations, automations and AI tasks. Enterprise includes custom SLAs and concierge onboarding.",
    },
    {
      category: "Pricing",
      question: "Can I test eChatbot before committing to a paid plan?",
      answer:
        "Yes, every workspace starts with a fully-featured trial environment so you can validate flows, integrations and analytics. No card is required during the trial.",
    },
    {
      category: "Platform",
      question: "Which channels are supported besides WhatsApp?",
      answer:
        "WhatsApp is the primary channel, but eChatbot also integrates email, Instagram DM, web chat widgets and backoffice messaging via the same unified automation stack.",
    },
    {
      category: "Platform",
      question: "Does eChatbot support multilingual conversations?",
      answer:
        "Absolutely. Each workspace can configure Italian, English, Spanish, Portuguese and more. The AI router translates messages while keeping tone, brand voice and compliance consistent.",
    },
    {
      category: "Integrations",
      question: "How do I connect eChatbot with my ERP or CRM?",
      answer:
        "We provide REST APIs, webhooks, native connectors for HubSpot/Shopify, and middleware guides for custom ERPs. Enterprise clients receive solution architect support during integration.",
    },
    {
      category: "Support",
      question: "Can I talk with a human consultant if the bot can’t solve my issue?",
      answer:
        "Yes. Every plan includes human hand-off. Just request an agent and our team opens an email/WhatsApp thread with a named consultant who replies within SLA.",
    },
    {
      category: "Security",
      question: "Where is customer data hosted and how is it protected?",
      answer:
        "Data is hosted in the EU on AWS, encrypted at rest and in transit. We follow multi-tenant isolation, role-based access control and audit logging aligned with GDPR requirements.",
    },
    {
      category: "Billing",
      question: "Which payment methods do you accept for subscriptions?",
      answer:
        "We accept SEPA transfer, credit cards (Visa/Mastercard) and invoicing with 30-day terms for Enterprise customers.",
    },
    {
      category: "Automation",
      question: "Can eChatbot escalate complex workflows to my internal team?",
      answer:
        "Yes. The workflow engine can trigger Zendesk/Asana tasks, send Slack alerts or forward transcripts via email so your team continues the conversation seamlessly.",
    },
    {
      category: "Analytics",
      question: "What type of analytics can I expect in the dashboard?",
      answer:
        "You can monitor conversation volume, conversion funnels, agent performance, translation usage, CSAT trends and export raw data for BI tools.",
    },
    {
      category: "Compliance",
      question: "Is eChatbot Meta BSP compliant and do you manage WhatsApp templates?",
      answer:
        "Yes, we are aligned with Meta BSP guidelines. We help you register templates, manage quality scores and automate template fallback logic.",
    },
    {
      category: "Deployment",
      question: "How long does onboarding typically take?",
      answer:
        "Starter workspaces launch in a few hours. Enterprise rollouts include a 2-week implementation sprint covering training, automations, testing and go-live checklist.",
    },
    {
      category: "Features",
      question: "Can I use my own AI models or bring OpenAI keys?",
      answer:
        "Certainly. You can plug in your own OpenAI/Anthropic keys, set model policies per agent and even mix internal deterministic flows with LLMs.",
    },
    {
      category: "Team",
      question: "How many operators can collaborate in the console?",
      answer:
        "There’s no hard cap. Role-based permissions let you add unlimited operators, admins and analysts while tracking their actions in the audit log.",
    },
    {
      category: "Roadmap",
      question: "Do you support custom roadmaps or feature requests?",
      answer:
        "Enterprise contracts include roadmap alignment sessions and private betas. We prioritize features that align with your automation KPIs.",
    },
  ]

  for (const faq of supportFAQs) {
    await prisma.fAQ.create({
      data: {
        workspaceId: supportWorkspace.id,
        question: faq.question,
        answer: faq.answer,
        isActive: true,
        category: faq.category,
      },
    })
  }

  const supportProspect = await prisma.customers.create({
    data: {
      name: "Sara Product Demo",
      email: "sara.demo@echatbot.ai",
      phone: "+39 380 1112223",
      language: "ENG",
      company: "Innovative Retail Group",
      workspaceId: supportWorkspace.id,
      isActive: true,
      activeChatbot: true,
      currency: "EUR",
      discount: 0,
      push_notifications_consent: true,
      push_notifications_consent_at: new Date(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
  })

  const supportSession = await prisma.chatSession.create({
    data: {
      customerId: supportProspect.id,
      workspaceId: supportWorkspace.id,
      status: "active",
      context: {
        language: "eng",
        customerName: supportProspect.name,
      },
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: supportSession.id,
      direction: "INBOUND",
      content: "Hi, how much does the Enterprise plan cost with 5 workspaces?",
      type: "TEXT",
      createdAt: new Date(Date.now() - 1000 * 60 * 4),
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: supportSession.id,
      direction: "OUTBOUND",
      content:
        "Hi Sara! Enterprise starts from €899/month and scales with active workspaces. I can share a tailored quote or connect you with a consultant.",
      type: "TEXT",
      aiGenerated: true,
      metadata: {
        agentSelected: "CUSTOMER_SUPPORT",
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 3),
    },
  })

  await prisma.conversationMessage.createMany({
    data: [
      {
        conversationId: supportSession.id,
        workspaceId: supportWorkspace.id,
        customerId: supportProspect.id,
        role: "user",
        content:
          "Great! I'd like a live walkthrough and to involve my operations team.",
        createdAt: new Date(Date.now() - 1000 * 60 * 2),
      },
      {
        conversationId: supportSession.id,
        workspaceId: supportWorkspace.id,
        customerId: supportProspect.id,
        role: "assistant",
        content:
          "Perfect, I'm escalating this to our human operator. You'll receive a calendar invitation and WhatsApp follow-up within 15 minutes.",
        createdAt: new Date(Date.now() - 1000 * 60 * 2 + 500),
        debugInfo: JSON.stringify({
          action: "HANDOFF",
          operatorNotified: true,
        }),
      },
    ],
  })

  console.log(`✅ Informational workspace configured with ${infoAgents.length} agents and ${infoFAQs.length} FAQs`)
  console.log(`✅ Support workspace configured with ${supportAgents.length} agents and ${supportFAQs.length} FAQs`)
  console.log(`\n📦 Admin user channels setup complete:`)
  console.log(`   - Email: ${adminEmail}`)
  console.log(`   - Plan: ENTERPRISE`)
  console.log(
    `   - Channels: 3 (E-commerce: BellItalia VIP, Informational: BellItalia, Support: eChatbot HQ)\n`
  )

  // Use BellItalia VIP as the main workspace for demo data
  const workspace = ecommerceWorkspace

  // 5. Create Languages (additional languages for main workspace)
  console.log("🌐 Creating additional languages...")

  // Add Spanish and Portuguese (IT and ENG already created)
  for (const lang of [
    { code: "ESP", name: "Español", isDefault: false },
    { code: "PRT", name: "Português", isDefault: false },
  ]) {
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

  console.log(`✅ Created 2 additional languages (ESP, PRT)`)

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

  // 6b. Create Platform Configuration (NEW Single Source of Truth)
  console.log("🚀 Creating platform configuration (NEW)...")

  for (const config of platformConfigData) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: {
        type: config.type,
        value: config.value,
        originalValue: config.originalValue,
        description: config.description,
        isActive: config.isActive,
      },
      create: {
        type: config.type,
        key: config.key,
        value: config.value,
        originalValue: config.originalValue,
        description: config.description,
        isActive: config.isActive,
      },
    })
  }

  console.log(
    `✅ Created/Updated ${platformConfigData.length} platform configurations`
  )
  console.log(
    `   - Prices: ${platformConfigData.filter((p) => p.type === "PRICE").length}`
  )
  console.log(
    `   - Flags: ${platformConfigData.filter((p) => p.type === "FLAG").length}`
  )
  console.log(
    `   - Limits: ${platformConfigData.filter((p) => p.type === "LIMIT").length}`
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

  // 6.6 Create Transport Types (Feature 179 + Transport Optimization)
  console.log("🚚 Creating transport types with prices...")

  // Transport types with prices (EUR, IVA inclusa)
  // Prices based on optimize-cart.md spec: Ambiente=8€, Refrigerato=12€, Frozen=15€
  const transportTypesData = [
    { name: "Temperatura Ambiente", price: 8.00 },  // Ambient Temperature
    { name: "Refrigerato", price: 12.00 },           // Refrigerated
    { name: "Congelato", price: 15.00 },             // Frozen
  ]

  const transportTypeMap = new Map<string, string>()

  for (const typeData of transportTypesData) {
    const transportType = await prisma.transportType.create({
      data: {
        name: typeData.name,
        workspaceId: workspace.id,
        price: typeData.price,
        isActive: true,
      },
    })
    transportTypeMap.set(typeData.name, transportType.id)
  }

  console.log(`✅ Created ${transportTypesData.length} transport types with prices`)

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
        sku: prod.ProductCode || `PROD-${Date.now()}`,
        description: prod.description,
        formato: prod.formato,
        price: prod.price,
        stock: prod.stock,
        status: prod.status as any,
        slug: prod.slug,
        categoryId: categoryId,
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

    // ✅ Feature: Create ProductCategory pivot record (many-to-many)
    if (categoryId) {
      await prisma.productCategory.create({
        data: {
          productId: product.id,
          categoryId: categoryId,
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

  // NOTE: Agent configurations already created above for BellItalia VIP (ecommerceWorkspace)

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
        name: "Mario Rossi",
        street: "Via Roma 123",
        city: "Milano",
        postalCode: "20100",
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
        name: "João Silva",
        street: "Rua Augusta 456",
        city: "Lisboa",
        postalCode: "1100-053",
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
        name: "Maria Garcia",
        street: "Calle Mayor 789",
        city: "Madrid",
        postalCode: "28013",
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
        name: "John Smith",
        street: "Baker Street 221B",
        city: "London",
        postalCode: "NW1 6XE",
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
        // 📱 Push notifications consent - first 2 customers have consent
        push_notifications_consent: i < 2, // Mario and João have consent
        push_notifications_consent_at: i < 2 ? new Date() : null,
        // 📋 GDPR consent - first 2 customers have accepted
        last_privacy_version_accepted: i < 2 ? "v1.0" : null,
        createdAt: customer.createdAt,
        updatedAt: customer.createdAt,
      },
    })
  }

  console.log(
    `✅ Created ${testCustomers.length} test customers (distributed Apr-Jul 2025)`
  )
  console.log(
    `   📱 First 2 (Mario, João): active, push consent, GDPR accepted → eligible for campaigns`
  )
  console.log(
    `   🚫 Last 2 (Maria, John): blacklisted, no consent → NOT eligible for campaigns`
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
        content: "Ciao! Benvenuto in BellItalia. Come posso aiutarti oggi?",
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
          // 24 hours ago - outside the 10-minute conversation history window
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
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
          // 24 hours ago - outside the 10-minute conversation history window
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000),
        },
        {
          conversationId: chatSession1.id,
          workspaceId: workspace.id,
          customerId: italianCustomer.id,
          role: "user",
          content: "Sì, vorrei 1kg di Parmigiano Reggiano",
          // 24 hours ago - outside the 10-minute conversation history window
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 2000),
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
          // 24 hours ago - outside the 10-minute conversation history window
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 3000),
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
        content: "Hello! Welcome to BellItalia. How can I help you today?",
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
    // Now calculates total from actual product prices
    async function createOrder(
      orderCode: string,
      customerId: string,
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
      // First, calculate actual total from products
      let calculatedTotal = 0
      const itemsData: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = []
      
      for (let i = 0; i < productIds.length; i++) {
        const product = await prisma.products.findUnique({
          where: { id: productIds[i] },
        })
        if (product) {
          const unitPrice = Number(product.price)
          const itemTotal = unitPrice * quantities[i]
          calculatedTotal += itemTotal
          itemsData.push({
            productId: product.id,
            quantity: quantities[i],
            unitPrice,
            totalPrice: itemTotal,
          })
        }
      }

      // Create order with correct calculated total
      const order = await prisma.orders.create({
        data: {
          orderCode,
          customerId,
          workspaceId: workspace.id,
          status,
          totalAmount: calculatedTotal,
          createdAt: date,
        },
      })

      // Create order items
      for (const item of itemsData) {
        await prisma.orderItems.create({
          data: {
            orderId: order.id,
            ...item,
          },
        })
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

        // Total is now calculated inside createOrder from actual product prices
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
      initialCredit: 19.00,
      features: JSON.stringify([
        "14 giorni di prova gratuita",
        "€19 di credito iniziale",
        "1 canale WhatsApp",
        "50 prodotti",
        "50 clienti",
      ]),
    },
    {
      planType: "BASIC" as const,
      displayName: "Basic",
      monthlyFee: 19.00,
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
      monthlyFee: 39.00,
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
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
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

  // Create billing transaction history for PREMIUM plan
  console.log("💳 Creating billing transaction history...")

  const now = new Date()
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // ============================================================================
  // BILLING TRANSACTIONS - Realistic history starting from €19 Free Trial
  // Story: User starts Free Trial (€19), then upgrades, recharges, uses messages
  // NOTE: Monthly subscription fees are billed separately (not from credit balance)
  // ============================================================================

  // September 2025: User signs up with Free Trial (€19)
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 19.00,
      balanceAfter: 19.00,
      description: "Initial credit - Free Trial",
      createdAt: new Date(2025, 8, 5, 10, 0, 0), // Sep 5, 2025
    },
  })

  // September 15: First recharge +€30 (triggers automatic upgrade from FREE_TRIAL to BASIC)
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 30.00,
      balanceAfter: 49.00,
      description: "Credit recharge +€30",
      createdAt: new Date(2025, 8, 15, 14, 30, 0), // Sep 15, 2025
    },
  })

  // September 15: Automatic upgrade from FREE_TRIAL to BASIC (same time as recharge)
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "UPGRADE_FEE",
      amount: 0,
      balanceAfter: 49.00,
      description: "Upgrade from Free Trial to Basic plan (€19.00/month)",
      createdAt: new Date(2025, 8, 15, 14, 30, 0), // Sep 15, 2025 (same time)
    },
  })

  // October 1: Payment for September invoice (Plan €19 Basic + Recharges €30 = €49 charged)
  // After this, balance is 49, invoice is separate charge
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "INVOICE_PAID",
      amount: 0,
      balanceAfter: 49.00,
      description: "Invoice Sep 2025 paid - Basic plan €19.00 + Recharges €30.00",
      createdAt: new Date(2025, 9, 1, 6, 0, 0), // Oct 1, 2025 at 06:00
    },
  })

  // October 1: Upgrade to Premium plan (after invoice payment)
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "UPGRADE_FEE",
      amount: 0,
      balanceAfter: 49.00,
      description: "Upgrade from Basic to Premium plan (€39.00/month)",
      createdAt: new Date(2025, 9, 1, 7, 0, 0), // Oct 1, 2025 at 07:00
    },
  })

  // October 20: Message usage -€5
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "MESSAGE",
      amount: -5.00,
      balanceAfter: 44.00,
      description: "50 WhatsApp messages (BellItalia VIP)",
      createdAt: new Date(2025, 9, 20, 16, 45, 0), // Oct 20, 2025
    },
  })

  // November 1: Payment for October invoice (Plan €39 Premium + Recharges €0 = €39 charged)
  // Balance stays 44 (invoice is separate)
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "INVOICE_PAID",
      amount: 0,
      balanceAfter: 44.00,
      description: "Invoice Oct 2025 paid - Premium plan €39.00 + Recharges €0.00",
      createdAt: new Date(2025, 10, 1, 6, 0, 0), // Nov 1, 2025 at 06:00
    },
  })

  // November 1: Credit recharge +€49
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 49.00,
      balanceAfter: 93.00,
      description: "Credit recharge +€49",
      createdAt: new Date(2025, 10, 1, 8, 0, 0), // Nov 1, 2025 at 08:00
    },
  })

  // November 15: Message usage -€3.50
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "MESSAGE",
      amount: -3.50,
      balanceAfter: 89.50,
      description: "35 WhatsApp messages (BellItalia)",
      createdAt: new Date(2025, 10, 15, 11, 30, 0), // Nov 15, 2025
    },
  })

  // December 1: Payment for November invoice (Plan €39 Premium + Recharges €49 = €88 charged)
  // Balance stays 89.50 (invoice is separate)
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "INVOICE_PAID",
      amount: 0,
      balanceAfter: 89.50,
      description: "Invoice Nov 2025 paid - Premium plan €39.00 + Recharges €49.00",
      createdAt: new Date(2025, 11, 1, 6, 0, 0), // Dec 1, 2025 at 06:00
    },
  })

  // December 1: Credit recharge +€100
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 100.00,
      balanceAfter: 189.50,
      description: "Credit recharge +€100",
      createdAt: new Date(2025, 11, 1, 8, 0, 0), // Dec 1, 2025 at 08:00
    },
  })

  // December 8: Message usage -€2.50
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "MESSAGE",
      amount: -2.50,
      balanceAfter: 187.00,
      description: "25 WhatsApp messages (BellItalia VIP)",
      createdAt: new Date(2025, 11, 8, 14, 20, 0), // Dec 8, 2025
    },
  })

  // December 10: Today's message -€0.10
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "MESSAGE",
      amount: -0.10,
      balanceAfter: 186.90,
      description: "1 WhatsApp message (BellItalia)",
      createdAt: new Date(), // Today
    },
  })

  console.log("✅ Created 13 billing transactions (realistic history)")

  // ============================================================================
  // MONTHLY INVOICES - Past paid invoices
  // ============================================================================
  console.log("🧾 Creating monthly invoices...")

  // October 2025 Invoice (PAID)
  await prisma.monthlyInvoice.create({
    data: {
      user: { connect: { id: adminUser.id } },
      periodStart: new Date(2025, 9, 1, 0, 0, 0),
      periodEnd: new Date(2025, 9, 31, 23, 59, 59),
      periodMonth: 10,
      periodYear: 2025,
      subscriptionAmount: 49.00,
      creditUsage: 5.00,
      creditDebt: 0,
      totalAmount: 54.00,
      status: "PAID",
      paidAt: new Date(2025, 10, 1, 10, 0, 0),
      planType: "PREMIUM",
      itemsBreakdown: {
        messages: 50,
        orders: 5,
        pushNotifications: 2,
      },
    },
  })

  // November 2025 Invoice (PAID)
  await prisma.monthlyInvoice.create({
    data: {
      user: { connect: { id: adminUser.id } },
      periodStart: new Date(2025, 10, 1, 0, 0, 0),
      periodEnd: new Date(2025, 10, 30, 23, 59, 59),
      periodMonth: 11,
      periodYear: 2025,
      subscriptionAmount: 49.00,
      creditUsage: 3.50,
      creditDebt: 0,
      totalAmount: 52.50,
      status: "PAID",
      paidAt: new Date(2025, 11, 1, 10, 0, 0),
      planType: "PREMIUM",
      itemsBreakdown: {
        messages: 35,
        orders: 8,
        pushNotifications: 3,
      },
    },
  })

  // December 2025 Invoice (DRAFT - current month)
  await prisma.monthlyInvoice.create({
    data: {
      user: { connect: { id: adminUser.id } },
      periodStart: new Date(2025, 11, 1, 0, 0, 0),
      periodEnd: new Date(2025, 11, 31, 23, 59, 59),
      periodMonth: 12,
      periodYear: 2025,
      subscriptionAmount: 49.00,
      creditUsage: 2.60,
      creditDebt: 0,
      totalAmount: 51.60,
      status: "DRAFT",
      planType: "PREMIUM",
      itemsBreakdown: {
        messages: 26,
        orders: 2,
        pushNotifications: 0,
      },
    },
  })

  console.log("✅ Created 3 monthly invoices (Oct, Nov, Dec 2025)")

  // Seed Scheduler Job Status (all jobs active by default)
  console.log("⏰ Creating scheduler job status...")

  const schedulerJobs = [
    {
      jobName: "whatsapp-challenge-queue",
      isActive: true,
      lastStatus: "NEVER_RUN",
    },
    {
      jobName: "short-urls-cleanup",
      isActive: true,
      lastStatus: "NEVER_RUN",
    },
    {
      jobName: "unused-images-cleanup",
      isActive: true,
      lastStatus: "NEVER_RUN",
    },
    {
      jobName: "messages-archive",
      isActive: true,
      lastStatus: "NEVER_RUN",
    },
    {
      jobName: "whatsapp-queue-cleanup",
      isActive: true,
      lastStatus: "NEVER_RUN",
    },
    {
      jobName: "soft-delete-cleanup",
      isActive: true,
      lastStatus: "NEVER_RUN",
    },
    {
      jobName: "monthly-billing",
      isActive: true,
      lastStatus: "NEVER_RUN",
    },
  ]

  for (const job of schedulerJobs) {
    await prisma.schedulerJobStatus.upsert({
      where: { jobName: job.jobName },
      update: {}, // Don't update if exists (preserve isActive state)
      create: job,
    })
  }

  console.log(`✅ Created ${schedulerJobs.length} scheduler jobs`)

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
