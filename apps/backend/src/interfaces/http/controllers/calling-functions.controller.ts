import { PrismaClient } from "@echatbot/database"
import { Request, Response } from "express"
import logger from "../../../utils/logger"
import { WorkspaceCallingFunctionRepository } from "../../../repositories/workspace-calling-function.repository"
import { WebhookDispatchService } from "../../../services/webhook-dispatch.service"
import { FlowSyncService } from "../../../application/services/flow-sync.service"
import { SYSTEM_FUNCTIONS_BY_NAME, SystemFunctionDef } from "../../../constants/system-functions"
import { getValidAgentTypesForMode } from "../../../utils/template-path.helper"

/**
 * Agent types that handle infrastructure tasks and are NOT valid targets
 * for DELEGATE_TO_AGENT calling functions. These agents are never user-facing
 * tools — they're internal pipeline stages (routing, security, translation).
 */
const NON_DISPATCH_AGENTS = new Set(["ROUTER", "SECURITY", "TRANSLATION", "SUMMARY_AGENT", "CONVERSATION_HISTORY"])

/**
 * Fields that cannot be changed on ANY function (system or custom).
 * functionName is the primary key within a workspace, isSystemFunction
 * prevents privilege escalation, and workspaceId/id/createdAt are DB-managed.
 */
const IMMUTABLE_KEYS = new Set(["functionName", "isSystemFunction", "workspaceId", "id", "createdAt"])

/**
 * Calling Functions Controller
 *
 * Full CRUD for workspace calling functions (both system and custom).
 * System functions are pre-defined in SYSTEM_FUNCTIONS_BY_NAME and seeded at workspace creation.
 * Custom functions are user-created (WEBHOOK, INTERNAL, DELEGATE_TO_AGENT).
 *
 * Architecture:
 *   - System functions: seeded at workspace creation via seedSystemFunctions()
 *   - channelMode is immutable after creation → no sync logic needed on update
 *   - All functions (system + custom) support full CRUD
 *   - Deleted system functions can be restored via /reinstall
 *   - Immutable fields: functionName, isSystemFunction, workspaceId, id, createdAt
 *   - attachedLlm: links DELEGATE_TO_AGENT functions to a specialist agent type
 *
 * Endpoints:
 *   GET  /                      → List all functions (filtered by workspace capabilities)
 *   GET  /agent-types           → Valid agent types for DELEGATE_TO_AGENT dropdown
 *   GET  /system-missing        → System functions not currently installed
 *   POST /                      → Create custom function
 *   POST /test-webhook          → Test webhook connectivity
 *   PATCH /:functionName        → Update any function (respects immutable fields)
 *   DELETE /:functionName       → Hard delete any function
 *   POST /:functionName/reinstall → Restore system function to factory defaults
 */
export class CallingFunctionsController {
    private repository: WorkspaceCallingFunctionRepository
    private webhookService: WebhookDispatchService
    private flowSyncService: FlowSyncService

    constructor(private prisma: PrismaClient) {
        this.repository = new WorkspaceCallingFunctionRepository(prisma)
        this.webhookService = new WebhookDispatchService()
        this.flowSyncService = new FlowSyncService(prisma)
    }

