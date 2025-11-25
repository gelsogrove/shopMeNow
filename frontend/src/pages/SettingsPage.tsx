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
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Save, Settings, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface WorkspaceData {
  id: string
  name: string
  whatsappPhoneNumber: string
  whatsappApiKey: string
  adminEmail: string
  url: string
  challengeStatus: boolean // 🆕 Feature 126: Chatbot enabled/disabled (true=enabled, false=WIP mode)
  debugMode: boolean
  welcomeMessage: string
  wipMessage: string
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
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [formData, setFormData] = useState<WorkspaceData>({
    id: "",
    name: "",
    whatsappPhoneNumber: "",
    whatsappApiKey: "",
    adminEmail: "",
    url: "http://localhost:3000",
    challengeStatus: true, // 🆕 Default: chatbot enabled
    debugMode: true,
    welcomeMessage: defaultWelcomeMessage,
    wipMessage: defaultWipMessage,
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
      whatsappApiKey: workspace.whatsappApiKey || "",
      adminEmail: workspace.adminEmail || workspace.notificationEmail || "",
      url: workspace.url || "http://localhost:3000",
      challengeStatus: workspace.challengeStatus ?? true, // 🆕 Default to enabled if not set
      debugMode: workspace.debugMode ?? true,
      welcomeMessage: extractEnglishMessage(workspace.welcomeMessage, defaultWelcomeMessage),
      wipMessage: extractEnglishMessage(workspace.wipMessage, defaultWipMessage),
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
    onSuccess: () => {
      logger.info("✅ Workspace deleted successfully")
      localStorage.removeItem("currentWorkspace")
      toast.success("Workspace deleted successfully")
      navigate("/workspace-selection")
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
      whatsappApiKey: formData.whatsappApiKey,
      adminEmail: formData.adminEmail,
      url: formData.url || "http://localhost:3000",
      challengeStatus: formData.challengeStatus, // 🆕 Feature 126: Chatbot enabled/disabled
      debugMode: formData.debugMode,
      welcomeMessage: formData.welcomeMessage,
      wipMessage: formData.wipMessage,
    }

    // 🔍 LOG DETTAGLIATO per debug whatsappApiKey
    logger.info("=== FRONTEND SAVE DEBUG ===")
    logger.info("💾 Saving workspace settings:", updateData)
    logger.info(
      "whatsappApiKey presente:",
      updateData.whatsappApiKey ? "✅ SÌ" : "❌ NO"
    )
    if (updateData.whatsappApiKey) {
      logger.info("Lunghezza whatsappApiKey:", updateData.whatsappApiKey.length)
      logger.info(
        "Primi 10 caratteri:",
        updateData.whatsappApiKey.substring(0, 10) + "..."
      )
    }

    saveSettingsMutation.mutate(updateData)
  }

  const handleDelete = async () => {
    setShowDeleteDialog(false)
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
                <span className="text-sm text-muted-foreground">
                  Chatbot Enabled
                </span>
                <Switch
                  checked={formData.challengeStatus}
                  onCheckedChange={(checked) =>
                    handleFieldChange("challengeStatus", checked)
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
          <div className="space-y-2">
            <Label htmlFor="name">
              Workspace Name <span className="text-red-500">*</span>
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
            <Label htmlFor="whatsappPhoneNumber">WhatsApp Phone Number</Label>
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
              <p className="text-sm text-red-500">
                {errors.whatsappPhoneNumber}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              International format with country code (e.g., +1234567890)
            </p>
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="url">Workspace URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => handleFieldChange("url", e.target.value)}
              placeholder="http://localhost:3000"
              className={errors.url ? "border-red-500" : ""}
            />
            {errors.url && <p className="text-sm text-red-500">{errors.url}</p>}
            <p className="text-xs text-muted-foreground">
              Base URL for generating short links and redirects
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">
              Welcome Message{" "}
              <span className="text-xs text-muted-foreground">
                (English only)
              </span>
            </Label>
            <Textarea
              id="welcomeMessage"
              value={formData.welcomeMessage}
              onChange={(e) =>
                handleFieldChange("welcomeMessage", e.target.value)
              }
              rows={3}
              placeholder="Enter welcome message in English..."
            />
            <p className="text-xs text-muted-foreground">
              ℹ️ This message will be automatically translated to the customer's
              language by the AI Translation layer
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wipMessage">
              Work in Progress Message{" "}
              <span className="text-xs text-muted-foreground">
                (English only)
              </span>
            </Label>
            <Textarea
              id="wipMessage"
              value={formData.wipMessage}
              onChange={(e) => handleFieldChange("wipMessage", e.target.value)}
              rows={3}
              placeholder="Enter work in progress message in English..."
            />
            <p className="text-xs text-muted-foreground">
              ℹ️ This message will be automatically translated to the customer's
              language by the AI Translation layer
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            {/* Delete button - ONLY for SUPER_ADMIN (Owner) */}
            {isSuperAdmin && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={
                  deleteWorkspaceMutation.isPending ||
                  saveSettingsMutation.isPending
                }
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </Button>
            )}
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
              disabled={deleteWorkspaceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteWorkspaceMutation.isPending}
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
  )
}
