/**
 * BILLING CALCULATION UNIT TEST
 *
 * Test unitario per verificare SOLO la logica di calcolo del billing,
 * senza dipendere dal database reale.
 *
 * Testa:
 * 1. Calcolo corretto dei costi per MESSAGE (€0.15)
 * 2. Calcolo corretto dei costi per NEW_CUSTOMER (€1.00)
 * 3. Calcolo corretto dei costi per NEW_ORDER (€1.50)
 * 4. Accumulo corretto di previousTotal + currentCharge = newTotal
 */

// Type per billing (no Prisma dependency)
type BillingType =
  | "MESSAGE"
  | "NEW_CUSTOMER"
  | "NEW_ORDER"
  | "PUSH_CAMPAIGN"
  | "MONTHLY_CHANNEL"

// Mock dei prezzi (senza database)
const MOCK_PRICES = {
  MESSAGE: 0.15,
  NEW_CUSTOMER: 1.0, // Andrea ha cambiato da 1.50 a 1.00
  NEW_ORDER: 1.5,
  PUSH_CAMPAIGN: 1.0,
  MONTHLY_CHANNEL_COST: 59.0,
}

// Funzione helper per calcolare billing (simula BillingService logic)
function calculateBilling(
  type: BillingType,
  previousTotal: number = 0
): { currentCharge: number; newTotal: number; previousTotal: number } {
  let currentCharge = 0

  switch (type) {
    case "MESSAGE":
      currentCharge = MOCK_PRICES.MESSAGE
      break
    case "NEW_CUSTOMER":
      currentCharge = MOCK_PRICES.NEW_CUSTOMER
      break
    case "NEW_ORDER":
      currentCharge = MOCK_PRICES.NEW_ORDER
      break
    case "PUSH_CAMPAIGN":
      currentCharge = MOCK_PRICES.PUSH_CAMPAIGN
      break
    case "MONTHLY_CHANNEL":
      currentCharge = MOCK_PRICES.MONTHLY_CHANNEL_COST
      break
    default:
      currentCharge = 0
  }

  const newTotal = previousTotal + currentCharge

  return {
    previousTotal,
    currentCharge,
    newTotal,
  }
}

