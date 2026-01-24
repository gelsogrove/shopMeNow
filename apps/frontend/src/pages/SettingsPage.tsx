import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageCropUpload } from "@/components/shared/ImageCropUpload"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ChatWidget } from "@/components/ChatWidget"
import { IMG_BASE_URL } from "@/config"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"
import { SUPPORTED_CURRENCIES } from "@/utils/format"
import { useMutation } from "@tanstack/react-query"
import { Check, Copy, HelpCircle, Loader2, Monitor, Save, Smartphone, Trash2, Store, Users, Headphones, Bot, MessageSquare, Globe, Shield, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertCircle, ShoppingCart, Edit3, Briefcase, Smile, Award, Coffee } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"

interface WorkspaceData {
  id: string
  name: string
  whatsappPhoneNumber: string
  whatsappApiKey: string
  whatsappPhoneNumberId: string
  whatsappVerifyToken: string
  adminEmail: string
  url: string
  currency: string
  channelStatus: boolean
  debugMode: boolean
  welcomeMessage: string
  wipMessage: string
  allowedExternalLinks: string
  // Channel Configuration
  enableWhatsapp: boolean
  enableWidget: boolean
  sellsProductsAndServices: boolean
  hasSalesAgents: boolean
  hasHumanSupport: boolean
  humanSupportInstructions: string
  frustrationEscalationInstructions: string
  operatorContactMethod: string
  operatorWhatsappNumber: string
  toneOfVoice: string
  botIdentityResponse: string
  address: string
  customAiRules: string
  // Translation Settings
  translateProductNames: boolean
  translateCategoryNames: boolean
  translateServiceNames: boolean
  catalogBaseLanguage: string
  // Chatbot Personalization
  chatbotName: string
  businessType: string
  // Widget Configuration
  logoUrl: string
  widgetTitle: string
  widgetLanguage: string
  widgetPrimaryColor: string
}

// Business Type Options
const BUSINESS_TYPES = [
  { value: "retail", label: "Retail", desc: "Physical or online store" },
  { value: "ecommerce", label: "E-commerce", desc: "Online sales platform" },
  { value: "restaurant", label: "Restaurant", desc: "Food & beverage service" },
  { value: "healthcare", label: "Healthcare", desc: "Medical services" },
  { value: "education", label: "Education", desc: "Training & courses" },
  { value: "services", label: "Services", desc: "Professional services" },
  { value: "other", label: "Other", desc: "Other industry" },
]

const defaultWelcomeMessage =
  "Welcome! I'm your digital assistant. How can I help you today?"

const defaultWipMessage = "Work in progress. Please contact us later."

type SectionKey =
  | "business"
  | "channels"
  | "whatsapp"
  | "widget"
  | "personality"
  | "support"
  | "security"

