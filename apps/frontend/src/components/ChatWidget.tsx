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
  Globe,
  Mic,
  Square,
  Paperclip,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const shouldShowWhatsappNumber = (config?: {
  channelStatus?: boolean
  whatsappPhoneNumber?: string | null
} | null): boolean => {
  return !!config?.whatsappPhoneNumber && config?.channelStatus === true
}

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
import { EmojiPicker } from "@/components/EmojiPicker"
import { ChatSurface } from "@/components/chat/ChatSurface"
import { WelcomeVideoCard } from "@/components/chat/WelcomeVideoCard"
import { MessageRenderer } from "@/components/shared/MessageRenderer"
import { MessageAttachments } from "@/components/chat/MessageAttachments"
import {
  ACCEPTED_ACCEPT_ATTR,
  kindOf,
  validateSelection,
  type ChatAttachment,
} from "@/components/chat/attachment-utils"
import { WidgetProfilePanel } from "@/components/chat/WidgetProfilePanel"
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
  sendWidgetAudio,
  registerAndStartChat,
  getWidgetStatus,
  getWidgetProfile,
  updateWidgetProfile,
  clearWidgetSession,
  type WidgetStoredMessage,
} from "@/components/chat/adapters/widgetAdapter"

// Supported language codes (browser language detection)
const SUPPORTED_LANG_CODES = ["it", "en", "es", "pt", "fr", "de"]

