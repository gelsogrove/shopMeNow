/**
 * MANUAL TEST SCRIPT: Registration + 2FA Setup Flow
 * 
 * Run with: npx ts-node scripts/test-registration-flow.ts
 * 
 * Tests complete flow:
 * 1. POST /auth/register → Returns user, qrCode, sessionId, token
 * 2. POST /auth/verify-2fa-setup → Returns recoveryCodes, sessionId, token, user
 * 3. GET /workspaces → Uses sessionId from step 2, should return 200
 */

import axios from 'axios'
import speakeasy from 'speakeasy'

const API_BASE = 'http://localhost:3001/api'

async function testRegistrationFlow() {
  try {
    // Generate unique email
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'

    console.log('\n🚀 Starting Registration + 2FA Flow Test')
    console.log('=' .repeat(60))

    // STEP 1: Register
    console.log('\n📝 STEP 1: POST /auth/register')
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
      gdprAccepted: true,
    })

    console.log(`   ✅ Status: ${registerResponse.status}`)
    console.log(`   ✅ User ID: ${registerResponse.data.user.id}`)
    console.log(`   ✅ QR Code: ${registerResponse.data.qrCode?.substring(0, 50)}...`)
    console.log(`   🔒 NO sessionId or token (must verify 2FA first)`)

    const { user, qrCode } = registerResponse.data

    if (!user || !qrCode) {
      throw new Error('❌ Registration response missing required fields')
    }

    // Verify NO session or token returned (security requirement)
    if (registerResponse.data.sessionId || registerResponse.data.token) {
      throw new Error('❌ SECURITY VIOLATION: Registration should NOT return sessionId or token before 2FA verification!')
    }

    // STEP 2: Extract secret and generate TOTP
    console.log('\n🔐 STEP 2: Generate TOTP from QR Code')
    const secretMatch = qrCode.match(/secret=([A-Z0-9]+)/)
    if (!secretMatch) {
      throw new Error('❌ Could not extract secret from QR code')
    }

    const secret = secretMatch[1]
    console.log(`   ✅ Secret extracted: ${secret}`)

    // Wait a moment to ensure TOTP is fresh
    await new Promise(resolve => setTimeout(resolve, 100))

    const totpCode = speakeasy.totp({
      secret: secret,
      encoding: 'base32',
    })
    console.log(`   ✅ TOTP generated: ${totpCode}`)
    console.log(`   ⏰ Current time: ${new Date().toISOString()}`)

    // STEP 3: Verify 2FA Setup
    console.log('\n✅ STEP 3: POST /auth/verify-2fa-setup')
    console.log(`   📋 Request body: userId=${user.id}, code=${totpCode}`)
    console.log(`   🔒 NO Authorization header (not authenticated yet)`)
    
    const verifyResponse = await axios.post(
      `${API_BASE}/auth/verify-2fa-setup`,
      {
        userId: user.id,
        code: totpCode,
      }
    )

    console.log(`   ✅ Status: ${verifyResponse.status}`)
    console.log(`   ✅ Recovery Codes: ${verifyResponse.data.recoveryCodes?.length} codes`)
    console.log(`   ✅ SessionId: ${verifyResponse.data.sessionId?.substring(0, 8)}...`)
    console.log(`   ✅ Token: ${verifyResponse.data.token?.substring(0, 20)}...`)
    console.log(`   ✅ User: ${verifyResponse.data.user?.email}`)

    const { sessionId, token, user: verifiedUser } = verifyResponse.data

    if (!sessionId || !token || !verifiedUser) {
      throw new Error('❌ verify-2fa-setup response missing sessionId, token, or user')
    }

    // STEP 4: Verify workspace was created
    console.log('\n🏢 STEP 4: Verify workspace creation')
    const workspacesResponse = await axios.get(`${API_BASE}/workspaces`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Session-Id': sessionId,
      },
    })

    console.log(`   ✅ Status: ${workspacesResponse.status}`)
    console.log(`   ✅ Workspaces: ${workspacesResponse.data.length}`)

    if (workspacesResponse.data.length === 0) {
      throw new Error('❌ No workspace found for new user - workspace creation failed!')
    }

    const workspace = workspacesResponse.data[0]
    console.log(`   ✅ Workspace ID: ${workspace.id}`)
    console.log(`   ✅ Workspace Name: ${workspace.name}`)
    console.log(`   ✅ Workspace Slug: ${workspace.slug}`)

    // STEP 5: Validate Session
    console.log('\n🔍 STEP 5: GET /session/validate')
    const validateResponse = await axios.get(`${API_BASE}/session/validate`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Session-Id': sessionId,
      },
    })

    console.log(`   ✅ Status: ${validateResponse.status}`)
    console.log(`   ✅ Valid: ${validateResponse.data.valid}`)

    console.log('\n' + '='.repeat(60))
    console.log('🎉 ALL TESTS PASSED!')
    console.log('=' .repeat(60))
    console.log(`\n📧 Test user email: ${testEmail}`)
    console.log(`🆔 Test user ID: ${user.id}`)
    console.log(`🏢 Workspace ID: ${workspace.id}`)
    console.log(`🏢 Workspace Name: ${workspace.name}`)
    console.log('\n✅ Full registration + 2FA + workspace creation + session validation flow works!')
    console.log('\n🔒 SECURITY CHECKS PASSED:')
    console.log('   ✅ No sessionId/token before 2FA verification')
    console.log('   ✅ SessionId created only after 2FA verification')
    console.log('   ✅ Workspace created automatically for new user')
    console.log('   ✅ Session validates successfully')

  } catch (error: any) {
    console.error('\n❌ TEST FAILED')
    console.error('=' .repeat(60))
    if (error.response) {
      console.error(`Status: ${error.response.status}`)
      console.error(`Data:`, JSON.stringify(error.response.data, null, 2))
    } else if (error.message) {
      console.error(`Error message: ${error.message}`)
      console.error(`Error stack:`, error.stack)
    } else {
      console.error('Unknown error:', error)
    }
    process.exit(1)
  }
}

testRegistrationFlow()
