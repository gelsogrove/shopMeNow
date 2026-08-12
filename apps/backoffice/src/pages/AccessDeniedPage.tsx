/**
 * Access Denied Page
 * 
 * Shown when user tries to access backoffice without proper authentication.
 * No login form - user MUST authenticate via Frontend with isPlatformAdmin=true.
 */

import { ShieldX, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AccessDeniedPage() {
  const frontendUrl =
    import.meta.env.VITE_FRONTEND_URL ||
    (window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : 'https://www.echatbot.ai')

  const handleGoToFrontend = () => {
    window.location.href = frontendUrl
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 border border-red-200">
          <ShieldX className="h-10 w-10 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Access Denied
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-8">
          The Backoffice is restricted to Platform Administrators only.
          <br />
          Please login through the main application with an admin account.
        </p>

        {/* CTA Button */}
        <Button
          onClick={handleGoToFrontend}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
        >
          Go to Login
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
