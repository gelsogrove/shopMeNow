"use strict";
/**
 * 🚀 PLATFORM CONFIGURATION CONTROLLER
 *
 * Exposes platform configuration via REST API.
 *
 * Endpoints:
 * - GET /api/platform-config (public) - Get all config for frontend
 * - GET /api/platform-config/admin (auth required) - Get detailed config for admin
 * - PUT /api/platform-config/:key (auth required) - Update a config value
 * - POST /api/platform-config/flags/:key/toggle (auth required) - Toggle a flag
 * - POST /api/platform-config/cache/invalidate (auth required) - Force cache refresh
 *
 * @author Andrea Gelso - eChatbot Platform
 */
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
exports.platformConfigController = exports.PlatformConfigController = void 0;
const platform_config_service_1 = require("../../../services/platform-config.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class PlatformConfigController {
    /**
     * GET /api/platform-config
     * Public endpoint - returns all configuration for frontend
     */
    getPublicConfig(_req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const config = yield platform_config_service_1.platformConfigService.getPublicConfig();
                return res.status(200).json({
                    success: true,
                    data: config,
                });
            }
            catch (error) {
                logger_1.default.error("[PlatformConfigController] Error getting public config:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to fetch platform configuration",
                });
            }
        });
    }
    /**
     * GET /api/platform-config/admin
     * Admin endpoint - returns detailed configuration with descriptions
     */
    getAdminConfig(_req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const config = yield platform_config_service_1.platformConfigService.getAdminConfig();
                return res.status(200).json({
                    success: true,
                    data: config,
                });
            }
            catch (error) {
                logger_1.default.error("[PlatformConfigController] Error getting admin config:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to fetch admin configuration",
                });
            }
        });
    }
    /**
     * PUT /api/platform-config/:key
     * Update a configuration value
     */
    updateConfig(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { key } = req.params;
                const { value, originalValue } = req.body;
                if (!key) {
                    return res.status(400).json({
                        success: false,
                        error: "Configuration key is required",
                    });
                }
                if (value === undefined || value === null) {
                    return res.status(400).json({
                        success: false,
                        error: "Value is required",
                    });
                }
                const updated = yield platform_config_service_1.platformConfigService.updateConfig(key, String(value), originalValue ? String(originalValue) : undefined);
                if (!updated) {
                    return res.status(404).json({
                        success: false,
                        error: `Configuration key not found: ${key}`,
                    });
                }
                logger_1.default.info(`[PlatformConfigController] Updated config: ${key} = ${value}`);
                return res.status(200).json({
                    success: true,
                    data: updated,
                });
            }
            catch (error) {
                logger_1.default.error("[PlatformConfigController] Error updating config:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to update configuration",
                });
            }
        });
    }
    /**
     * POST /api/platform-config/flags/:key/toggle
     * Toggle a feature flag
     */
    toggleFlag(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { key } = req.params;
                if (!key) {
                    return res.status(400).json({
                        success: false,
                        error: "Flag key is required",
                    });
                }
                const newValue = yield platform_config_service_1.platformConfigService.toggleFlag(key);
                logger_1.default.info(`[PlatformConfigController] Toggled flag: ${key} = ${newValue}`);
                return res.status(200).json({
                    success: true,
                    data: {
                        key,
                        value: newValue,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[PlatformConfigController] Error toggling flag:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to toggle flag",
                });
            }
        });
    }
    /**
     * POST /api/platform-config/cache/invalidate
     * Force cache invalidation
     */
    invalidateCache(_req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield platform_config_service_1.platformConfigService.invalidateCache();
                logger_1.default.info("[PlatformConfigController] Cache invalidated manually");
                return res.status(200).json({
                    success: true,
                    message: "Cache invalidated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("[PlatformConfigController] Error invalidating cache:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to invalidate cache",
                });
            }
        });
    }
    /**
     * GET /api/platform-config/flags/check
     * Quick check for feature flags (used by login/register forms)
     */
    checkFlags(_req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [canLogin, canRegister, landingPageEnabled] = yield Promise.all([
                    platform_config_service_1.platformConfigService.canLogin(),
                    platform_config_service_1.platformConfigService.canRegister(),
                    platform_config_service_1.platformConfigService.isLandingPageEnabled(),
                ]);
                return res.status(200).json({
                    success: true,
                    data: {
                        canLogin,
                        canRegister,
                        landingPageEnabled,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[PlatformConfigController] Error checking flags:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to check feature flags",
                });
            }
        });
    }
}
exports.PlatformConfigController = PlatformConfigController;
// Export singleton instance
exports.platformConfigController = new PlatformConfigController();
//# sourceMappingURL=platform-config.controller.js.map