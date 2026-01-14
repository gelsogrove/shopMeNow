import { prisma } from "@echatbot/database"
import { SubscriptionBillingService } from "../../apps/backend/src/application/services/subscription-billing.service"

describe("Integration - Owner credit recharge limits", () => {
  const userId = `recharge-test-${Date.now()}`
  const email = `recharge-${Date.now()}@example.com`
  let service: SubscriptionBillingService

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        email,
        role: "OWNER",
      },
    })
    service = new SubscriptionBillingService(prisma)
  })

  afterAll(async () => {
    await prisma.billingTransaction.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it("rejects recharges below $10", async () => {
    await expect(service.rechargeOwnerCredit(userId, 5)).rejects.toThrow(
      "Minimum recharge amount is $10"
    )
  })

  it("accepts recharges at $10", async () => {
    const result = await service.rechargeOwnerCredit(userId, 10)
    expect(result.success).toBe(true)
    expect(result.newBalance).toBeDefined()
  })
})
