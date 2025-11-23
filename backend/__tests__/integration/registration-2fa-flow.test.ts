/**
 * UNIT TEST: Registration + 2FA Setup Flow
 * 
 * Tests complete flow:
 * 1. POST /auth/register → Returns user, qrCode, sessionId, token
 * 2. POST /auth/verify-2fa-setup → Returns recoveryCodes, sessionId, token, user
 * 3. GET /workspaces → Uses sessionId from step 2, should return 200
 * 
 * CRITICAL: This is a BASIC flow that MUST work ("un'operazione normale che si fa in tutti i siti")
 */

import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import app from '../../src/app'
import speakeasy from 'speakeasy'

const prisma = new PrismaClient()

describe('Registration + 2FA Setup Flow', () => {
  let testEmail: string
  let testPassword: string
  let registrationResponse: any
  let verifyResponse: any
  let sessionId: string
  let token: string
  let userId: string

  beforeAll(async () => {
    // Generate unique test email
    testEmail = `test-${Date.now()}@example.com`
    testPassword = 'TestPassword123!'
  })

  afterAll(async () => {
    // Cleanup: Delete test user
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  it('STEP 1: POST /auth/register should return user, qrCode (NO sessionId/token)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Test',
        lastName: 'User',
        gdprAccepted: true,
      })

    console.log('📋 Registration response status:', response.status)
    console.log('📋 Registration response body:', JSON.stringify(response.body, null, 2))

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('user')
    expect(response.body).toHaveProperty('qrCode')
    
    // 🔒 SECURITY: Registration should NOT return sessionId or token
    expect(response.body).not.toHaveProperty('sessionId')
    expect(response.body).not.toHaveProperty('token')

    // Save for next steps
    registrationResponse = response.body
    userId = response.body.user.id

    console.log('✅ STEP 1: Registration successful (NO session/token - SECURE!)')
    console.log(`   - User ID: ${userId}`)
    console.log(`   - QR Code: ${response.body.qrCode.substring(0, 50)}...`)
  })

  it('STEP 2: POST /auth/verify-2fa-setup should return recoveryCodes, sessionId, token, user', async () => {
    // Extract secret from qrCode (otpauth://totp/ShopME:email?secret=XXXXX&issuer=ShopME)
    const qrCode = registrationResponse.qrCode
    const secretMatch = qrCode.match(/secret=([A-Z0-9]+)/)
    expect(secretMatch).toBeTruthy()
    
    const secret = secretMatch![1]
    console.log(`   - Extracted secret: ${secret}`)

    // Generate valid TOTP code
    const totpCode = speakeasy.totp({
      secret: secret,
      encoding: 'base32',
    })
    console.log(`   - Generated TOTP: ${totpCode}`)

    // Verify 2FA setup with the code (NO Authorization header - user not authenticated yet!)
    const response = await request(app)
      .post('/api/auth/verify-2fa-setup')
      .send({
        userId: userId,
        code: totpCode,
      })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('recoveryCodes')
    expect(response.body).toHaveProperty('sessionId')
    expect(response.body).toHaveProperty('token')
    expect(response.body).toHaveProperty('user')
    expect(response.body.recoveryCodes).toHaveLength(10)

    // Save for next step
    verifyResponse = response.body
    sessionId = response.body.sessionId
    token = response.body.token

    console.log('✅ STEP 2: 2FA verification successful (NOW authenticated!)')
    console.log(`   - SessionId: ${sessionId.substring(0, 8)}...`)
    console.log(`   - Token: ${token.substring(0, 20)}...`)
    console.log(`   - Recovery codes: ${response.body.recoveryCodes.length} codes`)
  })

  it('STEP 3: GET /workspaces should return 200 with sessionId from step 2', async () => {
    // This simulates what WorkspaceSelectionPage does
    const response = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Session-Id', sessionId)

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)

    console.log('✅ STEP 3: Workspace fetch successful')
    console.log(`   - Status: ${response.status}`)
    console.log(`   - Workspaces: ${response.body.length}`)
  })

  it('STEP 4: GET /session/validate should return 200 with valid session', async () => {
    const response = await request(app)
      .get('/api/session/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Session-Id', sessionId)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('valid', true)

    console.log('✅ STEP 4: Session validation successful')
  })
})
