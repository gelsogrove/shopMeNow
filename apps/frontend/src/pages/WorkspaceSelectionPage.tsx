import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TeamMembersTable } from "@/components/workspace/TeamMembersTable"
import { BillingSection } from "@/components/billing/BillingSection"
import { UsageLimitsCard } from "@/components/billing/UsageLimitsCard"
import type { Workspace } from "@/hooks/use-workspace"
import { useWorkspace } from "@/hooks/use-workspace"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { LogOut, PlusCircle, Radio, MessageSquare, ShoppingCart, AlertTriangle, Smartphone, Crown } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
  workspaceApi,
} from "../services/workspaceApi"

// Badge stats type
interface WorkspaceBadgeStats {
  unreadMessages: number
  pendingOrders: number
  needsIntervention: number
}

// Definizione dei tipi di attività supportati
type BusinessType = "Shop"

export function WorkspaceSelectionPage() {
  const navigate = useNavigate()
  const { setCurrentWorkspace } = useWorkspace()
  const [selectedType] = useState<BusinessType>("Shop") // Always Shop by default
  const [newPhoneNumber, setNewPhoneNumber] = useState("")
  const [alias, setAlias] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [userEmail, setUserEmail] = useState("") // Email from token (auto-filled)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [channelLimitError, setChannelLimitError] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{
    whatsapp?: string
  }>({})
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  // Validation helpers
  const validateWhatsAppNumber = (phone: string): boolean => {
    // Must start with + and contain only digits after
    const whatsappRegex = /^\+[1-9]\d{6,14}$/
    return whatsappRegex.test(phone.replace(/\s/g, ''))
  }

  const handleWhatsAppChange = (value: string) => {
    setNewPhoneNumber(value)
    if (value && !validateWhatsAppNumber(value)) {
      setValidationErrors(prev => ({ ...prev, whatsapp: 'Invalid format. Use +1234567890' }))
    } else {
      setValidationErrors(prev => ({ ...prev, whatsapp: undefined }))
    }
  }

  const [isLoading, setIsLoading] = useState(false)
  const [badgeStats, setBadgeStats] = useState<Record<string, WorkspaceBadgeStats>>({})
  
  // Shared billing data state - to avoid duplicate API calls
  const [sharedBillingOverview, setSharedBillingOverview] = useState<any>(null)

  // 🔍 DEBUG: Log ALL localStorage keys on mount
  useEffect(() => {
    logger.info('🔍 [WorkspaceSelectionPage] MOUNT - Checking localStorage:')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        logger.info(`  - ${key}: ${value?.substring(0, 50)}...`)
      }
    }
    
    // Decode token if present
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c: string) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
        const decoded = JSON.parse(jsonPayload)
        logger.info('🔍 [WorkspaceSelectionPage] Token decoded:', decoded)
      } catch (e) {
        logger.error('Failed to decode token:', e)
      }
    }
  }, [])

  // Get first workspace ID for role check (all workspaces share the same owner)
  const firstWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null
  const { isSuperAdmin, isLoading: isRoleLoading, role } = useWorkspaceRole(firstWorkspaceId)

  // 🔍 DEBUG: Log role info
  useEffect(() => {
    logger.info('🔍 [WorkspaceSelectionPage] Role check:', {
      firstWorkspaceId,
      isSuperAdmin,
      isRoleLoading,
      role,
      workspacesCount: workspaces.length
    })
  }, [firstWorkspaceId, isSuperAdmin, isRoleLoading, role, workspaces.length])

  // Carica i workspace all'avvio
  useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = async () => {
    try {
      // Verify token exists before making API call
      const token = localStorage.getItem("token")
      logger.info(
        "🔍 [WorkspaceSelectionPage] Token in localStorage:",
        token ? token.substring(0, 20) + "..." : "NULL"
      )

      // Decode token to get user email
      if (token) {
        try {
          const base64Url = token.split('.')[1]
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
          const jsonPayload = decodeURIComponent(atob(base64).split('').map((c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          }).join(''))
          const decoded = JSON.parse(jsonPayload)
          logger.info('🔍 [WorkspaceSelectionPage] Token belongs to:', decoded.email || decoded.id)
          // Set user email from token for workspace creation
          if (decoded.email) {
            setUserEmail(decoded.email)
          }
        } catch (e) {
          logger.error('Failed to decode token:', e)
        }
      }

      if (!token) {
        logger.error(
          "❌ [WorkspaceSelectionPage] CRITICAL: No token found, redirecting to login"
        )
        setErrorMessage("Session expired, please login again")
        navigate('/auth/login')
        return
      }

      setIsLoading(true)
      logger.info("🔍 [WorkspaceSelectionPage] Calling getWorkspaces()")
      
      // Load workspaces and badge stats in parallel
      const [workspacesData, statsData] = await Promise.all([
        getWorkspaces(),
        workspaceApi.getBadgeStats(),
      ])
      
      // Set workspaces sorted by createdAt asc (oldest first)
      const sortedWorkspaces = workspacesData.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      setWorkspaces(sortedWorkspaces)
      setBadgeStats(statsData)
      
      logger.info("📊 Badge stats loaded:", statsData)
    } catch (error) {
      logger.error(
        "❌ [WorkspaceSelectionPage] Error loading workspaces:",
        error
      )
      setErrorMessage("Failed to load workspaces")
    } finally {
      setIsLoading(false)
    }
  }

  // Gestisce la selezione di un workspace
  const handleSelectWorkspace = (workspace: Workspace) => {
    // ✅ SINGLE SOURCE OF TRUTH: Save to localStorage + context
    // WorkspaceContext will automatically sync from localStorage
    setCurrentWorkspace(workspace)

    // ✅ Log workspace selection
    logger.info("✅ Workspace selected:", workspace.name, workspace.id)
    
    // ✅ Navigate using React Router (preserves React state)
    logger.info("🔄 Navigating to /chat")
    navigate("/chat")
  }

  // Gestisce la creazione di un nuovo workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedType) {
      setErrorMessage("Select a business type")
      return
    }

    if (!newPhoneNumber.trim()) {
      setErrorMessage("Enter a phone number")
      return
    }

    if (!alias.trim()) {
      setErrorMessage("Enter an alias")
      return
    }

    try {
      setIsLoading(true)
      setChannelLimitError(false)
      const newWorkspace = await createWorkspace({
        name: alias || newPhoneNumber,
        whatsappPhoneNumber: newPhoneNumber,
        language: "en",
        welcomeMessage: welcomeMessage || undefined,
        adminEmail: userEmail, // Use email from token
      })

      logger.info("✅ Workspace created successfully:", newWorkspace.id)
      toast.success("Channel created successfully!")

      // 🔄 REFRESH PAGE - Reload workspace-selection to show new workspace with all agents
      logger.info("🔄 Reloading workspace-selection page...")
      window.location.reload()
    } catch (error: any) {
      // Check if it's a channel limit error
      if (error?.response?.data?.code === "CHANNEL_LIMIT_EXCEEDED") {
        setChannelLimitError(true)
        setErrorMessage(error.response.data.message)
      } else {
        setErrorMessage("Failed to create channel")
      }
      logger.error("❌ Error creating workspace:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async (id: string) => {
    try {
      setIsLoading(true)
      const workspace = workspaces.find((w) => w.id === id)
      if (workspace) {
        const updatedWorkspace = await updateWorkspace(id, {
          id,
          isActive: !workspace.isActive,
        })
        const updatedWorkspaces = workspaces.map((w) =>
          w.id === id ? updatedWorkspace : w
        )
        setWorkspaces(updatedWorkspaces)
      }
    } catch (error) {
      setErrorMessage("Failed to toggle workspace status")
    } finally {
      setIsLoading(false)
    }
  }

  // 🆕 LOGOUT HANDLER
  const handleLogout = () => {
    logger.info("🚺 [WorkspaceSelectionPage] Logout requested")
    
    // 🛡️ CRITICAL SECURITY: Clear ALL storage on logout to prevent user isolation bugs
    logger.info('🧹 [LOGOUT] Clearing ALL storage (localStorage + sessionStorage)')
    localStorage.clear()
    sessionStorage.clear()
    logger.info('✅ [LOGOUT] Storage cleared completely')
    
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header with Logout */}
        <div className="flex justify-end items-center mb-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* ========== LOADING STATE ========== */}
        {isLoading && (
          <Card className="max-w-xl mx-auto">
            <CardContent className="py-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading your channels...</p>
            </CardContent>
          </Card>
        )}

        {/* ========== NO WORKSPACES: Show Welcome + Create Form ========== */}
        {!isLoading && workspaces.length === 0 && (
          <Card className="max-w-xl mx-auto">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-green-100 rounded-full w-fit mb-4">
                <Smartphone className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">
                Welcome to ShopME! 🎉
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Create your first WhatsApp channel to start receiving orders from your customers
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {errorMessage && (
                <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp-number-inline" className="text-sm font-medium">
                    WhatsApp Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="whatsapp-number-inline"
                    type="text"
                    placeholder="+34612345678"
                    value={newPhoneNumber}
                    onChange={(e) => handleWhatsAppChange(e.target.value)}
                    className={`mt-1.5 ${validationErrors.whatsapp ? 'border-red-500 focus:ring-red-500' : ''}`}
                    autoComplete="off"
                  />
                  {validationErrors.whatsapp && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.whatsapp}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +34 for Spain)</p>
                </div>

                <div>
                  <Label htmlFor="channel-alias-inline" className="text-sm font-medium">
                    Business Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="channel-alias-inline"
                    type="text"
                    placeholder="My Restaurant"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    className="mt-1.5"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="welcome-message-inline" className="text-sm font-medium">
                    Welcome Message
                  </Label>
                  <Textarea
                    id="welcome-message-inline"
                    placeholder={`Welcome to ${alias || 'My Business'}! I'm your virtual assistant. How can I help you today?`}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    className="mt-1.5 min-h-[80px] resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    AI will automatically translate to customer's language
                  </p>
                </div>

                {/* Admin email info (auto-filled from logged user) */}
                {userEmail && (
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                    📧 Admin email: <span className="font-medium text-gray-700">{userEmail}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 mt-6"
                  size="lg"
                  disabled={
                    !newPhoneNumber.trim() || 
                    !alias.trim() || 
                    !userEmail ||
                    !!validationErrors.whatsapp ||
                    isLoading
                  }
                >
                  {isLoading ? "Creating..." : "🚀 Create My Channel"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ========== HAS WORKSPACES: Show List ========== */}
        {!isLoading && workspaces.length > 0 && (
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Radio className="h-5 w-5" />
                  Your Channels
                </CardTitle>
                <CardDescription>
                  Select a channel to manage its conversations
                </CardDescription>
              </div>
              {!isRoleLoading && isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => {
                    const dialog = document.getElementById(
                      "type-selection-dialog"
                    ) as HTMLDialogElement
                    if (dialog) dialog.showModal()
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Channel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lista dei workspace esistenti */}
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    justCreatedId === workspace.id ? "ring-2 ring-green-500" : ""
                  } ${
                    workspace.isActive
                      ? "bg-green-50 border-green-300 hover:shadow-md hover:bg-green-100 hover:border-green-400"
                      : "bg-gray-100 border-gray-300 opacity-75"
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelectWorkspace(workspace)
                  }}
                >
                  <div className="space-y-2 min-w-0 w-full">
                    <div className="text-lg font-semibold truncate flex items-center justify-between">
                      <span>{workspace.name}</span>
                      {!workspace.challengeStatus && (
                        <span className="text-sm font-normal text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          Disabled
                        </span>
                    )}
                  </div>
                  {workspace.whatsappPhoneNumber && (
                    <div
                      className={`text-xl flex items-center gap-2 ${
                        workspace.isActive ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      <span className="truncate">
                        {workspace.whatsappPhoneNumber}
                      </span>
                    </div>
                  )}
                  
                  {/* 📊 Badge Stats Row */}
                  {badgeStats[workspace.id] && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-green-200">
                      {/* Unread Messages Badge */}
                      {badgeStats[workspace.id].unreadMessages > 0 && (
                        <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-sm font-medium">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{badgeStats[workspace.id].unreadMessages}</span>
                        </div>
                      )}
                      
                      {/* Pending Orders Badge */}
                      {badgeStats[workspace.id].pendingOrders > 0 && (
                        <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-sm font-medium">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          <span>{badgeStats[workspace.id].pendingOrders}</span>
                        </div>
                      )}
                      
                      {/* Needs Intervention Badge */}
                      {badgeStats[workspace.id].needsIntervention > 0 && (
                        <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-sm font-medium animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{badgeStats[workspace.id].needsIntervention}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {justCreatedId === workspace.id && (
                    <div className="mt-2">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        New
                      </span>
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Dialog per la creazione di un nuovo canale (only shown when workspaces exist) */}
        {workspaces.length > 0 && (
        <dialog
          id="type-selection-dialog"
          className="backdrop:bg-black/50 p-0 rounded-xl shadow-xl border-0 max-w-lg w-full bg-white"
        >
          <div className="p-6">
            {/* Header with icon */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-full">
                <Smartphone className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Channel</h2>
                <p className="text-sm text-gray-500">Set up your WhatsApp business channel</p>
              </div>
            </div>

            {/* Error message for channel limit */}
            {channelLimitError && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <Crown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Upgrade Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {errorMessage || "You've reached your channel limit. Upgrade your plan to add more channels."}
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 bg-amber-600 hover:bg-amber-700"
                    onClick={() => {
                      const dialog = document.getElementById("type-selection-dialog") as HTMLDialogElement
                      if (dialog) dialog.close()
                      // Scroll to billing section
                      document.querySelector('[class*="Subscription"]')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    Change Plan
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="whatsapp-number" className="text-sm font-medium">
                  WhatsApp Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="whatsapp-number"
                  type="text"
                  placeholder="+34612345678"
                  value={newPhoneNumber}
                  onChange={(e) => handleWhatsAppChange(e.target.value)}
                  className={`mt-1.5 ${validationErrors.whatsapp ? 'border-red-500 focus:ring-red-500' : ''}`}
                  autoComplete="off"
                />
                {validationErrors.whatsapp && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.whatsapp}</p>
                )}
              </div>

              <div>
                <Label htmlFor="channel-alias" className="text-sm font-medium">
                  Alias <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="channel-alias"
                  type="text"
                  placeholder="My Business Name"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="mt-1.5"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1">This name will be used in the welcome message</p>
              </div>

              <div>
                <Label htmlFor="welcome-message" className="text-sm font-medium">
                  Welcome Message
                </Label>
                <Textarea
                  id="welcome-message"
                  placeholder={`Welcome to ${alias || 'My Business'}! I'm your virtual assistant. How can I help you today?`}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="mt-1.5 min-h-[80px] resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  AI will automatically translate this message to the customer's language
                </p>
              </div>

              {/* Admin email info (auto-filled from logged user) */}
              {userEmail && (
                <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  📧 Admin email: <span className="font-medium text-gray-700">{userEmail}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const dialog = document.getElementById(
                      "type-selection-dialog"
                    ) as HTMLDialogElement
                    if (dialog) dialog.close()
                    // Reset form
                    setNewPhoneNumber("")
                    setAlias("")
                    setWelcomeMessage("")
                    setChannelLimitError(false)
                    setErrorMessage("")
                    setValidationErrors({})
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWorkspace}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={
                    !selectedType || 
                    !newPhoneNumber.trim() || 
                    !alias.trim() || 
                    !userEmail ||
                    !!validationErrors.whatsapp ||
                    isLoading
                  }
                >
                  {isLoading ? "Creating..." : "Create Channel"}
                </Button>
              </div>
            </div>
          </div>
        </dialog>
        )}

        {/* Subscription & Billing + Usage Limits Row - ONLY for Owner (SUPER_ADMIN) */}
        {firstWorkspaceId && !isRoleLoading && isSuperAdmin && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Main - Subscription & Billing */}
            <BillingSection 
              workspaceId={firstWorkspaceId} 
              onBillingOverviewLoaded={setSharedBillingOverview}
            />
            
            {/* Side - Usage Limits (uses shared data from BillingSection) */}
            <UsageLimitsCard 
              workspaceId={firstWorkspaceId} 
              billingOverview={sharedBillingOverview}
              isLoading={!sharedBillingOverview}
            />
          </div>
        )}

        {/* Team Members Section */}
        {firstWorkspaceId && !isRoleLoading && (
          <TeamMembersTable
            workspaceId={firstWorkspaceId}
            isSuperAdmin={isSuperAdmin}
          />
        )}
      </div>
    </div>
  )
}
