import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"
import { SUPPORTED_CURRENCIES } from "@/utils/format"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Save, Settings, Trash2, HelpCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface WorkspaceData {
  id: string
  name: string
  whatsappPhoneNumber: string
  adminEmail: string
  url: string
  currency: string
  channelStatus: boolean // 🆕 Feature 126: Chatbot enabled/disabled (true=enabled, false=WIP mode)
  welcomeMessage: string
  wipMessage: string
  allowedExternalLinks: string // 🆕 Security: comma-separated list of allowed domains
  // 🆕 Channel Configuration (Feature 199)
  sellsProductsAndServices: boolean
  hasSalesAgents: boolean
  hasHumanSupport: boolean
  humanSupportInstructions: string
  frustrationEscalationInstructions: string // 🆕 Feature 203: Custom escalation triggers
  operatorContactMethod: string
  operatorWhatsappNumber: string
  toneOfVoice: string
  botIdentityResponse: string
  address: string // 🆕 Physical location for "where are you?" questions
  customAiRules: string // 🆕 Custom AI rules that override default behavior
  // 🆕 Translation Settings
  translateProductNames: boolean
  translateCategoryNames: boolean
  translateServiceNames: boolean
  catalogBaseLanguage: string
  // 🆕 Chatbot Personalization
  chatbotName: string
  businessType: string
}

// 🆕 Business Type Options
const BUSINESS_TYPES = [
  { value: "automotive", label: "🚗 Automobilistico", desc: "Auto, moto, componenti" },
  { value: "aerospace", label: "✈️ Aerospaziale", desc: "Industria aeronautica" },
  { value: "mechanical", label: "⚙️ Meccanico", desc: "Industria meccanica" },
  { value: "electronics", label: "🔌 Elettronica", desc: "Componenti elettronici" },
  { value: "chemical", label: "🧪 Chimico", desc: "Industria chimica" },
  { value: "metalwork", label: "🔩 Metalmeccanico", desc: "Lavorazione metalli" },
  { value: "construction", label: "🏗️ Edilizia", desc: "Costruzioni e immobiliare" },
  // Settore Sanitario
  { value: "healthcare", label: "🏥 Salute e Benessere", desc: "Medicina, fitness" },
  { value: "pharma", label: "💊 Farmaceutico", desc: "Farmaci e biotecnologie" },
  { value: "medical_devices", label: "🩺 Dispositivi Medici", desc: "Attrezzature sanitarie" },
  { value: "veterinary", label: "🐾 Veterinaria", desc: "Cura animali" },
  // Settore Moda
  { value: "fashion", label: "👕 Abbigliamento", desc: "Vestiti e moda" },
  { value: "footwear", label: "👟 Calzature", desc: "Scarpe e accessori" },
  { value: "accessories", label: "👜 Accessori", desc: "Borse, gioielli" },
  { value: "luxury", label: "💎 Lusso", desc: "Prodotti di lusso" },
  // Settore Alimentare
  { value: "food", label: "🍔 Alimentare", desc: "Cibo e bevande" },
  { value: "restaurant", label: "🍽️ Ristorazione", desc: "Ristoranti, bar" },
  { value: "agrifood", label: "🌾 Agroalimentare", desc: "Agricoltura e produzione" },
  { value: "catering", label: "🥂 Catering", desc: "Eventi e catering" },
  { value: "food_delivery", label: "🚴 Food Delivery", desc: "Consegne a domicilio" },
  // Settore Tecnologico
  { value: "software", label: "💻 Software", desc: "Sviluppo software" },
  { value: "hardware", label: "🖥️ Hardware", desc: "Computer e dispositivi" },
  { value: "ai", label: "🤖 Intelligenza Artificiale", desc: "AI e machine learning" },
  { value: "cybersecurity", label: "🔒 Cybersecurity", desc: "Sicurezza informatica" },
  { value: "ecommerce", label: "🛒 E-commerce", desc: "Vendita online" },
  { value: "gaming", label: "🎮 Gaming", desc: "Videogiochi" },
  // Settore Finanziario
  { value: "banking", label: "🏦 Banche", desc: "Servizi bancari" },
  { value: "insurance", label: "🛡️ Assicurazioni", desc: "Polizze e coperture" },
  { value: "fintech", label: "📱 Fintech", desc: "Tecnologia finanziaria" },
  { value: "investments", label: "📈 Investimenti", desc: "Trading e investimenti" },
  { value: "crypto", label: "₿ Criptovalute", desc: "Blockchain e crypto" },
  // Settore Commercio
  { value: "retail", label: "🏪 Retail", desc: "Negozi fisici" },
  { value: "wholesale", label: "📦 Ingrosso", desc: "Commercio all'ingrosso" },
  { value: "marketplace", label: "🏬 Marketplace", desc: "Piattaforme multi-vendor" },
  { value: "import_export", label: "🌍 Import/Export", desc: "Commercio internazionale" },
  // Trasporti e Logistica
  { value: "logistics", label: "🚚 Logistica", desc: "Magazzini e distribuzione" },
  { value: "transport", label: "🚛 Trasporti", desc: "Spedizioni e corrieri" },
  { value: "supply_chain", label: "📋 Supply Chain", desc: "Gestione catena fornitura" },
  // Educazione
  { value: "education", label: "🎓 Educazione", desc: "Scuole e università" },
  { value: "online_courses", label: "📚 Corsi Online", desc: "E-learning" },
  { value: "coaching", label: "🎯 Coaching", desc: "Formazione e coaching" },
  // Intrattenimento
  { value: "entertainment", label: "🎬 Intrattenimento", desc: "Cinema, TV, media" },
  { value: "music", label: "🎵 Musica", desc: "Industria musicale" },
  { value: "events", label: "🎉 Eventi", desc: "Organizzazione eventi" },
  { value: "social_media", label: "📲 Social Media", desc: "Piattaforme social" },
  // Ambiente ed Energia
  { value: "renewable_energy", label: "🌱 Energie Rinnovabili", desc: "Solare, eolico" },
  { value: "recycling", label: "♻️ Riciclo", desc: "Gestione rifiuti" },
  { value: "green_tech", label: "🌿 Green Tech", desc: "Tecnologie verdi" },
  // Altro
  { value: "other", label: "📦 Altro", desc: "Altro settore" },
]

