import { NewsUpdates } from "@/components/landing/NewsUpdates"
import { PricingPlans } from "@/components/landing/PricingPlans"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
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
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/LanguageContext"
import { useFeatureFlags } from "@/hooks/usePlatformConfig"
import { logger } from "@/lib/logger"
import { zodResolver } from "@hookform/resolvers/zod"
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
  Zap,
  Chrome,
  Loader2,
  Eye,
  EyeOff,
  MessageSquare,
  LogOut,
  User,
  Crown,
  CreditCard,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import * as z from "zod"
import { toast } from "../lib/toast"
import { auth, api } from "../services/api"
import { workspaceApi } from "../services/workspaceApi"

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com'

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

export function LoginPage() {
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isValidatingSession, setIsValidatingSession] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin')
  const [isAdminAccess, setIsAdminAccess] = useState(false) // 🔐 Admin bypass for WIP mode
  
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
    planType?: string | null;
    trialEndsAt?: string | null;
  } | null>(null)
  
  // 🚀 Platform feature flags (canLogin, canRegister)
  const { canLogin, canRegister, isLoading: flagsLoading } = useFeatureFlags()
  const [showWIPModal, setShowWIPModal] = useState(false)
  const [wipFeature, setWipFeature] = useState<'login' | 'register'>('login')
  
  // 🔗 Extract returnUrl from query params (for invitation flow)
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const actionParam = searchParams.get('action') // 🆕 For auto-opening register modal
  const modeParam = searchParams.get('mode') // 🆕 For invite flow: 'register' opens register tab
  const inviteParam = searchParams.get('invite') // 🆕 For invite flow: pre-fill email from invite
  const logoutParam = searchParams.get('logout') // 🆕 For forcing logout from backoffice
  
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
    mode: "onBlur",
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
      localStorage.clear()
      sessionStorage.clear()
      // Remove the logout param from URL to prevent re-logout on refresh
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('logout')
      window.history.replaceState({}, '', newUrl.toString())
      setIsLoggedIn(false)
      setLoggedInUser(null)
      setIsValidatingSession(false)
      return
    }
    
    const existingToken = localStorage.getItem('token')
    
    // If user already has a token, show avatar instead of login buttons (DON'T redirect)
    if (existingToken) {
      logger.info('👤 [LOGIN PAGE] Token exists - showing user avatar in header')
      // Load user data from localStorage
      const cachedUser = localStorage.getItem('user')
      if (cachedUser) {
        try {
          const userData = JSON.parse(cachedUser)
          setLoggedInUser(userData)
          setIsLoggedIn(true)
          setAvatarImageError(false) // Reset image error when loading user
          logger.info('✅ [LOGIN PAGE] User loaded:', userData.email)
          
          // Fetch workspaces to get plan info - use first workspace (same as WorkspaceSelectionPage)
          workspaceApi.getAll().then(workspaces => {
            if (workspaces && workspaces.length > 0) {
              // Use the FIRST workspace (consistent with WorkspaceSelectionPage)
              const firstWs = workspaces[0]
              
              setUserPlan({
                planType: firstWs.planType,
                trialEndsAt: firstWs.trialEndsAt,
              })
              logger.info('👑 [LOGIN PAGE] Plan loaded:', firstWs.planType, 'from workspace:', firstWs.id)
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
    localStorage.removeItem('currentWorkspace')
    localStorage.removeItem('user')
    sessionStorage.clear()
    logger.info('✅ [LOGIN PAGE LOAD] Storage cleared - ready for fresh login')
    setIsValidatingSession(false)
  }, [navigate, logoutParam]) // Run only once on mount, or when logout param changes

  // 🆕 AUTO-OPEN REGISTER MODAL if ?action=register or ?mode=register parameter is present
  useEffect(() => {
    if (actionParam === 'register' || modeParam === 'register') {
      // 🚫 If registration is disabled, show WIP modal instead
      if (!canRegister && !flagsLoading) {
        logger.info('🚫 [AUTO-OPEN] Registration disabled - showing WIP modal')
        setWipFeature('register')
        setShowWIPModal(true)
        return
      }
      
      logger.info('🎯 [AUTO-OPEN] Detected register mode - opening registration modal')
      setShowLoginModal(true)
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

  // 🆕 Session check is now done in the first useEffect above
  // No auto-redirect - we show avatar instead if user is logged in

  const onSubmit = async (data: LoginForm) => {
    // 🚀 Check if login is enabled (bypass if admin access mode)
    if (!canLogin && !isAdminAccess) {
      setWipFeature('login')
      setShowWIPModal(true)
      return
    }
    
    setError("")
    setIsLoading(true)

    // 🛡️ CRITICAL SECURITY: Clear ALL storage to prevent session/workspace leakage
    logger.info("🧹 [LOGIN] Clearing ALL storage (localStorage + sessionStorage)")
    localStorage.clear()
    sessionStorage.clear()
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
          localStorage.setItem("token", response.data.token)
          logger.info(`✅ JWT token saved to localStorage`)
        } else {
          logger.warn("⚠️ No JWT token in login response (cookie-only mode)")
        }

        // 🆕 SAVE SESSION ID for x-session-id header
        // Using localStorage to persist across page refreshes
        if (response.data.sessionId) {
          localStorage.setItem("sessionId", response.data.sessionId)
          logger.info(`✅ SessionId saved to localStorage`)
        } else {
          logger.warn("⚠️ No sessionId in login response")
        }

        // Save user data
        localStorage.setItem("user", JSON.stringify(response.data.user))

        // JWT token is automatically saved as HTTP-only cookie by backend
        logger.info("Login successful - JWT token saved as HTTP-only cookie")

        // 🔐 Platform Admin redirect to Backoffice
        if (response.data.user.isPlatformAdmin) {
          logger.info("🔐 Platform Admin detected - redirecting to Backoffice")
          // Use direct URL to backoffice (proxy doesn't work for full page navigation)
          const backofficeUrl = 'http://localhost:3002'
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
    if (!canRegister) {
      setWipFeature('register')
      setShowWIPModal(true)
      return
    }
    
    logger.info('📝 [REGISTER] Starting registration', { email: data.email })
    
    setError("")
    setIsLoading(true)

    // 🛡️ CRITICAL SECURITY: Clear ALL storage to prevent session/workspace leakage
    logger.info("🧹 [REGISTER] Clearing storage")
    localStorage.clear()
    sessionStorage.clear()

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
    localStorage.clear()
    // 🛡️ CRITICAL SECURITY: Clear ALL storage before OAuth flow
    logger.info('🧹 [GOOGLE OAUTH] Clearing ALL storage (localStorage + sessionStorage)')
    localStorage.clear()
    sessionStorage.clear()
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
        localStorage.setItem('token', token)
        sessionStorage.setItem('sessionId', sessionId)
        localStorage.setItem('user', JSON.stringify(user))
        
        toast.success('Login successful!')
        
        // 🔐 Platform Admin redirect to Backoffice
        if (user.isPlatformAdmin) {
          logger.info('🔐 [GOOGLE OAUTH] Platform Admin detected - redirecting to Backoffice')
          // Use direct URL to backoffice (proxy doesn't work well for full page navigation)
          const backofficeUrl = 'http://localhost:3002'
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
      localStorage.setItem('user', JSON.stringify(user))
      
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

  // 🚧 Check if WIP mode is active
  const isWipMode = !flagsLoading && !canLogin && !canRegister

  // 🚧 WIP MODE: Show simple page with hidden admin access
  if (isWipMode && !showLoginModal) {
    return (
      <>
        <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
          <div className="text-center mb-12 w-full">
            
            <h1 style={{ fontSize: '120px' }} className="font-bold text-slate-900">eChatbot</h1>
          </div>
          <div className="max-w-lg w-full">

            {/* WIP Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-amber-100 rounded-full flex items-center justify-center">
                <svg 
                  className="w-10 h-10 text-amber-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Work in Progress
              </h2>
              
              <p className="text-slate-600 mb-6">
                We're working hard to bring you something amazing. 
                Please check back soon!
              </p>

              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span>Coming Soon</span>
              </div>
              
              {/* 🔐 Hidden Admin Access - small link for platform admins */}
              <button
                onClick={() => {
                  localStorage.clear()
                  sessionStorage.clear()
                  setActiveTab('signin')
                  setIsAdminAccess(true) // 🔐 Enable admin bypass
                  setShowLoginModal(true)
                }}
                className="mt-6 text-xs text-slate-400 hover:text-slate-600 underline opacity-50 hover:opacity-100 transition-opacity"
              >
                Admin Access
              </button>
            </div>

            {/* Footer */}
            <p className="text-center text-sm text-slate-400 mt-8">
              © 2025 eChatbot. All rights reserved.
            </p>
          </div>
        </div>
      </>
    )
  }

  // 🚧 WIP MODE with Modal Open: Show modal overlay on top of WIP page
  if (isWipMode && showLoginModal) {
    return (
      <>
        {/* Background - WIP Page */}
        <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <div className="max-w-lg w-full opacity-30">
            
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Work in Progress</h2>
            </div>
          </div>
        </div>

        {/* Login Modal */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <div className="p-8">
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowLoginModal(false)
                  setIsAdminAccess(false) // 🔐 Reset admin bypass
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                ×
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Admin Access</h3>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Sign In Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-admin">{t("form.email")}</Label>
                  <Input
                    id="email-admin"
                    type="email"
                    placeholder="your@email.com"
                    {...register("email")}
                    disabled={isLoading}
                    autoComplete="username"
                    className="h-11"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password-admin">{t("form.password")}</Label>
                  <div className="relative">
                    <Input
                      id="password-admin"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...register("password")}
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-green-600 hover:bg-green-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("login.signingIn")}
                    </>
                  ) : (
                    t("login.signin")
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t"></span>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Google OAuth */}
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <div className="flex justify-center">
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
              </GoogleOAuthProvider>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header - Professional Design */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 lg:px-12">
          {/* Main Header Row */}
          <div className="flex items-center justify-between h-24">
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
              {/* Language Flags - Inline in header */}
              <div className="hidden sm:block">
                <LanguageSelector />
              </div>
              
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
                          ? `Free Trial ${userPlan?.trialEndsAt ? Math.max(0, Math.ceil((new Date(userPlan.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0}d` 
                          : userPlan.planType === 'BASIC' ? 'Basic'
                          : userPlan.planType === 'PREMIUM' ? 'Premium'
                          : 'Enterprise'}
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
                          localStorage.clear()
                          sessionStorage.clear()
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
              ) : (
                /* Login/Register buttons for non-logged users */
                <div className="flex items-center gap-3">
                  {canLogin && (
                    <Button
                      onClick={() => {
                        localStorage.clear()
                        sessionStorage.clear()
                        setActiveTab('signin')
                        setShowLoginModal(true)
                      }}
                      className="bg-green-600 hover:bg-green-700 px-5 py-2 text-sm font-medium"
                    >
                      {t("login.signin")}
                    </Button>
                  )}
                  {canRegister && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        localStorage.clear()
                        sessionStorage.clear()
                        setActiveTab('register')
                        setShowLoginModal(true)
                      }}
                      className="border-green-600 text-green-600 hover:bg-green-50 px-5 py-2 text-sm font-medium"
                    >
                      {t("login.register")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Language Selector - Below main row on small screens */}
          <div className="sm:hidden pb-3 flex justify-end">
            <LanguageSelector />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Hero Text - Full Width */}
        <div className="space-y-3 mb-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">
              {t("hero.title")}
            </span>
          </h2>
          <p className="text-base text-slate-600 leading-relaxed">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Two Columns: Why eChatbot (Left) + Video (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column - Why eChatbot Features */}
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-6 text-center lg:text-left">
              {t("hero.whyTitle")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="group p-5 rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 hover:shadow-lg hover:border-purple-200 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-slate-900 text-base mb-1">
                  {t("features.24x7")}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {t("features.24x7.desc")}
                </p>
              </div>

              <div className="group p-5 rounded-2xl bg-gradient-to-br from-green-50 to-white border border-green-100 hover:shadow-lg hover:border-green-200 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-slate-900 text-base mb-1">
                  {t("features.pushNotifications")}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {t("features.pushNotifications.desc")}
                </p>
              </div>

              <div className="group p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-white border border-orange-100 hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-slate-900 text-base mb-1">
                  {t("features.multiLanguage")}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {t("features.multiLanguage.desc")}
                </p>
              </div>

              <div className="group p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-slate-900 text-base mb-1">
                  {t("features.ecommerce")}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {t("features.ecommerce.desc")}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Image */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
            <img 
              src="/home.png" 
              alt="eChatbot Dashboard" 
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Login Form Section - Mobile Only */}
        {canLogin && !isLoggedIn && (
          <div
            id="login-form-mobile"
            className="max-w-md mx-auto mt-12 lg:hidden"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900">Sign In</h3>
                  <p className="text-slate-600">Access your eChatbot workspace</p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Login Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-mobile">Email</Label>
                    <Input
                      id="email-mobile"
                      type="email"
                      placeholder="your@email.com"
                      {...register("email")}
                      disabled={isLoading}
                      autoComplete="username"
                      className="h-11"
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                <div className="space-y-2">
                  <Label htmlFor="password-mobile">Password</Label>
                  <div className="relative">
                    <Input
                      id="password-mobile"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...register("password")}
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-green-600 hover:bg-green-700"
                  disabled={isLoading}
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

              {/* OAuth Options - Mobile */}
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>

                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                  <div className="flex justify-center">
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
                </GoogleOAuthProvider>
              </div>

              {canRegister && (
                <div className="text-center text-sm text-slate-600">
                  Don't have an account?{" "}
                  <Link
                    to="/auth/register"
                    className="text-green-600 hover:text-green-700 underline-offset-4 hover:underline font-medium"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* News & Updates Section */}
      <NewsUpdates />

      {/* Pricing Section */}
      <div className="py-16 bg-gradient-to-br from-blue-50 via-white to-green-50">
        <PricingPlans onStartFreeTrial={() => {
          if (!canRegister) {
            setWipFeature('register')
            setShowWIPModal(true)
            return
          }
          setActiveTab('register')
          setShowLoginModal(true)
        }} />
      </div>

      {/* Contact Section */}
      <div className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h3 className="text-2xl font-bold">Get in Touch</h3>
            <p className="text-slate-300">
              Have questions? We're here to help you get started with eChatbot.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6 pt-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-green-400" />
                <a
                  href="mailto:info@echatbot.ai"
                  className="text-slate-300 hover:text-white"
                >
                  info@echatbot.ai
                </a>
              </div>
              <div className="flex items-center gap-3">
                 
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-green-400" />
                <span className="text-slate-300">Tech City, TC 12345</span>
              </div>
            </div>
          </div>
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
        href="https://wa.me/1234567890"
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
          Chat with us!
        </span>
      </a>

      {/* Login Modal - Rendered at page level for proper z-index */}
      {showLoginModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative"
          >
            <div className="p-8">
              {/* Close Button */}
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                ×
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">
                  {activeTab === 'signin' ? t("login.welcomeBack") : t("register.createAccount")}
                </h3>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Sign In Form */}
              {activeTab === 'signin' && (
                <>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-modal">{t("form.email")}</Label>
                      <Input
                        id="email-modal"
                        type="email"
                        placeholder="your@email.com"
                        {...register("email")}
                        disabled={isLoading}
                        autoComplete="username"
                        className="h-11"
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500">{errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password-modal">{t("form.password")}</Label>
                      <div className="relative">
                        <Input
                          id="password-modal"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...register("password")}
                          disabled={isLoading}
                          autoComplete="current-password"
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-red-500">{errors.password.message}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Link
                        to="/auth/forgot-password"
                        className="text-sm text-green-600 hover:text-green-700 underline-offset-4 hover:underline"
                        onClick={() => setShowLoginModal(false)}
                      >
                        {t("login.forgotPassword")}
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-green-600 hover:bg-green-700"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("login.signingIn")}
                        </>
                      ) : (
                        t("login.signin")
                      )}
                    </Button>
                  </form>
                </>
              )}

              {/* Register Form */}
              {activeTab === 'register' && (
                <>
                  {/* Invitation welcome message */}
                  {inviteData && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">{inviteData.invitedByName}</span> has invited you to join{' '}
                        <span className="font-medium">{inviteData.workspaceName}</span>. 
                        Create your account to accept the invitation.
                      </p>
                    </div>
                  )}
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">{t("form.firstName")}</Label>
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="John"
                          {...registerForm.register("firstName")}
                          disabled={isLoading}
                          className="h-11"
                        />
                        {registerForm.formState.errors.firstName && (
                          <p className="text-sm text-red-500">{registerForm.formState.errors.firstName.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">{t("form.lastName")}</Label>
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Doe"
                          {...registerForm.register("lastName")}
                          disabled={isLoading}
                          className="h-11"
                        />
                        {registerForm.formState.errors.lastName && (
                          <p className="text-sm text-red-500">{registerForm.formState.errors.lastName.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email-register">{t("form.email")}</Label>
                      <Input
                        id="email-register"
                        type="email"
                        placeholder="your@email.com"
                        {...registerForm.register("email")}
                        disabled={isLoading || !!inviteData?.email}
                        readOnly={!!inviteData?.email}
                        autoComplete="email"
                        className={`h-11 ${inviteData?.email ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      />
                      {inviteData?.email && (
                        <p className="text-xs text-gray-500">Email is pre-filled from your invitation</p>
                      )}
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-red-500">{registerForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password-register">{t("form.password")}</Label>
                      <div className="relative">
                        <Input
                          id="password-register"
                          type={showPasswordRegister ? "text" : "password"}
                          placeholder="••••••••"
                          {...registerForm.register("password")}
                          disabled={isLoading}
                          autoComplete="new-password"
                          className="h-11 pr-10"
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
                      <p className="text-xs text-gray-500">
                        {t("register.passwordHint")}
                      </p>
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-red-500">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">{t("form.confirmPassword")}</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...registerForm.register("confirmPassword")}
                          disabled={isLoading}
                          autoComplete="new-password"
                          className="h-11 pr-10"
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
                        <p className="text-sm text-red-500">{registerForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>

                    <div className="flex items-start gap-2">
                      <Checkbox 
                        id="gdpr" 
                        checked={registerForm.watch("gdprAccepted")}
                        onCheckedChange={async (checked) => {
                          registerForm.setValue("gdprAccepted", checked as boolean)
                          // Force immediate validation
                          await registerForm.trigger("gdprAccepted")
                        }}
                      />
                      <label 
                        htmlFor="gdpr" 
                        className="text-sm text-gray-600 leading-tight cursor-pointer"
                        onClick={async () => {
                          const current = registerForm.getValues("gdprAccepted")
                          registerForm.setValue("gdprAccepted", !current)
                          // Force immediate validation
                          await registerForm.trigger("gdprAccepted")
                        }}
                      >
                        {t("register.gdprAccept")}{" "}
                        <Link to="/privacy" className="text-green-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {t("register.privacyPolicy")}
                        </Link>{" "}
                        {t("register.and")}{" "}
                        <Link to="/terms" className="text-green-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {t("register.termsOfService")}
                        </Link>
                      </label>
                    </div>
                    {registerForm.formState.errors.gdprAccepted && (
                      <p className="text-sm text-red-500">{registerForm.formState.errors.gdprAccepted.message}</p>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 bg-green-600 hover:bg-green-700"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("register.creatingAccount")}
                        </>
                      ) : (
                        t("register.createAccount")
                      )}
                    </Button>
                  </form>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-2 text-gray-500">{t("login.orContinueWith")}</span>
                    </div>
                  </div>

                  {/* OAuth Buttons */}
                  <div className="space-y-3">
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <div className="flex justify-center">
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
                    </GoogleOAuthProvider>
                  </div>
                </>
              )}

              {/* Divider - Only for Sign In */}
              {activeTab === 'signin' && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-2 text-gray-500">{t("login.orContinueWith")}</span>
                    </div>
                  </div>

                  {/* OAuth Buttons - Sign In */}
                  <div className="space-y-3">
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <div className="flex justify-center">
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
                    </GoogleOAuthProvider>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* WIP Modal - shown when canLogin or canRegister is false */}
      <WIPModal
        isOpen={showWIPModal}
        feature={wipFeature}
        onClose={() => setShowWIPModal(false)}
        showBackHome={true}
        onBackHome={() => {
          setShowWIPModal(false)
          setShowLoginModal(false)
        }}
      />
    </div>
  )
}
