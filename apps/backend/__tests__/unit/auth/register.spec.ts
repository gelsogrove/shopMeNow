/**
 * Unit Tests: User Registration
 * 
 * Tests the registration flow including:
 * - Email validation
 * - Password hashing
 * - User creation
 * - Error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { AuthService } from '../../../src/application/services/auth.service'

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockUser = {
    findUnique: jest.fn(),
    create: jest.fn(),
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

describe('User Registration', () => {
  let authService: AuthService
  let mockPrisma: any

  beforeEach(() => {
    const { PrismaClient } = require('@prisma/client')
    mockPrisma = new PrismaClient()
    authService = new AuthService(mockPrisma)
    jest.clearAllMocks()
  })

  describe('register()', () => {
    it('should successfully register a new user with valid data', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
      }

      mockPrisma.user.findUnique.mockResolvedValue(null) // Email not taken
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash: 'hashed_SecurePassword123!',
        role: 'MEMBER',
        status: 'ACTIVE',
        twoFactorEnabled: false,
      })

      const result = await authService.register({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
      })

      expect(result).toBeDefined()
      expect(result.id).toBe('new-user-id')
      expect(result.email).toBe(userData.email)
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          passwordHash: expect.stringContaining('hashed_'),
          role: 'MEMBER',
          status: 'ACTIVE',
        }),
      })
    })

    it('should reject registration if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: 'existing@test.com',
        deletedAt: null, // Active user, not soft-deleted
      })

      await expect(
        authService.register({
          email: 'existing@test.com',
          password: 'ValidPassword123!',
          firstName: 'John',
          lastName: 'Doe',
        })
      ).rejects.toThrow('User with this email already exists')
    })

    it('should hash password before storing', async () => {
      const bcrypt = require('bcryptjs')
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        passwordHash: 'hashed_password123',
      })

      await authService.register({
        email: 'test@test.com',
        password: 'ValidPassword123!',
        firstName: 'John',
        lastName: 'Doe',
      })

      expect(bcrypt.hash).toHaveBeenCalledWith('ValidPassword123!', 10)
    })

    it('should set 2FA disabled by default', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        twoFactorEnabled: false,
        recoveryCodes: [],
      })

      await authService.register({
        email: 'test@test.com',
        password: 'ValidPassword123!',
        firstName: 'John',
        lastName: 'Doe',
      })

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          twoFactorEnabled: false,
          recoveryCodes: [],
        }),
      })
    })
  })
})
