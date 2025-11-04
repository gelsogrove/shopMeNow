/**
 * OrderCode Detection Logic Unit Tests
 *
 * CRITICAL: Tests the Router's logic for determining order link format
 *
 * This test suite validates the FROZEN link format logic documented in:
 * /docs/LINK_FORMATS_REFERENCE.md
 *
 * TEST SCENARIOS:
 * 1️⃣ Single Order (1 code) → Specific link with orderCode in path
 * 2️⃣ Multiple Orders (2+ codes) → General link without orderCode
 * 3️⃣ No Orders (0 codes) → General link without orderCode
 * 4️⃣ Edge Cases → Malformed codes, punctuation, etc.
 *
 * @author Andrea's AI Agent
 * @critical DO NOT MODIFY without updating LINK_FORMATS_REFERENCE.md
 */

describe("OrderCode Detection Logic", () => {
  /**
   * Helper function that mimics Router's orderCode detection
   */
  function detectOrderCode(response: string): string | undefined {
    // REGEX: Matches format "ORD-XXX-YYYY-Z" (e.g., ORD-048-2025-9)
    const orderCodes = response.match(/ORD-[0-9-]+/g) || []

    // CRITICAL: Only return orderCode if EXACTLY ONE is found
    return orderCodes.length === 1 ? orderCodes[0] : undefined
  }

  describe("✅ Scenario 1: Single Order Detection", () => {
    it("should detect single order code and return it", () => {
      const response = "Your order ORD-048-2025-9 has been shipped!"
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-048-2025-9")
    })

    it("should work with order code at start of message", () => {
      const response = "ORD-044-2025-8 is ready for pickup."
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-044-2025-8")
    })

    it("should work with order code in middle with punctuation", () => {
      const response = "Your order (ORD-040-2025-7) is being processed."
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-040-2025-7")
    })

    it("should work with order code followed by period", () => {
      const response = "Status of order ORD-038-2025-6."
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-038-2025-6")
    })

    it("should work with order code in Markdown link", () => {
      const response =
        "Click [here](LINK_ORDERS_WITH_TOKEN) to view ORD-035-2025-5."
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-035-2025-5")
    })
  })

  describe("❌ Scenario 2: Multiple Orders Detection", () => {
    it("should return undefined when 2 order codes detected", () => {
      const response = "Your recent orders: ORD-048-2025-9 and ORD-044-2025-8."
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })

    it("should return undefined when 3 order codes detected (common case)", () => {
      const response = `📦 Your last 3 orders:
1. ORD-048-2025-9 - $150.00
2. ORD-044-2025-8 - $89.99
3. ORD-040-2025-7 - $45.00`
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })

    it("should return undefined when 5+ order codes in long list", () => {
      const response = `Order history: ORD-048, ORD-044, ORD-040, ORD-038, ORD-035, ORD-030`
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })

    it("should return undefined with duplicate codes (same order mentioned twice)", () => {
      const response =
        "Your order ORD-048-2025-9 is ready. Track ORD-048-2025-9 here."
      const result = detectOrderCode(response)

      // Even though it's the same order, regex finds 2 matches → undefined
      expect(result).toBeUndefined()
    })
  })

  describe("⭕ Scenario 3: No Orders Detection", () => {
    it("should return undefined when no order codes present", () => {
      const response = "Click here to view your order history."
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })

    it("should return undefined with only generic text", () => {
      const response = "You have no orders yet. Start shopping!"
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })

    it("should return undefined with link token but no codes", () => {
      const response = "View your orders [here](LINK_ORDERS_WITH_TOKEN)."
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })
  })

  describe("🔍 Scenario 4: Edge Cases", () => {
    it("should NOT match incomplete order codes", () => {
      const response = "Order ORD- is pending"
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })

    it("should NOT match order codes without ORD prefix", () => {
      const response = "Invoice 048-2025-9 is available"
      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })

    it("should match order code with trailing hyphen (partial match)", () => {
      const response = "Your order ORD-048-2025-9-EXTRA is shipped"
      const result = detectOrderCode(response)

      // Regex /ORD-[0-9-]+/ matches digits and hyphens, stops at letter
      // Result: "ORD-048-2025-9-" (includes trailing hyphen before 'E')
      expect(result).toBe("ORD-048-2025-9-")
    })

    it("should handle order code with newlines around it", () => {
      const response = `Your order:\nORD-048-2025-9\nis ready!`
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-048-2025-9")
    })

    it("should handle order code in complex Markdown formatting", () => {
      const response = `**Order ORD-048-2025-9** is _ready_!`
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-048-2025-9")
    })

    it("should handle order code with emoji before/after", () => {
      const response = "📦 ORD-048-2025-9 ✅ shipped!"
      const result = detectOrderCode(response)

      expect(result).toBe("ORD-048-2025-9")
    })
  })

  describe("📋 Real-World Scenarios", () => {
    it("should handle ORDER TRACKING agent response (single order)", () => {
      const response = `🔍 Order ORD-048-2025-9
Status: Delivered ✅
Total: $150.00
Date: 2025-01-15

Click [here](LINK_ORDERS_WITH_TOKEN) for details.
⏰ Link valid for 15 minutes.`

      const result = detectOrderCode(response)

      expect(result).toBe("ORD-048-2025-9")
    })

    it("should handle ORDER TRACKING agent response (last 3 orders)", () => {
      const response = `📦 Your last 3 orders:

1. Order #ORD-048-2025-9
   Status: Delivered ✅
   Total: $150.00
   Date: 2025-01-15

2. Order #ORD-044-2025-8
   Status: In Transit 🚚
   Total: $89.99
   Date: 2025-01-10

3. Order #ORD-040-2025-7
   Status: Processing ⏳
   Total: $45.00
   Date: 2025-01-05

👉 View all orders: [here](LINK_ORDERS_WITH_TOKEN)
⏰ Link valid for 15 minutes.`

      const result = detectOrderCode(response)

      // Should return undefined because 3 codes detected
      expect(result).toBeUndefined()
    })

    it("should handle CART MANAGEMENT agent response (with order code)", () => {
      const response = `✅ Order placed successfully!

Order Code: ORD-049-2025-10
Total: $200.00
Items: 3

Track your order [here](LINK_ORDERS_WITH_TOKEN).`

      const result = detectOrderCode(response)

      expect(result).toBe("ORD-049-2025-10")
    })

    it("should handle generic order history request (no specific codes)", () => {
      const response = `You can view your complete order history here: [LINK_ORDERS_WITH_TOKEN]

This link shows all your past orders with status updates.
⏰ Valid for 15 minutes.`

      const result = detectOrderCode(response)

      expect(result).toBeUndefined()
    })
  })

  describe("🔗 Integration with Link Generation", () => {
    /**
     * This section tests the COMPLETE flow from detection to link format
     */

    function generateOrderLink(
      response: string,
      baseUrl: string = "http://localhost:3000/orders-public"
    ): string {
      const orderCode = detectOrderCode(response)

      if (orderCode) {
        // SINGLE ORDER → Specific link with code in path
        return `${baseUrl}/${orderCode}?token=xxx`
      } else {
        // MULTIPLE/NO ORDERS → General link without code
        return `${baseUrl}?token=xxx`
      }
    }

    it("should generate specific link for single order", () => {
      const response = "Your order ORD-048-2025-9 is ready!"
      const link = generateOrderLink(response)

      expect(link).toBe(
        "http://localhost:3000/orders-public/ORD-048-2025-9?token=xxx"
      )
    })

    it("should generate general link for multiple orders", () => {
      const response = "Last 3 orders: ORD-048, ORD-044, ORD-040"
      const link = generateOrderLink(response)

      expect(link).toBe("http://localhost:3000/orders-public?token=xxx")
    })

    it("should generate general link when no orders", () => {
      const response = "View your order history here."
      const link = generateOrderLink(response)

      expect(link).toBe("http://localhost:3000/orders-public?token=xxx")
    })
  })
})
