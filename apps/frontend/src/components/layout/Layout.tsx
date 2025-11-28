import { WhatsAppChatModal } from "@/components/shared/WhatsAppChatModal"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useChat } from "@/contexts/ChatContext"
import { logger } from "@/lib/logger"
import { Chat } from "@/types/chat"
// Importiamo l'icona WhatsAppIcon che creiamo internamente
import { memo, useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

// Memorizziamo i componenti per evitare re-render inutili
const MemoizedHeader = memo(Header)
const MemoizedSidebar = memo(Sidebar)

export function Layout() {
  const { setSelectedChat } = useChat()
  const location = useLocation()

  // Reset selected chat when leaving chat page
  useEffect(() => {
    if (location.pathname !== "/chat") {
      logger.info("🔄 Resetting selectedChat - left chat page")
      setSelectedChat(null)
    }
  }, [location.pathname, setSelectedChat])

  // Get workspace from localStorage instead of API call
  const [workspace, setWorkspace] = useState<any>(null)

  // Load workspace from localStorage
  useEffect(() => {
    const cachedWorkspace = localStorage.getItem("currentWorkspace")
    if (cachedWorkspace) {
      try {
        setWorkspace(JSON.parse(cachedWorkspace))
      } catch (error) {
        logger.error("Error parsing workspace from localStorage:", error)
      }
    }
  }, [])

  const [showPlaygroundDialog, setShowPlaygroundDialog] = useState(false)
  const [savedChat, setSavedChat] = useState<Chat | null>(null)

  // Recupera la chat salvata dal localStorage quando il componente viene montato
  useEffect(() => {
    try {
      const savedChatJson = localStorage.getItem("selectedChat")
      if (savedChatJson) {
        const chat = JSON.parse(savedChatJson)
        logger.info("Loaded chat from localStorage:", chat)
        setSavedChat(chat)
      }
    } catch (error) {
      logger.error("Error loading chat from localStorage:", error)
    }
  }, [])

  // Aggiorna il savedChat quando cambia il localStorage
  // (utile per quando la chat viene selezionata in un'altra pagina)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selectedChat") {
        try {
          if (e.newValue) {
            const chat = JSON.parse(e.newValue)
            logger.info("Chat in localStorage updated:", chat)
            setSavedChat(chat)
          } else {
            setSavedChat(null)
          }
        } catch (error) {
          logger.error("Error parsing chat from localStorage:", error)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const handlePlaygroundClick = () => {
    try {
      const latestChatJson = localStorage.getItem("selectedChat")
      if (latestChatJson) {
        const latestChat = JSON.parse(latestChatJson)
        // Only update if different from current savedChat
        if (!savedChat || savedChat.sessionId !== latestChat.sessionId) {
          logger.info("Updating to latest chat from localStorage:", latestChat)
          setSavedChat(latestChat)
        }
      }
    } catch (error) {
      logger.error("Error reading latest chat from localStorage:", error)
    }

    setShowPlaygroundDialog(true)
  }

  const handleClosePlayground = () => {
    setShowPlaygroundDialog(false)
    // Non rimuoviamo i dati della chat quando chiudiamo il modal
    // per mantenere la continuità della conversazione
  }

  return (
    <TooltipProvider>
      <div className="relative flex min-h-screen">
        <MemoizedSidebar />
        <div className="flex w-full flex-col pl-72">
          <MemoizedHeader />
          <main className="flex-1 p-8">
            <Outlet />
          </main>
        </div>
        <WhatsAppChatModal
          isOpen={showPlaygroundDialog}
          onClose={handleClosePlayground}
          channelName="WhatsApp Chat"
          workspaceId={workspace?.id}
          selectedChat={savedChat}
        />
      </div>
    </TooltipProvider>
  )
}
