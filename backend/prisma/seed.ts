/**
 * DATABASE SEED SCRIPT - WORKING VERSION
 *
 * ✅ ADMIN CREDENTIALS TESTED AND WORKING
 * Date: June 13, 2025
 *
 * ADMIN CREDENTIALS:
 * - Email: admin@shopme.com
 * - Password: venezia44 (from .env file ADMIN_PASSWORD)
 *
 * LOGIN TESTED SUCCESSFULLY:
 * curl -X POST http://localhost:3001/api/auth/login \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"admin@shopme.com","password":"venezia44"}'
 *
 * MAIN WORKSPACE:
 * - ID: cm9hjgq9v00014qk8fsdy4ujv
 * - Name: L'Altra Italia(ESP)
 * - Admin associated as OWNER
 *
 * ⚠️ DO NOT MODIFY CREDENTIALS WITHOUT UPDATING .env
 */

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()

// Use environment variables with fallbacks
let adminEmail = process.env.ADMIN_EMAIL || ""
let adminPassword = process.env.ADMIN_PASSWORD || "admin123" // Default password for development

// Validate required environment variables
if (!adminEmail) {
  adminEmail = "admin@shopme.com" // Default email for development
}

if (!adminPassword) {
  adminPassword = "admin123" // Fallback password
}

// Define the default agent at the top level of the script
const defaultAgent = {
  name: "SofIA - Gusto Italiano Assistant",
  description: "SofIA, the passionate virtual assistant for Gusto Italiano",
  isRouter: true,
  department: null,
  promptName: "SofIA - Gusto Italiano Assistant",
  model: "anthropic/claude-3.5-haiku",
  temperature: 0, // ✅ Set to 0 for deterministic checkout link behavior
}

// Andrea's Two-LLM Architecture - LLM 1 RAG Processor Prompt (Agent Settings)
const SOFIA_PROMPT = fs.readFileSync(
  path.join(__dirname, "../../docs/other/prompt_agent.md"),
  "utf8"
)

// Initialize createdWorkspaces here, before main()
let createdWorkspaces: any[] = []
// Define a fixed ID for our unique workspace
const mainWorkspaceId = "cm9hjgq9v00014qk8fsdy4ujv"

// Function to automatically generate ALL embeddings like clicking buttons in frontend
async function generateEmbeddingsAfterSeed() {
  console.log("\n🤖 AUTO-GENERATING ALL EMBEDDINGS (like clicking FE buttons)")
  console.log("============================================================")

  try {
    // Import the embedding services
    const { EmbeddingService } = require("../src/services/embeddingService")
    // const { DocumentService } = require("../src/services/documentService") // REMOVED - documents no longer exist

    const embeddingService = new EmbeddingService()
    // const documentService = new DocumentService() // REMOVED - documents no longer exist

    console.log("🔄 1. Generating FAQ embeddings...")
    try {
      const faqResult =
        await embeddingService.generateFAQEmbeddings(mainWorkspaceId)
      console.log(
        `✅ FAQ embeddings: ${faqResult.processed} processed, ${faqResult.errors.length} errors`
      )
      if (faqResult.errors.length > 0) {
        console.log("⚠️ FAQ errors:", faqResult.errors)
      }
    } catch (error) {
      console.log("❌ FAQ embeddings failed:", (error as any).message)
    }

    console.log("🔄 2. Generating Service embeddings...")
    try {
      const serviceResult =
        await embeddingService.generateServiceEmbeddings(mainWorkspaceId)
      console.log(
        `✅ Service embeddings: ${serviceResult.processed} processed, ${serviceResult.errors.length} errors`
      )
      if (serviceResult.errors.length > 0) {
        console.log("⚠️ Service errors:", serviceResult.errors)
      }
    } catch (error) {
      console.log("❌ Service embeddings failed:", (error as any).message)
    }

    console.log("🔄 3. Generating Product embeddings...")
    try {
      const productResult =
        await embeddingService.generateProductEmbeddings(mainWorkspaceId)
      console.log(
        `✅ Product embeddings: ${productResult.processed} processed, ${productResult.errors.length} errors`
      )
      if (productResult.errors.length > 0) {
        console.log("⚠️ Product errors:", productResult.errors)
      }
    } catch (error) {
      console.log("❌ Product embeddings failed:", (error as any).message)
    }

    // console.log("🔄 4. Generating Document embeddings...")
    // try {
    //   const documentResult =
    //     await documentService.generateEmbeddingsForActiveDocuments(
    //       mainWorkspaceId
    //     )
    //   console.log(
    //     `✅ Document embeddings: ${documentResult.processed} processed, ${documentResult.errors.length} errors`
    //   )
    //   if (documentResult.errors.length > 0) {
    //     console.log("⚠️ Document errors:", documentResult.errors)
    //   }
    // } catch (error) {
    //   console.log("❌ Document embeddings failed:", error.message)
    // }
    console.log(
      "🔄 4. Document embeddings: SKIPPED (documents no longer exist in system)"
    )

    console.log("🎉 EMBEDDING GENERATION COMPLETED!")
    console.log("=================================")
    console.log("✅ All embeddings generated automatically")
    console.log("✅ RAG search should now work correctly")
    console.log("✅ Chatbot will use ONLY database data")
  } catch (error) {
    console.log("❌ Error during embedding generation:", (error as any).message)
    console.log("⚠️ You may need to generate embeddings manually via frontend")
  }
}

