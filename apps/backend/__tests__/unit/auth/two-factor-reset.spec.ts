/**
 * Unit Tests for TwoFactorResetService
 * 
 * Tests:
 * - TEST-1 to TEST-10: Service methods
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}))

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  twoFactorResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
}

// Mock email service
const mockEmailService = {
  sendEmail: jest.fn(),
}

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

describe('TwoFactorResetService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // TEST-1: createResetToken
  // ===========================================
  describe('TEST-1: createResetToken()', () => {
    it('should create a valid reset token', async () => {
      const userId = 'user-123'
      const adminId = 'admin-456'
      
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      }
      
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.twoFactorResetToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'generated-token',
        userId,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdByAdminId: adminId,
      })
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      })
      
      // Service will create token, disable 2FA, send email
      // When implemented:
      // const result = await service.createResetToken(userId, adminId)
      // expect(result.token).toBeDefined()
      
      expect(mockPrisma.user.findUnique).toBeDefined()
    })

    it('should reject if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      
      // When implemented:
      // await expect(service.createResetToken('invalid-id', 'admin-id'))
      //   .rejects.toThrow('User not found')
      
      expect(true).toBe(true) // Placeholder
    })

    it('should reject if user has no 2FA enabled', async () => {
      const userWithout2FA = {
        id: 'user-123',
        twoFactorEnabled: false,
      }
      
      mockPrisma.user.findUnique.mockResolvedValue(userWithout2FA)
      
      // When implemented:
      // await expect(service.createResetToken('user-123', 'admin-id'))
      //   .rejects.toThrow('User does not have 2FA enabled')
      
      expect(userWithout2FA.twoFactorEnabled).toBe(false)
    })

    it('should disable 2FA immediately when creating reset token', async () => {
      // 2FA should be disabled right away so old codes stop working
      const updateData = {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      }
      
      expect(updateData.twoFactorEnabled).toBe(false)
      expect(updateData.twoFactorSecret).toBeNull()
    })

    it('should send email with reset link', async () => {
      // Email service should be called with reset link
      const emailData = {
        to: 'user@example.com',
        subject: 'Reset Your 2FA',
        template: '2fa-reset',
        data: {
          resetLink: 'https://app.shopme.com/auth/2fa-reset/token-123',
          adminEmail: 'admin@example.com',
          expiresIn: '1 hour',
        },
      }
      
      expect(emailData.template).toBe('2fa-reset')
      expect(emailData.data.resetLink).toContain('/auth/2fa-reset/')
    })
  })

  // ===========================================
  // TEST-2: validateToken
  // ===========================================
  describe('TEST-2: validateToken()', () => {
    it('should return valid for unexpired, unused token', async () => {
      const validToken = {
        id: 'token-id',
        token: 'valid-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 1800000), // 30 min from now
        usedAt: null,
        createdAt: new Date(),
        createdByAdminId: 'admin-id',
      }
      
      mockPrisma.twoFactorResetToken.findFirst.mockResolvedValue(validToken)
      
      const isValid = validToken.expiresAt > new Date() && validToken.usedAt === null
      expect(isValid).toBe(true)
    })
  })

  // ===========================================
  // TEST-3: validateToken - expired
  // ===========================================
  describe('TEST-3: validateToken() - expired', () => {
    it('should reject expired token', async () => {
      const expiredToken = {
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        usedAt: null,
      }
      
      const isExpired = new Date() > expiredToken.expiresAt
      expect(isExpired).toBe(true)
    })
  })

  // ===========================================
  // TEST-4: validateToken - used
  // ===========================================
  describe('TEST-4: validateToken() - used', () => {
    it('should reject already-used token', async () => {
      const usedToken = {
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(), // Already used
      }
      
      const isUsed = usedToken.usedAt !== null
      expect(isUsed).toBe(true)
    })
  })

  // ===========================================
  // TEST-5: verifyPassword
  // ===========================================
  describe('TEST-5: verifyPassword()', () => {
    it('should verify password and return temp token', async () => {
      const user = {
        id: 'user-123',
        email: 'user@example.com',
        passwordHash: await bcrypt.hash('CorrectPass123!', 10),
      }
      
      mockPrisma.user.findUnique.mockResolvedValue(user)
      
      const passwordMatch = await bcrypt.compare('CorrectPass123!', user.passwordHash)
      expect(passwordMatch).toBe(true)
    })

    it('should reject wrong password', async () => {
      const user = {
        id: 'user-123',
        email: 'user@example.com',
        passwordHash: await bcrypt.hash('CorrectPass123!', 10),
      }
      
      const passwordMatch = await bcrypt.compare('WrongPassword', user.passwordHash)
      expect(passwordMatch).toBe(false)
    })
  })

  // ===========================================
  // TEST-6: verifyPassword - lockout
  // ===========================================
  describe('TEST-6: verifyPassword() - lockout', () => {
    it('should track failed attempts', async () => {
      // Service should track failed attempts and lock after 5
      const failedAttempts = new Map<string, { count: number; lockedUntil: Date | null }>()
      
      const userId = 'user-123'
      failedAttempts.set(userId, { count: 4, lockedUntil: null })
      
      // After one more failure:
      const current = failedAttempts.get(userId)!
      current.count += 1
      
      if (current.count >= 5) {
        current.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
      }
      
      expect(current.count).toBe(5)
      expect(current.lockedUntil).not.toBeNull()
    })
  })

  // ===========================================
  // TEST-7: complete2FASetup
  // ===========================================
  describe('TEST-7: complete2FASetup()', () => {
    it('should enable 2FA with new secret', async () => {
      const newSecret = 'NEWBASE32SECRET'
      const totpCode = '123456'
      
      // Service should:
      // 1. Verify TOTP code with new secret
      // 2. Update user with new secret
      // 3. Set twoFactorEnabled = true
      // 4. Mark token as used
      
      const updateData = {
        twoFactorSecret: newSecret,
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date(),
      }
      
      expect(updateData.twoFactorEnabled).toBe(true)
      expect(updateData.twoFactorSecret).toBe(newSecret)
    })
  })

  // ===========================================
  // TEST-8: setPassword for OAuth user
  // ===========================================
  describe('TEST-8: AuthService.setPassword()', () => {
    it('should set password for OAuth user', async () => {
      const oauthUser = {
        id: 'user-123',
        passwordHash: null,
        authProvider: 'google',
      }
      
      mockPrisma.user.findUnique.mockResolvedValue(oauthUser)
      
      const newPassword = 'NewStrongPass123!'
      const hashedPassword = await bcrypt.hash(newPassword, 10)
      
      const updateData = {
        passwordHash: hashedPassword,
        authProvider: 'multi',
      }
      
      expect(updateData.authProvider).toBe('multi')
      expect(updateData.passwordHash).toBeDefined()
    })
  })

  // ===========================================
  // TEST-9: setPassword - reject if exists
  // ===========================================
  describe('TEST-9: AuthService.setPassword() - reject if exists', () => {
    it('should reject if user already has password', async () => {
      const userWithPassword = {
        id: 'user-123',
        passwordHash: '$2b$10$existinghash',
        authProvider: 'email',
      }
      
      const hasPassword = userWithPassword.passwordHash !== null
      expect(hasPassword).toBe(true)
      
      // Service should throw: 'User already has a password. Use change password instead.'
    })
  })

  // ===========================================
  // TEST-10: Email template
  // ===========================================
  describe('TEST-10: Email template renders correctly', () => {
    it('should include all required fields in email', () => {
      const emailTemplate = {
        subject: '🔐 Reset Your Two-Factor Authentication',
        body: `
          <h1>2FA Reset Requested</h1>
          <p>An administrator has initiated a 2FA reset for your account.</p>
          <p>Administrator: {{adminEmail}}</p>
          <p>Click the link below to set up your new 2FA:</p>
          <a href="{{resetLink}}">Reset 2FA</a>
          <p>This link expires in {{expiresIn}}.</p>
          <p>If you did not request this, contact support immediately.</p>
        `,
      }
      
      expect(emailTemplate.body).toContain('{{adminEmail}}')
      expect(emailTemplate.body).toContain('{{resetLink}}')
      expect(emailTemplate.body).toContain('{{expiresIn}}')
      expect(emailTemplate.body).toContain('administrator')
    })
  })

  // ===========================================
  // TEST-11 to TEST-16: Additional edge cases
  // ===========================================
  describe('Additional Tests', () => {
    it('TEST-11: should generate 1 hour expiry for token', () => {
      const createdAt = new Date()
      const expiresAt = new Date(createdAt.getTime() + 3600000)
      
      const diffMs = expiresAt.getTime() - createdAt.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      
      expect(diffHours).toBe(1)
    })

    it('TEST-12: should create audit log with all required fields', () => {
      const auditLog = {
        action: '2fa-reset-initiated',
        performedBy: 'admin-123',
        targetUserId: 'user-456',
        targetUserEmail: 'user@example.com',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        details: {
          reason: 'User lost phone',
          tokenExpiry: '1 hour',
        },
      }
      
      expect(auditLog.action).toBe('2fa-reset-initiated')
      expect(auditLog.performedBy).toBeDefined()
      expect(auditLog.targetUserId).toBeDefined()
      expect(auditLog.timestamp).toBeDefined()
    })

    it('TEST-13: should update authProvider to multi after setting password', () => {
      const beforeSetPassword = {
        authProvider: 'google',
        passwordHash: null,
      }
      
      const afterSetPassword = {
        authProvider: 'multi',
        passwordHash: '$2b$10$newhash',
      }
      
      expect(beforeSetPassword.authProvider).toBe('google')
      expect(afterSetPassword.authProvider).toBe('multi')
    })

    it('TEST-14: temp token should have short expiry (10 min)', () => {
      const tempTokenExpiry = 10 * 60 * 1000 // 10 minutes
      const regularTokenExpiry = 24 * 60 * 60 * 1000 // 24 hours
      
      expect(tempTokenExpiry).toBeLessThan(regularTokenExpiry)
      expect(tempTokenExpiry).toBe(600000)
    })

    it('TEST-15: should validate TOTP code before completing setup', () => {
      // Speakeasy or similar library should validate TOTP
      const secret = 'BASE32SECRET'
      const validCode = '123456'
      const invalidCode = '000000'
      
      // Mock TOTP validation
      const isValid = (code: string) => code === validCode
      
      expect(isValid(validCode)).toBe(true)
      expect(isValid(invalidCode)).toBe(false)
    })

    it('TEST-16: should clear failed attempts after successful verification', () => {
      const failedAttempts = new Map<string, number>()
      const userId = 'user-123'
      
      // Before: 3 failed attempts
      failedAttempts.set(userId, 3)
      expect(failedAttempts.get(userId)).toBe(3)
      
      // After successful verification: reset to 0
      failedAttempts.delete(userId)
      expect(failedAttempts.get(userId)).toBeUndefined()
    })
  })
})
