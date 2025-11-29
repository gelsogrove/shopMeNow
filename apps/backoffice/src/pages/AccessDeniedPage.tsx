/**
 * Access Denied Page
 * 
 * Shown when user tries to access backoffice without proper authentication.
 * No login form - user MUST authenticate via Frontend with isPlatformAdmin=true.
 */

import { ShieldX, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AccessDeniedPage() {
  const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000'

  const handleGoToFrontend = () => {
    window.location.href = frontendUrl
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="text-center max-w-md px-6">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-900/30 border border-red-700">
          <ShieldX className="h-10 w-10 text-red-400" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-2">
          Access Denied
        </h1>

        {/* Description */}
        <p className="text-gray-400 mb-8">
          The Backoffice is restricted to Platform Administrators only.
          <br />
          Please login through the main application with an admin account.
        </p>

        {/* CTA Button */}
        <Button 
          onClick={handleGoToFrontend}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
        >
          Go to Login
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {/* Info */}
        <div className="mt-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-500">
            <strong className="text-gray-400">How to access:</strong>
            <br />
            1. Login at <span className="text-blue-400">{frontendUrl}</span>
            <br />
            2. Use an account with <code className="bg-gray-700 px-1 rounded">isPlatformAdmin</code> enabled
            <br />
            3. You'll be automatically redirected here
          </p>
        </div>
      </div>
    </div>
  )
}
