import QRCode from "qrcode"
import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "./alert"

interface QRCodeDisplayProps {
  userId: string | null
}

export function QRCodeDisplay({ userId }: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchQRCode = async () => {
      if (!userId) {
        setError("User ID is missing")
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/auth/2fa/setup?userId=${userId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch QR code")
        }

        const { otpAuthUrl } = await response.json()
        const qrCode = await QRCode.toDataURL(otpAuthUrl)
        setQrCodeUrl(qrCode)
      } catch (err) {
        setError("Failed to load QR code")
      } finally {
        setIsLoading(false)
      }
    }

    fetchQRCode()
  }, [userId])

  if (isLoading) {
    return <div className="text-center">Loading QR code...</div>
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <img
        src={qrCodeUrl}
        alt="2FA QR Code"
        className="w-48 h-48 border rounded-lg p-2"
      />
      <p className="text-sm text-muted-foreground text-center">
        Scan this QR code with your authenticator app (e.g., Google
        Authenticator)
      </p>
    </div>
  )
}
