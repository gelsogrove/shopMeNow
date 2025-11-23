/**
 * Setup 2FA Page
 * Displayed after registration to configure TOTP 2FA
 * 
 * FLOW:
 * 1. Display QR code from registration response
 * 2. User scans with Google Authenticator
 * 3. User enters 6-digit code to verify
 * 4. Backend generates 10 recovery codes
 * 5. Display recovery codes with download/copy option
 * 6. Redirect to login
 * 
 * SECURITY: Recovery codes shown only once, stored hashed in database
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
import { Loader2, Download, Copy, CheckCircle, AlertCircle, Smartphone } from 'lucide-react'
import { api, setSessionId } from '@/services/api'

export default function Setup2FAPage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get state from registration
  const { userId, email, firstName, qrCode, provider } = location.state || {}
  
  // Page state
  const [step, setStep] = useState<'scan' | 'verify' | 'codes'>('scan')
  const [loading, setLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [codesCopied, setCodesCopied] = useState(false)
  const [error, setError] = useState('')

  /**
   * Redirect if no state provided
   */
  useEffect(() => {
    console.log('🔍 Setup2FA - Received qrCode:', qrCode)
    console.log('🔍 QR Code length:', qrCode?.length)
    console.log('🔍 QR Code starts with:', qrCode?.substring(0, 50))
    
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
      
      const { recoveryCodes: codes, sessionId, token, user } = response.data
      
      // Save session and token for continued authentication
      // CRITICAL: Use sessionStorage for sessionId (via setSessionId helper)
      logger.info('🔐 [Setup2FA] verify-2fa-setup response:', { sessionId, token, user })
      
      if (sessionId) {
        setSessionId(sessionId)
        logger.info(`✅ [Setup2FA] SessionId saved to sessionStorage: ${sessionId.substring(0, 8)}...`)
      } else {
        logger.error('❌ [Setup2FA] CRITICAL: Backend did not return sessionId!')
      }
      
      if (token) {
        localStorage.setItem('token', token)
        logger.info('✅ [Setup2FA] Token saved to localStorage')
      } else {
        logger.error('❌ [Setup2FA] CRITICAL: Backend did not return token!')
      }
      
      if (user) {
        localStorage.setItem('user', JSON.stringify(user))
        logger.info('✅ [Setup2FA] User saved to localStorage')
      }
      
      // Verify sessionStorage has sessionId before proceeding
      const verifySessionId = sessionStorage.getItem('sessionId')
      logger.info(`🔍 [Setup2FA] Verifying sessionStorage.sessionId: ${verifySessionId ? verifySessionId.substring(0, 8) + '...' : 'NULL'}`)
      
      if (!verifySessionId) {
        logger.error('❌ [Setup2FA] CRITICAL: sessionStorage.sessionId is NULL after setSessionId!')
      }
      
      setRecoveryCodes(codes)
      setStep('codes')
      toast.success('2FA enabled successfully!')
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Invalid verification code'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Copy recovery codes to clipboard
   */
  const handleCopyRecoveryCodes = () => {
    const codesText = recoveryCodes.join('\n')
    navigator.clipboard.writeText(codesText)
    setCodesCopied(true)
    toast.success('Recovery codes copied to clipboard!')
    
    setTimeout(() => setCodesCopied(false), 3000)
  }

  /**
   * Download recovery codes as text file
   */
  const handleDownloadRecoveryCodes = () => {
    const codesText = `ShopME Recovery Codes\n\nEmail: ${email}\nGenerated: ${new Date().toLocaleString()}\n\n${recoveryCodes.join('\n')}\n\nKEEP THESE CODES SAFE!\nEach code can only be used once.\nYou will not see these codes again.`
    
    const blob = new Blob([codesText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `shopme-recovery-codes-${email}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success('Recovery codes downloaded!')
  }

  /**
   * Complete setup and redirect to workspace selection (user is now fully authenticated)
   */
  const handleComplete = () => {
    toast.success('Setup complete! Redirecting to workspace selection...')
    navigate('/workspace-selection')
  }

  /**
   * Render QR code scan step
   */
  const renderScanStep = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-green-600" />
          Setup Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app
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
            <AlertTitle>Use an authenticator app</AlertTitle>
            <AlertDescription>
              Recommended: <strong>Google Authenticator</strong>, Microsoft Authenticator, or Authy
            </AlertDescription>
          </Alert>
        </div>

        {/* Instructions */}
        <div className="space-y-3 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">How to setup:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Open your authenticator app</li>
            <li>Tap "+" or "Add account"</li>
            <li>Scan this QR code</li>
            <li>Enter the 6-digit code below</li>
          </ol>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={() => setStep('verify')} 
          className="w-full bg-green-600 hover:bg-green-700"
        >
          I've scanned the code
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
        <CardTitle className="text-2xl">Verify Your Setup</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Verification Code Input */}
        <div className="space-y-2">
          <Label htmlFor="verificationCode">Verification Code</Label>
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
            The code refreshes every 30 seconds. Enter the current code from your app.
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
              Verifying...
            </>
          ) : (
            'Verify and Continue'
          )}
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => setStep('scan')}
          disabled={loading}
          className="w-full"
        >
          Back to QR Code
        </Button>
      </CardFooter>
    </Card>
  )

  /**
   * Render recovery codes display step
   */
  const renderCodesStep = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-600" />
          Save Your Recovery Codes
        </CardTitle>
        <CardDescription>
          Keep these codes in a safe place - you won't see them again!
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Warning Alert */}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important!</AlertTitle>
          <AlertDescription>
            Each code can only be used <strong>once</strong>. Store them securely - you will not see these codes again.
          </AlertDescription>
        </Alert>

        {/* Recovery Codes Display */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3 font-mono text-sm">
            {recoveryCodes.map((code, index) => (
              <div 
                key={index}
                className="bg-white px-3 py-2 rounded border border-gray-300 text-center"
              >
                {code}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleCopyRecoveryCodes}
            variant="outline"
            className="flex-1"
          >
            {codesCopied ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Codes
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleDownloadRecoveryCodes}
            variant="outline"
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>

        {/* Security Notice */}
        <div className="text-sm text-gray-600 space-y-2">
          <p className="font-semibold text-gray-900">What are recovery codes?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use them if you lose access to your authenticator app</li>
            <li>Each code works only once</li>
            <li>Store them in a password manager or safe place</li>
            <li>Never share them with anyone</li>
          </ul>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        <Button 
          onClick={handleComplete}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          I've Saved My Codes - Continue to Login
        </Button>
        
        <p className="text-xs text-gray-500 text-center">
          You can now log in with {email}
        </p>
      </CardFooter>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Step Indicator */}
        <div className="mb-6 flex justify-center items-center gap-2 text-sm text-gray-600">
          <div className={`flex items-center gap-1 ${step === 'scan' ? 'font-semibold text-green-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step === 'scan' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>
              1
            </span>
            Scan
          </div>
          
          <div className="w-8 h-0.5 bg-gray-300" />
          
          <div className={`flex items-center gap-1 ${step === 'verify' ? 'font-semibold text-green-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step === 'verify' ? 'bg-green-600 text-white border-green-600' : step === 'codes' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>
              2
            </span>
            Verify
          </div>
          
          <div className="w-8 h-0.5 bg-gray-300" />
          
          <div className={`flex items-center gap-1 ${step === 'codes' ? 'font-semibold text-green-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step === 'codes' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>
              3
            </span>
            Codes
          </div>
        </div>

        {/* Main Content */}
        {step === 'scan' && renderScanStep()}
        {step === 'verify' && renderVerifyStep()}
        {step === 'codes' && renderCodesStep()}

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <Link to="/auth/login" className="text-green-600 hover:text-green-700 hover:underline">
            Skip and login later
          </Link>
        </div>
      </div>
    </div>
  )
}
