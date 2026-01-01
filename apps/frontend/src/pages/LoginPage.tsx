import { NewsUpdates } from "@/components/landing/NewsUpdates"
import { PricingPlans } from "@/components/landing/PricingPlans"
import { HomeFAQ } from "@/components/landing/HomeFAQ"
import { WIPModal } from "@/components/shared/WIPModal"
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
import { useLanguage } from "@/contexts/LanguageContext"
import { useFeatureFlags } from "@/hooks/usePlatformConfig"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import hero1 from "@/assets/hero/home_1.png"
import hero2 from "@/assets/hero/home_2.png"
import hero3 from "@/assets/hero/home_3.png"
import hero4 from "@/assets/hero/home_4.png"
import hero5 from "@/assets/hero/home_5.png"
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
} from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import * as z from "zod"
import { toast } from "../lib/toast"
import { auth, api } from "../services/api"
import { workspaceApi } from "../services/workspaceApi"
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
  const { t } = useLanguage()
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
    isLoading: flagsLoading,
  } = useFeatureFlags()
  const [showWIPModal, setShowWIPModal] = useState(false)
  const [wipFeature, setWipFeature] = useState<'login' | 'register'>('login')
  
  // 🔗 Extract returnUrl from query params (for invitation flow)
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const actionParam = searchParams.get('action') // 🆕 For auto-opening register modal
  const modeParam = searchParams.get('mode') // 🆕 For invite flow: 'register' opens register tab
  const inviteParam = searchParams.get('invite') // 🆕 For invite flow: pre-fill email from invite
  const logoutParam = searchParams.get('logout') // 🆕 For forcing logout from backoffice
  const isAdminBypass = searchParams.get('admin') === 'true'
  const isLoginDisabled = flagsLoading || (!canLogin && !isAdminBypass)
  const isRegisterDisabled = flagsLoading || !canRegister
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

  const heroSlides = [
    { src: hero1, alt: "WhatsApp AI agent dashboard view 1" },
    { src: hero2, alt: "WhatsApp AI agent dashboard view 2" },
    { src: hero3, alt: "WhatsApp AI agent dashboard view 3" },
    { src: hero4, alt: "WhatsApp AI agent dashboard view 4" },
    { src: hero5, alt: "WhatsApp AI agent dashboard view 5" },
  ]
  const [currentSlide, setCurrentSlide] = useState(0)
  const [contactTitle, setContactTitle] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [contactCaptchaToken, setContactCaptchaToken] = useState("")
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactError, setContactError] = useState("")
  const [contactSuccess, setContactSuccess] = useState(false)
  const [contactHoneypot, setContactHoneypot] = useState("")
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""


  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }, 7000)
    return () => clearInterval(interval)
  }, [heroSlides.length])

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
    defaultValues: {
      email: isDev ? "admin@echatbot.ai" : "",
      password: isDev ? "Venezia44" : "",
    } as LoginForm,
  })

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
    if (isLoginDisabled) {
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

      // 🔒 SECURITY: Check if 2FA is required
      if (response.data && response.data.requires2FA) {
        logger.info("🔐 User requires 2FA verification")
        
        toast.success("Credentials verified! Please enter 2FA code.")

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

        // 🔐 Platform Admin redirect to Backoffice
        if (response.data.user.isPlatformAdmin) {
          logger.info("🔐 Platform Admin detected - redirecting to Backoffice")
          // Use separate backoffice URL (standalone Heroku app)
          const backofficeUrl = import.meta.env.VITE_BACKOFFICE_URL || 'http://localhost:3002'
          const redirectUrl = `${backofficeUrl}/auth/callback?token=${response.data.token}`
          logger.info('🔐 Redirect URL:', redirectUrl)
          window.location.replace(redirectUrl)
          return
        }

        // Redirect to workspace selection
        navigate("/workspace-selection")
      } else {
        throw new Error("Invalid response format from the server.")
      }
    } catch (err: any) {
      logger.error("Login error:", err)

      // Mostra messaggio di errore dettagliato
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please check your credentials."

      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const onRegisterSubmit = async (data: RegisterForm) => {
    // 🚀 Check if registration is enabled
    if (isRegisterDisabled) {
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

      toast.success('Account created! Please setup 2FA.')
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
        
        toast.success('Login successful!')
        
        // 🔐 Platform Admin redirect to Backoffice
        if (user.isPlatformAdmin) {
          logger.info('🔐 [GOOGLE OAUTH] Platform Admin detected - redirecting to Backoffice')
          // Use separate backoffice URL (standalone Heroku app)
          const backofficeUrl = import.meta.env.VITE_BACKOFFICE_URL || 'http://localhost:3002'
          const redirectUrl = `${backofficeUrl}/auth/callback?token=${token}`
          logger.info('🔐 [GOOGLE OAUTH] Redirect URL:', redirectUrl)
          window.location.replace(redirectUrl)
          return
        }
        
        // Normal user - go to workspace selection
        navigate('/workspace-selection')
        return
      }
      
      // Only save user info for the 2FA pages to use
      storage.setUser(user)
      
      if (requiresSetup) {
        toast.success('Welcome! Please setup 2FA.')
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
        toast.success('Google login successful! Please enter 2FA code.')
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
        title: contactTitle.trim(),
        message: contactMessage.trim(),
        captchaToken: contactCaptchaToken,
        website: contactHoneypot,
      })

      setContactSuccess(true)
      setContactTitle("")
      setContactMessage("")
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
      ? new Intl.NumberFormat("it-IT", {
          style: "currency",
          currency: "EUR",
        }).format(userPlan.creditBalance)
      : "--"

  const VALID_PLAN_TYPES: PlanType[] = ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]
  const currentPlanForPricing = userPlan?.planType && VALID_PLAN_TYPES.includes(userPlan.planType as PlanType)
    ? (userPlan.planType as PlanType)
    : undefined

  return (
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
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 lg:px-12">
          <div className="flex justify-end pt-3">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-green-600 hover:text-green-700"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact us
            </a>
          </div>

          {/* Main Header Row */}
          <div className="flex items-center justify-between h-20">
            {/* Left: Logo + Brand */}
            <div className="flex items-center gap-0 mt-[5px]">
              <img 
                src="/logo.png" 
                alt="eChatbot" 
                className="h-[100px] w-[100px] object-contain mr-[-15px] mt-[10px]"
              />
              <span className="text-4xl font-bold text-green-600 tracking-tight">eChatbot</span>
            </div>

            {/* Right: Language Selector + Auth */}
            <div className="flex items-center gap-6">
              {isLoggedIn ? (
                <div className="flex items-center gap-4">
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
                            {loggedInUser?.email || 'Welcome'}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="p-2 cursor-pointer"
                        onClick={() => navigate("/workspace-selection")}
                      >
                        <MessageSquare className="mr-2 h-4 w-4 text-green-500" fill="currentColor" />
                        <span>Your Channels</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-2 cursor-pointer"
                        onClick={() => navigate("/profile")}
                      >
                        <User className="mr-2 h-4 w-4 text-blue-500" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="p-2 cursor-pointer"
                        onClick={() => navigate("/billing")}
                      >
                        <CreditCard className="mr-2 h-4 w-4 text-emerald-500" />
                        <span>Billing</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="p-2 cursor-pointer text-red-600 focus:text-red-600"
                        onClick={() => {
                          storage.clearAppState()
                          setIsLoggedIn(false)
                          setLoggedInUser(null)
                          setUserPlan(null)
                          toast.success('Logged out successfully')
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </div>
          </div>

        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16 relative z-20">
        <div className="text-center mb-12 space-y-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-green-600">
            <span className="h-[1px] w-8 bg-green-600" aria-hidden="true" />
            {t("header.tagline")}
            <span className="h-[1px] w-8 bg-green-600" aria-hidden="true" />
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900">
            {t("hero.title")}
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            {t("hero.subtitle")}
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-10 items-stretch">
          <div className="flex justify-center lg:justify-start items-center w-full lg:flex-1">
            <div className="relative w-full max-w-3xl lg:mr-2 min-h-[32rem]">
              <div className="absolute inset-0 bg-gradient-to-br from-green-200 to-emerald-100 rounded-[32px] transform rotate-2 scale-105" />
              <div className="relative rounded-[32px] shadow-2xl overflow-hidden bg-white min-h-[32rem]">
                <div className="absolute top-5 inset-x-0 flex justify-center gap-2 z-10 opacity-0" aria-hidden="true">
                  {heroSlides.map((_, index) => (
                    <span
                      key={`slide-dot-${index}`}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        index === currentSlide ? "w-8 bg-green-600" : "w-2.5 bg-slate-300"
                      }`}
                    />
                  ))}
                </div>
                <div className="relative w-full pt-[70%]">
                  {heroSlides.map((slide, index) => (
                    <img
                      key={slide.src}
                      src={slide.src}
                      alt={slide.alt}
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out ${
                        index === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative w-full max-w-sm lg:w-[24rem] bg-white rounded-2xl shadow-xl border border-slate-200 p-8 lg:order-2 min-h-[32rem] flex"
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
            <div className="space-y-6 flex-1 flex flex-col">
                <div className="text-center space-y-2">
                  {workingInProgress && (
                    <div className="absolute -right-6 top-[14px] rotate-12 bg-red-600 py-2 text-[10px] font-bold uppercase tracking-[0.4em] text-white shadow-lg pl-[50px] pr-[45px]">
                      Work in Progress
                    </div>
                  )}
                  <h3 className={`text-2xl font-bold text-slate-900 ${isLoginViewDisabled ? "opacity-60" : ""}`}>
                    {activeTab === "signin" ? "Login" : "Create your account"}
                  </h3>
                  <p className={`text-slate-600 ${isLoginViewDisabled ? "opacity-60" : ""}`}>
                    {activeTab === "signin"
                      ? "Monitor conversations, automations and insights inside the eChatbot dashboard."
                      : "Start automating your WhatsApp commerce with eChatbot"}
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{activeTab === "signin" ? "Login Error" : "Registration Error"}</AlertTitle>
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
                        <button
                          type="button"
                          onClick={() => {
                            if (loggedInUser?.isPlatformAdmin) {
                              window.location.assign("https://backoffice.echatbot.ai")
                              return
                            }
                            navigate("/workspace-selection")
                          }}
                          className="w-full rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          {loggedInUser?.isPlatformAdmin ? "Go to backoffice" : "Go to workspace"}
                        </button>
                      </div>
                    ) : (
                      <div className={isLoginViewDisabled ? "opacity-60 text-slate-500" : ""}>
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
                              onClick={() => {
                                if (isLoginDisabled) {
                                  setWipFeature("login")
                                  setShowWIPModal(true)
                                }
                              }}
                            >
                              <Checkbox id="remember-desktop" disabled={isLoginDisabled || isLoading} />
                              <span className="text-sm text-slate-600">Remember me</span>
                            </div>
                            <Link
                              to="/auth/forgot-password"
                              className={`text-sm font-medium text-green-600 hover:underline ${isLoginDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                              onClick={(event) => {
                                if (isLoginDisabled) {
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
                            className={`w-full bg-green-600 hover:bg-green-700 ${isLoginDisabled ? "opacity-60 cursor-not-allowed hover:bg-green-600" : ""}`}
                            disabled={isLoading}
                            aria-disabled={isLoginDisabled}
                            onClick={(event) => {
                              if (isLoginDisabled) {
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
                              if (isRegisterDisabled) {
                                setWipFeature('register')
                                setShowWIPModal(true)
                                return
                              }

                              storage.clearAppState()
                              setError("")
                              setActiveTab("register")
                            }}
                            className={`text-green-600 hover:underline font-semibold ${isRegisterDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                            aria-disabled={isRegisterDisabled}
                          >
                            Create one
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={isRegisterViewDisabled ? "opacity-60 text-slate-500" : ""}>
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
                          if (isRegisterDisabled) {
                            return
                          }
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
                      disabled={isLoading || !registerForm.formState.isValid}
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

        <div className="mt-14">
          <div className="text-center space-y-2 mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
              <span className="inline-block align-middle h-[1px] w-6 bg-green-600 mr-2" aria-hidden="true" />
              Why eChatbot?
              <span className="inline-block align-middle h-[1px] w-6 bg-green-600 ml-2" aria-hidden="true" />
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-6 text-left">
              <div className="h-12 w-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-4">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                AI sales agent
              </h3>
              <p className="text-sm text-slate-600">
                Create your agent in minutes. No AI skills or prompts required.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-6 text-left">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <Megaphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Push messages
              </h3>
              <p className="text-sm text-slate-600">
                Send targeted WhatsApp pushes, recover abandoned carts, and bring customers back at the right time.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-6 text-left">
              <div className="h-12 w-12 rounded-xl bg-lime-100 text-lime-600 flex items-center justify-center mb-4">
                <Headphones className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Customer care
              </h3>
              <p className="text-sm text-slate-600">
                Triage FAQs, escalate to humans with context, and keep every chat logged.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* News & Updates Section */}
      <NewsUpdates />

      {/* Pricing Section */}
      <div className="py-16 bg-gradient-to-br from-blue-50 via-white to-green-50">
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

      {/* Contact Section */}
      <div className="py-14 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr,260px] gap-8 items-center rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-emerald-50/60 to-white p-8 lg:p-10 shadow-xl">
            <div className="flex items-center justify-center">
              <div className="w-48 h-48 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-md">
                <img
                  src="/bellaitalia.webp"
                  alt="Bellitalia demo"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="text-center lg:text-left space-y-2">
              <h3 className="text-3xl lg:text-4xl font-bold text-slate-900">Demo</h3>
              <p className="text-lg text-slate-600">
                Bellitalia is a distributor of Italian products and has created its own AI Sales Agent.
                Ask the agent anything about their business and try adding products to your cart.
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <Button
                type="button"
                disabled
                className="px-12 py-7 text-lg font-semibold rounded-full bg-green-600 text-white cursor-not-allowed shadow-xl shadow-green-200/70 hover:bg-green-600"
              >
                Try our demo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <div id="contact" className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-600">
              Contact us
            </p>
            <h3 className="text-3xl font-bold text-slate-900">Send us a message</h3>
            <p className="text-slate-600">
              Tell us what you want to build and we’ll get back to you shortly.
            </p>
          </div>

          <form
            onSubmit={handleContactSubmit}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-6 lg:p-8 space-y-6 shadow-lg"
          >
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="contact-title">
                Title
              </label>
              <Input
                id="contact-title"
                value={contactTitle}
                onChange={(event) => setContactTitle(event.target.value)}
                placeholder="Tell us what you need"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="contact-message">
                Message
              </label>
              <textarea
                id="contact-message"
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                placeholder="Write your message here..."
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
                <p className="text-sm text-red-600">Captcha configuration missing.</p>
              )}
            </div>

            {contactError && (
              <div className="text-sm text-red-600 text-center">{contactError}</div>
            )}
            {contactSuccess && (
              <div className="text-sm text-green-600 text-center">
                Message sent successfully. We’ll be in touch soon.
              </div>
            )}

            <div className="flex justify-center">
              <Button
                type="submit"
                disabled={contactSubmitting}
                className="px-10 py-6 text-base font-semibold rounded-full bg-green-600 text-white shadow-lg shadow-green-200/70 hover:bg-green-600"
              >
                {contactSubmitting ? "Sending..." : "Send message"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="eChatbot"
                className="w-8 h-8 object-contain"
              />
              <span className="text-xs">
                © 2025 eChatbot. All rights reserved.
              </span>
            </div>
            <div className="flex gap-6 text-xs">
              <Link to="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-white">
                Terms of Service
              </Link>
              <Link to="/support" className="hover:text-white">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
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

      {/* WIP Modal - shown when canLogin or canRegister is false */}
      <WIPModal
        isOpen={showWIPModal}
        feature={wipFeature}
        onClose={() => setShowWIPModal(false)}
      />
    </div>
  )
}
