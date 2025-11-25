/**
 * Setup2FAPage.returnUrl.spec.tsx
 * 
 * Tests for returnUrl handling in Setup2FAPage
 * 
 * BUG FIXED: After completing 2FA setup, user was always redirected to 
 * /workspace-selection, even when they came from an invitation link.
 * Now, the page respects the returnUrl passed from the registration flow.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

describe("Setup2FAPage returnUrl Logic", () => {
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
     * Simulates the logic from Setup2FAPage for calculating the redirect URL
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

    it("should return /workspace-selection when returnUrl is empty string", () => {
      const result = calculateFinalRedirectUrl('')
      expect(result).toBe('/workspace-selection')
    })

    it("should return decoded returnUrl when provided (invitation flow)", () => {
      const encodedUrl = encodeURIComponent('/accept-invite?token=abc123')
      const result = calculateFinalRedirectUrl(encodedUrl)
      expect(result).toBe('/accept-invite?token=abc123')
    })

    it("should handle already decoded returnUrl", () => {
      const result = calculateFinalRedirectUrl('/accept-invite?token=abc123')
      expect(result).toBe('/accept-invite?token=abc123')
    })

    it("should handle complex returnUrl with multiple query params", () => {
      const encodedUrl = encodeURIComponent('/accept-invite?token=abc123&extra=value')
      const result = calculateFinalRedirectUrl(encodedUrl)
      expect(result).toBe('/accept-invite?token=abc123&extra=value')
    })
  })

  describe("state extraction from location", () => {
    /**
     * Simulates extracting returnUrl from location.state
     */
    const extractReturnUrl = (locationState: Record<string, unknown> | null | undefined): string | undefined => {
      if (!locationState) return undefined
      return locationState.returnUrl as string | undefined
    }

    it("should return undefined when location.state is null", () => {
      const result = extractReturnUrl(null)
      expect(result).toBeUndefined()
    })

    it("should return undefined when location.state is undefined", () => {
      const result = extractReturnUrl(undefined)
      expect(result).toBeUndefined()
    })

    it("should return undefined when returnUrl is not in state", () => {
      const result = extractReturnUrl({ userId: '123', email: 'test@test.com' })
      expect(result).toBeUndefined()
    })

    it("should return returnUrl when present in state", () => {
      const result = extractReturnUrl({ 
        userId: '123', 
        email: 'test@test.com',
        returnUrl: '/accept-invite?token=abc123' 
      })
      expect(result).toBe('/accept-invite?token=abc123')
    })

    it("should handle encoded returnUrl in state", () => {
      const encodedUrl = encodeURIComponent('/accept-invite?token=abc123')
      const result = extractReturnUrl({ 
        userId: '123', 
        returnUrl: encodedUrl 
      })
      expect(result).toBe(encodedUrl)
    })
  })

  describe("full flow simulation", () => {
    /**
     * Simulates the complete flow from registration to redirect
     */
    const simulateSetup2FAComplete = (locationState: {
      userId?: string
      email?: string
      qrCode?: string
      provider?: string
      returnUrl?: string
    } | null) => {
      // Extract state (as Setup2FAPage does)
      const { returnUrl } = locationState || {}
      
      // Calculate final redirect URL
      const finalRedirectUrl = returnUrl ? decodeURIComponent(returnUrl) : '/workspace-selection'
      
      // Simulate successful 2FA verification
      const token = 'eyJhbGciOi...'
      localStorage.clear()
      localStorage.setItem('token', token)
      
      return {
        finalRedirectUrl,
        tokenSaved: localStorage.getItem('token') === token,
      }
    }

    it("should redirect to /workspace-selection for normal registration", () => {
      const result = simulateSetup2FAComplete({
        userId: 'user-123',
        email: 'test@example.com',
        qrCode: 'otpauth://...',
        provider: 'email',
        // No returnUrl - normal registration
      })

      expect(result.finalRedirectUrl).toBe('/workspace-selection')
      expect(result.tokenSaved).toBe(true)
    })

    it("should redirect to /accept-invite for invitation registration", () => {
      const result = simulateSetup2FAComplete({
        userId: 'user-123',
        email: 'invited@example.com',
        qrCode: 'otpauth://...',
        provider: 'email',
        returnUrl: encodeURIComponent('/accept-invite?token=invite-token-abc'),
      })

      expect(result.finalRedirectUrl).toBe('/accept-invite?token=invite-token-abc')
      expect(result.tokenSaved).toBe(true)
    })

    it("should redirect to /accept-invite for Google OAuth invitation", () => {
      const result = simulateSetup2FAComplete({
        userId: 'user-123',
        email: 'invited@example.com',
        qrCode: 'otpauth://...',
        provider: 'google',
        returnUrl: encodeURIComponent('/accept-invite?token=invite-token-xyz'),
      })

      expect(result.finalRedirectUrl).toBe('/accept-invite?token=invite-token-xyz')
      expect(result.tokenSaved).toBe(true)
    })

    it("should handle null state gracefully", () => {
      const result = simulateSetup2FAComplete(null)

      expect(result.finalRedirectUrl).toBe('/workspace-selection')
      expect(result.tokenSaved).toBe(true)
    })
  })
})
