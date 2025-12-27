"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
const uuid_1 = require("uuid");
/**
 * Settings Entity
 * Represents WhatsApp settings in the domain
 */
class Settings {
    constructor(props) {
        this.id = props.id || (0, uuid_1.v4)();
        this.phoneNumber = props.phoneNumber;
        this.apiKey = props.apiKey;
        this.webhookUrl = props.webhookUrl;
        this.settings = props.settings || {};
        this.gdpr = props.gdpr;
        this.workspaceId = props.workspaceId;
        this.createdAt = props.createdAt || new Date();
        this.updatedAt = props.updatedAt || new Date();
    }
    /**
     * Validate settings data
     */
    validate() {
        if (!this.phoneNumber || this.phoneNumber.trim() === '') {
            return false;
        }
        if (!this.apiKey || this.apiKey.trim() === '') {
            return false;
        }
        if (!this.workspaceId) {
            return false;
        }
        return true;
    }
    /**
     * Check if the settings are configured
     */
    isConfigured() {
        return !!(this.phoneNumber && this.apiKey);
    }
    /**
     * Check if GDPR is configured
     */
    hasGdprContent() {
        return !!this.gdpr && this.gdpr.trim() !== '';
    }
    /**
     * Get settings value by key
     */
    getSetting(key) {
        return this.settings ? this.settings[key] : undefined;
    }
}
exports.Settings = Settings;
//# sourceMappingURL=settings.entity.js.map