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
import { TeamMembersTable } from "@/components/workspace/TeamMembersTable"
import { BillingSection, PLAN_LIMITS } from "@/components/billing/BillingSection"
import { UsageLimitsCard } from "@/components/billing/UsageLimitsCard"
import type { Workspace } from "@/hooks/use-workspace"
import { useWorkspace } from "@/hooks/use-workspace"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { getBillingOverview, PlanType } from "@/services/subscriptionBillingApi"
import { LogOut, PlusCircle, MessageSquare, ShoppingCart, AlertTriangle, Smartphone, Crown, User, Ban, UserPlus, Clock, CreditCard, ArrowLeft, Check, ChevronRight, ChevronLeft, Store, Users, Headphones, Bot, X, HelpCircle, Trash2, Plus, Mail, Briefcase, ImagePlus, Pencil } from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
  workspaceApi,
} from "../services/workspaceApi"

// ============================================================================
// WIZARD TYPES & CONFIGURATION
// ============================================================================

interface WizardFormData {
  // Step 1: Channel Details
  whatsappNumber: string
  alias: string
  email: string
  website: string
  // Step 2: Business Type (E-commerce)
  sellsProductsAndServices: boolean
  // Step 3: Sales Agents (conditional)
  hasSalesAgents: boolean
  // Step 4: Human Support
  hasHumanSupport: boolean
  humanSupportInstructions: string
  operatorContactMethod: 'email' | 'whatsapp'
  operatorWhatsappNumber: string
  // Step 5: Tone of Voice
  toneOfVoice: 'formal' | 'friendly' | 'professional' | 'casual'
  // Step 6: Bot Identity
  botIdentityResponse: string
  // Step 7: FAQs
  faqs: Array<{ question: string; answer: string }>
}

