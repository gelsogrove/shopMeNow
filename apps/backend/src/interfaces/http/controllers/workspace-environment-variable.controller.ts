/**
 * WorkspaceEnvironmentVariableController
 *
 * HTTP endpoints for secure credential management
 *
 * Security:
 * - 🔐 All endpoints require authentication
 * - 👥 Workspace ownership verified (IDOR prevention)
 * - 🚫 READ endpoint never returns encrypted values (metadata only)
 * - 📝 All operations logged for audit trail
 *
 * Endpoints:
 * - GET    /workspaces/:workspaceId/env-vars              List all variables
 * - POST   /workspaces/:workspaceId/env-vars              Create new variable
 * - PATCH  /workspaces/:workspaceId/env-vars/:name        Update variable
 * - DELETE /workspaces/:workspaceId/env-vars/:name        Delete variable
 */

import { Request, Response } from 'express'
import { PrismaClient } from '@echatbot/database'
import { WorkspaceEnvironmentVariableService } from '../../../application/services/workspace-environment-variable.service'
import logger from '../../../utils/logger'

export class WorkspaceEnvironmentVariableController {
  private service: WorkspaceEnvironmentVariableService

  constructor(private prisma: PrismaClient) {
    this.service = new WorkspaceEnvironmentVariableService(prisma)
  }

  /**
   * GET /workspaces/:workspaceId/env-vars
   *
   * List all environment variables for the workspace
   * 🔐 Returns metadata only - NEVER returns encrypted values or plain credentials
   */
  async listVariables(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId // Set by middleware
      const userId = (req as any).user?.id // Set by authMiddleware

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const variables = await this.service.listVariables(workspaceId, userId)

      /**
       * @swagger
       * /api/workspaces/{workspaceId}/env-vars:
       *   get:
       *     summary: List all environment variables for workspace
       *     tags: [Environment Variables]
       *     security:
       *       - bearerAuth: []
       *     parameters:
       *       - in: path
       *         name: workspaceId
       *         required: true
       *         schema:
       *           type: string
       *     responses:
       *       200:
       *         description: List of environment variable metadata
       *         content:
       *           application/json:
       *             schema:
       *               type: array
       *               items:
       *                 type: object
       *                 properties:
       *                   id:
       *                     type: string
       *                   variableName:
       *                     type: string
       *                   description:
       *                     type: string
       *                     nullable: true
       *                   createdAt:
       *                     type: string
       *                     format: date-time
       *       401:
       *         description: Unauthorized
       *       403:
       *         description: Access denied to workspace
       *       500:
       *         description: Server error
       */

      res.json({
        data: variables,
        count: variables.length,
      })
    } catch (error) {
      logger.error('❌ Failed to list environment variables:', error)
      res.status(500).json({
        error: 'Failed to list environment variables',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * POST /workspaces/:workspaceId/env-vars
   *
   * Create a new environment variable
   * 📝 Variable name must be UPPERCASE_WITH_UNDERSCORES
   * 🔐 Plaintext is encrypted before storage
   */
  async createVariable(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId // Set by middleware
      const userId = (req as any).user?.id // Set by authMiddleware

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const { variableName, plaintext, description } = req.body

      // Validate required fields
      if (!variableName || typeof variableName !== 'string') {
        res.status(400).json({
          error: 'Invalid input',
          details: 'variableName is required and must be a string',
        })
        return
      }

      if (!plaintext || typeof plaintext !== 'string') {
        res.status(400).json({
          error: 'Invalid input',
          details: 'plaintext is required and must be a string',
        })
        return
      }

      const result = await this.service.createVariable(workspaceId, userId, {
        variableName: variableName.trim(),
        plaintext,  // Never trim credentials - spaces may be significant
        description: description ? description.trim() : undefined,
      })

      /**
       * @swagger
       * /api/workspaces/{workspaceId}/env-vars:
       *   post:
       *     summary: Create a new environment variable
       *     tags: [Environment Variables]
       *     security:
       *       - bearerAuth: []
       *     parameters:
       *       - in: path
       *         name: workspaceId
       *         required: true
       *         schema:
       *           type: string
       *     requestBody:
       *       required: true
       *       content:
       *         application/json:
       *           schema:
       *             type: object
       *             required:
       *               - variableName
       *               - plaintext
       *             properties:
       *               variableName:
       *                 type: string
       *                 example: STRIPE_API_KEY
       *                 description: Uppercase with underscores only
       *               plaintext:
       *                 type: string
       *                 description: The credential value (will be encrypted)
       *               description:
       *                 type: string
       *                 example: Stripe production API key
       *     responses:
       *       201:
       *         description: Variable created successfully
       *       400:
       *         description: Validation error (invalid name format, duplicate, etc)
       *       401:
       *         description: Unauthorized
       *       403:
       *         description: Access denied to workspace
       *       500:
       *         description: Server error
       */

      res.status(201).json({
        data: result,
        message: `Environment variable "${result.variableName}" created successfully`,
      })
    } catch (error) {
      logger.error('❌ Failed to create environment variable:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Return 400 for validation errors
      if (errorMessage.includes('Invalid variable name') || errorMessage.includes('already exists')) {
        res.status(400).json({
          error: 'Validation error',
          message: errorMessage,
        })
        return
      }

      res.status(500).json({
        error: 'Failed to create environment variable',
        message: errorMessage,
      })
    }
  }

  /**
   * PATCH /workspaces/:workspaceId/env-vars/:variableName
   *
   * Update an environment variable (credential rotation)
   * 🔐 New plaintext is encrypted with a fresh nonce
   */
  async updateVariable(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId // Set by middleware
      const userId = (req as any).user?.id // Set by authMiddleware
      const { variableName } = req.params

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const { plaintext, description } = req.body

      // Validate required fields
      if (!plaintext || typeof plaintext !== 'string') {
        res.status(400).json({
          error: 'Invalid input',
          details: 'plaintext is required and must be a string',
        })
        return
      }

      const result = await this.service.updateVariable(
        workspaceId,
        userId,
        variableName,
        {
          plaintext,  // Never trim credentials - spaces may be significant
          description: description ? description.trim() : undefined,
        }
      )

      /**
       * @swagger
       * /api/workspaces/{workspaceId}/env-vars/{variableName}:
       *   patch:
       *     summary: Update an environment variable (credential rotation)
       *     tags: [Environment Variables]
       *     security:
       *       - bearerAuth: []
       *     parameters:
       *       - in: path
       *         name: workspaceId
       *         required: true
       *         schema:
       *           type: string
       *       - in: path
       *         name: variableName
       *         required: true
       *         schema:
       *           type: string
       *     requestBody:
       *       required: true
       *       content:
       *         application/json:
       *           schema:
       *             type: object
       *             required:
       *               - plaintext
       *             properties:
       *               plaintext:
       *                 type: string
       *                 description: The new credential value (will be encrypted with fresh nonce)
       *               description:
       *                 type: string
       *     responses:
       *       200:
       *         description: Variable updated successfully
       *       400:
       *         description: Validation error
       *       401:
       *         description: Unauthorized
       *       403:
       *         description: Access denied to workspace
       *       404:
       *         description: Variable not found
       *       500:
       *         description: Server error
       */

      res.json({
        data: result,
        message: `Environment variable "${result.variableName}" updated successfully (credential rotated)`,
      })
    } catch (error) {
      logger.error('❌ Failed to update environment variable:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Return 404 for not found
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Not found',
          message: errorMessage,
        })
        return
      }

      // Return 400 for validation errors
      if (errorMessage.includes('Invalid') || errorMessage.includes('too long')) {
        res.status(400).json({
          error: 'Validation error',
          message: errorMessage,
        })
        return
      }

      res.status(500).json({
        error: 'Failed to update environment variable',
        message: errorMessage,
      })
    }
  }

