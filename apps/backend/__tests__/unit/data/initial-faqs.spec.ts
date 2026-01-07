/**
 * Unit tests for initialFAQs
 * Verifies that the correct 4 FAQs are created for new workspaces
 */

import { initialFAQs } from "../../../prisma/data/initialFAQs"

describe("initialFAQs", () => {
  const testWorkspaceId = "test-workspace-123"

  describe("structure", () => {
    it("should return exactly 12 FAQs", () => {
      const faqs = initialFAQs(testWorkspaceId)
      expect(faqs).toHaveLength(12)
    })

    it("should include workspaceId in all FAQs", () => {
      const faqs = initialFAQs(testWorkspaceId)
      faqs.forEach((faq) => {
        expect(faq.workspaceId).toBe(testWorkspaceId)
      })
    })

    it("should have all required fields in each FAQ", () => {
      const faqs = initialFAQs(testWorkspaceId)
      faqs.forEach((faq) => {
        expect(faq).toHaveProperty("question")
        expect(faq).toHaveProperty("answer")
        expect(faq).toHaveProperty("keywords")
        expect(faq).toHaveProperty("category")
        expect(faq).toHaveProperty("order")
        expect(faq).toHaveProperty("isActive")
        expect(faq).toHaveProperty("workspaceId")
      })
    })

    it("should have all FAQs active by default", () => {
      const faqs = initialFAQs(testWorkspaceId)
      faqs.forEach((faq) => {
        expect(faq.isActive).toBe(true)
      })
    })

    it("should have sequential order values starting from 0", () => {
      const faqs = initialFAQs(testWorkspaceId)
      faqs.forEach((faq, index) => {
        expect(faq.order).toBe(index)
      })
    })
  })

  describe("required FAQs content", () => {
    it('should include "How is my privacy protected?" FAQ', () => {
      const faqs = initialFAQs(testWorkspaceId)
      const privacy = faqs.find((f) => f.question === "How is my privacy protected?")
      
      expect(privacy).toBeDefined()
      expect(privacy?.category).toBe("Account")
      expect(privacy?.answer).toContain("GDPR")
      expect(privacy?.keywords).toContain("privacy")
    })

    it('should include "What are the delivery times?" FAQ', () => {
      const faqs = initialFAQs(testWorkspaceId)
      const delivery = faqs.find((f) => f.question === "What are the delivery times?")
      
      expect(delivery).toBeDefined()
      expect(delivery?.category).toBe("Shipping")
      expect(delivery?.keywords).toContain("delivery time")
    })

    it('should include "How can I repeat a previous order?" FAQ', () => {
      const faqs = initialFAQs(testWorkspaceId)
      const repeat = faqs.find((f) => f.question === "How can I repeat a previous order?")
      
      expect(repeat).toBeDefined()
      expect(repeat?.category).toBe("Orders")
      expect(repeat?.keywords).toContain("repeat order")
    })

    it('should include "What payment methods do you accept?" FAQ', () => {
      const faqs = initialFAQs(testWorkspaceId)
      const payment = faqs.find((f) => f.question === "What payment methods do you accept?")
      
      expect(payment).toBeDefined()
      expect(payment?.category).toBe("Payments")
      expect(payment?.keywords).toContain("payment")
    })
  })

  describe("categories", () => {
    it("should have FAQs from different categories", () => {
      const faqs = initialFAQs(testWorkspaceId)
      const categories = [...new Set(faqs.map((f) => f.category))]

      expect(categories).toEqual(
        expect.arrayContaining(["Account", "Shipping", "Orders", "Payments"])
      )
      expect(categories.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe("keywords", () => {
    it("should have non-empty keywords array for all FAQs", () => {
      const faqs = initialFAQs(testWorkspaceId)
      faqs.forEach((faq) => {
        expect(Array.isArray(faq.keywords)).toBe(true)
        expect(faq.keywords.length).toBeGreaterThan(0)
      })
    })
  })
})
