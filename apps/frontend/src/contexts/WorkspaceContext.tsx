import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { workspaceApi } from "@/services/workspaceApi"
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
  whatsappAppName?: string
  whatsappAppSecret?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  whatsappWebhookId?: string
  whatsappWebhookToken?: string
  whatsappWebhookUrl?: string
  whatsappBusinessAccountId?: string
  whatsappProvider?: string
  ultraMsgInstanceId?: string
  ultraMsgToken?: string
  ultraMsgApiUrl?: string
  adminEmail?: string
  url?: string
  websiteUrl?: string
  debugMode?: boolean
  currency?: string
  language?: string
  defaultLanguage?: string // 🌍 ISO-2 default language for customers
  welcomeMessage?: string
  enableWelcomeMessage?: boolean // E0a - toggle to enable/disable welcome message
  sessionResetTimeout?: number // E0b - seconds after escalation before auto-reset (0 = never)
  wipMessage?: string
  afterRegistrationMessages?: any
  messageLimit?: number
  blocklist?: string | string[]
  channelStatus?: boolean
  notificationEmail?: string
  webhookUrl?: string
  webhookTimeout?: number
  planType?: string | null
  trialEndsAt?: string | null
  // Channel Configuration (Feature 199)
  enableWhatsapp?: boolean
  enableWidget?: boolean
  sellsProducts?: boolean
  sellsServices?: boolean
  channelMode?: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  humanSupportInstructions?: string
  operatorContactMethod?: string
  operatorWhatsappNumber?: string
  toneOfVoice?: string
  botIdentityResponse?: string
  address?: string // 🆕 Physical address for "where are you?" questions
  customAiRules?: string // 🆕 Custom AI rules that override default behavior
  allowedExternalLinks?: string[] // 🆕 Security: allowed external domains
  logoUrl?: string // 🆕 Channel logo/icon
  widgetLogoUrl?: string // 🆕 Widget bubble logo/image
  widgetLogoKey?: string
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
  widgetUseChannelLogo?: boolean
  widgetAutoSuggestionsEnabled?: boolean
  widgetQuickReplies?: string[]
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
  // 🆕 Chatbot Identity & Context
  chatbotName?: string // Custom name for the chatbot (e.g., "Sofia", "Marco")
  businessType?: string // Business sector (e.g., "food", "fashion", "electronics")
  registrationPage?: string
  requireManualApproval?: boolean
  channelType?: 'WHATSAPP' | 'WIDGET' | null
  // 📅 Calendar & Appointment Booking
  enableCalendarBooking?: boolean
  timezone?: string
  appointmentReminder24hEnabled?: boolean
  appointmentReminder24hMessage?: string | null
  appointmentReminder1hEnabled?: boolean
  appointmentReminder1hMessage?: string | null
  appointmentReminder30mEnabled?: boolean
  appointmentReminder30mMessage?: string | null
  appointmentReminderMessage?: string | null
  appointmentReminderHours?: number[]
  appointmentReminderChannel?: string
  minBookingBufferHours?: number
  // WasenderAPI fields
  wasenderSessionId?: string | null
  wasenderApiKey?: string | null
  wasenderSessionStatus?: string | null
  wasenderPhoneNumber?: string | null
  wasenderIsActive?: boolean
  wasenderQrString?: string | null
  wasenderQrGeneratedAt?: string | null
  operatorEmail?: string
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
        return storage.getWorkspace<Workspace>()
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
        const user = storage.getUser()
        const authenticated = user !== null

        // If authenticated but no workspace, try to get from localStorage
        if (authenticated && !currentWorkspace) {
          const workspace = storage.getWorkspace<Workspace>()
          if (workspace) {
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

  // 🔄 Refresh workspace from API on startup to avoid stale localStorage data.
  // Ensures fields like enableCalendarBooking and channelMode are always current.
  useEffect(() => {
    if (!currentWorkspace?.id) return
    const token = storage.getToken()
    if (!token) return

    workspaceApi.getById(currentWorkspace.id)
      .then((fresh) => {
        if (JSON.stringify(fresh) !== JSON.stringify(currentWorkspace)) {
          logger.info("🔄 WorkspaceContext: refreshed workspace from API", fresh.name)
          storage.setWorkspace(fresh)
          setCurrentWorkspace(fresh)
        }
      })
      .catch((err) => {
        logger.error("WorkspaceContext: failed to refresh workspace from API", err)
        // Non-fatal — localStorage data used as fallback
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      storage.setWorkspace(currentWorkspace)
      // 🆕 Also save for widget access
      localStorage.setItem("echatbot-workspace-id", currentWorkspace.id)
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
    const parsed = storage.getWorkspace<Workspace>()
    if (parsed) {
      
      // 🧹 CRITICAL: Clear chat-related storage when workspace changes
      // This prevents cross-workspace data contamination
      if (parsed?.id !== workspace?.id) {
        logger.info("🧹 Workspace changed! Clearing chat localStorage AND sessionStorage...")
        storage.clearChatCache()
        storage.clearSelectedChatId()  // 🔥 CRITICAL: ChatContext reads this!
        // Invalidate react-query cache by triggering storage event
        storage.setWorkspaceChanged()
        // 🔥 Ensure same-tab listeners react immediately
        window.dispatchEvent(new Event("workspace-changed"))
      }
    }
    
    // Salva nel localStorage PRIMA di settare lo state
    storage.setWorkspace(workspace)
    // 🆕 Also save for widget access
    localStorage.setItem("echatbot-workspace-id", workspace.id)
    
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
