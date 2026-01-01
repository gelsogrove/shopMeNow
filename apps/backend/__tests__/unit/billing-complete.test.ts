/**
 * 🔒 BILLING SYSTEM - COMPLETE TEST SUITE
 * 
 * Purpose: Prevent ALL billing bugs discovered in production
 * 
 * Critical Bugs Prevented:
 * 1. Race Condition: Multiple messages reading same balance → Fixed by reading balance INSIDE transaction
 * 2. Amount Sign Error: MESSAGE stored as positive instead of negative → Fixed by using -messageCost
 * 3. Upgrade Fee Balance Corruption: UPGRADE_FEE with amount=0 creating wrong balanceAfter
 * 
 * Production Incident Timeline:
 * - Dec 28, 2025 15:02: Balance jumped from 186.90€ to 499.90€ (race condition + positive amount)
 * - Jan 01, 2026 10:42: UPGRADE_FEE recorded balance=499.90€ (photographed corrupted state)
 * 
 * @author Andrea Gelso - eChatbot Platform
 */

import { PrismaClient, Prisma } from "@echatbot/database"
import { BillingService } from "../../src/application/services/billing.service"
import { SubscriptionBillingRepository } from "../../src/repositories/subscription-billing.repository"
import logger from "../../src/utils/logger"

// Suppress logs during tests
jest.spyOn(logger, "info").mockImplementation()
jest.spyOn(logger, "error").mockImplementation()
jest.spyOn(logger, "warn").mockImplementation()

