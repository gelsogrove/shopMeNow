import { PrismaClient } from "@echatbot/database"
import { Request, Response } from "express"
import logger from "../../../utils/logger"
import { WorkspaceCallingFunctionRepository } from "../../../repositories/workspace-calling-function.repository"
import { WebhookDispatchService } from "../../../services/webhook-dispatch.service"

/**
 * Custom Calling Functions Controller
 * Handles CRUD for custom tools and webhook testing
 */
export class CallingFunctionsController {
    private repository: WorkspaceCallingFunctionRepository
    private webhookService: WebhookDispatchService

    constructor(private prisma: PrismaClient) {
        this.repository = new WorkspaceCallingFunctionRepository(prisma)
        this.webhookService = new WebhookDispatchService()
    }

    /**
     * List all functions for a workspace
     */
    async getFunctions(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            if (!workspaceId) {
                return res.status(400).json({ error: "Workspace ID required" })
            }

            const functions = await this.repository.findAllByWorkspace(workspaceId)
            return res.status(200).json({ functions })
        } catch (error) {
            logger.error("❌ Failed to get calling functions:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Create a custom function
     */
    async createFunction(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            const { functionName, description, responseInstructions, parameters, executionType, isActive, webhookUrl } = req.body

            if (!functionName || !description || !executionType) {
                return res.status(400).json({ error: "Missing required fields" })
            }

            // Check if already exists
            const existing = await this.repository.findByName(workspaceId, functionName)
            if (existing) {
                return res.status(409).json({ error: "Function already exists with this name" })
            }

            const newFunction = await this.repository.create({
                workspaceId,
                functionName,
                description,
                responseInstructions: responseInstructions || "",
                parameters: parameters || {},
                executionType,
                isActive: isActive !== undefined ? isActive : true,
                isSystemFunction: false, // Custom functions are never system functions
                webhookUrl: webhookUrl || null
            })

            logger.info(`✅ Custom function created: ${functionName} for workspace ${workspaceId}`)
            return res.status(201).json(newFunction)
        } catch (error) {
            logger.error("❌ Failed to create calling function:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Update a function
     */
    async updateFunction(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            const { functionName } = req.params
            const data = req.body

            const existing = await this.repository.findByName(workspaceId, functionName)
            if (!existing) {
                return res.status(404).json({ error: "Function not found" })
            }

            // Prevent system function restriction updates if necessary
            if (existing.isSystemFunction) {
                // Limited updates for system functions
                const allowedKeys = ['isActive', 'description'] // Maybe allow changing description?
                const restrictedKeys = Object.keys(data).filter(k => !allowedKeys.includes(k))

                if (restrictedKeys.length > 0) {
                    return res.status(403).json({
                        error: "System function restriction",
                        message: `Cannot update these fields on a system function: ${restrictedKeys.join(', ')}`
                    })
                }
            }

            const updated = await this.repository.update(workspaceId, functionName, data)
            logger.info(`✅ Function updated: ${functionName} for workspace ${workspaceId}`)
            return res.status(200).json(updated)
        } catch (error) {
            logger.error("❌ Failed to update calling function:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Delete a function
     */
    async deleteFunction(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            const { functionName } = req.params

            const existing = await this.repository.findByName(workspaceId, functionName)
            if (!existing) {
                return res.status(404).json({ error: "Function not found" })
            }

            if (existing.isSystemFunction) {
                return res.status(403).json({ error: "Cannot delete system functions" })
            }

            await this.repository.delete(workspaceId, functionName)
            logger.info(`✅ Function deleted: ${functionName} from workspace ${workspaceId}`)
            return res.status(204).send()
        } catch (error) {
            logger.error("❌ Failed to delete calling function:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Test webhook connection
     */
    async testWebhook(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            const { url, secret, timeout } = req.body

            if (!url) {
                return res.status(400).json({ error: "Webhook URL required" })
            }

            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true }
            })

            // Use provided timeout or default
            const finalTimeout = timeout || 10000

            logger.info(`🧪 Testing webhook connection for workspace ${workspaceId} to ${url}`)

            const result = await this.webhookService.dispatch({
                url,
                timeout: finalTimeout,
                payload: {
                    function: "test_connection",
                    parameters: {
                        timestamp: new Date().toISOString(),
                        test: true
                    },
                    context: {
                        workspaceId,
                        customerId: "test-user-id",
                        customerLanguage: "en"
                    }
                }
            })

            return res.status(200).json({
                success: true,
                message: "Webhook responded successfully",
                data: result
            })
        } catch (error: any) {
            logger.warn("⚠️ Webhook test failed:", error.message)
            return res.status(error.message === 'WEBHOOK_TIMEOUT' ? 408 : 400).json({
                success: false,
                error: error.message,
                message: "Webhook communication failed"
            })
        }
    }
}
