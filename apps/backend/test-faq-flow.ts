/**
 * Test FAQ Flow
 * 
 * Quick test script to verify FAQ system works with new architecture:
 * 1. Find workspace with sellsProductsAndServices=false
 * 2. Find customer
 * 3. Call ChatEngine with FAQ question
 * 4. Verify response contains FAQ answer (not "I didn't understand")
 */

import { prisma } from "@echatbot/database"
import { ChatEngineService } from "./src/application/chat-engine/chat-engine.service"

async function testFaqFlow() {
  console.log("🔍 Testing FAQ Flow with New Architecture\n")

  try {
    // 1. Find informational workspace
    const workspace = await prisma.workspace.findFirst({
      where: { sellsProductsAndServices: false },
      select: { id: true, name: true, sellsProductsAndServices: true },
    })

    if (!workspace) {
      console.log("❌ No informational workspace found. Creating one...")
      const newWorkspace = await prisma.workspace.create({
        data: {
          name: "Test FAQ Workspace",
          notificationEmail: "test-faq@echatbot.ai",
          whatsappPhoneNumber: "+393331234567",
          apiKey: `test_faq_${Date.now()}`,
          currency: "EUR",
          sellsProductsAndServices: false,
          slug: `test-faq-${Date.now()}`,
          welcomeMessage: "Benvenuto! Come posso aiutarti?",
        },
      })
      console.log(`✅ Created workspace: ${newWorkspace.name} (${newWorkspace.id})`)
    } else {
      console.log(`✅ Found workspace: ${workspace.name} (${workspace.id})`)
      console.log(`   sellsProductsAndServices: ${workspace.sellsProductsAndServices}\n`)
    }

    const workspaceId = workspace?.id || ""

    // 2. Find or create customer
    let customer = await prisma.customers.findFirst({
      where: { workspaceId },
      select: { id: true, name: true, phone: true },
    })

    if (!customer) {
      console.log("❌ No customer found. Creating one...")
      customer = await prisma.customers.create({
        data: {
          workspaceId,
          phone: "+393331234567",
          name: "Test FAQ Customer",
          language: "it",
          isActive: true,
        },
      })
      console.log(`✅ Created customer: ${customer.name} (${customer.id})\n`)
    } else {
      console.log(`✅ Found customer: ${customer.name} (${customer.id})\n`)
    }

    // 3. Check if FAQs exist
    const faqCount = await prisma.fAQ.count({
      where: { workspaceId, isActive: true },
    })
    console.log(`📚 FAQ count: ${faqCount}`)

    if (faqCount === 0) {
      console.log("⚠️  No FAQs found. Add FAQs to workspace first.\n")
    } else {
      const sampleFaq = await prisma.fAQ.findFirst({
        where: { workspaceId, isActive: true },
        select: { question: true, answer: true },
      })
      console.log(`📝 Sample FAQ: "${sampleFaq?.question?.substring(0, 50)}..."\n`)
    }

    // 4. Test ChatEngine with FAQ question
    console.log("🧪 Testing ChatEngine.routeMessage()...\n")
    const chatEngine = new ChatEngineService(prisma as any)

    const testMessage = "cosa ne pensi della politica?"
    console.log(`💬 Test message: "${testMessage}"`)

    const result = await chatEngine.routeMessage({
      workspaceId,
      customerId: customer.id,
      conversationId: `test-conv-${Date.now()}`,
      message: testMessage,
      customerLanguage: "it",
      customerName: customer.name || "Test",
    })

    console.log("\n📊 RESULTS:")
    console.log("=".repeat(60))
    console.log(`✅ Response: ${result.response?.substring(0, 200)}...`)
    console.log(`✅ Agent Used: ${result.agentUsed}`)
    console.log(`✅ Intent: ${result.intent || "N/A"}`)
    console.log(`✅ Confidence: ${result.confidence || "N/A"}`)
    console.log(`✅ Tokens Used: ${result.tokensUsed}`)
    console.log(`✅ Processing Time: ${result.processingTimeMs || result.executionTimeMs}ms`)
    console.log("=".repeat(60))

    // 5. Verify result
    const didntUnderstand = result.response?.includes("non ho capito") || result.response?.includes("didn't understand")
    const hasFaqAnswer = result.response && result.response.length > 50 && !didntUnderstand

    if (hasFaqAnswer) {
      console.log("\n✅ ✅ ✅ FAQ SYSTEM WORKING! Got meaningful response (not 'didn't understand')")
    } else if (didntUnderstand) {
      console.log("\n❌ ❌ ❌ FAQ SYSTEM BROKEN! Got 'didn't understand' response")
      console.log("   This means IntentParser returned UNKNOWN but RouterOrchestration failed")
    } else {
      console.log("\n⚠️  Unclear result - response too short or empty")
    }

    // 6. Debug info
    if (result.debugInfo?.steps) {
      console.log("\n🔍 Debug Steps:")
      for (const step of result.debugInfo.steps) {
        console.log(`   - ${step.type}: ${step.agent}`)
      }
    }

  } catch (error) {
    console.error("\n❌ ERROR:", error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testFaqFlow()