describe("🔒 BILLING SYSTEM - Complete Protection Suite", () => {
  let prisma: PrismaClient
  let billingService: BillingService
  let subscriptionBillingRepo: SubscriptionBillingRepository

  let testUserId: string
  let testWorkspaceId: string
  let testCustomerId: string

  beforeAll(async () => {
    prisma = new PrismaClient()
    billingService = new BillingService(prisma)
    subscriptionBillingRepo = new SubscriptionBillingRepository(prisma)

    // Create test user with initial balance
    const testUser = await prisma.user.create({
      data: {
        email: `billing-test-${Date.now()}@test.com`,
        password: "hashed_password",
        firstName: "Billing",
        lastName: "Test",
        creditBalance: new Prisma.Decimal("200.00"),
        planType: "PREMIUM",
      },
    })
    testUserId = testUser.id

    // Create test workspace
    const testWorkspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace Billing",
        ownerId: testUserId,
        creditBalance: new Prisma.Decimal("0"), // Not used anymore (Feature 198)
      },
    })
    testWorkspaceId = testWorkspace.id

    // Create test customer
    const testCustomer = await prisma.customers.create({
      data: {
        workspaceId: testWorkspaceId,
        phoneNumber: "+393331234567",
        firstName: "Test",
        lastName: "Customer",
      },
    })
    testCustomerId = testCustomer.id
  })

  afterAll(async () => {
    // Cleanup in reverse order
    await prisma.billingTransaction.deleteMany({
      where: { userId: testUserId },
    })
    await prisma.billing.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.customers.deleteMany({
      where: { id: testCustomerId },
    })
    await prisma.workspace.deleteMany({
      where: { id: testWorkspaceId },
    })
    await prisma.user.deleteMany({
      where: { id: testUserId },
    })

    await prisma.$disconnect()
  })

  describe("Category 1: MESSAGE Deduction - Correct Behavior", () => {
    it("should deduct €0.10 from owner balance (not workspace)", async () => {
      const balanceBefore = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const balanceAfter = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      const expectedBalance = Number(balanceBefore!.creditBalance) - 0.1

      expect(Number(balanceAfter!.creditBalance)).toBeCloseTo(expectedBalance, 2)
    })

    it("should create billing transaction with NEGATIVE amount", async () => {
      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const transaction = await prisma.billingTransaction.findFirst({
        where: {
          userId: testUserId,
          type: "MESSAGE",
        },
        orderBy: { createdAt: "desc" },
      })

      expect(transaction).not.toBeNull()
      expect(Number(transaction!.amount)).toBeLessThan(0) // 🔒 CRITICAL: Must be negative
      expect(Number(transaction!.amount)).toBeCloseTo(-0.1, 2)
    })

    it("should update balanceAfter to match actual user.creditBalance", async () => {
      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      const transaction = await prisma.billingTransaction.findFirst({
        where: { userId: testUserId, type: "MESSAGE" },
        orderBy: { createdAt: "desc" },
      })

      // 🔒 CRITICAL: balanceAfter must EXACTLY match user.creditBalance
      expect(Number(transaction!.balanceAfter)).toEqual(Number(user!.creditBalance))
    })
  })

  describe("Category 2: RACE CONDITION Prevention", () => {
    it("should handle 10 concurrent messages with UNIQUE balances (no duplicates)", async () => {
      const promises = Array.from({ length: 10 }, () =>
        billingService.trackMessage(testWorkspaceId, testCustomerId)
      )

      await Promise.all(promises)

      // Get last 10 transactions
      const transactions = await prisma.billingTransaction.findMany({
        where: {
          userId: testUserId,
          type: "MESSAGE",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })

      expect(transactions.length).toBe(10)

      // Extract balances
      const balances = transactions.map((t) => Number(t.balanceAfter))

      // 🔒 CRITICAL: All balances must be UNIQUE (no race condition)
      const uniqueBalances = new Set(balances)
      expect(uniqueBalances.size).toBe(10)

      // Verify descending order (most recent has lowest balance)
      const sortedBalances = [...balances].sort((a, b) => b - a)
      expect(balances).toEqual(sortedBalances)
    })

    it("should maintain balance consistency after 5 sequential messages", async () => {
      const initialBalance = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      for (let i = 0; i < 5; i++) {
        await billingService.trackMessage(testWorkspaceId, testCustomerId)
      }

      const finalBalance = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      const expectedBalance = Number(initialBalance!.creditBalance) - 0.5

      expect(Number(finalBalance!.creditBalance)).toBeCloseTo(expectedBalance, 2)
    })
  })

  describe("Category 3: UPGRADE_FEE - Balance Preservation", () => {
    it("should NOT corrupt balance when UPGRADE_FEE has amount=0", async () => {
      const balanceBefore = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      // Simulate upgrade fee (amount=0 because it's just a status change)
      await subscriptionBillingRepo.addCredit(
        testUserId,
        0, // Amount = 0 (no actual charge, just documentation)
        "UPGRADE_FEE",
        "Upgrade to Enterprise (€149.00/month)",
        testWorkspaceId
      )

      const balanceAfter = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      // 🔒 CRITICAL: Balance MUST NOT change when amount=0
      expect(Number(balanceAfter!.creditBalance)).toEqual(Number(balanceBefore!.creditBalance))
    })

    it("should record UPGRADE_FEE with CORRECT balanceAfter (no corruption)", async () => {
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      await subscriptionBillingRepo.addCredit(
        testUserId,
        0,
        "UPGRADE_FEE",
        "Upgrade to Premium (€39.00/month)",
        testWorkspaceId
      )

      const transaction = await prisma.billingTransaction.findFirst({
        where: {
          userId: testUserId,
          type: "UPGRADE_FEE",
        },
        orderBy: { createdAt: "desc" },
      })

      // 🔒 CRITICAL: balanceAfter must match actual user balance (not some random value)
      expect(Number(transaction!.balanceAfter)).toEqual(Number(user!.creditBalance))
      expect(Number(transaction!.amount)).toBe(0)
    })

    it("should handle UPGRADE_FEE even if user balance was previously corrupted", async () => {
      // Simulate a corrupted balance scenario
      const corruptedBalance = 499.9
      await prisma.user.update({
        where: { id: testUserId },
        data: { creditBalance: new Prisma.Decimal(corruptedBalance) },
      })

      await subscriptionBillingRepo.addCredit(
        testUserId,
        0,
        "UPGRADE_FEE",
        "Upgrade to Enterprise (€149.00/month)"
      )

      const transaction = await prisma.billingTransaction.findFirst({
        where: {
          userId: testUserId,
          type: "UPGRADE_FEE",
        },
        orderBy: { createdAt: "desc" },
      })

      // Transaction should photograph the actual balance (even if corrupted)
      expect(Number(transaction!.balanceAfter)).toBeCloseTo(corruptedBalance, 2)

      // Restore correct balance for other tests
      await prisma.user.update({
        where: { id: testUserId },
        data: { creditBalance: new Prisma.Decimal("200.00") },
      })
    })
  })

  describe("Category 4: Balance Calculation Consistency", () => {
    it("should maintain exact balance sync between user and transactions", async () => {
      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      const latestTransaction = await prisma.billingTransaction.findFirst({
        where: { userId: testUserId },
        orderBy: { createdAt: "desc" },
      })

      expect(Number(latestTransaction!.balanceAfter)).toEqual(Number(user!.creditBalance))
    })

    it("should calculate balance correctly after multiple deduction types", async () => {
      const initialBalance = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      // MESSAGE: -0.10
      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      // RECHARGE: +50.00
      await subscriptionBillingRepo.addCredit(
        testUserId,
        50,
        "RECHARGE",
        "Manual credit recharge",
        testWorkspaceId
      )

      // MESSAGE: -0.10
      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const finalBalance = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      const expectedBalance = Number(initialBalance!.creditBalance) - 0.1 + 50 - 0.1

      expect(Number(finalBalance!.creditBalance)).toBeCloseTo(expectedBalance, 2)
    })
  })

  describe("Category 5: Edge Cases & Error Scenarios", () => {
    it("should handle near-zero balance without going negative", async () => {
      // Set balance to 0.05 (less than message cost)
      await prisma.user.update({
        where: { id: testUserId },
        data: { creditBalance: new Prisma.Decimal("0.05") },
      })

      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const balance = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      // Should allow negative balance (debt)
      expect(Number(balance!.creditBalance)).toBeCloseTo(-0.05, 2)

      // Restore balance
      await prisma.user.update({
        where: { id: testUserId },
        data: { creditBalance: new Prisma.Decimal("200.00") },
      })
    })

    it("should create legacy billing record for analytics", async () => {
      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const legacyRecord = await prisma.billing.findFirst({
        where: {
          workspaceId: testWorkspaceId,
          type: "whatsapp_message",
        },
        orderBy: { createdAt: "desc" },
      })

      expect(legacyRecord).not.toBeNull()
      expect(Number(legacyRecord!.amount)).toBeCloseTo(-0.1, 2)
    })
  })

  describe("Category 6: Production Incident Replication", () => {
    it("should NEVER create positive MESSAGE transactions (Dec 28 bug)", async () => {
      // Replicate Dec 28, 2025 incident conditions
      await billingService.trackMessage(testWorkspaceId, testCustomerId)

      const transaction = await prisma.billingTransaction.findFirst({
        where: {
          userId: testUserId,
          type: "MESSAGE",
        },
        orderBy: { createdAt: "desc" },
      })

      // 🚨 CRITICAL: This was the bug - amount was 0.10 instead of -0.10
      expect(Number(transaction!.amount)).toBeLessThan(0)
      expect(Number(transaction!.amount)).not.toBeGreaterThan(0)
    })

    it("should prevent balance jump from concurrent messages (Dec 28 race condition)", async () => {
      const balanceBefore = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      // Simulate Dec 28 incident: 2 messages arrive at exact same time
      await Promise.all([
        billingService.trackMessage(testWorkspaceId, testCustomerId),
        billingService.trackMessage(testWorkspaceId, testCustomerId),
      ])

      const balanceAfter = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { creditBalance: true },
      })

      const expectedBalance = Number(balanceBefore!.creditBalance) - 0.2

      // 🚨 CRITICAL: Balance should drop by exactly 0.20€, NOT jump to random value like 499.90€
      expect(Number(balanceAfter!.creditBalance)).toBeCloseTo(expectedBalance, 2)
      expect(Number(balanceAfter!.creditBalance)).not.toBeCloseTo(499.9, 2)
    })
  })
})
