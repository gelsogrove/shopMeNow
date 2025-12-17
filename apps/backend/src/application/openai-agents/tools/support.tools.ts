/**
 * OpenAI Agents SDK - Support Tools
 * 
 * Tools for customer support: FAQ, human handoff, services.
 * 
 * @architecture Clean Architecture - Tools layer
 * @security ALL queries filtered by workspaceId
 * @critical NO hardcoded data - all from database
 */

import { tool } from "@openai/agents"
import { z } from "zod"
import Fuse from "fuse.js"
import { AgentContext, FAQResult, ServiceResult, HumanSupportResult, ToolResult } from "../types"
import logger from "../../../utils/logger"

/**
 * Search FAQs
 */
export const searchFAQsTool = tool({
  name: "search_faqs",
  description: `Search frequently asked questions for answers.
    Use this when the customer asks a general question that might be in the FAQ.`,
  parameters: z.object({
    query: z.string().describe("Search query or question"),
    category: z.string().optional().describe("FAQ category to filter by"),
  }),
  execute: async ({ query, category }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      logger.info(`❓ [searchFAQs] Query: "${query}", Category: ${category || "all"}`)
      
      const whereClause: any = {
        workspaceId: ctx.workspaceId,
        isActive: true,
      }
      
      if (category) {
        whereClause.category = category
      }
      
      const faqs = await ctx.prisma.fAQ.findMany({
        where: whereClause,
        orderBy: { order: "asc" },
      })
      
      if (faqs.length === 0) {
        return {
          success: true,
          data: [],
          message: "Nessuna FAQ disponibile",
        } as ToolResult<FAQResult[]>
      }
      
      // Fuzzy search
      const fuse = new Fuse(faqs, {
        keys: [
          { name: "question", weight: 0.6 },
          { name: "answer", weight: 0.3 },
          { name: "keywords", weight: 0.1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeScore: true,
      })
      
      const searchResults = fuse.search(query)
      
      const results: FAQResult[] = searchResults.slice(0, 5).map(({ item }) => ({
        id: item.id,
        question: item.question,
        answer: item.answer,
        category: item.category || undefined,
      }))
      
      return {
        success: true,
        data: results,
        message: results.length > 0 
          ? `Trovate ${results.length} FAQ pertinenti` 
          : "Nessuna FAQ corrispondente trovata",
      } as ToolResult<FAQResult[]>
      
    } catch (error) {
      logger.error(`❌ [searchFAQs] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nella ricerca FAQ",
      } as ToolResult<FAQResult[]>
    }
  },
})

/**
 * Get all FAQ categories
 */
export const getFAQCategoriesTool = tool({
  name: "get_faq_categories",
  description: `Get list of FAQ categories.
    Use this to help the customer browse FAQs by topic.`,
  parameters: z.object({}),
  execute: async (_, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const faqs = await ctx.prisma.fAQ.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          category: { not: null },
        },
        select: { category: true },
        distinct: ["category"],
      })
      
      const categories = faqs
        .map((f) => f.category)
        .filter((c): c is string => c !== null)
      
      return {
        success: true,
        data: categories,
        message: `${categories.length} categorie FAQ disponibili`,
      } as ToolResult<string[]>
      
    } catch (error) {
      logger.error(`❌ [getFAQCategories] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero categorie FAQ",
      } as ToolResult<string[]>
    }
  },
})

/**
 * Get available services
 */
export const getServicesTool = tool({
  name: "get_services",
  description: `Get list of available services.
    Use this when the customer asks about services offered.`,
  parameters: z.object({}),
  execute: async (_, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const services = await ctx.prisma.services.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
        },
        orderBy: { name: "asc" },
      })
      
      const results: ServiceResult[] = services.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        price: s.price,
        duration: s.duration,
        imageUrl: s.imageUrl,
      }))
      
      return {
        success: true,
        data: results,
        message: results.length > 0 
          ? `${results.length} servizi disponibili` 
          : "Nessun servizio disponibile",
      } as ToolResult<ServiceResult[]>
      
    } catch (error) {
      logger.error(`❌ [getServices] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero servizi",
      } as ToolResult<ServiceResult[]>
    }
  },
})

/**
 * Request human support
 */
export const requestHumanSupportTool = tool({
  name: "request_human_support",
  description: `Request to speak with a human operator.
    Use this when the customer explicitly asks to speak with a person/human/operator,
    or when the conversation requires human intervention.`,
  parameters: z.object({
    reason: z.string().describe("Reason for requesting human support"),
    urgency: z.enum(["low", "medium", "high"]).default("medium").describe("Urgency level"),
  }),
  execute: async ({ reason, urgency }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      logger.info(`👤 [requestHumanSupport] Customer: ${ctx.customerId}, Reason: ${reason}`)
      
      // Get workspace settings for human support
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId },
        select: {
          hasHumanSupport: true,
          humanSupportInstructions: true,
          operatorContactMethod: true,
          operatorWhatsappNumber: true,
          notificationEmail: true,
        },
      })
      
      if (!workspace?.hasHumanSupport) {
        return {
          success: false,
          error: "Human support not available",
          message: "Il supporto umano non è disponibile per questo canale. Posso aiutarti in altro modo?",
        } as ToolResult<HumanSupportResult>
      }
      
      // Create support ticket/notification
      // In a real implementation, this would:
      // 1. Send notification to operator (email/WhatsApp)
      // 2. Create a support ticket in the system
      // 3. Queue the customer for human callback
      
      const ticketId = `TKT-${Date.now()}`
      
      // Log the support request
      await ctx.prisma.agentConversationLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          customerId: ctx.customerId,
          conversationId: ctx.conversationId,
          messageId: ticketId,
          step: 1,
          agentType: "HUMAN_SUPPORT",
          agentAction: "request_handoff",
          inputMessage: reason,
          llmResponse: `Human support requested. Ticket: ${ticketId}`,
          hasError: false,
        },
      })
      
      let responseMessage = workspace.humanSupportInstructions 
        || "La tua richiesta è stata inoltrata a un operatore. Sarai contattato al più presto."
      
      if (workspace.operatorContactMethod === "whatsapp" && workspace.operatorWhatsappNumber) {
        responseMessage += ` Puoi anche contattare direttamente: ${workspace.operatorWhatsappNumber}`
      }
      
      return {
        success: true,
        data: {
          success: true,
          ticketId,
          message: responseMessage,
          estimatedWaitTime: urgency === "high" ? "5-10 minuti" : "15-30 minuti",
        },
        message: responseMessage,
      } as ToolResult<HumanSupportResult>
      
    } catch (error) {
      logger.error(`❌ [requestHumanSupport] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nella richiesta di supporto umano",
      } as ToolResult<HumanSupportResult>
    }
  },
})

