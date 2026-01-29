/**
 * Unit Tests for Free Trial Expiration Logic
 * Feature: Subscription & Billing System
 */

import { SubscriptionBillingService } from "../../src/application/services/subscription-billing.service"

const mockRepository = {
    getOwnerBilling: jest.fn(),
    getWorkspaceBilling: jest.fn(),
    getPlanConfiguration: jest.fn(),
}

const mockPrisma = {
    user: {
        findUnique: jest.fn(),
    },
}

jest.mock("../../src/repositories/subscription-billing.repository", () => ({
    SubscriptionBillingRepository: jest.fn().mockImplementation(() => mockRepository),
}))

describe("SubscriptionBillingService - Free Trial Expiration", () => {
    let service: SubscriptionBillingService
    const mockWorkspaceId = "test-workspace-id"

    beforeEach(() => {
        jest.clearAllMocks()
        service = new SubscriptionBillingService(mockPrisma as any)
            ; (service as any).repository = mockRepository
    })

    // Test Case 1: Active trial
    it("should return isValid: true for an active free trial", async () => {
        const trialEndsAt = new Date()
        trialEndsAt.setDate(trialEndsAt.getDate() + 5) // 5 days in the future

        mockRepository.getWorkspaceBilling.mockResolvedValue({
            planType: "FREE_TRIAL",
            trialEndsAt: trialEndsAt,
            isTrialExpired: false,
            daysUntilTrialExpires: 5,
        })

        const result = await service.isTrialValid(mockWorkspaceId)

        expect(result.isValid).toBe(true)
        expect(result.isTrialPlan).toBe(true)
        expect(result.daysRemaining).toBe(5)
    })

    // Test Case 2: Expired trial
    it("should return isValid: false for an expired free trial", async () => {
        const trialEndsAt = new Date()
        trialEndsAt.setDate(trialEndsAt.getDate() - 2) // 2 days in the past

        mockRepository.getWorkspaceBilling.mockResolvedValue({
            planType: "FREE_TRIAL",
            trialEndsAt: trialEndsAt,
            isTrialExpired: true,
            daysUntilTrialExpires: -2,
        })

        const result = await service.isTrialValid(mockWorkspaceId)

        expect(result.isValid).toBe(false)
        expect(result.isTrialPlan).toBe(true)
    })

    // Test Case 3: Paid plan (Trial logic not applicable)
    it("should return isValid: true for paid plans (BASIC, PREMIUM)", async () => {
        mockRepository.getWorkspaceBilling.mockResolvedValue({
            planType: "BASIC",
            trialEndsAt: null,
            isTrialExpired: false,
            daysUntilTrialExpires: null,
        })

        const result = await service.isTrialValid(mockWorkspaceId)

        expect(result.isValid).toBe(true)
        expect(result.isTrialPlan).toBe(false)
    })
})