// Custom navigation blocker
function useUnsavedChangesGuard(when: boolean, onSave: () => Promise<boolean>) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showDialog, setShowDialog] = useState(false)
  const [nextPath, setNextPath] = useState<string | null>(null)
  const [shouldNavigate, setShouldNavigate] = useState(false)

  // Block browser back/forward/close
  useEffect(() => {
    if (!when) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [when])

  // Navigate after confirmation
  useEffect(() => {
    if (shouldNavigate && nextPath) {
      navigate(nextPath)
      setShouldNavigate(false)
      setNextPath(null)
    }
  }, [shouldNavigate, nextPath, navigate])

  // Intercept all clicks
  useEffect(() => {
    if (!when) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Check for links or buttons that might trigger navigation
      const link = target.closest('a, button, [role="menuitem"]')
      if (!link) return

      const href = (link as HTMLAnchorElement).href
      if (href) {
        try {
          const url = new URL(href)
          const targetPath = url.pathname
          
          if (targetPath !== location.pathname && !targetPath.startsWith('http')) {
            e.preventDefault()
            e.stopPropagation()
            setNextPath(targetPath)
            setShowDialog(true)
            return false
          }
        } catch {}
      }

      // Check for onClick that might call navigate()
      const onclick = (link as any).onclick?.toString() || ''
      if (onclick.includes('navigate') || onclick.includes('href')) {
        e.preventDefault()
        e.stopPropagation()
        // Try to extract path from onClick
        const pathMatch = onclick.match(/navigate\(['"]([^'"]+)['"]\)/)
        if (pathMatch) {
          setNextPath(pathMatch[1])
          setShowDialog(true)
          return false
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [when, location.pathname])

  const handleDiscard = () => {
    setShowDialog(false)
    setShouldNavigate(true)
  }

  const handleCancel = () => {
    setShowDialog(false)
    setNextPath(null)
  }

  const handleSaveAndContinue = async () => {
    const success = await onSave()
    if (success) {
      setShowDialog(false)
      setShouldNavigate(true)
    }
  }

  return { 
    showDialog, 
    handleDiscard, 
    handleCancel,
    handleSaveAndContinue
  }
}

// Guide Content for each section
const GUIDES = {
  business: {
    title: "Business Configuration",
    content:
      "• Channel Name: Use this to identify your channel - it appears in URLs and headers. Pick something short and memorable!\n\n• Business Type: Tell the AI what industry you're in so it understands your context better (e.g., Restaurant, E-commerce, Services)\n\n• Admin Email: Where we'll send important notifications about billing and security alerts\n\n• Website URL: The main link your bot can share with customers when they ask about your website\n\n• Channel Status: Turn this OFF when you need to pause the channel - customers will see the maintenance message instead\n\n• Debug Mode: Turn this ON only for troubleshooting - customers will receive the maintenance message while you fix issues",
  },
  channels: {
    title: "Channel Selection",
    content:
      "• WhatsApp: Enable this to have direct conversations with customers and send order updates\n\n• Website Widget: Turn this ON to add a live chat bubble on your website for instant support and FAQs\n\n💡 Best practice: We recommend enabling both channels! This gives customers flexibility to reach you wherever they prefer",
  },
  whatsapp: {
    title: "WhatsApp Configuration",
    content:
      "• Phone Number: Your verified WhatsApp Business phone number (format: +1234567890)\n\n• Phone Number ID: This is the unique ID Meta assigns to your WhatsApp Business number - find it in your Meta Business Manager\n\n• API Key: Your access token from Meta - this lets us send/receive messages on your behalf\n\n• Verify Token: A secret string you create to validate webhook connections - choose something secure and remember it!",
  },
  widget: {
    title: "Website Widget",
    content: "• Widget Title: This appears at the top of the chat window - keep it friendly like 'Chat with us!' or 'Need help?'\n\n• Language: Pick from 50+ languages - the widget UI will display in this language\n\n• Primary Color: Choose a color that matches your brand - this affects buttons and the chat bubble\n\n• Logo: Upload your brand logo (square format works best) - shows in the chat header\n\n• Embed Code: Copy this code and paste it just before the closing </body> tag in your website's HTML\n\n💡 The widget appears as a bubble in the bottom-right corner of your site. Customers click it to start chatting!",
  },
  personality: {
    title: "AI Personality",
    content: "• Assistant Name: Give your bot a name! Examples: 'Sofia', 'Alex', 'Support Bot'. This makes conversations feel more human\n\n• Tone of Voice: How should your bot talk?\n                  - Formal: Professional and respectful\n                  - Friendly: Warm and approachable\n                  - Professional: Business-like but pleasant\n                  - Casual: Relaxed and conversational\n\n• Welcome Message: The first thing customers see when they start a chat - make it welcoming!\n\n• Bot Identity: What does your bot say when asked 'Who are you?' - explain what you can help with\n\n• Custom AI Rules: Add special instructions to override default behavior (e.g., 'Always ask for order number before checking status')\n\n• Maintenance Message: What customers see when the channel is paused or in debug mode\n\n💡 Variables you can use: {{customerName}}, {{businessName}}, {{businessEmail}} - they'll be replaced with real data",
  },
  support: {
    title: "Human Support",
    content:
      "• Enable Human Support: Turn this ON to let customers request a human operator when the AI can't help\n\n• Sales Agents (E-commerce): If enabled, escalations can be routed to assigned sales agents for orders and upsells\n\n• Contact Method: Choose how customers reach your team:\n                  - Email: Customers get an email address to contact\n                  - WhatsApp: Bot provides a WhatsApp number for direct contact\n\n• Operator WhatsApp Number: If you chose WhatsApp method, enter the number here (format: +1234567890)\n\n• Special Instructions: Tell the AI when to offer human support - e.g., 'Offer human support for complaints or complex technical issues'\n\n💡 The bot will automatically suggest human contact when it detects it can't help!",
  },
  security: {
    title: "Security & Access",
    content: "• Allowed External Domains: List the websites your bot is allowed to share links from - this prevents malicious link injection\n\n💡 Always add your payment processors and official social media here! The bot will reject any links from unlisted domains for security.\n\n🔒 echatbot.ai and paypal.com are pre-approved by default",
  },
}

// Textarea Sheet Component
function TextareaModal({ 
  title, 
  value, 
  onChange, 
  placeholder, 
  disabled,
  hint,
  variables
}: { 
  title: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  hint?: string
  variables?: { name: string; description: string }[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleSave = () => {
    onChange(localValue)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setLocalValue(value)
    setIsOpen(false)
  }

  const insertVariable = (varName: string) => {
    // Special case: [LINK_REGISTRATION] should be inserted without braces
    if (varName.startsWith('[') && varName.endsWith(']')) {
      setLocalValue(prev => prev + varName)
    } else {
      setLocalValue(prev => prev + `{{${varName}}}`)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="w-full justify-start text-left font-normal"
      >
        <Edit3 className="mr-2 h-4 w-4" />
        {value ? (
          <span className="truncate">{value.substring(0, 120)}{value.length > 120 ? '...' : ''}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder || 'Click to edit'}</span>
        )}
      </Button>
      
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[90%] sm:w-[540px] md:w-[720px] p-0 overflow-y-auto"
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="px-6 pt-6 pb-2">
              <SheetTitle>{title}</SheetTitle>
              {hint && (
                <SheetDescription className="text-sm text-slate-600">{hint}</SheetDescription>
              )}
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <Textarea
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  placeholder={placeholder}
                  className="min-h-[240px] resize-none font-mono text-sm"
                />

                {variables && variables.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <h4 className="font-semibold text-sm mb-3 text-slate-700">Available Variables</h4>
                    <div className="space-y-2">
                      {variables.map((v) => (
                        <div key={v.name} className="group">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => insertVariable(v.name)}
                            className="w-full justify-start text-left h-auto py-2 px-2 hover:bg-slate-100"
                          >
                            <div className="flex flex-col items-start w-full">
                              <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded group-hover:bg-slate-200">
                                {`{{${v.name}}}`}
                              </code>
                              <span className="text-xs text-slate-500 mt-1">{v.description}</span>
                            </div>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SheetFooter className="px-6 py-4 border-t">
              <div className="flex justify-end w-full gap-3">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// Guide Card Component
function GuideCard({ guide, isOpen }: { guide: { title: string; content: string }, isOpen: boolean }) {
  return (
    <Card className="rounded-2xl border-blue-200 bg-blue-50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 flex justify-end">
        <div className="flex items-center justify-end">
          <HelpCircle className="h-5 w-5 text-blue-600" />
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          <div className="text-xs text-blue-800 leading-relaxed space-y-2">
            {guide.content.split('\n').map((line, index) => {
              if (!line.trim()) return null
              const trimmedLine = line.trim()
              if (trimmedLine.startsWith('•')) {
                const withoutBullet = trimmedLine.substring(1).trim()
                const [label, ...rest] = withoutBullet.split(':')
                return (
                  <div key={index} className="flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <div className="flex-1">
                      {rest.length > 0 ? (
                        <>
                          <strong className="text-blue-900">{label}:</strong>
                          <span className="ml-1">{rest.join(':')}</span>
                        </>
                      ) : (
                        <span>{withoutBullet}</span>
                      )}
                    </div>
                  </div>
                )
              }
              // Preserve indentation for sub-items (lines starting with spaces and -)
              if (trimmedLine.startsWith('-')) {
                const leadingSpaces = line.search(/\S/)
                const indentLevel = Math.floor(leadingSpaces / 4) // 4 spaces per indent level
                return (
                  <div key={index} className="flex gap-2" style={{ marginLeft: `${indentLevel * 0.5}rem` }}>
                    <span className="text-blue-600">-</span>
                    <span>{trimmedLine.substring(1).trim()}</span>
                  </div>
                )
              }
              return <div key={index}>{line}</div>
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function extractEnglishMessage(
  message: string | Record<string, string> | undefined,
  defaultValue: string
): string {
  if (!message) return defaultValue
  if (typeof message === "string") return message
  if (typeof message === "object" && "en" in message) {
    return (message as Record<string, string>).en || defaultValue
  }
  return defaultValue
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [widgetCodeCopied, setWidgetCodeCopied] = useState(false)
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  
  // Sheet state - which section sheet is open
  const [openSheetSection, setOpenSheetSection] = useState<SectionKey | null>(null)
  
  // Video modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const [formData, setFormData] = useState<WorkspaceData>({
    id: "",
    name: "",
    whatsappPhoneNumber: "",
    whatsappApiKey: "",
    whatsappPhoneNumberId: "",
    whatsappVerifyToken: "",
    adminEmail: "",
    url: "http://localhost:3000",
    currency: "USD",
    channelStatus: true,
    debugMode: false,
    welcomeMessage: defaultWelcomeMessage,
    wipMessage: defaultWipMessage,
    allowedExternalLinks: "",
    enableWhatsapp: true,
    enableWidget: false,
    sellsProductsAndServices: true,
    hasSalesAgents: false,
    hasHumanSupport: true,
    humanSupportInstructions: "",
    frustrationEscalationInstructions: "",
    operatorContactMethod: "email",
    operatorWhatsappNumber: "",
    toneOfVoice: "friendly",
    botIdentityResponse: "",
    address: "",
    customAiRules: "",
    translateProductNames: true,
    translateCategoryNames: true,
    translateServiceNames: true,
    catalogBaseLanguage: "it",
    chatbotName: "",
    businessType: "retail",
    logoUrl: "",
    widgetTitle: "Chat with us",
    widgetLanguage: "en",
    widgetPrimaryColor: "#22c55e",
  })

  const baseCustomAiVariables = [
    { name: "customerName", description: "Customer's name" },
    { name: "customerEmail", description: "Customer's email" },
    { name: "customerPhone", description: "Customer's phone" },
    { name: "businessName", description: "Your business name" },
    { name: "businessAddress", description: "Business address" },
    { name: "businessPhone", description: "Business phone" },
    { name: "businessEmail", description: "Business email" },
    { name: "[LINK_REGISTRATION]", description: "Registration/signup link" },
  ]

  const ecommerceCustomAiVariables = [
    { name: "products", description: "Available products list" },
    { name: "categories", description: "Product categories" },
    { name: "offers", description: "Active offers/promotions" },
    { name: "services", description: "Available services" },
    { name: "orderNumber", description: "Order reference number" },
    { name: "orderTotal", description: "Order total amount" },
    { name: "orderStatus", description: "Current order status" },
  ]

  const customAiVariables = formData.sellsProductsAndServices
    ? [...baseCustomAiVariables, ...ecommerceCustomAiVariables]
    : baseCustomAiVariables

  const sectionTitles: Record<SectionKey, string> = {
    business: "Business Configuration",
    channels: "Channel Selection",
    whatsapp: "WhatsApp Configuration",
    widget: "Widget Configuration",
    personality: "AI Personality",
    support: "Human Support",
    security: "Security & Access",
  }

  const handleSectionOpen = (sectionId: SectionKey) => {
    setOpenSheetSection(sectionId)
  }

  const handleSheetClose = () => {
    setOpenSheetSection(null)
  }

  const layoutClass = "mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
  const tileCardClass = "min-h-[160px]"
  const tileHoverClass =
    "transition-all hover:shadow-lg hover:border-green-400 bg-white cursor-pointer group"
  const iconWrapperBase = "flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"

  const { workspace: currentWorkspace, setCurrentWorkspace, loading: workspaceLoading } = useWorkspace()
  const { role: workspaceRole, isSuperAdmin } = useWorkspaceRole(currentWorkspace?.id)
  // ⚠️ SECURITY: Only SUPER_ADMIN (workspace owner) can modify settings
  // ADMIN and AGENT roles can view but not edit
  const canEdit = isSuperAdmin
  const [isLoadingData, setIsLoadingData] = useState(true)

  // 🔍 Debug logging for role
  useEffect(() => {
    logger.info("🔍 [SettingsPage] Role check:", {
      workspaceRole,
      isSuperAdmin,
      canEdit,
    })
  }, [workspaceRole, canEdit, isSuperAdmin])

  // 🔍 Debug logging
  useEffect(() => {
    logger.info("🔍 [SettingsPage] State check:", {
      workspaceLoading,
      isLoadingData,
      hasCurrentWorkspace: !!currentWorkspace,
      currentWorkspaceId: currentWorkspace?.id,
    })
  }, [workspaceLoading, isLoadingData, currentWorkspace])

  // Warn on browser/tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setIsDirty(true)
    setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: Partial<WorkspaceData>) => {
      if (!currentWorkspace?.id) throw new Error("No workspace selected")
      return await updateWorkspace(currentWorkspace.id, data)
    },
    onSuccess: (updatedWorkspace) => {
      toast.success("Settings saved successfully")
      setCurrentWorkspace(updatedWorkspace)
      setIsDirty(false)
      // Dispatch custom event for workspace-selection page to reload
      window.dispatchEvent(new CustomEvent("workspace-updated", { detail: updatedWorkspace }))
    },
    onError: (error: any) => {
      logger.error("Failed to save settings:", error)
      toast.error(error.response?.data?.message || "Failed to save settings")
    },
  })

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      return await deleteWorkspace(workspaceId)
    },
    onSuccess: () => {
      toast.success("Channel deleted successfully")
      storage.clearWorkspace()
      navigate("/workspace-selection")
    },
    onError: (error: any) => {
      logger.error("Failed to delete workspace:", error)
      toast.error(error.response?.data?.message || "Failed to delete channel")
    },
  })

  const handleSave = useCallback(async () => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = "Channel name is required"
    }

    if (formData.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
      newErrors.adminEmail = "Invalid email address"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fix validation errors")
      return false
    }

    try {
      const updateData: Partial<WorkspaceData> = {
        name: formData.name,
        adminEmail: formData.adminEmail,
        url: formData.url,
        currency: formData.currency,
        channelStatus: formData.channelStatus,
        debugMode: formData.debugMode,
        welcomeMessage: formData.welcomeMessage,
        wipMessage: formData.wipMessage,
        allowedExternalLinks: formData.allowedExternalLinks,
        enableWhatsapp: formData.enableWhatsapp,
        enableWidget: formData.enableWidget,
        sellsProductsAndServices: formData.sellsProductsAndServices,
        hasSalesAgents: formData.hasSalesAgents,
        hasHumanSupport: formData.hasHumanSupport,
        humanSupportInstructions: formData.humanSupportInstructions,
        frustrationEscalationInstructions: formData.frustrationEscalationInstructions,
        operatorContactMethod: formData.operatorContactMethod,
        operatorWhatsappNumber: formData.operatorWhatsappNumber,
        toneOfVoice: formData.toneOfVoice,
        botIdentityResponse: formData.botIdentityResponse,
        address: formData.address,
        customAiRules: formData.customAiRules,
        translateProductNames: formData.translateProductNames,
        translateCategoryNames: formData.translateCategoryNames,
        translateServiceNames: formData.translateServiceNames,
        catalogBaseLanguage: formData.catalogBaseLanguage,
        chatbotName: formData.chatbotName,
        businessType: formData.businessType,
        widgetTitle: formData.widgetTitle,
        widgetLanguage: formData.widgetLanguage,
        widgetPrimaryColor: formData.widgetPrimaryColor,
        whatsappApiKey: formData.whatsappApiKey,
        whatsappPhoneNumberId: formData.whatsappPhoneNumberId,
        whatsappVerifyToken: formData.whatsappVerifyToken,
      }

      saveSettingsMutation.mutate(updateData)
      return true
    } catch (error) {
      return false
    }
  }, [formData, saveSettingsMutation])

  // Block in-app navigation when form is dirty
  const { showDialog, handleDiscard, handleCancel, handleSaveAndContinue } = useUnsavedChangesGuard(
    isDirty,
    handleSave
  )

  const handleDelete = async () => {
    if (deleteConfirmation !== formData.name) {
      toast.error("Channel name doesn't match")
      return
    }
    if (!currentWorkspace?.id) return
    deleteWorkspaceMutation.mutate(currentWorkspace.id)
  }

  const handleLogoChange = async (file: File) => {
    if (!currentWorkspace?.id) return
    try {
      setIsDirty(true)
      setIsLogoUploading(true)
      const formDataObj = new FormData()
      formDataObj.append("logo", file)
      const response = await api.post(
        `/workspaces/${currentWorkspace.id}/logo`,
        formDataObj,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      setFormData((prev) => ({ ...prev, logoUrl: response.data.logoUrl }))
      toast.success("Logo updated successfully")
    } catch (error) {
      logger.error("Error uploading logo:", error)
      toast.error("Failed to upload logo")
    } finally {
      setIsLogoUploading(false)
    }
  }

  const handleLogoRemove = async () => {
    if (!currentWorkspace?.id) return
    try {
      setIsDirty(true)
      setFormData((prev) => ({ ...prev, logoUrl: null }))
      toast.success("Logo removed successfully")
    } catch (error) {
      logger.error("Error removing logo:", error)
      toast.error("Failed to remove logo")
    }
  }

  useEffect(() => {
    logger.info("🔍 [SettingsPage] Checking workspace:", {
      hasCurrentWorkspace: !!currentWorkspace,
      workspaceId: currentWorkspace?.id,
      workspaceLoading,
    })

    if (workspaceLoading) {
      logger.info("⏳ [SettingsPage] Workspace loading - waiting before redirect")
      return
    }

    // If no workspace, redirect to selection
    if (!currentWorkspace?.id) {
      logger.info("❌ [SettingsPage] No workspace found - redirecting to workspace-selection")
      navigate("/workspace-selection")
      return
    }

    logger.info("✅ [SettingsPage] Workspace loaded, fetching settings:", currentWorkspace.id)

    const loadWorkspaceData = async () => {
      try {
        setIsLoadingData(true)
        const response = await api.get(`/workspaces/${currentWorkspace.id}`)
        const data = response.data

        setFormData({
          id: data.id,
          name: data.name || "",
          whatsappPhoneNumber: data.whatsappPhoneNumber || "",
          whatsappApiKey: data.whatsappApiKey || "",
          whatsappPhoneNumberId: data.whatsappPhoneNumberId || "",
          whatsappVerifyToken: data.whatsappVerifyToken || "",
          adminEmail: data.adminEmail || "",
          url: data.url || "http://localhost:3000",
          currency: data.currency || "USD",
          channelStatus: data.channelStatus ?? true,
          debugMode: data.debugMode ?? false,
          welcomeMessage: extractEnglishMessage(data.welcomeMessage, defaultWelcomeMessage),
          wipMessage: extractEnglishMessage(data.wipMessage, defaultWipMessage),
          allowedExternalLinks: (data.allowedExternalLinks || []).join(", "),
          enableWhatsapp: data.enableWhatsapp ?? true,
          enableWidget: data.enableWidget ?? false,
          sellsProductsAndServices: data.sellsProductsAndServices ?? true,
          hasSalesAgents: data.hasSalesAgents ?? false,
          hasHumanSupport: data.hasHumanSupport ?? true,
          humanSupportInstructions: data.humanSupportInstructions || "",
          frustrationEscalationInstructions: data.frustrationEscalationInstructions || "",
          operatorContactMethod: data.operatorContactMethod || "email",
          operatorWhatsappNumber: data.operatorWhatsappNumber || "",
          toneOfVoice: data.toneOfVoice || "friendly",
          botIdentityResponse: data.botIdentityResponse || "",
          address: data.address || "",
          customAiRules: data.customAiRules || "",
          translateProductNames: data.translateProductNames ?? true,
          translateCategoryNames: data.translateCategoryNames ?? true,
          translateServiceNames: data.translateServiceNames ?? true,
          catalogBaseLanguage: data.catalogBaseLanguage || "it",
          chatbotName: data.chatbotName || "",
          businessType: data.businessType || "retail",
          logoUrl: data.logoUrl || "",
          widgetTitle: data.widgetTitle || "Chat with us",
          widgetLanguage: data.widgetLanguage || "en",
          widgetPrimaryColor: data.widgetPrimaryColor || "#22c55e",
        })
        setIsDirty(false)
      } catch (error) {
        logger.error("Failed to load workspace data:", error)
        toast.error("Failed to load settings")
      } finally {
        setIsLoadingData(false)
      }
    }

    loadWorkspaceData()
  }, [currentWorkspace?.id, navigate])

  if (workspaceLoading || isLoadingData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* 🚨 Unsaved Changes Dialog */}
      <Dialog open={showDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifiche non salvate</DialogTitle>
            <DialogDescription>
              Hai modifiche non salvate. Vuoi salvare prima di uscire?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleDiscard}
            >
              Scarta modifiche
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveAndContinue}
            >
              <Save className="mr-2 h-4 w-4" />
              Salva e continua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Read-only mode banner for non-owners */}
        {!canEdit && (
          <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-yellow-800">
                View-only mode: Only the workspace owner can modify settings
              </p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure your channel and AI assistant
              </p>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <Monitor className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Channel</span>
                  <Switch
                    checked={formData.channelStatus}
                    onCheckedChange={(checked) =>
                      handleFieldChange("channelStatus", checked)
                    }
                    disabled={!canEdit}
                  />
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${formData.channelStatus ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {formData.channelStatus ? 'Active' : 'Off'}
                  </span>
                </div>
              <Button
                onClick={() => setShowDeleteDialog(true)}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={deleteWorkspaceMutation.isPending || !canEdit}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveSettingsMutation.isPending || !canEdit}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Card + Guide Layout */}
        <div className={layoutClass}>
          {/* 1️⃣ Business Configuration */}
          {isSectionVisible("business") && !focusedSection && (
          <div>
            <Card 
              className={`rounded-xl border-2 border-gray-200 h-full flex flex-col ${tileHoverClass} ${tileCardClass} cursor-pointer`}
              onClick={() => handleSectionOpen("business")}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`${iconWrapperBase} bg-purple-100`}>
                    <Store className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold text-gray-900">Business Configuration</CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      Define your business type and basic information
                    </CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              {isSectionOpen("business") && (
              <CardContent className="px-6 pb-6 pt-6">
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-8 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Channel Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="e.g., My Restaurant, Tech Support"
                      disabled={!canEdit}
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Business Type</Label>
                    <Select
                      value={formData.businessType}
                      onValueChange={(value) => handleFieldChange("businessType", value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger id="businessType">
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-gray-500">{type.desc}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Admin Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => handleFieldChange("adminEmail", e.target.value)}
                      placeholder="admin@example.com"
                      disabled={!canEdit}
                      className={errors.adminEmail ? "border-red-500" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">Website URL</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) => handleFieldChange("url", e.target.value)}
                      placeholder="https://mybusiness.com"
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5 text-slate-600" />
                    <p className="font-medium text-sm">E-commerce Features</p>
                  </div>
                  <Switch
                    checked={formData.sellsProductsAndServices}
                    onCheckedChange={(checked) =>
                      handleFieldChange("sellsProductsAndServices", checked)
                    }
                    disabled={!canEdit}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-slate-600" />
                    <p className="font-medium text-sm">Debug Mode</p>
                  </div>
                  <Switch
                    checked={formData.debugMode}
                    onCheckedChange={(checked) =>
                      handleFieldChange("debugMode", checked)
                    }
                    disabled={!canEdit}
                  />
                </div>


                  </div>
                  <div className="lg:col-span-4">
                    <GuideCard
                      guide={GUIDES.business}
                      isOpen={isSectionOpen("business")}
                    />
                  </div>
                </div>
              </CardContent>
              )}
            </Card>
          </div>
          )}

          {/* 2️⃣ Channel Selection */}
          {isSectionVisible("channels") && !focusedSection && (
          <div>
            <Card 
              className={`rounded-xl border-2 border-gray-200 h-full flex flex-col ${tileHoverClass} ${tileCardClass} cursor-pointer`}
              onClick={() => handleSectionOpen("channels")}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`${iconWrapperBase} bg-green-100`}>
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold text-gray-900">Channel Selection</CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      Choose which channels to enable for customer communication
                    </CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              {isSectionOpen("channels") && (
              <CardContent className="px-6 pb-6 pt-6">
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-6 w-6 text-slate-600" />
                      <div>
                        <p className="font-semibold text-sm">WhatsApp</p>
                        <p className="text-xs text-slate-500">
                          Message customers directly
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.enableWhatsapp}
                      onCheckedChange={(checked) =>
                        handleFieldChange("enableWhatsapp", checked)
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-6 w-6 text-slate-600" />
                      <div>
                        <p className="font-semibold text-sm">Website Widget</p>
                        <p className="text-xs text-slate-500">
                          Embed chat on your site
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.enableWidget}
                      onCheckedChange={(checked) =>
                        handleFieldChange("enableWidget", checked)
                      }
                      disabled={!canEdit}
                    />
                  </div>
                    </div>
                  </div>
                  <div className="lg:col-span-4">
                    <GuideCard
                      guide={GUIDES.channels}
                      isOpen={isSectionOpen("channels")}
                    />
                  </div>
                </div>
              </CardContent>
              )}
            </Card>
          </div>
          )}

          {/* 3️⃣ WhatsApp Settings (Conditional) */}
          {formData.enableWhatsapp && (
            <div>
              {isSectionVisible("whatsapp") && !focusedSection && (
              <Card 
                className={`rounded-xl border-2 border-gray-200 h-full flex flex-col ${tileHoverClass} ${tileCardClass} cursor-pointer`}
                onClick={() => handleSectionOpen("whatsapp")}
              >
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`${iconWrapperBase} bg-emerald-100`}>
                      <Smartphone className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold text-gray-900">WhatsApp Configuration</CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        Configure WhatsApp Business API credentials
                      </CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardHeader>
                {isSectionOpen("whatsapp") && (
                <CardContent className="px-6 pb-6 pt-6">
                  <div className="grid gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8 space-y-4">
                      <div className="space-y-2">
                    <Label htmlFor="whatsappPhoneNumber">Phone Number</Label>
                    <Input
                      id="whatsappPhoneNumber"
                      value={formData.whatsappPhoneNumber}
                      onChange={(e) => handleFieldChange("whatsappPhoneNumber", e.target.value)}
                      placeholder="+1234567890"
                      disabled={!canEdit}
                    />
                  </div>
                      <div className="space-y-2">
                    <Label htmlFor="whatsappApiKey">API Key</Label>
                    <Input
                      id="whatsappApiKey"
                      type="password"
                      value={formData.whatsappApiKey}
                      onChange={(e) => handleFieldChange("whatsappApiKey", e.target.value)}
                      placeholder="Enter API key"
                      disabled={!canEdit}
                    />
                  </div>
                      <div className="space-y-2">
                    <Label htmlFor="whatsappPhoneNumberId">Phone Number ID</Label>
                    <Input
                      id="whatsappPhoneNumberId"
                      value={formData.whatsappPhoneNumberId}
                      onChange={(e) => handleFieldChange("whatsappPhoneNumberId", e.target.value)}
                      placeholder="123456789012345"
                      disabled={!canEdit}
                    />
                  </div>
                      <div className="space-y-2">
                    <Label htmlFor="whatsappVerifyToken">Verify Token</Label>
                    <Input
                      id="whatsappVerifyToken"
                      value={formData.whatsappVerifyToken}
                      onChange={(e) => handleFieldChange("whatsappVerifyToken", e.target.value)}
                      placeholder="mySecureToken123"
                      disabled={!canEdit}
                    />
                  </div>
                      
                      {/* Video Tutorial Button */}
                      <div className="pt-2">
                        <Button
                          onClick={() => setIsVideoModalOpen(true)}
                          variant="outline"
                          className="w-full bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-700 font-semibold"
                          size="lg"
                          type="button"
                        >
                          <span className="mr-2">📺</span>
                          Watch: How to Connect WhatsApp API
                        </Button>
                      </div>
                    </div>
                    <div className="lg:col-span-4">
                      <GuideCard
                        guide={GUIDES.whatsapp}
                        isOpen={isSectionOpen("whatsapp")}
                      />
                    </div>
                  </div>
                </CardContent>
                )}
              </Card>
              )}
            </div>
            )}

          {/* 4️⃣ Widget Settings (Conditional) */}
          {formData.enableWidget && (
            <div>
              {isSectionVisible("widget") && !focusedSection && (
              <Card 
                className={`rounded-xl border-2 border-gray-200 h-full flex flex-col ${tileHoverClass} ${tileCardClass} cursor-pointer`}
                onClick={() => handleSectionOpen("widget")}
              >
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`${iconWrapperBase} bg-blue-100`}>
                      <Monitor className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold text-gray-900">Widget Configuration</CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        Customize your website chat widget
                      </CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardHeader>
                {isSectionOpen("widget") && (
                <CardContent className="px-6 pb-6 pt-6">
                  <div className="grid gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8 space-y-4">
                      <div className="space-y-2">
                    <Label htmlFor="widgetTitle">Widget Title</Label>
                    <Input
                      id="widgetTitle"
                      value={formData.widgetTitle}
                      onChange={(e) => handleFieldChange("widgetTitle", e.target.value)}
                      placeholder="Chat with us"
                      disabled={!canEdit}
                    />
                  </div>
                      <div className="space-y-2">
                    <Label htmlFor="widgetPrimaryColor">Primary Color</Label>
                    <Input
                      id="widgetPrimaryColor"
                      type="color"
                      value={formData.widgetPrimaryColor}
                      onChange={(e) => handleFieldChange("widgetPrimaryColor", e.target.value)}
                      disabled={!canEdit}
                      className="w-32 h-10"
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Embed Code</Label>
                    <div className="relative">
                      <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${currentWorkspace?.id || 'YOUR_WORKSPACE_ID'}",
    title: "${formData.widgetTitle || 'Chat with us'}",
    primaryColor: "${formData.widgetPrimaryColor || '#22c55e'}",
    language: "${formData.widgetLanguage || 'it'}"
  };
</script>
<script src="${window.location.origin}/widget.js?v=186" async></script>`}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 bg-white"
                        onClick={() => {
                          const embedCode = `<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${currentWorkspace?.id}",
    title: "${formData.widgetTitle || 'Chat with us'}",
    primaryColor: "${formData.widgetPrimaryColor || '#22c55e'}",
    language: "${formData.widgetLanguage || 'it'}"
  };
</script>
<script src="${window.location.origin}/widget.js?v=186" async></script>`;
                          navigator.clipboard.writeText(embedCode);
                          toast.success("Code copied to clipboard!");
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                    </div>
                    <div className="lg:col-span-4">
                      <GuideCard
                        guide={GUIDES.widget}
                        isOpen={isSectionOpen("widget")}
                      />
                    </div>
                  </div>
                </CardContent>
                )}
              </Card>
              )}
            </div>
            )}

          {/* 5️⃣ AI Personality */}
          {isSectionVisible("personality") && !focusedSection && (
          <div>
            <Card 
              className={`rounded-xl border-2 border-gray-200 h-full flex flex-col ${tileHoverClass} ${tileCardClass} cursor-pointer`}
              onClick={() => handleSectionOpen("personality")}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`${iconWrapperBase} bg-indigo-100`}>
                    <Bot className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold text-gray-900">AI Personality</CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      Define how your AI assistant communicates
                    </CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              {isSectionOpen("personality") && (
              <CardContent className="px-6 pb-6 pt-6">
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="flex gap-6 items-start">
                  {/* Left column - Assistant Name */}
                  <div className="space-y-2">
                    <Label htmlFor="chatbotName">Assistant Name</Label>
                    <Input
                      id="chatbotName"
                      value={formData.chatbotName}
                      onChange={(e) => handleFieldChange("chatbotName", e.target.value)}
                      placeholder="SofiA"
                      disabled={!canEdit}
                      className="w-48"
                    />
                  </div>
                  
                  {/* Right column - Logo */}
                  {canEdit && (
                    <div className="ml-auto">
                      <ImageCropUpload
                        currentImageUrl={
                          formData.logoUrl ? `${IMG_BASE_URL}${formData.logoUrl}` : undefined
                        }
                        onImageSelected={handleLogoChange}
                        onImageRemove={handleLogoRemove}
                        placeholder="logo"
                        editIconStyle={true}
                        size="md"
                        label=""
                        circularCrop={true}
                      />
                    </div>
                  )}
                  {!canEdit && formData.logoUrl && (
                    <div className="ml-auto">
                      <img
                        src={`${IMG_BASE_URL}${formData.logoUrl}`}
                        alt="Logo"
                        className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                      />
                    </div>
                  )}
                </div>
                    <div className="space-y-2">
                  <Label>Tone of Voice</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors ${
                        formData.toneOfVoice === "formal" 
                          ? "border-green-200 bg-green-50 ring-2 ring-green-200" 
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !canEdit ? null : handleFieldChange("toneOfVoice", "formal")}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-slate-600" />
                          <span className="text-sm font-medium">Formal</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        formData.toneOfVoice === "formal" 
                          ? "border-green-600 bg-green-600" 
                          : "border-slate-300"
                      }`} />
                    </div>
                    <div
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors ${
                        formData.toneOfVoice === "friendly" 
                          ? "border-green-200 bg-green-50 ring-2 ring-green-200" 
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !canEdit ? null : handleFieldChange("toneOfVoice", "friendly")}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Smile className="h-4 w-4 text-slate-600" />
                          <span className="text-sm font-medium">Friendly</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        formData.toneOfVoice === "friendly" 
                          ? "border-green-600 bg-green-600" 
                          : "border-slate-300"
                      }`} />
                    </div>
                    <div
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors ${
                        formData.toneOfVoice === "professional" 
                          ? "border-green-200 bg-green-50 ring-2 ring-green-200" 
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !canEdit ? null : handleFieldChange("toneOfVoice", "professional")}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-slate-600" />
                          <span className="text-sm font-medium">Professional</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        formData.toneOfVoice === "professional" 
                          ? "border-green-600 bg-green-600" 
                          : "border-slate-300"
                      }`} />
                    </div>
                    <div
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors ${
                        formData.toneOfVoice === "casual" 
                          ? "border-green-200 bg-green-50 ring-2 ring-green-200" 
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !canEdit ? null : handleFieldChange("toneOfVoice", "casual")}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-4 w-4 text-slate-600" />
                          <span className="text-sm font-medium">Casual</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        formData.toneOfVoice === "casual" 
                          ? "border-green-600 bg-green-600" 
                          : "border-slate-300"
                      }`} />
                    </div>
                  </div>
                </div>
                    <div className="space-y-2">
                  <Label htmlFor="botIdentityResponse">Bot Identity</Label>
                  <TextareaModal
                    title="Bot Identity Response"
                    value={formData.botIdentityResponse}
                    onChange={(value) => handleFieldChange("botIdentityResponse", value)}
                    placeholder="I'm an AI assistant created to help you..."
                    disabled={!canEdit}
                    hint="Define how your bot responds when asked about its identity"
                    variables={[
                      { name: "businessName", description: "Your business name" },
                      { name: "chatbotName", description: "Chatbot name" },
                      { name: "businessType", description: "Type of business" },
                      { name: "supportEmail", description: "Support email address" },
                      { name: "[LINK_REGISTRATION]", description: "Registration/signup link" },
                    ]}
                  />
                </div>
                    <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <TextareaModal
                    title="Welcome Message"
                    value={formData.welcomeMessage}
                    onChange={(value) => handleFieldChange("welcomeMessage", value)}
                    placeholder="Welcome! I'm your digital assistant. How can I help you today?"
                    disabled={!canEdit}
                    hint="First message sent when customer starts a conversation"
                    variables={[
                      { name: "customerName", description: "Customer's name" },
                      { name: "chatbotName", description: "Chatbot name" },
                      { name: "businessName", description: "Your business name" },
                    ]}
                  />
                </div>
                    <div className="space-y-2">
                  <Label htmlFor="customAiRules">Custom AI Rules</Label>
                  <TextareaModal
                    title="Custom AI Rules"
                    value={formData.customAiRules}
                    onChange={(value) => handleFieldChange("customAiRules", value)}
                    placeholder="Add custom rules for specific behaviors..."
                    disabled={!canEdit}
                    hint="💡 Custom rules override default AI behavior. Be specific and clear. Use variables to personalize responses."
                    variables={customAiVariables}
                  />
                </div>
                    <div className="space-y-2">
                  <Label htmlFor="wipMessage">Maintenance Message</Label>
                  <TextareaModal
                    title="Maintenance Message"
                    value={formData.wipMessage}
                    onChange={(value) => handleFieldChange("wipMessage", value)}
                    placeholder="Work in progress. Please contact us later."
                    disabled={!canEdit}
                    hint="Message shown when system is under maintenance (when Channel Status is OFF or Debug Mode is ON)"
                    variables={[
                      { name: "businessName", description: "Your business name" },
                      { name: "businessEmail", description: "Business email" },
                      { name: "businessPhone", description: "Business phone" },
                    ]}
                  />
                    </div>
                  </div>
                  <div className="lg:col-span-4 space-y-4">
                    <GuideCard
                      guide={GUIDES.personality}
                      isOpen={isSectionOpen("personality")}
                    />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">Widget preview</p>
                      <p className="text-sm text-slate-600 mt-1">
                        The live widget sits in the bottom-right corner so you can feel the tone changes while editing AI Personality.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              )}
            </Card>
          </div>
          )}

          {/* 6️⃣ Support Configuration */}
          {isSectionVisible("support") && !focusedSection && (
          <div>
            <Card 
              className={`rounded-xl border-2 border-gray-200 h-full flex flex-col ${tileHoverClass} ${tileCardClass} cursor-pointer`}
              onClick={() => handleSectionOpen("support")}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`${iconWrapperBase} bg-orange-100`}>
                    <Headphones className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold text-gray-900">Human Support</CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      Configure escalation to human operators
                    </CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              {isSectionOpen("support") && (
              <CardContent className="px-6 pt-6 pb-6">
                <div className="grid gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <Headphones className="h-5 w-5 text-slate-600" />
                    <p className="font-medium text-sm">Enable Human Support</p>
                  </div>
                  <Switch
                    checked={formData.hasHumanSupport}
                    onCheckedChange={(checked) =>
                      handleFieldChange("hasHumanSupport", checked)
                    }
                    disabled={!canEdit}
                  />
                </div>

                {formData.sellsProductsAndServices && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-slate-600" />
                      <p className="font-medium text-sm">Sales Agents</p>
                    </div>
                    <Switch
                      checked={formData.hasSalesAgents}
                      onCheckedChange={(checked) =>
                        handleFieldChange("hasSalesAgents", checked)
                      }
                      disabled={!canEdit}
                    />
                  </div>
                )}

                {formData.hasHumanSupport && (
                  <>
                    <div className="space-y-3">
                      <Label>Contact Method</Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-slate-600" />
                            <p className="font-medium text-sm">Email</p>
                          </div>
                          <Switch
                            checked={formData.operatorContactMethod === "email"}
                            onCheckedChange={(checked) => 
                              handleFieldChange("operatorContactMethod", checked ? "email" : "whatsapp")
                            }
                            disabled={!canEdit}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-slate-600" />
                            <p className="font-medium text-sm">WhatsApp</p>
                          </div>
                          <Switch
                            checked={formData.operatorContactMethod === "whatsapp"}
                            onCheckedChange={(checked) =>
                              handleFieldChange("operatorContactMethod", checked ? "whatsapp" : "email")
                            }
                            disabled={!canEdit}
                          />
                        </div>
                      </div>
                    </div>

                    {formData.operatorContactMethod === "whatsapp" && (
                      <div className="space-y-2">
                        <Label htmlFor="operatorWhatsappNumber">Operator WhatsApp</Label>
                        <Input
                          id="operatorWhatsappNumber"
                          value={formData.operatorWhatsappNumber}
                          onChange={(e) =>
                            handleFieldChange("operatorWhatsappNumber", e.target.value)
                          }
                          placeholder="+1234567890"
                          disabled={!canEdit}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="humanSupportInstructions">Support Instructions</Label>
                      <TextareaModal
                        title="Human Support Instructions"
                        value={formData.humanSupportInstructions}
                        onChange={(value) => handleFieldChange("humanSupportInstructions", value)}
                        placeholder="Instructions for when to escalate..."
                        disabled={!canEdit}
                        hint="Define when and how to escalate conversations to human operators"
                        variables={[
                          { name: "customerName", description: "Customer's name" },
                          { name: "operatorContact", description: "Operator contact method" },
                          { name: "[LINK_REGISTRATION]", description: "Registration/signup link" },
                        ]}
                      />
                    </div>
                  </>
                )}
                  </div>
                  <div className="lg:col-span-4">
                    <GuideCard
                      guide={GUIDES.support}
                      isOpen={isSectionOpen("support")}
                    />
                  </div>
                </div>
              </CardContent>
              )}
            </Card>
          </div>
          )}

          {/* 7️⃣ Security Settings */}
          {isSectionVisible("security") && !focusedSection && (
          <div>
            <Card 
              className={`rounded-xl border-2 border-gray-200 h-full flex flex-col ${tileHoverClass} ${tileCardClass} cursor-pointer`}
              onClick={() => handleSectionOpen("security")}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`${iconWrapperBase} bg-red-100`}>
                    <Shield className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold text-gray-900">Security & Access</CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      Control external domain access
                    </CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              {isSectionOpen("security") && (
              <CardContent className="px-6 pt-6 pb-6">
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="space-y-2">
                  <Label htmlFor="allowedExternalLinks">Allowed External Domains</Label>
                  <TextareaModal
                    title="Allowed External Domains"
                    value={formData.allowedExternalLinks}
                    onChange={(value) => handleFieldChange("allowedExternalLinks", value)}
                    placeholder="example.com, trusted-site.com, docs.google.com, stripe.com"
                    disabled={!canEdit}
                    hint="💡 Comma-separated list of trusted external domains that the bot can link to. Examples: docs.google.com, stripe.com, instagram.com"
                  />
                    </div>
                  </div>
                  <div className="lg:col-span-4">
                    <GuideCard
                      guide={GUIDES.security}
                      isOpen={isSectionOpen("security")}
                    />
                  </div>
                </div>
              </CardContent>
              )}
            </Card>
          </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Channel</DialogTitle>
              <DialogDescription>
                This action cannot be undone. Type the channel name to confirm:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="deleteConfirmation">Channel Name</Label>
              <Input
                id="deleteConfirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type channel name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteWorkspaceMutation.isPending}
              >
                {deleteWorkspaceMutation.isPending ? "Deleting..." : "Delete Channel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* YouTube Video Modal */}
      <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>How to Connect WhatsApp API</DialogTitle>
            <DialogDescription>
              Follow this video tutorial to set up your WhatsApp Business API
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video w-full">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/gdD_0ernIqM"
              title="WhatsApp API Setup Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg"
            ></iframe>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsVideoModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

      {/* Widget Preview (visible during AI Personality editing) */}
      {(!isDirty || focusedSection === "personality") && (
        <div className="fixed bottom-6 right-6 z-50">
          <ChatWidget
            workspaceId={currentWorkspace?.id}
            title={formData.widgetTitle}
            logoUrl={formData.logoUrl ? `${IMG_BASE_URL}${formData.logoUrl}` : undefined}
            primaryColor={formData.widgetPrimaryColor}
            language={formData.widgetLanguage}
          />
        </div>
      )}
    </div>
  )
}
