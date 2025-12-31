/**
 * ROOT PAGE ROUTER - Dynamic Landing vs Login
 * 
 * Decides which page to show based on landingPageEnabled flag:
 * - TRUE: Show LandingPage (Coming Soon mode)
 * - FALSE: Show LoginPage (Auth/Login mode)
 * 
 * @author Andrea Gelso - eChatbot
 */

import { LandingPage } from "./LandingPage"
import { LoginPage } from "./LoginPage"
import { useFeatureFlags } from "@/hooks/usePlatformConfig"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { storage } from "@/lib/storage"

export function RootPage() {
  const { landingPageEnabled, isLoading } = useFeatureFlags()
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is already logged in
    const token = storage.getToken()
    if (token) {
      // User logged in, redirect to workspace selection
      navigate("/workspace-selection", { replace: true })
    }
  }, [navigate])

  // Show loading state while fetching config
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // Show Landing Page if flag is enabled, otherwise Login
  return landingPageEnabled ? <LandingPage /> : <LoginPage />
}
