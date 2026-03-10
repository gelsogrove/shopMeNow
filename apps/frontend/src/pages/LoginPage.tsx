import { SiteFooter } from "@/components/layout/SiteFooter"
import { NewsUpdates } from "@/components/landing/NewsUpdates"
import { PricingPlans } from "@/components/landing/PricingPlans"
import { HomeFAQ } from "@/components/landing/HomeFAQ"
import { WIPModal } from "@/components/shared/WIPModal"
import { SEO } from "@/components/SEO"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useLanguage } from "@/contexts/LanguageContext"
import { useFeatureFlags } from "@/hooks/usePlatformConfig"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { zodResolver } from "@hookform/resolvers/zod"
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import {
  AlertTriangle,
  BarChart3,
  Mail,
  MapPin,
  Phone,
  Bot,
  Megaphone,
  Headphones,
  Loader2,
  Eye,
  EyeOff,
  MessageSquare,
  LogOut,
  User,
  Crown,
  CreditCard,
  ChevronDown,
} from "lucide-react"
import { useEffect, useState, useRef, type FormEvent } from "react"
import { motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import * as z from "zod"
import landingImg from "@/assets/landing.png"
import whatsappIcon from "@/assets/whatsapp.svg"
import { toast } from "../lib/toast"
import { auth, api } from "../services/api"
import { workspaceApi } from "../services/workspaceApi"
import { widgetApi } from "../services/widgetApi"
import { getBillingOverview, PlanLimits, UsageStats, PlanType } from "../services/subscriptionBillingApi"

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '988195920488-caj4sdf4t7elrsdedk36a5n5t1ndki4c.apps.googleusercontent.com'

// 🚨 REMOVED MODULE-LEVEL CLEAR - was too aggressive!
// Storage clear is now done ONLY in specific actions:
// - onSubmit (login form)
// - onRegisterSubmit (register form)
// - handleGoogleSuccess (Google OAuth)
// - Register button click
// This prevents clearing token AFTER it's been saved by Google OAuth

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gdprAccepted: z.boolean(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.gdprAccepted === true, {
  message: "You must accept the terms",
  path: ["gdprAccepted"],
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

const PLAN_PRIORITY: Record<PlanType, number> = {
  FREE_TRIAL: 0,
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
}

const getPlanPriorityValue = (planType?: string | null) => {
  if (!planType) return -1
  const normalized = planType as PlanType
  return PLAN_PRIORITY[normalized] ?? -1
}

export function LoginPage() {
  const { t, language, setLanguage } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isValidatingSession, setIsValidatingSession] = useState(true)
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin')
  
  // 👤 Logged-in user state (for showing avatar instead of login/register buttons)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState<{ 
    firstName?: string; 
    lastName?: string; 
    email?: string;
    profilePicture?: string;
    authProvider?: string;
    isPlatformAdmin?: boolean;
  } | null>(null)
  const [avatarImageError, setAvatarImageError] = useState(false)
  const [userPlan, setUserPlan] = useState<{
    planType?: string | null
    trialEndsAt?: string | null
    creditBalance?: number | null
    limits?: PlanLimits | null
    usage?: UsageStats | null
  } | null>(null)
  
  // 🚀 Platform feature flags (canLogin, canRegister)
  const {
    canLogin,
    canRegister,
    workingInProgress,
    registerFirst,
    cantryDemo,
    isLoading: flagsLoading,
  } = useFeatureFlags()
  const [showWIPModal, setShowWIPModal] = useState(false)
  const [wipFeature, setWipFeature] = useState<'login' | 'register' | 'demo'>('login')
  
  // 🔗 Extract returnUrl from query params (for invitation flow)
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const actionParam = searchParams.get('action') // 🆕 For auto-opening register modal
  const modeParam = searchParams.get('mode') // 🆕 For invite flow: 'register' opens register tab
  const inviteParam = searchParams.get('invite') // 🆕 For invite flow: pre-fill email from invite
  const logoutParam = searchParams.get('logout') // 🆕 For forcing logout from backoffice
  
  // 🔓 Admin bypass: check URL param OR sessionStorage
  const adminParamFromUrl = searchParams.get('admin')
  
  // Handle explicit admin parameter values
  if (adminParamFromUrl === 'true') {
    // Enable bypass and persist in sessionStorage
    if (sessionStorage.getItem('adminBypass') !== 'true') {
      sessionStorage.setItem('adminBypass', 'true')
    }
  } else if (adminParamFromUrl === 'false' || adminParamFromUrl === null) {
    // Explicitly disable bypass and clear sessionStorage
    // (both ?admin=false and no parameter at all should clear it)
    sessionStorage.removeItem('adminBypass')
  }
  
  const isAdminBypass = adminParamFromUrl === 'true'
  
  const isLoginDisabled = flagsLoading || ((!canLogin || workingInProgress) && !isAdminBypass)
  const isRegisterDisabled = flagsLoading || ((!canRegister || workingInProgress) && !isAdminBypass)
  const isDemoDisabled = flagsLoading || !cantryDemo || workingInProgress
  const isLoginViewDisabled = activeTab === "signin" && isLoginDisabled
  const isRegisterViewDisabled = activeTab === "register" && isRegisterDisabled
  
  // Parse invite data if present
  const inviteData = inviteParam ? (() => {
    try {
      return JSON.parse(decodeURIComponent(inviteParam))
    } catch {
      return null
    }
  })() : null
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordRegister, setShowPasswordRegister] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 🆕 Remember Me functionality
  const [rememberMe, setRememberMe] = useState(false)
  const REMEMBER_ME_KEY = "login_email_remembered"

  // Dynamic hero slides based on language
  const getHeroSlides = (lang: string) => {
    const validLang = ["it", "en", "es", "pt"].includes(lang) ? lang : "en"
    return [
      { src: new URL(`../assets/hero/${validLang}/home_1.png`, import.meta.url).href, alt: "WhatsApp AI agent dashboard view 1" },
      { src: new URL(`../assets/hero/${validLang}/home_2.png`, import.meta.url).href, alt: "WhatsApp AI agent dashboard view 2" },
      { src: new URL(`../assets/hero/${validLang}/home_3.png`, import.meta.url).href, alt: "WhatsApp AI agent dashboard view 3" },
      { src: new URL(`../assets/hero/${validLang}/home_4.png`, import.meta.url).href, alt: "WhatsApp AI agent dashboard view 4" },
      { src: new URL(`../assets/hero/${validLang}/home_5.png`, import.meta.url).href, alt: "WhatsApp AI agent dashboard view 5" },
    ]
  }

  const heroSlides = getHeroSlides(language)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStartHero, setTouchStartHero] = useState<number | null>(null)
  const [touchEndHero, setTouchEndHero] = useState<number | null>(null)
  const [isMobileView, setIsMobileView] = useState(false)

  const minSwipeDistance = 50

  const onTouchStartHero = (e: React.TouchEvent) => {
    setTouchEndHero(null)
    setTouchStartHero(e.targetTouches[0].clientX)
  }

  const onTouchMoveHero = (e: React.TouchEvent) => {
    setTouchEndHero(e.targetTouches[0].clientX)
  }

  const onTouchEndHero = () => {
    if (!touchStartHero || !touchEndHero) return
    const distance = touchStartHero - touchEndHero
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe) {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }
    if (isRightSwipe) {
      setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)
    }
  }
  const [contactName, setContactName] = useState("")
  const [contactSurname, setContactSurname] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactTitle, setContactTitle] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactCaptchaToken, setContactCaptchaToken] = useState("")
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactError, setContactError] = useState("")
  const [contactSuccess, setContactSuccess] = useState(false)
  const [contactHoneypot, setContactHoneypot] = useState("")
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""
  
  // Support ticket unread count (only loaded in Chat History)
  const supportUnreadCount = 0
  
  // Ref for contact form name input
  const contactNameInputRef = useRef<HTMLInputElement>(null)
  
  // Refs for login/register form first inputs
  const loginEmailInputRef = useRef<HTMLInputElement>(null)
  const registerEmailInputRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }, 7000)
    return () => clearInterval(interval)
  }, [heroSlides.length])

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsMobileView(false)
      return
    }
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateMatch = () => setIsMobileView(mediaQuery.matches)
    updateMatch()
    mediaQuery.addEventListener("change", updateMatch)
    return () => mediaQuery.removeEventListener("change", updateMatch)
  }, [])

  useEffect(() => {
    if (!recaptchaSiteKey) {
      return
    }

    const existingScript = document.querySelector(
      'script[src="https://www.google.com/recaptcha/api.js"]'
    )

    if (!existingScript) {
      const script = document.createElement("script")
      script.src = "https://www.google.com/recaptcha/api.js"
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    ;(window as any).onRecaptchaSuccess = (token: string) => {
      setContactCaptchaToken(token)
      setContactError("")
    }

    return () => {
      delete (window as any).onRecaptchaSuccess
    }
  }, [recaptchaSiteKey])
  
  const navigate = useNavigate()

  // Prefill credentials only in development
  const isDev = import.meta.env.MODE === "development"

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: isDev ? "admin@echatbot.ai" : "",
      password: isDev ? "Venezia44" : "",
    } as LoginForm,
  })

  // 🆕 Load remembered email on component mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBER_ME_KEY)
    if (rememberedEmail) {
      form.setValue("email", rememberedEmail)
      setRememberMe(true)
      logger.info("📧 [Remember Me] Loaded remembered email:", rememberedEmail)
    }
  }, []) // Empty dependency - run only once on mount

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      gdprAccepted: false,
    },
  })

  // 🔥 CRITICAL FIX: Clear storage ONLY if user intentionally navigates to login
  // Don't clear if there's already a valid token (user might be redirected here by mistake)
  useEffect(() => {
    // 🆕 If logout=true param, force logout regardless of existing token
    if (logoutParam === 'true') {
      logger.info('🚪 [LOGOUT] Force logout requested from backoffice - clearing all storage')
      storage.clearAppState()
      // Remove the logout param from URL to prevent re-logout on refresh
      // But KEEP admin=true if present
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('logout')
      window.history.replaceState({}, '', newUrl.toString())
      setIsLoggedIn(false)
      setLoggedInUser(null)
      setIsValidatingSession(false)
      return
    }
    
    const existingToken = storage.getToken()
    
    // If user already has a token, show avatar instead of login buttons (DON'T redirect)
    if (existingToken) {
      logger.info('👤 [LOGIN PAGE] Token exists - showing user avatar in header')
      // Load user data from localStorage
      const cachedUser = storage.getUser<{ email?: string }>()
      if (cachedUser) {
        try {
          setLoggedInUser(cachedUser)
          setIsLoggedIn(true)
          setAvatarImageError(false) // Reset image error when loading user
          logger.info('✅ [LOGIN PAGE] User loaded:', cachedUser.email)
          
          // Fetch workspaces to get plan info - use first workspace (same as WorkspaceSelectionPage)
          workspaceApi.getAll().then(workspaces => {
            if (workspaces && workspaces.length > 0) {
              let storedWorkspaceId: string | null = null
              const storedWorkspace = storage.getWorkspace<{ id?: string }>()
              storedWorkspaceId = storedWorkspace?.id ?? null

              const selectedWorkspace = workspaces.reduce((best, current) => {
                if (!best) {
                  return current
                }

                const bestPriority = getPlanPriorityValue(best.planType)
                const currentPriority = getPlanPriorityValue(current.planType)

                if (currentPriority > bestPriority) {
                  return current
                }

                if (currentPriority === bestPriority) {
                  if (!best.planType && current.planType) {
                    return current
                  }

                  if (storedWorkspaceId && current.id === storedWorkspaceId) {
                    return current
                  }
                }

                return best
              }, workspaces[0])

              if (!selectedWorkspace) {
                return
              }

              setUserPlan({
                planType: selectedWorkspace.planType,
                trialEndsAt: selectedWorkspace.trialEndsAt,
                creditBalance: null,
                limits: null,
                usage: null,
              })
              logger.info('👑 [LOGIN PAGE] Plan loaded:', selectedWorkspace.planType, 'from workspace:', selectedWorkspace.id)

              getBillingOverview(selectedWorkspace.id)
                .then((overview) => {
                  setUserPlan({
                    planType: overview.billing.planType,
                    trialEndsAt: overview.billing.trialEndsAt,
                    creditBalance: overview.billing.creditBalance,
                    limits: overview.limits,
                    usage: overview.usage,
                  })
                })
                .catch((err) => {
                  logger.error('Failed to fetch billing overview:', err)
                })
            }
          }).catch(err => {
            if (err?.response?.status === 401) {
              logger.warn('🔐 [LOGIN PAGE] Token invalid while fetching workspaces - clearing auth')
              storage.clearAuth()
              setIsLoggedIn(false)
              setLoggedInUser(null)
              setUserPlan(null)
              return
            }
            logger.error('Failed to fetch workspaces for plan:', err)
          })
        } catch (e) {
          logger.error('Failed to parse cached user:', e)
        }
      } else {
        // Token exists but no user data - still logged in
        setIsLoggedIn(true)
      }
      setIsValidatingSession(false)
      return
    }
    
    // No token - safe to clear any stale data
    logger.info('🧹 [LOGIN PAGE LOAD] No token found - clearing stale storage')
    storage.clearWorkspace()
    storage.clearUser()
    storage.clearSessionId()
    logger.info('✅ [LOGIN PAGE LOAD] Storage cleared - ready for fresh login')
    setIsValidatingSession(false)
  }, [navigate, logoutParam]) // Run only once on mount, or when logout param changes

  // 🆕 AUTO-OPEN REGISTER VIEW if ?action=register or ?mode=register parameter is present
  useEffect(() => {
    if (actionParam === 'register' || modeParam === 'register') {
      // 🚫 If registration is disabled, show WIP modal instead
      if (!canRegister && !flagsLoading) {
        logger.info('🚫 [AUTO-OPEN] Registration disabled - showing WIP modal')
        setWipFeature('register')
        setShowWIPModal(true)
        return
      }
      
      logger.info('🎯 [AUTO-OPEN] Detected register mode - switching to register form')
      setActiveTab('register')
      
      // Pre-fill form from invite data if available
      if (inviteParam) {
        try {
          const data = JSON.parse(decodeURIComponent(inviteParam))
          if (data?.email) {
            logger.info('📧 [INVITE] Pre-filling form from invite:', data)
            registerForm.setValue('email', data.email)
            if (data.firstName) {
              registerForm.setValue('firstName', data.firstName)
            }
            if (data.lastName) {
              registerForm.setValue('lastName', data.lastName)
            }
          }
        } catch (e) {
          logger.error('Failed to parse invite data:', e)
        }
      }
    }
  }, [actionParam, modeParam, inviteParam, canRegister, flagsLoading])

  // If login is disabled but registration is allowed, show register form by default
  useEffect(() => {
    if (!canLogin && canRegister && !isAdminBypass) {
      setActiveTab("register")
      return
    }
    if (registerFirst && canRegister) {
      setActiveTab("register")
      return
    }
    setActiveTab("signin")
  }, [canLogin, canRegister, isAdminBypass, registerFirst])

  // 🆕 Session check is now done in the first useEffect above
  // No auto-redirect - we show avatar instead if user is logged in

  const onSubmit = async (data: LoginForm) => {
    // 🚀 Check if login is enabled (bypass if admin access mode)
    if (isLoginDisabled && !isAdminBypass) {
      setWipFeature('login')
      setShowWIPModal(true)
      return
    }
    
    setError("")
    setIsLoading(true)

    // 🛡️ CRITICAL SECURITY: Clear ALL storage to prevent session/workspace leakage
    logger.info("🧹 [LOGIN] Clearing ALL storage (localStorage + sessionStorage)")
    storage.clearAppState()
    logger.info("✅ [LOGIN] Storage cleared completely")

    try {
      // Usa await esplicitamente e salva la risposta
      const response = await auth.login({
        email: data.email!,
        password: data.password!,
      })
      logger.info("Login successful:", response.data)

      // 🆕 Save email if "Remember Me" is checked
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, data.email!)
        logger.info("📧 [Remember Me] Email saved to localStorage")
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY)
        logger.info("📧 [Remember Me] Email cleared from localStorage")
      }

      // 🔒 SECURITY: Check if 2FA is required
      if (response.data && response.data.requires2FA) {
        logger.info("🔐 User requires 2FA verification")

        // Redirect to 2FA verification page (NO session/token yet!)
        navigate("/auth/verify-2fa", {
          state: {
            userId: response.data.userId,
            email: response.data.email,
            provider: 'email',
            returnUrl, // 🔗 Pass returnUrl for invitation flow
          },
        })
        return
      }

      // Normal login (no 2FA) - save token and redirect
      if (response.data && response.data.user) {
        // 🆕 SAVE JWT TOKEN for Authorization header (proxy-safe)
        if (response.data.token) {
          storage.setToken(response.data.token)
          logger.info(`✅ JWT token saved to localStorage`)
        } else {
          logger.warn("⚠️ No JWT token in login response (cookie-only mode)")
        }

        // 🆕 SAVE SESSION ID for x-session-id header
        // Using localStorage to persist across page refreshes
        if (response.data.sessionId) {
          storage.setSessionId(response.data.sessionId)
          logger.info(`✅ SessionId saved to sessionStorage`)
        } else {
          logger.warn("⚠️ No sessionId in login response")
        }

        // Save user data
        storage.setUser(response.data.user)

        // JWT token is automatically saved as HTTP-only cookie by backend
        logger.info("Login successful - JWT token saved as HTTP-only cookie")

        // 🔐 Platform Admin: Stay on homepage, show avatar menu with both options
        // Andrea's requirement: Let admin choose between Workspace and Backoffice
        if (response.data.user.isPlatformAdmin) {
          logger.info("🔐 Platform Admin detected - staying on homepage for manual selection")
          
          // 🔄 Force state update to show avatar menu immediately
          setIsLoggedIn(true)
          setLoggedInUser(response.data.user)
          logger.info('🔄 [EMAIL LOGIN] State updated - user:', { 
            email: response.data.user.email, 
            isPlatformAdmin: response.data.user.isPlatformAdmin,
            isDeveloperUser: response.data.user.isDeveloperUser 
          })
          setIsLoading(false)
          return
        }

        // Redirect to workspace selection
        navigate("/workspace-selection")
      } else {
        throw new Error("Invalid response format from the server.")
      }
    } catch (err: any) {
      logger.error("Login error:", err)

      // Get error code or message from backend
      const errorCode = err.response?.data?.error || err.response?.data?.message
      
      // Map backend error codes to translation keys
      let errorMsg: string
      if (errorCode === "ACCOUNT_INACTIVE") {
        errorMsg = t("auth.error.accountInactive")
      } else if (errorCode === "ACCOUNT_DELETED") {
        errorMsg = t("auth.error.accountDeleted")
      } else {
        // Use backend message directly or fallback
        errorMsg = errorCode || err.message || "Login failed. Please check your credentials."
      }

      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const onRegisterSubmit = async (data: RegisterForm) => {
    // 🚀 Check if registration is enabled
    if (isRegisterDisabled && !isAdminBypass) {
      setWipFeature('register')
      setShowWIPModal(true)
      return
    }
    
    logger.info('📝 [REGISTER] Starting registration', { email: data.email })
    
    setError("")
    setIsLoading(true)

    // 🛡️ CRITICAL SECURITY: Clear ALL storage to prevent session/workspace leakage
    logger.info("🧹 [REGISTER] Clearing storage")
    storage.clearAppState()

    try {
      const response = await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        gdprAccepted: data.gdprAccepted,
      })

      const { user, qrCode } = response.data

      // 🔒 SECURITY: No sessionId or token from registration
      // User MUST verify 2FA first to get authenticated

      // 🆕 Widget Integration: Convert web visitor to customer
      // If visitor came from widget, merge chat history and mark as real customer
      const visitorId = widgetApi.getVisitorId()
      if (visitorId) {
        try {
          logger.info('🔄 [WIDGET] Converting visitor to customer', { visitorId, userId: user.id })
          
          // Convert visitor using the widget's "chatbot.AI" workspace (eChatbot support)
          await widgetApi.convertVisitor({
            workspaceId: 'chatbot.AI',
            visitorId,
            phone: '', // Phone will be added later if needed
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            language: navigator.language || 'en',
          })

          // Clear chat history from localStorage since it's now merged
          widgetApi.clearStoredMessages()
          logger.info('✅ [WIDGET] Visitor converted successfully')
        } catch (err) {
          logger.error('⚠️ [WIDGET] Failed to convert visitor (non-blocking):', err)
          // Don't block registration if conversion fails
        }
      }

      logger.info('✅ [REGISTER] Success, navigating to 2FA setup')
      
      navigate('/auth/setup-2fa', {
        state: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          qrCode,
          provider: 'email',
          returnUrl, // 🔗 Pass returnUrl for invitation flow
        },
      })
    } catch (err: any) {
      logger.error('❌ [REGISTER] Registration failed:', {
        status: err.response?.status,
        message: err.response?.data?.message || err.message,
      })

      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please try again.'

      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    logger.info('🔐 [GOOGLE OAUTH] Starting Google authentication')
    setIsLoading(true)
    
    // 🛡️ CRITICAL SECURITY: Clear ALL storage to prevent session/workspace leakage
    logger.info("🧹 [GOOGLE OAUTH] Clearing storage")
    storage.clearAppState()
    // 🛡️ CRITICAL SECURITY: Clear ALL storage before OAuth flow
    logger.info('🧹 [GOOGLE OAUTH] Clearing ALL storage (localStorage + sessionStorage)')
    storage.clearAppState()
    logger.info('✅ [GOOGLE OAUTH] Storage cleared completely')
    
    try {
      const response = await api.post('/auth/oauth/google', {
        credential: credentialResponse.credential,
      })
      
      const { user, requiresSetup, requires2FA, qrCode, token, sessionId } = response.data
      
      // 🔐 CASE 0: Platform Admin or Developer User - Direct login (skip 2FA)
      if (sessionId && token && !requiresSetup && !requires2FA) {
        logger.info('🔐 [GOOGLE OAUTH] Direct login (2FA skipped for admin/developer)')
        
        // Save token and session
        storage.setToken(token)
        storage.setSessionId(sessionId)
        storage.setUser(user)
        
        // 🔐 Platform Admin: Stay on homepage, show avatar menu with both options
        if (user.isPlatformAdmin) {
          logger.info('🔐 [GOOGLE OAUTH] Platform Admin detected - staying on homepage for manual selection')
          
          // 🔄 Force state update to show avatar menu immediately
          setIsLoggedIn(true)
          setLoggedInUser(user)
          logger.info('🔄 [GOOGLE OAUTH] State updated - user:', { 
            email: user.email, 
            isPlatformAdmin: user.isPlatformAdmin,
            isDeveloperUser: user.isDeveloperUser 
          })
          setIsLoading(false)
          return
        }
        
        // Normal user - go to workspace selection
        navigate('/workspace-selection')
        return
      }
      
      // Only save user info for the 2FA pages to use
      storage.setUser(user)
      
      if (requiresSetup) {
        logger.info('🔄 [GOOGLE OAUTH] Navigating to 2FA setup')
        navigate('/auth/setup-2fa', {
          state: {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            qrCode,
            provider: 'google',
            returnUrl, // 🔗 Pass returnUrl for invitation flow
          },
        })
      } else {
        logger.info('🔄 [GOOGLE OAUTH] Navigating to 2FA verification')
        navigate('/auth/verify-2fa', {
          state: {
            userId: user.id,
            email: user.email,
            provider: 'google',
            returnUrl, // 🔗 Pass returnUrl for invitation flow
          },
        })
      }
    } catch (error: any) {
      logger.error('❌ [GOOGLE OAUTH] Authentication failed:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      })
      toast.error('Google login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleContactSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setContactError("")

    if (!contactName.trim() || contactName.trim().length < 2) {
      setContactError("Please enter your name.")
      return
    }

    if (!contactSurname.trim() || contactSurname.trim().length < 2) {
      setContactError("Please enter your surname.")
      return
    }

    const normalizedEmail = contactEmail.trim()
    if (!normalizedEmail) {
      setContactError("Please enter your email.")
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setContactError("Please enter a valid email address.")
      return
    }

    const normalizedPhone = contactPhone.trim()
    if (normalizedPhone && !/^[+()0-9\s.-]{7,20}$/.test(normalizedPhone)) {
      setContactError("Please enter a valid phone number.")
      return
    }

    if (!contactCaptchaToken) {
      setContactError("Please complete the security check.")
      return
    }

    if (!contactTitle.trim() || contactTitle.trim().length < 3) {
      setContactError("Please enter a title.")
      return
    }

    if (!contactMessage.trim() || contactMessage.trim().length < 10) {
      setContactError("Please enter a longer message.")
      return
    }

    setContactSubmitting(true)
    setContactSuccess(false)

    try {
      await api.post("/contact", {
        name: contactName.trim(),
        surname: contactSurname.trim(),
        email: normalizedEmail,
        title: contactTitle.trim(),
        message: contactMessage.trim(),
        phone: normalizedPhone || undefined,
        captchaToken: contactCaptchaToken,
        website: contactHoneypot,
      })

      setContactSuccess(true)
      setContactName("")
      setContactSurname("")
      setContactEmail("")
      setContactTitle("")
      setContactMessage("")
      setContactPhone("")
      setContactCaptchaToken("")
      setContactHoneypot("")
      ;(window as any).grecaptcha?.reset?.()
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to send message. Please try again."
      setContactError(msg)
    } finally {
      setContactSubmitting(false)
    }
  }
  
  // Function to scroll to contact form and focus on name input
  const scrollToContactForm = (e?: React.MouseEvent) => {
    e?.preventDefault()
    contactNameInputRef.current?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    })
    setTimeout(() => {
      contactNameInputRef.current?.focus()
    }, 600) // Wait for smooth scroll to complete
  }

  const handleGoogleError = () => {
    toast.error('Google login failed. Please try again.')
  }

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = form

  // 🆕 SHOW LOADING SPINNER WHILE VALIDATING EXISTING SESSION
  if (isValidatingSession) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Validating session...</p>
        </div>
      </div>
    )
  }

  const planLabel =
    !userPlan?.planType || userPlan.planType === "FREE_TRIAL"
      ? "Free Trial"
      : userPlan.planType === "BASIC"
      ? "Basic"
      : userPlan.planType === "PREMIUM"
      ? "Premium"
      : userPlan?.planType
      ? userPlan.planType.charAt(0) + userPlan.planType.slice(1).toLowerCase()
      : "Plan"

  const trialDaysRemaining =
    userPlan?.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(userPlan.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        )
      : null

  const formattedCredit =
    userPlan?.creditBalance != null
      ? (() => {
          // Get workspace currency from storage
          const workspace = storage.getWorkspace<{ currency?: string }>()
          const currency = workspace?.currency || "EUR"
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
          }).format(userPlan.creditBalance)
        })()
      : "--"

  const VALID_PLAN_TYPES: PlanType[] = ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]
  const currentPlanForPricing = userPlan?.planType && VALID_PLAN_TYPES.includes(userPlan.planType as PlanType)
    ? (userPlan.planType as PlanType)
    : undefined

  const howItWorksCards = [
    {
      step: "1",
      title: t("howItWorks.step1.title"),
      description: t("howItWorks.step1.desc"),
      gradient: "from-green-50 to-emerald-50",
      border: "border-green-200",
      showArrow: true,
    },
    {
      step: "2",
      title: t("howItWorks.step2.title"),
      description: t("howItWorks.step2.desc"),
      gradient: "from-blue-50 to-cyan-50",
      border: "border-blue-200",
      showArrow: true,
    },
    {
      step: "3",
      title: t("howItWorks.step3.title"),
      description: t("howItWorks.step3.desc"),
      gradient: "from-purple-50 to-pink-50",
      border: "border-purple-200",
      showArrow: false,
    },
  ]

  return (
    <>
      <SEO
        title="Login"
        description="Access eChatbot to sign in, register, or explore the platform with a mobile-friendly experience."
      />
      <div
        className="w-full min-h-screen"
        style={{
          backgroundImage:
            "linear-gradient(to bottom right, rgba(248,250,252,0.95), rgba(226,232,240,0.95)), url('/background.png')",
          backgroundRepeat: "no-repeat, no-repeat",
          backgroundSize: "100% 100%, cover",
          backgroundPosition: "top left, center top",
          backgroundBlendMode: "normal, lighten",
        }}
      >
      {/* Header - Professional Design */}
      <header className="bg-white shadow-sm sticky top-0 z-[100] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 lg:px-12">
          <div className="hidden lg:flex justify-end pt-3">
            <div className="flex items-center gap-4">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 hover:text-slate-600"
              >
                {t("nav.pricing")}
              </a>
              <span className="text-slate-900 text-xs font-semibold">|</span>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 hover:text-slate-600"
              >
                {t("nav.contact")}
              </a>
            </div>
          </div>

          {/* Main Header Row */}
          <div className="flex items-center justify-between py-1 md:py-1.5 max-h-[70px]">
            {/* Left: Logo + Brand */}
            <div className="flex items-center justify-start gap-1">
              <img 
                src="/logo.png" 
                alt="eChatbot Logo" 
                className="hidden md:block w-[110px] h-[110px] mt-[-10px]"
              />
              <span className="py-2 md:py-[15px] px-2 md:px-0 relative md:left-[-25px] md:top-[-7px] text-2xl md:text-2xl lg:text-4xl font-bold text-green-600 tracking-tight leading-none">eChatbot</span>
            </div>

            {/* Right: Language Selector + Auth */}
            <div className="flex items-center justify-end gap-2 md:gap-6">
              {/* Language Selector - Hidden on mobile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="hidden lg:flex items-center gap-2 h-9 px-3 hover:bg-green-50 rounded-lg transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
                  >
                    <span className="text-xl">
                      {language === "it" ? "🇮🇹" : language === "en" ? "🇬🇧" : language === "es" ? "🇪🇸" : "🇵🇹"}
                    </span>
                    <span className="hidden sm:inline text-sm font-medium text-slate-700">
                      {language === "it" ? "IT" : language === "en" ? "EN" : language === "es" ? "ES" : "PT"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48" align="end">
                  <DropdownMenuLabel className="text-xs text-slate-500 uppercase tracking-wider px-2 py-1.5">{t("nav.language")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-3 cursor-pointer py-2.5 px-3"
                    onClick={() => setLanguage("it")}
                  >
                    <span className="text-xl">🇮🇹</span>
                    <span className="font-medium">Italiano</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-3 cursor-pointer py-2.5 px-3"
                    onClick={() => setLanguage("en")}
                  >
                    <span className="text-xl">🇬🇧</span>
                    <span className="font-medium">English</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-3 cursor-pointer py-2.5 px-3"
                    onClick={() => setLanguage("es")}
                  >
                    <span className="text-xl">🇪🇸</span>
                    <span className="font-medium">Español</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-3 cursor-pointer py-2.5 px-3"
                    onClick={() => setLanguage("pt")}
                  >
                    <span className="text-xl">🇵🇹</span>
                    <span className="font-medium">Português</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isLoggedIn ? (
                <div className="flex items-center gap-4">
                  {/* Support Inbox Icon with Badge */}
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate("/support/tickets")}
                          className="relative h-9 w-9 p-0 text-slate-600 hover:text-green-600 hover:bg-green-50"
                        >
                          <Mail className="h-5 w-5" />
                          {supportUnreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                              {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                            </span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {supportUnreadCount > 0
                            ? `${supportUnreadCount} unread message${supportUnreadCount > 1 ? "s" : ""}`
                            : "Support"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {/* Plan Badge */}
                  <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                      !userPlan?.planType || userPlan.planType === 'FREE_TRIAL'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : userPlan.planType === 'BASIC'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : userPlan.planType === 'PREMIUM'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-amber-200'
                    }`}>
                      <Crown className="h-3.5 w-3.5" />
                      <span>
                        {!userPlan?.planType || userPlan.planType === 'FREE_TRIAL'
                          ? `Free Trial ${trialDaysRemaining ?? 0}d`
                          : planLabel}
                      </span>
                    </div>

                  {/* User Avatar Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative h-10 w-10 rounded-full focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none hover:scale-105 transition-transform p-0"
                        aria-label={`${loggedInUser?.firstName || loggedInUser?.email || "User"} menu`}
                        data-testid="user-avatar-button"
                      >
                        {loggedInUser?.profilePicture && !avatarImageError ? (
                          <img 
                            src={loggedInUser.profilePicture} 
                            alt="User"
                            referrerPolicy="no-referrer"
                            className="h-full w-full rounded-full object-cover ring-2 ring-gray-100"
                            onError={() => setAvatarImageError(true)}
                          />
                        ) : (
                          <div className="h-full w-full rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-semibold ring-2 ring-green-100">
                            {loggedInUser?.firstName && loggedInUser?.lastName
                              ? `${loggedInUser.firstName[0]}${loggedInUser.lastName[0]}`.toUpperCase()
                              : loggedInUser?.firstName?.[0]?.toUpperCase() || loggedInUser?.email?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal p-3">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none truncate">
                            {loggedInUser?.firstName && loggedInUser?.lastName 
                              ? `${loggedInUser.firstName} ${loggedInUser.lastName}` 
                              : 'User'}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground truncate">
                            {loggedInUser?.email || t("nav.welcome")}
                          </p>
                          {loggedInUser?.isPlatformAdmin && (
                            <p className="text-xs leading-none text-purple-600 font-semibold pt-1">
                              🔐 Platform Admin
                            </p>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem
                        className="p-2 cursor-pointer"
                        onClick={() => navigate("/workspace-selection")}
                      >
                        <MessageSquare className="mr-2 h-4 w-4 text-green-500" fill="currentColor" />
                        <span>{t("nav.yourChannels")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-2 cursor-pointer"
                        onClick={() => navigate("/profile")}
                      >
                        <User className="mr-2 h-4 w-4 text-blue-500" />
                        <span>{t("nav.profile")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-2 cursor-pointer"
                        onClick={() => navigate("/billing")}
                      >
                        <CreditCard className="mr-2 h-4 w-4 text-emerald-500" />
                        <span>{t("nav.billing")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-2 cursor-pointer"
                        onClick={() => navigate("/support/tickets")}
                      >
                        <div className="relative mr-2">
                          <Mail className="h-4 w-4 text-blue-500" />
                          {supportUnreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                              {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                            </span>
                          )}
                        </div>
                        <span>
                          {supportUnreadCount > 0
                            ? `Support (${supportUnreadCount})`
                            : "Support"}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="p-2 cursor-pointer text-red-600 focus:text-red-600"
                        onClick={() => {
                          storage.clearAppState()
                          setIsLoggedIn(false)
                          setLoggedInUser(null)
                          setUserPlan(null)
                          toast.success(t("nav.logoutSuccess"))
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{t("nav.logout")}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="flex items-center gap-2 md:gap-3">
                  <Button
                    variant="ghost"
                    className="hidden sm:flex text-xs md:text-sm font-medium text-slate-700 hover:text-green-600 hover:bg-green-50 transition-colors px-2 md:px-3"
                    onClick={() => {
                      if (isAdminBypass || !workingInProgress) {
                        setActiveTab('signin')
                        // Scroll to login form and focus first input
                        setTimeout(() => {
                          const loginSection = document.querySelector('[data-form="signin"]')
                          loginSection?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          setTimeout(() => loginEmailInputRef.current?.focus(), 300)
                        }, 100)
                      } else {
                        setWipFeature('login')
                        setShowWIPModal(true)
                      }
                    }}
                  >
                    {t("nav.signin")}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white font-medium text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 rounded-lg shadow-sm transition-all hover:shadow-md"
                    onClick={() => {
                      if (isAdminBypass || !workingInProgress) {
                        setActiveTab('register')
                        // Scroll to register form and focus first input
                        setTimeout(() => {
                          const registerSection = document.querySelector('[data-form="register"]')
                          registerSection?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          setTimeout(() => registerEmailInputRef.current?.focus(), 300)
                        }, 100)
                      } else {
                        setWipFeature('register')
                        setShowWIPModal(true)
                      }
                    }}
                  >
                    {t("nav.getStarted")}
                  </Button>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      <main className="flex-1">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 relative z-20">
        
        <div className="text-center mb-12 space-y-4 relative">
          {/* WhatsApp brand badge */}
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-1">
            <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
            <span className="text-green-700 text-sm font-semibold">WhatsApp AI Platform</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900">
            {t("hero.title")}
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Mobile hero image — shown only on mobile/tablet, desktop has the carousel */}
        <div className="block lg:hidden mb-8 px-2">
          <div className="relative mx-auto max-w-md">
            <div className="absolute inset-0 bg-gradient-to-br from-green-200 to-emerald-100 rounded-3xl rotate-1 scale-105 opacity-80" />
            <img
              src={landingImg}
              alt="eChatbot platform preview"
              className="relative w-full h-auto rounded-3xl shadow-2xl border border-white/50"
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-stretch">
          <div className="hidden lg:flex justify-center lg:justify-start items-center w-full lg:flex-1">
            <div className="relative w-full max-w-3xl lg:mr-2">
              <div className="absolute inset-0 bg-gradient-to-br from-green-200 to-emerald-100 rounded-[32px] transform rotate-2 scale-105" />
            <div className="relative rounded-[32px] shadow-2xl bg-transparent overflow-visible">
                <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50">
                  <div 
                    className="relative w-full"
                    onTouchStart={onTouchStartHero}
                    onTouchMove={onTouchMoveHero}
                    onTouchEnd={onTouchEndHero}
                    style={{ touchAction: "pan-x" }}
                  >
                    {isMobileView
                      ? [-1, 0, 1].map((offset) => {
                          const slideIndex =
                            (currentSlide + offset + heroSlides.length) %
                            heroSlides.length
                          const slide = heroSlides[slideIndex]
                          const isCenter = offset === 0
                          return (
                            <div
                              key={`${slide.src}-${offset}`}
                              className={`flex items-center justify-center ${
                                offset === 0 ? "relative" : "absolute inset-0"
                              }`}
                              style={{
                                transform: `translateX(${offset * 85}%) scale(${
                                  isCenter ? 1 : 0.9
                                })`,
                                opacity: isCenter ? 1 : 0.55,
                                zIndex: isCenter ? 2 : 1,
                                transition: "transform 0.6s ease, opacity 0.6s ease",
                              }}
                            >
                              <div className="w-full overflow-hidden rounded-[22px] aspect-[3/2]">
                                <img
                                  src={slide.src}
                                  alt={slide.alt}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            </div>
                          )
                        })
                      : heroSlides.map((slide, index) => (
                          <div
                            key={slide.src}
                            className={`flex items-center justify-center transition-opacity duration-700 ease-in-out ${
                              index === currentSlide ? "relative" : "absolute inset-0"
                            }`}
                            style={{
                              opacity: index === currentSlide ? 1 : 0,
                              zIndex: index === currentSlide ? 2 : 1,
                            }}
                          >
                            <div className="w-full overflow-hidden rounded-[22px] aspect-[3/2]">
                              <img
                                src={slide.src}
                                alt={slide.alt}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-2 mt-5" aria-hidden="true">
                {heroSlides.map((_, index) => (
                  <span
                    key={`slide-dot-${index}`}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      index === currentSlide ? "w-8 bg-green-600" : "w-2.5 bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            className="relative w-full max-w-sm lg:w-[24rem] bg-white rounded-2xl shadow-xl border border-slate-200 p-8 lg:order-2 min-h-[32rem] flex mx-auto lg:mx-0"
            onClickCapture={() => {
              if (isLoginViewDisabled) {
                setWipFeature("login")
                setShowWIPModal(true)
              }
              if (isRegisterViewDisabled) {
                setWipFeature("register")
                setShowWIPModal(true)
              }
            }}
          >
            {workingInProgress && !isAdminBypass && (
              <div className="absolute -right-6 top-[14px] rotate-12 bg-red-600 py-2 text-[10px] font-bold uppercase tracking-[0.4em] text-white shadow-lg pl-[50px] pr-[45px] z-20">
                {t("wip.banner")}
              </div>
            )}
            
            <div className="space-y-6 flex-1 flex flex-col">
                <div className="text-center space-y-2">
                  <h3 className={`text-2xl font-bold text-slate-900 ${isLoginViewDisabled ? "opacity-60" : ""}`}>
                    {activeTab === "signin" ? t("auth.login") : t("auth.createAccount")}
                  </h3>
                  <p className={`text-slate-600 ${isLoginViewDisabled ? "opacity-60" : ""}`}>
                    {activeTab === "signin"
                      ? t("auth.login.subtitle")
                      : t("auth.register.subtitle")}
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{activeTab === "signin" ? t("auth.error.login") : t("auth.error.registration")}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {activeTab === "signin" ? (
                  <>
                    {isLoggedIn ? (
                      <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-900 space-y-3">
                        <div>
                          <div className="font-semibold text-base">You're signed in</div>
                          <div className="text-green-800">{loggedInUser?.email || "Logged user"}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
                            <p className="font-semibold text-slate-900">{planLabel}</p>
                            {(!userPlan?.planType || userPlan.planType === "FREE_TRIAL") && trialDaysRemaining !== null && (
                              <p className="text-xs text-slate-500">{trialDaysRemaining} days left</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Credit</p>
                            <p className="font-semibold text-slate-900">{formattedCredit}</p>
                          </div>
                        </div>
                        {loggedInUser?.isPlatformAdmin ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => navigate("/workspace-selection")}
                              className="w-full rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              Go to workspace
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const token = storage.getToken()
                                const backofficeUrl =
                                  import.meta.env.VITE_BACKOFFICE_URL ||
                                  (window.location.hostname === "localhost"
                                    ? "http://localhost:3002"
                                    : "https://backoffice.echatbot.ai")
                                const destination = token
                                  ? `${backofficeUrl}/auth/callback?token=${token}`
                                  : `${backofficeUrl}/access-denied`
                                window.open(destination, "_blank", "noopener,noreferrer")
                              }}
                              className="w-full rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              Go to backoffice
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate("/workspace-selection")}
                            className="w-full rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                          >
                            Go to workspace
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={isLoginViewDisabled ? "opacity-60 text-slate-500" : ""} data-form="signin">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                          <div className="space-y-2">
                            <Input
                              id="email-desktop"
                              type="email"
                              placeholder="your@email.com"
                              {...register("email")}
                              disabled={isLoading || isLoginDisabled}
                              autoComplete="username"
                              className="h-11"
                            />
                            {errors.email && (
                              <p className="text-sm text-red-500">{errors.email.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="relative">
                              <Input
                                id="password-desktop"
                                type={showPassword ? "text" : "password"}
                                placeholder="********"
                                {...register("password")}
                                disabled={isLoading || isLoginDisabled}
                                autoComplete="current-password"
                                className="h-11 pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-3 flex items-center text-gray-400"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {errors.password && (
                              <p className="text-sm text-red-500">{errors.password.message}</p>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div
                              className={`flex items-center space-x-2 ${isLoginDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                              aria-disabled={isLoginDisabled}
                            >
                              <Checkbox 
                                id="remember-desktop" 
                                disabled={isLoginDisabled || isLoading}
                                checked={rememberMe}
                                onCheckedChange={(checked) => {
                                  if (!isLoginDisabled && !isLoading) {
                                    setRememberMe(checked as boolean)
                                  } else if (isLoginDisabled) {
                                    setWipFeature("login")
                                    setShowWIPModal(true)
                                  }
                                }}
                              />
                              <span className="text-sm text-slate-600">Remember me</span>
                            </div>
                            <Link
                              to="/auth/forgot-password"
                              className={`text-sm font-medium text-green-600 hover:underline ${(isLoginDisabled && !isAdminBypass) ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                              onClick={(event) => {
                                if (isLoginDisabled && !isAdminBypass) {
                                  event.preventDefault()
                                  setWipFeature("login")
                                  setShowWIPModal(true)
                                }
                              }}
                            >
                              Forgot password?
                            </Link>
                          </div>

                          <Button
                            type="submit"
                            className={`w-full bg-green-600 hover:bg-green-700 ${(isLoginDisabled && !isAdminBypass) ? "opacity-60 cursor-not-allowed hover:bg-green-600" : ""}`}
                            disabled={isLoading || isLoginDisabled}
                            aria-disabled={isLoginDisabled && !isAdminBypass}
                            onClick={(event) => {
                              if (isLoginDisabled && !isAdminBypass) {
                                event.preventDefault()
                                setWipFeature("login")
                                setShowWIPModal(true)
                              }
                            }}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing in...
                              </>
                            ) : (
                              "Sign In"
                            )}
                          </Button>
                        </form>

                        <div className="mt-[25px] space-y-3">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-gray-300" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                              <span className="bg-white px-2 text-gray-500">Or continue with</span>
                            </div>
                          </div>

                          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                            <div className="flex justify-center relative">
                              {isLoginDisabled && (
                                <button
                                  type="button"
                                  aria-label="Login disabled"
                                  className="absolute inset-0 z-10 cursor-not-allowed"
                                  onClick={() => {
                                    setWipFeature("login")
                                    setShowWIPModal(true)
                                  }}
                                />
                              )}
                              <div className={isLoginDisabled ? "opacity-60 pointer-events-none" : ""}>
                                <GoogleLogin
                                  onSuccess={handleGoogleSuccess}
                                  onError={handleGoogleError}
                                  useOneTap={false}
                                  theme="outline"
                                  size="large"
                                  text="signin_with"
                                  shape="rectangular"
                                  logo_alignment="left"
                                />
                              </div>
                            </div>
                          </GoogleOAuthProvider>
                        </div>

                        <div className="mt-[20px] text-center text-sm text-gray-600">
                          Don't have an account?{" "}
                          <button
                            onClick={() => {
                              if (isRegisterDisabled && !isAdminBypass) {
                                setWipFeature('register')
                                setShowWIPModal(true)
                                return
                              }

                              storage.clearAppState()
                              setError("")
                              setActiveTab("register")
                            }}
                            className={`text-green-600 hover:underline font-semibold ${(isRegisterDisabled && !isAdminBypass) ? "opacity-50 cursor-not-allowed" : ""}`}
                            aria-disabled={isRegisterDisabled && !isAdminBypass}
                          >
                            Create one
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={isRegisterViewDisabled ? "opacity-60 text-slate-500" : ""} data-form="register">
                    {inviteData && (
                      <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-800 space-y-2">
                        <div className="font-semibold">Invitation detected</div>
                        <div>
                          <span className="font-medium">{inviteData.invitedByName}</span> invited you to join{" "}
                          <span className="font-medium">{inviteData.workspaceName}</span>
                        </div>
                      </div>
                    )}

                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="First name"
                          autoComplete="off"
                          {...registerForm.register("firstName")}
                          disabled={isLoading || isRegisterDisabled}
                          className={`h-11 ${registerForm.formState.errors.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                        />
                        </div>
                        <div className="space-y-2">
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Last name"
                          autoComplete="off"
                          {...registerForm.register("lastName")}
                          disabled={isLoading || isRegisterDisabled}
                          className={`h-11 ${registerForm.formState.errors.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                        />
                        </div>
                      </div>

                      <div className="space-y-2">
                      <Input
                        id="email-register"
                        type="email"
                        placeholder="your@email.com"
                        {...registerForm.register("email")}
                        disabled={isLoading || isRegisterDisabled || !!inviteData?.email}
                        readOnly={!!inviteData?.email}
                        autoComplete="email"
                        className={`h-11 ${inviteData?.email ? "bg-gray-100 cursor-not-allowed" : ""} ${registerForm.formState.errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      />
                        {inviteData?.email && (
                          <p className="text-xs text-gray-500">Email is pre-filled from your invitation</p>
                        )}
                        {/* Error text removed - border indicates validation */}
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            id="password-register"
                            type={showPasswordRegister ? "text" : "password"}
                            placeholder="********"
                            {...registerForm.register("password")}
                            disabled={isLoading || isRegisterDisabled}
                            autoComplete="new-password"
                            className={`h-11 pr-10 ${registerForm.formState.errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswordRegister(!showPasswordRegister)}
                            tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPasswordRegister ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {registerForm.formState.errors.password && (
                          <p className="text-xs text-red-500">
                            {registerForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="********"
                            {...registerForm.register("confirmPassword")}
                            disabled={isLoading || isRegisterDisabled}
                            autoComplete="new-password"
                            className={`h-11 pr-10 ${registerForm.formState.errors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {registerForm.formState.errors.confirmPassword && (
                          <p className="text-xs text-red-500">
                            {registerForm.formState.errors.confirmPassword.message}
                          </p>
                        )}
                      </div>

                      <div className="flex items-start gap-2">
                      <Checkbox
                        id="gdpr"
                        checked={registerForm.watch("gdprAccepted")}
                        onCheckedChange={async (checked) => {
                          registerForm.setValue("gdprAccepted", checked as boolean)
                          await registerForm.trigger("gdprAccepted")
                        }}
                        disabled={isRegisterDisabled || isLoading}
                        className={registerForm.formState.errors.gdprAccepted ? "border-red-500 text-red-500" : ""}
                      />
                        <label
                        htmlFor="gdpr"
                        className="text-sm text-gray-600 leading-tight cursor-pointer"
                        onClick={async () => {
                          if (isRegisterDisabled) {
                            return
                          }
                          const current = registerForm.getValues("gdprAccepted")
                          registerForm.setValue("gdprAccepted", !current)
                          await registerForm.trigger("gdprAccepted")
                        }}
                        >
                          I agree to the{" "}
                          <Link to="/privacy" className="text-green-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                            Privacy Policy
                          </Link>{" "}
                          and{" "}
                          <Link to="/terms" className="text-green-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                            Terms of Service
                          </Link>
                        </label>
                      </div>
                    <Button
                      type="submit"
                      className={`w-full bg-green-600 hover:bg-green-700 ${isRegisterDisabled ? "opacity-60 cursor-not-allowed hover:bg-green-600" : ""}`}
                      disabled={isLoading || !registerForm.formState.isValid || isRegisterDisabled}
                      aria-disabled={isRegisterDisabled}
                      onClick={(event) => {
                        if (isRegisterDisabled) {
                          event.preventDefault()
                          setWipFeature("register")
                          setShowWIPModal(true)
                        }
                      }}
                    >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create account"
                        )}
                      </Button>
                    </form>

                    <div className="relative mt-[14px]">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-gray-500">Or continue with</span>
                      </div>
                    </div>

                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <div className="flex justify-center relative mt-[10px]">
                        {isRegisterDisabled && (
                          <button
                            type="button"
                            aria-label="Registration disabled"
                            className="absolute inset-0 z-10 cursor-not-allowed"
                            onClick={() => {
                              setWipFeature("register")
                              setShowWIPModal(true)
                            }}
                          />
                        )}
                        <div className={isRegisterDisabled ? "opacity-60 pointer-events-none" : ""}>
                          <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            useOneTap={false}
                            theme="outline"
                            size="large"
                            text="signup_with"
                            shape="rectangular"
                            logo_alignment="left"
                          />
                        </div>
                      </div>
                    </GoogleOAuthProvider>

                    <div className="mt-[18px] text-center text-sm text-gray-600">
                      Already have an account?{" "}
                      <button
                        onClick={() => {
                          if (isLoginDisabled) {
                            setWipFeature('login')
                            setShowWIPModal(true)
                            return
                          }
                          storage.clearAppState()
                          setError("")
                          setActiveTab("signin")
                        }}
                        className={`text-green-600 hover:underline font-semibold ${isLoginDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        aria-disabled={isLoginDisabled}
                      >
                        Sign in
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Smart Push AI Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="group relative"
            initial={{ opacity: 0, x: 80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-green-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500"></div>

            <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 min-h-[320px]">
              <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-10 items-start">
                <div className="flex flex-col items-center lg:items-start gap-4">
                  <div className="relative">
                    <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-xl ring-4 ring-white group-hover:ring-emerald-100 transition-all duration-300">
                      <img
                        src="/push.png"
                        alt="Smart AI push messaging"
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 text-center lg:text-left">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mx-auto lg:mx-0">
                      <Megaphone className="h-4 w-4" />
                      {t("pushAi.badge")}
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                      {t("pushAi.title")}
                    </h3>
                    <p className="text-xl text-slate-600 leading-relaxed text-justify">
                      {t("pushAi.subtitle")}
                    </p>
                  </div>
                  <div className="pt-4 flex justify-center lg:justify-start">
                    <Link
                      to="/push-notifications"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline transition-colors"
                    >
                      {t("common.viewMore")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Survey CTA Section - MOVED BEFORE HOW IT WORKS */}
      {(() => {
        const qLang = language as string
        const qMap: Record<string, { title: string; desc: string; cta: string }> = {
          it: {
            title: "Aiutaci a costruire il chatbot perfetto per te",
            desc: "Il segreto di un buon chatbot è la qualità delle risposte. Rispondi a qualche domanda sulle tue esigenze — supporto umano, marketing push, widget, vendite, e-commerce e privacy — e ti mostreremo come eChatbot può fare la differenza. Circa 2 minuti, zero impegno.",
            cta: "Avvia il survey →",
          },
          es: {
            title: "Ayúdanos a construir el chatbot perfecto para ti",
            desc: "El secreto de un buen chatbot son las respuestas de calidad. Responde algunas preguntas sobre tus necesidades — soporte humano, marketing push, widget, ventas, e-commerce y privacidad — y te mostraremos cómo eChatbot puede marcar la diferencia. Unos 2 minutos, sin compromiso.",
            cta: "Iniciar el survey →",
          },
          pt: {
            title: "Ajude-nos a construir o chatbot perfeito para você",
            desc: "O segredo de um bom chatbot são as respostas de qualidade. Responda algumas perguntas sobre suas necessidades — suporte humano, marketing push, widget, vendas, e-commerce e privacidade — e mostraremos como o eChatbot pode fazer a diferença. Cerca de 2 minutos, sem compromisso.",
            cta: "Iniciar o survey →",
          },
          en: {
            title: "Help us build the perfect chatbot for you",
            desc: "The secret to a great chatbot is quality responses. Answer a few questions about your needs — human support, push marketing, widget, sales, e-commerce, and privacy — and we'll show you how eChatbot can make a real difference. About 2 minutes, no commitment.",
            cta: "Start the survey →",
          },
        }
        const q = qMap[qLang] || qMap["en"]

        return (
          <section className="py-24 bg-gradient-to-br from-emerald-50 via-white to-green-50 border-t border-emerald-100">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex flex-col lg:flex-row items-center gap-16"
              >
                {/* Left: Visual grid of topics */}
                <div className="lg:w-1/2 flex justify-center">
                  <div className="relative w-full max-w-md">
                    {/* Decorative background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-200 to-emerald-300 rounded-3xl rotate-3 opacity-30" />
                    <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-green-100">
                      <div className="text-center mb-6 space-y-3">
                        <img
                          src="/survey.png"
                          alt="Survey illustration"
                          className="mx-auto h-20 w-20 drop-shadow-md"
                        />
                        <p className="text-lg font-semibold text-green-700">
                          {qLang === "it"
                            ? "Questionario eChatbot"
                            : qLang === "es"
                            ? "Cuestionario eChatbot"
                            : qLang === "pt"
                            ? "Questionário eChatbot"
                            : "eChatbot Questionnaire"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { emoji: "🤝", label: qLang === "it" ? "Supporto umano" : qLang === "es" ? "Soporte humano" : qLang === "pt" ? "Suporte humano" : "Human support" },
                          { emoji: "📣", label: qLang === "it" ? "Marketing push" : "Push marketing" },
                          { emoji: "🌐", label: "Widget" },
                          { emoji: "🛍️", label: qLang === "it" ? "Agenti vendita" : qLang === "es" ? "Agentes ventas" : qLang === "pt" ? "Agentes vendas" : "Sales agents" },
                          { emoji: "🛒", label: "E-commerce" },
                          { emoji: "🔒", label: "Privacy" },
                        ].map(({ emoji, label }) => (
                          <div
                            key={label}
                            className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3 border border-green-100"
                          >
                            <span className="text-2xl">{emoji}</span>
                            <span className="text-sm font-medium text-green-800">{label}</span>
                          </div>
                        ))}
                      </div>
                      {/* Progress bar decoration */}
                      <div className="mt-6 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full w-4/6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full" />
                      </div>
                      <p className="text-sm text-slate-400 text-center mt-2">2 min</p>
                    </div>
                  </div>
                </div>

                {/* Right: Text + CTA */}
                <div className="lg:w-1/2 text-center lg:text-left">
                  <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                    Survey
                  </span>
                  <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6 leading-tight">
                    {q.title}
                  </h2>
                  <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                    {q.desc}
                  </p>
                  <Link
                    to="/survey"
                    className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-10 py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
                  >
                    <span className="text-2xl">📋</span>
                    <span>{q.cta}</span>
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>
        )
      })()}

      {/* How It Works Section */}
      <motion.section
        id="features"
        className="py-16 bg-white"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">
              {t("howItWorks.title")}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {t("howItWorks.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorksCards.map((card, index) => (
              <div className="relative" key={card.step}>
                <motion.div
                  className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-8 border-2 ${card.border} h-full shadow-lg hover:shadow-xl transition-all duration-500 flex flex-col`}
                  initial={{ opacity: 0, y: 60, scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.65, ease: "easeOut", delay: index * 0.08 }}
                >
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-6 shadow-lg shadow-emerald-200/40">
                    {card.step}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">{card.title}</h3>
                  <p className="text-slate-600 leading-relaxed flex-1">
                    {card.description}
                  </p>
                </motion.div>

                {card.showArrow && (
                  <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2 text-green-600 z-10">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Pricing Section */}
      <div id="pricing" className="py-16 bg-gradient-to-br from-blue-50 via-white to-green-50">
        <PricingPlans
          currentPlan={currentPlanForPricing || null}
          onChangePlan={() => navigate("/billing")}
          onStartFreeTrial={() => {
            if (isRegisterDisabled) {
              setWipFeature('register')
              setShowWIPModal(true)
              return
            }
            setActiveTab('register')
            setTimeout(() => {
              document.getElementById("firstName")?.focus()
            }, 0)
          }}
          disableTrial={isRegisterDisabled}
        />
      </div>

      {/* FAQ Section */}
      <HomeFAQ />

      {/* Contact Section (Demo highlight) */}
      <div id="demo" className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="group relative"
            initial={{ opacity: 0, x: 80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {/* Decorative rotated background frame */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500"></div>
            
              <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 min-h-[320px]">
              {workingInProgress && !isAdminBypass && (
                <div className="absolute -right-6 top-[14px] rotate-12 bg-red-600 py-2 text-[10px] font-bold uppercase tracking-[0.4em] text-white shadow-lg pl-[50px] pr-[45px] z-20">
                  {t("wip.banner")}
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-10 items-start">
                {/* Left: Content */}
                <div className="space-y-6 text-center lg:text-left">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium mx-auto lg:mx-0">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Interactive Demo
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                      {t("demo.title")}
                    </h3>
                    <p className="text-xl text-slate-600 leading-relaxed text-justify">
                      {t("demo.subtitle")}
                    </p>
                  </div>
                  
                  <div className="pt-4 flex justify-center lg:justify-start">
                    <Button
                      type="button"
                      disabled={isDemoDisabled}
                      className={`w-full sm:w-[220px] sm:h-[52px] px-8 py-4 text-base sm:text-lg font-semibold rounded-2xl bg-green-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 ${isDemoDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={() => {
                        if (isDemoDisabled) {
                          setWipFeature('demo')
                          setShowWIPModal(true)
                          return
                        }
                        window.open("https://wa.me/34602119358", "_blank", "noopener,noreferrer")
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <svg
                          aria-hidden="true"
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2a10 10 0 0 0-8.67 15.02L2 22l5.08-1.33a10 10 0 1 0 4.92-18.67zm0 1.8a8.2 8.2 0 0 1 0 16.4c-1.4 0-2.74-.36-3.93-1.05l-.28-.16-2.98.78.8-2.9-.18-.3A8.2 8.2 0 0 1 12 3.8zm-2.1 4.2c-.2 0-.5.08-.75.36-.25.27-.96.94-.96 2.3s.98 2.67 1.12 2.85c.14.18 1.9 3.05 4.7 4.15.9.36 1.57.58 2.1.47.48-.1 1.57-.65 1.8-1.28.22-.63.22-1.17.16-1.29-.07-.12-.26-.19-.55-.33-.29-.14-1.72-.85-1.99-.94-.27-.1-.46-.14-.65.14-.19.27-.75.94-.92 1.13-.17.19-.34.22-.63.08-.29-.14-1.2-.44-2.28-1.4-.84-.75-1.4-1.67-1.57-1.96-.17-.29 0-.44.13-.58.13-.13.29-.34.43-.5.14-.16.19-.28.29-.46.1-.18.05-.35-.02-.49-.07-.14-.63-1.52-.87-2.07-.23-.56-.46-.48-.63-.49h-.54z" />
                        </svg>
                        <span>{t("demo.button")}</span>
                      </span>
                    </Button>
                  </div>
                </div>
                
                {/* Right: Image with badge */}
                <div className="flex flex-col items-center lg:items-end gap-4">
                  <div className="relative">
                    <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-xl">
                      <img
                        src="/demo.png"
                        alt="Demo Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute -top-3 -right-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold uppercase tracking-wider animate-bounce">
                      Live
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Human-in-the-loop Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="group relative"
            initial={{ opacity: 0, x: -80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500"></div>

            <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 min-h-[320px]">
              <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-10 items-start">
                <div className="flex flex-col items-center lg:items-start gap-4 order-1">
                  <div className="relative">
                    <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-xl ring-4 ring-white group-hover:ring-amber-100 transition-all duration-300">
                      <img
                        src="/human.png"
                        alt="Human-in-the-loop support"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 text-center lg:text-left order-2">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium mx-auto lg:mx-0">
                      <span>🤝</span>
                      Human-in-the-loop
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                      {t("humanLoop.title")}
                    </h3>
                    <p className="text-xl text-slate-600 leading-relaxed text-justify">
                      {t("humanLoop.subtitle")}
                    </p>
                  </div>
                  <div className="pt-4 flex justify-center lg:justify-start">
                    <Link
                      to="/human-support"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-900 hover:underline transition-colors"
                    >
                      {t("common.viewMore")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Widget to WhatsApp Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="group relative"
            initial={{ opacity: 0, x: 80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {/* Green/teal decorative frame - WhatsApp theme */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-teal-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500"></div>

            <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 min-h-[320px]">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-10 items-center">

                {/* Left: Content */}
                <div className="space-y-6 text-center lg:text-left">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium mx-auto lg:mx-0">
                      <span>📱</span>
                      {t("widgetToWhatsapp.badge")}
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                      {t("widgetToWhatsapp.title")}
                    </h3>
                    <p className="text-xl text-slate-600 leading-relaxed text-justify">
                      {t("widgetToWhatsapp.subtitle")}
                    </p>
                  </div>

                  {/* Feature chips */}
                  <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                    {(["chip1", "chip2", "chip3", "chip4"] as const).map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200"
                      >
                        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {t(`widgetToWhatsapp.${chip}`)}
                      </span>
                    ))}
                  </div>
                  <div className="pt-2 flex justify-center lg:justify-start">
                    <Link
                      to="/widget-to-whatsapp"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-900 hover:underline transition-colors"
                    >
                      {t("common.viewMore")}
                    </Link>
                  </div>
                </div>

                {/* Right: Widget → WhatsApp illustration */}
                <div className="flex items-center justify-center lg:justify-end">
                  <div className="relative w-[260px] h-[200px] flex items-center justify-center select-none">

                    {/* Widget mock – left */}
                    <div className="absolute left-0 top-4 bg-white rounded-2xl shadow-xl border border-slate-200 w-[100px] p-3 z-10">
                      <div className="text-[7px] text-slate-400 font-bold mb-2 tracking-widest uppercase">Widget</div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-green-400 rounded-full opacity-80"></div>
                        <div className="h-2 w-3/4 bg-slate-200 rounded-full ml-auto"></div>
                        <div className="h-2 w-2/3 bg-green-400 rounded-full opacity-60"></div>
                        <div className="h-2 w-4/5 bg-slate-200 rounded-full ml-auto"></div>
                      </div>
                      <div className="flex gap-1 mt-2.5 justify-end">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce [animation-delay:0ms]"></div>
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce [animation-delay:150ms]"></div>
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce [animation-delay:300ms]"></div>
                      </div>
                    </div>

                    {/* Arrow + label – center */}
                    <div className="absolute left-[88px] top-1/2 -translate-y-[55%] flex flex-col items-center gap-1 z-20">
                      <div className="text-[9px] text-green-700 font-semibold bg-white px-2 py-0.5 rounded-full border border-green-200 shadow-sm whitespace-nowrap">
                        operator
                      </div>
                      <svg width="50" height="20" viewBox="0 0 50 20" fill="none" className="text-green-500">
                        <path d="M2 10 H40 M32 3 L40 10 L32 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Smartphone with WhatsApp – right */}
                    <div className="absolute right-0 top-0 w-[90px] h-[160px] bg-slate-800 rounded-[22px] shadow-2xl overflow-hidden ring-2 ring-slate-700 group-hover:ring-green-400 transition-all duration-300">
                      {/* Status bar */}
                      <div className="h-4 bg-slate-900 flex items-center justify-center">
                        <div className="w-14 h-1.5 bg-slate-700 rounded-full"></div>
                      </div>
                      {/* WhatsApp header */}
                      <div className="bg-[#075e54] px-2 py-1.5 flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-[#25d366] rounded-full flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                          </div>
                        <div className="flex-1 min-w-0">
                          <div className="h-1.5 w-full bg-white opacity-90 rounded-full"></div>
                          <div className="h-1 w-2/3 bg-white opacity-50 rounded-full mt-0.5"></div>
                        </div>
                      </div>
                      {/* Chat messages */}
                      <div className="bg-[#ece5dd] p-1.5 space-y-1.5 h-[90px] overflow-hidden">
                        <div className="bg-white rounded-lg rounded-tl-none px-1.5 py-1 w-4/5 shadow-sm">
                          <div className="h-1 w-full bg-slate-200 rounded-full"></div>
                          <div className="h-1 w-2/3 bg-slate-200 rounded-full mt-0.5"></div>
                        </div>
                        <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none px-1.5 py-1 w-3/4 ml-auto shadow-sm">
                          <div className="h-1 w-full bg-green-200 rounded-full"></div>
                        </div>
                        <div className="bg-white rounded-lg rounded-tl-none px-1.5 py-1 w-4/5 shadow-sm">
                          <div className="h-1 w-full bg-slate-200 rounded-full"></div>
                          <div className="h-1 w-1/2 bg-slate-200 rounded-full mt-0.5"></div>
                        </div>
                      </div>
                      {/* Input bar */}
                      <div className="bg-white px-1.5 py-1 flex gap-1 items-center border-t border-slate-100">
                        <div className="flex-1 h-4 bg-slate-100 rounded-full"></div>
                        <div className="w-4 h-4 bg-[#25d366] rounded-full flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                          </svg>
                        </div>
                      </div>
                      {/* Notification badge */}
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#25d366] rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-lg animate-pulse ring-2 ring-white z-30">
                        1
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Integration Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="group relative"
            initial={{ opacity: 0, x: 80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {/* Decorative rotated background frame - BLU for enterprise */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500"></div>
            
            <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 min-h-[320px]">
              <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-10 items-start">
                {/* Left: Image with effects */}
                <div className="flex flex-col items-center lg:items-start">
                  <div className="relative">
                    <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-xl ring-4 ring-white group-hover:ring-blue-100 transition-all duration-300">
                      <img
                        src="/CRM.png"
                        alt="CRM integration preview"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Right: Content */}
                <div className="space-y-6 text-center lg:text-left">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mx-auto lg:mx-0">
                      <span>🔗</span>
                      Enterprise Feature
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                      {t("integration.crm.title")}
                    </h3>
                    <p className="text-xl text-slate-600 leading-relaxed text-justify">
                      {t("integration.crm.subtitle")}
                    </p>
                  </div>
                  
                  <div className="pt-4 flex flex-wrap items-center gap-4 justify-center lg:justify-start">
                    <Button
                      type="button"
                      className="w-full sm:w-[220px] sm:h-[52px] px-8 py-4 text-base sm:text-lg font-semibold rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                      onClick={() => {
                        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <span>{t("integration.crm.button")}</span>
                      </span>
                    </Button>
                    <Link
                      to="/crm-integration"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline transition-colors"
                    >
                      {t("common.viewMore")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Team Collaboration Section */}
      <div className="py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="group relative"
            initial={{ opacity: 0, x: -80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {/* Decorative rotated background frame - PURPLE for collaboration */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-3xl rotate-0 sm:-rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:-rotate-2 transition-transform duration-500"></div>
            
            <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 min-h-[320px]">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-10 items-start">
                {/* Left: Content */}
                <div className="space-y-6 text-center lg:text-left">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium mx-auto lg:mx-0">
                      <span>👥</span>
                      Team Feature
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                      {t("teamCollaboration.title")}
                    </h3>
                    <p className="text-xl text-slate-600 leading-relaxed text-justify">
                      {t("teamCollaboration.subtitle")}
                    </p>
                  </div>
                  <div className="pt-4 flex justify-center lg:justify-start">
                    <Link
                      to="/team-collaboration"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900 hover:underline transition-colors"
                    >
                      {t("common.viewMore")}
                    </Link>
                  </div>
                </div>

                {/* Right: Image */}
                <div className="flex flex-col items-center lg:items-end">
                  <div className="relative">
                    <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-xl ring-4 ring-white group-hover:ring-purple-100 transition-all duration-300">
                      <img
                        src="/human.png"
                        alt="Team collaboration"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Privacy Section */}
      <div className="py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="group relative"
            initial={{ opacity: 0, x: 80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {/* Decorative rotated background frame */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500"></div>
            
            <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 min-h-[320px]">
              <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-10 items-start">
                {/* Left: Image with security badge */}
                <div className="flex flex-col items-center lg:items-start gap-4">
                  <div className="relative">
                    <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-xl ring-4 ring-white group-hover:ring-teal-100 transition-all duration-300">
                      <img
                        src="/privacy.png"
                        alt="Privacy by design"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Right: Content */}
                <div className="space-y-6 text-center lg:text-left">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium mx-auto lg:mx-0">
                      <span>🛡️</span>
                      GDPR Compliant
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                      {t("privacy.sectionTitle")}
                    </h3>
                    <p className="text-xl text-slate-600 leading-relaxed text-justify">
                      {t("privacy.subtitle")}
                    </p>
                  </div>
                  
                  <div className="pt-4 flex justify-center lg:justify-start">
                    <Link
                      to="/privacy-by-design"
                      className="inline-flex items-center gap-2 w-full sm:w-auto sm:h-[52px] px-8 py-4 text-base sm:text-lg font-semibold rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 justify-center"
                    >
                      <span>{t("common.viewMore")}</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Contact Form removed - see /contact page */}
      {false && <div id="contact" className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 items-stretch">
            {/* Form Section - 60% */}
            <div className="flex-1 lg:w-[60%] group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-green-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg transition-transform duration-500"></div>
              <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 min-h-[320px]">
                <div className="text-center space-y-3 mb-10">
                  <h3 className="text-3xl font-bold text-slate-900">{t("contact.form.title")}</h3>
                  <p className="text-slate-600">{t("contact.form.subtitle")}</p>
                </div>

              {contactSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 sm:p-10 text-center shadow-lg">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-8 w-8"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <h4 className="text-2xl font-semibold text-slate-900">Message sent</h4>
                  <p className="mt-2 text-slate-600">
                    Thanks for reaching out. We’ll be in touch soon.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleContactSubmit}
                  className="space-y-6"
                >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="contact-name">
                    {t("contact.form.name")}
                  </label>
                  <Input
                    ref={contactNameInputRef}
                    id="contact-name"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder={t("contact.form.namePlaceholder")}
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="contact-surname">
                    {t("contact.form.surname")}
                  </label>
                  <Input
                    id="contact-surname"
                    value={contactSurname}
                    onChange={(event) => setContactSurname(event.target.value)}
                    placeholder={t("contact.form.surnamePlaceholder")}
                    className="h-11"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="contact-email">
                    {t("contact.form.email")}
                  </label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder={t("contact.form.emailPlaceholder")}
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="contact-phone">
                    {t("contact.form.phone")}
                  </label>
                  <Input
                    id="contact-phone"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    placeholder={t("contact.form.phonePlaceholder")}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="contact-title">
                  {t("contact.form.subject")}
                </label>
                <Input
                  id="contact-title"
                  value={contactTitle}
                  onChange={(event) => setContactTitle(event.target.value)}
                  placeholder={t("contact.form.subjectPlaceholder")}
                  className="h-11"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="contact-message">
                  {t("contact.form.message")}
                </label>
                <textarea
                  id="contact-message"
                  value={contactMessage}
                  onChange={(event) => setContactMessage(event.target.value)}
                  placeholder={t("contact.form.messagePlaceholder")}
                  required
                  className="min-h-[140px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                />
              </div>

              <input
                type="text"
                name="website"
                value={contactHoneypot}
                onChange={(event) => setContactHoneypot(event.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="flex justify-center">
                {recaptchaSiteKey ? (
                  <div
                    className="g-recaptcha"
                    data-sitekey={recaptchaSiteKey}
                    data-callback="onRecaptchaSuccess"
                  />
                ) : (
                  <p className="text-sm text-red-600">{t("contact.form.captchaError")}</p>
                )}
              </div>

              {contactError && (
                <div className="text-sm text-red-600 text-center">{contactError}</div>
              )}

              <div className="flex justify-center">
                <Button
                  type="submit"
                  disabled={contactSubmitting}
                  className="w-56 px-12 py-6 text-base font-semibold rounded-full bg-green-600 text-white shadow-lg shadow-green-200/70 hover:bg-green-600"
                >
                  {contactSubmitting ? t("contact.form.sending") : t("contact.form.send")}
                </Button>
              </div>
                </form>
              )}
            </div>
          </div>

          {/* Image Section - 40% */}
          <div className="flex-1 lg:w-[40%] hidden lg:flex items-center justify-center">
            <div className="w-full rounded-3xl overflow-hidden shadow-2xl" style={{ height: 'calc(100% - 15px)' }}>
              <img
                src="/contactus.png"
                alt="Contact us"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
        </div>
      </div>}

      {/* CTA Section - Barra Verde con Call to Action */}
      <div className="py-12 bg-gradient-to-br from-green-600 to-emerald-700 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/50 to-transparent"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <p className="text-xl md:text-2xl text-green-50 mb-10 leading-relaxed max-w-3xl mx-auto">
            {t("cta.subtitle")}
          </p>
          
          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => {
                setActiveTab('register')
                setTimeout(() => {
                  document.getElementById("firstName")?.focus()
                }, 0)
              }}
              className="group px-10 py-5 bg-white text-green-600 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 flex items-center gap-3"
            >
              <span>{t("cta.button.start")}</span>
              <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <Link
              to="/contact"
              className="px-10 py-5 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 shadow-lg transition-all duration-300"
            >
              {t("cta.button.contact")}
            </Link>
          </div>
        </div>
      </div>
      </main>

      <SiteFooter language={language} />

      {/* ⏸️ WhatsApp Floating Button - DISABLED (will reactivate later) */}
      {/* 
      <a
        href="https://wa.me/34654728753"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform z-50 group"
        aria-label="Contact us on WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-7 h-7"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          +34 654 728 753
        </span>
      </a>
      */}

      {/* WIP Modal - shown when canLogin or canRegister is false */}
      <WIPModal
        isOpen={showWIPModal}
        feature={wipFeature}
        onClose={() => setShowWIPModal(false)}
      />

      </div>
    </>
  )
}