const defaultWelcomeMessage =
  "Welcome! I'm SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?"

const defaultWipMessage = "Work in progress. Please contact us later."

/**
 * Extract English message from JSON object or return default
 * Messages from backend are objects like { en: "...", es: "...", it: "...", pt: "..." }
 */
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

// 🆕 Help Panel Component
interface HelpPanelProps {
  title: string
  description: string
  sections: Array<{
    title: string
    content: string
    icon?: string
  }>
}

function HelpPanel({ title, description, sections }: HelpPanelProps) {
  return (
    <div className="sticky top-6 space-y-4 min-h-[600px]">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-blue-900">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            {title}
          </CardTitle>
          <p className="text-sm text-blue-800 mt-1">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.map((section, idx) => (
            <div key={idx} className="pb-3 border-b border-blue-200 last:border-b-0 last:pb-0">
              <div className="flex items-start gap-2">
                <span className="text-lg mt-0.5">{section.icon || "•"}</span>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-blue-900">{section.title}</h4>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [formData, setFormData] = useState<WorkspaceData>({
    id: "",
    name: "",
    whatsappPhoneNumber: "",
    adminEmail: "",
    url: "http://localhost:3000",
    currency: "USD",
    channelStatus: true, // 🆕 Default: chatbot enabled
    welcomeMessage: defaultWelcomeMessage,
    wipMessage: defaultWipMessage,
    allowedExternalLinks: "", // 🆕 Security: allowed external domains
    // 🆕 Channel Configuration (Feature 199)
    sellsProductsAndServices: true,
    hasSalesAgents: false,
    hasHumanSupport: true,
    humanSupportInstructions: "",
    frustrationEscalationInstructions: "", // 🆕 Feature 203
    operatorContactMethod: "email",
    operatorWhatsappNumber: "",
    toneOfVoice: "friendly",
    botIdentityResponse: "",
    address: "",
    customAiRules: "",
    // 🆕 Translation Settings
    translateProductNames: false,
    translateCategoryNames: false,
    translateServiceNames: true,
    catalogBaseLanguage: "it",
    // 🆕 Chatbot Personalization
    chatbotName: "Assistente",
    businessType: "other",
  })
  const { workspace, loading, setCurrentWorkspace } = useWorkspace()
  const { isSuperAdmin } = useWorkspaceRole(workspace?.id)

  useEffect(() => {
    if (!workspace) return
    logger.info("📝 Populating form with workspace data:", workspace)

    setFormData({
      id: workspace.id,
      name: workspace.name || "",
      whatsappPhoneNumber: workspace.whatsappPhoneNumber || "",
      adminEmail: workspace.adminEmail || workspace.notificationEmail || "",
      url: workspace.url || "http://localhost:3000",
      currency: workspace.currency || "USD",
      channelStatus: workspace.channelStatus ?? true, // 🆕 Default to enabled if not set
      welcomeMessage: extractEnglishMessage(workspace.welcomeMessage, defaultWelcomeMessage),
      wipMessage: extractEnglishMessage(workspace.wipMessage, defaultWipMessage),
      allowedExternalLinks: (workspace.allowedExternalLinks || []).join(", "), // 🆕 Security: convert array to comma-separated
      // 🆕 Channel Configuration (Feature 199)
      sellsProductsAndServices: workspace.sellsProductsAndServices ?? true,
      hasSalesAgents: workspace.hasSalesAgents ?? false,
      hasHumanSupport: workspace.hasHumanSupport ?? true,
      humanSupportInstructions: workspace.humanSupportInstructions || "",
      frustrationEscalationInstructions: workspace.frustrationEscalationInstructions || "", // 🆕 Feature 203
      operatorContactMethod: workspace.operatorContactMethod || "email",
      operatorWhatsappNumber: workspace.operatorWhatsappNumber || "",
      toneOfVoice: workspace.toneOfVoice || "friendly",
      botIdentityResponse: workspace.botIdentityResponse || 
        "I'm your digital assistant. I can help you find products, answer questions, and manage your orders!",
      address: workspace.address || "",
      customAiRules: workspace.customAiRules || "",
      // 🆕 Translation Settings
      translateProductNames: workspace.translateProductNames ?? false,
      translateCategoryNames: workspace.translateCategoryNames ?? false,
      translateServiceNames: workspace.translateServiceNames ?? true,
      catalogBaseLanguage: workspace.catalogBaseLanguage || "it",
      // 🆕 Chatbot Personalization
      chatbotName: workspace.chatbotName || "Assistente",
      businessType: workspace.businessType || "other",
    })
  }, [workspace])

  const saveSettingsMutation = useMutation({
    mutationFn: async (updateData: any) =>
      updateWorkspace(formData.id, updateData),
    onSuccess: async (updatedWorkspace) => {
      logger.info("✅ Workspace updated successfully:", updatedWorkspace)
      // Update the workspace context with the new data
      if (updatedWorkspace) {
        setCurrentWorkspace(updatedWorkspace)
      }
      toast.success("Settings saved successfully")
    },
    onError: (error: any) => {
      logger.error("❌ Error saving settings:", error)
      if (error.response?.data?.details) {
        toast.error(
          `Validation failed: ${error.response.data.details.join(", ")}`
        )
      } else {
        toast.error("Failed to save settings")
      }
    },
  })

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => deleteWorkspace(formData.id),
    onSuccess: async () => {
      logger.info("✅ Workspace deleted successfully - performing full logout")
      
      // 🛡️ CRITICAL: Full logout after workspace delete (Andrea's request)
      try {
        await api.post("/auth/logout")
      } catch (logoutError) {
        logger.error("Error calling logout API:", logoutError)
      }
      
      // Clear ALL storage (security)
      logger.info("🧹 [DELETE WORKSPACE] Clearing ALL storage")
      storage.clearAppState()
      
      toast.success("Workspace deleted successfully. You have been logged out.")
      navigate("/auth/login")
    },
    onError: (error) => {
      logger.error("❌ Error deleting workspace:", error)
      toast.error("Failed to delete workspace")
    },
  })

  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}
    if (!formData.adminEmail.trim())
      newErrors.adminEmail = "Admin email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail))
      newErrors.adminEmail = "Please enter a valid email address"
    if (formData.whatsappPhoneNumber && formData.whatsappPhoneNumber.trim()) {
      const cleanPhone = formData.whatsappPhoneNumber.replace(/\s/g, "")
      if (!/^\+?\d{10,15}$/.test(cleanPhone))
        newErrors.whatsappPhoneNumber =
          "Phone must be in international format (+1234567890) with 10-15 digits"
    }
    if (!formData.name.trim()) newErrors.name = "Workspace name is required"
    else if (formData.name.length < 2 || formData.name.length > 100)
      newErrors.name = "Name must be between 2 and 100 characters"
    if (formData.url && formData.url.trim()) {
      try {
        new URL(formData.url)
      } catch {
        newErrors.url = "Please enter a valid URL (e.g., http://localhost:3000)"
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (saveSettingsMutation.isPending) return
    if (!validateForm()) {
      toast.error("Please fix validation errors before saving")
      return
    }
    const updateData = {
      id: formData.id,
      name: formData.name,
      whatsappPhoneNumber: formData.whatsappPhoneNumber,
      adminEmail: formData.adminEmail,
      url: formData.url || "http://localhost:3000",
      channelStatus: formData.channelStatus, // 🆕 Feature 126: Chatbot enabled/disabled
      welcomeMessage: formData.welcomeMessage,
      wipMessage: formData.wipMessage,
      allowedExternalLinks: formData.allowedExternalLinks
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0), // 🆕 Security: convert to array
      currency: formData.currency,
      // 🆕 Channel Configuration (Feature 199)
      sellsProductsAndServices: formData.sellsProductsAndServices,
      hasSalesAgents: formData.hasSalesAgents,
      hasHumanSupport: formData.hasHumanSupport,
      humanSupportInstructions: formData.humanSupportInstructions,
      frustrationEscalationInstructions: formData.frustrationEscalationInstructions, // 🆕 Feature 203
      operatorContactMethod: formData.operatorContactMethod,
      operatorWhatsappNumber: formData.operatorWhatsappNumber,
      toneOfVoice: formData.toneOfVoice,
      botIdentityResponse: formData.botIdentityResponse,
      address: formData.address,
      customAiRules: formData.customAiRules,
      // 🆕 Translation Settings
      translateProductNames: formData.translateProductNames,
      translateCategoryNames: formData.translateCategoryNames,
      translateServiceNames: formData.translateServiceNames,
      catalogBaseLanguage: formData.catalogBaseLanguage,
      // 🆕 Chatbot Personalization
      chatbotName: formData.chatbotName,
      businessType: formData.businessType,
    }

    saveSettingsMutation.mutate(updateData)
  }

  const handleDelete = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type DELETE to confirm")
      return
    }
    setShowDeleteDialog(false)
    setDeleteConfirmation("")
    deleteWorkspaceMutation.mutate()
  }

  if (loading)
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-medium">Loading settings...</h2>
      </div>
    )

  if (!workspace)
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-medium text-red-600">
          No workspace found. Please select a workspace.
        </h2>
        <Button
          onClick={() => navigate("/workspace-selection")}
          className="mt-4"
        >
          Go to Workspace Selection
        </Button>
      </div>
    )

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your channel configuration and preferences
          </p>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="basic">📱 Basic</TabsTrigger>
            <TabsTrigger value="personality">🤖 Personality</TabsTrigger>
            <TabsTrigger value="business">🏪 Business</TabsTrigger>
            <TabsTrigger value="support">👤 Support</TabsTrigger>
            <TabsTrigger value="custom-ai">⚙️ Custom AI</TabsTrigger>
            <TabsTrigger value="translation">🌍 Translation</TabsTrigger>
            <TabsTrigger value="security">🛡️ Security</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Form - 2/3 */}
              <div className="col-span-2 min-h-[600px]">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">📱</span> Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">
                          Channel Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleFieldChange("name", e.target.value)}
                          placeholder="My Business"
                          className={errors.name ? "border-red-500" : ""}
                        />
                        {errors.name && (
                          <p className="text-sm text-red-500">{errors.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminEmail">
                          Admin Email <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          value={formData.adminEmail}
                          onChange={(e) => handleFieldChange("adminEmail", e.target.value)}
                          placeholder="admin@example.com"
                          className={errors.adminEmail ? "border-red-500" : ""}
                        />
                        {errors.adminEmail && (
                          <p className="text-sm text-red-500">{errors.adminEmail}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsappPhoneNumber">WhatsApp Number</Label>
                      <Input
                        id="whatsappPhoneNumber"
                        value={formData.whatsappPhoneNumber}
                        onChange={(e) =>
                          handleFieldChange("whatsappPhoneNumber", e.target.value)
                        }
                        placeholder="+1234567890"
                        className={errors.whatsappPhoneNumber ? "border-red-500" : ""}
                      />
                      {errors.whatsappPhoneNumber && (
                        <p className="text-sm text-red-500">{errors.whatsappPhoneNumber}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="url">Website URL</Label>
                      <Input
                        id="url"
                        type="url"
                        value={formData.url}
                        onChange={(e) => handleFieldChange("url", e.target.value)}
                        placeholder="https://mybusiness.com"
                        className={errors.url ? "border-red-500" : ""}
                      />
                      {errors.url && <p className="text-sm text-red-500">{errors.url}</p>}
                      <p className="text-xs text-muted-foreground">
                        Used for short links and redirects
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => handleFieldChange("currency", value)}
                      >
                        <SelectTrigger id="currency">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Used for product, service, and order prices in this channel.
                      </p>
                    </div>

                    {/* 🆕 Address field */}
                    <div className="space-y-2">
                      <Label htmlFor="address">
                        Physical Address <span className="text-xs text-muted-foreground">(When asked "Where are you?")</span>
                      </Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleFieldChange("address", e.target.value)}
                        rows={2}
                        placeholder="Via Roma 123, 00100 Roma, Italy"
                      />
                    </div>

                    {/* Chatbot Active Toggle */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                      <div className="space-y-1">
                        <Label className="text-base">Chatbot Status</Label>
                        <p className="text-xs text-muted-foreground">
                          Enable or disable the chatbot for this channel
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${formData.channelStatus ? 'text-green-600' : 'text-gray-500'}`}>
                          {formData.channelStatus ? '🟢 Active' : '🔴 Disabled'}
                        </span>
                        <Switch
                          checked={formData.channelStatus}
                          onCheckedChange={(checked) =>
                            handleFieldChange("channelStatus", checked)
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Help Panel - 1/3 */}
              <div>
                <HelpPanel
                  title="📚 Basic Information"
                  description="Set up the core details of your channel"
                  sections={[
                    {
                      icon: "📝",
                      title: "Channel Name",
                      content: "The name of your business or store. This appears in messages and settings."
                    },
                    {
                      icon: "✉️",
                      title: "Admin Email",
                      content: "Your email address. We'll send important notifications and recovery codes here."
                    },
                    {
                      icon: "📱",
                      title: "WhatsApp Number",
                      content: "Your WhatsApp business number. Use international format like +1234567890"
                    },
                    {
                      icon: "🌐",
                      title: "Website URL",
                      content: "Your website address. Used for short links sent to customers."
                    },
                    {
                      icon: "📍",
                      title: "Address",
                      content: "Your physical location. When customers ask 'Where are you?' they'll get this."
                    },
                    {
                      icon: "⚡",
                      title: "Chatbot Status",
                      content: "Enable to let the AI assistant answer customer questions. Disable to show maintenance mode."
                    }
                  ]}
                />
              </div>
            </div>
          </TabsContent>

          {/* Bot Personality Tab */}
          <TabsContent value="personality" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Form - 2/3 */}
              <div className="col-span-2 min-h-[600px]">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">🤖</span> Bot Personality
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 🆕 Chatbot Name */}
                    <div className="space-y-2">
                      <Label htmlFor="chatbotName">
                        Nome del Chatbot <span className="text-xs text-muted-foreground">(Come si chiama il tuo assistente)</span>
                      </Label>
                      <Input
                        id="chatbotName"
                        value={formData.chatbotName}
                        onChange={(e) => handleFieldChange("chatbotName", e.target.value)}
                        placeholder="es. Sofia, Marco, Assistente..."
                        className="max-w-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Il chatbot si presenterà con questo nome ai clienti
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Tone of Voice</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { value: "friendly", label: "😊 Friendly", desc: "Warm & emojis" },
                          { value: "professional", label: "💼 Professional", desc: "Business-like" },
                          { value: "formal", label: "🎩 Formal", desc: "Traditional" },
                          { value: "casual", label: "✌️ Casual", desc: "Relaxed & fun" },
                        ].map((tone) => (
                          <button
                            key={tone.value}
                            type="button"
                            onClick={() => handleFieldChange("toneOfVoice", tone.value)}
                            className={`p-3 border rounded-lg text-left transition-all ${
                              formData.toneOfVoice === tone.value
                                ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                                : "hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className="font-medium text-sm">{tone.label}</div>
                            <div className="text-xs text-muted-foreground">{tone.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="botIdentityResponse">
                        Bot Identity <span className="text-xs text-muted-foreground">(When asked "Who are you?")</span>
                      </Label>
                      <Textarea
                        id="botIdentityResponse"
                        value={formData.botIdentityResponse}
                        onChange={(e) => handleFieldChange("botIdentityResponse", e.target.value)}
                        rows={2}
                        placeholder="I'm your digital assistant. I can help you find products and answer questions."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="welcomeMessage">Welcome Message</Label>
                        <Textarea
                          id="welcomeMessage"
                          value={formData.welcomeMessage}
                          onChange={(e) => handleFieldChange("welcomeMessage", e.target.value)}
                          rows={4}
                          placeholder="Welcome! How can I help you today?"
                        />
                        <p className="text-xs text-muted-foreground">
                          Token: [LINK_REGISTRATION]
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wipMessage">Maintenance Message</Label>
                        <Textarea
                          id="wipMessage"
                          value={formData.wipMessage}
                          onChange={(e) => handleFieldChange("wipMessage", e.target.value)}
                          rows={4}
                          placeholder="We're currently unavailable. Please try again later."
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ℹ️ Messages are automatically translated to the customer's language
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Help Panel - 1/3 */}
              <div>
                <HelpPanel
                  title="🤖 Bot Personality"
                  description="Give your bot a unique character and voice"
                  sections={[
                    {
                      icon: "💬",
                      title: "Tone of Voice",
                      content: "How should the bot communicate? Friendly is warm & helpful. Professional is business-focused. Formal is traditional. Casual is fun & relaxed."
                    },
                    {
                      icon: "🆔",
                      title: "Bot Identity",
                      content: "What does the bot say when customers ask 'Who are you?'. Make it personal and match your brand."
                    },
                    {
                      icon: "👋",
                      title: "Welcome Message",
                      content: "The first message when customers start a conversation. Be friendly and clear about what you can help with."
                    },
                    {
                      icon: "🔧",
                      title: "Maintenance Message",
                      content: "Shown when the chatbot is disabled (maintenance mode). Let customers know you'll be back soon."
                    }
                  ]}
                />
              </div>
            </div>
          </TabsContent>

          {/* Business Configuration Tab */}
          <TabsContent value="business" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Form - 2/3 */}
              <div className="col-span-2 min-h-[600px]">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">🏪</span> Business Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 🆕 Business Type Dropdown */}
                    <div className="space-y-2">
                      <Label htmlFor="businessType">
                        Settore di Business <span className="text-xs text-muted-foreground">(Aiuta il chatbot a contestualizzare le risposte)</span>
                      </Label>
                      <Select
                        value={formData.businessType}
                        onValueChange={(value) => handleFieldChange("businessType", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleziona il tuo settore" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {BUSINESS_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <span>{type.label}</span>
                                <span className="text-xs text-muted-foreground">- {type.desc}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Il settore scelto aiuterà l'AI a fornire risposte più pertinenti
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className={`flex items-center justify-between p-3 border rounded-lg transition-all ${formData.sellsProductsAndServices ? 'border-green-200 bg-green-50' : ''}`}>
                        <div>
                          <Label className="text-sm">Sells Products & Services</Label>
                          <p className="text-xs text-muted-foreground">Enables E-commerce menu</p>
                        </div>
                        <Switch
                          checked={formData.sellsProductsAndServices}
                          onCheckedChange={(checked) => handleFieldChange("sellsProductsAndServices", checked)}
                        />
                      </div>
                      {formData.sellsProductsAndServices && (
                        <div className={`flex items-center justify-between p-3 border rounded-lg transition-all ${formData.hasSalesAgents ? 'border-green-200 bg-green-50' : ''}`}>
                          <div>
                            <Label className="text-sm">Sales Team</Label>
                            <p className="text-xs text-muted-foreground">Agent assignment</p>
                          </div>
                          <Switch
                            checked={formData.hasSalesAgents}
                            onCheckedChange={(checked) => handleFieldChange("hasSalesAgents", checked)}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Help Panel - 1/3 */}
              <div>
                <HelpPanel
                  title="🏪 Business Config"
                  description="Choose what your channel sells"
                  sections={[
                    {
                      icon: "🏭",
                      title: "Settore di Business",
                      content: "Indica il settore della tua attività. L'AI utilizzerà questa informazione per fornire risposte più contestualizzate e pertinenti."
                    },
                    {
                      icon: "🛒",
                      title: "Products & Services",
                      content: "Enable if you sell products, services, or both. This shows your catalog to customers and lets them add items to their cart."
                    },
                    {
                      icon: "👥",
                      title: "Sales Team",
                      content: "Enable if you have team members assigned to customers. Each customer gets their own dedicated agent for personalized support."
                    }
                  ]}
                />
              </div>
            </div>
          </TabsContent>

          {/* Human Support Tab */}
          <TabsContent value="support" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Form - 2/3 */}
              <div className="col-span-2 space-y-6 min-h-[600px]">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👤</span> Human Support & Escalation
                      </div>
                      <Switch
                        checked={formData.hasHumanSupport}
                        onCheckedChange={(checked) => handleFieldChange("hasHumanSupport", checked)}
                      />
                    </CardTitle>
                  </CardHeader>
                  
                  {/* HUMAN SUPPORT = TRUE */}
                  {formData.hasHumanSupport && (
                    <CardContent className="space-y-6 pt-0">
                      {/* SECTION 1: Contact Method */}
                      {formData.hasSalesAgents ? (
                        <div>
                          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-4">
                            <p className="text-sm font-medium text-blue-800 mb-1">👨‍💼 Sales Team Mode</p>
                            <p className="text-xs text-blue-600">
                              Customer will be connected with their assigned sales agent.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4">
                            <p className="text-sm font-medium text-amber-800 mb-1">⚙️ Generic Support Mode</p>
                            <p className="text-xs text-amber-600">
                              Without Sales Team, you need to configure who will receive support requests.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>How do you want to be contacted?</Label>
                            <Select
                              value={formData.operatorContactMethod}
                              onValueChange={(value) => handleFieldChange("operatorContactMethod", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="email">📧 Email (uses Admin Email)</SelectItem>
                                <SelectItem value="whatsapp">📱 WhatsApp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {formData.operatorContactMethod === "whatsapp" && (
                            <div className="space-y-2 mt-4">
                              <Label htmlFor="operatorWhatsappNumber">Support WhatsApp Number</Label>
                              <Input
                                id="operatorWhatsappNumber"
                                value={formData.operatorWhatsappNumber}
                                onChange={(e) => handleFieldChange("operatorWhatsappNumber", e.target.value)}
                                placeholder="+39 333 1234567"
                              />
                              <p className="text-xs text-muted-foreground">
                                Number that will receive support request notifications for immediate intervention
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* DIVIDER */}
                      <div className="border-t pt-6" />

                      {/* SECTION 2: Escalation Triggers */}
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                          <span>🚨</span> Escalation Triggers
                        </h4>
                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg mb-4">
                          <p className="text-sm font-medium text-purple-800 mb-1">📋 When should the chatbot call an operator?</p>
                          <p className="text-xs text-purple-600">
                            Define the situations where the chatbot should automatically escalate to a human operator.
                            Leave empty to use default triggers (damaged products, missing delivery, explicit operator requests).
                            Be explicit that the AI must call <code className="font-mono">contactOperator</code> when these rules match.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="frustrationEscalationInstructions">Custom Escalation Rules</Label>
                          <Textarea
                            id="frustrationEscalationInstructions"
                            value={formData.frustrationEscalationInstructions}
                            onChange={(e) => {
                              if (e.target.value.length <= 5000) {
                                handleFieldChange("frustrationEscalationInstructions", e.target.value)
                              }
                            }}
                            rows={6}
                            placeholder={`Call operator when:
- Customer received wrong product
- Customer didn't receive their order
- Customer asks for a custom quote
- Customer mentions legal action
- Customer explicitly asks for human help
- Customer complains about quality issues`}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>
                              💡 Write in your catalog language (Italian). AI will understand and apply in any customer language.
                            </span>
                            <span className={formData.frustrationEscalationInstructions.length > 4500 ? "text-amber-600" : ""}>
                              {formData.frustrationEscalationInstructions.length}/5000
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* DIVIDER */}
                      <div className="border-t pt-6" />

                      {/* SECTION 3: Customer Message */}
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                          <span>💬</span> Message for Customer
                        </h4>
                        {formData.hasSalesAgents ? (
                          <>
                            <Label htmlFor="humanSupportInstructions">What customer sees when paused (with assigned agent)</Label>
                            <Textarea
                              id="humanSupportInstructions"
                              value={formData.humanSupportInstructions}
                              onChange={(e) => handleFieldChange("humanSupportInstructions", e.target.value)}
                              rows={6}
                              placeholder={`Hello {{nameUser}}, I'm sorry for the issue! 😔\nI understand your frustration.\n\nYour dedicated agent is:\n• {{agentName}}\n• 📞 {{agentPhone}}\n• ✉️ {{agentEmail}}\n\n⏸️ Chat is now paused.\nYour agent will contact you as soon as possible!`}
                              className="mt-2"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              💡 Variables: {"{{nameUser}}"}, {"{{agentName}}"}, {"{{agentPhone}}"}, {"{{agentEmail}}"} • AI will translate to customer's language
                            </p>
                          </>
                        ) : (
                          <>
                            <Label htmlFor="humanSupportInstructions">What customer sees when paused (generic support)</Label>
                            <Textarea
                              id="humanSupportInstructions"
                              value={formData.humanSupportInstructions}
                              onChange={(e) => handleFieldChange("humanSupportInstructions", e.target.value)}
                              rows={4}
                              placeholder="I understand you need assistance. Our team will contact you within 24 hours.\n\n⏸️ Chat is now paused."
                              className="mt-2"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              AI will translate to customer's language
                            </p>
                          </>
                        )}
                      </div>
                    </CardContent>
                  )}
                  
                  {/* HUMAN SUPPORT = FALSE */}
                  {!formData.hasHumanSupport && (
                    <CardContent className="space-y-4 pt-0">
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                        <p className="text-sm font-medium text-yellow-800 mb-1">⚠️ Human Support Disabled</p>
                        <p className="text-xs text-yellow-600">
                          No live support available. Customers will be redirected to email contact.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="humanSupportInstructions">Message to Show Customer</Label>
                        <Textarea
                          id="humanSupportInstructions"
                          value={formData.humanSupportInstructions || `Please send an email to {{adminEmail}} and we will write you back as soon as possible.`}
                          onChange={(e) => handleFieldChange("humanSupportInstructions", e.target.value)}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          💡 {"{{adminEmail}}"} will be replaced with your Admin Email • AI will translate to customer's language
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Help Panel - 1/3 */}
              <div>
                <HelpPanel
                  title="👤 Human Support"
                  description="Let customers reach a real person"
                  sections={[
                    {
                      icon: "🎯",
                      title: "Enable Human Support",
                      content: "Turn ON to let customers contact you for problems. When someone needs help, the chatbot pauses and calls a human operator."
                    },
                    {
                      icon: "👥",
                      title: "With Sales Team",
                      content: "If you have a Sales Team, each customer is connected to their assigned agent. The message tells them who their agent is."
                    },
                    {
                      icon: "⚙️",
                      title: "Without Sales Team",
                      content: "Choose how to be contacted - via Email (you get an alert at your email address) or WhatsApp (immediate notification)."
                    },
                    {
                      icon: "💬",
                      title: "Customer Message",
                      content: "What the chatbot tells the customer when pausing the chat. Use {{nameUser}} or {{agentName}} to personalize it."
                    },
                    {
                      icon: "🚨",
                      title: "Escalation Triggers",
                      content: "Tell the AI when to automatically call a human. Examples: wrong order received, payment issues, or customer anger. Keep default if unsure."
                    }
                  ]}
                />
              </div>
            </div>
          </TabsContent>

          {/* Custom AI Tab */}
          <TabsContent value="custom-ai" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Form - 2/3 */}
              <div className="col-span-2 min-h-[600px]">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">⚙️</span> Custom AI Rules
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Define custom rules that will override the default AI behavior for this channel.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <div>
                            <p className="font-medium text-amber-800">Priority Override</p>
                            <p className="text-sm text-amber-700 mt-1">
                              These rules have <strong>ABSOLUTE PRIORITY</strong> over all default AI instructions. 
                              The AI will follow these rules even if they contradict its standard behavior.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customAiRules">
                          Your Custom Rules
                        </Label>
                        <Textarea
                          id="customAiRules"
                          value={formData.customAiRules}
                          onChange={(e) => handleFieldChange("customAiRules", e.target.value)}
                          rows={12}
                          className="font-mono text-sm min-h-[300px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          💡 Use clear, specific instructions. The AI will interpret these rules literally.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Help Panel - 1/3 */}
              <div>
                <HelpPanel
                  title="⚙️ Custom AI Rules"
                  description="Control exactly how your AI behaves"
                  sections={[
                    {
                      icon: "🎯",
                      title: "What are Custom Rules?",
                      content: "These are instructions that tell the AI exactly what to do. They override all default behaviors."
                    },
                    {
                      icon: "📝",
                      title: "How to Write Rules",
                      content: "Use simple, clear language. Organize by topic with # headers. Example: 'Always mention our 10% first-purchase discount'"
                    },
                    {
                      icon: "⚡",
                      title: "Rules Always Apply",
                      content: "Your rules are more important than anything else. The AI follows them even if it normally wouldn't."
                    },
                    {
                      icon: "🚫",
                      title: "Common Use Cases",
                      content: "Restrict what the AI can say, enforce product recommendations, set pricing policies, require specific greetings, block competitor mentions."
                    }
                  ]}
                />
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Form - 2/3 */}
              <div className="col-span-2 min-h-[600px]">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">🛡️</span> Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="allowedExternalLinks">Allowed External Links</Label>
                      <Textarea
                        id="allowedExternalLinks"
                        value={formData.allowedExternalLinks}
                        onChange={(e) => handleFieldChange("allowedExternalLinks", e.target.value)}
                        rows={2}
                        placeholder="echatbot.ai, stripe.com, paypal.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated domains the AI can include in messages. Other links will be blocked.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Help Panel - 1/3 */}
              <div>
                <HelpPanel
                  title="🛡️ Security"
                  description="Control what links the AI can suggest"
                  sections={[
                    {
                      icon: "🔗",
                      title: "What Are Allowed Links?",
                      content: "These are websites the AI is allowed to mention to customers. All other links are blocked."
                    },
                    {
                      icon: "✅",
                      title: "Which Links to Add?",
                      content: "Add your website, payment providers (Stripe, PayPal), social media, support tools, and trusted partners."
                    },
                    {
                      icon: "❌",
                      title: "What Gets Blocked?",
                      content: "Any link not in this list is blocked. This prevents the AI from suggesting unwanted external sites."
                    },
                    {
                      icon: "📝",
                      title: "How to Format",
                      content: "Just list domain names separated by commas: stripe.com, paypal.com, yoursite.com"
                    }
                  ]}
                />
              </div>
            </div>
          </TabsContent>

          {/* Translation Tab */}
          <TabsContent value="translation" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Form - 2/3 */}
              <div className="col-span-2 min-h-[600px]">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">🌍</span> Translation Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                      Configure how the AI translates your catalog content when responding to customers in different languages.
                      By default, product and category names are preserved in the original language (e.g., "Pecorino Romano" stays "Pecorino Romano").
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="catalogBaseLanguage">Catalog Base Language</Label>
                      <Select 
                        value={formData.catalogBaseLanguage} 
                        onValueChange={(value) => handleFieldChange("catalogBaseLanguage", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="it">🇮🇹 Italian</SelectItem>
                          <SelectItem value="en">🇬🇧 English</SelectItem>
                          <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                          <SelectItem value="pt">🇵🇹 Portuguese</SelectItem>
                          <SelectItem value="fr">🇫🇷 French</SelectItem>
                          <SelectItem value="de">🇩🇪 German</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The language your product catalog is written in. The AI will preserve names in this language when appropriate.
                      </p>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="font-medium text-sm">Translation Rules</h4>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Label className="text-sm font-medium">Translate Product Names</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            When OFF, names like "Pecorino Romano" stay as-is. When ON, they get translated.
                          </p>
                        </div>
                        <Switch
                          checked={formData.translateProductNames}
                          onCheckedChange={(checked) => handleFieldChange("translateProductNames", checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Label className="text-sm font-medium">Translate Category Names</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            When OFF, category names remain in their original language.
                          </p>
                        </div>
                        <Switch
                          checked={formData.translateCategoryNames}
                          onCheckedChange={(checked) => handleFieldChange("translateCategoryNames", checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Label className="text-sm font-medium">Translate Service Names</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            When ON (default), service descriptions get translated to customer's language.
                          </p>
                        </div>
                        <Switch
                          checked={formData.translateServiceNames}
                          onCheckedChange={(checked) => handleFieldChange("translateServiceNames", checked)}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        💡 <strong>Tip:</strong> For authentic Italian food products, we recommend keeping product names untranslated 
                        to preserve their authenticity and comply with PDO/PGI regulations.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Help Panel - 1/3 */}
              <div>
                <HelpPanel
                  title="🌍 Translation"
                  description="Control what gets translated for other languages"
                  sections={[
                    {
                      icon: "🌐",
                      title: "Base Language",
                      content: "What language are your product names and descriptions written in? This is your 'source' language. The AI will preserve it when translating for other languages."
                    },
                    {
                      icon: "🏷️",
                      title: "Product Names",
                      content: "Keep OFF to preserve famous brand names (like 'Parmigiano Reggiano' stays Italian). Turn ON to translate."
                    },
                    {
                      icon: "📂",
                      title: "Category Names",
                      content: "Usually best kept OFF (e.g., 'Formaggi' stays as 'Formaggi', not translated to 'Cheeses')."
                    },
                    {
                      icon: "✨",
                      title: "Service Names",
                      content: "Usually kept ON so generic services (like 'Gift Wrapping') get translated to customer's language."
                    },
                    {
                      icon: "✅",
                      title: "Best Practice",
                      content: "For authentic Italian food: keep product names OFF, categories OFF, services ON."
                    }
                  ]}
                />
              </div>
            </div>
          </TabsContent>

        </Tabs>

        {/* Actions - Always visible */}
        <div className="flex justify-end items-center gap-3 pt-4 border-t">
          {isSuperAdmin && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteWorkspaceMutation.isPending || saveSettingsMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Channel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saveSettingsMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {saveSettingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Delete Workspace Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) setDeleteConfirmation("")
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">⚠️ Delete Workspace</DialogTitle>
              <DialogDescription className="space-y-3">
                <p>
                  This action will soft-delete your workspace. It can be recovered
                  within 90 days by contacting support.
                </p>
                <p className="font-medium text-destructive">
                  After 90 days, all data will be permanently deleted including:
                  products, customers, orders, and chat history.
                </p>
                <p className="mt-4">
                  To confirm, type <span className="font-mono font-bold">DELETE</span> below:
                </p>
              </DialogDescription>
            </DialogHeader>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="font-mono"
              autoComplete="off"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteConfirmation("")
                }}
                disabled={deleteWorkspaceMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteWorkspaceMutation.isPending || deleteConfirmation !== "DELETE"}
              >
                {deleteWorkspaceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Workspace"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  )
}
