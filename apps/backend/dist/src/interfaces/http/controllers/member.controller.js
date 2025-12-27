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
exports.memberController = exports.MemberController = void 0;
const workspace_member_service_1 = require("../../../application/services/workspace-member.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class MemberController {
    constructor(memberService) {
        /**
         * Get all members of a workspace
         * GET /api/workspaces/:workspaceId/members
         * Requires: authMiddleware, validateWorkspaceOperation, requireWorkspaceMember
         */
        this.getMembers = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId || req.params.workspaceId;
                const members = yield this.memberService.getMembers(workspaceId);
                res.json({
                    success: true,
                    members,
                });
            }
            catch (error) {
                logger_1.default.error("Error fetching members:", error);
                next(error);
            }
        });
        /**
         * Remove a member from workspace (and all owner's channels)
         * DELETE /api/workspaces/:workspaceId/members/:userId
         * Requires: authMiddleware, validateWorkspaceOperation, requireSuperAdmin
         */
        this.removeMember = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const workspaceId = req.workspaceId || req.params.workspaceId;
                const { userId: userIdToRemove } = req.params;
                const requestingUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userIdToRemove) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "User ID is required",
                    });
                    return;
                }
                const result = yield this.memberService.removeMember(workspaceId, userIdToRemove, requestingUserId);
                if (!result.success) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: result.error,
                    });
                    return;
                }
                res.json({
                    success: true,
                    message: `Member removed from ${result.workspacesRemoved} workspace(s)`,
                    workspacesRemoved: result.workspacesRemoved,
                });
            }
            catch (error) {
                logger_1.default.error("Error removing member:", error);
                next(error);
            }
        });
        /**
         * Get current user's role in a workspace
         * GET /api/workspaces/:workspaceId/members/me/role
         * Requires: authMiddleware, validateWorkspaceOperation
         */
        this.getMyRole = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const workspaceId = req.workspaceId || req.params.workspaceId;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({
                        error: "Unauthorized",
                        message: "Authentication required",
                    });
                    return;
                }
                const role = yield this.memberService.getUserRole(workspaceId, userId);
                const isSuperAdmin = yield this.memberService.isSuperAdmin(workspaceId, userId);
                res.json({
                    success: true,
                    role,
                    isSuperAdmin,
                });
            }
            catch (error) {
                logger_1.default.error("Error fetching role:", error);
                next(error);
            }
        });
        this.memberService = memberService || workspace_member_service_1.workspaceMemberService;
    }
}
exports.MemberController = MemberController;
exports.memberController = new MemberController();
//# sourceMappingURL=member.controller.js.map