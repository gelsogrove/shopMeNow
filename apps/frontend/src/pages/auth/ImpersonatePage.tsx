/**
 * Impersonate Page
 * 
 * Handles impersonation redirect from backoffice.
 * Receives token from URL params, stores it and redirects to workspace-selection.
 * The token already contains all user info and bypasses 2FA completely.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, Shield } from 'lucide-react'

export default function ImpersonatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    const sessionId = searchParams.get('sessionId')

    if (!token) {
      setError('Missing token parameter')
      return
    }

    if (!sessionId) {
      setError('Missing sessionId parameter')
      return
    }

    try {
      // Clear ALL existing auth data
      localStorage.removeItem('token')
      localStorage.removeItem('currentWorkspace')
      localStorage.removeItem('sessionId')
      localStorage.removeItem('user')
      sessionStorage.clear()
      
      // Store the impersonation token and sessionId
      localStorage.setItem('token', token)
      localStorage.setItem('sessionId', sessionId)
      
      console.log('🔐 Impersonation: Token and sessionId stored, forcing hard redirect to workspace-selection')
      
      // Small delay to ensure localStorage is updated, then HARD REDIRECT
      setTimeout(() => {
        // Use window.location.href for hard redirect - bypasses React Router completely
        window.location.href = '/workspace-selection'
      }, 300)
    } catch (err) {
      console.error('Impersonation error:', err)
      setError('Failed to process impersonation')
    }
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Impersonation Failed</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <div className="relative mb-4">
          <Shield className="h-12 w-12 text-purple-500 mx-auto" />
          <Loader2 className="h-6 w-6 text-purple-500 animate-spin absolute -right-1 -bottom-1" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Impersonating User</h1>
        <p className="text-gray-600">Please wait while we log you in...</p>
      </div>
    </div>
  )
}
