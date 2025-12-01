/**
 * SESSION VALIDATION MIDDLEWARE SECURITY TESTS
 * 
 * Tests for session-validation.middleware.ts
 * Verifies proper session validation and security checks.
 * 
 * @security HIGH
 */

import { Request, Response, NextFunction } from 'express'

// Create mock functions before importing the middleware
const mockValidateSession = jest.fn()
const mockUnauthorized = jest.fn()
const mockInternalError = jest.fn()

jest.mock('../../src/application/services/admin-session.service', () => ({
  adminSessionService: {
    validateSession: mockValidateSession
  }
}))

jest.mock('../../src/utils/logger', () => {
  const mockFn = jest.fn()
  return {
    __esModule: true,
    default: {
      info: mockFn,
      warn: mockFn,
      error: mockFn,
      debug: mockFn,
    }
  }
})

jest.mock('../../src/utils/secure-error-responses', () => ({
  SecureErrorResponses: {
    unauthorized: (res: any, message: string) => {
      mockUnauthorized(message)
      res.status(401).json({ error: 'Unauthorized', message })
    },
    internalError: (res: any, error: any) => {
      mockInternalError(error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}))

// Import after mocks are set up
import { sessionValidationMiddleware } from '../../src/interfaces/http/middlewares/session-validation.middleware'

describe('🔐 Session Validation Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockReq = {
      headers: {},
      method: 'GET',
      url: '/api/test',
      get: jest.fn(),
      ip: '127.0.0.1'
    }
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    
    mockNext = jest.fn()
  })

  describe('Session ID Header Validation', () => {
    it('should REJECT request without x-session-id header', async () => {
      mockReq.headers = {} // No session ID
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should REJECT request with empty x-session-id', async () => {
      mockReq.headers = { 'x-session-id': '' }
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should REJECT request with whitespace-only x-session-id', async () => {
      mockReq.headers = { 'x-session-id': '   ' }
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Session Validation', () => {
    it('should REJECT invalid session', async () => {
      mockReq.headers = { 'x-session-id': 'invalid-session-123' }
      
      mockValidateSession.mockResolvedValue({
        valid: false,
        error: 'Session expired'
      })
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should REJECT session with no user data', async () => {
      mockReq.headers = { 'x-session-id': 'session-without-user' }
      
      mockValidateSession.mockResolvedValue({
        valid: true,
        session: { id: 'session-123', user: null }
      })
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should ACCEPT valid session and attach to request', async () => {
      const validSession = {
        id: 'session-valid-123',
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      }
      
      mockReq.headers = { 'x-session-id': 'valid-session' }
      ;(mockReq as any).user = { id: 'user-123', email: 'test@example.com' }
      
      mockValidateSession.mockResolvedValue({
        valid: true,
        session: validSession
      })
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      expect((mockReq as any).session).toBe(validSession)
      expect((mockReq as any).sessionUser).toBe(validSession.user)
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('🚨 SECURITY: Token-Session User Mismatch Detection', () => {
    it('should DETECT and BLOCK session hijacking attempt', async () => {
      // Scenario: Attacker has valid session but tries to use with different token
      const attackerSession = {
        id: 'attacker-session',
        user: {
          id: 'attacker-user-id',
          email: 'attacker@evil.com'
        }
      }
      
      mockReq.headers = { 'x-session-id': 'attacker-session' }
      // Token belongs to different user (the victim)
      ;(mockReq as any).user = {
        id: 'victim-user-id',
        email: 'victim@example.com'
      }
      
      mockValidateSession.mockResolvedValue({
        valid: true,
        session: attackerSession
      })
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      // Should be rejected due to user mismatch
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
      
      console.log('🔒 SECURITY: Session hijacking attempt DETECTED and BLOCKED')
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockReq.headers = { 'x-session-id': 'valid-session' }
      
      mockValidateSession.mockRejectedValue(
        new Error('Database connection failed')
      )
      
      await sessionValidationMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )
      
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})
