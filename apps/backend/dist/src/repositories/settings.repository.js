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
exports.SettingsRepository = void 0;
const settings_entity_1 = require("../domain/entities/settings.entity");
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Implementation of Settings Repository using Prisma
 */
class SettingsRepository {
    /**
     * Convert Prisma model to domain entity
     */
    toDomainEntity(settingsData) {
        return new settings_entity_1.Settings({
            id: settingsData.id,
            phoneNumber: settingsData.phoneNumber,
            apiKey: settingsData.apiKey,
            webhookUrl: settingsData.webhookUrl,
            settings: settingsData.settings,
            gdpr: settingsData.gdpr,
            workspaceId: settingsData.workspaceId,
            createdAt: settingsData.createdAt,
            updatedAt: settingsData.updatedAt
        });
    }
    /**
     * Find settings by workspace ID
     */
    findByWorkspaceId(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const settings = yield prisma_1.prisma.whatsappSettings.findFirst({
                    where: { workspaceId }
                });
                return settings ? this.toDomainEntity(settings) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding settings for workspace ${workspaceId}:`, error);
                return null;
            }
        });
    }
    /**
     * Create settings for a workspace
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate a unique phone number if needed to avoid conflicts
                let phoneNumber = data.phoneNumber;
                if (phoneNumber) {
                    // Check if this phone number already exists
                    const existingWithPhone = yield prisma_1.prisma.whatsappSettings.findFirst({
                        where: { phoneNumber }
                    });
                    if (existingWithPhone) {
                        // Make it unique by appending part of the workspace ID
                        phoneNumber = `${phoneNumber}-${data.workspaceId.substring(0, 8)}`;
                    }
                }
                else {
                    // Generate a placeholder phone number
                    phoneNumber = `temp-${data.workspaceId.substring(0, 8)}`;
                }
                const settings = yield prisma_1.prisma.whatsappSettings.create({
                    data: {
                        phoneNumber,
                        apiKey: data.apiKey || '',
                        webhookUrl: data.webhookUrl,
                        settings: data.settings || {},
                        gdpr: data.gdpr,
                        workspaceId: data.workspaceId
                    }
                });
                return this.toDomainEntity(settings);
            }
            catch (error) {
                logger_1.default.error("Error creating settings:", error);
                // Create a mock settings object instead of throwing
                const mockSettings = new settings_entity_1.Settings({
                    id: 'temp-id',
                    phoneNumber: data.phoneNumber || '',
                    apiKey: data.apiKey || '',
                    webhookUrl: data.webhookUrl,
                    settings: data.settings || {},
                    gdpr: data.gdpr,
                    workspaceId: data.workspaceId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                return mockSettings;
            }
        });
    }
    /**
     * Update settings for a workspace
     */
    update(workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First check if settings exist
                const existingSettings = yield prisma_1.prisma.whatsappSettings.findFirst({
                    where: { workspaceId }
                });
                if (!existingSettings) {
                    // If not, create them
                    return this.create({
                        workspaceId,
                        phoneNumber: data.phoneNumber || '',
                        apiKey: data.apiKey || '',
                        webhookUrl: data.webhookUrl,
                        settings: data.settings,
                        gdpr: data.gdpr
                    });
                }
                const updateData = {};
                // Check phone number uniqueness if it's being updated
                if (data.phoneNumber !== undefined && data.phoneNumber !== existingSettings.phoneNumber) {
                    const existingWithPhone = yield prisma_1.prisma.whatsappSettings.findFirst({
                        where: {
                            phoneNumber: data.phoneNumber,
                            id: { not: existingSettings.id }
                        }
                    });
                    if (existingWithPhone) {
                        // Make it unique by appending part of the workspace ID
                        updateData.phoneNumber = `${data.phoneNumber}-${workspaceId.substring(0, 8)}`;
                    }
                    else {
                        updateData.phoneNumber = data.phoneNumber;
                    }
                }
                if (data.apiKey !== undefined)
                    updateData.apiKey = data.apiKey;
                if (data.webhookUrl !== undefined)
                    updateData.webhookUrl = data.webhookUrl;
                if (data.settings !== undefined)
                    updateData.settings = data.settings;
                if (data.gdpr !== undefined)
                    updateData.gdpr = data.gdpr;
                const settings = yield prisma_1.prisma.whatsappSettings.update({
                    where: { id: existingSettings.id },
                    data: updateData
                });
                return this.toDomainEntity(settings);
            }
            catch (error) {
                logger_1.default.error(`Error updating settings for workspace ${workspaceId}:`, error);
                // Return existing settings if possible or create a mock
                try {
                    const existingSettings = yield prisma_1.prisma.whatsappSettings.findFirst({
                        where: { workspaceId }
                    });
                    if (existingSettings) {
                        return this.toDomainEntity(existingSettings);
                    }
                }
                catch (e) {
                    // Ignore this error and continue with mock
                }
                // Create a mock settings object
                const mockSettings = new settings_entity_1.Settings({
                    id: 'temp-id',
                    phoneNumber: data.phoneNumber || '',
                    apiKey: data.apiKey || '',
                    webhookUrl: data.webhookUrl,
                    settings: data.settings || {},
                    gdpr: data.gdpr,
                    workspaceId: workspaceId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                return mockSettings;
            }
        });
    }
    /**
     * Delete settings for a workspace
     */
    delete(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.whatsappSettings.deleteMany({
                    where: { workspaceId }
                });
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error deleting settings for workspace ${workspaceId}:`, error);
                return false;
            }
        });
    }
    /**
     * Get GDPR content for a workspace
     */
    getGdprContent(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const settings = yield prisma_1.prisma.whatsappSettings.findFirst({
                    where: { workspaceId },
                    select: { gdpr: true }
                });
                return (settings === null || settings === void 0 ? void 0 : settings.gdpr) || null;
            }
            catch (error) {
                logger_1.default.error(`Error getting GDPR content for workspace ${workspaceId}:`, error);
                return null;
            }
        });
    }
    /**
     * Update GDPR content for a workspace
     */
    updateGdprContent(workspaceId, gdprContent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[GDPR REPO] Starting updateGdprContent for workspace: ${workspaceId}`);
                logger_1.default.info(`[GDPR REPO] GDPR content length: ${gdprContent.length}`);
                // Check if settings already exist
                const existingSettings = yield prisma_1.prisma.whatsappSettings.findFirst({
                    where: { workspaceId }
                });
                logger_1.default.info(`[GDPR REPO] Existing settings found: ${existingSettings ? 'yes' : 'no'}`);
                if (existingSettings) {
                    logger_1.default.info(`[GDPR REPO] Existing settings ID: ${existingSettings.id}`);
                }
                let settings;
                if (existingSettings) {
                    // Update existing settings
                    logger_1.default.info(`[GDPR REPO] Updating existing settings with ID: ${existingSettings.id}`);
                    settings = yield prisma_1.prisma.whatsappSettings.update({
                        where: { id: existingSettings.id },
                        data: { gdpr: gdprContent }
                    });
                    logger_1.default.info(`[GDPR REPO] Update completed successfully`);
                }
                else {
                    // Generate a unique phone number for the new settings
                    const phoneNumber = `gdpr-${workspaceId.substring(0, 8)}`;
                    logger_1.default.info(`[GDPR REPO] Creating new settings with phone: ${phoneNumber}`);
                    // Create new settings with generated phone number
                    settings = yield prisma_1.prisma.whatsappSettings.create({
                        data: {
                            workspaceId,
                            gdpr: gdprContent,
                            phoneNumber,
                            apiKey: ""
                        }
                    });
                    logger_1.default.info(`[GDPR REPO] Create completed successfully`);
                }
                logger_1.default.info(`[GDPR REPO] Final settings ID: ${settings.id}`);
                logger_1.default.info(`[GDPR REPO] Final GDPR content length: ${settings.gdpr ? settings.gdpr.length : 'undefined'}`);
                return this.toDomainEntity(settings);
            }
            catch (error) {
                logger_1.default.error(`[GDPR REPO] Error updating GDPR content for workspace ${workspaceId}:`, error);
                // Create a mock settings object instead of throwing
                const mockSettings = new settings_entity_1.Settings({
                    id: 'temp-id',
                    phoneNumber: `gdpr-${workspaceId.substring(0, 8)}`,
                    apiKey: '',
                    webhookUrl: '',
                    settings: {},
                    gdpr: gdprContent,
                    workspaceId: workspaceId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                return mockSettings;
            }
        });
    }
}
exports.SettingsRepository = SettingsRepository;
//# sourceMappingURL=settings.repository.js.map