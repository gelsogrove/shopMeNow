/**
 * ChatWidget Component
 * Embeddable WhatsApp-style chat widget for websites
 * 
 * Usage:
 * <ChatWidget workspaceId="your-workspace-id" position="bottom-right" />
 */

import React, { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "bot"
  content: string
  timestamp?: Date
}

interface ChatWidgetProps {
  workspaceId: string
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  theme?: "light" | "dark"
  logoUrl?: string
  title?: string
  placeholder?: string
  onConvert?: (customerId: string) => void
}

const STORAGE_KEYS = {
  VISITOR_ID: "echatbot-visitor-id",
  SESSION_ID: "echatbot-session-id",
  MESSAGES: "echatbot-messages",
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

export function ChatWidget({
  workspaceId,
  position = "bottom-right",
  theme = "light",
  logoUrl,
  title = "Chat with us 💬",
  placeholder = "Type a message...",
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize visitor ID
  useEffect(() => {
    let id = localStorage.getItem(STORAGE_KEYS.VISITOR_ID)
    if (!id) {
      id = "webvisitor-" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
      localStorage.setItem(STORAGE_KEYS.VISITOR_ID, id)
      console.log("🆕 New visitor ID created:", id)
    } else {
      console.log("♻️ Existing visitor ID loaded:", id)
    }
    setVisitorId(id)

    // Load stored messages
    const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    if (stored) {
      try {
        const messages = JSON.parse(stored)
        setMessages(messages)
        console.log("📨 Loaded", messages.length, "messages from localStorage")
      } catch (e) {
        console.error("Failed to load messages:", e)
      }
    } else {
      console.log("📭 No messages in localStorage yet")
    }

    // Load session ID
    const session = localStorage.getItem(STORAGE_KEYS.SESSION_ID)
    if (session) {
      setSessionId(session)
      console.log("📋 Loaded session ID:", session)
    }
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
      timestamp: new Date(),
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedMessages))
    console.log("💾 Saved message to localStorage. Total messages:", updatedMessages.length)

    setInputValue("")
    setIsLoading(true)

    try {
      const response = await fetch(`${DEFAULT_API_URL}/widget/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: resolvedWorkspaceId,
          visitorId,
          message,
          customerLanguage: navigator.language || "it",
        }),
      })

      if (!response.ok) throw new Error("API Error")

      const data = await response.json()

      if (data.success && data.response) {
        // Save session ID if provided
        if (data.sessionId) {
          setSessionId(data.sessionId)
          localStorage.setItem(STORAGE_KEYS.SESSION_ID, data.sessionId)
        }

        // Add bot message
        const botMessage: Message = {
          role: "bot",
          content: data.response,
          timestamp: new Date(),
        }
        const finalMessages = [...updatedMessages, botMessage]
        setMessages(finalMessages)
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(finalMessages))
      } else {
        throw new Error("No response from bot")
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      const errorMessage: Message = {
        role: "bot",
        content:
          "Sorry, I couldn't process your message. Please try again or refresh the page.",
        timestamp: new Date(),
      }
      const errorMessages = [...updatedMessages, errorMessage]
      setMessages(errorMessages)
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(errorMessages))
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
      const response = await fetch(`${DEFAULT_API_URL}/widget/convert-visitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          visitorId,
          ...customerData,
        }),
      })

      if (!response.ok) throw new Error("Conversion failed")

      const data = await response.json()
      if (data.success) {
        localStorage.removeItem(STORAGE_KEYS.VISITOR_ID)
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
        localStorage.removeItem(STORAGE_KEYS.MESSAGES)
      },
    }
    ;(window as any).eChatbotWidgetReact = widget
  }, [visitorId, messages])

  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "top-right": "top-6 right-6",
    "top-left": "top-6 left-6",
  }

  return (
    <>
      {/* Widget Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed z-[2147483647] w-24 h-24 rounded-full",
            "bg-transparent active:scale-90 active:rotate-6",
            "border-none shadow-none",
            "flex items-center justify-center transition-transform duration-200 hover:scale-105",
            "focus:outline-none",
            positionClasses[position]
          )}
          aria-label="Open chat"
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Chat" className="w-full h-full object-contain" />
          ) : (
            <span className="text-white text-2xl">💬</span>
          )}
        </button>
      )}

      {/* Widget Popup */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-[2147483646] flex flex-col",
            "w-96 h-[600px] bg-white rounded-lg shadow-2xl",
            "border border-gray-200 overflow-hidden",
            "animate-in slide-in-from-bottom-4",
            positionClasses[position]
          )}
        >
          {/* Header */}
          <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">{title}</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-green-700 p-1 rounded transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Container */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3 pr-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm text-center py-12">
                  <p>Start a conversation! 👋</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex mb-3",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] px-4 py-2 rounded-lg text-sm break-words",
                        msg.role === "user"
                          ? "bg-green-600 text-white rounded-br-none"
                          : "bg-gray-100 text-black rounded-bl-none"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Footer with Input */}
          <div className="border-t border-gray-200 p-4 space-y-2">
            <div className="flex gap-2">
            <input
              type="text"
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
              className={cn(
                "flex-1 px-4 py-2 rounded-full border border-gray-300",
                "focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600",
                "text-sm placeholder-gray-400",
                "disabled:bg-gray-50 disabled:text-gray-400"
              )}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-green-600 hover:bg-green-700 disabled:bg-gray-300",
                "text-white transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-green-600"
              )}
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
