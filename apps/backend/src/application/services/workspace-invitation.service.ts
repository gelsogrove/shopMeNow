import { PrismaClient, InvitationStatus } from "@prisma/client"
import crypto from "crypto"
import logger from "../../utils/logger"
import { EmailService } from "./email.service"

// Constants
const TOKEN_BYTES = 32 // 256-bit token
const TOKEN_EXPIRY_DAYS = 7
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"

export interface CreateInvitationInput {
  workspaceId: string
  email: string
  invitedById: string
  firstName?: string  // Optional: name of invited person
  lastName?: string   // Optional: surname of invited person
}

export interface AcceptInvitationInput {
  token: string
}

export interface AcceptInvitationWithRegistrationInput {
  token: string
  password: string
  firstName?: string
  lastName?: string
}

export interface InvitationInfo {
  id: string
  email: string
  firstName?: string  // Name of invited person
  lastName?: string   // Surname of invited person
  workspaceName: string
  workspaceId: string
  invitedByName: string
  expiresAt: Date
  status: InvitationStatus
  isExpired: boolean
  existingUser: boolean
}

export class WorkspaceInvitationService {
  private prisma: PrismaClient
  private emailService: EmailService

  constructor(prisma?: PrismaClient, emailService?: EmailService) {
    this.prisma = prisma || new PrismaClient()
    this.emailService = emailService || new EmailService()
  }

  /**
   * Generate a secure random token
   * @private
   */
  private generateToken(): string {
    return crypto.randomBytes(TOKEN_BYTES).toString("hex")
  }

