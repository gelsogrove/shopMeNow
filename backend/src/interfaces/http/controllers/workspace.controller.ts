import { NextFunction, Request, Response } from "express"
import { WorkspaceService } from "../../../application/services/workspace.service"
import logger from "../../../utils/logger"

export class WorkspaceController {
  private workspaceService: WorkspaceService

  constructor() {
    this.workspaceService = new WorkspaceService()
  }

  /**
   * Get all workspaces
   */
  getAllWorkspaces = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      logger.info("Getting all workspaces")
      const workspaces = await this.workspaceService.getAll()

      // Serialize workspaces to plain objects with all properties
      const serializedWorkspaces = workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
        whatsappApiKey: workspace.whatsappApiKey, // ✅ FIXED: Use whatsappApiKey instead of whatsappApiToken
        webhookUrl: workspace.webhookUrl,
        notificationEmail: workspace.notificationEmail,
        adminEmail: workspace.adminEmail, // Explicitly include adminEmail
        language: workspace.language,
        currency: workspace.currency,
        messageLimit: workspace.messageLimit,
        blocklist: workspace.blocklist,
        welcomeMessages: workspace.welcomeMessages,
        wipMessages: workspace.wipMessages,
        challengeStatus: workspace.challengeStatus,
        isActive: workspace.isActive,
        isDelete: workspace.isDelete,
        url: workspace.url,
        debugMode: workspace.debugMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      }))

      return res.json(serializedWorkspaces)
    } catch (error) {
      logger.error("Error fetching workspaces:", error)
      return next(error)
    }
  }

  /**
   * Get a workspace by ID
   */
  getWorkspaceById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params
      logger.info(`Getting workspace ${id}`)

      if (!id) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        const workspace = await this.workspaceService.getById(id)

        if (!workspace) {
          return res.status(404).json({ message: "Workspace not found" })
        }

        // Serialize workspace to plain object with all properties
        const serializedWorkspace = {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          whatsappPhoneNumber: workspace.whatsappPhoneNumber,
          whatsappApiKey: workspace.whatsappApiKey, // ✅ FIXED: Use whatsappApiKey instead of whatsappApiToken
          webhookUrl: workspace.webhookUrl,
          notificationEmail: workspace.notificationEmail,
          adminEmail: workspace.adminEmail, // Explicitly include adminEmail
          language: workspace.language,
          currency: workspace.currency,
          messageLimit: workspace.messageLimit,
          blocklist: workspace.blocklist,
          welcomeMessages: workspace.welcomeMessages,
          wipMessages: workspace.wipMessages,
          challengeStatus: workspace.challengeStatus,
          isActive: workspace.isActive,
          isDelete: workspace.isDelete,
          url: workspace.url,
          debugMode: workspace.debugMode,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        }

        return res.json(serializedWorkspace)
      } catch (serviceError) {
        logger.error(`Service error fetching workspace ${id}:`, serviceError)
        // Restituisci un errore più specifico basato sull'errore del servizio
        return res.status(500).json({
          error: "Failed to retrieve workspace",
          details:
            serviceError instanceof Error
              ? serviceError.message
              : "Unknown error",
        })
      }
    } catch (error) {
      logger.error(
        `Error in workspace controller for ID ${req.params.id}:`,
        error
      )
      return next(error)
    }
  }

  /**
   * Create a new workspace
   */
  createWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info("Creating new workspace")
      const workspaceData = req.body

      const workspace = await this.workspaceService.create(workspaceData)
      return res.status(201).json(workspace)
    } catch (error) {
      logger.error("Error creating workspace:", error)
      return next(error)
    }
  }

  /**
   * Update a workspace
   */
  updateWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const workspaceData = req.body

      logger.info(`Updating workspace ${id}`)
      logger.info(
        `📦 Workspace data received: ${JSON.stringify(workspaceData, null, 2)}`
      )

      const workspace = await this.workspaceService.update(id, workspaceData)

      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" })
      }

      // Serialize workspace to plain object with all properties (same as getWorkspaceById)
      const serializedWorkspace = {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
        whatsappApiKey: workspace.whatsappApiKey,
        webhookUrl: workspace.webhookUrl,
        notificationEmail: workspace.notificationEmail,
        adminEmail: workspace.adminEmail,
        language: workspace.language,
        currency: workspace.currency,
        messageLimit: workspace.messageLimit,
        blocklist: workspace.blocklist,
        welcomeMessages: workspace.welcomeMessages,
        wipMessages: workspace.wipMessages,
        challengeStatus: workspace.challengeStatus,
        isActive: workspace.isActive,
        isDelete: workspace.isDelete,
        url: workspace.url,
        debugMode: workspace.debugMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      }

      logger.info(
        `✅ Workspace serialized and ready to return: ${JSON.stringify(serializedWorkspace, null, 2)}`
      )
      return res.json(serializedWorkspace)
    } catch (error) {
      logger.error(`Error updating workspace ${req.params.id}:`, error)
      return next(error)
    }
  }

  /**
   * Delete a workspace
   */
  deleteWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      logger.info(`Deleting workspace ${id}`)

      const result = await this.workspaceService.delete(id)

      if (!result) {
        return res.status(404).json({ message: "Workspace not found" })
      }

      return res.status(204).send()
    } catch (error) {
      logger.error(`Error deleting workspace ${req.params.id}:`, error)
      return next(error)
    }
  }
}
