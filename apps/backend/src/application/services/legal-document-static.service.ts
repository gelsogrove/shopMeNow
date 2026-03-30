import { readFileSync } from "fs"
import { join } from "path"
import logger from "../../utils/logger"

type LegalDocumentType = "GDPR" | "PRIVACY_POLICY" | "TERMS_OF_SERVICE" | "REFUND_POLICY"
type Language = "en" | "it" | "es" | "pt"

const TYPE_TO_FILENAME: Record<LegalDocumentType, string> = {
  GDPR: "gdpr",
  PRIVACY_POLICY: "privacy",
  TERMS_OF_SERVICE: "terms",
  REFUND_POLICY: "refund",
}

/**
 * Static Legal Documents Service
 * Reads HTML documents from the file system (no database)
 * Documents are served as-is from /apps/backend/public/legal/ directory
 */
export class LegalDocumentStaticService {
  private legalDocPath = join(process.cwd(), "public", "legal")

  async getLegalDocument(type: string, language: Language = "en") {
    if (!this.isValidType(type)) {
      throw new Error(`Invalid document type: ${type}`)
    }

    const filename = TYPE_TO_FILENAME[type as LegalDocumentType]
    const filepath = join(this.legalDocPath, `${filename}-${language}.html`)

    try {
      const content = readFileSync(filepath, "utf-8")
      logger.info(`✅ Loaded legal document: ${type} (${language})`)
      return {
        type,
        language,
        content,
      }
    } catch (error) {
      logger.error(`❌ Failed to load legal document: ${filepath}`, error)
      throw new Error(`Document not found: ${type} (${language})`)
    }
  }

  async getAllLegalDocuments() {
    const types: LegalDocumentType[] = ["GDPR", "PRIVACY_POLICY", "TERMS_OF_SERVICE", "REFUND_POLICY"]
    const languages: Language[] = ["en", "it", "es", "pt"]
    const documents = []

    for (const type of types) {
      for (const lang of languages) {
        try {
          const doc = await this.getLegalDocument(type, lang)
          documents.push(doc)
        } catch (error) {
          logger.warn(`Skipping missing document: ${type} (${lang})`)
        }
      }
    }

    return documents
  }

  private isValidType(type: string): boolean {
    return Object.keys(TYPE_TO_FILENAME).includes(type)
  }
}

export const legalDocumentStaticService = new LegalDocumentStaticService()
