/**
 * ChatWidget Component
 * Embeddable WhatsApp-style chat widget for websites
 * 
 * Usage:
 * <ChatWidget workspaceId="your-workspace-id" position="bottom-right" />
 */

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatSurface } from "@/components/chat/ChatSurface"
import { useLanguage } from "@/contexts/LanguageContext"
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
  language?: string
  apiUrl?: string
  onOpenChange?: (isOpen: boolean) => void
  onConvert?: (customerId: string) => void
}

// Determine API URL based on environment
const getApiUrl = () => {
  if (typeof window === "undefined") return "https://api.echatbot.ai/api/v1"
  
  // If running on localhost, use local backend
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"
  }
  
  // Otherwise use production URL
  return import.meta.env.VITE_API_URL || "https://api.echatbot.ai/api/v1"
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
  language,
  apiUrl,
  onOpenChange,
  onConvert,
}: ChatWidgetProps) {
  console.log("🚀 ChatWidget MOUNTED! workspaceId prop:", workspaceId)
  
  // 🌍 Get language from LanguageContext (header dropdown)
  const { language: headerLanguage } = useLanguage()
  
  // ⚠️ PRIORITY: Read from window.eChatbotConfig first (set by WidgetLoader)
  const widgetConfig = typeof window !== "undefined" ? (window as any).eChatbotConfig : null
  
  // Resolve workspaceId: window config > prop > fallback
  const resolvedWorkspaceId = widgetConfig?.workspaceId || workspaceId || (typeof localStorage !== "undefined" && localStorage.getItem("echatbot-workspace-id"))
  
  // Resolve language: LanguageContext > window config > prop > "en"
  const resolvedLanguage = headerLanguage || widgetConfig?.language || language || "en"
  
  // Resolve other props from window config
  const resolvedTitle = widgetConfig?.title || title
  const resolvedPrimaryColor = widgetConfig?.primaryColor || primaryColor
  const resolvedLogoUrl = widgetConfig?.logoUrl || logoUrl
  const resolvedApiUrl = widgetConfig?.apiUrl || apiUrl || DEFAULT_API_URL
  
  console.log("✅ Resolved widget config:", {
    workspaceId: resolvedWorkspaceId,
    language: resolvedLanguage,
    headerLanguage: headerLanguage,
    widgetConfigLanguage: widgetConfig?.language,
    title: resolvedTitle,
    apiUrl: resolvedApiUrl,
  })
  
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [visitorId, setVisitorId] = useState<string>("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
   * Send message to API
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

    try {
      const data = await sendWidgetMessage({
        apiUrl: resolvedApiUrl,
        workspaceId: resolvedWorkspaceId,
        visitorId,
        message,
        language: resolvedLanguage, // Use language from window.eChatbotConfig (set by LanguageSelector)
        sessionId,
      })

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
      const response = await fetch(`${resolvedApiUrl}/widget/convert-visitor`, {
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
  const displayLogoUrl =
    !resolvedLogoUrl || resolvedLogoUrl.endsWith("/logo.png") ? defaultLogoUrl : resolvedLogoUrl
  const positionClasses = {
    "bottom-right": isEmbedded ? "bottom-2 right-2" : "bottom-6 right-6",
    "bottom-left": isEmbedded ? "bottom-2 left-2" : "bottom-6 left-6",
    "top-right": isEmbedded ? "top-2 right-2" : "top-6 right-6",
    "top-left": isEmbedded ? "top-2 left-2" : "top-6 left-6",
  }

  const embeddedPopupSizeClasses = isEmbedded
    ? "w-full h-full rounded-[24px] shadow-none border-2"
    : "w-[420px] h-[680px] rounded-3xl shadow-none border-2"
    
  // Generate light version of primary color for border
  const getBorderColor = (color: string) => {
    // Convert hex to rgba with 30% opacity for a light tint
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, 0.3)`
    }
    return color
  }
  const borderColor = getBorderColor(resolvedPrimaryColor)
  
  const embeddedButtonSizeClasses = isEmbedded ? "w-[56px] h-[56px]" : "w-[60px] h-[60px]"
  const embeddedButtonShapeClasses = "rounded-full"
  const embeddedButtonRingClasses = isEmbedded
    ? "border-2 bg-transparent"
    : "border-none bg-transparent"

  // Hide any external widget buttons when our popup is open
  useEffect(() => {
    if (isOpen) {
      // Hide all widget buttons (ours and any external ones)
      const widgetButtons = document.querySelectorAll('[data-widget-button], .echatbot-widget-button, #echatbot-button, [class*="echatbot-widget"]')
      widgetButtons.forEach((btn) => {
        if (btn instanceof HTMLElement) {
          btn.style.display = 'none'
        }
      })
    } else {
      // Show them back when closed
      const widgetButtons = document.querySelectorAll('[data-widget-button], .echatbot-widget-button, #echatbot-button, [class*="echatbot-widget"]')
      widgetButtons.forEach((btn) => {
        if (btn instanceof HTMLElement) {
          btn.style.display = ''
        }
      })
    }
  }, [isOpen])

  return (
    <>
      {/* Overlay - Darkens page when widget is open */}
      {isOpen && !isEmbedded && (
        <div
          className="fixed inset-0 bg-black/50 z-[2147483645] animate-in fade-in duration-300"
          onClick={() => {
            setIsOpen(false)
            onOpenChange?.(false)
          }}
          aria-label="Close chat overlay"
        />
      )}

      {/* Widget Button - Glassmorphism Style */}
      {!isOpen && (
        <button
          data-widget-button
          onClick={() => {
            setIsOpen(true)
            onOpenChange?.(true)
          }}
          className={cn(
            isEmbedded ? "absolute" : "fixed",
            "z-[2147483647] rounded-full",
            embeddedButtonSizeClasses,
            "active:scale-95",
            // Transparent background
            "bg-transparent",
            "border-none",
            "shadow-none",
            "group flex items-center justify-center",
            "transition-all duration-300 ease-out",
            "hover:scale-110",
            "hover:bg-transparent",
            "focus:outline-none",
            positionClasses[position]
          )}
          aria-label="Open chat"
        >
          <img
            src={displayLogoUrl}
            alt="Chat"
            className="h-full w-full rounded-full object-cover"
          />
        </button>
      )}

      {/* Widget Popup - Enhanced Design */}
      {isOpen && (
        <div
          className={cn(
            isEmbedded ? "absolute" : "fixed",
            "z-[2147483647] flex flex-col",
            "bg-white",
            "overflow-hidden overscroll-contain isolate",
            embeddedPopupSizeClasses,
            "animate-in slide-in-from-bottom-4 fade-in duration-300",
            positionClasses[position]
          )}
          style={{ borderColor }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="text-white px-6 py-4 flex items-center justify-between"
            style={{ backgroundColor: resolvedPrimaryColor }}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg">{resolvedTitle}</h2>
            </div>
            <button
              onClick={() => {
                setIsOpen(false)
                onOpenChange?.(false)
              }}
              className="hover:brightness-95 p-2 rounded-lg transition-colors"
              style={{ backgroundColor: "transparent" }}
              aria-label="Close chat"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Messages Container */}
          <ScrollArea 
            className="flex-1 bg-slate-50 px-5 py-4 widget-scroll-area overscroll-contain"
          >
            <style>{`
              .widget-scroll-area {
                overscroll-behavior: contain;
              }
              .widget-scroll-area > div > div:first-child {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
                overscroll-behavior: contain !important;
              }
              .widget-scroll-area > div > div:first-child::-webkit-scrollbar {
                display: none !important;
              }
              .widget-scroll-area [data-radix-scroll-area-scrollbar] {
                display: flex !important;
                width: 8px !important;
                padding: 2px !important;
                background: transparent !important;
              }
              .widget-scroll-area [data-radix-scroll-area-thumb] {
                background-color: ${resolvedPrimaryColor} !important;
                border-radius: 4px !important;
              }
            `}</style>
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
                  "rounded-2xl px-4 py-3 max-w-[85%] sm:max-w-[360px] mb-3 shadow-sm",
                  "word-wrap break-words overflow-wrap-anywhere relative text-[15px] leading-relaxed",
                  msg.role === "user"
                    ? "text-white rounded-br-md"
                    : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                )
              }
              getBubbleStyle={(msg) =>
                msg.role === "user" ? { backgroundColor: resolvedPrimaryColor } : undefined
              }
              getContainerClassName={(msg) =>
                msg.role === "user" ? "widget-user-message" : undefined
              }
            />
          </ScrollArea>

          {/* Footer with Input */}
          <div className="border-t border-gray-200 p-5 space-y-3">
            <div className="flex gap-3">
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
                "text-[15px] placeholder-gray-400 leading-relaxed",
                "disabled:bg-gray-50 disabled:text-gray-400"
              )}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                "disabled:bg-gray-300 hover:brightness-95",
                "text-white transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-green-600"
              )}
              style={{ backgroundColor: resolvedPrimaryColor }}
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
            </div>
            <div className="text-xs text-gray-400 text-center">
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
