/**
 * Impersonation Banner (Feature 190)
 * 
 * Shows a banner at the top of the page when admin is impersonating a user.
 * Displays the impersonator email and provides an Exit button.
 */

import { useEffect, useState } from 'react'
import { Shield, X } from 'lucide-react'
import { storage } from '@/lib/storage'

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonatorEmail, setImpersonatorEmail] = useState<string | null>(null)

  useEffect(() => {
    // Check storage for impersonation flags
    const { isImpersonating: impersonating, impersonatorEmail: email } =
      storage.getImpersonationFlags()
    
    setIsImpersonating(impersonating)
    setImpersonatorEmail(email)
  }, [])

  const handleExit = () => {
    // Clear all auth data
    storage.clearAuth()
    storage.clearImpersonationFlags()
    
    // Close this window
    window.close()
    
    // If window.close() doesn't work (some browsers block it), redirect to login
    setTimeout(() => {
      window.location.href = '/login'
    }, 100)
  }

  if (!isImpersonating) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-purple-600 text-white px-4 py-1 flex items-center justify-center gap-2 text-sm">
      <Shield className="h-4 w-4" />
      <span>
        Admin Mode: <span className="font-medium">{impersonatorEmail}</span>
      </span>
      <button
        onClick={handleExit}
        className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
      >
        <X className="h-3 w-3" />
        Exit
      </button>
    </div>
  )
}
