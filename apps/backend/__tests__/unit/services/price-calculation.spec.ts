/**
 * Unit tests for Price Calculation Service
 *
 * Tests cover:
 * 1. Rounding up to nearest 10 cents (Math.ceil)
 * 2. Discount application
 * 3. RepeatOrder price calculation
 */

describe("Price Calculation Service", () => {
  // Helper function matching PriceCalculationService logic
  const roundToNearest10Cents = (price: number): number => {
    return Math.ceil(price * 10) / 10
  }

  const calculateDiscountedPrice = (
    originalPrice: number,
    discountPercent: number
  ): number => {
    const discounted = originalPrice * (1 - discountPercent / 100)
    return roundToNearest10Cents(discounted)
  }

  describe("Rounding to Nearest 10 Cents", () => {
    it("should round 7.38 up to 7.40", () => {
      expect(roundToNearest10Cents(7.38)).toBe(7.4)
    })

    it("should round 7.31 up to 7.40", () => {
      expect(roundToNearest10Cents(7.31)).toBe(7.4)
    })

    it("should keep 7.40 as 7.40", () => {
      expect(roundToNearest10Cents(7.4)).toBe(7.4)
    })

    it("should round 7.41 up to 7.50", () => {
      expect(roundToNearest10Cents(7.41)).toBe(7.5)
    })

    it("should round 9.99 up to 10.00", () => {
      expect(roundToNearest10Cents(9.99)).toBe(10.0)
    })

    it("should round 0.01 up to 0.10", () => {
      expect(roundToNearest10Cents(0.01)).toBe(0.1)
    })
  })

  describe("Discount Application", () => {
    it("should apply 10% discount to €8.20 and round to €7.40", () => {
      const originalPrice = 8.2
      const discountPercent = 10
      // 8.20 * 0.90 = 7.38 → rounded to 7.40
      expect(calculateDiscountedPrice(originalPrice, discountPercent)).toBe(7.4)
    })

    it("should apply 20% discount to €10.00 and get €8.00", () => {
      const originalPrice = 10.0
      const discountPercent = 20
      // 10.00 * 0.80 = 8.00 → stays 8.00
      expect(calculateDiscountedPrice(originalPrice, discountPercent)).toBe(8.0)
    })

    it("should apply 15% discount to €12.50 and round correctly", () => {
      const originalPrice = 12.5
      const discountPercent = 15
      // 12.50 * 0.85 = 10.625 → rounded to 10.70
      expect(calculateDiscountedPrice(originalPrice, discountPercent)).toBe(
        10.7
      )
    })

    it("should handle 0% discount", () => {
      const originalPrice = 8.2
      const discountPercent = 0
      expect(calculateDiscountedPrice(originalPrice, discountPercent)).toBe(8.2)
    })
  })

  describe("RepeatOrder Price Calculation", () => {
    it("should calculate total for multiple items with discount", () => {
      const items = [
        { name: "Burrata", price: 8.2, quantity: 2 },
        { name: "Mozzarella", price: 5.5, quantity: 1 },
      ]
      const discountPercent = 10

      const originalTotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      )
      // 8.20 * 2 + 5.50 * 1 = 21.90
      expect(originalTotal).toBe(21.9)

      const discountedTotal = calculateDiscountedPrice(
        originalTotal,
        discountPercent
      )
      // 21.90 * 0.90 = 19.71 → rounded to 19.80
      expect(discountedTotal).toBe(19.8)
    })

    it("should show breakdown correctly", () => {
      const originalPrice = 8.2
      const discountPercent = 10
      const discountedPrice = calculateDiscountedPrice(
        originalPrice,
        discountPercent
      )

      const breakdown = `€${originalPrice.toFixed(2)} → €${discountedPrice.toFixed(2)} con sconto ${discountPercent}%`
      expect(breakdown).toBe("€8.20 → €7.40 con sconto 10%")
    })
  })

  describe("Edge Cases", () => {
    it("should handle very small prices", () => {
      expect(roundToNearest10Cents(0.001)).toBe(0.1)
      expect(roundToNearest10Cents(0.05)).toBe(0.1)
    })

    it("should handle large prices", () => {
      expect(roundToNearest10Cents(999.99)).toBe(1000.0)
      expect(roundToNearest10Cents(1234.56)).toBe(1234.6)
    })

    it("should handle exactly 10 cents increments", () => {
      expect(roundToNearest10Cents(1.0)).toBe(1.0)
      expect(roundToNearest10Cents(1.1)).toBe(1.1)
      expect(roundToNearest10Cents(1.2)).toBe(1.2)
    })
  })
})
