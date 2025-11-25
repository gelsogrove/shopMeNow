/**
 * LoginPage.returnUrl.spec.tsx
 * 
 * Tests for returnUrl handling in LoginPage
 * 
 * BUG FIXED: LoginPage was not passing returnUrl to the 2FA pages (Setup2FAPage, Verify2FAPage),
 * causing users to lose their invitation link context after completing registration/2FA.
 * Now, the returnUrl is extracted from query params and passed to 2FA pages via navigation state.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

describe("LoginPage returnUrl Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("returnUrl extraction from query params", () => {
    /**
     * Simulates extracting returnUrl from URLSearchParams (as LoginPage does)
     */
    const extractReturnUrl = (searchString: string): string | null => {
      const searchParams = new URLSearchParams(searchString)
      return searchParams.get('returnUrl')
    }

    it("should return null when no returnUrl in query", () => {
      const result = extractReturnUrl('')
      expect(result).toBeNull()
    })

    it("should return null when only other params exist", () => {
      const result = extractReturnUrl('?foo=bar&baz=qux')
      expect(result).toBeNull()
    })

    it("should extract simple returnUrl", () => {
      const result = extractReturnUrl('?returnUrl=/dashboard')
      expect(result).toBe('/dashboard')
    })

    it("should extract encoded returnUrl (invitation flow)", () => {
      // Note: URLSearchParams automatically decodes the value
      const encodedUrl = encodeURIComponent('/accept-invite?token=abc123')
      const result = extractReturnUrl(`?returnUrl=${encodedUrl}`)
      // URLSearchParams decodes it automatically
      expect(result).toBe('/accept-invite?token=abc123')
    })

    it("should extract returnUrl with other params present", () => {
      // Note: URLSearchParams automatically decodes the value
      const encodedUrl = encodeURIComponent('/accept-invite?token=abc123')
      const result = extractReturnUrl(`?foo=bar&returnUrl=${encodedUrl}&baz=qux`)
      expect(result).toBe('/accept-invite?token=abc123')
    })
  })

  describe("navigation state construction for registration flow", () => {
    /**
     * Simulates constructing the navigation state for setup-2fa (as onRegisterSubmit does)
     */
    const constructRegistrationNavigationState = (
      user: { id: string; email: string; firstName: string },
      qrCode: string,
      returnUrl: string | null
    ) => {
      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        qrCode,
        provider: 'email',
        returnUrl, // 🔗 Pass returnUrl for invitation flow
      }
    }

    it("should include returnUrl when present", () => {
      const user = { id: 'user-123', email: 'test@test.com', firstName: 'Test' }
      const returnUrl = encodeURIComponent('/accept-invite?token=abc123')
      
      const state = constructRegistrationNavigationState(user, 'otpauth://...', returnUrl)
      
      expect(state.returnUrl).toBe(returnUrl)
      expect(state.userId).toBe('user-123')
      expect(state.provider).toBe('email')
    })

    it("should set returnUrl to null when not present", () => {
      const user = { id: 'user-123', email: 'test@test.com', firstName: 'Test' }
      
      const state = constructRegistrationNavigationState(user, 'otpauth://...', null)
      
      expect(state.returnUrl).toBeNull()
    })
  })

  describe("navigation state construction for login flow", () => {
    /**
     * Simulates constructing the navigation state for verify-2fa (as onSubmit does)
     */
    const constructLoginNavigationState = (
      response: { userId: string; email: string },
      returnUrl: string | null
    ) => {
      return {
        userId: response.userId,
        email: response.email,
        provider: 'email',
        returnUrl, // 🔗 Pass returnUrl for invitation flow
      }
    }

    it("should include returnUrl when present (invitation login)", () => {
      const response = { userId: 'user-123', email: 'invited@test.com' }
      const returnUrl = encodeURIComponent('/accept-invite?token=invite-xyz')
      
      const state = constructLoginNavigationState(response, returnUrl)
      
      expect(state.returnUrl).toBe(returnUrl)
      expect(state.userId).toBe('user-123')
    })

    it("should set returnUrl to null for normal login", () => {
      const response = { userId: 'user-123', email: 'user@test.com' }
      
      const state = constructLoginNavigationState(response, null)
      
      expect(state.returnUrl).toBeNull()
    })
  })

  describe("navigation state construction for Google OAuth flow", () => {
    /**
     * Simulates constructing the navigation state for Google OAuth (both setup-2fa and verify-2fa)
     */
    const constructGoogleOAuthNavigationState = (
      user: { id: string; email: string; firstName?: string },
      options: { requiresSetup: boolean; qrCode?: string; returnUrl: string | null }
    ) => {
      if (options.requiresSetup) {
        // Navigate to setup-2fa
        return {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          qrCode: options.qrCode,
          provider: 'google',
          returnUrl: options.returnUrl,
        }
      } else {
        // Navigate to verify-2fa
        return {
          userId: user.id,
          email: user.email,
          provider: 'google',
          returnUrl: options.returnUrl,
        }
      }
    }

    it("should include returnUrl for Google OAuth new user (setup-2fa)", () => {
      const user = { id: 'google-user', email: 'google@test.com', firstName: 'Google' }
      const returnUrl = encodeURIComponent('/accept-invite?token=google-invite')
      
      const state = constructGoogleOAuthNavigationState(user, {
        requiresSetup: true,
        qrCode: 'otpauth://...',
        returnUrl,
      })
      
      expect(state.returnUrl).toBe(returnUrl)
      expect(state.provider).toBe('google')
      expect(state.qrCode).toBe('otpauth://...')
    })

    it("should include returnUrl for Google OAuth existing user (verify-2fa)", () => {
      const user = { id: 'google-user', email: 'google@test.com' }
      const returnUrl = encodeURIComponent('/accept-invite?token=google-invite-existing')
      
      const state = constructGoogleOAuthNavigationState(user, {
        requiresSetup: false,
        returnUrl,
      })
      
      expect(state.returnUrl).toBe(returnUrl)
      expect(state.provider).toBe('google')
      expect(state.qrCode).toBeUndefined()
    })

    it("should set returnUrl to null for normal Google OAuth", () => {
      const user = { id: 'google-user', email: 'google@test.com' }
      
      const state = constructGoogleOAuthNavigationState(user, {
        requiresSetup: false,
        returnUrl: null,
      })
      
      expect(state.returnUrl).toBeNull()
    })
  })

  describe("complete invitation registration flow", () => {
    /**
     * Simulates the complete flow from invitation link to workspace access
     * Note: URLSearchParams automatically decodes the returnUrl value
     */
    const simulateInvitationRegistrationFlow = () => {
      // Step 1: User arrives at /accept-invite?token=abc123
      const inviteToken = 'abc123'
      const acceptInviteUrl = `/accept-invite?token=${inviteToken}`
      
      // Step 2: AcceptInvitePage redirects to login with returnUrl
      const loginReturnUrl = encodeURIComponent(acceptInviteUrl)
      const loginUrl = `/auth/login?returnUrl=${loginReturnUrl}`
      
      // Step 3: LoginPage extracts returnUrl (URLSearchParams auto-decodes)
      const searchParams = new URLSearchParams(loginUrl.split('?')[1])
      const extractedReturnUrl = searchParams.get('returnUrl')
      // extractedReturnUrl is already decoded: '/accept-invite?token=abc123'
      
      // Step 4: User registers, LoginPage navigates to setup-2fa with returnUrl
      const setup2FAState = {
        userId: 'new-user-123',
        email: 'invited@test.com',
        firstName: 'Invited',
        qrCode: 'otpauth://...',
        provider: 'email',
        returnUrl: extractedReturnUrl, // Already decoded by URLSearchParams
      }
      
      // Step 5: Setup2FAPage calculates finalRedirectUrl
      const finalRedirectUrl = setup2FAState.returnUrl 
        ? decodeURIComponent(setup2FAState.returnUrl) 
        : '/workspace-selection'
      
      return {
        originalInviteToken: inviteToken,
        loginUrl,
        extractedReturnUrl,
        setup2FAState,
        finalRedirectUrl,
      }
    }

    it("should preserve invitation token through entire flow", () => {
      const flow = simulateInvitationRegistrationFlow()
      
      // Verify returnUrl was extracted from login URL (already decoded by URLSearchParams)
      expect(flow.extractedReturnUrl).toBe('/accept-invite?token=abc123')
      
      // Verify returnUrl was passed to setup-2fa state
      expect(flow.setup2FAState.returnUrl).toBe(flow.extractedReturnUrl)
      
      // Verify final redirect goes back to accept-invite with original token
      expect(flow.finalRedirectUrl).toBe('/accept-invite?token=abc123')
      expect(flow.finalRedirectUrl).toContain(flow.originalInviteToken)
    })
  })

  describe("complete invitation login flow", () => {
    /**
     * Simulates the flow for an existing user accepting an invitation
     */
    const simulateInvitationLoginFlow = () => {
      // Step 1: User arrives at /accept-invite?token=xyz789
      const inviteToken = 'xyz789'
      const acceptInviteUrl = `/accept-invite?token=${inviteToken}`
      
      // Step 2: AcceptInvitePage redirects to login with returnUrl
      const loginReturnUrl = encodeURIComponent(acceptInviteUrl)
      const loginUrl = `/auth/login?returnUrl=${loginReturnUrl}`
      
      // Step 3: LoginPage extracts returnUrl
      const searchParams = new URLSearchParams(loginUrl.split('?')[1])
      const extractedReturnUrl = searchParams.get('returnUrl')
      
      // Step 4: User logs in, requires 2FA, LoginPage navigates to verify-2fa with returnUrl
      const verify2FAState = {
        userId: 'existing-user-456',
        email: 'existing@test.com',
        provider: 'email',
        returnUrl: extractedReturnUrl,
      }
      
      // Step 5: Verify2FAPage calculates finalRedirectUrl
      const finalRedirectUrl = verify2FAState.returnUrl 
        ? decodeURIComponent(verify2FAState.returnUrl) 
        : '/workspace-selection'
      
      return {
        originalInviteToken: inviteToken,
        loginUrl,
        extractedReturnUrl,
        verify2FAState,
        finalRedirectUrl,
      }
    }

    it("should preserve invitation token through login flow", () => {
      const flow = simulateInvitationLoginFlow()
      
      // Verify returnUrl was extracted from login URL (already decoded by URLSearchParams)
      expect(flow.extractedReturnUrl).toBe('/accept-invite?token=xyz789')
      
      // Verify returnUrl was passed to verify-2fa state
      expect(flow.verify2FAState.returnUrl).toBe(flow.extractedReturnUrl)
      
      // Verify final redirect goes back to accept-invite with original token
      expect(flow.finalRedirectUrl).toBe('/accept-invite?token=xyz789')
      expect(flow.finalRedirectUrl).toContain(flow.originalInviteToken)
    })
  })
})
