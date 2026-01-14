import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { storage } from "@/lib/storage"
import { api } from "@/services/api"

export function VerifyOtpPage() {
  const [searchParams] = useSearchParams()
  const userId = searchParams.get("userId")
  const [qrCode, setQrCode] = useState("")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) {
      navigate("/")
      return
    }

    // Fetch QR code for 2FA setup
    api
      .get("/auth/2fa/setup", { params: { userId } })
      .then((response) => {
        if (response.data?.qrCode) {
          setQrCode(response.data.qrCode)
        }
      })
      .catch(() => {
        setError("Failed to load QR code")
      })
  }, [userId, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const response = await api.post("/auth/2fa/verify", { userId, otp })
      const data = response.data

      // 🛡️ CRITICAL SECURITY: Clear ALL storage before saving new credentials
      storage.clearAppState()
      
      // Store the token and redirect to workspace selection
      storage.setToken(data.token)
      navigate("/workspace-selection")
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
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app and enter the code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-500">
                {error}
              </div>
            )}
            {qrCode && (
              <div className="flex justify-center mb-4">
                <img src={qrCode} alt="QR Code for 2FA" className="w-48 h-48" />
              </div>
            )}
            <div className="space-y-2">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none"
                required
                pattern="[0-9]{6}"
                maxLength={6}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-green-500 py-2 text-white hover:bg-green-600"
            >
              Verify Code
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
