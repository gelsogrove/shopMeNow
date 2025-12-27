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
exports.SettingsService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const settings_entity_1 = require("../../domain/entities/settings.entity");
const settings_repository_1 = require("../../repositories/settings.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service layer for Settings
 * Handles business logic for WhatsApp settings
 */
class SettingsService {
    constructor() {
        this.repository = new settings_repository_1.SettingsRepository();
    }
    /**
     * Get settings for a workspace
     * @param workspaceId The workspace ID
     */
    getSettings(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to find existing settings
                const existingSettings = yield this.repository.findByWorkspaceId(workspaceId);
                // If settings exist, return them
                if (existingSettings) {
                    return existingSettings;
                }
                // If settings don't exist, create and return default settings
                const defaultSettings = new settings_entity_1.Settings({
                    workspaceId,
                    phoneNumber: '',
                    apiKey: '',
                    webhookUrl: '',
                    settings: {},
                    gdpr: yield this.getDefaultGdprContent()
                });
                // Create settings in database but don't throw if it fails
                try {
                    return yield this.repository.create(defaultSettings);
                }
                catch (error) {
                    logger_1.default.error(`Failed to create default settings: ${error.message}`);
                    return defaultSettings;
                }
            }
            catch (error) {
                logger_1.default.error(`Error in getSettings: ${error.message}`);
                return null;
            }
        });
    }
    /**
     * Update settings for a workspace
     * @param workspaceId The workspace ID
     * @param data The settings data
     */
    updateSettings(workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to find existing settings
                const existingSettings = yield this.repository.findByWorkspaceId(workspaceId);
                if (existingSettings) {
                    // Update existing settings
                    return yield this.repository.update(workspaceId, data);
                }
                else {
                    // Create new settings with provided data
                    const newSettings = new settings_entity_1.Settings({
                        workspaceId,
                        phoneNumber: data.phoneNumber || '',
                        apiKey: data.apiKey || '',
                        webhookUrl: data.webhookUrl || '',
                        settings: data.settings || {},
                        gdpr: data.gdpr || (yield this.getDefaultGdprContent())
                    });
                    return yield this.repository.create(newSettings);
                }
            }
            catch (error) {
                logger_1.default.error(`Error in updateSettings: ${error.message}`);
                // Return a temporary settings object instead of throwing
                return new settings_entity_1.Settings({
                    id: 'temp-id',
                    workspaceId,
                    phoneNumber: data.phoneNumber || '',
                    apiKey: data.apiKey || '',
                    webhookUrl: data.webhookUrl || '',
                    settings: data.settings || {},
                    gdpr: data.gdpr || (yield this.getDefaultGdprContent()),
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });
    }
    /**
     * Delete settings for a workspace
     * @param workspaceId The workspace ID
     */
    deleteSettings(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.repository.delete(workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in deleteSettings: ${error.message}`);
                return false;
            }
        });
    }
    /**
     * Get GDPR content for a workspace
     * @param workspaceId The workspace ID
     */
    getGdprContent(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (yield this.repository.getGdprContent(workspaceId)) || (yield this.getDefaultGdprContent());
            }
            catch (error) {
                logger_1.default.error(`Error in getGdprContent: ${error.message}`);
                return yield this.getDefaultGdprContent();
            }
        });
    }
    /**
     * Update GDPR content for a workspace
     * @param workspaceId The workspace ID
     * @param content The GDPR content
     */
    updateGdprContent(workspaceId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[GDPR SERVICE] Starting updateGdprContent for workspace: ${workspaceId}`);
                logger_1.default.info(`[GDPR SERVICE] Content length: ${content.length}`);
                const result = yield this.repository.updateGdprContent(workspaceId, content);
                logger_1.default.info(`[GDPR SERVICE] Repository returned: ${result ? 'success' : 'null'}`);
                if (result) {
                    logger_1.default.info(`[GDPR SERVICE] Result ID: ${result.id}, WorkspaceId: ${result.workspaceId}`);
                    logger_1.default.info(`[GDPR SERVICE] Result GDPR length: ${result.gdpr ? result.gdpr.length : 'undefined'}`);
                }
                return result;
            }
            catch (error) {
                logger_1.default.error(`Error in updateGdprContent: ${error.message}`);
                // Return a temporary settings object instead of throwing
                return new settings_entity_1.Settings({
                    id: 'temp-id',
                    workspaceId,
                    phoneNumber: '',
                    apiKey: '',
                    webhookUrl: '',
                    settings: {},
                    gdpr: content,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });
    }
    /**
     * Get default GDPR content from file
     */
    getDefaultGdprContent() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to read the GDPR content from file
                const filePath = path_1.default.join(process.cwd(), '..', 'finalproject-AG', 'GDPR.md');
                const content = fs_1.default.readFileSync(filePath, 'utf8');
                return content;
            }
            catch (error) {
                // If file doesn't exist or can't be read, return default content
                logger_1.default.warn(`GDPR.md file not found, using default content ${error}`);
                return `# GDPR Compliance

## Privacy Policy

This is a default GDPR privacy policy for your application.

### Data Collection
We collect minimal data necessary for the functioning of our services.

### Data Usage
Your data is used solely for providing you with our services.

### Data Rights
You have the right to access, modify, or request deletion of your data.

### Contact
For any privacy-related inquiries, please contact us at support@example.com.`;
            }
        });
    }
}
exports.SettingsService = SettingsService;
// Export a singleton instance for backward compatibility
exports.default = new SettingsService();
//# sourceMappingURL=settings.service.js.map