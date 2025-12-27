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
exports.gdprService = exports.GdprService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const gdpr_repository_1 = require("../repositories/gdpr.repository");
class GdprService {
    /**
     * Get GDPR content for a workspace (all 4 languages)
     */
    getGdprContent(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[GdprService] Getting GDPR content for workspace: ${workspaceId}`);
                const content = yield gdpr_repository_1.gdprRepository.getGdprContent(workspaceId);
                return content;
            }
            catch (error) {
                logger_1.default.error(`[GdprService] Error getting GDPR content:`, error);
                throw new Error(`Failed to get GDPR content: ${error.message}`);
            }
        });
    }
    /**
     * Update GDPR content for a workspace (all 4 languages)
     */
    updateGdprContent(workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[GdprService] Updating GDPR content for workspace: ${workspaceId}`);
                const result = yield gdpr_repository_1.gdprRepository.updateGdprContent(workspaceId, data);
                logger_1.default.info(`[GdprService] GDPR content updated successfully`);
                return result;
            }
            catch (error) {
                logger_1.default.error(`[GdprService] Error updating GDPR content:`, error);
                throw new Error(`Failed to update GDPR content: ${error.message}`);
            }
        });
    }
}
exports.GdprService = GdprService;
exports.gdprService = new GdprService();
//# sourceMappingURL=gdpr.service.js.map