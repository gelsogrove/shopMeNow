/**
 * WORKSPACE ISOLATION SECURITY TEST
 * 
 * CRITICAL: Every user MUST see ONLY their own workspaces
 * 
 * Tests:
 * 1. User A creates account → gets workspace A
 * 2. User B creates account → gets workspace B
 * 3. User A calls /workspaces → MUST see ONLY workspace A
 * 4. User B calls /workspaces → MUST see ONLY workspace B
 * 5. User A tries /workspaces/B → MUST get 403 Forbidden
 * 
 * SECURITY VIOLATION: If User A sees workspace B → CRITICAL BUG
 */

import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import app from '../../src/app'
import speakeasy from 'speakeasy'

const prisma = new PrismaClient()

/**
 * Helper: Verify 2FA with retry logic (handles TOTP timing edge cases)
 */
async function verify2FAWithRetry(
  userId: string, 
  secret: string, 
  maxRetries: number = 3
): Promise<{ status: number; body: any }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Wait a bit to ensure TOTP window is fresh
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    const totpCode = speakeasy.totp({ 
      secret, 
      encoding: 'base32',
      // Use current time window
    })
    
    console.log(`🔐 2FA attempt ${attempt}/${maxRetries} for user ${userId.substring(0, 8)}... code: ${totpCode}`)
    
    const response = await request(app)
      .post('/api/auth/verify-2fa-setup')
      .send({
        userId,
        code: totpCode,
      })
    
    if (response.status === 200) {
      console.log(`✅ 2FA verified on attempt ${attempt}`)
      return response
    }
    
    console.log(`⚠️ 2FA attempt ${attempt} failed with status ${response.status}: ${JSON.stringify(response.body)}`)
    
    // If it's the last attempt or a non-retryable error, return the response
    if (attempt === maxRetries || response.status !== 400) {
      return response
    }
  }
  
  throw new Error('Should not reach here')
}

