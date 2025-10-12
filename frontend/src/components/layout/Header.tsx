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
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import {
  ArrowLeftRight,
  Bot,
  CreditCard,
  LogOut,
  Phone,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export function Header() {
  const navigate = useNavigate()
  // Get workspace from sessionStorage instead of API call
  const [workspace, setWorkspace] = useState<any>(null)
  const [phoneNumber, setPhoneNumber] = useState<string>("")
  const [workspaceType, setWorkspaceType] = useState<string>("")
  const [channelName, setChannelName] = useState<string>("")
  const [userName, setUserName] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [userInitials, setUserInitials] = useState<string>("")
  // Get user data from localStorage instead of API call
  const [userData, setUserData] = useState<any>(null)

  // Load workspace and user data from storage
  useEffect(() => {
    // Load workspace
    const cachedWorkspace = localStorage.getItem("currentWorkspace")
    if (cachedWorkspace) {
      try {
        setWorkspace(JSON.parse(cachedWorkspace))
      } catch (error) {
        logger.error("Error parsing workspace from localStorage:", error)
      }
    }

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

  const planInfo = getPlanDisplayInfo(workspace?.plan)

  useEffect(() => {
    // Recupera le informazioni del workspace dai sessionStorage
    const currentPhone =
      sessionStorage.getItem("currentWorkspacePhone") || "No phone configured"
    const currentType = sessionStorage.getItem("currentWorkspaceType") || "Shop"
    const currentChannel =
      sessionStorage.getItem("currentWorkspaceName") || "Shop"

    setPhoneNumber(currentPhone)
    setWorkspaceType(currentType)
    setChannelName(currentChannel)

    // Carica i dati dell'utente
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const firstName = userData?.firstName || ""
      const lastName = userData?.lastName || ""
      const fullName = `${firstName} ${lastName}`.trim()

      setUserName(fullName || "User")
      setUserEmail(userData?.email || "")

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
    console.log("🔄 Navigating to workspace selection with reload")
    window.location.href = "/workspace-selection"
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout")

      // Clear all localStorage and sessionStorage data
      localStorage.removeItem("user")
      sessionStorage.removeItem("sessionId") // 🔒 CRITICAL: Clear sessionId (now in sessionStorage - OWASP compliant)
      sessionStorage.removeItem("currentWorkspace")
      sessionStorage.removeItem("currentWorkspaceName")
      sessionStorage.removeItem("currentWorkspaceType")
      localStorage.removeItem("chat-tab-lock") // Clear tab lock

      navigate("/auth/login")
    } catch (error) {
      logger.error("Error logging out:", error)
      toast.error("Failed to logout")
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
                className="relative h-12 w-12 rounded-full focus:ring-2 focus:ring-green-500 focus:outline-none hover:scale-105 transition-transform"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src="/avatars/01.png" alt="User" />
                  <AvatarFallback className="text-lg font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-4">
                <div className="flex flex-col space-y-2">
                  <p className="text-xl font-medium leading-none">{userName}</p>
                  <p className="text-lg leading-none text-muted-foreground">
                    {userEmail || "Welcome to ShopMe"}
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

              <DropdownMenuItem
                className="p-4 text-lg cursor-not-allowed opacity-50"
                disabled
              >
                <CreditCard className="mr-3 h-5 w-5" />
                <span>Plans (Coming Soon)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="p-4 text-lg cursor-pointer"
                onClick={() => navigate("/settings")}
              >
                <Settings className="mr-3 h-5 w-5" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="p-4 text-lg cursor-pointer"
                onClick={() => navigate("/gdpr")}
              >
                <ShieldCheck className="mr-3 h-5 w-5" />
                <span>GDPR Policy</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="p-4 text-lg cursor-pointer"
                onClick={() => navigate("/agent")}
              >
                <Bot className="mr-3 h-5 w-5" />
                <span>Agent Configuration</span>
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
