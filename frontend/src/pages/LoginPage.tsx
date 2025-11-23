import { NewsUpdates } from "@/components/landing/NewsUpdates"
import { PricingPlans } from "@/components/landing/PricingPlans"
import { PricingSimulatorModal } from "@/components/pricing/PricingSimulatorModal"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/LanguageContext"
import { logger } from "@/lib/logger"
import { zodResolver } from "@hookform/resolvers/zod"
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import {
  AlertTriangle,
  Bell,
  Calculator,
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
} from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import * as z from "zod"
import { toast } from "../lib/toast"
import { auth, getSessionId, setSessionId, api } from "../services/api"

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
  const [showSimulator, setShowSimulator] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin')
  
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
      email: isDev ? "admin@shopme.com" : "",
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

  // 🆕 AUTO-REDIRECT IF SESSION IS ALREADY VALID
  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      const sessionId = getSessionId()
      const token = localStorage.getItem('token')

      // Se NON c'è sessionId O token, mostra form login
      if (!sessionId || !token) {
        logger.info("🔓 No existing sessionId/token - showing login form", { sessionId: !!sessionId, token: !!token })
        setIsValidatingSession(false)
        return
      }

      // 🚨 CRITICAL FIX: Non fare redirect automatico se siamo in fase di registrazione
      // Questo previene il loop: registrazione → storage cleared → checkExistingSession trova sessionId vecchio → redirect
      const isInAuthFlow = window.location.pathname.includes('/auth/')
      if (isInAuthFlow) {
        logger.info("🔒 In auth flow - skipping auto-redirect", { pathname: window.location.pathname })
        setIsValidatingSession(false)
        return
      }

      // Se c'è sessionId e token VALIDI, facciamo redirect
      logger.info(
        `✅ SessionId found: ${sessionId.substring(
          0,
          8
        )}... - redirecting to workspace selection`
      )
      toast.success("Sessione già attiva, reindirizzamento...")
      navigate("/workspace-selection", { replace: true })
    } catch (error: any) {
      logger.error("❌ Error checking session:", error)
      setIsValidatingSession(false)
    }
  }

  const onSubmit = async (data: LoginForm) => {
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

      if (response.data && response.data.user) {
        // 🆕 SAVE SESSION ID FROM RESPONSE FIRST (BEFORE navigate!)
        if (response.data.sessionId) {
          setSessionId(response.data.sessionId)
          logger.info(
            `✅ SessionID saved to sessionStorage: ${response.data.sessionId.substring(
              0,
              8
            )}...`
          )
        } else {
          logger.error("❌ No sessionId in login response!")
          throw new Error("No sessionId in login response")
        }

        // 🆕 SAVE JWT TOKEN for Authorization header (proxy-safe)
        if (response.data.token) {
          localStorage.setItem("token", response.data.token)
          logger.info(`✅ JWT token saved to localStorage`)
        } else {
          logger.warn("⚠️ No JWT token in login response (cookie-only mode)")
        }

        // Save user data
        localStorage.setItem("user", JSON.stringify(response.data.user))

        // JWT token is automatically saved as HTTP-only cookie by backend
        logger.info("Login successful - JWT token saved as HTTP-only cookie")

        toast.success("Credentials verified! Please enter 2FA code.")

        // Redirect to 2FA verification page
        navigate("/auth/verify-2fa", {
          state: {
            userId: response.data.user.id,
            email: response.data.user.email,
            provider: 'email',
          },
        })
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
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('📝 [REGISTER] STEP 1: Form submitted', { email: data.email, firstName: data.firstName, lastName: data.lastName })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    setError("")
    setIsLoading(true)

    // 🛡️ CRITICAL SECURITY: Clear ALL storage to prevent session/workspace leakage
    logger.info("🧹 [REGISTER] STEP 2: Clearing ALL storage (localStorage + sessionStorage)")
    const beforeClear = {
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
    }
    logger.info("📦 [REGISTER] Storage BEFORE clear:", beforeClear)
    
    localStorage.clear()
    sessionStorage.clear()
    
    const afterClear = {
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
    }
    logger.info("✅ [REGISTER] Storage AFTER clear:", afterClear)

    try {
      logger.info('🌐 [REGISTER] STEP 3: Calling POST /auth/register API')
      const response = await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        gdprAccepted: data.gdprAccepted,
      })

      logger.info('✅ [REGISTER] STEP 4: Registration API success', {
        status: response.status,
        userId: response.data.user?.id,
        hasQrCode: !!response.data.qrCode,
      })

      const { user, qrCode } = response.data

      // 🔒 SECURITY: No sessionId or token from registration
      // User MUST verify 2FA first to get authenticated

      toast.success('Account created! Please setup 2FA.')
      
      logger.info('🔄 [REGISTER] STEP 5: Navigating to /auth/setup-2fa', {
        userId: user.id,
        email: user.email,
        qrCodeLength: qrCode?.length,
      })
      
      navigate('/auth/setup-2fa', {
        state: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          qrCode,
          provider: 'email',
        },
      })
      
      logger.info('✅ [REGISTER] STEP 6: Navigate completed successfully')
    } catch (err: any) {
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      logger.error('❌ [REGISTER] ERROR at some step:', err)
      logger.error('❌ [REGISTER] Full error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message,
        stack: err.stack,
        url: err.config?.url,
        method: err.config?.method,
      })
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please try again.'

      setError(errorMsg)
      toast.error(errorMsg)
      
      logger.info('🔒 [REGISTER] STEP ERROR: Staying on registration page - NO redirect')
    } finally {
      setIsLoading(false)
      logger.info('🏁 [REGISTER] Flow completed (success or error)')
    }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🔐 [GOOGLE OAUTH] STEP 1: Google credential received')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    setIsLoading(true)
    
    // 🛡️ CRITICAL SECURITY: Clear ALL storage to prevent session/workspace leakage
    logger.info("🧹 [GOOGLE OAUTH] STEP 2: Clearing ALL storage (localStorage + sessionStorage)")
    const beforeClear = {
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
    }
    logger.info("📦 [GOOGLE OAUTH] Storage BEFORE clear:", beforeClear)
    
    localStorage.clear()
    sessionStorage.clear()
    
    const afterClear = {
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
    }
    logger.info("✅ [GOOGLE OAUTH] Storage AFTER clear:", afterClear)
    
    try {
      logger.info('🌐 [GOOGLE OAUTH] STEP 3: Calling POST /auth/oauth/google API')
      const response = await api.post('/auth/oauth/google', {
        credential: credentialResponse.credential,
      })
      
      logger.info('✅ [GOOGLE OAUTH] STEP 4: API success', {
        status: response.status,
        userId: response.data.user?.id,
        requiresSetup: response.data.requiresSetup,
        hasQrCode: !!response.data.qrCode,
        hasSessionId: !!response.data.sessionId,
        hasToken: !!response.data.token,
      })
      
      const { user, requiresSetup, qrCode, sessionId, token } = response.data
      
      logger.info('💾 [GOOGLE OAUTH] STEP 5: Saving authentication data to storage')
      
      if (sessionId) {
        logger.info(`  → SessionId: ${sessionId.substring(0, 8)}...`)
        setSessionId(sessionId)
      } else {
        logger.warn('  ⚠️ No sessionId in response!')
      }
      
      if (token) {
        logger.info(`  → Token: ${token.substring(0, 30)}...`)
        localStorage.setItem('token', token)
        
        // Verify save immediately
        const savedToken = localStorage.getItem('token')
        if (savedToken === token) {
          logger.info('  ✅ Token saved and verified')
        } else {
          logger.error('  ❌ Token save FAILED - mismatch!')
        }
      } else {
        logger.warn('  ⚠️ No token in response!')
      }
      
      logger.info(`  → User data saved`)
      localStorage.setItem('user', JSON.stringify(user))
      
      if (requiresSetup) {
        logger.info('🔄 [GOOGLE OAUTH] STEP 6a: Navigating to /auth/setup-2fa (new user)')
        toast.success('Welcome! Please setup 2FA.')
        navigate('/auth/setup-2fa', {
          state: {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            qrCode,
            provider: 'google',
          },
        })
      } else {
        logger.info('🔄 [GOOGLE OAUTH] STEP 6b: Navigating to /auth/verify-2fa (existing user)')
        toast.success('Google login successful! Please enter 2FA code.')
        navigate('/auth/verify-2fa', {
          state: {
            userId: user.id,
            email: user.email,
            provider: 'google',
          },
        })
      }
      
      logger.info('✅ [GOOGLE OAUTH] STEP 7: Navigate completed successfully')
    } catch (error: any) {
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      logger.error('❌ [GOOGLE OAUTH] ERROR at some step:', error)
      logger.error('❌ [GOOGLE OAUTH] Full error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        stack: error.stack,
        url: error.config?.url,
        method: error.config?.method,
      })
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      toast.error('Google login failed. Please try again.')
    } finally {
      setIsLoading(false)
      logger.info('🏁 [GOOGLE OAUTH] Flow completed (success or error)')
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

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header with Logo */}
      <header className="w-full py-1 px-4 lg:px-8 bg-gradient-to-r from-white via-green-50/30 to-emerald-50/40 backdrop-blur-sm border-b border-green-100/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Language Selector - Top right */}
          <div className="flex justify-end mb-1">
            <LanguageSelector />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <img
                src="/logo.png"
                alt="ShopMe Logo"
                className="w-32 h-32 object-contain"
              />
              <div>
                <h1 className="text-3xl font-bold text-slate-900">ShopMe</h1>
                <p className="text-base text-slate-600">
                  {t("header.tagline")}
                </p>
              </div>
            </div>

            {/* Sign In / Register Buttons - Desktop */}
            <div className="hidden lg:flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  logger.info('🖱️ [SIGN IN BUTTON] Clicked - clearing storage')
                  localStorage.clear()
                  sessionStorage.clear()
                  logger.info('✅ [SIGN IN BUTTON] Storage cleared, opening modal')
                  setActiveTab('signin')
                  setShowLoginModal(true)
                }}
                className="bg-green-600 hover:bg-green-700 px-6"
              >
                {t("login.signin")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  logger.info('🖱️ [REGISTER BUTTON] Clicked - clearing storage')
                  localStorage.clear()
                  sessionStorage.clear()
                  logger.info('✅ [REGISTER BUTTON] Storage cleared, opening modal')
                  setActiveTab('register')
                  setShowLoginModal(true)
                }}
                className="border-green-600 text-green-600 hover:bg-green-50 px-6"
              >
                {t("login.register")}
              </Button>
            </div>
          </div>
          
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-10">
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

        {/* Two Columns: Why ShopMe (Left) + Video (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Why ShopMe Features */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("hero.whyTitle")}
            </h3>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-200">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {t("features.24x7")}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {t("features.24x7.desc")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-200">
                <div className="p-2 rounded-lg bg-green-100">
                  <Bell className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {t("features.pushNotifications")}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {t("features.pushNotifications.desc")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-200">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Globe className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {t("features.multiLanguage")}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {t("features.multiLanguage.desc")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-200">
                <div className="p-2 rounded-lg bg-blue-100">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {t("features.ecommerce")}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {t("features.ecommerce.desc")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Video */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
            <video className="w-full h-auto" controls>
              <source src="/video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>

        {/* Login Form Section - Mobile Only */}
        <div
          id="login-form-mobile"
          className="max-w-md mx-auto mt-12 lg:hidden"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">Sign In</h3>
                <p className="text-slate-600">Access your ShopMe workspace</p>
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

              <div className="text-center text-sm text-slate-600">
                Don't have an account?{" "}
                <Link
                  to="/auth/register"
                  className="text-green-600 hover:text-green-700 underline-offset-4 hover:underline font-medium"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* News & Updates Section */}
      <NewsUpdates />

      {/* Pricing Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 bg-gradient-to-b from-white to-slate-50">
        <PricingPlans />

        {/* Simulator Button - Centered below pricing */}
        <div className="text-center mt-12">
          <Button
            onClick={() => setShowSimulator(true)}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <Calculator className="w-5 h-5 mr-2" />
            {t("pricing.simulator.button")}
          </Button>
          <p className="text-sm text-slate-600 mt-3">
            {t("pricing.simulator.description")}
          </p>
        </div>
      </div>

      {/* Pricing Simulator Modal */}
      <PricingSimulatorModal
        open={showSimulator}
        onOpenChange={setShowSimulator}
        t={t}
      />

      {/* Contact Section */}
      <div className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h3 className="text-2xl font-bold">Get in Touch</h3>
            <p className="text-slate-300">
              Have questions? We're here to help you get started with ShopMe.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6 pt-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-green-400" />
                <a
                  href="mailto:info@shopme.com"
                  className="text-slate-300 hover:text-white"
                >
                  info@shopme.com
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-green-400" />
                <a
                  href="tel:+1234567890"
                  className="text-slate-300 hover:text-white"
                >
                  +1 (234) 567-890
                </a>
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
                alt="ShopMe"
                className="w-8 h-8 object-contain"
              />
              <span className="text-xs">
                © 2025 ShopMe. All rights reserved.
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
                        disabled={isLoading}
                        autoComplete="email"
                        className="h-11"
                      />
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
    </div>
  )
}
