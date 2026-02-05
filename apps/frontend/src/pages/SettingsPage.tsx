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
import { Save, Trash2, Loader2, Power } from "lucide-react"
import { toast } from "@/lib/toast"
import { ChatWidget } from "@/components/ChatWidget"
import { IMG_BASE_URL } from "@/config"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { updateWorkspace, deleteWorkspace } from "@/services/workspaceApi"
import { resetAgentPromptsToDefaults } from "@/services/agent-config-api"
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
import { SubscriptionSection } from "@/components/settings/sections/SubscriptionSection"

// Types
type SectionKey = "ai-personality" | "business" | "whatsapp" | "widget" | "widget-support" | "security" | "subscription"

// Section definitions for dropdown
const SECTIONS: SettingsSection[] = [
  { key: "business", label: "Business Config", description: "Company info and preferences" },
  { key: "ai-personality", label: "AI Personality", description: "Bot identity, messages and rules" },
  { key: "whatsapp", label: "WhatsApp Channel", description: "WhatsApp Business API settings" },
  { key: "widget", label: "Website Widget", description: "Chat widget for your website" },
  { key: "widget-support", label: "Human Support", description: "Escalation to human operators" },
  { key: "security", label: "Security", description: "Access control and domains" },
  { key: "subscription", label: "Subscription", description: "Plan and payment settings" },
]

