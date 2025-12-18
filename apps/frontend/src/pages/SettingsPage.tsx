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
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Save, Settings, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface WorkspaceData {
  id: string
  name: string
  whatsappPhoneNumber: string
  adminEmail: string
  url: string
  challengeStatus: boolean // 🆕 Feature 126: Chatbot enabled/disabled (true=enabled, false=WIP mode)
  welcomeMessage: string
  wipMessage: string
  allowedExternalLinks: string // 🆕 Security: comma-separated list of allowed domains
  // 🆕 Channel Configuration (Feature 199)
  sellsProductsAndServices: boolean
  hasSalesAgents: boolean
  hasSuppliers: boolean
  hasHumanSupport: boolean
  humanSupportInstructions: string
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
}

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
    challengeStatus: true, // 🆕 Default: chatbot enabled
    welcomeMessage: defaultWelcomeMessage,
    wipMessage: defaultWipMessage,
    allowedExternalLinks: "", // 🆕 Security: allowed external domains
    // 🆕 Channel Configuration (Feature 199)
    sellsProductsAndServices: true,
    hasSalesAgents: false,
    hasSuppliers: false,
    hasHumanSupport: true,
    humanSupportInstructions: "",
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
      challengeStatus: workspace.challengeStatus ?? true, // 🆕 Default to enabled if not set
      welcomeMessage: extractEnglishMessage(workspace.welcomeMessage, defaultWelcomeMessage),
      wipMessage: extractEnglishMessage(workspace.wipMessage, defaultWipMessage),
      allowedExternalLinks: (workspace.allowedExternalLinks || []).join(", "), // 🆕 Security: convert array to comma-separated
      // 🆕 Channel Configuration (Feature 199)
      sellsProductsAndServices: workspace.sellsProductsAndServices ?? true,
      hasSalesAgents: workspace.hasSalesAgents ?? false,
      hasSuppliers: workspace.hasSuppliers ?? false,
      hasHumanSupport: workspace.hasHumanSupport ?? true,
      humanSupportInstructions: workspace.humanSupportInstructions || "",
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
      localStorage.clear()
      sessionStorage.clear()
      
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
      challengeStatus: formData.challengeStatus, // 🆕 Feature 126: Chatbot enabled/disabled
      welcomeMessage: formData.welcomeMessage,
      wipMessage: formData.wipMessage,
      allowedExternalLinks: formData.allowedExternalLinks
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0), // 🆕 Security: convert to array
      // 🆕 Channel Configuration (Feature 199)
      sellsProductsAndServices: formData.sellsProductsAndServices,
      hasSalesAgents: formData.hasSalesAgents,
      hasSuppliers: formData.hasSuppliers,
      hasHumanSupport: formData.hasHumanSupport,
      humanSupportInstructions: formData.humanSupportInstructions,
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
                <span className={`text-sm font-medium ${formData.challengeStatus ? 'text-green-600' : 'text-gray-500'}`}>
                  {formData.challengeStatus ? '🟢 Active' : '🔴 Disabled'}
                </span>
                <Switch
                  checked={formData.challengeStatus}
                  onCheckedChange={(checked) =>
                    handleFieldChange("challengeStatus", checked)
                  }
                />
              </div>
            </div>
          </CardContent>
            </Card>
          </TabsContent>

          {/* Bot Personality Tab */}
          <TabsContent value="personality" className="space-y-6">
            <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-lg">🤖</span> Bot Personality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </TabsContent>

          {/* Business Configuration Tab */}
          <TabsContent value="business" className="space-y-6">
            <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-lg">🏪</span> Business Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              {formData.sellsProductsAndServices && (
                <div className={`flex items-center justify-between p-3 border rounded-lg transition-all ${formData.hasSuppliers ? 'border-green-200 bg-green-50' : ''}`}>
                  <div>
                    <Label className="text-sm">Suppliers</Label>
                    <p className="text-xs text-muted-foreground">Suppliers management</p>
                  </div>
                  <Switch
                    checked={formData.hasSuppliers}
                    onCheckedChange={(checked) => handleFieldChange("hasSuppliers", checked)}
                  />
                </div>
              )}
            </div>
          </CardContent>
            </Card>
          </TabsContent>

          {/* Human Support Tab */}
          <TabsContent value="support" className="space-y-6">
            <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span> Human Support
              </div>
              <Switch
                checked={formData.hasHumanSupport}
                onCheckedChange={(checked) => handleFieldChange("hasHumanSupport", checked)}
              />
            </CardTitle>
          </CardHeader>
          
          {/* HUMAN SUPPORT = TRUE */}
          {formData.hasHumanSupport && (
            <CardContent className="space-y-4 pt-0">
              {formData.hasSalesAgents ? (
                // Con Sales Team: il cliente ha già un agente assegnato
                <>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-1">👨‍💼 Sales Team Mode</p>
                    <p className="text-xs text-blue-600">
                      Customer will be connected with their assigned sales agent.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="humanSupportInstructions">Message for Customer</Label>
                    <Textarea
                      id="humanSupportInstructions"
                      value={formData.humanSupportInstructions}
                      onChange={(e) => handleFieldChange("humanSupportInstructions", e.target.value)}
                      rows={6}
                      placeholder={`Hello {{nameUser}}, I'm sorry for the issue! 😔\nI understand your frustration.\n\nYour dedicated agent is:\n• {{agentName}}\n• 📞 {{agentPhone}}\n• ✉️ {{agentEmail}}\n\n⏸️ Chat is now paused.\nYour agent will contact you as soon as possible!`}
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 Variables: {"{{nameUser}}"}, {"{{agentName}}"}, {"{{agentPhone}}"}, {"{{agentEmail}}"} • AI will translate to customer's language
                    </p>
                  </div>
                </>
              ) : (
                // Without Sales Team: need to know who to contact and how
                <>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
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
                    <div className="space-y-2">
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

                  <div className="space-y-2">
                    <Label htmlFor="humanSupportInstructions">Message for Customer</Label>
                    <Textarea
                      id="humanSupportInstructions"
                      value={formData.humanSupportInstructions}
                      onChange={(e) => handleFieldChange("humanSupportInstructions", e.target.value)}
                      rows={4}
                      placeholder="I understand you need assistance. Our team will contact you within 24 hours.\n\n⏸️ Chat is now paused."
                    />
                    <p className="text-xs text-muted-foreground">
                      AI will translate to customer's language
                    </p>
                  </div>
                </>
              )}
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
          </TabsContent>

          {/* Custom AI Tab */}
          <TabsContent value="custom-ai" className="space-y-6">
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
                      placeholder={`Write your custom rules here. Examples:

# Product Recommendations
- When customer asks about cheese, always recommend "Parmigiano Reggiano DOP" first
- Never suggest products from competitor brands

# Pricing Rules  
- Always mention the 10% discount for first-time buyers
- Never discuss prices lower than listed

# Communication Style
- Always greet customers with "Benvenuto da BellItalia!"
- End every conversation asking for feedback

# Restrictions
- Never share internal company information
- Don't discuss delivery times for international orders`}
                      className="font-mono text-sm min-h-[300px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 Use clear, specific instructions. The AI will interpret these rules literally.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
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
          </TabsContent>

          {/* Translation Tab */}
          <TabsContent value="translation" className="space-y-6">
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
