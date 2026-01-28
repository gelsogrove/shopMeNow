/**
 * ChatWidget Component
 * Embeddable WhatsApp-style chat widget for websites
 * 
 * Usage:
 * <ChatWidget workspaceId="your-workspace-id" position="bottom-right" />
 */

import React, { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatSurface } from "@/components/chat/ChatSurface"
import { TypingIndicator } from "@/components/chat/TypingIndicator"
import {
  getOrCreateVisitorId,
  loadWidgetMessages,
  loadWidgetSessionId,
  saveWidgetMessages,
  saveWidgetSessionId,
  sendWidgetMessage,
  type WidgetStoredMessage,
} from "@/components/chat/adapters/widgetAdapter"

interface Message {
  role: "user" | "bot"
  content: string
  timestamp?: string
}

interface ChatWidgetProps {
  workspaceId: string
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  theme?: "light" | "dark"
  logoUrl?: string
  title?: string
  placeholder?: string
  primaryColor?: string
  phoneNumber?: string // 📱 Optional phone number for playground testing (e.g., "+39 899 1234567")
  language?: string
  debugMode?: boolean // 🐛 Debug mode indicator (red dot if true)
  isPlayground?: boolean // 🧪 Playground mode - disables billing (default: false)
  apiUrl?: string
  onOpenChange?: (isOpen: boolean) => void
  onConvert?: (customerId: string) => void
}

// Determine API URL based on environment
const getApiUrl = () => {
  if (typeof window === "undefined") return "https://api.echatbot.ai/api/v1"
  
  // If running on localhost, use local backend
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3001/api/v1"
  }
  
  // Otherwise use production URL
  return "https://api.echatbot.ai/api/v1"
}

const DEFAULT_API_URL = getApiUrl()
const DEFAULT_PRIMARY_COLOR = "#22c55e"

