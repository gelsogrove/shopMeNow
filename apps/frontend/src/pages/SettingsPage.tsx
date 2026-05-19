/**
 * SettingsPage - Pagina Settings con architettura modulare
 * 
 * Architettura:
 * - Dropdown menu per navigare tra 5 sezioni
 * - Layout 2 colonne: Form (sinistra) + Help Panel (destra)
 * - Save per sezione
 * - Smart dirty detection
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Save, Trash2, Loader2, Power, Smartphone, Sparkles } from "lucide-react"
import { toast } from "@/lib/toast"
import { ChatWidget } from "@/components/ChatWidget"
import { IMG_BASE_URL } from "@/config"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { useWebSocket } from "@/hooks/useWebSocket"
import { storage } from "@/lib/storage"
import { updateWorkspace, deleteWorkspace, getWorkspaceById } from "@/services/workspaceApi"

import { Switch } from "@/components/ui/switch"

// Settings components
import { SettingsDropdown, SettingsSection } from "@/components/settings/SettingsDropdown"
import { SettingsLayout } from "@/components/settings/SettingsLayout"
import { HelpPanel, HELP_CONTENT } from "@/components/settings/HelpPanel"

// Section components
import { AIPersonalitySection } from "@/components/settings/sections/AIPersonalitySection"
import { BusinessConfigSection } from "@/components/settings/sections/BusinessConfigSection"
import { WhatsAppChannelSection } from "@/components/settings/sections/WhatsAppChannelSection"
import { WebsiteWidgetSection } from "@/components/settings/sections/WebsiteWidgetSection"
import { SecuritySection } from "@/components/settings/sections/SecuritySection"
import { WidgetSupportSection } from "@/components/settings/sections/WidgetSupportSection"
import { CallingFunctionsSection } from "@/components/settings/sections/CallingFunctionsSection"
import { CalendarSection } from "@/components/settings/sections/CalendarSection"

// Types
type SectionKey = "ai-personality" | "business" | "whatsapp" | "widget" | "widget-support" | "security" | "functions" | "calendar"

// Section definitions for dropdown.
//
// F50 — Andrea 2026-05-13: when the workspace runs a custom chatbot module
// (`customChatbotId` set, e.g. "ecolaundry"), sections that are not used by
// the custom flow are filtered out at render time:
//   - Appointments & Calendar (no booking)
//   - Custom Tools (no external functions / sub-agents)
// The remaining sections stay visible because they still configure
// platform-wide concerns (Business Config, WhatsApp, Widget, Human Support,
// Security) or contain the Custom Chatbot ID field itself (AI Personality).
const ALL_SECTIONS: SettingsSection[] = [
  { key: "business", label: "Business Config", description: "Company info and preferences" },
  { key: "ai-personality", label: "AI Personality", description: "Bot identity, messages and rules" },
  { key: "whatsapp", label: "WhatsApp Channel", description: "WhatsApp Business API settings" },
  { key: "widget", label: "Website Widget", description: "Chat widget for your website" },
  { key: "widget-support", label: "Human Support", description: "Escalation to human operators" },
  { key: "calendar", label: "Appointments & Calendar", description: "Google Calendar, reminders" },
  { key: "security", label: "Security", description: "Access control and domains" },
  { key: "functions", label: "Custom Tools", description: "External functions and webhooks" },
]

// For custom chatbot workspaces, everything is managed in settings.json inside
// the custom module — the only relevant platform-level config is the WhatsApp
// channel provider credentials (API key, phone number, webhook token).
// All other sections are hidden: AI Personality, Business Config, Widget,
// Human Support, Security, Calendar, Custom Tools are either unused or
// already configured inside the custom module's own JSON.
const HIDDEN_FOR_CUSTOM_CHATBOT: Array<SectionKey> = [
  "business",
  "ai-personality",
  "widget",
  "widget-support",
  "security",
  "calendar",
  "functions",
]

function getVisibleSections(isCustomChatbot: boolean): SettingsSection[] {
  if (!isCustomChatbot) return ALL_SECTIONS
  return ALL_SECTIONS.filter((s) => !HIDDEN_FOR_CUSTOM_CHATBOT.includes(s.key as SectionKey))
}

// Default help content for each section
const SECTION_DEFAULT_HELP: Record<SectionKey, string> = {
  "ai-personality": "botName",
  "business": "businessName",
  "whatsapp": "whatsappPhoneNumber",
  "widget": "widgetTitle",
  "widget-support": "humanSupportEnabled",
  "calendar": "appointmentReminder24hEnabled",
  "security": "allowedDomains",
  "functions": "webhookUrl",
}

// Default messages
const defaultWelcomeMessage = "👋 Welcome! I'm your digital assistant. How can I help you today?"
const defaultWipMessage = "⚠️ System currently under maintenance. Please try again later."

interface FormData {
  // AI Personality
  chatbotName: string
  botIdentityResponse: string
  toneOfVoice: "formal" | "friendly" | "professional" | "casual"
  logoUrl?: string
  // Business
  name: string
  adminEmail: string
  url: string
  businessType: string
  currency: string
  defaultLanguage: string
  channelMode: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW' // TODO: Switch toggle should become a dropdown for 3-way selection
  // Channels
  channelStatus: boolean
  debugMode: boolean
  enableWhatsapp: boolean
  enableWidget: boolean
  whatsappPhoneNumber: string
  whatsappApiKey: string
  whatsappAppName: string
  whatsappAppSecret: string
  whatsappPhoneNumberId: string
  whatsappVerifyToken: string
  whatsappBusinessAccountId: string
  whatsappWebhookId?: string
  whatsappWebhookUrl?: string
  whatsappProvider?: string
  ultraMsgInstanceId?: string
  ultraMsgToken?: string
  ultraMsgApiUrl?: string
  widgetTitle: string
  widgetPrimaryColor: string
  widgetLanguage: string
  widgetIcon: string
  widgetUseChannelLogo: boolean
  widgetAutoSuggestionsEnabled: boolean
  widgetQuickReplies: string[]
  // AI Config
  customAiRules: string
  customChatbotId: string  // Custom chatbot module for FLOW workspaces (e.g. "ecolaundry")
  welcomeMessage: string
  enableWelcomeMessage: boolean // E0a
  sessionResetTimeout: number // E0b (seconds, 0 = never)
  wipMessage: string
  // Security
  allowedExternalLinks: string
  hasHumanSupport: boolean
  hasSalesAgents: boolean
  operatorContactMethod: "email" | "whatsapp"
  operatorWhatsappNumber: string
  humanSupportInstructions: string
  address: string
  registrationPage: string
  requireManualApproval: boolean
  hasProductCatalog: boolean
  hasCart: boolean
  hasOrderTracking: boolean
  needRegistration: boolean
  // Webhooks
  webhookUrl: string
  webhookTimeout: number
  // Calendar & Appointments
  enableCalendarBooking?: boolean
  timezone?: string
  appointmentReminder24hEnabled?: boolean
  appointmentReminder24hMessage?: string
  appointmentReminder1hEnabled?: boolean
  appointmentReminder1hMessage?: string
  appointmentReminder30mEnabled?: boolean
  appointmentReminder30mMessage?: string
  appointmentReminderChannel?: string
  minBookingBufferHours?: number
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { workspace, setCurrentWorkspace } = useWorkspace()
  const currentWorkspace = workspace
  const { isOwner, isSuperAdmin } = useWorkspaceRole(currentWorkspace?.id || "")
  const currentUserId = storage.getUser<{ id?: string }>()?.id
  const { socket } = useWebSocket({
    workspaceId: currentWorkspace?.id || null,
    userId: currentUserId,
  })
  const canEdit = isOwner || isSuperAdmin
  // F50: filter the dropdown to hide sections that don't apply when the
  // workspace runs a custom chatbot module.
  const isCustomChatbot = Boolean(currentWorkspace?.customChatbotId)
  const SECTIONS = getVisibleSections(isCustomChatbot)

  // Load last opened section from localStorage; for custom chatbot workspaces
  // fall back to 'whatsapp' (the only visible section) instead of 'business'.
  const getLastOpenedSection = (): SectionKey => {
    const fallback: SectionKey = isCustomChatbot ? 'whatsapp' : 'business'
    try {
      const saved = localStorage.getItem('settings-last-section')
      if (!saved) return fallback
      const candidate = saved as SectionKey
      if (isCustomChatbot && HIDDEN_FOR_CUSTOM_CHATBOT.includes(candidate)) return fallback
      return candidate
    } catch {
      return fallback
    }
  }

  // State
  const [activeSection, setActiveSection] = useState<SectionKey>(getLastOpenedSection())
  const [activeHelpField, setActiveHelpField] = useState<string>("businessName")

  // When the workspace loads async, ensure activeSection is valid for this workspace type.
  // If the current section is hidden for custom chatbot, reset to 'whatsapp'.
  useEffect(() => {
    if (isCustomChatbot && HIDDEN_FOR_CUSTOM_CHATBOT.includes(activeSection)) {
      setActiveSection('whatsapp')
    }
  }, [isCustomChatbot, activeSection])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const isDirtyRef = useRef(false)
  const lastWorkspaceIdRef = useRef<string | null>(null)
  const hydratedWorkspaceIdsRef = useRef<Set<string>>(new Set())

  const resolveLogoUrl = useCallback((value?: string) => {
    if (!value) return undefined
    if (/^https?:\/\//i.test(value)) return value
    const path = value.startsWith("/") ? value : `/${value}`
    return `${IMG_BASE_URL}${path}`
  }, [])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  const [formData, setFormData] = useState<FormData>({
    chatbotName: "Sofia",
    botIdentityResponse: "",
    toneOfVoice: "friendly",
    logoUrl: undefined,
    name: "",
    adminEmail: "",
    url: "http://localhost:3000",
    businessType: "retail",
    currency: "EUR",
    defaultLanguage: "it",
    channelMode: 'ECOMMERCE' as const,
    channelStatus: true,
    debugMode: false,
    enableWhatsapp: true,
    enableWidget: false,
    whatsappPhoneNumber: "",
    whatsappApiKey: "",
    whatsappAppName: "",
    whatsappAppSecret: "",
    whatsappPhoneNumberId: "",
    whatsappVerifyToken: "",
    whatsappBusinessAccountId: "",
    whatsappWebhookId: undefined,
    whatsappWebhookUrl: undefined,
    whatsappProvider: "meta",
    ultraMsgInstanceId: "",
    ultraMsgToken: "",
    ultraMsgApiUrl: "",
    widgetTitle: "Chat with us",
    widgetPrimaryColor: "#22c55e",
    widgetLanguage: "it",
    widgetIcon: "chat",
    widgetUseChannelLogo: false,
    widgetAutoSuggestionsEnabled: false,
    widgetQuickReplies: [],
    customAiRules: "",
    customChatbotId: "",
    welcomeMessage: defaultWelcomeMessage,
    enableWelcomeMessage: true,
    sessionResetTimeout: 3600,
    wipMessage: defaultWipMessage,
    allowedExternalLinks: "",
    hasHumanSupport: true,
    hasSalesAgents: false,
    operatorContactMethod: "email",
    operatorWhatsappNumber: "",
    humanSupportInstructions: "",
    address: "",
    registrationPage: "",
    requireManualApproval: false,
    hasProductCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    needRegistration: true,
    webhookUrl: "",
    webhookTimeout: 10000,
    // Calendar & Appointments
    enableCalendarBooking: false,
    timezone: "Europe/Rome",
    appointmentReminder24hEnabled: true,
    appointmentReminder24hMessage: undefined,
    appointmentReminder1hEnabled: true,
    appointmentReminder1hMessage: undefined,
    appointmentReminder30mEnabled: false,
    appointmentReminder30mMessage: undefined,
    appointmentReminderChannel: "whatsapp",
    minBookingBufferHours: 12,
  })

  // Load workspace data
  useEffect(() => {
    if (currentWorkspace) {
      const workspaceId = currentWorkspace.id
      const previousId = lastWorkspaceIdRef.current
      const workspaceChanged = !!previousId && previousId !== workspaceId

      if (workspaceChanged) {
        setIsDirty(false)
        isDirtyRef.current = false
      }

      lastWorkspaceIdRef.current = workspaceId

      if (isDirty && !workspaceChanged) {
        return
      }

      setFormData({
        chatbotName: currentWorkspace.chatbotName || "Sofia",
        botIdentityResponse: currentWorkspace.botIdentityResponse || "",
        toneOfVoice: (currentWorkspace.toneOfVoice as FormData["toneOfVoice"]) || "friendly",
        logoUrl: currentWorkspace.logoUrl,
        name: currentWorkspace.name || "",
        adminEmail: currentWorkspace.adminEmail || "",
        url: currentWorkspace.url || "http://localhost:3000",
        businessType: currentWorkspace.businessType || "retail",
        currency: currentWorkspace.currency || "EUR",
        defaultLanguage: currentWorkspace.defaultLanguage || "it", // ✅ Fix: API now returns defaultLanguage directly
        channelMode: currentWorkspace.channelMode ?? 'ECOMMERCE',
        channelStatus: currentWorkspace.channelStatus ?? true,
        debugMode: currentWorkspace.debugMode ?? false,
        enableWhatsapp: currentWorkspace.enableWhatsapp ?? true,
        enableWidget: currentWorkspace.enableWidget ?? false,
        whatsappPhoneNumber: currentWorkspace.whatsappPhoneNumber || "",
        whatsappApiKey: currentWorkspace.whatsappApiKey || "",
        whatsappAppName: currentWorkspace.whatsappAppName || "",
        whatsappAppSecret: currentWorkspace.whatsappAppSecret || "",
        whatsappPhoneNumberId: currentWorkspace.whatsappPhoneNumberId || "",
        whatsappVerifyToken:
          currentWorkspace.whatsappVerifyToken || currentWorkspace.whatsappWebhookToken || "",
        whatsappBusinessAccountId: currentWorkspace.whatsappBusinessAccountId || "",
        whatsappWebhookId: currentWorkspace.whatsappWebhookId,
        whatsappWebhookUrl: currentWorkspace.whatsappWebhookUrl,
        whatsappProvider: currentWorkspace.whatsappProvider || (currentWorkspace.ultraMsgInstanceId ? "ultramsg" : "meta"),
        ultraMsgInstanceId: currentWorkspace.ultraMsgInstanceId || "",
        ultraMsgToken: currentWorkspace.ultraMsgToken || "",
        ultraMsgApiUrl: currentWorkspace.ultraMsgApiUrl || "",
        widgetTitle: currentWorkspace.widgetTitle || "Chat with us",
        widgetPrimaryColor: currentWorkspace.widgetPrimaryColor || "#22c55e",
        widgetLanguage: currentWorkspace.widgetLanguage || "it",
        widgetIcon: currentWorkspace.widgetIcon || "chat",
        widgetUseChannelLogo: currentWorkspace.widgetUseChannelLogo ?? false,
        widgetAutoSuggestionsEnabled: currentWorkspace.widgetAutoSuggestionsEnabled ?? false,
        widgetQuickReplies: currentWorkspace.widgetQuickReplies || [],
        customAiRules: currentWorkspace.customAiRules || "",
        customChatbotId: currentWorkspace.customChatbotId || "",
        welcomeMessage: currentWorkspace.welcomeMessage || defaultWelcomeMessage,
        enableWelcomeMessage: currentWorkspace.enableWelcomeMessage ?? true,
        sessionResetTimeout: currentWorkspace.sessionResetTimeout ?? 3600,
        wipMessage: currentWorkspace.wipMessage || defaultWipMessage,
        allowedExternalLinks: Array.isArray(currentWorkspace.allowedExternalLinks)
          ? currentWorkspace.allowedExternalLinks.join(", ")
          : currentWorkspace.allowedExternalLinks || "",
        hasHumanSupport: currentWorkspace.hasHumanSupport ?? true,
        hasSalesAgents: currentWorkspace.hasSalesAgents ?? false,
        operatorContactMethod:
          (currentWorkspace.operatorContactMethod as "email" | "whatsapp") || "email",
        operatorWhatsappNumber: currentWorkspace.operatorWhatsappNumber || "",
        humanSupportInstructions: currentWorkspace.humanSupportInstructions || "",
        address: currentWorkspace.address || "",
        registrationPage: currentWorkspace.registrationPage || "",
        requireManualApproval: currentWorkspace.requireManualApproval || false,
        hasProductCatalog: currentWorkspace.hasProductCatalog ?? true,
        hasCart: currentWorkspace.hasCart ?? true,
        hasOrderTracking: currentWorkspace.hasOrderTracking ?? true,
        needRegistration: currentWorkspace.needRegistration ?? true,
        webhookUrl: currentWorkspace.webhookUrl || "",
        webhookTimeout: currentWorkspace.webhookTimeout || 10000,
        // Calendar & Appointments
        enableCalendarBooking: currentWorkspace.enableCalendarBooking || false,
        timezone: currentWorkspace.timezone || "Europe/Rome",
        appointmentReminder24hEnabled: currentWorkspace.appointmentReminder24hEnabled ?? true,
        appointmentReminder24hMessage: currentWorkspace.appointmentReminder24hMessage || undefined,
        appointmentReminder1hEnabled: currentWorkspace.appointmentReminder1hEnabled ?? true,
        appointmentReminder1hMessage: currentWorkspace.appointmentReminder1hMessage || undefined,
        appointmentReminder30mEnabled: currentWorkspace.appointmentReminder30mEnabled ?? false,
        appointmentReminder30mMessage: currentWorkspace.appointmentReminder30mMessage || undefined,
        appointmentReminderChannel: currentWorkspace.appointmentReminderChannel || "whatsapp",
        minBookingBufferHours: currentWorkspace.minBookingBufferHours ?? 12,
      })
    }
  }, [currentWorkspace, isDirty])

  useEffect(() => {
    if (!socket || !currentWorkspace?.id) return

    const handleChannelStatusChanged = (data: {
      workspaceId: string
      channelStatus: boolean
      source?: string
      reason?: string
      timestamp?: string
    }) => {
      if (data.workspaceId !== currentWorkspace.id) return

      setCurrentWorkspace((prev) => {
        if (!prev) return prev
        return { ...prev, channelStatus: data.channelStatus }
      })

      setFormData((prev) => {
        const currentStatus = currentWorkspace.channelStatus ?? true
        if (prev.channelStatus !== currentStatus) {
          return prev
        }
        return { ...prev, channelStatus: data.channelStatus }
      })
    }

    socket.on("channel-status-changed", handleChannelStatusChanged)

    return () => {
      socket.off("channel-status-changed", handleChannelStatusChanged)
    }
  }, [socket, currentWorkspace?.id, currentWorkspace?.channelStatus, setCurrentWorkspace])

  useEffect(() => {
    const workspaceId = currentWorkspace?.id
    if (!workspaceId) return
    if (hydratedWorkspaceIdsRef.current.has(workspaceId)) return

    hydratedWorkspaceIdsRef.current.add(workspaceId)
    let cancelled = false

    const hydrateWorkspace = async () => {
      try {
        const freshWorkspace = await getWorkspaceById(workspaceId)
        if (cancelled) return
        if (!freshWorkspace) return
        // Update context with full data; form will re-hydrate only if not dirty.
        setCurrentWorkspace(freshWorkspace)
      } catch (error) {
        console.error("Failed to hydrate workspace settings:", error)
      }
    }

    hydrateWorkspace()

    return () => {
      cancelled = true
    }
  }, [currentWorkspace?.id, setCurrentWorkspace])

  // Handle field change
  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setIsDirty(true)
    // Use functional update to avoid stale closure on errors state
    setErrors((prev) => {
      if (!prev[field]) return prev // No change needed — avoid unnecessary re-render
      return { ...prev, [field]: "" }
    })
  }, []) // No dependency on errors — functional update reads latest state

  // Handle Debug Mode toggle - immediate save (like workspace selection)
  const handleToggleDebugMode = useCallback(async (checked: boolean) => {
    if (!currentWorkspace?.id) return

    try {
      // Update immediately
      const updatedWorkspace = await updateWorkspace(currentWorkspace.id, {
        debugMode: checked,
      })

      // Update context
      setCurrentWorkspace(updatedWorkspace)

      // Update local form
      setFormData((prev) => ({ ...prev, debugMode: checked }))

      toast.success(checked ? "Debug mode enabled" : "Debug mode disabled")
    } catch (error) {
      console.error("Error updating debug mode:", error)
      toast.error("Failed to update debug mode")
      // Revert on error
      setFormData((prev) => ({ ...prev, debugMode: !checked }))
    }
  }, [currentWorkspace?.id, setCurrentWorkspace])

  // Handle field focus for help panel
  const handleFieldFocus = useCallback((fieldKey: string) => {
    setActiveHelpField(fieldKey)
  }, [])

  // Handle section change - update help field to section default
  const handleSectionChange = useCallback((sectionKey: string) => {
    setActiveSection(sectionKey as SectionKey)
    // 🆕 Save to localStorage for next visit
    try {
      localStorage.setItem('settings-last-section', sectionKey)
    } catch (error) {
      // Ignore localStorage errors
    }
    // Update help to section's default field
    const defaultField = SECTION_DEFAULT_HELP[sectionKey as SectionKey]
    if (defaultField) {
      setActiveHelpField(defaultField)
    }
  }, [])

  const pendingFocusRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      const focusKey = localStorage.getItem("settings-focus-key")
      if (focusKey) {
        pendingFocusRef.current = focusKey
        localStorage.removeItem("settings-focus-key")
      }
    } catch (error) {
      // Ignore localStorage errors
    }
  }, [])

  useEffect(() => {
    if (!pendingFocusRef.current) return
    const focusKey = pendingFocusRef.current
    const timer = window.setTimeout(() => {
      const target = document.querySelector(`[data-focus-key="${focusKey}"]`) as HTMLElement | null
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" })
        const focusable = target.querySelector(
          "input, textarea, select, button, [tabindex]:not([tabindex='-1'])"
        ) as HTMLElement | null
        focusable?.focus()
      }
      pendingFocusRef.current = null
    }, 150)

    return () => window.clearTimeout(timer)
  }, [activeSection])

  // Save handler
  const handleSave = async () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      newErrors.name = "Channel name is required"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fix the errors before saving")
      return
    }

    // Normal save
    try {
      await performSave(formData)
    } catch {
      // performSave already shows the error toast
    }
  }

  // Perform the actual save
  const performSave = async (dataToSave: FormData, options?: { suppressToast?: boolean }) => {
    try {
      const updateData: any = { ...dataToSave }
      delete updateData.logoUrl

      // Map appointment reminder UI fields to backend - ONLY new specific fields
      const reminderHours: number[] = []
      if (dataToSave.appointmentReminder24hEnabled) reminderHours.push(24)
      if (dataToSave.appointmentReminder1hEnabled) reminderHours.push(1)
      if (dataToSave.appointmentReminder30mEnabled) reminderHours.push(0.5)

      updateData.appointmentReminderHours = reminderHours
      // ✅ CRITICAL: Always send the enabled flags AND individual message fields
      updateData.appointmentReminder24hEnabled = dataToSave.appointmentReminder24hEnabled ?? true
      updateData.appointmentReminder24hMessage = dataToSave.appointmentReminder24hMessage || null
      updateData.appointmentReminder1hEnabled = dataToSave.appointmentReminder1hEnabled ?? true
      updateData.appointmentReminder1hMessage = dataToSave.appointmentReminder1hMessage || null
      updateData.appointmentReminder30mEnabled = dataToSave.appointmentReminder30mEnabled ?? false
      updateData.appointmentReminder30mMessage = dataToSave.appointmentReminder30mMessage || null
      updateData.minBookingBufferHours = dataToSave.minBookingBufferHours ?? 12
      
      // 🔒 PROTECTION: Only send boolean toggles if they actually changed
      // This prevents accidental state changes when user is just updating other settings
      // ✅ CRITICAL: Appointment fields MUST ALWAYS be sent - never delete them!
      if (currentWorkspace) {
        // channelStatus
        if (updateData.channelStatus === currentWorkspace.channelStatus) {
          delete updateData.channelStatus
        }

        // widgetUseChannelLogo
        if (updateData.widgetUseChannelLogo === currentWorkspace.widgetUseChannelLogo) {
          delete updateData.widgetUseChannelLogo
        }

        // widgetAutoSuggestionsEnabled
        if (updateData.widgetAutoSuggestionsEnabled === currentWorkspace.widgetAutoSuggestionsEnabled) {
          delete updateData.widgetAutoSuggestionsEnabled
        }

        // hasHumanSupport
        if (updateData.hasHumanSupport === currentWorkspace.hasHumanSupport) {
          delete updateData.hasHumanSupport
        }

        // hasSalesAgents
        if (updateData.hasSalesAgents === currentWorkspace.hasSalesAgents) {
          delete updateData.hasSalesAgents
        }

        // requireManualApproval
        if (updateData.requireManualApproval === currentWorkspace.requireManualApproval) {
          delete updateData.requireManualApproval
        }

        // debugMode (usually handled separately, but protect here too)
        if (updateData.debugMode === currentWorkspace.debugMode) {
          delete updateData.debugMode
        }

        // 🆕 enableCalendarBooking - protect if unchanged
        if (updateData.enableCalendarBooking === currentWorkspace.enableCalendarBooking) {
          delete updateData.enableCalendarBooking
        }

        // E0a - enableWelcomeMessage - protect if unchanged
        if (updateData.enableWelcomeMessage === currentWorkspace.enableWelcomeMessage) {
          delete updateData.enableWelcomeMessage
        }

        // E0b - sessionResetTimeout - protect if unchanged
        if (updateData.sessionResetTimeout === currentWorkspace.sessionResetTimeout) {
          delete updateData.sessionResetTimeout
        }

        // Appointment reminder fields MUST ALWAYS be sent (never delete!)
        // They are explicitly set above and should always be persisted
      }

      // Trim and cap quick replies
      if (updateData.widgetQuickReplies) {
        updateData.widgetQuickReplies = (updateData.widgetQuickReplies as string[])
          .map((r) => r.trim())
          .filter((r) => r.length > 0)
          .slice(0, 4)
      }

      if (!updateData.whatsappAppSecret) {
        delete updateData.whatsappAppSecret
      }
      if (!updateData.whatsappAppName) {
        delete updateData.whatsappAppName
      }
      if (!updateData.whatsappBusinessAccountId) {
        delete updateData.whatsappBusinessAccountId
      }

      // 🛡️ CRITICAL: Always remove provider-specific fields from base spread
      // to prevent empty strings from overwriting real DB values
      delete updateData.ultraMsgInstanceId
      delete updateData.ultraMsgToken
      delete updateData.ultraMsgApiUrl

      // Always persist WhatsApp provider if present
      if (dataToSave.whatsappProvider) {
        updateData.whatsappProvider = dataToSave.whatsappProvider
      }

      // ✅ Fix: Send defaultLanguage directly to backend (field now exists in API)
      // Keep defaultLanguage as-is in updateData, no remapping needed

      // Only send UltraMsg fields when provider is ultramsg AND values are non-empty
      if (dataToSave.whatsappProvider === "ultramsg") {
        if (dataToSave.ultraMsgInstanceId) updateData.ultraMsgInstanceId = dataToSave.ultraMsgInstanceId
        if (dataToSave.ultraMsgToken) updateData.ultraMsgToken = dataToSave.ultraMsgToken
        if (dataToSave.ultraMsgApiUrl) updateData.ultraMsgApiUrl = dataToSave.ultraMsgApiUrl
      }

      // Avoid triggering channel limit checks when channel toggles are unchanged
      if (currentWorkspace) {
        if (updateData.enableWhatsapp === currentWorkspace.enableWhatsapp) {
          delete updateData.enableWhatsapp
        }
        if (updateData.enableWidget === currentWorkspace.enableWidget) {
          delete updateData.enableWidget
        }
      }

      await updateWorkspace(currentWorkspace!.id, updateData)

      // Fetch fresh workspace data from server to ensure all fields are in sync
      const freshWorkspace = await getWorkspaceById(currentWorkspace!.id)

      // Reset dirty flags BEFORE updating workspace
      // This allows the useEffect to properly sync formData with new workspace values
      setIsDirty(false)
      isDirtyRef.current = false

      setCurrentWorkspace(freshWorkspace)

      if (!options?.suppressToast) {
        toast.success("Settings saved successfully")
      }
    } catch (error: any) {
      toast.error(error.message || "Save failed")
      throw error
    }
  }

  // Delete workspace mutation
  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => {
      return deleteWorkspace(currentWorkspace!.id)
    },
    onSuccess: async () => {
      const { api } = await import("@/services/api")
      await api.post("/auth/logout")
      localStorage.clear()
      sessionStorage.clear()
      navigate("/login")
      toast.success("Workspace deleted successfully")
    },
    onError: (error: any) => {
      toast.error(error.message || "Workspace deletion failed")
    },
  })

  const handleDeleteWorkspace = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type DELETE to confirm")
      return
    }
    setShowDeleteDialog(false)
    setDeleteConfirmation("")
    deleteWorkspaceMutation.mutate()
  }

  // Get current help content
  const currentHelp = HELP_CONTENT[activeHelpField] || HELP_CONTENT["default"] || {
    title: "Settings Help",
    description: "Select a field to see detailed information.",
  }

  // Render active section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case "ai-personality":
        return (
          <AIPersonalitySection
            formData={{
              chatbotName: formData.chatbotName,
              botIdentityResponse: formData.botIdentityResponse,
              toneOfVoice: formData.toneOfVoice,
              channelMode: formData.channelMode,
              welcomeMessage: formData.welcomeMessage,
              enableWelcomeMessage: formData.enableWelcomeMessage,
              sessionResetTimeout: formData.sessionResetTimeout,
              customAiRules: formData.customAiRules,
              wipMessage: formData.wipMessage,
              customChatbotId: formData.customChatbotId,
            }}
            errors={errors}
            canEdit={canEdit}
            onFieldChange={handleFieldChange}
            onFieldFocus={handleFieldFocus}
          />
        )
      case "business":
        return (
          <BusinessConfigSection
            formData={{
              name: formData.name,
              adminEmail: formData.adminEmail,
              url: formData.url,
              businessType: formData.businessType,
              currency: formData.currency,
              defaultLanguage: formData.defaultLanguage,
              channelMode: formData.channelMode,
              enableWhatsapp: formData.enableWhatsapp,
              enableWidget: formData.enableWidget,
              address: formData.address,
              registrationPage: formData.registrationPage,
              requireManualApproval: formData.requireManualApproval,
              hasHumanSupport: formData.hasHumanSupport,
              hasProductCatalog: formData.hasProductCatalog,
              hasCart: formData.hasCart,
              hasOrderTracking: formData.hasOrderTracking,
              needRegistration: formData.needRegistration,
            }}
            errors={errors}
            canEdit={canEdit}
            onFieldChange={handleFieldChange}
            onFieldFocus={handleFieldFocus}
          />
        )
      case "whatsapp":
        return (
          <WhatsAppChannelSection
            formData={{
              enableWhatsapp: formData.enableWhatsapp,
              whatsappPhoneNumber: formData.whatsappPhoneNumber,
              whatsappApiKey: formData.whatsappApiKey,
              whatsappAppName: formData.whatsappAppName,
              whatsappAppSecret: formData.whatsappAppSecret,
              whatsappPhoneNumberId: formData.whatsappPhoneNumberId,
              whatsappVerifyToken: formData.whatsappVerifyToken,
              whatsappBusinessAccountId: formData.whatsappBusinessAccountId,
              whatsappWebhookId: formData.whatsappWebhookId,
              whatsappWebhookUrl: formData.whatsappWebhookUrl,
              whatsappProvider: formData.whatsappProvider,
              ultraMsgInstanceId: formData.ultraMsgInstanceId,
              ultraMsgToken: formData.ultraMsgToken,
              ultraMsgApiUrl: formData.ultraMsgApiUrl,
            }}
            enableWidget={formData.enableWidget}
            errors={errors}
            canEdit={canEdit}
            onFieldChange={handleFieldChange}
            onFieldFocus={handleFieldFocus}
          />
        )
      case "widget":
        return (
          <WebsiteWidgetSection
            formData={{
              enableWidget: formData.enableWidget,
              widgetTitle: formData.widgetTitle,
              widgetPrimaryColor: formData.widgetPrimaryColor,
              widgetLanguage: formData.widgetLanguage,
              widgetIcon: formData.widgetIcon,
              widgetUseChannelLogo: formData.widgetUseChannelLogo,
              widgetAutoSuggestionsEnabled: formData.widgetAutoSuggestionsEnabled,
              widgetQuickReplies: formData.widgetQuickReplies,
              logoUrl: resolveLogoUrl(formData.logoUrl),
            }}
            workspaceId={currentWorkspace?.id || ""}
            errors={errors}
            canEdit={canEdit}
            channelMode={formData.channelMode}
            onFieldChange={handleFieldChange}
            onFieldFocus={handleFieldFocus}
          />
        )
      case "security":
        return (
          <SecuritySection
            formData={{
              allowedExternalLinks: formData.allowedExternalLinks,
            }}
            errors={errors}
            canEdit={canEdit}
            isSuperAdmin={isSuperAdmin}
            isDeleting={deleteWorkspaceMutation.isPending}
            onFieldChange={handleFieldChange}
            onFieldFocus={handleFieldFocus}
            onDeleteWorkspace={handleDeleteWorkspace}
          />
        )
      case "widget-support":
        return (
          <WidgetSupportSection
            formData={{
              hasHumanSupport: formData.hasHumanSupport,
              hasSalesAgents: formData.hasSalesAgents,
              operatorContactMethod: formData.operatorContactMethod,
              operatorWhatsappNumber: formData.operatorWhatsappNumber,
              operatorEmail: formData.adminEmail, // Use business email as default
              humanSupportInstructions: formData.humanSupportInstructions,
            }}
            errors={errors}
            canEdit={canEdit}
            onFieldChange={handleFieldChange}
            onFieldFocus={handleFieldFocus}
          />
        )
      case "functions":
        return (
          <CallingFunctionsSection
            workspaceId={currentWorkspace?.id || ""}
            canEdit={canEdit}
          />
        )
      case "calendar":
        return (
          <CalendarSection
            workspaceId={currentWorkspace?.id || ""}
            formData={{
              enableCalendarBooking: formData.enableCalendarBooking,
              timezone: formData.timezone,
              appointmentReminder24hEnabled: formData.appointmentReminder24hEnabled,
              appointmentReminder24hMessage: formData.appointmentReminder24hMessage,
              appointmentReminder1hEnabled: formData.appointmentReminder1hEnabled,
              appointmentReminder1hMessage: formData.appointmentReminder1hMessage,
              appointmentReminder30mEnabled: formData.appointmentReminder30mEnabled,
              appointmentReminder30mMessage: formData.appointmentReminder30mMessage,
              appointmentReminderChannel: formData.appointmentReminderChannel,
            }}
            onChange={handleFieldChange}
            onFocus={handleFieldFocus}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            {isCustomChatbot ? (
              /* Custom chatbot: only WhatsApp Channel is configurable here —
                 show a static pill instead of the section dropdown */
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700">
                  <Smartphone className="h-4 w-4" />
                  WhatsApp Channel
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-xs font-medium text-violet-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Custom Chatbot — all other settings are managed in settings.json
                </span>
              </div>
            ) : (
              <SettingsDropdown
                sections={SECTIONS}
                currentSection={activeSection}
                onSectionChange={handleSectionChange}
              />
            )}
          </div>

          {/* Right side: Channel Status + Debug Mode + Save */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
              {/* Debug Mode Toggle */}
              {canEdit && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${formData.debugMode
                      ? "bg-amber-50 border-amber-200"
                      : "bg-gray-100 border-gray-200"
                    }`}
                >
                  <span className={`text-sm font-medium ${formData.debugMode ? "text-amber-700" : "text-gray-500"}`}>
                    Debug
                  </span>
                  <Switch
                    checked={formData.debugMode}
                    onCheckedChange={handleToggleDebugMode}
                    className="ml-1"
                  />
                </div>
              )}

              {/* Channel Status Toggle */}
              {canEdit && (
                <div
                  data-focus-key="channelStatus"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${formData.channelStatus
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-100 border-gray-200"
                    }`}
                >
                  <Power className={`h-4 w-4 ${formData.channelStatus ? "text-green-600" : "text-gray-400"}`} />
                  <span className={`text-sm font-medium ${formData.channelStatus ? "text-green-700" : "text-gray-500"}`}>
                    {formData.channelStatus ? "Active" : "Inactive"}
                  </span>
                  <Switch
                    checked={formData.channelStatus}
                    onCheckedChange={(checked) => handleFieldChange("channelStatus", checked)}
                    className="ml-1"
                  />
                </div>
              )}

              {/* Save Button */}
              {canEdit && (
                <Button onClick={handleSave} disabled={!isDirty}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              )}
            </div>

          </div>
        </div>

        {/* Main Content with Layout */}
        <SettingsLayout
          helpPanel={
            <HelpPanel
              title={currentHelp.title}
              description={currentHelp.description}
              examples={currentHelp.examples}
              tips={currentHelp.tips}
              showVariables={
                activeSection === "ai-personality" ||
                ["welcomeMessage", "agentSystemPrompt", "botDescription"].includes(activeHelpField)
              }
              isEcommerce={formData.channelMode === 'ECOMMERCE'}
            />
          }
        >
          {renderSectionContent()}
        </SettingsLayout>
      </div>

      {/* Delete Workspace Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) setDeleteConfirmation("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Workspace
            </DialogTitle>
            <DialogDescription>
              This action will soft-delete the workspace. You can recover it within 90 days
              by contacting support. All data will be permanently deleted after 90 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deleteConfirmation">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </Label>
              <Input
                id="deleteConfirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setDeleteConfirmation("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteConfirmation !== "DELETE" || deleteWorkspaceMutation.isPending}
            >
              {deleteWorkspaceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Widget */}
      {currentWorkspace && formData.channelStatus && (
        <ChatWidget
          key={`${formData.widgetTitle}-${formData.widgetPrimaryColor}-${formData.widgetIcon}-${formData.widgetLanguage}-${formData.widgetUseChannelLogo}`}
          workspaceId={currentWorkspace.id}
          title={formData.widgetTitle}
          primaryColor={formData.widgetPrimaryColor}
          icon={formData.widgetIcon}
          logoUrl={resolveLogoUrl(formData.logoUrl)}
          useChannelLogo={formData.widgetUseChannelLogo}
          useWindowConfig={false}
          language={formData.widgetLanguage}
        />
      )}
    </div>
  )
}

export default SettingsPage
