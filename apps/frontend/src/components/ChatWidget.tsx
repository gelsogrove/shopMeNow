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
  Paperclip,
  Check,
  CheckCheck,
  Mic,
  SmilePlus,
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
function TypingIndicator({ primaryColor, waSkin }: { primaryColor: string; waSkin?: boolean }) {
  // 📱 WhatsApp typing bubble: white incoming bubble with a left tail and three
  // grey pulsing dots. In branded (non-demo) mode keep the original look.
  const dotColor = waSkin ? "#8696A0" : primaryColor
  return (
    <div
      className={cn(
        "relative flex items-center gap-1 shadow-sm",
        waSkin
          ? "bg-white rounded-[10px] rounded-tl-none px-3 py-2.5 max-w-[70px]"
          : "bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85px] mb-3"
      )}
    >
      {waSkin && <BubbleTail side="left" color="#ffffff" />}
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
      <div className="typing-dot" style={{ backgroundColor: dotColor }} />
      <div className="typing-dot" style={{ backgroundColor: dotColor }} />
      <div className="typing-dot" style={{ backgroundColor: dotColor }} />
    </div>
  )
}
import { EmojiPicker } from "@/components/EmojiPicker"
import { ReactionPicker } from "@/components/ReactionPicker"
import { ChatSurface } from "@/components/chat/ChatSurface"
import { WelcomeVideoCard } from "@/components/chat/WelcomeVideoCard"
import { extractVideoUrl } from "@/lib/welcome-video"
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
  setWidgetReaction,
  registerAndStartChat,
  getWidgetStatus,
  getWidgetProfile,
  updateWidgetProfile,
  clearWidgetSession,
  type WidgetStoredMessage,
} from "@/components/chat/adapters/widgetAdapter"

// 📱 WhatsApp message "tail" — the little beak at the top corner of the first
// bubble of a turn. side="right" → outgoing bubble; side="left" → incoming.
// Rendered just outside the bubble's squared corner; colour matches the bubble.
function BubbleTail({ side, color }: { side: "left" | "right"; color: string }) {
  return side === "right" ? (
    <svg viewBox="0 0 8 13" width="8" height="13" aria-hidden="true" className="absolute -right-[7px] top-0">
      <path d="M0 0 H8 L0 9 Z" fill={color} />
    </svg>
  ) : (
    <svg viewBox="0 0 8 13" width="8" height="13" aria-hidden="true" className="absolute -left-[7px] top-0">
      <path d="M8 0 H0 L8 9 Z" fill={color} />
    </svg>
  )
}

