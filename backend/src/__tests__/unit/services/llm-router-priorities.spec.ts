/**
 * Unit Tests for LLMRouterService Priority Checks (P1/P2/P3)
 *
 * PURPOSE: Diagnose why P2 (challenge disabled) check fails
 *
 * Tests verify:
 * - P1: checkBlockedUser() with real John Smith data
 * - P2: getChallengeDisabled() with real workspace data
 * - Database field names, types, and values
 */

import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../../services/llm-router.service"

const prisma = new PrismaClient()

describe("LLMRouterService - Priority Checks (P1/P2/P3)", () => {
  let llmRouterService: LLMRouterService

  // Real IDs from your database
  const WORKSPACE_ID = "cm9hjgq9v00014qk8fsdy4ujv" // Bell'Italia
  const JOHN_SMITH_ID = "e0915581-2ea4-4b3e-8a07-1cdb75a31e41" // +44123456789 (blocked)
  const JOAO_SILVA_ID = "8dc6f6f9-b05e-4c32-92f7-b7eae7cf8f3f" // +351123456789 (not blocked)

  beforeAll(() => {
    llmRouterService = new LLMRouterService(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe("P1: Blocked User Check", () => {
    it("should detect John Smith as blocked", async () => {
      console.log("\n🔍 TEST P1: Checking if John Smith is blocked...")

      // Get customer from DB to see actual values
      const customer = await prisma.customers.findUnique({
        where: { id: JOHN_SMITH_ID },
      })

      console.log("📊 John Smith database record:")
      console.log(JSON.stringify(customer, null, 2))
      console.log(
        "\n🔑 Critical field - isBlocked:",
        (customer as any)?.isBlocked
      )
      console.log("🔑 Field type:", typeof (customer as any)?.isBlocked)

      // Call private method via reflection (TypeScript workaround)
      const isBlocked = await (llmRouterService as any).checkBlockedUser(
        JOHN_SMITH_ID
      )

      console.log("\n✅ checkBlockedUser() returned:", isBlocked)
      console.log("Expected: true")

      expect(isBlocked).toBe(true)
    })

    it("should NOT detect João Silva as blocked", async () => {
      console.log("\n🔍 TEST P1: Checking if João Silva is blocked...")

      const customer = await prisma.customers.findUnique({
        where: { id: JOAO_SILVA_ID },
      })

      console.log("📊 João Silva database record:")
      console.log(JSON.stringify(customer, null, 2))
      console.log(
        "\n🔑 Critical field - isBlocked:",
        (customer as any)?.isBlocked
      )

      const isBlocked = await (llmRouterService as any).checkBlockedUser(
        JOAO_SILVA_ID
      )

      console.log("\n✅ checkBlockedUser() returned:", isBlocked)
      console.log("Expected: false")

      expect(isBlocked).toBe(false)
    })
  })

  describe("P2: Challenge Disabled Check", () => {
    it("should detect workspace challenge disabled status", async () => {
      console.log(
        "\n🔍 TEST P2: Checking workspace challenge disabled status..."
      )

      // Get workspace from DB to see actual values
      const workspace = await prisma.workspace.findUnique({
        where: { id: WORKSPACE_ID },
      })

      console.log("📊 Workspace database record:")
      console.log(JSON.stringify(workspace, null, 2))
      console.log(
        "\n🔑 Critical field - isChallengeDisabled:",
        (workspace as any)?.isChallengeDisabled
      )
      console.log(
        "🔑 Field type:",
        typeof (workspace as any)?.isChallengeDisabled
      )
      console.log("🔑 Workspace name:", (workspace as any)?.name)

      // List ALL fields in workspace object
      console.log("\n📋 ALL workspace fields:")
      if (workspace) {
        Object.keys(workspace).forEach((key) => {
          const value = (workspace as any)[key]
          console.log(`  - ${key}: ${JSON.stringify(value)} (${typeof value})`)
        })
      }

      // Call private method via reflection
      const isChallengeDisabled = await (
        llmRouterService as any
      ).getChallengeDisabled(WORKSPACE_ID)

      console.log("\n✅ getChallengeDisabled() returned:", isChallengeDisabled)
      console.log("Current DB value:", (workspace as any)?.isChallengeDisabled)
      console.log("Expected: Should match DB value")

      // This test shows current state - we'll verify it matches DB
      expect(isChallengeDisabled).toBe((workspace as any)?.isChallengeDisabled)
    })

    it("should return WIP message when challenge disabled", async () => {
      console.log("\n🔍 TEST P2: Manually enable maintenance mode and test...")

      // 1. Enable maintenance mode
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: WORKSPACE_ID },
        data: { isChallengeDisabled: true },
      })

      console.log("✅ Maintenance mode ENABLED")
      console.log("isChallengeDisabled:", updatedWorkspace.isChallengeDisabled)

      // 2. Check if method detects it
      const isChallengeDisabled = await (
        llmRouterService as any
      ).getChallengeDisabled(WORKSPACE_ID)

      console.log("\n✅ getChallengeDisabled() returned:", isChallengeDisabled)
      console.log("Expected: true")

      // 3. Disable maintenance mode after test
      await prisma.workspace.update({
        where: { id: WORKSPACE_ID },
        data: { isChallengeDisabled: false },
      })

      console.log("\n🔄 Maintenance mode DISABLED (cleanup)")

      expect(isChallengeDisabled).toBe(true)
    })
  })

  describe("P3: Welcome Message Check", () => {
    it("should NOT send welcome message to existing customer", async () => {
      console.log(
        "\n🔍 TEST P3: Checking welcome message for João Silva (existing customer)..."
      )

      // Count existing messages
      const messageCount = await prisma.conversationMessage.count({
        where: {
          workspaceId: WORKSPACE_ID,
          customerId: JOAO_SILVA_ID,
          role: "assistant",
        },
      })

      console.log("📊 João Silva message count:", messageCount)

      // Call private method via reflection
      const welcomeMessage = await (llmRouterService as any).getWelcomeMessage(
        WORKSPACE_ID,
        JOAO_SILVA_ID,
        "pt"
      )

      console.log("\n✅ getWelcomeMessage() returned:", welcomeMessage)
      console.log("Expected: null (customer has history)")

      expect(welcomeMessage).toBeNull()
    })
  })

  describe("Database Schema Verification", () => {
    it("should verify Workspace has isChallengeDisabled field", async () => {
      console.log(
        "\n🔍 SCHEMA CHECK: Verifying Workspace.isChallengeDisabled field..."
      )

      const workspace = await prisma.workspace.findUnique({
        where: { id: WORKSPACE_ID },
      })

      const hasField = workspace && "isChallengeDisabled" in workspace

      console.log("✅ Field exists:", hasField)
      console.log("Field value:", (workspace as any)?.isChallengeDisabled)
      console.log("Field type:", typeof (workspace as any)?.isChallengeDisabled)

      expect(hasField).toBe(true)
      expect(typeof (workspace as any)?.isChallengeDisabled).toBe("boolean")
    })

    it("should verify Customer has isBlocked field", async () => {
      console.log("\n🔍 SCHEMA CHECK: Verifying Customer.isBlocked field...")

      const customer = await prisma.customers.findUnique({
        where: { id: JOHN_SMITH_ID },
      })

      const hasField = customer && "isBlocked" in customer

      console.log("✅ Field exists:", hasField)
      console.log("Field value:", (customer as any)?.isBlocked)
      console.log("Field type:", typeof (customer as any)?.isBlocked)

      expect(hasField).toBe(true)
      expect(typeof (customer as any)?.isBlocked).toBe("boolean")
    })
  })
})
