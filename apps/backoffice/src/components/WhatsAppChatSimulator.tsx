import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, X } from "lucide-react"
import { toast } from "@/lib/toast"

interface Message {
  id: string
  direction: "incoming" | "outgoing"
  content: string
  timestamp: Date
}

interface WhatsAppChatSimulatorProps {
  workspaceId: string
  phoneNumber: string
  language: string
  apiUrl?: string
  onClose?: () => void
}

/**
 * WhatsApp Chat Simulator
 * Simulates a WhatsApp chat conversation with the AI
 * Used in backoffice playground to test the channel
 */
export function WhatsAppChatSimulator({
  workspaceId,
  phoneNumber,
  language,
  apiUrl = "http://localhost:3001/api/v1",
  onClose,
}: WhatsAppChatSimulatorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      direction: "incoming",
      content: "👋 Ciao! Benvenuto. Come posso aiutarti?",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      direction: "outgoing",
      content: inputValue,
      timestamp: new Date(),
    }

    setInputValue("")
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const startTime = Date.now()

    try {
      const response = await fetch(`${apiUrl}/widget/chat/${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: `playground-${phoneNumber}`,
          message: inputValue,
          phoneNumber,
          language,
          isPlayground: true, // 🧪 Never deduct credits
        }),
      })

      // Ensure minimum 500ms loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, 500 - elapsedTime)
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime))
      }

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Failed to send message")
      }

      if (!data?.response) {
        throw new Error("No response from AI")
      }

      const aiMessage: Message = {
        id: `msg-${Date.now()}`,
        direction: "incoming",
        content: data.response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Failed to send message:", error)
      toast.error(error instanceof Error ? error.message : "Failed to send message")

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        direction: "incoming",
        content: "❌ Sorry, something went wrong. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">W</span>
          </div>
          <div>
            <h3 className="font-semibold">WhatsApp Test</h3>
            <p className="text-xs text-green-100">{phoneNumber}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="hover:brightness-95 p-1 rounded transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Testing Mode Banner */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
        <p className="text-xs text-blue-800 font-medium flex items-center gap-2">
          <span>💡</span>
          <span>Testing Mode - No credits deducted</span>
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-gray-50 p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.direction === "outgoing"
                    ? "bg-green-500 text-white rounded-br-none"
                    : "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
                }`}
              >
                <p className="text-sm break-words">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg rounded-bl-none">
                <div className="flex gap-2 items-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
