/**
 * TEST LOGIN WITH 2FA - Complete Flow
 * 
 * Tests the ENTIRE login process with 2FA:
 * 1. Login with email/password (existing user with 2FA enabled)
 * 2. Verify 2FA code
 * 3. Check sessionId is created
 * 4. Validate session
 * 5. Fetch workspaces
 * 
 * CRITICAL: SessionId MUST be created after 2FA verification
 */

import axios from 'axios'
import speakeasy from 'speakeasy'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_BASE = 'http://localhost:3001/api'

async function testLoginWith2FA() {
  console.log('🚀 Starting Login + 2FA Flow Test')
  console.log('=' .repeat(60))

  let testUserId: string | null = null

  try {
    // Create a test user with 2FA enabled
    const testEmail = `test-login-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'
    
    console.log('📝 Creating test user with 2FA...')
    
    // Generate 2FA secret
    const secret = speakeasy.generateSecret({
      name: `ShopME:${testEmail}`,
      issuer: 'ShopME',
    })
    
    const hashedPassword = await import('bcryptjs').then(bcrypt => 
      bcrypt.hash(testPassword, 10)
    )
    
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'MEMBER',
        gdprAccepted: new Date(),
        twoFactorEnabled: true,
        twoFactorSecret: secret.base32,
        twoFactorEnabledAt: new Date(),
        recoveryCodes: [], // Empty for test
      },
    })
    
    testUserId = user.id

    console.log(`✅ Test user created: ${user.email}`)
    console.log(`✅ User ID: ${user.id}`)
    console.log(`✅ 2FA secret: ${secret.base32.substring(0, 10)}...`)

    // STEP 1: Login with email/password
    console.log('\n📝 STEP 1: POST /auth/login')
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: testEmail,
      password: testPassword,
    })

    console.log(`   ✅ Status: ${loginResponse.status}`)
    console.log(`   📋 Response keys:`, Object.keys(loginResponse.data))
    
    if (loginResponse.data.sessionId) {
      console.log(`   ✅ SessionId (from login): ${loginResponse.data.sessionId.substring(0, 8)}...`)
    } else {
      console.log(`   ⚠️  NO sessionId in login response (expected if 2FA required)`)
    }

    if (loginResponse.data.token) {
      console.log(`   ✅ Token: ${loginResponse.data.token.substring(0, 20)}...`)
    }

    const userId = loginResponse.data.user?.id || user.id

    // STEP 2: Generate TOTP code
    console.log('\n🔐 STEP 2: Generate TOTP from user\'s secret')
    const totpCode = speakeasy.totp({
      secret: secret.base32!,
      encoding: 'base32',
    })
    console.log(`   ✅ TOTP generated: ${totpCode}`)
    console.log(`   ⏰ Current time: ${new Date().toISOString()}`)

    // STEP 3: Verify 2FA code
    console.log('\n✅ STEP 3: POST /auth/2fa/verify')
    console.log(`   📋 Request body: userId=${userId}, code=${totpCode}`)
    
    const verify2FAResponse = await axios.post(`${API_BASE}/auth/2fa/verify`, {
      userId: userId,
      code: totpCode,
    })

    console.log(`   ✅ Status: ${verify2FAResponse.status}`)
    console.log(`   📋 Response keys:`, Object.keys(verify2FAResponse.data))

    const { sessionId, token, user: verifiedUser } = verify2FAResponse.data

    if (!sessionId) {
      console.error('\n❌ CRITICAL ERROR: No sessionId in verify2FA response!')
      console.error('   Response:', JSON.stringify(verify2FAResponse.data, null, 2))
      throw new Error('No sessionId in verify2FA response')
    }

    console.log(`   ✅ SessionId: ${sessionId.substring(0, 8)}...`)
    console.log(`   ✅ Token: ${token.substring(0, 20)}...`)
    console.log(`   ✅ User: ${verifiedUser.email}`)

    // STEP 4: Validate session
    console.log('\n🔍 STEP 4: GET /session/validate')
    const validateResponse = await axios.get(`${API_BASE}/session/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Session-Id': sessionId,
      },
    })

    console.log(`   ✅ Status: ${validateResponse.status}`)
    console.log(`   ✅ Valid: ${validateResponse.data.valid}`)
    console.log(`   ✅ UserId: ${validateResponse.data.session?.userId}`)

    // STEP 5: Fetch workspaces
    console.log('\n🏢 STEP 5: GET /workspaces')
    const workspacesResponse = await axios.get(`${API_BASE}/workspaces`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Session-Id': sessionId,
      },
    })

    console.log(`   ✅ Status: ${workspacesResponse.status}`)
    console.log(`   ✅ Workspaces: ${workspacesResponse.data.length}`)
    
    if (workspacesResponse.data.length > 0) {
      console.log(`   ✅ First workspace: ${workspacesResponse.data[0].name} (${workspacesResponse.data[0].id})`)
    }

    // SUCCESS
    console.log('\n' + '='.repeat(60))
    console.log('🎉 ALL TESTS PASSED!')
    console.log('='.repeat(60))
    console.log(`\n📧 Test user: ${testEmail}`)
    console.log(`🆔 User ID: ${userId}`)
    console.log(`🔑 SessionId: ${sessionId.substring(0, 8)}...`)
    console.log(`\n✅ Full login + 2FA + session validation + workspaces flow works!`)
    
    console.log('\n🔒 SECURITY CHECKS:')
    console.log(`   ✅ SessionId created after 2FA verification`)
    console.log(`   ✅ Session validates successfully`)
    console.log(`   ✅ Workspaces API works with sessionId`)

    // Cleanup test user
    if (testUserId) {
      console.log('\n🧹 Cleaning up test user...')
      await prisma.adminSession.deleteMany({ where: { userId: testUserId } })
      await prisma.user.delete({ where: { id: testUserId } })
      console.log('✅ Test user cleaned up')
    }

  } catch (error: any) {
    console.error('\n❌ TEST FAILED')
    console.error('='.repeat(60))
    
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Data:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('Error:', error.message)
    }
    
    // Cleanup on error
    if (testUserId) {
      try {
        await prisma.adminSession.deleteMany({ where: { userId: testUserId } })
        await prisma.user.delete({ where: { id: testUserId } })
      } catch {}
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testLoginWith2FA()
