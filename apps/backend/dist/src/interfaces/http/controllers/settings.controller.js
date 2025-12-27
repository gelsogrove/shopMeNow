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
exports.SettingsController = void 0;
const settings_service_1 = require("../../../application/services/settings.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
const response_1 = require("../../../utils/response");
/**
 * SETTINGS CONTROLLER - VERSIONE FUNZIONANTE
 *
 * ✅ SOLUZIONE GDPR ENDPOINT TESTATA E FUNZIONANTE
 * Data: 13 Giugno 2025
 *
 * PROBLEMA RISOLTO:
 * - Frontend chiamava /api/settings/{workspaceId}/gdpr (404 NOT FOUND)
 * - Backend aveva solo /api/settings/gdpr (con header x-workspace-id)
 *
 * SOLUZIONE IMPLEMENTATA:
 * 1. Frontend modificato per chiamare /api/settings/gdpr
 * 2. Backend usa header 'x-workspace-id' per identificare workspace
 * 3. Auto-creazione record se non esiste nel database
 * 4. Usa tabella WhatsappSettings esistente (campo gdpr)
 *
 * ENDPOINT TESTATO CON SUCCESSO:
 * curl -b cookies.txt -H "x-workspace-id: cm9hjgq9v00014qk8fsdy4ujv" http://localhost:3001/api/settings/gdpr
 *
 * RISPOSTA: {"success":true,"content":"...","data":{"gdpr":"..."}}
 *
 * ⚠️ NON MODIFICARE QUESTO CONTROLLER SENZA TESTARE GDPR ENDPOINT
 */
/**
 * SettingsController class
 * Handles HTTP requests related to WhatsApp settings
 */
class SettingsController {
    constructor() {
        this.settingsService = new settings_service_1.SettingsService();
    }
    /**
     * Get GDPR content for a workspace
     * @swagger
     * /api/settings/gdpr:
     *   get:
     *     summary: Get GDPR content for a workspace
     *     tags: [Settings]
     *     responses:
     *       200:
     *         description: GDPR content
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 gdpr:
     *                   type: string
     *       500:
     *         description: Failed to retrieve GDPR content
     */
    getGdprContent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Extract workspaceId from header (simplified approach)
                const workspaceId = req.headers['x-workspace-id'];
                if (!workspaceId || workspaceId.trim() === '') {
                    response_1.AppResponse.badRequest(res, "Workspace ID is required");
                    return;
                }
                logger_1.default.info(`[GDPR CONTROLLER] Getting GDPR content for workspace: ${workspaceId}`);
                // Use the existing settings service that auto-creates if not exists
                const gdprContent = yield this.settingsService.getGdprContent(workspaceId);
                logger_1.default.info(`[GDPR CONTROLLER] GDPR content retrieved, length: ${gdprContent ? gdprContent.length : 0}`);
                response_1.AppResponse.success(res, {
                    success: true,
                    content: gdprContent || '',
                    data: { gdpr: gdprContent || '' }
                });
            }
            catch (error) {
                logger_1.default.error("Error getting GDPR content:", error);
                response_1.AppResponse.serverError(res, "Failed to get GDPR content");
            }
        });
    }
    /**
     * Update GDPR content for a workspace
     * @swagger
     * /api/settings/gdpr:
     *   put:
     *     summary: Update GDPR content for a workspace
     *     tags: [Settings]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               gdpr:
     *                 type: string
     *                 description: GDPR content
     *     responses:
     *       200:
     *         description: Updated settings
     *       500:
     *         description: Failed to update GDPR content
     */
    updateGdprContent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Extract workspaceId from header (simplified approach)
                const workspaceId = req.headers['x-workspace-id'];
                const { gdpr } = req.body;
                logger_1.default.info(`[GDPR CONTROLLER] Starting update for workspace: ${workspaceId}`);
                logger_1.default.info(`[GDPR CONTROLLER] GDPR content length: ${gdpr ? gdpr.length : 'undefined'}`);
                if (!workspaceId) {
                    logger_1.default.error("[GDPR CONTROLLER] Missing workspaceId");
                    response_1.AppResponse.badRequest(res, "Workspace ID is required");
                    return;
                }
                if (gdpr === undefined || gdpr === null) {
                    logger_1.default.error("[GDPR CONTROLLER] Missing GDPR content");
                    response_1.AppResponse.badRequest(res, "GDPR content is required");
                    return;
                }
                // Use the existing settings service that auto-creates if not exists
                const updatedSettings = yield this.settingsService.updateGdprContent(workspaceId, gdpr);
                logger_1.default.info(`[GDPR CONTROLLER] GDPR content updated successfully`);
                // Return the response structure expected by frontend and tests
                response_1.AppResponse.success(res, {
                    success: true,
                    data: updatedSettings
                });
            }
            catch (error) {
                logger_1.default.error("Error updating GDPR content:", error);
                response_1.AppResponse.serverError(res, "Failed to update GDPR content");
            }
        });
    }
    /**
     * Get default GDPR content
     * @swagger
     * /api/settings/gdpr/default:
     *   get:
     *     summary: Get default GDPR content
     *     tags: [Settings]
     *     responses:
     *       200:
     *         description: Default GDPR content
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 content:
     *                   type: string
     *       500:
     *         description: Failed to retrieve default GDPR content
     */
    getDefaultGdprContent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const defaultGdprContent = yield this.settingsService.getDefaultGdprContent();
                response_1.AppResponse.success(res, { content: defaultGdprContent });
            }
            catch (error) {
                logger_1.default.error("Error getting default GDPR content:", error);
                response_1.AppResponse.serverError(res, "Failed to get default GDPR content");
            }
        });
    }
    /**
     * Get settings for a workspace
     * @swagger
     * /api/settings/{workspaceId}:
     *   get:
     *     summary: Get settings for a workspace
     *     tags: [Settings]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID of the workspace
     *     responses:
     *       200:
     *         description: Workspace settings
     *       404:
     *         description: Settings not found
     *       500:
     *         description: Failed to retrieve settings
     */
    getSettings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                logger_1.default.info(`Getting settings for workspace ${workspaceId}`);
                if (!workspaceId) {
                    response_1.AppResponse.badRequest(res, "Workspace ID is required");
                    return;
                }
                const settings = yield this.settingsService.getSettings(workspaceId);
                // Always return success, even if settings don't exist
                // The service will return an appropriate default object
                response_1.AppResponse.success(res, settings || {});
            }
            catch (error) {
                logger_1.default.error("Error getting settings:", error);
                response_1.AppResponse.serverError(res, "Failed to get settings");
            }
        });
    }
    /**
     * Update settings for a workspace
     * @swagger
     * /api/settings/{workspaceId}:
     *   put:
     *     summary: Update settings for a workspace
     *     tags: [Settings]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID of the workspace
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               phoneNumber:
     *                 type: string
     *               apiKey:
     *                 type: string
     *               webhookUrl:
     *                 type: string
     *               settings:
     *                 type: object
     *     responses:
     *       200:
     *         description: Updated settings
     *       500:
     *         description: Failed to update settings
     */
    updateSettings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const settingsData = req.body;
                logger_1.default.info(`Updating settings for workspace ${workspaceId}`);
                if (!workspaceId) {
                    response_1.AppResponse.badRequest(res, "Workspace ID is required");
                    return;
                }
                if (!settingsData) {
                    response_1.AppResponse.badRequest(res, "Settings data is required");
                    return;
                }
                const updatedSettings = yield this.settingsService.updateSettings(workspaceId, settingsData);
                response_1.AppResponse.success(res, updatedSettings);
            }
            catch (error) {
                logger_1.default.error("Error updating settings:", error);
                response_1.AppResponse.serverError(res, "Failed to update settings");
            }
        });
    }
    /**
     * Delete settings for a workspace
     * @swagger
     * /api/settings/{workspaceId}:
     *   delete:
     *     summary: Delete settings for a workspace
     *     tags: [Settings]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID of the workspace
     *     responses:
     *       200:
     *         description: Settings deleted successfully
     *       404:
     *         description: Settings not found
     *       500:
     *         description: Failed to delete settings
     */
    deleteSettings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                if (!workspaceId) {
                    response_1.AppResponse.badRequest(res, "Workspace ID is required");
                    return;
                }
                const success = yield this.settingsService.deleteSettings(workspaceId);
                if (success) {
                    response_1.AppResponse.success(res, { message: "Settings deleted successfully" });
                }
                else {
                    response_1.AppResponse.notFound(res, "Settings not found or could not be deleted");
                }
            }
            catch (error) {
                logger_1.default.error("Error deleting settings:", error);
                response_1.AppResponse.serverError(res, "Failed to delete settings");
            }
        });
    }
}
exports.SettingsController = SettingsController;
//# sourceMappingURL=settings.controller.js.map