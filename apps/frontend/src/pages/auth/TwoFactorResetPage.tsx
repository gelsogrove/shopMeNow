/**
 * 2FA Reset Page
 * Displayed when user clicks the reset link in their email
 * 
 * FLOW (Feature 189 - Simplified):
 * 1. Admin initiates reset from backoffice
 * 2. User receives email with reset link
 * 3. User clicks link → validates token → gets QR code directly
 * 4. User scans QR code with authenticator app
 * 5. User enters 6-digit code to verify
 * 6. Success → redirect to login
 * 
 * SECURITY:
 * - Token expires in 1 hour
 * - Token is single-use
 * - Email verification is implicit (user received email)
 * - No password needed (supports OAuth users too)
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/lib/toast'
import { Loader2, Shield, AlertCircle, CheckCircle, Smartphone } from 'lucide-react'
import { api } from '@/services/api'
import { logger } from '@/lib/logger'

type Step = 'validating' | 'setup' | 'success' | 'error'

export default function TwoFactorResetPage() {
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()
  
  // Page state
  const [step, setStep] = useState<Step>('validating')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  
  // 2FA setup
  const [qrCodeUri, setQrCodeUri] = useState('')
  const [secret, setSecret] = useState('')
  const [totpCode, setTotpCode] = useState('')

  /**
   * Validate token on mount and get QR code directly
   */
  useEffect(() => {
    if (!token) {
      setStep('error')
      setError('Invalid reset link')
      return
    }

    validateAndGetQRCode()
  }, [token])

  /**
   * Validate token and get QR code in one step
   */
  const validateAndGetQRCode = async () => {
    try {
      // Call the new endpoint that validates and returns QR code
      const response = await api.post(`/auth/2fa-reset/${token}/start`)
      
      if (response.data.success) {
        setMaskedEmail(response.data.email)
        setQrCodeUri(response.data.qrCodeUri)
        setSecret(response.data.secret)
        setStep('setup')
      } else {
        setError(response.data.error || 'Invalid or expired link')
        setStep('error')
      }
    } catch (error: any) {
      logger.error('Token validation failed:', error)
      setError(error.response?.data?.error || 'Invalid or expired link')
      setStep('error')
    }
  }

  /**
   * Complete 2FA setup with TOTP code
   */
  const handleComplete2FA = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.post(`/auth/2fa-reset/${token}/complete`, {
        secret,
        totpCode,
      })

      if (response.data.success) {
        setStep('success')
        toast.success('2FA reset complete!')
      } else {
        setError(response.data.error || 'Invalid verification code')
      }
    } catch (error: any) {
      logger.error('2FA setup failed:', error)
      setError(error.response?.data?.error || 'Failed to complete 2FA setup')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Render based on current step
   */
  const renderStep = () => {
    switch (step) {
      case 'validating':
        return (
          <Card>
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" />
              <p className="mt-4 text-gray-600">Validating your reset link...</p>
            </CardContent>
          </Card>
        )

      case 'setup':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-green-600" />
                Set Up New 2FA
              </CardTitle>
              <CardDescription>
                Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Info Alert */}
              <Alert className="bg-blue-50 border-blue-200">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  Resetting 2FA for: <strong>{maskedEmail}</strong>
                </AlertDescription>
              </Alert>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                {qrCodeUri && (
                  <QRCode 
                    value={qrCodeUri} 
                    size={192}
                    level="M"
                  />
                )}
              </div>

              {/* Verification Code Input */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="totpCode">Enter the 6-digit code from your app</Label>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setTotpCode(value)
                    setError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && totpCode.length === 6 && handleComplete2FA()}
                  className="text-center text-2xl tracking-widest font-mono"
                  disabled={loading}
                  autoFocus
                  autoComplete="off"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter>
              <Button 
                onClick={handleComplete2FA}
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Complete 2FA Setup'
                )}
              </Button>
            </CardFooter>
          </Card>
        )

      case 'success':
        return (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">2FA Reset Complete!</h2>
              <p className="text-gray-600">
                Your two-factor authentication has been successfully reset.
                You can now log in with your new authenticator.
              </p>
              <Button 
                onClick={() => navigate('/')}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        )

      case 'error':
        return (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Link Invalid</h2>
              <p className="text-gray-600">{error}</p>
              <p className="text-sm text-gray-500">
                This link may have expired or already been used.
                Please contact your administrator for a new reset link.
              </p>
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {renderStep()}
      </div>
    </div>
  )
}
