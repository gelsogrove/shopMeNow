import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AuthLogo } from "@/components/ui/auth-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { logger } from "@/lib/logger"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangle,
  Globe,
  MessageSquare,
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isValidatingSession, setIsValidatingSession] = useState(true)
  const navigate = useNavigate()

  // Prefill credentials only in development
  const isDev = import.meta.env.MODE === "development"

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: isDev ? "admin@shopme.com" : "",
      password: isDev ? "venezia44" : "",
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
    <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
      {/* Left side - Login Form */}
      <div className="flex items-center justify-center py-12 px-4 lg:px-8">
        <div className="mx-auto w-full max-w-[400px] space-y-6">
          <div className="space-y-4 text-center">
            <AuthLogo />
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">ShopMe</h1>
              <p className="text-balance text-muted-foreground">
                Enter your credentials to access your workspace
              </p>
            </div>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
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

            {/* Forgot Password Link - Better positioned */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline"
              >
                Forgot your password?
              </Link>
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="text-primary hover:text-primary/80 underline-offset-4 hover:underline font-medium"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>

      {/* Right side - Enhanced Visual Design */}
      <div className="hidden lg:block relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800"></div>

        {/* Geometric Pattern Overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-20 w-32 h-32 border border-white/20 rounded-full"></div>
            <div className="absolute top-40 right-32 w-24 h-24 border border-white/15 rounded-lg rotate-12"></div>
            <div className="absolute bottom-32 left-16 w-40 h-40 border border-white/10 rounded-full"></div>
            <div className="absolute bottom-20 right-20 w-28 h-28 border border-white/20 rounded-lg -rotate-12"></div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-white p-12">
          {/* Main Logo/Icon */}
          <div className="mb-8 p-4 bg-white/10 rounded-full backdrop-blur-sm">
            <MessageSquare className="w-16 h-16 text-white" />
          </div>

          {/* Main Heading */}
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-center mb-6">
            Power your business
            <span className="block text-blue-200">
              with an AI-driven sales agent
            </span>
          </h2>

          {/* Description */}
          <p className="text-lg text-blue-100 max-w-xl text-center mb-12 leading-relaxed">
            that understands, assists, and sells, directly on WhatsApp.
          </p>

          {/* Feature Icons */}
          <div className="grid grid-cols-3 gap-8 max-w-sm">
            <div className="flex flex-col items-center space-y-3 group">
              <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-blue-100 text-center">
                Smart Sales
              </span>
            </div>
            <div className="flex flex-col items-center space-y-3 group">
              <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-blue-100 text-center">
                AI Powered
              </span>
            </div>
            <div className="flex flex-col items-center space-y-3 group">
              <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-blue-100 text-center">Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
