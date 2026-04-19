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
import { products } from "./data/products"
import { TRANSLATION_PROMPT } from "./data/agent-templates/translation"
import { services } from "./data/services"
import { workspaceSettings } from "./data/workspaceSettings"

// 🔧 HEROKU FIX: Always use adapter (direct connection causes initialization error in production build)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('heroku') || process.env.DATABASE_URL?.includes('amazonaws')
    ? { rejectUnauthorized: false }
    : false
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

let invoiceSequence = 1

const buildInvoiceNumber = (issuedAt: Date) => {
  const datePart = issuedAt.toISOString().slice(0, 10).replace(/-/g, '')
  const sequence = String(invoiceSequence).padStart(4, '0')
  invoiceSequence += 1
  return `${datePart}-${sequence}`
}

const ensureInvoiceNumber = async (invoice: {
  id: string
  status: string
  paidAt: Date | null
  createdAt: Date
  invoiceNumber?: string | null
}) => {
  if (invoice.invoiceNumber || invoice.status !== 'PAID') {
    return
  }

  const issuedAt = invoice.paidAt ?? invoice.createdAt

  await prisma.monthlyInvoice.update({
    where: { id: invoice.id },
    data: {
      invoiceNumber: buildInvoiceNumber(issuedAt),
    },
  })
}

