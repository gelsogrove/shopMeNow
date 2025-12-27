"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceInvitationService = exports.getWorkspaceInvitationService = exports.WorkspaceInvitationService = void 0;
const database_1 = require("@echatbot/database");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../../utils/logger"));
const email_service_1 = require("./email.service");
// Constants
const TOKEN_BYTES = 32; // 256-bit token
const TOKEN_EXPIRY_DAYS = 7;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
class WorkspaceInvitationService {
    constructor(prismaInstance, emailService) {
        this.prisma = prismaInstance || database_1.prisma;
        this.emailService = emailService || new email_service_1.EmailService();
    }
    /**
     * Generate a secure random token
     * @private
     */
    generateToken() {
        return crypto_1.default.randomBytes(TOKEN_BYTES).toString("hex");
    }
    /**
     * Hash a token using SHA-256
     * @private
     */
    hashToken(token) {
        return crypto_1.default.createHash("sha256").update(token).digest("hex");
    }
    /**
     * Timing-safe token comparison
     * @private
     */
    verifyToken(providedToken, storedHash) {
        const providedHash = this.hashToken(providedToken);
        try {
            return crypto_1.default.timingSafeEqual(Buffer.from(providedHash, "hex"), Buffer.from(storedHash, "hex"));
        }
        catch (_a) {
            return false;
        }
    }
    /**
     * Normalize email to lowercase for consistent comparison
     * @private
     */
    normalizeEmail(email) {
        return email.toLowerCase().trim();
    }
    /**
     * Create a new invitation
     * - Validates no pending invite exists
     * - Validates user is not already a member
     * - Generates secure token
     * - Sends email
     * - Returns invitation only if email was sent successfully
     */
    createInvitation(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const email = this.normalizeEmail(input.email);
            return yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // 1. Check if email already has a pending invitation for this workspace
                const existingInvitation = yield tx.workspaceInvitation.findFirst({
                    where: {
                        workspaceId: input.workspaceId,
                        email,
                        status: "PENDING",
                    },
                });
                if (existingInvitation) {
                    return {
                        success: false,
                        error: "Invite already pending for this email",
                    };
                }
                // 2. Check if user is already a member of any workspace owned by same owner
                const workspace = yield tx.workspace.findUnique({
                    where: { id: input.workspaceId },
                    select: { ownerId: true, name: true },
                });
                if (!workspace || !workspace.ownerId) {
                    return {
                        success: false,
                        error: "Workspace not found or has no owner",
                    };
                }
                const existingUser = yield tx.user.findUnique({
                    where: { email },
                    select: { id: true },
                });
                if (existingUser) {
                    // Check if already a member of any workspace with same owner
                    const existingMembership = yield tx.userWorkspace.findFirst({
                        where: {
                            userId: existingUser.id,
                            workspace: {
                                ownerId: workspace.ownerId,
                            },
                        },
                    });
                    if (existingMembership) {
                        return {
                            success: false,
                            error: "User is already a member of this workspace",
                        };
                    }
                }
                // 3. Get inviter info for email
                const inviter = yield tx.user.findUnique({
                    where: { id: input.invitedById },
                    select: { firstName: true, lastName: true, email: true },
                });
                if (!inviter) {
                    return {
                        success: false,
                        error: "Inviter not found",
                    };
                }
                // 4. Generate token and expiry
                const token = this.generateToken();
                const tokenHash = this.hashToken(token);
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);
                // 5. Create invitation in database
                const invitation = yield tx.workspaceInvitation.create({
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
                });
                // 6. Try to send email - CRITICAL: If email fails, we rollback the transaction
                try {
                    const inviterName = inviter.firstName
                        ? `${inviter.firstName} ${inviter.lastName || ""}`.trim()
                        : inviter.email;
                    yield this.sendInvitationEmail({
                        to: email,
                        token,
                        workspaceName: workspace.name,
                        inviterName,
                        expiresAt,
                    });
                    logger_1.default.info(`Invitation sent to ${email} for workspace ${workspace.name}`);
                    return {
                        success: true,
                        invitation: {
                            id: invitation.id,
                            email: invitation.email,
                            expiresAt: invitation.expiresAt,
                        },
                    };
                }
                catch (emailError) {
                    logger_1.default.error("Failed to send invitation email:", emailError);
                    // This will rollback the transaction
                    throw new Error("Failed to send invitation email");
                }
            }));
        });
    }
    /**
     * Send invitation email
     * @private
     */
    sendInvitationEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const acceptUrl = `${FRONTEND_URL}/accept-invite?token=${data.token}`;
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
            <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.workspaceName}</strong> on eChatbot.</p>
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
    `;
            // Use the existing email service transporter
            const nodemailer = yield Promise.resolve().then(() => __importStar(require("nodemailer")));
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || "smtp.gmail.com",
                port: parseInt(process.env.SMTP_PORT || "587"),
                secure: process.env.SMTP_SECURE === "true",
                auth: {
                    user: process.env.SMTP_USER || "",
                    pass: process.env.SMTP_PASS || "",
                },
            });
            yield transporter.sendMail({
                from: `"eChatbot Team" <${process.env.SMTP_FROM || "noreply@echatbot.ai"}>`,
                to: data.to,
                subject: `You've been invited to join ${data.workspaceName}`,
                html: htmlContent,
                text: `${data.inviterName} has invited you to join ${data.workspaceName} on eChatbot. Accept the invitation: ${acceptUrl}`,
            });
        });
    }
    /**
     * Validate an invitation token and return invitation info
     */
    validateToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenHash = this.hashToken(token);
            const invitation = yield this.prisma.workspaceInvitation.findFirst({
                where: { tokenHash },
                include: {
                    workspace: {
                        select: { id: true, name: true },
                    },
                    invitedBy: {
                        select: { firstName: true, lastName: true },
                    },
                },
            });
            if (!invitation) {
                return null;
            }
            const isExpired = new Date() > invitation.expiresAt;
            const existingUser = yield this.prisma.user.findUnique({
                where: { email: invitation.email },
                select: { id: true },
            });
            // Update status to EXPIRED if needed
            if (isExpired && invitation.status === "PENDING") {
                yield this.prisma.workspaceInvitation.update({
                    where: { id: invitation.id },
                    data: { status: "EXPIRED" },
                });
            }
            const inviterName = invitation.invitedBy.firstName
                ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName || ""}`.trim()
                : "Team member";
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
            };
        });
    }
    /**
     * Accept an invitation (for existing users)
     * - Validates token
     * - Adds user to all workspaces with same owner
     */
    acceptInvitation(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenHash = this.hashToken(input.token);
            return yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const invitation = yield tx.workspaceInvitation.findFirst({
                    where: { tokenHash },
                    include: {
                        workspace: {
                            select: { id: true, ownerId: true },
                        },
                    },
                });
                if (!invitation) {
                    return { success: false, error: "Invalid invitation token" };
                }
                if (invitation.status === "CANCELLED") {
                    return { success: false, error: "This invitation has been cancelled" };
                }
                if (invitation.status === "ACCEPTED") {
                    return { success: false, error: "Invitation already accepted" };
                }
                if (new Date() > invitation.expiresAt) {
                    yield tx.workspaceInvitation.update({
                        where: { id: invitation.id },
                        data: { status: "EXPIRED" },
                    });
                    return { success: false, error: "Invitation has expired" };
                }
                // Find the user
                const user = yield tx.user.findUnique({
                    where: { email: invitation.email },
                    select: { id: true },
                });
                if (!user) {
                    return {
                        success: false,
                        error: "User not found. Please register first.",
                    };
                }
                // Find all workspaces owned by the same owner
                const ownerId = invitation.workspace.ownerId;
                if (!ownerId) {
                    return { success: false, error: "Workspace has no owner" };
                }
                const ownerWorkspaces = yield tx.workspace.findMany({
                    where: { ownerId },
                    select: { id: true },
                });
                // Add user to all owner's workspaces
                for (const ws of ownerWorkspaces) {
                    const existingMembership = yield tx.userWorkspace.findUnique({
                        where: {
                            userId_workspaceId: {
                                userId: user.id,
                                workspaceId: ws.id,
                            },
                        },
                    });
                    if (!existingMembership) {
                        yield tx.userWorkspace.create({
                            data: {
                                userId: user.id,
                                workspaceId: ws.id,
                                role: "ADMIN",
                            },
                        });
                    }
                }
                // Update invitation status
                yield tx.workspaceInvitation.update({
                    where: { id: invitation.id },
                    data: {
                        status: "ACCEPTED",
                        acceptedAt: new Date(),
                    },
                });
                logger_1.default.info(`Invitation accepted: ${invitation.email} joined ${ownerWorkspaces.length} workspace(s)`);
                return {
                    success: true,
                    workspaceId: invitation.workspaceId,
                };
            }));
        });
    }
    /**
     * Get pending invitations for a workspace
     *
     * Business Rule: If the invited email exists in Sales table,
     * they will become an "AGENT" when they accept the invitation.
     */
    getPendingInvitations(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const invitations = yield this.prisma.workspaceInvitation.findMany({
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
            });
            // Update expired invitations
            const now = new Date();
            for (const inv of invitations) {
                if (inv.status === "PENDING" && now > inv.expiresAt) {
                    yield this.prisma.workspaceInvitation.update({
                        where: { id: inv.id },
                        data: { status: "EXPIRED" },
                    });
                    inv.status = "EXPIRED";
                }
            }
            // Get Sales emails to determine which invitees will be Agents
            let salesEmails = new Set();
            try {
                const salesRecords = yield this.prisma.sales.findMany({
                    where: { workspaceId },
                    select: { email: true },
                });
                salesEmails = new Set(salesRecords.map((s) => s.email.toLowerCase()));
            }
            catch (_a) {
                // Graceful degradation: if Sales query fails, all invitees are considered Admins
            }
            return invitations.map((inv) => ({
                id: inv.id,
                email: inv.email,
                createdAt: inv.createdAt,
                expiresAt: inv.expiresAt,
                status: inv.status,
                isAgent: salesEmails.has(inv.email.toLowerCase()),
                invitedBy: inv.invitedBy,
            }));
        });
    }
    /**
     * Cancel a pending invitation
     */
    cancelInvitation(invitationId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const invitation = yield this.prisma.workspaceInvitation.findFirst({
                where: {
                    id: invitationId,
                    workspaceId,
                    status: "PENDING",
                },
            });
            if (!invitation) {
                return { success: false, error: "Invitation not found or already processed" };
            }
            yield this.prisma.workspaceInvitation.update({
                where: { id: invitationId },
                data: { status: "CANCELLED" },
            });
            logger_1.default.info(`Invitation cancelled: ${invitation.email}`);
            return { success: true };
        });
    }
    /**
     * Resend an expired or pending invitation
     */
    resendInvitation(invitationId, workspaceId, resenderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const invitation = yield this.prisma.workspaceInvitation.findFirst({
                where: {
                    id: invitationId,
                    workspaceId,
                },
                include: {
                    workspace: { select: { name: true } },
                    invitedBy: { select: { firstName: true, lastName: true, email: true } },
                },
            });
            if (!invitation) {
                return { success: false, error: "Invitation not found" };
            }
            if (invitation.status === "ACCEPTED") {
                return { success: false, error: "Invitation already accepted" };
            }
            if (invitation.status === "CANCELLED") {
                return { success: false, error: "Invitation was cancelled" };
            }
            // Generate new token
            const token = this.generateToken();
            const tokenHash = this.hashToken(token);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);
            // Get resender info
            const resender = yield this.prisma.user.findUnique({
                where: { id: resenderId },
                select: { firstName: true, lastName: true, email: true },
            });
            const inviterName = (resender === null || resender === void 0 ? void 0 : resender.firstName)
                ? `${resender.firstName} ${resender.lastName || ""}`.trim()
                : (resender === null || resender === void 0 ? void 0 : resender.email) || "Team member";
            // Update invitation with new token
            yield this.prisma.workspaceInvitation.update({
                where: { id: invitationId },
                data: {
                    tokenHash,
                    expiresAt,
                    status: "PENDING",
                },
            });
            // Send new email
            try {
                yield this.sendInvitationEmail({
                    to: invitation.email,
                    token,
                    workspaceName: invitation.workspace.name,
                    inviterName,
                    expiresAt,
                });
                logger_1.default.info(`Invitation resent to ${invitation.email}`);
                return { success: true };
            }
            catch (error) {
                logger_1.default.error("Failed to resend invitation email:", error);
                return { success: false, error: "Failed to send invitation email" };
            }
        });
    }
}
exports.WorkspaceInvitationService = WorkspaceInvitationService;
// Lazy initialization to avoid SMTP errors in test environments
let cachedService = null;
const getWorkspaceInvitationService = () => {
    if (!cachedService) {
        cachedService = new WorkspaceInvitationService();
    }
    return cachedService;
};
exports.getWorkspaceInvitationService = getWorkspaceInvitationService;
// Backward compatibility
exports.workspaceInvitationService = (0, exports.getWorkspaceInvitationService)();
//# sourceMappingURL=workspace-invitation.service.js.map