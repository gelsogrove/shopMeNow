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
  slug?: string
  description?: string
  isActive: boolean
  isDelete: boolean
  deletedAt?: string | null
  currency?: string
  url?: string
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  whatsappAppName?: string
  // sensitive field
  whatsappAppSecret?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  whatsappWebhookId?: string
  whatsappWebhookToken?: string
  whatsappWebhookUrl?: string
  whatsappBusinessAccountId?: string
  whatsappProvider?: string
  ultraMsgInstanceId?: string
  ultraMsgToken?: string
  ultraMsgApiUrl?: string
  adminEmail?: string
  debugMode?: boolean
  welcomeMessage?: string
  enableWelcomeMessage?: boolean // E0a - toggle welcome message on/off
  sessionResetTimeout?: number // E0b - seconds after escalation before auto-reset (0 = never)
  wipMessage?: string
  defaultLanguage?: string // 🌍 ISO-2 default language for customers
  createdAt: string
  updatedAt: string
  planType?: string | null
  trialEndsAt?: string | null
  // 🆕 Feature 199: Channel Configuration
  enableWhatsapp?: boolean
  enableWidget?: boolean
  channelMode?: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  hasProductCatalog?: boolean
  hasCart?: boolean
  hasOrderTracking?: boolean
  needRegistration?: boolean
  humanSupportInstructions?: string
  operatorContactMethod?: string
  operatorWhatsappNumber?: string
  toneOfVoice?: string
  botIdentityResponse?: string
  channelStatus?: boolean
  allowedExternalLinks?: string[]
  // 🆕 Prompt Builder fields
  address?: string
  customAiRules?: string
  customChatbotId?: string // Custom chatbot module ID for FLOW workspaces (e.g. "ecolaundry")
  logoUrl?: string
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
  // 🆕 Chatbot Identity & Context
  chatbotName?: string // Custom name for the chatbot (e.g., "Sofia", "Marco")
  businessType?: string // Business sector (e.g., "food", "fashion", "electronics")
  registrationPage?: string
  requireManualApproval?: boolean
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
  widgetUseChannelLogo?: boolean
  widgetLogoUrl?: string
  widgetLogoKey?: string
  widgetAutoSuggestionsEnabled?: boolean
  widgetQuickReplies?: string[]
  channelType?: 'WHATSAPP' | 'WIDGET' | null
  // 📅 Calendar & Appointment Settings
  enableCalendarBooking?: boolean
  timezone?: string
  appointmentReminder24hEnabled?: boolean
  appointmentReminder24hMessage?: string | null
  appointmentReminder1hEnabled?: boolean
  appointmentReminder1hMessage?: string | null
  appointmentReminder30mEnabled?: boolean
  appointmentReminder30mMessage?: string | null
  appointmentReminderHours?: number[]
  appointmentReminderChannel?: string
  minBookingBufferHours?: number
  // WasenderAPI fields
  wasenderSessionId?: string | null
  wasenderApiKey?: string | null
  wasenderSessionStatus?: string | null
  wasenderPhoneNumber?: string | null
  wasenderIsActive?: boolean
  wasenderQrString?: string | null
  wasenderQrGeneratedAt?: string | null
  // Other
  websiteUrl?: string | null
  operatorEmail?: string
  notificationEmail?: string
  language?: string
  messageLimit?: number
  blocklist?: string[]
  webhookUrl?: string
  webhookTimeout?: number
  afterRegistrationMessages?: string
}

export interface ChecklistAction {
  path: string
  section?: string
  focusKey?: string
  action?: "paypal-connect"
}

export interface ChecklistItem {
  key: string
  label: string
  completed: boolean
  action?: ChecklistAction
}

export interface WorkspaceChecklist {
  workspaceId: string
  channelType: "WHATSAPP" | "WIDGET"
  channelMode: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
  completedCount: number
  totalCount: number
  percent: number
  items: ChecklistItem[]
}

export interface CreateWorkspaceData {
  name: string
  whatsappPhoneNumber?: string
  language?: string
  description?: string
  welcomeMessage?: string
  adminEmail?: string
  channelMode?: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
  hasHumanSupport?: boolean
  enableWhatsapp?: boolean
  enableWidget?: boolean
}

export interface UpdateWorkspaceData {
  id?: string
  name?: string
  description?: string
  isActive?: boolean
  currency?: string
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  whatsappAppName?: string
  whatsappAppSecret?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  whatsappBusinessAccountId?: string
  whatsappProvider?: string
  ultraMsgInstanceId?: string
  ultraMsgToken?: string
  ultraMsgApiUrl?: string
  adminEmail?: string
  url?: string
  debugMode?: boolean
  welcomeMessage?: string
  enableWelcomeMessage?: boolean // E0a
  sessionResetTimeout?: number // E0b (seconds, 0 = never)
  wipMessage?: string
  defaultLanguage?: string // 🌍 ISO-2 default language for customers
  allowedExternalLinks?: string
  // 🆕 Feature 199: Channel Configuration
  enableWhatsapp?: boolean
  enableWidget?: boolean
  channelMode?: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  hasProductCatalog?: boolean
  hasCart?: boolean
  hasOrderTracking?: boolean
  needRegistration?: boolean
  humanSupportInstructions?: string
  operatorContactMethod?: string
  operatorWhatsappNumber?: string
  toneOfVoice?: string
  botIdentityResponse?: string
  channelStatus?: boolean
  // 🆕 Prompt Builder fields
  address?: string
  customAiRules?: string
  customChatbotId?: string // Custom chatbot module ID for FLOW workspaces (e.g. "ecolaundry")
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
  // 🆕 Chatbot Identity & Context
  chatbotName?: string
  businessType?: string
  registrationPage?: string
  requireManualApproval?: boolean
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
  widgetUseChannelLogo?: boolean
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

  async getChecklist(id: string): Promise<WorkspaceChecklist> {
    const response = await api.get(`/workspaces/${id}/checklist`)
    return response.data?.data ?? response.data
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
export const getWorkspaceById = workspaceApi.getById
export const createWorkspace = workspaceApi.create
export const updateWorkspace = workspaceApi.update
export const deleteWorkspace = workspaceApi.delete

export { workspaceApi }
