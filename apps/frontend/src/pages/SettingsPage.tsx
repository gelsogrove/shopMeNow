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
import { updateWorkspace } from "@/services/workspaceApi"
import { SUPPORTED_CURRENCIES } from "@/utils/format"
import { Textarea } from "@/components/ui/textarea"
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
  ShoppingCart,
  AlertCircle,
  Users,
  Briefcase,
  Smile,
  Award,
  Coffee,
  Copy
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"

// Types
type SectionKey = "business" | "channels" | "whatsapp" | "widget" | "personality" | "support" | "security"

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
  enableWhatsapp: boolean
  enableWidget: boolean
  widgetTitle: string
  widgetPrimaryColor: string
  widgetLanguage: string
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
    key: "business" as SectionKey, 
    icon: Store, 
    label: "Business Configuration",
    description: "Basic business settings"
  },
  { 
    key: "channels" as SectionKey, 
    icon: MessageSquare, 
    label: "Channel Selection",
    description: "Enable/disable channels"
  },
  { 
    key: "whatsapp" as SectionKey, 
    icon: Smartphone, 
    label: "WhatsApp",
    description: "WhatsApp configuration"
  },
  { 
    key: "widget" as SectionKey, 
    icon: Globe, 
    label: "Website Widget",
    description: "Chat widget settings"
  },
  { 
    key: "personality" as SectionKey, 
    icon: Bot, 
    label: "AI Personality",
    description: "Bot behavior & tone"
  },
  { 
    key: "support" as SectionKey, 
    icon: Headphones, 
    label: "Human Support",
    description: "Operator escalation"
  },
  { 
    key: "security" as SectionKey, 
    icon: Shield, 
    label: "Security",
    description: "Domain access control"
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
  const [activeSection, setActiveSection] = useState<SectionKey>("business")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isDirty, setIsDirty] = useState(false)
  const [isLogoUploading, setIsLogoUploading] = useState(false)
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
    widgetTitle: "Chat with us",
    widgetPrimaryColor: "#22c55e",
    widgetLanguage: "it",
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

  // Load workspace data
  useEffect(() => {
    if (currentWorkspace) {
      setFormData({
        id: currentWorkspace.id,
        name: currentWorkspace.name || "",
        whatsappPhoneNumber: currentWorkspace.whatsappPhoneNumber || "",
        whatsappApiKey: currentWorkspace.whatsappApiKey || "",
        whatsappPhoneNumberId: currentWorkspace.whatsappPhoneNumberId || "",
        whatsappVerifyToken: currentWorkspace.whatsappVerifyToken || "",
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

  // Render Content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case "business":
        return renderBusinessSection()
      case "channels":
        return renderChannelsSection()
      case "whatsapp":
        return renderWhatsAppSection()
      case "widget":
        return renderWidgetSection()
      case "personality":
        return renderPersonalitySection()
      case "support":
        return renderSupportSection()
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
          Channel Selection
        </h2>
        <p className="text-sm text-gray-500 mt-1">Choose which channels to enable for customer communication</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Channel Status Toggle - SPOSTATO QUI */}
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

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-slate-600" />
              <div>
                <p className="font-semibold text-sm">WhatsApp</p>
                <p className="text-xs text-slate-500">Message customers directly</p>
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
                <p className="text-xs text-slate-500">Embed chat on your site</p>
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Globe className="h-6 w-6 text-indigo-600" />
          Widget Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">Customize your website chat widget</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
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

  const renderSupportSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Headphones className="h-6 w-6 text-orange-600" />
          Human Support
        </h2>
        <p className="text-sm text-gray-500 mt-1">Configure escalation to human operators</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
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
          Security & Access
        </h2>
        <p className="text-sm text-gray-500 mt-1">Control external domain access</p>
      </div>

      <Card>
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
      <div className="flex h-screen">
        {/* Left Sidebar Menu */}
        <aside className="w-56 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h1 className="text-lg font-bold text-gray-900 mb-4">Settings</h1>
            <nav className="space-y-1">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.key
                
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                      isActive
                        ? "bg-green-50 text-green-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                    <div className="flex-1">
                      <div className="text-sm">{item.label}</div>
                      {!isActive && (
                        <div className="text-xs text-gray-400">{item.description}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container pl-0 pr-4 pt-4 pb-4">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Chat Widget (always visible) */}
      {currentWorkspace && (
        <ChatWidget workspaceId={currentWorkspace.id} />
      )}
    </div>
  )
}
