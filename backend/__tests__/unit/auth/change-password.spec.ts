/**
 * Unit Tests: Change Password
 * 
 * Tests the change password flow including:
 * - Current password verification
 * - New password validation
 * - Hash update
 * - Error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { AuthService } from '../../../src/application/services/auth.service'

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockUser = {
    findUnique: jest.fn(),
    update: jest.fn(),
  }

  return {
    PrismaClient: jest.fn(() => ({
      user: mockUser,
      $disconnect: jest.fn(),
    })),
  }
})

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn(),
}))

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

describe('Change Password', () => {
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

  describe('changePassword()', () => {
    it('should successfully change password with valid current password', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_old_password',
        status: 'ACTIVE',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hashed_new_password',
      })

      await authService.changePassword(
        'user-id-123',
        'OldPassword123!',
        'NewPassword456!'
      )

      expect(bcrypt.compare).toHaveBeenCalledWith('OldPassword123!', 'hashed_old_password')
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword456!', 10)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        data: {
          passwordHash: 'hashed_NewPassword456!',
        },
      })
    })

    it('should reject password change with incorrect current password', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_old_password',
        status: 'ACTIVE',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(false)

      await expect(
        authService.changePassword(
          'user-id-123',
          'wrong_current_password',
          'new_password'
        )
      ).rejects.toThrow('Current password is incorrect')
    })

    it('should reject password change if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(
        authService.changePassword(
          'non-existent-user',
          'old_password',
          'new_password'
        )
      ).rejects.toThrow('User not found')
    })

    it('should reject weak passwords (less than 8 characters)', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_old_password',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      await expect(
        authService.changePassword(
          'user-id-123',
          'old_password',
          'weak'
        )
      ).rejects.toThrow('Password must be at least 8 characters')
    })

    it('should reject if new password equals current password', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_same_password',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      await expect(
        authService.changePassword(
          'user-id-123',
          'same_password',
          'same_password'
        )
      ).rejects.toThrow('New password must be different')
    })

    it('should hash new password before storing', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_old_password',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      mockPrisma.user.update.mockResolvedValue(mockUser)

      await authService.changePassword(
        'user-id-123',
        'OldPassword123!',
        'NewPassword456!'
      )

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword456!', 10)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        data: {
          passwordHash: expect.stringContaining('hashed_NewPassword456!'),
        },
      })
    })

    it('should not update other user fields', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashed_old_password',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      mockPrisma.user.update.mockResolvedValue(mockUser)

      await authService.changePassword(
        'user-id-123',
        'OldPassword123!',
        'NewPassword456!'
      )

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        data: {
          passwordHash: expect.any(String),
        },
      })
      // Verify only passwordHash is in data
      const updateCall = mockPrisma.user.update.mock.calls[0][0]
      expect(Object.keys(updateCall.data)).toEqual(['passwordHash'])
    })
  })
})
