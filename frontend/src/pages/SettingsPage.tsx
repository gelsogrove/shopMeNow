import { Button } from "@/components/ui/button"import { Button } from "@/components/ui/button"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import {import {

  Dialog,  Dialog,

  DialogContent,  DialogContent,

  DialogDescription,  DialogDescription,

  DialogFooter,  DialogFooter,

  DialogHeader,  DialogHeader,

  DialogTitle,  DialogTitle,

} from "@/components/ui/dialog"} from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"import { Label } from "@/components/ui/label"

import { Switch } from "@/components/ui/switch"import { Switch } from "@/components/ui/switch"

import { Textarea } from "@/components/ui/textarea"import { Textarea } from "@/components/ui/textarea"

import { useWorkspace } from "@/contexts/WorkspaceContext"import { useWorkspace } from "@/contexts/WorkspaceContext"

import { logger } from "@/lib/logger"import { logger } from "@/lib/logger"

import { toast } from "@/lib/toast"import { toast } from "@/lib/toast"

import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"

import { useMutation } from "@tanstack/react-query"import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Loader2, Save, Settings, Trash2 } from "lucide-react"import { Loader2, Save, Settings, Trash2 } from "lucide-react"

import { useEffect, useState } from "react"import { useEffect, useState } from "react"

import { useNavigate } from "react-router-dom"import { useNavigate } from "react-router-dom"



// Workspace data interface// Workspace data interface

interface WorkspaceData {interface WorkspaceData {

  id: string  id: string

  name: string  name: string

  whatsappPhoneNumber: string  whatsappPhoneNumber: string

  whatsappApiKey: string  whatsappApiKey: string

  adminEmail: string  adminEmail: string

  url: string  url: string

  isActive: boolean  isActive: boolean

  debugMode: boolean  debugMode: boolean

  welcomeMessages: {  welcomeMessages: {

    en: string    en: string

    it: string    it: string

    es: string    es: string

    pt: string    pt: string

  }  }

  wipMessages: {  wipMessages: {

    en: string    en: string

    it: string    it: string

    es: string    es: string

    pt: string    pt: string

  }  }

}}



// Default messagesexport default function SettingsPage() {

const defaultWelcomeMessages = {  const navigate = useNavigate()

  en: "Hello! Thank you for contacting us. How can we help you today?",  const queryClient = useQueryClient()

  it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",  const [isLoading, setIsLoading] = useState(false)

  es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",  const [errors, setErrors] = useState<{ [key: string]: string }>({})

}

  // Form data state

