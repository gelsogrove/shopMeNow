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
import { storage } from "@/lib/storage"
import { getUnreadCount } from "@/services/supportApi"
import { ArrowLeft, LogOut, User, CreditCard, Crown, Bot, BarChart3, MessageSquare, History, Users, HelpCircle, Package, Briefcase, Tag, Truck, UserCog, ShoppingCart, Megaphone, Settings, ListTodo, Mail } from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { WidgetLoader } from "@/components/WidgetLoader"

/**
 * MinimalLayout - Layout for pages that don't require a workspace context
 * Used for: Profile, Settings (user-level), etc.
 * 
 * Features:
 * - Header with logo and user menu
 * - Back button to return to workspace selection
 * - Clean, minimal design consistent with the app
 */
export function MinimalLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get workspace from context (reactive to changes)
  const { workspace } = useWorkspace()
  
  // Get user role - only owners can see billing
  const { isOwner } = useWorkspaceRole(workspace?.id)
  
  // User profile state
  const [userName, setUserName] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [userInitials, setUserInitials] = useState<string>("U")
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  
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

  // Derived from workspace context (reactive)
  const planType = workspace?.planType || "FREE_TRIAL"
  const trialEndsAt = workspace?.trialEndsAt || null
  const workspaceName = workspace?.name || ""
  const workspacePhone = workspace?.whatsappPhoneNumber || ""
  const hasSalesAgents = workspace?.hasSalesAgents ?? false
  const enableWhatsapp = (workspace as any)?.enableWhatsapp ?? false

  // Load user profile from localStorage
  useEffect(() => {
    const userData = storage.getUser<any>()
    if (userData) {
        const firstName = userData?.firstName || ""
        const lastName = userData?.lastName || ""
        const fullName = `${firstName} ${lastName}`.trim()
        
        setUserName(fullName || "User")
        setUserEmail(userData?.email || "")
        setProfilePicture(userData?.profilePicture || null)
        setImageError(false) // Reset error when profile changes
        
        // Create initials for avatar
        const initials =
          firstName && lastName
            ? `${firstName[0]}${lastName[0]}`.toUpperCase()
            : firstName
            ? firstName[0].toUpperCase()
            : "U"
        setUserInitials(initials)
    }
  }, [])

  const getPlanBadgeColor = (type: string) => {
    switch (type) {
      case 'FREE_TRIAL':
        return 'bg-amber-100 text-amber-700 border-amber-300'
      case 'BASIC':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'PREMIUM':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'ENTERPRISE':
        return 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getPlanName = (type: string) => {
    if (type === 'FREE_TRIAL') {
      const daysLeft = trialEndsAt 
        ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0
      return `Free Trial ${daysLeft}d`
    }
    switch (type) {
      case 'BASIC': return 'Basic'
      case 'PREMIUM': return 'Premium'
      case 'ENTERPRISE': return 'Enterprise'
      default: return type
    }
  }

  const handleLogout = () => {
    storage.clearAuth()
    navigate("/")
  }

  const handleBack = () => {
    // Navigate back to workspace selection
    navigate("/workspace-selection")
  }

  // Check if we're on user-level pages (no workspace context needed)
  const isUserLevelPage = location.pathname === "/profile" || location.pathname === "/billing"
  // Check if we're on chat page (needs minimal menu)
  const isChatPage = location.pathname === "/chat"

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Back button, Logo, and Channel Info */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              
              <div className="h-6 w-px bg-gray-200" />
              
              <span className="text-xl font-bold text-green-600">eChatbot</span>
            </div>

            {/* Center: Workspace Info (hidden on user-level pages) */}
            {!isUserLevelPage && (workspaceName || workspacePhone) && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                {workspaceName && <span className="font-medium">{workspaceName}</span>}
                {workspaceName && workspacePhone && <span>•</span>}
                {workspacePhone && <span>{workspacePhone}</span>}
              </div>
            )}



            {/* Right: Support + Settings + Plan Badge + User Menu */}
            <div className="flex items-center gap-3">
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

              {/* Settings Icon - Only shown when workspace is active */}
              {workspace && (
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
              )}

              {/* Plan Badge - Only shown when NOT in a workspace */}
              {!workspace && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getPlanBadgeColor(planType)}`}>
                  <Crown className="h-3.5 w-3.5" />
                  <span>{getPlanName(planType)}</span>
                </div>
              )}

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full focus:ring-2 focus:ring-green-500 focus:outline-none hover:scale-105 transition-transform p-0"
                  >
                    {profilePicture && !imageError ? (
                      <img 
                        src={profilePicture} 
                        alt="User"
                        referrerPolicy="no-referrer"
                        className="h-full w-full rounded-full object-cover"
                        onError={() => setImageError(true)}
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
                    <p className="text-sm font-medium leading-none">{userName || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <>
                  <DropdownMenuItem
                    className="p-2 cursor-pointer"
                    onClick={() => navigate("/workspace-selection")}
                  >
                    <MessageSquare className="mr-2 h-4 w-4 text-green-500" fill="currentColor" />
                    <span>Your Channels</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/chat")}>
                    <History className="mr-2 h-4 w-4 text-green-500" />
                    <span>Chat History</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/clients")}>
                    <Users className="mr-2 h-4 w-4 text-indigo-500" />
                    <span>Clients</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/faq")}>
                    <HelpCircle className="mr-2 h-4 w-4 text-amber-500" />
                    <span>FAQ</span>
                  </DropdownMenuItem>
                  {workspace?.sellsProductsAndServices && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>E-commerce</DropdownMenuLabel>
                      <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/products")}>
                        <Package className="mr-2 h-4 w-4 text-orange-500" />
                        <span>Products</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/services")}>
                        <Briefcase className="mr-2 h-4 w-4 text-cyan-500" />
                        <span>Services</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/offers")}>
                        <Tag className="mr-2 h-4 w-4 text-pink-500" />
                        <span>Offers</span>
                      </DropdownMenuItem>
                      {hasSalesAgents && (
                        <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/sales")}>
                          <UserCog className="mr-2 h-4 w-4 text-violet-500" />
                          <span>Sales</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/admin/orders")}>
                        <ShoppingCart className="mr-2 h-4 w-4 text-emerald-500" />
                        <span>Orders</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/campaigns")}>
                    <Megaphone className="mr-2 h-4 w-4 text-rose-500" />
                    <span>Campaigns</span>
                  </DropdownMenuItem>
                  {workspace?.sellsProductsAndServices && isSuperAdmin && (
                    <DropdownMenuItem
                      className="p-2 cursor-pointer"
                      onClick={() => navigate("/analytics")}
                    >
                      <BarChart3 className="mr-2 h-4 w-4 text-purple-500" />
                      <span>Analytics</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {enableWhatsapp && (
                    <DropdownMenuItem
                      className="p-2 cursor-pointer"
                      onClick={() => navigate("/queue")}
                    >
                      <ListTodo className="mr-2 h-4 w-4 text-green-600" />
                      <span>WhatsApp Queue</span>
                    </DropdownMenuItem>
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
                </>
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full py-8 px-4 sm:px-6 lg:px-8 flex-1">
        <div className="max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-gray-500 border-t border-gray-200 bg-white">
        <p>© 2025 eChatbot. All rights reserved.</p>
      </footer>
    </div>
  )
}
