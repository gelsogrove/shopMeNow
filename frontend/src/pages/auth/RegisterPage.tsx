/**
 * Registration Page
 * Multi-provider registration: Email/Password + Google + Facebook + Apple
 * 
 * FLOW:
 * 1. User selects registration method (4 options)
 * 2. Email: Shows form → Register → Setup 2FA
 * 3. OAuth: Popup → Auto-register → Setup 2FA
 * 
 * DESIGN: Aligned with GdprPage (shadcn/ui + Card)
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/lib/toast'
import { Loader2, Mail, Chrome, Facebook as FacebookIcon, Apple } from 'lucide-react'
import { api } from '@/services/api'
import { logger } from '@/lib/logger'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com'

export default function RegisterPage() {
  const navigate = useNavigate()
  
  // ❌ REMOVED: Don't clear storage in useEffect - causes race conditions with OAuth
  // Storage clearing moved to individual handlers (onSubmitRegister, handleGoogleSuccess)
  
  // Form state
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Email registration form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gdprAccepted, setGdprAccepted] = useState(false)
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  /**
   * Validate email registration form
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Valid email is required'
    }
    
    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }
    
    // Password strength validation
    if (!/[A-Z]/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(password)) {
      newErrors.password = 'Password must contain at least one lowercase letter'
    }
    if (!/\d/.test(password)) {
      newErrors.password = 'Password must contain at least one number'
    }
    if (!/[@$!%*?&]/.test(password)) {
      newErrors.password = 'Password must contain at least one special character (@$!%*?&)'
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    if (!firstName?.trim()) {
      newErrors.firstName = 'First name is required'
    }
    
    if (!lastName?.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    
    if (!gdprAccepted) {
      newErrors.gdpr = 'You must accept the privacy policy'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Handle email/password registration
   */
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }
    
    setLoading(true)
    
    try {
      const response = await api.post('/auth/register', {
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gdprAccepted: true,
      })
      
      const { user, qrCode } = response.data
      
      toast.success('Registration successful! Please setup 2FA.')
      
      // Navigate to 2FA setup with user data
      navigate('/auth/setup-2fa', {
        state: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          qrCode,
          provider: 'email',
        },
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Registrazione fallita'
      
      if (error.response?.status === 409) {
        // User already exists - redirect to login
        toast.error('Utente già presente. Verrai reindirizzato al login...')
        setErrors({ email: 'Email già registrata' })
        
        setTimeout(() => {
          navigate('/auth/login', {
            state: { email: email.toLowerCase().trim() },
          })
        }, 2000)
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle Google OAuth registration
   */
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true)
    
    try {
      // 🔒 SECURITY: Clear ALL storage before OAuth login
      logger.info('🔄 [RegisterPage] Clearing storage before Google OAuth')
      localStorage.clear()
      sessionStorage.clear()
      
      // Send Google token to backend
      const response = await api.post('/auth/oauth/google', {
        credential: credentialResponse.credential,
      })
      
      logger.info('🔍 [RegisterPage] OAuth Google response:', response.data)
      
      const { user, requiresSetup, requires2FA, qrCode } = response.data
      
      logger.info('🔍 [RegisterPage] Extracted data:', { user, requiresSetup, requires2FA, qrCode: qrCode ? 'present' : 'missing' })
      
      if (requiresSetup) {
        // New user - setup 2FA
        toast.success('Registration successful! Please setup 2FA.')
        logger.info('🔍 [RegisterPage] Navigating to setup-2fa with state:', {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          provider: 'google',
        })
        navigate('/auth/setup-2fa', {
          state: {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            qrCode,
            provider: 'google',
          },
        })
      } else if (requires2FA) {
        // Existing user with 2FA - clear ONLY authentication data
        logger.info('🗑️ [RegisterPage] Clearing authentication data before 2FA verification')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('currentWorkspace')
        sessionStorage.removeItem('sessionId')
        
        toast.success('Welcome back! Please verify your 2FA code.')
        navigate('/auth/verify-2fa', {
          state: {
            userId: user.id,
            email: user.email,
            provider: 'google',
          },
        })
      } else {
        // Fallback
        navigate('/auth/verify-2fa', {
          state: {
            userId: user.id,
            email: user.email,
            provider: 'google',
          },
        })
      }
    } catch (error: any) {
      logger.error('❌ [RegisterPage] Google OAuth error:', error)
      toast.error('Google sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle Google OAuth error
   */
  const handleGoogleError = () => {
    toast.error('Google sign-in failed. Please try again.')
  }

  /**
   * Handle Facebook login (placeholder - requires FB SDK)
   */
  const handleFacebookLogin = () => {
    toast.info('Facebook login coming soon!')
    // TODO: Implement Facebook SDK integration
  }

  /**
   * Handle Apple login (placeholder - requires Apple SDK)
   */
  const handleAppleLogin = () => {
    toast.info('Apple Sign In coming soon!')
    // TODO: Implement Apple Sign In
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-green-700">
              Create Account
            </CardTitle>
            <CardDescription>
              Choose your preferred registration method
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!showEmailForm ? (
              // Registration method selection
              <div className="space-y-3">
                {/* Email/Password Button */}
                <Button
                  onClick={() => setShowEmailForm(true)}
                  variant="outline"
                  className="w-full h-12 flex items-center justify-center gap-2 border-2 hover:border-green-500 hover:bg-green-50"
                >
                  <Mail className="h-5 w-5" />
                  <span className="font-medium">Sign up with Email</span>
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                {/* Google OAuth */}
                <div className="w-full">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    text="signup_with"
                    width="100%"
                  />
                </div>

                {/* Facebook Button (placeholder) */}
                <Button
                  onClick={handleFacebookLogin}
                  variant="outline"
                  className="w-full h-12 flex items-center justify-center gap-2 border-2 hover:border-blue-500 hover:bg-blue-50"
                  disabled
                >
                  <FacebookIcon className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Continue with Facebook</span>
                </Button>

                {/* Apple Button (placeholder) */}
                <Button
                  onClick={handleAppleLogin}
                  variant="outline"
                  className="w-full h-12 flex items-center justify-center gap-2 border-2 hover:border-gray-700 hover:bg-gray-50"
                  disabled
                >
                  <Apple className="h-5 w-5" />
                  <span className="font-medium">Continue with Apple</span>
                </Button>
              </div>
            ) : (
              // Email registration form
              <form onSubmit={handleEmailRegister} className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEmailForm(false)}
                  className="mb-4"
                >
                  ← Back to options
                </Button>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.doe@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>

                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={errors.firstName ? 'border-red-500' : ''}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-500">{errors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={errors.lastName ? 'border-red-500' : ''}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-500">{errors.lastName}</p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Must contain uppercase, lowercase, number, and special character
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* GDPR Consent */}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="gdpr"
                    checked={gdprAccepted}
                    onCheckedChange={(checked) => setGdprAccepted(checked as boolean)}
                    className={errors.gdpr ? 'border-red-500' : ''}
                  />
                  <label
                    htmlFor="gdpr"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I accept the{' '}
                    <Link to="/privacy-policy" className="text-green-600 hover:underline">
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link to="/terms" className="text-green-600 hover:underline">
                      Terms of Service
                    </Link>
                  </label>
                </div>
                {errors.gdpr && (
                  <p className="text-sm text-red-500">{errors.gdpr}</p>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 h-12"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/auth/login" className="text-green-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </GoogleOAuthProvider>
  )
}
