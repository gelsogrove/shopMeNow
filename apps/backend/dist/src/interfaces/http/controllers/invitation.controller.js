"use strict";
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
exports.invitationController = exports.InvitationController = void 0;
const workspace_invitation_service_1 = require("../../../application/services/workspace-invitation.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class InvitationController {
    constructor(invitationService) {
        /**
         * Create a new invitation
         * POST /api/workspaces/:workspaceId/invitations
         * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
         */
        this.createInvitation = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const workspaceId = req.workspaceId || req.params.workspaceId;
                const invitedById = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const { email, firstName, lastName } = req.body;
                if (!email) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "Email is required",
                    });
                    return;
                }
                if (!invitedById) {
                    res.status(401).json({
                        error: "Unauthorized",
                        message: "Authentication required",
                    });
                    return;
                }
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "Invalid email format",
                    });
                    return;
                }
                logger_1.default.info(`Creating invitation for ${email} to workspace ${workspaceId.substring(0, 8)}...`);
                const result = yield this.invitationService.createInvitation({
                    workspaceId,
                    email,
                    invitedById,
                    firstName: (firstName === null || firstName === void 0 ? void 0 : firstName.trim()) || undefined,
                    lastName: (lastName === null || lastName === void 0 ? void 0 : lastName.trim()) || undefined,
                });
                if (!result.success) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: result.error,
                    });
                    return;
                }
                res.status(201).json({
                    success: true,
                    message: "Invitation sent successfully",
                    invitation: result.invitation,
                });
            }
            catch (error) {
                logger_1.default.error("Error creating invitation:", error);
                if (error instanceof Error && error.message === "Failed to send invitation email") {
                    res.status(500).json({
                        error: "Email Error",
                        message: "Failed to send invitation email. Please try again later.",
                    });
                    return;
                }
                next(error);
            }
        });
        /**
         * Get pending invitations for a workspace
         * GET /api/workspaces/:workspaceId/invitations
         * Requires: authMiddleware, validateWorkspaceOperation, requireWorkspaceMember
         */
        this.getPendingInvitations = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId || req.params.workspaceId;
                const invitations = yield this.invitationService.getPendingInvitations(workspaceId);
                res.json({
                    success: true,
                    invitations,
                });
            }
            catch (error) {
                logger_1.default.error("Error fetching invitations:", error);
                next(error);
            }
        });
        /**
         * Cancel a pending invitation
         * DELETE /api/workspaces/:workspaceId/invitations/:invitationId
         * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
         */
        this.cancelInvitation = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId || req.params.workspaceId;
                const { invitationId } = req.params;
                if (!invitationId) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "Invitation ID is required",
                    });
                    return;
                }
                const result = yield this.invitationService.cancelInvitation(invitationId, workspaceId);
                if (!result.success) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: result.error,
                    });
                    return;
                }
                res.json({
                    success: true,
                    message: "Invitation cancelled successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Error cancelling invitation:", error);
                next(error);
            }
        });
        /**
         * Resend an invitation
         * POST /api/workspaces/:workspaceId/invitations/:invitationId/resend
         * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
         */
        this.resendInvitation = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const workspaceId = req.workspaceId || req.params.workspaceId;
                const { invitationId } = req.params;
                const resenderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!invitationId) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "Invitation ID is required",
                    });
                    return;
                }
                const result = yield this.invitationService.resendInvitation(invitationId, workspaceId, resenderId);
                if (!result.success) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: result.error,
                    });
                    return;
                }
                res.json({
                    success: true,
                    message: "Invitation resent successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Error resending invitation:", error);
                next(error);
            }
        });
        /**
         * Validate an invitation token (public endpoint)
         * GET /api/invitations/validate/:token
         * No auth required
         */
        this.validateToken = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { token } = req.params;
                if (!token) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "Token is required",
                    });
                    return;
                }
                const invitationInfo = yield this.invitationService.validateToken(token);
                if (!invitationInfo) {
                    res.status(404).json({
                        error: "Not Found",
                        message: "Invalid invitation token",
                    });
                    return;
                }
                res.json({
                    success: true,
                    invitation: invitationInfo,
                });
            }
            catch (error) {
                logger_1.default.error("Error validating token:", error);
                next(error);
            }
        });
        /**
         * Accept an invitation (public endpoint for existing users)
         * POST /api/invitations/accept
         * No auth required - token is sufficient
         */
        this.acceptInvitation = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { token } = req.body;
                if (!token) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "Token is required",
                    });
                    return;
                }
                const result = yield this.invitationService.acceptInvitation({ token });
                if (!result.success) {
                    // Determine appropriate status code based on error
                    let statusCode = 400;
                    if (result.error === "Invalid invitation token") {
                        statusCode = 404;
                    }
                    else if (result.error === "Invitation has expired") {
                        statusCode = 410; // Gone
                    }
                    res.status(statusCode).json({
                        error: "Invitation Error",
                        message: result.error,
                    });
                    return;
                }
                res.json({
                    success: true,
                    message: "Invitation accepted successfully",
                    workspaceId: result.workspaceId,
                });
            }
            catch (error) {
                logger_1.default.error("Error accepting invitation:", error);
                next(error);
            }
        });
        this.invitationService = invitationService || workspace_invitation_service_1.workspaceInvitationService;
    }
}
exports.InvitationController = InvitationController;
exports.invitationController = new InvitationController();
//# sourceMappingURL=invitation.controller.js.map