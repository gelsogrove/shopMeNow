import { Request, Response, NextFunction } from "express"
import {
  WorkspaceMemberService,
  workspaceMemberService,
} from "../../../application/services/workspace-member.service"
import logger from "../../../utils/logger"

export class MemberController {
  private memberService: WorkspaceMemberService

  constructor(memberService?: WorkspaceMemberService) {
    this.memberService = memberService || workspaceMemberService
  }

  /**
   * Get all members of a workspace
   * GET /api/workspaces/:workspaceId/members
   * Requires: authMiddleware, validateWorkspaceOperation, requireWorkspaceMember
   */
  getMembers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      const members = await this.memberService.getMembers(workspaceId)

      res.json({
        success: true,
        members,
      })
    } catch (error) {
      logger.error("Error fetching members:", error)
      next(error)
    }
  }

  /**
   * Remove a member from workspace (and all owner's channels)
   * DELETE /api/workspaces/:workspaceId/members/:userId
   * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
   */
  removeMember = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const { userId: userIdToRemove } = req.params
      const requestingUserId = (req as any).user?.id

      if (!userIdToRemove) {
        res.status(400).json({
          error: "Bad Request",
          message: "User ID is required",
        })
        return
      }

      const result = await this.memberService.removeMember(
        workspaceId,
        userIdToRemove,
        requestingUserId
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
        message: `Member removed from ${result.workspacesRemoved} workspace(s)`,
        workspacesRemoved: result.workspacesRemoved,
      })
    } catch (error) {
      logger.error("Error removing member:", error)
      next(error)
    }
  }

  /**
   * Get current user's role in a workspace
   * GET /api/workspaces/:workspaceId/members/me/role
   * Requires: authMiddleware, validateWorkspaceOperation
   */
  getMyRole = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        })
        return
      }

      const role = await this.memberService.getUserRole(workspaceId, userId)
      const isSuperAdmin = await this.memberService.isSuperAdmin(
        workspaceId,
        userId
      )
      const isOwner = await this.memberService.isOwner(workspaceId, userId)

      res.json({
        success: true,
        role,
        isSuperAdmin,
        isOwner,
      })
    } catch (error) {
      logger.error("Error fetching role:", error)
      next(error)
    }
  }
}

export const memberController = new MemberController()
