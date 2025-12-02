/**
 * Manual Test Script for Push Notification Endpoint
 *
 * This script tests the /workspaces/:workspaceId/push/chatbot-reactivated endpoint
 *
 * Usage:
 * 1. Start backend: npm run start:dev
 * 2. Run this script: ts-node scripts/test-push-notification.ts
 */

import axios from "axios"

const BASE_URL = "http://localhost:3001/api"
const WORKSPACE_ID = "cm9hjgq9v00014qk8fsdy4ujv" // Bell'Italia workspace
const ADMIN_EMAIL = "admin@echatbot.ai"
const ADMIN_PASSWORD = "Venezia44"

async function testPushNotification() {
  try {
    console.log("🧪 Testing Push Notification Endpoint\n")

    // Step 1: Login as admin
    console.log("1️⃣  Logging in as admin...")
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })

    const token = loginResponse.data.token || loginResponse.data.accessToken
    const sessionId =
      loginResponse.data.sessionId || loginResponse.data.session?.id

    if (!token) {
      throw new Error("No token in login response")
    }

    console.log("✅ Login successful")
    console.log(`   Token: ${token.substring(0, 20)}...`)
    console.log(`   Session: ${sessionId || "N/A"}\n`)

    // Step 2: Get a test customer
    console.log("2️⃣  Fetching test customer...")
    const customersResponse = await axios.get(
      `${BASE_URL}/workspaces/${WORKSPACE_ID}/customers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-session-id": sessionId,
          "x-workspace-id": WORKSPACE_ID,
        },
      }
    )

    const customers = customersResponse.data
    if (!customers || customers.length === 0) {
      throw new Error("No customers found in workspace")
    }

    const testCustomer = customers[0]
    console.log("✅ Test customer found:")
    console.log(`   ID: ${testCustomer.id}`)
    console.log(`   Name: ${testCustomer.name}`)
    console.log(`   Phone: ${testCustomer.phone}`)
    console.log(`   Language: ${testCustomer.language}\n`)

    // Step 3: Send push notification
    console.log("3️⃣  Sending chatbot reactivation notification...")
    const pushResponse = await axios.post(
      `${BASE_URL}/workspaces/${WORKSPACE_ID}/push/chatbot-reactivated`,
      {
        workspaceId: WORKSPACE_ID,
        customerIds: [testCustomer.id],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-session-id": sessionId,
          "x-workspace-id": WORKSPACE_ID,
        },
      }
    )

    console.log("✅ Push notification sent!")
    console.log("   Response:", JSON.stringify(pushResponse.data, null, 2))
    console.log("\n🎉 Test completed successfully!\n")
  } catch (error: any) {
    console.error("\n❌ Test failed!")
    if (error.response) {
      console.error("   Status:", error.response.status)
      console.error("   Data:", JSON.stringify(error.response.data, null, 2))
    } else {
      console.error("   Error:", error.message)
    }
    console.error("\n")
    process.exit(1)
  }
}

testPushNotification()
