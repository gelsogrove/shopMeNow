/**
 * Verify 2FA Page
 * Displayed during login after credentials verified
 * 
 * FLOW:
 * 1. User enters email/password → credentials verified
 * 2. Redirected here to enter TOTP code
 * 3. Enter 6-digit code from authenticator app
 * 4. On success: create session → redirect to workspace selection
 * 
 * NOTE: Recovery codes have been REMOVED (Feature 189)
 * Users who lose access must contact admin for 2FA reset
 * 
 * SECURITY: Rate limited (3 attempts/15min), account lockout after 5 failures
 * DESIGN: Aligned with RegisterPage (shadcn/ui + Card)
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/lib/toast'
import { Loader2, Shield, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'
import { logger } from '@/lib/logger'
import { storage } from '@/lib/storage'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Verify2FAPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  
  // Get state from login (including returnUrl for invitation flow)
  const { userId, email, provider, returnUrl } = location.state || {}
  
  // 🔗 Determine final redirect URL (invitation flow or default)
  const finalRedirectUrl = returnUrl ? decodeURIComponent(returnUrl) : '/workspace-selection'
  
  // Page state
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  /**
   * Redirect if no state provided
   */
  useEffect(() => {
    if (!userId || !email) {
      toast.error(t('auth.error.invalidVerificationLink'))
      navigate('/')
    }
  }, [userId, email, navigate])

  /**
   * Verify TOTP code
   */
  const handleVerifyTOTP = async () => {
    if (!code || code.length !== 6) {
      setError(t('auth.error.invalid6DigitCode'))
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await api.post('/auth/verify-2fa', {
        userId,
        code,
      })
      
      const { token, sessionId, user } = response.data
      
      // 🛡️ CRITICAL SECURITY: Clear ALL storage before saving new credentials
      logger.info('🧹 [Verify2FA] Clearing ALL storage (localStorage + sessionStorage)')
      storage.clearAppState()
      logger.info('✅ [Verify2FA] Storage cleared completely')
      
      // Store token and user
      if (token) {
        storage.setToken(token)
        logger.info('✅ JWT token saved to localStorage')
      }

      // 🆕 Store sessionId for x-session-id header
      if (sessionId) {
        storage.setSessionId(sessionId)
        logger.info('✅ SessionId saved to sessionStorage')
      }
      
      storage.setUser(user)
      
      toast.success(`Welcome back, ${user.firstName}!`)
      
      // 🔄 CRITICAL: Hard reload instead of navigate() to clear axios cache
      logger.info(`🔄 [Verify2FA] Forcing hard reload to ${finalRedirectUrl}`)
      setTimeout(() => {
        window.location.href = finalRedirectUrl
      }, 200)
    } catch (error: any) {
      const errorData = error.response?.data
      const errorMessage = errorData?.message || 'Codice di verifica non valido'
      
      setError(errorMessage)
      toast.error(errorMessage)
      
      // Update attempts remaining if provided
      if (errorData?.attemptsRemaining !== undefined) {
        setAttemptsRemaining(errorData.attemptsRemaining)
        
        if (errorData.attemptsRemaining === 0) {
          toast.error(t('auth.error.accountLocked'))
          setTimeout(() => navigate('/'), 3000)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6 text-green-600" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Enter the code from your authenticator app
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Account Info */}
            <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Logging in as:</p>
              <p className="font-semibold text-gray-900">{email}</p>
              {provider && provider !== 'email' && (
                <p className="text-xs text-gray-500 mt-1">via {provider}</p>
              )}
            </div>

            {/* TOTP Input */}
            <div className="space-y-2">
              <Label htmlFor="totpCode">Verification Code</Label>
              <Input
                id="totpCode"
                name="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setCode(value)
                  setError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyTOTP()}
                className="text-center text-2xl tracking-widest font-mono"
                disabled={loading}
                autoFocus
                autoComplete="off"
              />
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <p className="text-sm text-orange-600">
                  {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining
                </p>
              )}
            </div>

            {/* Lost Access Help */}
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800">
                <strong>Lost access to your authenticator?</strong><br/>
                Contact your administrator to reset your 2FA. They will send you a secure link to set up a new authenticator.
              </AlertDescription>
            </Alert>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-3">
            <Button 
              onClick={handleVerifyTOTP}
              disabled={loading || code.length < 6}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify and Continue'
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => navigate('/')}
              disabled={loading}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
