import { Router, Request, Response } from "express"
import { gdprController } from "../controllers/gdpr.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

const router = Router({ mergeParams: true })

/**
 * @swagger
 * /api/workspaces/{workspaceId}/gdpr:
 *   get:
 *     summary: Get GDPR content in specified language
 *     description: Returns GDPR privacy notice in the requested language
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [it, en, es, pt]
 *         description: Language code (default - English)
 *     responses:
 *       200:
 *         description: GDPR content successfully retrieved
 *   put:
 *     summary: Update GDPR content for a specific language
 *     description: Updates GDPR content in the database
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [it, en, es, pt]
 *         required: true
 *         description: Language code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: GDPR content successfully updated
 */
// GET: Retrieve GDPR content (public, no auth required)
router.get("/", (req: Request, res: Response) => gdprController.getGdpr(req, res))

// PUT: Update GDPR content (requires auth + workspace validation)
router.put(
  "/",
  authMiddleware,
  workspaceValidationMiddleware,
  (req: Request, res: Response) => gdprController.updateGdpr(req, res)
)

export default router
