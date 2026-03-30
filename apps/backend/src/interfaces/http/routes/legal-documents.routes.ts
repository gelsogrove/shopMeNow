import { Router } from "express"
import { legalDocumentStaticService } from "../../../application/services/legal-document-static.service"
import logger from "../../../utils/logger"

const router = Router()

logger.info("🌍 Setting up GLOBAL legal documents routes (Static file serving - eCHATBOT platform)")

/**
 * @swagger
 * /api/legal-documents/{type}:
 *   get:
 *     summary: Get a legal document by type (PUBLIC - eCHATBOT platform)
 *     description: |
 *       Returns a specific legal document by type and language.
 *       PUBLIC endpoint - no authentication required (static file).
 *       These documents describe the eCHATBOT PLATFORM terms, NOT customer workspace terms.
 *     tags: [Legal Documents]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [GDPR, PRIVACY_POLICY, TERMS_OF_SERVICE, REFUND_POLICY]
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [it, en, es, pt]
 *           default: en
 *     responses:
 *       200:
 *         description: Legal document retrieved successfully (HTML content)
 *       404:
 *         description: Document not found
 */
router.get("/:type", async (req: any, res: any) => {
  try {
    const { type } = req.params
    const lang = (req.query.lang || "en") as string
    const doc = await legalDocumentStaticService.getLegalDocument(type, lang as any)
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.send(doc.content)
  } catch (error) {
    logger.error("Error serving legal document:", error)
    res.status(404).json({
      error: error instanceof Error ? error.message : "Document not found",
    })
  }
})

/**
 * @swagger
 * /api/legal-documents:
 *   get:
 *     summary: List all legal documents metadata (PUBLIC - eCHATBOT platform)
 *     description: |
 *       Returns metadata of all legal documents for the eCHATBOT platform.
 *       PUBLIC endpoint - no authentication required (static files).
 *     tags: [Legal Documents]
 *     responses:
 *       200:
 *         description: List of all legal documents (metadata only)
 */
router.get("/", async (req: any, res: any) => {
  try {
    const docs = await legalDocumentStaticService.getAllLegalDocuments()
    res.json({
      count: docs.length,
      documents: docs.map((d) => ({
        type: d.type,
        language: d.language,
        url: `/api/legal-documents/${d.type}?lang=${d.language}`,
      })),
    })
  } catch (error) {
    logger.error("Error listing legal documents:", error)
    res.status(500).json({
      error: "Failed to list legal documents",
    })
  }
})

logger.info("✅ GLOBAL legal documents routes configured (PUBLIC GET - static file serving)")

export const legalDocumentRoutes = router

