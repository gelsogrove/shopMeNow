import { Request, Response } from "express"
import { LegalDocumentService } from "../../../application/services/legal-document.service"
import logger from "../../../utils/logger"

export class LegalDocumentController {
  constructor(private legalDocumentService: LegalDocumentService) {}

  async getLegalDocument(req: Request, res: Response) {
    try {
      const { type } = req.params
      const language = (req.query.lang as string) || "it"

      logger.info(`🌍 PUBLIC request for GLOBAL legal document: ${type}, lang=${language}`)

      const document = await this.legalDocumentService.getLegalDocumentByLanguage(
        type,
        language
      )

      return res.json(document)
    } catch (error) {
      logger.error("Error fetching legal document:", error)
      return res.status(404).json({ error: error.message })
    }
  }

  async getAllLegalDocuments(req: Request, res: Response) {
    try {
      logger.info(`🌍 Fetching ALL GLOBAL legal documents for eCHATBOT platform`)

      const documents = await this.legalDocumentService.getAllLegalDocuments()

      return res.json(documents)
    } catch (error) {
      logger.error("Error fetching legal documents:", error)
      return res.status(500).json({ error: "Failed to fetch legal documents" })
    }
  }

  async updateLegalDocument(req: Request, res: Response) {
    try {
      const { type } = req.params
      const { titleIt, titleEn, titleEs, titlePt, contentIt, contentEn, contentEs, contentPt, isActive } = req.body

      logger.info(`🔧 PLATFORM ADMIN updating GLOBAL legal document: ${type}`)

      const updatedDocument = await this.legalDocumentService.updateLegalDocument(type, {
        titleIt,
        titleEn,
        titleEs,
        titlePt,
        contentIt,
        contentEn,
        contentEs,
        contentPt,
        isActive,
      })

      logger.info(`✅ GLOBAL legal document updated: ${type}`)
      return res.json(updatedDocument)
    } catch (error) {
      logger.error("Error updating legal document:", error)
      return res.status(400).json({ error: error.message })
    }
  }
}
