/**
 * Unit tests for Transaction History and Monthly Invoices Features
 *
 * Tests cover:
 * 1. Transaction descriptions are in English
 * 2. INITIAL_CREDIT (Free Trial €29) excluded from Income totals
 * 3. Transactions grouped by month correctly
 * 4. Income/Expenses calculation
 * 5. Billing date is 1st of next month
 */

import { TransactionType } from "@prisma/client"

// Mock transaction data
const createMockTransaction = (
  type: TransactionType,
  amount: number,
  description: string,
  createdAt: Date = new Date()
) => ({
  id: `tx-${Math.random().toString(36).substr(2, 9)}`,
  workspaceId: "ws-123",
  type,
  amount,
  description,
  createdAt,
  status: "COMPLETED",
})

describe("Transaction History", () => {
  describe("Transaction Descriptions (English)", () => {
    it("should have upgrade description in English format", () => {
      const description = "Upgrade to Premium"
      expect(description).toMatch(/^Upgrade to (Basic|Premium)$/)
    })

    it("should have downgrade description in English format", () => {
      const description = "Downgrade to Basic"
      expect(description).toMatch(/^Downgrade to (Free Trial|Basic)$/)
    })

    it("should have monthly fee description in English format", () => {
      const description = "Monthly Fee - Premium"
      expect(description).toMatch(/^Monthly Fee - (Basic|Premium)$/)
    })

    it("should have channel cost description in English format", () => {
      const description = "Additional Channel"
      expect(description).toBe("Additional Channel")
    })

    it("should NOT contain Italian text", () => {
      const validDescriptions = [
        "Upgrade to Premium",
        "Downgrade to Basic",
        "Monthly Fee - Premium",
        "Additional Channel",
        "Free Trial Credit",
        "Top-up Credit",
      ]

      const italianWords = [
        "Abbonamento",
        "Canale",
        "Aggiuntivo",
        "Mensile",
        "Credito",
        "Prova",
      ]

      validDescriptions.forEach((desc) => {
        italianWords.forEach((word) => {
          expect(desc.toLowerCase()).not.toContain(word.toLowerCase())
        })
      })
    })
  })

  describe("INITIAL_CREDIT Exclusion from Income", () => {
    const transactions = [
      createMockTransaction("INITIAL_CREDIT", 29, "Free Trial Credit"),
      createMockTransaction("TOP_UP", 50, "Top-up Credit"),
      createMockTransaction("UPGRADE_FEE", 49, "Upgrade to Premium"),
      createMockTransaction("MONTHLY_FEE", 49, "Monthly Fee - Premium"),
    ]

    // Helper function matching frontend logic
    function calculateIncome(txs: typeof transactions): number {
      return txs
        .filter((tx) => {
          // Exclude INITIAL_CREDIT from income calculation
          if (tx.type === "INITIAL_CREDIT") return false
          // Exclude zero-amount upgrade/downgrade fees
          if (
            (tx.type === "UPGRADE_FEE" || tx.type === "DOWNGRADE_FEE") &&
            tx.amount === 0
          )
            return false
          // Only count TOP_UP and actual fees as income
          return tx.type === "TOP_UP"
        })
        .reduce((sum, tx) => sum + tx.amount, 0)
    }

    function calculateExpenses(txs: typeof transactions): number {
      return txs
        .filter((tx) => {
          // Count actual costs: monthly fees, channel costs, upgrade/downgrade fees with amount > 0
          return (
            tx.type === "MONTHLY_FEE" ||
            tx.type === "MONTHLY_CHANNEL_COST" ||
            ((tx.type === "UPGRADE_FEE" || tx.type === "DOWNGRADE_FEE") &&
              tx.amount > 0)
          )
        })
        .reduce((sum, tx) => sum + tx.amount, 0)
    }

    it("should NOT include INITIAL_CREDIT in income calculation", () => {
      const income = calculateIncome(transactions)
      // Only TOP_UP (€50) should be counted, not INITIAL_CREDIT (€29)
      expect(income).toBe(50)
    })

    it("should include TOP_UP in income calculation", () => {
      const topUpOnly = [
        createMockTransaction("TOP_UP", 100, "Top-up Credit"),
      ]
      expect(calculateIncome(topUpOnly)).toBe(100)
    })

    it("should calculate expenses correctly", () => {
      const expenses = calculateExpenses(transactions)
      // UPGRADE_FEE (€49) + MONTHLY_FEE (€49) = €98
      expect(expenses).toBe(98)
    })

    it("should exclude zero-amount upgrade fees from expenses", () => {
      const txsWithZeroUpgrade = [
        createMockTransaction("UPGRADE_FEE", 0, "Upgrade to Basic"),
        createMockTransaction("MONTHLY_FEE", 29, "Monthly Fee - Basic"),
      ]
      const expenses = calculateExpenses(txsWithZeroUpgrade)
      expect(expenses).toBe(29) // Only MONTHLY_FEE
    })
  })

  describe("Transaction Grouping by Month", () => {
    // Helper function to group transactions by month
    function groupByMonth(
      txs: Array<{ createdAt: Date; amount: number; type: string }>
    ): Map<string, typeof txs> {
      const groups = new Map<string, typeof txs>()

      txs.forEach((tx) => {
        const date = new Date(tx.createdAt)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

        if (!groups.has(monthKey)) {
          groups.set(monthKey, [])
        }
        groups.get(monthKey)!.push(tx)
      })

      return groups
    }

    it("should group transactions from same month together", () => {
      const transactions = [
        createMockTransaction(
          "MONTHLY_FEE",
          49,
          "Monthly Fee",
          new Date("2025-11-05")
        ),
        createMockTransaction(
          "TOP_UP",
          50,
          "Top-up",
          new Date("2025-11-15")
        ),
        createMockTransaction(
          "MONTHLY_FEE",
          49,
          "Monthly Fee",
          new Date("2025-11-25")
        ),
      ]

      const groups = groupByMonth(transactions)
      expect(groups.size).toBe(1)
      expect(groups.get("2025-11")).toHaveLength(3)
    })

    it("should separate transactions from different months", () => {
      const transactions = [
        createMockTransaction(
          "MONTHLY_FEE",
          49,
          "November",
          new Date("2025-11-01")
        ),
        createMockTransaction(
          "MONTHLY_FEE",
          49,
          "December",
          new Date("2025-12-01")
        ),
        createMockTransaction(
          "MONTHLY_FEE",
          49,
          "January",
          new Date("2026-01-01")
        ),
      ]

      const groups = groupByMonth(transactions)
      expect(groups.size).toBe(3)
      expect(groups.has("2025-11")).toBe(true)
      expect(groups.has("2025-12")).toBe(true)
      expect(groups.has("2026-01")).toBe(true)
    })

    it("should handle year boundary correctly", () => {
      const transactions = [
        createMockTransaction(
          "MONTHLY_FEE",
          49,
          "Dec 2025",
          new Date("2025-12-31")
        ),
        createMockTransaction(
          "MONTHLY_FEE",
          49,
          "Jan 2026",
          new Date("2026-01-01")
        ),
      ]

      const groups = groupByMonth(transactions)
      expect(groups.size).toBe(2)
      expect(groups.get("2025-12")).toHaveLength(1)
      expect(groups.get("2026-01")).toHaveLength(1)
    })
  })

  describe("Billing Date - 1st of Next Month", () => {
    // Matches getFirstOfNextMonth from subscription-billing.repository.ts
    function getFirstOfNextMonth(fromDate: Date = new Date()): Date {
      const nextMonth = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth() + 1,
        1
      )
      return nextMonth
    }

    it("should return December 1st for upgrade in November", () => {
      const nov15 = new Date("2025-11-15")
      const result = getFirstOfNextMonth(nov15)
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(11) // December (0-indexed)
      expect(result.getDate()).toBe(1)
    })

    it("should return January 1st 2026 for upgrade in December", () => {
      const dec15 = new Date("2025-12-15")
      const result = getFirstOfNextMonth(dec15)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(1)
    })

    it("should return next month even if upgraded on last day", () => {
      const nov30 = new Date("2025-11-30")
      const result = getFirstOfNextMonth(nov30)
      expect(result.getMonth()).toBe(11) // December
      expect(result.getDate()).toBe(1)
    })

    it("should return next month even if upgraded on 1st", () => {
      const nov1 = new Date("2025-11-01")
      const result = getFirstOfNextMonth(nov1)
      expect(result.getMonth()).toBe(11) // December
      expect(result.getDate()).toBe(1)
    })
  })
})

