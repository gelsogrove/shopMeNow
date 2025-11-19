import {
  MessageDirection,
  MessageType,
  OrderStatus,
  PrismaClient,
} from "@prisma/client"
import * as dotenv from "dotenv"
import OpenAI from "openai"
import { BillingPrices } from "../domain/enums/billing-prices.enum"
import { websocketService } from "../services/websocket.service"
import logger from "../utils/logger"

/**
 * Apply Unicode strikethrough to text
 * Example: "€6.80" → "€̶6̶.̶8̶0̶"
 * Uses combining long stroke overlay (U+0336)
 */
function applyStrikethrough(text: string): string {
  return text
    .split("")
    .map((char) => char + "\u0336")
    .join("")
}

// Load environment variables
dotenv.config()

// Log API key status (safely)
const apiKey = process.env.OPENAI_API_KEY || ""
logger.info(
  `OpenAI API key status: ${
    apiKey ? "Present (length: " + apiKey.length + ")" : "Missing"
  }`
)
if (apiKey) {
  logger.info(`API key prefix: ${apiKey.substring(0, 10)}...`)
}

// OpenAI client instance
const openai = new OpenAI({
  apiKey: apiKey, // No default 'your-api-key-here' value, just use the actual key
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://laltroitalia.shop",
    "X-Title": "L'Altra Italia Shop",
  },
})

// Helper function to check if OpenAI is properly configured
function isOpenAIConfigured() {
  // In test environment, always return true
  if (process.env.NODE_ENV === "test") {
    return true
  }

  const apiKey = process.env.OPENAI_API_KEY
  // Log for debugging
  logger.info(
    `API key check - key present: ${!!apiKey}, key length: ${
      apiKey ? apiKey.length : 0
    }`
  )
  if (apiKey) {
    logger.info(`API key prefix: ${apiKey.substring(0, 10)}...`)
  }
  return apiKey && apiKey.length > 10 && apiKey !== "your-api-key-here"
}

export class MessageRepository {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Create a new chat session for a customer
   *
   * @param workspaceId The workspace ID
   * @param customerId The customer ID
   * @returns The created chat session
   */
  async createChatSession(workspaceId: string, customerId: string) {
    try {
      const session = await this.prisma.chatSession.create({
        data: {
          workspaceId,
          customerId,
          status: "active",
        },
      })

      logger.info(`Created new chat session: ${session.id}`)
      return session
    } catch (error) {
      logger.error("Error creating chat session:", error)
      throw new Error("Failed to create chat session")
    }
  }

  /**
   * Save a single message to the database
   *
   * @param chatSessionId The chat session ID
   * @param content The message content
   * @param direction The message direction (INBOUND or OUTBOUND)
   * @param type The message type
   * @param aiGenerated Whether the message was AI generated
   * @param metadata Additional metadata
   * @returns The created message
   */
  async saveOriginalMessage(
    chatSessionId: string,
    content: string,
    direction: MessageDirection,
    type: MessageType = MessageType.TEXT,
    aiGenerated: boolean = false,
    metadata: any = {}
  ) {
    try {
      const message = await this.prisma.message.create({
        data: {
          chatSessionId,
          content,
          direction,
          type,
          aiGenerated,
          metadata,
        },
      })

      logger.info(`Saved message: ${message.id}`)
      return message
    } catch (error) {
      logger.error("Error saving message:", error)
      throw new Error("Failed to save message")
    }
  }

