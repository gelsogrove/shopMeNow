/**
 * 🔧 Shared Test Setup for Calling Functions Integration Tests
 *
 * Common configuration and utilities for all CF integration tests
 * to ensure consistency and reduce code duplication.
 */

// DON'T IMPORT - USE REQUIRE LIKE HELLO WORLD TEST!
const { PrismaClient } = require("@prisma/client")
import { LLMService } from "../../../services/llm.service"

// Initialize services globally - SAME AS WORKING TEST
export const prisma = new PrismaClient()
export const llmService = new LLMService()

// 🌍 Shared Test Configuration
export const TEST_CONFIG = {
  workspaceId: "", // Will be set during setup from first workspace
  customerPhone: "+34666777888", // Spanish test customer from seed
  customerId: "", // Will be set during setup
  model: "openai/gpt-4o-mini", // Use OpenRouter like production
  language: "it",
  sessionId: "test-session",
  maxTokens: 5000,
  timeout: 30000, // 30 seconds for LLM calls
}

/**
 * Setup test customer with correct configuration
 */
export async function setupTestCustomer() {
  // USE SINGULAR 'workspace' - that's what the generated Prisma client has!
  const workspace = await (prisma as any).workspace.findFirst({
    where: { isActive: true, isDelete: false },
    // Don't include relations - just get basic workspace
  })

  if (!workspace) {
    throw new Error("No workspace found! Run npm run seed first.")
  }
  TEST_CONFIG.workspaceId = workspace.id

  const customer = await prisma.customers.findFirst({
    where: {
      phone: TEST_CONFIG.customerPhone,
      workspaceId: TEST_CONFIG.workspaceId,
    },
  })

  if (!customer) {
    throw new Error(
      `Test customer ${TEST_CONFIG.customerPhone} not found! Run npm run seed first.`
    )
  }

  // Ensure customer has chatbot enabled
  if (!customer.activeChatbot || customer.isBlacklisted) {
    await prisma.customers.update({
      where: { id: customer.id },
      data: {
        activeChatbot: true,
        isBlacklisted: false,
      },
    })
  }

  TEST_CONFIG.customerId = customer.id
  return customer
}

/**
 * Helper function to call LLM and extract function call info
 */
export async function callLLMAndGetFunctionInfo(userQuery: string) {
  const result = await llmService.handleMessage({
    chatInput: userQuery,
    phone: TEST_CONFIG.customerPhone,
    workspaceId: TEST_CONFIG.workspaceId,
    customerid: TEST_CONFIG.customerId,
    language: TEST_CONFIG.language,
    sessionId: TEST_CONFIG.sessionId,
    maxTokens: TEST_CONFIG.maxTokens,
    model: TEST_CONFIG.model,
    messages: [],
    prompt: "", // Will be loaded from database
  })

  // Extract function calls from debugInfo if present
  let functionCalled = null
  let functionArgs = null

  if (result.debugInfo) {
    const debugData =
      typeof result.debugInfo === "string"
        ? JSON.parse(result.debugInfo)
        : result.debugInfo

    if (debugData.functionCalls && Array.isArray(debugData.functionCalls)) {
      const firstCall = debugData.functionCalls[0]
      if (firstCall) {
        functionCalled = firstCall.name || null
        functionArgs = firstCall.arguments || null
      }
    }
  }

  return {
    response: result.output || "",
    functionCalled,
    functionArgs,
    success: result.success,
    debugInfo: result.debugInfo,
  }
}

/**
 * Cleanup function to disconnect Prisma
 */
export async function cleanup() {
  await prisma.$disconnect()
}