// Default help content for each section
const SECTION_DEFAULT_HELP: Record<SectionKey, string> = {
  "ai-personality": "botName",
  "business": "businessName",
  "whatsapp": "whatsappPhoneNumber",
  "widget": "widgetTitle",
  "widget-support": "humanSupportEnabled",
  "security": "allowedDomains",
  "subscription": "subscription",
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
  sellsProductsAndServices: boolean
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
  widgetTitle: string
  widgetPrimaryColor: string
  widgetLanguage: string
  widgetIcon: string
  widgetUseChannelLogo: boolean
  // AI Config
  customAiRules: string
  welcomeMessage: string
  wipMessage: string
  // Security
  allowedExternalLinks: string
  hasHumanSupport: boolean
  operatorContactMethod: "email" | "whatsapp"
  operatorWhatsappNumber: string
  humanSupportInstructions: string
  frustrationEscalationInstructions: string
  address: string
  registrationPage: string
  requireManualApproval: boolean
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { workspace, setCurrentWorkspace } = useWorkspace()
  const currentWorkspace = workspace
  const { isOwner, isSuperAdmin } = useWorkspaceRole(currentWorkspace?.id || "")
  const canEdit = isOwner || isSuperAdmin

  // 🆕 Load last opened section from localStorage
  const getLastOpenedSection = (): SectionKey => {
    try {
      const saved = localStorage.getItem('settings-last-section')
      return (saved as SectionKey) || 'business'
    } catch {
      return 'business'
    }
  }

  // State
  const [activeSection, setActiveSection] = useState<SectionKey>(getLastOpenedSection())
  const [activeHelpField, setActiveHelpField] = useState<string>("businessName")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [showWorkspaceTypeChangeDialog, setShowWorkspaceTypeChangeDialog] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)

  const resolveLogoUrl = useCallback((value?: string) => {
    if (!value) return undefined
    if (/^https?:\/\//i.test(value)) return value
    const path = value.startsWith("/") ? value : `/${value}`
    return `${IMG_BASE_URL}${path}`
  }, [])

  const [formData, setFormData] = useState<FormData>({
    chatbotName: "Sofia",
    botIdentityResponse: "",
    toneOfVoice: "friendly",
    logoUrl: undefined,
    name: "",
    adminEmail: "",
    url: "http://localhost:3000",
    businessType: "retail",
    currency: "USD",
    defaultLanguage: "it",
    sellsProductsAndServices: true,
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
    widgetTitle: "Chat with us",
    widgetPrimaryColor: "#22c55e",
    widgetLanguage: "it",
    widgetIcon: "chat",
    widgetUseChannelLogo: false,
    customAiRules: "",
    welcomeMessage: defaultWelcomeMessage,
    wipMessage: defaultWipMessage,
    allowedExternalLinks: "",
    hasHumanSupport: true,
    operatorContactMethod: "email",
    operatorWhatsappNumber: "",
    humanSupportInstructions: "",
    frustrationEscalationInstructions: "",
    address: "",
    registrationPage: "",
    requireManualApproval: false,
  })

  // Load workspace data
  useEffect(() => {
    if (currentWorkspace) {
      setFormData({
        chatbotName: currentWorkspace.chatbotName || "Sofia",
        botIdentityResponse: currentWorkspace.botIdentityResponse || "",
        toneOfVoice: (currentWorkspace.toneOfVoice as FormData["toneOfVoice"]) || "friendly",
        logoUrl: currentWorkspace.logoUrl,
        name: currentWorkspace.name || "",
        adminEmail: currentWorkspace.adminEmail || "",
        url: currentWorkspace.url || "http://localhost:3000",
        businessType: currentWorkspace.businessType || "retail",
        currency: currentWorkspace.currency || "USD",
        defaultLanguage: currentWorkspace.defaultLanguage || "it",
        sellsProductsAndServices: currentWorkspace.sellsProductsAndServices ?? true,
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
        whatsappProvider: currentWorkspace.whatsappProvider || "meta",
        ultraMsgInstanceId: currentWorkspace.ultraMsgInstanceId || "",
        ultraMsgToken: currentWorkspace.ultraMsgToken || "",
        widgetTitle: currentWorkspace.widgetTitle || "Chat with us",
        widgetPrimaryColor: currentWorkspace.widgetPrimaryColor || "#22c55e",
        widgetLanguage: currentWorkspace.widgetLanguage || "it",
        widgetIcon: currentWorkspace.widgetIcon || "chat",
        widgetUseChannelLogo: currentWorkspace.widgetUseChannelLogo ?? false,
        customAiRules: currentWorkspace.customAiRules || "",
        welcomeMessage: currentWorkspace.welcomeMessage || defaultWelcomeMessage,
        wipMessage: currentWorkspace.wipMessage || defaultWipMessage,
        allowedExternalLinks: Array.isArray(currentWorkspace.allowedExternalLinks)
          ? currentWorkspace.allowedExternalLinks.join(", ")
          : currentWorkspace.allowedExternalLinks || "",
        hasHumanSupport: currentWorkspace.hasHumanSupport ?? true,
        operatorContactMethod:
          (currentWorkspace.operatorContactMethod as "email" | "whatsapp") || "email",
        operatorWhatsappNumber: currentWorkspace.operatorWhatsappNumber || "",
        humanSupportInstructions: currentWorkspace.humanSupportInstructions || "",
        frustrationEscalationInstructions: currentWorkspace.frustrationEscalationInstructions || "",
        address: currentWorkspace.address || "",
        registrationPage: currentWorkspace.registrationPage || "",
        requireManualApproval: currentWorkspace.requireManualApproval || false,
      })
    }
  }, [currentWorkspace])

  // Handle field change
  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setIsDirty(true)
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }, [errors])

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

    // Check if workspace type changed (sellsProductsAndServices)
    const currentValue = currentWorkspace?.sellsProductsAndServices ?? true
    const newValue = formData.sellsProductsAndServices
    
    if (currentValue !== newValue) {
      // Store pending data and show confirmation dialog
      setPendingFormData(formData)
      setShowWorkspaceTypeChangeDialog(true)
      return
    }

    // Normal save without workspace type change
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

      if (!updateData.whatsappAppSecret) {
        delete updateData.whatsappAppSecret
      }
      if (!updateData.whatsappAppName) {
        delete updateData.whatsappAppName
      }
      if (!updateData.whatsappBusinessAccountId) {
        delete updateData.whatsappBusinessAccountId
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

      const updatedWorkspace = await updateWorkspace(currentWorkspace!.id, updateData)

      setCurrentWorkspace({
        ...currentWorkspace!,
        ...updatedWorkspace,
      })

      setIsDirty(false)
      if (!options?.suppressToast) {
        toast.success("Settings saved successfully")
      }
    } catch (error: any) {
      toast.error(error.message || "Save failed")
      throw error
    }
  }

  // Handle workspace type change confirmation
  const handleConfirmWorkspaceTypeChange = async () => {
    if (!pendingFormData) return
    
    try {
      // First save the workspace changes
      await performSave(pendingFormData, { suppressToast: true })
      
      // Then reset agent prompts to new template type
      const newType = pendingFormData.sellsProductsAndServices ? "e-commerce" : "informational"
      await resetAgentPromptsToDefaults(currentWorkspace!.id, true)
      toast.success(`Settings saved and prompts updated to ${newType} templates`)
    } catch (error: any) {
      toast.error(error.message || "Failed to reset prompts")
    } finally {
      setShowWorkspaceTypeChangeDialog(false)
      setPendingFormData(null)
    }
  }

  const handleCancelWorkspaceTypeChange = () => {
    // Revert the form data change
    if (currentWorkspace) {
      setFormData(prev => ({
        ...prev,
        sellsProductsAndServices: currentWorkspace.sellsProductsAndServices ?? true
      }))
    }
    setShowWorkspaceTypeChangeDialog(false)
    setPendingFormData(null)
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
              sellsProductsAndServices: formData.sellsProductsAndServices,
              welcomeMessage: formData.welcomeMessage,
              customAiRules: formData.customAiRules,
              wipMessage: formData.wipMessage,
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
              sellsProductsAndServices: formData.sellsProductsAndServices,
              enableWhatsapp: formData.enableWhatsapp,
              enableWidget: formData.enableWidget,
              address: formData.address,
              registrationPage: formData.registrationPage,
              requireManualApproval: formData.requireManualApproval,
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
              logoUrl: resolveLogoUrl(formData.logoUrl),
            }}
            workspaceId={currentWorkspace?.id || ""}
            errors={errors}
            canEdit={canEdit}
            sellsProductsAndServices={formData.sellsProductsAndServices}
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
              operatorContactMethod: formData.operatorContactMethod,
              operatorWhatsappNumber: formData.operatorWhatsappNumber,
              operatorEmail: formData.adminEmail, // Use business email as default
              humanSupportInstructions: formData.humanSupportInstructions,
              frustrationEscalationInstructions: formData.frustrationEscalationInstructions,
            }}
            errors={errors}
            canEdit={canEdit}
            onFieldChange={handleFieldChange}
            onFieldFocus={handleFieldFocus}
          />
        )
      case "subscription":
        return (
          <SubscriptionSection
            onFieldFocus={handleFieldFocus}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Dropdown */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <SettingsDropdown
              sections={SECTIONS}
              currentSection={activeSection}
              onSectionChange={handleSectionChange}
            />
          </div>

          {/* Right side: Channel Status + Debug Mode + Save */}
          <div className="flex items-center gap-4">
            {/* Debug Mode Toggle */}
            {canEdit && (
              <div 
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  formData.debugMode 
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
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  formData.channelStatus 
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
              sellsProductsAndServices={formData.sellsProductsAndServices}
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

      {/* Workspace Type Change Confirmation Dialog */}
      <Dialog
        open={showWorkspaceTypeChangeDialog}
        onOpenChange={(open) => {
          if (!open) handleCancelWorkspaceTypeChange()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              ⚠️ Workspace Type Change
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                You are changing the workspace type from{" "}
                <strong>{currentWorkspace?.sellsProductsAndServices ? "E-commerce" : "Informational"}</strong> to{" "}
                <strong>{pendingFormData?.sellsProductsAndServices ? "E-commerce" : "Informational"}</strong>.
              </p>
              <p className="text-red-600 font-medium">
                ⚠️ This will RESET all agent prompts to the new template type!
              </p>
              <p>
                Any custom prompts you have configured will be lost. We recommend backing up your current prompts before proceeding.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <strong>How to backup:</strong>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Go to Agent Configuration page</li>
                  <li>Copy each agent's system prompt to a text file</li>
                  <li>Return here to proceed with the change</li>
                </ol>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelWorkspaceTypeChange}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmWorkspaceTypeChange}
            >
              Reset Prompts & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Widget (sempre visibile) */}
      {currentWorkspace && (
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
