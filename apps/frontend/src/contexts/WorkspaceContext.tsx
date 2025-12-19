import { logger } from "@/lib/logger"
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

export interface Workspace {
  id: string
  name: string
  slug?: string
  description?: string
  isActive: boolean
  isDelete: boolean
  createdAt: string
  updatedAt: string
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  adminEmail?: string
  url?: string
  debugMode?: boolean
  currency?: string
  language?: string
  welcomeMessage?: string
  wipMessage?: string
  afterRegistrationMessages?: any
  messageLimit?: number
  blocklist?: string
  challengeStatus?: boolean
  notificationEmail?: string
  webhookUrl?: string
  planType?: string | null
  trialEndsAt?: string | null
  // Channel Configuration (Feature 199)
  sellsProducts?: boolean
  sellsServices?: boolean
  sellsProductsAndServices?: boolean // 🆕 Unified field
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  humanSupportInstructions?: string
  frustrationEscalationInstructions?: string // 🆕 Feature 203: Custom escalation triggers
  operatorContactMethod?: string
  operatorWhatsappNumber?: string
  toneOfVoice?: string
  botIdentityResponse?: string
  address?: string // 🆕 Physical address for "where are you?" questions
  customAiRules?: string // 🆕 Custom AI rules that override default behavior
  allowedExternalLinks?: string[] // 🆕 Security: allowed external domains
  logoUrl?: string // 🆕 Channel logo/icon
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
}

interface WorkspaceContextType {
  workspace: Workspace | null
  setCurrentWorkspace: (workspace: Workspace) => void
  loading: boolean
  error: any
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
)

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider")
  }
  return context
}

interface WorkspaceProviderProps {
  children: ReactNode
  initialWorkspace?: Workspace | null
}

export const WorkspaceProvider = ({ children, initialWorkspace }: WorkspaceProviderProps) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    () => {
      // If initialWorkspace is provided (for testing), use it
      if (initialWorkspace) {
        return initialWorkspace
      }
      // Initialize from localStorage (shared across tabs)
      try {
        const stored = localStorage.getItem("currentWorkspace")
        const parsed = stored ? JSON.parse(stored) : null
        return parsed
      } catch (error) {
        return null
      }
    }
  )
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  // Check authentication status and workspace
  useEffect(() => {
    const checkAuth = () => {
      try {
        const user = localStorage.getItem("user")
        const authenticated = user !== null

        // If authenticated but no workspace, try to get from localStorage
        if (authenticated && !currentWorkspace) {
          const stored = localStorage.getItem("currentWorkspace")
          if (stored) {
            const workspace = JSON.parse(stored)
            setCurrentWorkspace(workspace)
          }
        }

        setIsAuthenticated(authenticated)
        return authenticated
      } catch (error) {
        setIsAuthenticated(false)
        return false
      }
    }

    // Check immediately
    checkAuth()

    // Listen for storage changes
    const handleStorageChange = () => {
      checkAuth()
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  // Query per ottenere il workspace corrente - TEMPORANEAMENTE DISABILITATA
  // const { data: workspaceData, isLoading, error } = useQuery({
  //   queryKey: ['workspace'],
  //   queryFn: workspaceApi.getCurrent,
  //   staleTime: 5 * 60 * 1000, // 5 minutes
  //   enabled: isAuthenticated && !currentWorkspace, // Disabilita se non autenticato o se abbiamo già un workspace
  // })

  // TEMPORANEO: Nessuna chiamata API
  const workspaceData = null
  const isLoading = false
  const error = null

  // Salva il workspace nel localStorage quando cambia
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem("currentWorkspace", JSON.stringify(currentWorkspace))
      logger.info("🏢 Workspace saved to localStorage:", currentWorkspace.name)
    }
  }, [currentWorkspace])

  // ❌ REMOVED: This useEffect was causing a race condition!
  // The workspace is already initialized from localStorage in useState (line 77)
  // This useEffect was overwriting fresh API data with stale localStorage data

  // Aggiorna il workspace quando cambiano i dati
  useEffect(() => {
    if (workspaceData && !currentWorkspace) {
      setCurrentWorkspace(workspaceData)
    }
  }, [workspaceData, currentWorkspace])

  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    // 🔍 Check what's currently in localStorage BEFORE we update
    const beforeUpdate = localStorage.getItem("currentWorkspace")
    if (beforeUpdate) {
      const parsed = JSON.parse(beforeUpdate)
      
      // 🧹 CRITICAL: Clear chat-related storage when workspace changes
      // This prevents cross-workspace data contamination
      if (parsed?.id !== workspace?.id) {
        logger.info("🧹 Workspace changed! Clearing chat localStorage AND sessionStorage...")
        localStorage.removeItem("selectedChat")
        localStorage.removeItem("chatMessages")
        localStorage.removeItem("chat-list-updated")
        sessionStorage.removeItem("selectedChatId")  // 🔥 CRITICAL: ChatContext reads this!
        // Invalidate react-query cache by triggering storage event
        localStorage.setItem("workspace-changed", Date.now().toString())
      }
    }
    
    // Salva nel localStorage PRIMA di settare lo state
    localStorage.setItem("currentWorkspace", JSON.stringify(workspace))
    
    setCurrentWorkspace(workspace)
  }

  const value: WorkspaceContextType = {
    workspace: currentWorkspace,
    setCurrentWorkspace: handleSetCurrentWorkspace,
    loading: isLoading,
    error,
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
