import { Request, Response } from "express";
import { SettingsService } from "../../../application/services/settings.service";
import logger from "../../../utils/logger";
import { AppResponse } from "../../../utils/response";

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
export class SettingsController {
  private settingsService: SettingsService;
  
  constructor() {
    this.settingsService = new SettingsService();
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
  async getGdprContent(req: Request, res: Response): Promise<void> {
    try {
      // Extract workspaceId from header (simplified approach)
      const workspaceId = req.headers['x-workspace-id'] as string;

      if (!workspaceId || workspaceId.trim() === '') {
        AppResponse.badRequest(res, "Workspace ID is required");
        return;
      }

      logger.info(`[GDPR CONTROLLER] Getting GDPR content for workspace: ${workspaceId}`);
      
      // Use the existing settings service that auto-creates if not exists
      const gdprContent = await this.settingsService.getGdprContent(workspaceId);
      
      logger.info(`[GDPR CONTROLLER] GDPR content retrieved, length: ${gdprContent ? gdprContent.length : 0}`);
      
      AppResponse.success(res, { 
        success: true,
        content: gdprContent || '',
        data: { gdpr: gdprContent || '' }
      });
    } catch (error) {
      logger.error("Error getting GDPR content:", error);
      AppResponse.serverError(res, "Failed to get GDPR content");
    }
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
  async updateGdprContent(req: Request, res: Response): Promise<void> {
    try {
      // Extract workspaceId from header (simplified approach)
      const workspaceId = req.headers['x-workspace-id'] as string;
      const { gdpr } = req.body;

      logger.info(`[GDPR CONTROLLER] Starting update for workspace: ${workspaceId}`);
      logger.info(`[GDPR CONTROLLER] GDPR content length: ${gdpr ? gdpr.length : 'undefined'}`);

      if (!workspaceId) {
        logger.error("[GDPR CONTROLLER] Missing workspaceId");
        AppResponse.badRequest(res, "Workspace ID is required");
        return;
      }

      if (gdpr === undefined || gdpr === null) {
        logger.error("[GDPR CONTROLLER] Missing GDPR content");
        AppResponse.badRequest(res, "GDPR content is required");
        return;
      }

      // Use the existing settings service that auto-creates if not exists
      const updatedSettings = await this.settingsService.updateGdprContent(workspaceId, gdpr);
      
      logger.info(`[GDPR CONTROLLER] GDPR content updated successfully`);
      
      // Return the response structure expected by frontend and tests
      AppResponse.success(res, {
        success: true,
        data: updatedSettings
      });
    } catch (error) {
      logger.error("Error updating GDPR content:", error);
      AppResponse.serverError(res, "Failed to update GDPR content");
    }
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
  async getDefaultGdprContent(req: Request, res: Response): Promise<void> {
    try {
      const defaultGdprContent = await this.settingsService.getDefaultGdprContent();
      AppResponse.success(res, { content: defaultGdprContent });
    } catch (error) {
      logger.error("Error getting default GDPR content:", error);
      AppResponse.serverError(res, "Failed to get default GDPR content");
    }
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
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      logger.info(`Getting settings for workspace ${workspaceId}`);

      if (!workspaceId) {
        AppResponse.badRequest(res, "Workspace ID is required");
        return;
      }

      const settings = await this.settingsService.getSettings(workspaceId);
      
      // Always return success, even if settings don't exist
      // The service will return an appropriate default object
      AppResponse.success(res, settings || {});
    } catch (error) {
      logger.error("Error getting settings:", error);
      AppResponse.serverError(res, "Failed to get settings");
    }
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
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const settingsData = req.body;

      logger.info(`Updating settings for workspace ${workspaceId}`);

      if (!workspaceId) {
        AppResponse.badRequest(res, "Workspace ID is required");
        return;
      }

      if (!settingsData) {
        AppResponse.badRequest(res, "Settings data is required");
        return;
      }

      const updatedSettings = await this.settingsService.updateSettings(workspaceId, settingsData);
      AppResponse.success(res, updatedSettings);
    } catch (error) {
      logger.error("Error updating settings:", error);
      AppResponse.serverError(res, "Failed to update settings");
    }
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
  async deleteSettings(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        AppResponse.badRequest(res, "Workspace ID is required");
        return;
      }

      const success = await this.settingsService.deleteSettings(workspaceId);
      
      if (success) {
        AppResponse.success(res, { message: "Settings deleted successfully" });
      } else {
        AppResponse.notFound(res, "Settings not found or could not be deleted");
      }
    } catch (error) {
      logger.error("Error deleting settings:", error);
      AppResponse.serverError(res, "Failed to delete settings");
    }
  }
} 