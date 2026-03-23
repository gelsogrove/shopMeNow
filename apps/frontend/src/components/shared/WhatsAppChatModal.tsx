import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { getWorkspaceId } from "@/config/workspace.config"
import { IMG_BASE_URL } from "@/config"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { api } from "@/services/api"
import { MessageCircle, Send, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ChatSurface } from "@/components/chat/ChatSurface"

// Utility functions are available in @/utils/messageUtils if needed for extraction
// import { getInitials, isValidPhoneNumber, formatWhatsAppMessage, getMessageStyle } from "@/utils/messageUtils"

// Define a global variable to store the current session ID
// This will persist across modal closes/opens but not page refreshes
let globalSessionId: string | null = null

interface Message {
  id: string
  content: string
  sender: "user" | "customer" | "bot"
  timestamp: Date
  agentName?: string
  translatedQuery?: string
  processedPrompt?: string
  debugInfo?: string | any // 🔧 NEW: Debug information
  processingSource?: string // 🔧 NEW: Source of the response (LLM/function name)
  deliveredAt?: Date | string | null // 🔧 NEW: WhatsApp delivery timestamp (from conversationMessage.deliveredAt)
  functionCalls?: Array<{
    functionName: string
    toolCall?: {
      function?: {
        name: string
        arguments: string
      }
    }
    result: any
    type?: string
    source?: string
    data?: any
  }>
  metadata?: {
    isOperatorMessage?: boolean
    isOperatorControl?: boolean
    agentSelected?: string
    sentBy?: string
    operatorId?: string
  }
}

// Interface for selected chat from chat history
interface Chat {
  id: string
  sessionId: string
  customerId: string
  customerName: string
  customerPhone: string
  companyName?: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isActive: boolean
  isFavorite: boolean
  messages?: Message[]
}

interface WhatsAppChatModalProps {
  isOpen: boolean
  onClose: () => void
  onMessageSent?: () => void
  channelName?: string
  phoneNumber?: string
  workspaceId?: string
  selectedChat?: Chat | null
  logoUrl?: string
  enableWhatsapp?: boolean // Flag to determine logo source
}

