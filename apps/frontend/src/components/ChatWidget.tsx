/**
 * ChatWidget Component
 * Embeddable WhatsApp-style chat widget for websites
 * 
 * Usage:
 * <ChatWidget workspaceId="your-workspace-id" position="bottom-right" />
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Loader2,
  Send,
  X,
  MessageCircle,
  Sparkles,
  Bot,
  LifeBuoy,
  Brain,
  Zap,
  MessageSquare,
  HelpCircle,
  Phone,
  Cpu,
  MessagesSquare,
  User,
  Star,
  Heart,
  Bell,
  Shield,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * TypingIndicator - 3 bouncing dots animation (like Payload playground)
 */
function TypingIndicator({ primaryColor }: { primaryColor: string }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-bl-md max-w-[85px] shadow-sm mb-3">
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-8px) scale(1.1);
            opacity: 1;
          }
        }
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: typingBounce 1.4s infinite ease-in-out;
        }
        .typing-dot:nth-child(1) {
          animation-delay: 0s;
        }
        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>
      <div className="typing-dot" style={{ backgroundColor: primaryColor }} />
      <div className="typing-dot" style={{ backgroundColor: primaryColor }} />
      <div className="typing-dot" style={{ backgroundColor: primaryColor }} />
    </div>
  )
}
import { ChatSurface } from "@/components/chat/ChatSurface"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  getOrCreateVisitorId,
  loadWidgetMessages,
  loadWidgetSessionId,
  loadCustomerId,
  saveWidgetMessages,
  saveWidgetSessionId,
  saveCustomerId,
  sendWidgetMessage,
  registerAndStartChat,
  getWidgetStatus,
  type WidgetStoredMessage,
} from "@/components/chat/adapters/widgetAdapter"

// Supported language codes (browser language detection)
const SUPPORTED_LANG_CODES = ["it", "en", "es", "pt", "fr", "de"]

interface Message {
  role: "user" | "bot"
  content: string
  timestamp?: string
  suggestions?: string[]
}