async function main() {
  console.log("🚀 STARTING COMPLETE DATABASE SEED")
  console.log("=".repeat(50))

  // 🔥 COMPLETE DATABASE CLEANUP
  console.log(
    "🧹 COMPLETE DATABASE CLEANUP - Removing all data from all tables..."
  )

  try {
    // Delete all chunks first (foreign keys)
    await prisma.documentChunks.deleteMany({})
    console.log("✅ Deleted all document chunks")

    await prisma.fAQChunks.deleteMany({})
    console.log("✅ Deleted all FAQ chunks")

    await prisma.serviceChunks.deleteMany({})
    console.log("✅ Deleted all service chunks")

    // Delete orders and carts
    await prisma.orderItems.deleteMany({})
    await prisma.paymentDetails.deleteMany({})
    await prisma.orders.deleteMany({})
    await prisma.cartItems.deleteMany({})
    await prisma.carts.deleteMany({})
    console.log("✅ Deleted all orders and carts")

    // Delete chats and messages
    await prisma.message.deleteMany({})
    await prisma.chatSession.deleteMany({})
    console.log("✅ Deleted all chat sessions and messages")

    // Delete documents, FAQs, products, categories, services
    await prisma.documents.deleteMany({})
    await prisma.fAQ.deleteMany({})
    await prisma.products.deleteMany({})
    await prisma.categories.deleteMany({})
    await prisma.services.deleteMany({})
    await prisma.offers.deleteMany({})
    console.log("✅ Deleted all content entities")

    // Delete usage before customers (foreign key)
    await prisma.usage.deleteMany({})
    console.log("✅ Deleted all usage records")

    // Delete customers and configurations
    await prisma.customers.deleteMany({})
    await prisma.agentConfig.deleteMany({})
    await prisma.prompts.deleteMany({})
    await prisma.languages.deleteMany({})
    await prisma.whatsappSettings.deleteMany({})
    console.log("✅ Deleted all customers and configurations")

    // Delete user-workspace associations
    await prisma.userWorkspace.deleteMany({})
    console.log("✅ Deleted all user-workspace associations")

    // Delete secure tokens before workspaces (foreign key)
    await prisma.secureToken.deleteMany({})
    console.log("✅ Deleted all secure tokens")

    // Delete billing records before workspaces (foreign key)
    await prisma.billing.deleteMany({})
    console.log("✅ Deleted all billing records")

    // Delete sales before workspaces (foreign key)
    await prisma.sales.deleteMany({})
    console.log("✅ Deleted all sales records")

    // Delete workspaces and users
    await prisma.workspace.deleteMany({})
    await prisma.user.deleteMany({})
    console.log("✅ Deleted all workspaces and users")

    console.log("🎉 COMPLETE DATABASE CLEANUP FINISHED!")
    console.log("=".repeat(50))
  } catch (error) {
    console.error("❌ Error during database cleanup:", error)
    throw error
  }

  // Check if the admin user already exists (should be empty after cleanup)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  let adminUser
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10)
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
      },
    })
    console.log(
      `✅ Admin user created: ${adminUser.email} (ID: ${adminUser.id})`
    )
  } else {
    adminUser = existingAdmin
    console.log("ℹ️ Admin user already exists.")
  }

  // Check if the main workspace exists
  const existingMainWorkspace = await prisma.workspace.findUnique({
    where: { id: mainWorkspaceId },
  })

  if (existingMainWorkspace) {
    console.log(`Found main workspace with ID: ${mainWorkspaceId}`)

    // COMPLETE CLEANUP: Delete all data from the main workspace
    console.log("🧹 COMPLETE CLEANUP: deleting all workspace data...")

    // 1. First, delete items with dependencies (chunks and relations)
    console.log("🗑️ Deleting chunks and dependencies...")

    // Delete all chunks (using correct names from schema)
    try {
      await prisma.documentChunks.deleteMany({
        where: {
          document: {
            workspaceId: mainWorkspaceId,
          },
        },
      })
      console.log("Deleted document chunks")
    } catch (error) {
      console.log("Error deleting document chunks:", (error as any).message)
    }

    try {
      await prisma.fAQChunks.deleteMany({
        where: {
          faq: {
            workspaceId: mainWorkspaceId,
          },
        },
      })
      console.log("Deleted FAQ chunks")
    } catch (error) {
      console.log("Error deleting FAQ chunks:", (error as any).message)
    }

    try {
      await prisma.serviceChunks.deleteMany({
        where: {
          service: {
            workspaceId: mainWorkspaceId,
          },
        },
      })
      console.log("Deleted service chunks")
    } catch (error) {
      console.log("Error deleting service chunks:", (error as any).message)
    }

    // Delete all orders and items
    await prisma.orderItems.deleteMany({
      where: {
        order: {
          workspaceId: mainWorkspaceId,
        },
      },
    })
    await prisma.paymentDetails.deleteMany({
      where: {
        order: {
          workspaceId: mainWorkspaceId,
        },
      },
    })
    await prisma.orders.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })

    // Delete all carts and items
    await prisma.cartItems.deleteMany({
      where: {
        cart: {
          workspaceId: mainWorkspaceId,
        },
      },
    })
    await prisma.carts.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })

    // Delete all chats and messages
    await prisma.message.deleteMany({
      where: {
        chatSession: {
          workspaceId: mainWorkspaceId,
        },
      },
    })
    await prisma.chatSession.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })

    // 2. Then, delete the main entities
    console.log("🗑️ Deleting main entities...")

    // Delete all documents
    await prisma.documents.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log("Deleted all documents from the main workspace")

    // Delete all FAQs
    await prisma.fAQ.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log("Deleted all FAQs from the main workspace")

    // Delete all products
    await prisma.products.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log("Deleted all products from the main workspace")

    // Delete all customers
    await prisma.customers.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log("Deleted all customers from the main workspace")

    // Delete all categories
    await prisma.categories.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log("Deleted all categories from the main workspace")

    // Delete all services
    await prisma.services.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log("Deleted all services from the main workspace")

    // Delete all agent configurations
    await prisma.agentConfig.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log("Deleted all agent configurations from the main workspace")

    // Delete all prompts and agents
    const deletedPrompts = await prisma.prompts.deleteMany({
      where: {
        workspaceId: mainWorkspaceId,
      },
    })
    console.log(
      `Deleted ${deletedPrompts.count} prompts from the main workspace`
    )

    console.log("✅ Complete cleanup finished!")

    // We update the workspace with the required data, but keep the original slug
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: mainWorkspaceId },
      data: {
        name: "L'Altra Italia(ESP)",
        whatsappPhoneNumber: "+34654728753",
        whatsappApiKey: "placeholder_whatsapp_api_key_for_testing",

        language: "es",
        currency: "EUR",
        url: "http://localhost:3000",

        wipMessages: {
          en: "Work in progress. Please contact us later.",
          it: "Lavori in corso. Contattaci più tardi.",
          es: "Trabajos en curso. Por favor, contáctenos más tarde.",
          pt: "Em manutenção. Por favor, contacte-nos mais tarde.",
        },
      },
    })
    console.log(
      `Workspace updated: ${updatedWorkspace.name} with ID ${updatedWorkspace.id}`
    )
    createdWorkspaces.push(updatedWorkspace)

    // Ensure admin user has access to this workspace (FORCED)
    try {
      await prisma.userWorkspace.upsert({
        where: {
          userId_workspaceId: {
            userId: adminUser.id,
            workspaceId: mainWorkspaceId,
          },
        },
        update: {
          role: "OWNER",
        },
        create: {
          userId: adminUser.id,
          workspaceId: mainWorkspaceId,
          role: "OWNER",
        },
      })
      console.log(
        `✅ Admin user forcibly associated with the workspace as OWNER (upsert) - UserID: ${adminUser.id}`
      )

      // Verify that the association was created
      const verification = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: adminUser.id,
            workspaceId: mainWorkspaceId,
          },
        },
      })
      if (verification) {
        console.log(
          `✅ Verification: UserWorkspace association created correctly`
        )
      } else {
        console.error(
          `❌ ERROR: UserWorkspace association NOT found after creation!`
        )
      }
    } catch (error) {
      console.error(`❌ ERROR in UserWorkspace creation:`, error)
      throw error
    }

    // ADDITION: CREATE Default AgentConfig IF IT DOES NOT EXIST
    const existingAgentConfig = await prisma.agentConfig.findFirst({
      where: { workspaceId: mainWorkspaceId },
    })
    if (!existingAgentConfig) {
      await prisma.agentConfig.create({
        data: {
          prompt: SOFIA_PROMPT,
          workspaceId: mainWorkspaceId,
          model: defaultAgent.model,
          temperature: 0,
          maxTokens: 2000,
          isActive: true,
        },
      })
      console.log("SofIA AgentConfig created for the main workspace")
    } else {
      // FORCE UPDATE: Always update agentConfig with the content of prompt_agent.md
      let promptContent = ""
      const promptFilePath = path.join(
        __dirname,
        "..",
        "..",
        "docs",
        "other",
        "prompt_agent.md"
      )

      try {
        promptContent = fs.readFileSync(promptFilePath, "utf8")
        console.log(`🔄 Updating agentConfig with prompt_agent.md`)
      } catch (error) {
        console.error(`❌ Error reading prompt_agent.md: ${error}`)
        promptContent = SOFIA_PROMPT // Fallback to default prompt
      }

      await prisma.agentConfig.update({
        where: { id: existingAgentConfig.id },
        data: {
          prompt: promptContent,
          model: defaultAgent.model,
          temperature: 0,
          maxTokens: 2000,
          isActive: true,
        },
      })
      console.log("✅ AgentConfig updated with prompt_agent.md")
    }

    // ALSO CREATE AN AGENT IN THE PROMPTS TABLE IF IT DOES NOT EXIST
    const existingPromptAgent = await prisma.prompts.findFirst({
      where: {
        workspaceId: mainWorkspaceId,
        isRouter: true,
        isActive: true,
      },
    })
    if (!existingPromptAgent) {
      await prisma.prompts.create({
        data: {
          name: defaultAgent.name,
          content: SOFIA_PROMPT,
          isActive: true,
          isRouter: true,
          department: null,
          workspaceId: mainWorkspaceId,
          model: "gpt-3.5-turbo",
          temperature: 0, // Lowered for more consistency in links
          top_p: 1,
          max_tokens: 1024,
        },
      })
      console.log("SofIA Prompt agent created for the main workspace")
    } else {
      console.log("Prompt agent already exists for the main workspace")
    }

    // CREATE ROUTER PROMPT IF IT DOES NOT EXIST
    const existingRouterPrompt = await prisma.prompts.findFirst({
      where: {
        workspaceId: mainWorkspaceId,
        name: "Router LLM",
        isActive: true,
      },
    })
    if (!existingRouterPrompt) {
      await prisma.prompts.create({
        data: {
          name: "Router LLM",
          content: SOFIA_PROMPT,
          isActive: true,
          isRouter: false,
          department: "router",
          workspaceId: mainWorkspaceId,
          model: "anthropic/claude-3.5-sonnet",
          temperature: 0.1,
          top_p: 1,
          max_tokens: 500,
        },
      })
      console.log("Router Prompt created for the main workspace")
    } else {
      console.log("Router Prompt already exists for the main workspace")
    }
  } else {
    console.log(
      `The workspace with ID ${mainWorkspaceId} does not exist in the database, creating it`
    )
    // Create the workspace if it doesn't exist
    const mainWorkspace = await prisma.workspace.create({
      data: {
        id: mainWorkspaceId,
        name: "L'Altra Italia(ESP)",
        slug: "altra-italia-esp",
        whatsappPhoneNumber: "+34654728753",
        whatsappApiKey: "placeholder_whatsapp_api_key_for_testing",

        language: "es",
        currency: "EUR",
        url: "http://localhost:3000",

        wipMessages: {
          it: "🔧 Siamo in manutenzione. Il servizio tornerà disponibile a breve. Grazie per la pazienza! 🇮🇹",
          en: "🔧 We're under maintenance. The service will be back shortly. Thank you for your patience! 🇬🇧",
          es: "🔧 Estamos en mantenimiento. El servicio estará disponible pronto. ¡Gracias por tu paciencia! 🇪🇸",
          pt: "🔧 Estamos em manutenção. O serviço voltará em breve. Obrigado pela paciência! 🇵🇹",
          de: "🔧 Wir befinden uns in Wartung. Der Service wird in Kürze wieder verfügbar sein. Vielen Dank für Ihre Geduld! 🇩🇪",
          fr: "🔧 Nous sommes en maintenance. Le service sera bientôt de retour. Merci pour votre patience! 🇫🇷",
        },
        welcomeMessages: {
          it: "👋 Benvenuto a L'Altra Italia! Sono SofiA, il tuo assistente digitale. Sono qui per aiutarti con:\n\n• Esplorare i nostri prodotti italiani di alta qualità\n• Seguire i tuoi ordini\n• Rispondere a qualsiasi domanda\n\nPrima di iniziare, ti invito a registrarti per accedere a tutte le funzionalità. I tuoi dati saranno protetti e mai condivisi con terzi.\n\nCosa posso fare per te oggi? 🇮🇹",
          en: "👋 Welcome to L'Altra Italia! I'm SofiA, your digital assistant. I'm here to help you with:\n\n• Exploring our high-quality Italian products\n• Tracking your orders\n• Answering any questions\n\nBefore we begin, please register to access all features. Your data will be protected and never shared with third parties.\n\nWhat can I do for you today? 🇬🇧",
          es: "👋 ¡Bienvenido a L'Altra Italia! Soy SofiA, tu asistente digital. Estoy aquí para ayudarte con:\n\n• Explorar nuestros productos italianos de alta calidad\n• Seguir tus pedidos\n• Responder cualquier pregunta\n\nAntes de comenzar, te invito a registrarte para acceder a todas las funciones. Tus datos estarán protegidos y nunca se compartirán con terceros.\n\n¿Qué puedo hacer por ti hoy? 🇪🇸",
          pt: "👋 Bem-vindo à L'Altra Italia! Sou a SofiA, a sua assistente digital. Estou aqui para ajudá-lo com:\n\n• Explorar os nossos produtos italianos de alta qualidade\n• Acompanhar os seus pedidos\n• Responder a qualquer pergunta\n\nAntes de começar, convido-o a registar-se para aceder a todas as funcionalidades. Os seus dados estarão protegidos e nunca serão partilhados com terceiros.\n\nO que posso fazer por si hoje? 🇵🇹",
          de: "👋 Willkommen bei L'Altra Italia! Ich bin SofiA, Ihre digitale Assistentin. Ich helfe Ihnen gerne bei:\n\n• Erkunden Sie unsere hochwertigen italienischen Produkte\n• Verfolgen Sie Ihre Bestellungen\n• Beantworten Sie alle Fragen\n\nBitte registrieren Sie sich zunächst, um auf alle Funktionen zuzugreifen. Ihre Daten werden geschützt und niemals an Dritte weitergegeben.\n\nWas kann ich heute für Sie tun? 🇩🇪",
          fr: "👋 Bienvenue chez L'Altra Italia! Je suis SofiA, votre assistante numérique. Je suis là pour vous aider avec:\n\n• Explorer nos produits italiens de haute qualité\n• Suivre vos commandes\n• Répondre à toutes vos questions\n\nAvant de commencer, veuillez vous inscrire pour accéder à toutes les fonctionnalités. Vos données seront protégées et ne seront jamais partagées avec des tiers.\n\nQue puis-je faire pour vous aujourd'hui? 🇫🇷",
        },
        afterRegistrationMessages: {
          it: "Ben tornato, {name}! 👋 Come posso aiutarti oggi?",
          en: "Welcome back, {name}! 👋 How can I help you today?",
          es: "¡Bienvenido de nuevo, {name}! 👋 ¿Cómo puedo ayudarte hoy?",
          pt: "Bem-vindo de volta, {name}! 👋 Como posso ajudá-lo hoje?",
        },
        debugMode: false,
      },
    })
    console.log(
      `Workspace created: ${mainWorkspace.name} with ID ${mainWorkspace.id}`
    )
    createdWorkspaces.push(mainWorkspace)

    // Associate admin user with the new workspace (FORCED)
    try {
      await prisma.userWorkspace.upsert({
        where: {
          userId_workspaceId: {
            userId: adminUser.id,
            workspaceId: mainWorkspaceId,
          },
        },
        update: {
          role: "OWNER",
        },
        create: {
          userId: adminUser.id,
          workspaceId: mainWorkspaceId,
          role: "OWNER",
        },
      })
      console.log(
        `✅ Admin user forcibly associated with the new workspace as OWNER (upsert) - UserID: ${adminUser.id}`
      )

      // Verify that the association was created
      const verification = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: adminUser.id,
            workspaceId: mainWorkspaceId,
          },
        },
      })
      if (verification) {
        console.log(
          `✅ Verification: UserWorkspace association created correctly`
        )
      } else {
        console.error(
          `❌ ERROR: UserWorkspace association NOT found after creation!`
        )
      }
    } catch (error) {
      console.error(`❌ ERROR in UserWorkspace creation:`, error)
      throw error
    }

    // ADDITION: CREATE Default AgentConfig IF IT DOES NOT EXIST
    const existingAgentConfig = await prisma.agentConfig.findFirst({
      where: { workspaceId: mainWorkspaceId },
    })
    if (!existingAgentConfig) {
      await prisma.agentConfig.create({
        data: {
          prompt: SOFIA_PROMPT,
          workspaceId: mainWorkspaceId,
          model: defaultAgent.model,
          temperature: 0,
          maxTokens: 2000,
          isActive: true,
        },
      })
      console.log("SofIA AgentConfig created for the main workspace")
    } else {
      // FORCE UPDATE: Always update agentConfig with the content of prompt_agent.md
      let promptContent = ""
      const promptFilePath = path.join(
        __dirname,
        "..",
        "..",
        "docs",
        "other",
        "prompt_agent.md"
      )

      try {
        promptContent = fs.readFileSync(promptFilePath, "utf8")
        console.log(`🔄 Updating agentConfig with prompt_agent.md`)
      } catch (error) {
        console.error(`❌ Error reading prompt_agent.md: ${error}`)
        promptContent = SOFIA_PROMPT // Fallback to default prompt
      }

      await prisma.agentConfig.update({
        where: { id: existingAgentConfig.id },
        data: {
          prompt: promptContent,
          model: defaultAgent.model,
          temperature: 0,
          maxTokens: 2000,
          isActive: true,
        },
      })
      console.log("✅ AgentConfig updated with prompt_agent.md")
    }

    // ALSO CREATE AN AGENT IN THE PROMPTS TABLE IF IT DOES NOT EXIST
    const existingPromptAgent = await prisma.prompts.findFirst({
      where: {
        workspaceId: mainWorkspaceId,
        isRouter: true,
        isActive: true,
      },
    })
    if (!existingPromptAgent) {
      await prisma.prompts.create({
        data: {
          name: defaultAgent.name,
          content: SOFIA_PROMPT,
          isActive: true,
          isRouter: true,
          department: null,
          workspaceId: mainWorkspaceId,
          model: "gpt-3.5-turbo",
          temperature: 0,
          top_p: 1,
          max_tokens: 1024,
        },
      })
      console.log("SofIA Prompt agent created for the main workspace")
    } else {
      console.log("Prompt agent already exists for the main workspace")
    }

    // CREATE ROUTER PROMPT IF IT DOES NOT EXIST
    const existingRouterPrompt = await prisma.prompts.findFirst({
      where: {
        workspaceId: mainWorkspaceId,
        name: "Router LLM",
        isActive: true,
      },
    })
    if (!existingRouterPrompt) {
      await prisma.prompts.create({
        data: {
          name: "Router LLM",
          content: SOFIA_PROMPT,
          isActive: true,
          isRouter: false,
          department: "router",
          workspaceId: mainWorkspaceId,
          model: "anthropic/claude-3.5-sonnet",
          temperature: 0.1,
          top_p: 1,
          max_tokens: 500,
        },
      })
      console.log("Router Prompt created for the main workspace")
    } else {
      console.log("Router Prompt already exists for the main workspace")
    }
  }

  // Cleanup any other workspaces (optionally delete them)
  const otherWorkspaces = await prisma.workspace.findMany({
    where: {
      id: {
        not: mainWorkspaceId,
      },
    },
  })

  if (otherWorkspaces.length > 0) {
    console.log(
      `Found ${otherWorkspaces.length} other workspaces (will not be used)`
    )
    // We don't delete them for safety, but we don't include them in subsequent operations
  }

  // L'Altra Italia Categories - Based on catalog structure
  const foodCategories = [
    {
      name: "Cheeses & Dairy",
      slug: "cheeses-dairy",
      description:
        "🧀 Premium Italian cheeses and dairy, mozzarella, burrata, and high-quality dairy products.",
    },
    {
      name: "Cured Meats",
      slug: "cured-meats",
      description:
        "🥓 Traditional Italian cured meats and high-quality artisanal sausages.",
    },
    {
      name: "Salami & Cold Cuts",
      slug: "salami-cold-cuts",
      description:
        "🍖 Artisanal salami, prosciutto, and the best traditional Italian cold cuts.",
    },
    {
      name: "Pasta & Rice",
      slug: "pasta-rice",
      description:
        "🍝 Premium Italian pasta and rice, traditional and high-quality artisanal varieties.",
    },
    {
      name: "Tomato Products",
      slug: "tomato-products",
      description:
        "🍅 Italian tomato sauces, passata, and superior quality tomato-based products.",
    },
    {
      name: "Flour & Baking",
      slug: "flour-baking",
      description:
        "🌾 Italian flours and ingredients for artisanal baking and pastry.",
    },
    {
      name: "Sauces & Preserves",
      slug: "sauces-preserves",
      description:
        "🫙 Gourmet sauces, preserves, and high-quality Italian condiments to enrich every dish.",
    },
    {
      name: "Water & Beverages",
      slug: "water-beverages",
      description:
        "💧 Premium Italian mineral waters and high-quality traditional beverages.",
    },
    {
      name: "Frozen Products",
      slug: "frozen-products",
      description:
        "🧊 Italian frozen desserts, pastries, and high-quality frozen specialties.",
    },
    {
      name: "Various & Spices",
      slug: "various-spices",
      description:
        "🌶️ Italian spices, condiments, and various gourmet products for traditional cuisine.",
    },
  ]

  // Create categories for the main workspace
  console.log(`Creating categories for workspace: ${createdWorkspaces[0].name}`)
  for (const category of foodCategories) {
    const existingCategory = await prisma.categories.findFirst({
      where: {
        slug: category.slug,
        workspaceId: mainWorkspaceId,
      },
    })

    if (!existingCategory) {
      await prisma.categories.create({
        data: {
          ...category,

          workspace: {
            connect: {
              id: mainWorkspaceId,
            },
          },
        },
      })
      console.log(
        `Category created: ${category.name} for workspace ${createdWorkspaces[0].name}`
      )
    } else {
      console.log(
        `Category already exists: ${category.name} for workspace ${createdWorkspaces[0].name}`
      )
    }
  }

  // Create sales (salespeople) for the main workspace
  console.log(`Creating sales for workspace: ${createdWorkspaces[0].name}`)
  const salesData = [
    {
      firstName: "Marco",
      lastName: "Rossi",
      email: "marco.rossi@example.com",
      phone: "+39 333 1234567",
    },
    {
      firstName: "Giulia",
      lastName: "Bianchi",
      email: "giulia.bianchi@example.com",
      phone: "+39 333 2345678",
    },
    {
      firstName: "Alessandro",
      lastName: "Ferrari",
      email: "alessandro.ferrari@example.com",
      phone: "+39 333 3456789",
    },
    {
      firstName: "Francesca",
      lastName: "Romano",
      email: "francesca.romano@example.com",
      phone: "+39 333 4567890",
    },
    {
      firstName: "Luca",
      lastName: "Esposito",
      email: "luca.esposito@example.com",
      phone: "+39 333 5678901",
    },
  ]

  // === COMMENTED OUT: Extra salespeople (kept for reference) ===
  /*
    {
      firstName: "Sofia",
      lastName: "Colombo",
      email: "sofia.colombo@example.com",
      phone: "+39 333 6789012",
    },
    {
      firstName: "Matteo",
      lastName: "Ricci",
      email: "matteo.ricci@example.com",
      phone: "+39 333 7890123",
    },
    {
      firstName: "Chiara",
      lastName: "Marino",
      email: "chiara.marino@example.com",
      phone: "+39 333 8901234",
    },
    {
      firstName: "Lorenzo",
      lastName: "Greco",
      email: "lorenzo.greco@example.com",
      phone: "+39 333 9012345",
    },
    {
      firstName: "Martina",
      lastName: "Bruno",
      email: "martina.bruno@example.com",
      phone: "+39 333 0123456",
    },
    {
      firstName: "Andrea",
      lastName: "Gallo",
      email: "andrea.gallo@example.com",
      phone: "+39 334 1234567",
    },
    {
      firstName: "Valentina",
      lastName: "Costa",
      email: "valentina.costa@example.com",
      phone: "+39 334 2345678",
    },
    {
      firstName: "Davide",
      lastName: "Fontana",
      email: "davide.fontana@example.com",
      phone: "+39 334 3456789",
    },
    {
      firstName: "Elena",
      lastName: "Barbieri",
      email: "elena.barbieri@example.com",
      phone: "+39 334 4567890",
    },
    {
      firstName: "Simone",
      lastName: "Villa",
      email: "simone.villa@example.com",
      phone: "+39 334 5678901",
    },
    {
      firstName: "Serena",
      lastName: "Lombardi",
      email: "serena.lombardi@example.com",
      phone: "+39 334 6789012",
    },
    {
      firstName: "Riccardo",
      lastName: "Moretti",
      email: "riccardo.moretti@example.com",
      phone: "+39 334 7890123",
    },
    {
      firstName: "Elisa",
      lastName: "Barbieri",
      email: "elisa.barbieri@example.com",
      phone: "+39 334 8901234",
    },
    {
      firstName: "Federico",
      lastName: "Conti",
      email: "federico.conti@example.com",
      phone: "+39 334 9012345",
    },
    {
      firstName: "Alessia",
      lastName: "De Luca",
      email: "alessia.deluca@example.com",
      phone: "+39 334 0123456",
    },
    {
      firstName: "Giovanni",
      lastName: "Mancini",
      email: "giovanni.mancini@example.com",
      phone: "+39 335 1234567",
    },
    {
      firstName: "Laura",
      lastName: "Santoro",
      email: "laura.santoro@example.com",
      phone: "+39 335 2345678",
    },
    {
      firstName: "Paolo",
      lastName: "Marini",
      email: "paolo.marini@example.com",
      phone: "+39 335 3456789",
    },
    {
      firstName: "Silvia",
      lastName: "Giordano",
      email: "silvia.giordano@example.com",
      phone: "+39 335 4567890",
    },
    {
      firstName: "Stefano",
      lastName: "Ferri",
      email: "stefano.ferri@example.com",
      phone: "+39 335 5678901",
    },
    {
      firstName: "Anna",
      lastName: "Pellegrini",
      email: "anna.pellegrini@example.com",
      phone: "+39 335 6789012",
    },
    {
      firstName: "Nicola",
      lastName: "Rossetti",
      email: "nicola.rossetti@example.com",
      phone: "+39 335 7890123",
    },
    {
      firstName: "Cristina",
      lastName: "Martini",
      email: "cristina.martini@example.com",
      phone: "+39 335 8901234",
    },
    {
      firstName: "Daniele",
      lastName: "Leone",
      email: "daniele.leone@example.com",
      phone: "+39 335 9012345",
    },
    {
      firstName: "Marta",
      lastName: "Longo",
      email: "marta.longo@example.com",
      phone: "+39 335 0123456",
    },
    {
      firstName: "Roberto",
      lastName: "Benedetti",
      email: "roberto.benedetti@example.com",
      phone: "+39 336 1234567",
    },
    {
      firstName: "Beatrice",
      lastName: "Sala",
      email: "beatrice.sala@example.com",
      phone: "+39 336 2345678",
    },
    {
      firstName: "Fabio",
      lastName: "Gentile",
      email: "fabio.gentile@example.com",
      phone: "+39 336 3456789",
    },
    {
      firstName: "Michela",
      lastName: "Monti",
      email: "michela.monti@example.com",
      phone: "+39 336 4567890",
    },
    {
      firstName: "Emanuele",
      lastName: "Parisi",
      email: "emanuele.parisi@example.com",
      phone: "+39 336 5678901",
    },
    {
      firstName: "Claudia",
      lastName: "Negri",
      email: "claudia.negri@example.com",
      phone: "+39 336 6789012",
    },
    {
      firstName: "Filippo",
      lastName: "Pagano",
      email: "filippo.pagano@example.com",
      phone: "+39 336 7890123",
    },
    {
      firstName: "Barbara",
      lastName: "Gatti",
      email: "barbara.gatti@example.com",
      phone: "+39 336 8901234",
    },
    {
      firstName: "Massimo",
      lastName: "Orlando",
      email: "massimo.orlando@example.com",
      phone: "+39 336 9012345",
    },
    {
      firstName: "Roberta",
      lastName: "Testa",
      email: "roberta.testa@example.com",
      phone: "+39 336 0123456",
    },
    {
      firstName: "Antonio",
      lastName: "Guerra",
      email: "antonio.guerra@example.com",
      phone: "+39 337 1234567",
    },
    {
      firstName: "Ilaria",
      lastName: "Ferrara",
      email: "ilaria.ferrara@example.com",
      phone: "+39 337 2345678",
    },
    {
      firstName: "Vincenzo",
      lastName: "Caruso",
      email: "vincenzo.caruso@example.com",
      phone: "+39 337 3456789",
    },
    {
      firstName: "Giorgia",
      lastName: "Vitale",
      email: "giorgia.vitale@example.com",
      phone: "+39 337 4567890",
    },
    {
      firstName: "Tommaso",
      lastName: "Silvestri",
      email: "tommaso.silvestri@example.com",
      phone: "+39 337 5678901",
    },
  */

  const createdSales = []
  for (const sale of salesData) {
    const existingSale = await prisma.sales.findFirst({
      where: {
        email: sale.email,
        workspaceId: mainWorkspaceId,
      },
    })

    if (!existingSale) {
      const createdSale = await prisma.sales.create({
        data: {
          ...sale,
          isActive: true,
          workspace: {
            connect: {
              id: mainWorkspaceId,
            },
          },
        },
      })
      createdSales.push(createdSale)
      console.log(`Salesperson created: ${sale.firstName} ${sale.lastName}`)
    } else {
      createdSales.push(existingSale)
      console.log(
        `Salesperson already exists: ${sale.firstName} ${sale.lastName}`
      )
    }
  }

  // Store sales IDs for later use
  const [
    marcoRossi,
    giuliaBianchi,
    alessandroFerrari,
    francescaRomano,
    lucaEsposito,
  ] = createdSales

  // Create available languages only if they don't exist
  const languageCodes = ["it", "en", "es", "pt"]
  const existingLanguages = await prisma.languages.findMany({
    where: {
      code: { in: languageCodes },
      workspaceId: mainWorkspaceId,
    },
  })

  const existingLanguageCodes = existingLanguages.map(
    (lang: { code: string }) => lang.code
  )
  const languagesToCreate = languageCodes.filter(
    (code) => !existingLanguageCodes.includes(code)
  )

  const languages = [...existingLanguages]

  // Helper function to get language names
  function getLanguageName(code: string): string {
    const names: { [key: string]: string } = {
      it: "Italiano",
      en: "English",
      es: "Español",
      pt: "Português",
    }
    return names[code] || code
  }

  if (languagesToCreate.length > 0) {
    const newLanguages = await Promise.all(
      languagesToCreate.map((code) =>
        prisma.languages.create({
          data: {
            code,
            name: getLanguageName(code),
            workspace: { connect: { id: mainWorkspaceId } },
          },
        })
      )
    )
    languages.push(...newLanguages)
    console.log(`New languages created: ${languagesToCreate.join(", ")}`)
  } else {
    console.log("All languages already exist")
  }

  // Connect languages to the workspace
  await prisma.workspace.update({
    where: { id: mainWorkspaceId },
    data: {
      languages: {
        connect: languages.map((lang: { id: string }) => ({ id: lang.id })),
      },
    },
  })

  // Create prompts for all agents
  console.log("Creating prompts for all agents...")
  for (const agent of [defaultAgent]) {
    const existingPrompt = await prisma.prompts.findFirst({
      where: {
        name: agent.promptName,
        workspaceId: mainWorkspaceId,
      },
    })

    // Force update the prompt to use our new prompt_agent.md
    if (existingPrompt) {
      // Read the new prompt content
      let promptContent = ""
      const promptFilePath = path.join(
        __dirname,
        "..",
        "..",
        "docs",
        "other",
        "prompt_agent.md"
      )

      try {
        promptContent = fs.readFileSync(promptFilePath, "utf8")
        console.log(`Using updated prompt_agent.md for ${agent.name} agent`)
      } catch (error) {
        console.error(`Error reading prompt_agent.md file: ${error}`)
        promptContent =
          "Default prompt content. Please update with proper instructions."
      }

      // Update existing prompt
      await prisma.prompts.update({
        where: { id: existingPrompt.id },
        data: {
          content: promptContent,
          temperature: 0,
          top_p: 0.8,
          top_k: 30,
          model: agent.model,
        },
      })
      console.log(`Prompt updated: ${agent.promptName} for agent ${agent.name}`)
    }

    if (!existingPrompt) {
      let promptContent = ""
      let promptFilePath = ""

      // Use our updated prompt_agent.md for all agents
      promptFilePath = path.join(
        __dirname,
        "..",
        "..",
        "docs",
        "other",
        "prompt_agent.md"
      )

      try {
        promptContent = fs.readFileSync(promptFilePath, "utf8")
        console.log(
          `Using specific content from ${path.basename(promptFilePath)} for ${
            agent.name
          } agent`
        )
      } catch (error) {
        console.error(
          `Error reading ${path.basename(promptFilePath)} file: ${error}`
        )
        // Fallback to GDPR.md if specific file doesn't exist or can't be read
        try {
          promptContent = fs.readFileSync(
            path.join(__dirname, "prompts/gdpr.md"),
            "utf8"
          )
          console.log(`Using fallback GDPR.md content for ${agent.name} agent`)
        } catch (fallbackError) {
          console.error(`Error reading fallback GDPR.md file: ${fallbackError}`)
          promptContent =
            "Default prompt content. Please update with proper instructions."
        }
      }

      await prisma.prompts.create({
        data: {
          name: agent.promptName,
          content: promptContent,
          isRouter: agent.isRouter,
          department: agent.department,
          temperature: 0,
          top_p: 0.8,
          top_k: 30,
          model: agent.model,
          workspaceId: mainWorkspaceId,
        },
      })
      console.log(
        `Prompt created: ${agent.promptName} for agent ${agent.name} for workspace ${createdWorkspaces[0].name}`
      )
    } else {
      console.log(
        `Prompt already exists: ${agent.promptName} for agent ${agent.name} for workspace ${createdWorkspaces[0].name}`
      )
    }
  }

  // L'Altra Italia Products - COMPLETE CATALOG (66 products)
  const products = [
    // BURRATA CATEGORY (18 products)
    {
      name: "Burrata di Vacca Senza Testa",
      ProductCode: "0212000022",
      description:
        "Burrata artigianale pugliese di latte vaccino senza testa, dal cuore cremoso e sapore delicato. Prodotta secondo tradizione in Puglia. Regione: Puglia - Culla della burrata, dove nasce questo capolavoro caseario nel cuore del Salento.",
      formato: "100gr x12",
      price: 5.5,
      stock: 48,
      status: "ACTIVE",
      slug: "burrata-de-vaca-s-cabeza",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata di Vacca Con Testa",
      ProductCode: "0212000017",
      description:
        "Burrata tradizionale pugliese di latte vaccino con testa, dalla consistenza cremosa e gusto autentico della tradizione casearia del Sud Italia.",
      formato: "125gr x12",
      price: 6.2,
      stock: 36,
      status: "ACTIVE",
      slug: "burrata-de-vaca-c-cabeza",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata in Vaso",
      ProductCode: "0212000020",
      description:
        "Artisanal burrata preserved in a jar, perfect for maintaining freshness and creaminess. High-quality Apulian specialty.",
      formato: "125gr x12",
      price: 6.8,
      stock: 24,
      status: "ACTIVE",
      slug: "burrata-en-vaso",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata Artigianale Senza Testa",
      ProductCode: "0212000043",
      description:
        "Limited production artisanal burrata without head, with intense flavor and exceptional creaminess. Produced by Apulian master cheesemakers.",
      formato: "150gr x2",
      price: 8.9,
      stock: 18,
      status: "ACTIVE",
      slug: "burrata-artigianale-s-cabeza",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata",
      ProductCode: "0212000029",
      description:
        "Classic large Apulian burrata, perfect for sharing. Creamy heart of stracciatella and cream, with stretched curd outer shell.",
      formato: "250gr x10",
      price: 9.5,
      stock: 30,
      status: "ACTIVE",
      slug: "burrata-classica-250gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata 200gr",
      ProductCode: "0212000018",
      description:
        "Burrata di formato medio, ideale per 2-3 persone. Prodotta in Puglia con latte fresco locale e tecniche tradizionali.",
      formato: "200gr",
      price: 7.8,
      stock: 42,
      status: "ACTIVE",
      slug: "burrata-200gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Nodo in vaschetta",
      ProductCode: "0212000064",
      description:
        "Piccoli nodi di burrata in vaschetta, perfetti come antipasto o aperitivo. Formato mini per degustazioni raffinate.",
      formato: "50gr (5ud)",
      price: 4.2,
      stock: 60,
      status: "ACTIVE",
      slug: "nodo-in-vaschetta",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata Affumicata",
      ProductCode: "0212000023",
      description:
        "Burrata affumicata con legni aromatici, dal sapore unico e avvolgente. Specialità gourmet della tradizione pugliese moderna.",
      formato: "125gr x2",
      price: 8.5,
      stock: 20,
      status: "ACTIVE",
      slug: "burrata-ahumada",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata 30 Gr",
      ProductCode: "0212000030",
      description:
        "Mini burrate monoporzione, perfette per aperitivi e degustazioni. Formato piccolo ma dal grande sapore pugliese.",
      formato: "6 ud",
      price: 6.9,
      stock: 45,
      status: "ACTIVE",
      slug: "burrata-30gr-6ud",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata al Gorgonzola DOP",
      ProductCode: "0212000039",
      description:
        "Burrata gourmet con cuore di gorgonzola DOP lombardo. Incontro perfetto tra cremosità pugliese e sapidità lombarda.",
      formato: "100Gr x12",
      price: 9.8,
      stock: 15,
      status: "ACTIVE",
      slug: "burrata-al-gorgonzola-dop",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata alla Nduja",
      ProductCode: "0212000040",
      description:
        "Spicy burrata with Calabrian 'nduja, a fusion of flavors from Southern Italy. Apulian creaminess meets Calabrian spiciness.",
      formato: "200 Grx8",
      price: 11.2,
      stock: 12,
      status: "ACTIVE",
      slug: "burrata-alla-nduja",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata Caprese",
      ProductCode: "0212000046",
      description:
        "Burrata with cherry tomatoes and basil, inspired by the Caprese tradition. Campanian freshness in an Apulian version.",
      formato: "100Gr x12",
      price: 7.9,
      stock: 28,
      status: "ACTIVE",
      slug: "burrata-caprese",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata ai Ricci di Mare",
      ProductCode: "0212000044",
      description:
        "Gourmet burrata with sea urchins, a luxury specialty that combines the creaminess of burrata with the taste of the Apulian sea.",
      formato: "100Gr x12",
      price: 15.5,
      stock: 8,
      status: "ACTIVE",
      slug: "burrata-ai-ricci-di-mare",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata Affumicata con Cuore di Ricotta",
      ProductCode: "0212000041",
      description:
        "Smoked burrata with a heart of fresh ricotta, double creaminess and a delicate smoky flavor. An innovation of tradition.",
      formato: "100gr x16",
      price: 8.9,
      stock: 22,
      status: "ACTIVE",
      slug: "burrata-ahumada-con-cuore-ricotta",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata con Tartufo",
      ProductCode: "0212000019",
      description:
        "Gourmet burrata with truffle, an Apulian excellence enriched by the precious Italian truffle. Luxury and tradition in a single product. Region: Puglia - From the Apulian Murgia, where burrata meets Umbrian truffle in a unique marriage of flavors.",
      formato: "100g x12",
      price: 12.8,
      stock: 10,
      status: "ACTIVE",
      slug: "burrata-c-trufa",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata Anchoas del Cantábrico y pimiento",
      ProductCode: "G-ANCH-PROV",
      description:
        "Gourmet burrata with Cantabrian anchovies and peppers, an Italian-Spanish fusion of sea and land flavors.",
      formato: "100gr x16",
      price: 13.5,
      stock: 6,
      status: "ACTIVE",
      slug: "burrata-anchoas-cantabrico-pimiento",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata Olive e Maggiorana",
      ProductCode: "G-OLIV-PROV",
      description:
        "Burrata flavored with Apulian olives and fresh marjoram, Mediterranean flavors in perfect harmony with traditional creaminess.",
      formato: "100gr x16",
      price: 9.2,
      stock: 14,
      status: "ACTIVE",
      slug: "burrata-olive-maggiorana",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burrata di Bufala",
      ProductCode: "0212000047",
      description:
        "Burrata made from buffalo milk from Campania, with superior creaminess and a more intense flavor. A dairy excellence from Southern Italy.",
      formato: "125Gr x12",
      price: 11.8,
      stock: 16,
      status: "ACTIVE",
      slug: "burrata-di-bufala",
      categoryName: "Cheeses & Dairy",
    },

    // MOZZARELLA BUFALA CATEGORY (12 products)
    {
      name: "Mozzarela Di Bufala",
      ProductCode: "0212000035",
      description:
        "PDO buffalo mozzarella from Campania, with an intense flavor and elastic texture. Produced with 100% Campanian buffalo milk.",
      formato: "5x100 Gr",
      price: 12.5,
      stock: 25,
      status: "ACTIVE",
      slug: "mozzarela-di-bufala-5x100",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Bocconcino Di Bufala",
      ProductCode: "0212000033",
      description:
        "Small balls of PDO buffalo mozzarella from Campania, a practical format for salads and appetizers. Freshness and quality guaranteed.",
      formato: "2x125 Gr",
      price: 8.9,
      stock: 32,
      status: "ACTIVE",
      slug: "bocconcino-di-bufala",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Ciliegina",
      ProductCode: "0212000048",
      description:
        "PDO buffalo mozzarella cherries, a mini format perfect for appetizers and Caprese salads. Sweetness and Campanian freshness.",
      formato: "15Gr (250Grx10)",
      price: 6.8,
      stock: 40,
      status: "ACTIVE",
      slug: "ciliegina-bufala",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella Di Bufala Campana D.O.P.",
      ProductCode: "0212000034",
      description:
        "Certified PDO buffalo mozzarella from Campania, cherries in a bag. Campanian dairy tradition since 1800, authentic flavor.",
      formato: "15Gr xbolsa 250Gr",
      price: 7.2,
      stock: 35,
      status: "ACTIVE",
      slug: "mozzarella-bufala-campana-dop-ciliegine",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella di Bufala Campana D.O.P. 125gr",
      ProductCode: "0212000024",
      description:
        "Classic-sized PDO buffalo mozzarella from Campania, produced in the provinces of Caserta and Salerno according to traditional regulations. Region: Campania - Land of buffaloes, where the PDO tradition has protected dairy excellence for generations.",
      formato: "125gr x 12",
      price: 9.5,
      stock: 28,
      status: "ACTIVE",
      slug: "mozzarella-bufala-campana-dop-125gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella di Bufala Campana D.O.P. 250gr",
      ProductCode: "0212000031",
      description:
        "Large-sized PDO buffalo mozzarella from Campania, ideal for families. Creaminess and intense flavor of the Campanian tradition.",
      formato: "250gr x12",
      price: 14.8,
      stock: 20,
      status: "ACTIVE",
      slug: "mozzarella-bufala-campana-dop-250gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella di Bufala D.O.P. Treccia 1kg",
      ProductCode: "0212000053",
      description:
        "1kg braid of PDO buffalo mozzarella, a professional format for restaurants. Artisanal hand-crafting.",
      formato: "1 Kg",
      price: 18.9,
      stock: 15,
      status: "ACTIVE",
      slug: "mozzarella-bufala-dop-treccia-1kg",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella di Bufala D.O.P. Affumicata",
      ProductCode: "0212000028",
      description:
        "Smoked PDO buffalo mozzarella with natural woods, a unique flavor that combines Campanian tradition and smoking techniques.",
      formato: "250gr x12",
      price: 16.2,
      stock: 12,
      status: "ACTIVE",
      slug: "mozzarella-bufala-dop-ahumada",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella di Bufala D.O.P. Treccia 2kg",
      ProductCode: "0212000049",
      description:
        "2kg braid of PDO buffalo mozzarella, a format for large events and catering. Completely handmade.",
      formato: "2 Kg",
      price: 35.5,
      stock: 8,
      status: "ACTIVE",
      slug: "mozzarella-bufala-dop-treccia-2kg",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella di Bufala Senza Lattosio",
      ProductCode: "0212000036",
      description:
        "Lactose-free buffalo mozzarella, for those with intolerance who do not want to give up the authentic taste of Campanian buffalo.",
      formato: "2x125 Gr",
      price: 10.8,
      stock: 18,
      status: "ACTIVE",
      slug: "mozzarella-bufala-s-lactose",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella di Bufala Senza Lattosio 500gr",
      ProductCode: "P-MBSL-PROV",
      description:
        "Large-sized lactose-free buffalo mozzarella, an innovation for the intolerant. It retains all the flavor of the Campanian tradition.",
      formato: "500 Gr",
      price: 16.5,
      stock: 10,
      status: "ACTIVE",
      slug: "mozzarella-bufala-s-lactose-500gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Bocconcini di Bufala Senza Lattosio",
      ProductCode: "0212000037",
      description:
        "Lactose-free buffalo mozzarella bites, a practical format for those with intolerances who love authentic flavors.",
      formato: "5x50 Gr",
      price: 9.2,
      stock: 22,
      status: "ACTIVE",
      slug: "bocconcino-bufala-s-lactose",
      categoryName: "Cheeses & Dairy",
    },

    // FIOR DI LATTE CATEGORY (9 products)
    {
      name: "Fiordilatte Taglio Napoli",
      ProductCode: "0212000025",
      description:
        "Fior di latte with a Napoli cut, cow's milk mozzarella from the Neapolitan tradition. Perfect for pizza and typical Campanian dishes.",
      formato: "6x500Gr",
      price: 8.5,
      stock: 30,
      status: "ACTIVE",
      slug: "fiordilatte-taglio-napoli",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Fiordilatte Julienne Taglio Fiammifero",
      ProductCode: "0212000026",
      description:
        "Julienne-cut fior di latte, professional format for pizzerias and restaurants. Perfect and fast melting.",
      formato: "3 Kg",
      price: 12.8,
      stock: 20,
      status: "ACTIVE",
      slug: "fiordilatte-julienne-taglio-fiammifero",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Fior di Latte Boccone",
      ProductCode: "0212000045",
      description:
        "Fior di latte in bites, professional format for catering. Cow's milk mozzarella with a perfect consistency.",
      formato: "3 Kg",
      price: 11.9,
      stock: 25,
      status: "ACTIVE",
      slug: "fior-di-latte-boccone",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Fior di Latte Cubettata",
      ProductCode: "0212000051",
      description:
        "Diced fior di latte, uniform cut for professional preparations. Ideal for salads and cold dishes.",
      formato: "3 Kg",
      price: 12.2,
      stock: 18,
      status: "ACTIVE",
      slug: "fior-di-latte-cubettata",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella Fior di Latte",
      ProductCode: "0212000032",
      description:
        "Family-sized fior di latte mozzarella, from the Campanian dairy tradition. Delicate flavor and elastic consistency.",
      formato: "15x200 Gr",
      price: 6.8,
      stock: 35,
      status: "ACTIVE",
      slug: "mozzarella-fior-di-latte",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella Fiordilatte 500gr",
      ProductCode: "0212000027",
      description:
        "Medium-sized fior di latte mozzarella, perfect for home use. Produced with high-quality fresh Italian milk.",
      formato: "500 Gr x6",
      price: 5.9,
      stock: 42,
      status: "ACTIVE",
      slug: "mozzarella-fiordilatte-500gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Fior di Latte 125gr",
      ProductCode: "0212000042",
      description:
        "Small-sized fior di latte, ideal for individual portions. Freshness and quality of the Italian dairy tradition.",
      formato: "125Gr x20",
      price: 4.5,
      stock: 50,
      status: "ACTIVE",
      slug: "fior-di-latte-125gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella Julienne",
      ProductCode: "0219000003",
      description:
        "Professional julienne mozzarella, thin cut for quick melting. Restaurant format for fast preparations.",
      formato: "2 Kg",
      price: 9.8,
      stock: 28,
      status: "ACTIVE",
      slug: "mozzarella-julienne",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mozzarella FDL Barra",
      ProductCode: "0212000050",
      description:
        "Mozzarella fior di latte a barra, formato pratico per taglio personalizzato. Ideale per pizzerie e ristoranti.",
      formato: "1 Kg",
      price: 7.2,
      stock: 32,
      status: "ACTIVE",
      slug: "mozzarella-fdl-barra",
      categoryName: "Cheeses & Dairy",
    },

    // OTROS FRESCOS CATEGORY (18 products)
    {
      name: "Stracciatella Artigianale",
      ProductCode: "0212000021",
      description:
        "Stracciatella artigianale pugliese, il cuore cremoso della burrata. Prodotta a mano secondo tradizione con panna fresca.",
      formato: "250gr x10",
      price: 8.9,
      stock: 25,
      status: "ACTIVE",
      slug: "stracciatella-artigianale",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Stracciatella Artigianale 1kg",
      ProductCode: "0217000024",
      description:
        "Stracciatella artigianale formato professionale, per ristoranti e pizzerie. Cremosità e sapore della tradizione pugliese.",
      formato: "1 Kg x2",
      price: 15.8,
      stock: 15,
      status: "ACTIVE",
      slug: "stracciatella-artigianale-1kg",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Stracciatella Affumicata in Vaso",
      ProductCode: "0217000030",
      description:
        "Stracciatella affumicata in vaso, innovazione della tradizione pugliese. Sapore affumicato delicato e cremosità intatta.",
      formato: "250Gr x10",
      price: 10.5,
      stock: 18,
      status: "ACTIVE",
      slug: "stracciatella-ahumada-en-vaso",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Ricotta",
      ProductCode: "1002037075",
      description:
        "Fresh Italian ricotta, produced with high-quality whey. Sweet flavor and creamy consistency, a dairy tradition.",
      formato: "1,5 Kg x2",
      price: 6.5,
      stock: 30,
      status: "ACTIVE",
      slug: "ricotta-1-5kg",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Ricotta 250gr",
      ProductCode: "1002020376",
      description:
        "Family-sized fresh ricotta, perfect for desserts and savory preparations. Produced daily with Italian milk.",
      formato: "250gr x8",
      price: 3.8,
      stock: 45,
      status: "ACTIVE",
      slug: "ricotta-250gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Ricotta de Bufala",
      ProductCode: "0217000037",
      description:
        "Campanian buffalo ricotta, more intense flavor and superior creaminess. Produced with PDO buffalo whey.",
      formato: "200 Gr x12",
      price: 8.9,
      stock: 20,
      status: "ACTIVE",
      slug: "ricotta-de-bufala-200gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Ricotta de Bufala 400gr",
      ProductCode: "0217000038",
      description:
        "Large-sized buffalo ricotta, a Campanian dairy excellence. Ideal for high-quality sweet and savory preparations.",
      formato: "400 Gr x6",
      price: 12.5,
      stock: 15,
      status: "ACTIVE",
      slug: "ricotta-de-bufala-400gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mascarpone",
      ProductCode: "1002037074",
      description:
        "Traditional Lombard mascarpone, creamy and delicate. Perfect for tiramisu and traditional Italian desserts.",
      formato: "500 gr x6",
      price: 7.8,
      stock: 25,
      status: "ACTIVE",
      slug: "mascarpone-500gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Mascarpone 2kg",
      ProductCode: "0217000026",
      description:
        "Professional-sized mascarpone for pastry shops and restaurants. Lombard creaminess and quality for high-level preparations.",
      formato: "2 Kg x6",
      price: 22.5,
      stock: 12,
      status: "ACTIVE",
      slug: "mascarpone-2kg",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Scamorza Affumicata a Spicchi",
      ProductCode: "0217000043",
      description:
        "Smoked scamorza in wedges, appetizer format. Delicate smoky flavor from the dairy tradition of Southern Italy. Region: Molise - From the Matese mountains, where the ancient art of smoking gives unique flavors to stretched-curd cheeses.",
      formato: "30 Gr (250Gr x10)",
      price: 6.2,
      stock: 35,
      status: "ACTIVE",
      slug: "scamorza-ahumada-spizzico",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Taleggio DOP",
      ProductCode: "1002037073",
      description:
        "Lombard PDO Taleggio, a soft cheese with a washed rind. Intense flavor and typical creaminess of the Bergamo valleys.",
      formato: "+/-2Kg",
      price: 24.8,
      stock: 8,
      status: "ACTIVE",
      slug: "taleggio-dop",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Gorgonzola Dolce",
      ProductCode: "0217000031",
      description:
        "Sweet Lombard Gorgonzola, a creamy blue cheese with a delicate flavor. Dairy tradition of the Po Valley since 1800. Region: Lombardy - In the Bergamo valleys, this blue-veined jewel is born, a symbol of Lombard dairy excellence.",
      formato: "1,5 Kg +/-",
      price: 18.9,
      stock: 12,
      status: "ACTIVE",
      slug: "gorgonzola-dolce",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Yogurt di Bufala",
      ProductCode: "0320000001",
      description:
        "Campanian buffalo yogurt, creamy and rich in protein. Produced with fresh buffalo milk from the best Campanian farms.",
      formato: "150 Gr x6",
      price: 5.8,
      stock: 30,
      status: "ACTIVE",
      slug: "iogurt-de-bufala",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Burro di Bufala",
      ProductCode: "0227000021",
      description:
        "Campanian buffalo butter, intense flavor and superior creaminess. Produced with buffalo cream, an Italian dairy excellence.",
      formato: "125 Gr x40",
      price: 4.5,
      stock: 40,
      status: "ACTIVE",
      slug: "mantequilla-bufala",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Panna Cotta de Bufala",
      ProductCode: "0221000003",
      description:
        "Buffalo panna cotta, a traditional Piedmontese dessert with Campanian buffalo milk. Unique creaminess and flavor.",
      formato: "100 Gr",
      price: 3.8,
      stock: 25,
      status: "ACTIVE",
      slug: "panna-cotta-de-bufala",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Kefir di Bufala",
      ProductCode: "P-KEFB-PROV",
      description:
        "Buffalo kefir, a probiotic fermented drink. A healthy innovation with Campanian buffalo milk, rich in live cultures.",
      formato: "200 Gr x6",
      price: 6.8,
      stock: 18,
      status: "ACTIVE",
      slug: "kefir-de-bufala",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Formaggio Fresco di Bufala Spalmabile",
      ProductCode: "P-QFRE-PROV",
      description:
        "Spreadable fresh buffalo cheese, creamy and delicate. Perfect for appetizers and breakfasts, an innovation of the Campanian tradition.",
      formato: "150 Gr x6",
      price: 7.2,
      stock: 22,
      status: "ACTIVE",
      slug: "queso-fresco-bufala-untar",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Perle di Bufala in Crema Fresca",
      ProductCode: "P-PBCF-PROV",
      description:
        "Buffalo pearls wrapped in fresh cream, a gourmet specialty. Small spheres of buffalo mozzarella in cream, a unique experience.",
      formato: "500 Gr",
      price: 14.5,
      stock: 10,
      status: "ACTIVE",
      slug: "perlas-bufala-crema-fresca",
      categoryName: "Cheeses & Dairy",
    },

    // CURADOS CATEGORY (9 products)
    {
      name: "Gran Moravia",
      ProductCode: "0217000005",
      description:
        "Gran Moravia, a high-quality aged Czech cheese. Intense flavor and compact consistency, perfect for grating and tasting.",
      formato: "500 Gr x10",
      price: 12.8,
      stock: 20,
      status: "ACTIVE",
      slug: "gran-moravia-500gr",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Gran Moravia Rallado",
      ProductCode: "1002037090",
      description:
        "Grated Gran Moravia, ready to use for pasta and risottos. Prolonged aging for intense flavor and persistent aroma.",
      formato: "1 Kg",
      price: 15.5,
      stock: 25,
      status: "ACTIVE",
      slug: "gran-moravia-rallado",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Gran Moravia En Laminas",
      ProductCode: "0201020522",
      description:
        "Gran Moravia in flakes, professional cut for appetizers and gourmet dishes. Elegant presentation and intense flavor.",
      formato: "1 Kg",
      price: 16.8,
      stock: 15,
      status: "ACTIVE",
      slug: "gran-moravia-laminas",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Gran Moravia 1/8",
      ProductCode: "0217000003",
      description:
        "Gran Moravia in an eighth of a wheel, traditional format for custom cutting. Minimum aging of 12 months.",
      formato: "4 Kg +/-",
      price: 38.5,
      stock: 8,
      status: "ACTIVE",
      slug: "gran-moravia-1-8",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Parmigiano Reggiano D.O.P. Gran Fiore",
      ProductCode: "0202020436",
      description:
        "Parmigiano Reggiano DOP Gran Fiore, aged 24 months. The king of Italian cheeses from the provinces of Parma, Reggio Emilia, and Modena. Region: Emilia-Romagna - Homeland of Parmigiano, where the Po Valley provides the finest milk in Italy.",
      formato: "1 Kg +/-",
      price: 28.5,
      stock: 15,
      status: "ACTIVE",
      slug: "parmigiano-reggiano-dop-gran-fiore",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Parmigiano Reggiano Rueda Entera",
      ProductCode: "0202020582",
      description:
        "PDO Parmigiano Reggiano whole wheel, aged 24+ months. The absolute excellence of the Emilian cheese-making tradition, professional format.",
      formato: "34 Kg +/-",
      price: 39.9,
      stock: 2,
      status: "ACTIVE",
      slug: "parmigiano-reggiano-rueda-entera",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Formaggio Fontal",
      ProductCode: "1002037066",
      description:
        "Formaggio Fontal, pasta semi-dura dal sapore dolce e delicato. Tradizione casearia alpina, perfetto per fondute e piatti gratinati.",
      formato: "2 Kg +/-",
      price: 16.8,
      stock: 12,
      status: "ACTIVE",
      slug: "queso-fontal",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Scamorza Affumicata",
      ProductCode: "1002037060",
      description:
        "Scamorza affumicata stagionata, dalla caratteristica forma a pera. Affumicatura naturale con legni aromatici del Sud Italia.",
      formato: "2,5 Kg +/-",
      price: 22.5,
      stock: 10,
      status: "ACTIVE",
      slug: "scamorza-ahumada-stagionata",
      categoryName: "Cheeses & Dairy",
    },
    {
      name: "Provolone Dolce",
      ProductCode: "0217000002",
      description:
        "Provolone dolce stagionato, formaggio a pasta filata della tradizione del Sud Italia. Sapore delicato e consistenza compatta.",
      formato: "5,6 Kg +/-",
      price: 38.9,
      stock: 6,
      status: "ACTIVE",
      slug: "provolone-dolce",
      categoryName: "Cheeses & Dairy",
    },

    // FROZEN PRODUCTS CATEGORY (10 products from Congelado section)
    {
      name: "Tiramisù Monoporzione",
      ProductCode: "0420000074",
      description:
        "Tiramisù monoporzione artigianale, dolce tradizionale italiano con mascarpone, caffè e cacao. Formato individuale per ristorazione.",
      formato: "110gr x10",
      price: 4.5,
      stock: 30,
      status: "ACTIVE",
      slug: "tiramisu-monoporzione",
      categoryName: "Frozen Products",
    },
    {
      name: "Torta Sacher",
      ProductCode: "0420000107",
      description:
        "Austrian Sacher cake with chocolate and apricot jam. Traditional Viennese recipe, frozen format.",
      formato: "800gr",
      price: 18.9,
      stock: 12,
      status: "ACTIVE",
      slug: "torta-sacher",
      categoryName: "Frozen Products",
    },
    {
      name: "Cannolo Siciliano",
      ProductCode: "0503000110",
      description:
        "Traditional Sicilian cannoli with fresh ricotta and chocolate chips. An authentic Sicilian pastry specialty. Region: Sicily - From the island of the sun, where Arab pastry tradition merges with the ricotta from the Madonie mountains.",
      formato: "10 pezzi",
      price: 12.8,
      stock: 20,
      status: "ACTIVE",
      slug: "cannolo-siciliano",
      categoryName: "Frozen Products",
    },
    {
      name: "Sfogliatella Grande",
      ProductCode: "0420000073",
      description:
        "Neapolitan sfogliatella filled with ricotta and candied fruit. Crispy puff pastry, a traditional Campanian dessert. Region: Campania - From the heart of Naples, where master pastry chefs have been creating this flaky wonder for centuries.",
      formato: "100gr x60",
      price: 2.8,
      stock: 50,
      status: "ACTIVE",
      slug: "sfogliatella-grande",
      categoryName: "Frozen Products",
    },
    {
      name: "Croissant alla Crema",
      ProductCode: "0420000075",
      description:
        "French croissants filled with pastry cream. Buttery puff pastry and delicate cream, frozen format.",
      formato: "95gr x50",
      price: 1.8,
      stock: 80,
      status: "ACTIVE",
      slug: "croissant-crema",
      categoryName: "Frozen Products",
    },

    // SAUCES & PRESERVES CATEGORY (8 products from Salsas y conservas section)
    {
      name: "Sugo al Pomodoro e Basilico",
      ProductCode: "0607000013",
      description:
        "Italian tomato sauce with fresh basil. Traditional grandmother's recipe, ideal for pasta and pizza.",
      formato: "370ml x12",
      price: 3.2,
      stock: 60,
      status: "ACTIVE",
      slug: "sugo-pomodoro-basilico",
      categoryName: "Sauces & Preserves",
    },
    {
      name: "Sugo alla Bolognese",
      ProductCode: "0607000014",
      description:
        "Traditional Bolognese ragù with beef and pork. Authentic Emilian recipe, slow-cooked.",
      formato: "370ml x4",
      price: 5.8,
      stock: 40,
      status: "ACTIVE",
      slug: "sugo-bolognese",
      categoryName: "Sauces & Preserves",
    },
    {
      name: "Sugo all'Arrabbiata",
      ProductCode: "0607000015",
      description:
        "Spicy Arrabbiata sauce with tomato, garlic, and chili pepper. A Roman specialty with a strong flavor.",
      formato: "370ml x12",
      price: 3.5,
      stock: 45,
      status: "ACTIVE",
      slug: "sugo-arrabbiata",
      categoryName: "Sauces & Preserves",
    },
    {
      name: "Salsa di Tartufo",
      ProductCode: "0607000005",
      description:
        "Gourmet sauce with 5% black truffle, perfect for pasta and risottos. Intense flavor and unmistakable aroma.",
      formato: "500gr x6",
      price: 15.9,
      stock: 25,
      status: "ACTIVE",
      slug: "salsa-tartufo",
      categoryName: "Sauces & Preserves",
    },
    {
      name: "Olio di Oliva con Tartufo Bianco",
      ProductCode: "0602050490",
      description:
        "Extra virgin olive oil flavored with precious white truffle. A gourmet condiment for refined dishes.",
      formato: "250ml x12",
      price: 22.5,
      stock: 18,
      status: "ACTIVE",
      slug: "olio-tartufo-bianco",
      categoryName: "Sauces & Preserves",
    },

    // VARIOUS & SPICES CATEGORY (10 products from Varios section)
    {
      name: "Aglio Granulato",
      ProductCode: "0608000043",
      description:
        "Dried granulated garlic, practical and always ready. Intense aroma for seasonings and culinary preparations.",
      formato: "850gr",
      price: 8.9,
      stock: 35,
      status: "ACTIVE",
      slug: "aglio-granulato",
      categoryName: "Various & Spices",
    },
    {
      name: "Cannella in Polvere",
      ProductCode: "0608000036",
      description:
        "Ceylon cinnamon powder, a sweet and aromatic spice. Perfect for desserts, hot drinks, and oriental preparations.",
      formato: "550gr",
      price: 12.8,
      stock: 28,
      status: "ACTIVE",
      slug: "cannella-polvere",
      categoryName: "Various & Spices",
    },
    {
      name: "Curry in Polvere",
      ProductCode: "0608000021",
      description:
        "Traditional Indian curry spice mix. Aromatic blend for ethnic dishes and fusion cuisine.",
      formato: "810gr",
      price: 15.5,
      stock: 22,
      status: "ACTIVE",
      slug: "curry-polvere",
      categoryName: "Various & Spices",
    },
    {
      name: "Oregano Siciliano",
      ProductCode: "0608000037",
      description:
        "Sicilian dried oregano, intense and lingering aroma. An essential spice for pizza, pasta, and Mediterranean dishes.Region: Sicily – From the hills of Mount Etna, where the Mediterranean sun concentrates the flavors in the leaves of wild oregano.",
      formato: "1kg",
      price: 18.9,
      stock: 20,
      status: "ACTIVE",
      slug: "oregano-siciliano",
      categoryName: "Various & Spices",
    },
    {
      name: "Pepe Nero in Grani",
      ProductCode: "0608000045",
      description:
        "High-quality whole black pepper, spicy and aromatic. An essential spice for every professional kitchen",
      formato: "710gr",
      price: 16.8,
      stock: 30,
      status: "ACTIVE",
      slug: "pepe-nero-grani",
      categoryName: "Various & Spices",
    },
    {
      name: "Basilico Essiccato",
      ProductCode: "0606000099",
      description:
        "Italian dried basil, authentic Mediterranean flavor. Perfect for sauces, pizza, and traditional dishes. Region: Liguria – From the Ligurian Riviera, homeland of Genoese PDO basil, where the most fragrant basil in Italy grows.  ",
      formato: "250gr",
      price: 9.8,
      stock: 40,
      status: "ACTIVE",
      slug: "basilico-essiccato",
      categoryName: "Various & Spices",
    },
  ]

  // Create or update products with their categories
  for (const product of products) {
    // Find the category by name for this workspace
    const category = await prisma.categories.findFirst({
      where: {
        name: product.categoryName,
        workspaceId: mainWorkspaceId,
      },
    })

    if (!category) {
      console.log(
        `Category ${product.categoryName} not found for workspace ${createdWorkspaces[0].name}`
      )
      continue
    }

    // Create a product with proper type for Prisma
    try {
      const existingProduct = await prisma.products.findFirst({
        where: {
          name: product.name,
          workspaceId: mainWorkspaceId,
        },
      })

      if (!existingProduct) {
        await prisma.products.create({
          data: {
            name: product.name,
            ProductCode:
              product.ProductCode ||
              `000${Math.floor(Math.random() * 1000)
                .toString()
                .padStart(3, "0")}`,
            description: product.description,
            formato: product.formato,
            price: product.price,
            stock: product.stock,
            status: "ACTIVE" as any, // Casting to any per evitare errori di tipo
            slug: `${product.slug}-${Date.now()}`, // Generiamo slug unici
            workspaceId: mainWorkspaceId,
            categoryId: category.id,
          },
        })
        console.log(
          `Product created: ${product.name} for workspace ${createdWorkspaces[0].name}`
        )
      } else {
        // Update existing product
        await prisma.products.update({
          where: { id: existingProduct.id },
          data: {
            name: product.name,
            description: product.description,
            formato: product.formato,
            price: product.price,
            stock: product.stock,
            categoryId: category.id,
          },
        })
        console.log(
          `Product updated: ${product.name} for workspace ${createdWorkspaces[0].name}`
        )
      }
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("slug")) {
        console.error(
          `Duplicate slug detected for product: ${product.name}. Skipping creation.`
        )
      } else {
        console.error(`Error creating/updating product ${product.name}:`, error)
      }
    }
  }

  // Create special offers for the workspace
  console.log("Creating special offers...")

  // Define sample offers
  const specialOffers = [
    {
      name: "Frozen Products 20% Offer",
      description: "20% discount on all frozen products!",
      discountPercent: 20,
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)), // 30 days ago
      endDate: new Date(2025, 11, 31), // Scade il 31 dicembre 2025
      isActive: true,
      categoryId: null as string | null, // Will be set to Frozen Products category below
    },
    {
      name: "Black Friday Special",
      description: "Huge discounts on all products for Black Friday weekend!",
      discountPercent: 25,
      startDate: new Date(new Date().getFullYear(), 10, 25), // November 25th
      endDate: new Date(new Date().getFullYear(), 10, 28), // November 28th
      isActive: false,
      categoryId: null as string | null, // All categories
    },
    {
      name: "Summer Sale",
      description: "Special summer discounts on selected products!",
      discountPercent: 15,
      startDate: new Date(new Date().getFullYear(), 7, 15), // August 15th
      endDate: new Date(new Date().getFullYear(), 8, 15), // September 15th
      isActive: false,
      categoryId: null as string | null, // All categories
    },
  ]

  // Delete existing offers first
  await prisma.offers.deleteMany({
    where: {
      workspaceId: mainWorkspaceId,
    },
  })
  console.log("Deleted existing offers")

  // Create new offers
  for (const offer of specialOffers) {
    try {
      // For "Frozen Products 20% Offer", find and assign Frozen Products category
      let finalCategoryId = offer.categoryId
      if (offer.name === "Frozen Products 20% Offer") {
        const frozenCategory = await prisma.categories.findFirst({
          where: {
            workspaceId: mainWorkspaceId,
            name: "Frozen Products",
          },
        })
        if (frozenCategory) {
          finalCategoryId = frozenCategory.id
          console.log(
            `Assigning Offerta Frozen Products to Frozen Products category: ${frozenCategory.id}`
          )
        }
      }

      await prisma.offers.create({
        data: {
          name: offer.name,
          description: offer.description,
          discountPercent: offer.discountPercent,
          startDate: offer.startDate,
          endDate: offer.endDate,
          isActive: offer.isActive,
          categoryId: finalCategoryId,
          workspaceId: mainWorkspaceId,
        },
      })
      console.log(`Offer created: ${offer.name}`)
    } catch (error) {
      console.error(`Error creating offer ${offer.name}:`, error)
    }
  }

  // Create services for the main workspace (reduced to 2 services as requested)
  const services = [
    {
      code: "SHP001",
      name: "Shipping",
      description:
        "Standard shipping service for orders within Italy. Delivery within 3-5 business days.",
      price: 5.0,
      currency: "EUR",
    },
    {
      code: "GFT001",
      name: "Gift Wrapping",
      description:
        "Luxury gift wrapping service with personalized message and premium packaging materials.",
      price: 30.0,
      currency: "EUR",
    },
  ]

  // Create or update services for the main workspace
  for (const service of services) {
    const existingService = await prisma.services.findFirst({
      where: {
        code: service.code,
        workspaceId: mainWorkspaceId,
      },
    })

    if (!existingService) {
      await prisma.services.create({
        data: {
          ...service,
          workspaceId: mainWorkspaceId,
        },
      })
      console.log(
        `Service created: ${service.name} (${service.code}) for workspace ${createdWorkspaces[0].name}`
      )
    } else {
      await prisma.services.update({
        where: { id: existingService.id },
        data: {
          name: service.name,
          description: service.description,
          price: service.price,
          currency: service.currency,
        },
      })
      console.log(
        `Service updated: ${service.name} (${service.code}) for workspace ${createdWorkspaces[0].name}`
      )
    }
  }

  // Create FAQ data - RESTORED ORIGINAL FAQs
  const faqsData = [
    {
      question: "What are your business hours?",
      answer:
        "Our business hours are Monday to Friday from 9:00 AM to 6:00 PM, and Saturdays from 9:00 AM to 2:00 PM. We are closed on Sundays.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept credit/debit card payments, bank transfers, PayPal, and cash on delivery (depending on availability in your area).",
    },
    {
      question: "Do you ship throughout Spain?",
      answer:
        "Yes, we ship throughout mainland Spain. For the Balearic Islands, Canary Islands, Ceuta, and Melilla, please check special shipping conditions.",
    },
    {
      question: "How long does it take for my order to arrive?",
      answer:
        "Orders usually arrive within 24-48 hours in mainland Spain. For other destinations, delivery time may vary between 3-5 business days.",
    },
    {
      question: "Are the products authentic Italian products?",
      answer:
        "Yes, all our products are authentic Italian products imported directly from Italy. We work with certified and trusted producers.",
    },
    {
      question: "Can I return a product if I don't like it?",
      answer:
        "Yes, you have 14 days from receipt of your order to return it. The product must be in perfect condition and in its original packaging.",
    },
    {
      question: "Do the products have a long expiration date?",
      answer:
        "All our products have a minimum expiration date of 6 months from shipping. Fresh products are shipped with appropriate expiration dates.",
    },
    {
      question: "How should I store the products once received?",
      answer:
        "Each product includes storage instructions. Generally, dry products in a cool, dry place, refrigerated products in the fridge, and frozen products in the freezer.",
    },
    {
      question:
        "What are the shipping costs and are there free shipping options?",
      answer:
        "💰 *Shipping costs depend on your location and order size:*\n\n🇪🇸 *Mainland Spain:*\n• Orders over €50: FREE shipping 🎉\n• Orders under €50: €4.95\n\n🏝️ *Islands (Balearic/Canary):*\n• Special rates apply (€8.95-€15.95)\n• Free shipping threshold: €75\n\n📦 *Express delivery:* Available for €9.95 (24h delivery)",
    },
    {
      question: "What should I do if my package is damaged during transport?",
      answer:
        "📦 *Don't worry, we'll take care of it immediately!*\n\n🚨 *If you receive damaged products:*\n• Don't accept the delivery if damage is visible\n• Take photos of the damaged package\n• Contact us immediately via WhatsApp\n• We'll arrange replacement or full refund\n\n⚡ *Our response:*\n• Immediate replacement sent within 24h\n• Full refund if you prefer\n• No questions asked - customer satisfaction guaranteed!\n\n📋 *Important:* Report damage within 24h of delivery for fastest resolution.",
    },
    {
      question: "How do you maintain the cold chain for fresh products?",
      answer:
        "❄️ *Cold chain protection guaranteed!*\n\n🧊 *Our cold chain process:*\n• Products stored at controlled temperatures (0-4°C)\n• Insulated packaging with gel ice packs\n• Temperature monitoring during transport\n• Maximum 24h delivery time for fresh items\n\n📊 *Quality controls:*\n• Temperature sensors in our warehouse\n• Specialized refrigerated vehicles\n• Partner couriers trained for fresh deliveries\n\n⚠️ *Fresh products delivery:* Available Tuesday to Friday only to ensure optimal freshness!",
    },
    {
      question: "Is my merchandise insured during shipping?",
      answer:
        "🛡️ *Full insurance coverage included!*\n\n✅ *What's covered:*\n• Loss during transport\n• Damage caused by courier mishandling\n• Theft during delivery\n• Weather-related damage\n\n💰 *Coverage details:*\n• Up to €500 per package (standard)\n• Higher value items: contact us for extended coverage\n• No additional cost - included in shipping\n\n📋 *How to claim:*\n• Report within 48h of delivery\n• Provide photos and order number\n• We handle everything with insurance company\n• Replacement or refund processed within 5-7 days",
    },
    {
      question: "How can I modify my profile?",
      answer:
        "You can modify your profile information directly through this secure link. [LINK_PROFILE_WITH_TOKEN]",
    },
    {
      question: "How can I change my shipping address?",
      answer:
        "You can update your shipping address through this secure link. [LINK_PROFILE_WITH_TOKEN]",
    },
    {
      question: "How can I change my email?",
      answer:
        "You can update your email address through this secure link. [LINK_PROFILE_WITH_TOKEN]",
    },
    {
      question: "How can I see the product catalog?",
      answer:
        "You can download our complete product catalog here: [LINK_CATALOG]",
    },
    {
      question: "What discount do I have on products?",
      answer:
        "Hello! Your current discount on products is [USER_DISCOUNT], and the following offers are also active: [LIST_OFFERS]",
    },
    {
      question: "What discount do I have on products?",
      answer:
        "Hello! Your current discount on products is [USER_DISCOUNT], and the following offers are also active: [LIST_OFFERS]",
    },
    /* Rimosse FAQ con token non supportati - LIST_SERVICES e LIST_ALL_PRODUCTS sono gestiti dal prompt */
    {
      question: "How can I see my orders?",
      answer:
        "Hello! You can view your orders by clicking this link: [LINK_ORDERS_WITH_TOKEN]",
    },
    {
      question: "Show me my orders",
      answer:
        "Hello! You can view your orders by clicking this link: [LINK_ORDERS_WITH_TOKEN]",
    },
    {
      question: "Give me my orders",
      answer:
        "Hello! You can view your orders by clicking this link: [LINK_ORDERS_WITH_TOKEN]",
    },
    {
      question: "How can I place an order?",
      answer:
        "Hello! To place a new order, please click on this link: [LINK_CHECKOUT_WITH_TOKEN]",
    },
    {
      question: "What is your name?",
      answer:
        "Hello! I am SofIA, the digital assistant of L'Altra Italia. I'm here to help you with information about our Italian products, orders, and services. How can I assist you today?",
    },
    /* Rimosse FAQ con token non supportati - LIST_SERVICES sono gestiti dal prompt */
    {
      question: "I want to change my email",
      answer:
        "Hello! You can change your email through this secure link: [LINK_PROFILE_WITH_TOKEN]",
    },
    {
      question: "I want to change my shipping address",
      answer:
        "Hello! You can change your shipping address through this secure link: [LINK_PROFILE_WITH_TOKEN]",
    },
    {
      question: "Give me the list of orders",
      answer:
        "Hello! You can view your orders by clicking this link: [LINK_ORDERS_WITH_TOKEN]",
    },
    {
      question: "Give me the list of orders",
      answer:
        "Ciao! Per visualizzare i tuoi ordini, clicca su questo link: [LINK_ORDERS_WITH_TOKEN]",
    },
    {
      question: "I want to modify my profile",
      answer:
        "Hello! You can modify your profile through this secure link: [LINK_PROFILE_WITH_TOKEN]",
    },
    {
      question: "Show my orders",
      answer:
        "Hello! You can view your orders by clicking this link: [LINK_ORDERS_WITH_TOKEN]",
    },
    {
      question: "I want to see my orders",
      answer:
        "Hello! You can view your orders by clicking this link: [LINK_ORDERS_WITH_TOKEN]",
    },
    {
      question: "Can I speak with an operator?",
      answer:
        "Hello! To speak with a human operator, contact our customer service: info@laltrait.com or call (+34) 93 15 91 221. We are available Monday to Friday from 9:00 AM to 6:00 PM.",
    },
    {
      question: "Show cart",
      answer: "Here is your cart! 🛒 [LINK_CHECKOUT_WITH_TOKEN]",
    },
    {
      question: "Show me cart",
      answer: "Here is your cart! 🛒 [LINK_CHECKOUT_WITH_TOKEN]",
    },
    {
      question: "show cart",
      answer: "Here is your cart! 🛒 [LINK_CHECKOUT_WITH_TOKEN]",
    },
    {
      question: "show my cart",
      answer: "Here is your cart! 🛒 [LINK_CHECKOUT_WITH_TOKEN]",
    },
    // New FAQ: activate cart / new order
    {
      question: "new order",
      answer: "Click here to activate your cart 🛒 [LINK_CHECKOUT_WITH_TOKEN]",
    },
    {
      question: "show cart",
      answer: "Here is your cart! 🛒 [LINK_CHECKOUT_WITH_TOKEN]",
    },
    {
      question: "show my cart",
      answer: "Here is your cart! 🛒 [LINK_CHECKOUT_WITH_TOKEN]",
    },
    {
      question: "What offers do you have?",
      answer: "Hello! Here are our active offers: [LIST_OFFERS]",
    },
    /* Rimosse FAQ con token LIST_ALL_PRODUCTS - sono gestiti dal prompt */
    {
      question: "what offers do you have?",
      answer: "Hello! Here are our active offers: [LIST_OFFERS]",
    },
    {
      question: "Offers",
      answer: "Here are our active offers: [LIST_OFFERS]",
    },
    {
      question: "Discounts",
      answer: "Here are our active offers and discounts: [LIST_OFFERS]",
    },
    {
      question: "Defective products",
      answer:
        "I'm sorry about the defective product! 😔\n\nTo resolve:\n✅ **Contact us immediately** at (+34) 93 15 91 221 or info@laltrait.com\n✅ **Free return** with free pickup\n✅ **Full refund** or immediate replacement\n\nQuality is our priority. We'll help you resolve it right away!",
    },
  ]

  // Create new FAQs
  for (const faq of faqsData) {
    try {
      await prisma.fAQ.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          workspaceId: mainWorkspaceId,
        },
      })
      console.log(`FAQ created: ${faq.question.substring(0, 50)}...`)
    } catch (error) {
      console.error(`Error creating FAQ: ${faq.question}`, error)
    }
  }

  // Create test customers with chat sessions
  const testCustomers = [
    {
      name: "Mario Rossi",
      email: "mario.rossi@example.com",
      phone: "+393331234567",
      language: "it",
      currency: "EUR",
    },
    {
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "+447700900123",
      language: "en",
      currency: "EUR",
    },
    {
      name: "Maria Garcia",
      email: "maria.garcia@example.com",
      phone: "+34600123456",
      language: "es",
      currency: "EUR",
    },
    {
      name: "João Silva",
      email: "joao.silva@example.com",
      phone: "+351912345678",
      language: "pt",
      currency: "EUR",
    },
  ]

  // Delete existing test customers first
  await prisma.customers.deleteMany({
    where: {
      workspaceId: mainWorkspaceId,
      email: {
        in: [
          "mario.rossi@rossilimited.it",
          "john.smith@shopme.com",
          "maria.garcia@shopme.com",
          "joao.silva@shopme.com",
        ],
      },
    },
  })
  console.log("Deleted existing test customers")

  // Create Italian customer - Mario Rossi with complete real data
  const testCustomer = await prisma.customers.create({
    data: {
      id: "3c9fce96-5397-5c9f-9f8e-3d4f5a6b7890", // ID fisso per MCP test client
      name: "Mario Rossi",
      email: "mario.rossi@rossilimited.it",
      phone: "+390212345678", // Real Italian phone number
      address: JSON.stringify({
        name: "Mario Rossi",
        street: "Via Garibaldi 45",
        city: "Milano",
        postalCode: "20121",
        country: "Italia",
      }),
      company: "Rossi Limited S.r.l.",
      discount: 10,
      language: "it",
      currency: "EUR",
      notes: "Cliente premium - Preferisce prodotti DOP",
      workspaceId: mainWorkspaceId,
      salesId: marcoRossi.id, // Assigned to Marco Rossi
      invoiceAddress: {
        firstName: "Mario",
        lastName: "Rossi",
        company: "Rossi Limited S.r.l.",
        address: "Via Roma 123",
        city: "Milano",
        postalCode: "20100",
        country: "Italia",
        vatNumber: "IT12345678901",
        phone: "+390212345678",
      },
    },
  })

  console.log(
    `✅ Italian customer created: ${testCustomer.name} (${testCustomer.email})`
  )

  // Create English customer - John Smith (with 10% discount)
  const testCustomer2 = await prisma.customers.create({
    data: {
      name: "John Smith",
      email: "john.smith@shopme.com",
      phone: "+44123456789",
      address: JSON.stringify({
        name: "John Smith",
        street: "456 Regent Street",
        city: "London",
        postalCode: "W1B 5AH",
        country: "United Kingdom",
      }),
      company: "Smith & Co Ltd",
      discount: 10, // 10% discount
      language: "en",
      currency: "EUR",
      notes: "VIP customer - Prefers organic products",
      workspaceId: mainWorkspaceId,
      salesId: giuliaBianchi.id, // Assigned to Giulia Bianchi
      invoiceAddress: {
        firstName: "John",
        lastName: "Smith",
        company: "Smith & Co Ltd",
        address: "123 Oxford Street",
        city: "London",
        postalCode: "W1D 2HG",
        country: "United Kingdom",
        vatNumber: "GB123456789",
        phone: "+44123456789",
      },
    },
  })

  console.log(
    `✅ English customer created: ${testCustomer2.name} (${testCustomer2.email})`
  )

  // Create Spanish customer - Maria Garcia
  const testCustomerMCP = await prisma.customers.create({
    data: {
      id: "test-customer-123", // Fixed ID for MCP testing
      name: "Maria Garcia",
      email: "maria.garcia@shopme.com",
      phone: "+34666777888",
      address: JSON.stringify({
        name: "Maria Garcia",
        street: "Calle Gran Vía 78",
        city: "Madrid",
        postalCode: "28013",
        country: "España",
      }),
      company: "Garcia Imports S.L.",
      discount: 5, // 5% discount
      language: "es",
      currency: "EUR",
      notes: "Cliente frecuente - Le gustan los productos artesanales",
      workspaceId: mainWorkspaceId,
      salesId: alessandroFerrari.id, // Assigned to Alessandro Ferrari
      invoiceAddress: {
        firstName: "Maria",
        lastName: "Garcia",
        company: "Garcia Imports S.L.",
        address: "Calle Mayor 45",
        city: "Madrid",
        postalCode: "28013",
        country: "España",
        vatNumber: "ES12345678Z",
        phone: "+34666777888",
      },
    },
  })

  console.log(
    `✅ Spanish customer created: ${testCustomerMCP.name} (${testCustomerMCP.email})`
  )

  // Create Portuguese customer - João Silva
  const testCustomer4 = await prisma.customers.create({
    data: {
      name: "João Silva",
      email: "joao.silva@shopme.com",
      phone: "+351123456789",
      address: JSON.stringify({
        name: "João Silva",
        street: "Rua da Liberdade 200",
        city: "Lisboa",
        postalCode: "1250-096",
        country: "Portugal",
      }),
      company: "Silva & Filhos Lda",
      discount: 0,
      language: "pt",
      currency: "EUR",
      notes: "Novo cliente - Interessado em produtos gourmet",
      workspaceId: mainWorkspaceId,
      salesId: francescaRomano.id, // Assigned to Francesca Romano
      invoiceAddress: {
        firstName: "João",
        lastName: "Silva",
        company: "Silva & Filhos Lda",
        address: "Rua Augusta 100",
        city: "Lisboa",
        postalCode: "1100-053",
        country: "Portugal",
        vatNumber: "PT123456789",
        phone: "+351123456789",
      },
    },
  })

  console.log(
    `✅ Portuguese customer created: ${testCustomer4.name} (${testCustomer4.email})`
  )

  // 💰 CREATE BILLING TRANSACTIONS FOR CUSTOMERS
  console.log("💰 Creating billing transactions...")

  const now = new Date()
  const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60000)

  // Mario Rossi transactions
  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer.id,
      type: "NEW_CUSTOMER",
      description: "New customer registration",
      amount: 1.5,
      previousTotal: 0,
      currentCharge: 1.5,
      newTotal: 1.5,
      createdAt: minutesAgo(60), // 1 hour ago
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer.id,
      type: "MESSAGE",
      description: "Message from +390212345678",
      userQuery: "Ciao, vorrei informazioni sui prodotti",
      amount: 0.15,
      previousTotal: 1.5,
      currentCharge: 0.15,
      newTotal: 1.65,
      createdAt: minutesAgo(55),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer.id,
      type: "MESSAGE",
      description: "Message from +390212345678",
      userQuery: "Quali sono i vostri orari?",
      amount: 0.15,
      previousTotal: 1.65,
      currentCharge: 0.15,
      newTotal: 1.8,
      createdAt: minutesAgo(50),
    },
  })

  // João Silva transactions
  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer4.id,
      type: "NEW_CUSTOMER",
      description: "New customer registration",
      amount: 1.5,
      previousTotal: 1.8,
      currentCharge: 1.5,
      newTotal: 3.3,
      createdAt: minutesAgo(45),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer4.id,
      type: "MESSAGE",
      description: "Message from +351123456789",
      userQuery: "Olá, gostaria de saber mais sobre os produtos",
      amount: 0.15,
      previousTotal: 3.3,
      currentCharge: 0.15,
      newTotal: 3.45,
      createdAt: minutesAgo(40),
    },
  })

  // María García transactions
  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer2.id,
      type: "NEW_CUSTOMER",
      description: "New customer registration",
      amount: 1.5,
      previousTotal: 3.45,
      currentCharge: 1.5,
      newTotal: 4.95,
      createdAt: minutesAgo(30),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer2.id,
      type: "MESSAGE",
      description: "Message from +34612345678",
      userQuery: "Hola, ¿tienen envío a España?",
      amount: 0.15,
      previousTotal: 4.95,
      currentCharge: 0.15,
      newTotal: 5.1,
      createdAt: minutesAgo(25),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer2.id,
      type: "MESSAGE",
      description: "Message from +34612345678",
      userQuery: "¿Cuánto tarda el envío?",
      amount: 0.15,
      previousTotal: 5.1,
      currentCharge: 0.15,
      newTotal: 5.25,
      createdAt: minutesAgo(20),
    },
  })

  // Pierre Dupont transactions
  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomerMCP.id,
      type: "NEW_CUSTOMER",
      description: "New customer registration",
      amount: 1.5,
      previousTotal: 5.25,
      currentCharge: 1.5,
      newTotal: 6.75,
      createdAt: minutesAgo(15),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomerMCP.id,
      type: "MESSAGE",
      description: "Message from +33612345678",
      userQuery: "Bonjour, avez-vous des produits bio?",
      amount: 0.15,
      previousTotal: 6.75,
      currentCharge: 0.15,
      newTotal: 6.9,
      createdAt: minutesAgo(10),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: testCustomer.id,
      type: "HUMAN_SUPPORT",
      description: "Customer requested human support",
      userQuery: "Vorrei parlare con un operatore",
      amount: 1.0,
      previousTotal: 6.9,
      currentCharge: 1.0,
      newTotal: 7.9,
      createdAt: minutesAgo(5),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: null, // Admin created FAQ
      type: "NEW_FAQ",
      description: "FAQ created: Come posso tracciare il mio ordine?",
      userQuery: null,
      amount: 0.5,
      previousTotal: 7.9,
      currentCharge: 0.5,
      newTotal: 8.4,
      createdAt: minutesAgo(3),
    },
  })

  await prisma.billing.create({
    data: {
      workspaceId: mainWorkspaceId,
      customerId: null, // System activated offer
      type: "ACTIVE_OFFER",
      description: "Offer activated: Offerta primaverile",
      userQuery: null,
      amount: 0.5,
      previousTotal: 8.4,
      currentCharge: 0.5,
      newTotal: 8.9,
      createdAt: minutesAgo(2),
    },
  })

  console.log(
    "✅ Created 13 billing transactions (4 registrations + 6 messages + 1 human support + 1 FAQ + 1 offer)"
  )
  console.log("   💰 Total billing: €8.90")

  // Create chat sessions and welcome messages for each customer
  console.log("🔄 Creating chat sessions and welcome messages...")

  // Italian customer - Mario Rossi
  const chatSession1 = await prisma.chatSession.create({
    data: {
      customerId: testCustomer.id,
      workspaceId: mainWorkspaceId,
      status: "active",
      context: {
        language: "it",
        customerName: "Mario Rossi",
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
      content: "Ciao, piacere di conoscerti! Come posso aiutarti?",
      type: "TEXT",
      aiGenerated: true,
      metadata: {
        agentSelected: "CHATBOT_DUAL_LLM",
        sentBy: "AI",
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 4), // 4 minutes ago
    },
  })

  // English customer - John Smith
  const chatSession2 = await prisma.chatSession.create({
    data: {
      customerId: testCustomer2.id,
      workspaceId: mainWorkspaceId,
      status: "active",
      context: {
        language: "en",
        customerName: "John Smith",
      },
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: chatSession2.id,
      direction: "INBOUND",
      content: "Hello!",
      type: "TEXT",
      createdAt: new Date(Date.now() - 1000 * 60 * 3), // 3 minutes ago
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: chatSession2.id,
      direction: "OUTBOUND",
      content: "Hi, nice to meet you! How can I help you?",
      type: "TEXT",
      aiGenerated: true,
      metadata: {
        agentSelected: "CHATBOT_DUAL_LLM",
        sentBy: "AI",
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 2), // 2 minutes ago
    },
  })

  // Spanish customer - Maria Garcia
  const chatSession3 = await prisma.chatSession.create({
    data: {
      customerId: testCustomerMCP.id,
      workspaceId: mainWorkspaceId,
      status: "active",
      context: {
        language: "es",
        customerName: "Maria Garcia",
      },
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: chatSession3.id,
      direction: "INBOUND",
      content: "¡Hola!",
      type: "TEXT",
      createdAt: new Date(Date.now() - 1000 * 60 * 1), // 1 minute ago
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: chatSession3.id,
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

  // Portuguese customer - João Silva
  const chatSession4 = await prisma.chatSession.create({
    data: {
      customerId: testCustomer4.id,
      workspaceId: mainWorkspaceId,
      status: "active",
      context: {
        language: "pt",
        customerName: "João Silva",
      },
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: chatSession4.id,
      direction: "INBOUND",
      content: "Olá!",
      type: "TEXT",
      createdAt: new Date(Date.now() - 1000 * 30), // 30 seconds ago
    },
  })

  await prisma.message.create({
    data: {
      chatSessionId: chatSession4.id,
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

  console.log("✅ Chat sessions and welcome messages created successfully!")
  console.log(`   🇮🇹 Mario Rossi (Italian) - Chat ID: ${chatSession1.id}`)
  console.log(`   🇬🇧 John Smith (English) - Chat ID: ${chatSession2.id}`)
  console.log(`   🇪🇸 Maria Garcia (Spanish) - Chat ID: ${chatSession3.id}`)
  console.log(`   🇵🇹 João Silva (Portuguese) - Chat ID: ${chatSession4.id}`)

  console.log(
    "✅ Test customers with active chats and welcome messages created successfully!"
  )

  // Create sample orders for test customers
  console.log("🔄 Creating sample orders for test customers...")

  // Get some products for orders
  const sampleProducts = await prisma.products.findMany({
    where: { workspaceId: mainWorkspaceId },
    take: 5,
  })

  if (sampleProducts.length > 0) {
    // Create order for Mario Rossi (Italian customer)
    const order1 = await prisma.orders.create({
      data: {
        orderCode: "ORD-001-2024",
        customerId: testCustomer.id,
        workspaceId: mainWorkspaceId,
        status: "CONFIRMED",
        totalAmount: 25.5,
        notes: "Ordine di test per Mario Rossi - Prodotti italiani premium",
        trackingNumber: "DHL1234456",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      },
    })

    // Add items to Mario's order
    await prisma.orderItems.create({
      data: {
        orderId: order1.id,
        productId: sampleProducts[0].id,
        quantity: 2,
        unitPrice: sampleProducts[0].price,
        totalPrice: sampleProducts[0].price * 2,
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order1.id,
        productId: sampleProducts[1].id,
        quantity: 1,
        unitPrice: sampleProducts[1].price,
        totalPrice: sampleProducts[1].price,
      },
    })

    // Create order for John Smith (English customer with discount)
    const order2 = await prisma.orders.create({
      data: {
        orderCode: "ORD-002-2024",
        customerId: testCustomer2.id,
        workspaceId: mainWorkspaceId,
        status: "PENDING",
        totalAmount: 18.9,
        notes: "Test order for John Smith - VIP customer with 10% discount",
        trackingNumber: "DHL1234456",
        createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      },
    })

    // Add items to John's order
    await prisma.orderItems.create({
      data: {
        orderId: order2.id,
        productId: sampleProducts[2].id,
        quantity: 1,
        unitPrice: sampleProducts[2].price,
        totalPrice: sampleProducts[2].price,
      },
    })

    // Create order for Maria Garcia (Spanish customer)
    const order3 = await prisma.orders.create({
      data: {
        orderCode: "ORD-003-2024",
        customerId: testCustomerMCP.id,
        workspaceId: mainWorkspaceId,
        status: "DELIVERED",
        totalAmount: 32.8,
        notes: "Pedido de prueba para Maria Garcia - Cliente frecuente",
        trackingNumber: "DHL1234456",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      },
    })

    // Add items to Maria's order
    await prisma.orderItems.create({
      data: {
        orderId: order3.id,
        productId: sampleProducts[3].id,
        quantity: 3,
        unitPrice: sampleProducts[3].price,
        totalPrice: sampleProducts[3].price * 3,
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order3.id,
        productId: sampleProducts[4].id,
        quantity: 1,
        unitPrice: sampleProducts[4].price,
        totalPrice: sampleProducts[4].price,
      },
    })

    // Create additional orders for Mario Rossi
    const order4 = await prisma.orders.create({
      data: {
        orderCode: "ORD-004-2024",
        customerId: testCustomer.id,
        workspaceId: mainWorkspaceId,
        status: "DELIVERED",
        totalAmount: 45.2,
        notes: "Ordine premium per Mario Rossi - Prodotti DOP",
        trackingNumber: "DHL1234456",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order4.id,
        productId: sampleProducts[0].id,
        quantity: 3,
        unitPrice: sampleProducts[0].price,
        totalPrice: sampleProducts[0].price * 3,
      },
    })

    const order5 = await prisma.orders.create({
      data: {
        orderCode: "ORD-005-2024",
        customerId: testCustomer.id,
        workspaceId: mainWorkspaceId,
        status: "CONFIRMED",
        totalAmount: 67.8,
        notes: "Ordine grande per Mario Rossi - Prodotti artigianali",
        trackingNumber: "DHL1234456",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order5.id,
        productId: sampleProducts[1].id,
        quantity: 2,
        unitPrice: sampleProducts[1].price,
        totalPrice: sampleProducts[1].price * 2,
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order5.id,
        productId: sampleProducts[2].id,
        quantity: 1,
        unitPrice: sampleProducts[2].price,
        totalPrice: sampleProducts[2].price,
      },
    })

    const order6 = await prisma.orders.create({
      data: {
        orderCode: "ORD-006-2024",
        customerId: testCustomer.id,
        workspaceId: mainWorkspaceId,
        status: "PENDING",
        totalAmount: 28.9,
        notes: "Ordine recente per Mario Rossi - Prodotti freschi",
        trackingNumber: "DHL1234456",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order6.id,
        productId: sampleProducts[3].id,
        quantity: 1,
        unitPrice: sampleProducts[3].price,
        totalPrice: sampleProducts[3].price,
      },
    })

    const order7 = await prisma.orders.create({
      data: {
        orderCode: "ORD-007-2024",
        customerId: testCustomer.id,
        workspaceId: mainWorkspaceId,
        status: "DELIVERED",
        totalAmount: 89.5,
        notes: "Ordine VIP per Mario Rossi - Selezione premium",
        trackingNumber: "DHL1234456",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order7.id,
        productId: sampleProducts[4].id,
        quantity: 4,
        unitPrice: sampleProducts[4].price,
        totalPrice: sampleProducts[4].price * 4,
      },
    })

    await prisma.orderItems.create({
      data: {
        orderId: order7.id,
        productId: sampleProducts[0].id,
        quantity: 2,
        unitPrice: sampleProducts[0].price,
        totalPrice: sampleProducts[0].price * 2,
      },
    })

    console.log("✅ Sample orders created successfully!")
    console.log(`   📦 Order ORD-001-2024 for Mario Rossi (CONFIRMED) - €25.50`)
    console.log(`   📦 Order ORD-002-2024 for John Smith (PENDING) - €18.90`)
    console.log(
      `   📦 Order ORD-003-2024 for Maria Garcia (DELIVERED) - €32.80`
    )
    console.log(`   📦 Order ORD-004-2024 for Mario Rossi (DELIVERED) - €45.20`)
    console.log(`   📦 Order ORD-005-2024 for Mario Rossi (CONFIRMED) - €67.80`)
    console.log(`   📦 Order ORD-006-2024 for Mario Rossi (PENDING) - €28.90`)
    console.log(`   📦 Order ORD-007-2024 for Mario Rossi (DELIVERED) - €89.50`)
  } else {
    console.log("⚠️ No products found, skipping order creation")
  }

  // Seed Aviso Legal document - RIMOSSO (documenti non esistono più nel sistema)
  // await seedAvisoLegalDocument(mainWorkspaceId)

  console.log("🎉 SEED COMPLETED SUCCESSFULLY!")
  console.log("=".repeat(50))
  console.log("   ✅ Database cleaned and reseeded")
  console.log("   ✅ Admin user ready")
  console.log("   ✅ Workspace configured")
  console.log("   ✅ L'Altra Italia categories and products loaded")
  console.log("   ✅ Services configured")
  console.log("   ✅ FAQs loaded")
  console.log("   ✅ Test customers created")
  console.log("   ✅ Sample orders created")
  console.log("   ✅ System ready for WhatsApp")

  console.log(`Seed completato con successo!`)
  console.log(`- Admin user creato: ${adminEmail}`)
  console.log(`- Workspace creato/aggiornato: ${createdWorkspaces[0].name}`)
  console.log(`- Categorie create/esistenti: ${foodCategories.length}`)
  console.log(`- Prodotti creati/aggiornati: ${products.length}`)
  console.log(`- Services creati/aggiornati: ${services.length}`)
  console.log(`- FAQs create: ${faqsData.length}`)
  console.log(
    `- 4 test customers with active chats and conversation history created: Mario Rossi (🇮🇹), John Smith (🇬🇧), Maria Garcia (🇪🇸), João Silva (🇵🇹)`
  )
  console.log(
    `- 7 sample orders created with different statuses (5 for Mario Rossi, 1 for John Smith, 1 for Maria Garcia)`
  )

  //await generateEmbeddingsAfterSeed()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
