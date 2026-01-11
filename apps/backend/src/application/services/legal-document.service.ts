import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"

type LegalDocumentType = "GDPR" | "PRIVACY_POLICY" | "TERMS_OF_SERVICE" | "REFUND_POLICY"

interface UpdateLegalDocumentDTO {
  titleIt?: string
  titleEn?: string
  titleEs?: string
  titlePt?: string
  contentIt?: string
  contentEn?: string
  contentEs?: string
  contentPt?: string
  isActive?: boolean
}

export class LegalDocumentService {
  private readonly validTypes: LegalDocumentType[] = [
    "GDPR",
    "PRIVACY_POLICY",
    "TERMS_OF_SERVICE",
    "REFUND_POLICY",
  ]

  async getLegalDocument(type: string) {
    if (!this.isValidType(type)) {
      throw new Error(`Invalid document type: ${type}`)
    }

    logger.info(`🌍 Fetching GLOBAL legal document: ${type} (eCHATBOT platform)`)

    const document = await prisma.legalDocument.findUnique({
      where: {
        type: type as LegalDocumentType,
      },
    })

    if (!document) {
      throw new Error(`Document not found: ${type}`)
    }

    return document
  }

  async getAllLegalDocuments() {
    logger.info(`🌍 Fetching ALL GLOBAL legal documents (eCHATBOT platform)`)
    
    const documents = await prisma.legalDocument.findMany({
      orderBy: { createdAt: "asc" },
    })

    return documents
  }

  async updateLegalDocument(type: string, data: UpdateLegalDocumentDTO) {
    if (!this.isValidType(type)) {
      throw new Error(`Invalid document type: ${type}`)
    }

    logger.info(`🔧 Updating GLOBAL legal document: ${type} (eCHATBOT platform, ADMIN ONLY)`)

    // Validate HTML content if provided
    if (data.contentIt) this.validateHtml(data.contentIt)
    if (data.contentEn) this.validateHtml(data.contentEn)
    if (data.contentEs) this.validateHtml(data.contentEs)
    if (data.contentPt) this.validateHtml(data.contentPt)

    const updatedDocument = await prisma.legalDocument.update({
      where: {
        type: type as LegalDocumentType,
      },
      data,
    })

    logger.info(`✅ Updated GLOBAL legal document: ${type}`)
    return updatedDocument
  }

  async getLegalDocumentByLanguage(type: string, language: string = "it") {
    const document = await this.getLegalDocument(type)

    // CRITICAL: Database fields are capitalized (e.g., contentIt, titleIt), NOT uppercase (contentIT, titleIT)
    const langCapitalized = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase()
    const contentKey = `content${langCapitalized}` as keyof typeof document
    const titleKey = `title${langCapitalized}` as keyof typeof document

    return {
      type: document.type,
      title: document[titleKey],
      content: document[contentKey],
      isActive: document.isActive,
    }
  }

  private isValidType(type: string): boolean {
    return this.validTypes.includes(type as LegalDocumentType)
  }

  private validateHtml(html: string): void {
    // Basic HTML validation - check for unclosed tags
    const openTags = (html.match(/<[^/][^>]*>/g) || []).length
    const closeTags = (html.match(/<\/[^>]*>/g) || []).length

    if (openTags !== closeTags) {
      throw new Error("Invalid HTML: unclosed tags detected")
    }
  }
}
