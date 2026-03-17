import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ImageCropUpload } from "@/components/shared/ImageCropUpload"
import { IMG_BASE_URL } from "@/config"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TeamMembersTable } from "@/components/workspace/TeamMembersTable"
import { BillingSection } from "@/components/billing/BillingSection"
import { UsageLimitsCard } from "@/components/billing/UsageLimitsCard"
import type { Workspace } from "@/hooks/use-workspace"
import { useWorkspace } from "@/hooks/use-workspace"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { getBillingOverview, PlanType } from "@/services/subscriptionBillingApi"
import { getPayPalConnectUrl, getPayPalStatus, disconnectPayPal, getPayPalConfig, type PayPalStatusResponse, type PayPalConfigResponse } from "@/services/paypalApi"
import { LogOut, PlusCircle, MessageSquare, ShoppingCart, AlertTriangle, MessageCircle, Smartphone, Crown, User, Ban, UserPlus, Clock, CreditCard, ArrowLeft, Check, ChevronRight, ChevronLeft, Store, Users, Headphones, Bot, X, HelpCircle, Mail, Briefcase, ImagePlus, Pencil, Globe, DollarSign, Languages, BarChart3, Zap, Layout, Megaphone, Wallet, Code2, Settings, Info, ListTodo, CheckCircle2, Circle, Power, Monitor, Building2, Link2, RefreshCw, Loader2, PartyPopper, ExternalLink } from "lucide-react"
import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
  workspaceApi,
  type WorkspaceChecklist,
} from "@/services/workspaceApi"
import { WasenderOnboarding } from "@/components/WasenderOnboarding"

// ============================================================================
// WIZARD TYPES & CONFIGURATION
// ============================================================================

interface WizardFormData {
  // Step 1: Business Type (same values as Settings → BusinessConfigSection)
  businessType: 'retail' | 'restaurant' | 'healthcare' | 'education' | 'finance' | 'realestate' | 'technology' | 'other'
  // Step 2: Channel Setup
  alias: string
  channelType: 'WHATSAPP' | 'WIDGET'
  whatsappNumber: string // Only required if channelType === 'WHATSAPP'
  sellsProductsAndServices: boolean
  // Step 3: Provider (WhatsApp only)
  whatsappProvider: 'meta' | 'ultramsg' | 'wasender'
  // Step 4: Bot Personality
  toneOfVoice: 'formal' | 'friendly' | 'professional' | 'casual'
  botIdentityResponse: string
  // Support (always enabled by default — configurable in Settings later)
  hasHumanSupport: boolean
  humanSupportInstructions: string
  // FAQs
  faqs: Array<{ question: string; answer: string }>
}

const WIZARD_STEPS = [
  { id: 1, title: "Your Business", description: "Industry & goals", icon: Building2 },
  { id: 2, title: "Channel Setup", description: "Type & name", icon: Smartphone },
  { id: 3, title: "Support", description: "Human escalation", icon: Headphones },
  { id: 4, title: "Bot Personality", description: "Tone & identity", icon: Bot },
  { id: 5, title: "Connect", description: "Link your channel", icon: Link2 },
  { id: 6, title: "All Done!", description: "Channel ready", icon: CheckCircle2 },
] as const

const PLAN_LABELS: Record<PlanType, string> = {
  FREE_TRIAL: "Free Trial",
  BASIC: "Basic",
  PREMIUM: "Premium",
  ENTERPRISE: "Enterprise",
}

const PLAN_TYPE_VALUES: PlanType[] = ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]

const normalizePlanType = (value?: string | null): PlanType => {
  if (value && PLAN_TYPE_VALUES.includes(value as PlanType)) {
    return value as PlanType
  }
  return "FREE_TRIAL"
}

const CHECKLIST_ITEM_HELP: Record<string, { title: string; description: string; impact: string }> = {
  "channel-active": {
    title: "Channel Is Active",
    description: "Ensures the selected channel is enabled and ready to receive conversations.",
    impact: "If disabled, customers will not be able to reach your assistant.",
  },
  faqs: {
    title: "At Least 10 FAQs",
    description: "Gives the assistant enough context to answer the most common questions accurately.",
    impact: "More FAQs improve answer quality and reduce repetitive support.",
  },
  "bot-identity": {
    title: "Bot Identity",
    description: "Defines how the assistant introduces itself and its purpose.",
    impact: "A clear identity builds trust and sets expectations.",
  },
  "default-language": {
    title: "Default Language",
    description: "Sets the primary language used for responses and system messages.",
    impact: "Prevents mismatched language experiences for customers.",
  },
  "welcome-message": {
    title: "Welcome Message",
    description: "First message users see when they open a conversation.",
    impact: "Sets the tone and guides users on how to interact.",
  },
  "wip-message": {
    title: "WIP Message",
    description: "Fallback message when the assistant is under maintenance or paused.",
    impact: "Keeps users informed instead of leaving them without a response.",
  },
  "assistant-name": {
    title: "Assistant Name",
    description: "The public-facing name shown in conversations.",
    impact: "Makes the assistant feel consistent and branded.",
  },
  "tone-of-voice": {
    title: "Tone of Voice",
    description: "Defines the communication style used by the assistant.",
    impact: "Aligns the bot personality with your brand voice.",
  },
  "human-support": {
    title: "Human Support",
    description: "Allows escalation to a human operator when needed.",
    impact: "Improves customer satisfaction for complex requests.",
  },
  "frustration-triggers": {
    title: "Frustration Triggers",
    description: "Rules that detect frustration and trigger human escalation.",
    impact: "Prevents negative experiences and saves at-risk conversations.",
  },
  campaigns: {
    title: "Campaign",
    description: "At least one campaign configured for proactive outreach.",
    impact: "Unlocks broadcast or follow-up workflows.",
  },
  paypal: {
    title: "PayPal Account",
    description: "Connects PayPal for automatic billing and plan management.",
    impact: "Keeps billing uninterrupted and the channel active.",
  },
  "whatsapp-settings": {
    title: "WhatsApp Access Settings",
    description: "Required WhatsApp API details for sending and receiving messages.",
    impact: "Missing values block message delivery.",
  },
  "widget-settings": {
    title: "Widget Access Settings",
    description: "Widget title, primary color, icon, and language configuration.",
    impact: "Ensures the widget looks consistent and works across the site.",
  },
  services: {
    title: "Services",
    description: "At least one service published in your catalog.",
    impact: "Allows the assistant to answer service-related questions.",
  },
  products: {
    title: "Products",
    description: "At least one product published in your catalog.",
    impact: "Enables product recommendations and sales flows.",
  },
  "sales-agents": {
    title: "Sales Agent",
    description: "At least one sales agent configured for assisted selling.",
    impact: "Lets the assistant route lead requests to the right agent.",
  },
  offers: {
    title: "Offers",
    description: "At least one offer configured for promotions.",
    impact: "Allows the assistant to highlight active promotions.",
  },
}

const initialWizardData: WizardFormData = {
  // Step 1: Business Type
  businessType: 'retail',
  // Step 2: Channel Setup
  alias: "",
  channelType: 'WHATSAPP',
  whatsappNumber: "",
  sellsProductsAndServices: true,
  // Step 3: Provider
  whatsappProvider: 'wasender',
  // Step 4: Bot Personality
  toneOfVoice: 'friendly',
  botIdentityResponse: "",
  // Support defaults
  hasHumanSupport: true,
  humanSupportInstructions: "Hello {{nameUser}}, I'm connecting you with our agent. They will contact you shortly.",
  faqs: [],
}

// Badge stats type
interface WorkspaceBadgeStats {
  unreadMessages: number
  pendingOrders: number
  needsIntervention: number
  blockedUsers: number
  newCustomers: number
}