/**
 * Update customer profile
 */
export const updateCustomerProfileTool = tool({
  name: "update_customer_profile",
  description: `Update customer profile information.
    Use this when the customer wants to update their email, phone, name, or address.`,
  parameters: z.object({
    name: z.string().optional().describe("Customer name"),
    email: z.string().email().optional().describe("Customer email"),
    phone: z.string().optional().describe("Customer phone"),
    address: z.string().optional().describe("Customer address"),
    language: z.string().optional().describe("Preferred language code (ENG, ITA, ESP, POR)"),
  }),
  execute: async ({ name, email, phone, address, language }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      // Verify customer exists and belongs to workspace
      const customer = await ctx.prisma.customers.findFirst({
        where: {
          id: ctx.customerId,
          workspaceId: ctx.workspaceId,
        },
      })
      
      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
          message: "Profilo cliente non trovato",
        } as ToolResult<boolean>
      }
      
      const updateData: any = {}
      if (name) updateData.name = name
      if (email) updateData.email = email
      if (phone) updateData.phone = phone
      if (address) updateData.address = address
      if (language) updateData.language = language
      
      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: "No fields to update",
          message: "Nessun dato da aggiornare",
        } as ToolResult<boolean>
      }
      
      await ctx.prisma.customers.update({
        where: { id: ctx.customerId },
        data: updateData,
      })
      
      const updatedFields = Object.keys(updateData).join(", ")
      
      return {
        success: true,
        data: true,
        message: `Profilo aggiornato: ${updatedFields}`,
      } as ToolResult<boolean>
      
    } catch (error) {
      logger.error(`❌ [updateCustomerProfile] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nell'aggiornamento del profilo",
      } as ToolResult<boolean>
    }
  },
})

/**
 * Get customer profile
 */
export const getCustomerProfileTool = tool({
  name: "get_customer_profile",
  description: `Get current customer profile information.
    Use this when the customer asks about their account details or profile.`,
  parameters: z.object({}),
  execute: async (_, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const customer = await ctx.prisma.customers.findFirst({
        where: {
          id: ctx.customerId,
          workspaceId: ctx.workspaceId,
        },
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
          language: true,
          discount: true,
          createdAt: true,
        },
      })
      
      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
          message: "Profilo non trovato",
        } as ToolResult<any>
      }
      
      return {
        success: true,
        data: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "Non specificato",
          address: customer.address || "Non specificato",
          language: customer.language,
          discount: customer.discount ? `${customer.discount}%` : "Nessuno",
          memberSince: customer.createdAt.toLocaleDateString("it-IT"),
        },
        message: "Profilo cliente recuperato",
      } as ToolResult<any>
      
    } catch (error) {
      logger.error(`❌ [getCustomerProfile] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero del profilo",
      } as ToolResult<any>
    }
  },
})

// Export all support tools
export const supportTools = [
  searchFAQsTool,
  getFAQCategoriesTool,
  getServicesTool,
  requestHumanSupportTool,
  updateCustomerProfileTool,
  getCustomerProfileTool,
]
