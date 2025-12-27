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
exports.gdprRepository = exports.GdprRepository = void 0;
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Repository for GDPR Content management
 * Simple structure: One row per workspace with all 4 languages in separate columns
 */
class GdprRepository {
    /**
     * Get GDPR content for a workspace (all 4 languages)
     */
    getGdprContent(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[GDPR REPO] Getting GDPR content for workspace: ${workspaceId}`);
                const gdprContent = yield prisma_1.prisma.gdprContent.findUnique({
                    where: { workspaceId }
                });
                if (!gdprContent) {
                    logger_1.default.warn(`[GDPR REPO] No GDPR content found for workspace: ${workspaceId}`);
                    return null;
                }
                return gdprContent;
            }
            catch (error) {
                logger_1.default.error(`[GDPR REPO] Error getting GDPR content: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Update or create GDPR content for a workspace
     */
    updateGdprContent(workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[GDPR REPO] Updating GDPR content for workspace: ${workspaceId}`);
                // Try to find existing record
                const existing = yield prisma_1.prisma.gdprContent.findUnique({
                    where: { workspaceId }
                });
                let gdprRecord;
                if (existing) {
                    // Update existing record
                    gdprRecord = yield prisma_1.prisma.gdprContent.update({
                        where: { workspaceId },
                        data: Object.assign(Object.assign({}, data), { updatedAt: new Date() })
                    });
                    logger_1.default.info(`[GDPR REPO] GDPR content updated for workspace: ${workspaceId}`);
                }
                else {
                    // Create new record
                    gdprRecord = yield prisma_1.prisma.gdprContent.create({
                        data: Object.assign({ workspaceId }, data)
                    });
                    logger_1.default.info(`[GDPR REPO] GDPR content created for workspace: ${workspaceId}`);
                }
                return gdprRecord;
            }
            catch (error) {
                logger_1.default.error(`[GDPR REPO] Error updating GDPR content: ${error.message}`);
                throw error;
            }
        });
    }
}
exports.GdprRepository = GdprRepository;
exports.gdprRepository = new GdprRepository();
//# sourceMappingURL=gdpr.repository.js.map