  /**
   * Hash a token using SHA-256
   * @private
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex")
  }

  /**
   * Timing-safe token comparison
   * @private
   */
  private verifyToken(providedToken: string, storedHash: string): boolean {
    const providedHash = this.hashToken(providedToken)
    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedHash, "hex"),
        Buffer.from(storedHash, "hex")
      )
    } catch {
      return false
    }
  }

  /**
   * Normalize email to lowercase for consistent comparison
   * @private
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
  }

  /**
   * Create a new invitation
   * - Validates no pending invite exists
   * - Validates user is not already a member
   * - Generates secure token
   * - Sends email
   * - Returns invitation only if email was sent successfully
   */
  async createInvitation(input: CreateInvitationInput): Promise<{
    success: boolean
    invitation?: { id: string; email: string; expiresAt: Date }
    error?: string
  }> {
    const email = this.normalizeEmail(input.email)

    return await this.prisma.$transaction(async (tx) => {
      // 1. Check if email already has a pending invitation for this workspace
      const existingInvitation = await tx.workspaceInvitation.findFirst({
        where: {
          workspaceId: input.workspaceId,
          email,
          status: "PENDING",
        },
      })

      if (existingInvitation) {
        return {
          success: false,
          error: "Invite already pending for this email",
        }
      }

      // 2. Check if user is already a member of any workspace owned by same owner
      const workspace = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { ownerId: true, name: true },
      })

      if (!workspace || !workspace.ownerId) {
        return {
          success: false,
          error: "Workspace not found or has no owner",
        }
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (existingUser) {
        // Check if already a member of any workspace with same owner
        const existingMembership = await tx.userWorkspace.findFirst({
          where: {
            userId: existingUser.id,
            workspace: {
              ownerId: workspace.ownerId,
            },
          },
        })

        if (existingMembership) {
          return {
            success: false,
            error: "User is already a member of this workspace",
          }
        }
      }

      // 3. Get inviter info for email
      const inviter = await tx.user.findUnique({
        where: { id: input.invitedById },
        select: { firstName: true, lastName: true, email: true },
      })

      if (!inviter) {
        return {
          success: false,
          error: "Inviter not found",
        }
      }

      // 4. Generate token and expiry
      const token = this.generateToken()
      const tokenHash = this.hashToken(token)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

      // 5. Create invitation in database
      const invitation = await tx.workspaceInvitation.create({
        data: {
          email,
          firstName: input.firstName || null,
          lastName: input.lastName || null,
          workspaceId: input.workspaceId,
          tokenHash,
          invitedById: input.invitedById,
          expiresAt,
          status: "PENDING",
        },
      })

      // 6. Try to send email - CRITICAL: If email fails, we rollback the transaction
      try {
        const inviterName = inviter.firstName
          ? `${inviter.firstName} ${inviter.lastName || ""}`.trim()
          : inviter.email

        await this.sendInvitationEmail({
          to: email,
          token,
          workspaceName: workspace.name,
          inviterName,
          expiresAt,
        })

        logger.info(
          `Invitation sent to ${email} for workspace ${workspace.name}`
        )

        return {
          success: true,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            expiresAt: invitation.expiresAt,
          },
        }
      } catch (emailError) {
        logger.error("Failed to send invitation email:", emailError)
        // This will rollback the transaction
        throw new Error("Failed to send invitation email")
      }
    })
  }

  /**
   * Send invitation email
   * @private
   */
  private async sendInvitationEmail(data: {
    to: string
    token: string
    workspaceName: string
    inviterName: string
    expiresAt: Date
  }): Promise<void> {
    const acceptUrl = `${FRONTEND_URL}/accept-invite?token=${data.token}`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited!</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.workspaceName}</strong> on ShopME.</p>
            <p>Click the button below to accept the invitation:</p>
            <p style="text-align: center;">
              <a href="${acceptUrl}" class="button">Accept Invitation</a>
            </p>
            <p>Or copy this link: ${acceptUrl}</p>
            <p style="color: #666; font-size: 14px;">
              This invitation expires on ${data.expiresAt.toLocaleDateString()}.
            </p>
          </div>
          <div class="footer">
            <p>If you didn't expect this invitation, you can ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // Use the existing email service transporter
    const nodemailer = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    })

    await transporter.sendMail({
      from: `"ShopMe Team" <${process.env.SMTP_FROM || "noreply@shopme.com"}>`,
      to: data.to,
      subject: `You've been invited to join ${data.workspaceName}`,
      html: htmlContent,
      text: `${data.inviterName} has invited you to join ${data.workspaceName} on ShopME. Accept the invitation: ${acceptUrl}`,
    })
  }

  /**
   * Validate an invitation token and return invitation info
   */
  async validateToken(token: string): Promise<InvitationInfo | null> {
    const tokenHash = this.hashToken(token)

    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: { tokenHash },
      include: {
        workspace: {
          select: { id: true, name: true },
        },
        invitedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    if (!invitation) {
      return null
    }

    const isExpired = new Date() > invitation.expiresAt
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    })

    // Update status to EXPIRED if needed
    if (isExpired && invitation.status === "PENDING") {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      })
    }

    const inviterName = invitation.invitedBy.firstName
      ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName || ""}`.trim()
      : "Team member"

    return {
      id: invitation.id,
      email: invitation.email,
      firstName: invitation.firstName || undefined,
      lastName: invitation.lastName || undefined,
      workspaceName: invitation.workspace.name,
      workspaceId: invitation.workspace.id,
      invitedByName: inviterName,
      expiresAt: invitation.expiresAt,
      status: isExpired ? "EXPIRED" : invitation.status,
      isExpired,
      existingUser: !!existingUser,
    }
  }

  /**
   * Accept an invitation (for existing users)
   * - Validates token
   * - Adds user to all workspaces with same owner
   */
  async acceptInvitation(input: AcceptInvitationInput): Promise<{
    success: boolean
    error?: string
    workspaceId?: string
  }> {
    const tokenHash = this.hashToken(input.token)

    return await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.workspaceInvitation.findFirst({
        where: { tokenHash },
        include: {
          workspace: {
            select: { id: true, ownerId: true },
          },
        },
      })

      if (!invitation) {
        return { success: false, error: "Invalid invitation token" }
      }

      if (invitation.status === "CANCELLED") {
        return { success: false, error: "This invitation has been cancelled" }
      }

      if (invitation.status === "ACCEPTED") {
        return { success: false, error: "Invitation already accepted" }
      }

      if (new Date() > invitation.expiresAt) {
        await tx.workspaceInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        })
        return { success: false, error: "Invitation has expired" }
      }

      // Find the user
      const user = await tx.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      })

      if (!user) {
        return {
          success: false,
          error: "User not found. Please register first.",
        }
      }

      // Find all workspaces owned by the same owner
      const ownerId = invitation.workspace.ownerId
      if (!ownerId) {
        return { success: false, error: "Workspace has no owner" }
      }

      const ownerWorkspaces = await tx.workspace.findMany({
        where: { ownerId },
        select: { id: true },
      })

      // Add user to all owner's workspaces
      for (const ws of ownerWorkspaces) {
        const existingMembership = await tx.userWorkspace.findUnique({
          where: {
            userId_workspaceId: {
              userId: user.id,
              workspaceId: ws.id,
            },
          },
        })

        if (!existingMembership) {
          await tx.userWorkspace.create({
            data: {
              userId: user.id,
              workspaceId: ws.id,
              role: "ADMIN",
            },
          })
        }
      }

      // Update invitation status
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      })

      logger.info(
        `Invitation accepted: ${invitation.email} joined ${ownerWorkspaces.length} workspace(s)`
      )

      return {
        success: true,
        workspaceId: invitation.workspaceId,
      }
    })
  }

  /**
   * Get pending invitations for a workspace
   */
  async getPendingInvitations(workspaceId: string): Promise<
    Array<{
      id: string
      email: string
      createdAt: Date
      expiresAt: Date
      status: InvitationStatus
      invitedBy: {
        firstName: string | null
        lastName: string | null
        email: string
      }
    }>
  > {
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { 
        workspaceId,
        // Only show PENDING and EXPIRED invitations (not CANCELLED or ACCEPTED)
        status: { in: ["PENDING", "EXPIRED"] }
      },
      include: {
        invitedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Update expired invitations
    const now = new Date()
    for (const inv of invitations) {
      if (inv.status === "PENDING" && now > inv.expiresAt) {
        await this.prisma.workspaceInvitation.update({
          where: { id: inv.id },
          data: { status: "EXPIRED" },
        })
        inv.status = "EXPIRED"
      }
    }

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      status: inv.status,
      invitedBy: inv.invitedBy,
    }))
  }

  /**
   * Cancel a pending invitation
   */
  async cancelInvitation(
    invitationId: string,
    workspaceId: string
  ): Promise<{ success: boolean; error?: string }> {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId,
        status: "PENDING",
      },
    })

    if (!invitation) {
      return { success: false, error: "Invitation not found or already processed" }
    }

    await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" },
    })

    logger.info(`Invitation cancelled: ${invitation.email}`)
    return { success: true }
  }

  /**
   * Resend an expired or pending invitation
   */
  async resendInvitation(
    invitationId: string,
    workspaceId: string,
    resenderId: string
  ): Promise<{ success: boolean; error?: string }> {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId,
      },
      include: {
        workspace: { select: { name: true } },
        invitedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    })

    if (!invitation) {
      return { success: false, error: "Invitation not found" }
    }

    if (invitation.status === "ACCEPTED") {
      return { success: false, error: "Invitation already accepted" }
    }

    if (invitation.status === "CANCELLED") {
      return { success: false, error: "Invitation was cancelled" }
    }

    // Generate new token
    const token = this.generateToken()
    const tokenHash = this.hashToken(token)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

    // Get resender info
    const resender = await this.prisma.user.findUnique({
      where: { id: resenderId },
      select: { firstName: true, lastName: true, email: true },
    })

    const inviterName = resender?.firstName
      ? `${resender.firstName} ${resender.lastName || ""}`.trim()
      : resender?.email || "Team member"

    // Update invitation with new token
    await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        tokenHash,
        expiresAt,
        status: "PENDING",
      },
    })

    // Send new email
    try {
      await this.sendInvitationEmail({
        to: invitation.email,
        token,
        workspaceName: invitation.workspace.name,
        inviterName,
        expiresAt,
      })

      logger.info(`Invitation resent to ${invitation.email}`)
      return { success: true }
    } catch (error) {
      logger.error("Failed to resend invitation email:", error)
      return { success: false, error: "Failed to send invitation email" }
    }
  }
}

export const workspaceInvitationService = new WorkspaceInvitationService()
