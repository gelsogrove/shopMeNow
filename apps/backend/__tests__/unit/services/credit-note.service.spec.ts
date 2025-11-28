// Mock Prisma client
const mockPrismaOrders = {
  findFirst: jest.fn(),
}

const mockPrismaCreditNote = {
  create: jest.fn(),
  findMany: jest.fn(),
  findFirst: jest.fn(),
  aggregate: jest.fn(),
  delete: jest.fn(),
}

jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      orders: mockPrismaOrders,
      creditNote: mockPrismaCreditNote,
    })),
  }
})

import { CreditNoteService, CreateCreditNoteDto } from "../../../src/application/services/credit-note.service"

describe("CreditNoteService", () => {
  let service: CreditNoteService
  const workspaceId = "workspace-123"
  const orderId = "order-123"
  const userId = "user-123"

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CreditNoteService()
  })

  describe("createCreditNote", () => {
    const validDto: CreateCreditNoteDto = {
      orderId,
      workspaceId,
      amount: 50,
      reason: "Prodotto danneggiato",
      createdById: userId,
    }

    it("should create a credit note for a DELIVERED order", async () => {
      const mockOrder = {
        id: orderId,
        orderCode: "ORD-2025-001",
        status: "DELIVERED",
        totalAmount: 100,
        workspaceId,
        customer: {
          id: "customer-123",
          name: "Mario Rossi",
          email: "mario@test.com",
        },
        creditNotes: [],
      }

      const mockCreditNote = {
        id: "cn-123",
        creditNoteCode: "NC-ORD-2025-001",
        orderId,
        amount: 50,
        reason: "Prodotto danneggiato",
        createdAt: new Date(),
        createdById: userId,
        order: {
          id: orderId,
          orderCode: "ORD-2025-001",
          status: "DELIVERED",
          totalAmount: 100,
          customer: mockOrder.customer,
        },
      }

      mockPrismaOrders.findFirst.mockResolvedValue(mockOrder)
      mockPrismaCreditNote.create.mockResolvedValue(mockCreditNote)

      const result = await service.createCreditNote(validDto)

      expect(result).toEqual(mockCreditNote)
      expect(mockPrismaOrders.findFirst).toHaveBeenCalledWith({
        where: { id: orderId, workspaceId },
        include: expect.any(Object),
      })
      expect(mockPrismaCreditNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          creditNoteCode: "NC-ORD-2025-001",
          orderId,
          amount: 50,
          reason: "Prodotto danneggiato",
          createdById: userId,
        }),
        include: expect.any(Object),
      })
    })

    it("should throw error if order not found", async () => {
      mockPrismaOrders.findFirst.mockResolvedValue(null)

      await expect(service.createCreditNote(validDto)).rejects.toThrow(
        "Ordine non trovato"
      )
    })

    it("should throw error if order is not CONFIRMED or DELIVERED", async () => {
      const mockOrder = {
        id: orderId,
        orderCode: "ORD-2025-001",
        status: "PENDING",
        totalAmount: 100,
        workspaceId,
        creditNotes: [],
      }

      mockPrismaOrders.findFirst.mockResolvedValue(mockOrder)

      await expect(service.createCreditNote(validDto)).rejects.toThrow(
        "La nota di credito può essere emessa solo per ordini confermati o consegnati"
      )
    })

    it("should throw error if amount is zero or negative", async () => {
      const mockOrder = {
        id: orderId,
        orderCode: "ORD-2025-001",
        status: "DELIVERED",
        totalAmount: 100,
        workspaceId,
        creditNotes: [],
      }

      mockPrismaOrders.findFirst.mockResolvedValue(mockOrder)

      const invalidDto = { ...validDto, amount: 0 }
      await expect(service.createCreditNote(invalidDto)).rejects.toThrow(
        "L'importo della nota di credito deve essere maggiore di zero"
      )
    })

    it("should throw error if amount exceeds remaining order value", async () => {
      const mockOrder = {
        id: orderId,
        orderCode: "ORD-2025-001",
        status: "DELIVERED",
        totalAmount: 100,
        workspaceId,
        creditNotes: [{ amount: 80 }], // Already credited 80
      }

      mockPrismaOrders.findFirst.mockResolvedValue(mockOrder)

      // Try to credit 50, but only 20 remaining
      await expect(service.createCreditNote(validDto)).rejects.toThrow(
        "L'importo supera il valore residuo dell'ordine"
      )
    })

    it("should generate correct credit note code for multiple credit notes", async () => {
      const mockOrder = {
        id: orderId,
        orderCode: "ORD-2025-001",
        status: "DELIVERED",
        totalAmount: 100,
        workspaceId,
        customer: {
          id: "customer-123",
          name: "Mario Rossi",
          email: "mario@test.com",
        },
        creditNotes: [{ amount: 20 }], // Already has one credit note
      }

      const mockCreditNote = {
        id: "cn-124",
        creditNoteCode: "NC-ORD-2025-001-2", // Second credit note
        orderId,
        amount: 30,
        reason: "Secondo rimborso",
        createdAt: new Date(),
        createdById: userId,
        order: mockOrder,
      }

      mockPrismaOrders.findFirst.mockResolvedValue(mockOrder)
      mockPrismaCreditNote.create.mockResolvedValue(mockCreditNote)

      const dto = { ...validDto, amount: 30, reason: "Secondo rimborso" }
      await service.createCreditNote(dto)

      expect(mockPrismaCreditNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creditNoteCode: "NC-ORD-2025-001-2",
          }),
        })
      )
    })
  })

  describe("getCreditNotesByOrderId", () => {
    it("should return credit notes for an order", async () => {
      const mockOrder = { id: orderId, workspaceId }
      const mockCreditNotes = [
        { id: "cn-1", creditNoteCode: "NC-ORD-001", amount: 50 },
        { id: "cn-2", creditNoteCode: "NC-ORD-001-2", amount: 30 },
      ]

      mockPrismaOrders.findFirst.mockResolvedValue(mockOrder)
      mockPrismaCreditNote.findMany.mockResolvedValue(mockCreditNotes)

      const result = await service.getCreditNotesByOrderId(orderId, workspaceId)

      expect(result).toEqual(mockCreditNotes)
    })

    it("should throw error if order not found", async () => {
      mockPrismaOrders.findFirst.mockResolvedValue(null)

      await expect(
        service.getCreditNotesByOrderId(orderId, workspaceId)
      ).rejects.toThrow("Ordine non trovato")
    })
  })

  describe("getTotalCreditNotesForOrder", () => {
    it("should return total credit notes amount", async () => {
      mockPrismaCreditNote.aggregate.mockResolvedValue({
        _sum: { amount: 80 },
      })

      const result = await service.getTotalCreditNotesForOrder(orderId)

      expect(result).toBe(80)
    })

    it("should return 0 if no credit notes exist", async () => {
      mockPrismaCreditNote.aggregate.mockResolvedValue({
        _sum: { amount: null },
      })

      const result = await service.getTotalCreditNotesForOrder(orderId)

      expect(result).toBe(0)
    })
  })

  describe("deleteCreditNote", () => {
    it("should delete an existing credit note", async () => {
      const mockCreditNote = {
        id: "cn-123",
        creditNoteCode: "NC-ORD-2025-001",
      }

      mockPrismaCreditNote.findFirst.mockResolvedValue(mockCreditNote)
      mockPrismaCreditNote.delete.mockResolvedValue(mockCreditNote)

      await service.deleteCreditNote("cn-123", workspaceId)

      expect(mockPrismaCreditNote.delete).toHaveBeenCalledWith({
        where: { id: "cn-123" },
      })
    })

    it("should throw error if credit note not found", async () => {
      mockPrismaCreditNote.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteCreditNote("cn-nonexistent", workspaceId)
      ).rejects.toThrow("Nota di credito non trovata")
    })
  })
})
