#!/usr/bin/env node

/**
 * Multi-turn conversation test for Product Search flow
 * Tests: grouping → selection → cart delegation
 */

const axios = require("axios")

const BASE_URL = "http://localhost:3001"
const WORKSPACE_ID = "cm9hjgq9v00014qk8fsdy4ujv"
const CUSTOMER_PHONE = "+393331234567"
const CUSTOMER_NAME = "Mario Rossi"

// Generate unique session ID for this test
const SESSION_ID = `test-${Date.now()}`

async function sendMessage(message, stepName) {
  console.log(`\n${"=".repeat(80)}`)
  console.log(`📤 STEP: ${stepName}`)
  console.log(`📤 USER > ${message}`)
  console.log(`${"=".repeat(80)}`)

  try {
    const response = await axios.post(`${BASE_URL}/api/whatsapp/webhook`, {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "mock-entry-id",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "123456789",
                  phone_number_id: "mock-phone-id",
                },
                contacts: [
                  {
                    profile: {
                      name: CUSTOMER_NAME,
                    },
                    wa_id: CUSTOMER_PHONE,
                  },
                ],
                messages: [
                  {
                    from: CUSTOMER_PHONE,
                    id: `msg-${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: {
                      body: message,
                    },
                    type: "text",
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
      // Force same session for multi-turn
      _testSessionId: SESSION_ID,
    })

    // Extract bot response from logs (webhook returns 200 immediately)
    console.log(`✅ Webhook accepted (status: ${response.status})`)

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 3000))
  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message)
    throw error
  }
}

async function runTest() {
  console.log(`\n🚀 Starting multi-turn conversation test`)
  console.log(`Session ID: ${SESSION_ID}`)
  console.log(`Customer: ${CUSTOMER_NAME} (${CUSTOMER_PHONE})`)
  console.log(`Workspace: ${WORKSPACE_ID}\n`)

  try {
    // Step 1: Initial search with grouping
    await sendMessage(
      "mostrami tutti i formaggi",
      "1. Initial Search (expect grouping)"
    )

    // Step 2: Select group/product
    await sendMessage("2", "2. Select item #2")

    // Step 3: Confirm cart addition
    await sendMessage("si voglio aggiungerlo al carrello", "3. Add to cart")

    console.log(`\n${"=".repeat(80)}`)
    console.log(`✅ Test completed! Check backend logs for responses.`)
    console.log(`${"=".repeat(80)}\n`)
  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message)
    process.exit(1)
  }
}

// Run test
runTest()
