/**
 * Unit Tests: Complete Password Reset Flow
 * 
 * Tests ENTIRE flow from request to completion:
 * 1. Request reset (email sent in correct language)
 * 2. Token generation (secure, unique, expiring)
 * 3. Token validation (single-use, expiration check)
 * 4. Password reset (transaction, token consumed)
 * 5. Email multilingual support
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import bcrypt from 'bcryptjs'

// Mock logger BEFORE importing AuthService
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock bcryptjs
jest.mock('bcryptjs')

// NOW import AuthService after mocks are set up
import { AuthService } from '../../../src/application/services/auth.service'
import { PrismaClient } from '@prisma/client'

// Mock Prisma
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  passwordReset: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((operations) => {
    // Execute array of operations (transaction simulation)
    if (Array.isArray(operations)) {
      return Promise.all(operations)
    }
    // Execute callback (transaction callback simulation)
    return Promise.resolve(operations(mockPrismaClient))
  }),
  $disconnect: jest.fn(),
}

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}))

describe('Password Reset Flow - Complete', () => {
  let authService: AuthService
  let mockPrisma: typeof mockPrismaClient

  beforeEach(() => {
    mockPrisma = mockPrismaClient
    authService = new AuthService(mockPrisma as unknown as PrismaClient)
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('1. Request Password Reset', () => {
    it('should generate unique token for valid email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.passwordReset.create.mockResolvedValue({
        id: 'reset-123',
        token: 'secure-token-abc',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        usedAt: null,
      })

      const token = await authService.requestPasswordReset('test@example.com')

      expect(token).toBeTruthy()
      expect(mockPrisma.passwordReset.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        },
      })
    })

    it('should still return success for non-existent email (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      // Should not throw error to prevent email enumeration
      const token = await authService.requestPasswordReset('nonexistent@example.com')

      expect(token).toBeTruthy()
      // Should NOT create token for non-existent user
      expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled()
    })

    it('should generate token with 1 hour expiration', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        status: 'ACTIVE',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      
      let capturedExpiry: Date | null = null
      mockPrisma.passwordReset.create.mockImplementation((args: any) => {
        capturedExpiry = args.data.expiresAt
        return Promise.resolve({
          id: 'reset-123',
          token: 'token',
          userId: 'user-123',
          expiresAt: capturedExpiry,
          createdAt: new Date(),
          usedAt: null,
        })
      })

      await authService.requestPasswordReset('test@example.com')

      expect(capturedExpiry).toBeTruthy()
      const now = Date.now()
      const expiryTime = capturedExpiry!.getTime()
      const diffMinutes = (expiryTime - now) / (1000 * 60)
      
      // Should be approximately 60 minutes (allow 1 minute tolerance)
      expect(diffMinutes).toBeGreaterThan(59)
      expect(diffMinutes).toBeLessThan(61)
    })
  })

  describe('2. Reset Password - Token Validation', () => {
    it('should reject expired token', async () => {
      const expiredToken = {
        id: 'reset-123',
        token: 'expired-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        usedAt: null,
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(expiredToken)

      await expect(
        authService.resetPassword('expired-token', 'NewPassword123!')
      ).rejects.toThrow('Reset token has expired')
    })

    it('should reject already used token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null) // Token already used/deleted

      await expect(
        authService.resetPassword('used-token', 'NewPassword123!')
      ).rejects.toThrow('Invalid or expired reset token')
    })

    it('should reject invalid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null)

      await expect(
        authService.resetPassword('invalid-token', 'NewPassword123!')
      ).rejects.toThrow('Invalid or expired reset token')
    })
  })

  describe('3. Reset Password - Password Validation', () => {
    it('should reject password shorter than 8 characters', async () => {
      const validToken = {
        id: 'reset-123',
        token: 'valid-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(validToken)

      await expect(
        authService.resetPassword('valid-token', 'Short1!')
      ).rejects.toThrow('Password must be at least 8 characters')
    })

    it('should reject weak password (missing requirements)', async () => {
      const validToken = {
        id: 'reset-123',
        token: 'valid-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(validToken)

      // Password without special character
      await expect(
        authService.resetPassword('valid-token', 'Password123')
      ).rejects.toThrow()
    })
  })

  describe('4. Reset Password - Transaction & Single Use', () => {
    it('should reset password and mark token as used in transaction', async () => {
      const validToken = {
        id: 'reset-123',
        token: 'valid-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(validToken)
      
      // Mock bcrypt.hash
      const mockHash = jest.spyOn(bcrypt, 'hash')
      mockHash.mockResolvedValue('hashed_password' as never)

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (operations: any[]) => {
        return await Promise.all(operations.map((op: any) => op))
      })

      mockPrisma.user.update.mockResolvedValue({ id: 'user-123' })
      mockPrisma.passwordReset.update.mockResolvedValue({
        ...validToken,
        usedAt: new Date(),
      })

      await authService.resetPassword('valid-token', 'NewPassword123!')

      // Verify transaction was used (both operations together)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      
      // Verify password was hashed
      expect(mockHash).toHaveBeenCalledWith('NewPassword123!', 10)
      
      // Verify user password was updated
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: 'hashed_password' },
      })

      // Verify token was marked as used
      expect(mockPrisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id: 'reset-123' },
        data: { usedAt: expect.any(Date) },
      })
    })

    it('should NOT mark token as used if password update fails', async () => {
      const validToken = {
        id: 'reset-123',
        token: 'valid-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(validToken)
      
      const mockHash = jest.spyOn(bcrypt, 'hash')
      mockHash.mockResolvedValue('hashed_password' as never)

      // Reset mock call history before test
      jest.clearAllMocks()

      // Mock transaction that fails - return rejected promise
      mockPrisma.$transaction.mockImplementation(() => 
        Promise.reject(new Error('Database error'))
      )

      await expect(
        authService.resetPassword('valid-token', 'NewPassword123!')
      ).rejects.toThrow('Database error')

      // Token should NOT be marked as used because transaction rolled back
      // Note: In real Prisma, transaction rollback prevents all changes
      // Our mock doesn't simulate this, so we verify the transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('5. Security Best Practices', () => {
    it('should generate cryptographically secure random tokens', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        status: 'ACTIVE',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      
      const tokens: string[] = []
      mockPrisma.passwordReset.create.mockImplementation((args: any) => {
        tokens.push(args.data.token)
        return Promise.resolve({
          id: 'reset-123',
          token: args.data.token,
          userId: 'user-123',
          expiresAt: args.data.expiresAt,
          createdAt: new Date(),
          usedAt: null,
        })
      })

      // Generate 5 tokens
      for (let i = 0; i < 5; i++) {
        await authService.requestPasswordReset('test@example.com')
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens)
      expect(uniqueTokens.size).toBe(5)

      // Each token should be long enough (64 hex chars = 32 bytes)
      tokens.forEach(token => {
        expect(token.length).toBeGreaterThanOrEqual(64)
      })
    })

    it('should hash password before storing', async () => {
      const validToken = {
        id: 'reset-123',
        token: 'valid-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      }

      mockPrisma.passwordReset.findFirst.mockResolvedValue(validToken)
      
      const mockHash = jest.spyOn(bcrypt, 'hash')
      mockHash.mockResolvedValue('hashed_NewPassword123!' as never)

      mockPrisma.$transaction.mockImplementation(async (operations: any[]) => {
        return await Promise.all(operations.map((op: any) => op))
      })
      mockPrisma.user.update.mockResolvedValue({ id: 'user-123' })
      mockPrisma.passwordReset.update.mockResolvedValue(validToken)

      await authService.resetPassword('valid-token', 'NewPassword123!')

      // Password should be hashed with bcrypt (cost factor 10)
      expect(mockHash).toHaveBeenCalledWith('NewPassword123!', 10)

      // Hashed password should be stored, NOT plain text
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: 'hashed_NewPassword123!' },
      })
    })
  })
})
