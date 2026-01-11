import { LegalDocumentService } from "../../src/application/services/legal-document.service"

jest.mock("@echatbot/database", () => {
  const prisma = {
    legalDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  }

  return {
    prisma,
    PrismaClient: jest.fn(),
  }
})

const { prisma } = require("@echatbot/database")

describe("LegalDocumentService", () => {
  let service: LegalDocumentService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new LegalDocumentService()
  })

  describe("getLegalDocumentByLanguage", () => {
    const mockDocument = {
      id: "doc1",
      type: "PRIVACY_POLICY",
      titleIt: "Privacy Policy",
      titleEn: "Privacy Policy",
      titleEs: "Política de Privacidad",
      titlePt: "Política de Privacidade",
      contentIt: "<h1>Privacy IT</h1>",
      contentEn: "<h1>Privacy EN</h1>",
      contentEs: "<h1>Privacy ES</h1>",
      contentPt: "<h1>Privacy PT</h1>",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it("should return document in Italian (lowercase 'it')", async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(mockDocument)

      const result = await service.getLegalDocumentByLanguage("PRIVACY_POLICY", "it")

      expect(result.type).toBe("PRIVACY_POLICY")
      expect(result.title).toBe("Privacy Policy") // titleIt
      expect(result.content).toBe("<h1>Privacy IT</h1>") // contentIt
      expect(result.isActive).toBe(true)
    })

    it("should return document in English (lowercase 'en')", async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(mockDocument)

      const result = await service.getLegalDocumentByLanguage("PRIVACY_POLICY", "en")

      expect(result.title).toBe("Privacy Policy") // titleEn
      expect(result.content).toBe("<h1>Privacy EN</h1>") // contentEn
    })

    it("should return document in Spanish (lowercase 'es')", async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(mockDocument)

      const result = await service.getLegalDocumentByLanguage("PRIVACY_POLICY", "es")

      expect(result.title).toBe("Política de Privacidad") // titleEs
      expect(result.content).toBe("<h1>Privacy ES</h1>") // contentEs
    })

    it("should return document in Portuguese (lowercase 'pt')", async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(mockDocument)

      const result = await service.getLegalDocumentByLanguage("PRIVACY_POLICY", "pt")

      expect(result.title).toBe("Política de Privacidade") // titlePt
      expect(result.content).toBe("<h1>Privacy PT</h1>") // contentPt
    })

    it("should handle uppercase language codes (IT -> It)", async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(mockDocument)

      const result = await service.getLegalDocumentByLanguage("PRIVACY_POLICY", "IT")

      expect(result.title).toBe("Privacy Policy") // titleIt (not titleIT)
      expect(result.content).toBe("<h1>Privacy IT</h1>")
    })

    it("should default to Italian if no language specified", async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(mockDocument)

      const result = await service.getLegalDocumentByLanguage("PRIVACY_POLICY")

      expect(result.title).toBe("Privacy Policy") // titleIt
      expect(result.content).toBe("<h1>Privacy IT</h1>")
    })

    it("should throw error for invalid document type", async () => {
      await expect(
        service.getLegalDocumentByLanguage("INVALID_TYPE", "it")
      ).rejects.toThrow("Invalid document type")
    })

    it("should throw error if document not found", async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(null)

      await expect(
        service.getLegalDocumentByLanguage("PRIVACY_POLICY", "it")
      ).rejects.toThrow("Document not found")
    })
  })

  describe("getAllLegalDocuments", () => {
    it("should return all legal documents", async () => {
      const mockDocuments = [
        { id: "1", type: "GDPR", titleIt: "GDPR", isActive: true },
        { id: "2", type: "PRIVACY_POLICY", titleIt: "Privacy", isActive: true },
        { id: "3", type: "TERMS_OF_SERVICE", titleIt: "Terms", isActive: true },
        { id: "4", type: "REFUND_POLICY", titleIt: "Refund", isActive: true },
      ] as any

      prisma.legalDocument.findMany.mockResolvedValue(mockDocuments)

      const result = await service.getAllLegalDocuments()

      expect(result).toHaveLength(4)
      expect(prisma.legalDocument.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
      })
    })
  })

  describe("updateLegalDocument", () => {
    it("should update document with valid data", async () => {
      const updateData = {
        titleIt: "Nuovo Titolo",
        contentIt: "<h1>Nuovo Contenuto</h1>",
      }

      const updatedDocument = {
        id: "doc1",
        type: "PRIVACY_POLICY",
        ...updateData,
        isActive: true,
      } as any

      prisma.legalDocument.update.mockResolvedValue(updatedDocument)

      const result = await service.updateLegalDocument("PRIVACY_POLICY", updateData)

      expect(result.titleIt).toBe("Nuovo Titolo")
      expect(prisma.legalDocument.update).toHaveBeenCalledWith({
        where: { type: "PRIVACY_POLICY" },
        data: updateData,
      })
    })

    it("should throw error for invalid document type", async () => {
      await expect(
        service.updateLegalDocument("INVALID_TYPE", { titleIt: "Test" })
      ).rejects.toThrow("Invalid document type")
    })

    it("should validate HTML content", async () => {
      const invalidHtml = {
        contentIt: "<h1>Unclosed tag",
      }

      await expect(
        service.updateLegalDocument("PRIVACY_POLICY", invalidHtml)
      ).rejects.toThrow("Invalid HTML: unclosed tags")
    })
  })
})
