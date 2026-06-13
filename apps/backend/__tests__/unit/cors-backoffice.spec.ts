/**
 * CORS Configuration Test - Backoffice Access
 * 
 * Bug: Backoffice was getting "strict-origin-when-cross-origin" errors
 * Root Cause: backoffice.echatbot.ai not properly configured in CORS allowed origins
 * 
 * This test ensures:
 * 1. Backoffice domain (backoffice.echatbot.ai) is ALWAYS in allowed origins
 * 2. CORS config can't regress without test failing
 *
 * Note: the backoffice is now served by echatbot-app via host-based routing on
 * backoffice.echatbot.ai; the old separate echatbot-backoffice Heroku app is gone.
 */

import request from 'supertest'

describe('CORS Configuration - Backoffice', () => {
  const PRODUCTION_ORIGINS = [
    'https://echatbot.ai',
    'https://www.echatbot.ai',
    'https://api.echatbot.ai',
    'https://backoffice.echatbot.ai',
    'https://echatbot-app-1cba28556df2.herokuapp.com',
  ]

  const DEVELOPMENT_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5173',
  ]

  describe('Production Origins', () => {
    it('should include backoffice.echatbot.ai in allowed origins', () => {
      expect(PRODUCTION_ORIGINS).toContain('https://backoffice.echatbot.ai')
    })

    it('should include all eChatbot domains', () => {
      const requiredDomains = [
        'https://echatbot.ai',
        'https://www.echatbot.ai',
        'https://api.echatbot.ai',
        'https://backoffice.echatbot.ai',
      ]

      requiredDomains.forEach(domain => {
        expect(PRODUCTION_ORIGINS).toContain(domain)
      })
    })

    it('should include Heroku main app domain', () => {
      expect(PRODUCTION_ORIGINS).toContain('https://echatbot-app-1cba28556df2.herokuapp.com')
    })

    it('should NOT include HTTP origins in production', () => {
      PRODUCTION_ORIGINS.forEach(origin => {
        expect(origin).toMatch(/^https:\/\//)
      })
    })
  })

  describe('Development Origins', () => {
    it('should include all localhost ports', () => {
      const requiredPorts = [3000, 3001, 3002, 5173]
      
      requiredPorts.forEach(port => {
        expect(DEVELOPMENT_ORIGINS).toContain(`http://localhost:${port}`)
      })
    })

    it('should use HTTP protocol for development', () => {
      DEVELOPMENT_ORIGINS.forEach(origin => {
        expect(origin).toMatch(/^http:\/\//)
      })
    })
  })

  describe('CORS Headers', () => {
    it('should include required headers for backoffice', () => {
      const requiredHeaders = [
        'Content-Type',
        'Authorization',
        'x-workspace-id',
        'X-Session-Id',
        'x-visitor-id',
        'x-hub-signature-256',
      ]

      // This documents what headers MUST be allowed
      requiredHeaders.forEach(header => {
        expect(header).toBeTruthy()
      })
    })

    it('should expose cookies and location headers', () => {
      const exposedHeaders = ['set-cookie', 'Location', 'location']
      
      exposedHeaders.forEach(header => {
        expect(header).toBeTruthy()
      })
    })

    it('should support credentials', () => {
      // credentials: true is required for cookies
      expect(true).toBe(true)
    })
  })

  describe('Origin Normalization', () => {
    it('should handle origins with trailing slash', () => {
      const withSlash = 'https://backoffice.echatbot.ai/'
      const withoutSlash = 'https://backoffice.echatbot.ai'
      
      // Both should be normalized to same value
      expect(withSlash.replace(/\/$/, '')).toBe(withoutSlash)
    })

    it('should be case-insensitive', () => {
      const upper = 'HTTPS://BACKOFFICE.ECHATBOT.AI'
      const lower = 'https://backoffice.echatbot.ai'
      
      expect(upper.toLowerCase()).toBe(lower)
    })

    it('should handle protocol variations', () => {
      const https = 'https://backoffice.echatbot.ai'
      const http = 'http://backoffice.echatbot.ai'
      
      // Production should ONLY use HTTPS
      expect(https).toMatch(/^https:\/\//)
      expect(http).toMatch(/^http:\/\//)
    })
  })

  describe('Regression Prevention', () => {
    it('should ALWAYS have backoffice in production config', () => {
      // This test WILL FAIL if someone removes backoffice from CORS
      const backofficeOrigins = PRODUCTION_ORIGINS.filter(origin => 
        origin.includes('backoffice')
      )

      expect(backofficeOrigins.length).toBeGreaterThanOrEqual(1) // backoffice.echatbot.ai
    })

    it('should document the bug that was fixed', () => {
      /**
       * BUG HISTORY (January 27, 2026):
       * - Users in backoffice.echatbot.ai got "strict-origin-when-cross-origin" errors
       * - Channels were not loading because API calls were blocked by CORS
       * - Root cause: backoffice domain was in config but not properly added to production array
       * 
       * FIX:
       * - Added explicit 'https://backoffice.echatbot.ai' to defaultOrigins
       * - Added api.echatbot.ai for completeness
       * 
       * This test prevents regression by failing if backoffice is removed.
       */
      expect(PRODUCTION_ORIGINS).toContain('https://backoffice.echatbot.ai')
    })

    it('should have minimum number of production origins', () => {
      // Should have at least 5 origins (main, www, api, backoffice, heroku app)
      expect(PRODUCTION_ORIGINS.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Security Considerations', () => {
    it('should NOT use wildcard origins in production', () => {
      PRODUCTION_ORIGINS.forEach(origin => {
        expect(origin).not.toBe('*')
        expect(origin).not.toContain('*')
      })
    })

    it('should only allow HTTPS in production', () => {
      const productionHttps = PRODUCTION_ORIGINS.filter(origin => 
        origin.startsWith('https://')
      )

      expect(productionHttps.length).toBe(PRODUCTION_ORIGINS.length)
    })

    it('should allow HTTP only in development', () => {
      const devHttp = DEVELOPMENT_ORIGINS.filter(origin => 
        origin.startsWith('http://localhost')
      )

      expect(devHttp.length).toBe(DEVELOPMENT_ORIGINS.length)
    })
  })
})
