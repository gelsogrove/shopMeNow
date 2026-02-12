import { BillingService } from "../../src/application/services/billing.service"
import { SubscriptionBillingService } from "../../src/application/services/subscription-billing.service"
import { TransactionType } from "../../src/repositories/subscription-billing.repository"
import { platformConfigService } from "../../src/services/platform-config.service"

/**
 * Security tests to lock billing unit prices and deductions:
 * - WhatsApp messages: €0.10
 * - Widget messages:   €0.05
 */

describe("Billing unit rates security", () => {
  describe("trackMessage (WhatsApp)", () => {
    it("deducts exactly €0.10 and records negative transaction", async () => {
      jest.spyOn(platformConfigService, "getPrice").mockResolvedValue(0.10)

      // In-memory ledger to observe writes
      let balance = 1.00
      const createdTransactions: any[] = []

      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws1",
            ownerId: "owner1",
            name: "WS",
          }),
        },
        billing: { create: jest.fn() },
        billingTransaction: {
          create: jest.fn().mockImplementation(({ data }: any) => {
            createdTransactions.push(data)
          }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: balance }),
          update: jest.fn().mockImplementation(({ data }: any) => {
            balance = Number(data.creditBalance)
          }),
        },
        $transaction: async (cb: any) =>
          cb({
            billing: prismaMock.billing,
            billingTransaction: prismaMock.billingTransaction,
            user: prismaMock.user,
          }),
      }

      const service = new BillingService(prismaMock as any)
      await service.trackMessage("ws1", "cust1", "Message interaction")

      expect(platformConfigService.getPrice).toHaveBeenCalledWith("MESSAGE")
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "owner1" },
        data: { creditBalance: balance }, // balance already updated in mock
      })
      expect(createdTransactions[0].amount).toBe(-0.10)
      expect(balance).toBeCloseTo(0.90, 2) // 1.00 - 0.10
    })
  })

  describe("deductOwnerWidgetMessageCredit (widget)", () => {
    it("uses €0.05 widget cost and records deduction via repository", async () => {
      jest.spyOn(platformConfigService, "getPrice").mockResolvedValue(0.05)

      const mockRepository = {
        getOwnerBilling: jest.fn().mockResolvedValue({
          userId: "owner1",
          planType: "BASIC",
        }),
        getPlanConfiguration: jest.fn().mockResolvedValue({
          lowBalanceThreshold: 5,
        }),
        deductCredit: jest.fn().mockResolvedValue({
          success: true,
          newBalance: 4.5,
        }),
      }

      jest
        .spyOn(SubscriptionBillingService.prototype as any, "repository", "get")
        .mockReturnValue(mockRepository)

      const service = new SubscriptionBillingService({} as any)
      const result = await service.deductOwnerWidgetMessageCredit(
        "owner1",
        "ws1",
        "msg1"
      )

      expect(platformConfigService.getPrice).toHaveBeenCalledWith(
        "WIDGET_MESSAGE"
      )
      expect(mockRepository.deductCredit).toHaveBeenCalledWith(
        "owner1",
        0.05,
        TransactionType.MESSAGE,
        "Widget message",
        "ws1",
        "msg1",
        "widget_message"
      )
      expect(result.newBalance).toBe(4.5)
    })
  })
})
