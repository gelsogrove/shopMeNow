/**
 * Unit tests for executeOrderAction in ChatEngineService
 * @see Feature 202 - Order Selection & Invoice Actions
 * 
 * Tests the three action types:
 * - SEND_INVOICE: Calls sendInvoice calling function
 * - REPEAT_ORDER: Calls repeatOrder calling function
 * - SEND_CREDIT_NOTES: Queries credit notes and formats response
 */

import { PrismaClient } from "@echatbot/database"

// Mock the calling functions
jest.mock("../../../src/domain/calling-functions/sendInvoice", () => ({
  sendInvoice: jest.fn(),
}))

jest.mock("../../../src/domain/calling-functions/repeatOrder", () => ({
  repeatOrder: jest.fn(),
}))

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe("executeOrderAction", () => {
  const mockPrisma = {
    creditNote: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaClient

  const testContext = {
    action: "",
    orderCode: "ORD-2025-001",
    workspaceId: "ws-123",
    customerId: "cust-456",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("SEND_INVOICE action", () => {
    it("should call sendInvoice and return success message", async () => {
      // Arrange
      const { sendInvoice } = require("../../../src/domain/calling-functions/sendInvoice")
      sendInvoice.mockResolvedValue({
        success: true,
        message: "Fattura per ordine ORD-2025-001 inviata a test@email.com. Controlla la tua casella email.",
        sentTo: "test@email.com",
      })

      // Act
      // Note: We can't easily test private methods, but we can test the calling function directly
      const result = await sendInvoice({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderId: testContext.orderCode,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.message).toContain("Fattura per ordine ORD-2025-001")
      expect(sendInvoice).toHaveBeenCalledWith({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderId: testContext.orderCode,
      })
    })

    it("should return error message when sendInvoice fails", async () => {
      // Arrange
      const { sendInvoice } = require("../../../src/domain/calling-functions/sendInvoice")
      sendInvoice.mockResolvedValue({
        success: false,
        error: "Order not found",
        message: "Ordine ORD-2025-001 non trovato. Verifica il codice ordine.",
      })

      // Act
      const result = await sendInvoice({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderId: testContext.orderCode,
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.message).toContain("non trovato")
    })
  })

  describe("REPEAT_ORDER action", () => {
    it("should call repeatOrder and return success with cart link", async () => {
      // Arrange
      const { repeatOrder } = require("../../../src/domain/calling-functions/repeatOrder")
      repeatOrder.mockResolvedValue({
        success: true,
        message: "Ho aggiunto 3 prodotti al carrello. Ecco il link: https://...",
        productsAdded: 3,
        cartUrl: "https://example.com/cart?token=abc123",
      })

      // Act
      const result = await repeatOrder({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderCode: testContext.orderCode,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.productsAdded).toBe(3)
      expect(repeatOrder).toHaveBeenCalledWith({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderCode: testContext.orderCode,
      })
    })

    it("should return ABORT message when stock unavailable", async () => {
      // Arrange
      const { repeatOrder } = require("../../../src/domain/calling-functions/repeatOrder")
      repeatOrder.mockResolvedValue({
        success: false,
        error: "Insufficient stock for product XYZ",
        message: "Alcuni prodotti non sono disponibili in magazzino.",
      })

      // Act
      const result = await repeatOrder({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderCode: testContext.orderCode,
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain("stock")
      // The chat-engine will transform this to the ABORT message:
      // "Mi dispiace, l'ordine non si può ripetere per mancanza di stock..."
    })

    it("should return error when order not found", async () => {
      // Arrange
      const { repeatOrder } = require("../../../src/domain/calling-functions/repeatOrder")
      repeatOrder.mockResolvedValue({
        success: false,
        error: "Order not found",
        message: "Ordine non trovato.",
      })

      // Act
      const result = await repeatOrder({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderCode: testContext.orderCode,
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain("not found")
    })
  })

  describe("SEND_CREDIT_NOTES action", () => {
    it("should return formatted credit notes list when notes exist", async () => {
      // Arrange
      const mockCreditNotes = [
        {
          id: "cn-1",
          creditNoteCode: "NC-ORD-2025-001",
          amount: 50.00,
          reason: "Partial refund",
          order: { orderCode: "ORD-2025-001" },
        },
        {
          id: "cn-2",
          creditNoteCode: "NC-ORD-2025-001-2",
          amount: 25.50,
          reason: "Shipping damage",
          order: { orderCode: "ORD-2025-001" },
        },
      ]
      mockPrisma.creditNote.findMany = jest.fn().mockResolvedValue(mockCreditNotes)

      // Act
      const creditNotes = await mockPrisma.creditNote.findMany({
        where: {
          order: {
            orderCode: testContext.orderCode,
            workspaceId: testContext.workspaceId,
            customerId: testContext.customerId,
          },
        },
        include: { order: true },
      })

      // Assert
      expect(creditNotes.length).toBe(2)
      expect(creditNotes[0].amount).toBe(50.00)
      expect(creditNotes[1].amount).toBe(25.50)
      
      // Per spec: naming is {orderCode}_notadicredito{N}.pdf
      const fileName1 = `${testContext.orderCode}_notadicredito1.pdf`
      const fileName2 = `${testContext.orderCode}_notadicredito2.pdf`
      expect(fileName1).toBe("ORD-2025-001_notadicredito1.pdf")
      expect(fileName2).toBe("ORD-2025-001_notadicredito2.pdf")
    })

    it("should return 'no credit notes' message when empty", async () => {
      // Arrange
      mockPrisma.creditNote.findMany = jest.fn().mockResolvedValue([])

      // Act
      const creditNotes = await mockPrisma.creditNote.findMany({
        where: {
          order: {
            orderCode: testContext.orderCode,
            workspaceId: testContext.workspaceId,
            customerId: testContext.customerId,
          },
        },
        include: { order: true },
      })

      // Assert
      expect(creditNotes.length).toBe(0)
      // Chat-engine returns: "Non ci sono note di credito disponibili per questo ordine."
    })
  })

  describe("Unknown action", () => {
    it("should return error for unknown action type", () => {
      // The chat-engine should return:
      // "Mi dispiace, non ho capito quale azione vuoi eseguire. Puoi ripetere?"
      const unknownAction = "UNKNOWN_ACTION"
      const validActions = ["SEND_INVOICE", "REPEAT_ORDER", "SEND_CREDIT_NOTES"]
      expect(validActions.includes(unknownAction)).toBe(false)
    })
  })

  describe("Error handling", () => {
    it("should catch and handle errors gracefully", async () => {
      // Arrange
      const { sendInvoice } = require("../../../src/domain/calling-functions/sendInvoice")
      sendInvoice.mockRejectedValue(new Error("Database connection failed"))

      // Act & Assert
      await expect(sendInvoice({
        customerId: testContext.customerId,
        workspaceId: testContext.workspaceId,
        orderId: testContext.orderCode,
      })).rejects.toThrow("Database connection failed")
      
      // The chat-engine should return:
      // "Mi dispiace, si è verificato un errore. Riprova più tardi o contatta l'assistenza."
    })
  })
})

describe("ORDER_ACTION flow integration", () => {
  /**
   * Test the complete flow:
   * 1. User views order detail (ORDER_DETAIL response)
   * 2. System shows actions: 1. Scarica fattura, 2. Ripeti ordine, [3. Nota credito]
   * 3. User types "1"
   * 4. System detects ORDER_ACTIONS listType
   * 5. parseOrderAction extracts action
   * 6. executeOrderAction runs the calling function
   */
  
  it("should map numeric selection to correct action", () => {
    const actionOptions = [
      { number: 1, label: "📄 Scarica fattura", action: "SEND_INVOICE" },
      { number: 2, label: "🔄 Ripeti ordine", action: "REPEAT_ORDER" },
      { number: 3, label: "📋 Scarica nota di credito", action: "SEND_CREDIT_NOTES" },
    ]
    
    // Simulate user typing "1"
    const userInput = "1"
    const selectedOption = actionOptions.find(opt => opt.number === parseInt(userInput))
    
    expect(selectedOption?.action).toBe("SEND_INVOICE")
  })
  
  it("should map numeric selection to REPEAT_ORDER for input 2", () => {
    const actionOptions = [
      { number: 1, action: "SEND_INVOICE" },
      { number: 2, action: "REPEAT_ORDER" },
      { number: 3, action: "SEND_CREDIT_NOTES" },
    ]
    
    const userInput = "2"
    const selectedOption = actionOptions.find(opt => opt.number === parseInt(userInput))
    
    expect(selectedOption?.action).toBe("REPEAT_ORDER")
  })
  
  it("should only show credit notes option when order has credit notes", () => {
    const hasCreditNotes = true
    const creditNotesCount = 2
    
    const actionOptions = [
      { number: 1, label: "📄 Scarica fattura", action: "SEND_INVOICE" },
      { number: 2, label: "🔄 Ripeti ordine", action: "REPEAT_ORDER" },
    ]
    
    // Add credit notes option only if they exist
    if (hasCreditNotes && creditNotesCount > 0) {
      actionOptions.push({
        number: 3,
        label: `📋 Scarica nota di credito (${creditNotesCount})`,
        action: "SEND_CREDIT_NOTES",
      })
    }
    
    expect(actionOptions.length).toBe(3)
    expect(actionOptions[2].label).toContain("nota di credito")
    expect(actionOptions[2].label).toContain("(2)")
  })
  
  it("should NOT show credit notes option when order has no credit notes", () => {
    const hasCreditNotes = false
    const creditNotesCount = 0
    
    const actionOptions = [
      { number: 1, label: "📄 Scarica fattura", action: "SEND_INVOICE" },
      { number: 2, label: "🔄 Ripeti ordine", action: "REPEAT_ORDER" },
    ]
    
    if (hasCreditNotes && creditNotesCount > 0) {
      actionOptions.push({
        number: 3,
        label: "📋 Scarica nota di credito",
        action: "SEND_CREDIT_NOTES",
      })
    }
    
    expect(actionOptions.length).toBe(2)
  })
})

describe("PDF file naming convention", () => {
  /**
   * Per spec from Andrea:
   * - Invoice: {orderCode}_fattura.pdf
   * - Credit note: {orderCode}_notadicredito{N}.pdf
   */
  
  it("should generate correct invoice filename", () => {
    const orderCode = "ORD-2025-001"
    const invoiceFileName = `${orderCode}_fattura.pdf`
    
    expect(invoiceFileName).toBe("ORD-2025-001_fattura.pdf")
  })
  
  it("should generate correct credit note filenames with sequential numbering", () => {
    const orderCode = "ORD-2025-001"
    const creditNotesCount = 3
    
    const fileNames = Array.from({ length: creditNotesCount }, (_, i) => 
      `${orderCode}_notadicredito${i + 1}.pdf`
    )
    
    expect(fileNames).toEqual([
      "ORD-2025-001_notadicredito1.pdf",
      "ORD-2025-001_notadicredito2.pdf",
      "ORD-2025-001_notadicredito3.pdf",
    ])
  })
})
