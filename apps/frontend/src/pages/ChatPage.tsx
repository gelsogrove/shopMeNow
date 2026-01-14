import { IMG_BASE_URL } from "@/config"
import { PageLayout } from "@/components/layout/PageLayout"
import { ClientSheet } from "@/components/shared/ClientSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import MessageFlowDialog from "@/components/shared/MessageFlowDialog"
import { MessageRenderer } from "@/components/shared/MessageRenderer"
import { NotificationDialog } from "@/components/shared/NotificationDialog"
import { WhatsAppChatModal } from "@/components/shared/WhatsAppChatModal"
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon"
import { useChat } from "@/contexts/ChatContext"
import { useChatList } from "@/contexts/ChatListContext"
import { useCustomerEdit } from "@/contexts/CustomerEditContext"
import { useWorkspace } from "@/hooks/use-workspace"
import { useChatSync } from "@/hooks/useChatSync"
import { useCurrentChatMessages } from "@/hooks/useCurrentChatMessages"
import { useLoadMoreMessages } from "@/hooks/useLoadMoreMessages"
import { useWebSocket } from "@/hooks/useWebSocket"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { pushNotificationService } from "@/services/pushNotificationService"
import { getLanguages, Language } from "@/services/workspaceApi"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Ban,
  Bot,
  Eye,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Switch } from "../components/ui/switch"
import { Textarea } from "../components/ui/textarea"

import type { Chat, Message } from "@/types/chat"

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return "Data non disponibile"
  }

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return "Data non valida"
    }

    const options: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit", // Show 2-digit year for consistency with WhatsApp modal
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit", // 🔧 NEW: Add seconds for more precision
    }

    return date.toLocaleDateString("it-IT", options)
  } catch (error) {
    return "Errore nella formattazione data"
  }
}

// Helper function to get language flag emoji
const getLanguageFlag = (language?: string): string => {
  const normalizedLang = language?.toUpperCase() // Normalize to uppercase
  switch (normalizedLang) {
    case "IT":
      return "🇮🇹"
    case "EN":
    case "ENG":
      return "🇬🇧"
    case "ES":
    case "ESP":
      return "🇪🇸"
    case "PT":
    case "PRT":
      return "🇵🇹"
    default:
      return "🌐"
  }
}

