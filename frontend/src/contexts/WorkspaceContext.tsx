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
  businessType?: string
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
}

export const WorkspaceProvider = ({ children }: WorkspaceProviderProps) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    () => {
      // Initialize from localStorage (shared across tabs)
      try {
        const stored = localStorage.getItem("currentWorkspace")
        return stored ? JSON.parse(stored) : null
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

  // Carica il workspace dal localStorage all'avvio
  useEffect(() => {
    const cachedWorkspace = localStorage.getItem("currentWorkspace")
    if (cachedWorkspace) {
      try {
        const workspace = JSON.parse(cachedWorkspace)
        setCurrentWorkspace(workspace)
      } catch (error) {
        logger.error("Error parsing workspace from localStorage:", error)
      }
    }
  }, [])

  // Aggiorna il workspace quando cambiano i dati
  useEffect(() => {
    if (workspaceData && !currentWorkspace) {
      setCurrentWorkspace(workspaceData)
    }
  }, [workspaceData, currentWorkspace])

  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace)
    // Salva nel localStorage
    localStorage.setItem("currentWorkspace", JSON.stringify(workspace))
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
