import { Router } from "express"
import logger from "../../../utils/logger"
import { AgentController } from "../controllers/agent.controller"
import { asyncHandler } from "../middlewares/async.middleware"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     Agent:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: Unique ID of the agent
 *         name:
 *           type: string
 *           description: Name of the agent
 *         content:
 *           type: string
 *           description: Content/description of the agent
 *         isActive:
 *           type: boolean
 *           description: Whether the agent is active
 *         isRouter:
 *           type: boolean
 *           description: Whether the agent is a router
 *         department:
 *           type: string
 *           description: Department of the agent
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace the agent belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when the agent was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when the agent was last updated
 */

export const createAgentRouter = (): Router => {
  const router = Router({ mergeParams: true }) // Enable mergeParams to inherit workspaceId
  const agentController = new AgentController()

  logger.info("Setting up agent routes")

  // Apply auth middleware first
  router.use(authMiddleware) // ENABLED FOR PROPER AUTHENTICATION

  // Enable workspace validation middleware (this will extract workspaceId from params)
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/agent:
   *   get:
   *     summary: Get all agents for a workspace
   *     tags: [Agent]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of agents
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Agent'
   */
  router.get("/", asyncHandler(agentController.getAllForWorkspace))

  /**
   * @swagger
   * /api/agent/{id}:
   *   put:
   *     summary: Update an existing agent
   *     tags: [Agent]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: Agent updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Agent'
   *       404:
   *         description: Agent not found
   */
  router.put("/:id", asyncHandler(agentController.update))

  logger.info("Agent routes setup complete")

  return router
}
