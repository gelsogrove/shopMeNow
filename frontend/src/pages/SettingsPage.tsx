import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import {
  deleteWorkspace,
  getCurrentWorkspace,
  updateWorkspace,
} from "@/services/workspaceApi"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Save, Settings, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

// Workspace data interface
interface WorkspaceData {
  id: string
  name: string
  whatsappPhoneNumber: string
  whatsappApiKey: string
  adminEmail: string
  url: string
  isActive: boolean
  debugMode: boolean
  welcomeMessages: {
    en: string
    it: string
    es: string
    pt: string
  }
  wipMessages: {
    en: string
    it: string
    es: string
    pt: string
  }
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Form data state
  const [formData, setFormData] = useState<WorkspaceData>({
    id: "",
    name: "",
    whatsappPhoneNumber: "",
    whatsappApiKey: "",
    adminEmail: "",
    url: "http://localhost:3000",
    isActive: true,
    debugMode: true,
    welcomeMessages: {
      en: "Hello! Thank you for contacting us. How can we help you today?",
      it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",
      es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",
      pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",
    },
    wipMessages: {
      en: "Work in progress. Please contact us later.",
      it: "Lavori in corso. Contattaci più tardi.",
      es: "Trabajos en curso. Por favor, contáctenos más tarde.",
      pt: "Em manutenção. Por favor, contacte-nos mais tarde.",
    },
  })

  // Language selection for messages
  const [selectedWelcomeLang, setSelectedWelcomeLang] = useState("en")
  const [selectedWipLang, setSelectedWipLang] = useState("en")

  // Use React Query per gestire il workspace loading
  const {
    data: workspace,
    isLoading: isPageLoading,
    error: workspaceError,
    isError,
  } = useQuery({
    queryKey: ["currentWorkspace"],
    queryFn: getCurrentWorkspace,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minuti
  })

  // Popola il form quando i dati del workspace sono disponibili
  useEffect(() => {
    if (workspace) {
      logger.info("Populating form with workspace data:", workspace)

      // Default messages - definiti staticamente per evitare loop
      const defaultWelcomeMessages = {
        en: "Hello! Thank you for contacting us. How can we help you today?",
        it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",
        es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",
        pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",
      }

      const defaultWipMessages = {
        en: "Work in progress. Please contact us later.",
        it: "Lavori in corso. Contattaci più tardi.",
        es: "Trabajos en curso. Por favor, contáctenos más tarde.",
        pt: "Em manutenção. Por favor, contacte-nos mais tarde.",
      }

      // Parse welcome messages
      let welcomeMessages = defaultWelcomeMessages
      if (workspace.welcomeMessages) {
        try {
          welcomeMessages =
            typeof workspace.welcomeMessages === "string"
              ? JSON.parse(workspace.welcomeMessages)
              : workspace.welcomeMessages
        } catch (e) {
          logger.error("Error parsing welcome messages:", e)
        }
      }

      // Parse WIP messages
      let wipMessages = defaultWipMessages
      if (workspace.wipMessages) {
        try {
          wipMessages =
            typeof workspace.wipMessages === "string"
              ? JSON.parse(workspace.wipMessages)
              : workspace.wipMessages
        } catch (e) {
          logger.error("Error parsing WIP messages:", e)
        }
      }

      setFormData({
        id: workspace.id,
        name: workspace.name || "",
        whatsappPhoneNumber: workspace.whatsappPhoneNumber || "",
        whatsappApiKey: workspace.whatsappApiKey || "",
        adminEmail: workspace.adminEmail || "",
        url: workspace.url || "http://localhost:3000",
        isActive: workspace.isActive ?? true,
        debugMode: workspace.debugMode ?? true,
        welcomeMessages,
        wipMessages,
      })
    }
  }, [workspace])

  // Gestisci errori del workspace
  useEffect(() => {
    if (isError && workspaceError) {
      logger.error("Workspace loading error:", workspaceError)
      toast.error("Failed to load workspace settings")
    }
  }, [isError, workspaceError])

