import { Button } from "@/components/ui/button"import { Button } from "@/components/ui/button"import { Button } from "@/components/ui/button"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import {import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

  Dialog,

  DialogContent,import {import {

  DialogDescription,

  DialogFooter,  Dialog,  Dialog,

  DialogHeader,

  DialogTitle,  DialogContent,  DialogContent,

} from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"  DialogDescription,  DialogDescription,

import { Label } from "@/components/ui/label"

import { Switch } from "@/components/ui/switch"  DialogFooter,  DialogFooter,

import { Textarea } from "@/components/ui/textarea"

import { useWorkspace } from "@/contexts/WorkspaceContext"  DialogHeader,  DialogHeader,

import { logger } from "@/lib/logger"

import { toast } from "@/lib/toast"  DialogTitle,  DialogTitle,

import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"

import { useMutation } from "@tanstack/react-query"} from "@/components/ui/dialog"} from "@/components/ui/dialog"

import { Loader2, Save, Settings, Trash2 } from "lucide-react"

import { useEffect, useState } from "react"import { Input } from "@/components/ui/input"import { Input } from "@/components/ui/input"

import { useNavigate } from "react-router-dom"

import { Label } from "@/components/ui/label"import { Label } from "@/components/ui/label"

// Workspace data interface

interface WorkspaceData {import { Switch } from "@/components/ui/switch"import { Switch } from "@/components/ui/switch"

  id: string

  name: stringimport { Textarea } from "@/components/ui/textarea"import { Textarea } from "@/components/ui/textarea"

  whatsappPhoneNumber: string

  whatsappApiKey: stringimport { useWorkspace } from "@/contexts/WorkspaceContext"import { useWorkspace } from "@/contexts/WorkspaceContext"

  adminEmail: string

  url: stringimport { logger } from "@/lib/logger"import { logger } from "@/lib/logger"

  isActive: boolean

  debugMode: booleanimport { toast } from "@/lib/toast"import { toast } from "@/lib/toast"

