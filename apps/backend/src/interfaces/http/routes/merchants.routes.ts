import { Router } from "express"
import { MerchantController } from "../controllers/merchant.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     Merchant:
 *       type: object
 *       required: [id, name, workspaceId]
 *       properties:
 *         id: { type: string }
 *         workspaceId: { type: string }
 *         name: { type: string, description: Merchant display name }
 *         description: { type: string, nullable: true }
 *         location: { type: string, nullable: true }
 *         billingName: { type: string, nullable: true, description: Ragione sociale }
 *         vatNumber: { type: string, nullable: true, description: Partita IVA }
 *         taxCode: { type: string, nullable: true, description: Codice fiscale }
 *         sdiCode: { type: string, nullable: true, description: Codice destinatario SDI }
 *         pec: { type: string, nullable: true }
 *         billingAddress: { type: string, nullable: true }
 *         billingCity: { type: string, nullable: true }
 *         billingZip: { type: string, nullable: true }
 *         billingProvince: { type: string, nullable: true }
 *         billingCountry: { type: string, nullable: true }
 *         isActive: { type: boolean }
 *         quotaRemaining:
 *           type: integer
 *           description: Push-package balance. Read-only — moves only via top-ups and debited sends.
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     MerchantPush:
 *       type: object
 *       required: [id, workspaceId, merchantId, title, text]
 *       properties:
 *         id: { type: string }
 *         workspaceId: { type: string }
 *         merchantId: { type: string }
 *         title: { type: string }
 *         text: { type: string }
 *         photoUrl: { type: string, nullable: true }
 *         videoUrl: { type: string, nullable: true }
 *         location: { type: string, nullable: true }
 *         description: { type: string, nullable: true }
 *         isActive: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     MerchantStats:
 *       type: object
 *       properties:
 *         merchantId: { type: string }
 *         name: { type: string }
 *         isActive: { type: boolean }
 *         quotaRemaining: { type: integer }
 *         totalPurchased: { type: integer }
 *         totalSent: { type: integer }
 *         topups:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string }
 *               amount: { type: integer }
 *               note: { type: string, nullable: true }
 *               createdAt: { type: string, format: date-time }
 *         monthlySent:
 *           type: array
 *           description: Sent messages per month ("2026-08" → count), for invoicing
 *           items:
 *             type: object
 *             properties:
 *               month: { type: string, example: "2026-08" }
 *               sent: { type: integer }
 */
export const merchantsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new MerchantController()

  router.use(authMiddleware)
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/merchants:
   *   get:
   *     summary: List merchants (esercenti) of a workspace
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: Merchants
   *         content:
   *           application/json:
   *             schema: { type: array, items: { $ref: '#/components/schemas/Merchant' } }
   *   post:
   *     summary: Create a merchant
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name: { type: string }
   *               description: { type: string }
   *               location: { type: string }
   *               billingName: { type: string }
   *               vatNumber: { type: string }
   *               taxCode: { type: string }
   *               sdiCode: { type: string }
   *               pec: { type: string }
   *               billingAddress: { type: string }
   *               billingCity: { type: string }
   *               billingZip: { type: string }
   *               billingProvince: { type: string }
   *               billingCountry: { type: string }
   *               isActive: { type: boolean }
   *     responses:
   *       201:
   *         description: Merchant created
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Merchant' }
   */
  router.get("/", controller.list.bind(controller))
  router.post("/", controller.create.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/merchants/{id}:
   *   get:
   *     summary: Get a merchant
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Merchant, content: { application/json: { schema: { $ref: '#/components/schemas/Merchant' } } } }
   *       404: { description: Merchant not found }
   *   put:
   *     summary: Update a merchant (workspaceId and quotaRemaining are not writable)
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Merchant updated }
   *       404: { description: Merchant not found }
   *   delete:
   *     summary: Soft-delete a merchant (history is kept for invoicing)
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     responses:
   *       204: { description: Merchant deleted }
   *       404: { description: Merchant not found }
   */
  router.get("/:id", controller.getById.bind(controller))
  router.put("/:id", controller.update.bind(controller))
  router.delete("/:id", controller.delete.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/merchants/{id}/quota/topup:
   *   post:
   *     summary: Sell a push package to the merchant (adds to quotaRemaining, audited)
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [amount]
   *             properties:
   *               amount: { type: integer, minimum: 1, example: 500 }
   *               note: { type: string, example: "Winter package" }
   *     responses:
   *       200: { description: Updated merchant with new balance }
   *       400: { description: Invalid amount }
   *       404: { description: Merchant not found }
   */
  router.post("/:id/quota/topup", controller.topUpQuota.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/merchants/{id}/stats:
   *   get:
   *     summary: Invoicing stats — balance, package purchases, sent per month
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Stats, content: { application/json: { schema: { $ref: '#/components/schemas/MerchantStats' } } } }
   *       404: { description: Merchant not found }
   */
  router.get("/:id/stats", controller.stats.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/merchants/{id}/pushes:
   *   get:
   *     summary: List a merchant's creatives
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Pushes, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/MerchantPush' } } } } }
   *   post:
   *     summary: Create a creative (links must be in the workspace allow-list)
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title, text]
   *             properties:
   *               title: { type: string }
   *               text: { type: string }
   *               photoUrl: { type: string }
   *               videoUrl: { type: string }
   *               location: { type: string }
   *               description: { type: string }
   *               isActive: { type: boolean }
   *     responses:
   *       201: { description: Push created }
   *       400: { description: Missing fields or unauthorized link(s) }
   *       404: { description: Merchant not found }
   */
  router.get("/:id/pushes", controller.listPushes.bind(controller))
  router.post("/:id/pushes", controller.createPush.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/merchants/{id}/pushes/{pushId}:
   *   put:
   *     summary: Update a creative (resulting content re-validated against the allow-list)
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *       - { in: path, name: pushId, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Push updated }
   *       400: { description: Unauthorized link(s) }
   *       404: { description: Push not found }
   *   delete:
   *     summary: Soft-delete a creative
   *     tags: [Merchants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: workspaceId, required: true, schema: { type: string } }
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *       - { in: path, name: pushId, required: true, schema: { type: string } }
   *     responses:
   *       204: { description: Push deleted }
   *       404: { description: Push not found }
   */
  router.put("/:id/pushes/:pushId", controller.updatePush.bind(controller))
  router.delete("/:id/pushes/:pushId", controller.deletePush.bind(controller))

  return router
}
