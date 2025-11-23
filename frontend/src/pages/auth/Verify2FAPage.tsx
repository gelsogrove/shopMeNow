/**
 * Verify 2FA Page
 * Displayed during login after credentials verified
 * 
 * FLOW:
 * 1. User enters email/password → credentials verified
 * 2. Redirected here to enter TOTP code
 * 3. Enter 6-digit code from authenticator app
 * 4. OR use recovery code as backup
 * 5. On success: create session → redirect to workspace selection
 * 
 * SECURITY: Rate limited (3 attempts/15min), account lockout after 5 failures
 * DESIGN: Aligned with RegisterPage (shadcn/ui + Card)
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/lib/toast'
import { Loader2, Shield, AlertCircle, KeyRound } from 'lucide-react'
import { api, setSessionId } from '@/services/api'
import { logger } from '@/lib/logger'

export default function Verify2FAPage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get state from login
  const { userId, email, provider } = location.state || {}
  
  // Page state
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp')
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  /**
   * Redirect if no state provided
   */
  useEffect(() => {
    if (!userId || !email) {
      toast.error('Invalid verification link. Please login again.')
      navigate('/auth/login')
    }
  }, [userId, email, navigate])

  /**
   * Verify TOTP code
   */
  const handleVerifyTOTP = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await api.post('/auth/2fa/verify', {
        userId,
        code,
      })
      
      const { token, user, sessionId } = response.data
      
      // Store session (using helper for sessionStorage)
      if (token) {
        localStorage.setItem('token', token)
        logger.info('✅ JWT token saved to localStorage')
      }
      
      if (sessionId) {
        setSessionId(sessionId)
        logger.info(`✅ SessionId saved to sessionStorage: ${sessionId.substring(0, 8)}...`)
      } else {
        logger.error('❌ No sessionId in verify2FA response!')
        throw new Error('No sessionId in response')
      }
      
      localStorage.setItem('user', JSON.stringify(user))
      
      toast.success(`Welcome back, ${user.firstName}!`)
      
      // 🔄 CRITICAL: Hard reload instead of navigate() to clear axios cache
      logger.info('🔄 [Verify2FA] Forcing hard reload to /workspace-selection')
      setTimeout(() => {
        window.location.href = '/workspace-selection'
      }, 200)
    } catch (error: any) {
      const errorData = error.response?.data
      const errorMessage = errorData?.message || 'Invalid verification code'
      
      setError(errorMessage)
      toast.error(errorMessage)
      
      // Update attempts remaining if provided
      if (errorData?.attemptsRemaining !== undefined) {
        setAttemptsRemaining(errorData.attemptsRemaining)
        
        if (errorData.attemptsRemaining === 0) {
          toast.error('Account locked due to too many failed attempts')
          setTimeout(() => navigate('/auth/login'), 3000)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Verify recovery code
   */
  const handleVerifyRecoveryCode = async () => {
    if (!code || code.length < 8) {
      setError('Please enter a valid recovery code')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await api.post('/auth/verify-recovery-code', {
        userId,
        code,
      })
      
      const { token, user, sessionId } = response.data
      
      // Store session (using helper for sessionStorage)
      if (token) {
        localStorage.setItem('token', token)
        logger.info('✅ JWT token saved to localStorage')
      }
      
      if (sessionId) {
        setSessionId(sessionId)
        logger.info(`✅ SessionId saved to sessionStorage: ${sessionId.substring(0, 8)}...`)
      } else {
        logger.error('❌ No sessionId in recovery code response!')
        throw new Error('No sessionId in response')
      }
      
      localStorage.setItem('user', JSON.stringify(user))
      
      toast.success(`Welcome back, ${user.firstName}! Recovery code used.`)
      toast.warning('This recovery code is now invalid. You have 9 codes remaining.')
      
      // 🔄 CRITICAL: Hard reload instead of navigate() to clear axios cache
      logger.info('🔄 [Verify2FA] Forcing hard reload to /workspace-selection (recovery code)')
      setTimeout(() => {
        window.location.href = '/workspace-selection'
      }, 200)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Invalid recovery code'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    if (mode === 'totp') {
      handleVerifyTOTP()
    } else {
      handleVerifyRecoveryCode()
    }
  }

  /**
   * Switch between TOTP and recovery code modes
   */
  const toggleMode = () => {
    setMode(mode === 'totp' ? 'recovery' : 'totp')
    setCode('')
    setError('')
    setAttemptsRemaining(null)
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
              {mode === 'totp' 
                ? 'Enter the code from your authenticator app' 
                : 'Enter one of your recovery codes'}
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

            {/* TOTP Mode */}
            {mode === 'totp' && (
              <div className="space-y-2">
                <Label htmlFor="totpCode">Verification Code</Label>
                <Input
                  id="totpCode"
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
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="text-center text-2xl tracking-widest font-mono"
                  disabled={loading}
                  autoFocus
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
            )}

            {/* Recovery Code Mode */}
            {mode === 'recovery' && (
              <div className="space-y-2">
                <Label htmlFor="recoveryCode" className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Recovery Code
                </Label>
                <Input
                  id="recoveryCode"
                  type="text"
                  placeholder="Enter recovery code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.trim())
                    setError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="font-mono"
                  disabled={loading}
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Recovery codes are the backup codes you saved during setup. Each code can only be used once.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Mode Toggle */}
            <div className="pt-2">
              <Button 
                variant="link" 
                onClick={toggleMode}
                disabled={loading}
                className="text-sm text-green-600 hover:text-green-700 p-0"
              >
                {mode === 'totp' 
                  ? "Can't access your app? Use a recovery code" 
                  : 'Use authenticator app instead'}
              </Button>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-3">
            <Button 
              onClick={handleSubmit}
              disabled={loading || code.length < (mode === 'totp' ? 6 : 8)}
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
              onClick={() => navigate('/auth/login')}
              disabled={loading}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Lost access to your authenticator and recovery codes?{' '}
            <Link to="/support" className="text-green-600 hover:text-green-700 hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
