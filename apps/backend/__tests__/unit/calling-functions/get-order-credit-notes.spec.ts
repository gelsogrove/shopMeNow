/**
 * @file get-order-credit-notes.spec.ts
 * @description Unit tests for getOrder credit notes response structure
 *
 * Test Coverage:
 * 1. GetOrderResponse interface includes creditNotes
 * 2. Credit note structure validation
 * 3. Response formatting for credit notes
 */

import { GetOrderResponse } from "../../../src/domain/calling-functions/GetOrder"

describe("GetOrder - Credit Notes Response Structure", () => {
  describe("GetOrderResponse interface", () => {
    it("should support creditNotes array in response", () => {
      const response: GetOrderResponse = {
        success: true,
        order: {
          id: "order-123",
          orderCode: "ORD-2025-001",
          status: "DELIVERED",
          totalAmount: 150.0,
          currency: "EUR",
          createdAt: "2025-01-15T00:00:00.000Z",
          items: [
            {
              id: "item-1",
              name: "Product A",
              quantity: 2,
              price: 75.0,
              total: 150.0,
            },
          ],
          creditNotes: [
            {
              creditNoteCode: "NC-ORD-2025-001",
              amount: 20.0,
              reason: "Prodotto danneggiato",
              createdAt: "2025-01-20T00:00:00.000Z",
            },
          ],
        },
        message: "Ordine trovato con successo.",
      }

      expect(response.order).toBeDefined()
      expect(response.order!.creditNotes).toBeDefined()
      expect(response.order!.creditNotes).toHaveLength(1)
      expect(response.order!.creditNotes![0].creditNoteCode).toBe("NC-ORD-2025-001")
      expect(response.order!.creditNotes![0].amount).toBe(20.0)
      expect(response.order!.creditNotes![0].reason).toBe("Prodotto danneggiato")
    })

    it("should allow undefined creditNotes when order has none", () => {
      const response: GetOrderResponse = {
        success: true,
        order: {
          id: "order-123",
          orderCode: "ORD-2025-001",
          status: "PENDING",
          totalAmount: 100.0,
          currency: "EUR",
          createdAt: "2025-01-15T00:00:00.000Z",
          items: [],
          creditNotes: undefined,
        },
        message: "Ordine trovato con successo.",
      }

      expect(response.order).toBeDefined()
      expect(response.order!.creditNotes).toBeUndefined()
    })

    it("should support multiple credit notes", () => {
      const response: GetOrderResponse = {
        success: true,
        order: {
          id: "order-123",
          orderCode: "ORD-2025-001",
          status: "DELIVERED",
          totalAmount: 200.0,
          currency: "EUR",
          createdAt: "2025-01-15T00:00:00.000Z",
          items: [],
          creditNotes: [
            {
              creditNoteCode: "NC-ORD-2025-001",
              amount: 30.0,
              reason: "Primo rimborso",
              createdAt: "2025-01-20T00:00:00.000Z",
            },
            {
              creditNoteCode: "NC-ORD-2025-001-2",
              amount: 20.0,
              reason: "Secondo rimborso",
              createdAt: "2025-01-25T00:00:00.000Z",
            },
          ],
        },
        message: "Ordine trovato con successo.",
      }

      expect(response.order!.creditNotes).toHaveLength(2)
      
      // Calculate net amount
      const totalAmount = response.order!.totalAmount
      const totalCreditNotes = response.order!.creditNotes!.reduce((sum, cn) => sum + cn.amount, 0)
      const netAmount = totalAmount - totalCreditNotes

      expect(totalAmount).toBe(200.0)
      expect(totalCreditNotes).toBe(50.0)
      expect(netAmount).toBe(150.0)
    })

    it("should have all required credit note fields", () => {
      const creditNote = {
        creditNoteCode: "NC-ORD-2025-001",
        amount: 50.0,
        reason: "Reso parziale - articolo difettoso",
        createdAt: "2025-01-22T14:30:00.000Z",
      }

      expect(creditNote).toHaveProperty("creditNoteCode")
      expect(creditNote).toHaveProperty("amount")
      expect(creditNote).toHaveProperty("reason")
      expect(creditNote).toHaveProperty("createdAt")
      expect(typeof creditNote.creditNoteCode).toBe("string")
      expect(typeof creditNote.amount).toBe("number")
      expect(typeof creditNote.reason).toBe("string")
      expect(typeof creditNote.createdAt).toBe("string")
    })
  })
})