const WIZARD_STEPS = [
  { id: 1, title: "Channel Details", description: "Basic channel information", icon: Smartphone },
  { id: 2, title: "E-commerce", description: "Sell products/services on WhatsApp?", icon: Store },
  { id: 3, title: "Sales Team", description: "Do you have sales agents?", icon: Users },
  { id: 4, title: "Human Support", description: "Talk to an operator?", icon: Headphones },
  { id: 5, title: "Contact Method", description: "How to reach operator?", icon: Mail },
  { id: 6, title: "Tone of Voice", description: "How should the bot communicate?", icon: MessageSquare },
  { id: 7, title: "Bot Identity", description: "How should the bot introduce itself?", icon: Bot },
  { id: 8, title: "FAQs", description: "Common questions & answers", icon: HelpCircle },
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

const initialWizardData: WizardFormData = {
  whatsappNumber: "",
  alias: "",
  email: "",
  website: "",
  sellsProductsAndServices: true,
  hasSalesAgents: false,
  hasHumanSupport: true,
  humanSupportInstructions: "",
  operatorContactMethod: 'email',
  operatorWhatsappNumber: "",
  toneOfVoice: 'friendly',
  botIdentityResponse: "",
  faqs: [
    { question: "How is my privacy protected?", answer: "" },
    { question: "What are the delivery times?", answer: "" },
    { question: "How can I repeat a previous order?", answer: "" },
    { question: "What payment methods do you accept?", answer: "" },
  ],
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
  
  // ============================================================================
  // WIZARD STATE
  // ============================================================================
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardFormData>(initialWizardData)
  const [wizardOpen, setWizardOpen] = useState(false)
  
  const [userEmail, setUserEmail] = useState("") // Email from token (auto-filled)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [channelLimitError, setChannelLimitError] = useState(false)
  const [channelLimitMessage, setChannelLimitMessage] = useState("")
  const [validationErrors, setValidationErrors] = useState<{
    whatsapp?: string
  }>({})
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [hasLoadedWorkspaces, setHasLoadedWorkspaces] = useState(false)
  const [hasAutoOpenedWizard, setHasAutoOpenedWizard] = useState(false)
  
  // Logo upload state
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)
  const [selectedWorkspaceForLogo, setSelectedWorkspaceForLogo] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // ============================================================================
  // WIZARD HELPERS
  // ============================================================================
  
  const updateWizardData = <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
    setWizardData(prev => ({ ...prev, [field]: value }))
  }

  const validateCurrentStep = (): boolean => {
    switch (wizardStep) {
      case 1: // Channel Details
        return !!(
          wizardData.whatsappNumber.trim() && 
          validateWhatsAppNumber(wizardData.whatsappNumber) &&
          wizardData.alias.trim()
        )
      case 2: // E-commerce - always valid (boolean)
        return true
      case 3: // Sales Agents - always valid (boolean)
        return true
      case 4: // Human Support - always valid (boolean)
        return true
      case 5: // Tone of Voice - always valid (has default)
        return true
      case 6: // Availability - always valid (has default)
        return true
      case 7: // Bot Identity - require some text
        return wizardData.botIdentityResponse.trim().length > 0
      case 8: // Welcome Message - optional but we auto-generate
        return true
      default:
        return true
    }
  }

  const getVisibleSteps = () => {
    // Step 3 (Sales Agents) only visible if sellsProductsAndServices is true
    // Step 5 (Contact Method) only visible if hasHumanSupport is true
    return WIZARD_STEPS.filter(step => {
      if (step.id === 3) return wizardData.sellsProductsAndServices
      if (step.id === 5) return wizardData.hasHumanSupport
      return true
    })
  }

  const getNextStep = () => {
    if (wizardStep === 2 && !wizardData.sellsProductsAndServices) {
      return 4 // Skip step 3 (Sales Agents)
    }
    if (wizardStep === 4 && !wizardData.hasHumanSupport) {
      return 6 // Skip step 5 (Contact Method)
    }
    return wizardStep + 1
  }

  const getPrevStep = () => {
    if (wizardStep === 4 && !wizardData.sellsProductsAndServices) {
      return 2 // Skip back over step 3
    }
    if (wizardStep === 6 && !wizardData.hasHumanSupport) {
      return 4 // Skip back over step 5
    }
    return wizardStep - 1
  }

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      const next = getNextStep()
      if (next <= 8) {
        setWizardStep(next)
      }
    }
  }

  const handlePrevStep = () => {
    const prev = getPrevStep()
    if (prev >= 1) {
      setWizardStep(prev)
    }
  }

  const resetWizard = useCallback(() => {
    setWizardStep(1)
    setWizardData({
      ...initialWizardData,
      email: userEmail, // Pre-fill with logged user email
    })
    setErrorMessage("")
    setChannelLimitError(false)
    setValidationErrors({})
  }, [userEmail])

  const closeWizardDialog = () => {
    setWizardOpen(false)
    resetWizard()
  }

  useEffect(() => {
    const dialog = document.getElementById("wizard-dialog") as HTMLDialogElement | null
    if (!dialog) return

    if (wizardOpen) {
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

  // 🔍 DEBUG: Log role info
  useEffect(() => {
    logger.info('🔍 [WorkspaceSelectionPage] Role check:', {
      firstWorkspaceId,
      isSuperAdmin,
      isRoleLoading,
      role,
      workspacesCount: workspaces.length
    })
  }, [firstWorkspaceId, isSuperAdmin, isRoleLoading, role, workspaces.length])

  const currentPlanType = normalizePlanType(
    sharedBillingOverview?.billing?.planType || firstWorkspace?.planType
  )
  const currentChannelLimit =
    sharedBillingOverview?.limits?.maxChannels ?? PLAN_LIMITS[currentPlanType].maxChannels
  const currentChannelUsage =
    sharedBillingOverview?.usage?.channelsCount ?? workspaces.length
  const channelLimitReached = currentChannelUsage >= currentChannelLimit
  const wizardBlocked = channelLimitError || channelLimitReached

  useEffect(() => {
    if (channelLimitReached) {
      const defaultMessage = `Your ${PLAN_LABELS[currentPlanType]} plan allows ${currentChannelLimit} channel${currentChannelLimit > 1 ? "s" : ""}. You already have ${currentChannelUsage}.`
      setChannelLimitError(true)
      setChannelLimitMessage((prev) => prev || defaultMessage)
    } else if (channelLimitError) {
      setChannelLimitError(false)
      setChannelLimitMessage("")
    }
  }, [
    channelLimitReached,
    channelLimitError,
    currentChannelLimit,
    currentChannelUsage,
    currentPlanType,
  ])

  const openWizardDialog = useCallback(() => {
    if (!wizardOpen) {
      resetWizard()
    }

    if (channelLimitReached) {
      const planLabel = PLAN_LABELS[currentPlanType]
      const message = `Your ${planLabel} plan allows ${currentChannelLimit} channel${currentChannelLimit > 1 ? "s" : ""}. You already have ${currentChannelUsage}.`
      setChannelLimitError(true)
      setChannelLimitMessage(message)
      toast.error(message)
    } else {
      setChannelLimitError(false)
      setChannelLimitMessage("")
    }

    if (!wizardOpen) {
      setWizardOpen(true)
    }
  }, [
    channelLimitReached,
    currentChannelLimit,
    currentChannelUsage,
    currentPlanType,
    resetWizard,
    wizardOpen,
  ])

  // 🧹 Clear workspace on mount
  useEffect(() => {
    storage.clearWorkspace()
  }, [])

  // Carica i workspace all'avvio
  useEffect(() => {
    loadWorkspaces()
  }, [])

  useEffect(() => {
    if (hasLoadedWorkspaces && workspaces.length === 0 && !hasAutoOpenedWizard) {
      openWizardDialog()
      setHasAutoOpenedWizard(true)
    }
  }, [hasLoadedWorkspaces, hasAutoOpenedWizard, openWizardDialog, workspaces.length])

  const loadWorkspaces = async () => {
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
        navigate('/auth/login')
        return
      }

      setIsLoading(true)
      logger.info("🔍 [WorkspaceSelectionPage] Calling getWorkspaces()")
      
      // Load workspaces and badge stats in parallel
      const [workspacesData, statsData] = await Promise.all([
        getWorkspaces(),
        workspaceApi.getBadgeStats(),
      ])
      
      // Set workspaces sorted by createdAt asc (oldest first)
      const sortedWorkspaces = workspacesData.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      
      setWorkspaces(sortedWorkspaces)
      setBadgeStats(statsData)
      
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
    }
  }

  // Gestisce la selezione di un workspace
  const handleSelectWorkspace = (workspace: Workspace) => {
    // 1. Set localStorage
    storage.setWorkspace(workspace)
    
    // 2. Redirect with workspaceId in URL (SOURCE OF TRUTH)
    window.location.href = `/chat?workspaceId=${workspace.id}`
  }

  // Gestisce la creazione di un nuovo workspace (from wizard)
  const handleCreateWorkspace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // Use wizard data
    const phoneNumber = wizardData.whatsappNumber
    const channelAlias = wizardData.alias
    const channelWelcomeMessage = wizardData.welcomeMessage

    if (!phoneNumber.trim()) {
      setErrorMessage("Enter a phone number")
      return
    }

    if (!channelAlias.trim()) {
      setErrorMessage("Enter an alias")
      return
    }

    try {
      setIsLoading(true)
      setChannelLimitError(false)
      
      // 🆕 Build workspace data with ALL wizard configuration (Feature 199)
      // Website URL is automatically added to allowedExternalLinks with echatbot.ai and paypal.com
      const allowedLinks = ["echatbot.ai", "paypal.com"]
      if (wizardData.website) {
        try {
          const url = new URL(wizardData.website)
          allowedLinks.unshift(url.hostname) // Add website domain at the beginning
        } catch {
          // Invalid URL, skip adding to allowedLinks
        }
      }
      
      const workspaceConfig = {
        name: channelAlias || phoneNumber,
        whatsappPhoneNumber: phoneNumber,
        language: "en",
        welcomeMessage: channelWelcomeMessage || undefined,
        adminEmail: wizardData.email || userEmail,
        url: wizardData.website || undefined,
        allowedExternalLinks: allowedLinks,
        // 🆕 Channel Configuration (Feature 199)
        sellsProductsAndServices: wizardData.sellsProductsAndServices,
        hasSalesAgents: wizardData.hasSalesAgents,
        hasHumanSupport: wizardData.hasHumanSupport,
        humanSupportInstructions: wizardData.humanSupportInstructions || undefined,
        operatorContactMethod: wizardData.operatorContactMethod,
        operatorWhatsappNumber: wizardData.operatorWhatsappNumber || undefined,
        toneOfVoice: wizardData.toneOfVoice,
        botIdentityResponse: wizardData.botIdentityResponse || undefined,
        // FAQs will be created by the backend from initialFAQs, 
        // but we can pass custom FAQs if user edited them
        faqs: wizardData.faqs.filter(faq => faq.answer.trim() !== ''),
      }
      
      const newWorkspace = await createWorkspace(workspaceConfig)

      logger.info("✅ Workspace created successfully:", newWorkspace.id)
      logger.info("📋 Wizard configuration:", {
        sellsProductsAndServices: wizardData.sellsProductsAndServices,
        hasSalesAgents: wizardData.hasSalesAgents,
        hasHumanSupport: wizardData.hasHumanSupport,
        toneOfVoice: wizardData.toneOfVoice,
      })
      
      toast.success("Channel created successfully!")
      closeWizardDialog()

      // 🔄 REFRESH PAGE - Reload workspace-selection to show new workspace with all agents
      logger.info("🔄 Reloading workspace-selection page...")
      window.location.reload()
    } catch (error: any) {
      // Check if it's a channel limit error
      if (error?.response?.data?.code === "CHANNEL_LIMIT_EXCEEDED") {
        setChannelLimitError(true)
        const limitMsg =
          error.response.data.message ||
          `You've reached your channel limit (${currentChannelUsage}/${currentChannelLimit}). Upgrade to add more channels.`
        setChannelLimitMessage(limitMsg)
        setErrorMessage(limitMsg)
      } else {
        setErrorMessage("Failed to create channel")
      }
      logger.error("❌ Error creating workspace:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async (id: string) => {
    try {
      setIsLoading(true)
      const workspace = workspaces.find((w) => w.id === id)
      if (workspace) {
        const updatedWorkspace = await updateWorkspace(id, {
          id,
          isActive: !workspace.isActive,
        })
        const updatedWorkspaces = workspaces.map((w) =>
          w.id === id ? updatedWorkspace : w
        )
        setWorkspaces(updatedWorkspaces)
      }
    } catch (error) {
      setErrorMessage("Failed to toggle workspace status")
    } finally {
      setIsLoading(false)
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
    storage.clearAll()
    logger.info('✅ [LOGOUT] Storage cleared completely')
    
    navigate("/auth/login")
  }

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!logoFile || !selectedWorkspaceForLogo) return

    try {
      setUploadingLogo(true)
      const formData = new FormData()
      formData.append('logo', logoFile)

      const response = await api.post(`/workspaces/${selectedWorkspaceForLogo}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      logger.info('Logo upload response:', response.data)

      // Reload workspaces to get fresh data
      await loadWorkspaces()

      toast.success('Logo updated successfully!')
      setLogoDialogOpen(false)
      setLogoFile(null)
      setSelectedWorkspaceForLogo(null)
    } catch (error) {
      logger.error('Error uploading logo:', error)
      toast.error('Failed to upload logo')
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
                onClick={() => navigate("/auth/login")}
                className="gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
              </Button>
              
              <div className="h-6 w-px bg-gray-200" />
              
              <span className="text-xl font-bold text-green-600">eChatbot</span>
            </div>

            {/* Right side: Plan Badge + Profile */}
            <div className="flex items-center gap-3">
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
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* ========== LOADING STATE ========== */}
        {isLoading && (
          <Card className="max-w-xl mx-auto">
            <CardContent className="py-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading your channels...</p>
            </CardContent>
          </Card>
        )}

        {/* ========== NO WORKSPACES: Show Welcome + Create Form ========== */}
        {!isLoading && workspaces.length === 0 && (
          <Card className="max-w-xl mx-auto">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-green-100 rounded-full w-fit mb-4">
                <Smartphone className="h-10 w-10 text-green-600" />
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

              <div className="grid gap-4 text-left sm:grid-cols-2">
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Catalog ready</p>
                      <p className="text-sm text-gray-500">Import your Italian products and services.</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Headphones className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Human handoff</p>
                      <p className="text-sm text-gray-500">Let customers reach your operators with one tap.</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Sales routing</p>
                      <p className="text-sm text-gray-500">Assign leads to your agents automatically.</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900">AI tone & FAQs</p>
                      <p className="text-sm text-gray-500">Configure tone of voice, identity, and FAQs.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-3">
                <Button
                  onClick={openWizardDialog}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
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
                  className="gap-1.5 text-green-600 border-green-600 hover:bg-green-50"
                  onClick={openWizardDialog}
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
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={`rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                    justCreatedId === workspace.id ? "ring-2 ring-green-500" : ""
                  } ${
                    workspace.isActive
                      ? "bg-white border-green-200 hover:shadow-lg hover:border-green-400"
                      : "bg-gray-50 border-gray-300 opacity-75"
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelectWorkspace(workspace)
                  }}
                >
                  {/* Logo Header Area */}
                  <div 
                    className={`relative h-40 flex items-center justify-center ${
                      workspace.isActive ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gray-100"
                    }`}
                  >
                    <div className="relative group">
                      {workspace.logoUrl ? (
                        <img
                          src={workspace.logoUrl.startsWith('http') ? workspace.logoUrl : `${IMG_BASE_URL}${workspace.logoUrl}`}
                          alt={workspace.name}
                          className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-xl"
                        />
                      ) : (
                        <div className={`h-32 w-32 rounded-full flex items-center justify-center text-white font-bold text-5xl shadow-xl ${
                          workspace.isActive ? "bg-green-500" : "bg-gray-400"
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
                          className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-white border-2 border-gray-200 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-50 hover:border-green-300"
                        >
                          <Pencil className="h-4 w-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                    {/* Type Badge - Top Right */}
                    <div className="absolute top-2 right-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${
                        workspace.sellsProductsAndServices 
                          ? "text-green-700 bg-white/90 border border-green-200" 
                          : "text-gray-600 bg-white/90 border border-gray-200"
                      }`}>
                        <Store className="h-3 w-3" />
                        {workspace.sellsProductsAndServices ? "E-commerce" : "Info"}
                      </span>
                    </div>
                    {/* Disabled Badge - Top Left */}
                    {!workspace.channelStatus && (
                      <div className="absolute top-2 left-2">
                        <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                          Disabled
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Area */}
                  <div className="p-4 space-y-3">
                    {/* Channel Name */}
                    <h3 className="text-lg font-semibold text-gray-900 truncate text-center">
                      {workspace.name}
                    </h3>
                    
                    {/* WhatsApp Number */}
                    {workspace.whatsappPhoneNumber && (
                      <div
                        className={`flex items-center justify-center gap-2 text-sm ${
                          workspace.isActive ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <span className="truncate">{workspace.whatsappPhoneNumber}</span>
                      </div>
                    )}
                  
                    {/* 📊 Badge Stats Row */}
                    {badgeStats[workspace.id] && (
                      <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
                        <TooltipProvider delayDuration={100}>
                          {/* Pending Orders Badge */}
                          {badgeStats[workspace.id].pendingOrders > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium cursor-help">
                                  <ShoppingCart className="h-3 w-3" />
                                  <span>{badgeStats[workspace.id].pendingOrders}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Pending orders awaiting processing</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {/* Needs Intervention Badge */}
                          {badgeStats[workspace.id].needsIntervention > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium animate-pulse cursor-help">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>{badgeStats[workspace.id].needsIntervention}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Customers requesting human assistance</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {/* Blocked Users Badge */}
                          {badgeStats[workspace.id].blockedUsers > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium cursor-help">
                                  <Ban className="h-3 w-3" />
                                  <span>{badgeStats[workspace.id].blockedUsers}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Blocked/blacklisted customers</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {/* New Customers Badge (last 24h) */}
                          {badgeStats[workspace.id].newCustomers > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium cursor-help">
                                  <UserPlus className="h-3 w-3" />
                                  <span>{badgeStats[workspace.id].newCustomers}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>New customers in the last 24 hours</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TooltipProvider>
                      </div>
                    )}
                    
                    {justCreatedId === workspace.id && (
                      <div className="text-center">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          New
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {/* ============================================================================ */}
        {/* WIZARD DIALOG - Multi-step channel creation */}
        {/* ============================================================================ */}
        <dialog
          id="wizard-dialog"
          className="backdrop:bg-black/50 p-0 rounded-2xl shadow-2xl border-0 w-[1200px] max-w-[95vw] bg-white"
        >
          <div className="flex h-[750px] max-h-[90vh]">
            {/* LEFT SIDEBAR - Step Indicators */}
            <div className="w-[340px] bg-gray-50 border-r border-gray-200 p-6 flex flex-col rounded-l-2xl">
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900">New Channel</h2>
                <p className="text-gray-500 text-sm mt-1">Setup wizard</p>
              </div>
              
              <div className="flex-1 space-y-1">
                {getVisibleSteps().map((step, index) => {
                  const isActive = wizardStep === step.id
                  const isCompleted = wizardStep > step.id
                  const StepIcon = step.icon
                  const canNavigate = isCompleted || isActive
                  
                  return (
                    <div
                      key={step.id}
                      onClick={() => canNavigate && setWizardStep(step.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                        canNavigate ? 'cursor-pointer hover:bg-gray-100' : ''
                      } ${
                        isActive 
                          ? 'bg-white shadow-sm border border-gray-200 text-gray-900' 
                          : isCompleted 
                            ? 'text-gray-700' 
                            : 'text-gray-400'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted 
                          ? 'bg-green-500 text-white' 
                          : isActive 
                            ? 'bg-green-500 text-white' 
                            : 'bg-gray-200 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-gray-900' : ''}`}>
                          {step.title}
                        </p>
                        <p className={`text-xs truncate ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* WhatsApp branding */}
              <div className="mt-auto pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-green-600 text-xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>WhatsApp Business Channel</span>
                </div>
              </div>
            </div>

            {/* RIGHT CONTENT - Step Forms */}
            <div className="flex-1 flex flex-col relative">
              {/* Close button */}
              <button
                type="button"
                onClick={closeWizardDialog}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Error message for channel limit */}
              {channelLimitError && (
                <div className="m-6 mb-0 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <Crown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Upgrade Required</p>
                    <p className="text-sm text-amber-700 mt-1">
                      {channelLimitMessage || "You've reached your channel limit. Upgrade your plan to add more channels."}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2 bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        closeWizardDialog()
                        setOpenChangePlanDialog(true)
                        document.getElementById("billing-section")?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      Change Plan
                    </Button>
                  </div>
                </div>
              )}

              {/* Step Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {wizardBlocked ? (
                  <div className="max-w-lg mx-auto text-center space-y-4 py-20">
                    <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Crown className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900">Upgrade required</h3>
                    <p className="text-gray-600 text-sm">
                      {channelLimitMessage ||
                        `Your ${PLAN_LABELS[currentPlanType]} plan allows ${currentChannelLimit} channel${
                          currentChannelLimit > 1 ? "s" : ""
                        }. You already have ${currentChannelUsage}. You can't add another channel until you upgrade.`}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => {
                          setOpenChangePlanDialog(true)
                          document.getElementById("billing-section")?.scrollIntoView({ behavior: "smooth" })
                        }}
                      >
                        Change Plan
                      </Button>
                      <Button variant="outline" onClick={closeWizardDialog}>
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                {/* STEP 1: Channel Details */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Channel Details</h3>
                      <p className="text-sm text-gray-500 mt-1">Basic information about your WhatsApp channel</p>
                    </div>
                    
                    <div className="space-y-4">
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

                      <div>
                        <Label htmlFor="wizard-alias" className="text-sm font-medium">
                          Business Name / Alias <span className="text-red-500">*</span>
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

                      <div>
                        <Label htmlFor="wizard-email" className="text-sm font-medium">
                          Admin Email <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="wizard-email"
                          type="email"
                          placeholder="admin@yourbusiness.com"
                          value={wizardData.email || userEmail}
                          onChange={(e) => updateWizardData('email', e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="wizard-website" className="text-sm font-medium">
                          Website URL <span className="text-gray-400">(optional)</span>
                        </Label>
                        <Input
                          id="wizard-website"
                          type="url"
                          placeholder="https://yourbusiness.com"
                          value={wizardData.website}
                          onChange={(e) => updateWizardData('website', e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* additional steps... existing content */}

                {/* STEP 2: E-commerce */}
                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">E-commerce Integration</h3>
                      <p className="text-sm text-gray-500 mt-1">What do you want to sell through WhatsApp?</p>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Sells Products & Services option */}
                      <div 
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          wizardData.sellsProductsAndServices 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('sellsProductsAndServices', true)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${wizardData.sellsProductsAndServices ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Store className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">Yes, I sell products & services</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Enable product/service catalog, shopping cart, and order management
                            </p>
                          </div>
                          {wizardData.sellsProductsAndServices && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>

                      {/* Support only option */}
                      <div 
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          !wizardData.sellsProductsAndServices
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('sellsProductsAndServices', false)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${!wizardData.sellsProductsAndServices ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <MessageSquare className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">No, just customer support</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Use WhatsApp for customer inquiries and support only
                            </p>
                          </div>
                          {!wizardData.sellsProductsAndServices && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: Sales Agents (only if selling products) */}
                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Sales Team</h3>
                      <p className="text-sm text-gray-500 mt-1">Do you have sales agents who handle customer requests?</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div 
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          wizardData.hasSalesAgents 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('hasSalesAgents', true)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${wizardData.hasSalesAgents ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Users className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">Yes, I have sales agents</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Enable agent assignment
                            </p>
                          </div>
                          {wizardData.hasSalesAgents && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>

                      <div 
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          !wizardData.hasSalesAgents 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('hasSalesAgents', false)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${!wizardData.hasSalesAgents ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Bot className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">No, AI handles everything</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              The AI chatbot will manage all sales conversations
                            </p>
                          </div>
                          {!wizardData.hasSalesAgents && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Human Support */}
                {wizardStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Human Support</h3>
                      <p className="text-sm text-gray-500 mt-1">Allow customers to request a human operator?</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div 
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          wizardData.hasHumanSupport 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('hasHumanSupport', true)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${wizardData.hasHumanSupport ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Headphones className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">Yes, enable human handoff</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Customers can request to speak with a human operator when needed
                            </p>
                          </div>
                          {wizardData.hasHumanSupport && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>

                      <div 
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          !wizardData.hasHumanSupport 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('hasHumanSupport', false)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${!wizardData.hasHumanSupport ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Bot className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">No, AI only</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              The AI will handle all conversations without human intervention
                            </p>
                          </div>
                          {!wizardData.hasHumanSupport && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5: Contact Method (only if Human Support enabled) */}
                {wizardStep === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Contact Method</h3>
                      <p className="text-sm text-gray-500 mt-1">How should we contact the operator when a customer requests human support?</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          wizardData.operatorContactMethod === 'email'
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('operatorContactMethod', 'email')}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${wizardData.operatorContactMethod === 'email' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Mail className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">Email</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Send notification to admin email when customer requests human support
                            </p>
                          </div>
                          {wizardData.operatorContactMethod === 'email' && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>

                      {/* WhatsApp option - always visible */}
                      <div
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          wizardData.operatorContactMethod === 'whatsapp'
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateWizardData('operatorContactMethod', 'whatsapp')}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${wizardData.operatorContactMethod === 'whatsapp' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Smartphone className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">WhatsApp</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {wizardData.hasSalesAgents 
                                ? "Forward conversation to the assigned sales agent's WhatsApp"
                                : "Forward conversation to operator's WhatsApp number"
                              }
                            </p>
                          </div>
                          {wizardData.operatorContactMethod === 'whatsapp' && (
                            <Check className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>

                      {/* Info note when sales agents are enabled */}
                      {wizardData.hasSalesAgents && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-700">
                            💡 Requests will be forwarded to the assigned sales agent's contact (email or WhatsApp).
                          </p>
                        </div>
                      )}

                      {/* WhatsApp number input - shown when whatsapp selected AND no sales agents */}
                      {wizardData.operatorContactMethod === 'whatsapp' && !wizardData.hasSalesAgents && (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <Label htmlFor="wizard-operator-whatsapp" className="text-sm font-medium text-gray-700">
                            Operator WhatsApp Number <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="wizard-operator-whatsapp"
                            type="text"
                            placeholder="+34612345678"
                            value={wizardData.operatorWhatsappNumber}
                            onChange={(e) => updateWizardData('operatorWhatsappNumber', e.target.value)}
                            className="mt-1.5"
                          />
                          <p className="text-xs text-gray-500 mt-1">The WhatsApp number where operator requests will be forwarded</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 6: Tone of Voice */}
                {wizardStep === 6 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Tone of Voice</h3>
                      <p className="text-sm text-gray-500 mt-1">How should the chatbot communicate with customers?</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { value: 'friendly', label: 'Friendly', emoji: '😊', desc: 'Warm, approachable, uses emojis' },
                        { value: 'professional', label: 'Professional', emoji: '💼', desc: 'Polite, business-like, clear' },
                        { value: 'formal', label: 'Formal', emoji: '🎩', desc: 'Respectful, traditional, courteous' },
                        { value: 'casual', label: 'Casual', emoji: '✌️', desc: 'Relaxed, conversational, fun' },
                      ].map((tone) => (
                        <div
                          key={tone.value}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            wizardData.toneOfVoice === tone.value
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => updateWizardData('toneOfVoice', tone.value as WizardFormData['toneOfVoice'])}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{tone.emoji}</span>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{tone.label}</h4>
                              <p className="text-xs text-gray-500">{tone.desc}</p>
                            </div>
                            {wizardData.toneOfVoice === tone.value && (
                              <Check className="w-5 h-5 text-green-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-600 mb-2">Example response:</p>
                      <p className="text-sm text-gray-800 italic">
                        {wizardData.toneOfVoice === 'friendly' && '"Hey there! 👋 Great to hear from you! How can I help you today?"'}
                        {wizardData.toneOfVoice === 'professional' && '"Good day. Thank you for contacting us. How may I assist you?"'}
                        {wizardData.toneOfVoice === 'formal' && '"Good afternoon. It is my pleasure to assist you. How may I be of service?"'}
                        {wizardData.toneOfVoice === 'casual' && '"Hey! What\'s up? Need any help finding something cool?"'}
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 7: Bot Identity */}
                {wizardStep === 7 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Bot Identity</h3>
                      <p className="text-sm text-gray-500 mt-1">When a customer asks "Who are you?", how should the bot respond?</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="wizard-identity" className="text-sm font-medium">
                        Bot's self-introduction <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="wizard-identity"
                        placeholder={`E.g., "I'm Sofia, the virtual assistant for ${wizardData.alias || 'your business'}. I can help you browse our products, answer questions, and place orders."`}
                        value={wizardData.botIdentityResponse}
                        onChange={(e) => updateWizardData('botIdentityResponse', e.target.value)}
                        className="mt-1.5 min-h-[150px]"
                        rows={6}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        💡 Tip: Include the bot's name, what it can help with, and your business name
                      </p>
                    </div>

                    {/* Quick suggestions */}
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

                {/* STEP 8: FAQs */}
                {wizardStep === 8 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h3>
                      <p className="text-sm text-gray-500 mt-1">Add common questions and answers for your customers</p>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        💡 <strong>Tip:</strong> You can edit these FAQs anytime after creating your channel in the Settings page.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {wizardData.faqs.map((faq, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <Label className="text-sm font-medium text-gray-700">
                                Question {index + 1}
                              </Label>
                              <Input
                                value={faq.question}
                                onChange={(e) => {
                                  const newFaqs = [...wizardData.faqs]
                                  newFaqs[index] = { ...newFaqs[index], question: e.target.value }
                                  updateWizardData('faqs', newFaqs)
                                }}
                                placeholder="Enter a common question..."
                                className="mt-1"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newFaqs = wizardData.faqs.filter((_, i) => i !== index)
                                updateWizardData('faqs', newFaqs)
                              }}
                              className="mt-6 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove FAQ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-700">
                              Answer
                            </Label>
                            <Textarea
                              value={faq.answer}
                              onChange={(e) => {
                                const newFaqs = [...wizardData.faqs]
                                newFaqs[index] = { ...newFaqs[index], answer: e.target.value }
                                updateWizardData('faqs', newFaqs)
                              }}
                              placeholder="Provide the answer..."
                              className="mt-1 min-h-[60px]"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add FAQ button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        updateWizardData('faqs', [...wizardData.faqs, { question: '', answer: '' }])
                      }}
                      className="w-full gap-2 border-dashed"
                    >
                      <Plus className="w-4 h-4" />
                      Add FAQ
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                      Default FAQs are provided as suggestions. Feel free to modify or remove them.
                    </p>
                  </div>
                )}

                  </>
                )}
              </div>

              {/* Footer with navigation */}
              <div className="p-6 border-t bg-gray-50 flex items-center justify-end">
                {wizardBlocked ? (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeWizardDialog}
                    >
                      Close
                    </Button>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        setOpenChangePlanDialog(true)
                        document.getElementById("billing-section")?.scrollIntoView({ behavior: "smooth" })
                        closeWizardDialog()
                      }}
                    >
                      Change Plan
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {wizardStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrevStep}
                        className="gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                      </Button>
                    )}
                    
                    {wizardStep < 8 ? (
                      <Button
                        onClick={handleNextStep}
                        disabled={!validateCurrentStep()}
                        className="bg-green-600 hover:bg-green-700 gap-2"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleCreateWorkspace}
                        disabled={isLoading || !validateCurrentStep()}
                        className="bg-green-600 hover:bg-green-700 gap-2"
                      >
                        {isLoading ? "Creating..." : "Create Channel"}
                        {!isLoading && <Check className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                )}
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
          <TeamMembersTable
            workspaceId={firstWorkspaceId}
            isSuperAdmin={isSuperAdmin}
          />
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

      {/* Footer */}
      <footer className="mt-16 pb-8 text-center text-sm text-gray-500">
        <p>© 2025 eChatbot. All rights reserved.</p>
      </footer>
    </div>
  )
}