export function WorkspaceSelectionPage() {
  const navigate = useNavigate()
  const { setCurrentWorkspace } = useWorkspace()
  
  // Guard against concurrent/duplicate loadWorkspaces calls
  const isLoadingRef = useRef(false)
  const lastLoadTimestampRef = useRef(0)
  const RELOAD_DEBOUNCE_MS = 3000 // Minimum 3s between reloads
  
  // ============================================================================
  // WIZARD STATE
  // ============================================================================
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardFormData>(initialWizardData)
  const [wizardOpen, setWizardOpen] = useState(false)
  // New workspace created during wizard (set when entering Step 5)
  const [newlyCreatedWorkspaceId, setNewlyCreatedWorkspaceId] = useState<string | null>(null)
  
  const [userEmail, setUserEmail] = useState("") // Email from token (auto-filled)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [validationErrors, setValidationErrors] = useState<{
    whatsapp?: string
  }>({})
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [hasLoadedWorkspaces, setHasLoadedWorkspaces] = useState(false)
  const [hasAutoOpenedWizard, setHasAutoOpenedWizard] = useState(false)
  const [checklists, setChecklists] = useState<Record<string, WorkspaceChecklist>>({})
  const [checklistLoading, setChecklistLoading] = useState<Record<string, boolean>>({})
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [selectedChecklist, setSelectedChecklist] = useState<WorkspaceChecklist | null>(null)
  const [selectedChecklistWorkspaceId, setSelectedChecklistWorkspaceId] = useState<string | null>(null)
  const [checklistError, setChecklistError] = useState<string | null>(null)
  const [activeChecklistItemKey, setActiveChecklistItemKey] = useState<string | null>(null)
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  
  // Support tickets unread count (only loaded in Chat History)
  const supportUnreadCount = 0
  
  // PayPal connection state
  const [paypalStatus, setPaypalStatus] = useState<PayPalStatusResponse | null>(null)
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfigResponse | null>(null)
  const [paypalLoading, setPaypalLoading] = useState(false)
  const [paypalConnecting, setPaypalConnecting] = useState(false)
  const [paypalDisconnecting, setPaypalDisconnecting] = useState(false)
  const [paypalConnectModalOpen, setPaypalConnectModalOpen] = useState(false)
  const [paypalDisconnectModalOpen, setPaypalDisconnectModalOpen] = useState(false)
  const [disconnectConfirmText, setDisconnectConfirmText] = useState("")
  
  // Logo upload state
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)
  const [selectedWorkspaceForLogo, setSelectedWorkspaceForLogo] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [debugSavingId, setDebugSavingId] = useState<string | null>(null)
  const [activeSavingId, setActiveSavingId] = useState<string | null>(null)

  const activeChecklistItem =
    selectedChecklist?.items.find((item) => item.key === activeChecklistItemKey) ??
    selectedChecklist?.items?.[0] ??
    null
  const activeChecklistHelp = activeChecklistItem
    ? CHECKLIST_ITEM_HELP[activeChecklistItem.key]
    : null

  // ============================================================================
  // WIZARD HELPERS
  // ============================================================================
  
  const updateWizardData = <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
    setWizardData(prev => ({ ...prev, [field]: value }))
  }

  const validateCurrentStep = (): boolean => {
    switch (wizardStep) {
      case 1: // Business Goal — always valid (defaults preset)
        return true
      case 2: // Channel Setup: alias required; phone required for WhatsApp
        if (!wizardData.alias.trim()) return false
        if (wizardData.channelType === 'WHATSAPP') {
          return !!(
            wizardData.whatsappNumber.trim() &&
            validateWhatsAppNumber(wizardData.whatsappNumber)
          )
        }
        return true
      case 3: // Support — always valid (human support is optional)
        return true
      case 4: // Bot Personality: require bot identity
        return wizardData.botIdentityResponse.trim().length > 0
      case 5: // Connect — always valid (Wasender handles its own completion)
        return true
      case 6: // Done — always valid
        return true
      default:
        return true
    }
  }

  const getVisibleSteps = () => {
    return WIZARD_STEPS as unknown as typeof WIZARD_STEPS[number][]
  }

  const getWizardStepImage = () => {
    if (wizardStep === 1) return '/survery-start.png'
    if (wizardStep === 2) return '/surver-widget.png'
    if (wizardStep === 3) return '/survey-agent.png'
    if (wizardStep === 4) return '/survey-agent.png'
    if (wizardStep === 5) return wizardData.channelType === 'WIDGET' ? '/surver-widget.png' : '/survey-support.png'
    return '/survey.png'
  }

  const getNextStep = () => {
    return wizardStep + 1
  }

  const getPrevStep = () => {
    return wizardStep - 1
  }

  useEffect(() => {
    if (selectedChecklist?.items?.length) {
      const firstVisible =
        (showOnlyPending
          ? selectedChecklist.items.filter((i) => !i.completed)
          : selectedChecklist.items)[0]
      setActiveChecklistItemKey(firstVisible ? firstVisible.key : null)
    } else {
      setActiveChecklistItemKey(null)
    }
  }, [selectedChecklist?.workspaceId, showOnlyPending])

  const handleNextStep = async () => {
    if (!validateCurrentStep()) return
    const next = getNextStep()

    // Step 4 → 5: create workspace first (silently), then advance
    if (next === 5 && !newlyCreatedWorkspaceId) {
      const success = await handleCreateWorkspace()
      if (success) {
        setWizardStep(5)
      }
      return
    }

    if (next <= 6) {
      setWizardStep(next)
    }
  }

  const handlePrevStep = () => {
    // Cannot go back once channel is done (Step 6)
    if (wizardStep >= 6) return
    const prev = getPrevStep()
    if (prev >= 1) {
      setWizardStep(prev)
    }
  }

  const resetWizard = useCallback(() => {
    setWizardStep(1)
    setWizardData({ ...initialWizardData })
    setErrorMessage("")
    setValidationErrors({})
    setNewlyCreatedWorkspaceId(null)
  }, [])

  const closeWizardDialog = () => {
    setWizardOpen(false)
    resetWizard()
  }

  useEffect(() => {
    const dialog = document.getElementById("wizard-dialog") as HTMLDialogElement | null
    if (!dialog) return

    if (wizardOpen) {
      // Preload all wizard step images so navigation is instant
      const WIZARD_IMAGES = [
        '/survery-start.png',
        '/surver-widget.png',
        '/survey-agent.png',
        '/survey-support.png',
        '/survey.png',
      ]
      WIZARD_IMAGES.forEach((src) => { const img = new Image(); img.src = src })

      if (!dialog.open) {
        try {
          dialog.showModal()
        } catch (error) {
          logger.error("Failed to open wizard dialog:", error)
        }
      }
    } else if (dialog.open) {
      dialog.close()
    }

    return () => {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [wizardOpen])

  // Validation helpers
  const validateWhatsAppNumber = (phone: string): boolean => {
    // Must start with + and contain only digits after
    const whatsappRegex = /^\+[1-9]\d{6,14}$/
    return whatsappRegex.test(phone.replace(/\s/g, ''))
  }

  const [isLoading, setIsLoading] = useState(false)
  const [badgeStats, setBadgeStats] = useState<Record<string, WorkspaceBadgeStats>>({})
  
  // Shared billing data state - to avoid duplicate API calls
  const [sharedBillingOverview, setSharedBillingOverview] = useState<any>(null)
  
  // State to open Change Plan dialog from header badge
  const [openChangePlanDialog, setOpenChangePlanDialog] = useState(false)

  // 👤 User profile state for header menu
  const [userName, setUserName] = useState<string>("")
  const [userInitials, setUserInitials] = useState<string>("U")
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  // Load user profile from localStorage
  useEffect(() => {
    const userData = storage.getUser<any>()
    if (userData) {
        const firstName = userData?.firstName || ""
        const lastName = userData?.lastName || ""
        const fullName = `${firstName} ${lastName}`.trim()
        
        setUserName(fullName || "User")
        setProfilePicture(userData?.profilePicture || null)
        setImageError(false) // Reset image error when loading profile
        
        // Create initials for avatar
        const initials =
          firstName && lastName
            ? `${firstName[0]}${lastName[0]}`.toUpperCase()
            : firstName
            ? firstName[0].toUpperCase()
            : "U"
        setUserInitials(initials)
        
        // Also set userEmail if not already set from token
        if (!userEmail && userData?.email) {
          setUserEmail(userData.email)
        }
      }
  }, [])
  
  // Get first workspace ID for role check (all workspaces share the same owner)
const firstWorkspace = workspaces.length > 0 ? workspaces[0] : null
const firstWorkspaceId = firstWorkspace?.id ?? null
const { isSuperAdmin, isLoading: isRoleLoading, role } = useWorkspaceRole(firstWorkspaceId)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    
    // Handle PayPal callback
    const paypalParam = params.get("paypal")
    if (paypalParam) {
      if (paypalParam === "connected") {
        toast.success("PayPal connected successfully.")
      } else if (paypalParam === "missing_config") {
        toast.error("PayPal is not configured. Add sandbox/live credentials first.")
      } else {
        toast.error("PayPal connection failed. Please try again.")
      }
      params.delete("paypal")
    }
    
    // Handle upgrade dialog open
    const upgradeParam = params.get("upgrade")
    if (upgradeParam === "true") {
      setOpenChangePlanDialog(true)
      params.delete("upgrade")
    }
    
    // Clean up URL
    const nextQuery = params.toString()
    const nextUrl = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname
    window.history.replaceState({}, "", nextUrl)
  }, [])

  const loadPayPalStatus = useCallback(async () => {
    if (isRoleLoading || !hasLoadedWorkspaces) {
      return
    }

    try {
      setPaypalLoading(true)
      const data = await getPayPalStatus()
      setPaypalStatus(data)
    } catch (error) {
      logger.error("Failed to load PayPal status:", error)
      // Fail-safe: treat as disconnected so UI can warn
      setPaypalStatus({ paypalStatus: "DISCONNECTED", isPaymentConnected: false })
    } finally {
      setPaypalLoading(false)
    }
  }, [hasLoadedWorkspaces, isRoleLoading])

  const loadPayPalConfig = useCallback(async () => {
    if (isRoleLoading || !hasLoadedWorkspaces) return

    try {
      const data = await getPayPalConfig()
      setPaypalConfig(data)
    } catch (error) {
      logger.error("Failed to load PayPal config:", error)
      setPaypalConfig(null)
    }
  }, [hasLoadedWorkspaces, isRoleLoading])

  useEffect(() => {
    loadPayPalStatus()
    loadPayPalConfig()
  }, [loadPayPalStatus, loadPayPalConfig])

  const handlePayPalConnect = async () => {
    if (paypalConfig && !paypalConfig.configured) {
      toast.error("PayPal is not configured. Add sandbox/live credentials first.")
      return
    }
    // Apri modal invece di redirect diretto
    setPaypalConnectModalOpen(true)
  }

  const confirmPayPalConnect = async () => {
    try {
      setPaypalConnecting(true)
      setPaypalConnectModalOpen(false)
      const url = await getPayPalConnectUrl()
      
      // Apri PayPal in una nuova finestra popup
      const popup = window.open(
        url,
        'PayPal Connection',
        'width=600,height=800,left=100,top=100,resizable=yes,scrollbars=yes'
      )
      
      // Monitora quando la popup si chiude
      const checkPopupClosed = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkPopupClosed)
          // Quando la popup si chiude, refresh della pagina
          logger.info("PayPal popup closed, refreshing page...")
          window.location.reload()
        }
      }, 500)
      
      // Fallback: se la popup non si apre (popup blocker)
      if (!popup || popup.closed) {
        toast.error("Popup blocked! Please allow popups for this site.")
        setPaypalConnecting(false)
      }
    } catch (error) {
      logger.error("Failed to start PayPal connect:", error)
      toast.error("Unable to start PayPal connection.")
      setPaypalConnecting(false)
    }
  }

  const handlePayPalDisconnect = async () => {
    setPaypalDisconnectModalOpen(true)
  }

  const confirmPayPalDisconnect = async () => {
    if (disconnectConfirmText !== "DISCONNECT") {
      toast.error("Please type DISCONNECT to confirm")
      return
    }

    try {
      setPaypalDisconnecting(true)
      await disconnectPayPal()
      toast.success("PayPal disconnected.")
      setPaypalDisconnectModalOpen(false)
      setDisconnectConfirmText("")
      await loadPayPalStatus()
      await loadPayPalConfig()
    } catch (error) {
      logger.error("Failed to disconnect PayPal:", error)
      toast.error("Unable to disconnect PayPal.")
    } finally {
      setPaypalDisconnecting(false)
    }
  }

  const planTypeRaw = sharedBillingOverview?.billing?.planType || firstWorkspace?.planType
  const hasPlanInfo = Boolean(planTypeRaw)
  const currentPlanType = normalizePlanType(planTypeRaw)
  const isPaymentConnected =
    paypalStatus?.isPaymentConnected ??
    (paypalStatus?.paypalStatus === "CONNECTED")
  const isPayPalStatusReady = !paypalLoading && paypalStatus !== null
  // ⚠️ Limiti SEMPRE dal database (sharedBillingOverview) - NO fallback hardcoded
  const currentChannelLimit = sharedBillingOverview?.limits?.maxChannels ?? 0
  const currentChannelUsage =
    sharedBillingOverview?.usage?.channelsCount ?? workspaces.length
  const channelLimitReached = currentChannelLimit > 0 && currentChannelUsage >= currentChannelLimit
  // Require PayPal only for paid plans when we have plan info. Free trial users should NOT see the PayPal warning.
  const requiresPaymentForChannels = hasPlanInfo && currentPlanType !== "FREE_TRIAL"
  // Avoid flicker: show warning only after PayPal status is ready
  const showPayPalWarning = requiresPaymentForChannels && isPayPalStatusReady && !isPaymentConnected

  const openWizardDialog = useCallback(() => {
    if (requiresPaymentForChannels && !isPayPalStatusReady) {
      toast.error("PayPal status is still loading. Please try again.")
      return
    }

    if (requiresPaymentForChannels && !isPaymentConnected) {
      if (paypalConfig?.configured === false) {
        toast.error("PayPal is not configured. Add sandbox/live credentials first.")
      } else {
        toast.error("Connect PayPal to create a channel.")
        setPaypalConnectModalOpen(true)
      }
      return
    }

    // Se limite canali raggiunto: mostra toast e apri dialog Change Plan
    if (channelLimitReached) {
      const planLabel = PLAN_LABELS[currentPlanType]
      const message = `Your ${planLabel} plan allows ${currentChannelLimit} channel${currentChannelLimit > 1 ? "s" : ""}. You already have ${currentChannelUsage}. Upgrade your plan to add more.`
      toast.error(message)
      setOpenChangePlanDialog(true)
      return
    }

    // Altrimenti apri wizard normalmente
    if (!wizardOpen) {
      resetWizard()
      setWizardOpen(true)
    }
  }, [
    requiresPaymentForChannels,
    channelLimitReached,
    currentChannelLimit,
    currentChannelUsage,
    currentPlanType,
    resetWizard,
    wizardOpen,
    isPayPalStatusReady,
    isPaymentConnected,
    paypalConfig?.configured,
  ])

  // 🧹 Clear workspace on mount
  useEffect(() => {
    storage.clearWorkspace()
  }, [])

  // Carica i workspace all'avvio
  useEffect(() => {
    loadWorkspaces()
  }, [])

  // 🎯 Check if we need to open Change Plan dialog (from Settings page)
  useEffect(() => {
    const shouldOpenDialog = localStorage.getItem("openChangePlanDialog")
    if (shouldOpenDialog === "true") {
      setOpenChangePlanDialog(true)
      localStorage.removeItem("openChangePlanDialog")
    }
  }, [])

  // 🔄 Reload workspaces when user returns to page (refresh channelStatus changes)
  // NOTE: Only visibilitychange is used — "focus" was removed because both
  //       fire at the same time when switching tabs, causing double reloads.
  //       A debounce guard (RELOAD_DEBOUNCE_MS) prevents rapid successive calls.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && hasLoadedWorkspaces) {
        const now = Date.now()
        if (now - lastLoadTimestampRef.current < RELOAD_DEBOUNCE_MS) {
          logger.info("🔄 [WorkspaceSelectionPage] Skipping reload - debounced")
          return
        }
        logger.info("🔄 [WorkspaceSelectionPage] Page visible again - reloading workspaces")
        loadWorkspaces()
      }
    }

    // 🔄 Listen for workspace updates from Settings page (live sync)
    const handleWorkspaceUpdate = (event: CustomEvent) => {
      logger.info("🔄 [WorkspaceSelectionPage] Workspace updated - reloading list", event.detail)
      loadWorkspaces()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("workspace-updated", handleWorkspaceUpdate as EventListener)
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("workspace-updated", handleWorkspaceUpdate as EventListener)
    }
  }, [hasLoadedWorkspaces])

  useEffect(() => {
    if (hasLoadedWorkspaces && workspaces.length === 0 && !hasAutoOpenedWizard) {
      openWizardDialog()
      setHasAutoOpenedWizard(true)
    }
  }, [hasLoadedWorkspaces, hasAutoOpenedWizard, openWizardDialog, workspaces.length])

  const loadWorkspaces = async () => {
    // Guard: prevent concurrent or rapid successive calls
    if (isLoadingRef.current) {
      logger.info("🔄 [WorkspaceSelectionPage] Skipping reload - already loading")
      return
    }
    isLoadingRef.current = true
    lastLoadTimestampRef.current = Date.now()

    try {
      // Verify token exists before making API call
      const token = storage.getToken()

      // Decode token to get user email
      if (token) {
        try {
          const base64Url = token.split('.')[1]
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
          const jsonPayload = decodeURIComponent(atob(base64).split('').map((c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          }).join(''))
          const decoded = JSON.parse(jsonPayload)
          // Set user email from token for workspace creation
          if (decoded.email) {
            setUserEmail(decoded.email)
          }
        } catch (e) {
          logger.error('Failed to decode token:', e)
        }
      }

      if (!token) {
        logger.error(
          "❌ [WorkspaceSelectionPage] CRITICAL: No token found, redirecting to login"
        )
        setErrorMessage("Session expired, please login again")
        navigate('/')
        return
      }

      setIsLoading(true)
      const startTime = Date.now()
      
      // Load workspaces and badge stats in parallel
      const [workspacesData, statsData] = await Promise.all([
        getWorkspaces(),
        workspaceApi.getBadgeStats(),
      ])
      
      // Ensure minimum 500ms loading time for smooth UX
      const elapsed = Date.now() - startTime
      if (elapsed < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsed))
      }
      
      // Set workspaces sorted by createdAt asc (oldest first)
      const sortedWorkspaces = workspacesData.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      
      setWorkspaces(sortedWorkspaces)
      setBadgeStats(statsData)
      void loadChecklists(sortedWorkspaces)
      
      logger.info("📊 Badge stats loaded:", statsData)
      
      // Load billing overview immediately for plan badge (force refresh to get latest data)
      if (sortedWorkspaces.length > 0) {
        try {
          const billingData = await getBillingOverview(sortedWorkspaces[0].id, true) // forceRefresh=true
          setSharedBillingOverview(billingData)
          logger.info("💳 Billing overview loaded:", billingData.billing.planType)
        } catch (billingError) {
          logger.error("Failed to load billing overview:", billingError)
          // Continue without billing data - will fallback to workspace planType
        }
      }
    } catch (error) {
      logger.error(
        "❌ [WorkspaceSelectionPage] Error loading workspaces:",
        error
      )
      setErrorMessage("Failed to load workspaces")
    } finally {
      setIsLoading(false)
      setHasLoadedWorkspaces(true)
      isLoadingRef.current = false
    }
  }

  // Gestisce la selezione di un workspace
  const handleSelectWorkspace = (workspace: Workspace) => {
    // 1. Set localStorage
    storage.setWorkspace(workspace)
    
    // 2. Redirect with workspaceId in URL (SOURCE OF TRUTH)
    window.location.href = `/chat?workspaceId=${workspace.id}`
  }

  const handleOpenSettings = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation()
    storage.setWorkspace(workspace)
    window.location.href = "/settings"
  }

  const loadChecklists = async (workspaceList: Workspace[]) => {
    const pending = workspaceList.filter(
      (workspace) => !checklists[workspace.id] && !checklistLoading[workspace.id]
    )
    if (pending.length === 0) return

    setChecklistLoading((prev) => {
      const next = { ...prev }
      pending.forEach((workspace) => {
        next[workspace.id] = true
      })
      return next
    })

    await Promise.all(
      pending.map(async (workspace) => {
        try {
          const checklist = await workspaceApi.getChecklist(workspace.id)
          setChecklists((prev) => ({ ...prev, [workspace.id]: checklist }))
        } catch (error) {
          logger.error("❌ [WorkspaceSelectionPage] Failed to load checklist:", error)
        } finally {
          setChecklistLoading((prev) => ({ ...prev, [workspace.id]: false }))
        }
      })
    )
  }

  const handleOpenChecklist = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation()
    const existing = checklists[workspace.id]
    if (existing) {
      setSelectedChecklist(existing)
      setSelectedChecklistWorkspaceId(workspace.id)
      setChecklistError(null)
      setChecklistOpen(true)
      return
    }

    setChecklistOpen(true)
    setSelectedChecklist(null)
    setSelectedChecklistWorkspaceId(workspace.id)
    setChecklistError(null)
    setChecklistLoading((prev) => ({ ...prev, [workspace.id]: true }))
    workspaceApi
      .getChecklist(workspace.id)
      .then((checklist) => {
        setChecklists((prev) => ({ ...prev, [workspace.id]: checklist }))
        setSelectedChecklist(checklist)
      })
      .catch((error) => {
        logger.error("❌ [WorkspaceSelectionPage] Failed to load checklist:", error)
        setChecklistError("Checklist not available yet. Try again.")
      })
      .finally(() => {
        setChecklistLoading((prev) => ({ ...prev, [workspace.id]: false }))
      })
  }

  const handleChecklistAction = (item: { action?: { path: string; section?: string; focusKey?: string; action?: string } }) => {
    if (!item.action) return
    const workspace = selectedChecklist
      ? workspaces.find((w) => w.id === selectedChecklist.workspaceId)
      : null
    if (workspace) {
      storage.setWorkspace(workspace)
    }
    if (item.action.section) {
      try {
        localStorage.setItem("settings-last-section", item.action.section)
      } catch (error) {
        // Ignore localStorage errors
      }
    }
    if (item.action.focusKey) {
      try {
        localStorage.setItem("settings-focus-key", item.action.focusKey)
      } catch (error) {
        // Ignore localStorage errors
      }
    }
    if (item.action.action) {
      try {
        localStorage.setItem("settings-action", item.action.action)
      } catch (error) {
        // Ignore localStorage errors
      }
    }
    setChecklistOpen(false)
    navigate(item.action.path)
  }

  // ============================================================================
  // WORKSPACE CREATION (called at Step 4 → 5 transition)
  // ============================================================================

  // Creates workspace and stores ID. Returns true if successful.
  const handleCreateWorkspace = async (): Promise<boolean> => {

    const channelAlias = wizardData.alias.trim()
    const phoneNumber = wizardData.channelType === 'WHATSAPP' ? wizardData.whatsappNumber : ''

    if (!channelAlias.trim()) {
      setErrorMessage("Enter a channel name")
      return false
    }

    if (wizardData.channelType === 'WHATSAPP' && !phoneNumber.trim()) {
      setErrorMessage("Enter a phone number for WhatsApp channel")
      return false
    }

    try {
      setIsLoading(true)
      setErrorMessage("")

      // Widget channels CANNOT sell products (Andrea's rule)
      const finalSellsProducts = wizardData.channelType === 'WIDGET' ? false : wizardData.sellsProductsAndServices

      const allowedLinks = ["echatbot.ai", "paypal.com"]

      const workspaceConfig = {
        name: channelAlias,
        planType: 'FREE_TRIAL',
        channelType: wizardData.channelType,
        whatsappPhoneNumber: phoneNumber || undefined,
        // Provider: only for WhatsApp
        whatsappProvider: wizardData.channelType === 'WHATSAPP' ? wizardData.whatsappProvider : undefined,
        language: "en",
        adminEmail: userEmail,
        allowedExternalLinks: allowedLinks,
        sellsProductsAndServices: finalSellsProducts,
        businessType: wizardData.businessType,
        hasHumanSupport: wizardData.hasHumanSupport,
        humanSupportInstructions: wizardData.hasHumanSupport
          ? (wizardData.humanSupportInstructions || "Hello {{nameUser}}, I'm connecting you with our agent {{agentName}}. They will contact you as soon as possible (phone: {{agentPhone}} / email: {{agentEmail}}). We're disabling the chatbot until you receive a response. Thank you for your patience! 🤝")
          : undefined,
        operatorContactMethod: 'email',
        operatorEmail: userEmail,
        toneOfVoice: wizardData.toneOfVoice,
        botIdentityResponse: wizardData.botIdentityResponse || undefined,
        faqs: wizardData.faqs.filter(faq => faq.answer.trim() !== ''),
      }

      const newWorkspace = await createWorkspace(workspaceConfig)
      setNewlyCreatedWorkspaceId(newWorkspace.id)

      logger.info("✅ Workspace created:", newWorkspace.id, {
        channelType: wizardData.channelType,
        provider: wizardData.whatsappProvider,
        sellsProductsAndServices: finalSellsProducts,
      })

      return true
    } catch (error: any) {
      if (error?.response?.data?.code === "CHANNEL_LIMIT_EXCEEDED") {
        const limitMsg = error.response.data.message ||
          `Channel limit reached (${currentChannelUsage}/${currentChannelLimit}). Upgrade your plan to add more channels.`
        setErrorMessage(limitMsg)
        toast.error(limitMsg)
        closeWizardDialog()
        setOpenChangePlanDialog(true)
      } else if (error?.response?.data?.code === "PAYPAL_NOT_CONNECTED") {
        const msg = error.response.data.message || "Connect PayPal to create a new channel."
        setErrorMessage(msg)
        toast.error(msg)
        closeWizardDialog()
        setPaypalConnectModalOpen(true)
      } else {
        const genericMessage = error?.response?.data?.message || error?.message || "Failed to create channel"
        setErrorMessage(genericMessage)
        toast.error(genericMessage)
      }
      logger.error("❌ Error creating workspace:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleDebugMode = async (
    id: string,
    currentValue: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    setDebugSavingId(id)
    try {
      const updatedWorkspace = await updateWorkspace(id, {
        debugMode: !currentValue,
      })
      const updatedWorkspaces = workspaces.map((w) =>
        w.id === id ? updatedWorkspace : w
      )
      setWorkspaces(updatedWorkspaces)
    } catch (error) {
      logger.error("Error updating debug mode:", error)
      toast.error("Failed to update debug mode")
    } finally {
      setDebugSavingId(null)
    }
  }



  const handleToggleStatus = async (
    id: string,
    currentValue: boolean,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    setActiveSavingId(id)
    try {
      const workspace = workspaces.find((w) => w.id === id)
      if (workspace) {
        const updatedWorkspace = await updateWorkspace(id, {
          id,
          channelStatus: !currentValue,
        })
        const updatedWorkspaces = workspaces.map((w) =>
          w.id === id ? updatedWorkspace : w
        )
        setWorkspaces(updatedWorkspaces)
      }
    } catch (error) {
      setErrorMessage("Failed to toggle workspace status")
      toast.error("Failed to update active status")
    } finally {
      setActiveSavingId(null)
    }
  }

  // 🆕 LOGOUT HANDLER
  const handleLogout = async () => {
    logger.info("🚺 [WorkspaceSelectionPage] Logout requested")
    
    try {
      await api.post("/auth/logout")
    } catch (error) {
      logger.error("Error calling logout API:", error)
    }
    
    // 🛡️ CRITICAL SECURITY: Clear ALL storage on logout to prevent user isolation bugs
    logger.info('🧹 [LOGOUT] Clearing ALL storage (localStorage + sessionStorage)')
    storage.clearAppState()
    logger.info('✅ [LOGOUT] Storage cleared completely')
    
    navigate("/")
  }

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!logoFile || !selectedWorkspaceForLogo) return

    try {
      setUploadingLogo(true)
      const formData = new FormData()
      formData.append('logo', logoFile)

      const response = await api.post(`/workspaces/${selectedWorkspaceForLogo}/logo`, formData)

      logger.info('Logo upload response:', response.data)

      // Reload workspaces to get fresh data
      await loadWorkspaces()

      toast.success('Logo updated successfully!')
      setLogoDialogOpen(false)
      setLogoFile(null)
      setSelectedWorkspaceForLogo(null)
    } catch (error: any) {
      logger.error('Error uploading logo:', error)
      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message
      toast.error(serverMessage || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const openLogoDialog = (workspaceId: string) => {
    setSelectedWorkspaceForLogo(workspaceId)
    setLogoDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - same style as MinimalLayout */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Back button and Logo */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
              </Button>
              
              <div className="h-6 w-px bg-gray-200" />
              
              <span className="text-xl font-bold text-green-600">eChatbot</span>
            </div>

            {/* Right side: Support + Plan Badge + Profile */}
            <div className="flex items-center gap-3">
              {/* Support Tickets Button with Badge */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/support/tickets")}
                      className="relative p-2 text-gray-600 hover:text-gray-900"
                    >
                      <Mail className="h-5 w-5" />
                      {supportUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                          {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {supportUnreadCount > 0
                        ? `${supportUnreadCount} unread message${supportUnreadCount > 1 ? "s" : ""}`
                        : "Support Tickets"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Plan Badge - uses first workspace data or sharedBillingOverview */}
              {(() => {
                // Get plan info from first workspace or from billing overview
                const firstWorkspace = workspaces[0]
                const planType = sharedBillingOverview?.billing?.planType || firstWorkspace?.planType || 'FREE_TRIAL'
                const trialEndsAt = sharedBillingOverview?.billing?.trialEndsAt || firstWorkspace?.trialEndsAt
                const daysRemaining = trialEndsAt 
                  ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : null
                
                // Show badge if we have workspaces
                if (workspaces.length > 0) {
                  return (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => isSuperAdmin && setOpenChangePlanDialog(true)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all ${isSuperAdmin ? 'hover:scale-105 cursor-pointer' : 'cursor-default'} ${
                              planType === 'FREE_TRIAL'
                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                : planType === 'BASIC'
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : planType === 'PREMIUM'
                                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                                : 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            <Crown className="h-3.5 w-3.5" />
                            <span>
                              {planType === 'FREE_TRIAL' 
                                ? `Free Trial ${daysRemaining ?? 0}d` 
                                : planType === 'BASIC'
                                ? 'Basic'
                                : planType === 'PREMIUM'
                                ? 'Premium'
                                : 'Enterprise'}
                            </span>
                          </button>
                        </TooltipTrigger>
                        {isSuperAdmin && (
                          <TooltipContent>
                            <p>Click to change your plan</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )
                }
                return null
              })()}

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full focus:ring-2 focus:ring-green-500 focus:outline-none hover:scale-105 transition-transform p-0"
                  >
                    {profilePicture && !imageError ? (
                      <img 
                        src={profilePicture} 
                        alt="User"
                        referrerPolicy="no-referrer"
                        className="h-full w-full rounded-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="h-full w-full rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium">
                        {userInitials}
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userName || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userEmail || "Welcome to eChatbot"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="p-2 cursor-pointer"
                    onClick={() => navigate("/profile")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="p-2 cursor-pointer"
                    onClick={() => navigate("/billing")}
                  >
                    <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                    <span>Billing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="p-2 cursor-pointer relative"
                    onClick={() => navigate("/support/tickets")}
                  >
                    <Mail className="mr-2 h-4 w-4 text-blue-500" />
                    <span>Support</span>
                    {supportUnreadCount > 0 && (
                      <span className="ml-auto h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                        {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="p-2 cursor-pointer text-red-600 focus:text-red-600"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 pb-24">{/* pb-24 = 6rem per vedere bene il footer */}

        {/* ========== LOADING STATE ========== */}
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="group relative overflow-hidden animate-pulse">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="flex gap-2 mt-4">
                    <div className="h-8 bg-gray-200 rounded flex-1"></div>
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                  </div>
                </CardContent>
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
              </Card>
            ))}
          </div>
        )}

        {/* ========== NO WORKSPACES: Show Welcome + Create Form ========== */}
        {!isLoading && workspaces.length === 0 && (
          <Card className="max-w-6xl mx-auto">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-green-100 rounded-full w-fit mb-4">
                <MessageCircle className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">
                Welcome to eChatbot! 🎉
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Create your first WhatsApp channel to start receiving orders from your customers
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {errorMessage && (
                <div className="p-4 text-red-700 bg-red-100 rounded-md">
                  {errorMessage}
                </div>
              )}

              {/* Value Propositions Grid - 2x4 */}
              <div className="grid gap-2.5 text-left sm:grid-cols-2 lg:grid-cols-4">
                {/* Row 1 */}
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-green-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-green-100 rounded-lg group-hover:scale-110 transition-transform">
                      <Store className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Catalog ready</p>
                    <p className="text-xs text-gray-500">Products & services</p>
                  </div>
                </div>
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-blue-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:scale-110 transition-transform">
                      <Headphones className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Human handoff</p>
                    <p className="text-xs text-gray-500">Operator support</p>
                  </div>
                </div>
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-purple-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-purple-100 rounded-lg group-hover:scale-110 transition-transform">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Sales routing</p>
                    <p className="text-xs text-gray-500">Auto-assign leads</p>
                  </div>
                </div>
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-indigo-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-indigo-100 rounded-lg group-hover:scale-110 transition-transform">
                      <Bot className="h-5 w-5 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">AI tone & FAQs</p>
                    <p className="text-xs text-gray-500">Custom identity</p>
                  </div>
                </div>
                
                {/* Row 2 */}
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-amber-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-amber-100 rounded-lg group-hover:scale-110 transition-transform">
                      <DollarSign className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Pay per use</p>
                    <p className="text-xs text-gray-500">No fixed costs</p>
                  </div>
                </div>
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-teal-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-teal-100 rounded-lg group-hover:scale-110 transition-transform">
                      <Languages className="h-5 w-5 text-teal-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Multilingual</p>
                    <p className="text-xs text-gray-500">IT, EN, ES, PT</p>
                  </div>
                </div>
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-rose-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-rose-100 rounded-lg group-hover:scale-110 transition-transform">
                      <BarChart3 className="h-5 w-5 text-rose-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Real-time analytics</p>
                    <p className="text-xs text-gray-500">Track performance</p>
                  </div>
                </div>
                <div className="group p-3 border border-gray-200 rounded-xl bg-gradient-to-br from-cyan-50 to-white hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="p-2 bg-cyan-100 rounded-lg group-hover:scale-110 transition-transform">
                      <Zap className="h-5 w-5 text-cyan-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">24/7 automated</p>
                    <p className="text-xs text-gray-500">Always online</p>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-3">
                <Button
                  onClick={openWizardDialog}
                  className="bg-green-600 hover:bg-green-700 px-8"
                  size="lg"
                  disabled={
                    requiresPaymentForChannels &&
                    (!isPayPalStatusReady || !isPaymentConnected)
                  }
                  title={
                    requiresPaymentForChannels
                      ? !isPayPalStatusReady
                        ? "Loading PayPal status..."
                        : !isPaymentConnected
                        ? "Connect PayPal to create a channel."
                        : undefined
                      : undefined
                  }
                >
                  Launch Setup Wizard
                </Button>
                <p className="text-sm text-gray-500">
                  We’ll guide you through every step. You can update settings anytime in the channel settings.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== HAS WORKSPACES: Show List ========== */}
        {!isLoading && workspaces.length > 0 && (
          <>
            <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <MessageSquare className="h-5 w-5" fill="currentColor" />
                  Your Channels
                </CardTitle>
                <CardDescription>
                  Select a channel to manage its conversations
                </CardDescription>
              </div>
              {!isRoleLoading && isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-1.5 ${
                    channelLimitReached ||
                    (requiresPaymentForChannels && (!isPayPalStatusReady || !isPaymentConnected))
                      ? 'opacity-50 cursor-not-allowed'
                      : 'text-green-600 border-green-600 hover:bg-green-50'
                  }`}
                  onClick={openWizardDialog}
                  disabled={
                    channelLimitReached ||
                    (requiresPaymentForChannels && (!isPayPalStatusReady || !isPaymentConnected))
                  }
                  title={
                    requiresPaymentForChannels
                      ? !isPayPalStatusReady
                        ? "Loading PayPal status..."
                        : !isPaymentConnected
                        ? "Connect PayPal to create a channel."
                        : channelLimitReached
                        ? "Channel limit reached"
                        : undefined
                      : channelLimitReached
                      ? "Channel limit reached"
                      : undefined
                  }
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Channel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Lista dei workspace esistenti */}
              {workspaces.map((workspace) => {
                const checklist = checklists[workspace.id]
                const isChecklistLoading = checklistLoading[workspace.id]
                const channelActive = workspace.channelStatus ?? true
                const debugModeEnabled = Boolean(workspace.debugMode)
                return (
                  <div
                    key={workspace.id}
                    className={`rounded-xl border overflow-hidden cursor-pointer transition-all flex flex-col min-h-[200px] ${
                      justCreatedId === workspace.id ? "ring-2 ring-green-500" : ""
                    } ${
                      channelActive
                        ? "bg-white border-gray-200 hover:shadow-lg hover:border-gray-300"
                        : "bg-gray-50 border-gray-300 opacity-75"
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelectWorkspace(workspace)
                    }}
                  >
                  {/* 🎨 REDESIGNED: Colored Header Bar */}
                  <div 
                    className={`relative px-4 py-3 flex items-center justify-between ${
                      workspace.sellsProductsAndServices 
                        ? "bg-gradient-to-r from-green-500 to-green-600" 
                        : "bg-gradient-to-r from-slate-500 to-slate-600"
                    }`}
                  >
                    {/* Left: Type Badge + Channel Icon */}
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-semibold flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        {workspace.sellsProductsAndServices ? "E-commerce" : "Info Channel"}
                      </span>
                      
                      {/* WhatsApp/Widget Icon Badge */}
                      {workspace.channelType === 'WHATSAPP' ? (
                        <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1.5" title="WhatsApp Channel">
                          <MessageCircle className="h-3.5 w-3.5 text-white" />
                          <span className="text-xs text-white font-medium">WhatsApp</span>
                        </div>
                      ) : workspace.channelType === 'WIDGET' ? (
                        <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1.5" title="Website Widget">
                          <Monitor className="h-3.5 w-3.5 text-white" />
                          <span className="text-xs text-white font-medium">Widget</span>
                        </div>
                      ) : null}
                    </div>
                    
                    {/* Right: Settings Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenSettings(workspace, e)}
                      className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                      aria-label="Open settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    
                    {/* Disabled Badge */}
                    {!channelActive && (
                      <span className="absolute -bottom-3 left-4 text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                        Disabled
                      </span>
                    )}
                  </div>
                  
                  {/* Content Area */}
                  <div className="p-4 flex flex-col flex-1">
                    {/* Top Content - grows to push bottom row down */}
                    <div className="flex-1 space-y-3">
                      {/* Logo + Name Row */}
                      <div className="flex items-center gap-3">
                      {/* Small Logo */}
                      <div className="relative group flex-shrink-0">
                        {workspace.logoUrl ? (
                          <img
                            src={workspace.logoUrl.startsWith('http') ? workspace.logoUrl : `${IMG_BASE_URL}${workspace.logoUrl}`}
                            alt={workspace.name}
                            className="h-14 w-14 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className={`h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                            channelActive ? "bg-green-500" : "bg-gray-400"
                          }`}>
                            {workspace.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {/* Edit button - appears on hover */}
                        {isSuperAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openLogoDialog(workspace.id)
                            }}
                            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-50"
                          >
                            <Pencil className="h-3 w-3 text-gray-600" />
                          </button>
                        )}
                      </div>
                      
                      {/* Name + WhatsApp */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {workspace.name}
                        </h3>
                        {workspace.whatsappPhoneNumber && workspace.sellsProductsAndServices && (
                          <div className="flex items-center gap-1.5 text-sm text-green-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            <span className="truncate">{workspace.whatsappPhoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 📊 Badge Stats Row - Prominent */}
                    {badgeStats[workspace.id] && (
                      Object.values(badgeStats[workspace.id]).some(v => v > 0) ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <TooltipProvider delayDuration={100}>
                            {/* Pending Orders */}
                            {badgeStats[workspace.id].pendingOrders > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium cursor-help">
                                    <ShoppingCart className="h-3 w-3" />
                                    <span>{badgeStats[workspace.id].pendingOrders}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p>Pending orders</p></TooltipContent>
                              </Tooltip>
                            )}
                            
                            {/* Needs Intervention */}
                            {badgeStats[workspace.id].needsIntervention > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium animate-pulse cursor-help">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>{badgeStats[workspace.id].needsIntervention}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p>Needs human assistance</p></TooltipContent>
                              </Tooltip>
                            )}
                            
                            {/* Blocked Users */}
                            {badgeStats[workspace.id].blockedUsers > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium cursor-help">
                                    <Ban className="h-3 w-3" />
                                    <span>{badgeStats[workspace.id].blockedUsers}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p>Blocked customers</p></TooltipContent>
                              </Tooltip>
                            )}
                            
                            {/* New Customers */}
                            {badgeStats[workspace.id].newCustomers > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium cursor-help">
                                    <UserPlus className="h-3 w-3" />
                                    <span>{badgeStats[workspace.id].newCustomers}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p>New customers (24h)</p></TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>
                      ) : null
                    )}
                    </div>
                    
                    {/* Bottom Row: Checklist + Toggles - ALWAYS at bottom */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                      {/* Checklist - Clickable entire area */}
                      <div
                        onClick={(e) => handleOpenChecklist(workspace, e)}
                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                      >
                        <ListTodo className="h-4 w-4" />
                        <span>
                          {checklist 
                            ? `${checklist.completedCount}/${checklist.totalCount}` 
                            : isChecklistLoading ? "..." : "Checklist"
                          }
                        </span>
                        {checklist && checklist.percent === 100 && (
                          <span className="text-green-500">✓</span>
                        )}
                      </div>
                      
                      {/* Debug + Active Toggles */}
                      {isSuperAdmin && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggleDebugMode(workspace.id, debugModeEnabled, e)}
                            disabled={isRoleLoading || debugSavingId === workspace.id}
                            aria-pressed={debugModeEnabled}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                              debugModeEnabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 bg-gray-100 text-gray-600"
                            } disabled:opacity-50`}
                          >
                            <span>Debug</span>
                            <span
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                debugModeEnabled ? "bg-emerald-500" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                  debugModeEnabled ? "translate-x-4" : "translate-x-1"
                                }`}
                              />
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleToggleStatus(workspace.id, channelActive, e)}
                            disabled={isRoleLoading || activeSavingId === workspace.id}
                            aria-pressed={channelActive}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                              channelActive
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-gray-200 bg-gray-100 text-gray-600"
                            } disabled:opacity-50`}
                          >
                            <Power className="h-3.5 w-3.5" />
                            <span>Active</span>
                            <span
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                channelActive ? "bg-green-500" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                  channelActive ? "translate-x-4" : "translate-x-1"
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {justCreatedId === workspace.id && (
                      <div className="text-center">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          New
                        </span>
                      </div>
                    )}
                  </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
          </>
        )}

        {/* ============================================================================ */}
        {/* WIZARD DIALOG - Multi-step channel creation */}
        {/* ============================================================================ */}
        <dialog
          id="wizard-dialog"
          className="backdrop:bg-black/50 p-0 rounded-2xl shadow-2xl border-0 w-[640px] max-w-[95vw] bg-white"
        >
          <div className="flex max-h-[90vh]">
            {/* CONTENT */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {/* Progress bar + step counter (survey style) */}
              <div className="flex-shrink-0">
                <div className="h-1.5 bg-slate-100">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${((wizardStep) / getVisibleSteps().length) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between items-center px-6 py-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Step {getVisibleSteps().findIndex(s => s.id === wizardStep) + 1} of {getVisibleSteps().length}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {getVisibleSteps().map((s, i) => (
                        <div
                          key={s.id}
                          className={`h-1.5 w-5 rounded-full transition-colors ${
                            i <= getVisibleSteps().findIndex(st => st.id === wizardStep) ? 'bg-green-500' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={closeWizardDialog}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Step Image — fixed header, never scrolls */}
              <div className="flex-shrink-0 overflow-hidden">
                <img
                  key={getWizardStepImage()}
                  src={getWizardStepImage()}
                  alt=""
                  className="w-full h-44 sm:h-52 object-cover"
                  loading="eager"
                />
              </div>

              {/* Error message */}
              {errorMessage && errorMessage !== "Enter an alias" && (
                <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              {/* Step Content — only this scrolls */}
              <div className="flex-1 px-6 pt-5 pb-2 overflow-y-auto">

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* STEP 1 — Your Business (questionnaire-style) */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-4xl">🏢</span>
                        <h2 className="text-xl font-bold text-slate-900">Your Business</h2>
                      </div>
                      <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.15rem' }}>Help us personalise your setup in seconds</p>
                    </div>

                    {/* Business Type — same options as Settings → BusinessConfigSection */}
                    <div>
                      <Label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">What type of business do you have?</Label>
                      <div className="space-y-3 mt-3">
                        {[
                          { value: 'retail',      label: 'Retail & E-commerce', emoji: '🛒', desc: 'Online or physical store' },
                          { value: 'restaurant',  label: 'Restaurant & Food',   emoji: '🍽️', desc: 'Food services' },
                          { value: 'healthcare',  label: 'Healthcare',          emoji: '🏥', desc: 'Medical services' },
                          { value: 'education',   label: 'Education',           emoji: '🎓', desc: 'Schools, courses' },
                          { value: 'finance',     label: 'Finance & Banking',   emoji: '🏦', desc: 'Financial services' },
                          { value: 'realestate',  label: 'Real Estate',         emoji: '🏠', desc: 'Real estate services' },
                          { value: 'technology',  label: 'Technology & IT',     emoji: '💻', desc: 'Tech services' },
                          { value: 'other',       label: 'Other',               emoji: '📋', desc: 'Other business type' },
                        ].map((item) => (
                          <button
                            type="button"
                            key={item.value}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                              wizardData.businessType === item.value
                                ? 'border-green-500 bg-green-50 text-green-800'
                                : 'border-slate-200 hover:border-green-300 text-slate-700'
                            }`}
                            onClick={() => {
                              updateWizardData('businessType', item.value as WizardFormData['businessType'])
                              // Auto-set sellsProductsAndServices based on business type
                              const sellsTypes = ['retail', 'restaurant']
                              updateWizardData('sellsProductsAndServices', sellsTypes.includes(item.value))
                            }}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              wizardData.businessType === item.value ? 'bg-green-500 border-green-500' : 'border-slate-300'
                            }`}>
                              {wizardData.businessType === item.value && <span className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                            <span className="text-xl">{item.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm">{item.label}</span>
                              <p className="text-xs text-slate-500">{item.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* STEP 2 — Channel Setup */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-4xl">📡</span>
                        <h2 className="text-xl font-bold text-slate-900">Channel Setup</h2>
                      </div>
                      <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.15rem' }}>Choose your channel type and enter basic details</p>
                    </div>

                    {/* Channel Type Selection */}
                    <div className="space-y-3">
                      <button
                        type="button"
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                          wizardData.channelType === 'WHATSAPP'
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-slate-200 hover:border-green-300 text-slate-700'
                        }`}
                        onClick={() => {
                          updateWizardData('channelType', 'WHATSAPP')
                          if (wizardData.channelType !== 'WHATSAPP') {
                            const sellsTypes = ['retail', 'restaurant']
                            updateWizardData('sellsProductsAndServices', sellsTypes.includes(wizardData.businessType))
                          }
                        }}
                      >
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          wizardData.channelType === 'WHATSAPP' ? 'bg-green-500 border-green-500' : 'border-slate-300'
                        }`}>
                          {wizardData.channelType === 'WHATSAPP' && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        <span className="text-xl">💬</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">WhatsApp Channel</span>
                          <p className="text-xs text-slate-500">Connect your WhatsApp Business number</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                          wizardData.channelType === 'WIDGET'
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-slate-200 hover:border-green-300 text-slate-700'
                        }`}
                        onClick={() => {
                          updateWizardData('channelType', 'WIDGET')
                          updateWizardData('sellsProductsAndServices', false)
                        }}
                      >
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          wizardData.channelType === 'WIDGET' ? 'bg-green-500 border-green-500' : 'border-slate-300'
                        }`}>
                          {wizardData.channelType === 'WIDGET' && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        <span className="text-xl">🌐</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">Web Widget</span>
                          <p className="text-xs text-slate-500">Embed chat on your website (support only)</p>
                        </div>
                      </button>
                    </div>

                    {/* Widget Info Alert */}
                    {wizardData.channelType === 'WIDGET' && (
                      <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                        <div className="flex gap-2">
                          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-700">
                            Widget channels are for support and information only. E-commerce features require WhatsApp.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Channel Name */}
                    <div>
                      <Label htmlFor="wizard-alias" className="text-sm font-medium">
                        Channel Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="wizard-alias"
                        type="text"
                        placeholder="My Business Name"
                        value={wizardData.alias}
                        onChange={(e) => updateWizardData('alias', e.target.value)}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-gray-500 mt-1">This name will identify your channel</p>
                    </div>

                    {/* WhatsApp Number (ONLY for WhatsApp) */}
                    {wizardData.channelType === 'WHATSAPP' && (
                      <div>
                        <Label htmlFor="wizard-whatsapp" className="text-sm font-medium">
                          WhatsApp Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="wizard-whatsapp"
                          type="text"
                          placeholder="+34612345678"
                          value={wizardData.whatsappNumber}
                          onChange={(e) => {
                            updateWizardData('whatsappNumber', e.target.value)
                            if (e.target.value && !validateWhatsAppNumber(e.target.value)) {
                              setValidationErrors(prev => ({ ...prev, whatsapp: 'Invalid format. Use +1234567890' }))
                            } else {
                              setValidationErrors(prev => ({ ...prev, whatsapp: undefined }))
                            }
                          }}
                          className={`mt-1.5 ${validationErrors.whatsapp ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {validationErrors.whatsapp && (
                          <p className="text-xs text-red-500 mt-1">{validationErrors.whatsapp}</p>
                        )}
                      </div>
                    )}

                    {wizardData.channelType === 'WHATSAPP' && (
                      <div>
                        <Label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Do you sell products?</Label>
                        <div className="space-y-3 mt-3">
                          <button
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                              wizardData.sellsProductsAndServices
                                ? 'border-green-500 bg-green-50 text-green-800'
                                : 'border-slate-200 hover:border-green-300 text-slate-700'
                            }`}
                            onClick={() => updateWizardData('sellsProductsAndServices', true)}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              wizardData.sellsProductsAndServices ? 'bg-green-500 border-green-500' : 'border-slate-300'
                            }`}>
                              {wizardData.sellsProductsAndServices && <span className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                            <span className="text-xl">🛍️</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm">Yes</span>
                              <p className="text-xs text-slate-500">Catalog, cart & orders</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                              !wizardData.sellsProductsAndServices
                                ? 'border-green-500 bg-green-50 text-green-800'
                                : 'border-slate-200 hover:border-green-300 text-slate-700'
                            }`}
                            onClick={() => updateWizardData('sellsProductsAndServices', false)}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              !wizardData.sellsProductsAndServices ? 'bg-green-500 border-green-500' : 'border-slate-300'
                            }`}>
                              {!wizardData.sellsProductsAndServices && <span className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                            <span className="text-xl">💬</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm">No</span>
                              <p className="text-xs text-slate-500">Support only</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* STEP 4 — Bot Personality */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* ── Step 3: Human Support ───────────────────────────── */}
                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-4xl">🙋</span>
                        <h2 className="text-xl font-bold text-slate-900">Human Support</h2>
                      </div>
                      <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.15rem' }}>
                        Allow customers to request a human agent when the bot can't help
                      </p>
                    </div>

                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => setWizardData(d => ({ ...d, hasHumanSupport: !d.hasHumanSupport }))}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${
                        wizardData.hasHumanSupport
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${wizardData.hasHumanSupport ? 'bg-green-500' : 'bg-slate-300'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${wizardData.hasHumanSupport ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                      </div>
                      <div>
                        <p className={`font-semibold ${wizardData.hasHumanSupport ? 'text-green-800' : 'text-slate-700'}`}>
                          {wizardData.hasHumanSupport ? 'Human support enabled' : 'Bot only (no human escalation)'}
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {wizardData.hasHumanSupport
                            ? 'Customers can ask to speak with a human agent'
                            : 'The bot handles all conversations automatically'}
                        </p>
                      </div>
                    </button>

                    {/* Escalation message (shown only when enabled) */}
                    {wizardData.hasHumanSupport && (
                      <div>
                        <Label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                          Escalation Message
                        </Label>
                        <p className="text-sm text-slate-500 mb-2">
                          Message sent to the customer when they request a human agent. You can use{' '}
                          <code className="bg-slate-100 px-1 rounded text-xs">{'{{nameUser}}'}</code>,{' '}
                          <code className="bg-slate-100 px-1 rounded text-xs">{'{{agentName}}'}</code>
                        </p>
                        <Textarea
                          value={wizardData.humanSupportInstructions}
                          onChange={e => setWizardData(d => ({ ...d, humanSupportInstructions: e.target.value }))}
                          placeholder="Hello {{nameUser}}, I'm connecting you with our agent. They will contact you shortly."
                          rows={4}
                          className="w-full text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}

                {wizardStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-4xl">🤖</span>
                        <h2 className="text-xl font-bold text-slate-900">Bot Personality</h2>
                      </div>
                      <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.15rem' }}>Define how your bot communicates and introduces itself</p>
                    </div>

                    {/* Tone of Voice — survey radio style */}
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Tone of Voice</p>
                      <div className="space-y-3">
                        {[
                          { value: 'friendly', label: 'Friendly', emoji: '😊', desc: 'Warm & approachable' },
                          { value: 'professional', label: 'Professional', emoji: '💼', desc: 'Business-like & clear' },
                          { value: 'formal', label: 'Formal', emoji: '🎩', desc: 'Traditional & courteous' },
                          { value: 'casual', label: 'Casual', emoji: '✌️', desc: 'Relaxed & fun' },
                        ].map((tone) => (
                          <button
                            key={tone.value}
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                              wizardData.toneOfVoice === tone.value
                                ? 'border-green-500 bg-green-50 text-green-800'
                                : 'border-slate-200 hover:border-green-300 text-slate-700'
                            }`}
                            onClick={() => updateWizardData('toneOfVoice', tone.value as WizardFormData['toneOfVoice'])}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              wizardData.toneOfVoice === tone.value ? 'bg-green-500 border-green-500' : 'border-slate-300'
                            }`}>
                              {wizardData.toneOfVoice === tone.value && <span className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                            <span className="text-xl">{tone.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm">{tone.label}</span>
                              <p className="text-xs text-slate-500">{tone.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tone preview */}
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">💬 Example response</p>
                      <p className="text-sm text-gray-800 italic leading-relaxed">
                        {wizardData.toneOfVoice === 'friendly' && '"Hey there! 👋 Great to hear from you! How can I help you today?"'}
                        {wizardData.toneOfVoice === 'professional' && '"Good day. Thank you for contacting us. How may I assist you?"'}
                        {wizardData.toneOfVoice === 'formal' && '"Good afternoon. It is my pleasure to assist you. How may I be of service?"'}
                        {wizardData.toneOfVoice === 'casual' && '"Hey! What\'s up? Need any help finding something cool?"'}
                      </p>
                    </div>

                    {/* Bot Identity */}
                    <div>
                      <Label htmlFor="wizard-identity" className="text-sm font-medium">
                        Bot Identity <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-xs text-gray-500 mt-0.5 mb-1.5">When a customer asks "Who are you?", how should the bot respond?</p>
                      <Textarea
                        id="wizard-identity"
                        placeholder={`E.g., "I'm Sofia, the virtual assistant for ${wizardData.alias || 'your business'}. I can help you browse products, answer questions, and place orders."`}
                        value={wizardData.botIdentityResponse}
                        onChange={(e) => updateWizardData('botIdentityResponse', e.target.value)}
                        className="min-h-[100px]"
                        rows={4}
                      />
                    </div>

                    {/* Quick templates */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">Quick templates:</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                          onClick={() => updateWizardData('botIdentityResponse', `I'm Sofia, the AI assistant for ${wizardData.alias || 'our store'}. I can help you discover our products, answer your questions, check order status, and assist with purchases. How can I help you today?`)}
                        >
                          🛒 E-commerce assistant
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                          onClick={() => updateWizardData('botIdentityResponse', `Hi! I'm the virtual assistant for ${wizardData.alias || 'our company'}. I'm here to help answer your questions and provide information about our services. Feel free to ask me anything!`)}
                        >
                          💬 Support assistant
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                          onClick={() => updateWizardData('botIdentityResponse', `Hello! I'm your personal shopping assistant at ${wizardData.alias || 'our store'}. I know everything about our Italian gourmet products and I'm happy to help you find exactly what you're looking for. What would you like to explore today?`)}
                        >
                          🇮🇹 Gourmet specialist
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* STEP 5 — Connect (QR / Embed code / Credentials) */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {wizardStep === 5 && (
                  <div className="space-y-6">
                    {/* WasenderAPI — QR scan */}
                    {wizardData.channelType === 'WHATSAPP' && wizardData.whatsappProvider === 'wasender' && (
                      <>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-4xl">📱</span>
                            <h2 className="text-xl font-bold text-slate-900">Connect WhatsApp via WasenderAPI</h2>
                          </div>
                          <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.15rem' }}>
                            Scan the QR with your phone to link your WhatsApp number
                          </p>
                        </div>
                        {newlyCreatedWorkspaceId ? (
                          <WasenderOnboarding
                            workspaceId={newlyCreatedWorkspaceId}
                            initialPhoneNumber={wizardData.whatsappNumber}
                            onComplete={() => setWizardStep(6)}
                          />
                        ) : (
                          <div className="flex items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                            <p className="text-sm text-gray-500">Preparing connection…</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Meta / UltraMsg — credentials note */}
                    {wizardData.channelType === 'WHATSAPP' && wizardData.whatsappProvider !== 'wasender' && (
                      <>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-4xl">🔧</span>
                            <h2 className="text-xl font-bold text-slate-900">
                              {wizardData.whatsappProvider === 'meta' ? 'Meta Business API' : 'UltraMsg'} Setup
                            </h2>
                          </div>
                          <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.15rem' }}>Your channel has been created. Configure credentials in Settings.</p>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-blue-800">Next step: add your credentials</p>
                              <p className="text-sm text-blue-700 mt-1">
                                {wizardData.whatsappProvider === 'meta'
                                  ? 'Go to Settings → WhatsApp → Meta Business API and enter your Phone Number ID and Access Token.'
                                  : 'Go to Settings → WhatsApp → UltraMsg and enter your Instance ID and Token.'
                                }
                              </p>
                              <p className="text-xs text-blue-500 mt-2">You can complete this after closing the wizard.</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Widget — embed code */}
                    {wizardData.channelType === 'WIDGET' && (
                      <>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-4xl">🌐</span>
                            <h2 className="text-xl font-bold text-slate-900">Your Widget is Ready!</h2>
                          </div>
                          <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.15rem' }}>Copy the embed code and add it to your website.</p>
                        </div>
                        <div className="p-4 bg-gray-900 rounded-xl">
                          <p className="text-xs text-gray-400 mb-2 font-mono">Paste before &lt;/body&gt;</p>
                          <code className="text-xs text-green-400 font-mono break-all">
                            {`<script src="https://cdn.echatbot.ai/widget.js" data-workspace="${newlyCreatedWorkspaceId || 'YOUR_WORKSPACE_ID'}"></script>`}
                          </code>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 w-full"
                          onClick={() => {
                            navigator.clipboard.writeText(`<script src="https://cdn.echatbot.ai/widget.js" data-workspace="${newlyCreatedWorkspaceId || ''}"></script>`)
                            toast.success('Embed code copied!')
                          }}
                        >
                          <Code2 className="w-4 h-4" />
                          Copy Embed Code
                        </Button>
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700">
                            Full widget configuration (color, language, position) available in <strong>Settings → Widget</strong>.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* STEP 6 — Done! */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {wizardStep === 6 && (
                  <div className="space-y-6">
                    <div className="text-center py-2">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <PartyPopper className="w-8 h-8 text-green-600" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900">Your channel is ready!</h2>
                      <p className="text-slate-500 mt-2" style={{ fontSize: '1.15rem' }}>
                        <strong>{wizardData.alias}</strong> has been created and connected.
                      </p>
                    </div>

                    {/* Next Steps */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recommended next steps</p>
                      <div className="space-y-2">
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
                          onClick={() => {
                            closeWizardDialog()
                            window.location.reload()
                          }}
                        >
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">Configure your AI chatbot</p>
                            <p className="text-xs text-gray-500">Set its personality, rules and knowledge base</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </button>

                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
                          onClick={() => {
                            closeWizardDialog()
                            window.location.reload()
                          }}
                        >
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <HelpCircle className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">Add your first FAQs</p>
                            <p className="text-xs text-gray-500">Teach the bot your most common questions</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </button>

                        {wizardData.sellsProductsAndServices && (
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
                            onClick={() => {
                              closeWizardDialog()
                              window.location.reload()
                            }}
                          >
                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Store className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">Upload your product catalog</p>
                              <p className="text-xs text-gray-500">Add products so the bot can recommend and sell</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        )}

                        {wizardData.channelType === 'WHATSAPP' && (
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
                            onClick={() => {
                              closeWizardDialog()
                              window.location.reload()
                            }}
                          >
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Megaphone className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">Create your first campaign</p>
                              <p className="text-xs text-gray-500">Send broadcast messages to your customers</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer with navigation (survey style) */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white">
                <div className="flex gap-3">
                  {/* Back: visible for steps 2-5 (no back once done) */}
                  {wizardStep > 1 && wizardStep < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevStep}
                      className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Back
                    </Button>
                  )}

                  {/* Steps 1-4: Next / Connect Channel */}
                  {wizardStep >= 1 && wizardStep <= 4 && (
                    <Button
                      onClick={handleNextStep}
                      disabled={!validateCurrentStep() || isLoading}
                      className="flex-[2] bg-green-600 hover:bg-green-700 text-white px-8"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Creating channel…
                        </>
                      ) : wizardStep === 4 ? (
                        'Connect Channel'
                      ) : (
                        'Next'
                      )}
                    </Button>
                  )}

                  {/* Step 5 Widget/Meta/UltraMsg: Continue to success screen */}
                  {wizardStep === 5 && (
                    wizardData.channelType !== 'WHATSAPP' || wizardData.whatsappProvider !== 'wasender'
                  ) && (
                    <Button
                      onClick={() => setWizardStep(6)}
                      className="flex-[2] bg-green-600 hover:bg-green-700 text-white px-8"
                    >
                      Continue
                    </Button>
                  )}


                  {/* Step 6: Go to Dashboard */}
                  {wizardStep === 6 && (
                    <Button
                      onClick={() => {
                        closeWizardDialog()
                        window.location.reload()
                      }}
                      className="flex-[2] bg-green-600 hover:bg-green-700 text-white px-8"
                    >
                      Go to Dashboard
                    </Button>
                  )}
                </div>

              </div>
            </div>
          </div>
        </dialog>

        {/* Subscription & Billing + Usage Limits Row - ONLY for Owner (SUPER_ADMIN) */}
        {firstWorkspaceId && !isRoleLoading && isSuperAdmin && (
          <div id="billing-section" className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Main - Subscription & Billing */}
            <BillingSection 
              workspaceId={firstWorkspaceId} 
              onBillingOverviewLoaded={setSharedBillingOverview}
              openUpgradeDialog={openChangePlanDialog}
              onUpgradeDialogClose={() => setOpenChangePlanDialog(false)}
            />
            
            {/* Side - Usage Limits (uses shared data from BillingSection) */}
            <UsageLimitsCard 
              workspaceId={firstWorkspaceId} 
              billingOverview={sharedBillingOverview}
              isLoading={!sharedBillingOverview}
            />
          </div>
        )}

        {/* Team Members Section */}
        {firstWorkspaceId && !isRoleLoading && (
          <div className="space-y-3">
            <TeamMembersTable
              workspaceId={firstWorkspaceId}
              isSuperAdmin={isSuperAdmin}
              paypalConnected={
                paypalStatus?.isPaymentConnected ??
                (paypalStatus?.paypalStatus === "CONNECTED")
              }
            />
          </div>
        )}

        {/* PayPal Warning - ABOVE PayPal box (Andrea's request) */}
        {isSuperAdmin && showPayPalWarning && (
          <div className="mt-6 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-400">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-red-800 dark:text-red-200">
                PayPal Connection Required
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                You must connect PayPal to add new channels or invite team members.
              </p>
            </div>
          </div>
        )}

        {/* PayPal Integration (Owner only) */}
        {isSuperAdmin && (
          <Card className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 hover:shadow-lg transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <img src="/paypal.png" alt="PayPal" className="w-9 h-auto object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">PayPal Account</CardTitle>
                      {paypalStatus?.paypalStatus === "CONNECTED" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-blue-700">
                      {paypalStatus?.paypalStatus === "CONNECTED" 
                        ? "Your PayPal account is connected and ready to receive monthly payouts."
                        : "Connect your PayPal account to receive monthly payouts."}
                    </CardDescription>
                  </div>
                </div>
                {paypalStatus?.paypalStatus === "CONNECTED" ? (
                  <Button
                    variant="outline"
                    onClick={handlePayPalDisconnect}
                    disabled={paypalDisconnecting}
                  >
                    {paypalDisconnecting ? "Disconnecting..." : "Disconnect"}
                  </Button>
                ) : (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handlePayPalConnect}
                    disabled={paypalConnecting || paypalConfig?.configured === false}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {paypalConnecting ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </CardHeader>
            {(paypalLoading || paypalStatus?.paypalStatus === "CONNECTED" || paypalConfig?.configured === false) && (
              <CardContent className="pt-2">
                {paypalLoading ? (
                  <p className="text-sm text-gray-500">Loading PayPal status...</p>
                ) : paypalConfig?.configured === false ? (
                  <div className="rounded-lg bg-yellow-50 px-3 py-2 text-yellow-800">
                    PayPal is not configured. Add sandbox/live credentials to enable Connect.
                  </div>
                ) : null}
              </CardContent>
            )}
          </Card>
        )}

        {/* Support Ticket Card (Owner only) */}
        {isSuperAdmin && (
          <Card className="mt-6 bg-gradient-to-br from-purple-50 to-white border-purple-100 cursor-pointer hover:shadow-lg transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Need Help?</CardTitle>
                    <CardDescription className="text-purple-700">
                      Contact our support team for assistance
                    </CardDescription>
                  </div>
                </div>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => navigate("/support/tickets")}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Support 
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* Logo Upload Dialog */}
      {logoDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-w-[95vw] relative">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Update Channel Logo</h3>
                <button
                  onClick={() => {
                    setLogoDialogOpen(false)
                    setLogoFile(null)
                    setSelectedWorkspaceForLogo(null)
                  }}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ImageCropUpload
                onImageSelected={setLogoFile}
                currentImageUrl={workspaces.find(w => w.id === selectedWorkspaceForLogo)?.logoUrl}
                label="Channel Logo"
                circularCrop={true}
                size="xl"
                placeholder="logo"
              />

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLogoDialogOpen(false)
                    setLogoFile(null)
                    setSelectedWorkspaceForLogo(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLogoUpload}
                  disabled={!logoFile || uploadingLogo}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {uploadingLogo ? 'Uploading...' : 'Save Logo'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PayPal Connect Modal */}
      {paypalConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-w-[95vw] relative">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Connect PayPal Account</h3>
                <button
                  onClick={() => setPaypalConnectModalOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-2">You will be redirected to PayPal</p>
                      <p>Click OK to connect your PayPal account. You'll be redirected to PayPal's secure login page.</p>
                      <p className="mt-2">After connecting, you'll be returned to this page automatically.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPaypalConnectModalOpen(false)}
                  disabled={paypalConnecting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmPayPalConnect}
                  disabled={paypalConnecting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {paypalConnecting ? 'Connecting...' : 'OK - Proceed to PayPal'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PayPal Disconnect Modal */}
      {paypalDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-w-[95vw] relative">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Disconnect PayPal Account</h3>
                <button
                  onClick={() => {
                    setPaypalDisconnectModalOpen(false)
                    setDisconnectConfirmText("")
                  }}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-900">
                      <p className="font-semibold mb-2">⚠️ Important Warning</p>
                      <p className="mb-2">
                        Disconnecting your PayPal account will <strong>permanently stop</strong> automatic monthly payments.
                      </p>
                      <p className="font-semibold text-red-700">
                        The service will NOT reactivate automatically after a failed payment. 
                        You will need to manually reconnect PayPal to resume billing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disconnect-confirm" className="text-sm font-medium">
                    Type <span className="font-mono font-bold text-red-600">DISCONNECT</span> to confirm
                  </Label>
                  <Input
                    id="disconnect-confirm"
                    value={disconnectConfirmText}
                    onChange={(e) => setDisconnectConfirmText(e.target.value)}
                    placeholder="Type DISCONNECT"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaypalDisconnectModalOpen(false)
                    setDisconnectConfirmText("")
                  }}
                  disabled={paypalDisconnecting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmPayPalDisconnect}
                  disabled={paypalDisconnecting || disconnectConfirmText !== "DISCONNECT"}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {paypalDisconnecting ? 'Disconnecting...' : 'Disconnect PayPal'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-w-4xl w-[96vw] max-h-[90vh] p-0 overflow-hidden">
          <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 px-4 sm:px-6 py-3 sm:py-4">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-emerald-600" />
                Channel Setup Checklist
              </DialogTitle>
              <DialogDescription className="text-sm">
                {selectedChecklist
                  ? `${selectedChecklist.completedCount}/${selectedChecklist.totalCount} completed • ${selectedChecklist.percent}%`
                  : "Loading checklist..."}
              </DialogDescription>
            </DialogHeader>
            {selectedChecklist && (
              <div className="mt-3 space-y-2">
                <Progress value={selectedChecklist.percent} className="h-2" />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    {selectedChecklist.sellsProductsAndServices ? "E-commerce channel" : "Info channel"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{selectedChecklist.channelType}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                      Done {selectedChecklist.completedCount}/{selectedChecklist.totalCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                      Pending {selectedChecklist.totalCount - selectedChecklist.completedCount}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={showOnlyPending ? "secondary" : "outline"}
                      className="h-7 px-3 text-xs"
                      onClick={() => setShowOnlyPending((v) => !v)}
                    >
                      {showOnlyPending ? "Show all" : "Show pending"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="px-4 sm:px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)] lg:max-h-[calc(90vh-130px)]">
              {selectedChecklist ? (
                <div className="space-y-2">
                  {(showOnlyPending
                    ? selectedChecklist.items.filter((i) => !i.completed)
                    : selectedChecklist.items
                  ).map((item) => {
                    const isActive = item.key === activeChecklistItem?.key
                    return (
                      <div
                        key={item.key}
                        onMouseEnter={() => setActiveChecklistItemKey(item.key)}
                        onFocus={() => setActiveChecklistItemKey(item.key)}
                        onClick={() => item.action && handleChecklistAction(item)}
                        className={`group flex items-center gap-3 rounded-xl border px-3 py-2 transition-all ${
                          isActive
                            ? "border-emerald-200 bg-emerald-50/60 shadow-sm"
                            : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                        } ${item.action ? "cursor-pointer" : ""}`}
                      >
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 flex-shrink-0 ${
                            item.completed
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {item.completed && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            item.completed 
                              ? "text-gray-500 line-through" 
                              : "text-gray-900"
                          }`}>
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.completed ? "Completed" : "Not completed yet"}
                          </p>
                        </div>
                        {item.action && (
                          <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : checklistError ? (
                <div className="space-y-3 text-sm text-gray-600">
                  <p>{checklistError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const workspace = workspaces.find((w) => w.id === selectedChecklistWorkspaceId)
                      if (workspace) {
                        handleOpenChecklist(workspace, { stopPropagation: () => {} } as any)
                      }
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading checklist...</div>
              )}
            </div>

            <div className="border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/60 px-4 sm:px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)] lg:max-h-[calc(90vh-130px)] hidden lg:block">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                {activeChecklistItem ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {activeChecklistHelp?.title ?? activeChecklistItem.label}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {activeChecklistItem.completed ? "Status: Completed" : "Status: Incomplete"}
                        </p>
                      </div>
                      <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                        activeChecklistItem.completed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {activeChecklistItem.completed ? "Ready" : "Needs attention"}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">
                      {activeChecklistHelp?.description ?? "Hover an item to see what it means."}
                    </p>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      {activeChecklistHelp?.impact ?? "This item helps ensure your setup works as expected."}
                    </div>
                    {activeChecklistItem.action && (
                      <div className="text-xs text-gray-500">
                        Click the item to open the exact settings page.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Hover an item on the left to see the explanation here.</p>
                    <p>This panel explains why each value matters and how it affects your channel.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile detail panel (stacked) */}
          <div className="border-t border-gray-100 bg-gray-50/60 px-4 sm:px-6 py-4 lg:hidden">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              {activeChecklistItem ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {activeChecklistHelp?.title ?? activeChecklistItem.label}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {activeChecklistItem.completed ? "Status: Completed" : "Status: Incomplete"}
                      </p>
                    </div>
                    <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                      activeChecklistItem.completed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {activeChecklistItem.completed ? "Ready" : "Needs attention"}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">
                    {activeChecklistHelp?.description ?? "Tap an item to see details."}
                  </p>
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    {activeChecklistHelp?.impact ?? "This item helps ensure your setup works as expected."}
                  </div>
                  {activeChecklistItem.action && (
                    <div className="text-xs text-gray-500">
                      Tap the item to open the exact settings page.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Tap an item to see the explanation here.</p>
                  <p>This panel explains why each value matters and how it affects your channel.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Footer - Fixed at bottom */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 bg-white/80 backdrop-blur-sm border-t border-gray-200 text-center text-sm text-gray-500">
        <p>© 2025 eChatbot. All rights reserved.</p>
      </footer>
    </div>
  )
}