interface ChatWidgetProps {
  workspaceId: string
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  theme?: "light" | "dark"
  logoUrl?: string
  useChannelLogo?: boolean
  useWindowConfig?: boolean
  title?: string
  placeholder?: string
  primaryColor?: string
  icon?: string
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

type LangCode = "it" | "en" | "es" | "pt" | "fr" | "de"

const UI_STRINGS: Record<
  LangCode,
  {
    intro: string
    name: string
    phone: string
    message: string
    namePh: string
    phonePh: string
    messagePh: string
    start: string
    termsLabel: string
    viewTerms: string
    back: string
    termsTitle: string
    termsBody: string
  }
> = {
  it: {
    intro: "Presentati per iniziare a chattare",
    name: "Nome",
    phone: "Telefono",
    message: "Messaggio",
    namePh: "Il tuo nome",
    phonePh: "+39 312 345 6789",
    messagePh: "Come possiamo aiutarti?",
    start: "Inizia chat",
    termsLabel: "Accetto Termini e Condizioni e ricevere comunicazioni su WhatsApp",
    viewTerms: "Leggi Termini",
    back: "Indietro",
    termsTitle: "Termini e Condizioni",
    termsBody:
      "Accettando, autorizzi eChatbot a contattarti su WhatsApp per assistenza, notifiche e offerte. Puoi revocare il consenso in qualsiasi momento rispondendo STOP o scrivendo al supporto.",
  },
  en: {
    intro: "Introduce yourself to start chatting",
    name: "Name",
    phone: "Phone",
    message: "Message",
    namePh: "Your name",
    phonePh: "+1 415 555 1212",
    messagePh: "How can we help you?",
    start: "Start Chat",
    termsLabel: "I accept Terms & Conditions and WhatsApp updates",
    viewTerms: "View Terms",
    back: "Back",
    termsTitle: "Terms & Conditions",
    termsBody:
      "By accepting you allow eChatbot to message you on WhatsApp for support, notifications, and offers. You can revoke anytime by replying STOP or contacting support.",
  },
  es: {
    intro: "Preséntate para comenzar a chatear",
    name: "Nombre",
    phone: "Teléfono",
    message: "Mensaje",
    namePh: "Tu nombre",
    phonePh: "+34 612 345 678",
    messagePh: "¿Cómo podemos ayudarte?",
    start: "Iniciar chat",
    termsLabel: "Acepto Términos y recibir novedades por WhatsApp",
    viewTerms: "Ver Términos",
    back: "Volver",
    termsTitle: "Términos y Condiciones",
    termsBody:
      "Al aceptar, autorizas a eChatbot a contactarte por WhatsApp para soporte, notificaciones y ofertas. Puedes revocar el consentimiento en cualquier momento respondiendo STOP o escribiendo al soporte.",
  },
  pt: {
    intro: "Apresente-se para começar a conversar",
    name: "Nome",
    phone: "Telefone",
    message: "Mensagem",
    namePh: "Seu nome",
    phonePh: "+55 11 91234-5678",
    messagePh: "Como podemos ajudar?",
    start: "Iniciar chat",
    termsLabel: "Aceito Termos e receber novidades no WhatsApp",
    viewTerms: "Ver Termos",
    back: "Voltar",
    termsTitle: "Termos e Condições",
    termsBody:
      "Ao aceitar, você autoriza a eChatbot a contatá-lo pelo WhatsApp para suporte, notificações e ofertas. Você pode revogar a qualquer momento respondendo STOP ou falando com o suporte.",
  },
  fr: {
    intro: "Présentez-vous pour commencer à discuter",
    name: "Nom",
    phone: "Téléphone",
    message: "Message",
    namePh: "Votre nom",
    phonePh: "+33 6 12 34 56 78",
    messagePh: "Comment pouvons-nous vous aider ?",
    start: "Commencer",
    termsLabel: "J'accepte les Conditions et les mises à jour WhatsApp",
    viewTerms: "Voir les Conditions",
    back: "Retour",
    termsTitle: "Conditions Générales",
    termsBody:
      "En acceptant, vous autorisez eChatbot à vous contacter sur WhatsApp pour support, notifications et offres. Vous pouvez retirer votre consentement à tout moment en répondant STOP ou en contactant le support.",
  },
  de: {
    intro: "Stell dich vor, um zu chatten",
    name: "Name",
    phone: "Telefon",
    message: "Nachricht",
    namePh: "Dein Name",
    phonePh: "+49 170 1234567",
    messagePh: "Wie können wir helfen?",
    start: "Chat starten",
    termsLabel: "Ich akzeptiere AGB und WhatsApp-Updates",
    viewTerms: "AGB ansehen",
    back: "Zurück",
    termsTitle: "Allgemeine Bedingungen",
    termsBody:
      "Mit der Zustimmung erlaubst du eChatbot, dich über WhatsApp für Support, Benachrichtigungen und Angebote zu kontaktieren. Du kannst dies jederzeit widerrufen, indem du STOP antwortest oder den Support kontaktierst.",
  },
}

export function ChatWidget({
  workspaceId,
  position = "bottom-right",
  theme = "light",
  logoUrl,
  useChannelLogo,
  useWindowConfig = true,
  title = "Chat with us 💬",
  placeholder = "Type a message...",
  primaryColor = DEFAULT_PRIMARY_COLOR,
  icon,
  language,
  apiUrl,
  onOpenChange,
  onConvert,
}: ChatWidgetProps) {
  console.log("🚀 ChatWidget MOUNTED! workspaceId prop:", workspaceId)
  
  // 🌍 Get language from LanguageContext (header dropdown)
  const { language: headerLanguage } = useLanguage()
  
  // ⚠️ PRIORITY: Read from window.eChatbotConfig first (set by WidgetLoader)
  const [configVersion, setConfigVersion] = useState(0)
  const widgetConfig = useMemo(() => {
    if (!useWindowConfig || typeof window === "undefined") return null
    return (window as any).eChatbotConfig || null
  }, [configVersion, useWindowConfig])

  useEffect(() => {
    const cfg = typeof window !== "undefined" ? (window as any).eChatbotConfig : null
    console.debug("🔎 ChatWidget resolved config", {
      fromWindow: cfg,
      resolvedIcon,
      resolvedPrimaryColor,
      configVersion,
    })
  }, [configVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: poll window.eChatbotConfig for late injections (handles cases where events are missed)
  const lastConfigRef = useRef<string | null>(null)
  useEffect(() => {
    if (!useWindowConfig || typeof window === "undefined") return
    const interval = setInterval(() => {
      try {
        const current = (window as any).eChatbotConfig || null
        const serialized = current ? JSON.stringify(current) : null
        if (serialized && serialized !== lastConfigRef.current) {
          lastConfigRef.current = serialized
          setConfigVersion((v) => v + 1)
        }
      } catch {
        // ignore JSON errors
      }
    }, 800)
    return () => clearInterval(interval)
  }, [])

  // Re-render when WidgetLoader broadcasts config changes
  useEffect(() => {
    if (!useWindowConfig || typeof window === "undefined") return
    const handler = () => setConfigVersion((v) => v + 1)
    window.addEventListener("echatbot-config-updated", handler)
    // Run once in case config is already present
    handler()
    return () => window.removeEventListener("echatbot-config-updated", handler)
  }, [])
  
  // Resolve workspaceId: window config > prop > fallback
  const resolvedWorkspaceId = widgetConfig?.workspaceId || workspaceId || (typeof localStorage !== "undefined" && localStorage.getItem("echatbot-workspace-id"))
  
  // Resolve language: window config > prop > header > "en"
  const resolvedLanguage = widgetConfig?.language || language || headerLanguage || "en"
  const resolvedLangKey = (resolvedLanguage?.slice(0, 2).toLowerCase() as LangCode) || "en"
  const ui = UI_STRINGS[resolvedLangKey] || UI_STRINGS.en
  
  // Resolve other props from window config
  const resolvedTitle = widgetConfig?.title || title
  const resolvedPrimaryColor = widgetConfig?.primaryColor || primaryColor
  const resolvedLogoUrl = widgetConfig?.logoUrl || logoUrl
  const resolvedUseChannelLogoRaw = (widgetConfig as any)?.useChannelLogo
  const resolvedUseChannelLogo =
    resolvedUseChannelLogoRaw === true ||
    resolvedUseChannelLogoRaw === "true" ||
    useChannelLogo === true
  const resolvedIcon = widgetConfig?.icon || icon || "chat"
  const resolvedApiUrl = widgetConfig?.apiUrl || apiUrl || DEFAULT_API_URL
  const resolvedAutoSuggestionsEnabled =
    (widgetConfig as any)?.autoSuggestionsEnabled === true
  const resolvedQuickReplies = Array.isArray((widgetConfig as any)?.quickReplies)
    ? (widgetConfig as any)?.quickReplies.slice(0, 4)
    : []
  const resolvedPlaceholder =
    widgetConfig?.placeholder ||
    {
      it: "Scrivi un messaggio...",
      en: "Type a message...",
      es: "Escribe un mensaje...",
      pt: "Digite uma mensagem...",
      fr: "Écrivez un message...",
      de: "Nachricht schreiben...",
    }[resolvedLangKey] ||
    "Type a message..."
  
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
  const [customerId, setCustomerId] = useState<string | null>(null)
  // Operator handoff: when chatbot is disabled, poll for operator replies
  const [botDisabled, setBotDisabled] = useState(false)
  const lastOperatorMsgAt = useRef<string>(new Date().toISOString())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Registration form state
  // showRegistrationForm=true by default; set to false if customerId found in localStorage
  const [showRegistrationForm, setShowRegistrationForm] = useState(true)
  const [formName, setFormName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formLanguage, setFormLanguage] = useState<LangCode>("en")
  const [formFirstMessage, setFormFirstMessage] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsContent, setShowTermsContent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [workspaceConfig, setWorkspaceConfig] = useState<{
    debugMode?: boolean
    channelStatus?: boolean
    whatsappPhoneNumber?: string | null
    name?: string | null
  } | null>(null)

  // Initialize visitor ID, customerId, and registration form state
  useEffect(() => {
    if (!resolvedWorkspaceId) {
      return
    }

    localStorage.setItem("echatbot-last-workspace-id", resolvedWorkspaceId)

    const id = getOrCreateVisitorId(localStorage, resolvedWorkspaceId)
    setVisitorId(id)

    // Check if returning registered user (customerId persists across visitorId expiry)
    const storedCustomerId = loadCustomerId(localStorage, resolvedWorkspaceId)
    if (storedCustomerId) {
      setCustomerId(storedCustomerId)
      setShowRegistrationForm(false) // Skip form for returning registered users
      console.log("👤 Returning registered user (from localStorage), skipping registration form")
      // Still fetch workspace status to get debug/phone info
      ;(async () => {
        try {
          const statusResp = await getWidgetStatus({
            apiUrl: resolvedApiUrl,
            workspaceId: resolvedWorkspaceId,
            visitorId: id,
            language: resolvedLanguage,
          })
          if (statusResp?.workspace) {
            setWorkspaceConfig({
              debugMode: statusResp.workspace.debugMode,
              channelStatus: statusResp.workspace.channelStatus,
              whatsappPhoneNumber: statusResp.workspace.whatsappPhoneNumber,
              name: statusResp.workspace.name,
            })
          }
        } catch (err) {
          console.debug("Workspace status fetch skipped (returning user path)", err)
        }
      })()
    } else {
      // 🕵️ RECONCILIATION: Check server if visitorId is already linked (handles refresh after Step 7 success but partial 500 error)
      const reconcileVisitor = async () => {
        try {
          const statusResp = await getWidgetStatus({
            apiUrl: resolvedApiUrl,
            workspaceId: resolvedWorkspaceId,
            visitorId: id,
            language: resolvedLanguage,
          })

          // Capture workspace config flags (debugMode, channelStatus, phone) for UI
          if (statusResp?.workspace) {
            setWorkspaceConfig({
              debugMode: statusResp.workspace.debugMode,
              channelStatus: statusResp.workspace.channelStatus,
              whatsappPhoneNumber: statusResp.workspace.whatsappPhoneNumber,
              name: statusResp.workspace.name,
            })
          }

          if (statusResp?.customer?.id) {
            console.log("👤 Visitor recognized from server! Skipping registration form", {
              customerId: statusResp.customer.id
            })
            const cId = statusResp.customer.id
            setCustomerId(cId)
            saveCustomerId(localStorage, resolvedWorkspaceId, cId)
            setShowRegistrationForm(false)
          }
        } catch (err) {
          console.debug("🕵️ Reconcile skipped (server status unavailable)", err)
        }
      }
      reconcileVisitor()
    }

    // Pre-select language from widget config
    const normalizedLang = (resolvedLanguage?.slice(0, 2).toLowerCase() as LangCode) || "en"
    setFormLanguage(SUPPORTED_LANG_CODES.includes(normalizedLang) ? normalizedLang : "en")

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
  }, [resolvedWorkspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Operator handoff polling ────────────────────────────────────────────
  // When the chatbot is disabled (operator mode), poll every 5s for new
  // messages sent by the operator and check if the chatbot was re-enabled.
  useEffect(() => {
    if (!botDisabled || !visitorId || !resolvedWorkspaceId) return

    const poll = async () => {
      try {
        const resp = await fetch(
          `${resolvedApiUrl}/widget/operator-messages?visitorId=${encodeURIComponent(visitorId)}&workspaceId=${encodeURIComponent(resolvedWorkspaceId)}&since=${encodeURIComponent(lastOperatorMsgAt.current)}`
        )
        if (!resp.ok) return
        const data = await resp.json()

        // Check if chatbot was re-enabled by operator
        if (data.activeChatbot === true) {
          setBotDisabled(false)
          return
        }

        // Append new operator messages
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const newMsgs = (
            data.messages as { id: string; content: string; createdAt: string }[]
          ).map((m) => ({
            role: "bot" as const,
            content: m.content,
            timestamp: m.createdAt,
          }))
          setMessages((prev) => {
            const updated = [...prev, ...newMsgs]
            if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, updated)
            return updated
          })
          // Update since timestamp to the latest message
          const latest = data.messages[data.messages.length - 1].createdAt
          lastOperatorMsgAt.current = latest
        }
      } catch {
        // Silently ignore network errors during polling
      }
    }

    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botDisabled, visitorId, resolvedWorkspaceId, resolvedApiUrl])

  /**
   * Send message to API
   */
  const sendMessage = async (text: string) => {
    const message = text.trim()
    // RULE: Block all LLM messages when operator handoff is active
    if (!message || isLoading || !visitorId || botDisabled) return

    // Add user message — also clear any suggestions from prior bot messages immediately
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [
      ...messages.map((m) => (m.role === "bot" && m.suggestions ? { ...m, suggestions: undefined } : m)),
      userMessage,
    ]
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
        customerId: customerId || undefined, // Pass registered customer ID if available
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
        suggestions: data.suggestions,
      }
      const finalMessages = [...updatedMessages, botMessage]
      setMessages(finalMessages)
      if (resolvedWorkspaceId) {
        saveWidgetMessages(localStorage, resolvedWorkspaceId, finalMessages)
      }

      // Check if chatbot was disabled by operator handoff.
      // Backend now returns activeChatbot:false directly in the chat response when
      // the contactOperator CF was triggered — use that immediately (no separate poll).
      if (!botDisabled) {
        if (data.activeChatbot === false) {
          setBotDisabled(true)
          lastOperatorMsgAt.current = new Date().toISOString()
        } else if (visitorId && resolvedWorkspaceId) {
          // Fallback: backend didn't include flag — do a one-shot poll check
          try {
            const checkResp = await fetch(
              `${resolvedApiUrl}/widget/operator-messages?visitorId=${encodeURIComponent(visitorId)}&workspaceId=${encodeURIComponent(resolvedWorkspaceId)}&since=9999-12-31`
            )
            if (checkResp.ok) {
              const checkData = await checkResp.json()
              if (checkData.activeChatbot === false) {
                setBotDisabled(true)
                lastOperatorMsgAt.current = new Date().toISOString()
              }
            }
          } catch {
            // Ignore — this is a best-effort check
          }
        }
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

  const handleSendMessage = async () => {
    await sendMessage(inputValue)
  }

  /**
   * Handle registration form submit
   * Creates/finds customer by phone, sends first message through LLM
   */
  const handleRegistrationSubmit = async () => {
    // Basic client-side validation
    if (!formName.trim()) {
      setFormError("Name is required")
      return
    }
    if (!formPhone.trim()) {
      setFormError("Phone number is required")
      return
    }
    if (!/^\+\d{1,4}\d{6,14}$/.test(formPhone.trim())) {
      setFormError("Phone must be in international format (e.g. +39 1234567890)")
      return
    }
    if (!formFirstMessage.trim()) {
      setFormError("Please write your first message")
      return
    }
    if (!termsAccepted) {
      setFormError(ui.termsLabel)
      return
    }
    setIsLoading(true)
    setFormError(null)

    try {
      console.log("🔄 [REGISTER] Starting registration...", {
        workspaceId: resolvedWorkspaceId,
        phone: formPhone.trim(),
        language: formLanguage,
      })

      const result = await registerAndStartChat({
        apiUrl: resolvedApiUrl,
        workspaceId: resolvedWorkspaceId,
        visitorId,
        name: formName.trim(),
        phone: formPhone.trim(),
        language: formLanguage,
        firstMessage: formFirstMessage.trim(),
        pushNotificationsConsent: termsAccepted,
      })

      console.log("✅ [REGISTER] Registration API success", {
        customerId: result.customerId,
        sessionId: result.sessionId,
        isNewCustomer: result.isNewCustomer,
      })

      // ✅ CRITICAL: Save customerId ONLY after successful registration
      saveCustomerId(localStorage, resolvedWorkspaceId, result.customerId)
      saveWidgetSessionId(localStorage, resolvedWorkspaceId, result.sessionId)
      setCustomerId(result.customerId)
      setSessionId(result.sessionId)

      // Show user message + bot response in chat
      const initialMessages: Message[] = [
        {
          role: "user",
          content: formFirstMessage.trim(),
          timestamp: new Date().toISOString(),
        },
        {
          role: "bot",
          content: result.response,
          timestamp: new Date().toISOString(),
          suggestions: result.suggestions,
        },
      ]
      setMessages(initialMessages)
      saveWidgetMessages(localStorage, resolvedWorkspaceId, initialMessages)

      setShowRegistrationForm(false)
      console.log("✅ [REGISTER] Lifecycle complete - user registered", {
        customerId: result.customerId,
        isNewCustomer: result.isNewCustomer,
      })
    } catch (error) {
      console.error("❌ [REGISTER] Registration failed:", {
        error: error instanceof Error ? error.message : String(error),
        phone: formPhone.trim(),
        workspaceId: resolvedWorkspaceId,
      })

      // Show user-friendly error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Registration failed. Please try again."

      setFormError(errorMessage)

      // Don't save anything to localStorage on error - user will see form again
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickReply = async (reply: string) => {
    // sendMessage already clears all bot suggestions before adding the user message
    await sendMessage(reply)
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
  const defaultLogoUrl = (() => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Open chat">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22c55e"/>
            <stop offset="100%" stop-color="#16a34a"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#g)"/>
        <path d="M26 32h48c4.4 0 8 3.6 8 8v18c0 4.4-3.6 8-8 8H52l-9 8v-8H26c-4.4 0-8-3.6-8-8V40c0-4.4 3.6-8 8-8Z" fill="#ffffff"/>
        <rect x="34" y="43" width="32" height="3.5" rx="1.75" fill="#22c55e"/>
        <rect x="34" y="50" width="14" height="4" rx="2" fill="#22c55e"/>
        <rect x="50" y="50" width="16" height="4" rx="2" fill="#22c55e"/>
      </svg>
    `
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  })()
  const shouldUseLogo = Boolean(
    resolvedUseChannelLogo &&
      resolvedLogoUrl &&
      !resolvedLogoUrl.endsWith("/logo.png")
  )
  const displayLogoUrl = shouldUseLogo ? resolvedLogoUrl : null

  const renderIconGlyph = (value: string) => {
    switch (value) {
      case "chat":
        return <MessageCircle className="h-6 w-6 text-white" />
      case "bot":
        return <Bot className="h-6 w-6 text-white" />
      case "sparkles":
        return <Sparkles className="h-6 w-6 text-white" />
      case "support":
        return <LifeBuoy className="h-6 w-6 text-white" />
      case "brain":
        return <Brain className="h-6 w-6 text-white" />
      case "zap":
        return <Zap className="h-6 w-6 text-white" />
      case "send":
        return <Send className="h-6 w-6 text-white" />
      case "message-square":
        return <MessageSquare className="h-6 w-6 text-white" />
      case "messages":
        return <MessagesSquare className="h-6 w-6 text-white" />
      case "help":
        return <HelpCircle className="h-6 w-6 text-white" />
      case "phone":
        return <Phone className="h-8 w-8 text-white" />
      case "cpu":
        return <Cpu className="h-8 w-8 text-white" />
      case "mail":
        return <Mail className="h-8 w-8 text-white" />
      case "user":
        return <User className="h-8 w-8 text-white" />
      case "star":
        return <Star className="h-8 w-8 text-white" />
      case "heart":
        return <Heart className="h-8 w-8 text-white" />
      case "bell":
        return <Bell className="h-8 w-8 text-white" />
      case "shield":
        return <Shield className="h-8 w-8 text-white" />
      default:
        return <MessageCircle className="h-8 w-8 text-white" />
    }
  }
  const positionClasses = {
    "bottom-right": isEmbedded ? "bottom-2 right-2" : "bottom-6 right-6",
    "bottom-left": isEmbedded ? "bottom-2 left-2" : "bottom-6 left-6",
    "top-right": isEmbedded ? "top-2 right-2" : "top-6 right-6",
    "top-left": isEmbedded ? "top-2 left-2" : "top-6 left-6",
  }

  const embeddedPopupSizeClasses = isEmbedded
    ? "w-full h-full rounded-[24px] shadow-none border-2"
    : "w-[430px] h-[690px] rounded-3xl shadow-none border-2"
    
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
  
  const embeddedButtonSizeClasses = isEmbedded ? "w-[62px] h-[62px]" : "w-[66px] h-[66px]"
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
        <>
          <style>{`
            @keyframes echatbot-pulse {
              0% {
                box-shadow: 0 0 0 0 ${resolvedPrimaryColor}cc;
              }
              50% {
                box-shadow: 0 0 0 20px ${resolvedPrimaryColor}00;
              }
              100% {
                box-shadow: 0 0 0 0 ${resolvedPrimaryColor}00;
              }
            }
            .widget-button-pulse {
              animation: echatbot-pulse 2s infinite;
            }
          `}</style>
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
              "widget-button-pulse",
              positionClasses[position]
            )}
            aria-label="Open chat"
          >
          {displayLogoUrl ? (
            <img
              src={displayLogoUrl || defaultLogoUrl}
              alt="Chat"
              className="h-full w-full rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultLogoUrl
              }}
            />
          ) : (
            <div
              className="h-full w-full rounded-full flex items-center justify-center shadow-inner"
              style={{ backgroundColor: resolvedPrimaryColor || DEFAULT_PRIMARY_COLOR }}
            >
              {renderIconGlyph(resolvedIcon)}
            </div>
          )}
          </button>
        </>
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
            className="text-white px-6 py-4 flex items-center justify-between gap-3"
            style={{ backgroundColor: resolvedPrimaryColor }}
          >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full shadow-sm transition-colors flex-shrink-0",
                  workspaceConfig?.debugMode === true || workspaceConfig?.channelStatus === false
                    ? "bg-red-400"
                    : "bg-emerald-300"
                )}
              />
              <div className="flex flex-col leading-tight flex-1">
                <h2 className="font-semibold text-lg">
                  {resolvedTitle}
                  {workspaceConfig?.name ? ` · ${workspaceConfig.name}` : ""}
                </h2>
                {workspaceConfig?.whatsappPhoneNumber && (
                  <div className="flex items-center gap-1 text-xs text-white/80">
                    <span>WhatsApp:</span>
                    <a
                      className="underline-offset-2 hover:underline"
                      href={`https://wa.me/${workspaceConfig.whatsappPhoneNumber.replace(/\\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {workspaceConfig.whatsappPhoneNumber}
                    </a>
                  </div>
                )}
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

          {showRegistrationForm ? (
            /* ── Registration Form ── */
            <>
              <ScrollArea className="flex-1 bg-slate-50 px-5 py-5">
                {showTermsContent ? (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-800">{ui.termsTitle}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {ui.termsBody}
                    </p>
                    <button
                      onClick={() => setShowTermsContent(false)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all"
                      style={{ borderColor: borderColor, color: resolvedPrimaryColor }}
                    >
                      ← {ui.back}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 text-center">
                      {ui.intro}
                    </p>

                    {/* Name */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <User className="w-3.5 h-3.5" /> {ui.name}
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRegistrationSubmit()}
                        placeholder={ui.namePh}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 placeholder-slate-400"
                        style={{ "--tw-ring-color": resolvedPrimaryColor } as CSSProperties}
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Phone className="w-3.5 h-3.5" /> {ui.phone}
                      </label>
                      <input
                        type="tel"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder={ui.phonePh}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 placeholder-slate-400"
                      />
                    </div>

                    {/* First message */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <MessageCircle className="w-3.5 h-3.5" /> {ui.message}
                      </label>
                      <textarea
                        value={formFirstMessage}
                        onChange={(e) => setFormFirstMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleRegistrationSubmit()
                          }
                        }}
                        placeholder={ui.messagePh}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 placeholder-slate-400 resize-none"
                      />
                    </div>

                    {/* Terms & consent */}
                    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                      <input
                        id="terms-consent"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="text-xs text-slate-600 leading-snug">
                        <label htmlFor="terms-consent" className="cursor-pointer font-medium">
                          {ui.termsLabel}
                        </label>
                        <div>
                          <button
                            type="button"
                            className="text-emerald-600 hover:underline font-semibold"
                            onClick={() => setShowTermsContent(true)}
                          >
                            {ui.viewTerms}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {formError && (
                      <p className="text-xs text-red-500 text-center">{formError}</p>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Registration submit footer */}
              <div className="border-t border-gray-200 p-4 space-y-3">
                <button
                  onClick={handleRegistrationSubmit}
                  disabled={isLoading || !termsAccepted}
                  className="w-full py-3 rounded-2xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60"
                  style={{ backgroundColor: resolvedPrimaryColor }}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {ui.start} <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
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
            </>
          ) : (
            /* ── Normal Chat ── */
            <>
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
                {/* Show typing indicator when waiting for bot response */}
                {isLoading && (
                  <div className="flex items-start gap-2 mb-3">
                    <TypingIndicator primaryColor={resolvedPrimaryColor} />
                  </div>
                )}
              </ScrollArea>

              {/* AI Suggestions from last bot message (widget only) */}
              {(() => {
                // RULE: Never show suggestions when operator handoff is active
                if (botDisabled) return null

                // If there are conversation messages, only show LLM-provided suggestions (dynamic per response)
                // If no messages yet, fall back to static quick replies
                const lastBot = [...messages].reverse().find((m) => m.role === "bot" && m.suggestions?.length)
                const rawSuggestions = lastBot?.suggestions?.length
                  ? lastBot.suggestions
                  : messages.length === 0 && resolvedAutoSuggestionsEnabled
                    ? resolvedQuickReplies
                    : []

                // RULE: Never suggest a question the user already asked
                const askedMessages = new Set(
                  messages
                    .filter((m) => m.role === "user")
                    .map((m) => m.content.trim().toLowerCase())
                )
                const suggestions = rawSuggestions.filter(
                  (s: string) => !askedMessages.has(s.trim().toLowerCase())
                )

                if (!suggestions || suggestions.length === 0) return null

                return (
                  <div className="px-4 py-2 bg-white border-t border-slate-200">
                    <div className="flex flex-col gap-1.5">
                      {suggestions.slice(0, 4).map((qr: string, idx: number) => (
                        <button
                          key={`${qr}-${idx}`}
                        className="w-full text-left text-sm px-4 py-2 rounded-xl border font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                          style={{
                            borderColor: borderColor,
                            backgroundColor: "rgba(255,255,255,0.95)",
                            color: resolvedPrimaryColor,
                            boxShadow: `0 3px 10px -6px ${borderColor}`,
                          }}
                          onClick={() => handleQuickReply(qr)}
                          disabled={isLoading}
                          onMouseEnter={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement
                            btn.style.backgroundColor = `${resolvedPrimaryColor}14`
                            btn.style.boxShadow = `0 6px 14px -6px ${resolvedPrimaryColor}55`
                            btn.style.transform = "translateY(-1px)"
                          }}
                          onMouseLeave={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement
                            btn.style.backgroundColor = "rgba(255,255,255,0.95)"
                            btn.style.boxShadow = `0 3px 10px -6px ${borderColor}`
                            btn.style.transform = "translateY(0px)"
                          }}
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Operator handoff banner — shown when chatbot is disabled */}
              {botDisabled && (
                <div className="mx-4 mb-2 px-4 py-2 rounded-xl text-sm text-center font-medium"
                  style={{ backgroundColor: `${resolvedPrimaryColor}18`, color: resolvedPrimaryColor, border: `1px solid ${resolvedPrimaryColor}33` }}>
                  👤 Connecting you with our team — replies coming shortly
                </div>
              )}

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
                    placeholder={botDisabled ? "Waiting for operator reply..." : resolvedPlaceholder}
                    disabled={isLoading || botDisabled}
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
                    disabled={isLoading || !inputValue.trim() || botDisabled}
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
            </>
          )}
        </div>
      )}
    </>
  )
}

export default ChatWidget
