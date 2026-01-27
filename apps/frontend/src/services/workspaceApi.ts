import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { api } from "./api"

export interface Language {
  id: string
  code: string
  name: string
}

export interface Workspace {
  id: string
  name: string
  description?: string
  deletedAt?: string | null
  currency?: string
  url?: string
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  // sensitive field
  whatsappAppSecret?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  whatsappWebhookId?: string
  whatsappWebhookToken?: string
  whatsappWebhookUrl?: string
  adminEmail?: string
  debugMode?: boolean
  welcomeMessage?: string
  wipMessage?: string
  createdAt: string
  updatedAt: string
  planType?: string | null
  trialEndsAt?: string | null
  // 🆕 Feature 199: Channel Configuration
  enableWhatsapp?: boolean
  enableWidget?: boolean
  sellsProductsAndServices?: boolean
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  humanSupportInstructions?: string
  frustrationEscalationInstructions?: string // 🆕 Feature 203: Custom escalation triggers
  operatorContactMethod?: string
  operatorWhatsappNumber?: string
  toneOfVoice?: string
  botIdentityResponse?: string
  channelStatus?: boolean
  allowedExternalLinks?: string[]
  // 🆕 Prompt Builder fields
  address?: string
  customAiRules?: string
  logoUrl?: string
  // 🆕 Channel branding
  logoUrl?: string
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
  // 🆕 Chatbot Identity & Context
  chatbotName?: string // Custom name for the chatbot (e.g., "Sofia", "Marco")
  businessType?: string // Business sector (e.g., "food", "fashion", "electronics")
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
  widgetLogoUrl?: string
  widgetLogoKey?: string
}

export interface CreateWorkspaceData {
  name: string
  whatsappPhoneNumber: string
  language?: string
  description?: string
  welcomeMessage?: string
  adminEmail?: string
}

export interface UpdateWorkspaceData {
  id?: string
  name?: string
  description?: string
  isActive?: boolean
  currency?: string
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  whatsappAppSecret?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  adminEmail?: string
  url?: string
  debugMode?: boolean
  welcomeMessage?: string
  wipMessage?: string
  allowedExternalLinks?: string
  // 🆕 Feature 199: Channel Configuration
  enableWhatsapp?: boolean
  enableWidget?: boolean
  sellsProductsAndServices?: boolean
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  humanSupportInstructions?: string
  frustrationEscalationInstructions?: string // 🆕 Feature 203
  operatorContactMethod?: string
  operatorWhatsappNumber?: string
  toneOfVoice?: string
  botIdentityResponse?: string
  channelStatus?: boolean
  // 🆕 Prompt Builder fields
  address?: string
  customAiRules?: string
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
  // 🆕 Chatbot Identity & Context
  chatbotName?: string
  businessType?: string
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
}

const workspaceApi = {
  async getAll(): Promise<Workspace[]> {
    // JWT token is automatically added by axios interceptor
    const response = await api.get("/workspaces")
    return response.data
  },

  async getCurrent(): Promise<Workspace> {
    const response = await api.get("/workspaces/current")
    return response.data
  },

  async getById(id: string): Promise<Workspace> {
    const response = await api.get(`/workspaces/${id}`)
    return response.data
  },

  async create(data: CreateWorkspaceData): Promise<Workspace> {
    const response = await api.post("/workspaces", data)
    return response.data
  },

  async update(id: string, data: UpdateWorkspaceData): Promise<Workspace> {
    const response = await api.put(`/workspaces/${id}`, data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workspaces/${id}`)
  },

  /**
   * Get badge stats for all user's workspaces
   * Returns counts for: unread messages, pending orders, needs operator intervention, blocked users, new customers (24h)
   */
  async getBadgeStats(): Promise<
    Record<
      string,
      {
        unreadMessages: number
        pendingOrders: number
        needsIntervention: number
        blockedUsers: number
        newCustomers: number
      }
    >
  > {
    try {
      logger.info("[workspaceApi] 📊 Fetching badge stats...")
      const response = await api.get("/workspaces/badge-stats")
      logger.info("[workspaceApi] 📊 Badge stats response:", response.data)
      return response.data
    } catch (error) {
      logger.error("[workspaceApi] ❌ Failed to fetch badge stats:", error)
      return {}
    }
  },
}

// Language functions
export const getLanguages = async (): Promise<Language[]> => {
  const workspace = storage.getWorkspace<{ id?: string }>()
  if (!workspace?.id) {
    throw new Error("No workspace selected")
  }
  try {
    const response = await api.get("/languages", {
      headers: {
        "x-workspace-id": workspace.id,
      },
    })
    // Extract languages array from response
    const languages = response.data.languages || []
    return languages
  } catch (error) {
    throw new Error("Failed to get languages. Please try again.")
  }
}

// Export individual functions for backward compatibility
export const getCurrentWorkspace = workspaceApi.getCurrent
export const getWorkspaces = workspaceApi.getAll
export const createWorkspace = workspaceApi.create
export const updateWorkspace = workspaceApi.update
export const deleteWorkspace = workspaceApi.delete

export { workspaceApi }