  // Mutation per salvare i settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (updateData: any) => {
      return updateWorkspace(formData.id, updateData)
    },
    onSuccess: (updatedWorkspace) => {
      logger.info("Workspace updated:", updatedWorkspace)

      // Update cached workspace data
      sessionStorage.setItem(
        "currentWorkspace",
        JSON.stringify(updatedWorkspace)
      )

      // Invalida e aggiorna la cache di React Query
      queryClient.setQueryData(["currentWorkspace"], updatedWorkspace)

      // Refetch fresh data from server to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["currentWorkspace"] })

      toast.success("Settings saved successfully")
    },
    onError: (error) => {
      logger.error("Error saving settings:", error)
      toast.error("Failed to save settings")
    },
  })

  // Handle form field changes
  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  // Handle message changes
  const handleMessageChange = (
    messageType: "welcomeMessages" | "wipMessages",
    lang: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [messageType]: {
        ...prev[messageType],
        [lang]: value,
      },
    }))
  }

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = "Admin email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
      newErrors.adminEmail = "Please enter a valid email address"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save workspace settings
  const handleSave = async () => {
    // Prevenire chiamate multiple
    if (saveSettingsMutation.isPending) {
      return
    }

    if (!validateForm()) {
      return
    }

    const updateData = {
      id: formData.id,
      name: formData.name,
      whatsappPhoneNumber: formData.whatsappPhoneNumber,
      whatsappApiKey: formData.whatsappApiKey,
      adminEmail: formData.adminEmail,
      // currency rimosso - non serve più
      url: formData.url || "http://localhost:3000",
      isActive: formData.isActive,
      debugMode: formData.debugMode,
      welcomeMessages: formData.welcomeMessages,
      wipMessages: formData.wipMessages,
    }

    logger.info("💾 Saving workspace settings:", updateData)
    saveSettingsMutation.mutate(updateData)
  }

  // Delete workspace
  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteWorkspace(formData.id)
      sessionStorage.removeItem("currentWorkspace")
      queryClient.removeQueries({ queryKey: ["currentWorkspace"] })
      toast.success("Workspace deleted successfully")
      navigate("/workspace-selection")
    } catch (error) {
      logger.error("Error deleting workspace:", error)
      toast.error("Failed to delete workspace")
    } finally {
      setIsLoading(false)
      setShowDeleteDialog(false)
    }
  }

  if (isPageLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-medium">Loading settings...</h2>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6 text-green-600" />
        <h1 className="text-xl font-bold text-green-600">Workspace Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>General Settings</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Active</span>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    handleFieldChange("isActive", checked)
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Debug Mode
                </span>
                <Switch
                  checked={formData.debugMode}
                  onCheckedChange={(checked) =>
                    handleFieldChange("debugMode", checked)
                  }
                />
              </div>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="My Business"
            />
          </div>

          {/* WhatsApp Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="whatsappPhoneNumber">WhatsApp Phone Number</Label>
            <Input
              id="whatsappPhoneNumber"
              value={formData.whatsappPhoneNumber}
              onChange={(e) =>
                handleFieldChange("whatsappPhoneNumber", e.target.value)
              }
              placeholder="+1234567890"
            />
          </div>

          {/* WhatsApp API Key */}
          <div className="space-y-2">
            <Label htmlFor="whatsappApiKey">WhatsApp API Key</Label>
            <Input
              id="whatsappApiKey"
              type="password"
              value={formData.whatsappApiKey}
              onChange={(e) =>
                handleFieldChange("whatsappApiKey", e.target.value)
              }
              placeholder="Your WhatsApp API Key"
            />
          </div>

          {/* Admin Email */}
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
            <p className="text-xs text-muted-foreground">
              This email will receive notifications when users request operator
              assistance
            </p>
          </div>

          {/* Workspace URL */}
          <div className="space-y-2">
            <Label htmlFor="url">Workspace URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => handleFieldChange("url", e.target.value)}
              placeholder="http://localhost:3000"
            />
            <p className="text-xs text-muted-foreground">
              Base URL for generating short links and redirects (e.g.,
              http://yourdomain.com)
            </p>
          </div>

          {/* Welcome Messages */}
          <div className="space-y-2">
            <Label>Welcome Messages</Label>
            <div className="flex gap-2 mb-2">
              {["en", "it", "es", "pt"].map((lang) => (
                <Button
                  key={lang}
                  variant={selectedWelcomeLang === lang ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedWelcomeLang(lang)}
                >
                  {lang.toUpperCase()}
                </Button>
              ))}
            </div>
            <Textarea
              value={
                formData.welcomeMessages[
                  selectedWelcomeLang as keyof typeof formData.welcomeMessages
                ]
              }
              onChange={(e) =>
                handleMessageChange(
                  "welcomeMessages",
                  selectedWelcomeLang,
                  e.target.value
                )
              }
              rows={3}
              placeholder="Enter welcome message..."
            />
          </div>

          {/* WIP Messages */}
          <div className="space-y-2">
            <Label>Work in Progress Messages</Label>
            <div className="flex gap-2 mb-2">
              {["en", "it", "es", "pt"].map((lang) => (
                <Button
                  key={lang}
                  variant={selectedWipLang === lang ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedWipLang(lang)}
                >
                  {lang.toUpperCase()}
                </Button>
              ))}
            </div>
            <Textarea
              value={
                formData.wipMessages[
                  selectedWipLang as keyof typeof formData.wipMessages
                ]
              }
              onChange={(e) =>
                handleMessageChange(
                  "wipMessages",
                  selectedWipLang,
                  e.target.value
                )
              }
              rows={3}
              placeholder="Enter work in progress message..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isLoading || saveSettingsMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Workspace
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveSettingsMutation.isPending}
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
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your
              workspace and all associated data including products, customers,
              orders, and chat history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? (
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
  )
}