  /**
   * Get chat session messages
   *
   * @param chatSessionId The chat session ID
   * @param workspaceId Optional workspace ID to filter
   * @returns The messages for the chat session (all messages, blacklist status affects only new message sending)
   */
  async getChatSessionMessages(chatSessionId: string, workspaceId?: string) {
    try {
      // First get the chat session to verify workspace
      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: chatSessionId,
          ...(workspaceId ? { workspaceId: workspaceId } : {}),
        },
        select: {
          id: true,
          customerId: true,
          workspaceId: true, // ✅ Add workspaceId to select
          customer: {
            select: {
              isBlacklisted: true,
              phone: true,
            },
          },
        },
      })

      if (!session) {
        logger.warn(
          `getChatSessionMessages: Chat session ${chatSessionId} not found${workspaceId ? ` in workspace ${workspaceId}` : ""}`
        )
        return []
      }

      // Log blacklist status but still return messages (blacklist only affects new message sending)
      if (session.customer?.isBlacklisted) {
        logger.info(
          `getChatSessionMessages: Customer ${session.customer.phone} (${session.customerId}) is blacklisted - showing existing messages but new messages will be blocked`
        )
      }

      // Check workspace blocklist if workspaceId is provided (for logging)
      if (workspaceId && session.customer?.phone) {
        const isBlacklisted = await this.isCustomerBlacklisted(
          session.customer.phone,
          workspaceId
        )
        if (isBlacklisted) {
          logger.info(
            `getChatSessionMessages: Customer ${session.customer.phone} is in workspace blocklist - showing existing messages but new messages will be blocked`
          )
        }
      }

      // ✅ FIXED: Query conversationMessage table (NEW) instead of message table (OLD)
      // This fixes the issue where messages saved by LLMRouter were not visible in frontend
      // 🚨 CRITICAL: Exclude "function" role messages - they are internal LLM context only!
      const messages = await this.prisma.conversationMessage.findMany({
        where: {
          conversationId: chatSessionId,
          role: {
            not: "function", // ✅ Filter out function calls - users should never see these!
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          createdAt: true,
          workspaceId: true,
          customerId: true,
          conversationId: true,
          role: true,
          content: true,
          agentType: true,
          tokensUsed: true,
          functionName: true,
          functionArguments: true,
          debugInfo: true, // ✅ Explicitly select debugInfo
        },
      })

      // Get billing records for this customer to attach to messages
      const billingRecords = await this.prisma.billing.findMany({
        where: {
          customerId: session.customerId,
          ...(workspaceId ? { workspaceId } : {}),
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      // 💰 NEW: Use the saved progressive totals from database
      const billingMap = new Map()

      billingRecords.forEach((record) => {
        billingMap.set(record.id, {
          currentTotal: Number(record.previousTotal),
          messageCharge: record.type === "MESSAGE" ? Number(record.amount) : 0,
          newTotal: Number(record.newTotal),
          userQuery: record.userQuery,
        })
      })

      // Get agent interactions (debug steps) for this conversation
      const agentInteractions = await this.prisma.agentConversationLog.findMany({
        where: {
          conversationId: chatSessionId,
          workspaceId: workspaceId || session.workspaceId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      // Create a map of messageId -> agentInteractions for operator messages
      const operatorDebugMap = new Map()
      agentInteractions.forEach((interaction) => {
        if (interaction.messageId && interaction.agentType === 'OPERATOR') {
          operatorDebugMap.set(interaction.messageId, interaction)
        }
      })

      // Parse debugInfo and attach billing data
      // ✅ Map conversationMessage format to frontend expected format
      const parsedMessages = messages.map((message) => {
        // Convert role (user/assistant/function) to direction (INBOUND/OUTBOUND)
        const direction = message.role === "user" ? "INBOUND" : "OUTBOUND"

        let parsed: any = {
          ...message,
          direction, // Add direction field for frontend compatibility
          type: "TEXT", // Default type
          // ✅ CRITICAL: Add default metadata for bot messages to show as GREEN in frontend
          metadata: {
            agentSelected: direction === "OUTBOUND" ? "CHATBOT" : "CUSTOMER",
            sentBy: direction === "OUTBOUND" ? "AI" : "CUSTOMER",
            isOperatorMessage: false,
            isOperatorControl: false,
          },
        }

        // 🆕 OPERATOR DEBUG: Check if this message has operator debug info
        const operatorDebug = operatorDebugMap.get(message.id)
        if (operatorDebug) {
          // Recreate debug info from AgentConversationLog record
          const operatorDebugInfo = {
            steps: [{
              type: "operator_message",
              agent: "Human Operator",
              model: "N/A",
              temperature: 0,
              timestamp: operatorDebug.createdAt.toISOString(),
              input: {
                messageContent: operatorDebug.inputMessage,
                sessionId: chatSessionId,
                customerId: operatorDebug.customerId,
              },
              output: {
                message: operatorDebug.llmResponse || operatorDebug.inputMessage,
                messageId: message.id,
                safetyProcessed: true,
                whatsappSent: true,
                finalMessage: operatorDebug.llmResponse || operatorDebug.inputMessage,
                whatsappError: "",
              },
              tokenUsage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: operatorDebug.tokensUsed || 0,
              },
            }],
            totalTokens: operatorDebug.tokensUsed || 0,
            totalCost: 0,
            executionTimeMs: operatorDebug.executionTimeMs || 0,
            timestamp: operatorDebug.createdAt.toISOString(),
          }

          // Update metadata for operator messages
          parsed.metadata = {
            ...parsed.metadata,
            agentSelected: "MANUAL_OPERATOR",
            sentBy: "HUMAN_OPERATOR", 
            isOperatorMessage: true,
            debugInfo: operatorDebugInfo,
          }
          
          logger.info(`Found operator debug info for message ${message.id}`)
        }
        // 🆕 DIRECT CHECK: If agentType is OPERATOR, mark as operator message
        else if (message.agentType === "OPERATOR") {
          // Parse existing debugInfo if available
          let existingDebugInfo = null
          if ((message as any).debugInfo) {
            try {
              existingDebugInfo = typeof (message as any).debugInfo === "string"
                ? JSON.parse((message as any).debugInfo)
                : (message as any).debugInfo
            } catch (parseError) {
              logger.warn(`Failed to parse debugInfo for operator message ${message.id}:`, parseError)
            }
          }

          // Update metadata for operator messages
          parsed.metadata = {
            ...parsed.metadata,
            agentSelected: "MANUAL_OPERATOR",
            sentBy: "HUMAN_OPERATOR", 
            isOperatorMessage: true,
            debugInfo: existingDebugInfo,
          }
          
          logger.info(`Found OPERATOR agentType for message ${message.id}`)
        }
        // Parse regular debugInfo if exists (it's stored as JSON string in DB)
        else if ((message as any).debugInfo) {
          try {
            const debugInfoParsed =
              typeof (message as any).debugInfo === "string"
                ? JSON.parse((message as any).debugInfo)
                : (message as any).debugInfo

            // Merge with existing metadata
            parsed.metadata = {
              ...parsed.metadata,
              debugInfo: debugInfoParsed, // Move debugInfo into metadata
            }
          } catch (parseError) {
            logger.warn(
              `Failed to parse debugInfo for message ${message.id}:`,
              parseError
            )
          }
        }

        // Find matching billing record (within 5 seconds of message)
        // 💰 IMPORTANT: Only match billing to the correct message direction:
        // - MESSAGE (€0.15) → INBOUND (customer message)
        // - PUSH_CAMPAIGN (€1.00) → OUTBOUND (bot message with push)
        const matchingBilling = billingRecords.find((billing) => {
          const timeDiff = Math.abs(
            new Date(billing.createdAt).getTime() -
              new Date(message.createdAt).getTime()
          )

          // Check time proximity (5 seconds tolerance)
          if (timeDiff >= 5000) return false

          // Match billing type to message direction
          const isInbound = direction === "INBOUND"
          const isOutbound = direction === "OUTBOUND"

          // MESSAGE billing should only attach to INBOUND messages
          if (billing.type === "MESSAGE" && !isInbound) return false

          // PUSH_CAMPAIGN should only attach to OUTBOUND messages
          if (billing.type === "PUSH_CAMPAIGN" && !isOutbound) return false

          return true
        })

        // Attach billing data if found
        if (matchingBilling && billingMap.has(matchingBilling.id)) {
          return {
            ...parsed,
            billing: billingMap.get(matchingBilling.id),
            messageCost: Number(matchingBilling.amount), // 💰 Add message cost for frontend
            billingType: matchingBilling.type, // 💰 Add billing type (MESSAGE, PUSH_MESSAGE, etc.)
          }
        }

        return parsed
      })

      return parsedMessages
    } catch (error) {
      logger.error("Error getting chat session messages:", error)
      throw new Error("Failed to get chat session messages")
    }
  }

  /**
   * Find or create a customer by phone number
   *
   * @param workspaceId The workspace ID
   * @param phoneNumber The customer's phone number
   * @returns The customer
   */
  async findCustomerByPhone(phoneNumber: string) {
    try {
      const customer = await this.prisma.customers.findFirst({
        where: {
          phone: phoneNumber,
        },
        include: {
          sales: true, // Include agent data
        },
      })
      return customer
    } catch (error) {
      logger.error("Error finding customer by phone:", error)
      throw new Error("Failed to find customer by phone")
    }
  }

  /**
   * Find an active chat session or create a new one
   *
   * 🔒 CONCURRENCY SAFE: Uses Prisma transaction to prevent race conditions
   * when multiple messages arrive simultaneously for the same customer.
   *
   * Pattern: Transaction-based session creation with unique constraint retry
   * - Atomic findFirst + create operation within transaction
   * - Handles P2002 (unique constraint violation) with retry logic
   * - Ensures only ONE active session per customer
   *
   * @param workspaceId The workspace ID
   * @param customerId The customer ID
   * @returns The chat session
   */
  async findOrCreateChatSession(workspaceId: string, customerId: string) {
    try {
      let isNewSession = false

      // 🔒 TRANSACTION: Atomic operation to prevent duplicate session creation
      const session = await this.prisma.$transaction(async (tx) => {
        // Try to find existing active session
        let session = await tx.chatSession.findFirst({
          where: {
            customerId: customerId,
            status: "active",
          },
          orderBy: {
            startedAt: "desc",
          },
        })

        if (!session) {
          try {
            // Atomic create with unique constraint on (customerId, status="active")
            session = await tx.chatSession.create({
              data: {
                workspaceId: workspaceId,
                customerId: customerId,
                status: "active",
              },
            })
            isNewSession = true
            logger.info(
              `✅ Created new chat session: ${session.id} for customer ${customerId}`
            )
          } catch (error: any) {
            // Handle race condition: another request created session simultaneously
            if (error.code === "P2002") {
              // Unique constraint violation - retry findFirst
              logger.warn(
                `⚠️ Race condition detected for customer ${customerId} - retrying findFirst`
              )
              session = await tx.chatSession.findFirst({
                where: {
                  customerId: customerId,
                  status: "active",
                },
                orderBy: {
                  startedAt: "desc",
                },
              })

              if (!session) {
                // Should never happen, but throw if still not found
                throw new Error(
                  `Failed to find session after P2002 for customer ${customerId}`
                )
              }

              logger.info(
                `✅ Retrieved existing session after race: ${session.id}`
              )
            } else {
              // Other error - rethrow
              throw error
            }
          }
        } else {
          logger.info(
            `✅ Found existing active session: ${session.id} for customer ${customerId}`
          )
        }

        return session
      })

      // 🔔 CRITICAL: Emit WebSocket event AFTER transaction commit for new sessions
      if (isNewSession) {
        // Fetch customer details for event payload
        const customer = await this.prisma.customers.findUnique({
          where: { id: customerId },
          select: { name: true, phone: true, language: true },
        })

        websocketService.notifyNewCustomer(workspaceId, {
          customerId: customerId,
          sessionId: session.id,
          customerName: customer?.name || "Unknown",
          customerPhone: customer?.phone || "",
          language: customer?.language || undefined,
          timestamp: new Date().toISOString(),
        })

        logger.info(
          `[NEW-SESSION] 🔔 WebSocket new-customer event sent for session ${session.id}`
        )
      }

      return session
    } catch (error) {
      logger.error(
        `❌ Error in findOrCreateChatSession for customer ${customerId}:`,
        error
      )
      throw new Error("Failed to find or create chat session")
    }
  }

  /**
   * Check if customer is in the blacklist
   *
   * @param phoneNumber The customer phone number to check
   * @param workspaceId The workspace ID to check blocklist
   * @returns True if customer is blacklisted, false otherwise
   */
  async isCustomerBlacklisted(
    phoneNumber: string,
    workspaceId?: string
  ): Promise<boolean> {
    try {
      // ✅ BLACKLIST CHECK ENABLED - Check customer blacklist status
      logger.info(`[BLACKLIST] Checking blacklist status for ${phoneNumber}`)

      // Check if customer has isBlacklisted flag
      const customer = await this.prisma.customers.findFirst({
        where: {
          phone: phoneNumber,
        },
        select: {
          isBlacklisted: true,
          workspaceId: true,
        },
      })

      // If customer is explicitly blacklisted, return true
      if (customer?.isBlacklisted === true) {
        return true
      }

      // If no workspaceId provided but we found the customer, use their workspaceId
      if (!workspaceId && customer?.workspaceId) {
        workspaceId = customer.workspaceId
      }

      // Blocklist check is now done via customers.isBlacklisted field
      // (workspace-level blocklist removed during database cleanup)
      return false
    } catch (error) {
      logger.error("Error checking customer blacklist status:", error)
      return false
    }
  }

  /**
   * Save a conversation message pair (user question and bot response)
   *
   * @param data Object containing message details
   * @returns The created message
   */
  async saveMessage(data: {
    workspaceId: string
    phoneNumber: string
    message: string
    response: string
    direction?: string
    agentSelected?: string
    // 🔧 Debug fields
    translatedQuery?: string
    processedPrompt?: string
    functionCallsDebug?: any[]
    processingSource?: string
    debugInfo?: string // 🔧 NEW: Debug info as JSON string
  }) {
    try {
      // Validate required fields
      if (!data.phoneNumber) {
        logger.error("saveMessage: Phone number is required")
        throw new Error("Phone number is required")
      }

      if (!data.message) {
        logger.error("saveMessage: Message content is required")
        throw new Error("Message content is required")
      }

      // Check if customer is blacklisted before saving any message
      const existingCustomer = await this.prisma.customers.findFirst({
        where: {
          phone: data.phoneNumber,
          workspaceId: data.workspaceId,
        },
        select: {
          id: true,
          isBlacklisted: true,
          name: true,
        },
      })

      if (existingCustomer?.isBlacklisted) {
        logger.warn(
          `saveMessage: Customer ${existingCustomer.name} (${data.phoneNumber}) is blacklisted - message blocked`
        )
        throw new Error("Customer is blacklisted - messages are not allowed")
      }

      // Verify workspace ID
      let workspaceId = data.workspaceId
      logger.info(`saveMessage: Using provided workspace ID: ${workspaceId}`)

      // Validate workspace ID using the dedicated method
      if (workspaceId) {
        const isValid = await this.validateWorkspaceId(workspaceId)
        if (!isValid) {
          logger.warn(
            `saveMessage: Provided workspace ID ${workspaceId} is invalid, will search for alternative`
          )
          workspaceId = ""
        } else {
          // Check if workspace is active
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { isActive: true },
          })

          if (!workspace?.isActive) {
            logger.warn(
              `saveMessage: Workspace ${workspaceId} exists but is inactive, will search for active workspace`
            )
            workspaceId = ""
          }
        }
      }

      // If no valid workspace ID provided, try to find an existing workspace
      if (!workspaceId) {
        // Try to find an active workspace
        logger.info("saveMessage: Searching for an active workspace")

        // First try to get a workspace associated with this phone number
        let existingCustomer = await this.prisma.customers.findFirst({
          where: {
            phone: data.phoneNumber,
          },
          include: {
            workspace: {
              select: { id: true, isActive: true },
            },
          },
        })

        // If customer exists and has a workspace associated
        if (existingCustomer?.workspace?.id) {
          workspaceId = existingCustomer.workspace.id
          logger.info(
            `saveMessage: Found workspace ${workspaceId} associated with customer ${existingCustomer.id}`
          )
        }
        // Otherwise look for any active workspace
        else {
          const activeWorkspace = await this.prisma.workspace.findFirst({
            where: { isActive: true },
            select: { id: true },
          })

          if (activeWorkspace) {
            workspaceId = activeWorkspace.id
            logger.info(`saveMessage: Found active workspace: ${workspaceId}`)
          } else {
            // If no active workspace, try any workspace
            const anyWorkspace = await this.prisma.workspace.findFirst({
              select: { id: true },
            })

            if (anyWorkspace) {
              workspaceId = anyWorkspace.id
              logger.info(
                `saveMessage: No active workspaces. Using workspace: ${workspaceId}`
              )
            } else {
              logger.error("saveMessage: No workspaces found in the database")
              throw new Error("No workspace found in the database")
            }
          }
        }
      }

      // Find or create customer
      let customer = await this.findCustomerByPhone(data.phoneNumber)

      // If no customer exists, create a temporary "Unknown User-XXX" for new users
      // This allows us to save messages in chat history even before registration
      if (!customer) {
        logger.info(
          `saveMessage: No customer found for phone ${data.phoneNumber} - creating temporary customer for new user`
        )

        // Generate random 3-digit number for temporary user
        const randomNumber = Math.floor(Math.random() * 900) + 100 // 100-999

        // Detect language from message content
        let detectedLanguage = "IT" // Default to Italian
        if (data.message) {
          const lowerMessage = data.message.toLowerCase()

          // Italian detection
          const italianWords = [
            "ciao",
            "buongiorno",
            "buonasera",
            "buonanotte",
            "voglio",
            "ho bisogno",
            "vorrei",
            "per favore",
            "grazie",
            "prego",
            "sì",
            "no",
            "il",
            "la",
            "i",
            "le",
            "e",
            "o",
            "ma",
            "con",
            "per",
            "da",
            "in",
            "su",
            "a",
            "di",
          ]

          // English detection
          const englishWords = [
            "hello",
            "hi",
            "good morning",
            "good afternoon",
            "good evening",
            "i want",
            "i need",
            "i would like",
            "please",
            "thank you",
            "thanks",
            "yes",
            "no",
            "the",
            "and",
            "or",
            "but",
            "with",
            "for",
            "to",
            "from",
            "in",
            "on",
            "at",
            "by",
          ]

          // Spanish detection
          const spanishWords = [
            "hola",
            "buenos días",
            "buenas tardes",
            "buenas noches",
            "quiero",
            "necesito",
            "me gustaría",
            "por favor",
            "gracias",
            "sí",
            "no",
            "el",
            "la",
            "los",
            "las",
            "y",
            "o",
            "pero",
            "con",
            "para",
            "de",
            "en",
            "por",
          ]

          // Portuguese detection
          const portugueseWords = [
            "olá",
            "bom dia",
            "boa tarde",
            "boa noite",
            "quero",
            "preciso",
            "gostaria",
            "por favor",
            "obrigado",
            "obrigada",
            "sim",
            "não",
            "o",
            "a",
            "os",
            "as",
            "e",
            "ou",
            "mas",
            "com",
            "para",
            "de",
            "em",
            "por",
          ]

          // Count matches for each language
          const italianMatches = italianWords.filter((word) =>
            lowerMessage.includes(word)
          ).length
          const englishMatches = englishWords.filter((word) =>
            lowerMessage.includes(word)
          ).length
          const spanishMatches = spanishWords.filter((word) =>
            lowerMessage.includes(word)
          ).length
          const portugueseMatches = portugueseWords.filter((word) =>
            lowerMessage.includes(word)
          ).length

          // Determine language based on highest match count
          if (
            italianMatches > englishMatches &&
            italianMatches > spanishMatches &&
            italianMatches > portugueseMatches
          ) {
            detectedLanguage = "IT"
          } else if (
            englishMatches > italianMatches &&
            englishMatches > spanishMatches &&
            englishMatches > portugueseMatches
          ) {
            detectedLanguage = "ENG"
          } else if (
            spanishMatches > italianMatches &&
            spanishMatches > englishMatches &&
            spanishMatches > portugueseMatches
          ) {
            detectedLanguage = "ESP"
          } else if (
            portugueseMatches > italianMatches &&
            portugueseMatches > englishMatches &&
            portugueseMatches > spanishMatches
          ) {
            detectedLanguage = "PRT"
          }
        }

        // Create a temporary customer for new users
        try {
          const newCustomer = await this.prisma.customers.create({
            data: {
              name: `Unknown User-${randomNumber}`,
              email: `${data.phoneNumber.replace(/[^0-9]/g, "")}@temp.com`,
              phone: data.phoneNumber,
              workspaceId: workspaceId,
              isActive: false, // Mark as inactive until they register
              isBlacklisted: true, // 🚨 NEW USERS ARE BLOCKED until admin approval!
              activeChatbot: true, // Enable chatbot to handle registration requests
              language: detectedLanguage,
              currency: "EUR",
            },
          })

          // Reload customer with sales relation
          customer = await this.prisma.customers.findUnique({
            where: { id: newCustomer.id },
            include: { sales: true },
          })

          logger.info(
            `saveMessage: Created temporary customer ${newCustomer.id} (Unknown User-${randomNumber}) for new user ${data.phoneNumber} with detected language: ${detectedLanguage}`
          )
        } catch (createError: any) {
          // P2002: Unique constraint violation (phone already exists)
          if (createError.code === "P2002") {
            logger.warn(
              `saveMessage: Race condition - customer with phone ${data.phoneNumber} already created. Fetching existing customer.`
            )

            // Fetch the existing customer (race condition: another webhook created it)
            customer = await this.prisma.customers.findFirst({
              where: {
                phone: data.phoneNumber,
                workspaceId: workspaceId,
              },
              include: {
                sales: true, // Include agent data
              },
            })

            if (!customer) {
              logger.error(
                `saveMessage: CRITICAL - Customer not found after P2002 error for phone ${data.phoneNumber}`
              )
              throw new Error(
                "Customer not found after unique constraint violation"
              )
            }

            logger.info(
              `saveMessage: ✅ Race condition handled - using existing customer ${customer.id}`
            )
          } else {
            // Different error, rethrow
            logger.error(
              `saveMessage: Error creating customer for phone ${data.phoneNumber}:`,
              createError
            )
            throw createError
          }
        }
      }

      // Update customer's lastContact field
      await this.prisma.customers.update({
        where: { id: customer.id },
        data: { updatedAt: new Date() },
      })

      // Find or create chat session
      let session = await this.prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          status: "active",
        },
        orderBy: {
          startedAt: "desc",
        },
      })

      if (!session) {
        session = await this.prisma.chatSession.create({
          data: {
            workspaceId: workspaceId,
            customerId: customer.id,
            status: "active",
          },
        })
        logger.info(`saveMessage: Created new chat session: ${session.id}`)
      }

      // Use INBOUND as default direction
      const direction =
        data.direction === "OUTBOUND"
          ? MessageDirection.OUTBOUND
          : MessageDirection.INBOUND

      // Save both messages in the conversation
      const userMessage =
        direction === MessageDirection.INBOUND ? data.message : data.response
      const botMessage =
        direction === MessageDirection.INBOUND ? data.response : data.message

      // Prepare metadata for bot response with agent info
      const botMetadata = data.agentSelected
        ? { agentName: data.agentSelected }
        : {}

      // Save user message (ensure it's not empty)
      if (userMessage && userMessage.trim()) {
        // 🚨 ANTI-DUPLICATE CHECK: Verify if similar message exists in same hour:minute
        const now = new Date()
        const currentHourMinute = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`

        // Search for messages in the last 2 minutes to catch duplicates across minute boundaries
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
        const existingMessage = await this.prisma.message.findFirst({
          where: {
            chatSessionId: session.id,
            content: userMessage,
            direction: MessageDirection.INBOUND,
            createdAt: {
              gte: twoMinutesAgo,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        })

        if (existingMessage) {
          const existingHourMinute = `${existingMessage.createdAt.getHours()}:${existingMessage.createdAt.getMinutes().toString().padStart(2, "0")}`
          logger.warn(
            `🚨 DUPLICATE DETECTED: Message "${userMessage.substring(0, 50)}..." already exists from ${existingHourMinute} (${existingMessage.createdAt.toISOString()}). Current time: ${currentHourMinute}. Skipping insert.`
          )
        } else {
          const userMessageObj = await this.prisma.message.create({
            data: {
              chatSessionId: session.id,
              content: userMessage,
              direction: MessageDirection.INBOUND,
              type: MessageType.TEXT,
              aiGenerated: false,
            },
          })
          logger.info(
            `✅ SAVED USER MESSAGE: "${userMessage.substring(0, 50)}..." for session ${session.id}`
          )

          // 🚀 WEBSOCKET: Notify real-time about new customer message
          try {
            const { websocketService } = await import(
              "../services/websocket.service"
            )
            websocketService.notifyNewMessage(workspaceId, {
              id: userMessageObj.id,
              sessionId: session.id,
              content: userMessage,
              sender: "customer",
              timestamp: userMessageObj.createdAt.toISOString(),
              workspaceId,
            })
          } catch (wsError) {
            logger.warn(
              "[WebSocket] Failed to notify new customer message:",
              wsError.message
            )
          }
        }
      }

      // Save bot response (ensure it's not empty)
      let botResponse = null
      // Fix: Ensure botMessage is a string before calling trim()
      const botMessageStr =
        typeof botMessage === "string" ? botMessage : String(botMessage || "")
      if (botMessageStr && botMessageStr.trim()) {
        // 🚨 ANTI-DUPLICATE CHECK: Verify if similar bot response exists in same hour:minute
        const now = new Date()
        const currentHourMinute = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`

        // Search for messages in the last 2 minutes to catch duplicates across minute boundaries
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
        const existingBotMessage = await this.prisma.message.findFirst({
          where: {
            chatSessionId: session.id,
            content: botMessageStr,
            direction: MessageDirection.OUTBOUND,
            createdAt: {
              gte: twoMinutesAgo,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        })

        if (existingBotMessage) {
          const existingHourMinute = `${existingBotMessage.createdAt.getHours()}:${existingBotMessage.createdAt.getMinutes().toString().padStart(2, "0")}`
          logger.warn(
            `🚨 DUPLICATE BOT RESPONSE DETECTED: Response "${botMessageStr.substring(0, 50)}..." already exists from ${existingHourMinute} (${existingBotMessage.createdAt.toISOString()}). Current time: ${currentHourMinute}. Skipping insert.`
          )
          botResponse = existingBotMessage // Return existing response instead of creating new one
        } else {
          logger.info(
            `[DEBUG-TRACKING] 🔍 About to track usage for customer: ${customer.id}, workspace: ${workspaceId}`
          )

          // 💰 USAGE TRACKING: Check debugMode before tracking €0.005
          try {
            // Get workspace to check debugMode setting
            const workspace = await this.prisma.workspace.findUnique({
              where: { id: workspaceId },
              select: { debugMode: true },
            })

            // Environment-based fallback (Constitution v1.5.0 Principle I compliance)
            // - If debugMode is NULL:
            //   - NODE_ENV=production → false (billing enabled)
            //   - NODE_ENV=development → true (billing disabled)
            //   - NODE_ENV undefined → true (safe default for local dev)
            const effectiveDebugMode =
              workspace?.debugMode ??
              (process.env.NODE_ENV === "production" ? false : true)

            if (!effectiveDebugMode) {
              // debugMode is false AND customer not blacklisted, track usage normally
              // 💰 UNIFIED BILLING: Price from BillingPrices enum (SINGLE SOURCE OF TRUTH)
              const messagePrice = BillingPrices.MESSAGE

              // Track in legacy usage system (for Analytics)
              const { usageService } = await import("../services/usage.service")
              await usageService.trackUsage({
                clientId: customer.id,
                workspaceId: workspaceId,
                price: messagePrice,
              })

              // Track in new billing system (same price!)
              const { BillingService } = await import(
                "../application/services/billing.service"
              )
              const billingService = new BillingService(this.prisma)

              // Track regular message cost (all messages are €0.15 regardless of agent type)
              await billingService.trackMessage(
                workspaceId,
                customer.id,
                `Message from ${data.phoneNumber}`,
                data.message // User's question
              )
              logger.info(
                `[BILLING] 💰 €0.15 message cost tracked for ${data.phoneNumber}`
              )
            } else {
              // debugMode is true, skip tracking
              logger.info(
                `[DEBUG-MODE] 🚫 Usage tracking skipped - debug mode enabled for workspace ${workspaceId}`
              )
            }
          } catch (trackingError) {
            logger.error(`[DEBUG-TRACKING] ❌ Tracking error:`, trackingError)
            logger.warn(
              `[USAGE-TRACKING] ❌ Failed to track usage, but conversation will still be saved:`,
              trackingError.message
            )
          }

          botResponse = await this.prisma.message.create({
            data: {
              chatSessionId: session.id,
              content: botMessageStr,
              direction: MessageDirection.OUTBOUND,
              type: MessageType.TEXT,
              aiGenerated: true,
              metadata: botMetadata,
              // 🔧 Debug fields
              translatedQuery: data.translatedQuery,
              processedPrompt: data.processedPrompt,
              functionCallsDebug: data.functionCallsDebug
                ? JSON.stringify(data.functionCallsDebug)
                : null,
              processingSource: data.processingSource,
              debugInfo: data.debugInfo, // 🔧 NEW: Debug info (already JSON string)
            },
          })
          logger.info(
            `✅ SAVED BOT RESPONSE: "${botMessageStr.substring(0, 50)}..." for session ${session.id}`
          )

          // 🚀 WEBSOCKET: Notify real-time about new message
          try {
            const { websocketService } = await import(
              "../services/websocket.service"
            )
            websocketService.notifyNewMessage(workspaceId, {
              id: botResponse.id,
              sessionId: session.id,
              content: botMessageStr,
              sender: "agent",
              timestamp: botResponse.createdAt.toISOString(),
              workspaceId,
            })
          } catch (wsError) {
            logger.warn(
              "[WebSocket] Failed to notify new message:",
              wsError.message
            )
          }
        }
      }

      // Also update the chat session's lastMessageAt
      await this.prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      })

      logger.info(
        `saveMessage: Saved conversation pair for phone number: ${data.phoneNumber}`
      )

      return botResponse
    } catch (error) {
      logger.error("Error saving message pair:", error)
      throw new Error(`Failed to save message pair: ${error.message}`)
    }
  }

  /**
   * Recupera le FAQ attive dal database.
   * @param workspaceId L'ID del workspace.
   * @returns Una stringa con le FAQ formattate.
   */
  async getActiveFaqs(workspaceId: string): Promise<string> {
    try {
      const faqs = await this.prisma.fAQ.findMany({
        where: {
          workspaceId: workspaceId,
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      if (faqs.length === 0) {
        return "" // Nessuna FAQ attiva
      }

      // Formatta le FAQ come stringa per il prompt
      const formattedFaqs = faqs
        .map((faq) => `D: ${faq.question}\nR: ${faq.answer}`)
        .join("\n\n")

      return `\n\n${formattedFaqs}`
    } catch (error) {
      logger.error("Error fetching active FAQs:", error)
      return "" // In caso di errore, restituisce una stringa vuota
    }
  }

  /**
   * Recupera i servizi attivi dal database e li formatta per il prompt.
   * @param workspaceId L'ID del workspace.
   * @returns Una stringa con i servizi formattati in lista numerata.
   */
  async getActiveServices(workspaceId: string): Promise<string> {
    try {
      const services = await this.prisma.services.findMany({
        where: {
          workspaceId: workspaceId,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
      })

      if (services.length === 0) {
        return "" // Nessun servizio attivo
      }

      // Formatta i servizi come lista numerata con tutti i dettagli
      const formattedServices = services
        .map((service, index) => {
          const price = service.price
            ? `€${service.price.toFixed(2)}`
            : "Prezzo da definire"
          const description = service.description || "Servizio disponibile"
          const code =
            service.code || `SRV-${String(index + 1).padStart(3, "0")}`

          return [
            `${index + 1}. **${service.name}** - ${price}`,
            `   📝 Descrizione: ${description}`,
            `   📋 Codice: ${code}`,
            `   ⏰ Disponibilità: Sempre disponibile`,
          ].join("\n")
        })
        .join("\n\n")

      return `\n\n${formattedServices}`
    } catch (error) {
      logger.error("Error fetching active services:", error)
      return "" // In caso di errore, restituisce una stringa vuota
    }
  }

  /**
   * Recupera i prodotti attivi dal database e li formatta per il prompt.
   * @param workspaceId L'ID del workspace.
   * @param customerDiscount Sconto del customer (opzionale)
   * @returns Una stringa con i prodotti formattati.
   */
  async getActiveProducts(
    workspaceId: string,
    customerDiscount: number = 0
  ): Promise<string> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId: workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          productCode: true,
          price: true,
          description: true, // Aggiungi description per il prompt
          formato: true, // Aggiungi formato per il prompt
          stock: true, // Aggiungi stock per disponibilità
          certifications: true, // Array: ["bio", "vegan", "gluten-free", "halal", "whole-grain", "DOP"]
          region: true, // ✅ Feature 123 - C2: Add region for single product details
          transportType: true, // ✅ Bonus: Temperature info for product search
          category: {
            select: {
              name: true,
            },
          },
          supplier: {
            // ✅ Feature 123 - C2: Add supplier for single product details
            select: {
              companyName: true,
            },
          },
        },
        orderBy: {
          category: {
            name: "asc",
          },
        },
      })

      if (products.length === 0) {
        return ""
      }

      // Calcola i prezzi con sconti
      const { PriceCalculationService } = await import(
        "../application/services/price-calculation.service"
      )
      const priceService = new PriceCalculationService(this.prisma)
      const productIds = products.map((p) => p.id)
      const priceResult = await priceService.calculatePricesWithDiscounts(
        workspaceId,
        productIds,
        customerDiscount
      )
      const priceMap = new Map(priceResult.products.map((p) => [p.id, p]))

      // Raggruppa i prodotti per categoria con prezzi scontati
      const productsByCategory = products.reduce(
        (acc, product) => {
          const categoryName = product.category?.name || "Senza Categoria"
          const priceData = priceMap.get(product.id)
          if (!acc[categoryName]) {
            acc[categoryName] = []
          }
          acc[categoryName].push({
            ...product,
            originalPrice: priceData?.originalPrice || product.price,
            finalPrice: priceData?.finalPrice || product.price,
            hasDiscount: (priceData?.appliedDiscount || 0) > 0,
            description: product.description, // Mantieni la descrizione
          })
          return acc
        },
        {} as Record<string, any[]>
      )

      // Formatta l'output con prezzi scontati - versione compatta per evitare troncamento
      let formattedProducts = ""

      for (const categoryName in productsByCategory) {
        const productList = productsByCategory[categoryName]
        formattedProducts += `\n**${categoryName.toUpperCase()}** (${productList.length} prodotti)\n`

        // Mostra tutti i prodotti della categoria
        const productsToShow = productList

        // Formato: ogni prodotto su una riga separata con description, stock, certifications
        productsToShow.forEach((p) => {
          const originalPrice = Number(p.originalPrice).toFixed(2)
          const finalPrice = Number(p.finalPrice).toFixed(2)
          const description = p.description ? ` - ${p.description}` : ""
          const formatoStr = p.formato ? ` ${p.formato}` : ""

          // Stock indicator
          let stockIcon = "✅"
          if (p.stock === 0) stockIcon = "❌"
          else if (p.stock < 5) stockIcon = "⚠️"
          const stockStr = ` | Stock: ${stockIcon} ${p.stock}`

          // Feature 123: Certification badges from certifications array
          const certMap: Record<string, string> = {
            DOP: "DOP",
            bio: "Bio",
            halal: "Halal",
            "whole-grain": "Integrale",
            vegan: "Vegan",
            "gluten-free": "Senza Glutine",
          }

          const certBadges: string[] =
            p.certifications
              ?.map((c: string) => certMap[c] || c)
              .filter(Boolean) || []

          const certificationsStr =
            certBadges.length > 0 ? ` | 🔖 ${certBadges.join(", ")}` : ""

          // ✅ Feature 123 - C2: Add supplier and region to formatted output
          const supplierStr = p.supplier?.companyName
            ? ` | 🏷️ ${p.supplier.companyName}`
            : ""
          const regionStr = p.region ? ` | 🌍 ${p.region}` : ""
          const transportStr = p.transportType
            ? ` | ${
                p.transportType === "Trasporto refrigerato"
                  ? "❄️"
                  : p.transportType === "Trasporto congelato"
                    ? "🧊"
                    : "📦"
              } ${p.transportType}`
            : ""

          // WhatsApp strikethrough: ~text~ (single tilde at start and end)
          // Format: [CODICE] NOME formato ~€originalPrice~ → €finalPrice - description | Stock: ✅ N | 🔖 Certifications | 🏷️ Supplier | 🌍 Region | ❄️ Transport
          // Se productCode è null/undefined, non mostrarlo
          const productCode = p.productCode ? `${p.productCode} ` : ""
          formattedProducts += `• ${productCode}${p.name}${formatoStr} ~€${originalPrice}~ → €${finalPrice}${description}${stockStr}${certificationsStr}${supplierStr}${regionStr}${transportStr}\n`
        })
        formattedProducts += "\n"
      }

      // ✅ Feature 123 - C1: Token count monitoring
      // Estimate token count (rough approximation: 1 token ≈ 4 characters)
      const tokenCount = Math.ceil(formattedProducts.length / 4)
      const tokenLimit = 50000

      logger.info(`📊 {{PRODUCTS}} token estimation`, {
        workspaceId,
        productsCount: products.length,
        charactersCount: formattedProducts.length,
        estimatedTokens: tokenCount,
        tokenLimit,
        utilizationPercent: ((tokenCount / tokenLimit) * 100).toFixed(1),
      })

      if (tokenCount > tokenLimit) {
        logger.warn(
          `⚠️ {{PRODUCTS}} exceeds recommended token limit: ${tokenCount} tokens (limit: ${tokenLimit})`,
          {
            workspaceId,
            productsCount: products.length,
            recommendation:
              "Consider implementing pagination or reducing product count",
          }
        )
      } else if (tokenCount > tokenLimit * 0.8) {
        logger.info(
          `ℹ️ {{PRODUCTS}} approaching token limit: ${tokenCount} tokens (80%+ of ${tokenLimit})`,
          {
            workspaceId,
            productsCount: products.length,
          }
        )
      }

      return formattedProducts
    } catch (error) {
      logger.error("Error fetching active products:", error)
      return ""
    }
  }

  /**
   * Get all chat sessions with their most recent message, ordered by latest message
   *
   * @param limit Number of chat sessions to return
   * @returns Array of chat sessions with latest message info
   */
  async getRecentChats(limit = 20, workspaceId?: string) {
    try {
      // Get all chat sessions
      const chatSessions = await this.prisma.chatSession.findMany({
        take: limit,
        include: {
          customer: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        where: {
          ...(workspaceId ? { workspaceId } : {}),
        },
      })

      // 🔥 FIX: Get last message from ConversationMessage table (not Message table)
      const sessionsWithMessages = await Promise.all(
        chatSessions.map(async (session) => {
          // Get most recent conversation message (exclude function calls)
          const lastMessage = await this.prisma.conversationMessage.findFirst({
            where: {
              conversationId: session.id,
              role: {
                not: "function", // Exclude function calls
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          })

          return {
            sessionId: session.id,
            customerId: session.customerId,
            customerName: session.customer.name,
            customerPhone: session.customer.phone,
            companyName: session.customer.company || null,
            lastMessage: lastMessage ? lastMessage.content : null,
            lastMessageTime: lastMessage
              ? lastMessage.createdAt
              : session.updatedAt,
            status: session.status,
            unreadCount: 0, // Will be updated later
            workspaceId: session.workspaceId,
            activeChatbot: session.customer?.activeChatbot ?? true,
          }
        })
      )

      return sessionsWithMessages
    } catch (error) {
      logger.error("Error getting recent chats:", error)
      throw new Error("Failed to get recent chats")
    }
  }

  /**
   * Get unread message count for a specific chat session
   *
   * @param chatSessionId The chat session ID
   * @returns Number of unread messages
   */
  async getUnreadCount(chatSessionId: string) {
    try {
      const count = await this.prisma.message.count({
        where: {
          chatSessionId,
          direction: MessageDirection.INBOUND, // Solo messaggi in entrata (dal cliente)
          read: false,
        },
      })

      return count
    } catch (error) {
      logger.error(
        `Error counting unread messages for session ${chatSessionId}:`,
        error
      )
      return 0
    }
  }

  /**
   * Mark all messages in a chat session as read
   *
   * @param chatSessionId The chat session ID
   * @param workspaceId Optional workspace ID to filter
   * @returns Success status
   */
  async markMessagesAsRead(chatSessionId: string, workspaceId?: string) {
    try {
      // First verify that the chat session belongs to the workspace if workspaceId is provided
      if (workspaceId) {
        const session = await this.prisma.chatSession.findFirst({
          where: {
            id: chatSessionId,
            workspaceId,
          },
          select: { id: true },
        })

        if (!session) {
          logger.warn(
            `markMessagesAsRead: Chat session ${chatSessionId} not found in workspace ${workspaceId}`
          )
          return false
        }
      }

      await this.prisma.message.updateMany({
        where: {
          chatSessionId,
          direction: MessageDirection.INBOUND,
          read: false,
        },
        data: {
          read: true,
          updatedAt: new Date(),
        },
      })

      return true
    } catch (error) {
      logger.error(
        `Error marking messages as read for session ${chatSessionId}:`,
        error
      )
      return false
    }
  }

  /**
   * Get chat sessions with unread message counts
   *
   * @param limit Maximum number of sessions to return
   * @param workspaceId Optional workspace ID to filter sessions
   * @returns Array of chat sessions with unread counts
   */
  async getChatSessionsWithUnreadCounts(limit = 20, workspaceId?: string) {
    try {
      // Get all chat sessions, including those with blacklisted customers
      // We want to show all chats but mark blacklisted ones visually
      // @ts-ignore - Prisma types issue
      const chatSessions = await this.prisma.chatSession.findMany({
        where: {
          ...(workspaceId ? { workspaceId } : {}),
          // Removed isBlacklisted filter - we want to show all chats
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: true, // Include company name for chat list display
              activeChatbot: true, // Include activeChatbot for chat list icon
              isBlacklisted: true, // Include to show blacklist status in UI
              // Remove avatar as it doesn't exist in the schema
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
          // Include message count
          messages: {
            where: {
              read: false, // Use 'read' instead of 'isRead'
              direction: "INBOUND",
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: limit,
      })

      // Return all sessions - we'll show blacklisted status in UI instead of hiding
      // Map sessions to include unread count and activeChatbot
      return chatSessions.map((session) => ({
        ...session,
        unreadCount: session.messages.length,
        activeChatbot: session.customer?.activeChatbot ?? true,
        messages: undefined, // Remove messages array
      }))
    } catch (error) {
      logger.error("Error getting chat sessions with unread counts:", error)
      return []
    }
  }

  /**
   * Validate a workspace ID
   * @param workspaceId The workspace ID to validate
   * @returns True if valid, False otherwise
   */
  async validateWorkspaceId(workspaceId: string): Promise<boolean> {
    try {
      if (!workspaceId || typeof workspaceId !== "string") {
        logger.warn("Invalid workspace ID format")
        return false
      }

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      })

      return !!workspace
    } catch (error) {
      logger.error("Error validating workspace ID:", error)
      return false
    }
  }

  /**
   * Get workspace settings for a workspace
   * @param workspaceId The workspace ID
   * @returns Workspace settings
   */
  async getWorkspaceSettings(workspaceId: string) {
    try {
      logger.info(`Getting workspace settings for workspace ${workspaceId}`)

      // Check if workspaceId is missing or empty
      if (!workspaceId || workspaceId.trim() === "") {
        logger.warn(
          "getWorkspaceSettings: No workspace ID provided, trying to find default workspace"
        )

        // Try to find any active workspace
        const activeWorkspace = await this.prisma.workspace.findFirst({
          where: { isActive: true },
        })

        if (activeWorkspace) {
          logger.info(
            `getWorkspaceSettings: Found active workspace ${activeWorkspace.id} to use as default`
          )
          return activeWorkspace
        }

        // If no active workspace, try any workspace
        const anyWorkspace = await this.prisma.workspace.findFirst()
        if (anyWorkspace) {
          logger.warn(
            `getWorkspaceSettings: No active workspaces found, using ${anyWorkspace.id} (inactive)`
          )
          return anyWorkspace
        }

        logger.error(
          "getWorkspaceSettings: No workspaces found in the database"
        )
        return null
      }

      // Try to find by exact ID first
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      })

      // If found, return it
      if (workspace) {
        logger.info(
          `getWorkspaceSettings: Workspace ${workspaceId} found, isActive: ${workspace.isActive}`
        )
        return workspace
      }

      // If not found by ID, try searching by name or slug
      logger.warn(
        `getWorkspaceSettings: Workspace with ID ${workspaceId} not found, trying alternative searches`
      )

      // Try by name or slug
      const workspaceByName = await this.prisma.workspace.findFirst({
        where: {
          OR: [
            { name: { contains: workspaceId, mode: "insensitive" } },
            { slug: { contains: workspaceId, mode: "insensitive" } },
          ],
        },
      })

      if (workspaceByName) {
        logger.info(
          `getWorkspaceSettings: Found workspace by name/slug match: ${workspaceByName.id}`
        )
        return workspaceByName
      }

      // If still not found, try to get any active workspace
      logger.warn(
        "getWorkspaceSettings: No matching workspace found, falling back to any active workspace"
      )

      const fallbackWorkspace = await this.prisma.workspace.findFirst({
        where: { isActive: true },
      })

      if (fallbackWorkspace) {
        logger.info(
          `getWorkspaceSettings: Using fallback active workspace: ${fallbackWorkspace.id}`
        )
        return fallbackWorkspace
      }

      logger.error(
        "getWorkspaceSettings: No workspaces found after all fallback attempts"
      )
      return null
    } catch (error) {
      logger.error(
        `Error getting workspace settings for ${workspaceId}:`,
        error
      )
      return null
    }
  }

  /**
   * Get all products
   * @param workspaceId Workspace ID to filter by
   * @returns List of products
   */
  async getProducts(workspaceId?: string) {
    try {
      const products = await this.prisma.products.findMany({
        where: workspaceId ? { workspaceId } : {},
        orderBy: {
          name: "asc",
        },
      })
      return products
    } catch (error) {
      logger.error("Error getting products:", error)
      return []
    }
  }

  /**
   * Get all services
   * @param workspaceId Workspace ID to filter by
   * @returns List of services
   */
  async getServices(workspaceId?: string) {
    try {
      const services = await this.prisma.services.findMany({
        where: workspaceId ? { workspaceId } : {},
        orderBy: {
          name: "asc",
        },
      })
      return services
    } catch (error) {
      logger.error("Error getting services:", error)
      return []
    }
  }

  /**
   * Get all events
   * @param workspaceId Workspace ID to filter by
   * @returns List of events
   */
  async getEvents(workspaceId?: string) {
    try {
      // Events functionality has been removed from the system
      logger.info("Events functionality has been removed from the system")
      return []
    } catch (error) {
      logger.error("Error getting events:", error)
      return []
    }
  }

  /**
   * Update a customer's language preference
   *
   * @param customerId The customer's ID
   * @param language The language code to set
   * @returns The updated customer
   */
  async updateCustomerLanguage(customerId: string, language: string) {
    try {
      const updatedCustomer = await this.prisma.customers.update({
        where: {
          id: customerId,
        },
        data: {
          language,
        },
      })

      logger.info(`Updated language for customer ${customerId} to ${language}`)
      return updatedCustomer
    } catch (error) {
      logger.error(`Error updating customer language:`, error)
      throw new Error("Failed to update customer language")
    }
  }

  /**
   * Create a new customer
   *
   * @param data Customer data
   * @returns The created customer
   */
  async createCustomer({
    name,
    email,
    phone,
    workspaceId,
    language = "ENG", // Add default language
  }: {
    name: string
    email: string
    phone: string
    workspaceId: string
    language?: string
  }) {
    try {
      const customer = await this.prisma.customers.create({
        data: {
          name,
          email,
          phone,
          workspaceId,
          language,
          isActive: true,
          isBlacklisted: true, // 🚨 NEW USERS ARE BLOCKED until admin approval!
          activeChatbot: true, // Enable chatbot to handle registration requests
          currency: "EUR",
        },
      })
      logger.info(
        `Created customer: ${customer.id} (blocked until admin approval)`
      )
      return customer
    } catch (error: any) {
      // P2002: Unique constraint violation (phone or email already exists)
      if (error.code === "P2002") {
        logger.warn(
          `createCustomer: Unique constraint violation for phone ${phone} or email ${email}. Fetching existing customer.`
        )

        // Fetch the existing customer
        const existingCustomer = await this.prisma.customers.findFirst({
          where: {
            phone,
            workspaceId,
          },
        })

        if (existingCustomer) {
          logger.info(
            `createCustomer: ✅ Returning existing customer ${existingCustomer.id}`
          )
          return existingCustomer
        }

        // If not found by phone, might be email duplicate
        const existingByEmail = await this.prisma.customers.findFirst({
          where: {
            email,
            workspaceId,
          },
        })

        if (existingByEmail) {
          logger.info(
            `createCustomer: ✅ Returning existing customer by email ${existingByEmail.id}`
          )
          return existingByEmail
        }

        // Should never reach here, but handle gracefully
        logger.error(
          "createCustomer: CRITICAL - Customer not found after P2002 error"
        )
        throw new Error("Customer not found after unique constraint violation")
      }

      // Different error, rethrow
      logger.error("Error creating customer:", error)
      throw new Error("Failed to create customer")
    }
  }

  /**
   * Chiama il function router di OpenAI per ottenere la funzione da chiamare
   * @param message Messaggio dell'utente
   * @param conversationContext Array di messaggi precedenti per contesto
   * @returns Risultato della chiamata al function router
   */
  async callFunctionRouter(
    message: string,
    conversationContext: any[] = []
  ): Promise<any> {
    logger.info("🚨 DEBUG - callFunctionRouter CALLED with message:", message)
    try {
      // Check if OpenRouter is properly configured
      logger.info("🔍 DEBUG - OPENROUTER_API_KEY check:", {
        present: !!process.env.OPENROUTER_API_KEY,
        length: process.env.OPENROUTER_API_KEY?.length || 0,
        prefix: process.env.OPENROUTER_API_KEY?.substring(0, 15) || "MISSING",
      })

      if (!process.env.OPENROUTER_API_KEY) {
        logger.warn(
          "OpenRouter API key not configured properly for function router"
        )
        return {
          function_call: {
            name: "get_generic_response",
            arguments: {},
          },
        }
      }

      // Use a simple default prompt for function routing
      const functionRouterPrompt =
        "You are a function router for a WhatsApp chatbot. Analyze the user's message and select the most appropriate function to call."

      // ANDREA DECISION: CF ATTIVE CON NOMI CORRETTI
      const availableFunctions = [
        {
          name: "ContactOperator",
          description:
            "Contact a human operator when: 1) User explicitly requests operator with phrases like 'voglio parlare con operatore', 'contatta operatore', 'mettimi in contatto con operatore'. 2) User responds 'si', 'yes', 'sì' after being asked if they want to contact an operator. Check conversation history to see if previous message offered operator contact. Do NOT trigger for product problems unless user confirms with 'si'/'yes'.",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description:
                  "The user's original message requesting operator contact",
              },
            },
            required: ["message"],
          },
        },
        {
          name: "GetLinkOrderByCode",
          description:
            "Get a secure link to view a specific order (or the last order if omitted). Triggers when user asks for a specific order or invoice.",
          parameters: {
            type: "object",
            properties: {
              orderCode: {
                type: "string",
                description:
                  "Order number or code to retrieve (optional, falls back to last order)",
              },
              documentType: {
                type: "string",
                description:
                  "Type of document requested: invoice, ddt, order (optional)",
              },
              message: {
                type: "string",
                description: "User's original request",
              },
            },
            required: ["message"],
          },
        },
        {
          name: "getShipmentTrackingLink",
          description:
            "Get shipment tracking link when user asks about order status, delivery, where is my order, when will it arrive, tracking information, last order",
          parameters: {
            type: "object",
            properties: {
              orderCode: {
                type: "string",
                description: "Order number or code to track",
              },
              message: {
                type: "string",
                description: "User's original tracking request",
              },
            },
            required: ["message"],
          },
        },
      ]

      logger.info(
        `Calling function router for message: "${message.substring(0, 30)}${
          message.length > 30 ? "..." : ""
        }"`
      )

      // Chiamata all'API OpenRouter con le funzioni definite
      const axios = require("axios")
      const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions"
      const openRouterApiKey = process.env.OPENROUTER_API_KEY

      // DEBUG: Log prompt e funzioni
      logger.info(
        "🔍 DEBUG - Function Router Prompt:",
        functionRouterPrompt.substring(0, 200) + "..."
      )
      logger.info(
        "🔍 DEBUG - Available Functions:",
        availableFunctions.map((f) => f.name)
      )
      logger.info("🔍 DEBUG - User Message:", message)
      logger.info(
        "🔍 DEBUG - Conversation Context:",
        conversationContext.length,
        "messages"
      )
      logger.info("🔍 DEBUG - OpenRouter API Key present:", !!openRouterApiKey)
      // Costruisci l'array di messaggi includendo il contesto della conversazione
      const messages = [{ role: "system", content: functionRouterPrompt }]

      // Aggiungi gli ultimi 3 messaggi della conversazione per contesto
      if (conversationContext && conversationContext.length > 0) {
        const recentContext = conversationContext.slice(-3) // Ultimi 3 messaggi
        for (const contextMsg of recentContext) {
          messages.push({
            role: contextMsg.direction === "INBOUND" ? "user" : "assistant",
            content: contextMsg.content,
          })
        }
        logger.info(
          "🔍 DEBUG - Added",
          recentContext.length,
          "context messages"
        )
      }

      // Aggiungi il messaggio corrente
      messages.push({ role: "user", content: message })

      const requestPayload = {
        model: "openai/gpt-5-mini",
        messages: messages,
        tools: availableFunctions.map((func) => ({
          type: "function",
          function: func,
        })),
        tool_choice: "auto",
      }

      logger.info(
        "🔍 DEBUG - Request payload:",
        JSON.stringify(requestPayload, null, 2)
      )

      let response
      try {
        response = await axios.post(openRouterUrl, requestPayload, {
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
            "X-Title": "ShopME Function Router",
          },
        })
        logger.info("🔍 DEBUG - Axios call successful")
      } catch (axiosError) {
        logger.error("🔍 DEBUG - Axios error:", axiosError.message)
        if (axiosError.response) {
          logger.error(
            "🔍 DEBUG - Axios response error:",
            axiosError.response.data
          )
        }
        throw axiosError
      }

      // DEBUG: Log risposta OpenRouter
      logger.info(
        "🔍 DEBUG - OpenRouter Response:",
        JSON.stringify(response.data.choices[0]?.message, null, 2)
      )

      // Estrai la chiamata di tool dal risultato
      const toolCalls = response.data.choices[0]?.message?.tool_calls
      const toolCall = toolCalls?.[0]

      if (!toolCall || !toolCall.function) {
        logger.warn("No tool call returned by OpenRouter")
        return {
          function_call: {
            name: "get_generic_response",
            arguments: {},
          },
        }
      }

      // Parsing degli argomenti della funzione
      let functionArgs = {}
      try {
        if (toolCall.function.arguments) {
          functionArgs = JSON.parse(toolCall.function.arguments)
        }
      } catch (error) {
        logger.error("Error parsing function arguments:", error)
      }

      logger.info(`Function router selected: ${toolCall.function.name}`)

      return {
        function_call: {
          name: toolCall.function.name,
          arguments: functionArgs,
        },
        // Normalize for debug clients and downstream services
        name: toolCall.function.name,
        arguments: functionArgs,
        functionCalls: [
          {
            name: toolCall.function.name,
            arguments: functionArgs,
            source: "function-router",
          },
        ],
      }
    } catch (error) {
      logger.error("Error calling function router:", error)
      return {
        function_call: {
          name: "get_generic_response",
          arguments: {},
        },
      }
    }
  }

  /**
   * Delete a chat session and all its messages
   *
   * @param chatSessionId The chat session ID
   * @param workspaceId Optional workspace ID for filtering
   * @returns True if successful, false otherwise
   */
  async deleteChat(
    chatSessionId: string,
    workspaceId?: string
  ): Promise<boolean> {
    try {
      // First verify that the chat session belongs to the workspace if needed
      if (workspaceId) {
        const session = await this.prisma.chatSession.findFirst({
          where: {
            id: chatSessionId,
            workspaceId,
          },
          select: { id: true },
        })

        if (!session) {
          logger.warn(
            `deleteChat: Chat session ${chatSessionId} not found in workspace ${workspaceId}`
          )
          return false
        }
      }

      // Delete all messages in the chat session
      await this.prisma.message.deleteMany({
        where: {
          chatSessionId,
        },
      })

      // Then delete the chat session itself
      await this.prisma.chatSession.delete({
        where: {
          id: chatSessionId,
        },
      })

      logger.info(`Deleted chat session: ${chatSessionId}`)
      return true
    } catch (error) {
      logger.error(`Error deleting chat session ${chatSessionId}:`, error)
      return false
    }
  }

  /**
   * Get latest messages for a phone number
   * @param phoneNumber The phone number
   * @param limit Number of messages to return
   * @param workspaceId Workspace ID to filter by
   * @returns Recent chat messages
   */
  async getLatesttMessages(
    phoneNumber: string,
    limit = 30,
    workspaceId?: string
  ) {
    try {
      logger.info(`[DB] Fetching messages from database for ${phoneNumber}`)

      // Find customer by phone
      const customer = await this.findCustomerByPhone(phoneNumber)
      if (!customer) return []

      // Find active chat session
      const session = await this.prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          status: "active",
          ...(workspaceId ? { workspaceId } : {}),
        },
      })

      if (!session) return []

      // Find messages for this session
      return await this.prisma.message.findMany({
        where: {
          chatSessionId: session.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      })
    } catch (error) {
      logger.error("Error getting latest messages:", error)
      return []
    }
  }

  /**
   * Get recent messages within a time window (for LLM context)
   * @param phoneNumber The phone number
   * @param minutesAgo How many minutes back to look
   * @param workspaceId Workspace ID to filter by
   * @returns Recent chat messages within time window
   */
  async getRecentMessagesByTime(
    phoneNumber: string,
    minutesAgo = 5,
    workspaceId?: string
  ) {
    try {
      logger.info(
        `[HISTORY] Fetching messages from last ${minutesAgo} minutes for ${phoneNumber}`
      )

      // Find customer by phone
      const customer = await this.findCustomerByPhone(phoneNumber)
      if (!customer) {
        logger.warn(`[HISTORY] Customer not found for phone: ${phoneNumber}`)
        return []
      }

      // Find active chat session
      const session = await this.prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          status: "active",
          ...(workspaceId ? { workspaceId } : {}),
        },
      })

      if (!session) {
        logger.warn(`[HISTORY] No active session for customer: ${customer.id}`)
        return []
      }

      // Calculate time threshold
      const timeThreshold = new Date(Date.now() - minutesAgo * 60 * 1000)

      // Find messages for this session within time window
      const messages = await this.prisma.message.findMany({
        where: {
          chatSessionId: session.id,
          createdAt: {
            gte: timeThreshold, // Greater than or equal to threshold
          },
        },
        orderBy: {
          createdAt: "desc", // Most recent first
        },
        take: 20, // Max 20 messages even if more exist in time window
      })

      logger.info(
        `[HISTORY] Found ${messages.length} messages from last ${minutesAgo} minutes`
      )

      return messages
    } catch (error) {
      logger.error("[HISTORY] Error getting recent messages by time:", error)
      return []
    }
  }

  /**
   * Get response from an agent
   * @param agent The agent to use
   * @param message The message to process
   * @returns The agent response
   */
  async getResponseFromAgent(agent: any, message: string) {
    try {
      // In a real implementation, this would call an LLM API
      // For now, we'll just return a mock response based on the message content
      const response = {
        name: agent.name || "Unknown",
        content: agent.content || "",
        department: agent.department || null,
      }

      return response
    } catch (error) {
      logger.error("Error getting response from agent:", error)
      return { name: "Error", content: "Failed to get agent response" }
    }
  }

  /**
   * Get conversation response from LLM
   * @param chatHistory Previous messages
   * @param message Current user message
   * @param systemPrompt System prompt for the LLM
   * @returns LLM response
   */
  async getConversationResponse(
    chatHistory: any[],
    message: string,
    systemPrompt: string
  ) {
    try {
      // In a real implementation, this would call an LLM API
      // For now, we'll just return a mock response
      return "This is a mock response from the LLM"
    } catch (error) {
      logger.error("Error getting conversation response:", error)
      return "Failed to generate response"
    }
  }

  /**
   * Count recent messages from a phone number within a time window
   * @param phoneNumber Customer phone number
   * @param workspaceId Workspace ID
   * @param since Date to count messages from
   * @returns Number of messages
   */
  async countRecentMessages(
    phoneNumber: string,
    workspaceId: string,
    since: Date
  ): Promise<number> {
    try {
      const count = await this.prisma.message.count({
        where: {
          chatSession: {
            workspaceId: workspaceId,
            customer: {
              phone: phoneNumber,
            },
          },
          direction: MessageDirection.INBOUND,
          createdAt: {
            gte: since,
          },
        },
      })

      return count
    } catch (error) {
      logger.error("Error counting recent messages:", error)
      return 0 // Return 0 on error to avoid false positives
    }
  }

  /**
   * Update customer blacklist status
   * @param customerId Customer ID
   * @param workspaceId Workspace ID
   * @param isBlacklisted Blacklist status
   */
  async updateCustomerBlacklist(
    customerId: string,
    workspaceId: string,
    isBlacklisted: boolean
  ): Promise<void> {
    try {
      await this.prisma.customers.update({
        where: {
          id: customerId,
          workspaceId,
        },
        data: {
          isBlacklisted,
        },
      })

      logger.info(
        `Customer ${customerId} blacklist status updated to: ${isBlacklisted}`
      )
    } catch (error) {
      logger.error("Error updating customer blacklist status:", error)
      throw error
    }
  }

  /**
   * Add phone number to blocklist
   * NOTE: Workspace-level blocklist was removed during database cleanup.
   * Now using customers.isBlacklisted field instead.
   * This method is kept for backward compatibility but does nothing.
   * @deprecated Use customer.isBlacklisted field directly
   * @param phoneNumber Phone number to add
   * @param workspaceId Workspace ID
   */
  async addToWorkspaceBlocklist(
    phoneNumber: string,
    workspaceId: string
  ): Promise<void> {
    logger.warn(
      `addToWorkspaceBlocklist is deprecated. Use customers.isBlacklisted field instead. Phone: ${phoneNumber}, Workspace: ${workspaceId}`
    )
    // Method kept for backward compatibility - workspace.blocklist field removed
    // To block a customer, update: customers.isBlacklisted = true
  }

  /**
   * TASK 4: Check if customer has recent activity within specified hours
   * Used for "Bentornato {NOME}" functionality
   *
   * @param customerId The customer ID
   * @param hours Number of hours to check back (default: 2)
   * @param workspaceId The workspace ID for filtering
   * @returns true if customer has recent activity, false otherwise
   */
  async hasRecentActivity(
    customerId: string,
    hours: number = 2,
    workspaceId?: string
  ): Promise<boolean> {
    try {
      const hoursAgo = new Date()
      hoursAgo.setHours(hoursAgo.getHours() - hours)

      const recentMessage = await this.prisma.message.findFirst({
        where: {
          chatSession: {
            customerId: customerId,
            ...(workspaceId && { workspaceId: workspaceId }),
          },
          direction: MessageDirection.INBOUND, // Only check incoming messages from customer
          createdAt: {
            gte: hoursAgo,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      const hasActivity = !!recentMessage

      logger.info(
        `[TASK4] hasRecentActivity for customer ${customerId}: ${hasActivity} (within ${hours} hours)`
      )

      return hasActivity
    } catch (error) {
      logger.error(
        `[TASK4] Error checking recent activity for customer ${customerId}:`,
        error
      )
      return false // Return false on error to trigger welcome back message (safer)
    }
  }

  /**
   * Get WIP message from database - NO HARDCODE (English only)
   * @param workspaceId Workspace ID
   * @returns WIP message from database (will be translated by Safety & Translation layer)
   */
  async getWipMessage(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { wipMessage: true },
      })

      if (!workspace?.wipMessage) {
        logger.error(
          `❌ NO WIP MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`
        )
        throw new Error("WIP message not configured in database")
      }

      // wipMessage is Json (multilingual), extract English version
      const wipMessageObj = workspace.wipMessage as {
        en: string
        es: string
        it: string
        pt: string
      }
      return wipMessageObj.en || JSON.stringify(workspace.wipMessage)
    } catch (error) {
      logger.error(
        `Error getting WIP message for workspace ${workspaceId}:`,
        error
      )
      throw error // Don't use hardcoded fallback - throw to ensure proper configuration
    }
  }

  /**
   * Get welcome message from database - NO HARDCODE (English only)
   * @param workspaceId Workspace ID
   * @returns Welcome message from database (will be translated by Safety & Translation layer)
   */
  async getWelcomeMessage(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { welcomeMessage: true },
      })

      if (!workspace?.welcomeMessage) {
        logger.error(
          `❌ NO WELCOME MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`
        )
        throw new Error("Welcome message not configured in database")
      }

      // welcomeMessage is Json (multilingual), extract English version
      const welcomeMessageObj = workspace.welcomeMessage as {
        en: string
        es: string
        it: string
        pt: string
      }
      return welcomeMessageObj.en || JSON.stringify(workspace.welcomeMessage)
    } catch (error) {
      logger.error(
        `Error getting welcome message for workspace ${workspaceId}:`,
        error
      )
      throw error // Don't use hardcoded fallback - throw to ensure proper configuration
    }
  }

  /**
   * Get welcome back message from database - NO HARDCODE
   * Uses afterRegistrationMessages as welcome back messages
   * @param workspaceId Workspace ID
   * @param customerName Customer name
   * @param language Customer language
   * @returns Welcome back message from database
   */
  async getWelcomeBackMessage(
    workspaceId: string,
    customerName: string,
    language: string
  ): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { afterRegistrationMessages: true },
      })

      if (!workspace?.afterRegistrationMessages) {
        logger.warn(
          `No after registration messages found for workspace ${workspaceId}`
        )
        return `Welcome back, ${customerName}! How can I help you today?`
      }

      const afterRegMessages = workspace.afterRegistrationMessages as Record<
        string,
        string
      >
      const template =
        afterRegMessages[language] ||
        afterRegMessages["en"] ||
        `Welcome back, {name}! How can I help you today?`

      return template
        .replace("{name}", customerName)
        .replace("{customerName}", customerName)
        .replace("[nome]", customerName)
    } catch (error) {
      logger.error(
        `Error getting welcome back message for workspace ${workspaceId}:`,
        error
      )
      return `Welcome back, ${customerName}! How can I help you today?`
    }
  }

  /**
   * Get error message from database - NO HARDCODE (English only)
   * Uses wipMessage as fallback for error messages
   * @param workspaceId Workspace ID
   * @returns Error message from database (will be translated by Safety & Translation layer)
   */
  async getErrorMessage(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { wipMessage: true },
      })

      if (!workspace?.wipMessage) {
        logger.error(
          `❌ NO WIP MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`
        )
        throw new Error("Error message not configured in database")
      }

      // wipMessage is Json (multilingual), extract English version
      const wipMessageObj = workspace.wipMessage as {
        en: string
        es: string
        it: string
        pt: string
      }
      return wipMessageObj.en || JSON.stringify(workspace.wipMessage)
    } catch (error) {
      logger.error(
        `Error getting error message for workspace ${workspaceId}:`,
        error
      )
      throw error // Don't use hardcoded fallback
    }
  }

  /**
   * Get agent configuration from database - NO HARDCODE
   * @param workspaceId Workspace ID
   * @returns Agent configuration from database
   */
  async getAgentConfig(workspaceId: string): Promise<{
    prompt: string
    model: string
    temperature: number
    maxTokens: number
  } | null> {
    try {
      const agentConfig = await this.prisma.agentConfig.findFirst({
        where: {
          workspaceId: workspaceId,
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (!agentConfig) {
        return null
      }

      return {
        prompt: agentConfig.systemPrompt || "", // ✅ CORRECT: Field is 'systemPrompt' in schema
        model: agentConfig.model || "openai/gpt-4o-mini",
        temperature: agentConfig.temperature || 0.0, // Default to 0 temperature
        maxTokens: agentConfig.maxTokens || 5000,
      }
    } catch (error) {
      logger.error(
        `Error getting agent config for workspace ${workspaceId}:`,
        error
      )
      return null
    }
  }

  /**
   * Get workspace URL for registration links
   */
  async getWorkspaceUrl(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { url: true },
      })

      if (!workspace?.url) {
        logger.warn(`No URL found for workspace ${workspaceId}, using default`)
        return "http://localhost:3000"
      }

      return workspace.url
    } catch (error) {
      logger.error("Error getting workspace URL:", error)
      return "http://localhost:3000"
    }
  }

  /**
   * Get Prisma client for direct database access (public method for services)
   */
  public getPrismaClient(): PrismaClient {
    return this.prisma
  }

  /**
   * Find services with filtering (public method for LangChain)
   */
  public async findServices(
    workspaceId: string,
    options?: {
      category?: string
      limit?: number
      isActive?: boolean
    }
  ) {
    try {
      const whereClause: any = {
        workspaceId,
        isActive: options?.isActive ?? true,
      }

      if (options?.category) {
        whereClause.category = options.category
      }

      return await this.prisma.services.findMany({
        where: whereClause,
        take: options?.limit || 10,
        orderBy: { name: "asc" },
      })
    } catch (error) {
      logger.error("Error finding services:", error)
      return []
    }
  }

  /**
   * Find FAQs with filtering (public method for LangChain)
   */
  public async findFAQs(
    workspaceId: string,
    options?: {
      topic?: string
      limit?: number
      isActive?: boolean
    }
  ) {
    try {
      const whereClause: any = {
        workspaceId,
        isActive: options?.isActive ?? true,
      }

      if (options?.topic) {
        whereClause.OR = [
          { question: { contains: options.topic, mode: "insensitive" } },
          { answer: { contains: options.topic, mode: "insensitive" } },
        ]
      }

      return await this.prisma.fAQ.findMany({
        where: whereClause,
        take: options?.limit || 5,
        orderBy: { createdAt: "desc" },
      })
    } catch (error) {
      logger.error("Error finding FAQs:", error)
      return []
    }
  }

  /**
   * Find offers with filtering (public method for LangChain)
   */
  public async findOffers(
    workspaceId: string,
    options?: {
      category?: string
      limit?: number
      isActive?: boolean
    }
  ) {
    try {
      const now = new Date()
      const whereClause: any = {
        workspaceId,
        isActive: options?.isActive ?? true,
        startDate: { lte: now },
        endDate: { gte: now },
      }

      if (options?.category) {
        whereClause.category = { name: options.category }
      }

      return await this.prisma.offers.findMany({
        where: whereClause,
        include: { category: true },
        take: options?.limit || 10,
        orderBy: { discountPercent: "desc" },
      })
    } catch (error) {
      logger.error("Error finding offers:", error)
      return []
    }
  }

  /**
   * Create order (public method for LangChain)
   */
  public async createOrder(data: {
    customerId: string
    workspaceId: string
    status?: OrderStatus
    totalAmount?: number
  }) {
    try {
      // Generate unique order code - 5 uppercase letters
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      let orderCode = ""
      for (let i = 0; i < 5; i++) {
        orderCode += letters.charAt(Math.floor(Math.random() * letters.length))
      }

      return await this.prisma.orders.create({
        data: {
          orderCode: orderCode,
          customerId: data.customerId,
          workspaceId: data.workspaceId,
          status: data.status || OrderStatus.PENDING,
          totalAmount: data.totalAmount || 0,
        },
      })
    } catch (error) {
      logger.error("Error creating order:", error)
      throw new Error("Failed to create order")
    }
  }

  /**
   * Recupera le categorie attive dal database e le formatta per il prompt.
   * Il Translation Layer tradurrà automaticamente nella lingua del cliente.
   * @param workspaceId L'ID del workspace.
   * @returns Una stringa con le categorie formattate in italiano (lingua base).
   */
  async getActiveCategories(workspaceId: string): Promise<string> {
    try {
      const categories = await this.prisma.categories.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
      })

      if (categories.length === 0) return ""

      // Feature 123: Format categories with numbers for easy selection
      // Format: 1. Category Name - Description
      const formattedCategories = categories
        .map((category, index) => {
          const name = category.name || "Categoria"
          const description = category.description || ""

          // Prendi una descrizione breve (prima frase o primi 80 caratteri)
          const shortDesc = description
            .split(/[.,;]/)[0]
            .substring(0, 80)
            .trim()

          return `${index + 1}. **${name}** - ${shortDesc || "Prodotti disponibili"}`
        })
        .join("\n")

      return `\n${formattedCategories}\n`
    } catch (error) {
      logger.error("Error fetching active categories:", error)
      return ""
    }
  }

  /**
   * Recupera le offerte attive dal database e le formatta per il prompt.
   * Il Translation Layer tradurrà automaticamente nella lingua del cliente.
   * @param workspaceId L'ID del workspace.
   * @returns Una stringa con le offerte formattate in italiano (lingua base).
   */
  async getActiveOffers(workspaceId: string): Promise<string> {
    try {
      const now = new Date()

      const offers = await this.prisma.offers.findMany({
        where: {
          workspaceId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          category: true,
        },
        orderBy: {
          discountPercent: "desc",
        },
      })

      if (offers.length === 0) {
        return "" // Nessuna offerta attiva
      }

      // Formatta le offerte dal database - SEMPRE in italiano (lingua base)
      // Il Translation Layer si occuperà della traduzione finale
      const formattedOffers = offers
        .map((offer) => {
          const categoryName = offer.category?.name || "Generale"
          return `Sconto di questo mese: ${offer.discountPercent}% sulla categoria ${categoryName}`
        })
        .join(" • ")

      return `\n${formattedOffers}\n`
    } catch (error) {
      logger.error("Error fetching active offers:", error)
      return "" // In caso di errore, restituisce una stringa vuota
    }
  }

  // 🔧 NEW: Debug function to count active and expired links
  async getLinkCounts(workspaceId: string) {
    try {
      const now = new Date()

      // Count active links (not expired)
      const activeLinksCount = await this.prisma.shortUrls.count({
        where: {
          workspaceId,
          isActive: true,
          OR: [
            { expiresAt: null }, // Never expires
            { expiresAt: { gt: now } }, // Not yet expired
          ],
        },
      })

      // Count expired links
      const expiredLinksCount = await this.prisma.shortUrls.count({
        where: {
          workspaceId,
          expiresAt: { lt: now }, // Expired
        },
      })

      // Count secure tokens active
      const activeTokensCount = await this.prisma.secureToken.count({
        where: {
          workspaceId,
          expiresAt: { gt: now }, // Not yet expired
        },
      })

      // Count secure tokens expired
      const expiredTokensCount = await this.prisma.secureToken.count({
        where: {
          workspaceId,
          expiresAt: { lt: now }, // Expired
        },
      })

      return {
        shortUrls: {
          active: activeLinksCount,
          expired: expiredLinksCount,
        },
        secureTokens: {
          active: activeTokensCount,
          expired: expiredTokensCount,
        },
      }
    } catch (error) {
      logger.error("Error getting link counts:", error)
      return {
        shortUrls: { active: 0, expired: 0 },
        secureTokens: { active: 0, expired: 0 },
      }
    }
  }
}
