import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import {
  ArrowLeftRight,
  BarChart3,
  Bot,
  CreditCard,
  ListChecks,
  LogOut,
  Phone,
  Settings,
  ShieldCheck,
  ShieldBan,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export function Header() {
  const navigate = useNavigate()

  // ✅ FIX: Use WorkspaceContext (single source of truth)
  const { workspace } = useWorkspace()
  const { isSuperAdmin } = useWorkspaceRole(workspace?.id)

  const [userName, setUserName] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [userInitials, setUserInitials] = useState<string>("")
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  // Get user data from localStorage instead of API call
  const [userData, setUserData] = useState<any>(null)
  // 🚫 Blocked users count
  const [blockedUsersCount, setBlockedUsersCount] = useState<number>(0)

  // Load user data from storage
  useEffect(() => {
    // Load user data
    const cachedUser = localStorage.getItem("user")
    if (cachedUser) {
      try {
        setUserData(JSON.parse(cachedUser))
      } catch (error) {
        logger.error("Error parsing user from localStorage:", error)
      }
    }
  }, [])

  // 🚫 Load blocked users count
  useEffect(() => {
    const loadBlockedCount = async () => {
      if (!workspace?.id) return
      try {
        const response = await api.get(`/workspaces/badge-stats`)
        const stats = response.data[workspace.id]
        if (stats?.blockedUsers !== undefined) {
          setBlockedUsersCount(stats.blockedUsers)
        }
      } catch (error) {
        logger.error("Error loading blocked users count:", error)
      }
    }
    loadBlockedCount()
  }, [workspace?.id])

  // Get plan display info
  const getPlanDisplayInfo = (plan?: string) => {
    switch (plan) {
      case "FREE":
        return {
          label: "FREE",
          color: "bg-gray-50 text-gray-600 border-gray-300",
        }
      case "BASIC":
        return {
          label: "BASIC",
          color: "bg-green-50 text-green-600 border-green-300",
        }
      case "PROFESSIONAL":
        return {
          label: "PRO",
          color: "bg-purple-50 text-purple-600 border-purple-300",
        }
      default:
        return {
          label: "FREE",
          color: "bg-gray-50 text-gray-600 border-gray-300",
        }
    }
  }

  // ✅ FIX: Get data directly from workspace context
  const phoneNumber = workspace?.whatsappPhoneNumber || "No phone configured"
  const channelName = workspace?.name || "Shop"

  useEffect(() => {
    // Carica i dati dell'utente
    loadUserProfile()
  }, [userData]) // 🆕 Re-run when userData changes

  const loadUserProfile = async () => {
    try {
      const firstName = userData?.firstName || ""
      const lastName = userData?.lastName || ""
      const fullName = `${firstName} ${lastName}`.trim()

      setUserName(fullName || "User")
      setUserEmail(userData?.email || "")
      setProfilePicture(userData?.profilePicture || null)

      logger.info('👤 [Header] User profile loaded:', {
        fullName,
        email: userData?.email,
        profilePicture: userData?.profilePicture,
      })

      // Crea le iniziali per l'avatar
      const initials =
        firstName && lastName
          ? `${firstName[0]}${lastName[0]}`.toUpperCase()
          : firstName
          ? firstName[0].toUpperCase()
          : "U"

      setUserInitials(initials)
    } catch (error) {
      logger.error("Failed to load user profile:", error)
      setUserName("User")
      setUserInitials("U")
    }
  }

  // Gestisce il ritorno alla selezione dei workspace
  const handleBackToWorkspaces = () => {
    // 🔄 HARD RELOAD - Force page refresh when changing workspace
    logger.info("🔄 Navigating to workspace selection with reload")
    window.location.href = "/workspace-selection"
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout")

      // 🛡️ CRITICAL SECURITY: Clear ALL storage on logout
      logger.info("🧹 [LOGOUT] Clearing ALL storage (localStorage + sessionStorage)")
      localStorage.clear()
      sessionStorage.clear()
      logger.info("✅ [LOGOUT] Storage cleared completely")

      navigate("/auth/login")
    } catch (error) {
      logger.error("Error logging out:", error)
      
      // Force logout even if API call fails
      logger.info("🧹 [LOGOUT FORCE] Clearing ALL storage after API error")
      localStorage.clear()
      sessionStorage.clear()
      logger.info("✅ [LOGOUT FORCE] Storage cleared completely")
      
      toast.error("Failed to logout")
      navigate("/auth/login")
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-24 items-center">
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="mr-2 flex items-center text-muted-foreground hover:text-foreground"
              onClick={handleBackToWorkspaces}
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              <span className="text-sm">Change</span>
            </Button>

            <div className="flex flex-col">
              <div className="flex items-center space-x-2 text-lg">
                <Phone className="h-5 w-5 text-green-600" />
                <span className="font-medium">{phoneNumber}</span>
                {/* 🚫 Blocked users badge */}
                {blockedUsersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 p-1 h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => navigate("/blocked-users")}
                    title={`${blockedUsersCount} blocked user${blockedUsersCount > 1 ? "s" : ""}`}
                  >
                    <ShieldBan className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">{blockedUsersCount}</span>
                  </Button>
                )}
              </div>
              <span className="text-xs text-muted-foreground ml-7">
                {channelName}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-12 w-12 rounded-full focus:ring-2 focus:ring-green-500 focus:outline-none hover:scale-105 transition-transform p-0"
                onClick={() => {
                  logger.info('🖼️ [Avatar Debug]:', {
                    profilePicture,
                    hasProfilePicture: !!profilePicture,
                    userData,
                    userDataProfilePicture: userData?.profilePicture,
                  })
                }}
              >
                {profilePicture ? (
                  <img 
                    src={profilePicture} 
                    alt="User"
                    referrerPolicy="no-referrer"
                    className="h-full w-full rounded-full object-cover"
                    onError={(e) => {
                      logger.error('❌ [Avatar] Image failed to load:', profilePicture)
                      e.currentTarget.style.display = 'none'
                    }}
                    onLoad={() => {
                      logger.info('✅ [Avatar] Image loaded successfully:', profilePicture)
                    }}
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-green-600 flex items-center justify-center text-white text-lg font-medium">
                    {userInitials}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-4">
                <div className="flex flex-col space-y-2">
                  <p className="text-xl font-medium leading-none">{userName}</p>
                  <p className="text-lg leading-none text-muted-foreground">
                    {userEmail || "Welcome to eChatbot"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="p-4 text-lg cursor-pointer"
                onClick={() => navigate("/profile")}
              >
                <User className="mr-3 h-5 w-5" />
                <span>Profile</span>
              </DropdownMenuItem>

              

              {/* Settings - ONLY for SUPER_ADMIN (Owner) */}
              {isSuperAdmin && (
                <DropdownMenuItem
                  className="p-4 text-lg cursor-pointer"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="mr-3 h-5 w-5" />
                  <span>Settings</span>
                </DropdownMenuItem>
              )}
              {/* GDPR Policy - ONLY for SUPER_ADMIN (Owner) */}
              {isSuperAdmin && (
                <DropdownMenuItem
                  className="p-4 text-lg cursor-pointer"
                  onClick={() => navigate("/gdpr")}
                >
                  <ShieldCheck className="mr-3 h-5 w-5" />
                  <span>GDPR Policy</span>
                </DropdownMenuItem>
              )}
              {/* Agents Configuration - ONLY for SUPER_ADMIN (Owner) */}
              {isSuperAdmin && (
                <DropdownMenuItem
                  className="p-4 text-lg cursor-pointer"
                  onClick={() => navigate("/agents")}
                >
                  <Bot className="mr-3 h-5 w-5" />
                  <span>Agents Configuration</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="p-4 text-lg cursor-pointer"
                onClick={() => navigate("/analytics")}
              >
                <BarChart3 className="mr-3 h-5 w-5" />
                <span>Analytics</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="p-4 text-lg cursor-pointer"
                onClick={() => navigate("/queue")}
              >
                <ListChecks className="mr-3 h-5 w-5" />
                <span>WhatsApp Queue</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="p-4 text-lg cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