export function ChatWidget({
  workspaceId,
  position = "bottom-right",
  theme = "light",
  logoUrl,
  title = "Chat with us 💬",
  placeholder = "Type a message...",
  primaryColor = DEFAULT_PRIMARY_COLOR,
  phoneNumber, // 📱 Playground phone number
  language,
  debugMode = false, // 🐛 Debug mode flag
  isPlayground = false, // 🧪 Playground mode - no billing
  apiUrl,
  onOpenChange,
  onConvert,
}: ChatWidgetProps) {
  console.log("🚀 ChatWidget MOUNTED! workspaceId prop:", workspaceId)
  
  // ⚠️ FALLBACK: If no workspaceId provided, check window for embed config or localStorage for testing
  const resolvedWorkspaceId = workspaceId || (typeof window !== "undefined" && (window as any).EchatbotWidgetConfig?.workspaceId) || (typeof localStorage !== "undefined" && localStorage.getItem("echatbot-workspace-id"))
  
  console.log("✅ Resolved workspaceId:", resolvedWorkspaceId)
  
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [visitorId, setVisitorId] = useState<string>("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  /**
   * Tooltip translations (multilingua)
   */
  const getTooltipText = (lang: string): string => {
    const translations: Record<string, string> = {
      it: "Ciao! 👋 Sono qui per aiutarti con qualsiasi domanda: come posso aiutarti oggi?",
      en: "Hello! 👋 I'm here to help you with any question: how can I help you today?",
      es: "¡Hola! 👋 Estoy aquí para ayudarte con cualquier pregunta: ¿cómo puedo ayudarte hoy?",
      pt: "Olá! 👋 Estou aqui para ajudá-lo com qualquer pergunta: como posso ajudá-lo hoje?",
    }
    return translations[lang] || translations.en
  }

  // Initialize visitor ID
  useEffect(() => {
    if (!resolvedWorkspaceId) {
      return
    }

    localStorage.setItem("echatbot-last-workspace-id", resolvedWorkspaceId)

    const id = getOrCreateVisitorId(localStorage, resolvedWorkspaceId)
    setVisitorId(id)

    // Load stored messages
    const storedMessages = loadWidgetMessages(localStorage, resolvedWorkspaceId)
    if (storedMessages.length > 0) {
      setMessages(storedMessages)
      console.log("📨 Loaded", storedMessages.length, "messages from localStorage")
    } else {
      console.log("📭 No messages in localStorage yet")
    }

    // Load session ID
    const session = loadWidgetSessionId(localStorage, resolvedWorkspaceId)
    if (session) {
      setSessionId(session)
      console.log("📋 Loaded session ID:", session)
    }
  }, [resolvedWorkspaceId])

  // Auto-scroll to latest message
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Ensure widget opens at the latest message (even if no new messages were added)
  useEffect(() => {
    if (!isOpen) return
    requestAnimationFrame(() => {
      if (typeof messagesEndRef.current?.scrollIntoView === "function") {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" })
      }
    })
  }, [isOpen])

  /**
   * Send message to API with minimum 500ms loading
   */
  const handleSendMessage = async () => {
    const message = inputValue.trim()
    if (!message || isLoading || !visitorId) return

    // Add user message
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    if (resolvedWorkspaceId) {
      saveWidgetMessages(localStorage, resolvedWorkspaceId, updatedMessages)
    }
    console.log("💾 Saved message to localStorage. Total messages:", updatedMessages.length)

    setInputValue("")
    setIsLoading(true)

    // ⏱️ Track start time for minimum 500ms loading
    const startTime = Date.now()

    try {
      const data = await sendWidgetMessage({
        apiUrl: apiUrl || DEFAULT_API_URL,
        workspaceId: resolvedWorkspaceId,
        visitorId,
        phoneNumber, // 📱 Pass phone number to backend
        message,
        language: language || navigator.language || "it",
        isPlayground, // 🧪 Pass playground flag for billing logic
        sessionId,
      })

      // ⏱️ Ensure minimum 500ms loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, 500 - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }

      // Save session ID if provided
      if (data.sessionId && resolvedWorkspaceId) {
        setSessionId(data.sessionId)
        saveWidgetSessionId(localStorage, resolvedWorkspaceId, data.sessionId)
      }

      // Add bot message
      const botMessage: Message = {
        role: "bot",
        content: data.response,
        timestamp: new Date().toISOString(),
      }
      const finalMessages = [...updatedMessages, botMessage]
      setMessages(finalMessages)
      if (resolvedWorkspaceId) {
        saveWidgetMessages(localStorage, resolvedWorkspaceId, finalMessages)
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      
      // ⏱️ Ensure minimum 500ms even for errors
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, 500 - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      const errorMessage: Message = {
        role: "bot",
        content:
          "Sorry, I couldn't process your message. Please try again or refresh the page.",
        timestamp: new Date().toISOString(),
      }
      const errorMessages = [...updatedMessages, errorMessage]
      setMessages(errorMessages)
      if (resolvedWorkspaceId) {
        saveWidgetMessages(localStorage, resolvedWorkspaceId, errorMessages)
      }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Convert visitor to customer
   */
  const convertVisitor = async (customerData: any) => {
    if (!visitorId) return

    try {
      const response = await fetch(`${apiUrl || DEFAULT_API_URL}/widget/convert-visitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: resolvedWorkspaceId,
          visitorId,
          ...customerData,
        }),
      })

      if (!response.ok) throw new Error("Conversion failed")

      const data = await response.json()
      if (data.success) {
        if (resolvedWorkspaceId) {
          const key = `echatbot-visitor-id:${resolvedWorkspaceId}`
          localStorage.removeItem(key)
        }
        onConvert?.(data.customerId)
        return data.customerId
      }
    } catch (error) {
      console.error("Failed to convert visitor:", error)
      throw error
    }
  }

  // Expose methods to parent
  useEffect(() => {
    const widget = {
      convertVisitor,
      getMessages: () => messages,
      getVisitorId: () => visitorId,
      clearHistory: () => {
        setMessages([])
        if (resolvedWorkspaceId) {
          const key = `echatbot-messages:${resolvedWorkspaceId}`
          localStorage.removeItem(key)
        }
      },
    }
    ;(window as any).eChatbotWidgetReact = widget
  }, [visitorId, messages])

  const isEmbedded = typeof window !== "undefined" && window.self !== window.top
  const defaultLogoUrl =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%2322c55e'/%3E%3Ccircle cx='35' cy='40' r='6' fill='%23fff'/%3E%3Ccircle cx='65' cy='40' r='6' fill='%23fff'/%3E%3Cpath d='M30 60 Q50 75 70 60' stroke='%23fff' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"
  const resolvedLogoUrl =
    !logoUrl || logoUrl.endsWith("/logo.png") ? defaultLogoUrl : logoUrl
  const positionClasses = {
    "bottom-right": isEmbedded ? "bottom-0 right-0" : "bottom-6 right-6",
    "bottom-left": isEmbedded ? "bottom-0 left-0" : "bottom-6 left-6",
    "top-right": isEmbedded ? "top-0 right-0" : "top-6 right-6",
    "top-left": isEmbedded ? "top-0 left-0" : "top-6 left-6",
  }

  const embeddedPopupSizeClasses = isEmbedded
    ? "w-full h-full rounded-[20px] shadow-none border-0"
    : "w-[380px] h-[620px] rounded-2xl shadow-2xl border border-gray-200"
  const embeddedButtonSizeClasses = isEmbedded ? "w-[44px] h-[44px]" : "w-[80px] h-[80px]"
  const embeddedButtonShapeClasses = "rounded-full"
  const embeddedButtonRingClasses = isEmbedded
    ? "border-2 bg-transparent"
    : "border-none bg-transparent"

  return (
    <>
      {/* Widget Button - Refactored Design with Tooltip */}
      {!isOpen && (
        <div className={cn(
          isEmbedded ? "absolute" : "fixed",
          "z-[2147483647]",
          positionClasses[position]
        )}>
          {/* Tooltip Balloon - Above the button */}
          {showTooltip && (
            <div
              className="absolute bottom-full right-0 mb-4 animate-in slide-in-from-bottom-2 fade-in duration-300"
              style={{ 
                width: "280px !important",
                maxWidth: "280px !important"
              }}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 relative"
                style={{
                  borderRadius: "16px !important",
                  padding: "16px !important",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important"
                }}
              >
                {/* Close button X */}
                <button
                  onClick={() => setShowTooltip(false)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
                  style={{
                    width: "20px !important",
                    height: "20px !important",
                    padding: "0 !important"
                  }}
                  aria-label="Close tooltip"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Tooltip Text */}
                <p 
                  className="text-sm text-gray-700 pr-6 leading-relaxed"
                  style={{
                    fontSize: "14px !important",
                    lineHeight: "1.5 !important",
                    color: "#374151 !important"
                  }}
                >
                  {getTooltipText(language || "en")}
                </p>
                
                {/* Triangle pointer */}
                <div 
                  className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r border-b border-gray-200 transform rotate-45"
                  style={{
                    width: "16px !important",
                    height: "16px !important"
                  }}
                />
              </div>
            </div>
          )}

          {/* Main Widget Button */}
          <button
            data-widget-button
            onClick={() => {
              setIsOpen(true)
              setShowTooltip(false)
              onOpenChange?.(true)
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setTimeout(() => setShowTooltip(false), 300)}
            className={cn(
              "rounded-full",
              "p-0",
              "bg-white",
              "border border-gray-200/50",
              "shadow-lg",
              "group flex items-center justify-center",
              "transition-all duration-200 ease-out",
              "hover:shadow-xl hover:border-gray-300",
              "active:scale-95",
              "focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-2",
              "relative"
            )}
            style={{
              width: "64px !important",
              height: "64px !important",
              minWidth: "64px !important",
              minHeight: "64px !important"
            }}
            aria-label="Open chat"
          >
            {/* Status Indicator - Top right corner */}
            <div
              className="absolute -top-1 -right-1 rounded-full border-2 border-white"
              style={{
                width: "16px !important",
                height: "16px !imdebugMode ? "#ef4444 !important" : "#22c55e !important",
                zIndex: "10 !important"
              }}
              title={debugMode
                (window as any).ECHATBOT_DEBUG_MODE === true) ? "Debug Mode" : "Online"}
            />

            {/* Chat Icon - Larger */}
            <div 
              className="flex items-center justify-center"
              style={{
                width: "100% !important",
                height: "100% !important"
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-600"
                style={{
                  width: "36px !important",
                  height: "36px !important",
                  color: primaryColor + " !important"
                }}
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Widget Popup - Enhanced Design */}
      {isOpen && (
        <div
          className={cn(
            isEmbedded ? "absolute" : "fixed",
            "z-[2147483646] flex flex-col",
            "bg-white backdrop-blur-sm",
            "overflow-hidden",
            embeddedPopupSizeClasses,
            "animate-in slide-in-from-bottom-4 fade-in duration-300",
            "shadow-2xl shadow-black/20",
            positionClasses[position]
          )}
        >
          {/* Header */}
          <div
            className="text-white px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">{title}</h2>
            </div>
            <button
              onClick={() => {
                setIsOpen(false)
                onOpenChange?.(false)
              }}
              className="hover:brightness-95 p-1 rounded transition-colors"
              style={{ backgroundColor: "transparent" }}
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Container */}
          <ScrollArea className="flex-1 bg-slate-50 px-4 py-3">
            <ChatSurface
              messages={messages}
              endRef={messagesEndRef}
              emptyState={
                <div className="text-gray-400 text-sm text-center py-12">
                  <p>Start a conversation! 👋</p>
                </div>
              }
              getAlignment={(msg) => (msg.role === "user" ? "right" : "left")}
              getBubbleClassName={(msg) =>
                cn(
                  "rounded-2xl px-3 py-3 max-w-[85%] sm:max-w-[400px] mb-2 shadow-sm",
                  "word-wrap break-words overflow-wrap-anywhere relative",
                  msg.role === "user"
                    ? "text-white rounded-br-md"
                    : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                )
              }
              getBubbleStyle={(msg) =>
                msg.role === "user" ? { backgroundColor: primaryColor } : undefined
              }
              getContainerClassName={(msg) =>
                msg.role === "user" ? "widget-user-message" : undefined
              }
            />
            
            {/* Typing Indicator - Shows while loading */}
            {isLoading && (
              <div className="flex justify-start mb-2">
                <TypingIndicator primaryColor={primaryColor} />
              </div>
            )}
          </ScrollArea>

          {/* Footer with Input */}
          <div className="border-t border-gray-200 p-4 space-y-2">
            <div className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={placeholder}
              disabled={isLoading}
              rows={2}
              className={cn(
                "flex-1 resize-none px-4 py-3 rounded-2xl border border-gray-300",
                "focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600",
                "text-sm placeholder-gray-400 leading-5",
                "disabled:bg-gray-50 disabled:text-gray-400"
              )}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "disabled:bg-gray-300 hover:brightness-95",
                "text-white transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-green-600"
              )}
              style={{ backgroundColor: primaryColor }}
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
            </div>
            <div className="text-[10px] text-gray-400 text-center">
              Powered by{" "}
              <a
                href="https://www.echatbot.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-700 hover:underline"
              >
                echatbot.ai
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatWidget
