import { prisma, PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"

export interface WorkspaceMember {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string // "SUPER_ADMIN" | "ADMIN"
  createdAt: Date
}

export class WorkspaceMemberService {
  private prisma: PrismaClient

  constructor(prismaInstance?: PrismaClient) {
    this.prisma = prismaInstance || prisma
  }

  /**
   * Get all members of a workspace
   * 
   * Business Rule: If a member's email exists in the Sales table for this workspace,
   * their displayed role should be "AGENT" instead of "ADMIN".
   * SUPER_ADMIN (owner) role is never overridden.
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const userWorkspaces = await this.prisma.userWorkspace.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    })

    // Get all Sales emails for this workspace to check for AGENT role
    let salesEmails: Set<string> = new Set()
    try {
      const salesRecords = await this.prisma.sales.findMany({
        where: { workspaceId },
        select: { email: true },
      })
      // Store emails in lowercase for case-insensitive matching
      salesEmails = new Set(salesRecords.map((s) => s.email.toLowerCase()))
    } catch (error) {
      // Graceful degradation: if Sales query fails, continue with original roles
      logger.warn(`Failed to fetch Sales for workspace ${workspaceId}, using original roles:`, error)
    }

    return userWorkspaces.map((uw) => {
      // Determine role: SUPER_ADMIN stays unchanged, ADMIN becomes AGENT if in Sales
      let displayRole = uw.role
      if (uw.role !== "SUPER_ADMIN" && salesEmails.has(uw.user.email.toLowerCase())) {
        displayRole = "AGENT"
      }

      return {
        userId: uw.user.id,
        email: uw.user.email,
        firstName: uw.user.firstName,
        lastName: uw.user.lastName,
        role: displayRole,
        createdAt: uw.createdAt,
      }
    })
  }

  /**
   * Get all ADMINs for all workspaces owned by a specific user
   */
  async getAdminsByOwnerId(ownerId: string): Promise<
    Array<{
      userId: string
      email: string
    }>
  > {
    const ownerWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId },
      select: { id: true },
    })

    const workspaceIds = ownerWorkspaces.map((w) => w.id)

    const admins = await this.prisma.userWorkspace.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        role: "ADMIN",
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
      distinct: ["userId"],
    })

    return admins.map((a) => ({
      userId: a.user.id,
      email: a.user.email,
    }))
  }

  /**
   * Add a member to all workspaces owned by a specific user
   * Used when accepting an invitation
   */
  async addMemberToAllOwnerChannels(
    userId: string,
    ownerId: string,
    role: string = "ADMIN"
  ): Promise<{ success: boolean; workspacesAdded: number }> {
    const ownerWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId },
      select: { id: true },
    })

    let workspacesAdded = 0

    for (const workspace of ownerWorkspaces) {
      const existing = await this.prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: workspace.id,
          },
        },
      })

      if (!existing) {
        await this.prisma.userWorkspace.create({
          data: {
            userId,
            workspaceId: workspace.id,
            role,
          },
        })
        workspacesAdded++
      }
    }

    logger.info(
      `Added user ${userId} to ${workspacesAdded} workspace(s) owned by ${ownerId}`
    )

    return { success: true, workspacesAdded }
  }

  /**
   * Remove a member from all workspaces owned by the workspace's owner
   * SUPER_ADMIN cannot remove themselves
   */
  async removeMember(
    workspaceId: string,
    userIdToRemove: string,
    requestingUserId: string
  ): Promise<{ success: boolean; error?: string; workspacesRemoved?: number }> {
    // Get the workspace and check ownership
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace || !workspace.ownerId) {
      return { success: false, error: "Workspace not found" }
    }

    // Check if requesting user is the SUPER_ADMIN (owner)
    if (requestingUserId !== workspace.ownerId) {
      return { success: false, error: "Only workspace owner can remove members" }
    }

    // Cannot remove yourself (the owner)
    if (userIdToRemove === workspace.ownerId) {
      return { success: false, error: "Cannot remove yourself from the workspace" }
    }

    // Find all workspaces owned by the same owner
    const ownerWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: workspace.ownerId },
      select: { id: true },
    })

    const workspaceIds = ownerWorkspaces.map((w) => w.id)

    // Remove user from all owner's workspaces
    const result = await this.prisma.userWorkspace.deleteMany({
      where: {
        userId: userIdToRemove,
        workspaceId: { in: workspaceIds },
      },
    })

    logger.info(
      `Removed user ${userIdToRemove} from ${result.count} workspace(s)`
    )

    return { success: true, workspacesRemoved: result.count }
  }

  /**
   * Check if a user is a member of a workspace
   */
  async isUserMember(
    workspaceId: string,
    userId: string
  ): Promise<{ isMember: boolean; role: string | null }> {
    const membership = await this.prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    })

    return {
      isMember: !!membership,
      role: membership?.role || null,
    }
  }

  /**
   * Check if user is SUPER_ADMIN (owner) of a workspace
   */
  async isSuperAdmin(workspaceId: string, userId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    return workspace?.ownerId === userId
  }

  /**
   * Get user's role in a workspace
   */
  async getUserRole(
    workspaceId: string,
    userId: string
  ): Promise<string | null> {
    const membership = await this.prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    })

    return membership?.role || null
  }

  /**
   * Add all existing ADMINs to a new workspace
   * Called when SUPER_ADMIN creates a new channel
   */
  async addExistingAdminsToNewWorkspace(
    newWorkspaceId: string,
    ownerId: string
  ): Promise<{ success: boolean; adminsAdded: number }> {
    // Get all ADMINs from owner's existing workspaces
    const existingAdmins = await this.getAdminsByOwnerId(ownerId)

    let adminsAdded = 0
    for (const admin of existingAdmins) {
      const existing = await this.prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: admin.userId,
            workspaceId: newWorkspaceId,
          },
        },
      })

      if (!existing) {
        await this.prisma.userWorkspace.create({
          data: {
            userId: admin.userId,
            workspaceId: newWorkspaceId,
            role: "ADMIN",
          },
        })
        adminsAdded++
      }
    }

    logger.info(
      `Added ${adminsAdded} existing ADMINs to new workspace ${newWorkspaceId}`
    )

    return { success: true, adminsAdded }
  }

  /**
   * Check if user can create a new workspace (channel)
   * A user can create workspace if:
   * 1. They have NO workspaces yet (first-time owner), OR
   * 2. They are SUPER_ADMIN (owner) in at least one workspace
   * 
   * ADMIN users cannot create new workspaces - only SUPER_ADMIN can
   */
  async canUserCreateWorkspace(userId: string): Promise<{
    canCreate: boolean
    reason?: string
    isFirstTimeOwner?: boolean
  }> {
    // Check all workspace memberships for this user
    const memberships = await this.prisma.userWorkspace.findMany({
      where: { userId },
      select: { role: true, workspaceId: true },
    })

    // If user has no workspaces, they can create their first one (become owner)
    if (memberships.length === 0) {
      return { canCreate: true, isFirstTimeOwner: true }
    }

    // Check if user is SUPER_ADMIN in at least one workspace
    const isSuperAdminInAny = memberships.some((m) => m.role === "SUPER_ADMIN")

    if (isSuperAdminInAny) {
      return { canCreate: true, isFirstTimeOwner: false }
    }

    // User is ONLY ADMIN in all workspaces - cannot create new ones
    return {
      canCreate: false,
      reason: "Only workspace owners (SUPER_ADMIN) can create new channels",
    }
  }
}

export const workspaceMemberService = new WorkspaceMemberService()
