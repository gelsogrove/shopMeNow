import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageCropUpload } from "@/components/shared/ImageCropUpload"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ChatWidget } from "@/components/ChatWidget"
import { IMG_BASE_URL } from "@/config"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { updateWorkspace, deleteWorkspace } from "@/services/workspaceApi"
import { SUPPORTED_CURRENCIES } from "@/utils/format"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Store, 
  MessageSquare, 
  Smartphone, 
  Globe, 
  Bot, 
  Headphones, 
  Shield,
  Save,
  Monitor,
  Copy,
  MessageCircle,
  Sparkles,
  LifeBuoy,
  Brain,
  Zap,
  Send,
  HelpCircle,
  Phone,
  Mail,
  Cpu,
  MessagesSquare,
  ShoppingCart,
  AlertCircle,
  Briefcase,
  Smile,
  Users,
  Award,
  Coffee,
  Trash2,
  Loader2,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { api } from "@/services/api"

const WEBHOOK_BASE =
  import.meta.env.VITE_PUBLIC_WEBHOOK_BASE ||
  (typeof window !== "undefined" ? window.location.origin : "https://echatbot.ai")

// Types
type SectionKey = "channels" | "ai" | "general" | "security"

interface WorkspaceData {
  id: string
  name: string
  whatsappPhoneNumber: string
  whatsappApiKey: string
  whatsappAppSecret: string
  whatsappPhoneNumberId: string
  whatsappVerifyToken: string
  whatsappWebhookId?: string
  whatsappWebhookToken?: string
  whatsappWebhookUrl?: string
  adminEmail: string
  url: string
  currency: string
  channelStatus: boolean
  debugMode: boolean
  welcomeMessage: string
  wipMessage: string
  allowedExternalLinks: string
  enableWhatsapp: boolean
  enableWidget: boolean
  widgetTitle: string
  widgetPrimaryColor: string
  widgetLanguage: string
  widgetIcon: string
  businessType: string
  chatbotName: string
  botIdentityResponse: string
  customAiRules: string
  sellsProductsAndServices: boolean
  hasHumanSupport: boolean
  hasSalesAgents: boolean
  humanSupportInstructions: string
  operatorContactMethod: "email" | "whatsapp"
  operatorWhatsappNumber: string
  toneOfVoice: "formal" | "friendly" | "professional" | "casual"
  logoUrl?: string
}

// Menu Items Configuration
const MENU_ITEMS = [
  { 
    key: "channels" as SectionKey, 
    icon: MessageSquare, 
    label: "Channels & Connections",
    description: "Enable/disable communication channels"
  },
  { 
    key: "ai" as SectionKey, 
    icon: Bot, 
    label: "AI Configuration",
    description: "Bot personality & behavior"
  },
  { 
    key: "general" as SectionKey, 
    icon: Store, 
    label: "General Settings",
    description: "Business info & branding"
  },
  { 
    key: "security" as SectionKey, 
    icon: Shield, 
    label: "Security & Support",
    description: "Access control & human support"
  },
]

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail & E-commerce", desc: "Online or physical store" },
  { value: "restaurant", label: "Restaurant & Food", desc: "Food service business" },
  { value: "healthcare", label: "Healthcare", desc: "Medical services" },
  { value: "education", label: "Education", desc: "Schools, courses" },
  { value: "finance", label: "Finance & Banking", desc: "Financial services" },
  { value: "realestate", label: "Real Estate", desc: "Property services" },
  { value: "technology", label: "Technology & IT", desc: "Tech services" },
  { value: "other", label: "Other", desc: "Other business type" },
]

const WIDGET_ICON_OPTIONS = [
  { value: "chat", label: "Chat Bubble", icon: MessageCircle, hint: "Classic chat" },
  { value: "bot", label: "Bot", icon: Bot, hint: "AI assistant" },
  { value: "sparkles", label: "Sparkles", icon: Sparkles, hint: "AI magic" },
  { value: "support", label: "Support", icon: LifeBuoy, hint: "Help & support" },
  { value: "brain", label: "Brain", icon: Brain, hint: "Smart AI" },
  { value: "zap", label: "Zap", icon: Zap, hint: "Fast replies" },
  { value: "send", label: "Send", icon: Send, hint: "Quick message" },
  { value: "message-square", label: "Message", icon: MessageSquare, hint: "Conversation" },
  { value: "messages", label: "Messages", icon: MessagesSquare, hint: "Multi chat" },
  { value: "help", label: "Help", icon: HelpCircle, hint: "Questions" },
  { value: "phone", label: "Phone", icon: Phone, hint: "Contact" },
  { value: "cpu", label: "CPU", icon: Cpu, hint: "Tech AI" },
]

