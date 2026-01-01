/**
 * Setup 2FA Page
 * Displayed after registration to configure TOTP 2FA
 * 
 * FLOW:
 * 1. Display QR code from registration response
 * 2. User scans with Google Authenticator
 * 3. User enters 6-digit code to verify
 * 4. Redirect to workspace selection
 * 
 * NOTE: Recovery codes have been REMOVED (Feature 189)
 * Users who lose access must contact admin for 2FA reset
 * 
 * DESIGN: Aligned with RegisterPage (shadcn/ui + Card)
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from '@/lib/toast'
import { logger } from '@/lib/logger'
import { storage } from '@/lib/storage'
import { Loader2, CheckCircle, AlertCircle, Smartphone } from 'lucide-react'
import { api } from '@/services/api'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Setup2FAPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  
  // Get state from registration (including returnUrl for invitation flow)
  const { userId, email, firstName, qrCode, provider, returnUrl } = location.state || {}
  
  // 🔗 Determine final redirect URL (invitation flow or default)
  const finalRedirectUrl = returnUrl ? decodeURIComponent(returnUrl) : '/workspace-selection'
  
  // Page state
  const [step, setStep] = useState<'scan' | 'verify'>('scan')
  const [loading, setLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')

  /**
   * Redirect if no state provided
   */
  useEffect(() => {
    if (!userId || !qrCode) {
      toast.error('Invalid setup link. Please register again.')
      navigate('/auth/register')
    }
  }, [userId, qrCode, navigate])

  /**
   * Verify TOTP code and get recovery codes
   */
  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await api.post('/auth/verify-2fa-setup', {
        userId,
        code: verificationCode,
      })
      
      const { recoveryCodes: codes, token, sessionId, user } = response.data
      
      // Save token for authentication (JWT-only)
      logger.info('🔐 [Setup2FA] verify-2fa-setup response received')
      
      if (!token) {
        logger.error('❌ [Setup2FA] CRITICAL: Backend did not return token!')
        toast.error('Authentication failed - no token received')
        return
      }
      
      // 🛡️ CRITICAL SECURITY: Clear ALL storage before saving new credentials
      logger.info('🧹 [Setup2FA] Clearing ALL storage (localStorage + sessionStorage)')
      
      storage.clearAppState()
      logger.info('✅ [Setup2FA] Storage cleared completely')
      
      // Save new authentication data
      storage.setToken(token)
      logger.info(`✅ [Setup2FA] NEW token saved`)

      // 🆕 Save sessionId for x-session-id header
      if (sessionId) {
        storage.setSessionId(sessionId)
        logger.info(`✅ [Setup2FA] SessionId saved`)
      }
      
      // Verify immediately that the token was saved correctly
      const savedToken = storage.getToken()
      if (savedToken !== token) {
        logger.error('❌ [Setup2FA] Token mismatch after save!')
        toast.error('Token save failed')
        return
      }
      
      if (user) {
        storage.setUser(user)
      }
      
      // Verify token saved correctly
      const verifyToken = storage.getToken()
      logger.info(`✅ [Setup2FA] Token saved`)
      
      if (!verifyToken) {
        logger.error('❌ [Setup2FA] CRITICAL: Token save failed!')
        toast.error('Authentication storage failed')
        return
      }
      
      // Feature 189: Recovery codes removed - go directly to workspace
      toast.success('2FA enabled successfully!')
      // 🔄 CRITICAL: Hard reload to ensure axios reads fresh token from localStorage
      logger.info(`🔄 [Setup2FA] Forcing hard reload to ${finalRedirectUrl}`)
      setTimeout(() => {
        window.location.href = finalRedirectUrl
      }, 200)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Codice di verifica non valido'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Helper to decode JWT (for debugging)
  const parseJwt = (token: string) => {
    try {
      return JSON.parse(atob(token.split('.')[1]))
    } catch (e) {
      return null
    }
  }

  /**
   * Render QR code scan step
   */
  const renderScanStep = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-green-600" />
          {t('setup2fa.title')}
        </CardTitle>
        <CardDescription>
          {t('setup2fa.scanDescription')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* QR Code Display */}
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <QRCode value={qrCode} size={200} />
          </div>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('setup2fa.useAuthenticatorApp')}</AlertTitle>
            <AlertDescription>
              {t('setup2fa.recommended')}
            </AlertDescription>
          </Alert>
        </div>

        {/* Instructions */}
        <div className="space-y-3 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">{t('setup2fa.howToSetup')}</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>{t('setup2fa.step1')}</li>
            <li>{t('setup2fa.step2')}</li>
            <li>{t('setup2fa.step3')}</li>
            <li>{t('setup2fa.step4')}</li>
          </ol>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={() => setStep('verify')} 
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {t('setup2fa.scannedButton')}
        </Button>
      </CardFooter>
    </Card>
  )

  /**
   * Render verification code input step
   */
  const renderVerifyStep = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{t('setup2fa.verifyTitle')}</CardTitle>
        <CardDescription>
          {t('setup2fa.verifyDescription')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Verification Code Input */}
        <div className="space-y-2">
          <Label htmlFor="verificationCode">{t('setup2fa.verificationCode')}</Label>
          <Input
            id="verificationCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '')
              setVerificationCode(value)
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            className="text-center text-2xl tracking-widest font-mono"
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('setup2fa.codeRefreshes')}
          </AlertDescription>
        </Alert>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        <Button 
          onClick={handleVerify}
          disabled={loading || verificationCode.length !== 6}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('setup2fa.verifying')}
            </>
          ) : (
            t('setup2fa.verifyAndContinue')
          )}
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => setStep('scan')}
          disabled={loading}
          className="w-full"
        >
          {t('setup2fa.backToQR')}
        </Button>
      </CardFooter>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Step Indicator - 2 steps only (Feature 189: Recovery codes removed) */}
        <div className="mb-6 flex justify-center items-center gap-2 text-sm text-gray-600">
          <div className={`flex items-center gap-1 ${step === 'scan' ? 'font-semibold text-green-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step === 'scan' ? 'bg-green-600 text-white border-green-600' : step === 'verify' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>
              {step === 'verify' ? <CheckCircle className="w-4 h-4" /> : '1'}
            </span>
            {t('setup2fa.stepScan')}
          </div>
          
          <div className="w-8 h-0.5 bg-gray-300" />
          
          <div className={`flex items-center gap-1 ${step === 'verify' ? 'font-semibold text-green-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step === 'verify' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>
              2
            </span>
            {t('setup2fa.stepVerify')}
          </div>
        </div>

        {/* Main Content */}
        {step === 'scan' && renderScanStep()}
        {step === 'verify' && renderVerifyStep()}
      </div>
    </div>
  )
}