async function main() {
  console.log("🌱 Starting database seed...")

  // 🔓 SECURITY: Allow seed in production only with explicit permission
  const allowDestructive = process.env.ALLOW_DESTRUCTIVE_OPERATIONS === 'true'
  const isProduction = process.env.NODE_ENV === 'production'
  const dangerousSeedProd = process.env.I_KNOW_THIS_IS_DANGEROUS_SEED_PROD === 'true'

  if (isProduction) {
    if (!allowDestructive) {
      console.error('❌ Cannot run seed in production! (ALLOW_DESTRUCTIVE_OPERATIONS is not true)')
      process.exit(1)
    }

    if (!dangerousSeedProd) {
      console.error('❌ CRITICAL PROTECTION: Attempted to run seed in production without explicit confirmation!')
      console.error('To run seed in production, you MUST set I_KNOW_THIS_IS_DANGEROUS_SEED_PROD=true')
      process.exit(1)
    }

    console.warn('⚠️ WARNING: RUNNING DESTRUCTIVE SEED IN PRODUCTION AS REQUESTED...')
  }

  if (isProduction && allowDestructive) {
    console.log('⚠️  SEED RUNNING IN PRODUCTION WITH DESTRUCTIVE OPERATIONS')
  }

  // 1. Clear existing data (in correct order to avoid FK constraints)
  // NOTE: In production with Heroku, user has no DELETE privileges after migrate reset.
  // The reset itself clears the database, so we skip deleteMany() calls in production.
  if (!isProduction) {
    console.log("🧹 Cleaning existing data...")

    // Delete all child tables with FK dependencies first
    await prisma.orderItems.deleteMany()
    await prisma.cartItems.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
    await prisma.supportAttachment.deleteMany()
    await prisma.supportMessage.deleteMany()
    await prisma.supportTicket.deleteMany()
    await prisma.passwordReset.deleteMany()
    await prisma.registrationToken.deleteMany()
    await prisma.secureToken.deleteMany()
    // await prisma.customerFeedback.deleteMany() // ❌ REMOVED
    await prisma.pushCampaignRecipient.deleteMany() // ✅ Fixed
    await prisma.pushCampaign.deleteMany() // ✅ Fixed
    await prisma.billing.deleteMany()
    await prisma.billingTransaction.deleteMany()
    await prisma.monthlyInvoice.deleteMany()
    await prisma.usage.deleteMany()
    await prisma.adminSession.deleteMany()
    await prisma.shortUrls.deleteMany()
    await prisma.carts.deleteMany()
    await prisma.orders.deleteMany()
    await prisma.customers.deleteMany()
    await prisma.documents.deleteMany()
    await prisma.fAQ.deleteMany()
    // await prisma.legalDocument.deleteMany() // ❌ REMOVED
    await prisma.offers.deleteMany()
    await prisma.services.deleteMany()
    await prisma.productType.deleteMany()
    await prisma.productCertification.deleteMany()
    await prisma.products.deleteMany()
    // await prisma.productSearch.deleteMany() // ❌ REMOVED: table dropped
    await prisma.categories.deleteMany()
    await prisma.sales.deleteMany()
    await prisma.languages.deleteMany()
    await prisma.agentConfig.deleteMany()
    await prisma.gdprContent.deleteMany()
    await prisma.whatsappSettings.deleteMany()
    await prisma.paymentDetails.deleteMany()
    await prisma.searchConversations.deleteMany()
    await prisma.certification.deleteMany()
    await prisma.type.deleteMany()

    // Delete user-related tables
    await prisma.workspaceInvitation.deleteMany()
    await prisma.userWorkspace.deleteMany()
    await prisma.twoFactorResetToken.deleteMany()
    await prisma.user.deleteMany()

    // Plan configurations might not exist in this client yet or be part of User/Workspace
    try { await (prisma as any).planConfiguration.deleteMany() } catch (e) { }

    // Finally delete workspace
    await prisma.workspace.deleteMany()

    // Finally delete workspace
    await prisma.workspace.deleteMany()

    console.log("✅ Database cleaned")
  } else {
    console.log("⏭️  Skipped data cleanup in production (database already reset via migrate reset --force)")
  }

  // 2. Create Admin User (Developer + Platform Admin)
  console.log("👤 Creating/updating admin user (Developer + Platform Admin)...")

  const adminEmail = process.env.ADMIN_EMAIL || "gelsogrove@gmail.com"
  const adminPassword = process.env.ADMIN_PASSWORD || "Venezia44"

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  // ✅ Use upsert to avoid conflicts if user already exists
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      // Update existing user (preserve workspaces, just refresh data)
      firstName: "Andrea",
      lastName: "Gelsomino",
      status: "ACTIVE",
      role: "ADMIN",
      planType: "ENTERPRISE",
      isPlatformAdmin: true,
      isDeveloperUser: true,
      twoFactorEnabled: false,
      // Keep existing creditBalance if user exists
    },
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      firstName: "Andrea",
      lastName: "Gelsomino",
      status: "ACTIVE",
      role: "ADMIN",
      planType: "ENTERPRISE", // ✅ Enterprise plan (full feature set)
      creditBalance: 185.00, // ✅ Reflects final balance from billing history
      isPlatformAdmin: true, // ✅ Platform Admin - can access backoffice
      isDeveloperUser: true, // ✅ Developer User - skip 2FA for testing
      twoFactorEnabled: false, // ❌ 2FA disabled by default - enable via Settings UI
      twoFactorEnabledAt: null,
      recoveryCodes: [], // Recovery codes generated when 2FA is enabled
      paypalStatus: "CONNECTED",
      isPaymentConnected: true,
      paypalClientId: "paypal-client-demo-1234",
      paypalMerchantId: "paypal-merchant-5678",
      paypalEmail: adminEmail, // Use admin email from env var
      paypalEnvironment: "sandbox",
      paypalConnectedAt: new Date(2025, 10, 1, 9, 30, 0),
      // 🧾 Billing Information (Andrea's requirement - sample data)
      companyName: "eChatbot Italia S.r.l.",
      vatNumber: "IT12345678901",
      website: "https://www.echatbot.it",
      billingPhone: "+39 06 1234567",
      billingAddress: "Via Roma 123, 00100 Roma, Italia",
    },
  })

  console.log(`✅ Admin user created/updated: ${adminEmail}`)
  console.log(`📧 Email: ${adminEmail}`)
  console.log(`🔑 Password: ${adminPassword}`)
  console.log(`🔐 isPlatformAdmin: true (Backoffice access)`)
  console.log(`🔧 isDeveloperUser: true (Skip 2FA for testing)\n`)

  // 2.7. Create E-commerce Workspace for Admin User (BellItalia VIP)
  console.log("🏢 Creating/updating E-commerce workspace (BellItalia VIP) for admin user...")

  // ✅ Check if workspace already exists
  let ecommerceWorkspace = await prisma.workspace.findUnique({
    where: { id: "bellitalia-vip-ecommerce" }
  })

  if (!ecommerceWorkspace) {
    console.log("   Creating new workspace...")
    ecommerceWorkspace = await prisma.workspace.create({
      data: {
        id: "bellitalia-vip-ecommerce", // Fixed ID for consistent testing
        name: "BellItalia VIP",
        slug: "bell-italia-vip",
        whatsappPhoneNumber: "+34654728751",
        whatsappProvider: "meta",
        metaPhoneNumberId: null,
        metaAccessToken: null,
        webhookVerifyToken: null,
        ultraMsgInstanceId: null,
        ultraMsgToken: null,
        notificationEmail: "info@bellitalia.com",
        language: "ENG",
        currency: "EUR",
        description: "Italian Gourmet Food E-commerce - VIP Channel",
        url: "https://bellitalia.com/vip",
        channelStatus: true,
        deletedAt: null,
        debugMode: false,
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
        owner: { connect: { id: adminUser.id } },
        // ✅ E-COMMERCE workspace
        channelMode: "ECOMMERCE",
        hasSalesAgents: true,
        hasHumanSupport: true,
        hasProductCatalog: true,
        hasCart: true,
        hasOrderTracking: true,
        needRegistration: true,
        humanSupportInstructions:
          "Hello {{nameUser}}, I'm connecting you with our agent {{agentName}}. They will contact you as soon as possible (phone: {{agentPhone}} / email: {{agentEmail}}). We're disabling the chatbot until you receive a response. Thank you for your patience! 🤝",
        operatorContactMethod: "EMAIL",
        toneOfVoice: "FRIENDLY",
        botIdentityResponse: "I'm the BellItalia VIP virtual assistant, here to help you discover and purchase authentic Italian gourmet products! 🇮🇹",
        chatbotName: "Sofia",
        businessType: "food",
        registrationPage: "https://bellitalia.com/registrati", // Custom registration page URL for [LINK_REGISTRATION]
        requireManualApproval: false, // If true, new customers go to PENDING_APPROVAL after registration
        customAiRules: `# Communication Style

- Keep sentences SHORT - avoid long text blocks
- Greet the user often using their name: {{customerName}}
- Use emoticons to make tone friendly 😊
- When appropriate, end with a question to keep conversation flowing
- For lists, ALWAYS use bullet points
- If there's a link, add a line break after it
- For important concepts, use **bold**
- For SUPER important concepts, use **BOLD AND UPPERCASE**

# Example Communication
"Hi {{customerName}}! 👋

Here's your order:
https://echatbot.ai/order/123

**Total: €45.50**

**PAYMENT DUE: 3 DAYS**

Need anything else?"`,
      },
    })
  } else {
    console.log(`   ✅ Workspace already exists: ${ecommerceWorkspace.name}`)
  }

  console.log(`✅ E-commerce workspace ready: ${ecommerceWorkspace.name} (${ecommerceWorkspace.id})`)

  // Associate admin user with e-commerce workspace (if not already)
  const existingLink = await prisma.userWorkspace.findFirst({
    where: {
      userId: adminUser.id,
      workspaceId: ecommerceWorkspace.id,
    }
  })

  if (!existingLink) {
    await prisma.userWorkspace.create({
      data: {
        userId: adminUser.id,
        workspaceId: ecommerceWorkspace.id,
        role: "SUPER_ADMIN",
      },
    })
    console.log(`   ✅ Admin user linked to workspace`)
  } else {
    console.log(`   ✅ Admin user already linked to workspace`)
  }

  // 2.8. Create Informational Workspace (BellItalia Info)
  console.log("🏢 Creating/updating Informational workspace (BellItalia) for admin user...")

  let infoWorkspace = await prisma.workspace.findUnique({
    where: { id: "bellitalia-info" }
  })

  if (!infoWorkspace) {
    console.log("   Creating new workspace...")
    infoWorkspace = await prisma.workspace.create({
      data: {
        id: "bellitalia-info-workspace", // Fixed ID for consistent testing
        name: "BellItalia",
        slug: "bell-italia",
        whatsappPhoneNumber: "+34654728752",
        whatsappProvider: "meta",
        metaPhoneNumberId: null,
        metaAccessToken: null,
        webhookVerifyToken: null,
        ultraMsgInstanceId: null,
        ultraMsgToken: null,
        notificationEmail: "info@bellitalia.com",
        language: "ENG",
        currency: "EUR",
        description: "Italian Gourmet Food - Information Channel",
        url: "https://bellitalia.com",
        channelStatus: true,
        deletedAt: null,
        debugMode: false,
        welcomeMessage: "Welcome to BellItalia! Ask me anything about our products and services.",
        wipMessage: "Sorry, I'm currently being improved. Please try again later.",
        owner: { connect: { id: adminUser.id } },
        channelMode: "INFORMATIONAL",
        hasSalesAgents: false,
        hasHumanSupport: true,
        hasProductCatalog: false,
        hasCart: false,
        hasOrderTracking: false,
        needRegistration: true,
        humanSupportInstructions:
          "Ciao {{nameUser}}, mi sto mettendo in contatto con il nostro operatore. Ti rispondera' al piu' presto. Disattivo il chatbot finche' non ricevi assistenza.",
        operatorContactMethod: "EMAIL",
        toneOfVoice: "PROFESSIONAL",
        botIdentityResponse: "I'm the BellItalia assistant, here to provide information about our Italian gourmet products and services! 📚",
        chatbotName: "Marco",
        businessType: "food",
        registrationPage: null, // Uses default /registration page
        requireManualApproval: false, // If true, new customers go to PENDING_APPROVAL after registration
        customAiRules: `# Communication Style

- Keep sentences SHORT - avoid long text blocks
- Greet the user often using their name: {{customerName}}
- Use emoticons to make tone friendly 😊
- When appropriate, end with a question to keep conversation flowing
- For lists, ALWAYS use bullet points
- If there's a link, add a line break after it
- For important concepts, use **bold**
- For SUPER important concepts, use **BOLD AND UPPERCASE**

# Example Communication
"Hi {{customerName}}! 👋

Here's the information you requested:
https://echatbot.ai/info/products

**Key Features:**
• Feature 1
• Feature 2

**IMPORTANT: Limited time offer**

Would you like details about something specific?"`,
      },
    })
  } else {
    console.log(`   ✅ Workspace already exists: ${infoWorkspace.name}`)
  }

  console.log(`✅ Informational workspace ready: ${infoWorkspace.name} (${infoWorkspace.id})`)

  // Associate admin user with informational workspace (if not already)
  const existingInfoLink = await prisma.userWorkspace.findFirst({
    where: {
      userId: adminUser.id,
      workspaceId: infoWorkspace.id,
    }
  })

  if (!existingInfoLink) {
    await prisma.userWorkspace.create({
      data: {
        userId: adminUser.id,
        workspaceId: infoWorkspace.id,
        role: "SUPER_ADMIN",
      },
    })
    console.log(`   ✅ Admin user linked to workspace`)
  } else {
    console.log(`   ✅ Admin user already linked to workspace`)
  }

  // Create WhatsApp settings for informational workspace
  await prisma.whatsappSettings.create({
    data: {
      workspaceId: infoWorkspace.id,
      phoneNumber: "+34654728752",
      apiKey: process.env.WHATSAPP_API_KEY || "dummy-api-key",
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "https://echatbot.ai/webhook",
      webhookId: `webhook-${infoWorkspace.id}`,
      webhookToken: `token-info-${Date.now()}`,
      adminEmail: adminEmail,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: process.env.SMTP_USER || adminEmail,
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: `eChatbot <${adminEmail}>`,
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
          agentSelected: "INFO_AGENT",
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
  // ⚠️  EXCEPTION: TRANSLATION agent prompt IS stored in DB for customization
  const ecommerceAgents = defaultAgents(ecommerceWorkspace.id)
  for (const config of ecommerceAgents) {
    await prisma.agentConfig.create({
      data: {
        workspaceId: config.workspaceId,
        name: config.name,
        type: config.type,
        description: config.description,
        icon: config.icon,
        systemPrompt: config.type === "TRANSLATION" ? TRANSLATION_PROMPT : "", // ✅ TRANSLATION uses DB prompt, others load from files
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
  // ⚠️  EXCEPTION: TRANSLATION agent prompt IS stored in DB for customization
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
        systemPrompt: config.type === "TRANSLATION" ? TRANSLATION_PROMPT : "", // ✅ TRANSLATION uses DB prompt, others load from files
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
  // 🔧 IMPORTANT: FAQs are in multiple languages to ensure LLM gets content regardless of translation pipeline
  const infoFAQs = [
    // Italian FAQs (primary language for BellItalia workspace)
    { category: "Products", question: "Quali tipologie di prodotti offre BellItalia?", answer: "Abbiamo a disposizione una vasta gamma di prodotti alimentari italiani e mediterranei — da articoli artigianali realizzati da produttori esclusivi fino a marchi ben noti — ideali per ristoranti, pizzerie, distributori e grande distribuzione." },
    { category: "Customers", question: "Chi può acquistare da BellItalia (ristoranti / negozi / privati)?", answer: "Il nostro catalogo è progettato principalmente per clienti professionali — pizzerie, ristoranti, distributori e GDO (grande distribuzione)." },
    { category: "Products", question: "Quanti prodotti avete nel vostro catalogo?", answer: "Offriamo più di 600 riferimenti nel nostro catalogo di prodotti autentici italiani." },

    // English FAQs (fallback in case translation doesn't work)
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

    // ========== CUSTOMIZATION & INTEGRATION FAQs (Andrea's FAQs) ==========
    // Italian Version
    { category: "Integrazioni", question: "Posso integrare il vostro servizio con il mio CRM?", answer: "Sì, certo! È una customizzazione disponibile con la versione Enterprise. Mandaci una email con tutte le specifiche del vostro CRM (API disponibili, formati dati, autenticazione, etc.) a support@echatbot.ai e provvediamo a farti un preventivo dettagliato." },
    { category: "Integrazioni", question: "Posso lanciare un webhook quando viene effettuato un ordine?", answer: "Sì, certo! È una customizzazione disponibile con la versione Enterprise. Mandaci una email con l'URL webhook di destinazione, il formato/struttura dati attesi, timing (immediate o batch?), e autenticazione required (API key, OAuth, etc.). Implementiamo un flusso: Ordine completato → Scheduler → Security Check → POST webhook al tuo servizio → Log e retry su failure." },
    { category: "Integrazioni", question: "Posso leggere la disponibilità dinamicamente dai miei server facendo una chiamata esterna?", answer: "Sì, certo! È una customizzazione disponibile con la versione Enterprise. Mandaci una email con l'URL API del vostro servizio di disponibilità, parametri da inviare (SKU, quantità, warehouse, etc.), formato risposta atteso, e timeout/retry policy. Implementiamo: Cliente chiede → ChatBot chiama API esterna → Risposta dinamica integrata nel flusso." },
    { category: "Team", question: "Ho una squadra di agenti. Posso inoltrare la richiesta all'agente associato?", answer: "Sì, certo! Ecco come funziona: 1) Vai in Backoffice → Settings → Team Members, 2) Aggiungi agenti con nome, email, skills (Sales, Support, Technical), 3) Configura routing nel Agent Config con regole di assegnazione (round-robin, skill-based, etc.), 4) Quando il cliente scrive, il ChatBot analizza la richiesta, assegna l'agente disponibile, e notifica l'agente per la risposta. Se l'agente è offline, il sistema passa al prossimo in lista." },
    { category: "Team", question: "Come ricevono le notifiche gli agenti quando viene assegnata una richiesta?", answer: "Gli agenti ricevono notifiche email con il nome del cliente e il contesto della conversazione. Possono rispondere direttamente dalla dashboard. Se attivi la versione Enterprise, le notifiche possono arrivare anche via WhatsApp. Il sistema traccia tutti gli handover per analytics e feedback di soddisfazione cliente." },
    { category: "FAQ", question: "Ho aggiunto delle FAQs. Puoi metterle nel flusso del chatbot?", answer: "Le FAQs sono già integrate nel flusso! Ecco come funzionano: 1) Aggiungi FAQ in Backoffice → Content → FAQs (Titolo, Risposta, Categorie, Keywords), 2) Quando il cliente chiede qualcosa, il sistema calcola un similarity score (0-100%), 3) Se score > 70% → usa la risposta FAQ istantaneamente (senza LLM latency), 4) Se score < 70% → usa risposta LLM standard. Tutto viene tracciato in analytics." },
    { category: "FAQ", question: "Quali sono i vantaggi di usare le FAQs nel chatbot?", answer: "I vantaggi delle FAQs sono: ✅ Risposte instant (no LLM latency), ✅ Consistenza (stesse risposte sempre), ✅ Risparmio token (meno costo LLM), ✅ Analytics complete (quante volte usata, click rate, fallback rate). Puoi vedere nel dashboard quali FAQ sono più usate e quali hanno il highest satisfaction rate." },

    // English Version (Fallback)
    { category: "Integrations", question: "Can I integrate your service with my CRM?", answer: "Yes, of course! It's a customization available with the Enterprise version. Send us an email with all your CRM specifications (available APIs, data formats, authentication, etc.) to support@echatbot.ai and we'll provide you with a detailed quote." },
    { category: "Integrations", question: "Can I launch a webhook when an order is placed?", answer: "Yes, of course! It's a customization available with the Enterprise version. Send us an email with: webhook destination URL, expected data format/structure, timing (immediate or batch?), and required authentication (API key, OAuth, etc.). We implement: Order completed → Scheduler → Security Check → POST webhook to your service → Log and retry on failure." },
    { category: "Integrations", question: "Can I read availability dynamically from my servers by making an external API call?", answer: "Yes, of course! It's a customization available with the Enterprise version. Send us an email with: your availability service API URL, parameters to send (SKU, quantity, warehouse, etc.), expected response format, and timeout/retry policy. We implement: Customer asks → ChatBot calls external API → Dynamic response integrated in the flow." },
    { category: "Team", question: "I have a team of agents. Can I forward requests to the associated agent?", answer: "Yes, of course! Here's how it works: 1) Go to Backoffice → Settings → Team Members, 2) Add agents with name, email, skills (Sales, Support, Technical), 3) Configure routing in Agent Config with assignment rules (round-robin, skill-based, etc.), 4) When the customer writes, the ChatBot analyzes the request, assigns the available agent, and notifies the agent for response. If the agent is offline, the system moves to the next in the list." },
    { category: "Team", question: "How do agents receive notifications when a request is assigned to them?", answer: "Agents receive email notifications with the customer name and conversation context. They can reply directly from the dashboard. If you activate the Enterprise version, notifications can also arrive via WhatsApp. The system tracks all handovers for analytics and customer satisfaction feedback." },
    { category: "FAQ", question: "I've added some FAQs. Can you put them in the chatbot flow?", answer: "FAQs are already integrated into the flow! Here's how it works: 1) Add FAQ in Backoffice → Content → FAQs (Title, Answer, Categories, Keywords), 2) When a customer asks something, the system calculates a similarity score (0-100%), 3) If score > 70% → use the FAQ answer instantly (without LLM latency), 4) If score < 70% → use standard LLM response. Everything is tracked in analytics." },
    { category: "FAQ", question: "What are the benefits of using FAQs in the chatbot?", answer: "The benefits of FAQs are: ✅ Instant answers (no LLM latency), ✅ Consistency (same answers always), ✅ Token savings (lower LLM cost), ✅ Complete analytics (times used, click rate, fallback rate). You can see in the dashboard which FAQs are most used and which have the highest satisfaction rate." },
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
  console.log("🏢 Creating/updating Enterprise support workspace (eChatbot HQ)...")

  let supportWorkspace = await prisma.workspace.findUnique({
    where: { id: "echatbot-hq-support" }
  })

  if (!supportWorkspace) {
    console.log("   Creating new workspace...")
    supportWorkspace = await prisma.workspace.create({
      data: {
        id: "echatbot-hq-support", // Fixed ID for consistent testing
        name: "eChatbot HQ",
        slug: "echatbot-hq",
        whatsappPhoneNumber: "+34654728753",
        whatsappProvider: "meta",
        metaPhoneNumberId: null,
        metaAccessToken: null,
        webhookVerifyToken: null,
        ultraMsgInstanceId: null,
        ultraMsgToken: null,
        notificationEmail: "hello@echatbot.ai",
        language: "ENG",
        currency: "EUR",
        description: "eChatbot Enterprise Support - product education channel",
        url: "https://www.echatbot.ai",
        channelStatus: true,
        deletedAt: null,
        welcomeMessage:
          "Hi! I'm your eChatbot product assistant. Ask me anything about plans, integrations or onboarding. 🚀",
        wipMessage:
          "Our assistants are being updated. If you need immediate help please write to support@echatbot.ai.",
        owner: { connect: { id: adminUser.id } },
        channelMode: "INFORMATIONAL",
        hasSalesAgents: false,
        hasHumanSupport: true,
        hasProductCatalog: false,
        hasCart: false,
        hasOrderTracking: false,
        needRegistration: true,
        humanSupportInstructions:
          "Ciao {{nameUser}}, ti metto subito in contatto con un consulente eChatbot. Riceverai risposta entro 15 minuti da {{agentName}} (tel: {{agentPhone}} / email: {{agentEmail}}).",
        operatorContactMethod: "EMAIL",
        toneOfVoice: "PROFESSIONAL",
        botIdentityResponse:
          "I'm the eChatbot product specialist. Automate sales, support, and campaigns on WhatsApp — in one platform. 💼 How can I help you today?",
        chatbotName: "Sofia",
        businessType: "technology",
        registrationPage: null, // Uses default /registration page
        requireManualApproval: false, // If true, new customers go to PENDING_APPROVAL after registration
        customAiRules: `# Communication Style

- Keep sentences SHORT - avoid long text blocks
- Greet the user often using their name: {{customerName}}
- Use emoticons to make tone friendly 😊
- When appropriate, end with a question to keep conversation flowing
- For lists, ALWAYS use bullet points
- If there's a link, add a line break after it
- For important concepts, use **bold**
- For SUPER important concepts, use **BOLD AND UPPERCASE**

# Custom Features & Enterprise Requests

When a customer asks about:
- **Custom integrations** (CRM, ERP, third-party APIs)
- **Personalized features** or platform modifications
- **Enterprise-specific needs** not covered by standard plans

**ALWAYS respond:**
"Le customizzazioni fanno parte del piano Enterprise 🏢

Per fornirti un preventivo accurato, ti chiedo di inviare una email a support@echatbot.ai con:
• Descrizione dettagliata della customizzazione richiesta
• Specifiche tecniche (API, formati dati, autenticazione)
• Piano mensile attuale o desiderato
• Consumo mensile stimato (numero messaggi/utenti)

Calcoleremo: prezzo piano mensile + consumo mensile + preventivo customizzazioni.

**RESPONSE TIME: 24-48 hours** 📧"

# Example Communication
"Hi {{customerName}}! 💼

Here's our documentation:
https://echatbot.ai/docs

**Quick Links:**
• Getting started
• API reference
• Pricing plans

Can I help with anything else?"`,
      },
    })
  } else {
    console.log(`   ✅ Workspace already exists: ${supportWorkspace.name}`)
  }

  console.log(
    `✅ Enterprise support workspace ready: ${supportWorkspace.name} (${supportWorkspace.id})`
  )

  // Associate admin user with support workspace (if not already)
  const existingSupportLink = await prisma.userWorkspace.findFirst({
    where: {
      userId: adminUser.id,
      workspaceId: supportWorkspace.id,
    }
  })

  if (!existingSupportLink) {
    await prisma.userWorkspace.create({
      data: {
        userId: adminUser.id,
        workspaceId: supportWorkspace.id,
        role: "SUPER_ADMIN",
      },
    })
    console.log(`   ✅ Admin user linked to workspace`)
  } else {
    console.log(`   ✅ Admin user already linked to workspace`)
  }

  await prisma.whatsappSettings.create({
    data: {
      workspaceId: supportWorkspace.id,
      phoneNumber: "+34654728753",
      apiKey: process.env.WHATSAPP_API_KEY || "dummy-api-key",
      webhookUrl:
        process.env.WHATSAPP_WEBHOOK_URL || "https://echatbot.ai/webhook",
      webhookId: `webhook-${supportWorkspace.id}`,
      webhookToken: `token-support-${Date.now()}`,
      adminEmail: adminEmail,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: process.env.SMTP_USER || adminEmail,
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: `eChatbot <${adminEmail}>`,
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
        systemPrompt: config.type === "TRANSLATION" ? TRANSLATION_PROMPT : "", // ✅ TRANSLATION uses DB prompt, others load from files
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
        "Data is hosted in the EU on Heroku infrastructure, encrypted at rest and in transit. We implement multi-tenant isolation, role-based access control and audit logging fully aligned with GDPR requirements. For more details, see our <a href='https://echatbot.ai/privacy' target='_blank'>Privacy Policy</a>.",
    },
    {
      category: "Security",
      question: "What happens to my customer data when they chat with the AI?",
      answer:
        "Customer messages are processed through OpenRouter's secure API with enterprise-grade encryption. Data is NOT used to train AI models and is processed only to generate responses. All conversations are stored encrypted in our EU servers and comply with GDPR data minimization principles. Full details in our <a href='https://echatbot.ai/privacy' target='_blank'>Privacy Policy</a>.",
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
    // === NEW FAQs - Missing from website ===
    {
      category: "Setup",
      question: "Do I need WhatsApp Business API or can I use regular WhatsApp?",
      answer:
        "eChatbot requires the official WhatsApp Business API (not the free WhatsApp Business app). We guide you through Meta verification and handle the technical setup. Most businesses get approved within 24-48 hours.",
    },
    {
      category: "Setup",
      question: "Can I use my existing phone number or do I need a new one?",
      answer:
        "You can migrate your existing business number to WhatsApp Business API. However, we recommend a dedicated number for your chatbot to keep personal and business messages separate.",
    },
    {
      category: "Setup",
      question: "How long does it take to set up eChatbot?",
      answer:
        "Basic setup takes about 30 minutes: connect WhatsApp, upload your catalog, configure the AI personality. Full customization with integrations typically takes 1-2 days for Starter, 1-2 weeks for Enterprise.",
    },
    {
      category: "AI Capabilities",
      question: "Can the AI actually sell my products?",
      answer:
        "Yes! The AI guides customers through product discovery, answers questions, handles objections, and facilitates checkout. It can send product images, create carts, and integrate with your payment system.",
    },
    {
      category: "AI Capabilities",
      question: "How do I upload my product catalog?",
      answer:
        "You can upload products via CSV import, connect to Shopify/WooCommerce, or use our API. The dashboard lets you add products manually with images, variants, and pricing.",
    },
    {
      category: "AI Capabilities",
      question: "Does the AI support multiple languages?",
      answer:
        "Yes! The AI auto-detects customer language and responds accordingly. We support Italian, English, Spanish, Portuguese and more. Your catalog stays in one language - the AI translates dynamically.",
    },
    {
      category: "AI Capabilities",
      question: "Can I customize the chatbot's personality and responses?",
      answer:
        "Absolutely. You control tone of voice (formal/friendly), bot name, identity response, and custom rules. You can also add FAQ entries that the AI prioritizes over generated responses.",
    },
    {
      category: "Payments",
      question: "Can the AI handle payments directly in WhatsApp?",
      answer:
        "The AI creates carts and sends secure payment links. We integrate with Stripe, PayPal, and custom payment gateways. WhatsApp Pay is not yet available in all regions.",
    },
    {
      category: "Limits",
      question: "How many messages can I send per month?",
      answer:
        "There's no hard message limit. You pay per conversation (24h window) according to WhatsApp's official rates. Our dashboard shows real-time usage and costs.",
    },
    {
      category: "Limits",
      question: "How many customers can the chatbot handle simultaneously?",
      answer:
        "Unlimited. The AI responds instantly to any number of concurrent conversations. During peak times (Black Friday, promotions), you won't experience slowdowns.",
    },
    {
      category: "Limits",
      question: "Is there a limit on products in my catalog?",
      answer:
        "Starter plans support up to 500 products. Premium handles 5,000+ products. Enterprise has no limits and includes vector search for large catalogs.",
    },
    {
      category: "Trial",
      question: "Is there a free trial period?",
      answer:
        "Yes! Every new workspace gets a 14-day free trial with full features. No credit card required to start. You can test all automations, integrations, and AI capabilities.",
    },
    {
      category: "Billing",
      question: "Can I cancel my subscription anytime?",
      answer:
        "Yes, you can cancel anytime from your dashboard. Monthly plans end at the billing cycle. No cancellation fees. Your data is retained for 30 days after cancellation.",
    },
    {
      category: "Support",
      question: "Do you offer support in Italian?",
      answer:
        "Sì! Our team is based in Italy and we offer full support in Italian, English, Spanish, and Portuguese. Enterprise clients get a dedicated Italian-speaking account manager.",
    },
    {
      category: "Support",
      question: "What are your support response times?",
      answer:
        "Starter: 24h email support. Premium: 4h response, live chat. Enterprise: 1h response, dedicated Slack channel, phone support during business hours.",
    },
    {
      category: "Widget",
      question: "Can I add the chatbot to my website?",
      answer:
        "Yes! We provide an embeddable widget for your website. Just copy-paste a code snippet. The widget syncs with your WhatsApp channel - customers can switch seamlessly.",
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

  // ========== PLATFORM GUIDE FAQs — navigation instructions for eChatbot users ==========
  const platformGuideFAQs = [
    {
      category: "Platform Guide",
      order: 10,
      question: "How do I connect my WhatsApp number?",
      answer:
        "Go to **Menu > Settings > WhatsApp Channel**.\n\n" +
        "Here you can:\n" +
        "- Choose your WhatsApp provider (**Meta** official API or **UltraMsg**)\n" +
        "- Enter your **phone number**, instance ID, and API token\n" +
        "- Set the **webhook URL** and verify token\n" +
        "- Enable or disable the channel with the toggle switch\n\n" +
        "Tip: The Meta official API requires approval from Meta Business. UltraMsg works immediately but has lower throughput.",
    },
    {
      category: "Platform Guide",
      order: 11,
      question: "How do I enable or disable the WhatsApp channel?",
      answer:
        "Go to **Menu > Settings > WhatsApp Channel**.\n\n" +
        "Toggle the **Channel Active** switch at the top of the page.\n" +
        "- Active: chatbot responds to incoming messages\n" +
        "- Disabled: messages are received but NOT answered (the queue still logs them)\n\n" +
        "Useful when you want to pause the bot temporarily without losing messages.",
    },
    {
      category: "Platform Guide",
      order: 20,
      question: "How do I change the chatbot name and tone of voice?",
      answer:
        "Go to **Menu > Settings > AI Personality**.\n\n" +
        "Here you can configure:\n" +
        "- **Chatbot Name** — the name shown to customers (e.g. Sofia, Alex)\n" +
        "- **Identity Response** — what the bot says when asked 'Who are you?'\n" +
        "- **Tone of Voice** — choose FORMAL, FRIENDLY, or PROFESSIONAL\n" +
        "- **Welcome Message** — the first message sent to new customers\n" +
        "- **Custom AI Rules** — free-text instructions (e.g. 'Always greet by name', 'Use bullet points')\n\n" +
        "Changes take effect on the next incoming message — no restart needed.",
    },
    {
      category: "Platform Guide",
      order: 30,
      question: "How do I create a push campaign?",
      answer:
        "Go to **Menu > Campaigns** (icon near your user avatar in the top bar).\n\n" +
        "Steps:\n" +
        "1. Click **New Campaign**\n" +
        "2. Write the message you want to send\n" +
        "3. Choose your **target audience** (all customers, by tag, by language, etc.)\n" +
        "4. Set the **scheduled date and time** or send immediately\n" +
        "5. Click **Send** or **Schedule**\n\n" +
        "After sending you can monitor delivery rate, open rate, and responses directly in the campaign detail page.",
    },
    {
      category: "Platform Guide",
      order: 40,
      question: "How do I add tags to a customer?",
      answer:
        "Go to **Menu > Customers**, find the customer and click on their name to open the profile.\n\n" +
        "In the customer detail panel:\n" +
        "- Click **Add Tag**\n" +
        "- Type the tag name (e.g. VIP, trial, italian) and confirm\n" +
        "- Tags are used to **filter campaigns** and **segment your audience**\n\n" +
        "You can also add tags during a live chat from the Chat panel by clicking the customer name at the top.",
    },
    {
      category: "Platform Guide",
      order: 50,
      question: "How do I see conversations waiting for human support?",
      answer:
        "Go to **Menu > Queue**.\n\n" +
        "The Queue shows all conversations where a customer has requested human assistance (or where the chatbot has escalated to an operator).\n\n" +
        "From here you can:\n" +
        "- See the **waiting time** for each conversation\n" +
        "- Click a chat to **open it and reply**\n" +
        "- **Reassign** chats to a team member\n" +
        "- Mark conversations as **resolved**\n\n" +
        "You can configure email notifications when new escalations arrive: go to **Menu > Settings > Human Support**.",
    },
    {
      category: "Platform Guide",
      order: 60,
      question: "How do I block a customer?",
      answer:
        "Go to **Menu > Customers**, find the customer and open their profile.\n\n" +
        "Click the **Block** button (or the three-dot menu > Block).\n" +
        "- A blocked customer can no longer send messages that the chatbot processes\n" +
        "- Their existing conversations remain visible in Chat history\n" +
        "- You can **unblock** them at any time from the same profile\n\n" +
        "Blocking applies to that specific phone number / contact only.",
    },
    {
      category: "Platform Guide",
      order: 70,
      question: "What are Custom Tools (Calling Functions) and how do I create one?",
      answer:
        "Go to **Menu > Settings > Custom Tools**.\n\n" +
        "Custom Tools allow the chatbot to call your **external APIs** (webhooks) to fetch or send real-time data — for example: check stock, look up order status, or trigger an action in your CRM.\n\n" +
        "To create a new tool:\n" +
        "1. Click **Add Tool**\n" +
        "2. Enter the **name** the AI will use to identify it (e.g. check_stock)\n" +
        "3. Enter the **webhook URL** of your API endpoint\n" +
        "4. Define the **parameters** the AI will collect from the conversation and pass to the API\n" +
        "5. Set the **HTTP method** (GET or POST)\n" +
        "6. Save\n\n" +
        "The chatbot will automatically call this function when it needs that information.",
    },
    {
      category: "Platform Guide",
      order: 80,
      question: "How do I configure human support and operator escalation?",
      answer:
        "Go to **Menu > Settings > Human Support**.\n\n" +
        "Here you can:\n" +
        "- **Enable/disable** human support for your workspace\n" +
        "- Set the **escalation message** shown to customers when an operator is assigned (supports variables like {{nameUser}}, {{agentName}}, {{agentPhone}})\n" +
        "- Choose **contact method**: EMAIL or WHATSAPP for operator notifications\n" +
        "- Write custom **escalation rules** (what situations should trigger escalation)\n\n" +
        "Operators receive a notification and can reply from **Menu > Queue** or via the Operator Dashboard link.",
    },
    {
      category: "Platform Guide",
      order: 90,
      question: "Where can I see stats and analytics for my chatbot?",
      answer:
        "Go to **Menu > Analytics**.\n\n" +
        "The Analytics dashboard shows:\n" +
        "- Total conversations and daily trends\n" +
        "- Messages sent/received\n" +
        "- Chatbot vs human response breakdown\n" +
        "- Top FAQ answers used\n" +
        "- Language distribution of customers\n" +
        "- Campaign performance (delivery, read rate)\n\n" +
        "You can filter by **date range** and export data for BI tools.",
    },
    {
      category: "Platform Guide",
      order: 100,
      question: "How do I invite a team member to my workspace?",
      answer:
        "Go to **Menu > Team Collaboration** (accessible from the top navigation bar).\n\n" +
        "Steps:\n" +
        "1. Click **Invite Member**\n" +
        "2. Enter their **email address**\n" +
        "3. Choose their **role**: SUPER_ADMIN, ADMIN, or MEMBER\n" +
        "4. Click **Send Invitation**\n\n" +
        "They will receive an email with a registration link. Once they accept, they can access your workspace with the permissions you assigned.\n\n" +
        "Roles:\n" +
        "- **SUPER_ADMIN** — full access including billing\n" +
        "- **ADMIN** — full access except billing\n" +
        "- **MEMBER** — read/respond only",
    },
    {
      category: "Platform Guide",
      order: 110,
      question: "How do I add the chat widget to my website?",
      answer:
        "Go to **Menu > Settings > Website Widget**.\n\n" +
        "Here you can:\n" +
        "- Set the **widget title**, subtitle, and colors to match your brand\n" +
        "- Choose **position** (bottom-right or bottom-left)\n" +
        "- Enable or disable the widget channel\n\n" +
        "To embed it on your website:\n" +
        "1. Scroll down to **Widget Code**\n" +
        "2. Copy the JavaScript snippet\n" +
        "3. Paste it just before the closing </body> tag of your website\n\n" +
        "The widget connects directly to the same chatbot and customer database as WhatsApp.",
    },
    {
      category: "Platform Guide",
      order: 120,
      question: "Where do I see my credit balance and how do I top up?",
      answer:
        "Go to **Menu > Billing**.\n\n" +
        "Here you can:\n" +
        "- See your **current credit balance** and consumption history\n" +
        "- View the **current plan** (Starter, Premium, Enterprise)\n" +
        "- **Add credits** via credit card or PayPal\n" +
        "- Download **monthly invoices**\n\n" +
        "Credits are consumed per message sent/received. You will receive an email alert when your balance is running low.",
    },
    {
      category: "Platform Guide",
      order: 130,
      question: "How do I update my business information?",
      answer:
        "Go to **Menu > Settings > Business Config**.\n\n" +
        "Here you can update:\n" +
        "- **Business name**, description, and website URL\n" +
        "- **Notification email** for alerts\n" +
        "- **Currency** and **default language**\n\n" +
        "These details are used by the chatbot when customers ask about your business.",
    },
    {
      category: "Platform Guide",
      order: 140,
      question: "How do I restrict which domains can use my widget?",
      answer:
        "Go to **Menu > Settings > Security**.\n\n" +
        "In the **Allowed Domains** field, enter your website domains (one per line, e.g. https://myshop.com).\n\n" +
        "- Only those domains will be allowed to load your widget\n" +
        "- Requests from unlisted domains will be blocked (prevents unauthorized embedding)\n" +
        "- Leave empty to allow all domains (not recommended for production)\n\n" +
        "Also here you can manage **2FA enforcement** for your team members.",
    },
  ]

  for (const faq of platformGuideFAQs) {
    await prisma.fAQ.create({
      data: {
        workspaceId: supportWorkspace.id,
        question: faq.question,
        answer: faq.answer,
        isActive: true,
        category: faq.category,
        order: faq.order,
      },
    })
  }

  console.log(`✅ Added ${platformGuideFAQs.length} Platform Guide FAQs for eChatbot HQ workspace`)

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
        agentSelected: "INFO_AGENT",
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

  // ============================================================================
  // ECOLAUNDRY — FLOW workspace (Neapolis / Cliente-0)
  // ============================================================================
  console.log("🏢 Creating/updating FLOW workspace (Ecolaundry) for admin user...")

  let ecolaundryWorkspace = await prisma.workspace.findFirst({
    where: { slug: "ecolaundry" },
  })

  if (!ecolaundryWorkspace) {
    console.log("   Creating new FLOW workspace...")
    ecolaundryWorkspace = await prisma.workspace.create({
      data: {
        name: "Ecolaundry",
        slug: "ecolaundry",
        owner: { connect: { id: adminUser.id } },
        channelMode: "FLOW",
        language: "ESP",
        currency: "EUR",
        description: "Self-service laundry with smart troubleshooting via QR codes",
        channelStatus: true,
        chatbotName: "Sofia",
        botIdentityResponse:
          "I'm Sofia, the self-service laundry digital assistant. I help customers use the washing machines and dryers. When a customer scans the QR code on a machine, I guide them step-by-step through troubleshooting. I can help with startup issues, error codes, and washing problems. If I can't resolve the issue, I connect them with a human operator.",
        toneOfVoice: "FRIENDLY",
        welcomeMessage:
          "Hi! 👋 I'm {{chatbotName}}, your laundry assistant.\nScan the QR code on the machine to get started, or describe your problem and I'll help you right away.",
        wipMessage:
          "The service is temporarily unavailable. Please contact the laundry staff directly.",
        businessType: "services",
        hasHumanSupport: false,
        hasProductCatalog: false,
        hasCart: false,
        hasOrderTracking: false,
        needRegistration: false,
        operatorContactMethod: "EMAIL",
        notificationEmail: "gelsogrove@gmail.com",
        humanSupportInstructions:
          "Hello {{nameUser}}, I'm connecting you with our maintenance team. Someone will assist you shortly (email: {{agentEmail}}). The chatbot is paused until they respond. Thank you for your patience! 🤝",
        enableWelcomeMessage: true,
        sessionResetTimeout: 3600,
      },
    })
  } else {
    console.log(`   ✅ FLOW workspace already exists: ${ecolaundryWorkspace.name}`)
  }

  console.log(`✅ FLOW workspace ready: ${ecolaundryWorkspace.name} (${ecolaundryWorkspace.id})`)

  // Associate admin user with Ecolaundry workspace
  const existingEcoLink = await prisma.userWorkspace.findFirst({
    where: { userId: adminUser.id, workspaceId: ecolaundryWorkspace.id },
  })

  if (!existingEcoLink) {
    await prisma.userWorkspace.create({
      data: {
        userId: adminUser.id,
        workspaceId: ecolaundryWorkspace.id,
        role: "SUPER_ADMIN",
      },
    })
    console.log(`   ✅ Admin user linked to Ecolaundry workspace`)
  }

  // WhatsApp settings for Ecolaundry
  const existingEcoWhatsapp = await prisma.whatsappSettings.findFirst({
    where: { workspaceId: ecolaundryWorkspace.id },
  })
  if (!existingEcoWhatsapp) {
    await prisma.whatsappSettings.create({
      data: {
        workspaceId: ecolaundryWorkspace.id,
        phoneNumber: "+34600000000",
        apiKey: process.env.WHATSAPP_API_KEY || "dummy-api-key",
        webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "https://echatbot.ai/webhook",
        webhookId: `webhook-${ecolaundryWorkspace.id}`,
        webhookToken: `token-eco-${Date.now()}`,
        adminEmail: adminEmail,
        smtpHost: "smtp.gmail.com",
        smtpPort: 465,
        smtpSecure: true,
        smtpUser: process.env.SMTP_USER || adminEmail,
        smtpPass: process.env.SMTP_PASS || "",
        smtpFrom: `Ecolaundry <${adminEmail}>`,
      },
    })
  }

  // Languages for Ecolaundry
  for (const lang of [
    { code: "ESP", name: "Español", isDefault: true },
    { code: "ENG", name: "English", isDefault: false },
    { code: "IT", name: "Italiano", isDefault: false },
  ]) {
    await prisma.languages.create({
      data: {
        code: lang.code,
        name: lang.name,
        isDefault: lang.isDefault,
        isActive: true,
        workspaceId: ecolaundryWorkspace.id,
      },
    })
  }

  // AgentConfig entries for Ecolaundry (same as Informational — no ecommerce agents)
  const ecoAgents = defaultAgents(ecolaundryWorkspace.id).filter(
    (agent) =>
      !["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"].includes(agent.type)
  )

  for (const agentCfg of ecoAgents) {
    await prisma.agentConfig.create({
      data: {
        workspaceId: agentCfg.workspaceId,
        name: agentCfg.name,
        type: agentCfg.type,
        description: agentCfg.description,
        icon: agentCfg.icon,
        systemPrompt: agentCfg.type === "TRANSLATION" ? TRANSLATION_PROMPT : "",
        model: agentCfg.model,
        temperature: agentCfg.temperature,
        maxTokens: agentCfg.maxTokens,
        order: agentCfg.order,
        isActive: agentCfg.isActive,
        availableFunctions: agentCfg.availableFunctions || null,
      },
    })
  }

  // ── Router prompt (History node — collects location+type+number, calls assignMachine) ──
  const ECOLAUNDRY_ROUTER_PROMPT = `You are {{chatbotName}}, the virtual assistant of {{companyName}}, a self-service laundry.
Tone: {{toneOfVoice}}.

YOUR MISSION: Welcome the customer and collect the information needed to assign them the correct machine.

RULES:
1. If the customer only greets ("hi", "hello", "ciao", "hola", "buenas") respond: "Hi! I'm the Ecolaundry assistant. How can I help you today?"
2. If the customer describes a problem, in ONE message: (a) acknowledge the problem, (b) ask for the location. Example: "I understand, don't worry. Which location are you at?"
3. ONE question per message — NEVER ask multiple questions at once
4. Collect in this order: 1) Location, 2) Machine type (washer or dryer), 3) Machine number
5. When you have LOCATION + TYPE + NUMBER → call assignMachine() immediately
6. assignMachine flowKey values: lavatrice_hs60xx = washer, asciugatrice_ed340 = dryer

EXAMPLES:
- "I paid but it won't start" → "I understand, don't worry. Which location are you at?"
- "Goya" → "Is it a washer or a dryer?"
- "washer" → "What's the machine number? You'll find it on the label."
- "42" → call assignMachine(flowKey="lavatrice_hs60xx", machineNumber="42") and briefly confirm

## WHEN TO CALL resetSession()
Call resetSession() WITHOUT asking confirmation when the customer indicates they made a mistake or wants to start over. Typical signals (any language):
- "wait, I meant the dryer / I was wrong about the machine"
- "forget it, let's start over / restart / ricominciamo / empecemos de nuevo"
- "no, actually the machine number is different" AFTER assignMachine was already called
After resetSession() the context (location, type, number) is wiped — ask again from step 1.

## FREQUENTLY ASKED QUESTIONS
If the customer asks a general question (hours, price, soap, refunds…) answer directly using the FAQs below WITHOUT routing to a specialist:

{{faqs}}

NEVER invent information. NEVER ask more than one question at a time.
ALWAYS respond in the customer's language — TranslationAgent handles multilingual output.`

  // ── Ecolaundry systemPrompt (Acceptance Criteria from Andrea) ──────────────
  // This prompt embeds ALL the business rules from the Ecolaundry acceptance doc:
  // tone, limits, anti-fraud rules, knowledge base, escalation protocol, etc.
  const ECOLAUNDRY_SYSTEM_PROMPT = `You are Sofia, the Ecolaundry customer support chatbot.
You help customers resolve laundry machine issues quickly, clearly, and reassuringly.

## PRIORITIES
1. Reduce customer frustration
2. Help them complete the service if possible
3. Collect only necessary data
4. Give simple instructions, one at a time
5. Escalate to operator when the case is ambiguous, inconsistent, or requires validation
6. Never improvise compensations outside defined rules
7. Never directly accuse anyone of fraud

## TONE & STYLE
- Close, professional, calm, solution-oriented, brief
- Short sentences
- One question at a time (never ask two questions in one message)
- Maximum 3 consecutive instructions
- Flow: reassure → diagnose → resolve
- If customer is angry → respond calmly, never argue
- Template phrases:
  - "Don't worry, I'll help you."
  - "To start, tell me which location you're at."
  - "Please check what exactly appears on the display."
  - "Thanks, with that I can guide you."

## WHAT YOU CAN DO
- Explain basic operation of washers and dryers
- Guide through common errors (SEL, PUSH PROG, DOOR, ALM DOOR, 001, ALM/ALN)
- Explain how loyalty cards work (purchase and recharge)
- Give info on invoices, prices, hours, and differences between locations
- Collect data for refunds/returns
- Guide the customer before escalating to a human

## WHAT YOU MUST NEVER DO
- Promise refunds without collecting data first
- Accuse of fraud or say "this is a scam"
- Decide doubtful cases without human review
- Handle undocumented exceptions
- Invent or affirm prices not confirmed in the knowledge base
- Promise compensations unless there is a clear automatic rule

## BASIC FLOW
Opening: "Hi, I'm the Ecolaundry assistant. I'll help with your request. Which location are you at?"
Minimum data to collect: location, washer or dryer, machine number, what happened, whether service completed.
Order: 1. identify location → 2. identify machine type → 3. was the service completed? → 4. identify the error → 5. give simplest solution → 6. if needed, collect data to escalate.

## MAIN INTENTS

### 5.1 Washer not working
Goal: identify if it's a process error, payment issue, or machine fault.
Questions (one per turn): location? machine number? paid with card, cash, or code? what's on the display? did the central unit return change?
Base response: "OK, I'll help you step by step. Tell me what exactly appears on the washer display."
Escalate if: display doesn't match known cases, unclear payment, suspected fault.

### 5.2 Dryer not working
Goal: differentiate between usage error, missing added time, or technical fault.
Questions: location? dryer number? did it start at all? did you add time or is it the first cycle? what's on the display?
Base response: "Thanks. Let me check. Tell me if the dryer started at any point or if it never began."
Escalate if: at Alemanya or Pineda money was added but minutes didn't increase, suspected fault.

### 5.3 Double charge
Goal: determine if service was completed and collect refund data.
Questions: location? were you able to wash or dry? explain step by step what you did? last 4 digits of the card? can you send a payment screenshot?
If service completed: "Thanks. To review, we need the last 4 digits of your card and a payment screenshot. We can also send you the refund form."
Preventive advice: "Next time, before paying again, contact us and we'll help you right away."
Escalate if: amount doesn't match the location, story is confusing, customer is very upset.

### 5.4 Paid but won't start
Goal: detect selection error, confirmation issue, door problem, or technical fault.
Questions in order: 1. location? 2. washer or dryer? 3. machine number? 4. what's on the display? 5. did the central unit return change?
RULES: never diagnose without location + machine type + display state. Ask only one question per turn.

#### Display states diagnostic:
**SEL** — Machine available, pending selection after payment.
Response: "The machine is pending selection. Please check that you pressed the correct machine number or program."
Action: re-select machine or program. Escalate only if already done and machine still doesn't respond.

**PUSH PROG** — Program confirmation missing.
Response: "Press the program you want and tell me if the machine responds."
Action: press program. Escalate only if it doesn't respond after pressing.

**DOOR** — Door not closed properly.
Response: "Open and close the door properly, then try again."
Action: open and close door correctly. Escalate if message persists after repeating.

**ALM DOOR** — Door latch problem or object stuck in door/drum.
Response: "Carefully open the door, check if anything is stuck, and close it properly again. Tell me if the message disappears."
Action: inspect door and close again. Escalate if message doesn't disappear.

**001** — Program may have been selected before payment, state didn't reset.
Response: "It's possible the program was selected before payment. We'll review it to help you."
Action: wait for instructions. ALWAYS escalate.

**ALM / ALN / ALN A / ALN N** — Machine alarm or interrupted cycle.
Response: "It seems the machine detected an issue and we need to review it."
Action: do not continue operating the machine. ALWAYS escalate.

#### Change returned rules:
If central unit did NOT return change → possible wrong machine number selected.
Response: "You may not have selected the right machine number. Check if there's still credit on the central unit and press the correct button."
If central unit DID return change → check display and proceed according to display state.
Escalate if: customer followed steps and still not working, contradiction between payment and machine state, undocumented display code, suspected fault.

### 5.5 Error AL001
Goal: explain the cause and correct the usage sequence.
Response: "This warning usually appears when the process was done in the wrong order. I'll help you complete it. Tell me which location you're at and what you did just before it appeared."
Secondary goal: educate the customer to avoid repeating the error.
Escalate if: customer can't follow instructions, error persists after correct process.

### 5.6 I have a code
Goal: differentiate if it's a lower or higher amount code and help use it.
Questions: what's the exact code including any letters? which location? is a small amount missing or does the code cover more?
Rules:
- If code seems incomplete (only numbers), ask if there are letters before it.
- If a small amount is missing, ask to put the remaining money in the central unit and not touch anything else, then guide them at the machine.
- If it's a higher amount, escalate or generate a new code per human operations.
Response: "I'll help you use it. Tell me the exact code, including letters if any."
Escalate if: incoherent code, customer says no letters but format doesn't match, new code needed.

### 5.7 Refund request
Goal: collect minimum data and route correctly.
Response: "To process the refund, we need: the last 4 digits of your card, a payment screenshot, and a brief description of what happened. We'll also send you the refund form."
Form: https://forms.gle/XFGPAd9581AhC9eu7
Support email: service@alberwaz.net
Escalate if: customer demands immediate refund, complex incident.

### 5.8 Invoice request
Goal: give clear, closed instructions.
Response: "To get an invoice, please send an email to olga@alberwaz.net with the following information:"
Required data: company name (raó social), email, laundry location used, CIF/NIF, address, date of use, washer 20kg / washer 15kg / washer 10kg / dryer usage, observations.

### 5.9 Loyalty card
Goal: explain purchase and recharge.
Response: "The loyalty card costs €20 in cash and only works at the store where it was purchased."
For Goya and Pineda: "At the button central unit, press the second button on the right line."
To recharge: "Insert the card and follow the central unit instructions."

### 5.10 Hours, prices, and location differences
Goal: give practical information without guessing.
General hours: "Opening hours are 8:00 to 22:00, every day of the year."
Exception L'Escala: "At L'Escala, machines can be used from 7:00 to 23:00."
If customer asks for prices: consult location knowledge base. If not confirmed, escalate to review.

## ANTI-FRAUD RULES
NEVER say "this is a scam" or "fraud". Instead use:
- "We need to verify this case manually."
- "There's a piece of data that doesn't match, we'll review it."
- "To check properly, we're forwarding this for review."
Flag as inconsistent:
- At Goya, customer says card reader charged €10 (should be €7)
- At Pineda, customer says card reader charged €10 (should be €8)
- Customer gives a numbers-only code and says there are no letters
- The process description is very contradictory
Action: do NOT confront, collect data, escalate to human review.

## COMPENSATION RULES
General rule: the chatbot can inform that a solution will be sought, but must NOT promise compensations unless there's a very clear automatic rule.
Response: "We'll review it and help you find the best solution."
Cases where chatbot can mention possible solutions (without granting):
- Clothes didn't come out clean/dry enough
- Incident attributable to the service
- Customer lost time due to our problem
Possible solutions to mention: free machine activation, free dryer, direct code, referral to refund form.
ALWAYS escalate when: deciding free machine activation, deciding free dryer, issuing a new code, customer claims specific compensation, ambiguous case or debatable responsibility.
Escalation message: "We're forwarding your case for review so we can apply the most appropriate solution."

## LOCATION KNOWLEDGE BASE

### General (all locations)
- All machines are Girbau brand
- Soap and softener included
- Do NOT recommend adding extra products (can damage machines)
- Average wash cycle: ~28 minutes
- 15 min drying can dry ~20kg of mixed laundry
- 100% cotton usually needs more time

### L'Escala
- Hours (machine use): 7:00–23:00
- Loyalty card: NO
- Central unit type: standard
- TPV fixed amount: not confirmed
- Returns change: not confirmed
- Notes: open location, machine may auto-activate without re-confirming program (verify with customer)
- Common issues: verify with customer if activation actually occurred

### Goya
- Hours: 8:00–22:00
- Loyalty card: YES (€7)
- Central unit type: button central
- TPV fixed amount: €7
- Returns change: yes, in coins
- Notes: customer must remove lint from dryer by opening the tray
- Common issues: if customer says card reader charged €10 → flag as inconsistent, escalate

### Pineda
- Hours: 8:00–22:00
- Loyalty card: YES (€8)
- Central unit type: button central
- TPV fixed amount: €8
- Returns change: yes, in coins
- Notes: central with buttons and individual charging
- Common issues: if customer says card reader charged €10 → flag as inconsistent, escalate. Sometimes adding money to dryer doesn't add minutes.

### Alemanya
- Hours: 8:00–22:00
- Loyalty card: YES
- Central unit type: standard
- TPV fixed amount: not confirmed
- Returns change: not confirmed
- Notes: may require technical support for payment or drying
- Common issues: sometimes adding money to dryer doesn't add minutes, sometimes card payment doesn't work

### Hortes
- Hours: 8:00–22:00
- Loyalty card: YES
- Central unit type: standard
- TPV fixed amount: not confirmed
- Returns change: not confirmed
- Notes: no specific observations confirmed
- Common issues: sometimes card payment doesn't work

## ESCALATION PROTOCOL
Escalate when:
- Customer is very angry
- Contradiction in amount or story
- Problem doesn't match known errors
- Need to manually activate a machine
- Need to decide a compensation
- Suspected fraud or inconsistency
- Incorrect code or need to generate a new one
- Incidents with cameras or AJAX systems
Escalation message: "We're forwarding your case for review so we can help you in the most appropriate way."

## REUSABLE RESPONSE TEMPLATES
- Welcome: "Hi, I'm the Ecolaundry assistant. Happy to help. Which location are you at right now?"
- Calm down: "Don't worry, let's review this together."
- Ask specific data: "Please tell me what exactly appears on the display."
- Payment data needed: "To review properly, we need the last 4 digits of your card and a payment screenshot."
- Escalation: "We'll review this manually because there's a piece of data we need to verify."
- Prevent re-payment: "Before paying again, contact us and we'll help you right away."

## SYSTEM RULES
1. ALWAYS respond in English — TranslationAgent handles i18n
2. If the customer describes a machine problem → call startFlow with the matching flowId
3. If the customer asks a general question → answer from the knowledge base above
4. If unsure which flow → ask a clarifying question
5. NEVER invent technical info not documented above
6. If frustrated or asks for help → call contactOperator
7. Identify the location FIRST, then the machine type, THEN diagnose
8. When there's a machine incident, ask for the exact display state before diagnosing
9. Never ask more than one question per turn
10. If the case doesn't clearly fit a known flow, escalate`

  // ── FlowNodeConfig #1: Washer HS-60XX ───────────────────────────────────────
  const washerFlowData = {
    flowLabel: "Washer HS-60XX",
    systemPrompt: ECOLAUNDRY_SYSTEM_PROMPT + `

## MACHINE SPECS — Washer HS-60XX
- Capacity: 8 kg
- Programs:
  • 60° Molt Calent — white clothes, work clothes, very dirty laundry (resistant fabrics) — €4.00
  • 40° Calent — cotton, coloured clothes, nylon, other fibres — €3.50
  • 30° Temperat — cotton blends, coloured clothes, synthetic fabrics — €3.00
  • Fred (*) cold — delicates, wool, acrylics, silk, curtains, down — €3.00
- Payment: coins or contactless
- Spin speed: 800/1000/1200 RPM (selectable)
- EXTRA options: Extra rinse (+€0.50), Pre-wash (+€1.00)

Available flows: non_parte, errore_alm, lavaggio_problema

## WHEN TO CALL resetSession()
Call resetSession() without asking confirmation whenever the customer signals they picked the WRONG machine type/number or wants to restart (any language). Examples:
- "wait, I meant the dryer" / "era l'asciugatrice" / "era la secadora"
- "start over" / "ricominciamo" / "empecemos de nuevo"
- "forget it, another machine"
After reset the context is wiped and the Router will ask again from step 1.`,
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    availableFunctions: JSON.parse(JSON.stringify(["startFlow", "contactOperator", "resetSession"])),
    flows: {
          non_parte: {
            step_0: {
              type: "CHOICE",
              prompt: "What exactly do you see on the washer display right now?",
              transitions: {
                "sel": "non_parte.caso_sel",
                "push": "non_parte.caso_push",
                "door": "non_parte.caso_door",
                "price": "non_parte.caso_importo",
                "extra": "non_parte.caso_extra",
                "alm_door": "non_parte.caso_alm_door",
                "001": "non_parte.caso_001",
                "alm": "non_parte.caso_alm_gen",
              },
              transitionDescriptions: {
                "sel": "SEL — the display shows 'SEL' (standby/selection mode)",
                "push": "PUSH or Pr followed by a number — program selected but not confirmed",
                "door": "DOOR — the display shows a door-related message",
                "price": "A price or amount in euros (e.g. 04.00, 12.00, 3.50) — shows how much is left to pay",
                "extra": "EXTRA — the EXTRA light or indicator is on",
                "alm_door": "ALM DOOR — door alarm specifically",
                "001": "001 or error 001 — numeric error code 001",
                "alm": "ALM, ALN, or any other alarm code (not ALM DOOR or 001)",
              },
              onInterruptFallback: "Please describe what you see on the washer display 👀",
            },
            caso_sel: {
              type: "ACTION",
              prompt: "SEL means the machine is ready and waiting for you to select a program.\n👉 Press the correct machine number or program button.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            caso_push: {
              type: "ACTION",
              prompt: "You've inserted credit but haven't confirmed the program yet.\n👉 Press the program you want and tell me if the machine responds.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            caso_door: {
              type: "ACTION",
              prompt: "The door isn't closed properly.\n👉 Open and close the door firmly until you hear it click, then try again.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            caso_importo: {
              type: "CHOICE",
              prompt: "Not enough credit. Did the central unit return your change?",
              transitions: {
                "YES": "non_parte.cambio_si",
                "NO": "non_parte.cambio_no",
              },
              transitionDescriptions: {
                "YES": "Yes, the central unit returned the change/coins",
                "NO": "No, it did not return the change",
              },
            },
            cambio_si: {
              type: "ACTION",
              prompt: "OK, check the display state and insert the correct amount shown.\n👉 You can pay with coins or contactless.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            cambio_no: {
              type: "ACTION",
              prompt: "You may not have selected the right machine number.\n👉 Check if there's still credit on the central unit and press the correct button for your machine.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            caso_extra: {
              type: "INFO",
              prompt: "An EXTRA option may be active.\n👉 If an EXTRA button is lit:\n- if you don't want it → press the button to deactivate\n- if you want it → insert the remaining credit shown on display",
              isTerminal: true,
            },
            caso_alm_door: {
              type: "ACTION",
              prompt: "ALM DOOR — possible object stuck in the door or drum.\n👉 Carefully open the door, check if anything is caught, and close it properly again.\nTell me if the message disappears.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            caso_001: {
              type: "INFO",
              prompt: "Error 001 — the program may have been selected before payment and the state didn't reset correctly.\n👉 We'll review this to help you. I'm contacting an operator.",
              isTerminal: true,
            },
            caso_alm_gen: {
              type: "INFO",
              prompt: "The machine has detected an alarm and we need to review it.\n👉 Do NOT continue operating the machine.\nI'm contacting an operator to assist you.",
              isTerminal: true,
            },
            ask_resolved: {
              type: "CONFIRMATION",
              prompt: "Did that solve the problem? (yes / no)",
              transitions: {
                YES: "non_parte.end_success",
                NO: "non_parte.handle_escalate",
              },
            },
            end_success: {
              type: "INFO",
              prompt: "Great! ✅ Enjoy your wash 👍",
              isTerminal: true,
            },
            handle_escalate: {
              type: "INFO",
              prompt: "I understand 😔 I'm contacting an operator to help you.",
              isTerminal: true,
            },
          },
          errore_alm: {
            step_0: {
              type: "CHOICE",
              prompt: "What alarm code do you see after ALM on the display?",
              transitions: {
                "alm_a": "errore_alm.alm_acqua",
                "alm_e": "errore_alm.alm_scarico",
                "alm_door": "errore_alm.alm_door",
                "alm_var": "errore_alm.alm_var",
              },
              transitionDescriptions: {
                "alm_a": "ALM/A — water intake alarm",
                "alm_e": "ALM/E — drainage alarm",
                "alm_door": "ALM/door — door-related alarm",
                "alm_var": "ALM/VAr — variable/technical alarm",
              },
              onInterruptFallback: "Tell me the code you see after ALM on the display 🔧",
            },
            alm_acqua: {
              type: "ACTION",
              prompt: "Water intake problem.\n👉 Press STOP once.\n\nIf the issue persists, please use another machine.\nI'll notify maintenance.",
              isTerminal: true,
            },
            alm_scarico: {
              type: "ACTION",
              prompt: "Drainage problem.\n👉 Press STOP once.\n\n⚠️ The door may stay locked for up to 30 minutes while the water drains.\n\nIf the issue persists, please use another machine.",
              isTerminal: true,
            },
            alm_door: {
              type: "ACTION",
              prompt: "Door latch problem.\n👉 Press STOP once.\n\nIf the issue persists, please use another machine.",
              isTerminal: true,
            },
            alm_var: {
              type: "INFO",
              prompt: "Technical machine fault.\n👉 Please use another machine.\nWe'll provide a compensation 👍\n\nI'm notifying maintenance.",
              isTerminal: true,
            },
          },
          lavaggio_problema: {
            step_0: {
              type: "CHOICE",
              prompt: "What problem did you notice during or after the wash?",
              transitions: {
                "no_spin": "lavaggio_problema.no_centrifuga",
                "end_bal": "lavaggio_problema.end_bal",
              },
              transitionDescriptions: {
                "no_spin": "Didn't spin properly / clothes still very wet after the cycle",
                "end_bal": "Display shows END + bAL after the wash finished",
              },
              onInterruptFallback: "Describe what happened during or after the wash 🔧",
            },
            no_centrifuga: {
              type: "INFO",
              prompt: "The load was probably too large or unbalanced.\n👉 Split the load and run a new spin cycle (Quick program at €2.50).",
              isTerminal: true,
            },
            end_bal: {
              type: "INFO",
              prompt: "The wash finished but the spin cycle failed due to an unbalanced load.\n👉 Split the load and run a new spin cycle (Quick program at €2.50).",
              isTerminal: true,
            },
          },
        },
        isActive: true,
      },
    },
    isActive: true,
  }
  await prisma.flowNodeConfig.upsert({
    where: { workspaceId_flowKey: { workspaceId: ecolaundryWorkspace.id, flowKey: "lavatrice_hs60xx" } },
    update: washerFlowData,
    create: { workspaceId: ecolaundryWorkspace.id, flowKey: "lavatrice_hs60xx", ...washerFlowData },
  })
  console.log("   ✅ FlowNodeConfig upserted: Washer HS-60XX")

  // ── FlowNodeConfig #2: Dryer ED-340 ────────────────────────────────────────
  const dryerFlowData = {
    flowLabel: "Dryer ED-340",
    systemPrompt: ECOLAUNDRY_SYSTEM_PROMPT + `

## MACHINE SPECS — Dryer ED-340
- Capacity: 15 kg
- Programs:
  • 80° Tª Alta — towels, weekly laundry, 100% cotton — €5.00 (30 min), €6.50 (45 min)
  • 65° Tª Mitja — duvets, blankets, mixed fabrics (50% cotton) — €4.00 (30 min), €5.50 (45 min)
  • 50° Tª Baixa — sofa covers, work clothes, polyester/cotton blends — €3.00 (30 min), €4.50 (45 min)
- Payment: coins or contactless
- Lint filter: should be cleaned before each use

Available flows: non_parte, errore_reset

## WHEN TO CALL resetSession()
Call resetSession() without asking confirmation whenever the customer signals they picked the WRONG machine type/number or wants to restart (any language). Examples:
- "wait, I meant the washer" / "era la lavatrice" / "era la lavadora"
- "start over" / "ricominciamo" / "empecemos de nuevo"
- "forget it, another machine"
After reset the context is wiped and the Router will ask again from step 1.`,
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    availableFunctions: JSON.parse(JSON.stringify(["startFlow", "contactOperator", "resetSession"])),
    flows: {
          non_parte: {
            step_0: {
              type: "CHOICE",
              prompt: "What's happening with the dryer? Describe what you see on the display or what the problem is.",
              transitions: {
                "blank": "non_parte.display_blank",
                "door": "non_parte.door_issue",
                "price": "non_parte.credit_issue",
              },
              transitionDescriptions: {
                "blank": "Display is blank, dark, shows nothing, no lights, not turning on",
                "door": "Door won't close, latch stuck, can't shut the door properly",
                "price": "Display shows a price or amount but the dryer won't start after paying",
              },
              onInterruptFallback: "Describe what you see on the dryer 🔧",
            },
            display_blank: {
              type: "ACTION",
              prompt: "The dryer may need a reset.\n👉 Open the door, wait 10 seconds, close it firmly, then try again.\n\nIf the display stays blank, please use another dryer.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            door_issue: {
              type: "ACTION",
              prompt: "The door latch may be stuck.\n👉 Check that no clothes are caught in the door seal.\n👉 Close the door firmly until you hear it click.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            credit_issue: {
              type: "ACTION",
              prompt: "You may need to insert more credit.\n👉 Check the amount shown on the display and insert coins or tap contactless.\n\nIf the issue persists after paying, try pressing the START button firmly.",
              transitions: { default: "non_parte.ask_resolved" },
            },
            ask_resolved: {
              type: "CONFIRMATION",
              prompt: "Did that solve the problem? (yes / no)",
              transitions: {
                YES: "non_parte.end_success",
                NO: "non_parte.handle_escalate",
              },
            },
            end_success: {
              type: "INFO",
              prompt: "Great! ✅ Your clothes will be dry soon 👍",
              isTerminal: true,
            },
            handle_escalate: {
              type: "INFO",
              prompt: "I understand 😔 I'm contacting an operator to help you.",
              isTerminal: true,
            },
          },
          errore_reset: {
            step_0: {
              type: "CHOICE",
              prompt: "What problem are you experiencing with the dryer?",
              transitions: {
                "alarm": "errore_reset.allarme",
                "no_heat": "errore_reset.non_scalda",
                "mid_stop": "errore_reset.mid_stop",
              },
              transitionDescriptions: {
                "alarm": "Alarm light, red light, blinking warning, error code on display",
                "no_heat": "Dryer is not heating, clothes still wet or damp after a full cycle",
                "mid_stop": "Dryer stops or shuts off in the middle of a cycle, turns off before finishing",
              },
              onInterruptFallback: "Describe what the dryer is doing 🔧",
            },
            allarme: {
              type: "ACTION",
              prompt: "To reset the alarm:\n👉 Press and hold the STOP button for 3 seconds.\n👉 Open the door, clean the lint filter, close the door.\n👉 Try starting again.",
              transitions: { default: "errore_reset.ask_resolved" },
            },
            non_scalda: {
              type: "ACTION",
              prompt: "First, check the lint filter — a clogged filter reduces heat.\n👉 Pull out the filter, remove lint, put it back.\n👉 Run a new cycle.\n\nIf it still doesn't heat, the heating element may need service. Please use another dryer.",
              transitions: { default: "errore_reset.ask_resolved" },
            },
            mid_stop: {
              type: "ACTION",
              prompt: "The dryer may have overheated (safety shut-off).\n👉 Wait 5 minutes for it to cool down.\n👉 Check and clean the lint filter.\n👉 Try starting again with a smaller load.",
              transitions: { default: "errore_reset.ask_resolved" },
            },
            ask_resolved: {
              type: "CONFIRMATION",
              prompt: "Did that solve the problem? (yes / no)",
              transitions: {
                YES: "errore_reset.end_success",
                NO: "errore_reset.handle_escalate",
              },
            },
            end_success: {
              type: "INFO",
              prompt: "Great! ✅ Your clothes will be dry soon 👍",
              isTerminal: true,
            },
            handle_escalate: {
              type: "INFO",
              prompt: "I understand 😔 I'm contacting an operator to help you.",
              isTerminal: true,
            },
          },
        },
    isActive: true,
  }
  await prisma.flowNodeConfig.upsert({
    where: { workspaceId_flowKey: { workspaceId: ecolaundryWorkspace.id, flowKey: "asciugatrice_ed340" } },
    update: dryerFlowData,
    create: { workspaceId: ecolaundryWorkspace.id, flowKey: "asciugatrice_ed340", ...dryerFlowData },
  })
  console.log("   ✅ FlowNodeConfig upserted: Dryer ED-340")

  // ── FlowNodeConfig #3: Router (History node — assigns machine via assignMachine()) ─────
  await prisma.flowNodeConfig.upsert({
    where: { workspaceId_flowKey: { workspaceId: ecolaundryWorkspace.id, flowKey: "router" } },
    update: {
      flowLabel: "Router - Asistente Ecolaundry",
      systemPrompt: ECOLAUNDRY_ROUTER_PROMPT,
      model: "openai/gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 1024,
      availableFunctions: JSON.parse(JSON.stringify(["assignMachine", "contactOperator", "resetSession"])),
      // flows contains available machine keys as metadata (no actual flow steps for the router)
      flows: { lavatrice_hs60xx: {}, asciugatrice_ed340: {} },
      isActive: true,
    },
    create: {
      workspaceId: ecolaundryWorkspace.id,
      flowKey: "router",
      flowLabel: "Router - Asistente Ecolaundry",
      systemPrompt: ECOLAUNDRY_ROUTER_PROMPT,
      model: "openai/gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 1024,
      availableFunctions: JSON.parse(JSON.stringify(["assignMachine", "contactOperator", "resetSession"])),
      flows: { lavatrice_hs60xx: {}, asciugatrice_ed340: {} },
      isActive: true,
    },
  })
  console.log("   ✅ FlowNodeConfig upserted: Router (History)")

  // WorkspaceCallingFunctions for Ecolaundry
  // FLOW workspaces use contactOperator (real escalation) — no agent delegates
  const ecoCallingFunctions = [
    {
      functionName: "contactOperator",
      description: "Contact human operator when the customer explicitly requests a human, or when the troubleshooting flow cannot resolve the issue.",
      parameters: { type: "object", properties: { reason: { type: "string", description: "Reason for contacting the operator" } }, required: ["reason"] },
      isSystemFunction: true,
      executionType: "CALLING_FUNCTION",
    },
    {
      functionName: "changeLanguage",
      description: "Change the customer's preferred language. Supported: Italian (it), English (en), Spanish (es), Portuguese (pt).",
      parameters: { type: "object", properties: { language: { type: "string", enum: ["it", "en", "es", "pt"], description: "ISO 639-1 language code" } }, required: ["language"] },
      isSystemFunction: true,
      executionType: "INTERNAL",
    },
    {
      functionName: "resetSession",
      description: "Reset the session when the customer realizes they picked the wrong machine type/number or explicitly wants to start over. Wipes flowKey, flowNumber, flowState and gatherState so the Router restarts from the beginning.",
      parameters: { type: "object", properties: {}, required: [] },
      isSystemFunction: true,
      executionType: "INTERNAL",
    },
  ]

  for (const func of ecoCallingFunctions) {
    await prisma.workspaceCallingFunction.create({
      data: {
        workspaceId: ecolaundryWorkspace.id,
        functionName: func.functionName,
        description: func.description,
        parameters: func.parameters,
        isSystemFunction: func.isSystemFunction,
        executionType: func.executionType,
        attachedLlm: (func as any).attachedLlm || null,
        isActive: true,
      },
    })
  }

  console.log(`✅ Ecolaundry FLOW workspace configured: 3 FlowNodeConfigs + ${ecoCallingFunctions.length} calling functions (contactOperator + changeLanguage + resetSession)`)

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

  // 6. Create Platform Configuration (Single Source of Truth)
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

  // 6c. Legal documents now served as static files from frontend/public/legal/
  // (no longer seeded from database)

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

  // 6.6 Create Types (Feature 179 + Transport Optimization)
  console.log("🚚 Creating types with prices...")

  // Types with prices (EUR, IVA inclusa)
  // Prices based on optimize-cart.md spec: Ambiente=8€, Refrigerato=12€, Frozen=15€
  const typesData = [
    { name: "Temperatura Ambiente", price: 8.00 },  // Ambient Temperature
    { name: "Refrigerato", price: 12.00 },           // Refrigerated
    { name: "Congelato", price: 15.00 },             // Frozen
  ]

  const typeMap = new Map<string, string>()

  for (const typeData of typesData) {
    const type = await prisma.type.create({
      data: {
        name: typeData.name,
        workspaceId: workspace.id,
        price: typeData.price,
        isActive: true,
      },
    })
    typeMap.set(typeData.name, type.id)
  }

  console.log(`✅ Created ${typesData.length} types with prices`)

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

    // ✅ Read region and type from source data (products.ts)
    const region = prod.region || null
    const type = prod.type || "Temperatura ambiente"

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
        workspaceId: workspace.id,
        imageUrl: prod.imageUrl || [],
        type: type,
        region: region,
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

    // ✅ Feature 179: Create ProductType pivot record
    // Map Italian types to English
    const typeMapping: Record<string, string> = {
      "Temperatura ambiente": "Ambient Temperature",
      "Trasporto refrigerato": "Refrigerated",
      "Refrigerato": "Refrigerated",
      "Trasporto congelato": "Frozen",
      "Congelato": "Frozen",
    }

    const englishType = typeMapping[type] || "Ambient Temperature"
    const typeId = typeMap.get(englishType)

    if (typeId) {
      await prisma.productType.create({
        data: {
          productId: product.id,
          typeId: typeId,
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
        category: faq.category,
        order: faq.order,
        isActive: faq.isActive,
      },
    })
  }

  console.log(`✅ Created ${defaultFaqList.length} FAQs (5 categories)`)

  // 📅 Create Calendar & Appointment Booking Test Data
  console.log("📅 Creating appointment booking test data...")

  // Update workspace with timezone and reminder settings
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { 
      timezone: "Europe/Rome", // IANA timezone for IT workspace
      // Three reminder templates for different timing intervals
      appointmentReminder24hEnabled: true,
      appointmentReminder24hMessage: `Ciao {{customerName}}, ti ricordo appuntamento di {{appointmentType}} il giorno: {{appointmentDate}} alle ore: {{appointmentTime}}

Confermi la tua presenza?`,
      appointmentReminder1hEnabled: true,
      appointmentReminder1hMessage: `Ciao {{customerName}}, tra 1 ora inizia il tuo appuntamento di {{appointmentType}} alle {{appointmentTime}}. Ti aspettiamo!`,
      appointmentReminder30mEnabled: false, // Disabled by default - owner can enable in settings
      appointmentReminder30mMessage: `Ciao {{customerName}}, tra 30 minuti inizia il tuo appuntamento di {{appointmentType}} alle {{appointmentTime}}. Ci vediamo!`,
      appointmentReminderChannel: "whatsapp" // Send via WhatsApp (€0.50/reminder)
    }
  })


  // 1. Create AppointmentTypes
  const appointmentTypes = [
    {
      name: "Consulenza Legale",
      description: "Consulenza legale con avvocato specializzato (60 minuti)",
      duration: 60,
      bufferTime: 15, // 15 min cleanup between appointments
      price: 150.00,
      color: "#3b82f6" // Blue
    },
    {
      name: "Fisioterapia",
      description: "Sessione di fisioterapia e riabilitazione (45 minuti)",
      duration: 45,
      bufferTime: 10,
      price: 80.00,
      color: "#10b981" // Green
    },
    {
      name: "Check-up Medico",
      description: "Visita medica completa con analisi (90 minuti)",
      duration: 90,
      bufferTime: 20,
      price: 200.00,
      color: "#ef4444" // Red
    }
  ]

  for (const type of appointmentTypes) {
    if ((prisma as any).appointmentType) {
      await (prisma as any).appointmentType.create({
        data: {
          workspaceId: workspace.id,
          ...type
        }
      })
    }
  }

  console.log(`   ✅ Created ${appointmentTypes.length} appointment types`)

  // 2. Create WorkspaceBusinessHours (Monday-Friday 09:00-17:00, Saturday 09:00-13:00)
  const businessHours = [
    { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, // Monday
    { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" }, // Tuesday
    { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }, // Wednesday
    { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Thursday
    { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }, // Friday
    { dayOfWeek: 6, startTime: "09:00", endTime: "13:00" }  // Saturday (half day)
  ]

  for (const hours of businessHours) {
    await prisma.workspaceBusinessHours.create({
      data: {
        workspaceId: workspace.id,
        ...hours
      }
    })
  }

  console.log(`   ✅ Created ${businessHours.length} business hour records`)

  // 3. Create BlackoutPeriod (Summer holidays: August 15-31, 2026)
  const blackoutPeriod = {
    startDate: new Date('2026-08-15T00:00:00Z'),
    endDate: new Date('2026-08-31T23:59:59Z'),
    reason: "Vacanze estive 2026"
  }

  await prisma.blackoutPeriod.create({
    data: {
      workspaceId: workspace.id,
      ...blackoutPeriod
    }
  })

  console.log(`   ✅ Created blackout period (${blackoutPeriod.reason})`)
  console.log(`   📅 Appointment booking ready (3 types, Mon-Sat hours, 1 blackout)`)

  // 9.5. Seed appointment calling functions for ALL workspaces
  // (filtered at runtime by enableCalendarBooking flag)
  const appointmentCallingFunctions = [
    {
      functionName: "listAvailableSlots",
      description: "Show available slots for appointment booking. Use when customer wants to book an appointment, asks about availability.",
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string", description: "ID of the service to book (optional - auto-selected if only one service exists)" },
          daysAhead: { type: "number", description: "How many days ahead to search (default 7, max 14). Ignored when targetDate is specified." },
          targetDate: { type: "string", description: "Specific date in YYYY-MM-DD format. Use when customer asks for availability on a specific day (e.g. next Thursday, this Friday). Example: 2026-04-17" }
        },
        required: []
      },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true
    },
    {
      functionName: "bookAppointment",
      description: "Confirm an appointment booking. Use when customer has chosen a slot and confirms. Requires appointmentTypeId and startTime.",
      parameters: {
        type: "object",
        properties: {
          appointmentTypeId: { type: "string", description: "ID of appointment type" },
          startTime: { type: "string", description: "Start time in ISO 8601 format" },
          customerNotes: { type: "string", description: "Optional customer notes" }
        },
        required: ["appointmentTypeId", "startTime"]
      },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true
    },
    {
      functionName: "cancelAppointment",
      description: "Cancel an existing appointment. Use when customer wants to cancel a booked appointment.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: { type: "string", description: "ID of appointment to cancel" },
          reason: { type: "string", description: "Cancellation reason (optional)" }
        },
        required: ["appointmentId"]
      },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true
    },
    {
      functionName: "getCustomerAppointments",
      description: "Show customer's upcoming appointments. Use when customer asks about their bookings.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true
    },
    {
      functionName: "rescheduleAppointment",
      description: "Reschedule an existing appointment to a new time. Use when customer wants to move their appointment to a different slot.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: { type: "string", description: "ID of appointment to reschedule" },
          newStartTime: { type: "string", description: "New start time in ISO 8601 format" },
          reason: { type: "string", description: "Reason for rescheduling (optional)" }
        },
        required: ["appointmentId", "newStartTime"]
      },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true
    }
  ]

  for (const ws of [ecommerceWorkspace, infoWorkspace]) {
    for (const fn of appointmentCallingFunctions) {
      await prisma.workspaceCallingFunction.upsert({
        where: {
          workspaceId_functionName: {
            workspaceId: ws.id,
            functionName: fn.functionName
          }
        },
        update: {},
        create: {
          workspaceId: ws.id,
          ...fn
        }
      })
    }
  }

  console.log(`   ✅ Seeded ${appointmentCallingFunctions.length} appointment functions for both workspaces`)

  // 9b. Seed changeLanguage system function for all workspaces
  for (const ws of [ecommerceWorkspace, infoWorkspace]) {
    await prisma.workspaceCallingFunction.upsert({
      where: {
        workspaceId_functionName: {
          workspaceId: ws.id,
          functionName: "changeLanguage"
        }
      },
      update: {},
      create: {
        workspaceId: ws.id,
        functionName: "changeLanguage",
        description: "Change the customer's preferred language. Supported: Italian (it), English (en), Spanish (es), Portuguese (pt).",
        parameters: {
          type: "object",
          properties: {
            language: { type: "string", enum: ["it", "en", "es", "pt"], description: "ISO 639-1 language code" }
          },
          required: ["language"]
        },
        isSystemFunction: true,
        executionType: "INTERNAL",
        isActive: true
      }
    })
  }
  console.log("   ✅ Seeded changeLanguage function for both workspaces")

  // 9c. Seed ALWAYS_AVAILABLE system functions (both workspaces)
  //     These were previously created by syncSystemFunctionsOnStartup on every server start.
  //     Now that startup sync is removed, the seed must create them explicitly.
  const alwaysAvailableFunctions = [
    {
      functionName: "customerSupportAgent",
      description: "Delegate to Customer Support Agent for complaints, issues, human operator contact. Use when customer is frustrated or has problems. NOT for notification management.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Support request" } }, required: ["query"] },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      attachedLlm: "CUSTOMER_SUPPORT",
      isActive: true,
    },
    {
      functionName: "profileManagementAgent",
      description: "Delegate to Profile Management Agent for email updates, notification preferences, profile data changes. Use for notification subscribe/unsubscribe, email change.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Profile-related request" } }, required: ["query"] },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      attachedLlm: "PROFILE_MANAGEMENT",
      isActive: true,
    },
    {
      functionName: "manageNotifications",
      description: "Manage push notification preferences (subscribe/unsubscribe).",
      parameters: { type: "object", properties: { action: { type: "string", enum: ["subscribe", "unsubscribe"], description: "Action to perform" } }, required: ["action"] },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true,
    },
  ]

  for (const ws of [ecommerceWorkspace, infoWorkspace]) {
    for (const fn of alwaysAvailableFunctions) {
      await prisma.workspaceCallingFunction.upsert({
        where: { workspaceId_functionName: { workspaceId: ws.id, functionName: fn.functionName } },
        update: {},
        create: { workspaceId: ws.id, ...fn }
      })
    }
  }
  console.log(`   ✅ Seeded ${alwaysAvailableFunctions.length} always-available functions for both workspaces`)

  // 9d. Seed ECOMMERCE-ONLY calling functions (ecommerce workspace only)
  const ecommerceFunctions = [
    {
      functionName: "productSearchAgent",
      description: "Delegate to Product Search Agent for product catalog browsing, search, filters. Use when customer asks about products, prices, categories, certifications.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Customer's product search query" } }, required: ["query"] },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      attachedLlm: "PRODUCT_SEARCH",
      isActive: true,
    },
    {
      functionName: "cartManagementAgent",
      description: "Delegate to Cart Management Agent for add/remove products, view cart, modify quantities. Use when customer wants to add to cart or modify cart contents.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Cart-related request" } }, required: ["query"] },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      attachedLlm: "CART_MANAGEMENT",
      isActive: true,
    },
    {
      functionName: "orderTrackingAgent",
      description: "Delegate to Order Tracking Agent for order history, tracking, checkout confirmation. Use for orders, delivery status, checkout.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Order-related question" } }, required: ["query"] },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      attachedLlm: "ORDER_TRACKING",
      isActive: true,
    },
  ]

  for (const fn of ecommerceFunctions) {
    await prisma.workspaceCallingFunction.upsert({
      where: { workspaceId_functionName: { workspaceId: ecommerceWorkspace.id, functionName: fn.functionName } },
      update: {},
      create: { workspaceId: ecommerceWorkspace.id, ...fn }
    })
  }
  console.log(`   ✅ Seeded ${ecommerceFunctions.length} ecommerce-only functions for ecommerce workspace`)

  // 10. Create Campaigns
  console.log("📢 Creating campaigns...")

  for (const campaign of campaigns) {
    try {
      await (prisma as any).pushCampaign.create({
        data: {
          workspaceId: ecommerceWorkspace.id,
          name: campaign.name,
          message: campaign.messagePreview,
          status: "DRAFT",
          targetingType: campaign.targetType === "ALL" ? "ALL" : "MANUAL",
          targetCustomerIds: campaign.customerIds || [],
          templateId: campaign.templateName,
          bodyPreview: campaign.messagePreview,
          lastRunAt: campaign.lastRunAt ? new Date(campaign.lastRunAt) : null,
        },
      })
    } catch (e) {
      console.warn(`⚠️  Failed to create campaign ${campaign.name}:`, (e as Error).message)
    }
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
      email: adminEmail, // Use admin email from env var
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

  // 🧪 PLAYGROUND TEST CUSTOMER
  console.log("🧪 Creating Playground test customer...")
  const playgroundCustomer = await prisma.customers.create({
    data: {
      name: "Test Customer (Playground)",
      email: "playground@test.echatbot.local",
      phone: "+39 999 1234567", // Fake non-real test number
      language: "IT",
      company: "Playground Test Company",
      address: JSON.stringify({
        name: "Test Customer",
        street: "Via Test 999",
        city: "Test City",
        postalCode: "99999",
        country: "Italia",
      }),
      workspaceId: workspace.id,
      salesId: createdSalesReps[0].id, // Assign first sales rep
      isActive: true,
      isBlacklisted: false,
      activeChatbot: true,
      currency: "EUR",
      discount: 0,
      push_notifications_consent: false,
      push_notifications_consent_at: null,
      last_privacy_version_accepted: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log(`✅ Created Playground test customer: ${playgroundCustomer.phone}`)

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

        // ❌ REMOVED: product_searches table dropped (was filling DB with 40k+ records)
        // Analytics now handled in-memory via ProductAnalyticsService
        // await prisma.productSearch.create({ ... })

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
  const messageCost = 0.15
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
  console.log(`⚠️  Channel billing removed (included in subscription plans)`)
  console.log(`   - Real billing starts when workspace is activated`)

  // 10. Create PUSH_CAMPAIGN billing (€1.00) for advertising push notifications
  console.log("\n� Creating push campaign billing (advertising)...")

  // Re-fetch all customers for push billing
  const customersForPush = await prisma.customers.findMany({
    where: { workspaceId: workspace.id },
  })

  const pushCampaignCost = 1.0
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

    // 🆕 Widget test messages (channel="widget")
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId: workspace.id,
        customerId: queueCustomers[0].id,
        phoneNumber: "",
        messageContent: "Ciao! Vorrei informazioni sui prodotti",
        status: "pending",
        channel: "widget",
        visitorId: "visitor_1726262000000_a7k2m9x1",
        isAnonymous: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 hours
        pollingAttempts: 0,
        createdAt: new Date(Date.now() - 30000), // 30 seconds ago
      },
    })

    await prisma.whatsAppQueue.create({
      data: {
        workspaceId: workspace.id,
        customerId: queueCustomers[1].id,
        phoneNumber: "",
        messageContent: "Quali sono le offerte attive?",
        status: "sent",
        channel: "widget",
        visitorId: "visitor_1726262001000_b8l3n0y2",
        isAnonymous: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        responsePayload: {
          response: "Abbiamo diverse offerte attive! Ti consiglio di dare un'occhiata alla sezione Offerte.",
          processedAt: new Date(Date.now() - 60000),
        },
        pollingAttempts: 5,
        lastPolledAt: new Date(Date.now() - 5000), // 5 seconds ago
        deliveredAt: new Date(Date.now() - 60000), // 1 minute ago
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
      },
    })

    console.log("✅ Created 2 widget test messages:")
    console.log("   - 1 pending widget message")
    console.log("   - 1 sent widget message with response")
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
      maxProducts: 9999,
      maxCustomers: 50,
      maxTeamMembers: 0,
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
      reminderCost: 0.50,
      lowBalanceThreshold: 5.00,
      trialDays: 14,
      initialCredit: 22.00,
      features: JSON.stringify([
        "14 giorni di prova gratuita",
        "€22 di credito iniziale",
        "1 canale WhatsApp",
        "50 clienti",
      ]),
    },
    {
      planType: "BASIC" as const,
      displayName: "Basic",
      monthlyFee: 22.00,
      maxChannels: 1,
      maxProducts: 9999,
      maxCustomers: 50,
      maxTeamMembers: 0,
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
      reminderCost: 0.50,
      lowBalanceThreshold: 5.00,
      trialDays: 0,
      initialCredit: 0,
      features: JSON.stringify([
        "1 canale WhatsApp",
        "50 clienti",
        "Multi-language support",
        "Analytics dashboard",
      ]),
    },
    {
      planType: "PREMIUM" as const,
      displayName: "Premium",
      monthlyFee: 45.00,
      maxChannels: 2,
      maxProducts: 9999,
      maxCustomers: 100,
      maxTeamMembers: 3,
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
      reminderCost: 0.50,
      lowBalanceThreshold: 5.00,
      trialDays: 0,
      initialCredit: 0,
      features: JSON.stringify([
        "2 canali WhatsApp",
        "100 clienti",
        "Multi-language support",
        "Analytics avanzati",
        "Brand customization",
        "Priority support",
        "Team members illimitati",
      ]),
    },
    {
      planType: "ENTERPRISE" as const,
      displayName: "Enterprise",
      monthlyFee: 160.00,
      maxChannels: 999, // Unlimited
      maxProducts: 9999, // Unlimited
      maxCustomers: 9999, // Unlimited
      maxTeamMembers: null,
      messageCost: 0.10,
      orderCost: 1.00,
      pushCost: 1.00,
      reminderCost: 0.50,
      lowBalanceThreshold: 10.00,
      trialDays: 0,
      initialCredit: 0,
      features: JSON.stringify([
        "Canali illimitati",
        "Clienti illimitati",
        "Sconti volume sui costi",
        "Server dedicato",
        "CRM integrato",
        "Support 24/7",
        "Account manager dedicato",
        "Team members illimitati",
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
  // BILLING TRANSACTIONS - Realistic history with INDIVIDUAL transactions
  // In production, each message/push creates a single transaction
  // Frontend aggregates by day+channel for display
  // NOTE: Monthly subscription fees are billed separately (not from credit balance)
  // ============================================================================

  let runningBalance = 0

  // September 5, 2025: User signs up with Free Trial ($22)
  runningBalance = 22.00
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 22.00,
      balanceAfter: runningBalance,
      description: "Initial credit - Free Trial",
      createdAt: new Date(2025, 8, 5, 10, 0, 0),
    },
  })

  // September 15: First recharge +$30
  runningBalance += 30.00
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 30.00,
      balanceAfter: runningBalance,
      description: "Credit recharge +$30",
      createdAt: new Date(2025, 8, 15, 14, 30, 0),
    },
  })

  // September 20: 5 individual WhatsApp messages (BellItalia VIP) - $0.10 each
  for (let i = 0; i < 5; i++) {
    runningBalance -= 0.10
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: workspace.id } },
        user: { connect: { id: adminUser.id } },
        type: "MESSAGE",
        amount: -0.10,
        balanceAfter: runningBalance,
        description: "WhatsApp message",
        createdAt: new Date(2025, 8, 20, 10 + i, 15, 0), // Sep 20, different hours
      },
    })
  }

  // October 15: 3 Push notifications (BellItalia VIP) - $1.00 each
  for (let i = 0; i < 3; i++) {
    runningBalance -= 1.00
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: workspace.id } },
        user: { connect: { id: adminUser.id } },
        type: "PUSH_NOTIFICATION",
        amount: -1.00,
        balanceAfter: runningBalance,
        description: "Push notification",
        createdAt: new Date(2025, 9, 15, 9 + i, 0, 0), // Oct 15
      },
    })
  }

  // October 20: 10 WhatsApp messages (BellItalia) - $0.10 each
  for (let i = 0; i < 10; i++) {
    runningBalance -= 0.10
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: infoWorkspace.id } }, // Different channel!
        user: { connect: { id: adminUser.id } },
        type: "MESSAGE",
        amount: -0.10,
        balanceAfter: runningBalance,
        description: "WhatsApp message",
        createdAt: new Date(2025, 9, 20, 8 + Math.floor(i / 2), i * 5, 0), // Oct 20
      },
    })
  }

  // November 1: Credit recharge +$50
  runningBalance += 50.00
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 50.00,
      balanceAfter: runningBalance,
      description: "Credit recharge +$50",
      createdAt: new Date(2025, 10, 1, 8, 0, 0),
    },
  })

  // November 10: 5 Push notifications each channel (10 total) - same day, different channels
  for (let i = 0; i < 5; i++) {
    runningBalance -= 1.00
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: workspace.id } }, // BellItalia VIP
        user: { connect: { id: adminUser.id } },
        type: "PUSH_NOTIFICATION",
        amount: -1.00,
        balanceAfter: runningBalance,
        description: "Push notification",
        createdAt: new Date(2025, 10, 10, 9, i * 10, 0), // Nov 10, morning
      },
    })
  }
  for (let i = 0; i < 5; i++) {
    runningBalance -= 1.00
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: infoWorkspace.id } }, // BellItalia (different channel!)
        user: { connect: { id: adminUser.id } },
        type: "PUSH_NOTIFICATION",
        amount: -1.00,
        balanceAfter: runningBalance,
        description: "Push notification",
        createdAt: new Date(2025, 10, 10, 14, i * 10, 0), // Nov 10, afternoon
      },
    })
  }

  // November 20: 8 WhatsApp messages (BellItalia VIP)
  for (let i = 0; i < 8; i++) {
    runningBalance -= 0.10
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: workspace.id } },
        user: { connect: { id: adminUser.id } },
        type: "MESSAGE",
        amount: -0.10,
        balanceAfter: runningBalance,
        description: "WhatsApp message",
        createdAt: new Date(2025, 10, 20, 10, i * 5, 0), // Nov 20
      },
    })
  }

  // December 1: Credit recharge +$100
  runningBalance += 100.00
  await prisma.billingTransaction.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: adminUser.id } },
      type: "RECHARGE",
      amount: 100.00,
      balanceAfter: runningBalance,
      description: "Credit recharge +$100",
      createdAt: new Date(2025, 11, 1, 8, 0, 0),
    },
  })

  // December 5: 15 WhatsApp messages (BellItalia VIP) + 10 Push (BellItalia) - same day!
  for (let i = 0; i < 15; i++) {
    runningBalance -= 0.10
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: workspace.id } },
        user: { connect: { id: adminUser.id } },
        type: "MESSAGE",
        amount: -0.10,
        balanceAfter: runningBalance,
        description: "WhatsApp message",
        createdAt: new Date(2025, 11, 5, 9, i * 3, 0), // Dec 5
      },
    })
  }
  for (let i = 0; i < 10; i++) {
    runningBalance -= 1.00
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: infoWorkspace.id } }, // BellItalia
        user: { connect: { id: adminUser.id } },
        type: "PUSH_NOTIFICATION",
        amount: -1.00,
        balanceAfter: runningBalance,
        description: "Push notification",
        createdAt: new Date(2025, 11, 5, 14, i * 5, 0), // Dec 5, afternoon
      },
    })
  }

  // Today: 3 WhatsApp messages (BellItalia VIP) + 2 Push (BellItalia VIP) + 3 Push (BellItalia)
  const today = new Date()
  for (let i = 0; i < 3; i++) {
    runningBalance -= 0.10
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: workspace.id } },
        user: { connect: { id: adminUser.id } },
        type: "MESSAGE",
        amount: -0.10,
        balanceAfter: runningBalance,
        description: "WhatsApp message",
        createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, i * 15, 0),
      },
    })
  }
  // Push from BellItalia VIP
  for (let i = 0; i < 2; i++) {
    runningBalance -= 1.00
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: workspace.id } }, // BellItalia VIP
        user: { connect: { id: adminUser.id } },
        type: "PUSH_NOTIFICATION",
        amount: -1.00,
        balanceAfter: runningBalance,
        description: "Push notification",
        createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, i * 30, 0),
      },
    })
  }
  // Push from BellItalia (different channel, same day!)
  for (let i = 0; i < 3; i++) {
    runningBalance -= 1.00
    await prisma.billingTransaction.create({
      data: {
        workspace: { connect: { id: infoWorkspace.id } }, // BellItalia (different!)
        user: { connect: { id: adminUser.id } },
        type: "PUSH_NOTIFICATION",
        amount: -1.00,
        balanceAfter: runningBalance,
        description: "Push notification",
        createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, i * 20, 0),
      },
    })
  }

  // Update user's credit balance to match
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { creditBalance: runningBalance },
  })

  // ============================================================================
  // INVOICE_PAID transactions - Monthly plan payments (NOT affecting credit balance!)
  // These show in Transaction History but DON'T change the counter
  // ============================================================================

  // October 1: Plan payment for September
  await prisma.billingTransaction.create({
    data: {
      user: { connect: { id: adminUser.id } },
      type: "INVOICE_PAID",
      amount: 0, // Does NOT affect credit balance
      balanceAfter: 52.00, // Balance at that time (after Sep recharges, before Oct usage)
      description: "Monthly plan PREMIUM - September 2025",
      createdAt: new Date(2025, 9, 1, 9, 0, 0), // Oct 1, 2025
    },
  })

  // November 1: Plan payment for October  
  await prisma.billingTransaction.create({
    data: {
      user: { connect: { id: adminUser.id } },
      type: "INVOICE_PAID",
      amount: 0, // Does NOT affect credit balance
      balanceAfter: 43.50, // Balance at that time
      description: "Monthly plan PREMIUM - October 2025",
      createdAt: new Date(2025, 10, 1, 9, 0, 0), // Nov 1, 2025
    },
  })

  // December 1: Plan payment for November
  await prisma.billingTransaction.create({
    data: {
      user: { connect: { id: adminUser.id } },
      type: "INVOICE_PAID",
      amount: 0, // Does NOT affect credit balance
      balanceAfter: 88.50, // Balance at that time (after Nov recharge)
      description: "Monthly plan PREMIUM - November 2025",
      createdAt: new Date(2025, 11, 1, 9, 0, 0), // Dec 1, 2025
    },
  })

  // January 1, 2026: Plan payment for December
  await prisma.billingTransaction.create({
    data: {
      user: { connect: { id: adminUser.id } },
      type: "INVOICE_PAID",
      amount: 0, // Does NOT affect credit balance
      balanceAfter: 175.20, // Balance at that time
      description: "Monthly plan PREMIUM - December 2025",
      createdAt: new Date(2026, 0, 1, 9, 0, 0), // Jan 1, 2026
    },
  })

  console.log(`✅ Created billing transactions with individual records (final balance: $${runningBalance.toFixed(2)})`)

  // ============================================================================
  // MONTHLY INVOICES - Past paid invoices
  // ============================================================================
  console.log("🧾 Creating monthly invoices...")

  const paidHistoryMonths = [
    { month: 7, year: 2025, usage: 4.2, total: 49.2, paidAt: new Date(2025, 7, 1, 9, 10, 0) },
    { month: 8, year: 2025, usage: 6.4, total: 51.4, paidAt: new Date(2025, 8, 1, 9, 5, 0) },
    { month: 9, year: 2025, usage: 5.6, total: 50.6, paidAt: new Date(2025, 9, 1, 9, 12, 0) },
  ]

  const historicalInvoices: Array<{
    id: string
    periodMonth: number
    periodYear: number
    totalAmount: number
    paidAt: Date
  }> = []

  for (const entry of paidHistoryMonths) {
    const created = await prisma.monthlyInvoice.create({
      data: {
        user: { connect: { id: adminUser.id } },
        periodStart: new Date(entry.year, entry.month - 1, 1, 0, 0, 0),
        periodEnd: new Date(entry.year, entry.month, 0, 23, 59, 59),
        periodMonth: entry.month,
        periodYear: entry.year,
        subscriptionAmount: 45.00,
        creditUsage: entry.usage,
        creditDebt: 0,
        totalAmount: entry.total,
        status: "PAID",
        paidAt: entry.paidAt,
        planType: "PREMIUM",
        itemsBreakdown: {
          messages: Math.round(entry.usage * 10),
          orders: Math.max(1, Math.round(entry.usage)),
          pushNotifications: 1,
        },
      },
    })
    await ensureInvoiceNumber(created)
    historicalInvoices.push({
      id: created.id,
      periodMonth: created.periodMonth,
      periodYear: created.periodYear,
      totalAmount: Number(created.totalAmount),
      paidAt: created.paidAt as Date,
    })
  }

  // October 2025 Invoice (PAID)
  const octoberInvoice = await prisma.monthlyInvoice.create({
    data: {
      user: { connect: { id: adminUser.id } },
      periodStart: new Date(2025, 9, 1, 0, 0, 0),
      periodEnd: new Date(2025, 9, 31, 23, 59, 59),
      periodMonth: 10,
      periodYear: 2025,
      subscriptionAmount: 45.00,
      creditUsage: 5.00,
      creditDebt: 0,
      totalAmount: 50.00,
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
  await ensureInvoiceNumber(octoberInvoice)

  // November 2025 Invoice (PAID)
  const novemberInvoice = await prisma.monthlyInvoice.create({
    data: {
      user: { connect: { id: adminUser.id } },
      periodStart: new Date(2025, 10, 1, 0, 0, 0),
      periodEnd: new Date(2025, 10, 30, 23, 59, 59),
      periodMonth: 11,
      periodYear: 2025,
      subscriptionAmount: 45.00,
      creditUsage: 3.50,
      creditDebt: 0,
      totalAmount: 48.50,
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
  await ensureInvoiceNumber(novemberInvoice)

  // December 2025 Invoice (PENDING - ready for payment)
  const decemberInvoice = await prisma.monthlyInvoice.create({
    data: {
      user: { connect: { id: adminUser.id } },
      periodStart: new Date(2025, 11, 1, 0, 0, 0),
      periodEnd: new Date(2025, 11, 31, 23, 59, 59),
      periodMonth: 12,
      periodYear: 2025,
      subscriptionAmount: 45.00,
      creditUsage: 2.60,
      creditDebt: 0,
      totalAmount: 47.60,
      status: "PENDING",
      planType: "PREMIUM",
      adminNotes: "Check credit note before payment",
      itemsBreakdown: {
        messages: 26,
        orders: 2,
        pushNotifications: 0,
      },
    },
  })
  await ensureInvoiceNumber(decemberInvoice)

  console.log("✅ Created 3 monthly invoices (Oct, Nov, Dec 2025)")

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  if (!(currentYear === 2025 && currentMonth === 12)) {
    const currentPeriodStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0)
    const currentPeriodEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59)

    const currentInvoice = await prisma.monthlyInvoice.create({
      data: {
        user: { connect: { id: adminUser.id } },
        periodStart: currentPeriodStart,
        periodEnd: currentPeriodEnd,
        periodMonth: currentMonth,
        periodYear: currentYear,
        subscriptionAmount: 45.00,
        creditUsage: 4.20,
        creditDebt: 0,
        totalAmount: 49.20,
        status: "DRAFT",
        planType: "PREMIUM",
        adminNotes: "Current month review pending",
        itemsBreakdown: {
          messages: 42,
          orders: 3,
          pushNotifications: 1,
        },
      },
    })
    await ensureInvoiceNumber(currentInvoice)

    // Current month stays clean; credit notes are managed only after payment in History.
  }

  const previousDate = new Date(currentYear, currentMonth - 2, 1)
  const previousMonth = previousDate.getMonth() + 1
  const previousYear = previousDate.getFullYear()

  const existingPreviousInvoice = await prisma.monthlyInvoice.findFirst({
    where: {
      userId: adminUser.id,
      periodMonth: previousMonth,
      periodYear: previousYear,
    },
  })

  if (!existingPreviousInvoice) {
    const previousInvoice = await prisma.monthlyInvoice.create({
      data: {
        user: { connect: { id: adminUser.id } },
        periodStart: new Date(previousYear, previousMonth - 1, 1, 0, 0, 0),
        periodEnd: new Date(previousYear, previousMonth, 0, 23, 59, 59),
        periodMonth: previousMonth,
        periodYear: previousYear,
        subscriptionAmount: 45.00,
        creditUsage: 6.75,
        creditDebt: 0,
        totalAmount: 51.75,
        status: "PENDING",
        planType: "PREMIUM",
        itemsBreakdown: {
          messages: 60,
          orders: 6,
          pushNotifications: 1,
        },
      },
    })

    await prisma.invoiceAdjustment.create({
      data: {
        invoiceId: previousInvoice.id,
        userId: adminUser.id,
        amount: -5.25,
        reason: "Manual discount",
        createdById: adminUser.id,
        createdByEmail: adminUser.email,
        createdAt: new Date(previousYear, previousMonth, 2, 9, 30, 0),
      },
    })
    await ensureInvoiceNumber(previousInvoice)
  }

  await prisma.invoiceCreditNote.create({
    data: {
      invoiceId: novemberInvoice.id,
      userId: adminUser.id,
      amount: 5.00,
      reason: "Goodwill adjustment",
      createdById: adminUser.id,
      createdByEmail: adminUser.email,
      createdAt: new Date(2025, 11, 10, 9, 30, 0),
    },
  })

  const failedDate = new Date(currentYear, currentMonth - 3, 1)
  const failedMonth = failedDate.getMonth() + 1
  const failedYear = failedDate.getFullYear()
  const existingFailedInvoice = await prisma.monthlyInvoice.findFirst({
    where: {
      userId: adminUser.id,
      periodMonth: failedMonth,
      periodYear: failedYear,
    },
  })

  if (!existingFailedInvoice) {
    const failedInvoice = await prisma.monthlyInvoice.create({
      data: {
        user: { connect: { id: adminUser.id } },
        periodStart: new Date(failedYear, failedMonth - 1, 1, 0, 0, 0),
        periodEnd: new Date(failedYear, failedMonth, 0, 23, 59, 59),
        periodMonth: failedMonth,
        periodYear: failedYear,
        subscriptionAmount: 45.00,
        creditUsage: 4.10,
        creditDebt: 0,
        totalAmount: 49.10,
        status: "FAILED",
        planType: "PREMIUM",
        adminNotes: "Failed payment - retry later",
        itemsBreakdown: {
          messages: 41,
          orders: 4,
          pushNotifications: 0,
        },
      },
    })
    await ensureInvoiceNumber(failedInvoice)
  }

  await prisma.monthlyInvoice.update({
    where: { id: novemberInvoice.id },
    data: {
      adminNotes: "Paid after retry",
    },
  })

  // ============================================================================
  // PAYPAL TRANSACTIONS - Sample history
  // ============================================================================
  console.log("💳 Creating PayPal transactions...")

  const historyTransactions = historicalInvoices.map((invoice) => ({
    userId: adminUser.id,
    adminUserId: adminUser.id,
    invoiceId: invoice.id,
    amount: Number(invoice.totalAmount),
    currency: "EUR",
    status: "SUCCESS" as const,
    notes: `Invoice ${String(invoice.periodMonth).padStart(2, "0")}/${invoice.periodYear} paid`,
    createdAt: invoice.paidAt,
  }))

  await prisma.payPalTransaction.createMany({
    data: [
      ...historyTransactions,
      {
        userId: adminUser.id,
        adminUserId: adminUser.id,
        invoiceId: octoberInvoice.id,
        amount: 50.00,
        currency: "EUR",
        status: "SUCCESS" as const,
        notes: "October invoice paid",
        createdAt: new Date(2025, 10, 1, 10, 5, 0),
      },
      {
        userId: adminUser.id,
        adminUserId: adminUser.id,
        invoiceId: novemberInvoice.id,
        amount: 48.50,
        currency: "EUR",
        status: "FAILED" as const,
        notes: "Card declined - retry scheduled",
        createdAt: new Date(2025, 11, 1, 10, 2, 0),
      },
      {
        userId: adminUser.id,
        adminUserId: adminUser.id,
        invoiceId: novemberInvoice.id,
        amount: 48.50,
        currency: "EUR",
        status: "SUCCESS" as const,
        notes: "November invoice paid on retry",
        createdAt: new Date(2025, 11, 2, 9, 15, 0),
      },
      {
        userId: adminUser.id,
        adminUserId: adminUser.id,
        invoiceId: decemberInvoice.id,
        amount: 47.60,
        currency: "EUR",
        status: "FAILED" as const,
        notes: "Insufficient funds",
        createdAt: new Date(2025, 11, 31, 18, 40, 0),
      },
      {
        userId: adminUser.id,
        adminUserId: adminUser.id,
        invoiceId: null,
        amount: 12.00,
        currency: "EUR",
        status: "SUCCESS" as const,
        notes: "Manual adjustment",
        createdAt: new Date(2025, 11, 20, 15, 5, 0),
      },
    ],
  })

  console.log("✅ Created PayPal transaction history")

  // Seed Scheduler Job Status (all jobs active by default)
  console.log("⏰ Creating scheduler job status...")

  const schedulerJobs = [
    {
      jobName: "whatsapp-channel-queue",
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
      isActive: isProduction, // ⚠️ ONLY active in production (cleanup Cloudinary)
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
      jobName: "support-attachments-cleanup",
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
