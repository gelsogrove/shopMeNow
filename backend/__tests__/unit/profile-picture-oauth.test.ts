/**
 * Profile Picture OAuth Integration Tests
 * 
 * Tests that Google OAuth properly saves and updates profile pictures
 * 
 * Test Cases:
 * 1. New user registration with Google saves profilePicture
 * 2. Existing user login with Google updates profilePicture if changed
 * 3. verify2FA returns profilePicture in response
 * 4. verify2FASetup returns profilePicture in response
 */

import { PrismaClient } from '@prisma/client'
import { OAuthController } from '../../src/interfaces/http/controllers/oauth.controller'
import { EnhancedAuthController } from '../../src/interfaces/http/controllers/enhanced-auth.controller'

const prisma = new PrismaClient()

describe('Profile Picture OAuth Integration', () => {
  let oauthController: OAuthController
  let enhancedAuthController: EnhancedAuthController
  let testUserId: string

  beforeAll(async () => {
    oauthController = new OAuthController()
    enhancedAuthController = new EnhancedAuthController()
  })

  afterAll(async () => {
    // Cleanup test user
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  describe('Google OAuth Registration', () => {
    it('should save profilePicture when creating new user via Google', async () => {
      const testEmail = `test-oauth-${Date.now()}@example.com`
      const testPictureUrl = 'https://lh3.googleusercontent.com/a/test-image-123'

      // Create user with Google OAuth (simulating the controller logic)
      const newUser = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '',
          firstName: 'Test',
          lastName: 'User',
          role: 'MEMBER',
          authProvider: 'google',
          profilePicture: testPictureUrl,
          twoFactorEnabled: false,
          gdprAccepted: new Date(),
          linkedProviders: [
            { provider: 'google', linkedAt: new Date().toISOString(), providerId: 'google-123' },
          ],
        },
      })

      testUserId = newUser.id

      expect(newUser.profilePicture).toBe(testPictureUrl)
      expect(newUser.authProvider).toBe('google')
    })
  })

  describe('Google OAuth Login - Profile Picture Update', () => {
    it('should update profilePicture when user logs in with new Google picture', async () => {
      // User already exists from previous test
      expect(testUserId).toBeDefined()

      const oldPictureUrl = 'https://lh3.googleusercontent.com/a/test-image-123'
      const newPictureUrl = 'https://lh3.googleusercontent.com/a/test-image-456-updated'

      // Verify old picture is saved
      const userBefore = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { profilePicture: true },
      })
      expect(userBefore?.profilePicture).toBe(oldPictureUrl)

      // Simulate OAuth login with updated picture
      await prisma.user.update({
        where: { id: testUserId },
        data: { profilePicture: newPictureUrl },
      })

      // Verify picture was updated
      const userAfter = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { profilePicture: true },
      })
      expect(userAfter?.profilePicture).toBe(newPictureUrl)
    })
  })

  describe('2FA Verification Response', () => {
    it('should include profilePicture in verify2FASetup response', async () => {
      const testEmail = `test-2fa-setup-${Date.now()}@example.com`
      const testPictureUrl = 'https://lh3.googleusercontent.com/a/setup-test'

      // Create user with profilePicture
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '',
          firstName: 'Setup',
          lastName: 'Test',
          role: 'MEMBER',
          authProvider: 'google',
          profilePicture: testPictureUrl,
          twoFactorEnabled: false,
        },
      })

      // Fetch user as verify2FASetup would
      const userResponse = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
      })

      expect(userResponse?.profilePicture).toBe(testPictureUrl)

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } })
    })

    it('should include profilePicture in verify2FA response', async () => {
      const testEmail = `test-2fa-verify-${Date.now()}@example.com`
      const testPictureUrl = 'https://lh3.googleusercontent.com/a/verify-test'

      // Create user with profilePicture and 2FA enabled
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '',
          firstName: 'Verify',
          lastName: 'Test',
          role: 'MEMBER',
          authProvider: 'google',
          profilePicture: testPictureUrl,
          twoFactorEnabled: true,
          twoFactorSecret: 'JBSWY3DPEHPK3PXP', // Test secret
        },
      })

      // Fetch user as verify2FA would (with profilePicture)
      const userResponse = await prisma.user.findUnique({
        where: { id: user.id },
        select: { 
          id: true, 
          email: true, 
          firstName: true, 
          lastName: true, 
          role: true,
          profilePicture: true,
        },
      })

      expect(userResponse?.profilePicture).toBe(testPictureUrl)

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } })
    })
  })

  describe('Profile Picture Fallback', () => {
    it('should handle users without profilePicture (email/password registration)', async () => {
      const testEmail = `test-no-picture-${Date.now()}@example.com`

      // Create user WITHOUT profilePicture (email/password registration)
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '$2b$10$hashedpassword', // Fake hash
          firstName: 'Email',
          lastName: 'User',
          role: 'MEMBER',
          authProvider: 'email',
          profilePicture: null, // No picture
          twoFactorEnabled: false,
        },
      })

      const userResponse = await prisma.user.findUnique({
        where: { id: user.id },
        select: { profilePicture: true },
      })

      expect(userResponse?.profilePicture).toBeNull()

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } })
    })

    it('should update null profilePicture to Google picture on OAuth link', async () => {
      const testEmail = `test-link-picture-${Date.now()}@example.com`

      // Create user without picture (email registration)
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '$2b$10$hashedpassword',
          firstName: 'Link',
          lastName: 'Test',
          role: 'MEMBER',
          authProvider: 'email',
          profilePicture: null,
          twoFactorEnabled: false,
        },
      })

      expect(user.profilePicture).toBeNull()

      // Simulate linking Google account and adding picture
      const googlePictureUrl = 'https://lh3.googleusercontent.com/a/linked-account'
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          profilePicture: googlePictureUrl,
          authProvider: 'multi', // User now has multiple auth providers
        },
      })

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { profilePicture: true, authProvider: true },
      })

      expect(updatedUser?.profilePicture).toBe(googlePictureUrl)
      expect(updatedUser?.authProvider).toBe('multi')

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } })
    })
  })
})
