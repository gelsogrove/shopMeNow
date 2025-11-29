/**
 * Auth Callback Page
 * 
 * Handles token from Frontend redirect for Platform Admins.
 * When a user logs in via Frontend and has isPlatformAdmin=true,
 * they are redirected here with the JWT token in URL.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setTokenFromCallback } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setError('No authentication token provided')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    // Validate token and set auth state
    try {
      const success = setTokenFromCallback(token)
      if (success) {
        navigate('/platforms', { replace: true })
      } else {
        setError('Invalid or expired token')
        setTimeout(() => navigate('/login'), 2000)
      }
    } catch (err) {
      console.error('Auth callback error:', err)
      setError('Authentication failed')
      setTimeout(() => navigate('/login'), 2000)
    }
  }, [searchParams, navigate, setTokenFromCallback])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-400 text-xl mb-2">⚠️ {error}</div>
            <p className="text-gray-400">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-white text-lg">Authenticating...</p>
            <p className="text-gray-400 text-sm">Please wait</p>
          </>
        )}
      </div>
    </div>
  )
}
