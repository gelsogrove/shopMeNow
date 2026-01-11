import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
import { useLanguage } from "@/contexts/LanguageContext"
import { api } from "@/services/api"
import { Eye, EyeOff } from "lucide-react"
import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"

export function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  
  const token = searchParams.get("token")

  useEffect(() => {
    if (!token) {
      setError(t("resetPassword.invalidLink.desc"))
    }
  }, [token, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setLoading(true)

    if (password !== confirmPassword) {
      setError(t("resetPassword.error.mismatch"))
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError(t("resetPassword.error.minLength"))
      setLoading(false)
      return
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    if (!passwordRegex.test(password)) {
      setError(t("resetPassword.error.strength"))
      setLoading(false)
      return
    }

    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: password,
      })
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/auth/login")
      }, 3000)
    } catch (err) {
      const message =
        (err as any).response?.data?.message ||
        (err as Error).message ||
        t("forgotPassword.error")
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="container flex h-screen items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <CardTitle>{t("resetPassword.invalidLink")}</CardTitle>
            <CardDescription>
              {t("resetPassword.invalidLink.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <a href="/auth/forgot-password" className="text-blue-500 hover:underline">
                {t("resetPassword.requestNew")}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container flex h-screen items-center justify-center">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>{t("resetPassword.title")}</CardTitle>
          <CardDescription>
            {t("resetPassword.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-500">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-50 p-2 text-sm text-green-500">
                {t("resetPassword.success")}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {t("resetPassword.newPassword")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("resetPassword.newPassword.placeholder")}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 focus:border-green-500 focus:outline-none"
                  required
                  disabled={loading || success}
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
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                {t("resetPassword.confirmPassword")}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("resetPassword.confirmPassword.placeholder")}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 focus:border-green-500 focus:outline-none"
                  required
                  disabled={loading || success}
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
            </div>
            <button
              type="submit"
              disabled={loading || success}
              className="w-full rounded-md bg-green-500 py-2 text-white hover:bg-green-600 disabled:bg-gray-400"
            >
              {loading ? t("resetPassword.button.loading") : t("resetPassword.button")}
            </button>
            <div className="text-center text-sm">
              <a href="/auth/login" className="text-blue-500 hover:underline">
                {t("forgotPassword.backToLogin")}
              </a>
            </div>
            <div className="flex gap-4 justify-center text-xs text-gray-500 mt-4">
              <a href="/privacy" className="hover:underline">
                {t("footer.privacy")}
              </a>
              <span>•</span>
              <a href="/terms" className="hover:underline">
                {t("footer.terms")}
              </a>
              <span>•</span>
              <a href="/refund" className="hover:underline">
                {t("refund.title")}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