export function WhatsAppChatModal({
  isOpen,
  onClose,
  onMessageSent,
  channelName = "L'Altra Italia",
  phoneNumber = "",
  workspaceId = "",
  selectedChat,
  logoUrl,
  enableWhatsapp = false, // Default to Widget mode
}: WhatsAppChatModalProps) {
  const [chatStarted, setChatStarted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [initialMessage, setInitialMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [localSelectedChat, setLocalSelectedChat] = useState<Chat | null>(null)
  // Use the global session ID if available
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showFunctionCalls, setShowFunctionCalls] = useState(false)
  const [showProcessedPrompt, setShowProcessedPrompt] = useState(false)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 🧪 Playground safety states
  const [isPlaygroundMode, setIsPlaygroundMode] = useState(true) // Default to safe playground mode
  const [customPhone, setCustomPhone] = useState("") // Custom phone number input
  const PLAYGROUND_PHONE = "+39 999 1234567" // Fake test number (default)
  const defaultLogoUrl =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%2322c55e'/%3E%3Ccircle cx='35' cy='40' r='6' fill='%23fff'/%3E%3Ccircle cx='65' cy='40' r='6' fill='%23fff'/%3E%3Cpath d='M30 60 Q50 75 70 60' stroke='%23fff' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"

  useEffect(() => {
    if (isOpen) {
      setIsPlaygroundMode(true)
      logger.info(`[WhatsApp Modal] Playground locked to ${PLAYGROUND_PHONE}`)
    }
  }, [isOpen])

  // 🔄 Handle modal close with chat list refresh
  const handleClose = () => {
    logger.info("[WhatsApp Modal] 🔄 Closing modal and triggering refresh callback")

    // Call onMessageSent to refresh chat list if provided
    if (onMessageSent) {
      onMessageSent()
    }
    
    // Close the modal via the provided callback
    onClose()
  }

  // Render component logic

  // Check if we have a valid workspace ID
  const currentWorkspaceId = getWorkspaceId(workspaceId)
  const hasValidWorkspace = currentWorkspaceId !== null

  logger.info("WhatsAppChatModal props:", {
    isOpen,
    channelName,
    phoneNumber,
    workspaceId,
    selectedChat,
  })

  logger.info("Workspace check:", {
    currentWorkspaceId,
    hasValidWorkspace,
    providedWorkspaceId: workspaceId,
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastSendRef = useRef<number>(0) // Track last sendMessage call

  // Load chat from props or storage when the modal opens
  useEffect(() => {
    if (isOpen) {
      setIsPlaygroundMode(true)
      setLocalSelectedChat((prev) =>
        prev && prev.customerPhone === PLAYGROUND_PHONE ? prev : null
      )

      // Priority 1: Use stored playground chat if available
      try {
        const savedChat = storage.getSelectedChat<Chat>()
        if (savedChat && savedChat.customerPhone === PLAYGROUND_PHONE) {
          logger.info("Using selectedChat from storage:", savedChat)
          setLocalSelectedChat(savedChat)

          // If the savedChat has a sessionId, use it
          if (savedChat.sessionId) {
            setSessionId(savedChat.sessionId)
            globalSessionId = savedChat.sessionId
          }

          return
        }

        if (savedChat) {
          storage.clearSelectedChat()
        }
      } catch (error) {
        logger.error("Error reading selectedChat from storage:", error)
      }

      // If the sessionId was set but not the chat, try to use that
      if (globalSessionId) {
        logger.info("Using previously stored sessionId:", globalSessionId)
        setSessionId(globalSessionId)
      }
    }
  }, [isOpen, selectedChat])

  // Initialize chat when a local selected chat is available
  useEffect(() => {
    if (isOpen && localSelectedChat) {
      logger.info("Initializing chat with chat:", localSelectedChat)
      setChatStarted(true)
      fetchMessagesForSelectedChat(localSelectedChat)
    }
  }, [isOpen, localSelectedChat])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      logger.info("Modal closed, resetting component state")
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
      resetTimeoutRef.current = setTimeout(() => {
        // Reset solo gli stati necessari, mantenendo la conversazione
        setIsLoading(false)
        setCurrentMessage("")

        // NON resettare questi per mantenere il contesto della conversazione
        // setChatStarted(false)
        // setMessages([])
        // setLocalSelectedChat(null)
      }, 300)
    } else if (isOpen && !localSelectedChat && !selectedChat) {
      // Handle case where modal opens without a selected chat
      logger.info("Modal opened without any chat")
      // Focus input field when chat opens without selected chat
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current)
      }
      focusTimeoutRef.current = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    }
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
        resetTimeoutRef.current = null
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current)
        focusTimeoutRef.current = null
      }
    }
  }, [isOpen, phoneNumber, localSelectedChat, selectedChat])

  // Fetch messages for the selected chat
  const fetchMessagesForSelectedChat = async (chat: Chat) => {
    if (!chat || !chat.sessionId) {
      logger.error(
        "No chat or sessionId provided to fetchMessagesForSelectedChat"
      )
      return
    }

    // Get workspaceId for API call
    const currentWorkspaceId = getWorkspaceId(workspaceId)
    if (!currentWorkspaceId) {
      logger.error("No workspace ID available for fetching messages")
      return
    }

    logger.info("Fetching messages for chat:", chat.sessionId)
    setIsLoading(true)
    try {
      const response = await api.get(`/chat/${chat.sessionId}/messages`)
      logger.info("API response for messages:", response.data)

      if (response.data.success) {
        // Transform backend messages to frontend format for the playground
        const chatMessages = response.data.data.map((message: any) => ({
          id: message.id,
          content: message.content,
          // Map MessageDirection.INBOUND to 'customer' and MessageDirection.OUTBOUND to 'bot'
          sender: message.direction === "INBOUND" ? "customer" : "bot",
          timestamp: new Date(message.createdAt),
          deliveredAt: message.deliveredAt ? new Date(message.deliveredAt) : null, // 🔧 NEW: WhatsApp delivery timestamp
          agentName:
            message.agentName ||
            (message.direction === "OUTBOUND" ? "AI Assistant" : undefined),
          // Debug fields
          translatedQuery: message.translatedQuery,
          processedPrompt: message.processedPrompt,
          processingSource: message.processingSource, // 🔧 NEW: Source information
          functionCalls: message.functionCallsDebug
            ? JSON.parse(message.functionCallsDebug)
            : [],
          metadata: {
            isOperatorMessage: message.metadata?.isOperatorMessage || false,
            isOperatorControl: message.metadata?.isOperatorControl || false,
            agentSelected:
              message.metadata?.agentSelected ||
              (message.direction === "OUTBOUND" ? "CHATBOT" : "CUSTOMER"),
            sentBy:
              message.metadata?.sentBy ||
              (message.direction === "OUTBOUND" ? "AI" : "CUSTOMER"),
            operatorId: message.metadata?.operatorId,
          },
        }))

        logger.info(
          `Loaded ${chatMessages.length} messages for chat:`,
          chat.sessionId
        )
        setMessages(chatMessages)
      }
    } catch (error) {
      logger.error("Error loading messages for selected chat:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-scroll to the latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }
      // Scroll immediately and after a short delay to ensure content is rendered
      scrollToBottom()
      setTimeout(scrollToBottom, 100)
    }
  }, [messages, isLoading])

  // Validate phone number - at least 10 digits
  const isValidPhoneNumber = (number: string) => {
    return /^\+?[\d\s]{10,}$/.test(number.trim())
  }

  const startChat = async () => {
    if (!isValidPhoneNumber(PLAYGROUND_PHONE)) return
    if (!initialMessage.trim()) return

    // Check if we have a valid workspace
    if (!hasValidWorkspace) {
      alert("No workspace available. Please select a workspace first.")
      return
    }

    setChatStarted(true)

    // Add the initial message
    const userMessage: Message = {
      id: (Date.now() + 100).toString(),
      content: initialMessage,
      sender: "customer", // Changed from "user" to "customer" for initial message
      timestamp: new Date(),
      metadata: {
        isOperatorMessage: false,
        isOperatorControl: false,
        agentSelected: "CUSTOMER",
        sentBy: "CUSTOMER",
      },
    }

    setMessages([userMessage])
    setInitialMessage("")
    setIsLoading(true)

    try {
      // Call the API to process the initial message - USE SAME WEBHOOK AS NORMAL MESSAGES
      // Use provided workspaceId or get from config
      const currentWorkspaceId = getWorkspaceId(workspaceId)

      // Use custom phone if provided, otherwise use default test number
      const phoneToUse = customPhone.trim() || PLAYGROUND_PHONE

      // Include isNewConversation flag for new chats
      const response = await api.post("/whatsapp/webhook", {
        message: userMessage.content,
        phoneNumber: phoneToUse,
        workspaceId: currentWorkspaceId,
        channelPhoneNumber: phoneNumber, // 🔧 NEW: Send channel phone number for workspace lookup
        isNewConversation: true, // Add flag to indicate new conversation
        isPlayground: isPlaygroundMode, // 🧪 Playground flag to skip billing
      })

      // Handle both success formats: { success: true, data: {...} } and { status: "new_user_welcomed", message: "..." }
      if (
        response.data.success ||
        response.data.status === "new_user_welcomed"
      ) {
        // Handle new user welcome message
        if (response.data.status === "new_user_welcomed") {
          const welcomeMessage: Message = {
            id: `bot-${Date.now()}`,
            content: response.data.message,
            sender: "bot",
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, welcomeMessage])
          setIsLoading(false)
          return
        }

        // Handle existing user flow
        // Save sessionId if provided in the response
        if (response.data.data.sessionId) {
          logger.info("Setting new session ID:", response.data.data.sessionId)
          setSessionId(response.data.data.sessionId)

          // Update our global variable to persist across modal closings
          globalSessionId = response.data.data.sessionId

          // Create or update the local selected chat
          const newChat: Chat = {
            id: response.data.data.sessionId,
            sessionId: response.data.data.sessionId,
            customerId: response.data.data.customerId || "unknown",
            customerName: "Customer",
            customerPhone: phoneToUse,
            lastMessage: initialMessage,
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            isActive: true,
            isFavorite: false,
          }

          setLocalSelectedChat(newChat)
          storage.setSelectedChat(newChat)
        }

        // Create the bot message from the API response
        const botMessage: Message = {
          id: (Date.now() + 200).toString(),
          content: response.data.data.message,
          sender: "bot",
          timestamp: new Date(),
          agentName: "AI Assistant",
          metadata: {
            isOperatorMessage: false,
            isOperatorControl: false,
            agentSelected: "CHATBOT",
            sentBy: "AI",
          },
        }

        // Add ONLY the bot response to chat history, not the user's message again
        // This prevents the duplicate "Ciao" message
        setMessages((prev) => [...prev, botMessage]) // Add only bot response - user message already added
      } else {
        // Handle API error response
        logger.error("API Error:", response.data.error)

        // Add an error message to the chat
        const errorMessage: Message = {
          id: (Date.now() + 200).toString(),
          content:
            "Sorry, there was an error processing your message. Please try again later.",
          sender: "bot",
          timestamp: new Date(),
          agentName: "System",
          metadata: {
            isOperatorMessage: false,
            isOperatorControl: false,
            agentSelected: "SYSTEM_ERROR",
            sentBy: "SYSTEM",
          },
        }

        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      logger.error("Error calling message API:", error)

      // 🚫 P1: Handle 410 Gone (blocked customer) - Silent block
      if ((error as any).response?.status === 410) {
        logger.warn("🚫 Customer is blocked (410 Gone) - silent block")
        return // Exit silently - no message displayed
      }

      // 🚫 Feature 197: Handle 402 (PAUSED, PAYMENT_FAILED, CREDIT_EXHAUSTED, TRIAL_EXPIRED) - Silent block
      // When subscription is paused or billing issue, chatbot doesn't respond
      if ((error as any).response?.status === 402) {
        const blockReason = (error as any).response?.data?.code || 'BILLING_ISSUE'
        logger.warn(`🚫 Workspace blocked (402 ${blockReason}) - silent block`)
        return // Exit silently - no message displayed
      }

      // 🚫 Handle 403 (CUSTOMER_LIMIT_REACHED, PLAN_LIMIT_REACHED) - Silent block
      if ((error as any).response?.status === 403) {
        const blockReason = (error as any).response?.data?.code || 'LIMIT_REACHED'
        logger.warn(`🚫 Plan limit reached (403 ${blockReason}) - silent block`)
        return // Exit silently - no message displayed
      }

      // Add an error message to the chat in case of exception
      const errorMessage: Message = {
        id: (Date.now() + 200).toString(),
        content:
          "Sorry, there was an error processing your message. Please try again later.",
        sender: "bot",
        timestamp: new Date(),
        agentName: "System",
        metadata: {
          isOperatorMessage: false,
          isOperatorControl: false,
          agentSelected: "SYSTEM_ERROR",
          sentBy: "SYSTEM",
        },
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      // Always set loading state to false, regardless of success or failure
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    logger.info("🚀 FRONTEND DEBUG: sendMessage called with:", currentMessage)

    if (!currentMessage.trim() || isLoading) {
      logger.info(
        "❌ FRONTEND DEBUG: sendMessage blocked - empty message or loading"
      )
      return
    }

    // Prevent double execution with simple debounce
    const now = Date.now()
    const lastCall = lastSendRef.current
    if (now - lastCall < 1000) {
      // 1 second debounce (reduced from 10s for testing)
      logger.info(
        "❌ FRONTEND DEBUG: sendMessage blocked - too soon after last call"
      )
      return
    }
    lastSendRef.current = now

    // Check if we have a valid workspace
    if (!hasValidWorkspace) {
      alert("No workspace available. Please select a workspace first.")
      return
    }

    logger.info(
      "✅ FRONTEND DEBUG: sendMessage proceeding with message:",
      currentMessage
    )

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentMessage,
      sender: "customer",
      timestamp: new Date(),
      metadata: {
        isOperatorMessage: false,
        isOperatorControl: false,
        agentSelected: "CUSTOMER",
        sentBy: "CUSTOMER",
      },
    }

    // Save the message to display immediately
    setMessages((prev) => [...prev, userMessage])
    setCurrentMessage("")
    setIsLoading(true)

    try {
      // Call the webhook API (same as real WhatsApp messages)
      // Use provided workspaceId or get from config
      const currentWorkspaceId = getWorkspaceId(workspaceId)

      // Use custom phone if provided, otherwise use default test number
      const phoneToUse = customPhone.trim() || PLAYGROUND_PHONE

      const response = await api.post("/whatsapp/webhook", {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: phoneToUse,
                      text: {
                        body: userMessage.content,
                      },
                    },
                  ],
                  workspaceId: currentWorkspaceId,
                  channelPhoneNumber: phoneNumber, // 🔧 NEW: Send channel phone number for workspace lookup
                  isPlayground: isPlaygroundMode, // 🧪 Playground flag to skip billing
                },
              },
            ],
          },
        ],
      })
      logger.info(
        "📥 FRONTEND DEBUG: Webhook response received:",
        response.data
      )
      logger.info("📥 FRONTEND DEBUG: Response status:", response.status)

      // ✅ Handle both response formats: existing user vs new user
      const webhookData = response.data

      // Handle new user welcome message
      if (webhookData.status === "new_user_welcomed") {
        logger.info("✅ New user welcomed - showing welcome message")
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: webhookData.message,
          sender: "bot",
          timestamp: new Date(),
          agentName: "AI Assistant",
        }
        setMessages((prev) => [...prev, botMessage])
        setIsLoading(false)
        return
      }

      // Handle existing user flow
      // ✅ OPTIMIZED: Use response directly from webhook instead of fetching again
      if (webhookData.success && webhookData.data?.message) {
        logger.info("✅ Using bot response from webhook directly")

        // Add bot response immediately from webhook
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: webhookData.data.message,
          sender: "bot",
          timestamp: new Date(),
          agentName: "AI Assistant",
          debugInfo: webhookData.debug
            ? JSON.stringify(webhookData.debug)
            : undefined,
          metadata: {
            isOperatorMessage: false,
            isOperatorControl: false,
            agentSelected: "AI",
            sentBy: "AI",
          },
        }

        setMessages((prev) => [...prev, botMessage])

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }

      // ✅ STILL fetch from backend to sync with database (background sync)
      // This ensures we have the correct IDs and all messages
      const sessionIdToUse = localSelectedChat?.sessionId || sessionId

      if (sessionIdToUse) {
        logger.info(
          "📥 FRONTEND DEBUG: Background sync - fetching messages from database"
        )

        // Small delay for database to save
        await new Promise((resolve) => setTimeout(resolve, 300))

        try {
          const messagesResponse = await api.get(
            `/chat/${sessionIdToUse}/messages`
          )

          if (messagesResponse.data.success) {
            const allMessages = messagesResponse.data.data.map(
              (message: any) => ({
                id: message.id,
                content: message.content,
                sender: message.direction === "INBOUND" ? "customer" : "bot",
                timestamp: new Date(message.createdAt),
                agentName:
                  message.agentName ||
                  (message.direction === "OUTBOUND"
                    ? "AI Assistant"
                    : undefined),
                debugInfo: message.debugInfo,
                metadata: {
                  isOperatorMessage: message.isOperatorMessage || false,
                  isOperatorControl: message.isOperatorControl || false,
                  agentSelected: message.agentName || "AI",
                  sentBy: message.direction === "INBOUND" ? "CUSTOMER" : "AI",
                },
              })
            )

            logger.info(
              "📥 FRONTEND DEBUG: Fetched",
              allMessages.length,
              "messages from backend"
            )

            // Replace all messages with fresh data from backend
            setMessages(allMessages)

            // 🔄 CRITICAL: Call parent to refresh chat list
            onMessageSent?.()
            logger.info("[WhatsApp Modal] 🔄 Chat list refresh triggered")

            // Scroll to bottom
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            }, 100)
          }
        } catch (fetchError) {
          logger.error("Error fetching messages after webhook:", fetchError)
        }
      }

      setIsLoading(false)
    } catch (error) {
      logger.error("Error calling message API:", error)

      // 🚫 P1: Handle 410 Gone (blocked customer) - Silent block
      if ((error as any).response?.status === 410) {
        logger.warn("🚫 Customer is blocked (410 Gone) - silent block")
        setIsLoading(false)
        return // Exit silently - no message displayed
      }

      // 🚫 Feature 197: Handle 402 (PAUSED, PAYMENT_FAILED, CREDIT_EXHAUSTED, TRIAL_EXPIRED) - Silent block
      if ((error as any).response?.status === 402) {
        const blockReason = (error as any).response?.data?.code || 'BILLING_ISSUE'
        logger.warn(`🚫 Workspace blocked (402 ${blockReason}) - silent block`)
        setIsLoading(false)
        return // Exit silently - no message displayed
      }

      // 🚫 Handle 403 (CUSTOMER_LIMIT_REACHED, PLAN_LIMIT_REACHED) - Silent block
      if ((error as any).response?.status === 403) {
        const blockReason = (error as any).response?.data?.code || 'LIMIT_REACHED'
        logger.warn(`🚫 Plan limit reached (403 ${blockReason}) - silent block`)
        setIsLoading(false)
        return // Exit silently - no message displayed
      }

      // Add an error message to the chat in case of exception
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "Sorry, there was an error processing your message. Please try again later.",
        sender: "bot",
        timestamp: new Date(),
        agentName: "System",
        metadata: {
          isOperatorMessage: false,
          isOperatorControl: false,
          agentSelected: "SYSTEM_ERROR",
          sentBy: "SYSTEM",
        },
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      // Always set loading state to false, regardless of success or failure
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Reset chat to allow new message
  const handleNewMessage = () => {
    // Don't reset the sessionId when starting a new message
    // This allows us to continue the same conversation
    setChatStarted(false)
    setMessages([])
    setCurrentMessage("")
    setInitialMessage("")
    // We're intentionally NOT clearing the sessionId here
  }

  const getMessageFlags = (message: Message) => {
    const isAgentMessage = message.sender === "bot"
    const isOperatorMessage =
      isAgentMessage &&
      (message.metadata?.agentSelected === "MANUAL_OPERATOR" ||
        message.metadata?.isOperatorMessage === true ||
        message.metadata?.sentBy === "HUMAN_OPERATOR")
    const isOperatorControl = message.metadata?.isOperatorControl === true
    const isManualOperator =
      message.metadata?.agentSelected === "MANUAL_OPERATOR" ||
      message.metadata?.agentSelected === "MANUAL_OPERATOR_CONTROL" ||
      message.metadata?.sentBy === "HUMAN_OPERATOR"

    return { isAgentMessage, isOperatorMessage, isOperatorControl, isManualOperator }
  }

  const getMessageStyle = (message: Message) => {
    const { isAgentMessage, isOperatorControl } = getMessageFlags(message)

    if (!isAgentMessage) {
      return isOperatorControl
        ? "bg-orange-50 text-orange-900 border-l-4 border-orange-400"
        : "bg-white border border-gray-200"
    }

    if (
      message.metadata?.agentSelected === "CHATBOT" ||
      message.metadata?.agentSelected?.startsWith("CHATBOT_") ||
      message.metadata?.agentSelected === "AI" ||
      message.metadata?.agentSelected === "LLM" ||
      message.agentName
    ) {
      return "bg-green-100 text-green-900 border-l-4 border-green-500"
    }

    if (message.metadata?.agentSelected === "MANUAL_OPERATOR") {
      return "bg-blue-100 text-blue-900 border-l-4 border-blue-500"
    }

    return "bg-green-100 text-green-900"
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          // Allow closing by clicking outside
          if (!open) {
            handleClose()
          }
        }}
      >
        <DialogContent
          className={`p-0 overflow-visible [&>button]:hidden h-[90vh] flex flex-row transition-all relative w-[600px] max-w-[95vw]`}
          data-state={isOpen ? "open" : "closed"}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
        <DialogTitle className="sr-only">WhatsApp Chat</DialogTitle>
        <DialogDescription id="whatsapp-dialog-description" className="sr-only">
          WhatsApp conversation interface to chat with a contact
        </DialogDescription>

        {/* Close Button - Positioned at top right of DialogContent */}
        <button
          onClick={handleClose}
          className="fixed top-[calc(50%-45vh)] right-[calc(50%-585px)] flex items-center justify-center w-10 h-10 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors z-50 shadow-lg"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Chat Column - Flexible width, left side */}
        <div className="flex-1 flex flex-col bg-transparent border-r border-gray-200 flex-shrink-0 transition-all">
          {/* WhatsApp header with WhatsApp icon and X */}
          <div className="bg-gradient-to-r from-green-500 to-green-400 shadow-md p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/90 ring-1 ring-white/60 shadow flex items-center justify-center overflow-hidden">
                <img
                  src={
                    enableWhatsapp
                      ? defaultLogoUrl // WhatsApp: usa logo di default (in realtà verrà dal profilo WhatsApp)
                      : logoUrl
                      ? logoUrl.startsWith("http")
                        ? logoUrl
                        : `${IMG_BASE_URL}${logoUrl}`
                      : defaultLogoUrl // Widget: usa logo custom o default
                  }
                  alt={channelName}
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div className="text-white">
                <div className="text-lg font-bold flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2 text-white/90" />
                  {channelName}
                </div>
                <div className="text-xs text-white/80">{PLAYGROUND_PHONE}</div>
              </div>
            </div>
            {/* PLAYGROUND Badge - only show if chat started */}
            {chatStarted && (
              <div className="flex items-center gap-2">
                <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm">
                  🧪 PLAYGROUND
                </span>
              </div>
            )}
          </div>

          {/* Chat Content Area - Flex layout: header top, messages flex-1, input bottom */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!chatStarted ? (
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Start a Chat Simulation
                </h3>

                {!hasValidWorkspace && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      ⚠️ No workspace available. Please select a workspace first
                      to send messages.
                    </p>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <Label htmlFor="phone-number">Phone Number (optional)</Label>
                    <input
                      id="phone-number"
                      type="text"
                      placeholder="e.g. +39 333 1234567 (leave empty for test number)"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to use default test number: {PLAYGROUND_PHONE}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="initial-message">First Message *</Label>
                    <Textarea
                      id="initial-message"
                      placeholder="Hello, I'd like to know about your products..."
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      className="mt-2"
                      rows={3}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the first message to start the conversation
                    </p>
                  </div>

                  <Button
                    className="w-full bg-green-500 hover:bg-green-600"
                    onClick={startChat}
                    disabled={
                      !hasValidWorkspace ||
                      !initialMessage.trim() ||
                      isLoading
                    }
                  >
                    {isLoading
                      ? "Processing..."
                      : !hasValidWorkspace
                      ? "No Workspace Available"
                      : "Start Chat"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Chat messages */}
                <ScrollArea className="flex-1 p-4 bg-gray-100">
                  <ChatSurface
                    messages={messages}
                    getAlignment={(message) =>
                      getMessageFlags(message).isAgentMessage ? "right" : "left"
                    }
                    getBubbleClassName={(message) => {
                      const { isOperatorMessage, isOperatorControl, isManualOperator } =
                        getMessageFlags(message)
                      return `rounded-2xl px-3 py-3 max-w-[85%] sm:max-w-[400px] mb-2 word-wrap break-words overflow-wrap-anywhere relative ${getMessageStyle(message)} ${
                        isOperatorMessage || isOperatorControl || isManualOperator ? "pt-6" : ""
                      }`
                    }}
                    renderBadge={(message) => {
                      const { isOperatorMessage, isOperatorControl, isManualOperator } =
                        getMessageFlags(message)
                      if (!isOperatorMessage && !isOperatorControl && !isManualOperator) {
                        return null
                      }
                      return (
                        <div className="absolute -top-2 -right-2 -ml-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium ${
                              isOperatorMessage ? "bg-blue-500 text-white" : "bg-orange-500 text-white"
                            }`}
                          >
                            👨‍💼 {isOperatorMessage ? "OPERATOR" : "MANUAL"}
                          </span>
                        </div>
                      )
                    }}
                    renderFooter={(message) => {
                      const { isAgentMessage, isOperatorMessage, isOperatorControl } =
                        getMessageFlags(message)
                      return (
                        <>
                          {isAgentMessage && (
                            <div className="flex items-center justify-end mt-1 text-xs text-gray-500">
                              {message.deliveredAt ? (
                                <span
                                  className="flex items-center text-blue-500"
                                  title={`Delivered: ${new Date(message.deliveredAt).toLocaleString("it-IT")}`}
                                >
                                  <svg viewBox="0 0 16 15" width="16" height="15" className="inline-block">
                                    <path
                                      fill="currentColor"
                                      d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"
                                    />
                                  </svg>
                                  <svg viewBox="0 0 16 15" width="16" height="15" className="inline-block -ml-1.5">
                                    <path
                                      fill="currentColor"
                                      d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"
                                    />
                                  </svg>
                                </span>
                              ) : (
                                <span className="flex items-center text-gray-400" title="Pending delivery...">
                                  <svg viewBox="0 0 16 15" width="16" height="15" className="inline-block">
                                    <path
                                      fill="currentColor"
                                      d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z"
                                    />
                                  </svg>
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[10px] opacity-70">
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            <div className="flex items-center gap-1">
                              {isAgentMessage && message.agentName && !isOperatorMessage && (
                                <span className="text-[10px] font-medium bg-green-200 text-green-800 px-2 py-0.5 rounded ml-2">
                                  🤖 {message.agentName}
                                </span>
                              )}
                              {isOperatorControl && (
                                <span className="text-[10px] font-medium bg-orange-200 text-orange-800 px-2 py-0.5 rounded ml-2">
                                  📋 Under Manual Control
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      )
                    }}
                    renderDebug={(message) =>
                      showFunctionCalls || showProcessedPrompt ? (
                        <div className="mt-3 border-t border-gray-300 pt-2 space-y-2">
                          {showProcessedPrompt && message.translatedQuery && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                              <div className="text-xs font-semibold text-yellow-800 mb-1">
                                🔍 Translated Query:
                              </div>
                              <div className="text-xs text-yellow-700 font-mono whitespace-pre-wrap">
                                {message.translatedQuery}
                              </div>
                            </div>
                          )}

                          {showProcessedPrompt && message.processedPrompt && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                              <div className="text-xs font-semibold text-blue-800 mb-1">
                                📝 Processed Prompt:
                              </div>
                              <div className="text-xs text-blue-700 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {message.processedPrompt}
                              </div>
                            </div>
                          )}

                          {showProcessedPrompt && message.debugInfo && (
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <div className="text-xs font-semibold text-green-800 mb-1">
                                🔧 Complete Debug Information:
                              </div>
                              <div className="text-xs text-green-700 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {(() => {
                                  try {
                                    const debugData =
                                      typeof message.debugInfo === "string"
                                        ? JSON.parse(message.debugInfo)
                                        : message.debugInfo

                                    const formattedDebug = {
                                      "🕐 Timestamp": debugData.timestamp || "N/A",
                                      "📞 Phone": debugData.requestPhone || "N/A",
                                      "🏢 Workspace ID": debugData.workspaceId || "N/A",
                                      "👤 Customer ID": debugData.customerId || "N/A",
                                      "📊 Stage": debugData.stage || "N/A",
                                      "👤 Customer Info": debugData.customer
                                        ? {
                                            Name: debugData.customer.name || "N/A",
                                            Language: debugData.customer.language || "N/A",
                                            Discount: `${debugData.customer.discount || 0}%`,
                                            Company: debugData.customer.company || "N/A",
                                            "Last Order": debugData.customer.lastOrderCode || "N/A",
                                          }
                                        : "New User",
                                      "🌐 User Context": debugData.userInfo || "N/A",
                                      "🔗 Links Status": debugData.linkCounts
                                        ? {
                                            "Short URLs Active": debugData.linkCounts.shortUrls?.active || 0,
                                            "Short URLs Expired": debugData.linkCounts.shortUrls?.expired || 0,
                                            "Secure Tokens Active": debugData.linkCounts.secureTokens?.active || 0,
                                            "Secure Tokens Expired": debugData.linkCounts.secureTokens?.expired || 0,
                                          }
                                        : "N/A",
                                      "🎯 Token Usage": debugData.tokenUsage
                                        ? {
                                            "Prompt Tokens": debugData.tokenUsage.promptTokens || 0,
                                            "Completion Tokens": debugData.tokenUsage.completionTokens || 0,
                                            "Total Tokens": debugData.tokenUsage.totalTokens || 0,
                                          }
                                        : "N/A",
                                      "💰 Cost Info": debugData.costInfo
                                        ? {
                                            "Prompt Cost": `$${debugData.costInfo.promptCost || 0}`,
                                            "Completion Cost": `$${debugData.costInfo.completionCost || 0}`,
                                            "Total Cost": `$${debugData.costInfo.totalCost || 0}`,
                                            Currency: debugData.costInfo.currency || "EUR",
                                          }
                                        : "N/A",
                                      "🔧 Function Calls": debugData.functionCalls && debugData.functionCalls.length > 0
                                        ? debugData.functionCalls.map((call: any, index: number) => ({
                                            [`Function ${index + 1}`]: call.functionName || "Unknown",
                                            [`Arguments ${index + 1}`]: call.functionArgs || {},
                                            [`Result ${index + 1}`]: call.result || "N/A",
                                          }))
                                        : "None",
                                      "📝 Prompt Info": debugData.promptInfo || "N/A",
                                      "📤 Response Length": debugData.finalResponseLength || "N/A",
                                    }

                                    return JSON.stringify(formattedDebug, null, 2)
                                  } catch (error) {
                                    return typeof message.debugInfo === "string"
                                      ? message.debugInfo
                                      : JSON.stringify(message.debugInfo, null, 2)
                                  }
                                })()}
                              </div>
                            </div>
                          )}

                          {showFunctionCalls && message.sender === "bot" && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                              <div className="text-xs font-semibold text-yellow-800 mb-1">
                                🎯 Response Source:
                              </div>
                              <div className="text-xs text-yellow-700">
                                {(() => {
                                  if (message.functionCalls && message.functionCalls.length > 0) {
                                    const functionNames = message.functionCalls
                                      .map((call) => call.functionName || call.type || "Unknown")
                                      .filter((name, index, arr) => arr.indexOf(name) === index)
                                      .slice(0, 3)
                                      .join(", ")

                                    return (
                                      <span className="font-mono">
                                        <span className="font-semibold text-purple-600">🔧 FUNCTION:</span>{" "}
                                        {functionNames}
                                        {message.functionCalls.length > 3 &&
                                          ` (+${message.functionCalls.length - 3} more)`}
                                      </span>
                                    )
                                  }
                                  if (message.processingSource && message.processingSource !== "unknown") {
                                    return (
                                      <span className="font-mono">
                                        <span className="font-semibold text-blue-600">🔧 SOURCE:</span>{" "}
                                        {message.processingSource}
                                      </span>
                                    )
                                  }
                                  if (message.metadata?.agentSelected?.includes("CHATBOT")) {
                                    return (
                                      <span className="font-mono">
                                        <span className="font-semibold text-green-600">🤖 LLM:</span>{" "}
                                        AI Generated Response
                                      </span>
                                    )
                                  }
                                  return (
                                    <span className="font-mono">
                                      <span className="font-semibold text-gray-600">❓ UNKNOWN:</span>{" "}
                                      {message.metadata?.agentSelected || "No source info"}
                                    </span>
                                  )
                                })()}
                              </div>
                            </div>
                          )}

                          {showFunctionCalls && (
                            <div className="bg-gray-50 border border-gray-200 rounded p-2">
                              <div className="text-xs font-semibold text-gray-800 mb-1">
                                🕒 Timestamp:
                              </div>
                              <div className="text-xs text-gray-700 font-mono">
                                {new Date(message.timestamp).toLocaleString("it-IT", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </div>
                            </div>
                          )}

                          {showFunctionCalls && message.functionCalls && message.functionCalls.length > 0 && (
                            <div className="bg-purple-50 border border-purple-200 rounded p-2">
                              <div className="text-xs font-semibold text-purple-800 mb-1">
                                {message.functionCalls.some((call) => call.type === "searchrag_result")
                                  ? `🔍 SearchRag Results (${message.functionCalls.length}):`
                                  : `⚡ Function Calls (${message.functionCalls.length}):`}
                              </div>

                              {message.translatedQuery && (
                                <div className="bg-pink-50 border border-pink-200 rounded p-2 mb-2">
                                  <div className="text-xs font-medium text-pink-700">
                                    🌐 Translated: {message.translatedQuery}
                                  </div>
                                </div>
                              )}
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {message.functionCalls.map((call, index) => (
                                  <div key={index} className="bg-white border border-purple-100 rounded p-2">
                                    <div className="text-xs font-medium text-purple-700 mb-1">
                                      {call.type === "searchrag_result" ? "🔍" : "🔧"}{" "}
                                      {call.functionName || call.type || "Unknown"}
                                    </div>
                                    {call.type === "searchrag_result" && call.data && (
                                      <div className="text-xs text-green-600">
                                        <strong>Source:</strong> {call.data.sourceName || "Unknown"}
                                        <br />
                                        <strong>Type:</strong> {call.data.sourceType || "Unknown"}
                                        <br />
                                        <strong>Similarity:</strong>{" "}
                                        {(call.data.similarity * 100).toFixed(1)}%<br />
                                        <strong>Content:</strong> {call.data.content?.substring(0, 200)}...
                                      </div>
                                    )}
                                    {call.result && call.type !== "searchrag_result" && (
                                      <div className="text-xs text-green-600 mt-1">
                                        <strong>Result:</strong> {JSON.stringify(call.result)}
                                      </div>
                                    )}
                                    {call.toolCall?.function?.arguments && (
                                      <div className="text-xs text-blue-600 mt-1">
                                        <strong>Arguments:</strong> {call.toolCall.function.arguments}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {showFunctionCalls &&
                            message.sender === "bot" &&
                            message.debugInfo &&
                            (() => {
                              try {
                                const debugData =
                                  typeof message.debugInfo === "string"
                                    ? JSON.parse(message.debugInfo)
                                    : message.debugInfo
                                return debugData.linkReplacements && debugData.linkReplacements.length > 0
                              } catch {
                                return false
                              }
                            })() && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                                <div className="text-xs font-semibold text-blue-800 mb-2">
                                  🔗 Link Replacements (
                                  {(() => {
                                    const debugData =
                                      typeof message.debugInfo === "string"
                                        ? JSON.parse(message.debugInfo)
                                        : message.debugInfo
                                    return debugData.linkReplacements?.length || 0
                                  })()}
                                  ):
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {(() => {
                                    try {
                                      const debugData =
                                        typeof message.debugInfo === "string"
                                          ? JSON.parse(message.debugInfo)
                                          : message.debugInfo

                                      return debugData.linkReplacements?.map((replacement: any, index: number) => (
                                        <div key={index} className="bg-white border border-blue-100 rounded p-2">
                                          <div className="text-xs">
                                            <div className="flex items-start gap-2 mb-1">
                                              <span className="font-semibold text-blue-700 whitespace-nowrap">
                                                Token:
                                              </span>
                                              <code className="bg-gray-100 px-1 rounded text-[10px] break-all">
                                                {replacement.token}
                                              </code>
                                            </div>
                                            <div className="flex items-start gap-2 mb-1">
                                              <span className="font-semibold text-green-700 whitespace-nowrap">
                                                URL:
                                              </span>
                                              <a
                                                href={replacement.replacedWith}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline text-[10px] break-all"
                                              >
                                                {replacement.replacedWith}
                                              </a>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600 mt-1">
                                              <div>
                                                <span className="font-semibold">Short URL:</span>{" "}
                                                {replacement.shortUrlCreated ? (
                                                  <span className="text-green-600">✓ Yes</span>
                                                ) : (
                                                  <span className="text-orange-600">✗ No</span>
                                                )}
                                              </div>
                                              <div>
                                                <span className="font-semibold">Token:</span>{" "}
                                                <code className="bg-gray-100 px-1 rounded">
                                                  {replacement.tokenGenerated?.substring(0, 8) || "N/A"}...
                                                </code>
                                              </div>
                                            </div>
                                            <div className="text-[9px] text-gray-500 mt-1">
                                              {new Date(replacement.timestamp).toLocaleString()}
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    } catch (error) {
                                      return (
                                        <span className="text-red-600 text-xs">
                                          Error displaying link replacements
                                        </span>
                                      )
                                    }
                                  })()}
                                </div>
                              </div>
                            )}
                        </div>
                      ) : null
                    }
                  />
                  {isLoading && (
                    <div className="flex justify-end mb-2">
                      <div className="bg-green-100 text-green-900 rounded-2xl rounded-bl-md shadow-sm px-4 py-3 max-w-[90%]">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-green-700 font-medium">
                            typing
                          </span>
                          <div className="flex space-x-1">
                            <div
                              className="w-2 h-2 bg-green-600 rounded-full animate-bounce"
                              style={{
                                animationDelay: "0ms",
                                animationDuration: "0.8s",
                              }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-green-600 rounded-full animate-bounce"
                              style={{
                                animationDelay: "150ms",
                                animationDuration: "0.8s",
                              }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-green-600 rounded-full animate-bounce"
                              style={{
                                animationDelay: "300ms",
                                animationDuration: "0.8s",
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-green-700 mt-1">
                          {new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                {/* Input improved - Fixed at bottom */}
                <div className="flex-shrink-0 flex items-center p-3 border-t bg-white">
                  {!hasValidWorkspace && (
                    <div className="flex-1 p-3 bg-yellow-50 border border-yellow-200 rounded-md mr-2">
                      <p className="text-sm text-yellow-800">
                        No workspace available. Please select a workspace to
                        send messages.
                      </p>
                    </div>
                  )}

                  {hasValidWorkspace && (
                    <>
                      <Textarea
                        ref={inputRef}
                        placeholder={
                          isLoading ? "Please wait..." : "Type a message"
                        }
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`flex-1 rounded-full border border-gray-300 px-4 py-2 mr-2 min-h-[40px] resize-none text-xs ${
                          isLoading ? "opacity-70" : ""
                        }`}
                        rows={2}
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={sendMessage}
                        disabled={!currentMessage.trim() || isLoading}
                        className={`bg-green-500 hover:bg-green-600 text-white rounded-full p-3 shadow transition h-10 w-10 flex items-center justify-center ${
                          isLoading ? "bg-gray-400" : ""
                        }`}
                        aria-label="Send message"
                      >
                        <Send size={20} />
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
