import { Router } from "express"
import { SalesController } from "../controllers/sales.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     Sales:
 *       type: object
 *       required:
 *         - id
 *         - firstName
 *         - lastName
 *         - email
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: Unique ID of the salesperson
 *         firstName:
 *           type: string
 *           description: First name of the salesperson
 *         lastName:
 *           type: string
 *           description: Last name of the salesperson
 *         email:
 *           type: string
 *           description: Email of the salesperson
 *         phone:
 *           type: string
 *           description: Phone number of the salesperson
 *         isActive:
 *           type: boolean
 *           description: Indicates if the salesperson is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace to which the salesperson belongs
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date of the salesperson
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date of the salesperson
 */

export const salesRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new SalesController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/sales:
   *   get:
   *     summary: Get all sales for a workspace
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: Workspace ID
   *     responses:
   *       200:
   *         description: List of sales
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Sales'
   */
  router.get("/", controller.getAllSales.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/sales:
   *   post:
   *     summary: Create a new salesperson
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: Workspace ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - firstName
   *               - lastName
   *               - email
   *             properties:
   *               firstName:
   *                 type: string
   *                 description: First name of the salesperson
   *               lastName:
   *                 type: string
   *                 description: Last name of the salesperson
   *               email:
   *                 type: string
   *                 description: Email of the salesperson
   *               phone:
   *                 type: string
   *                 description: Phone number of the salesperson
   *               isActive:
   *                 type: boolean
   *                 description: Indicates if the salesperson is active
   *                 default: true
   *     responses:
   *       201:
   *         description: Salesperson created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Sales'
   */
  router.post("/", controller.createSales.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/sales/{id}/has-customers:
   *   get:
   *     summary: Check if a salesperson has associated customers
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: Workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Salesperson ID
   *     responses:
   *       200:
   *         description: Salesperson status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 hasCustomers:
   *                   type: boolean
   *                   description: Indicates if the salesperson has associated customers
   */
  router.get("/:id/has-customers", controller.hasCustomers.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/sales/{id}:
   *   get:
   *     summary: Get a specific salesperson
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: Workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Salesperson ID
   *     responses:
   *       200:
   *         description: Salesperson details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Sales'
   *       404:
   *         description: Salesperson not found
   */
  router.get("/:id", controller.getSalesById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/sales/{id}:
   *   put:
   *     summary: Update an existing salesperson
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: Workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Salesperson ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               firstName:
   *                 type: string
   *                 description: First name of the salesperson
   *               lastName:
   *                 type: string
   *                 description: Last name of the salesperson
   *               email:
   *                 type: string
   *                 description: Email of the salesperson
   *               phone:
   *                 type: string
   *                 description: Phone number of the salesperson
   *               isActive:
   *                 type: boolean
   *                 description: Indicates if the salesperson is active
   *     responses:
   *       200:
   *         description: Salesperson updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Sales'
   *       404:
   *         description: Salesperson not found
   */
  router.put("/:id", controller.updateSales.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/sales/{id}:
   *   delete:
   *     summary: Delete a salesperson
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: Workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Salesperson ID
   *     responses:
   *       204:
   *         description: Salesperson deleted successfully
   *       404:
   *         description: Salesperson not found
   *       409:
   *         description: Cannot delete salesperson (has assigned customers)
   */
  router.delete("/:id", controller.deleteSales.bind(controller))

  return router
}
