/**
 * 🔒 BILLING SYSTEM - TRIAL EXPIRATION TEST
 * 
 * Verifies that the system correctly identifies and handles expired trials.
 */

import { prisma, PrismaClient } from "@echatbot/database"
import { SubscriptionBillingService } from "../../src/application/services/subscription-billing.service"
import { SubscriptionBillingRepository } from "../../src/repositories/subscription-billing.repository"
import logger from "../../src/utils/logger"

// Suppress logs during tests
jest.spyOn(logger, "info").mockImplementation()
jest.spyOn(logger, "error").mockImplementation()
jest.spyOn(logger, "warn").mockImplementation()

describe("🔒 BILLING SYSTEM - Trial Expiration", () => {
    let billingService: SubscriptionBillingService

    let testUserId: string
    let testWorkspaceId: string

    beforeAll(async () => {
        billingService = new SubscriptionBillingService(prisma)

        // Create test user with EXPIRED trial
        const expiredDate = new Date()
        expiredDate.setDate(expiredDate.getDate() - 1) // 1 day ago

        const testUser = await prisma.user.create({
            data: {
                email: `trial-test-${Date.now()}@test.com`,
                passwordHash: "hashed_password",
                firstName: "Trial",
                lastName: "Test",
                creditBalance: 10.00,
                planType: "FREE_TRIAL",
                trialEndsAt: expiredDate,
            },
        })
        testUserId = testUser.id

        // Create test workspace
        const testWorkspace = await prisma.workspace.create({
            data: {
                id: `trial-ws-${Date.now()}`,
                name: "Test Workspace Trial",
                slug: `trial-ws-slug-${Date.now()}`,
                ownerId: testUserId,
            },
        })
        testWorkspaceId = testWorkspace.id
    })

    afterAll(async () => {
        await prisma.billingTransaction.deleteMany({ where: { userId: testUserId } })
        await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } })
        await prisma.user.deleteMany({ where: { id: testUserId } })
        // Do not disconnect global prisma instance in unit tests if shared
    })

    it("should identify trial as EXPIRED when date is in the past", async () => {
        const trialStatus = await billingService.isOwnerTrialValid(testUserId)

        expect(trialStatus.isTrialPlan).toBe(true)
        expect(trialStatus.isValid).toBe(false)
    })

    it("should identify trial as VALID when date is in the future", async () => {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 7) // 7 days from now

        // Temporarily update trialEndsAt
        await prisma.user.update({
            where: { id: testUserId },
            data: { trialEndsAt: futureDate }
        })

        const trialStatus = await billingService.isOwnerTrialValid(testUserId)

        expect(trialStatus.isTrialPlan).toBe(true)
        expect(trialStatus.isValid).toBe(true)
        expect(trialStatus.daysRemaining).toBe(7)

        // Restore to expired for other tests
        const expiredDate = new Date()
        expiredDate.setDate(expiredDate.getDate() - 1)
        await prisma.user.update({
            where: { id: testUserId },
            data: { trialEndsAt: expiredDate }
        })
    })

    it("should return isValid=true for non-trial plans regardless of trialEndsAt", async () => {
        await prisma.user.update({
            where: { id: testUserId },
            data: { planType: "BASIC" }
        })

        const trialStatus = await billingService.isOwnerTrialValid(testUserId)

        expect(trialStatus.isTrialPlan).toBe(false)
        expect(trialStatus.isValid).toBe(true)

        // Restore to FREE_TRIAL
        await prisma.user.update({
            where: { id: testUserId },
            data: { planType: "FREE_TRIAL" }
        })
    })
})
