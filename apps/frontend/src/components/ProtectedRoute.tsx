import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { api } from "../services/api"

/**
 * 🔒 PROTECTED ROUTE COMPONENT
 *
 * Validates JWT token before rendering protected content.
 *
 * Behavior:
 * 1. On mount: checks if token exists in localStorage
 * 2. If valid: renders <Outlet /> (nested routes)
 * 3. If invalid/missing: redirects to /
 * 4. Shows loading spinner during validation
 *
 * Usage in App.tsx:
 * ```tsx
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/dashboard" element={<DashboardPage />} />
 *   <Route path="/settings" element={<SettingsPage />} />
 * </Route>
 * ```
 */
export function ProtectedRoute() {
  const [isValidating, setIsValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const location = useLocation()

  useEffect(() => {
    validateSession()
  }, [])

  const validateSession = async () => {
    try {
      const token = storage.getToken()

      // If no token in localStorage, clear everything and redirect
      if (!token) {
        logger.warn(
          "🔓 No token found - cleaning up and redirecting to login"
        )

        // Clear all auth data
        storage.clearAuth()

        setIsValid(false)
        setIsValidating(false)
        return
      }

      // Token exists - axios interceptor will add it to requests automatically
      logger.info(`🔒 JWT token found - allowing access`)
      setIsValid(true)
    } catch (error: any) {
      logger.error("❌ Token validation failed:", error)

      // Clear auth data
      logger.warn("🗑️ Clearing storage due to validation failure")

      // Clear localStorage
      storage.clearAuth()

      setIsValid(false)
    } finally {
      setIsValidating(false)
    }
  }

  // Show loading spinner during validation
  if (isValidating) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  // If token is invalid, redirect to login with return URL
  if (!isValid) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  // Token is valid, render nested routes via Outlet
  return <Outlet />
}
