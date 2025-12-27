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
exports.gdprController = exports.GdprController = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
const gdpr_service_1 = require("../../../services/gdpr.service");
class GdprController {
    /**
     * Get GDPR content for a workspace (all 4 languages)
     */
    getGdpr(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.params.workspaceId || req.workspaceId;
                if (!workspaceId) {
                    logger_1.default.warn(`[GdprController] Missing workspaceId`);
                    return res.status(400).json({
                        error: "Missing workspaceId",
                        message: "Workspace ID is required",
                    });
                }
                const gdprContent = yield gdpr_service_1.gdprService.getGdprContent(workspaceId);
                if (!gdprContent) {
                    logger_1.default.warn(`[GdprController] No GDPR content found for workspace: ${workspaceId}`);
                    return res.status(404).json({
                        error: "Not found",
                        message: "GDPR content not found for this workspace",
                    });
                }
                logger_1.default.info(`[GdprController] GDPR content served for workspace: ${workspaceId}`);
                return res.json(gdprContent);
            }
            catch (error) {
                logger_1.default.error(`[GdprController] Error retrieving GDPR content:`, error);
                return res.status(500).json({
                    error: "Failed to retrieve GDPR content",
                    message: error.message,
                });
            }
        });
    }
    /**
     * Update GDPR content for a workspace (all 4 languages)
     */
    updateGdpr(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.params.workspaceId || req.workspaceId;
                const { gdpr_ita, gdpr_esp, gdpr_eng, gdpr_prt } = req.body;
                if (!workspaceId) {
                    logger_1.default.warn(`[GdprController] Missing workspaceId`);
                    return res.status(400).json({
                        error: "Missing workspaceId",
                        message: "Workspace ID is required",
                    });
                }
                // Validate all 4 languages are provided
                if (!gdpr_ita || !gdpr_esp || !gdpr_eng || !gdpr_prt) {
                    logger_1.default.warn(`[GdprController] Missing GDPR content fields`);
                    return res.status(400).json({
                        error: "Invalid content",
                        message: "All 4 languages must be provided: gdpr_ita, gdpr_esp, gdpr_eng, gdpr_prt",
                    });
                }
                const data = { gdpr_ita, gdpr_esp, gdpr_eng, gdpr_prt };
                const result = yield gdpr_service_1.gdprService.updateGdprContent(workspaceId, data);
                logger_1.default.info(`[GdprController] GDPR content updated for workspace: ${workspaceId}`);
                return res.json(result);
            }
            catch (error) {
                logger_1.default.error(`[GdprController] Error updating GDPR content:`, error);
                return res.status(500).json({
                    error: "Failed to update GDPR content",
                    message: error.message,
                });
            }
        });
    }
}
exports.GdprController = GdprController;
exports.gdprController = new GdprController();
//# sourceMappingURL=gdpr.controller.js.map