    /**
     * List all functions for a workspace.
     * Also ensures always-available system functions (changeLanguage, etc.) exist — lazy migration pattern.
     */
    async getFunctions(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            if (!workspaceId) {
                return res.status(400).json({ error: "Workspace ID required" })
            }

            // Lazy migration: ensure changeLanguage exists for workspaces created BEFORE
            // this function was added to ALWAYS_AVAILABLE_FUNCTIONS in system-functions.ts.
            // New workspaces get it via seedSystemFunctions(). This can be removed once all
            // production workspaces have been migrated (i.e. after one full API call cycle).
            try {
                await this.prisma.workspaceCallingFunction.upsert({
                    where: { workspaceId_functionName: { workspaceId, functionName: "changeLanguage" } },
                    update: {},
                    create: {
                        workspaceId,
                        functionName: "changeLanguage",
                        description: "Change the customer's preferred language. Supported: Italian (it), English (en), Spanish (es), Portuguese (pt).",
                        parameters: {
                            type: "object",
                            properties: {
                                language: { type: "string", enum: ["it", "en", "es", "pt"], description: "ISO 639-1 language code" }
                            },
                            required: ["language"]
                        },
                        isSystemFunction: true,
                        executionType: "INTERNAL",
                        isActive: true
                    }
                })
            } catch (syncError) {
                logger.warn("⚠️ Failed to ensure changeLanguage for workspace (non-fatal):", syncError)
            }

            const functions = await this.repository.findAllByWorkspace(workspaceId)

            // Hide system functions based on feature flags
            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    enableCalendarBooking: true,
                    hasHumanSupport: true,
                    hasProductCatalog: true,
                    hasCart: true,
                    hasOrderTracking: true,
                    needRegistration: true,
                    channelMode: true,
                }
            })
            const APPOINTMENT_FN_NAMES = ["bookAppointment", "cancelAppointment", "getCustomerAppointments", "listAvailableSlots", "rescheduleAppointment"]
            const filteredFunctions = functions.filter(f => {
                if (!f.isSystemFunction) return true
                if (APPOINTMENT_FN_NAMES.includes(f.functionName) && !workspace?.enableCalendarBooking) return false
                if (f.functionName === "productSearchAgent" && !workspace?.hasProductCatalog) return false
                if (f.functionName === "cartManagementAgent" && !workspace?.hasCart) return false
                if (f.functionName === "orderTrackingAgent" && !workspace?.hasOrderTracking) return false
                if (f.functionName === "customerSupportAgent" && !workspace?.hasHumanSupport) return false
                if (f.functionName === "profileManagementAgent" && !workspace?.needRegistration) return false
                return true
            })

            return res.status(200).json({ functions: filteredFunctions })
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
            const { functionName, description, responseInstructions, parameters, executionType, isActive, webhookUrl, credentialsMapping, attachedLlm, attachedFlowKey } = req.body

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
                webhookUrl: webhookUrl || null,
                credentialsMapping: credentialsMapping || null,
                attachedLlm: attachedLlm || null,
                attachedFlowKey: attachedFlowKey || null,
            })

            // Auto-add DELEGATE_TO_AGENT to Router's availableFunctions
            if (executionType === "DELEGATE_TO_AGENT") {
                try {
                    await this.flowSyncService.addDelegateToRouter(workspaceId, functionName)
                } catch (syncError) {
                    logger.warn(`[FlowSync] Non-fatal: failed to add ${functionName} to Router:`, syncError)
                }
            }

            logger.info(`✅ Custom function created: ${functionName} for workspace ${workspaceId}`)
            return res.status(201).json(newFunction)
        } catch (error) {
            logger.error("❌ Failed to create calling function:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Update a function.
     * `functionName` and `isSystemFunction` are immutable and cannot be changed on any function.
     * All other fields are editable for both system and custom functions.
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

            // Reject attempts to change immutable fields on any function
            const blockedKeys = Object.keys(data).filter(k => IMMUTABLE_KEYS.has(k))
            if (blockedKeys.length > 0) {
                return res.status(403).json({
                    error: "Cannot modify immutable fields",
                    message: `These fields cannot be changed: ${blockedKeys.join(', ')}`
                })
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
     * Delete a function (system or custom).
     * Hard delete — no soft delete.
     */
    async deleteFunction(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            const { functionName } = req.params

            const existing = await this.repository.findByName(workspaceId, functionName)
            if (!existing) {
                return res.status(404).json({ error: "Function not found" })
            }

            await this.repository.delete(workspaceId, functionName)

            // Cascade: clean up FlowNodeConfig references to this function
            try {
                await this.flowSyncService.cleanupOrphanedReferences(workspaceId, functionName)
            } catch (syncError) {
                logger.warn(`[FlowSync] Non-fatal: failed to cleanup references for ${functionName}:`, syncError)
            }

            logger.info(`✅ Function deleted: ${functionName} from workspace ${workspaceId}`)
            return res.status(204).send()
        } catch (error) {
            logger.error("❌ Failed to delete calling function:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Returns system functions that are valid for this workspace but NOT currently installed.
     * Used by the UI to show a "Reinstall" section for accidentally-deleted system functions.
     */
    async getMissingSystemFunctions(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId

            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    enableCalendarBooking: true,
                    hasHumanSupport: true,
                    hasProductCatalog: true,
                    hasCart: true,
                    hasOrderTracking: true,
                    needRegistration: true,
                    channelMode: true,
                }
            })
            if (!workspace) {
                return res.status(404).json({ error: "Workspace not found" })
            }

            const installedFunctions = await this.repository.findAllByWorkspace(workspaceId)
            const installedNames = new Set(installedFunctions.map(f => f.functionName))

            const APPOINTMENT_FN_NAMES = ["bookAppointment", "cancelAppointment", "getCustomerAppointments", "listAvailableSlots", "rescheduleAppointment"]

            const missing: SystemFunctionDef[] = []
            for (const [name, fnDef] of SYSTEM_FUNCTIONS_BY_NAME) {
                if (installedNames.has(name)) continue
                if (APPOINTMENT_FN_NAMES.includes(name) && !workspace.enableCalendarBooking) continue
                if (name === "productSearchAgent" && !workspace.hasProductCatalog) continue
                if (name === "cartManagementAgent" && !workspace.hasCart) continue
                if (name === "orderTrackingAgent" && !workspace.hasOrderTracking) continue
                if (name === "customerSupportAgent" && !workspace.hasHumanSupport) continue
                if (name === "profileManagementAgent" && !workspace.needRegistration) continue
                missing.push(fnDef)
            }

            return res.status(200).json({ missing })
        } catch (error) {
            logger.error("❌ Failed to get missing system functions:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Returns valid DELEGATE_TO_AGENT types for the workspace's channelMode.
     * Excludes infrastructure agents (ROUTER, SECURITY, etc.) — only specialist agents capable of handling user requests.
     */
    async getAgentTypes(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId

            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { channelMode: true }
            })
            if (!workspace) {
                return res.status(404).json({ error: "Workspace not found" })
            }

            const allTypes = getValidAgentTypesForMode(workspace.channelMode as any)
            const agentTypes = allTypes.filter(t => !NON_DISPATCH_AGENTS.has(t))

            return res.status(200).json({ agentTypes })
        } catch (error) {
            logger.error("❌ Failed to get agent types:", error)
            return res.status(500).json({ error: "Internal server error" })
        }
    }

    /**
     * Reinstall a system function to its factory defaults.
     * Validates that the functionName is a known system function, then upserts it.
     * Used to restore accidentally deleted or modified system functions.
     */
    async reinstallFunction(req: Request, res: Response) {
        try {
            const workspaceId = (req as any).workspaceId
            const { functionName } = req.params

            const fnDef = SYSTEM_FUNCTIONS_BY_NAME.get(functionName)
            if (!fnDef) {
                return res.status(400).json({
                    error: "Not a valid system function",
                    message: `"${functionName}" is not a known system function`
                })
            }

            // Upsert: create if missing, restore to defaults if modified
            const result = await this.prisma.workspaceCallingFunction.upsert({
                where: { workspaceId_functionName: { workspaceId, functionName } },
                update: { ...fnDef, workspaceId },
                create: { ...fnDef, workspaceId },
            })

            logger.info(`✅ Reinstalled system function "${functionName}" for workspace ${workspaceId}`)
            return res.status(200).json(result)
        } catch (error) {
            logger.error("❌ Failed to reinstall function:", error)
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
