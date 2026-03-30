/**
 * Unit Tests: Forgot Password / Password Reset
 * 
 * Tests the password reset flow including:
 * - Reset email sending
 * - Token generation
 * - Token expiration
 * - Password reset completion
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { AuthService } from '../../../src/application/services/auth.service'

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockUser = {
    findUnique: jest.fn(),
    update: jest.fn(),
  }
  const mockPasswordResetToken = {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  }

  return {
    PrismaClient: jest.fn(() => ({
      user: mockUser,
      passwordReset: mockPasswordResetToken,
      $disconnect: jest.fn(),
      $transaction: jest.fn((operations: any) => {
        if (Array.isArray(operations)) {
          return Promise.all(operations)
        }
        return Promise.resolve(operations())
      }),
    })),
  }
})

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn(),
}))

// Mock crypto — only stub randomBytes; let createHash pass through to the real
// implementation so BUG#17 token hashing continues to work in tests.
jest.mock('crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actual = jest.requireActual('crypto') as Record<string, unknown>
  return {
    ...actual,
    randomBytes: jest.fn(() => ({
      toString: jest.fn(() => 'random-token-123'),
    })),
  }
})

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

describe('Forgot Password / Password Reset', () => {
  let authService: AuthService
  let mockPrisma: any
  let bcrypt: any

  beforeEach(() => {
    const { PrismaClient } = require('@prisma/client')
    bcrypt = require('bcryptjs')
    mockPrisma = new PrismaClient()
    authService = new AuthService(mockPrisma)
    jest.clearAllMocks()
  })

  describe('requestPasswordReset()', () => {
    it('should generate reset token and send email for valid user', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        firstName: 'John',
        status: 'ACTIVE',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.passwordReset.create.mockResolvedValue({
        token: 'random-token-123',
        userId: 'user-id-123',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      })

      await authService.requestPasswordReset('user@test.com')

      expect(mockPrisma.passwordReset.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id-123',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        },
      })
    })

    it('should not reveal if email does not exist (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      // Should NOT throw error, return success to prevent email enumeration
      await expect(
        authService.requestPasswordReset('nonexistent@test.com')
      ).resolves.not.toThrow()
    })

    it('should set token expiration to 1 hour from now', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.passwordReset.create.mockResolvedValue({})

      const nowBefore = Date.now()
      await authService.requestPasswordReset('user@test.com')
      const nowAfter = Date.now()

      const createCall = mockPrisma.passwordReset.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt.getTime()

      expect(expiresAt).toBeGreaterThanOrEqual(nowBefore + 3600000)
      expect(expiresAt).toBeLessThanOrEqual(nowAfter + 3600000)
    })
  })

  describe('resetPassword()', () => {
    it('should successfully reset password with valid token', async () => {
      const mockToken = {
        token: 'valid-token-123',
        userId: 'user-id-123',
        expiresAt: new Date(Date.now() + 3600000), // Future
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(mockToken)
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-id-123',
        passwordHash: 'hashed_NewPassword123!',
      })
      mockPrisma.passwordReset.update.mockResolvedValue({})

      await authService.resetPassword('valid-token-123', 'NewPassword123!')

      // Verify user password was updated
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        data: {
          passwordHash: 'hashed_NewPassword123!',
        },
      })
      expect(mockPrisma.passwordReset.update).toHaveBeenCalled()
    })

    it('should reject reset with expired token', async () => {
      const mockToken = {
        token: 'expired-token-123',
        userId: 'user-id-123',
        expiresAt: new Date(Date.now() - 3600000), // Past
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(mockToken)

      await expect(
        authService.resetPassword('expired-token-123', 'new_password')
      ).rejects.toThrow('Reset token has expired')
    })

    it('should reject reset with invalid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null)

      await expect(
        authService.resetPassword('invalid-token', 'new_password')
      ).rejects.toThrow('Invalid or expired reset token')
    })

    it('should delete token after successful password reset', async () => {
      const mockToken = {
        id: 'token-id-123',
        token: 'valid-token-123',
        userId: 'user-id-123',
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(mockToken)
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.passwordReset.update.mockResolvedValue({})

      await authService.resetPassword('valid-token-123', 'NewPassword123!')

      expect(mockPrisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id: 'token-id-123' },
        data: { usedAt: expect.any(Date) },
      })
    })

    it('should reject weak passwords', async () => {
      const mockToken = {
        token: 'valid-token-123',
        userId: 'user-id-123',
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(mockToken)

      await expect(
        authService.resetPassword('valid-token-123', 'weak')
      ).rejects.toThrow('Password must be at least 8 characters')
    })
  })
})