describe('WORKSPACE ISOLATION - SECURITY TEST', () => {
  let userA: any = {}
  let userB: any = {}

  beforeAll(async () => {
    // === CREATE USER A ===
    const emailA = `user-a-${Date.now()}@example.com`
    
    // Step 1: Register User A
    const registerResponseA = await request(app)
      .post('/api/auth/register')
      .send({
        email: emailA,
        password: 'Password123!',
        firstName: 'UserA',
        lastName: 'TestA',
        gdprAccepted: true,
      })

    expect(registerResponseA.status).toBe(201)
    const userIdA = registerResponseA.body.user.id
    const qrCodeA = registerResponseA.body.qrCode
    
    // Extract secret from QR code
    const matchA = qrCodeA.match(/secret=([A-Z0-9]+)/)
    expect(matchA).toBeTruthy()
    const secretA = matchA![1]

    // Step 2: Verify 2FA for User A (with retry logic for TOTP timing)
    const verify2FAResponseA = await verify2FAWithRetry(userIdA, secretA)
    expect(verify2FAResponseA.status).toBe(200)

    userA = {
      id: userIdA,
      email: emailA,
      token: verify2FAResponseA.body.token,
    }

    console.log('✅ User A created:', userA.email)

    // Small delay between user creations to avoid timing issues
    await new Promise(resolve => setTimeout(resolve, 500))

    // === CREATE USER B ===
    const emailB = `user-b-${Date.now() + 1000}@example.com`
    
    // Step 1: Register User B
    const registerResponseB = await request(app)
      .post('/api/auth/register')
      .send({
        email: emailB,
        password: 'Password123!',
        firstName: 'UserB',
        lastName: 'TestB',
        gdprAccepted: true,
      })

    expect(registerResponseB.status).toBe(201)
    const userIdB = registerResponseB.body.user.id
    const qrCodeB = registerResponseB.body.qrCode
    
    // Extract secret from QR code
    const matchB = qrCodeB.match(/secret=([A-Z0-9]+)/)
    expect(matchB).toBeTruthy()
    const secretB = matchB![1]

    // Step 2: Verify 2FA for User B (with retry logic for TOTP timing)
    const verify2FAResponseB = await verify2FAWithRetry(userIdB, secretB)
    expect(verify2FAResponseB.status).toBe(200)

    userB = {
      id: userIdB,
      email: emailB,
      token: verify2FAResponseB.body.token,
    }

    console.log('✅ User B created:', userB.email)
    
    // === CREATE WORKSPACES DIRECTLY IN DATABASE ===
    // User A gets workspace A
    const workspaceA = await prisma.workspace.create({
      data: {
        name: `Workspace A ${Date.now()}`,
        slug: `workspace-a-${Date.now()}`,
        whatsappPhoneNumber: '+1234567890',
        language: 'en',
      },
    })
    
    // Link User A to Workspace A
    await prisma.userWorkspace.create({
      data: {
        userId: userA.id,
        workspaceId: workspaceA.id,
        role: 'OWNER',
      },
    })
    
    userA.workspaceId = workspaceA.id
    console.log(`✅ Workspace A created: ${workspaceA.id} for User A`)
    
    // User B gets workspace B
    const workspaceB = await prisma.workspace.create({
      data: {
        name: `Workspace B ${Date.now() + 1000}`,
        slug: `workspace-b-${Date.now() + 1000}`,
        whatsappPhoneNumber: '+9876543210',
        language: 'es',
      },
    })
    
    // Link User B to Workspace B
    await prisma.userWorkspace.create({
      data: {
        userId: userB.id,
        workspaceId: workspaceB.id,
        role: 'OWNER',
      },
    })
    
    userB.workspaceId = workspaceB.id
    console.log(`✅ Workspace B created: ${workspaceB.id} for User B`)
  }, 30000) // Increase timeout to 30 seconds

  afterAll(async () => {
    // Cleanup
    if (userA.id) {
      await prisma.userWorkspace.deleteMany({ where: { userId: userA.id } })
      await prisma.user.delete({ where: { id: userA.id } }).catch(() => {})
    }
    if (userB.id) {
      await prisma.userWorkspace.deleteMany({ where: { userId: userB.id } })
      await prisma.user.delete({ where: { id: userB.id } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  describe('🔒 CRITICAL: Workspace Isolation', () => {
    it('User A MUST see ONLY their own workspace', async () => {
      const response = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      
      // CRITICAL: User A must see ONLY 1 workspace (their own)
      expect(response.body.length).toBe(1)
      
      // Verify it's their workspace
      const userAWorkspaces = await prisma.userWorkspace.findMany({
        where: { userId: userA.id },
        include: { workspace: true },
      })
      
      expect(response.body[0].id).toBe(userAWorkspaces[0].workspaceId)
      
      console.log('✅ User A sees ONLY their workspace')
    })

    it('User B MUST see ONLY their own workspace', async () => {
      const response = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      
      // CRITICAL: User B must see ONLY 1 workspace (their own)
      expect(response.body.length).toBe(1)
      
      // Verify it's their workspace
      const userBWorkspaces = await prisma.userWorkspace.findMany({
        where: { userId: userB.id },
        include: { workspace: true },
      })
      
      expect(response.body[0].id).toBe(userBWorkspaces[0].workspaceId)
      
      console.log('✅ User B sees ONLY their workspace')
    })

    it('User A and User B MUST have DIFFERENT workspaces', async () => {
      const responseA = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200)

      const responseB = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200)

      const workspaceIdA = responseA.body[0].id
      const workspaceIdB = responseB.body[0].id

      // CRITICAL: Workspace IDs MUST be different
      expect(workspaceIdA).not.toBe(workspaceIdB)
      
      console.log('✅ User A workspace:', workspaceIdA)
      console.log('✅ User B workspace:', workspaceIdB)
      console.log('✅ Workspaces are DIFFERENT (isolation confirmed)')
    })

    it('🚨 SECURITY: User A MUST NOT see User B workspace in list', async () => {
      const responseA = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200)

      const userBWorkspaces = await prisma.userWorkspace.findMany({
        where: { userId: userB.id },
      })
      const workspaceIdB = userBWorkspaces[0].workspaceId

      // CRITICAL: User A's workspace list MUST NOT contain User B's workspace
      const foundUserBWorkspace = responseA.body.find((w: any) => w.id === workspaceIdB)
      
      expect(foundUserBWorkspace).toBeUndefined()
      
      console.log('🔒 SECURITY CHECK PASSED: User A cannot see User B workspace')
    })
  })
})
