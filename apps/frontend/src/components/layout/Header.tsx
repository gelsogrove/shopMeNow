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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { getBillingOverview } from "@/services/subscriptionBillingApi"
import { getUnreadCount } from "@/services/supportApi"
import {
  ArrowLeft,
  Bot,
  CreditCard,
  Crown,
  LogOut,
  Mail,
  Send,
  Settings,
  User,
} from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"

export function Header() {
  const navigate = useNavigate()

  // ✅ FIX: Use WorkspaceContext (single source of truth)
  const { workspace } = useWorkspace()
  const { isOwner } = useWorkspaceRole(workspace?.id)

  const [userName, setUserName] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [userInitials, setUserInitials] = useState<string>("")
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  // Get user data from localStorage instead of API call
  const [userData, setUserData] = useState<any>(null)
  // Real-time plan type from billing API
  const [actualPlanType, setActualPlanType] = useState<string | null>(null)
  // Support ticket unread count
  const [supportUnreadCount, setSupportUnreadCount] = useState<number>(0)

  // Load support unread count
  const loadSupportUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount()
      if (response.success) {
        setSupportUnreadCount(response.data.unreadCount)
      }
    } catch (error) {
      // Silently fail - user might not have support access
    }
  }, [])

  // Poll for unread messages every 30 seconds
  useEffect(() => {
    loadSupportUnreadCount()
    const interval = setInterval(loadSupportUnreadCount, 30000)
    
    // Listen for ticket view events to refresh immediately
    const handleTicketViewed = () => {
      loadSupportUnreadCount()
    }
    window.addEventListener("support-ticket-viewed", handleTicketViewed)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener("support-ticket-viewed", handleTicketViewed)
    }
  }, [loadSupportUnreadCount])

  // Load user data from storage
  useEffect(() => {
    const loadUserData = () => {
      const cachedUser = storage.getUser()
      if (cachedUser) {
        setUserData(cachedUser)
      }
    }
    
    loadUserData()
    
    // Listen for storage changes (when user data is updated on other pages)
    window.addEventListener('storage', loadUserData)
    return () => window.removeEventListener('storage', loadUserData)
  }, [])

  // Load actual plan type from billing API (force refresh to get latest)
  useEffect(() => {
    const loadBillingPlan = async () => {
      if (!workspace?.id) return
      try {
        const billingData = await getBillingOverview(workspace.id, true) // forceRefresh=true
        setActualPlanType(billingData.billing.planType)
        logger.info("💳 [Header] Billing plan loaded:", billingData.billing.planType)
      } catch (error) {
        logger.error("Failed to load billing plan:", error)
        // Fallback to workspace planType
        setActualPlanType(workspace.planType || null)
      }
    }
    loadBillingPlan()
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
    // Reset avatar error when userData changes
    setProfilePicture(userData?.profilePicture || null)
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
      storage.clearAppState()
      logger.info("✅ [LOGOUT] Storage cleared completely")

      navigate("/")
    } catch (error) {
      logger.error("Error logging out:", error)
      
      // Force logout even if API call fails
      logger.info("🧹 [LOGOUT FORCE] Clearing ALL storage after API error")
      storage.clearAppState()
      logger.info("✅ [LOGOUT FORCE] Storage cleared completely")
      
      toast.error("Failed to logout")
      navigate("/")
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-green-600">eChatbot</span>
          </div>

          {/* Center: Navigation Menu */}
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/chat")}
              className="text-gray-600 hover:text-gray-900"
            >
              Chat History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/clients")}
              className="text-gray-600 hover:text-gray-900"
            >
              Clients
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/faq")}
              className="text-gray-600 hover:text-gray-900"
            >
              FAQ
            </Button>
            {workspace?.sellsProductsAndServices !== false && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    E-commerce
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => navigate("/products")}>Products</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/services")}>Services</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/offers")}>Offers</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/suppliers")}>Suppliers</DropdownMenuItem>
                  {workspace?.hasSalesAgents === true && (
                    <DropdownMenuItem onClick={() => navigate("/sales")}>Sales</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/admin/orders")}>Orders</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/campaigns")}
              className="text-gray-600 hover:text-gray-900"
            >
              Campaigns
            </Button>
          </nav>

          {/* Right side: Support Inbox + Settings + Plan Badge + Profile menu */}
          <div className="flex items-center gap-4">
            {/* Support Inbox Icon with Badge */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/support/tickets")}
                    className="relative p-2 text-gray-600 hover:text-gray-900"
                  >
                    <Mail className="h-5 w-5" />
                    {supportUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                        {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {supportUnreadCount > 0
                      ? `${supportUnreadCount} unread message${supportUnreadCount > 1 ? "s" : ""}`
                      : "Support Tickets"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Settings Icon */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/settings")}
                    className="p-2 text-gray-600 hover:text-gray-900"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Plan Badge - uses actualPlanType from billing API or fallback to workspace.planType */}
            {workspace && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => isSuperAdmin && navigate("/workspace-selection")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all ${isSuperAdmin ? 'hover:scale-105 cursor-pointer' : 'cursor-default'} ${
                        (actualPlanType || workspace.planType) === 'FREE_TRIAL'
                          ? 'bg-amber-100 text-amber-700 border border-amber-300'
                          : (actualPlanType || workspace.planType) === 'BASIC'
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : (actualPlanType || workspace.planType) === 'PREMIUM'
                          ? 'bg-purple-100 text-purple-700 border border-purple-300'
                          : 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      <Crown className="h-3.5 w-3.5" />
                      <span>
                        {(actualPlanType || workspace.planType) === 'FREE_TRIAL' 
                          ? 'Free Trial'
                          : (actualPlanType || workspace.planType) === 'BASIC'
                          ? 'Basic'
                          : (actualPlanType || workspace.planType) === 'PREMIUM'
                          ? 'Premium'
                          : 'Enterprise'}
                      </span>
                    </button>
                  </TooltipTrigger>
                  {isSuperAdmin && (
                    <TooltipContent>
                      <p>Click to change your plan</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-16 w-16 rounded-full focus:ring-2 focus:ring-green-500 focus:outline-none hover:scale-105 transition-transform p-0"
              data-testid="user-avatar-button"
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
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-green-600 flex items-center justify-center text-white text-base font-semibold">
                    {userInitials}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userEmail || "Welcome to eChatbot"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Owner-only menu items (SUPER_ADMIN) */}
              {isSuperAdmin && (
                <>
                  <DropdownMenuItem
                    className="p-2 cursor-pointer"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="p-2 cursor-pointer"
                    onClick={() => navigate("/queue")}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    <span>Queue</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="p-2 cursor-pointer"
                onClick={() => navigate("/profile")}
              >
                <User className="mr-2 h-4 w-4 text-blue-500" />
                <span>Profile</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="p-2 cursor-pointer"
                onClick={() => navigate("/billing")}
              >
                <CreditCard className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Billing</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="p-2 cursor-pointer relative"
                onClick={() => navigate("/support/tickets")}
              >
                <Mail className="mr-2 h-4 w-4 text-blue-500" />
                <span>Support</span>
                {supportUnreadCount > 0 && (
                  <span className="ml-auto h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                    {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                  </span>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="p-2 cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
