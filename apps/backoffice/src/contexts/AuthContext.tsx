import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { api } from '@/services/api'

interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  isPlatformAdmin: boolean
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  logout: () => void
  setTokenFromCallback: (token: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Decode JWT token to extract claims (without validation - backend validates)
 */
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Check if we have a valid token in localStorage
    const token = localStorage.getItem('backoffice_token')
    if (token) {
      const decoded = decodeJWT(token)
      if (decoded && decoded.isPlatformAdmin && decoded.exp * 1000 > Date.now()) {
        api.setToken(token)
        setUser({
          id: decoded.id,
          email: decoded.email,
          isPlatformAdmin: decoded.isPlatformAdmin,
        })
        setIsAuthenticated(true)
      } else {
        // Token invalid or not platform admin
        localStorage.removeItem('backoffice_token')
      }
    }
    setIsLoading(false)
  }, [])

  /**
   * Set token from Frontend callback (redirect flow)
   * This is the ONLY way to authenticate to backoffice
   */
  const setTokenFromCallback = useCallback((token: string): boolean => {
    const decoded = decodeJWT(token)
    
    if (!decoded) {
      console.error('Invalid token format')
      return false
    }

    // Verify token is not expired
    if (decoded.exp * 1000 < Date.now()) {
      console.error('Token expired')
      return false
    }

    // Verify user is platform admin
    if (!decoded.isPlatformAdmin) {
      console.error('User is not a platform admin')
      return false
    }

    // Token is valid - save and authenticate
    localStorage.setItem('backoffice_token', token)
    api.setToken(token)
    setUser({
      id: decoded.id,
      email: decoded.email,
      isPlatformAdmin: decoded.isPlatformAdmin,
    })
    setIsAuthenticated(true)
    return true
  }, [])

  const logout = () => {
    // Clear all storage to ensure clean state
    localStorage.clear()
    sessionStorage.clear()
    api.logout()
    
    // Redirect IMMEDIATELY before React re-renders (avoids flash of AccessDeniedPage)
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000'
    window.location.href = `${frontendUrl}/auth/login?logout=true`
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, logout, setTokenFromCallback }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