  /**
   * DELETE /workspaces/:workspaceId/env-vars/:variableName
   *
   * Delete an environment variable
   */
  async deleteVariable(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId // Set by middleware
      const userId = (req as any).user?.id // Set by authMiddleware
      const { variableName } = req.params

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      await this.service.deleteVariable(workspaceId, userId, variableName)

      /**
       * @swagger
       * /api/workspaces/{workspaceId}/env-vars/{variableName}:
       *   delete:
       *     summary: Delete an environment variable
       *     tags: [Environment Variables]
       *     security:
       *       - bearerAuth: []
       *     parameters:
       *       - in: path
       *         name: workspaceId
       *         required: true
       *         schema:
       *           type: string
       *       - in: path
       *         name: variableName
       *         required: true
       *         schema:
       *           type: string
       *     responses:
       *       200:
       *         description: Variable deleted successfully
       *       401:
       *         description: Unauthorized
       *       403:
       *         description: Access denied to workspace
       *       404:
       *         description: Variable not found
       *       500:
       *         description: Server error
       */

      res.json({
        success: true,
        message: `Environment variable "${variableName}" deleted successfully`,
      })
    } catch (error) {
      logger.error('❌ Failed to delete environment variable:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Return 404 for not found
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          error: 'Not found',
          message: errorMessage,
        })
        return
      }

      res.status(500).json({
        error: 'Failed to delete environment variable',
        message: errorMessage,
      })
    }
  }
}
