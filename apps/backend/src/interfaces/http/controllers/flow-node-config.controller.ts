/**
 * FlowNodeConfig Controller — CRUD for Flow workspace configurations
 *
 * Manages FlowNodeConfig records (machine troubleshooting configs)
 * used by FlowWorkspaceStrategy and FlowAgentLLM.
 *
 * All endpoints require workspace-scoped auth (3-layer middleware).
 */

import { Request, Response } from "express"
import { PrismaClient } from "@echatbot/database"
import { FlowNodeConfigRepository } from "../../../repositories/flow-node-config.repository"
import { FlowJsonValidator } from "../../../application/services/flow-json-validator.service"
import { FlowSyncService } from "../../../application/services/flow-sync.service"
import logger from "../../../utils/logger"

export class FlowNodeConfigController {
  private repository: FlowNodeConfigRepository
  private validator: FlowJsonValidator
  private flowSyncService: FlowSyncService

  constructor(private prisma: PrismaClient) {
    this.repository = new FlowNodeConfigRepository(prisma)
    this.validator = new FlowJsonValidator()
    this.flowSyncService = new FlowSyncService(prisma)
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/flow-configs:
   *   get:
   *     summary: Get all flow configs for workspace
   *     tags: [FlowConfigs]
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
   *         description: List of flow configs
   *       401:
   *         description: Unauthorized
   */
  async getAll(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId
      const configs = await this.repository.findAllByWorkspace(workspaceId)
      return res.json(configs)
    } catch (error) {
      logger.error("Error getting flow configs:", error)
      return res.status(500).json({
        error: "Failed to get flow configs",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/flow-configs/{id}:
   *   get:
   *     summary: Get flow config by ID
   *     tags: [FlowConfigs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Flow config object
   *       404:
   *         description: Not found
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId
      const config = await this.repository.findById(workspaceId, id)

      if (!config) {
        return res.status(404).json({ error: "Flow config not found" })
      }
      return res.json(config)
    } catch (error) {
      logger.error("Error getting flow config:", error)
      return res.status(500).json({
        error: "Failed to get flow config",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/flow-configs:
   *   post:
   *     summary: Create new flow config
   *     tags: [FlowConfigs]
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
   *               - flowKey
   *               - flowLabel
   *             properties:
   *               flowKey:
   *                 type: string
   *               flowLabel:
   *                 type: string
   *               systemPrompt:
   *                 type: string
   *               model:
   *                 type: string
   *               temperature:
   *                 type: number
   *               maxTokens:
   *                 type: integer
   *               availableFunctions:
   *                 type: array
   *               flows:
   *                 type: object
   *               isActive:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Created
   *       400:
   *         description: Bad request
   *       409:
   *         description: Duplicate flowKey
   */
  async create(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId
      const { flowKey, flowLabel, systemPrompt, model, temperature, maxTokens, availableFunctions, flows, isActive } = req.body

      if (!flowKey || !flowLabel) {
        return res.status(400).json({ error: "flowKey and flowLabel are required" })
      }

      // Validate flows JSON structure if provided (skip for empty objects — e.g. Router has no flows)
      if (flows && typeof flows === "object" && Object.keys(flows).length > 0) {
        const validation = this.validator.validate(flows)
        if (!validation.valid) {
          return res.status(400).json({
            error: "Invalid flow JSON structure",
            validationErrors: validation.errors,
            warnings: validation.warnings,
            stats: validation.stats,
          })
        }
      } else if (flows && typeof flows !== "object") {
        return res.status(400).json({ error: "flows must be a valid JSON object" })
      }

      const config = await this.repository.create(workspaceId, {
        flowKey,
        flowLabel,
        systemPrompt,
        model,
        temperature,
        maxTokens,
        availableFunctions,
        flows,
        isActive,
      })

      logger.info(`Flow config created: ${config.id} (${flowKey})`)

      // Auto-create DELEGATE_TO_AGENT calling function + add to Router
      try {
        await this.flowSyncService.ensureCallingFunctionForFlow(workspaceId, config.flowKey, config.flowLabel)
      } catch (syncError) {
        logger.warn(`[FlowSync] Non-fatal: failed to sync calling function for ${flowKey}:`, syncError)
      }

      return res.status(201).json(config)
    } catch (error: any) {
      logger.error("Error creating flow config:", error)

      // Prisma unique constraint violation
      if (error?.code === "P2002") {
        return res.status(409).json({ error: "A flow config with this flowKey already exists in this workspace" })
      }

      return res.status(500).json({
        error: "Failed to create flow config",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/flow-configs/{id}:
   *   put:
   *     summary: Update flow config
   *     tags: [FlowConfigs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               flowLabel:
   *                 type: string
   *               systemPrompt:
   *                 type: string
   *               model:
   *                 type: string
   *               temperature:
   *                 type: number
   *               maxTokens:
   *                 type: integer
   *               availableFunctions:
   *                 type: array
   *               flows:
   *                 type: object
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Updated
   *       404:
   *         description: Not found
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId
      const { flowLabel, systemPrompt, model, temperature, maxTokens, availableFunctions, flows, isActive } = req.body

      // Validate flows JSON structure if provided (skip for empty objects — Router has no flows)
      if (flows !== undefined && flows !== null) {
        if (typeof flows !== "object") {
          return res.status(400).json({ error: "flows must be a valid JSON object" })
        }
        if (Object.keys(flows).length > 0) {
          const validation = this.validator.validate(flows)
          if (!validation.valid) {
            return res.status(400).json({
              error: "Invalid flow JSON structure",
              validationErrors: validation.errors,
              warnings: validation.warnings,
              stats: validation.stats,
            })
          }
        }
      }

      const config = await this.repository.update(workspaceId, id, {
        flowLabel,
        systemPrompt,
        model,
        temperature,
        maxTokens,
        availableFunctions,
        flows,
        isActive,
      })

      logger.info(`Flow config updated: ${id}`)

      // Sync calling function description if label changed
      if (flowLabel && config.flowKey) {
        try {
          await this.flowSyncService.updateCallingFunctionLabel(workspaceId, config.flowKey, flowLabel)
        } catch (syncError) {
          logger.warn(`[FlowSync] Non-fatal: failed to sync label for ${config.flowKey}:`, syncError)
        }
      }

      return res.json(config)
    } catch (error: any) {
      logger.error("Error updating flow config:", error)

      if (error?.message === "Flow config not found") {
        return res.status(404).json({ error: "Flow config not found" })
      }

      return res.status(500).json({
        error: "Failed to update flow config",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/flow-configs/{id}:
   *   delete:
   *     summary: Delete flow config
   *     tags: [FlowConfigs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Deleted
   *       404:
   *         description: Not found
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      // Get config before deleting to know the flowKey for cascade
      const configToDelete = await this.repository.findById(workspaceId, id)

      // Cascade: remove associated calling function + clean Router
      if (configToDelete) {
        try {
          await this.flowSyncService.removeCallingFunctionForFlow(workspaceId, configToDelete.flowKey)
        } catch (syncError) {
          logger.warn(`[FlowSync] Non-fatal: failed to cleanup for ${configToDelete.flowKey}:`, syncError)
        }
      }

      await this.repository.delete(workspaceId, id)
      logger.info(`Flow config deleted: ${id}`)
      return res.json({ message: "Flow config deleted successfully" })
    } catch (error: any) {
      logger.error("Error deleting flow config:", error)

      if (error?.message === "Flow config not found") {
        return res.status(404).json({ error: "Flow config not found" })
      }

      return res.status(500).json({
        error: "Failed to delete flow config",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/flow-configs/schema-guide:
   *   get:
   *     summary: Get flow JSON schema documentation and examples
   *     tags: [FlowConfigs]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Schema guide with rules, types, and examples
   */
  async getSchemaGuide(_req: Request, res: Response) {
    return res.json(FlowJsonValidator.getSchemaGuide())
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/flow-configs/validate:
   *   post:
   *     summary: Validate flow JSON without saving
   *     tags: [FlowConfigs]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - flows
   *             properties:
   *               flows:
   *                 type: object
   *     responses:
   *       200:
   *         description: Validation result
   */
  async validateFlows(req: Request, res: Response) {
    const { flows } = req.body
    if (!flows) {
      return res.status(400).json({ error: "flows field is required" })
    }
    const result = this.validator.validate(flows)
    return res.json(result)
  }
}
