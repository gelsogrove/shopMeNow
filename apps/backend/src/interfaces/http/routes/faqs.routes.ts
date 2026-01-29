import { Router } from "express"
import { FaqController } from "../controllers/faq.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import { checkTrialValid } from "../middlewares/billing.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     FAQ:
 *       type: object
 *       required:
 *         - id
 *         - question
 *         - answer
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the FAQ
 *         question:
 *           type: string
 *           description: Question text
 *         answer:
 *           type: string
 *           description: Answer text
 *         isActive:
 *           type: boolean
 *           description: Whether the FAQ is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this FAQ belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const faqsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new FaqController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/faqs:
   *   get:
   *     summary: Get all FAQs for a workspace
   *     tags: [FAQs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of FAQs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/FAQ'
   */
  router.get("/", controller.getAllFaqs.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/faqs:
   *   post:
   *     summary: Create a new FAQ
   *     tags: [FAQs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - question
   *               - answer
   *             properties:
   *               question:
   *                 type: string
   *                 description: Question text
   *               answer:
   *                 type: string
   *                 description: Answer text
   *               isActive:
   *                 type: boolean
   *                 description: Whether the FAQ is active
   *                 default: true
   *     responses:
   *       201:
   *         description: FAQ created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FAQ'
   */
  router.post("/", checkTrialValid, controller.createFaq.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/faqs/{id}:
   *   get:
   *     summary: Get a specific FAQ
   *     tags: [FAQs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the FAQ
   *     responses:
   *       200:
   *         description: FAQ details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FAQ'
   *       404:
   *         description: FAQ not found
   */
  router.get("/:id", controller.getFaqById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/faqs/{id}:
   *   put:
   *     summary: Update an existing FAQ
   *     tags: [FAQs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the FAQ
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               question:
   *                 type: string
   *                 description: Question text
   *               answer:
   *                 type: string
   *                 description: Answer text
   *               isActive:
   *                 type: boolean
   *                 description: Whether the FAQ is active
   *     responses:
   *       200:
   *         description: FAQ updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FAQ'
   *       404:
   *         description: FAQ not found
   */
  router.put("/:id", controller.updateFaq.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/faqs/{id}:
   *   delete:
   *     summary: Delete a FAQ
   *     tags: [FAQs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the FAQ
   *     responses:
   *       204:
   *         description: FAQ deleted successfully
   *       404:
   *         description: FAQ not found
   */
  router.delete("/:id", controller.deleteFaq.bind(controller))

  return router
}
