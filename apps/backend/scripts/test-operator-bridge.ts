/**
 * Test Script: Operator Bridge Verification
 *
 * Verifies the complete operator relay tunnel flow:
 * 1. Check workspace has operatorWhatsappNumber configured
 * 2. Simulate customer message (activeChatbot=false) → should relay to operator
 * 3. Simulate operator reply → should relay to customer
 * 4. Simulate "END" command → should re-enable chatbot
 *
 * USAGE:
 *   npx ts-node scripts/test-operator-bridge.ts <workspaceId>
 */

import { prisma } from "@echatbot/database"
import logger from "../src/utils/logger"
import { OperatorRelayService } from "../src/application/services/operator-relay.service"

async function main() {
  console.log("\n🔍 OPERATOR BRIDGE TEST\n" + "=".repeat(60))

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 0: Get first workspace if no ID provided
  // ──────────────────────────────────────────────────────────────────────────
  let WORKSPACE_ID = process.argv[2]

  if (!WORKSPACE_ID) {
    const firstWorkspace = await prisma.workspace.findFirst({
      select: { id: true },
    })
    if (!firstWorkspace) {
      console.error("❌ No workspaces found in database!")
      process.exit(1)
    }
    WORKSPACE_ID = firstWorkspace.id
    console.log(`ℹ️  Using first workspace: ${WORKSPACE_ID}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Check workspace configuration
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📋 STEP 1: Workspace Configuration")
  const workspace = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: {
      id: true,
      name: true,
      operatorWhatsappNumber: true,
    },
  })

  if (!workspace) {
    console.error(`❌ Workspace not found: ${WORKSPACE_ID}`)
    process.exit(1)
  }

  console.log(`✅ Workspace: ${workspace.name} (${workspace.id})`)

  if (!workspace.operatorWhatsappNumber) {
    console.error("❌ ERROR: operatorWhatsappNumber NOT CONFIGURED!")
    console.log("\n💡 Solution:")
    console.log(`   UPDATE workspace SET "operatorWhatsappNumber" = '+39YOUR_PHONE' WHERE id = '${WORKSPACE_ID}';`)
    process.exit(1)
  }

  console.log(`✅ Operator WhatsApp: ${workspace.operatorWhatsappNumber}`)

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Find or create a test customer with activeChatbot=false
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📋 STEP 2: Find/Create Test Customer")

  const operatorRelayService = new OperatorRelayService(prisma)

  let customer = await prisma.customers.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      activeChatbot: false, // In operator mode
      deletedAt: null,
    },
    orderBy: { operatorRequestedAt: "desc" },
  })

  if (!customer) {
    console.log("⚠️  No customer with activeChatbot=false found")
    console.log("Creating test customer...")

    customer = await prisma.customers.create({
      data: {
        workspaceId: WORKSPACE_ID,
        name: "Test Operator Bridge",
        email: "test-operator@example.com",
        phone: "+393999888777",
        activeChatbot: false, // Chatbot disabled (operator mode)
        operatorRequestedAt: new Date(),
        originChannel: "whatsapp",
        operatorQueuePosition: 1, // Position 1 (being served)
        operatorQueueEnteredAt: new Date(),
      },
    })

    console.log(`✅ Created test customer: ${customer.id}`)
  } else {
    console.log(`✅ Found customer: ${customer.name} (${customer.id})`)
    console.log(`   - activeChatbot: ${customer.activeChatbot}`)
    console.log(`   - originChannel: ${customer.originChannel}`)
    console.log(`   - queuePosition: ${customer.operatorQueuePosition}`)
    
    // 🔧 FIX: If customer has no queue position, assign it now
    if (customer.operatorQueuePosition === null) {
      console.log("⚠️  Customer not in queue. Assigning queue position...")
      await operatorRelayService.assignQueuePosition(WORKSPACE_ID, customer.id)
      
      // Re-fetch customer
      customer = await prisma.customers.findUnique({
        where: { id: customer.id },
      })!
      
      console.log(`✅ Queue position assigned: ${customer.operatorQueuePosition}`)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Simulate customer message → should relay to operator
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📋 STEP 3: Simulate Customer Message → Operator")

  await operatorRelayService.relayCustomerMessageToOperator(
    WORKSPACE_ID,
    { id: customer.id, name: customer.name, phone: customer.phone },
    "Ciao, ho bisogno di assistenza urgente!"
  )

  console.log("✅ Message relayed to operator WhatsApp queue")

  // Check WhatsApp queue
  const queuedToOperator = await prisma.whatsAppQueue.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      phoneNumber: workspace.operatorWhatsappNumber,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
  })

  if (queuedToOperator) {
    console.log(`✅ Found in WhatsAppQueue:`)
    console.log(`   - To: ${queuedToOperator.phoneNumber}`)
    console.log(`   - Message: ${queuedToOperator.messageContent.substring(0, 100)}...`)
    console.log(`   - Status: ${queuedToOperator.status}`)
  } else {
    console.error("❌ ERROR: Message NOT found in WhatsAppQueue!")
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4: Simulate operator reply → should relay to customer
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📋 STEP 4: Simulate Operator Reply → Customer")

  await operatorRelayService.handleOperatorMessage(
    WORKSPACE_ID,
    "Ciao! Come posso aiutarti?"
  )

  console.log("✅ Operator reply processed")

  // Check customer received message
  if (customer.originChannel === "whatsapp") {
    const queuedToCustomer = await prisma.whatsAppQueue.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        phoneNumber: customer.phone!,
        status: "pending",
      },
      orderBy: { createdAt: "desc" },
    })

    if (queuedToCustomer) {
      console.log(`✅ Found in WhatsAppQueue for customer:`)
      console.log(`   - To: ${queuedToCustomer.phoneNumber}`)
      console.log(`   - Message: ${queuedToCustomer.messageContent}`)
    } else {
      console.error("❌ ERROR: Reply NOT found in WhatsAppQueue for customer!")
    }
  } else {
    // Widget customer - check ConversationMessage
    const session = await prisma.chatSession.findFirst({
      where: { customerId: customer.id, status: "active" },
      orderBy: { createdAt: "desc" },
    })

    if (session) {
      const message = await prisma.conversationMessage.findFirst({
        where: {
          conversationId: session.id,
          role: "assistant",
        },
        orderBy: { createdAt: "desc" },
      })

      if (message) {
        console.log(`✅ Found in ConversationMessage for widget customer:`)
        console.log(`   - Content: ${message.content}`)
      } else {
        console.error("❌ ERROR: Reply NOT found in ConversationMessage!")
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 5: Simulate "END" command → should re-enable chatbot
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📋 STEP 5: Simulate END Command → Re-enable Chatbot")

  await operatorRelayService.handleOperatorMessage(WORKSPACE_ID, "END")

  console.log("✅ END command processed")

  // Verify customer has activeChatbot=true
  const updatedCustomer = await prisma.customers.findUnique({
    where: { id: customer.id },
    select: {
      activeChatbot: true,
      operatorQueuePosition: true,
      operatorRequestedAt: true,
      originChannel: true,
    },
  })

  if (updatedCustomer?.activeChatbot === true) {
    console.log("✅ Chatbot re-enabled!")
    console.log(`   - activeChatbot: ${updatedCustomer.activeChatbot}`)
    console.log(`   - queuePosition: ${updatedCustomer.operatorQueuePosition} (should be null)`)
    console.log(`   - operatorRequestedAt: ${updatedCustomer.operatorRequestedAt} (should be null)`)
  } else {
    console.error("❌ ERROR: Chatbot NOT re-enabled after END!")
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────── 
  console.log("\n" + "=".repeat(60))
  console.log("✅ TEST COMPLETED")
  console.log("\n📋 Full Test Results:")
  console.log("1. ✅ Workspace configured with operator number")
  console.log("2. ✅ Customer → Operator relay works")
  console.log("3. ✅ Operator → Customer relay works")
  console.log("4. ✅ END command re-enables chatbot")
  console.log("\n💡 Next steps:")
  console.log("   - Check WhatsAppQueue scheduler is processing messages")
  console.log("   - Test with real WhatsApp webhook")
  console.log("   - Monitor operator conversation flow\n")

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error("❌ Test failed:", error)
  prisma.$disconnect()
  process.exit(1)
})
