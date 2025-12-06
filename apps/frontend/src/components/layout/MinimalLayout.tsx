import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logger } from "@/lib/logger"
import { workspaceApi } from "@/services/workspaceApi"
import { ArrowLeft, LogOut, User, Radio, CreditCard, Crown } from "lucide-react"
import { useEffect, useState } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"

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
  
  // User profile state
  const [userName, setUserName] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [userInitials, setUserInitials] = useState<string>("U")
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [planType, setPlanType] = useState<string>("FREE_TRIAL")
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)

  // Load user profile from localStorage and workspace for plan
  useEffect(() => {
    const cachedUser = localStorage.getItem("user")
    if (cachedUser) {
      try {
        const userData = JSON.parse(cachedUser)
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
      } catch (error) {
        logger.error("Error parsing user from localStorage:", error)
      }
    }
    
    // Load workspace to get plan type
    loadWorkspacePlan()
  }, [])

  const loadWorkspacePlan = async () => {
    try {
      const workspaces = await workspaceApi.getAll()
      if (workspaces && workspaces.length > 0) {
        // Use the FIRST workspace (consistent with WorkspaceSelectionPage)
        const firstWs = workspaces[0]
        
        setPlanType(firstWs.planType || 'FREE_TRIAL')
        setTrialEndsAt(firstWs.trialEndsAt || null)
      }
    } catch (error) {
      logger.error("Error loading workspace plan:", error)
    }
  }

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
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("currentWorkspace")
    navigate("/auth/login")
  }

  const handleBack = () => {
    // Navigate back to workspace selection
    navigate("/workspace-selection")
  }

  // Check if we're on the profile page
  const isProfilePage = location.pathname === "/profile"
  const isBillingPage = location.pathname === "/billing"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back button and Logo */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Channels</span>
              </Button>
              
              <div className="h-6 w-px bg-gray-200" />
              
              <span className="text-xl font-bold text-green-600">eChatbot</span>
            </div>

            {/* Right: Plan Badge + User Menu */}
            <div className="flex items-center gap-3">
              {/* Plan Badge */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getPlanBadgeColor(planType)}`}>
                <Crown className="h-3.5 w-3.5" />
                <span>{getPlanName(planType)}</span>
              </div>

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
                      <div className="h-full w-full rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium">
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
                <DropdownMenuItem
                  className="p-2 cursor-pointer"
                  onClick={() => navigate("/workspace-selection")}
                >
                  <Radio className="mr-2 h-4 w-4 text-green-600" />
                  <span>Your Channels</span>
                </DropdownMenuItem>
                {!isProfilePage && (
                  <DropdownMenuItem
                    className="p-2 cursor-pointer"
                    onClick={() => navigate("/profile")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                )}
                {!isBillingPage && (
                  <DropdownMenuItem
                    className="p-2 cursor-pointer"
                    onClick={() => navigate("/billing")}
                  >
                    <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                    <span>Billing</span>
                  </DropdownMenuItem>
                )}
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

      {/* Main Content */}
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-16 pb-8 text-center text-sm text-gray-500">
        <p>© 2025 eChatbot. All rights reserved.</p>
      </footer>
    </div>
  )
}
