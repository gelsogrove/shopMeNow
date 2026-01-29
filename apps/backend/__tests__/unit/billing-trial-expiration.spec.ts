/**
 * 🔒 BILLING SYSTEM - TRIAL EXPIRATION TEST
 * 
 * Verifies that the system correctly identifies and handles expired trials.
 * This version uses MOCKS to bypass database connection issues in the test environment.
 */

// Mock the database singleton BEFORE importing anything
jest.mock("@echatbot/database", () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
        },
        billingTransaction: {
            aggregate: jest.fn(),
        },
    },
    PrismaClient: jest.fn(),
}))

import { prisma } from "@echatbot/database"
import { SubscriptionBillingService } from "../../src/application/services/subscription-billing.service"
import logger from "../../src/utils/logger"

// Suppress logs during tests
jest.spyOn(logger, "info").mockImplementation()
jest.spyOn(logger, "error").mockImplementation()
jest.spyOn(logger, "warn").mockImplementation()

// Get the mocked prisma
const mockPrisma = prisma as any

describe("🔒 BILLING SYSTEM - Trial Expiration", () => {
    let billingService: SubscriptionBillingService
    let testUserId = "test-user-id"

    beforeAll(async () => {
        billingService = new SubscriptionBillingService(prisma)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should identify trial as EXPIRED when date is in the past", async () => {
        const expiredDate = new Date()
        expiredDate.setDate(expiredDate.getDate() - 1)

        // Mock repository response (simulating getOwnerBilling)
        mockPrisma.user.findUnique.mockResolvedValue({
            id: testUserId,
            planType: "FREE_TRIAL",
            trialEndsAt: expiredDate,
            planStartedAt: new Date(),
            subscriptionStatus: "ACTIVE",
            creditBalance: 10.0,
            isPaymentConnected: true
        })

        // Mock transaction aggregation for totalRecharges
        mockPrisma.billingTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } })

        const trialStatus = await billingService.isOwnerTrialValid(testUserId)

        expect(trialStatus.isTrialPlan).toBe(true)
        expect(trialStatus.isValid).toBe(false)
    })

    it("should identify trial as VALID when date is in the future", async () => {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 7)

        mockPrisma.user.findUnique.mockResolvedValue({
            id: testUserId,
            planType: "FREE_TRIAL",
            trialEndsAt: futureDate,
            planStartedAt: new Date(),
            subscriptionStatus: "ACTIVE",
            creditBalance: 10.0,
            isPaymentConnected: true
        })

        mockPrisma.billingTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } })

        const trialStatus = await billingService.isOwnerTrialValid(testUserId)

        expect(trialStatus.isTrialPlan).toBe(true)
        expect(trialStatus.isValid).toBe(true)
        expect(trialStatus.daysRemaining).toBe(7)
    })

    it("should return isValid=true for non-trial plans regardless of trialEndsAt", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: testUserId,
            planType: "BASIC",
            trialEndsAt: new Date(2000, 0, 1),
            planStartedAt: new Date(),
            subscriptionStatus: "ACTIVE",
            creditBalance: 10.0,
            isPaymentConnected: true
        })

        mockPrisma.billingTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } })

        const trialStatus = await billingService.isOwnerTrialValid(testUserId)

        expect(trialStatus.isTrialPlan).toBe(false)
        expect(trialStatus.isValid).toBe(true)
    })
})