interface Message {
  role: "user" | "bot"
  content: string
  timestamp?: string
  suggestions?: string[]
  audioUrl?: string // 🎤 voice note (user's local recording or bot TTS reply)
  welcomeVideoUrl?: string // 📺 presentation video on the first bot reply (parity with WhatsApp)
  welcomeRest?: string // 📺 reply text rendered AFTER the welcome video (greeting → video → rest)
  attachments?: ChatAttachment[] // 📎 operator-sent images / PDFs / audio (handoff)
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
  welcomeVideoUrl?: string
  // When true the popup is rendered already open on first mount (instead of the
  // floating bubble). Used by the standalone /demo/<slug> try-it page so the
  // visitor lands directly on the registration form. Defaults to false so the
  // normal embedded-bubble behaviour is unchanged.
  defaultOpen?: boolean
  // 🎮 Demo mode: skip the registration form and open straight into the chat
  // (WhatsApp-style). The first message creates an anonymous visitor server-side.
  instantChat?: boolean
  // Hide the " · <workspace name>" suffix in the header (avoids "Brand · Brand").
  hideWorkspaceName?: boolean
  // Render the WhatsApp number as plain text instead of a clickable wa.me link.
  plainWhatsappNumber?: boolean
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

// Convert a welcome-video URL (YouTube / Vimeo / direct file) into a renderable
// form. Returns null for unrecognized URLs — no guessing, no broken embeds.
function resolveWelcomeVideo(
  url: string
): { kind: "iframe" | "file"; src: string } | null {
  const u = (url || "").trim()
  if (!u) return null
  const yt = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/
  )
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` }
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: "file", src: u }
  return null
}

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
    termsError: string
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
    termsLabel: "Termini e Condizioni",
    termsError: "Accetta i Termini e Condizioni per continuare",
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
    termsLabel: "Terms & Conditions",
    termsError: "Please accept Terms & Conditions to continue",
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
    termsLabel: "Términos y Condiciones",
    termsError: "Acepta los Términos y Condiciones para continuar",
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
    termsLabel: "Termos e Condições",
    termsError: "Aceite os Termos e Condições para continuar",
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
    termsLabel: "Conditions Générales",
    termsError: "Veuillez accepter les Conditions Générales pour continuer",
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
    termsLabel: "AGB",
    termsError: "Bitte akzeptiere die AGB um fortzufahren",
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
  welcomeVideoUrl,
  defaultOpen = false,
  instantChat = false,
  hideWorkspaceName = false,
  plainWhatsappNumber = false,
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
  
  // Resolve language: header selection (user) > prop > window config > "en"
  // RULE: headerLanguage is the user's explicit in-widget selection → ALWAYS wins over workspace config
  const resolvedLanguage = headerLanguage || language || widgetConfig?.language || "en"
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
  const resolvedWelcomeVideoUrl =
    (widgetConfig as any)?.welcomeVideoUrl || welcomeVideoUrl || ""
  const welcomeVideo = resolveWelcomeVideo(resolvedWelcomeVideoUrl)
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
  
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [messages, setMessages] = useState<Message[]>([])

  // 📺 Welcome presentation video — rendered on the FIRST bot message, exactly
  // like the operator chat / playground (greeting → video card → rest). Computed at
  // render time (not stored per-message) so it also shows for messages restored
  // from localStorage. No-op when the workspace has no welcome video configured.
  const displayMessages = useMemo<Message[]>(() => {
    if (!resolvedWelcomeVideoUrl) return messages
    const firstBotIdx = messages.findIndex((m) => m.role === "bot")
    if (firstBotIdx === -1) return messages
    return messages.map((m, i) => {
      // Voice replies show only the audio player — never attach the video there.
      if (i !== firstBotIdx || m.audioUrl) return m
      const breakIdx = m.content.indexOf("\n\n")
      return {
        ...m,
        content: breakIdx !== -1 ? m.content.slice(0, breakIdx) : m.content,
        welcomeRest: breakIdx !== -1 ? m.content.slice(breakIdx + 2) : "",
        welcomeVideoUrl: resolvedWelcomeVideoUrl,
      }
    })
  }, [messages, resolvedWelcomeVideoUrl])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // 🎤 Voice recording (demo composer)
  const [recording, setRecording] = useState(false)
  const audioMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  // 📎 File attachments (demo composer): paperclip → pick image/PDF → render in
  // the user's own bubble. Object URLs are created locally so the media shows
  // instantly (parity with WhatsApp); revoked on unmount to avoid leaks.
  const attachInputRef = useRef<HTMLInputElement | null>(null)
  const attachObjectUrls = useRef<string[]>([])
  const [visitorId, setVisitorId] = useState<string>("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  // Operator handoff: when chatbot is disabled, poll for operator replies
  const [botDisabled, setBotDisabled] = useState(false)
  // operatorHasReplied: true when operator sent at least one message — unlocks input so customer can reply
  const [operatorHasReplied, setOperatorHasReplied] = useState(false)
  const lastOperatorMsgAt = useRef<string>(new Date().toISOString())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Registration form state
  // showRegistrationForm=true by default; set to false if customerId found in localStorage.
  // 🎮 instantChat (demo) opens straight into the chat — no registration form.
  const [showRegistrationForm, setShowRegistrationForm] = useState(!instantChat)
  const [welcomeVideoDismissed, setWelcomeVideoDismissed] = useState(false)
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

  // 👤 Profile Panel State
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // 🐛 Debug Panel State
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false)
  const [debugPhoneNumber, setDebugPhoneNumber] = useState("")
  const [debugLanguage, setDebugLanguage] = useState<LangCode>("en")
  const [debugMessages, setDebugMessages] = useState<Message[]>([])
  const [debugInputValue, setDebugInputValue] = useState("")
  const [debugIsLoading, setDebugIsLoading] = useState(false)
  const debugMessagesEndRef = useRef<HTMLDivElement>(null)

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

    // Restore operator handoff state in case of page reload / widget reopen.
    // RULE: botDisabled is NOT persisted — we re-check from BE on every init.
    const restoreOperatorState = async (currentVisitorId: string) => {
      try {
        const resp = await fetch(
          `${resolvedApiUrl}/widget/operator-messages?visitorId=${encodeURIComponent(currentVisitorId)}&workspaceId=${encodeURIComponent(resolvedWorkspaceId)}&since=${encodeURIComponent("1970-01-01T00:00:00.000Z")}`
        )
        if (!resp.ok) return
        const data = await resp.json()
        if (data.activeChatbot === false) {
          setBotDisabled(true)
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setOperatorHasReplied(true)
          }
          console.log("🔒 [WIDGET] Restored operator handoff state on init", {
            operatorHasReplied: Array.isArray(data.messages) && data.messages.length > 0,
          })
        }
      } catch {
        // Best-effort — ignore network errors during init
      }
    }
    restoreOperatorState(id)

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

  // ── Operator takeover detection ──────────────────────────────────────────
  // When the widget is open and a conversation exists, poll every 8s to detect
  // if the operator took over the chat (set activeChatbot=false from admin).
  // Without this, the widget only discovers the takeover when the customer
  // sends a new message — causing operator messages to be invisible until refresh.
  useEffect(() => {
    // Only run when: widget open, NOT already in operator mode, has session + visitor
    if (botDisabled || !isOpen || !visitorId || !resolvedWorkspaceId || !sessionId) return

    const checkOperatorTakeover = async () => {
      try {
        const resp = await fetch(
          `${resolvedApiUrl}/widget/operator-messages?visitorId=${encodeURIComponent(visitorId)}&workspaceId=${encodeURIComponent(resolvedWorkspaceId)}&since=${encodeURIComponent("1970-01-01T00:00:00.000Z")}`
        )
        if (!resp.ok) return
        const data = await resp.json()

        // Operator took over — switch to operator mode and show any pending messages
        if (data.activeChatbot === false) {
          setBotDisabled(true)
          lastOperatorMsgAt.current = new Date().toISOString()
          console.log("🔒 [WIDGET] Detected operator takeover via status poll")

          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setOperatorHasReplied(true)
            const newMsgs = (
              data.messages as { id: string; content: string; createdAt: string }[]
            ).map((m) => ({
              role: "bot" as const,
              content: m.content,
              timestamp: m.createdAt,
            }))
            setMessages((prev) => {
              // Deduplicate: skip messages already shown (by content + timestamp)
              const existingKeys = new Set(prev.map(m => `${m.content}|${m.timestamp}`))
              const uniqueNew = newMsgs.filter((m: { content: string; timestamp: string }) =>
                !existingKeys.has(`${m.content}|${m.timestamp}`)
              )
              if (uniqueNew.length === 0) return prev
              const updated = [...prev, ...uniqueNew]
              if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, updated)
              return updated
            })
            const latest = data.messages[data.messages.length - 1].createdAt
            lastOperatorMsgAt.current = latest
          }
        }
      } catch {
        // Silently ignore — best-effort status check
      }
    }

    const interval = setInterval(checkOperatorTakeover, 8000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botDisabled, isOpen, visitorId, resolvedWorkspaceId, sessionId, resolvedApiUrl])

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
          setOperatorHasReplied(false)
          return
        }

        // Append new operator messages — also unlock input so customer can reply
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setOperatorHasReplied(true)
          const newMsgs = (
            data.messages as {
              id: string
              content: string
              createdAt: string
              attachments?: ChatAttachment[]
            }[]
          ).map((m) => ({
            role: "bot" as const,
            content: m.content,
            timestamp: m.createdAt,
            attachments: m.attachments,
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
    // RULE: Block when bot is disabled AND operator hasn't replied yet (customer is waiting).
    // When operator has replied (operatorHasReplied=true), allow sending — message goes to BE
    // which saves it without calling LLM, so the operator can read the customer's reply.
    if (!message || isLoading || !visitorId || (botDisabled && !operatorHasReplied)) return

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

      // RULE: activeChatbot=false means the operator has taken over.
      // Backend blocked the LLM — do NOT show any bot reply.
      // Just enable waiting mode immediately and discard the empty response.
      if (data.activeChatbot === false) {
        setBotDisabled(true)
        lastOperatorMsgAt.current = new Date().toISOString()
        // Keep only the user message (no bot reply to add)
        setMessages(updatedMessages)
        if (resolvedWorkspaceId) {
          saveWidgetMessages(localStorage, resolvedWorkspaceId, updatedMessages)
        }
        return
      }

      // Add bot message. The welcome presentation video is rendered at display
      // time on the FIRST bot message (see `displayMessages`), so it works even
      // for messages restored from localStorage — no per-message flag needed.
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

      // Check if chatbot was JUST disabled by contactOperator CF in this very response.
      // Backend sets activeChatbot:false + suggestions:[] when handoff is triggered.
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
   * 🎤 Voice message: record via MediaRecorder → upload → transcribe (backend)
   * → bot reply. Shows a "voice message" bubble for the user's note.
   */
  const sendAudio = async (blob: Blob) => {
    if (!visitorId || !resolvedWorkspaceId || isLoading) return
    // Local playable URL for the user's own recording (no upload needed for the player).
    const localAudioUrl = URL.createObjectURL(blob)
    const userMessage: Message = {
      role: "user",
      content: "🎤 Voice message",
      timestamp: new Date().toISOString(),
      audioUrl: localAudioUrl,
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, updatedMessages)
    setIsLoading(true)
    try {
      const data = await sendWidgetAudio({
        apiUrl: resolvedApiUrl,
        workspaceId: resolvedWorkspaceId,
        visitorId,
        audioBlob: blob,
        language: resolvedLanguage,
        sessionId,
        customerId: customerId || undefined,
      })
      if (data.sessionId && resolvedWorkspaceId) {
        setSessionId(data.sessionId)
        saveWidgetSessionId(localStorage, resolvedWorkspaceId, data.sessionId)
      }
      const botMessage: Message = {
        role: "bot",
        // 🎤 Voice in → voice out: when the bot answers with audio, show ONLY
        // the voice note (no text bubble). If TTS failed (no audioUrl), keep
        // the text so the customer still gets the answer as a fallback.
        content: data.audioUrl ? "" : data.response,
        timestamp: new Date().toISOString(),
        suggestions: data.suggestions,
        audioUrl: data.audioUrl, // 🎤 bot voice reply (ElevenLabs)
      }
      const finalMessages = [...updatedMessages, botMessage]
      setMessages(finalMessages)
      if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, finalMessages)
    } catch (error) {
      console.error("Failed to send audio:", error)
      const errorMessage: Message = {
        role: "bot",
        content: "Sorry, I couldn't process your voice message. Please try again.",
        timestamp: new Date().toISOString(),
      }
      setMessages([...updatedMessages, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const startRecording = async () => {
    if (recording || isLoading) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, {
          type: mr.mimeType || "audio/webm",
        })
        if (blob.size > 0) await sendAudio(blob)
      }
      audioMediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
    } catch (err) {
      console.error("🎤 Microphone access failed:", err)
      setRecording(false)
    }
  }

  const stopRecording = () => {
    try {
      audioMediaRecorderRef.current?.stop()
    } catch {
      /* ignore */
    }
    setRecording(false)
  }

  /**
   * 📎 Attach images / PDFs from the demo composer (paperclip). Validates the
   * selection with the same caps as the backend, renders each file inside the
   * user's own bubble via a local object URL — WhatsApp parity, no upload needed
   * for the demo. Multiple files land in a single message bubble.
   */
  const handleAttachFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const { accepted, errors } = validateSelection(Array.from(fileList), 0)
    if (errors.length > 0) {
      setFormError(errors[0])
    }
    if (accepted.length === 0) return

    const attachments: ChatAttachment[] = accepted.map((file, i) => {
      const url = URL.createObjectURL(file)
      attachObjectUrls.current.push(url)
      return {
        id: `local-${Date.now()}-${i}`,
        url,
        kind: kindOf(file.type) || "DOCUMENT",
        mimeType: file.type,
        filename: file.name,
        sizeBytes: file.size,
      }
    })

    const userMessage: Message = {
      role: "user",
      content: "",
      timestamp: new Date().toISOString(),
      attachments,
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, updatedMessages)
  }

  // 🧹 Revoke any object URLs created for attachment previews on unmount.
  useEffect(() => {
    return () => {
      attachObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

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
      setFormError(ui.termsError)
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

  /**
   * Load customer profile for inline profile panel
   */
  const handleOpenProfile = async () => {
    if (!customerId || !resolvedWorkspaceId) return
    setShowProfilePanel(true)
    setProfileLoading(true)
    setProfileError(null)
    try {
      const data = await getWidgetProfile({
        apiUrl: resolvedApiUrl,
        workspaceId: resolvedWorkspaceId,
        customerId,
      })
      setProfileData(data)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to load profile")
    } finally {
      setProfileLoading(false)
    }
  }

  /**
   * Save customer profile from inline profile panel
   */
  const handleSaveProfile = async (data: Record<string, unknown>) => {
    if (!customerId || !resolvedWorkspaceId) return
    setProfileSaving(true)
    setProfileError(null)
    try {
      const updated = await updateWidgetProfile({
        apiUrl: resolvedApiUrl,
        workspaceId: resolvedWorkspaceId,
        customerId,
        data,
      })
      setProfileData(updated)
      setShowProfilePanel(false)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setProfileSaving(false)
    }
  }

  /**
   * Logout: clear localStorage session data and reset widget to registration form
   */
  const handleWidgetLogout = () => {
    if (resolvedWorkspaceId) {
      clearWidgetSession(localStorage, resolvedWorkspaceId)
    }
    setCustomerId(null)
    setSessionId(null)
    setMessages([])
    setShowProfilePanel(false)
    setShowRegistrationForm(true)
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
      (useChannelLogo === true || !resolvedLogoUrl.endsWith("/logo.png"))
  )
  const displayLogoUrl = shouldUseLogo ? resolvedLogoUrl : null

  const renderIconGlyph = (value: string) => {
    switch (value) {
      case "whatsapp":
        return (
          <svg viewBox="0 0 32 32" className="h-10 w-10 fill-white" aria-hidden="true">
            <path d="M16.003 3C9.38 3 4 8.38 4 15.003c0 2.117.553 4.187 1.605 6.01L4 29l8.184-1.55a11.94 11.94 0 0 0 3.819.626h.003C22.626 28.075 28 22.695 28 16.072 28 9.45 22.626 3 16.003 3Zm0 21.86h-.002a9.9 9.9 0 0 1-3.46-.62l-.248-.094-4.857.92.94-4.735-.16-.244a9.85 9.85 0 0 1-1.5-5.224c0-5.46 4.44-9.9 9.91-9.9 2.646 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.44 9.9-9.91 9.9Zm5.43-7.42c-.297-.15-1.758-.867-2.03-.967-.272-.099-.47-.148-.668.149-.198.297-.767.967-.94 1.166-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.76-1.653-2.057-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.496.099-.198.05-.372-.025-.521-.074-.149-.668-1.611-.916-2.206-.241-.58-.486-.501-.668-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.073.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347Z" />
          </svg>
        )
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
    "bottom-right": isEmbedded ? "bottom-2 right-2" : "bottom-4 right-4 sm:bottom-8 sm:right-8",
    "bottom-left": isEmbedded ? "bottom-2 left-2" : "bottom-4 left-4 sm:bottom-8 sm:left-8",
    "top-right": isEmbedded ? "top-2 right-2" : "top-4 right-4 sm:top-8 sm:right-8",
    "top-left": isEmbedded ? "top-2 left-2" : "top-4 left-4 sm:top-8 sm:left-8",
  }

  // Open panel: full-screen on mobile (inset-0, no corner offset that would
  // overflow with w-screen/h-screen), docked to the corner from sm+.
  const openPanelPositionClasses = {
    "bottom-right": isEmbedded ? "bottom-2 right-2" : "inset-0 sm:inset-auto sm:bottom-8 sm:right-8",
    "bottom-left": isEmbedded ? "bottom-2 left-2" : "inset-0 sm:inset-auto sm:bottom-8 sm:left-8",
    "top-right": isEmbedded ? "top-2 right-2" : "inset-0 sm:inset-auto sm:top-8 sm:right-8",
    "top-left": isEmbedded ? "top-2 left-2" : "inset-0 sm:inset-auto sm:top-8 sm:left-8",
  }

  const embeddedPopupSizeClasses = isEmbedded
    ? "w-full h-full rounded-[24px] shadow-none border-2"
    : instantChat
    ? "w-screen h-screen sm:w-[480px] sm:h-[760px] sm:max-h-[92vh] rounded-none sm:rounded-3xl shadow-2xl border-2 sm:border-2"
    : "w-screen h-screen sm:w-[410px] sm:h-[680px] max-h-[800px] rounded-none sm:rounded-3xl shadow-2xl border-2 sm:border-2"
    
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

  // 📱 WhatsApp skin — applied ONLY in demo mode (instantChat) so branded embeds
  // on customer sites keep their own primaryColor. Mirrors the home-page phone
  // (HomeShowcase): dark-green header, cream chat canvas, light-green outgoing
  // bubbles with a tail. Colours are the exact WhatsApp palette.
  const waSkin = instantChat
  const WA_HEADER = "#075E54" // WhatsApp dark green (header)
  const WA_OUT_BUBBLE = "#DCF8C6" // outgoing bubble (light green)
  const headerColor = waSkin ? WA_HEADER : resolvedPrimaryColor

  const embeddedButtonSizeClasses = isEmbedded
    ? "w-[56px] h-[56px]"
    : "w-[60px] h-[60px] sm:w-[68px] sm:h-[68px]"
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

  // 🚫 Global Guard: If channel is inactive, hide the entire widget
  // (Unless in debug mode or we are the owner viewing it)
  if (workspaceConfig && workspaceConfig.channelStatus === false && workspaceConfig.debugMode !== true) {
    console.debug("🚫 ChatWidget hidden: channel is inactive")
    return null
  }

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
            openPanelPositionClasses[position]
          )}
          style={{ borderColor }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="text-white px-4 sm:px-5 py-3 flex items-center justify-between gap-2 sm:gap-3"
            style={{ backgroundColor: headerColor }}
          >
              {waSkin ? (
                // 📱 WhatsApp-style avatar with online dot (parity with home phone).
                <div className="relative flex-shrink-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg shadow-inner"
                    style={{ backgroundColor: resolvedPrimaryColor }}
                  >
                    {displayLogoUrl ? (
                      <img src={displayLogoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      renderIconGlyph(resolvedIcon)
                    )}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#075E54]",
                      workspaceConfig?.debugMode === true || workspaceConfig?.channelStatus === false
                        ? "bg-red-400"
                        : "bg-emerald-400"
                    )}
                  />
                </div>
              ) : (
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full shadow-sm transition-colors flex-shrink-0",
                    workspaceConfig?.debugMode === true || workspaceConfig?.channelStatus === false
                      ? "bg-red-400"
                      : "bg-emerald-300"
                  )}
                />
              )}
              <div className="flex flex-col leading-tight flex-1">
                <h2 className="font-semibold text-lg">
                  {resolvedTitle}
                  {!hideWorkspaceName &&
                  workspaceConfig?.name &&
                  workspaceConfig.name !== resolvedTitle
                    ? ` · ${workspaceConfig.name}`
                    : ""}
                </h2>
                {waSkin && !shouldShowWhatsappNumber(workspaceConfig) && (
                  <p className="text-[11px] text-white/70">online</p>
                )}
                {shouldShowWhatsappNumber(workspaceConfig) && (
                  <div className="flex items-center gap-1 text-sm font-semibold text-white">
                    <span>WhatsApp:</span>
                    {plainWhatsappNumber ? (
                      <span>{workspaceConfig?.whatsappPhoneNumber}</span>
                    ) : (
                      <a
                        className="underline-offset-2 hover:underline"
                        href={`https://wa.me/${workspaceConfig.whatsappPhoneNumber?.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {workspaceConfig?.whatsappPhoneNumber}
                      </a>
                    )}
                  </div>
                )}
              </div>
            <div className="flex items-center gap-2">
              {/* Profile button - only visible for registered users (not during registration form).
                  🎮 Hidden in demo (instantChat): no profile for anonymous demo visitors. */}
              {customerId && !showRegistrationForm && !instantChat && (
                <button
                  onClick={handleOpenProfile}
                  className="hover:brightness-95 p-2 rounded-lg transition-colors"
                  style={{ backgroundColor: showProfilePanel ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)" }}
                  title="My Profile"
                  aria-label="My Profile"
                >
                  <User className="w-5 h-5" />
                </button>
              )}
              {!instantChat && workspaceConfig?.debugMode === true && (
                <button
                  onClick={() => setIsDebugPanelOpen(true)}
                  className="hover:brightness-95 p-2 rounded-lg transition-colors"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                  title="Debug Mode - Test AI engine"
                  aria-label="Debug mode"
                >
                  <span className="text-xl">🐛</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowProfilePanel(false)
                  onOpenChange?.(false)
                }}
                className="hover:brightness-95 p-2 rounded-lg transition-colors"
                style={{ backgroundColor: "transparent" }}
                aria-label="Close chat"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {showRegistrationForm ? (
            /* ── Registration Form ── */
            <>
              <ScrollArea className="flex-1 bg-slate-50 px-5 py-5">
                {!showTermsContent && welcomeVideo && !welcomeVideoDismissed && (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm relative">
                    <button
                      type="button"
                      onClick={() => setWelcomeVideoDismissed(true)}
                      aria-label="Close video"
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/55 hover:bg-black/75 text-white text-sm flex items-center justify-center transition-colors"
                    >
                      ×
                    </button>
                    <div className="aspect-video bg-black">
                      {welcomeVideo.kind === "file" ? (
                        <video
                          src={welcomeVideo.src}
                          controls
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <iframe
                          src={welcomeVideo.src}
                          title="Welcome video"
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    </div>
                  </div>
                )}
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

                    {/* Language */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Globe className="w-3.5 h-3.5" /> Language
                      </label>
                      <select
                        value={formLanguage}
                        onChange={(e) => setFormLanguage(e.target.value as LangCode)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1"
                        style={{ "--tw-ring-color": resolvedPrimaryColor } as CSSProperties}
                      >
                        <option value="en">🇬🇧 English</option>
                        <option value="it">🇮🇹 Italiano</option>
                        <option value="es">🇪🇸 Español</option>
                        <option value="pt">🇧🇷 Português</option>
                        <option value="fr">🇫🇷 Français</option>
                        <option value="de">🇩🇪 Deutsch</option>
                      </select>
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
                        <button
                          type="button"
                          className="cursor-pointer font-semibold text-emerald-600 hover:underline"
                          onClick={() => setShowTermsContent(true)}
                        >
                          {ui.termsLabel}
                        </button>
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
              <div className="border-t border-gray-200 p-3 sm:p-4 space-y-2 sm:space-y-3">
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
          ) : showProfilePanel ? (
            /* ── Inline Profile Panel ── */
            <WidgetProfilePanel
              profileData={profileData}
              loading={profileLoading}
              saving={profileSaving}
              error={profileError}
              primaryColor={resolvedPrimaryColor}
              onSave={handleSaveProfile}
              onBack={() => setShowProfilePanel(false)}
              onLogout={handleWidgetLogout}
            />
          ) : (
            /* ── Normal Chat ── */
            <>
              {/* Messages Container */}
              <ScrollArea
                className={cn(
                  "flex-1 px-5 py-4 widget-scroll-area overscroll-contain",
                  waSkin ? "bg-[#ECE5DD]" : "bg-slate-50"
                )}
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
                  messages={displayMessages}
                  endRef={messagesEndRef}
                  emptyState={
                    instantChat ? null : (
                      <div className="text-gray-400 text-sm text-center py-12">
                        <p>Start a conversation! 👋</p>
                      </div>
                    )
                  }
                  getAlignment={(msg) => (msg.role === "user" ? "right" : "left")}
                  getBubbleClassName={(msg) =>
                    cn(
                      "rounded-2xl px-3 sm:px-4 py-2 sm:py-3 max-w-[88%] sm:max-w-[360px] mb-3 shadow-sm",
                      "word-wrap break-words overflow-wrap-anywhere relative text-sm sm:text-[15px] leading-relaxed",
                      msg.role === "user"
                        ? waSkin
                          ? "text-slate-900 rounded-tr-sm" // 📱 WhatsApp outgoing bubble (dark text, top-right tail)
                          : "text-white rounded-br-md"
                        : waSkin
                          ? "bg-white text-slate-900 rounded-tl-sm" // 📱 WhatsApp incoming bubble (top-left tail)
                          : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                    )
                  }
                  getBubbleStyle={(msg) =>
                    msg.role === "user"
                      ? { backgroundColor: waSkin ? WA_OUT_BUBBLE : resolvedPrimaryColor }
                      : undefined
                  }
                  getContainerClassName={(msg) =>
                    msg.role === "user" ? "widget-user-message" : undefined
                  }
                  renderFooter={(msg) => (
                    <>
                      {/* 📺 Welcome video on the first reply: greeting (in the
                          bubble content) → video card → rest of the reply. */}
                      {msg.welcomeVideoUrl && (
                        <>
                          <WelcomeVideoCard
                            url={msg.welcomeVideoUrl}
                            lang={resolvedLanguage}
                            greeting={msg.content}
                          />
                          {msg.welcomeRest && (
                            <MessageRenderer content={msg.welcomeRest} variant="chat" />
                          )}
                        </>
                      )}
                      {msg.audioUrl && (
                        <audio
                          controls
                          src={msg.audioUrl}
                          className="mt-2 h-9 w-full min-w-[200px] max-w-[240px]"
                        />
                      )}
                      {/* 📎 Media: operator-sent (left) or customer-attached via
                          the paperclip (right). Aligns to the bubble's own side. */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <MessageAttachments
                          attachments={msg.attachments}
                          align={msg.role === "user" ? "right" : "left"}
                        />
                      )}
                    </>
                  )}
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
                  {operatorHasReplied
                    ? "🧑‍💼 Operator active — you can reply directly"
                    : "👤 Connecting you with our team — replies coming shortly"}
                </div>
              )}

              {/* Footer with Input */}
              <div className="border-t border-gray-200 p-3 sm:p-5 space-y-2 sm:space-y-3">
                <div className="flex items-end gap-2 sm:gap-3">
                  {/* 🎮 Emoji picker — demo composer */}
                  {instantChat && !(botDisabled && !operatorHasReplied) && (
                    <EmojiPicker
                      onSelect={(emoji) => setInputValue((prev) => prev + emoji)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                    />
                  )}
                  {/* 📎 Attach images / PDFs — demo composer (WhatsApp paperclip) */}
                  {instantChat && !(botDisabled && !operatorHasReplied) && (
                    <>
                      <input
                        ref={attachInputRef}
                        type="file"
                        accept={ACCEPTED_ACCEPT_ATTR}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleAttachFiles(e.target.files)
                          e.target.value = "" // allow re-selecting the same file
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => attachInputRef.current?.click()}
                        disabled={isLoading}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                        aria-label="Attach image or file"
                        title="Attach image or PDF"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder={
                      botDisabled && !operatorHasReplied
                        ? "Waiting for operator reply..."
                        : botDisabled && operatorHasReplied
                        ? "Reply to operator..."
                        : resolvedPlaceholder
                    }
                    disabled={isLoading || (botDisabled && !operatorHasReplied)}
                    rows={instantChat ? 3 : 2}
                    className={cn(
                      "flex-1 resize-none px-3 sm:px-4 py-2 sm:py-3 rounded-2xl border border-gray-300",
                      instantChat && "text-base leading-relaxed",
                      "focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600",
                      "text-sm sm:text-[15px] placeholder-gray-400 leading-relaxed",
                      "disabled:bg-gray-50 disabled:text-gray-400"
                    )}
                  />
                  {/* 🎤 Voice message button (demo) */}
                  {instantChat && !(botDisabled && !operatorHasReplied) && (
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      disabled={isLoading}
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                        "text-white transition-colors disabled:opacity-50",
                        recording ? "bg-red-500 animate-pulse" : "hover:brightness-95"
                      )}
                      style={recording ? undefined : { backgroundColor: resolvedPrimaryColor }}
                      aria-label={recording ? "Stop recording" : "Record voice message"}
                      title={recording ? "Stop" : "Voice message"}
                    >
                      {recording ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
                    </button>
                  )}
                  <button
                    // 🎤 WhatsApp-style: while recording, the send button stops
                    // the recorder and sends the voice note (onstop → sendAudio).
                    // Otherwise it sends the typed text.
                    onClick={recording ? stopRecording : handleSendMessage}
                    disabled={
                      isLoading ||
                      (!recording && !inputValue.trim()) ||
                      (botDisabled && !operatorHasReplied)
                    }
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      "disabled:bg-gray-300 hover:brightness-95",
                      "text-white transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-green-600"
                    )}
                    style={{ backgroundColor: resolvedPrimaryColor }}
                    aria-label={recording ? "Send voice message" : "Send message"}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {!instantChat && (
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
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 🐛 DEBUG PANEL MODAL - Testare l'engine senza storia/costi */}
      {isDebugPanelOpen && (
        <div
          className={cn(
            isEmbedded ? "absolute" : "fixed",
            "z-[2147483648] flex flex-col",
            "bg-white",
            "overflow-hidden overscroll-contain isolate",
            embeddedPopupSizeClasses,
            "animate-in slide-in-from-bottom-4 fade-in duration-300",
            openPanelPositionClasses[position]
          )}
          style={{ borderColor }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-3"
            style={{ backgroundColor: resolvedPrimaryColor }}
          >
            <div className="flex flex-col leading-tight flex-1">
              <h2 className="font-semibold text-lg">🐛 Debug Mode</h2>
              <p className="text-xs text-white/80">Test the AI engine - No history/credits</p>
            </div>
            <button
              onClick={() => setIsDebugPanelOpen(false)}
              className="hover:brightness-95 p-2 rounded-lg transition-colors"
              style={{ backgroundColor: "transparent" }}
              aria-label="Close debug"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Debug Form - Configuration */}
          <div className="border-b border-gray-200 p-4 bg-slate-50">
            <div className="space-y-3">
              {/* Phone Number */}
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <Phone className="w-3.5 h-3.5" /> Phone Number
                </label>
                <input
                  type="tel"
                  value={debugPhoneNumber}
                  onChange={(e) => setDebugPhoneNumber(e.target.value)}
                  placeholder="+39 312 345 6789"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1"
                />
              </div>

              {/* Language */}
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <MessageCircle className="w-3.5 h-3.5" /> Language
                </label>
                <select
                  value={debugLanguage}
                  onChange={(e) => setDebugLanguage(e.target.value as LangCode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1"
                >
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="pt">🇵🇹 Português</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="de">🇩🇪 Deutsch</option>
                </select>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="flex-1 bg-slate-50 px-4 py-4">
            <div className="space-y-3">
              {debugMessages.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">
                  Start a test conversation here<br/>
                  <span className="text-xs">No credits deducted • Not saved in history</span>
                </p>
              )}
              {debugMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 max-w-[80%] text-sm",
                      msg.role === "user"
                        ? "bg-blue-500 text-white rounded-br-none"
                        : "bg-white border border-slate-200 text-slate-900 rounded-bl-none"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {debugIsLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg rounded-bl-none">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: "0s"}}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={debugMessagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Footer */}
          <div className="border-t border-gray-200 p-3 sm:p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={debugInputValue}
                onChange={(e) => setDebugInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !debugIsLoading && debugInputValue.trim()) {
                    handleDebugSendMessage()
                  }
                }}
                placeholder="Test message..."
                disabled={debugIsLoading}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 disabled:bg-slate-100"
              />
              <button
                onClick={handleDebugSendMessage}
                disabled={debugIsLoading || !debugInputValue.trim()}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: resolvedPrimaryColor }}
              >
                {debugIsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // 🐛 Debug Handler Function
  function handleDebugSendMessage() {
    if (!debugInputValue.trim() || debugIsLoading) return

    const userMsg: Message = {
      role: "user",
      content: debugInputValue,
      timestamp: new Date().toISOString(),
    }

    setDebugMessages((prev) => [...prev, userMsg])
    setDebugInputValue("")
    setDebugIsLoading(true)

    const startTime = Date.now()

    // Send to API with isPlayground=true
    fetch(`${resolvedApiUrl}/widget/chat/${resolvedWorkspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: `debug-${debugPhoneNumber || "test"}`,
        message: debugInputValue,
        phoneNumber: debugPhoneNumber || "+39 999 9999999",
        language: debugLanguage,
        isPlayground: true, // 🧪 No credits deducted!
      }),
    })
      .then(async (resp) => {
        // Ensure minimum 500ms loading time
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, 500 - elapsedTime)
        if (remainingTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingTime))
        }

        const data = await resp.json()
        if (!resp.ok || !data?.response) {
          throw new Error(data?.message || "Failed to get response")
        }

        const botMsg: Message = {
          role: "bot",
          content: data.response,
          timestamp: new Date().toISOString(),
        }

        setDebugMessages((prev) => [...prev, botMsg])
      })
      .catch((error) => {
        const errorMsg: Message = {
          role: "bot",
          content: `❌ Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
          timestamp: new Date().toISOString(),
        }
        setDebugMessages((prev) => [...prev, errorMsg])
      })
      .finally(() => {
        setDebugIsLoading(false)
      })
  }
}

export default ChatWidget
