import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
import { api } from "@/services/api"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gdprAccepted, setGdprAccepted] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!gdprAccepted) {
      setError("You must accept the GDPR policy to register.");
      return;
    }
    try {
      const response = await api.post("/auth/register", {
        email,
        password,
        firstName,
        lastName,
        gdprAccepted,
      })
      const data = response.data
      // Se la registrazione ha successo, reindirizza alla pagina di verifica OTP
      navigate(`/auth/verify-otp?userId=${data.userId}`)
    } catch (err) {
      const message =
        (err as any).response?.data?.message ||
        (err as Error).message ||
        "An error occurred"
      setError(message)
    }
  }

  return (
    <div className="container flex h-screen items-center justify-center">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up for a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-500">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@echatbot.ai"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={gdprAccepted}
                onChange={(e) => setGdprAccepted(e.target.checked)}
                id="gdpr"
                required
              />
              <label htmlFor="gdpr" className="text-sm">I accept the GDPR policy</label>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-green-500 py-2 text-white hover:bg-green-600"
            >
              Sign Up
            </button>
            <div className="text-center text-sm">
              <a href="/" className="text-blue-500 hover:underline">
                Already have an account? Sign in
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