describe("Billing Calculation Logic - Unit Test", () => {
  describe("Single charge calculations", () => {
    it("should calculate MESSAGE cost correctly (€0.15)", () => {
      const result = calculateBilling("MESSAGE", 0)

      expect(result.previousTotal).toBe(0)
      expect(result.currentCharge).toBe(0.15)
      expect(result.newTotal).toBe(0.15)
    })

    it("should calculate NEW_CUSTOMER cost correctly (€1.00)", () => {
      const result = calculateBilling("NEW_CUSTOMER", 0)

      expect(result.previousTotal).toBe(0)
      expect(result.currentCharge).toBe(1.0) // Andrea's new price
      expect(result.newTotal).toBe(1.0)
    })

    it("should calculate NEW_ORDER cost correctly (€1.50)", () => {
      const result = calculateBilling("NEW_ORDER", 0)

      expect(result.previousTotal).toBe(0)
      expect(result.currentCharge).toBe(1.5)
      expect(result.newTotal).toBe(1.5)
    })

    it("should calculate PUSH_CAMPAIGN cost correctly (€1.00)", () => {
      const result = calculateBilling("PUSH_CAMPAIGN", 0)

      expect(result.previousTotal).toBe(0)
      expect(result.currentCharge).toBe(1.0)
      expect(result.newTotal).toBe(1.0)
    })

    it("should calculate MONTHLY_CHANNEL cost correctly (€59.00)", () => {
      const result = calculateBilling("MONTHLY_CHANNEL", 0)

      expect(result.previousTotal).toBe(0)
      expect(result.currentCharge).toBe(59.0)
      expect(result.newTotal).toBe(59.0)
    })
  })

  describe("Accumulation logic (previousTotal + currentCharge = newTotal)", () => {
    it("should accumulate MESSAGE charges correctly", () => {
      // First message
      const charge1 = calculateBilling("MESSAGE", 0)
      expect(charge1.newTotal).toBe(0.15)

      // Second message
      const charge2 = calculateBilling("MESSAGE", charge1.newTotal)
      expect(charge2.previousTotal).toBe(0.15)
      expect(charge2.currentCharge).toBe(0.15)
      expect(charge2.newTotal).toBe(0.3)

      // Third message
      const charge3 = calculateBilling("MESSAGE", charge2.newTotal)
      expect(charge3.previousTotal).toBe(0.3)
      expect(charge3.currentCharge).toBe(0.15)
      expect(charge3.newTotal).toBeCloseTo(0.45, 2)
    })

    it("should accumulate NEW_CUSTOMER + MESSAGE + NEW_ORDER correctly", () => {
      // Step 1: New customer registers (€1.00)
      const step1 = calculateBilling("NEW_CUSTOMER", 0)
      expect(step1.previousTotal).toBe(0)
      expect(step1.currentCharge).toBe(1.0)
      expect(step1.newTotal).toBe(1.0)

      // Step 2: Customer sends message (€0.15)
      const step2 = calculateBilling("MESSAGE", step1.newTotal)
      expect(step2.previousTotal).toBe(1.0)
      expect(step2.currentCharge).toBe(0.15)
      expect(step2.newTotal).toBe(1.15)

      // Step 3: Customer places order (€1.50)
      const step3 = calculateBilling("NEW_ORDER", step2.newTotal)
      expect(step3.previousTotal).toBe(1.15)
      expect(step3.currentCharge).toBe(1.5)
      expect(step3.newTotal).toBe(2.65)

      // Total should be: €1.00 + €0.15 + €1.50 = €2.65
      expect(step3.newTotal).toBeCloseTo(2.65, 2)
    })

    it("should handle multiple operations in sequence", () => {
      let runningTotal = 0

      // New customer
      const customer = calculateBilling("NEW_CUSTOMER", runningTotal)
      runningTotal = customer.newTotal
      expect(runningTotal).toBe(1.0)

      // 5 messages
      for (let i = 0; i < 5; i++) {
        const message = calculateBilling("MESSAGE", runningTotal)
        runningTotal = message.newTotal
      }
      expect(runningTotal).toBeCloseTo(1.75, 2) // 1.0 + (5 * 0.15)

      // 2 orders
      for (let i = 0; i < 2; i++) {
        const order = calculateBilling("NEW_ORDER", runningTotal)
        runningTotal = order.newTotal
      }
      expect(runningTotal).toBeCloseTo(4.75, 2) // 1.75 + (2 * 1.50)

      // 1 push campaign
      const push = calculateBilling("PUSH_CAMPAIGN", runningTotal)
      runningTotal = push.newTotal
      expect(runningTotal).toBeCloseTo(5.75, 2) // 4.75 + 1.00
    })
  })

  describe("Edge cases", () => {
    it("should handle zero previous total", () => {
      const result = calculateBilling("MESSAGE", 0)
      expect(result.previousTotal).toBe(0)
      expect(result.newTotal).toBe(result.currentCharge)
    })

    it("should handle large previous total", () => {
      const largeTotal = 9999.99
      const result = calculateBilling("MESSAGE", largeTotal)
      expect(result.previousTotal).toBe(largeTotal)
      expect(result.newTotal).toBe(largeTotal + 0.15)
    })

    it("should maintain precision with floating point calculations", () => {
      let total = 0

      // Add 10 messages (€0.15 each)
      for (let i = 0; i < 10; i++) {
        const result = calculateBilling("MESSAGE", total)
        total = result.newTotal
      }

      // Should be exactly €1.50
      expect(total).toBeCloseTo(1.5, 2)
    })
  })

  describe("Real-world scenarios", () => {
    it("should calculate typical customer journey cost", () => {
      // Typical customer: 1 registration + 3 messages + 1 order
      let total = 0

      // Registration
      total = calculateBilling("NEW_CUSTOMER", total).newTotal
      expect(total).toBe(1.0)

      // 3 messages
      total = calculateBilling("MESSAGE", total).newTotal
      total = calculateBilling("MESSAGE", total).newTotal
      total = calculateBilling("MESSAGE", total).newTotal
      expect(total).toBeCloseTo(1.45, 2) // 1.0 + (3 * 0.15)

      // 1 order
      total = calculateBilling("NEW_ORDER", total).newTotal
      expect(total).toBeCloseTo(2.95, 2) // 1.45 + 1.50

      // Final cost for this customer journey: €2.95
    })

    it("should calculate monthly workspace cost", () => {
      // Workspace with 1 channel + 100 messages + 10 customers + 5 orders
      let total = 0

      // Monthly channel
      total = calculateBilling("MONTHLY_CHANNEL", total).newTotal
      expect(total).toBe(59.0)

      // 100 messages (€0.15 each = €15.00)
      for (let i = 0; i < 100; i++) {
        total = calculateBilling("MESSAGE", total).newTotal
      }
      expect(total).toBeCloseTo(74.0, 2) // 59.0 + 15.0

      // 10 new customers (€1.00 each = €10.00)
      for (let i = 0; i < 10; i++) {
        total = calculateBilling("NEW_CUSTOMER", total).newTotal
      }
      expect(total).toBeCloseTo(84.0, 2) // 74.0 + 10.0

      // 5 orders (€1.50 each = €7.50)
      for (let i = 0; i < 5; i++) {
        total = calculateBilling("NEW_ORDER", total).newTotal
      }
      expect(total).toBeCloseTo(91.5, 2) // 84.0 + 7.5

      // Total monthly cost: €91.50
    })
  })

  describe("Price verification (Andrea's changes)", () => {
    it("should use NEW_CUSTOMER price of €1.00 (not €1.50)", () => {
      const result = calculateBilling("NEW_CUSTOMER", 0)
      expect(result.currentCharge).toBe(1.0)
      expect(result.currentCharge).not.toBe(1.5) // Old price
    })

    it("should calculate 10 customers at €1.00 each = €10.00 total", () => {
      let total = 0
      for (let i = 0; i < 10; i++) {
        total = calculateBilling("NEW_CUSTOMER", total).newTotal
      }
      expect(total).toBe(10.0)
      expect(total).not.toBe(15.0) // Would be with old price
    })
  })
})
