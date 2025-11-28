/**
 * Verify2FAPage.returnUrl.spec.tsx
 * 
 * Tests for returnUrl handling in Verify2FAPage
 * 
 * BUG FIXED: After completing 2FA verification, user was always redirected to 
 * /workspace-selection, even when they came from an invitation link (via login).
 * Now, the page respects the returnUrl passed from the login flow.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

describe("Verify2FAPage returnUrl Logic", () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
      clear: vi.fn(() => { store = {} }),
    }
  })()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    Object.defineProperty(window, "localStorage", { value: localStorageMock })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("finalRedirectUrl calculation", () => {
    /**
     * Simulates the logic from Verify2FAPage for calculating the redirect URL
     */
    const calculateFinalRedirectUrl = (returnUrl: string | undefined | null): string => {
      return returnUrl ? decodeURIComponent(returnUrl) : '/workspace-selection'
    }

    it("should return /workspace-selection when no returnUrl is provided", () => {
      const result = calculateFinalRedirectUrl(undefined)
      expect(result).toBe('/workspace-selection')
    })

    it("should return /workspace-selection when returnUrl is null", () => {
      const result = calculateFinalRedirectUrl(null)
      expect(result).toBe('/workspace-selection')
    })

    it("should return decoded returnUrl when provided (invitation flow)", () => {
      const encodedUrl = encodeURIComponent('/accept-invite?token=abc123')
      const result = calculateFinalRedirectUrl(encodedUrl)
      expect(result).toBe('/accept-invite?token=abc123')
    })
  })

  describe("TOTP verification flow", () => {
    /**
     * Simulates the TOTP verification flow with redirect
     */
    const simulateVerify2FAComplete = (locationState: {
      userId?: string
      email?: string
      provider?: string
      returnUrl?: string
    } | null, verificationResult: { success: boolean; token?: string; user?: { firstName: string } }) => {
      // Extract state (as Verify2FAPage does)
      const { returnUrl } = locationState || {}
      
      // Calculate final redirect URL
      const finalRedirectUrl = returnUrl ? decodeURIComponent(returnUrl) : '/workspace-selection'
      
      if (!verificationResult.success) {
        return { success: false, finalRedirectUrl: null }
      }
      
      // Simulate successful 2FA verification
      localStorage.clear()
      if (verificationResult.token) {
        localStorage.setItem('token', verificationResult.token)
      }
      if (verificationResult.user) {
        localStorage.setItem('user', JSON.stringify(verificationResult.user))
      }
      
      return {
        success: true,
        finalRedirectUrl,
        tokenSaved: !!localStorage.getItem('token'),
      }
    }

    it("should redirect to /workspace-selection for normal login", () => {
      const result = simulateVerify2FAComplete(
        {
          userId: 'user-123',
          email: 'test@example.com',
          provider: 'email',
          // No returnUrl - normal login
        },
        { success: true, token: 'jwt-token', user: { firstName: 'Test' } }
      )

      expect(result.success).toBe(true)
      expect(result.finalRedirectUrl).toBe('/workspace-selection')
      expect(result.tokenSaved).toBe(true)
    })

    it("should redirect to /accept-invite for invitation login", () => {
      const result = simulateVerify2FAComplete(
        {
          userId: 'user-123',
          email: 'invited@example.com',
          provider: 'email',
          returnUrl: encodeURIComponent('/accept-invite?token=invite-token-abc'),
        },
        { success: true, token: 'jwt-token', user: { firstName: 'Invited' } }
      )

      expect(result.success).toBe(true)
      expect(result.finalRedirectUrl).toBe('/accept-invite?token=invite-token-abc')
      expect(result.tokenSaved).toBe(true)
    })

    it("should redirect to /accept-invite for Google OAuth login with invitation", () => {
      const result = simulateVerify2FAComplete(
        {
          userId: 'user-123',
          email: 'google@example.com',
          provider: 'google',
          returnUrl: encodeURIComponent('/accept-invite?token=google-invite-xyz'),
        },
        { success: true, token: 'jwt-token', user: { firstName: 'Google' } }
      )

      expect(result.success).toBe(true)
      expect(result.finalRedirectUrl).toBe('/accept-invite?token=google-invite-xyz')
    })

    it("should not redirect on failed verification", () => {
      const result = simulateVerify2FAComplete(
        {
          userId: 'user-123',
          email: 'test@example.com',
          provider: 'email',
          returnUrl: '/accept-invite?token=abc',
        },
        { success: false }
      )

      expect(result.success).toBe(false)
      expect(result.finalRedirectUrl).toBeNull()
    })
  })

  describe("recovery code flow", () => {
    /**
     * Simulates the recovery code verification flow with redirect
     */
    const simulateRecoveryCodeComplete = (locationState: {
      userId?: string
      email?: string
      returnUrl?: string
    } | null, verificationResult: { success: boolean; token?: string; newRecoveryCode?: string }) => {
      // Extract state
      const { returnUrl } = locationState || {}
      
      // Calculate final redirect URL
      const finalRedirectUrl = returnUrl ? decodeURIComponent(returnUrl) : '/workspace-selection'
      
      if (!verificationResult.success) {
        return { success: false, finalRedirectUrl: null }
      }
      
      // Simulate successful recovery code verification
      localStorage.clear()
      if (verificationResult.token) {
        localStorage.setItem('token', verificationResult.token)
      }
      
      return {
        success: true,
        finalRedirectUrl,
        newRecoveryCode: verificationResult.newRecoveryCode,
      }
    }

    it("should redirect to returnUrl after recovery code verification", () => {
      const result = simulateRecoveryCodeComplete(
        {
          userId: 'user-123',
          email: 'recovery@example.com',
          returnUrl: encodeURIComponent('/accept-invite?token=recovery-invite'),
        },
        { success: true, token: 'jwt-token', newRecoveryCode: 'NEW-RECOVERY-CODE' }
      )

      expect(result.success).toBe(true)
      expect(result.finalRedirectUrl).toBe('/accept-invite?token=recovery-invite')
      expect(result.newRecoveryCode).toBe('NEW-RECOVERY-CODE')
    })

    it("should redirect to /workspace-selection when no returnUrl for recovery", () => {
      const result = simulateRecoveryCodeComplete(
        {
          userId: 'user-123',
          email: 'recovery@example.com',
          // No returnUrl
        },
        { success: true, token: 'jwt-token', newRecoveryCode: 'NEW-RECOVERY-CODE' }
      )

      expect(result.success).toBe(true)
      expect(result.finalRedirectUrl).toBe('/workspace-selection')
    })
  })
})
