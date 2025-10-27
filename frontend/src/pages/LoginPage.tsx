import { NewsUpdates } from "@/components/landing/NewsUpdates"
import { PricingPlans } from "@/components/landing/PricingPlans"
import { PricingSimulatorModal } from "@/components/pricing/PricingSimulatorModal"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/LanguageContext"
import { logger } from "@/lib/logger"
import { zodResolver } from "@hookform/resolvers/zod"
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
} from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import * as z from "zod"
import { toast } from "../lib/toast"
import { auth, getSessionId, setSessionId } from "../services/api"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isValidatingSession, setIsValidatingSession] = useState(true)
  const [showSimulator, setShowSimulator] = useState(false)
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

  // 🆕 AUTO-REDIRECT IF SESSION IS ALREADY VALID
  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      const sessionId = getSessionId()

      // Se NON c'è sessionId, mostra form login
      if (!sessionId) {
        logger.info("🔓 No existing sessionId - showing login form")
        setIsValidatingSession(false)
        return
      }

      // Se c'è sessionId, facciamo redirect diretto (ProtectedRoute farà validazione vera)
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

    // Pulisci la sessionStorage prima del login
    sessionStorage.removeItem("currentWorkspace")
    localStorage.removeItem("user")
    localStorage.removeItem("token") // Remove any old token
    localStorage.removeItem("chat-tab-lock") // Clear tab lock to prevent blocking

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

        // Save user data
        localStorage.setItem("user", JSON.stringify(response.data.user))

        // JWT token is automatically saved as HTTP-only cookie by backend
        logger.info("Login successful - JWT token saved as HTTP-only cookie")

        toast.success("Login successful!")

        // Navigate WITHOUT setTimeout - sessionId is already saved
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

            {/* Login Form Inline - Desktop */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="hidden lg:flex items-center gap-2"
            >
              <Input
                type="email"
                placeholder="Email"
                {...register("email")}
                disabled={isLoading}
                autoComplete="username"
                className={`h-9 w-48 ${
                  error
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : ""
                }`}
              />
              <Input
                type="password"
                placeholder="Password"
                {...register("password")}
                disabled={isLoading}
                autoComplete="current-password"
                className={`h-9 w-36 ${
                  error
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : ""
                }`}
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? "..." : "Sign In"}
              </Button>
            </form>
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
                  <Input
                    id="password-mobile"
                    type="password"
                    placeholder="••••••••"
                    {...register("password")}
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="h-11"
                  />
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
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="text-center text-sm text-slate-600">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="text-primary hover:text-primary/80 underline-offset-4 hover:underline font-medium"
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
    </div>
  )
}