const defaultWelcomeMessage = "👋 Welcome! I'm your digital assistant. How can I help you today?"
const defaultWipMessage = "⚠️ System is currently under maintenance. Please try again later."

const customAiVariables = [
  { name: "customerName", description: "Customer's name" },
  { name: "chatbotName", description: "Chatbot name" },
  { name: "businessName", description: "Your business name" },
  { name: "businessType", description: "Type of business" },
  { name: "supportEmail", description: "Support email address" },
  { name: "[LINK_REGISTRATION]", description: "Registration/signup link" },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { workspace, setCurrentWorkspace } = useWorkspace()
  const currentWorkspace = workspace // Get current workspace
  const { isOwner, isSuperAdmin } = useWorkspaceRole(currentWorkspace?.id || "")
  const canEdit = isOwner || isSuperAdmin
  
  // Active section from menu
  const [activeSection, setActiveSection] = useState<SectionKey>("channels")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isDirty, setIsDirty] = useState(false)
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [showWhatsAppSecrets, setShowWhatsAppSecrets] = useState(false)

  const handleCopy = async (text?: string) => {
    if (!text) {
      toast.error("Nothing to copy")
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch (err) {
      toast.error("Copy failed")
      console.error(err)
    }
  }
  
  // Delete workspace dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const [formData, setFormData] = useState<WorkspaceData>({
    id: "",
    name: "",
    whatsappPhoneNumber: "",
    whatsappApiKey: "",
    whatsappAppSecret: "",
    whatsappPhoneNumberId: "",
    whatsappVerifyToken: "",
    whatsappWebhookId: undefined,
    whatsappWebhookToken: undefined,
    whatsappWebhookUrl: undefined,
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
    widgetTitle: "Chat with us",
    widgetPrimaryColor: "#22c55e",
    widgetLanguage: "it",
    widgetIcon: "chat",
    businessType: "retail",
    chatbotName: "Sofia",
    botIdentityResponse: "",
    customAiRules: "",
    sellsProductsAndServices: true,
    hasHumanSupport: true,
    hasSalesAgents: false,
    humanSupportInstructions: "",
    operatorContactMethod: "email",
    operatorWhatsappNumber: "",
    toneOfVoice: "friendly",
    logoUrl: undefined,
  })
  const webhookDisplayUrl =
    formData.whatsappWebhookUrl ||
    `${WEBHOOK_BASE.replace(/\/$/, "")}/api/whatsapp/webhook/${formData.whatsappWebhookId || ""}`

  // Load workspace data
  useEffect(() => {
    if (currentWorkspace) {
      setFormData({
        id: currentWorkspace.id,
        name: currentWorkspace.name || "",
        whatsappPhoneNumber: currentWorkspace.whatsappPhoneNumber || "",
        whatsappApiKey: currentWorkspace.whatsappApiKey || "",
        whatsappAppSecret: currentWorkspace.whatsappAppSecret || "",
        whatsappPhoneNumberId: currentWorkspace.whatsappPhoneNumberId || "",
        whatsappVerifyToken:
          currentWorkspace.whatsappVerifyToken ||
          currentWorkspace.whatsappWebhookToken ||
          "",
        whatsappWebhookId: currentWorkspace.whatsappWebhookId,
        whatsappWebhookToken: currentWorkspace.whatsappWebhookToken,
        whatsappWebhookUrl: currentWorkspace.whatsappWebhookUrl,
        adminEmail: currentWorkspace.adminEmail || "",
        url: currentWorkspace.url || "http://localhost:3000",
        currency: currentWorkspace.currency || "USD",
        channelStatus: currentWorkspace.channelStatus ?? true,
        debugMode: currentWorkspace.debugMode ?? false,
        welcomeMessage: currentWorkspace.welcomeMessage || defaultWelcomeMessage,
        wipMessage: currentWorkspace.wipMessage || defaultWipMessage,
        allowedExternalLinks: Array.isArray(currentWorkspace.allowedExternalLinks) 
          ? currentWorkspace.allowedExternalLinks.join(", ") 
          : (currentWorkspace.allowedExternalLinks || ""),
        enableWhatsapp: currentWorkspace.enableWhatsapp ?? true,
        enableWidget: currentWorkspace.enableWidget ?? false,
        widgetTitle: currentWorkspace.widgetTitle || "Chat with us",
        widgetPrimaryColor: currentWorkspace.widgetPrimaryColor || "#22c55e",
        widgetLanguage: currentWorkspace.widgetLanguage || "it",
        widgetIcon: currentWorkspace.widgetIcon || "chat",
        businessType: currentWorkspace.businessType || "retail",
        chatbotName: currentWorkspace.chatbotName || "Sofia",
        botIdentityResponse: currentWorkspace.botIdentityResponse || "",
        customAiRules: currentWorkspace.customAiRules || "",
        sellsProductsAndServices: currentWorkspace.sellsProductsAndServices ?? true,
        hasHumanSupport: currentWorkspace.hasHumanSupport ?? true,
        hasSalesAgents: currentWorkspace.hasSalesAgents ?? false,
        humanSupportInstructions: currentWorkspace.humanSupportInstructions || "",
        operatorContactMethod: (currentWorkspace.operatorContactMethod as "email" | "whatsapp") || "email",
        operatorWhatsappNumber: currentWorkspace.operatorWhatsappNumber || "",
        toneOfVoice: (currentWorkspace.toneOfVoice as typeof formData.toneOfVoice) || "friendly",
        logoUrl: currentWorkspace.logoUrl,
      })
    }
  }, [currentWorkspace])

  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handleLogoChange = async (file: File) => {
    if (!currentWorkspace?.id) return
    setIsLogoUploading(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append("logo", file)

      const { api } = await import("@/services/api")
      const response = await api.post(
        `/workspaces/${currentWorkspace.id}/logo`,
        formDataUpload,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      
      if (response.data.logoUrl) {
        handleFieldChange("logoUrl", response.data.logoUrl)
        toast.success("Logo uploaded successfully")
        
        setCurrentWorkspace({
          ...currentWorkspace,
          logoUrl: response.data.logoUrl,
        })
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to upload logo")
    } finally {
      setIsLogoUploading(false)
    }
  }

  const handleLogoRemove = async () => {
    if (!currentWorkspace?.id) return
    try {
      handleFieldChange("logoUrl", undefined)
      toast.success("Logo removed successfully")
      
      setCurrentWorkspace({
        ...currentWorkspace,
        logoUrl: undefined,
      })
    } catch (error: any) {
      toast.error(error.message || "Failed to remove logo")
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    if (!formData.name?.trim()) {
      newErrors.name = "Channel name is required"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fix the errors before saving")
      return
    }

    try {
      const updateData: any = { ...formData }
      delete updateData.id
      delete updateData.logoUrl
      if (!updateData.whatsappAppSecret) {
        delete updateData.whatsappAppSecret
      }

      const updatedWorkspace = await updateWorkspace(currentWorkspace!.id, updateData)
      
      setCurrentWorkspace({
        ...currentWorkspace!,
        ...updatedWorkspace,
      })
      
      setIsDirty(false)
      toast.success("Settings saved successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings")
    }
  }

  // Delete workspace mutation
  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => {
      return deleteWorkspace(formData.id)
    },
    onSuccess: async () => {
      console.log("✅ Workspace deleted successfully. Logging out...")
      
      // Logout user
      const { api } = await import("@/services/api")
      await api.post("/auth/logout")
      
      // Clear all storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Redirect to login
      navigate("/login")
      toast.success("Workspace deleted successfully")
    },
    onError: (error: any) => {
      console.error("❌ Failed to delete workspace:", error)
      toast.error(error.message || "Failed to delete workspace")
    },
  })

  const handleDelete = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type DELETE to confirm")
      return
    }
    
    setShowDeleteDialog(false)
    setDeleteConfirmation("")
    deleteWorkspaceMutation.mutate()
  }

  // Render Content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case "channels":
        return renderChannelsSection()
      case "ai":
        return renderPersonalitySection()
      case "general":
        return renderBusinessSection()
      case "security":
        return renderSecuritySection()
      default:
        return null
    }
  }

  const renderBusinessSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Store className="h-6 w-6 text-purple-600" />
          Business Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">Define your business type and basic information</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
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

          {/* E-commerce Features - Hide if only Widget is enabled (no WhatsApp) */}
          {(formData.enableWhatsapp || !formData.enableWidget) && (
            <div className="mt-6 space-y-4">
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
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate(-1)} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )

  const renderChannelsSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-green-600" />
          Channels & Connections
        </h2>
        <p className="text-sm text-gray-500 mt-1">Enable/disable communication channels and configure technical settings</p>
      </div>

      {/* Channel Status & Debug Mode */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-green-50 to-white">
          <CardTitle className="text-base font-semibold">Channel Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Channel Active Toggle */}
          <div className="flex items-center justify-between rounded-xl border-2 border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-sm">Channel Active</p>
                <p className="text-xs text-green-700">
                  {formData.channelStatus ? "Chatbot is currently active" : "Chatbot is currently inactive"}
                </p>
              </div>
            </div>
            <Switch
              checked={formData.channelStatus}
              onCheckedChange={(checked) =>
                handleFieldChange("channelStatus", checked)
              }
              disabled={!canEdit}
            />
          </div>

          {/* Debug Mode - MOVED HERE! */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-slate-600" />
              <div>
                <p className="font-medium text-sm">Debug Mode</p>
                <p className="text-xs text-slate-500">Show detailed logs for troubleshooting</p>
              </div>
            </div>
            <Switch
              checked={formData.debugMode}
              onCheckedChange={(checked) =>
                handleFieldChange("debugMode", checked)
              }
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Channel */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              WhatsApp Channel
            </CardTitle>
            <Switch
              checked={formData.enableWhatsapp}
              onCheckedChange={(checked) =>
                handleFieldChange("enableWhatsapp", checked)
              }
              disabled={!canEdit}
            />
          </div>
        </CardHeader>
        {formData.enableWhatsapp && (
          <CardContent className="pt-6 space-y-4">
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

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Switch
                checked={showWhatsAppSecrets}
                onCheckedChange={setShowWhatsAppSecrets}
                disabled={!canEdit}
              />
              <span>Show API key & App Secret</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappApiKey">API Key</Label>
              <Input
                id="whatsappApiKey"
                type={showWhatsAppSecrets ? "text" : "password"}
                value={formData.whatsappApiKey}
                onChange={(e) => handleFieldChange("whatsappApiKey", e.target.value)}
                placeholder="Enter API key"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappAppSecret">App Secret</Label>
              <Input
                id="whatsappAppSecret"
                type={showWhatsAppSecrets ? "text" : "password"}
                value={formData.whatsappAppSecret}
                onChange={(e) => handleFieldChange("whatsappAppSecret", e.target.value)}
                placeholder="Enter App Secret"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">
                Usato per verificare la firma del webhook (per canale).
              </p>
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

            <div className="space-y-2">
              <Label>Webhook URL (paste in Meta)</Label>
              <div className="flex gap-2 items-center">
                <code className="flex-1 rounded border bg-slate-50 px-2 py-2 text-xs font-mono overflow-x-auto">
                  {webhookDisplayUrl || "Not generated"}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopy(webhookDisplayUrl)}
                  disabled={!webhookDisplayUrl}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Inserisci questo URL nel webhook di Meta → {webhookDisplayUrl || `${WEBHOOK_BASE}/api/whatsapp/webhook/:webhookId`}
                <br />
                <strong>Verify Token</strong>: usa il token inserito sopra per configurare il webhook in Meta.
              </p>
            </div>

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
          </CardContent>
        )}
      </Card>

      {/* Website Widget Channel */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Monitor className="h-5 w-5 text-indigo-600" />
              Website Widget Channel
            </CardTitle>
            <Switch
              checked={formData.enableWidget}
              onCheckedChange={(checked) =>
                handleFieldChange("enableWidget", checked)
              }
              disabled={!canEdit}
            />
          </div>
        </CardHeader>
        {formData.enableWidget && (
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Widget Title */}
              <div className="space-y-2">
                <Label htmlFor="widgetTitle" className="text-xs font-semibold text-gray-700">Widget Title</Label>
                <Input
                  id="widgetTitle"
                  value={formData.widgetTitle}
                  onChange={(e) => handleFieldChange("widgetTitle", e.target.value)}
                  placeholder="Chat with us"
                  disabled={!canEdit}
                />
              </div>

              {/* Primary Color */}
              <div className="space-y-2">
                <Label htmlFor="widgetPrimaryColor" className="text-xs font-semibold text-gray-700">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="widgetPrimaryColor"
                    type="color"
                    value={formData.widgetPrimaryColor}
                    onChange={(e) => handleFieldChange("widgetPrimaryColor", e.target.value)}
                    disabled={!canEdit}
                    className="w-12 h-9 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.widgetPrimaryColor}
                    onChange={(e) => handleFieldChange("widgetPrimaryColor", e.target.value)}
                    disabled={!canEdit}
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Widget Icon - Full Width */}
              <div className="col-span-2 space-y-2">
                <Label className="text-xs font-semibold text-gray-700">Widget Icon</Label>
                <div className="grid grid-cols-6 gap-2">
                  {WIDGET_ICON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "h-16 rounded border-2 transition-all flex flex-col items-center justify-center gap-1",
                        formData.widgetIcon === option.value
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => handleFieldChange("widgetIcon", option.value)}
                      disabled={!canEdit}
                    >
                      <option.icon className={cn("h-5 w-5", formData.widgetIcon === option.value ? "text-green-600" : "text-gray-600")} />
                      <span className="text-[9px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ========== EMBED CODE - DENTRO Website Widget Channel ========== */}
            <div className="space-y-3 pt-6 mt-6 border-t-2 border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-bold text-gray-900 flex items-center gap-2">
                    📋 Embed Code
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">Copy this code into your website's HTML to activate the widget</p>
                </div>
                <Button
                  type="button"
                  size="default"
                  className="h-10 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg"
                  onClick={() => {
                    const embedCode = `<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${currentWorkspace?.id}",
    title: "${formData.widgetTitle || 'Chat with us'}",
    primaryColor: "${formData.widgetPrimaryColor || '#22c55e'}",
    icon: "${formData.widgetIcon || 'chat'}",
    language: "${formData.widgetLanguage || 'it'}"
  };
</script>
<script src="${window.location.origin}/widget.js" async></script>`;
                    navigator.clipboard.writeText(embedCode);
                    toast.success("✅ Code copied to clipboard!");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
              </div>
              <div className="relative">
                <pre className="bg-slate-900 text-green-400 p-5 rounded-xl text-sm leading-relaxed overflow-x-auto border-2 border-slate-600 shadow-xl">
{`<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${currentWorkspace?.id || 'YOUR_WORKSPACE_ID'}",
    title: "${formData.widgetTitle || 'Chat with us'}",
    primaryColor: "${formData.widgetPrimaryColor || '#22c55e'}",
    icon: "${formData.widgetIcon || 'chat'}",
    language: "${formData.widgetLanguage || 'it'}"
  };
</script>
<script src="${window.location.origin}/widget.js" async></script>`}
                </pre>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {canEdit && (
        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate(-1)} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )

  const renderWhatsAppSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Smartphone className="h-6 w-6 text-emerald-600" />
          WhatsApp Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">Configure WhatsApp Business API credentials</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
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

          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Switch
              checked={showWhatsAppSecrets}
              onCheckedChange={setShowWhatsAppSecrets}
              disabled={!canEdit}
            />
            <span>Show API key & App Secret</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsappApiKey">API Key</Label>
            <Input
              id="whatsappApiKey"
              type={showWhatsAppSecrets ? "text" : "password"}
              value={formData.whatsappApiKey}
              onChange={(e) => handleFieldChange("whatsappApiKey", e.target.value)}
              placeholder="Enter API key"
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsappAppSecret">App Secret</Label>
            <Input
              id="whatsappAppSecret"
              type={showWhatsAppSecrets ? "text" : "password"}
              value={formData.whatsappAppSecret}
              onChange={(e) => handleFieldChange("whatsappAppSecret", e.target.value)}
              placeholder="Enter App Secret"
              disabled={!canEdit}
            />
            <p className="text-xs text-gray-500">
              Usato per verificare la firma del webhook (per canale).
            </p>
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
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate(-1)} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )

  const renderWidgetSection = () => (
    <div className="h-full flex flex-col">
      {/* Header Compatto */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Globe className="h-5 w-5 text-indigo-600" />
          Widget Configuration
        </h2>
        <p className="text-xs text-gray-500 mt-1">Customize your website chat widget</p>
      </div>

      {/* Main Card - Layout compatto senza scroll */}
      <Card className="shadow-sm border-gray-200 flex-1 flex flex-col">
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white px-4 py-3">
          <CardTitle className="text-base font-semibold text-gray-900">Widget Appearance</CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex-1">
          <div className="space-y-6">
            {/* Widget Configuration */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Colonna Sinistra */}
              <div className="space-y-4">
                {/* Widget Title */}
                <div className="space-y-2">
                  <Label htmlFor="widgetTitle" className="text-xs font-semibold text-gray-700">Widget Title</Label>
                  <Input
                    id="widgetTitle"
                    value={formData.widgetTitle}
                    onChange={(e) => handleFieldChange("widgetTitle", e.target.value)}
                    placeholder="Chat with us"
                    disabled={!canEdit}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Primary Color */}
                <div className="space-y-2">
                  <Label htmlFor="widgetPrimaryColor" className="text-xs font-semibold text-gray-700">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="widgetPrimaryColor"
                      type="color"
                      value={formData.widgetPrimaryColor}
                      onChange={(e) => handleFieldChange("widgetPrimaryColor", e.target.value)}
                      disabled={!canEdit}
                      className="w-12 h-9 cursor-pointer rounded border-2"
                    />
                    <Input
                      type="text"
                      value={formData.widgetPrimaryColor}
                      onChange={(e) => handleFieldChange("widgetPrimaryColor", e.target.value)}
                      disabled={!canEdit}
                      className="flex-1 font-mono text-xs h-9"
                      placeholder="#22c55e"
                    />
                  </div>
                </div>
              </div>

              {/* Colonna Destra - Widget Icon */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700">Widget Icon</Label>
                <div className="grid grid-cols-4 gap-2">
                  {WIDGET_ICON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "h-16 rounded border-2 transition-all flex flex-col items-center justify-center gap-1 p-1",
                        formData.widgetIcon === option.value
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                      onClick={() => handleFieldChange("widgetIcon", option.value)}
                      disabled={!canEdit}
                      title={`${option.label} - ${option.hint}`}
                    >
                      <option.icon 
                        className={cn(
                          "h-5 w-5 flex-shrink-0",
                          formData.widgetIcon === option.value ? "text-green-600" : "text-gray-600"
                        )} 
                      />
                      <span className={cn(
                        "text-[9px] font-medium leading-tight",
                        formData.widgetIcon === option.value ? "text-green-700" : "text-gray-700"
                      )}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ========== EMBED CODE - DENTRO LA CARD, SEMPRE VISIBILE ========== */}
            <div className="space-y-3 pt-6 mt-6 border-t-2 border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-bold text-gray-900 flex items-center gap-2">
                    📋 Embed Code
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">Copy this code into your website's HTML to activate the widget</p>
                </div>
                <Button
                  type="button"
                  size="default"
                  className="h-10 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg"
                  onClick={() => {
                    const embedCode = `<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${currentWorkspace?.id}",
    title: "${formData.widgetTitle || 'Chat with us'}",
    primaryColor: "${formData.widgetPrimaryColor || '#22c55e'}",
    icon: "${formData.widgetIcon || 'chat'}",
    language: "${formData.widgetLanguage || 'it'}"
  };
</script>
<script src="${window.location.origin}/widget.js" async></script>`;
                    navigator.clipboard.writeText(embedCode);
                    toast.success("✅ Code copied to clipboard!");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
              </div>
              <div className="relative">
                <pre className="bg-slate-900 text-green-400 p-5 rounded-xl text-sm leading-relaxed overflow-x-auto border-2 border-slate-600 shadow-xl">
{`<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${currentWorkspace?.id || 'YOUR_WORKSPACE_ID'}",
    title: "${formData.widgetTitle || 'Chat with us'}",
    primaryColor: "${formData.widgetPrimaryColor || '#22c55e'}",
    icon: "${formData.widgetIcon || 'chat'}",
    language: "${formData.widgetLanguage || 'it'}"
  };
</script>
<script src="${window.location.origin}/widget.js" async></script>`}
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Buttons */}
      {canEdit && (
        <div className="flex justify-end gap-2 mt-3">
          <Button onClick={() => navigate(-1)} variant="outline" size="sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty} size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )

  const renderPersonalitySection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Bot className="h-6 w-6 text-blue-600" />
          AI Personality
        </h2>
        <p className="text-sm text-gray-500 mt-1">Define how your AI assistant communicates</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex gap-6 items-start">
            <div className="space-y-2">
              <Label htmlFor="chatbotName">Assistant Name</Label>
              <Input
                id="chatbotName"
                value={formData.chatbotName}
                onChange={(e) => handleFieldChange("chatbotName", e.target.value)}
                placeholder="Sofia"
                disabled={!canEdit}
                className="w-48"
              />
            </div>
            
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
              {[
                { value: "formal", icon: Briefcase, label: "Formal" },
                { value: "friendly", icon: Smile, label: "Friendly" },
                { value: "professional", icon: Award, label: "Professional" },
                { value: "casual", icon: Coffee, label: "Casual" },
              ].map(({ value, icon: Icon, label }) => (
                <div
                  key={value}
                  className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors ${
                    formData.toneOfVoice === value 
                      ? "border-green-200 bg-green-50 ring-2 ring-green-200" 
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => !canEdit ? null : handleFieldChange("toneOfVoice", value)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    formData.toneOfVoice === value 
                      ? "border-green-600 bg-green-600" 
                      : "border-slate-300"
                  }`} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="botIdentityResponse">Bot Identity</Label>
            <Textarea
              id="botIdentityResponse"
              value={formData.botIdentityResponse}
              onChange={(e) => handleFieldChange("botIdentityResponse", e.target.value)}
              placeholder="I'm an AI assistant created to help you..."
              disabled={!canEdit}
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground">Define how your bot responds when asked about its identity</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message</Label>
            <Textarea
              id="welcomeMessage"
              value={formData.welcomeMessage}
              onChange={(e) => handleFieldChange("welcomeMessage", e.target.value)}
              placeholder="Welcome! I'm your digital assistant. How can I help you today?"
              disabled={!canEdit}
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground">First message sent when customer starts a conversation</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customAiRules">Custom AI Rules</Label>
            <Textarea
              id="customAiRules"
              value={formData.customAiRules}
              onChange={(e) => handleFieldChange("customAiRules", e.target.value)}
              placeholder="Add custom rules for specific behaviors..."
              disabled={!canEdit}
              className="min-h-[150px]"
            />
            <p className="text-sm text-muted-foreground">💡 Custom rules override default AI behavior. Be specific and clear. Use variables to personalize responses.</p>
          </div>

          {/* Available Variables Reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <span>📝</span>
              Available Variables (use in Welcome Message, AI Rules, etc.)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{"{{nome}}"}</code>
                <span className="text-gray-600 ml-2">Customer name</span>
              </div>
              <div>
                <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{"{{email}}"}</code>
                <span className="text-gray-600 ml-2">Customer email</span>
              </div>
              <div>
                <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{"{{telefono}}"}</code>
                <span className="text-gray-600 ml-2">Customer phone</span>
              </div>
              <div>
                <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{"{{lingua}}"}</code>
                <span className="text-gray-600 ml-2">Customer language</span>
              </div>
              <div>
                <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{"{{nomeAzienda}}"}</code>
                <span className="text-gray-600 ml-2">Company name</span>
              </div>
              <div>
                <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{"{{whatsapp}}"}</code>
                <span className="text-gray-600 ml-2">WhatsApp number</span>
              </div>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              💡 <strong>Tip</strong>: Use these variables to personalize messages. Example: "Ciao {`{{nome}}`}, welcome to {`{{nomeAzienda}}`}!"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wipMessage">Maintenance Message</Label>
            <Textarea
              id="wipMessage"
              value={formData.wipMessage}
              onChange={(e) => handleFieldChange("wipMessage", e.target.value)}
              placeholder="Work in progress. Please contact us later."
              disabled={!canEdit}
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground">Message shown when system is under maintenance (when Channel Status is OFF or Debug Mode is ON)</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Widget preview</p>
            <p className="text-sm text-slate-600 mt-1">
              The live widget sits in the bottom-right corner so you can feel the tone changes while editing AI Personality.
            </p>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate(-1)} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )

  const renderSecuritySection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="h-6 w-6 text-red-600" />
          Security & Support
        </h2>
        <p className="text-sm text-gray-500 mt-1">Access control and human operator escalation</p>
      </div>

      {/* Security - External Domains */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-red-50 to-white">
          <CardTitle className="text-base font-semibold">External Domain Access</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="allowedExternalLinks">Allowed External Domains</Label>
            <Textarea
              id="allowedExternalLinks"
              value={formData.allowedExternalLinks}
              onChange={(e) => handleFieldChange("allowedExternalLinks", e.target.value)}
              placeholder="example.com, trusted-site.com, docs.google.com, stripe.com"
              disabled={!canEdit}
              className="min-h-[80px]"
            />
            <p className="text-sm text-muted-foreground">💡 Comma-separated list of trusted external domains that the bot can link to. Examples: docs.google.com, stripe.com, instagram.com</p>
          </div>
        </CardContent>
      </Card>

      {/* Human Support */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold">Human Support Escalation</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
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

          {/* hasSalesAgents toggle REMOVED - Andrea: "non serve più il flag" */}

          {formData.hasHumanSupport && (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm text-blue-800">
                  <strong>✨ Smart Agent Routing:</strong> If a customer has an assigned sales agent, support requests will automatically be sent to that agent. Otherwise, they'll go to the operator configured below.
                </p>
              </div>
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
                <Textarea
                  id="humanSupportInstructions"
                  value={formData.humanSupportInstructions}
                  onChange={(e) => handleFieldChange("humanSupportInstructions", e.target.value)}
                  placeholder="Instructions for when to escalate..."
                  disabled={!canEdit}
                  className="min-h-[100px]"
                />
                <p className="text-sm text-muted-foreground">Define when and how to escalate conversations to human operators</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone - Delete Workspace (Super Admin only) */}
      {isSuperAdmin && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="border-b border-red-200">
            <CardTitle className="text-base font-semibold text-red-700">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-medium text-sm text-gray-900">Delete Workspace</p>
                <p className="text-sm text-gray-600">
                  Permanently delete this workspace and all associated data. This action can be recovered within 90 days.
                </p>
              </div>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteWorkspaceMutation.isPending}
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
            </div>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate(-1)} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-full">
        {/* Left Sidebar Menu */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-4 border-b border-gray-200">
            <h1 className="text-lg font-bold text-gray-900">Settings</h1>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.key
              
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-green-50 text-green-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    {!isActive && (
                      <div className="text-xs text-gray-400 truncate leading-tight">{item.description}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Right Content Area - Fixed height with scroll */}
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-8">
              {renderContent()}
            </div>
          </div>
        </main>
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
              This action will soft-delete the workspace. You can recover it within 90 days by contacting support.
              All data will be permanently deleted after 90 days.
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
              onClick={handleDelete}
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

      {/* Chat Widget (always visible) */}
      {currentWorkspace && (
        <ChatWidget
          key={`${formData.widgetTitle}-${formData.widgetPrimaryColor}-${formData.widgetIcon}-${formData.widgetLanguage}`}
          workspaceId={currentWorkspace.id}
          title={formData.widgetTitle}
          primaryColor={formData.widgetPrimaryColor}
          icon={formData.widgetIcon}
          logoUrl={
            formData.logoUrl ? `${IMG_BASE_URL}${formData.logoUrl}` : undefined
          }
          language={formData.widgetLanguage}
        />
      )}
    </div>
  )
}

export default SettingsPage