const defaultWipMessages = {  const [formData, setFormData] = useState<WorkspaceData>({

  en: "Work in progress. Please contact us later.",    id: "",

  it: "Lavori in corso. Contattaci più tardi.",    name: "",

  es: "Trabajos en curso. Por favor, contáctenos más tarde.",    whatsappPhoneNumber: "",

  pt: "Em manutenção. Por favor, contacte-nos mais tarde.",    whatsappApiKey: "",

}    adminEmail: "",

    url: "http://localhost:3000",

export default function SettingsPage() {    isActive: true,

  const navigate = useNavigate()    debugMode: true,

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)    welcomeMessages: {

  const [errors, setErrors] = useState<{ [key: string]: string }>({})      en: "Hello! Thank you for contacting us. How can we help you today?",

      it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",

  // Form data state      es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",

  const [formData, setFormData] = useState<WorkspaceData>({      pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",

    id: "",    },

    name: "",    wipMessages: {

    whatsappPhoneNumber: "",      en: "Work in progress. Please contact us later.",

    whatsappApiKey: "",      it: "Lavori in corso. Contattaci più tardi.",

    adminEmail: "",      es: "Trabajos en curso. Por favor, contáctenos más tarde.",

    url: "http://localhost:3000",      pt: "Em manutenção. Por favor, contacte-nos mais tarde.",

    isActive: true,    },

    debugMode: true,  })

    welcomeMessages: defaultWelcomeMessages,

    wipMessages: defaultWipMessages,  // Language selection for messages

  })  const [selectedWelcomeLang, setSelectedWelcomeLang] = useState("en")

  const [selectedWipLang, setSelectedWipLang] = useState("en")

  // Language selection for messages

  const [selectedWelcomeLang, setSelectedWelcomeLang] = useState("en")  // ✅ FIXED: Use WorkspaceContext to get workspaceId (single source of truth)

  const [selectedWipLang, setSelectedWipLang] = useState("en")  const { workspace: contextWorkspace, loading: contextLoading } =

    useWorkspace()

  // ✅ SINGLE SOURCE OF TRUTH: Use ONLY WorkspaceContext

  const { workspace, loading, refreshWorkspace } = useWorkspace()  // Then fetch full workspace details with all fields

  const [workspace, setWorkspace] = useState<any>(null)

  // ✅ SINGLE EFFECT: Populate form when workspace loads  const [isPageLoading, setIsPageLoading] = useState(true)

  useEffect(() => {  const [workspaceError, setWorkspaceError] = useState<any>(null)

    if (!workspace) return  const isError = !!workspaceError



    logger.info("📝 Populating form with workspace data:", workspace)  // Fetch full workspace data when contextWorkspace is available

  useEffect(() => {

    // Parse welcome messages    const fetchWorkspaceDetails = async () => {

    let welcomeMessages = defaultWelcomeMessages      if (!contextWorkspace?.id) {

    if (workspace.welcomeMessages) {        setIsPageLoading(false)

      try {        return

        welcomeMessages =      }

          typeof workspace.welcomeMessages === "string"

            ? JSON.parse(workspace.welcomeMessages)      try {

            : workspace.welcomeMessages        setIsPageLoading(true)

      } catch (e) {        const response = await fetch(`/api/workspaces/${contextWorkspace.id}`, {

        logger.error("Error parsing welcome messages:", e)          headers: {

      }            Authorization: `Bearer ${localStorage.getItem("token")}`,

    }            "X-Session-Id": sessionStorage.getItem("sessionId") || "",

          },

    // Parse WIP messages        })

    let wipMessages = defaultWipMessages

    if (workspace.wipMessages) {        if (!response.ok) {

      try {          throw new Error("Failed to fetch workspace details")

        wipMessages =        }

          typeof workspace.wipMessages === "string"

            ? JSON.parse(workspace.wipMessages)        const data = await response.json()

            : workspace.wipMessages        setWorkspace(data)

      } catch (e) {        setWorkspaceError(null)

        logger.error("Error parsing WIP messages:", e)      } catch (error) {

      }        logger.error("Error fetching workspace details:", error)

    }        setWorkspaceError(error)

      } finally {

    setFormData({        setIsPageLoading(false)

      id: workspace.id,      }

      name: workspace.name || "",    }

      whatsappPhoneNumber: workspace.whatsappPhoneNumber || "",

      whatsappApiKey: workspace.whatsappApiKey || "",    fetchWorkspaceDetails()

      adminEmail: workspace.adminEmail || "",  }, [contextWorkspace?.id])

      url: workspace.url || "http://localhost:3000",

      isActive: workspace.isActive ?? true,  // Popola il form quando i dati del workspace sono disponibili

      debugMode: workspace.debugMode ?? true,  useEffect(() => {

      welcomeMessages,    if (workspace) {

      wipMessages,      logger.info("Populating form with workspace data:", workspace)

    })

  }, [workspace])      // Default messages - definiti staticamente per evitare loop

      const defaultWelcomeMessages = {

  // ✅ MUTATION: Save settings with proper error handling        en: "Hello! Thank you for contacting us. How can we help you today?",

  const saveSettingsMutation = useMutation({        it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",

    mutationFn: async (updateData: any) => {        es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",

      return updateWorkspace(formData.id, updateData)        pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",

    },      }

    onSuccess: async (updatedWorkspace) => {

      logger.info("✅ Workspace updated successfully:", updatedWorkspace)      const defaultWipMessages = {

        en: "Work in progress. Please contact us later.",

      // ✅ Refresh WorkspaceContext (it will update localStorage automatically)        it: "Lavori in corso. Contattaci più tardi.",

      await refreshWorkspace()        es: "Trabajos en curso. Por favor, contáctenos más tarde.",

        pt: "Em manutenção. Por favor, contacte-nos mais tarde.",

      toast.success("Settings saved successfully")      }

    },

    onError: (error: any) => {      // Parse welcome messages

      logger.error("❌ Error saving settings:", error)      let welcomeMessages = defaultWelcomeMessages

      if (workspace.welcomeMessages) {

      // Show detailed error from backend validation        try {

      if (error.response?.data?.details) {          welcomeMessages =

        const details = error.response.data.details.join(", ")            typeof workspace.welcomeMessages === "string"

        toast.error(`Validation failed: ${details}`)              ? JSON.parse(workspace.welcomeMessages)

      } else {              : workspace.welcomeMessages

        toast.error("Failed to save settings")        } catch (e) {

      }          logger.error("Error parsing welcome messages:", e)

    },        }

  })      }



  // ✅ MUTATION: Delete workspace      // Parse WIP messages

  const deleteWorkspaceMutation = useMutation({      let wipMessages = defaultWipMessages

    mutationFn: async () => {      if (workspace.wipMessages) {

      return deleteWorkspace(formData.id)        try {

    },          wipMessages =

    onSuccess: () => {            typeof workspace.wipMessages === "string"

      logger.info("✅ Workspace deleted successfully")              ? JSON.parse(workspace.wipMessages)

      localStorage.removeItem("currentWorkspace")              : workspace.wipMessages

      toast.success("Workspace deleted successfully")        } catch (e) {

      navigate("/workspace-selection")          logger.error("Error parsing WIP messages:", e)

    },        }

    onError: (error) => {      }

      logger.error("❌ Error deleting workspace:", error)

      toast.error("Failed to delete workspace")      setFormData({

    },        id: workspace.id,

  })        name: workspace.name || "",

        whatsappPhoneNumber: workspace.whatsappPhoneNumber || "",

  // Handle form field changes        whatsappApiKey: workspace.whatsappApiKey || "",

  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {        adminEmail: workspace.adminEmail || "",

    setFormData((prev) => ({ ...prev, [field]: value }))        url: workspace.url || "http://localhost:3000",

        isActive: workspace.isActive ?? true,

    // Clear error for this field        debugMode: workspace.debugMode ?? true,

    if (errors[field]) {        welcomeMessages,

      setErrors((prev) => ({ ...prev, [field]: "" }))        wipMessages,

    }      })

  }    }

  }, [workspace])

  // Handle message changes

  const handleMessageChange = (  // Gestisci errori del workspace

    messageType: "welcomeMessages" | "wipMessages",  useEffect(() => {

    lang: string,    if (isError && workspaceError) {

    value: string      logger.error("Workspace loading error:", workspaceError)

  ) => {      toast.error("Failed to load workspace settings")

    setFormData((prev) => ({    }

      ...prev,  }, [isError, workspaceError])

      [messageType]: {

        ...prev[messageType],  // Mutation per salvare i settings

        [lang]: value,  const saveSettingsMutation = useMutation({

      },    mutationFn: async (updateData: any) => {

    }))      return updateWorkspace(formData.id, updateData)

  }    },

    onSuccess: (updatedWorkspace) => {

  // ✅ CLIENT-SIDE VALIDATION (before sending to backend)      logger.info("✅ Workspace updated:", updatedWorkspace)

  const validateForm = (): boolean => {

    const newErrors: { [key: string]: string } = {}      // ✅ Update localStorage (single source of truth)

      localStorage.setItem("currentWorkspace", JSON.stringify(updatedWorkspace))

    // Validate adminEmail

    if (!formData.adminEmail.trim()) {      // Update local state

      newErrors.adminEmail = "Admin email is required"      setWorkspace(updatedWorkspace)

    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {

      newErrors.adminEmail = "Please enter a valid email address"      toast.success("Settings saved successfully")

    }    },

    onError: (error) => {

    // Validate whatsappPhoneNumber (if provided)      logger.error("❌ Error saving settings:", error)

    if (formData.whatsappPhoneNumber && formData.whatsappPhoneNumber.trim()) {      toast.error("Failed to save settings")

      const cleanPhone = formData.whatsappPhoneNumber.replace(/\s/g, "")    },

      if (!/^\+?\d{10,15}$/.test(cleanPhone)) {  })

        newErrors.whatsappPhoneNumber =

          "Phone must be in international format (+1234567890) with 10-15 digits"  // Handle form field changes

      }  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {

    }    setFormData((prev) => ({ ...prev, [field]: value }))



    // Validate name    // Clear error for this field

    if (!formData.name.trim()) {    if (errors[field]) {

      newErrors.name = "Workspace name is required"      setErrors((prev) => ({ ...prev, [field]: "" }))

    } else if (formData.name.length < 2 || formData.name.length > 100) {    }

      newErrors.name = "Name must be between 2 and 100 characters"  }

    }

  // Handle message changes

    // Validate URL (if provided)  const handleMessageChange = (

    if (formData.url && formData.url.trim()) {    messageType: "welcomeMessages" | "wipMessages",

      try {    lang: string,

        new URL(formData.url)    value: string

      } catch {  ) => {

        newErrors.url = "Please enter a valid URL (e.g., http://localhost:3000)"    setFormData((prev) => ({

      }      ...prev,

    }      [messageType]: {

        ...prev[messageType],

    setErrors(newErrors)        [lang]: value,

    return Object.keys(newErrors).length === 0      },

  }    }))

  }

  // ✅ SAVE HANDLER: Validate + Send to backend

  const handleSave = async () => {  // Validate form data

    // Prevent multiple calls  const validateForm = (): boolean => {

    if (saveSettingsMutation.isPending) {    const newErrors: { [key: string]: string } = {}

      return

    }    if (!formData.adminEmail.trim()) {

      newErrors.adminEmail = "Admin email is required"

    // Client-side validation    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {

    if (!validateForm()) {      newErrors.adminEmail = "Please enter a valid email address"

      toast.error("Please fix validation errors before saving")    }

      return

    }    setErrors(newErrors)

    return Object.keys(newErrors).length === 0

    const updateData = {  }

      id: formData.id,

      name: formData.name,  // Save workspace settings

      whatsappPhoneNumber: formData.whatsappPhoneNumber,  const handleSave = async () => {

      whatsappApiKey: formData.whatsappApiKey,    // Prevenire chiamate multiple

      adminEmail: formData.adminEmail,    if (saveSettingsMutation.isPending) {

      url: formData.url || "http://localhost:3000",      return

      isActive: formData.isActive,    }

      debugMode: formData.debugMode,

      welcomeMessages: formData.welcomeMessages,    if (!validateForm()) {

      wipMessages: formData.wipMessages,      return

    }    }



    logger.info("💾 Saving workspace settings:", updateData)    const updateData = {

    saveSettingsMutation.mutate(updateData)      id: formData.id,

  }      name: formData.name,

      whatsappPhoneNumber: formData.whatsappPhoneNumber,

  // ✅ DELETE HANDLER      whatsappApiKey: formData.whatsappApiKey,

  const handleDelete = async () => {      adminEmail: formData.adminEmail,

    setShowDeleteDialog(false)      // currency rimosso - non serve più

    deleteWorkspaceMutation.mutate()      url: formData.url || "http://localhost:3000",

  }      isActive: formData.isActive,

      debugMode: formData.debugMode,

  // ✅ LOADING STATE: Show spinner while context loads      welcomeMessages: formData.welcomeMessages,

  if (loading) {      wipMessages: formData.wipMessages,

    return (    }

      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">

        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />    logger.info("💾 Saving workspace settings:", updateData)

        <h2 className="text-xl font-medium">Loading settings...</h2>    saveSettingsMutation.mutate(updateData)

      </div>  }

    )

  }  // Delete workspace

  const handleDelete = async () => {

  // ✅ NO WORKSPACE: Show error    setIsLoading(true)

  if (!workspace) {    try {

    return (      await deleteWorkspace(formData.id)

      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">      // ✅ Clear from localStorage (single source of truth)

        <h2 className="text-xl font-medium text-red-600">      localStorage.removeItem("currentWorkspace")

          No workspace found. Please select a workspace.      toast.success("Workspace deleted successfully")

        </h2>      navigate("/workspace-selection")

        <Button onClick={() => navigate("/workspace-selection")} className="mt-4">    } catch (error) {

          Go to Workspace Selection      logger.error("Error deleting workspace:", error)

        </Button>      toast.error("Failed to delete workspace")

      </div>    } finally {

    )      setIsLoading(false)

  }      setShowDeleteDialog(false)

    }

  return (  }

    <div className="container mx-auto py-6 px-4">

      <div className="flex items-center gap-2 mb-6">  if (isPageLoading) {

        <Settings className="h-6 w-6 text-green-600" />    return (

        <h1 className="text-xl font-bold text-green-600">Workspace Settings</h1>      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">

      </div>        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />

        <h2 className="text-xl font-medium">Loading settings...</h2>

      <Card>      </div>

        <CardHeader>    )

          <CardTitle className="flex items-center justify-between">  }

            <span>General Settings</span>

            <div className="flex items-center gap-4">  return (

              <div className="flex items-center gap-2">    <div className="container mx-auto py-6 px-4">

                <span className="text-sm text-muted-foreground">Active</span>      <div className="flex items-center gap-2 mb-6">

                <Switch        <Settings className="h-6 w-6 text-green-600" />

                  checked={formData.isActive}        <h1 className="text-xl font-bold text-green-600">Workspace Settings</h1>

                  onCheckedChange={(checked) =>      </div>

                    handleFieldChange("isActive", checked)

                  }      <Card>

                />        <CardHeader>

              </div>          <CardTitle className="flex items-center justify-between">

              <div className="flex items-center gap-2">            <span>General Settings</span>

                <span className="text-sm text-muted-foreground">            <div className="flex items-center gap-4">

                  Debug Mode              <div className="flex items-center gap-2">

                </span>                <span className="text-sm text-muted-foreground">Active</span>

                <Switch                <Switch

                  checked={formData.debugMode}                  checked={formData.isActive}

                  onCheckedChange={(checked) =>                  onCheckedChange={(checked) =>

                    handleFieldChange("debugMode", checked)                    handleFieldChange("isActive", checked)

                  }                  }

                />                />

              </div>              </div>

            </div>              <div className="flex items-center gap-2">

          </CardTitle>                <span className="text-sm text-muted-foreground">

        </CardHeader>                  Debug Mode

                </span>

        <CardContent className="space-y-6">                <Switch

          {/* Workspace Name */}                  checked={formData.debugMode}

          <div className="space-y-2">                  onCheckedChange={(checked) =>

            <Label htmlFor="name">                    handleFieldChange("debugMode", checked)

              Workspace Name <span className="text-red-500">*</span>                  }

            </Label>                />

            <Input              </div>

              id="name"            </div>

              value={formData.name}          </CardTitle>

              onChange={(e) => handleFieldChange("name", e.target.value)}        </CardHeader>

              placeholder="My Business"

              className={errors.name ? "border-red-500" : ""}        <CardContent className="space-y-6">

            />          {/* Workspace Name */}

            {errors.name && (          <div className="space-y-2">

              <p className="text-sm text-red-500">{errors.name}</p>            <Label htmlFor="name">Workspace Name</Label>

            )}            <Input

          </div>              id="name"

              value={formData.name}

          {/* WhatsApp Phone Number */}              onChange={(e) => handleFieldChange("name", e.target.value)}

          <div className="space-y-2">              placeholder="My Business"

            <Label htmlFor="whatsappPhoneNumber">WhatsApp Phone Number</Label>            />

            <Input          </div>

              id="whatsappPhoneNumber"

              value={formData.whatsappPhoneNumber}          {/* WhatsApp Phone Number */}

              onChange={(e) =>          <div className="space-y-2">

                handleFieldChange("whatsappPhoneNumber", e.target.value)            <Label htmlFor="whatsappPhoneNumber">WhatsApp Phone Number</Label>

              }            <Input

              placeholder="+1234567890"              id="whatsappPhoneNumber"

              className={errors.whatsappPhoneNumber ? "border-red-500" : ""}              value={formData.whatsappPhoneNumber}

            />              onChange={(e) =>

            {errors.whatsappPhoneNumber && (                handleFieldChange("whatsappPhoneNumber", e.target.value)

              <p className="text-sm text-red-500">              }

                {errors.whatsappPhoneNumber}              placeholder="+1234567890"

              </p>            />

            )}          </div>

            <p className="text-xs text-muted-foreground">

              International format with country code (e.g., +1234567890)          {/* WhatsApp API Key */}

            </p>          <div className="space-y-2">

          </div>            <Label htmlFor="whatsappApiKey">WhatsApp API Key</Label>

            <Input

          {/* WhatsApp API Key */}              id="whatsappApiKey"

          <div className="space-y-2">              type="password"

            <Label htmlFor="whatsappApiKey">WhatsApp API Key</Label>              value={formData.whatsappApiKey}

            <Input              onChange={(e) =>

              id="whatsappApiKey"                handleFieldChange("whatsappApiKey", e.target.value)

              type="password"              }

              value={formData.whatsappApiKey}              placeholder="Your WhatsApp API Key"

              onChange={(e) =>            />

                handleFieldChange("whatsappApiKey", e.target.value)          </div>

              }

              placeholder="Your WhatsApp API Key"          {/* Admin Email */}

            />          <div className="space-y-2">

          </div>            <Label htmlFor="adminEmail">

              Admin Email <span className="text-red-500">*</span>

          {/* Admin Email */}            </Label>

          <div className="space-y-2">            <Input

            <Label htmlFor="adminEmail">              id="adminEmail"

              Admin Email <span className="text-red-500">*</span>              type="email"

            </Label>              value={formData.adminEmail}

            <Input              onChange={(e) => handleFieldChange("adminEmail", e.target.value)}

              id="adminEmail"              placeholder="admin@example.com"

              type="email"              className={errors.adminEmail ? "border-red-500" : ""}

              value={formData.adminEmail}            />

              onChange={(e) => handleFieldChange("adminEmail", e.target.value)}            {errors.adminEmail && (

              placeholder="admin@example.com"              <p className="text-sm text-red-500">{errors.adminEmail}</p>

              className={errors.adminEmail ? "border-red-500" : ""}            )}

            />            <p className="text-xs text-muted-foreground">

            {errors.adminEmail && (              This email will receive notifications when users request operator

              <p className="text-sm text-red-500">{errors.adminEmail}</p>              assistance

            )}            </p>

            <p className="text-xs text-muted-foreground">          </div>

              This email will receive notifications when users request operator

              assistance          {/* Workspace URL */}

            </p>          <div className="space-y-2">

          </div>            <Label htmlFor="url">Workspace URL</Label>

            <Input

          {/* Workspace URL */}              id="url"

          <div className="space-y-2">              type="url"

            <Label htmlFor="url">Workspace URL</Label>              value={formData.url}

            <Input              onChange={(e) => handleFieldChange("url", e.target.value)}

              id="url"              placeholder="http://localhost:3000"

              type="url"            />

              value={formData.url}            <p className="text-xs text-muted-foreground">

              onChange={(e) => handleFieldChange("url", e.target.value)}              Base URL for generating short links and redirects (e.g.,

              placeholder="http://localhost:3000"              http://yourdomain.com)

              className={errors.url ? "border-red-500" : ""}            </p>

            />          </div>

            {errors.url && <p className="text-sm text-red-500">{errors.url}</p>}

            <p className="text-xs text-muted-foreground">          {/* Welcome Messages */}

              Base URL for generating short links and redirects (e.g.,          <div className="space-y-2">

              http://yourdomain.com)            <Label>Welcome Messages</Label>

            </p>            <div className="flex gap-2 mb-2">

          </div>              {["en", "it", "es", "pt"].map((lang) => (

                <Button

          {/* Welcome Messages */}                  key={lang}

          <div className="space-y-2">                  variant={selectedWelcomeLang === lang ? "default" : "outline"}

            <Label>Welcome Messages</Label>                  size="sm"

            <div className="flex gap-2 mb-2">                  onClick={() => setSelectedWelcomeLang(lang)}

              {["en", "it", "es", "pt"].map((lang) => (                >

                <Button                  {lang.toUpperCase()}

                  key={lang}                </Button>

                  variant={selectedWelcomeLang === lang ? "default" : "outline"}              ))}

                  size="sm"            </div>

                  onClick={() => setSelectedWelcomeLang(lang)}            <Textarea

                >              value={

                  {lang.toUpperCase()}                formData.welcomeMessages[

                </Button>                  selectedWelcomeLang as keyof typeof formData.welcomeMessages

              ))}                ]

            </div>              }

            <Textarea              onChange={(e) =>

              value={                handleMessageChange(

                formData.welcomeMessages[                  "welcomeMessages",

                  selectedWelcomeLang as keyof typeof formData.welcomeMessages                  selectedWelcomeLang,

                ]                  e.target.value

              }                )

              onChange={(e) =>              }

                handleMessageChange(              rows={3}

                  "welcomeMessages",              placeholder="Enter welcome message..."

                  selectedWelcomeLang,            />

                  e.target.value          </div>

                )

              }          {/* WIP Messages */}

              rows={3}          <div className="space-y-2">

              placeholder="Enter welcome message..."            <Label>Work in Progress Messages</Label>

            />            <div className="flex gap-2 mb-2">

          </div>              {["en", "it", "es", "pt"].map((lang) => (

                <Button

          {/* WIP Messages */}                  key={lang}

          <div className="space-y-2">                  variant={selectedWipLang === lang ? "default" : "outline"}

            <Label>Work in Progress Messages</Label>                  size="sm"

            <div className="flex gap-2 mb-2">                  onClick={() => setSelectedWipLang(lang)}

              {["en", "it", "es", "pt"].map((lang) => (                >

                <Button                  {lang.toUpperCase()}

                  key={lang}                </Button>

                  variant={selectedWipLang === lang ? "default" : "outline"}              ))}

                  size="sm"            </div>

                  onClick={() => setSelectedWipLang(lang)}            <Textarea

                >              value={

                  {lang.toUpperCase()}                formData.wipMessages[

                </Button>                  selectedWipLang as keyof typeof formData.wipMessages

              ))}                ]

            </div>              }

            <Textarea              onChange={(e) =>

              value={                handleMessageChange(

                formData.wipMessages[                  "wipMessages",

                  selectedWipLang as keyof typeof formData.wipMessages                  selectedWipLang,

                ]                  e.target.value

              }                )

              onChange={(e) =>              }

                handleMessageChange(              rows={3}

                  "wipMessages",              placeholder="Enter work in progress message..."

                  selectedWipLang,            />

                  e.target.value          </div>

                )

              }          {/* Action Buttons */}

              rows={3}          <div className="flex justify-end gap-2 pt-4 border-t">

              placeholder="Enter work in progress message..."            <Button

            />              variant="destructive"

          </div>              onClick={() => setShowDeleteDialog(true)}

              disabled={isLoading || saveSettingsMutation.isPending}

          {/* Action Buttons */}            >

          <div className="flex justify-end gap-2 pt-4 border-t">              <Trash2 className="h-4 w-4 mr-2" />

            <Button              Delete Workspace

              variant="destructive"            </Button>

              onClick={() => setShowDeleteDialog(true)}            <Button

              disabled={deleteWorkspaceMutation.isPending || saveSettingsMutation.isPending}              onClick={handleSave}

            >              disabled={saveSettingsMutation.isPending}

              <Trash2 className="h-4 w-4 mr-2" />            >

              Delete Workspace              {saveSettingsMutation.isPending ? (

            </Button>                <>

            <Button                  <Loader2 className="h-4 w-4 animate-spin mr-2" />

              onClick={handleSave}                  Saving...

              disabled={saveSettingsMutation.isPending}                </>

            >              ) : (

              {saveSettingsMutation.isPending ? (                <>

                <>                  <Save className="h-4 w-4 mr-2" />

                  <Loader2 className="h-4 w-4 animate-spin mr-2" />                  Save Changes

                  Saving...                </>

                </>              )}

              ) : (            </Button>

                <>          </div>

                  <Save className="h-4 w-4 mr-2" />        </CardContent>

                  Save Changes      </Card>

                </>

              )}      {/* Delete Confirmation Dialog */}

            </Button>      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>

          </div>        <DialogContent>

        </CardContent>          <DialogHeader>

      </Card>            <DialogTitle>Delete Workspace</DialogTitle>

            <DialogDescription>

      {/* Delete Confirmation Dialog */}              This action cannot be undone. This will permanently delete your

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>              workspace and all associated data including products, customers,

        <DialogContent>              orders, and chat history.

          <DialogHeader>            </DialogDescription>

            <DialogTitle>Delete Workspace</DialogTitle>          </DialogHeader>

            <DialogDescription>          <DialogFooter>

              This action cannot be undone. This will permanently delete your            <Button

              workspace and all associated data including products, customers,              variant="outline"

              orders, and chat history.              onClick={() => setShowDeleteDialog(false)}

            </DialogDescription>              disabled={isLoading}

          </DialogHeader>            >

          <DialogFooter>              Cancel

            <Button            </Button>

              variant="outline"            <Button

              onClick={() => setShowDeleteDialog(false)}              variant="destructive"

              disabled={deleteWorkspaceMutation.isPending}              onClick={handleDelete}

            >              disabled={isLoading}

              Cancel            >

            </Button>              {isLoading ? (

            <Button                <>

              variant="destructive"                  <Loader2 className="h-4 w-4 animate-spin mr-2" />

              onClick={handleDelete}                  Deleting...

              disabled={deleteWorkspaceMutation.isPending}                </>

            >              ) : (

              {deleteWorkspaceMutation.isPending ? (                "Delete Workspace"

                <>              )}

                  <Loader2 className="h-4 w-4 animate-spin mr-2" />            </Button>

                  Deleting...          </DialogFooter>

                </>        </DialogContent>

              ) : (      </Dialog>

                "Delete Workspace"    </div>

              )}  )

            </Button>}

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
