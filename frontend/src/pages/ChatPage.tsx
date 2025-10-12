import { CartIframePopup } from "@/components/CartIframePopup"
import { PageLayout } from "@/components/layout/PageLayout"
import { ClientSheet } from "@/components/shared/ClientSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { MessageRenderer } from "@/components/shared/MessageRenderer"
import { WhatsAppChatModal } from "@/components/shared/WhatsAppChatModal"
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon"
import { useChat } from "@/contexts/ChatContext"
import { useChatList } from "@/contexts/ChatListContext"
import { useWorkspace } from "@/hooks/use-workspace"
import { useChatSync } from "@/hooks/useChatSync"
import { useCurrentChatMessages } from "@/hooks/useCurrentChatMessages"
import { useWebSocket } from "@/hooks/useWebSocket"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { getLanguages, Language } from "@/services/workspaceApi"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Ban,
  Bot,
  Loader2,
  Lock,
  Pencil,
  Send,
  ShoppingCart,
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
  switch (language?.toLowerCase()) {
    case "it":
      return "🇮🇹"
    case "en":
      return "🇬🇧"
    case "es":
      return "🇪🇸"
    case "pt":
      return "🇵🇹"
    default:
      return "🌐"
  }
}

export function ChatPage() {
  // ChatPage loaded
  const { workspace, loading: isWorkspaceLoading } = useWorkspace()

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
  const [searchParams, setSearchParams] = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionId = searchParams.get("sessionId")

  // 🚨 FIX: Clear selectedChat and URL params when workspace changes
  const prevWorkspaceIdRef = useRef<string | undefined>(workspace?.id)
  useEffect(() => {
    if (
      workspace?.id &&
      prevWorkspaceIdRef.current &&
      workspace.id !== prevWorkspaceIdRef.current
    ) {
      logger.info(
        `[ChatPage] Workspace changed from ${prevWorkspaceIdRef.current} to ${workspace.id} - clearing selectedChat`
      )

      // Clear selected chat
      setSelectedChat(null)

      // Clear URL params
      setSearchParams({})

      // Clear messages
      setMessages([])
    }

    // Update ref for next comparison
    prevWorkspaceIdRef.current = workspace?.id
  }, [workspace?.id, setSelectedChat, setSearchParams])
  const [clientSearchTerm, setClientSearchTerm] = useState(
    searchParams.get("client") || ""
  )
  const initialLoadRef = useRef(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showCartPopup, setShowCartPopup] = useState(false)
  const [cartToken, setCartToken] = useState<string>("")
  const [isLoadingCartToken, setIsLoadingCartToken] = useState(false)

  // Function to get cart token for current customer
  const getCartToken = async (
    customerId: string,
    workspaceId: string
  ): Promise<string> => {
    try {
      setIsLoadingCartToken(true)

      const response = await api.post("/cart-tokens", {
        customerId,
        workspaceId,
      })

      if (response.data.success) {
        const token = response.data.data.token
        return token
      } else {
        throw new Error(response.data.error || "Failed to get cart token")
      }
    } catch (error) {
      logger.error("Error getting cart token:", error)
      toast.error("Failed to load customer cart", { duration: 1000 })
      throw error
    } finally {
      setIsLoadingCartToken(false)
    }
  }

  // Handle View Cart click
  const handleViewCart = async () => {
    if (!selectedChat || !workspace?.id) {
      toast.error("No customer or workspace selected", { duration: 1000 })
      return
    }

    try {
      const token = await getCartToken(selectedChat.customerId, workspace.id)
      setCartToken(token)
      setShowCartPopup(true)
    } catch (error) {
      // Error already handled in getCartToken
    }
  }
  const {
    chats,
    isLoading: isLoadingChats,
    updateActiveChatbot,
  } = useChatList()

  const [hasToggledChatbot, setHasToggledChatbot] = useState(false)
  const [isBlocking, setIsBlocking] = useState(false)
  const { isChatbotActive, setIsChatbotActive } = useChatList()

  // Keep chatbot state in sync with selected chat
  useEffect(() => {
    if (selectedChat) {
      setIsChatbotActive(selectedChat.activeChatbot ?? true)
    }
  }, [selectedChat, setIsChatbotActive])
  const [isInputDisabled, setIsInputDisabled] = useState(false)
  const [showActiveChatbotDialog, setShowActiveChatbotDialog] = useState(false)
  const [showActiveChatbotNotifyDialog, setShowActiveChatbotNotifyDialog] =
    useState(false)
  const navigate = useNavigate()
  const [showPlaygroundDialog, setShowPlaygroundDialog] = useState(false)
  const queryClient = useQueryClient()

  // 🚨 RESET COMPLETO: Pulisce tutto quando si entra in ChatPage
  useEffect(() => {
    logger.info("[ChatPage] 🔄 RESET: Cleaning all data on mount")

    // 1. Pulisci selected chat
    setSelectedChat(null)

    // 2. Pulisci messaggi
    setMessages([])

    // 3. Pulisci URL params
    setSearchParams({})

    // 4. Invalida TUTTE le query per ricaricare dati freschi
    queryClient.invalidateQueries({ queryKey: ["chats"] })
    queryClient.invalidateQueries({ queryKey: ["chat-messages"] })
    queryClient.invalidateQueries({ queryKey: ["recent-chats"] })

    logger.info("[ChatPage] ✅ RESET completed - ready for fresh data")
  }, []) // Solo al mount - no dependencies!

  // Redirect to workspace selection if user has no workspace
  useEffect(() => {
    if (!isWorkspaceLoading && !workspace) {
      navigate("/clients")
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

  // Polling with messages
  const { data: polledMessages = [], isLoading: isLoadingMessages } =
    useCurrentChatMessages(selectedChat?.sessionId || null, !!selectedChat)

  // Cross-tab sync disabled (using polling lock instead)
  const { notifyOtherTabs } = useChatSync()

  // Playground handlers
  const handlePlaygroundClick = () => setShowPlaygroundDialog(true)
  const handleClosePlayground = () => {
    setShowPlaygroundDialog(false)
    // Invalidate queries to refresh chat list
    queryClient.invalidateQueries({ queryKey: ["chats"] })
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
    // Only auto-select if we don't have a selection yet
    if (filteredChats.length > 0 && !selectedChat && !clientSearchTerm) {
      selectChat(filteredChats[0])
      return
    }

    // If we have a sessionId in URL, find that specific chat
    if (chats.length > 0 && !selectedChat) {
      if (sessionId) {
        const chatWithSessionId = chats.find(
          (chat) => chat.sessionId === sessionId
        )
        if (chatWithSessionId) {
          selectChat(chatWithSessionId)
          return
        }
      }

      // If we have a client search term, find chats for that client
      if (clientSearchTerm) {
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
          // Select the most recent chat for this client
          selectChat(clientChats[0])
          return
        }
      }
    }
  }, [chats, sessionId, clientSearchTerm])

  // Get workspaceId from workspace hook
  const workspaceId = workspace?.id

  // Fetch available languages
  const { data: availableLanguages = [] } = useQuery<Language[]>({
    queryKey: ["languages", workspaceId],
    queryFn: async () => getLanguages(),
    enabled: !!workspaceId,
  })

  // Sync polled messages with local state
  // This updates when the polling tab fetches new data
  useEffect(() => {
    if (polledMessages.length > 0 && selectedChat) {
      setMessages(polledMessages)

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
    if (selectedChat) {
      // Load messages for the selected chat (initial load)
      fetchMessagesForChat(selectedChat)

      // Check for stored activeChatbot value and update the state
      if (selectedChat.customerId) {
        fetchCustomerDetails(selectedChat.customerId)
      }
    }
  }, [selectedChat])

  // Function to load messages for a chat
  const fetchMessagesForChat = async (chat: Chat) => {
    if (!workspaceId) return

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

        setMessages(transformedMessages)
      } else {
        toast.error("Failed to load chat messages", { duration: 1000 })
      }
    } catch (error) {
      logger.error("Error loading messages:", error)
      toast.error("Failed to load chat messages", { duration: 1000 })
    } finally {
      setLoadingChat(false)
    }
  }

  // Function to fetch customer details
  const fetchCustomerDetails = async (customerId: string) => {
    if (!workspaceId || !selectedChat) return

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

      // 🔧 FIX: Update BOTH context and local state
      updateActiveChatbot(selectedChat.id, chatbotStatus)
      setIsChatbotActive(chatbotStatus) // Update local state immediately

      // 🔧 FIX: Invalidate chats to refresh the list
      queryClient.invalidateQueries({ queryKey: ["chats"] })
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

    // If turning on the chatbot, show notification confirmation dialog
    if (checked) {
      setShowActiveChatbotNotifyDialog(true)
      return
    }

    await updateActiveChatbotStatus(checked)
  }

  // Function to confirm turning off the chatbot
  const handleActiveChatbotConfirm = async () => {
    setHasToggledChatbot(true)
    setShowActiveChatbotDialog(false)
    await updateActiveChatbotStatus(false)
  }

  // Function to handle activation with or without notification
  const handleActiveChatbotNotifyConfirm = async (shouldNotify: boolean) => {
    setShowActiveChatbotNotifyDialog(false)
    await updateActiveChatbotStatus(true, shouldNotify)
  }

  // Function to update the activeChatbot status in the backend
  const updateActiveChatbotStatus = async (
    status: boolean,
    shouldNotify: boolean = false
  ) => {
    if (!selectedChat?.customerId || !workspaceId) return

    try {
      setLoading(true)

      // Update UI immediately for better responsiveness
      setIsChatbotActive(status)

      // Update the customer in the backend
      const response = await api.put(
        `/workspaces/${workspaceId}/customers/${selectedChat.customerId}`,
        { activeChatbot: status }
      )

      if (response.status === 200) {
        // Log the response for debugging
        logger.info("Update chatbot response:", response.data)

        // Update context state
        updateActiveChatbot(selectedChat.id, status)

        // Invalidate queries to refresh chat list
        await queryClient.invalidateQueries({ queryKey: ["chats"] })

        // If enabling chatbot and notification is requested
        if (status && shouldNotify) {
          try {
            // Send notification
            await api.post(
              `/workspaces/${workspaceId}/push/chatbot-reactivated`,
              {
                workspaceId,
                customerIds: [selectedChat.customerId],
              }
            )
          } catch (notifyError) {
            logger.error("Error sending notification:", notifyError)
            // Don't show error to user as the main action succeeded
          }
        }
        toast.success(
          `Chatbot ${status ? "enabled" : "disabled"} for ${
            selectedChat.customerName
          }`,
          { duration: 1000 }
        )
      } else {
        // Log error for debugging
        logger.error("Failed to update chatbot status:", {
          status: response.status,
          data: response.data,
        })
        toast.error(response.data.error || "Failed to update chatbot status", {
          duration: 1000,
        })
      }
    } catch (error) {
      logger.error("Error updating chatbot status:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update chatbot status",
        {
          duration: 1000,
        }
      )
    } finally {
      setLoading(false)
    }
  }

  // Function to select a chat
  const selectChat = (chat: Chat) => {
    setSelectedChat(chat)
    // Update URL to include sessionId - use sessionId or fallback to id
    const sessionIdToUse = chat.sessionId || chat.id
    const newParams = new URLSearchParams(searchParams)
    newParams.set("sessionId", sessionIdToUse)
    // Preserve client search term if present
    if (clientSearchTerm) {
      newParams.set("client", clientSearchTerm)
    } else {
      newParams.delete("client")
    }
    setSearchParams(newParams)

    // Salva la chat selezionata nel localStorage
    localStorage.setItem("selectedChat", JSON.stringify(chat))

    // Reset unread count when selecting a chat
    if (chat.unreadCount > 0) {
      // Call API to mark messages as read
      api
        .post(`/chat/${sessionIdToUse}/read`)
        .then((response) => {
          if (response.data.success) {
            // Invalidate chat queries to refresh unread counts
            queryClient.invalidateQueries({ queryKey: ["chats"] })
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
        queryClient.invalidateQueries({ queryKey: ["chats"] })
        setSelectedChat(null)
        // Remove sessionId from URL
        const newParams = new URLSearchParams(searchParams)
        newParams.delete("sessionId")
        setSearchParams(newParams)
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
  const handleSaveCustomer = async (customerData: any, clientId?: string) => {
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
        toast.success("Customer updated successfully", { duration: 1000 })
        setShowEditSheet(false)
        // Update only the selected chat's customer info
        if (selectedChat) {
          const updatedCustomer = response.data
          setSelectedChat({
            ...selectedChat,
            customerName: updatedCustomer.name || selectedChat.customerName,
            customerPhone: updatedCustomer.phone || selectedChat.customerPhone,
            companyName: updatedCustomer.company || selectedChat.companyName,
          })
        }
        // Refresh chat list
        queryClient.invalidateQueries({ queryKey: ["chats"] })
      } else {
        toast.error(
          "Failed to update customer: " +
            (response.data?.error || "Unknown error"),
          { duration: 1000 }
        )
      }
    } catch (error) {
      logger.error("Error updating customer:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update customer",
        { duration: 1000 }
      )
    } finally {
      setLoading(false)
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
          setMessages((prev) =>
            prev
              .filter((msg) => msg.id !== tempMessage.id)
              .concat(transformedMessages)
          )
        } else {
          // Just add the operator message directly (manual operator mode)
          setMessages((prev) => [...prev, ...transformedMessages])
        }

        // Update chat list to reflect new message
        queryClient.invalidateQueries({ queryKey: ["chats"] })

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
        queryClient.invalidateQueries({ queryKey: ["chats"] })
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
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
        {/* Chat List */}
        <Card className="col-span-4 p-4 overflow-hidden flex flex-col">
          <div className="mb-4 space-y-2">
            <Input
              type="search"
              placeholder="Search chats..."
              value={clientSearchTerm}
              onChange={(e) => {
                const newParams = new URLSearchParams(searchParams)
                if (e.target.value) {
                  newParams.set("client", e.target.value)
                } else {
                  newParams.delete("client")
                }
                // Keep sessionId if present
                if (sessionId) {
                  newParams.set("sessionId", sessionId)
                }
                setSearchParams(newParams)
                setClientSearchTerm(e.target.value)
              }}
              className="w-full"
            />
            {/* 🚀 WebSocket Status Indicator */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div
                className={`w-2 h-2 rounded-full ${
                  isWebSocketConnected ? "bg-green-500" : "bg-red-500"
                } ${isWebSocketConnected ? "animate-pulse" : ""}`}
              />
              <span>
                {isWebSocketConnected ? "Real-time updates" : "Connecting..."}
              </span>
            </div>
          </div>

          <div
            className="chat-scrollbar"
            style={{
              height: "600px",
              overflow: "auto",
              backgroundColor: "white",
            }}
          >
            {chats.length > 0 ? (
              chats.map((chat: Chat) => {
                // Compare sessionId instead of id
                const isSelected = selectedChat?.sessionId === chat.sessionId

                return (
                  <div
                    key={chat.id}
                    className={`p-3 cursor-pointer rounded-lg mb-2 transition-all
                      ${
                        isSelected
                          ? chat.activeChatbot === false
                            ? "border-l-4 border-orange-500 bg-orange-100 text-orange-800 font-bold"
                            : "border-l-4 border-green-600 bg-green-50 text-green-800 font-bold"
                          : chat.activeChatbot === false
                          ? "border-l-4 border-orange-300 bg-orange-50 text-orange-700"
                          : "border-l-0 bg-white text-gray-900"
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
                  </div>
                )
              })
            ) : (
              <div className="text-center py-4 text-gray-500">
                {isLoadingChats ? "Loading chats..." : "No chats found"}
              </div>
            )}
          </div>
        </Card>

        <Card className="col-span-8 p-4 flex flex-col">
          {selectedChat ? (
            <>
              {/* 🚨 OPERATOR CONTROL BANNER */}
              {!isChatbotActive && (
                <div className="bg-orange-100 border-l-4 border-orange-500 p-3 mb-2">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Bot className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-orange-700 font-medium">
                        <strong>Manual Operator Control Active</strong>
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        AI chatbot is disabled. You are now manually handling
                        this conversation.
                        <span className="font-medium">
                          {" "}
                          Customer messages will be saved but won't trigger AI
                          responses.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 🚫 CUSTOMER BLOCKED BANNER */}
              {selectedChat.isBlacklisted && (
                <div className="bg-red-100 border-l-4 border-red-500 p-3 mb-2">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Ban className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700 font-medium">
                        <strong>Customer is Blocked</strong>
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        This customer has been blacklisted. New messages are
                        blocked.
                        <span className="font-medium">
                          {" "}
                          You can view existing messages but cannot send new
                          ones.
                        </span>
                      </p>
                    </div>
                  </div>
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
                    onClick={handleViewCart}
                    className="hover:bg-green-50 h-10 w-10 p-0"
                    title="View Customer Cart"
                    disabled={isLoadingCartToken}
                  >
                    {isLoadingCartToken ? (
                      <Loader2 className="h-5 w-5 text-green-600 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-5 w-5 text-green-600" />
                    )}
                  </Button>
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
                className="chat-scrollbar px-4 py-2"
                style={{
                  height: "600px",
                  overflow: "auto",
                  backgroundColor: "white",
                }}
              >
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
                        className={`flex mb-4 ${
                          isAgentMessage ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`p-3 rounded-lg max-w-[75%] relative ${getMessageStyle()}`}
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
                              {/* 🤖 AI Agent Badge */}
                              {isAgentMessage &&
                                message.agentName &&
                                !isOperatorMessage && (
                                  <span className="text-[10px] font-medium bg-green-200 text-green-800 px-2 py-0.5 rounded ml-2">
                                    🤖 {message.agentName}
                                  </span>
                                )}

                              {/* 👨‍💼 Operator Badge */}
                              {isOperatorMessage && (
                                <span className="text-[10px] font-medium bg-blue-200 text-blue-800 px-2 py-0.5 rounded ml-2">
                                  👨‍💼 Human Operator
                                </span>
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
            <div className="text-center py-4 text-gray-500">
              {isLoadingChats ? "Loading chats..." : "No chats found"}
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

      {/* Chatbot Notification Confirmation Dialog */}
      <AlertDialog
        open={showActiveChatbotNotifyDialog}
        onOpenChange={setShowActiveChatbotNotifyDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Notification?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to notify {selectedChat?.customerName} that the
              chatbot is now active?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => handleActiveChatbotNotifyConfirm(false)}
            >
              No, just enable
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleActiveChatbotNotifyConfirm(true)}
            >
              Yes, notify user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      {/* WhatsApp Floating Button - stile OlaClick, solo su /chat */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handlePlaygroundClick}
          className="bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 h-16 w-16 p-0 flex items-center justify-center group relative"
          title="Chat WhatsApp"
        >
          <WhatsAppIcon className="h-8 w-8 text-white transition-transform group-hover:scale-110" />
          <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></div>
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Chatta con noi su WhatsApp
          </div>
        </Button>
      </div>
      <WhatsAppChatModal
        isOpen={showPlaygroundDialog}
        onClose={handleClosePlayground}
        channelName="WhatsApp Chat"
        workspaceId={workspace?.id}
        selectedChat={selectedChat as any}
      />

      {/* Cart Iframe Popup */}
      {selectedChat && cartToken && (
        <CartIframePopup
          isOpen={showCartPopup}
          onClose={() => setShowCartPopup(false)}
          iframeSrc={`http://localhost:3000/checkout?token=${cartToken}`}
          customerName={selectedChat.customerName}
        />
      )}
    </PageLayout>
  )
}
