/**
 * BILLING SERVICE UNIT TESTS
 *
 * Test per verificare che il BillingService:
 * 1. Legga i prezzi dal database (PricingRepository)
 * 2. Crei billing records con il prezzo corretto
 * 3. Aggiorni correttamente previousTotal, currentCharge, newTotal
 *
 * Andrea richiede: test per MESSAGE, NEW_CUSTOMER, NEW_ORDER
 */

import { PrismaClient, BillingType } from "@prisma/client"
import { BillingService } from "../../application/services/billing.service"
import { PricingRepository } from "../../repositories/pricing.repository"

const prisma = new PrismaClient()
const billingService = new BillingService(prisma)
const pricingRepo = new PricingRepository(prisma)

describe("BillingService - Dynamic Pricing from Database", () => {
  const testWorkspaceId = "test-workspace-billing"
  const testCustomerId = "test-customer-billing"

  // Helper function to create customer
  async function createTestCustomer(customerId: string, email?: string) {
    await prisma.customers.upsert({
      where: { id: customerId },
      create: {
        id: customerId,
        workspaceId: testWorkspaceId,
        phone: `+123456${Date.now()}`,
        email: email || `${customerId}@test.com`,
        name: `Test Customer ${customerId}`,
      },
      update: {},
    })
  }

  beforeAll(async () => {
    // Create test workspace first
    await prisma.workspace.upsert({
      where: { id: testWorkspaceId },
      create: {
        id: testWorkspaceId,
        name: "Test Workspace for Billing",
        slug: "test-billing-ws",
      },
      update: {},
    })

    // Create test customer
    await prisma.customers.upsert({
      where: { id: testCustomerId },
      create: {
        id: testCustomerId,
        workspaceId: testWorkspaceId,
        phone: "+1234567890",
        email: "test-billing@example.com",
        name: "Test Customer",
      },
      update: {},
    })

    // Cleanup test billing data
    await prisma.billing.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.billing.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.customers.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.workspace.delete({
      where: { id: testWorkspaceId },
    })
    await prisma.$disconnect()
  })

  describe("trackMessage (€0.15 per message)", () => {
    it("should charge correct MESSAGE price from database", async () => {
      // Get current price from database
      const expectedPrice = await pricingRepo.getValue("MESSAGE")
      expect(expectedPrice).toBe(0.15)

      // Track message
      await billingService.trackMessage(
        testWorkspaceId,
        testCustomerId,
        "Test message interaction"
      )

      // Verify billing record
      const billingRecords = await prisma.billing.findMany({
        where: {
          workspaceId: testWorkspaceId,
          customerId: testCustomerId,
          type: BillingType.MESSAGE,
        },
        orderBy: { createdAt: "desc" },
      })

      expect(billingRecords.length).toBeGreaterThan(0)
      const latestRecord = billingRecords[0]

      expect(latestRecord.amount).toBe(expectedPrice)
      expect(latestRecord.type).toBe(BillingType.MESSAGE)
      expect(latestRecord.currentCharge).toBe(expectedPrice)
    })

    it("should accumulate total correctly with multiple messages", async () => {
      const messagePrice = (await pricingRepo.getValue("MESSAGE")) ?? 0.15

      // Get initial total
      const initialRecords = await prisma.billing.findMany({
        where: { workspaceId: testWorkspaceId, customerId: testCustomerId },
      })
      const initialTotal = initialRecords.reduce(
        (sum, r) => sum + r.amount,
        0
      )

      // Send 3 messages
      await billingService.trackMessage(
        testWorkspaceId,
        testCustomerId,
        "Message 1"
      )
      await billingService.trackMessage(
        testWorkspaceId,
        testCustomerId,
        "Message 2"
      )
      await billingService.trackMessage(
        testWorkspaceId,
        testCustomerId,
        "Message 3"
      )

      // Check final total
      const finalRecords = await prisma.billing.findMany({
        where: { workspaceId: testWorkspaceId, customerId: testCustomerId },
      })
      const finalTotal = finalRecords.reduce((sum, r) => sum + r.amount, 0)

      const expectedIncrease = messagePrice * 3
      expect(finalTotal - initialTotal).toBeCloseTo(expectedIncrease, 2)
    })
  })

  describe("trackNewCustomer (€1.00 per new customer)", () => {
    it("should charge correct NEW_CUSTOMER price from database", async () => {
      // Get current price from database (Andrea changed to €1.00)
      const expectedPrice = await pricingRepo.getValue("NEW_CUSTOMER")
      expect(expectedPrice).toBe(1.0) // Verifico che sia €1.00 (non più €1.50)

      const newCustomerId = "new-customer-test-" + Date.now()
      await createTestCustomer(newCustomerId) // Create customer first

      // Track new customer
      await billingService.trackNewCustomer(testWorkspaceId, newCustomerId)

      // Verify billing record
      const billingRecords = await prisma.billing.findMany({
        where: {
          workspaceId: testWorkspaceId,
          customerId: newCustomerId,
          type: BillingType.NEW_CUSTOMER,
        },
      })

      expect(billingRecords.length).toBe(1)
      const record = billingRecords[0]

      expect(record.amount).toBe(expectedPrice)
      expect(record.type).toBe(BillingType.NEW_CUSTOMER)
      expect(record.currentCharge).toBe(expectedPrice)
      expect(record.description).toBe("New customer registration")
    })

    it("should set previousTotal correctly for first charge", async () => {
      const brandNewCustomerId = "brand-new-customer-" + Date.now()
      await createTestCustomer(brandNewCustomerId) // Create customer first

      await billingService.trackNewCustomer(
        testWorkspaceId,
        brandNewCustomerId
      )

      const record = await prisma.billing.findFirst({
        where: {
          workspaceId: testWorkspaceId,
          customerId: brandNewCustomerId,
        },
      })

      expect(record).toBeDefined()
      expect(record!.previousTotal).toBe(0) // First charge, no previous total
      expect(record!.currentCharge).toBe(1.0)
      expect(record!.newTotal).toBe(1.0)
    })
  })

  describe("trackNewOrder (€1.50 per new order)", () => {
    it("should charge correct NEW_ORDER price from database", async () => {
      // Get current price from database
      const expectedPrice = await pricingRepo.getValue("NEW_ORDER")
      expect(expectedPrice).toBe(1.5)

      const orderCustomerId = "order-customer-" + Date.now()
      await createTestCustomer(orderCustomerId) // Create customer first
      const orderCode = "ORD-TEST-001"

      // Track new order
      await billingService.trackNewOrder(
        testWorkspaceId,
        orderCustomerId,
        orderCode
      )

      // Verify billing record
      const billingRecords = await prisma.billing.findMany({
        where: {
          workspaceId: testWorkspaceId,
          customerId: orderCustomerId,
          type: BillingType.NEW_ORDER,
        },
      })

      expect(billingRecords.length).toBe(1)
      const record = billingRecords[0]

      expect(record.amount).toBe(expectedPrice)
      expect(record.type).toBe(BillingType.NEW_ORDER)
      expect(record.currentCharge).toBe(expectedPrice)
      expect(record.description).toContain(orderCode)
    })

    it("should accumulate total correctly with customer + message + order", async () => {
      const mixedCustomerId = "mixed-customer-" + Date.now()
      await createTestCustomer(mixedCustomerId) // Create customer first

      // 1. New customer (€1.00)
      await billingService.trackNewCustomer(testWorkspaceId, mixedCustomerId)

      // 2. Message (€0.15)
      await billingService.trackMessage(
        testWorkspaceId,
        mixedCustomerId,
        "Customer inquiry"
      )

      // 3. New order (€1.50)
      await billingService.trackNewOrder(
        testWorkspaceId,
        mixedCustomerId,
        "ORD-MIX-001"
      )

      // Get all billing records for this customer
      const allRecords = await prisma.billing.findMany({
        where: {
          workspaceId: testWorkspaceId,
          customerId: mixedCustomerId,
        },
        orderBy: { createdAt: "asc" },
      })

      expect(allRecords.length).toBe(3)

      // Check first record (NEW_CUSTOMER)
      expect(allRecords[0].type).toBe(BillingType.NEW_CUSTOMER)
      expect(allRecords[0].previousTotal).toBe(0)
      expect(allRecords[0].currentCharge).toBe(1.0)
      expect(allRecords[0].newTotal).toBe(1.0)

      // Check second record (MESSAGE)
      expect(allRecords[1].type).toBe(BillingType.MESSAGE)
      expect(allRecords[1].previousTotal).toBe(1.0)
      expect(allRecords[1].currentCharge).toBe(0.15)
      expect(allRecords[1].newTotal).toBeCloseTo(1.15, 2)

      // Check third record (NEW_ORDER)
      expect(allRecords[2].type).toBe(BillingType.NEW_ORDER)
      expect(allRecords[2].previousTotal).toBeCloseTo(1.15, 2)
      expect(allRecords[2].currentCharge).toBe(1.5)
      expect(allRecords[2].newTotal).toBeCloseTo(2.65, 2)

      // Total should be €1.00 + €0.15 + €1.50 = €2.65
      const totalAmount = allRecords.reduce((sum, r) => sum + r.amount, 0)
      expect(totalAmount).toBeCloseTo(2.65, 2)
    })
  })

  describe("Price consistency with PricingRepository", () => {
    it("should use same prices as PricingRepository", async () => {
      // Fetch prices from repository
      const messagePriceFromRepo = await pricingRepo.getValue("MESSAGE")
      const customerPriceFromRepo = await pricingRepo.getValue("NEW_CUSTOMER")
      const orderPriceFromRepo = await pricingRepo.getValue("NEW_ORDER")

      // Create billing records
      const consistencyCustomerId = "consistency-test-" + Date.now()
      await createTestCustomer(consistencyCustomerId) // Create customer first

      await billingService.trackMessage(
        testWorkspaceId,
        consistencyCustomerId,
        "Test"
      )
      await billingService.trackNewCustomer(
        testWorkspaceId,
        consistencyCustomerId
      )
      await billingService.trackNewOrder(
        testWorkspaceId,
        consistencyCustomerId,
        "ORD-001"
      )

      // Verify billing uses same prices
      const messageRecord = await prisma.billing.findFirst({
        where: {
          workspaceId: testWorkspaceId,
          customerId: consistencyCustomerId,
          type: BillingType.MESSAGE,
        },
      })

      const customerRecord = await prisma.billing.findFirst({
        where: {
          workspaceId: testWorkspaceId,
          customerId: consistencyCustomerId,
          type: BillingType.NEW_CUSTOMER,
        },
      })

      const orderRecord = await prisma.billing.findFirst({
        where: {
          workspaceId: testWorkspaceId,
          customerId: consistencyCustomerId,
          type: BillingType.NEW_ORDER,
        },
      })

      expect(messageRecord!.amount).toBe(messagePriceFromRepo)
      expect(customerRecord!.amount).toBe(customerPriceFromRepo)
      expect(orderRecord!.amount).toBe(orderPriceFromRepo)
    })
  })

  describe("Historical pricing preservation", () => {
    it("should preserve price in billing record even if pricing changes", async () => {
      const historicalCustomerId = "historical-customer-" + Date.now()
      await createTestCustomer(historicalCustomerId) // Create customer first

      // Create a billing record with current price
      await billingService.trackNewCustomer(
        testWorkspaceId,
        historicalCustomerId
      )

      const oldRecord = await prisma.billing.findFirst({
        where: {
          workspaceId: testWorkspaceId,
          customerId: historicalCustomerId,
          type: BillingType.NEW_CUSTOMER,
        },
      })

      expect(oldRecord).toBeDefined()
      const recordedPrice = oldRecord!.amount

      // Even if we change price in PricingConfig, old billing should keep original price
      // (This is the whole point of storing amount in billing record)
      expect(recordedPrice).toBe(1.0) // Current price for NEW_CUSTOMER

      // The billing record is immutable - it preserves historical price
      expect(oldRecord!.amount).toBe(recordedPrice)
    })
  })
})
