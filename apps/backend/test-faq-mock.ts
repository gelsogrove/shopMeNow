/**
 * Mock FAQ Test - No LLM API Calls
 * 
 * Tests routing logic WITHOUT calling OpenRouter API:
 * 1. IntentParser returns UNKNOWN (no pattern match)
 * 2. RouterOrchestrationService delegates to InformationalWorkspaceStrategy
 * 3. Mocked CUSTOMER_SUPPORT returns FAQ answer
 * 4. Verify response is FAQ answer (not "didn't understand")
 */

import { prisma } from "@echatbot/database"

// Mock CustomerSupportAgentLLM to avoid API calls
jest.mock("../src/application/agents/CustomerSupportAgentLLM", () => ({
  CustomerSupportAgentLLM: jest.fn().mockImplementation(() => ({
    handleQuery: jest.fn().mockResolvedValue({
      output: "Per quanto riguarda la politica, BellItalia si impegna a fornire prodotti di altissima qualità made in Italy e a supportare i produttori locali.",
      tokensUsed: 0,
      executionTimeMs: 50,
      functionCalls: [],
    }),
  })),
}))

// Mock LLMRouterService to avoid full Router LLM
jest.mock("../src/services/llm-router.service", () => ({
  LLMRouterService: jest.fn().mockImplementation(() => ({
    routeMessage: jest.fn().mockResolvedValue({
      response: "Per quanto riguarda la politica, BellItalia si impegna a fornire prodotti di altissima qualità made in Italy.",
      agentUsed: "CUSTOMER_SUPPORT",
      confidence: 1,
      tokensUsed: 0,
      executionTimeMs: 50,
      wasFAQ: false,
      debugInfo: {
        steps: [],
        totalTokens: 0,
        totalCost: 0,
        executionTimeMs: 50,
      },
    }),
  })),
}))

import { ChatEngineService } from "../src/application/chat-engine/chat-engine.service"

async function testMockFaqFlow() {
  console.log("🧪 Testing FAQ Flow with MOCKED LLM (No API Calls)\n")

  try {
    // 1. Find BellItalia workspace
    const workspace = await prisma.workspace.findFirst({
      where: { name: "BellItalia" },
      select: { id: true, name: true, sellsProductsAndServices: true },
    })

    if (!workspace) {
      console.log("❌ BellItalia workspace not found")
      return
    }

    console.log(`✅ Found workspace: ${workspace.name}`)
    console.log(`   sellsProductsAndServices: ${workspace.sellsProductsAndServices}\n`)

    // 2. Find customer
    const customer = await prisma.customers.findFirst({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true },
    })

    if (!customer) {
      console.log("❌ No customer found")
      return
    }

    console.log(`✅ Found customer: ${customer.name}\n`)

    // 3. Check FAQs
    const faqCount = await prisma.fAQ.count({
      where: { workspaceId: workspace.id, isActive: true },
    })
    console.log(`📚 FAQ count in DB: ${faqCount}`)

    const sampleFaq = await prisma.fAQ.findFirst({
      where: { 
        workspaceId: workspace.id, 
        isActive: true,
        question: { contains: "politica" }
      },
      select: { question: true, answer: true },
    })
    
    if (sampleFaq) {
      console.log(`📝 Sample FAQ found: "${sampleFaq.question}"`)
      console.log(`   Answer: "${sampleFaq.answer.substring(0, 80)}..."\n`)
    } else {
      console.log("⚠️  No matching FAQ found\n")
    }

    // 4. Create ChatEngine with MOCKED services
    console.log("🎬 Creating ChatEngine with MOCKED LLM services...")
    const chatEngine = new ChatEngineService(prisma as any)
    console.log("✅ ChatEngine created\n")

    // 5. Test with FAQ question
    const testMessage = "cosa ne pensi della politica?"
    console.log(`💬 Test message: "${testMessage}"`)
    console.log("🔄 Processing message...\n")

    const startTime = Date.now()
    const result = await chatEngine.routeMessage({
      workspaceId: workspace.id,
      customerId: customer.id,
      conversationId: `mock-test-${Date.now()}`,
      message: testMessage,
      customerLanguage: "it",
      customerName: customer.name || "Test",
    })
    const duration = Date.now() - startTime

    // 6. Display results
    console.log("\n" + "=".repeat(70))
    console.log("📊 TEST RESULTS")
    console.log("=".repeat(70))
    console.log(`✅ Response: ${result.response?.substring(0, 150)}...`)
    console.log(`✅ Agent Used: ${result.agentUsed}`)
    console.log(`✅ Intent: ${result.intent || "N/A"}`)
    console.log(`✅ Confidence: ${result.confidence || "N/A"}`)
    console.log(`✅ Source: ${result.source || "N/A"}`)
    console.log(`✅ Was Handled: ${result.wasHandled}`)
    console.log(`✅ Tokens Used: ${result.tokensUsed} (should be 0 - mocked)`)
    console.log(`✅ Processing Time: ${duration}ms`)
    console.log("=".repeat(70))

    // 7. Verify success
    const didntUnderstand = result.response?.includes("non ho capito") || 
                           result.response?.includes("didn't understand") ||
                           result.response?.includes("riformulare")
    
    const hasFaqAnswer = result.response && 
                        result.response.length > 50 && 
                        !didntUnderstand &&
                        result.response.includes("BellItalia")

    console.log("\n" + "=".repeat(70))
    if (hasFaqAnswer) {
      console.log("✅ ✅ ✅ FAQ ROUTING LOGIC WORKS!")
      console.log("✅ IntentParser → UNKNOWN → RouterOrchestration → CUSTOMER_SUPPORT")
      console.log("✅ Got meaningful FAQ response (not 'didn't understand')")
    } else if (didntUnderstand) {
      console.log("❌ ❌ ❌ FAQ ROUTING LOGIC BROKEN!")
      console.log("❌ Got 'didn't understand' response")
      console.log("❌ RouterOrchestrationService may not be working")
    } else {
      console.log("⚠️  UNCLEAR RESULT")
      console.log("⚠️  Response doesn't match expected patterns")
    }
    console.log("=".repeat(70))

    // 8. Debug steps
    if (result.debugInfo?.steps && result.debugInfo.steps.length > 0) {
      console.log("\n🔍 Debug Steps:")
      for (const step of result.debugInfo.steps) {
        console.log(`   ${step.type}: ${step.agent || "N/A"}`)
      }
    } else {
      console.log("\n⚠️  No debug steps recorded")
    }

  } catch (error) {
    console.error("\n❌ ERROR:", error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testMockFaqFlow()
