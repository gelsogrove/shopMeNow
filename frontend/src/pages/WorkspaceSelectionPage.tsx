import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TeamMembersTable } from "@/components/workspace/TeamMembersTable"
import { BillingSection } from "@/components/billing/BillingSection"
import type { Workspace } from "@/hooks/use-workspace"
import { useWorkspace } from "@/hooks/use-workspace"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { LogOut, PlusCircle, Radio, MessageSquare, ShoppingCart, AlertTriangle } from "lucide-react"
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
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [badgeStats, setBadgeStats] = useState<Record<string, WorkspaceBadgeStats>>({})

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

      // 🔍 DEBUG: Decode token to see who it belongs to
      if (token) {
        try {
          const base64Url = token.split('.')[1]
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
          const jsonPayload = decodeURIComponent(atob(base64).split('').map((c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          }).join(''))
          const decoded = JSON.parse(jsonPayload)
          logger.info('🔍 [WorkspaceSelectionPage] Token belongs to:', decoded.email || decoded.id)
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
      const newWorkspace = await createWorkspace({
        name: newPhoneNumber,
        whatsappPhoneNumber: newPhoneNumber,
        language: "en",
      })

      logger.info("✅ Workspace created successfully:", newWorkspace.id)
      toast.success("Workspace created successfully!")

      // 🔄 REFRESH PAGE - Reload workspace-selection to show new workspace with all agents
      logger.info("🔄 Reloading workspace-selection page...")
      window.location.reload()
    } catch (error) {
      setErrorMessage("Failed to create workspace")
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
              {!isRoleLoading && (workspaces.length === 0 || isSuperAdmin) && (
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
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
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

        {/* Dialog per la selezione del tipo di attività */}
        <dialog
          id="type-selection-dialog"
          className="backdrop:bg-black/50 p-0 rounded-lg shadow-lg border max-w-md w-full"
        >
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-6">Select Channel Type</h2>

            <div className="space-y-6">
              <div>
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  type="text"
                  placeholder="My Channel"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="mt-2"
                  autoComplete="off"
                />
              </div>

              <div>
                <Label htmlFor="channel-alias">Alias</Label>
                <Input
                  id="channel-alias"
                  type="text"
                  placeholder="My Channel Alias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="mt-2"
                  autoComplete="off"
                />
              </div>

              {/* Channel Type is always "Shop" by default - no UI needed */}

              <div className="flex justify-end gap-4 mt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const dialog = document.getElementById(
                      "type-selection-dialog"
                    ) as HTMLDialogElement
                    if (dialog) dialog.close()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWorkspace}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={
                    !selectedType || !newPhoneNumber.trim() || isLoading
                  }
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        </dialog>

        {/* Team Members Section - Show below channels */}
        {firstWorkspaceId && !isRoleLoading && (
          <TeamMembersTable
            workspaceId={firstWorkspaceId}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {/* Subscription & Billing Section - ONLY for Owner (SUPER_ADMIN) */}
        {firstWorkspaceId && !isRoleLoading && isSuperAdmin && (
          <div className="mt-8">
            <BillingSection workspaceId={firstWorkspaceId} />
          </div>
        )}
      </div>
    </div>
  )
}
