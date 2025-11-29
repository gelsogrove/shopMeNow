/**
 * Unit Tests: User Login
 * 
 * Tests the login flow including:
 * - Credential verification
 * - Token generation
 * - Failed login attempts
 * - 2FA handling
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
    UserStatus: {
      ACTIVE: 'ACTIVE',
      INACTIVE: 'INACTIVE',
      SUSPENDED: 'SUSPENDED',
      PENDING: 'PENDING',
    },
  }
})

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(),
}))

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

describe('User Login', () => {
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

  describe('login()', () => {
    it('should successfully login with valid credentials (no 2FA)', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_password',
        firstName: 'John',
        lastName: 'Doe',
        role: 'MEMBER',
        status: 'ACTIVE',
        twoFactorEnabled: false,
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      const result = await authService.login(
        'user@test.com',
        'correct_password'
      )

      expect(result).toBeDefined()
      expect(result.token).toBe('mock-jwt-token')
      expect(result.requires2FA).toBe(false)
      expect(bcrypt.compare).toHaveBeenCalledWith('correct_password', 'hashed_password')
    })

    it('should reject login with incorrect password', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_password',
        status: 'ACTIVE',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(false)

      await expect(
        authService.login('user@test.com', 'wrong_password')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should reject login with non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(
        authService.login('nonexistent@test.com', 'password')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should require 2FA if user has it enabled', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_password',
        status: 'ACTIVE',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret123',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      const result = await authService.login(
        'user@test.com',
        'correct_password'
      )

      expect(result.requires2FA).toBe(true)
      expect(result.token).toBe('') // No token until 2FA verified
      expect(result.user.id).toBe('user-id-123')
    })

    it('should reject login for inactive/suspended users', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_password',
        status: 'SUSPENDED',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      await expect(
        authService.login('user@test.com', 'correct_password')
      ).rejects.toThrow('Your account has been disabled')
    })

    it('should generate JWT token with correct payload', async () => {
      const jwt = require('jsonwebtoken')
      const mockUser = {
        id: 'user-id-123',
        email: 'user@test.com',
        passwordHash: 'hashed_password',
        role: 'ADMIN',
        status: 'ACTIVE',
        twoFactorEnabled: false,
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      await authService.login('user@test.com', 'correct_password')

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-id-123',
          email: 'user@test.com',
          role: 'ADMIN',
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: expect.any(String),
        })
      )
    })
  })
})