  welcomeMessages: {

    en: stringimport { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"import { deleteWorkspace, updateWorkspace } from "@/services/workspaceApi"

    it: string

    es: stringimport { useMutation } from "@tanstack/react-query"import { useMutation, useQueryClient } from "@tanstack/react-query"

    pt: string

  }import { Loader2, Save, Settings, Trash2 } from "lucide-react"import { Loader2, Save, Settings, Trash2 } from "lucide-react"

  wipMessages: {

    en: stringimport { useEffect, useState } from "react"import { useEffect, useState } from "react"

    it: string

    es: stringimport { useNavigate } from "react-router-dom"import { useNavigate } from "react-router-dom"

    pt: string

  }

}

// Workspace data interface// Workspace data interface

// Default messages

const defaultWelcomeMessages = {interface WorkspaceData {interface WorkspaceData {

  en: "Hello! Thank you for contacting us. How can we help you today?",

  it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",  id: string  id: string

  es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",

  pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",  name: string  name: string

}

  whatsappPhoneNumber: string  whatsappPhoneNumber: string

const defaultWipMessages = {

  en: "Work in progress. Please contact us later.",  whatsappApiKey: string  whatsappApiKey: string

  it: "Lavori in corso. Contattaci più tardi.",

  es: "Trabajos en curso. Por favor, contáctenos más tarde.",  adminEmail: string  adminEmail: string

  pt: "Em manutenção. Por favor, contacte-nos mais tarde.",

}  url: string  url: string



export default function SettingsPage() {  isActive: boolean  isActive: boolean

  const navigate = useNavigate()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)  debugMode: boolean  debugMode: boolean

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  welcomeMessages: {  welcomeMessages: {

  // Form data state

  const [formData, setFormData] = useState<WorkspaceData>({    en: string    en: string

    id: "",

    name: "",    it: string    it: string

    whatsappPhoneNumber: "",

    whatsappApiKey: "",    es: string    es: string

    adminEmail: "",

    url: "http://localhost:3000",    pt: string    pt: string

    isActive: true,

    debugMode: true,  }  }

    welcomeMessages: defaultWelcomeMessages,

    wipMessages: defaultWipMessages,  wipMessages: {  wipMessages: {

  })

    en: string    en: string

  // Language selection for messages

  const [selectedWelcomeLang, setSelectedWelcomeLang] = useState("en")    it: string    it: string

  const [selectedWipLang, setSelectedWipLang] = useState("en")

    es: string    es: string

  // ✅ SINGLE SOURCE OF TRUTH: Use ONLY WorkspaceContext

  const { workspace, loading, refreshWorkspace } = useWorkspace()    pt: string    pt: string



  // ✅ SINGLE EFFECT: Populate form when workspace loads  }  }

  useEffect(() => {

    if (!workspace) return}}



    logger.info("📝 Populating form with workspace data:", workspace)



    // Parse welcome messages// Default messagesexport default function SettingsPage() {

    let welcomeMessages = defaultWelcomeMessages

    if (workspace.welcomeMessages) {const defaultWelcomeMessages = {  const navigate = useNavigate()

      try {

        welcomeMessages =  en: "Hello! Thank you for contacting us. How can we help you today?",  const queryClient = useQueryClient()

          typeof workspace.welcomeMessages === "string"

            ? JSON.parse(workspace.welcomeMessages)  it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",  const [isLoading, setIsLoading] = useState(false)

            : workspace.welcomeMessages

      } catch (e) {  es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

        logger.error("Error parsing welcome messages:", e)

      }  pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",  const [errors, setErrors] = useState<{ [key: string]: string }>({})

    }

}

    // Parse WIP messages

    let wipMessages = defaultWipMessages  // Form data state

    if (workspace.wipMessages) {

      try {const defaultWipMessages = {  const [formData, setFormData] = useState<WorkspaceData>({

        wipMessages =

          typeof workspace.wipMessages === "string"  en: "Work in progress. Please contact us later.",    id: "",

            ? JSON.parse(workspace.wipMessages)

            : workspace.wipMessages  it: "Lavori in corso. Contattaci più tardi.",    name: "",

      } catch (e) {

        logger.error("Error parsing WIP messages:", e)  es: "Trabajos en curso. Por favor, contáctenos más tarde.",    whatsappPhoneNumber: "",

      }

    }  pt: "Em manutenção. Por favor, contacte-nos mais tarde.",    whatsappApiKey: "",



    setFormData({}    adminEmail: "",

      id: workspace.id,

      name: workspace.name || "",    url: "http://localhost:3000",

      whatsappPhoneNumber: workspace.whatsappPhoneNumber || "",

      whatsappApiKey: workspace.whatsappApiKey || "",export default function SettingsPage() {    isActive: true,

      adminEmail: workspace.adminEmail || "",

      url: workspace.url || "http://localhost:3000",  const navigate = useNavigate()    debugMode: true,

      isActive: workspace.isActive ?? true,

      debugMode: workspace.debugMode ?? true,  const [showDeleteDialog, setShowDeleteDialog] = useState(false)    welcomeMessages: {

      welcomeMessages,

      wipMessages,  const [errors, setErrors] = useState<{ [key: string]: string }>({})      en: "Hello! Thank you for contacting us. How can we help you today?",

    })

  }, [workspace])      it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",



  // ✅ MUTATION: Save settings with proper error handling  // Form data state      es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",

  const saveSettingsMutation = useMutation({

    mutationFn: async (updateData: any) => {  const [formData, setFormData] = useState<WorkspaceData>({      pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",

      return updateWorkspace(formData.id, updateData)

    },    id: "",    },

    onSuccess: async (updatedWorkspace) => {

      logger.info("✅ Workspace updated successfully:", updatedWorkspace)    name: "",    wipMessages: {



      // ✅ Refresh WorkspaceContext (it will update localStorage automatically)    whatsappPhoneNumber: "",      en: "Work in progress. Please contact us later.",

      await refreshWorkspace()

    whatsappApiKey: "",      it: "Lavori in corso. Contattaci più tardi.",

      toast.success("Settings saved successfully")

    },    adminEmail: "",      es: "Trabajos en curso. Por favor, contáctenos más tarde.",

    onError: (error: any) => {

      logger.error("❌ Error saving settings:", error)    url: "http://localhost:3000",      pt: "Em manutenção. Por favor, contacte-nos mais tarde.",



      // Show detailed error from backend validation    isActive: true,    },

      if (error.response?.data?.details) {

        const details = error.response.data.details.join(", ")    debugMode: true,  })

        toast.error(`Validation failed: ${details}`)

      } else {    welcomeMessages: defaultWelcomeMessages,

        toast.error("Failed to save settings")

      }    wipMessages: defaultWipMessages,  // Language selection for messages

    },

  })  })  const [selectedWelcomeLang, setSelectedWelcomeLang] = useState("en")



  // ✅ MUTATION: Delete workspace  const [selectedWipLang, setSelectedWipLang] = useState("en")

  const deleteWorkspaceMutation = useMutation({

    mutationFn: async () => {  // Language selection for messages

      return deleteWorkspace(formData.id)

    },  const [selectedWelcomeLang, setSelectedWelcomeLang] = useState("en")  // ✅ FIXED: Use WorkspaceContext to get workspaceId (single source of truth)

    onSuccess: () => {

      logger.info("✅ Workspace deleted successfully")  const [selectedWipLang, setSelectedWipLang] = useState("en")  const { workspace: contextWorkspace, loading: contextLoading } =

      localStorage.removeItem("currentWorkspace")

      toast.success("Workspace deleted successfully")    useWorkspace()

      navigate("/workspace-selection")

    },  // ✅ SINGLE SOURCE OF TRUTH: Use ONLY WorkspaceContext

    onError: (error) => {

      logger.error("❌ Error deleting workspace:", error)  const { workspace, loading, refreshWorkspace } = useWorkspace()  // Then fetch full workspace details with all fields

      toast.error("Failed to delete workspace")

    },  const [workspace, setWorkspace] = useState<any>(null)

  })

  // ✅ SINGLE EFFECT: Populate form when workspace loads  const [isPageLoading, setIsPageLoading] = useState(true)

  // Handle form field changes

  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {  useEffect(() => {  const [workspaceError, setWorkspaceError] = useState<any>(null)

    setFormData((prev) => ({ ...prev, [field]: value }))

    if (!workspace) return  const isError = !!workspaceError

    // Clear error for this field

    if (errors[field]) {

      setErrors((prev) => ({ ...prev, [field]: "" }))

    }    logger.info("📝 Populating form with workspace data:", workspace)  // Fetch full workspace data when contextWorkspace is available

  }

  useEffect(() => {

  // Handle message changes

  const handleMessageChange = (    // Parse welcome messages    const fetchWorkspaceDetails = async () => {

    messageType: "welcomeMessages" | "wipMessages",

    lang: string,    let welcomeMessages = defaultWelcomeMessages      if (!contextWorkspace?.id) {

    value: string

  ) => {    if (workspace.welcomeMessages) {        setIsPageLoading(false)

    setFormData((prev) => ({

      ...prev,      try {        return

      [messageType]: {

        ...prev[messageType],        welcomeMessages =      }

        [lang]: value,

      },          typeof workspace.welcomeMessages === "string"

    }))

  }            ? JSON.parse(workspace.welcomeMessages)      try {



  // ✅ CLIENT-SIDE VALIDATION (before sending to backend)            : workspace.welcomeMessages        setIsPageLoading(true)

  const validateForm = (): boolean => {

    const newErrors: { [key: string]: string } = {}      } catch (e) {        const response = await fetch(`/api/workspaces/${contextWorkspace.id}`, {



    // Validate adminEmail        logger.error("Error parsing welcome messages:", e)          headers: {

    if (!formData.adminEmail.trim()) {

      newErrors.adminEmail = "Admin email is required"      }            Authorization: `Bearer ${localStorage.getItem("token")}`,

    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {

      newErrors.adminEmail = "Please enter a valid email address"    }            "X-Session-Id": sessionStorage.getItem("sessionId") || "",

    }

          },

    // Validate whatsappPhoneNumber (if provided)

    if (formData.whatsappPhoneNumber && formData.whatsappPhoneNumber.trim()) {    // Parse WIP messages        })

      const cleanPhone = formData.whatsappPhoneNumber.replace(/\s/g, "")

      if (!/^\+?\d{10,15}$/.test(cleanPhone)) {    let wipMessages = defaultWipMessages

        newErrors.whatsappPhoneNumber =

          "Phone must be in international format (+1234567890) with 10-15 digits"    if (workspace.wipMessages) {        if (!response.ok) {

      }

    }      try {          throw new Error("Failed to fetch workspace details")



    // Validate name        wipMessages =        }

    if (!formData.name.trim()) {

      newErrors.name = "Workspace name is required"          typeof workspace.wipMessages === "string"

    } else if (formData.name.length < 2 || formData.name.length > 100) {

      newErrors.name = "Name must be between 2 and 100 characters"            ? JSON.parse(workspace.wipMessages)        const data = await response.json()

    }

            : workspace.wipMessages        setWorkspace(data)

    // Validate URL (if provided)

    if (formData.url && formData.url.trim()) {      } catch (e) {        setWorkspaceError(null)

      try {

        new URL(formData.url)        logger.error("Error parsing WIP messages:", e)      } catch (error) {

      } catch {

        newErrors.url = "Please enter a valid URL (e.g., http://localhost:3000)"      }        logger.error("Error fetching workspace details:", error)

      }

    }    }        setWorkspaceError(error)



    setErrors(newErrors)      } finally {

    return Object.keys(newErrors).length === 0

  }    setFormData({        setIsPageLoading(false)



  // ✅ SAVE HANDLER: Validate + Send to backend      id: workspace.id,      }

  const handleSave = async () => {

    // Prevent multiple calls      name: workspace.name || "",    }

    if (saveSettingsMutation.isPending) {

      return      whatsappPhoneNumber: workspace.whatsappPhoneNumber || "",

    }

      whatsappApiKey: workspace.whatsappApiKey || "",    fetchWorkspaceDetails()

    // Client-side validation

    if (!validateForm()) {      adminEmail: workspace.adminEmail || "",  }, [contextWorkspace?.id])

      toast.error("Please fix validation errors before saving")

      return      url: workspace.url || "http://localhost:3000",

    }

      isActive: workspace.isActive ?? true,  // Popola il form quando i dati del workspace sono disponibili

    const updateData = {

      id: formData.id,      debugMode: workspace.debugMode ?? true,  useEffect(() => {

      name: formData.name,

      whatsappPhoneNumber: formData.whatsappPhoneNumber,      welcomeMessages,    if (workspace) {

      whatsappApiKey: formData.whatsappApiKey,

      adminEmail: formData.adminEmail,      wipMessages,      logger.info("Populating form with workspace data:", workspace)

      url: formData.url || "http://localhost:3000",

      isActive: formData.isActive,    })

      debugMode: formData.debugMode,

      welcomeMessages: formData.welcomeMessages,  }, [workspace])      // Default messages - definiti staticamente per evitare loop

      wipMessages: formData.wipMessages,

    }      const defaultWelcomeMessages = {



    logger.info("💾 Saving workspace settings:", updateData)  // ✅ MUTATION: Save settings with proper error handling        en: "Hello! Thank you for contacting us. How can we help you today?",

    saveSettingsMutation.mutate(updateData)

  }  const saveSettingsMutation = useMutation({        it: "Ciao! Grazie per averci contattato. Come possiamo aiutarti oggi?",



  // ✅ DELETE HANDLER    mutationFn: async (updateData: any) => {        es: "¡Hola! Gracias por contactarnos. ¿Cómo podemos ayudarte hoy?",

  const handleDelete = async () => {

    setShowDeleteDialog(false)      return updateWorkspace(formData.id, updateData)        pt: "Olá! Obrigado por entrar em contato. Como podemos ajudar você hoje?",

    deleteWorkspaceMutation.mutate()

  }    },      }



  // ✅ LOADING STATE: Show spinner while context loads    onSuccess: async (updatedWorkspace) => {

  if (loading) {

    return (      logger.info("✅ Workspace updated successfully:", updatedWorkspace)      const defaultWipMessages = {

      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">

        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />        en: "Work in progress. Please contact us later.",

        <h2 className="text-xl font-medium">Loading settings...</h2>

      </div>      // ✅ Refresh WorkspaceContext (it will update localStorage automatically)        it: "Lavori in corso. Contattaci più tardi.",

    )

  }      await refreshWorkspace()        es: "Trabajos en curso. Por favor, contáctenos más tarde.",



  // ✅ NO WORKSPACE: Show error        pt: "Em manutenção. Por favor, contacte-nos mais tarde.",

  if (!workspace) {

    return (      toast.success("Settings saved successfully")      }

      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">

        <h2 className="text-xl font-medium text-red-600">    },

          No workspace found. Please select a workspace.

        </h2>    onError: (error: any) => {      // Parse welcome messages

        <Button onClick={() => navigate("/workspace-selection")} className="mt-4">

          Go to Workspace Selection      logger.error("❌ Error saving settings:", error)      let welcomeMessages = defaultWelcomeMessages

        </Button>

      </div>      if (workspace.welcomeMessages) {

    )

  }      // Show detailed error from backend validation        try {



  return (      if (error.response?.data?.details) {          welcomeMessages =

    <div className="container mx-auto py-6 px-4">

      <div className="flex items-center gap-2 mb-6">        const details = error.response.data.details.join(", ")            typeof workspace.welcomeMessages === "string"

        <Settings className="h-6 w-6 text-green-600" />

        <h1 className="text-xl font-bold text-green-600">Workspace Settings</h1>        toast.error(`Validation failed: ${details}`)              ? JSON.parse(workspace.welcomeMessages)

      </div>

      } else {              : workspace.welcomeMessages

      <Card>

        <CardHeader>        toast.error("Failed to save settings")        } catch (e) {

          <CardTitle className="flex items-center justify-between">

            <span>General Settings</span>      }          logger.error("Error parsing welcome messages:", e)

            <div className="flex items-center gap-4">

              <div className="flex items-center gap-2">    },        }

                <span className="text-sm text-muted-foreground">Active</span>

                <Switch  })      }

                  checked={formData.isActive}

                  onCheckedChange={(checked) =>

                    handleFieldChange("isActive", checked)

                  }  // ✅ MUTATION: Delete workspace      // Parse WIP messages

                />

              </div>  const deleteWorkspaceMutation = useMutation({      let wipMessages = defaultWipMessages

              <div className="flex items-center gap-2">

                <span className="text-sm text-muted-foreground">    mutationFn: async () => {      if (workspace.wipMessages) {

                  Debug Mode

                </span>      return deleteWorkspace(formData.id)        try {

                <Switch

                  checked={formData.debugMode}    },          wipMessages =

                  onCheckedChange={(checked) =>

                    handleFieldChange("debugMode", checked)    onSuccess: () => {            typeof workspace.wipMessages === "string"

                  }

                />      logger.info("✅ Workspace deleted successfully")              ? JSON.parse(workspace.wipMessages)

              </div>

            </div>      localStorage.removeItem("currentWorkspace")              : workspace.wipMessages

          </CardTitle>

        </CardHeader>      toast.success("Workspace deleted successfully")        } catch (e) {



        <CardContent className="space-y-6">      navigate("/workspace-selection")          logger.error("Error parsing WIP messages:", e)

          {/* Workspace Name */}

          <div className="space-y-2">    },        }

            <Label htmlFor="name">

              Workspace Name <span className="text-red-500">*</span>    onError: (error) => {      }

            </Label>

            <Input      logger.error("❌ Error deleting workspace:", error)

              id="name"

              value={formData.name}      toast.error("Failed to delete workspace")      setFormData({

              onChange={(e) => handleFieldChange("name", e.target.value)}

              placeholder="My Business"    },        id: workspace.id,

              className={errors.name ? "border-red-500" : ""}

            />  })        name: workspace.name || "",

            {errors.name && (

              <p className="text-sm text-red-500">{errors.name}</p>        whatsappPhoneNumber: workspace.whatsappPhoneNumber || "",

            )}

          </div>  // Handle form field changes        whatsappApiKey: workspace.whatsappApiKey || "",



          {/* WhatsApp Phone Number */}  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {        adminEmail: workspace.adminEmail || "",

          <div className="space-y-2">

            <Label htmlFor="whatsappPhoneNumber">WhatsApp Phone Number</Label>    setFormData((prev) => ({ ...prev, [field]: value }))        url: workspace.url || "http://localhost:3000",

            <Input

              id="whatsappPhoneNumber"        isActive: workspace.isActive ?? true,

              value={formData.whatsappPhoneNumber}

              onChange={(e) =>    // Clear error for this field        debugMode: workspace.debugMode ?? true,

                handleFieldChange("whatsappPhoneNumber", e.target.value)

              }    if (errors[field]) {        welcomeMessages,

              placeholder="+1234567890"

              className={errors.whatsappPhoneNumber ? "border-red-500" : ""}      setErrors((prev) => ({ ...prev, [field]: "" }))        wipMessages,

            />

            {errors.whatsappPhoneNumber && (    }      })

              <p className="text-sm text-red-500">

                {errors.whatsappPhoneNumber}  }    }

              </p>

            )}  }, [workspace])

            <p className="text-xs text-muted-foreground">

              International format with country code (e.g., +1234567890)  // Handle message changes

            </p>

          </div>  const handleMessageChange = (  // Gestisci errori del workspace



          {/* WhatsApp API Key */}    messageType: "welcomeMessages" | "wipMessages",  useEffect(() => {

          <div className="space-y-2">

            <Label htmlFor="whatsappApiKey">WhatsApp API Key</Label>    lang: string,    if (isError && workspaceError) {

            <Input

              id="whatsappApiKey"    value: string      logger.error("Workspace loading error:", workspaceError)

              type="password"

              value={formData.whatsappApiKey}  ) => {      toast.error("Failed to load workspace settings")

              onChange={(e) =>

                handleFieldChange("whatsappApiKey", e.target.value)    setFormData((prev) => ({    }

              }

              placeholder="Your WhatsApp API Key"      ...prev,  }, [isError, workspaceError])

            />

          </div>      [messageType]: {



          {/* Admin Email */}        ...prev[messageType],  // Mutation per salvare i settings

          <div className="space-y-2">

            <Label htmlFor="adminEmail">        [lang]: value,  const saveSettingsMutation = useMutation({

              Admin Email <span className="text-red-500">*</span>

            </Label>      },    mutationFn: async (updateData: any) => {

            <Input

              id="adminEmail"    }))      return updateWorkspace(formData.id, updateData)

              type="email"

              value={formData.adminEmail}  }    },

              onChange={(e) => handleFieldChange("adminEmail", e.target.value)}

              placeholder="admin@example.com"    onSuccess: (updatedWorkspace) => {

              className={errors.adminEmail ? "border-red-500" : ""}

            />  // ✅ CLIENT-SIDE VALIDATION (before sending to backend)      logger.info("✅ Workspace updated:", updatedWorkspace)

            {errors.adminEmail && (

              <p className="text-sm text-red-500">{errors.adminEmail}</p>  const validateForm = (): boolean => {

            )}

            <p className="text-xs text-muted-foreground">    const newErrors: { [key: string]: string } = {}      // ✅ Update localStorage (single source of truth)

              This email will receive notifications when users request operator

              assistance      localStorage.setItem("currentWorkspace", JSON.stringify(updatedWorkspace))

            </p>

          </div>    // Validate adminEmail



          {/* Workspace URL */}    if (!formData.adminEmail.trim()) {      // Update local state

          <div className="space-y-2">

            <Label htmlFor="url">Workspace URL</Label>      newErrors.adminEmail = "Admin email is required"      setWorkspace(updatedWorkspace)

            <Input

              id="url"    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {

              type="url"

              value={formData.url}      newErrors.adminEmail = "Please enter a valid email address"      toast.success("Settings saved successfully")

              onChange={(e) => handleFieldChange("url", e.target.value)}

              placeholder="http://localhost:3000"    }    },

              className={errors.url ? "border-red-500" : ""}

            />    onError: (error) => {

            {errors.url && <p className="text-sm text-red-500">{errors.url}</p>}

            <p className="text-xs text-muted-foreground">    // Validate whatsappPhoneNumber (if provided)      logger.error("❌ Error saving settings:", error)

              Base URL for generating short links and redirects (e.g.,

              http://yourdomain.com)    if (formData.whatsappPhoneNumber && formData.whatsappPhoneNumber.trim()) {      toast.error("Failed to save settings")

            </p>

          </div>      const cleanPhone = formData.whatsappPhoneNumber.replace(/\s/g, "")    },



          {/* Welcome Messages */}      if (!/^\+?\d{10,15}$/.test(cleanPhone)) {  })

          <div className="space-y-2">

            <Label>Welcome Messages</Label>        newErrors.whatsappPhoneNumber =

            <div className="flex gap-2 mb-2">

              {["en", "it", "es", "pt"].map((lang) => (          "Phone must be in international format (+1234567890) with 10-15 digits"  // Handle form field changes

                <Button

                  key={lang}      }  const handleFieldChange = (field: keyof WorkspaceData, value: any) => {

                  variant={selectedWelcomeLang === lang ? "default" : "outline"}

                  size="sm"    }    setFormData((prev) => ({ ...prev, [field]: value }))

                  onClick={() => setSelectedWelcomeLang(lang)}

                >

                  {lang.toUpperCase()}

                </Button>    // Validate name    // Clear error for this field

              ))}

            </div>    if (!formData.name.trim()) {    if (errors[field]) {

            <Textarea

              value={      newErrors.name = "Workspace name is required"      setErrors((prev) => ({ ...prev, [field]: "" }))

                formData.welcomeMessages[

                  selectedWelcomeLang as keyof typeof formData.welcomeMessages    } else if (formData.name.length < 2 || formData.name.length > 100) {    }

                ]

              }      newErrors.name = "Name must be between 2 and 100 characters"  }

              onChange={(e) =>

                handleMessageChange(    }

                  "welcomeMessages",

                  selectedWelcomeLang,  // Handle message changes

                  e.target.value

                )    // Validate URL (if provided)  const handleMessageChange = (

              }

              rows={3}    if (formData.url && formData.url.trim()) {    messageType: "welcomeMessages" | "wipMessages",

              placeholder="Enter welcome message..."

            />      try {    lang: string,

          </div>

        new URL(formData.url)    value: string

          {/* WIP Messages */}

          <div className="space-y-2">      } catch {  ) => {

            <Label>Work in Progress Messages</Label>

            <div className="flex gap-2 mb-2">        newErrors.url = "Please enter a valid URL (e.g., http://localhost:3000)"    setFormData((prev) => ({

              {["en", "it", "es", "pt"].map((lang) => (

                <Button      }      ...prev,

                  key={lang}

                  variant={selectedWipLang === lang ? "default" : "outline"}    }      [messageType]: {

                  size="sm"

                  onClick={() => setSelectedWipLang(lang)}        ...prev[messageType],

                >

                  {lang.toUpperCase()}    setErrors(newErrors)        [lang]: value,

                </Button>

              ))}    return Object.keys(newErrors).length === 0      },

            </div>

            <Textarea  }    }))

              value={

                formData.wipMessages[  }

                  selectedWipLang as keyof typeof formData.wipMessages

                ]  // ✅ SAVE HANDLER: Validate + Send to backend

              }

              onChange={(e) =>  const handleSave = async () => {  // Validate form data

                handleMessageChange(

                  "wipMessages",    // Prevent multiple calls  const validateForm = (): boolean => {

                  selectedWipLang,

                  e.target.value    if (saveSettingsMutation.isPending) {    const newErrors: { [key: string]: string } = {}

                )

              }      return

              rows={3}

              placeholder="Enter work in progress message..."    }    if (!formData.adminEmail.trim()) {

            />

          </div>      newErrors.adminEmail = "Admin email is required"



          {/* Action Buttons */}    // Client-side validation    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {

          <div className="flex justify-end gap-2 pt-4 border-t">

            <Button    if (!validateForm()) {      newErrors.adminEmail = "Please enter a valid email address"

              variant="destructive"

              onClick={() => setShowDeleteDialog(true)}      toast.error("Please fix validation errors before saving")    }

              disabled={deleteWorkspaceMutation.isPending || saveSettingsMutation.isPending}

            >      return

              <Trash2 className="h-4 w-4 mr-2" />

              Delete Workspace    }    setErrors(newErrors)

            </Button>

            <Button    return Object.keys(newErrors).length === 0

              onClick={handleSave}

              disabled={saveSettingsMutation.isPending}    const updateData = {  }

            >

              {saveSettingsMutation.isPending ? (      id: formData.id,

                <>

                  <Loader2 className="h-4 w-4 animate-spin mr-2" />      name: formData.name,  // Save workspace settings

                  Saving...

                </>      whatsappPhoneNumber: formData.whatsappPhoneNumber,  const handleSave = async () => {

              ) : (

                <>      whatsappApiKey: formData.whatsappApiKey,    // Prevenire chiamate multiple

                  <Save className="h-4 w-4 mr-2" />

                  Save Changes      adminEmail: formData.adminEmail,    if (saveSettingsMutation.isPending) {

                </>

              )}      url: formData.url || "http://localhost:3000",      return

            </Button>

          </div>      isActive: formData.isActive,    }

        </CardContent>

      </Card>      debugMode: formData.debugMode,



      {/* Delete Confirmation Dialog */}      welcomeMessages: formData.welcomeMessages,    if (!validateForm()) {

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>

        <DialogContent>      wipMessages: formData.wipMessages,      return

          <DialogHeader>

            <DialogTitle>Delete Workspace</DialogTitle>    }    }

            <DialogDescription>

              This action cannot be undone. This will permanently delete your

              workspace and all associated data including products, customers,

              orders, and chat history.    logger.info("💾 Saving workspace settings:", updateData)    const updateData = {

            </DialogDescription>

          </DialogHeader>    saveSettingsMutation.mutate(updateData)      id: formData.id,

          <DialogFooter>

            <Button  }      name: formData.name,

              variant="outline"

              onClick={() => setShowDeleteDialog(false)}      whatsappPhoneNumber: formData.whatsappPhoneNumber,

              disabled={deleteWorkspaceMutation.isPending}

            >  // ✅ DELETE HANDLER      whatsappApiKey: formData.whatsappApiKey,

              Cancel

            </Button>  const handleDelete = async () => {      adminEmail: formData.adminEmail,

            <Button

              variant="destructive"    setShowDeleteDialog(false)      // currency rimosso - non serve più

              onClick={handleDelete}

              disabled={deleteWorkspaceMutation.isPending}    deleteWorkspaceMutation.mutate()      url: formData.url || "http://localhost:3000",

            >

              {deleteWorkspaceMutation.isPending ? (  }      isActive: formData.isActive,

                <>

                  <Loader2 className="h-4 w-4 animate-spin mr-2" />      debugMode: formData.debugMode,

                  Deleting...

                </>  // ✅ LOADING STATE: Show spinner while context loads      welcomeMessages: formData.welcomeMessages,

              ) : (

                "Delete Workspace"  if (loading) {      wipMessages: formData.wipMessages,

              )}

            </Button>    return (    }

          </DialogFooter>

        </DialogContent>      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[50vh]">

      </Dialog>

    </div>        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />    logger.info("💾 Saving workspace settings:", updateData)

  )

}        <h2 className="text-xl font-medium">Loading settings...</h2>    saveSettingsMutation.mutate(updateData)


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
