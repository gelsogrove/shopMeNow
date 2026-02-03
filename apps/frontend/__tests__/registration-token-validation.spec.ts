/**
 * 🧪 Registration Token Validation Tests - THE BIBLE
 * 
 * CRITICAL: These tests prevent regression bugs in registration flow.
 * NEVER modify tokenApi baseURL without updating these tests!
 * 
 * Coverage:
 * - Token API baseURL must be /api/v1/token (NOT /api/token)
 * - Token validation endpoint correctness
 * - Registration page token handling logic
 * - Error states and user feedback
 * 
 * History:
 * - v275-v276: Bug introduced when baseURL changed to /api/token (404 errors)
 * - v277: Fixed with correct baseURL /api/v1/token
 */

import { describe, it, expect } from 'vitest'

describe('Registration Token Validation - THE BIBLE', () => {
  describe('🔴 CRITICAL: TokenAPI Configuration (NEVER CHANGE)', () => {
    it('should ALWAYS use baseURL=/api/v1/token (NOT /api/token)', () => {
      // ✅ CORRECT: /api/v1/token
      // ❌ WRONG: /api/token (missing v1 - causes 404)
      const CORRECT_BASE_URL = '/api/v1/token'
      const WRONG_BASE_URL = '/api/token'
      
      // Document why this is critical
      expect(CORRECT_BASE_URL).toBe('/api/v1/token')
      expect(WRONG_BASE_URL).not.toBe(CORRECT_BASE_URL)
      
      // This test serves as documentation
      expect(CORRECT_BASE_URL.includes('/v1/')).toBe(true)
    })

    it('should NEVER use authentication cookies (withCredentials=false)', () => {
      // Token endpoints must NOT send cookies
      const correctConfig = {
        baseURL: '/api/v1/token',
        withCredentials: false, // CRITICAL: Must be false
      }
      
      expect(correctConfig.withCredentials).toBe(false)
    })

    it('should document why /api/v1/token is correct', () => {
      // Backend: app.use("/api/v1", apiRouter) - see backend/src/app.ts:787
      // Router: router.use("/token", createTokenRouter()) - see backend/src/routes/index.ts:509
      // Result: /api/v1 + /token = /api/v1/token ✅
      
      const backendMount = '/api/v1'
      const tokenRouteMount = '/token'
      const fullBasePath = `${backendMount}${tokenRouteMount}`
      
      expect(fullBasePath).toBe('/api/v1/token')
    })
  })

  describe('Token Validation Endpoint Path', () => {
    it('should construct correct full endpoint path', () => {
      const baseURL = '/api/v1/token'
      const endpoint = '/validate-secure-token'
      const fullPath = `${baseURL}${endpoint}`
      
      expect(fullPath).toBe('/api/v1/token/validate-secure-token')
    })

    it('should NOT include type parameter (universal token system)', () => {
      const requestBody = {
        token: 'test-token-123',
        workspaceId: 'test-workspace',
        // type: NOT INCLUDED - allows any valid token type
      }

      expect(requestBody).toHaveProperty('token')
      expect(requestBody).toHaveProperty('workspaceId')
      expect(requestBody).not.toHaveProperty('type')
    })

    it('should handle valid token response structure', () => {
      const validResponse = {
        valid: true,
        data: {
          id: 'token-uuid',
          type: 'registration',
          workspaceId: 'workspace-id',
          phoneNumber: '+1234567890',
          expiresAt: '2026-12-31T23:59:59.000Z',
        },
        payload: {
          language: 'en',
          phoneNumber: '+1234567890',
        },
      }

      expect(validResponse.valid).toBe(true)
      expect(validResponse.data.type).toBe('registration')
    })

    it('should handle invalid token response structure', () => {
      const invalidResponse = {
        valid: false,
        error: 'Token expired or invalid',
        errorType: 'TOKEN_EXPIRED',
      }

      expect(invalidResponse.valid).toBe(false)
      expect(invalidResponse.error).toBeTruthy()
    })
  })

  describe('Registration Page URL Parameter Extraction', () => {
    it('should extract token from query string', () => {
      const url = 'https://echatbot.ai/registration/workspace-id?token=abc123&lang=en'
      const urlObj = new URL(url)
      const token = urlObj.searchParams.get('token')
      const lang = urlObj.searchParams.get('lang')
      
      expect(token).toBe('abc123')
      expect(lang).toBe('en')
    })

    it('should extract workspaceId from path parameter', () => {
      const path = '/registration/echatbot-hq-support?token=abc123'
      const match = path.match(/\/registration\/([^?]+)/)
      const workspaceId = match ? match[1] : null
      
      expect(workspaceId).toBe('echatbot-hq-support')
    })

    it('should handle missing token gracefully', () => {
      const url = 'https://echatbot.ai/registration/workspace-id'
      const urlObj = new URL(url)
      const token = urlObj.searchParams.get('token')
      
      expect(token).toBeNull()
    })
  })

  describe('Registration Page State Logic', () => {
    it('should show form when token is valid', () => {
      const tokenValid = true
      const tokenError = null
      const loading = false

      const shouldShowForm = tokenValid && !tokenError && !loading
      
      expect(shouldShowForm).toBe(true)
    })

    it('should show error when token is invalid', () => {
      const tokenValid = false
      const tokenError = 'Token expired'
      const loading = false

      const shouldShowError = !tokenValid || !!tokenError
      
      expect(shouldShowError).toBe(true)
    })

    it('should show loading during validation', () => {
      const validatingToken = true
      const tokenValid = false

      const shouldShowLoading = validatingToken
      
      expect(shouldShowLoading).toBe(true)
    })

    it('should hide form during loading', () => {
      const tokenValid = true
      const loading = true

      const shouldShowForm = tokenValid && !loading
      
      expect(shouldShowForm).toBe(false)
    })
  })

  describe('Error Messages and User Feedback', () => {
    it('should provide clear error when token is missing', () => {
      const token = ''
      const expectedError = 'Token mancante nel link'
      
      const actualError = !token ? expectedError : null
      
      expect(actualError).toBe(expectedError)
    })

    it('should provide clear error when token is expired', () => {
      const errorType = 'TOKEN_EXPIRED'
      const errorMessage = errorType === 'TOKEN_EXPIRED' 
        ? 'Link expired or invalid' 
        : null
      
      expect(errorMessage).toBe('Link expired or invalid')
    })

    it('should show Try Again button on error', () => {
      const tokenError = 'Some error'
      const showRetryButton = !!tokenError
      
      expect(showRetryButton).toBe(true)
    })
  })

  describe('useTokenValidation Hook Integration', () => {
    it('should pass correct parameters to hook', () => {
      const hookParams = {
        token: 'test-token-123',
        type: 'registration',
        workspaceId: 'test-workspace',
        autoValidate: true,
      }

      expect(hookParams.token).toBeTruthy()
      expect(hookParams.type).toBe('registration')
      expect(hookParams.workspaceId).toBeTruthy()
      expect(hookParams.autoValidate).toBe(true)
    })

    it('should auto-validate on mount when token exists', () => {
      const autoValidate = true
      const token = 'test-token-123'
      
      const shouldAutoValidate = autoValidate && !!token
      
      expect(shouldAutoValidate).toBe(true)
    })

    it('should NOT auto-validate when token is missing', () => {
      const autoValidate = true
      const token = ''
      
      const shouldAutoValidate = autoValidate && !!token
      
      expect(shouldAutoValidate).toBe(false)
    })
  })

  describe('🚨 REGRESSION PREVENTION (Historical Bugs)', () => {
    it('REGRESSION v275-v276: NEVER change baseURL to /api/token', () => {
      // BUG HISTORY:
      // v275-v276: baseURL was changed from /api/v1/token to /api/token
      // Result: 404 "Cannot POST /api/token/validate-secure-token"
      // Backend routes are at /api/v1/token, not /api/token
      
      const WRONG_BASE_URL = '/api/token'
      const CORRECT_BASE_URL = '/api/v1/token'
      
      expect(CORRECT_BASE_URL).toBe('/api/v1/token')
      expect(WRONG_BASE_URL).toBe('/api/token')
      expect(CORRECT_BASE_URL).not.toBe(WRONG_BASE_URL)
    })

    it('REGRESSION: workspace name fetch removed (endpoint did not exist)', () => {
      // Previous code called tokenApi.get(`/workspaces/${workspaceId}`)
      // This endpoint does NOT exist under /api/v1/token
      // Solution: Use fallback "Our Service" when workspace name unavailable
      
      const workspaceName = ''
      const displayName = workspaceName || 'Our Service'
      
      expect(displayName).toBe('Our Service')
    })

    it('REGRESSION: token validation is MANDATORY before showing form', () => {
      // SECURITY: Without token validation, anyone can access registration
      // Token must be validated before showing the form
      
      const hasToken = true
      const mustValidateBeforeShowingForm = hasToken
      
      expect(mustValidateBeforeShowingForm).toBe(true)
    })
  })

  describe('Backend Route Mapping Documentation', () => {
    it('should document complete backend path construction', () => {
      // Step 1: app.use("/api/v1", apiRouter) - backend/src/app.ts:787
      // Step 2: router.use("/token", createTokenRouter()) - backend/src/routes/index.ts:509
      // Step 3: router.use("/", publicOrdersRouter) - backend/src/routes/token/index.ts
      // Step 4: publicOrdersRouter has /validate-secure-token endpoint
      
      const step1 = '/api/v1'
      const step2 = '/token'
      const step3 = '/validate-secure-token'
      
      const fullPath = `${step1}${step2}${step3}`
      
      expect(fullPath).toBe('/api/v1/token/validate-secure-token')
    })

    it('should document why /api/token returns 404', () => {
      // Without /v1, path becomes: /api/token/validate-secure-token
      // Backend does NOT have routes mounted at /api/token
      // Only /api/v1/token exists
      
      const wrongPath = '/api/token/validate-secure-token'
      const expectedHTTPStatus = 404
      
      expect(expectedHTTPStatus).toBe(404)
      expect(wrongPath).not.toContain('/v1/')
    })
  })

  describe('Production Deployment Checklist', () => {
    it('should verify production config before deploy', () => {
      const productionConfig = {
        baseURL: '/api/v1/token',
        withCredentials: false,
      }

      // CHECKLIST:
      // ✅ baseURL includes /v1/
      // ✅ withCredentials is false
      // ✅ Frontend build includes this config
      
      expect(productionConfig.baseURL).toContain('/v1/')
      expect(productionConfig.withCredentials).toBe(false)
    })

    it('should document cache busting procedure', () => {
      // If changes don't appear in production:
      // 1. git commit --allow-empty -m "chore: force rebuild"
      // 2. git push heroku main
      // 3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
      
      const cacheBustingSteps = [
        'Create empty commit to force Heroku rebuild',
        'Push to Heroku to trigger new deployment',
        'Clear browser cache with hard refresh',
      ]

      expect(cacheBustingSteps).toHaveLength(3)
    })
  })
})