// Bubble timestamp like WhatsApp: 24h HH:MM. Falls back to "now" when a message
// carries no timestamp (e.g. an optimistic local send).
function formatBubbleTime(ts?: string): string {
  const d = ts ? new Date(ts) : new Date()
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

// Supported language codes (browser language detection)
const SUPPORTED_LANG_CODES = ["it", "en", "es", "de", "fr", "ca"]

interface Message {
  role: "user" | "bot"
  content: string
  timestamp?: string
  suggestions?: string[]
  welcomeVideoUrl?: string // 📺 presentation video on the first bot reply (parity with WhatsApp)
  welcomeRest?: string // 📺 reply text rendered AFTER the welcome video (text before → video → text after)
  attachments?: ChatAttachment[] // 📎 operator-sent images / PDFs / audio (handoff)
  serverId?: string // 😀 DB ConversationMessage id — needed to anchor a reaction server-side
  reaction?: string | null // 😀 visitor's reaction emoji on this message (server-synced)
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
  // 🔤 Explicit 2-letter avatar monogram (WhatsApp-skin only). Overrides the
  // initials auto-derived from the title — e.g. the /demo page forces "DW".
  monogram?: string
  language?: string
  apiUrl?: string
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
  // Show a small WhatsApp logo badge over the header avatar's bottom-right
  // corner (white circle + green glyph), like the channel badge in the
  // backoffice chat list. Used by the public /demo page to read as WhatsApp.
  whatsappBadge?: boolean
  onOpenChange?: (isOpen: boolean) => void
  onConvert?: (customerId: string) => void
  // 📣 Demo-only: ready-to-render (already localized + branded) promotional push
  // messages. When provided AND instantChat is on, the widget shows a "Simulate a
  // promo push" button that injects these as incoming bot messages (with a beep),
  // cycling through them. Empty/undefined → no button (normal client widget).
  pushDemoCases?: string[]
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

type LangCode = "it" | "en" | "es" | "de" | "fr" | "ca"

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
    // 📣 Demo-only "try a push" control (simulated promotional push message).
    pushBtn: string
    pushHint: string
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
    pushBtn: "📣 Simula un push promozionale",
    pushHint: "Così il cliente riceve un messaggio pubblicitario che invii tu.",
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
    pushBtn: "📣 Simulate a promo push",
    pushHint: "This is how your customer receives a promotional message you send.",
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
    pushBtn: "📣 Simula un push promocional",
    pushHint: "Así recibe tu cliente un mensaje publicitario que tú envías.",
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
    pushBtn: "📣 Simuler un push promo",
    pushHint: "Voici comment votre client reçoit un message publicitaire que vous envoyez.",
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
    pushBtn: "📣 Promo-Push simulieren",
    pushHint: "So erhält dein Kunde eine Werbenachricht, die du sendest.",
  },
  ca: {
    intro: "Presenta't per començar a xatejar",
    name: "Nom",
    phone: "Telèfon",
    message: "Missatge",
    namePh: "El teu nom",
    phonePh: "+34 612 345 678",
    messagePh: "Com podem ajudar-te?",
    start: "Iniciar xat",
    termsLabel: "Termes i Condicions",
    termsError: "Accepta els Termes i Condicions per continuar",
    back: "Enrere",
    termsTitle: "Termes i Condicions",
    termsBody:
      "En acceptar, autoritzes eChatbot a contactar-te per WhatsApp per a suport, notificacions i ofertes. Pots revocar el consentiment en qualsevol moment responent STOP o contactant el suport.",
    pushBtn: "📣 Simula un push promocional",
    pushHint: "Així rep el teu client un missatge publicitari que tu envies.",
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
  monogram,
  language,
  apiUrl,
  defaultOpen = false,
  instantChat = false,
  hideWorkspaceName = false,
  plainWhatsappNumber = false,
  whatsappBadge = false,
  onOpenChange,
  onConvert,
  pushDemoCases,
}: ChatWidgetProps) {
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
  // 🔤 Two-letter monogram derived from the title (WhatsApp-style avatar logo).
  // "DemoWash" → "DW", "Demo Wash" → "DW", "eChatbot HQ" → "EH". Empty when we
  // can't extract exactly two letters, so the avatar falls back to the icon glyph.
  const titleMonogram = useMemo(() => {
    // Explicit `monogram` prop wins (the /demo page forces "DW"); otherwise we
    // derive the initials from the title. Both go through the same extractor.
    const source = (monogram && monogram.trim()) || (resolvedTitle || "").trim()
    if (!source) return ""
    const words = source.split(/[\s_·.-]+/).filter(Boolean)
    let letters = ""
    if (words.length >= 2) {
      letters = (words[0][0] || "") + (words[1][0] || "")
    } else {
      const caps = words[0].match(/[A-Z]/g)
      letters = caps && caps.length >= 2 ? caps[0] + caps[1] : words[0].slice(0, 2)
    }
    letters = letters.replace(/[^A-Za-z]/g, "")
    return letters.length === 2 ? letters.toUpperCase() : ""
  }, [resolvedTitle, monogram])
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
      fr: "Écrivez un message...",
      de: "Nachricht schreiben...",
    }[resolvedLangKey] ||
    "Type a message..."
  
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [messages, setMessages] = useState<Message[]>([])

  // 📺 Welcome presentation video — the URL is authored INSIDE the first bot
  // reply (the module greeting). Extract it from that message, strip it from the
  // visible text, and render it as a card (greeting → video card → rest), exactly
  // like the operator chat / playground. Computed at render time (not stored
  // per-message) so it also shows for messages restored from localStorage.
  const displayMessages = useMemo<Message[]>(() => {
    const firstBotIdx = messages.findIndex((m) => m.role === "bot")
    if (firstBotIdx === -1) return messages
    const found = extractVideoUrl(messages[firstBotIdx].content)
    if (!found) return messages
    return messages.map((m, i) => {
      if (i !== firstBotIdx) return m
      return {
        ...m,
        content: found.before, // greeting + intro line (authored in the reply language)
        welcomeRest: found.after, // the rest of the reply, below the video
        welcomeVideoUrl: found.url,
      }
    })
  }, [messages])

  // 📱 WhatsApp read receipts (demo) — full tick progression:
  //   ✓  sent      → the message just left and the bot hasn't replied yet
  //   ✓✓ delivered → exchange settled but no later bot message (e.g. error)
  //   ✓✓ read (blue) → any later bot message exists (it has been "read")
  const tickStateDemo = (msg: Message): "sent" | "delivered" | "read" => {
    const idx = displayMessages.indexOf(msg)
    if (idx === -1) return "delivered"
    for (let i = idx + 1; i < displayMessages.length; i++) {
      if (displayMessages[i].role === "bot") return "read"
    }
    // No bot message after this one: single tick while the reply is in flight.
    return isLoading ? "sent" : "delivered"
  }

  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // 📎 File attachments (demo composer): paperclip → pick image/PDF → render in
  // the user's own bubble. Object URLs are created locally so the media shows
  // instantly (parity with WhatsApp); revoked on unmount to avoid leaks.
  const attachInputRef = useRef<HTMLInputElement | null>(null)
  const attachObjectUrls = useRef<string[]>([])
  // ⚠️ Transient composer error (e.g. rejected attachment) — visible in chat
  // mode just above the input; auto-dismisses.
  const [chatError, setChatError] = useState<string | null>(null)
  // 😀 serverId of the message whose reaction picker is open. Tap-to-open so it
  // also works on touch devices, where the old hover-only reveal was unreachable.
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  // WhatsApp-style composer: textarea grows with content up to a max, then scrolls
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  // 🎤 Voice note recording (mirrors PlaygroundPage): mic when the field is empty.
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
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

    // Load stored messages. Local-preview attachments use blob: object URLs
    // that die with the page — strip them so restored bubbles don't render
    // broken players/thumbnails after a reload.
    const storedMessages = (loadWidgetMessages(localStorage, resolvedWorkspaceId) as Message[]).map(
      (m) => {
        if (!m.attachments?.length) return m
        const alive = m.attachments.filter((a) => !a.url.startsWith("blob:"))
        if (alive.length > 0) return { ...m, attachments: alive }
        // All attachments were local-only: fall back to a text label so the
        // bubble doesn't render empty.
        const wasAudio = m.attachments.some((a) => a.kind === "AUDIO")
        return {
          ...m,
          attachments: undefined,
          content: m.content || (wasAudio ? "🎤 Voice message" : "📎 Attachment"),
        }
      }
    )
    if (storedMessages.length > 0) {
      setMessages(storedMessages)
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

  // WhatsApp-style auto-grow: resize the composer to fit its content (1 line →
  // up to ~5 lines), then it scrolls. Runs on every inputValue change so it also
  // shrinks back after sending or when an emoji is inserted programmatically.
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    // Empty → fall back to the rows=1 natural height. (A wrapping placeholder on
    // narrow widths inflates scrollHeight, so we must NOT measure it when empty.)
    if (!el.value) {
      el.style.height = ""
      return
    }
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputValue, isOpen])

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
              attachments: m.attachments, // 📎 keep operator-sent image/PDF/audio
              serverId: m.id, // 😀 lets the visitor react to this operator message
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
            serverId: m.id, // 😀 lets the visitor react to this operator message
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

  // 📣 Demo push: cycle through the provided promo cases, play a WhatsApp-like
  // beep, and inject the promo as an incoming bot bubble. Demo-only (gated on
  // instantChat + pushDemoCases at the call site).
  const pushDemoIndexRef = useRef(0)

  const playPushBeep = () => {
    try {
      const Ctx =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const beep = (startAt: number, freq: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = freq
        osc.connect(gain)
        gain.connect(ctx.destination)
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18)
        osc.start(startAt)
        osc.stop(startAt + 0.2)
      }
      const t0 = ctx.currentTime
      beep(t0, 880) // first tone
      beep(t0 + 0.16, 1320) // higher second tone → WhatsApp-style "bip-bip"
    } catch {
      // Audio is a nicety; never break the demo if it fails (autoplay policy).
    }
  }

  const firePushDemo = () => {
    if (!pushDemoCases || pushDemoCases.length === 0) return
    const idx = pushDemoIndexRef.current % pushDemoCases.length
    pushDemoIndexRef.current = idx + 1
    const pushMessage: Message = {
      role: "bot",
      content: pushDemoCases[idx],
      timestamp: new Date().toISOString(),
      serverId: `demo-push-${Date.now()}`,
    }
    setMessages((prev) => {
      const updated = [...prev, pushMessage]
      if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, updated)
      return updated
    })
    playPushBeep()
  }

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
        serverId: data.assistantMessageId, // 😀 lets the visitor react to this reply
        // 🔊 audioOutput tenants (demos): backend speaks every reply. Keep the text
        // readable AND attach a voice-note player so visitors see the bot sends audio.
        attachments: data.audioUrl
          ? [
              {
                id: `tts-${Date.now()}`,
                url: data.audioUrl,
                kind: "AUDIO",
                mimeType: "audio/mpeg",
                filename: "Voice reply",
              },
            ]
          : undefined,
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

  // 🎤 Upload a recorded voice note to the widget audio endpoint. The backend
  // transcribes it (Whisper), runs the normal bot turn on the transcription and
  // returns the same shape as a text send (+ optional TTS audioUrl). Mirrors the
  // PlaygroundPage flow; reuses sendMessage's response handling.
  const sendVoiceNote = async (blob: Blob) => {
    if (!resolvedWorkspaceId || isLoading) return

    // Show the voice note as a playable audio bubble immediately (parity with
    // WhatsApp): local object URL → instant player, no round-trip needed.
    const voiceUrl = URL.createObjectURL(blob)
    attachObjectUrls.current.push(voiceUrl)
    const userMessage: Message = {
      role: "user",
      content: "",
      timestamp: new Date().toISOString(),
      attachments: [
        {
          id: `local-voice-${Date.now()}`,
          url: voiceUrl,
          kind: "AUDIO",
          mimeType: blob.type || "audio/webm",
          filename: "Voice message",
        },
      ],
    }
    const updatedMessages = [
      ...messages.map((m) => (m.role === "bot" && m.suggestions ? { ...m, suggestions: undefined } : m)),
      userMessage,
    ]
    setMessages(updatedMessages)
    if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, updatedMessages)
    setIsLoading(true)

    try {
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm"
      const form = new FormData()
      form.append("audio", blob, `voice.${ext}`)
      form.append("visitorId", visitorId)
      if (sessionId) form.append("sessionId", sessionId)
      form.append("language", resolvedLanguage)
      if (customerId) form.append("customerId", customerId)

      const resp = await fetch(`${resolvedApiUrl}/widget/chat-audio/${resolvedWorkspaceId}`, {
        method: "POST",
        body: form,
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.message || data?.error || "Failed to send voice note")
      }

      if (data.sessionId && resolvedWorkspaceId) {
        setSessionId(data.sessionId)
        saveWidgetSessionId(localStorage, resolvedWorkspaceId, data.sessionId)
      }

      // Operator took over → no bot reply to show.
      if (data.activeChatbot === false) {
        setBotDisabled(true)
        lastOperatorMsgAt.current = new Date().toISOString()
        return
      }

      // 🔊 Voice in → voice out: the backend synthesizes the reply (TTS) and
      // returns audioUrl. On WhatsApp a voice message is JUST audio — no text
      // alongside it — so when we have audio we blank the bubble text and show
      // only the player (Andrea's rule).
      const hasTts = Boolean(data.audioUrl)
      const botMessage: Message = {
        role: "bot",
        content: hasTts ? "" : data.response,
        timestamp: new Date().toISOString(),
        suggestions: data.suggestions,
        serverId: data.assistantMessageId, // 😀 lets the visitor react to this reply
        attachments: hasTts
          ? [
              {
                id: `tts-${Date.now()}`,
                url: data.audioUrl as string,
                kind: "AUDIO",
                mimeType: "audio/mpeg",
                filename: "Voice reply",
              },
            ]
          : undefined,
      }
      const finalMessages = [...updatedMessages, botMessage]
      setMessages(finalMessages)
      if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, finalMessages)
    } catch (error) {
      console.error("Failed to send voice note:", error)
      const errorMessage: Message = {
        role: "bot",
        content: "Sorry, I couldn't process your voice message. Please try again.",
        timestamp: new Date().toISOString(),
      }
      const errorMessages = [...updatedMessages, errorMessage]
      setMessages(errorMessages)
      if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, errorMessages)
    } finally {
      setIsLoading(false)
    }
  }

  // Start microphone capture. On stop, the chunks are joined and uploaded.
  // Requires mic permission (browser prompts once). Fire-safe: never throws.
  const startRecording = async () => {
    if (recording || isLoading) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop()) // release the mic
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current)
          recordTimerRef.current = null
        }
        setRecording(false)
        setRecordSecs(0)
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" })
        if (blob.size > 0) void sendVoiceNote(blob)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordSecs(0)
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000)
    } catch {
      alert("Microphone access denied or unavailable.")
    }
  }

  // Stop & send. Cancel discards the chunks before stopping (sends nothing).
  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }
  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder) {
      recordChunksRef.current = []
      recorder.stop()
    }
  }

  /**
   * 📎 Attach images / PDFs from the widget composer (paperclip). Validates the
   * selection with the same caps as the backend, shows each file inside the
   * user's own bubble via a local object URL (instant WhatsApp-style preview),
   * then uploads them so the operator actually receives them. Upload needs an
   * existing session — once the visitor has exchanged at least one message the
   * widget holds a sessionId; before that the file is shown locally only.
   */
  const handleAttachFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const { accepted, errors } = validateSelection(Array.from(fileList), 0)
    if (errors.length > 0) {
      setChatError(errors[0])
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

    // Upload to the backend so the operator receives the media. Fire-and-forget:
    // a failure leaves the local preview intact (never blocks the UI).
    if (resolvedWorkspaceId && sessionId) {
      const form = new FormData()
      accepted.forEach((file) => form.append("files", file, file.name))
      form.append("sessionId", sessionId)
      void fetch(`${resolvedApiUrl}/widget/chat-attachments/${resolvedWorkspaceId}`, {
        method: "POST",
        body: form,
      }).catch((err) => {
        console.error("Failed to upload attachment(s):", err)
      })
    }
  }

  /**
   * 😀 Toggle the visitor's reaction on a bot/operator message (WhatsApp parity:
   * same emoji again clears it). Optimistic local update + localStorage persist,
   * then server sync so the operator sees the reaction too. Only messages with a
   * serverId (a real DB row) can be reacted to — pure-local bubbles are skipped.
   */
  const toggleReaction = (target: Message, emoji: string) => {
    if (!target.serverId) return
    const next = target.reaction === emoji ? "" : emoji
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.serverId === target.serverId ? { ...m, reaction: next || null } : m
      )
      if (resolvedWorkspaceId) saveWidgetMessages(localStorage, resolvedWorkspaceId, updated)
      return updated
    })
    if (resolvedWorkspaceId && sessionId) {
      void setWidgetReaction({
        apiUrl: resolvedApiUrl,
        workspaceId: resolvedWorkspaceId,
        sessionId,
        messageId: target.serverId,
        emoji: next,
      }).catch((err) => {
        // Non-blocking: a reaction failure must never disrupt the chat.
        console.error("Failed to sync reaction:", err)
      })
    }
  }

  // 🧹 Revoke any object URLs created for attachment previews on unmount.
  useEffect(() => {
    return () => {
      attachObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  // ⚠️ Auto-dismiss the transient composer error after a few seconds.
  useEffect(() => {
    if (!chatError) return
    const timer = setTimeout(() => setChatError(null), 5000)
    return () => clearTimeout(timer)
  }, [chatError])

  // 😀 Close the open reaction picker when tapping/clicking anywhere outside it.
  useEffect(() => {
    if (!reactionPickerFor) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.("[data-reaction-ui]")) return
      setReactionPickerFor(null)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
    }
  }, [reactionPickerFor])

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
          <svg viewBox="0 0 32 32" className="h-9 w-9 fill-white" aria-hidden="true">
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
    ? "w-screen h-[100dvh] sm:w-[480px] sm:h-[760px] sm:max-h-[92vh] rounded-none sm:rounded-3xl shadow-2xl border-2 sm:border-2"
    : "w-screen h-[100dvh] sm:w-[410px] sm:h-[680px] sm:max-h-[800px] rounded-none sm:rounded-3xl shadow-2xl border-2 sm:border-2"
    
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
                    className="flex h-10 w-10 items-center justify-center rounded-full text-base font-extrabold tracking-tight shadow-inner"
                    style={{ backgroundColor: resolvedPrimaryColor }}
                  >
                    {displayLogoUrl ? (
                      <img src={displayLogoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : titleMonogram ? (
                      // 🔤 Monogram logo — first letter white, second black
                      <>
                        <span className="text-white">{titleMonogram[0]}</span>
                        <span className="text-slate-900">{titleMonogram[1]}</span>
                      </>
                    ) : (
                      renderIconGlyph(resolvedIcon)
                    )}
                  </div>
                  {whatsappBadge ? (
                    // 📲 WhatsApp channel badge — small white circle with the
                    // green WhatsApp glyph, like the backoffice chat list badge.
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                      <svg viewBox="0 0 32 32" className="h-3 w-3 fill-[#25D366]" aria-hidden="true">
                        <path d="M16.003 3C9.38 3 4 8.38 4 15.003c0 2.117.553 4.187 1.605 6.01L4 29l8.184-1.55a11.94 11.94 0 0 0 3.819.626h.003C22.626 28.075 28 22.695 28 16.072 28 9.45 22.626 3 16.003 3Zm0 21.86h-.002a9.9 9.9 0 0 1-3.46-.62l-.248-.094-4.857.92.94-4.735-.16-.244a9.85 9.85 0 0 1-1.5-5.224c0-5.46 4.44-9.9 9.91-9.9 2.646 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.44 9.9-9.91 9.9Zm5.43-7.42c-.297-.15-1.758-.867-2.03-.967-.272-.099-.47-.148-.668.149-.198.297-.767.967-.94 1.166-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.76-1.653-2.057-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.496.099-.198.05-.372-.025-.521-.074-.149-.668-1.611-.916-2.206-.241-.58-.486-.501-.668-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.073.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347Z" />
                      </svg>
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#075E54]",
                        workspaceConfig?.debugMode === true || workspaceConfig?.channelStatus === false
                          ? "bg-red-400"
                          : "bg-emerald-400"
                      )}
                    />
                  )}
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
                {/* 📱 WhatsApp status line: "typing…" while the bot composes a
                    reply, otherwise "online" (or the WhatsApp number CTA). */}
                {waSkin && isLoading && (
                  <p className="text-[11px] text-white/90">typing…</p>
                )}
                {waSkin && !isLoading && !shouldShowWhatsappNumber(workspaceConfig) && (
                  <p className="text-[11px] text-white/70">online</p>
                )}
                {shouldShowWhatsappNumber(workspaceConfig) && !(waSkin && isLoading) && (
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
                        <option value="ca">🏴󠁥󠁳󠁣󠁴󠁿 Català</option>
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
                    waSkin
                      ? cn(
                          // 📱 WhatsApp bubble: ~10px radius, squared corner where
                          // the tail attaches, compact padding, subtle shadow.
                          // `group` → reveals the reaction picker on hover.
                          "group relative max-w-[80%] sm:max-w-[340px] px-2.5 py-[6px] shadow-sm rounded-[10px]",
                          "word-wrap break-words overflow-wrap-anywhere text-sm sm:text-[14.5px]",
                          msg.role === "user"
                            ? "text-slate-900 rounded-tr-none" // outgoing (green via style) — tail top-right
                            : "bg-white text-slate-900 rounded-tl-none" // incoming (white) — tail top-left
                        )
                      : cn(
                          "group rounded-2xl px-3 sm:px-4 py-2 sm:py-3 max-w-[88%] sm:max-w-[360px] mb-3 shadow-sm",
                          "word-wrap break-words overflow-wrap-anywhere relative text-sm sm:text-[15px] leading-relaxed",
                          msg.role === "user"
                            ? "text-white rounded-br-md"
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
                  renderBadge={(msg) =>
                    waSkin ? (
                      <BubbleTail
                        side={msg.role === "user" ? "right" : "left"}
                        color={msg.role === "user" ? WA_OUT_BUBBLE : "#ffffff"}
                      />
                    ) : null
                  }
                  renderFooter={(msg) => (
                    <>
                      {/* 😀 React to a bot/operator message. A small smiley
                          trigger sits beside the bubble: always visible on touch
                          devices (no hover there), hover-revealed on desktop.
                          Tapping it opens the WhatsApp-style reaction bar. Only
                          bubbles backed by a DB row (serverId) are reactable —
                          the reaction syncs to the operator chat. */}
                      {msg.role === "bot" && msg.serverId && (
                        <>
                          <button
                            type="button"
                            data-reaction-ui
                            aria-label="React to this message"
                            title="React"
                            onClick={() =>
                              setReactionPickerFor((cur) =>
                                cur === msg.serverId ? null : msg.serverId!
                              )
                            }
                            className={cn(
                              "absolute -right-8 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center",
                              "rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm",
                              "transition-opacity hover:text-emerald-600",
                              "opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                            )}
                          >
                            <SmilePlus className="h-4 w-4" />
                          </button>
                          {reactionPickerFor === msg.serverId && (
                            <div data-reaction-ui className="absolute -top-10 left-0 z-20">
                              <ReactionPicker
                                onReact={(emoji) => {
                                  toggleReaction(msg, emoji)
                                  setReactionPickerFor(null)
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}
                      {/* Reaction badge: small emoji overlapping the bubble's
                          bottom edge, the way WhatsApp renders reactions. */}
                      {msg.reaction && (
                        <span className="absolute -bottom-3 left-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border border-gray-200 bg-white px-1 text-sm shadow">
                          {msg.reaction}
                        </span>
                      )}
                      {/* 📺 Welcome video on the first reply: greeting (in the
                          bubble content) → video card → rest of the reply. */}
                      {msg.welcomeVideoUrl && (
                        <>
                          <WelcomeVideoCard url={msg.welcomeVideoUrl} />
                          {msg.welcomeRest && (
                            <MessageRenderer content={msg.welcomeRest} variant="chat" />
                          )}
                        </>
                      )}
                      {/* 📎 Media: operator-sent (left) or customer-attached via
                          the paperclip (right). Aligns to the bubble's own side. */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <MessageAttachments
                          attachments={msg.attachments}
                          align={msg.role === "user" ? "right" : "left"}
                        />
                      )}
                      {/* 📱 WhatsApp meta line: time + (outgoing) read receipts. */}
                      {waSkin && (
                        <div
                          className={cn(
                            "mt-0.5 -mb-0.5 flex items-center justify-end gap-1 text-[11px] leading-none",
                            msg.role === "user" ? "text-gray-500/80" : "text-gray-400"
                          )}
                        >
                          <span>{formatBubbleTime(msg.timestamp)}</span>
                          {msg.role === "user" &&
                            (tickStateDemo(msg) === "sent" ? (
                              <Check className="h-3.5 w-3.5" style={{ color: "#8696A0" }} />
                            ) : (
                              <CheckCheck
                                className="h-3.5 w-3.5"
                                style={{
                                  color: tickStateDemo(msg) === "read" ? "#53BDEB" : "#8696A0",
                                }}
                              />
                            ))}
                        </div>
                      )}
                    </>
                  )}
                />
                {/* Show typing indicator when waiting for bot response */}
                {isLoading && (
                  <div className="flex items-start gap-2 mb-3">
                    <TypingIndicator primaryColor={resolvedPrimaryColor} waSkin={waSkin} />
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

              {/* ⚠️ Transient composer error (e.g. rejected attachment) */}
              {chatError && (
                <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-medium text-red-600">
                  {chatError}
                </div>
              )}

              {/* Operator handoff banner — shown when chatbot is disabled */}
              {botDisabled && (
                <div className="mx-4 mb-2 px-4 py-2 rounded-xl text-sm text-center font-medium"
                  style={{ backgroundColor: `${resolvedPrimaryColor}18`, color: resolvedPrimaryColor, border: `1px solid ${resolvedPrimaryColor}33` }}>
                  {operatorHasReplied
                    ? "🧑‍💼 Operator active — you can reply directly"
                    : "👤 Connecting you with our team — replies coming shortly"}
                </div>
              )}

              {/* Footer with Input — WhatsApp-style: emoji + paperclip live INSIDE
                  the rounded input pill, and a single round button on the right
                  toggles mic ↔ send. Keeps the composer compact on narrow widths
                  so nothing wraps to a second line. */}
              <div className="border-t border-gray-200 p-2.5 sm:p-3 space-y-1.5">
                {/* 📣 Demo-only: simulate a promotional push. Injects an incoming
                    promo bubble + a WhatsApp-like beep. Dashed/amber so it reads
                    as a demo control, never shown in the real client widget. */}
                {instantChat && pushDemoCases && pushDemoCases.length > 0 && (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={firePushDemo}
                      className="w-full rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      {ui.pushBtn}
                    </button>
                    <p className="px-1 text-center text-[10px] leading-tight text-gray-400">
                      {ui.pushHint}
                    </p>
                  </div>
                )}
                {recording ? (
                  /* 🎤 Recording state: cancel (discard) · live timer · stop (send) */
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      aria-label="Cancel recording"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-red-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex flex-1 items-center gap-2 px-4 text-sm text-red-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      Recording… {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, "0")}
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      aria-label="Stop and send"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:brightness-95"
                      style={{ backgroundColor: resolvedPrimaryColor }}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                <div className="flex items-end gap-2">
                  {/* Input pill: emoji · textarea · paperclip */}
                  <div className="flex flex-1 min-w-0 items-end gap-1 rounded-3xl border border-gray-300 bg-white px-1.5 py-1 transition-colors focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600">
                    {/* 🎮 Emoji picker — demo composer */}
                    {instantChat && !(botDisabled && !operatorHasReplied) && (
                      <EmojiPicker
                        onSelect={(emoji) => setInputValue((prev) => prev + emoji)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                      />
                    )}
                    <textarea
                      ref={composerRef}
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
                      rows={1}
                      className={cn(
                        "flex-1 min-w-0 resize-none border-none bg-transparent px-1.5 py-1.5",
                        "focus:outline-none focus:ring-0",
                        "text-sm sm:text-[15px] placeholder-gray-400 leading-relaxed",
                        "disabled:text-gray-400"
                      )}
                    />
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
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                          aria-label="Attach image or file"
                          title="Attach image or PDF"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                  {/* Right round button (WhatsApp-style): mic when the field is
                      empty, send when there's text. Mic only in the live demo
                      composer and not while waiting for an operator. */}
                  {instantChat &&
                  !(botDisabled && !operatorHasReplied) &&
                  inputValue.trim().length === 0 ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isLoading}
                      className={cn(
                        "h-11 w-11 shrink-0 rounded-full flex items-center justify-center",
                        "text-white transition-colors disabled:bg-gray-300 hover:brightness-95",
                        "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-green-600"
                      )}
                      style={{ backgroundColor: resolvedPrimaryColor }}
                      aria-label="Record voice note"
                      title="Record voice note"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleSendMessage}
                      disabled={
                        isLoading ||
                        (botDisabled && !operatorHasReplied) ||
                        inputValue.trim().length === 0
                      }
                      className={cn(
                        "h-11 w-11 shrink-0 rounded-full flex items-center justify-center",
                        "text-white transition-colors disabled:bg-gray-300 hover:brightness-95",
                        "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-green-600"
                      )}
                      style={{ backgroundColor: resolvedPrimaryColor }}
                      aria-label="Send message"
                      title="Send"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
                )}
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
                  <option value="ca">🏴󠁥󠁳󠁣󠁴󠁿 Català</option>
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