export function ChatPage() {
  // ChatPage loaded
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { workspace, setCurrentWorkspace, loading: isWorkspaceLoading } = useWorkspace()
  const {
    saveOriginalCustomerData,
    getOriginalCustomerData,
    clearOriginalCustomerData,
  } = useCustomerEdit()

  // 🔑 Get workspaceId from URL first, fallback to localStorage
  const urlWorkspaceId = new URLSearchParams(window.location.search).get("workspaceId")
  const storedWorkspace = storage.getWorkspace<{ id?: string }>()
  const storedWorkspaceId = storedWorkspace?.id || null
  const effectiveWorkspaceId = urlWorkspaceId || storedWorkspaceId

  // 🚨 CRITICAL: If no workspaceId anywhere, redirect to workspace selection
  useEffect(() => {
    if (!effectiveWorkspaceId) {
      logger.warn("[ChatPage] No workspaceId found - redirecting to workspace selection")
      window.location.href = "/workspace-selection"
      return
    }
    
    // If workspaceId is in URL, make sure localStorage is in sync
    if (urlWorkspaceId && storedWorkspaceId !== urlWorkspaceId) {
      logger.info(`[ChatPage] Syncing localStorage with URL workspaceId: ${urlWorkspaceId}`)
      // We need to fetch workspace data - for now just clear the cache
      storage.clearWorkspace()
    }
  }, [])

  // Get sessionId from sessionStorage (unique per browser session)
  const userSessionId = storage.getSessionId()

  // Clean any stale locks on mount
  useEffect(() => {
    const lockKey = "chat-tab-lock"
    localStorage.removeItem(lockKey) // ALWAYS clear lock on mount
  }, [])

  // REMOVED: Tab blocking system is causing issues with React Strict Mode
  // const { isBlocked: isTabBlocked, hasLock } = useTabBlock()
  const isTabBlocked = false // Never block
  const hasLock = true // Always has lock

  // 🚀 WEBSOCKET: Real-time updates instead of polling
  const { isConnected: isWebSocketConnected } = useWebSocket({
    workspaceId: workspace?.id || null,
    onConnect: () => logger.info("[ChatPage] WebSocket connected"),
    onDisconnect: () => logger.warn("[ChatPage] WebSocket disconnected"),
    onError: (error) => logger.error("[ChatPage] WebSocket error:", error),
  })

  const { selectedChat, setSelectedChat } = useChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [isWorkspaceChanging, setIsWorkspaceChanging] = useState(false) // 🆕 Loading per workspace change
  const [, setSearchParams] = useSearchParams() // Only need setter, we read from searchParams above
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollContainerRef = useRef<HTMLDivElement>(null) // 📍 Ref for scroll preservation
  const hasCompletedChatDataRef = useRef(false) // 🔥 Traccia se abbiamo completato i dati della chat
  const hasResetOnMountRef = useRef(false) // 🔥 Traccia se abbiamo fatto il reset iniziale

  const [clientSearchTerm, setClientSearchTerm] = useState(
    searchParams.get("client") || ""
  )
  const initialLoadRef = useRef(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showFlowDialog, setShowFlowDialog] = useState(false)
  const [selectedFlowMessage, setSelectedFlowMessage] =
    useState<Message | null>(null)

  const {
    chats,
    isLoading: isLoadingChats,
    updateActiveChatbot,
    refetch: refetchChats,
    enableFetching,
  } = useChatList()

  // 🆕 Enable chat list fetching when entering this page
  useEffect(() => {
    enableFetching()
  }, [enableFetching])

  const [hasToggledChatbot, setHasToggledChatbot] = useState(false)
  const [isBlocking, setIsBlocking] = useState(false)
  const { isChatbotActive, setIsChatbotActive } = useChatList()

  // 🆕 Clean previous chat data when selectedChat changes
  const prevSelectedChatIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (selectedChat?.id !== prevSelectedChatIdRef.current) {
      // Clear previous chat's original data
      if (prevSelectedChatIdRef.current) {
        clearOriginalCustomerData(prevSelectedChatIdRef.current)
      }
      // 🔧 FIX: Reset messages when switching customers to avoid showing wrong chat
      setMessages([])
      logger.info(`🔄 Customer switched from ${prevSelectedChatIdRef.current} to ${selectedChat?.id}, messages cleared`)
      // Update ref
      prevSelectedChatIdRef.current = selectedChat?.id || null
    }
  }, [selectedChat?.id, clearOriginalCustomerData])

  // Keep chatbot state in sync with selected chat
  useEffect(() => {
    if (selectedChat) {
      setIsChatbotActive(selectedChat.activeChatbot ?? true)
    }
  }, [selectedChat, setIsChatbotActive])
  const [isInputDisabled, setIsInputDisabled] = useState(false)
  const [showActiveChatbotDialog, setShowActiveChatbotDialog] = useState(false)

  // 🆕 State for unified notification dialog (discount + chatbot + account changes)
  const [showNotificationDialog, setShowNotificationDialog] = useState(false)
  const [notificationChanges, setNotificationChanges] = useState<{
    discountChanged: boolean
    chatbotActivated: boolean
    accountActivated: boolean
    oldDiscount: number
    newDiscount: number
  } | null>(null)

  const [showPlaygroundDialog, setShowPlaygroundDialog] = useState(false)
  const queryClient = useQueryClient()

  // 🚨 RESET COMPLETO: Pulisce tutto quando si entra in ChatPage (UNA SOLA VOLTA)
  useEffect(() => {
    logger.info("[ChatPage] 🔄 RESET: Cleaning all data on mount")

    // 1. ✅ PRIMA verifica sessionStorage - se c'è un valore salvato, NON resettare MAI
    const savedChatId = storage.getSelectedChatId()

    if (!savedChatId) {
      logger.info("[ChatPage] Nessuna chat salvata, reset selectedChat")
      setSelectedChat(null)
      setMessages([])
    } else {
      logger.info(
        "[ChatPage] ✅ Chat salvata trovata in sessionStorage:",
        savedChatId,
        "- sarà ripristinata quando arrivano i dati"
      )
      // NON resettiamo selectedChat se c'è un valore salvato
      // Il ripristino vero avverrà nel useEffect che monitora chats
    }

    // 2. Pulisci URL params
    setSearchParams({})

    // 3. Invalida TUTTE le query per ricaricare dati freschi
    queryClient.invalidateQueries({ queryKey: ["chats", userSessionId] })
    queryClient.invalidateQueries({ queryKey: ["chat-messages"] })
    queryClient.invalidateQueries({ queryKey: ["recent-chats"] })

    logger.info("[ChatPage] ✅ RESET completed - ready for fresh data")
  }, []) // Solo al mount - SEMPRE si esegue quando torni alla pagina

  // Redirect to workspace selection if user has no workspace
  // ⚠️ CRITICAL: Give time for workspace to load from localStorage before redirecting
  useEffect(() => {
    if (!isWorkspaceLoading && !workspace) {
      // 🔍 Check if workspace exists in localStorage (might not be loaded yet)
      const storedWorkspace = storage.getWorkspace()
      if (!storedWorkspace) {
        // No workspace in localStorage → redirect to selection
        logger.warn("[ChatPage] ❌ No workspace found, redirecting to workspace selection")
        navigate("/workspace-selection")
      } else {
        // Workspace exists in localStorage but not loaded yet → wait
        logger.info("[ChatPage] ⏳ Workspace in localStorage, waiting for context to load...")
      }
    }
  }, [isWorkspaceLoading, workspace, navigate])

  // Callback when new message arrives - navigate to that chat
  const handleNewMessage = useCallback(
    (sessionId: string) => {
      // Update URL params
      const newParams = new URLSearchParams(searchParams)
      newParams.set("sessionId", sessionId)
      setSearchParams(newParams)

      // Invalidate messages query to force refresh
      queryClient.invalidateQueries({ queryKey: ["chat-messages", sessionId] })

      // Note: selectedChat will be updated by the useEffect that watches sessionId
    },
    [searchParams, setSearchParams, queryClient]
  )

  // 🔄 Use useLoadMoreMessages hook for manual pagination with "Load More" button
  const {
    messages: loadMoreMessages = [],
    hasMore,
    total,
    page,
    limit,
    isLoading: isLoadingMessages,
    isFetching,
    error: messagesError,
    loadMore,
    refetch: refetchMessages,
  } = useLoadMoreMessages(selectedChat?.sessionId || "", !!selectedChat, messagesScrollContainerRef)

  // 🔄 Use loaded messages for display
  const polledMessages = loadMoreMessages

  // Cross-tab sync disabled (using polling lock instead)
  const { notifyOtherTabs } = useChatSync()

  // Playground handlers
  const handlePlaygroundClick = () => setShowPlaygroundDialog(true)
  const handleClosePlayground = () => {
    setShowPlaygroundDialog(false)
    // Invalidate queries to refresh chat list
    queryClient.invalidateQueries({ queryKey: ["chats", userSessionId] })
    // Notify other tabs about the update
    notifyOtherTabs()
  }

  // Filter chats based on search term
  const filteredChats = clientSearchTerm
    ? chats.filter(
        (chat: Chat) =>
          chat.customerName
            ?.toLowerCase()
            .includes(clientSearchTerm.toLowerCase()) ||
          chat.customerPhone
            ?.toLowerCase()
            .includes(clientSearchTerm.toLowerCase()) ||
          chat.companyName
            ?.toLowerCase()
            .includes(clientSearchTerm.toLowerCase()) ||
          chat.lastMessage
            ?.toLowerCase()
            .includes(clientSearchTerm.toLowerCase())
      )
    : chats

  // SMART SELECTION: Auto-select when appropriate, but DON'T update existing selection
  useEffect(() => {
    // � PRIORITÀ 1: Ripristina da sessionStorage se disponibile
    if (chats.length > 0 && !selectedChat) {
      const savedChatId = storage.getSelectedChatId()

      if (savedChatId) {
        logger.info(
          "[ChatPage] 🔄 Ripristino chat da sessionStorage:",
          savedChatId
        )
        const savedChat = chats.find((c) => c.sessionId === savedChatId)

        if (savedChat) {
          logger.info(
            "[ChatPage] ✅ Chat trovata e ripristinata:",
            savedChat.customerName
          )
          selectChat(savedChat)
          return
        } else {
          logger.warn(
            "[ChatPage] ⚠️ Chat salvata non trovata nella lista, rimuovo da storage"
          )
          storage.clearSelectedChatId()
        }
      }
    }

    // �🔥 Se selectedChat ha solo sessionId (oggetto parziale da sessionStorage), completalo UNA VOLTA
    if (
      selectedChat?.sessionId &&
      !selectedChat.customerName &&
      chats.length > 0 &&
      !hasCompletedChatDataRef.current
    ) {
      logger.info("[ChatPage] Completing partial selectedChat with full data")
      const fullChat = chats.find((c) => c.sessionId === selectedChat.sessionId)
      if (fullChat) {
        setSelectedChat(fullChat)
        hasCompletedChatDataRef.current = true
        return
      } else {
        logger.warn(
          "[ChatPage] Chat not found in list:",
          selectedChat.sessionId
        )
      }
    }

    // 🚀 PRIORITÀ 2: Se c'è un filtro client, seleziona il primo risultato filtrato
    if (chats.length > 0 && !selectedChat && clientSearchTerm) {
      const clientChats = chats.filter(
        (chat) =>
          chat.customerName
            ?.toLowerCase()
            .includes(clientSearchTerm.toLowerCase()) ||
          chat.customerPhone
            ?.toLowerCase()
            .includes(clientSearchTerm.toLowerCase()) ||
          chat.companyName
            ?.toLowerCase()
            .includes(clientSearchTerm.toLowerCase())
      )

      if (clientChats.length > 0) {
        logger.info(
          "[ChatPage] 📍 Seleziono primo risultato filtro client:",
          clientChats[0].customerName
        )
        selectChat(clientChats[0])
        return
      }
    }

    // 🚀 PRIORITÀ 3: Fallback - seleziona il primo della lista solo se non c'è nulla di salvato
    if (filteredChats.length > 0 && !selectedChat && !clientSearchTerm) {
      logger.info(
        "[ChatPage] 📍 Nessuna chat salvata, seleziono il primo della lista:",
        filteredChats[0].customerName
      )
      selectChat(filteredChats[0])
      return
    }
  }, [chats, clientSearchTerm])

  // 🔑 Get workspaceId - prefer URL, fallback to localStorage, then context
  const workspaceId = effectiveWorkspaceId || workspace?.id

  // Fetch available languages
  const { data: availableLanguages = [] } = useQuery<Language[]>({
    queryKey: ["languages", workspaceId],
    queryFn: async () => getLanguages(),
    enabled: !!workspaceId,
    retry: false, // 🔥 FIX: Don't retry on session errors
  })

  // Sync polled messages with local state
  // This updates when the polling tab fetches new data
  useEffect(() => {
    if (polledMessages.length > 0 && selectedChat) {
      // 🔧 FIX: Deduplicate messages before setting state
      const seen = new Set<string>()
      const uniqueMessages = polledMessages.filter(msg => {
        if (seen.has(msg.id)) return false
        seen.add(msg.id)
        return true
      })
      setMessages(uniqueMessages)

      // 🔧 FIX: Re-fetch customer details to sync activeChatbot status
      // This ensures that when ContactOperator() is called, we update isChatbotActive
      if (selectedChat.customerId) {
        fetchCustomerDetails(selectedChat.customerId)
      }

      // Scroll to bottom only if user is already at bottom
      setTimeout(() => {
        if (messagesEndRef.current) {
          const container = messagesEndRef.current.parentElement
          if (container) {
            const isAtBottom =
              container.scrollHeight - container.scrollTop <=
              container.clientHeight + 100
            if (isAtBottom) {
              messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
            }
          }
        }
      }, 100)
    }
  }, [polledMessages, selectedChat])

  // Fetch selected chat details
  useEffect(() => {
    // 🚨 SAFETY: Skip if no chat selected, no workspace, or workspace is changing
    if (!selectedChat || !workspace?.id || isWorkspaceChanging) {
      logger.info(
        `[ChatPage] Skipping fetch - selectedChat: ${!!selectedChat}, workspace: ${!!workspace?.id}, changing: ${isWorkspaceChanging}`
      )
      return
    }

    // Load messages for the selected chat (initial load)
    fetchMessagesForChat(selectedChat)

    // Check for stored activeChatbot value and update the state
    if (selectedChat.customerId) {
      fetchCustomerDetails(selectedChat.customerId)
    }
  }, [selectedChat, workspace?.id, isWorkspaceChanging])

  // Function to load messages for a chat
  const fetchMessagesForChat = async (chat: Chat) => {
    // 🚨 SAFETY: Don't fetch during workspace change
    if (!workspaceId || isWorkspaceChanging) {
      logger.warn(
        "[fetchMessagesForChat] Skipping - workspace changing or no ID"
      )
      return
    }

    try {
      setLoadingChat(true)
      const sessionIdToUse = chat.sessionId || chat.id
      const response = await api.get(`/chat/${sessionIdToUse}/messages`)
      if (response.data.success) {
        // Transform backend messages to frontend format
        const transformedMessages = response.data.data.map((message: any) => ({
          id: message.id,
          content: message.content,
          // Map MessageDirection.INBOUND to 'customer' and MessageDirection.OUTBOUND to 'user'
          sender: message.direction === "INBOUND" ? "customer" : "user",
          timestamp: message.createdAt,
          agentName: message.metadata?.agentName || undefined,
          metadata: message.metadata, // 🔧 AGGIUNTO! Ora il metadata viene passato correttamente
        }))

        // 🔧 FIX: Remove duplicate messages by ID before rendering
        const uniqueMessages = transformedMessages.filter(
          (message, index, self) =>
            index === self.findIndex((m) => m.id === message.id)
        )

        setMessages(uniqueMessages)
      }
    } catch (error) {
      logger.error("Error loading messages:", error)
    } finally {
      setLoadingChat(false)
    }
  }

  // Function to fetch customer details
  const fetchCustomerDetails = async (customerId: string) => {
    // 🚨 SAFETY: Don't fetch during workspace change or if no workspace/chat
    if (!workspaceId || !selectedChat || isWorkspaceChanging) {
      logger.warn(
        "[fetchCustomerDetails] Skipping - workspace changing or invalid state"
      )
      return
    }

    try {
      // 🚨 SAFETY CHECK: Verify workspace match before API call
      if (!workspace?.id) {
        logger.warn(
          "[fetchCustomerDetails] No workspace ID available, skipping"
        )
        return
      }

      const response = await api.get(
        `/workspaces/${workspaceId}/customers/${customerId}`
      )
      const customerData = response.data

      const chatbotStatus = customerData.activeChatbot !== false // Default to true if undefined

      // 🆕 SAVE ORIGINAL DATA to Context for change detection
      if (customerData) {
        saveOriginalCustomerData(customerId, {
          discount: customerData.discount || 0,
          activeChatbot: chatbotStatus,
          isBlacklisted: customerData.isBlacklisted || false,
        })
      }

      // 🔧 FIX: Update BOTH context and local state
      updateActiveChatbot(selectedChat.id, chatbotStatus)
      setIsChatbotActive(chatbotStatus) // Update local state immediately
    } catch (error) {
      logger.error("Error fetching customer details:", error)
    }
  }

  // Function to handle toggling the chatbot
  const handleActiveChatbotToggle = async (checked: boolean) => {
    if (!selectedChat || !workspaceId) return

    // If turning off the chatbot and first time, show confirmation dialog
    if (!checked && hasToggledChatbot === false) {
      setShowActiveChatbotDialog(true)
      return
    }

    if (checked) {
      setHasToggledChatbot(true)
      await updateActiveChatbotStatus(true)
      return
    }

    await updateActiveChatbotStatus(false)
  }

  // Function to confirm turning off the chatbot
  const handleActiveChatbotConfirm = async () => {
    setHasToggledChatbot(true)
    setShowActiveChatbotDialog(false)
    await updateActiveChatbotStatus(false)
  }

  // 🆕 Unified notification handler (for both discount and chatbot changes)
  const handleNotificationConfirm = async (shouldNotify: boolean) => {
    setShowNotificationDialog(false)

    if (!selectedChat || !workspaceId) {
      window.location.reload()
      return
    }

    const customerId = selectedChat.customerId

    try {
      console.log('📋 handleNotificationConfirm called:', {
        shouldNotify,
        notificationChanges,
        customerId,
        workspaceId,
      })

      // If chatbot was activated, update it even if not sending notification
      if (notificationChanges?.chatbotActivated && !shouldNotify) {
        console.log('❌ Path: chatbotActivated=true but shouldNotify=false → save only')
        await updateActiveChatbotStatus(true, false)
        return
      }

      if (!shouldNotify) {
        console.log('❌ Path: shouldNotify=false → reload')
        // User clicked "Skip" for other notifications - reload to show updated data
        window.location.reload()
        return
      }
      
      console.log('✅ Path: shouldNotify=true → processing notifications...')

      // Send discount notification if changed
      if (notificationChanges?.discountChanged) {
        await pushNotificationService.sendDiscountChange(
          workspaceId,
          [customerId],
          notificationChanges.newDiscount
        )
        toast.success(
          `Discount notification sent (${notificationChanges.newDiscount}%)`,
          { duration: 2000 }
        )
      }

      // 🔔 Send chatbot reactivation notification
      if (notificationChanges?.chatbotActivated) {
        console.log('🚀 SENDING CHATBOT REACTIVATION:', { workspaceId, customerId })
        await pushNotificationService.sendChatbotReactivation(workspaceId, [
          customerId,
        ])
        console.log('✅ CHATBOT REACTIVATION SENT')
        toast.success("Chatbot reactivation notification sent", {
          duration: 2000,
        })
      }

      // Send account activation notification if unblocked
      if (notificationChanges?.accountActivated) {
        await pushNotificationService.sendAccountActivation(workspaceId, [
          customerId,
        ])
        toast.success("Account activation notification sent", {
          duration: 2000,
        })
      }

      // NO FETCH HERE - data already updated by handleSaveCustomer!
      // Calling fetchCustomerDetails here causes infinite loop because it triggers re-render
    } catch (error) {
      logger.error("Error sending notification:", error)
      toast.error("Failed to send notification", { duration: 2000 })
    } finally {
      setNotificationChanges(null)
      // Reload page to show updated data
      window.location.reload()
    }
  }

  // Function to update the activeChatbot status in the backend
  const updateActiveChatbotStatus = async (
    status: boolean,
    shouldNotify: boolean = false
  ) => {
    if (!selectedChat?.customerId || !workspaceId) return

    try {
      logger.info(`🔄 Updating chatbot status to ${status} for customer ${selectedChat.customerId}`)
      
      // Update the customer in the backend
      const response = await api.put(
        `/workspaces/${workspaceId}/customers/${selectedChat.customerId}`,
        { activeChatbot: status }
      )

      logger.info(`✅ API Response:`, response.status, response.data)

      // Reload page immediately to get fresh data from server
      setTimeout(() => {
        window.location.reload()
      }, 300)
    } catch (error) {
      logger.error("❌ Error updating chatbot status:", error)
      toast.error("Failed to update chatbot status")
    }
  }

  // Function to select a chat
  const selectChat = (chat: Chat) => {
    setSelectedChat(chat)
    // 💾 Salva l'ID della chat selezionata in sessionStorage
    if (chat?.sessionId) {
      storage.setSelectedChatId(chat.sessionId)
      // 🔔 Store current chat sessionId for WebSocket toast notifications
      storage.setCurrentChatSessionId(chat.sessionId)
      logger.info(
        "[ChatPage] Saved selectedChatId to sessionStorage:",
        chat.sessionId
      )
    }
    // Preserve client search term if present
    const newParams = new URLSearchParams(searchParams)
    if (clientSearchTerm) {
      newParams.set("client", clientSearchTerm)
    } else {
      newParams.delete("client")
    }
    setSearchParams(newParams)

    // Salva la chat selezionata nello storage centralizzato
    storage.setSelectedChat(chat)

    // Reset unread count when selecting a chat
    if (chat.unreadCount > 0) {
      // Get chat sessionId for API call
      const chatSessionId = chat.sessionId || chat.id
      // Call API to mark messages as read
      api
        .post(`/chat/${chatSessionId}/mark-read`)
        .then((response) => {
          if (response.data.success) {
            // Invalidate chat queries to refresh unread counts
            queryClient.invalidateQueries({
              queryKey: ["chats", userSessionId],
            })
          } else {
            logger.error("Failed to mark messages as read")
          }
        })
        .catch((err) => {
          logger.error("Error marking messages as read:", err)
        })
    }
  }

  // Handle chat deletion
  const handleDeleteChat = () => {
    if (!selectedChat) return
    setShowDeleteDialog(true)
  }

  // Handle chat deletion confirmation
  const handleDeleteConfirm = async () => {
    if (!selectedChat) return

    // Validate that we have a valid sessionId
    const sessionIdToDelete = selectedChat.sessionId || selectedChat.id
    if (!sessionIdToDelete) {
      logger.error("No valid session ID found for chat deletion:", selectedChat)
      toast.error("Cannot delete chat: Invalid session ID", { duration: 1000 })
      setShowDeleteDialog(false)
      return
    }

    try {
      setLoading(true)
      const response = await api.delete(`/chat/${sessionIdToDelete}`)

      if (response.data.success) {
        toast.success("Chat deleted successfully", { duration: 1000 })
        // Invalidate chat queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["chats", userSessionId] })
        setSelectedChat(null)
        // 🚨 REMOVED: No longer using sessionId in URL
      } else {
        toast.error(
          "Failed to delete chat: " + (response.data.error || "Unknown error"),
          { duration: 1000 }
        )
      }
    } catch (error) {
      logger.error("Error deleting chat:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to delete chat",
        { duration: 1000 }
      )
    } finally {
      setLoading(false)
      setShowDeleteDialog(false)
    }
  }

  // Handle customer edit
  const handleEditCustomer = () => {
    if (!selectedChat) return
    setShowEditSheet(true)
  }

  // Handle customer save after edit
  const handleSaveCustomer = async (
    customerData: any,
    clientId?: string,
    changes?: any
  ) => {
    if ((!selectedChat?.customerId && !clientId) || !workspaceId) return

    try {
      setLoading(true)

      // Use clientId if provided, otherwise use selectedChat.customerId
      const customerId = clientId || selectedChat?.customerId

      // Endpoint for the customer update
      const endpoint = `/workspaces/${workspaceId}/customers/${customerId}`

      // Make API call with PUT method to update customer
      const response = await api.put(endpoint, customerData)

      if (response.status === 200) {
        // ✅ Show success toast
        toast.success("Customer updated successfully", { duration: 2000 })

        // 🆕 Show notification popup if changes detected by ClientSheet
        if (
          changes &&
          (changes.discountChanged ||
            changes.chatbotActivated ||
            changes.accountActivated)
        ) {
          setNotificationChanges({
            discountChanged: changes.discountChanged,
            chatbotActivated: changes.chatbotActivated,
            accountActivated: changes.accountActivated,
            oldDiscount: changes.oldDiscount,
            newDiscount: changes.newDiscount,
          })
          setTimeout(() => {
            setShowNotificationDialog(true)
          }, 500) // Wait for toast to appear first
          // ✅ Close edit sheet AFTER showing notification dialog
          setShowEditSheet(false)
        } else {
          // ✅ No changes detected - close sheet immediately
          setShowEditSheet(false)
        }

        logger.info("✅ Customer updated successfully")
      } else {
        toast.error(
          "Failed to update customer: " +
            (response.data?.error || "Unknown error"),
          { duration: 1000 }
        )
        // ✅ Close sheet even on error
        setShowEditSheet(false)
      }
    } catch (error) {
      logger.error("Error updating customer:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update customer",
        { duration: 1000 }
      )
      // ✅ Close sheet on error
      setShowEditSheet(false)
    } finally {
      setLoading(false)
      // Flag will be reset in handleNotificationConfirm when dialog closes
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) {
      return "Data non disponibile"
    }

    try {
      const date = new Date(dateString)

      if (isNaN(date.getTime())) {
        return "Data non valida"
      }

      return date.toLocaleString("it-IT", {
        year: "2-digit", // 🔧 2-digit for consistency
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit", // 🔧 NEW: Add seconds
      })
    } catch (e) {
      return "Errore nella formattazione data"
    }
  }

  // Handle submitting a new message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !selectedChat || loading) {
      return
    }

    if (!workspace?.id) {
      logger.error("❌ No workspace ID available!")
      toast.error("No workspace selected", { duration: 1000 })
      return
    }

    // Disable chatbot automatically when agent takes control by typing
    if (isChatbotActive) {
      // Only show the dialog if it hasn't been shown before
      if (!hasToggledChatbot) {
        setShowActiveChatbotDialog(true)
      } else {
        // Otherwise just update the status directly
        await updateActiveChatbotStatus(false)
      }
    }

    try {
      setLoading(true)

      // For operator messages, don't add temporary message to avoid duplication
      // We'll add the message only when we get the response from the server
      let tempMessage: Message | null = null

      if (isChatbotActive) {
        // Only add temp message if chatbot is active (AI responses)
        tempMessage = {
          id: `temp-${Date.now()}`,
          content: messageInput,
          sender: "user",
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, tempMessage])
      }

      setMessageInput("") // Clear input field

      // Send message to API
      const sessionIdToUse = selectedChat.sessionId || selectedChat.id

      // Verify headers manually
      const headers = {
        "Content-Type": "application/json",
        "x-workspace-id": workspace?.id,
      }

      let response
      try {
        response = await api.post(
          `/chat/${sessionIdToUse}/send`,
          {
            content: messageInput,
            sender: "user",
          },
          {
            headers: headers,
          }
        )
      } catch (requestError) {
        logger.error(`❌ POST request failed`, {
          error: requestError,
          message: requestError?.message,
          response: requestError?.response,
          status: requestError?.response?.status,
          config: requestError?.config,
          requestHeaders: requestError?.config?.headers,
        })
        throw requestError // Re-throw to be caught by outer catch
      }

      if (!response.data.success) {
        toast.error("Failed to send message", { duration: 1000 })
        // Remove the temporary message only if it exists
        if (tempMessage) {
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id))
        }
      } else {
        // Handle response differently based on whether we have a temp message or not
        const responseMessages = Array.isArray(response.data.data)
          ? response.data.data
          : [response.data.data]

        const transformedMessages = responseMessages.map((message: any) => ({
          id: message.id,
          content: message.content,
          sender: message.direction === "INBOUND" ? "customer" : "user",
          timestamp: message.createdAt || new Date().toISOString(),
          agentName: message.metadata?.agentName,
          metadata: message.metadata, // Include full metadata for operator messages
        }))

        if (tempMessage) {
          // Replace temp message with actual message from server (AI responses)
          setMessages((prev) => {
            const withoutTemp = prev.filter((msg) => msg.id !== tempMessage.id)
            const combined = [...withoutTemp, ...transformedMessages]
            // 🔧 FIX: Remove duplicates by ID
            return combined.filter(
              (message, index, self) =>
                index === self.findIndex((m) => m.id === message.id)
            )
          })
        } else {
          // Just add the operator message directly (manual operator mode)
          setMessages((prev) => {
            const combined = [...prev, ...transformedMessages]
            // 🔧 FIX: Remove duplicates by ID
            return combined.filter(
              (message, index, self) =>
                index === self.findIndex((m) => m.id === message.id)
            )
          })
        }

        // Update chat list to reflect new message
        queryClient.invalidateQueries({ queryKey: ["chats", userSessionId] })

        // Notify other tabs about the update
        notifyOtherTabs()
      }
    } catch (error) {
      logger.error("❌ Error sending message:", error)
      logger.error("Error details:", {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        config: error?.config,
      })
      toast.error("Failed to send message", { duration: 1000 })
    } finally {
      setLoading(false)
    }
  }

  // Scroll to bottom of messages when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Handle blocking/unblocking a user
  const handleBlockUser = async () => {
    if (!selectedChat || !workspaceId) return

    const isCurrentlyBlocked = selectedChat.isBlacklisted
    const action = isCurrentlyBlocked ? "unblock" : "block"

    setIsBlocking(true)
    try {
      const response = await api.post(
        `/workspaces/${workspaceId}/customers/${selectedChat.customerId}/${action}`
      )

      if (response.status === 200) {
        // Update the chat in the context and invalidate queries
        queryClient.invalidateQueries({ queryKey: ["chats", userSessionId] })
        if (!selectedChat) return
        setSelectedChat({ ...selectedChat, isBlacklisted: !isCurrentlyBlocked })

        toast.success(
          `${selectedChat.customerName} has been ${
            isCurrentlyBlocked ? "unblocked" : "blocked"
          }`,
          {
            duration: 1000,
          }
        )
      }
    } catch (error) {
      logger.error(`Error ${action}ing user:`, error)
      toast.error(`Failed to ${action} user`, { duration: 1000 })
    } finally {
      setIsBlocking(false)
      setShowBlockDialog(false)
    }
  }

  // BLOCK UI if multiple tabs detected - fullscreen overlay with NO menu/header
  if (isTabBlocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-100">
        <Card className="p-12 max-w-2xl text-center shadow-2xl">
          <div className="mb-6">
            <Ban className="h-24 w-24 text-red-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-red-600 mb-2">
              ⛔ TAB BLOCKED
            </h2>
            <p className="text-xl text-gray-700 mb-4">
              Another tab is already using the chat
            </p>
          </div>
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
            <p className="text-lg font-semibold text-yellow-800 mb-2">
              ⚠️ Only ONE tab can be used at a time
            </p>
            <p className="text-gray-700">
              Please close the other tab to use this one.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <PageLayout selectedChat={selectedChat}>
      {/* 🔄 Loading Overlay durante cambio workspace */}
      {isWorkspaceChanging && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <div className="text-lg font-semibold">Switching workspace...</div>
            <div className="text-sm text-gray-500">Loading fresh data</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-12rem)]">
        {/* Chat List - Vertical Sidebar */}
        <div className="col-span-3 flex flex-col gap-3 h-full min-h-0">
          {/* Channel Logo & Name */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
            {workspace?.logoUrl ? (
              <img
                src={workspace.logoUrl.startsWith('http') ? workspace.logoUrl : `${IMG_BASE_URL}${workspace.logoUrl}`}
                alt={workspace.name}
                className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-md"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl shadow-md">
                {workspace?.name?.charAt(0).toUpperCase() || 'C'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">
                {workspace?.name || 'Channel'}
              </h2>
              <p className="text-xs text-gray-500">
                {workspace?.sellsProductsAndServices ? 'E-commerce' : 'Info'}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <Input
            type="search"
            placeholder="Search chats..."
            value={clientSearchTerm}
            className="h-8 text-sm w-full max-w-[calc(100%-50px)]"
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams)
              if (e.target.value) {
                newParams.set("client", e.target.value)
              } else {
                newParams.delete("client")
              }
              setSearchParams(newParams)
              setClientSearchTerm(e.target.value)
            }}
          />
          
          {/* WebSocket Status */}
          <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
            <div
              className={`w-2 h-2 rounded-full ${
                isWebSocketConnected ? "bg-green-500" : "bg-red-500"
              } ${isWebSocketConnected ? "animate-pulse" : ""}`}
            />
            <span>
              {isWebSocketConnected ? "Real-time" : "Connecting..."}
            </span>
          </div>
          
          {/* Chat List */}
          <div className="flex-1 min-h-0 overflow-y-auto chat-scrollbar">
          <div className="flex flex-col gap-2">
            {chats.length > 0 ? (
              chats.map((chat: Chat) => {
                // Compare sessionId instead of id
                const isSelected = selectedChat?.sessionId === chat.sessionId

                return (
                  <Card
                    key={chat.id}
                    className={`p-3 cursor-pointer transition-all flex-shrink-0 w-64
                      ${
                        isSelected
                          ? chat.activeChatbot === false
                            ? "border-t-4 border-orange-500 bg-orange-100 text-orange-800 font-bold"
                            : "border-t-4 border-green-600 bg-green-50 text-green-800 font-bold"
                          : chat.activeChatbot === false
                          ? "border-t-4 border-orange-300 bg-orange-50 text-orange-700"
                          : "border-t-0 bg-white text-gray-900"
                      }
                      ${
                        !isSelected
                          ? chat.activeChatbot === false
                            ? "hover:bg-orange-100"
                            : "hover:bg-gray-50"
                          : ""
                      }
                      ${
                        loadingChat && isSelected
                          ? "opacity-70 pointer-events-none"
                          : ""
                      }`}
                    onClick={() => selectChat(chat)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        {/* Prima riga: bandiera + nome + icone stato */}
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-sm flex-shrink-0"
                            title={`Language: ${chat.language || "Unknown"}`}
                          >
                            {getLanguageFlag(chat.language)}
                          </span>
                          <div className="font-semibold text-green-700 text-sm truncate">
                            {chat.customerName}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Manual operator icon if chatbot is disabled */}
                            {chat.activeChatbot === false && (
                              <span title="Manual Operator Control">
                                <Bot className="h-3 w-3 text-orange-500" />
                              </span>
                            )}
                            {/* Blocked user indicator */}
                            {chat.isBlacklisted && (
                              <span title="Customer is blocked">
                                <Ban className="h-3 w-3 text-red-500" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Seconda riga: azienda */}
                        {chat.companyName && (
                          <div className="text-xs text-gray-600 truncate mb-1">
                            {chat.companyName}
                          </div>
                        )}

                        {/* Terza riga: telefono */}
                        <div className="text-xs text-green-600 mb-1">
                          {chat.customerPhone}
                        </div>

                        {/* Quarta riga: ultimo messaggio + timestamp */}
                        <div className="flex justify-between items-center">
                          <div
                            className="text-xs text-gray-600 truncate flex-1 mr-2"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {chat.lastMessage}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <p className="text-[10px] text-gray-400">
                              {formatDate(chat.lastMessageTime)}
                            </p>
                            {chat.unreadCount > 0 && (
                              <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                {chat.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                {isLoadingChats ? (
                  <>
                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin mb-3" />
                    <p className="text-sm text-gray-500">Loading chats...</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">No chats yet</h3>
                    <p className="text-xs text-gray-500 max-w-[200px]">
                      When customers message you on WhatsApp, their conversations will appear here
                    </p>
                  </>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Chat Messages - Right Side */}
        <Card className="col-span-9 p-4 flex flex-col h-full min-h-0">
          {selectedChat ? (
            <>
              {/* 🚨 BANNERS ROW - Manual Control + Blocked Customer */}
              {(!isChatbotActive || selectedChat.isBlacklisted) && (
                <div className="flex gap-2 mb-2">
                  {/* 🚨 OPERATOR CONTROL BANNER */}
                  {!isChatbotActive && (
                    <div className={`bg-orange-100 border-l-4 border-orange-500 p-3 ${selectedChat.isBlacklisted ? 'flex-1' : 'w-full'}`}>
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Bot className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-orange-700 font-medium">
                            <strong>Manual Operator Control</strong>
                          </p>
                          <p className="text-xs text-orange-600 mt-1">
                            AI chatbot disabled. Messages saved but no AI responses.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🚫 CUSTOMER BLOCKED BANNER */}
                  {selectedChat.isBlacklisted && (
                    <div className={`bg-red-100 border-l-4 border-red-500 p-3 ${!isChatbotActive ? 'flex-1' : 'w-full'}`}>
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Ban className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700 font-medium">
                            <strong>Customer Blocked</strong>
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            Blacklisted. Cannot send new messages.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Header - Nome + controlli (senza telefono e società) */}
              <div className="flex justify-between items-center pb-2 border-b h-[60px]">
                <div
                  className="flex items-center cursor-pointer group"
                  onClick={handleEditCustomer}
                >
                  <h2 className="font-bold text-sm text-green-700">
                    {selectedChat.customerName}
                  </h2>
                  <Pencil className="h-3 w-3 ml-1 text-green-600 group-hover:text-green-700 transition-colors" />
                </div>
                <div className="flex space-x-2 items-center">
                  {/* ChatBot Toggle */}
                  <div className="flex items-center mr-2">
                    <Bot
                      className={`h-4 w-4 mr-1 ${
                        isChatbotActive ? "text-green-600" : "text-gray-400"
                      }`}
                    />
                    <Switch
                      className="mr-1"
                      checked={isChatbotActive}
                      onCheckedChange={handleActiveChatbotToggle}
                      title={
                        isChatbotActive ? "Disable chatbot" : "Enable chatbot"
                      }
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBlockDialog(true)}
                    className={
                      selectedChat?.isBlacklisted
                        ? "hover:bg-green-50 h-10 w-10 p-0"
                        : "hover:bg-orange-50 h-10 w-10 p-0"
                    }
                    title={
                      selectedChat?.isBlacklisted
                        ? "Unblock User"
                        : "Block User"
                    }
                  >
                    {selectedChat?.isBlacklisted ? (
                      <Lock className="h-5 w-5 text-green-600" />
                    ) : (
                      <Ban className="h-5 w-5 text-orange-600" />
                    )}
                  </Button>
                  <Button
                    id="delete-chat-button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteChat}
                    className="hover:bg-red-50 h-10 w-10 p-0"
                    title="Delete Chat"
                  >
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </Button>
                </div>
              </div>

              {/* Chat Messages */}
              <div
                ref={messagesScrollContainerRef}
                className="chat-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-2 bg-white"
              >
                {/* 📋 Load Button - Shows when there are more messages available */}
                {hasMore && messages.length > 0 && (
                  <div className="flex justify-center mb-4 mt-2">
                    <Button
                      onClick={loadMore}
                      disabled={isFetching}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {isFetching ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        `Load (${total} total, page ${page})`
                      )}
                    </Button>
                  </div>
                )}

                {messages.length > 0 ? (
                  messages.map((message) => {
                    // Using the sender field which is properly mapped from direction
                    const isAgentMessage = message.sender === "user"
                    const isCustomerMessage = message.sender === "customer"

                    // 🚨 ANDREA'S OPERATOR CONTROL INDICATORS
                    // Correct logic:
                    const isChatbotMessage =
                      isAgentMessage &&
                      (message.metadata?.agentSelected?.startsWith(
                        "CHATBOT_"
                      ) ||
                        message.metadata?.agentSelected === "LLM" ||
                        message.metadata?.agentSelected === "AI" ||
                        message.metadata?.agentSelected === "AI_AGENT")

                    // Only EXPLICIT operator messages should be blue
                    const isOperatorMessage =
                      isAgentMessage &&
                      (message.metadata?.agentSelected === "MANUAL_OPERATOR" ||
                        message.metadata?.isOperatorMessage === true ||
                        message.metadata?.sentBy === "HUMAN_OPERATOR")

                    const isOperatorControl =
                      message.metadata?.isOperatorControl === true
                    const isManualOperator =
                      message.metadata?.agentSelected === "MANUAL_OPERATOR" ||
                      message.metadata?.agentSelected ===
                        "MANUAL_OPERATOR_CONTROL" ||
                      message.metadata?.sentBy === "HUMAN_OPERATOR"

                    const getMessageStyle = () => {
                      if (!isAgentMessage) {
                        return isOperatorControl
                          ? "bg-orange-50 text-orange-900 border-l-4 border-orange-400" // Customer under control
                          : "bg-gray-100 text-gray-800" // Normal customer
                      }

                      // SE C'È IL BADGE CHATBOT → VERDE (controllo anche agentName)
                      if (
                        message.metadata?.agentSelected === "CHATBOT" ||
                        message.metadata?.agentSelected?.startsWith(
                          "CHATBOT_"
                        ) ||
                        message.metadata?.agentSelected === "AI" ||
                        message.metadata?.agentSelected === "LLM" ||
                        message.agentName
                      ) {
                        // Se ha agentName è un chatbot!
                        return "bg-green-100 text-green-900 border-l-4 border-green-500" // CHATBOT → VERDE
                      }

                      if (
                        message.metadata?.agentSelected === "MANUAL_OPERATOR"
                      ) {
                        return "bg-blue-100 text-blue-900 border-l-4 border-blue-500" // MANUAL_OPERATOR → BLU
                      }

                      // Default fallback
                      return "bg-gray-100 text-gray-800"
                    }

                    return (
                      <div
                        key={message.id}
                        data-message-id={message.id}
                        className={`flex mb-4 ${
                          isAgentMessage ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`p-3 rounded-lg max-w-[75%] relative ${
                            isOperatorMessage || isOperatorControl || isManualOperator 
                              ? 'pt-6' 
                              : ''
                          } ${getMessageStyle()}`}
                        >
                          {/* 🚨 OPERATOR CONTROL BADGE */}
                          {(isOperatorMessage ||
                            isOperatorControl ||
                            isManualOperator) && (
                            <div className="absolute -top-2 -right-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium ${
                                  isOperatorMessage
                                    ? "bg-blue-500 text-white"
                                    : "bg-orange-500 text-white"
                                }`}
                              >
                                👨‍💼 {isOperatorMessage ? "OPERATOR" : "MANUAL"}
                              </span>
                            </div>
                          )}

                          <div
                            className="break-words"
                            style={{ lineHeight: "1.7", fontSize: "0.95rem" }}
                          >
                            <MessageRenderer
                              content={message.content}
                              variant="chat"
                            />
                          </div>

                          <div className="flex justify-end items-center mt-1">
                            <div className="flex items-center gap-1">
                              {/* � View Flow Button - ONLY for bot messages with debugInfo */}
                              {isAgentMessage &&
                                message.metadata?.debugInfo && (
                                  <button
                                    onClick={() => {
                                      setSelectedFlowMessage(message)
                                      setShowFlowDialog(true)
                                    }}
                                    className="text-[10px] font-medium bg-purple-100 hover:bg-purple-200 text-purple-800 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                    title="View message flow through multi-agent system"
                                  >
                                    <Eye className="w-3 h-3" />
                                    View Flow
                                  </button>
                                )}

                              {/* 📋 Manual Control Badge */}
                              {isOperatorControl && (
                                <span className="text-[10px] font-medium bg-orange-200 text-orange-800 px-2 py-0.5 rounded ml-2">
                                  📋 Under Manual Control
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    {loadingChat ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-green-600 mb-2" />
                        <p className="text-sm">Loading messages...</p>
                      </>
                    ) : (
                      <p className="text-sm">No messages yet</p>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input: Only show if chatbot is disabled */}
              {!isChatbotActive && (
                <div className="mt-2 flex gap-2">
                  <Textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={
                      selectedChat?.isBlacklisted
                        ? "Cannot send messages to blocked customer"
                        : "Type your message..."
                    }
                    className="min-h-[40px] resize-none text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e)
                      }
                    }}
                    disabled={loading || selectedChat?.isBlacklisted}
                  />
                  <Button
                    onClick={(e) => handleSubmit(e)}
                    className="self-end h-8 w-8 p-0"
                    size="sm"
                    disabled={loading || selectedChat?.isBlacklisted}
                  >
                    {loading ? (
                      <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              {isLoadingChats ? (
                <>
                  <Loader2 className="h-12 w-12 text-gray-300 animate-spin mb-4" />
                  <p className="text-gray-500">Loading conversations...</p>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-gradient-to-br from-green-50 to-green-100 rounded-full flex items-center justify-center mb-6">
                    <MessageSquare className="h-12 w-12 text-green-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">No conversations yet</h2>
                  <p className="text-gray-500 max-w-md mb-6">
                    Your WhatsApp conversations will appear here. When customers send messages to your business number, you'll be able to view and respond to them.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Waiting for incoming messages...</span>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Chat"
        description={`Are you sure you want to delete the chat with ${selectedChat?.customerName}? This action cannot be undone and all messages will be lost.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />

      {/* Active Chatbot Confirmation Dialog */}
      <ConfirmDialog
        open={showActiveChatbotDialog}
        onOpenChange={setShowActiveChatbotDialog}
        title="Disable Chatbot"
        description={`Are you sure you want to disable the chatbot for ${selectedChat?.customerName}? You will need to manually respond to their messages. You can re-enable it later.`}
        onConfirm={handleActiveChatbotConfirm}
        confirmLabel="Disable"
        cancelLabel="Cancel"
        variant="destructive"
      />

      {/* 🆕 Unified Notification Dialog (Discount + Chatbot changes) */}
      <NotificationDialog
        open={showNotificationDialog}
        onOpenChange={setShowNotificationDialog}
        title="Send Notification?"
        description={(() => {
          const changes = []
          if (notificationChanges?.discountChanged) {
            changes.push(`new discount (${notificationChanges.newDiscount}%)`)
          }
          if (notificationChanges?.chatbotActivated) {
            changes.push("chatbot activation")
          }
          if (notificationChanges?.accountActivated) {
            changes.push("account reactivation")
          }

          if (changes.length === 0) {
            return "Send notification to customer?"
          }

          const changesText = changes.join(" and ")
          return `Would you like to notify ${selectedChat?.customerName} about the ${changesText}?`
        })()}
        confirmText="Yes, notify user"
        cancelText="No, just save"
        onConfirm={() => handleNotificationConfirm(true)}
        onCancel={() => handleNotificationConfirm(false)}
      />

      {/* Block User Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedChat?.isBlacklisted ? "Unblock User" : "Block User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedChat?.isBlacklisted
                ? `Are you sure you want to unblock ${selectedChat?.customerName}? They will be able to send messages to your chatbot again.`
                : `Are you sure you want to block ${selectedChat?.customerName}? They will no longer be able to send messages to your chatbot.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockUser}
              disabled={isBlocking}
              className={
                selectedChat?.isBlacklisted
                  ? "bg-green-600 hover:bg-green-700 focus:ring-green-600"
                  : "bg-red-600 hover:bg-red-700 focus:ring-red-600"
              }
            >
              {isBlocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {selectedChat?.isBlacklisted
                    ? "Unblocking..."
                    : "Blocking..."}
                </>
              ) : selectedChat?.isBlacklisted ? (
                "Unblock"
              ) : (
                "Block"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Edit Sheet */}
      <ClientSheet
        client={selectedChat ? selectedChat.customerId : null}
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        onSubmit={handleSaveCustomer}
        mode="edit"
        availableLanguages={
          Array.isArray(availableLanguages)
            ? availableLanguages.map((lang) => lang.name || "")
            : []
        }
      />

      {/* WhatsApp Floating Button - stile OlaClick, solo su /chat e SOLO se debugMode=true */}
      {workspace?.debugMode === true && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={handlePlaygroundClick}
            className="bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 h-16 w-16 p-0 flex items-center justify-center group relative"
            title="Chat WhatsApp (Playground - Debug Mode)"
          >
            <WhatsAppIcon className="h-8 w-8 text-white transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></div>
            <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              Playground (Debug Mode)
            </div>
          </Button>
        </div>
      )}
      <WhatsAppChatModal
        isOpen={showPlaygroundDialog}
        onClose={handleClosePlayground}
        onMessageSent={refetchChats}
        channelName="WhatsApp Chat"
        phoneNumber={workspace?.whatsappPhoneNumber}
        workspaceId={workspace?.id}
        selectedChat={selectedChat as any}
      />

      {/* Message Flow Dialog */}
      {selectedFlowMessage?.metadata?.debugInfo && (
        <MessageFlowDialog
          isOpen={showFlowDialog}
          onClose={() => setShowFlowDialog(false)}
          debugInfo={
            typeof selectedFlowMessage.metadata.debugInfo === "string"
              ? JSON.parse(selectedFlowMessage.metadata.debugInfo)
              : selectedFlowMessage.metadata.debugInfo
          }
        />
      )}
    </PageLayout>
  )
}
