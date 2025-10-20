import { Chat } from "@/types/chat"
import { createContext, ReactNode, useContext, useState, useEffect } from "react"

interface ChatContextType {
  selectedChat: Chat | null
  setSelectedChat: (chat: Chat | null) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  // ✅ Inizializza sempre a null, poi leggiamo da sessionStorage in useEffect
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)

  // 🔥 Leggi da sessionStorage DOPO il mount per garantire la sincronizzazione
  useEffect(() => {
    const savedChatId = sessionStorage.getItem("selectedChatId")
    
    if (savedChatId) {
      console.log("🔍 ChatContext useEffect - Trovato chat ID in sessionStorage:", savedChatId)
      // Imposta un oggetto parziale con solo l'ID
      // Verrà completato quando le chat si caricano in ChatPage
      setSelectedChat({ sessionId: savedChatId } as Chat)
    } else {
      console.log("🔍 ChatContext useEffect - Nessun chat ID in sessionStorage")
    }
  }, []) // ✅ Esegui solo una volta al mount

  return (
    <ChatContext.Provider value={{ selectedChat, setSelectedChat }}>
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
