import { logger } from "@/lib/logger"
import { Chat } from "@/types/chat"
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

interface ChatContextType {
  selectedChat: Chat | null
  setSelectedChat: (chat: Chat | null) => void
  clearSelectedChat: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  // ✅ Inizializza sempre a null, poi leggiamo da sessionStorage in useEffect
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)

  // 🔥 Leggi da sessionStorage DOPO il mount per garantire la sincronizzazione
  useEffect(() => {
    const savedChatId = sessionStorage.getItem("selectedChatId")

    if (savedChatId) {
      logger.info(
        "🔍 ChatContext useEffect - Trovato chat ID in sessionStorage:",
        savedChatId
      )
      // Imposta un oggetto parziale con solo l'ID
      // Verrà completato quando le chat si caricano in ChatPage
      setSelectedChat({ sessionId: savedChatId } as Chat)
    } else {
      logger.info("🔍 ChatContext useEffect - Nessun chat ID in sessionStorage")
    }
  }, []) // ✅ Esegui solo una volta al mount

  // 🔥 Listen for workspace changes to clear chat selection
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "workspace-changed" || e.key === "selectedChatId") {
        logger.info("🧹 ChatContext - Workspace changed, clearing selected chat")
        setSelectedChat(null)
      }
    }

    // Also listen for custom event dispatched within same tab
    const handleWorkspaceChange = () => {
      logger.info("🧹 ChatContext - Custom workspace-changed event, clearing selected chat")
      setSelectedChat(null)
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("workspace-changed", handleWorkspaceChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("workspace-changed", handleWorkspaceChange)
    }
  }, [])

  // 🔥 Method to manually clear selected chat (used when switching workspaces)
  const clearSelectedChat = () => {
    logger.info("🧹 ChatContext - clearSelectedChat called")
    sessionStorage.removeItem("selectedChatId")
    setSelectedChat(null)
  }

  return (
    <ChatContext.Provider value={{ selectedChat, setSelectedChat, clearSelectedChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}
