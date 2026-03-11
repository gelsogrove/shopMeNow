import { Router } from "express"
import { authMiddleware } from "../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../middlewares/platformAdmin.middleware"
import { LegalDocumentController } from "../controllers/legal-document.controller"
import { LegalDocumentService } from "../../../application/services/legal-document.service"
import logger from "../../../utils/logger"

const legalDocumentService = new LegalDocumentService()
const legalDocumentController = new LegalDocumentController(legalDocumentService)

const router = Router()

logger.info("🌍 Setting up GLOBAL legal documents routes (eCHATBOT platform)")

/**
 * @swagger
 * /api/legal-documents/{type}:
 *   get:
 *     summary: Get a legal document by type (PUBLIC - eCHATBOT platform)
 *     description: |
 *       Returns a specific legal document by type and language.
 *       PUBLIC endpoint - no authentication required.
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
 *           default: it
 *     responses:
 *       200:
 *         description: Legal document retrieved successfully
 *       404:
 *         description: Document not found
 */
router.get(
  "/:type",
  // 🔓 PUBLIC endpoint - no authentication required
  (req: any, res: any) => legalDocumentController.getLegalDocument(req, res)
)

/**
 * @swagger
 * /api/legal-documents:
 *   get:
 *     summary: Get all legal documents (PUBLIC - eCHATBOT platform)
 *     description: |
 *       Returns all legal documents for the eCHATBOT platform.
 *       PUBLIC endpoint - no authentication required.
 *       These documents are GLOBAL to the platform, not workspace-specific.
 *     tags: [Legal Documents]
 *     responses:
 *       200:
 *         description: List of all legal documents
 */
router.get(
  "/",
  // 🔓 PUBLIC endpoint - no authentication required
  (req: any, res: any) => legalDocumentController.getAllLegalDocuments(req, res)
)

/**
 * @swagger
 * /api/legal-documents/{type}:
 *   put:
 *     summary: Update a legal document (PLATFORM ADMIN ONLY)
 *     description: |
 *       Updates a legal document for the eCHATBOT PLATFORM.
 *       REQUIRES PLATFORM ADMIN PRIVILEGES (isPlatformAdmin=true).
 *       NOT for workspace admins - this is platform-level operation.
 *     tags: [Legal Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [GDPR, PRIVACY_POLICY, TERMS_OF_SERVICE, REFUND_POLICY]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titleIt:
 *                 type: string
 *               titleEn:
 *                 type: string
 *               titleEs:
 *                 type: string
 *               titlePt:
 *                 type: string
 *               contentIt:
 *                 type: string
 *               contentEn:
 *                 type: string
 *               contentEs:
 *                 type: string
 *               contentPt:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Document updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires platform admin privileges
 */
router.put(
  "/:type",
  authMiddleware, // 🔒 PROTECTED - requires JWT token
  platformAdminMiddleware, // 🔒 PLATFORM ADMIN ONLY - verify isPlatformAdmin=true
  (req: any, res: any) => legalDocumentController.updateLegalDocument(req, res)
)

/**
 * @swagger
 * /api/legal-documents/initialize:
 *   post:
 *     summary: Initialize legal documents from seed files (PLATFORM ADMIN ONLY)
 *     description: |
 *       Upserts all 4 legal documents (GDPR, Privacy Policy, Terms, Refund Policy)
 *       from the HTML seed files. Safe to call multiple times (idempotent).
 *     tags: [Legal Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents initialized successfully
 */
router.post(
  "/initialize",
  authMiddleware,
  platformAdminMiddleware,
  async (req: any, res: any) => {
    try {
      const { legalDocuments } = await import("@echatbot/database/prisma/data/legalDocuments")
      const { prisma } = await import("@echatbot/database")

      const results: string[] = []
      for (const doc of legalDocuments) {
        await prisma.legalDocument.upsert({
          where: { type: doc.type },
          update: {
            titleIt: doc.titleIt,
            titleEn: doc.titleEn,
            titleEs: doc.titleEs,
            titlePt: doc.titlePt,
            contentIt: doc.contentIt,
            contentEn: doc.contentEn,
            contentEs: doc.contentEs,
            contentPt: doc.contentPt,
            isActive: doc.isActive,
          },
          create: doc,
        })
        results.push(doc.type)
        logger.info(`[LegalDocs] Initialized: ${doc.type}`)
      }

      res.json({
        success: true,
        initialized: results,
        message: `${results.length} legal documents initialized successfully`,
      })
    } catch (error) {
      logger.error("[LegalDocs] Error initializing documents:", error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize legal documents",
      })
    }
  }
)

logger.info("✅ GLOBAL legal documents routes configured (PUBLIC GET, PLATFORM ADMIN PUT/POST)")

export const legalDocumentRoutes = router
