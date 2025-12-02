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
import { ArrowLeft, LogOut, User } from "lucide-react"
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

  // Load user profile from localStorage
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
  }, [])

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

            {/* Right: User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full focus:ring-2 focus:ring-green-500 focus:outline-none hover:scale-105 transition-transform p-0"
                >
                  {profilePicture ? (
                    <img 
                      src={profilePicture} 
                      alt="User"
                      referrerPolicy="no-referrer"
                      className="h-full w-full rounded-full object-cover"
                      onError={(e) => {
                        logger.error('Avatar image failed to load:', profilePicture)
                        e.currentTarget.style.display = 'none'
                      }}
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
                {!isProfilePage && (
                  <>
                    <DropdownMenuItem
                      className="p-2 cursor-pointer"
                      onClick={() => navigate("/profile")}
                    >
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
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
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