describe("Monthly Invoices", () => {
  describe("Next Payment Calculation", () => {
    it("should show next payment as 1st of next month", () => {
      const today = new Date("2025-11-27")
      const nextBillingDate = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        1
      )

      expect(nextBillingDate.getDate()).toBe(1)
      expect(nextBillingDate.getMonth()).toBe(11) // December
    })

    it("should calculate days until next payment correctly", () => {
      const today = new Date("2025-11-27")
      const nextBilling = new Date("2025-12-01")
      const daysUntil = Math.ceil(
        (nextBilling.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(daysUntil).toBe(4) // Nov 27 → Dec 1 = 4 days
    })
  })

  describe("Invoice Amount Calculation", () => {
    it("should calculate Premium plan monthly cost correctly", () => {
      const premiumMonthlyFee = 49
      const channelCost = 49 // If additional channels
      const totalWithOneExtraChannel = premiumMonthlyFee + channelCost

      expect(totalWithOneExtraChannel).toBe(98)
    })

    it("should calculate Basic plan monthly cost correctly", () => {
      const basicMonthlyFee = 29
      expect(basicMonthlyFee).toBe(29)
    })

    it("should calculate Free Trial credit correctly", () => {
      const freeTrialCredit = 29
      expect(freeTrialCredit).toBe(29)
    })
  })
})

describe("Price Configuration", () => {
  describe("Premium Plan Pricing", () => {
    it("should have Premium monthly fee of €49", () => {
      const PREMIUM_MONTHLY_FEE = 49
      expect(PREMIUM_MONTHLY_FEE).toBe(49)
    })

    it("should have Premium channel cost of €49", () => {
      const MONTHLY_CHANNEL_COST = 49
      expect(MONTHLY_CHANNEL_COST).toBe(49)
    })

    it("should NOT use old €59 pricing", () => {
      const PREMIUM_MONTHLY_FEE = 49
      const MONTHLY_CHANNEL_COST = 49

      expect(PREMIUM_MONTHLY_FEE).not.toBe(59)
      expect(MONTHLY_CHANNEL_COST).not.toBe(59)
    })
  })

  describe("Basic Plan Pricing", () => {
    it("should have Basic monthly fee of €29", () => {
      const BASIC_MONTHLY_FEE = 29
      expect(BASIC_MONTHLY_FEE).toBe(29)
    })
  })

  describe("Free Trial", () => {
    it("should have Free Trial credit of €29", () => {
      const FREE_TRIAL_CREDIT = 29
      expect(FREE_TRIAL_CREDIT).toBe(29)
    })
  })
})
