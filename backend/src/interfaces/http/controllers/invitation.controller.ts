import { Request, Response, NextFunction } from "express"
import {
  WorkspaceInvitationService,
  workspaceInvitationService,
} from "../../../application/services/workspace-invitation.service"
import logger from "../../../utils/logger"

export class InvitationController {
  private invitationService: WorkspaceInvitationService

  constructor(invitationService?: WorkspaceInvitationService) {
    this.invitationService = invitationService || workspaceInvitationService
  }

  /**
   * Create a new invitation
   * POST /api/workspaces/:workspaceId/invitations
   * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
   */
  createInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const invitedById = (req as any).user?.id
      const { email } = req.body

      if (!email) {
        res.status(400).json({
          error: "Bad Request",
          message: "Email is required",
        })
        return
      }

      if (!invitedById) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        })
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: "Bad Request",
          message: "Invalid email format",
        })
        return
      }

      logger.info(
        `Creating invitation for ${email} to workspace ${workspaceId.substring(0, 8)}...`
      )

      const result = await this.invitationService.createInvitation({
        workspaceId,
        email,
        invitedById,
      })

      if (!result.success) {
        res.status(400).json({
          error: "Bad Request",
          message: result.error,
        })
        return
      }

      res.status(201).json({
        success: true,
        message: "Invitation sent successfully",
        invitation: result.invitation,
      })
    } catch (error) {
      logger.error("Error creating invitation:", error)
      if (error instanceof Error && error.message === "Failed to send invitation email") {
        res.status(500).json({
          error: "Email Error",
          message: "Failed to send invitation email. Please try again later.",
        })
        return
      }
      next(error)
    }
  }

  /**
   * Get pending invitations for a workspace
   * GET /api/workspaces/:workspaceId/invitations
   * Requires: authMiddleware, validateWorkspaceOperation, requireWorkspaceMember
   */
  getPendingInvitations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      const invitations =
        await this.invitationService.getPendingInvitations(workspaceId)

      res.json({
        success: true,
        invitations,
      })
    } catch (error) {
      logger.error("Error fetching invitations:", error)
      next(error)
    }
  }

  /**
   * Cancel a pending invitation
   * DELETE /api/workspaces/:workspaceId/invitations/:invitationId
   * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
   */
  cancelInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const { invitationId } = req.params

      if (!invitationId) {
        res.status(400).json({
          error: "Bad Request",
          message: "Invitation ID is required",
        })
        return
      }

      const result = await this.invitationService.cancelInvitation(
        invitationId,
        workspaceId
      )

      if (!result.success) {
        res.status(400).json({
          error: "Bad Request",
          message: result.error,
        })
        return
      }

      res.json({
        success: true,
        message: "Invitation cancelled successfully",
      })
    } catch (error) {
      logger.error("Error cancelling invitation:", error)
      next(error)
    }
  }

  /**
   * Resend an invitation
   * POST /api/workspaces/:workspaceId/invitations/:invitationId/resend
   * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
   */
  resendInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const { invitationId } = req.params
      const resenderId = (req as any).user?.id

      if (!invitationId) {
        res.status(400).json({
          error: "Bad Request",
          message: "Invitation ID is required",
        })
        return
      }

      const result = await this.invitationService.resendInvitation(
        invitationId,
        workspaceId,
        resenderId
      )

      if (!result.success) {
        res.status(400).json({
          error: "Bad Request",
          message: result.error,
        })
        return
      }

      res.json({
        success: true,
        message: "Invitation resent successfully",
      })
    } catch (error) {
      logger.error("Error resending invitation:", error)
      next(error)
    }
  }

  /**
   * Validate an invitation token (public endpoint)
   * GET /api/invitations/validate/:token
   * No auth required
   */
  validateToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { token } = req.params

      if (!token) {
        res.status(400).json({
          error: "Bad Request",
          message: "Token is required",
        })
        return
      }

      const invitationInfo = await this.invitationService.validateToken(token)

      if (!invitationInfo) {
        res.status(404).json({
          error: "Not Found",
          message: "Invalid invitation token",
        })
        return
      }

      res.json({
        success: true,
        invitation: invitationInfo,
      })
    } catch (error) {
      logger.error("Error validating token:", error)
      next(error)
    }
  }

  /**
   * Accept an invitation (public endpoint for existing users)
   * POST /api/invitations/accept
   * No auth required - token is sufficient
   */
  acceptInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { token } = req.body

      if (!token) {
        res.status(400).json({
          error: "Bad Request",
          message: "Token is required",
        })
        return
      }

      const result = await this.invitationService.acceptInvitation({ token })

      if (!result.success) {
        // Determine appropriate status code based on error
        let statusCode = 400
        if (result.error === "Invalid invitation token") {
          statusCode = 404
        } else if (result.error === "Invitation has expired") {
          statusCode = 410 // Gone
        }

        res.status(statusCode).json({
          error: "Invitation Error",
          message: result.error,
        })
        return
      }

      res.json({
        success: true,
        message: "Invitation accepted successfully",
        workspaceId: result.workspaceId,
      })
    } catch (error) {
      logger.error("Error accepting invitation:", error)
      next(error)
    }
  }
}

export const invitationController = new InvitationController()
