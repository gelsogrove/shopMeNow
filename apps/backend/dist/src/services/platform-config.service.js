"use strict";
/**
 * 🚀 PLATFORM CONFIGURATION SERVICE
 *
 * Single Source of Truth for all platform configuration.
 * Replaces the hardcoded BillingPrices enum.
 *
 * Features:
 * - In-memory cache with 5-minute TTL
 * - Type-safe getters for prices, flags, and limits
 * - Automatic fallback for backwards compatibility (during migration)
 *
 * ⚠️ CRITICAL: After full migration, remove all fallbacks
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
exports.platformConfigService = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../utils/logger"));
// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
class PlatformConfigService {
    constructor() {
        this.cache = {
            prices: new Map(),
            flags: new Map(),
            limits: new Map(),
            lastFetch: null,
        };
        this.prisma = database_1.prisma;
    }
    /**
     * Initialize or refresh the cache
     */
    refreshCache() {
        return __awaiter(this, void 0, void 0, function* () {
            const configs = yield this.prisma.platformConfig.findMany({
                where: { isActive: true },
            });
            // Clear existing cache
            this.cache.prices.clear();
            this.cache.flags.clear();
            this.cache.limits.clear();
            // Populate cache by type
            for (const config of configs) {
                const item = {
                    key: config.key,
                    type: config.type,
                    value: config.value,
                    originalValue: config.originalValue,
                    description: config.description,
                    isActive: config.isActive,
                };
                switch (config.type) {
                    case "PRICE":
                        this.cache.prices.set(config.key, item);
                        break;
                    case "FLAG":
                        this.cache.flags.set(config.key, item);
                        break;
                    case "LIMIT":
                        this.cache.limits.set(config.key, item);
                        break;
                }
            }
            this.cache.lastFetch = new Date();
            logger_1.default.info(`[PlatformConfig] Cache refreshed: ${configs.length} items (${this.cache.prices.size} prices, ${this.cache.flags.size} flags, ${this.cache.limits.size} limits)`);
        });
    }
    /**
     * Check if cache is stale and needs refresh
     */
    isCacheStale() {
        if (!this.cache.lastFetch)
            return true;
        const now = new Date();
        return now.getTime() - this.cache.lastFetch.getTime() > CACHE_TTL_MS;
    }
    /**
     * Ensure cache is fresh
     */
    ensureCache() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isCacheStale()) {
                yield this.refreshCache();
            }
        });
    }
    /**
     * Force cache refresh (use after admin updates config)
     */
    invalidateCache() {
        return __awaiter(this, void 0, void 0, function* () {
            this.cache.lastFetch = null;
            yield this.refreshCache();
        });
    }
    // ============================================================================
    // 💰 PRICE GETTERS
    // ============================================================================
    /**
     * Get a price value by key
     * @param key - The price key (e.g., "BASIC_MONTHLY", "MESSAGE")
     * @returns The price as a number, or 0 if not found
     */
    getPrice(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const item = this.cache.prices.get(key);
            if (!item) {
                console.warn(`[PlatformConfig] Price not found: ${key}`);
                return 0;
            }
            return parseFloat(item.value);
        });
    }
    /**
     * Get price with original value for strikethrough display
     */
    getPriceWithOriginal(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const item = this.cache.prices.get(key);
            if (!item) {
                console.warn(`[PlatformConfig] Price not found: ${key}`);
                return { current: 0, original: null };
            }
            return {
                current: parseFloat(item.value),
                original: item.originalValue ? parseFloat(item.originalValue) : null,
            };
        });
    }
    /**
     * Get all prices as a map
     */
    getAllPrices() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const result = new Map();
            for (const [key, item] of this.cache.prices) {
                result.set(key, {
                    current: parseFloat(item.value),
                    original: item.originalValue ? parseFloat(item.originalValue) : null,
                    description: item.description,
                });
            }
            return result;
        });
    }
    // ============================================================================
    // 🚩 FLAG GETTERS
    // ============================================================================
    /**
     * Get a feature flag value
     * @param key - The flag key (e.g., "canLogin", "canRegister")
     * @returns The flag as a boolean, or true if not found (safe default)
     */
    getFlag(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const item = this.cache.flags.get(key);
            if (!item) {
                console.warn(`[PlatformConfig] Flag not found: ${key}, defaulting to true`);
                return true; // Safe default: allow operation
            }
            return item.value === "true";
        });
    }
    /**
     * Get all flags as a map
     */
    getAllFlags() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const result = new Map();
            for (const [key, item] of this.cache.flags) {
                result.set(key, item.value === "true");
            }
            return result;
        });
    }
    /**
     * Check if login is allowed
     */
    canLogin() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getFlag("canLogin");
        });
    }
    /**
     * Check if registration is allowed
     */
    canRegister() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getFlag("canRegister");
        });
    }
    /**
     * Check if landing page redirect is enabled
     */
    isLandingPageEnabled() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getFlag("landingPageEnabled");
        });
    }
    // ============================================================================
    // 📊 LIMIT GETTERS
    // ============================================================================
    /**
     * Get a limit value by key
     * @param key - The limit key (e.g., "FREE_PRODUCTS", "BASIC_CLIENTS")
     * @returns The limit as a number, or 0 if not found
     */
    getLimit(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const item = this.cache.limits.get(key);
            if (!item) {
                console.warn(`[PlatformConfig] Limit not found: ${key}`);
                return 0;
            }
            return parseInt(item.value, 10);
        });
    }
    /**
     * Get all limits as a map
     */
    getAllLimits() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const result = new Map();
            for (const [key, item] of this.cache.limits) {
                result.set(key, parseInt(item.value, 10));
            }
            return result;
        });
    }
    // ============================================================================
    // 📤 PUBLIC API RESPONSE FORMATTERS
    // ============================================================================
    /**
     * Get full configuration for public API (frontend consumption)
     */
    getPublicConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const prices = {};
            const flags = {};
            const limits = {};
            for (const [key, item] of this.cache.prices) {
                prices[key] = {
                    current: parseFloat(item.value),
                    original: item.originalValue ? parseFloat(item.originalValue) : null,
                };
            }
            for (const [key, item] of this.cache.flags) {
                flags[key] = item.value === "true";
            }
            for (const [key, item] of this.cache.limits) {
                limits[key] = parseInt(item.value, 10);
            }
            return { prices, flags, limits };
        });
    }
    /**
     * Get configuration with descriptions for admin panel
     */
    getAdminConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCache();
            const prices = [];
            const flags = [];
            const limits = [];
            for (const [key, item] of this.cache.prices) {
                prices.push({
                    key,
                    current: parseFloat(item.value),
                    original: item.originalValue ? parseFloat(item.originalValue) : null,
                    description: item.description,
                });
            }
            // Only include supported flags exposed in admin UI
            const supportedFlags = ["canLogin", "canRegister", "landingPageEnabled"];
            for (const [key, item] of this.cache.flags) {
                if (supportedFlags.includes(key)) {
                    flags.push({
                        key,
                        value: item.value === "true",
                        description: item.description,
                    });
                }
            }
            for (const [key, item] of this.cache.limits) {
                limits.push({
                    key,
                    value: parseInt(item.value, 10),
                    description: item.description,
                });
            }
            return { prices, flags, limits };
        });
    }
    // ============================================================================
    // 🔧 ADMIN UPDATE METHODS
    // ============================================================================
    /**
     * Update a configuration value (admin only)
     */
    updateConfig(key, value, originalValue) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updated = yield this.prisma.platformConfig.update({
                    where: { key },
                    data: {
                        value,
                        originalValue: originalValue !== null && originalValue !== void 0 ? originalValue : null,
                        updatedAt: new Date(),
                    },
                });
                // Invalidate cache after update
                yield this.invalidateCache();
                return {
                    key: updated.key,
                    type: updated.type,
                    value: updated.value,
                    originalValue: updated.originalValue,
                    description: updated.description,
                    isActive: updated.isActive,
                };
            }
            catch (error) {
                console.error(`[PlatformConfig] Failed to update ${key}:`, error);
                return null;
            }
        });
    }
    /**
     * Toggle a flag (admin only)
     */
    toggleFlag(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentValue = yield this.getFlag(key);
            const newValue = !currentValue;
            yield this.updateConfig(key, newValue.toString());
            return newValue;
        });
    }
}
// Export singleton instance
exports.platformConfigService = new PlatformConfigService();
//# sourceMappingURL=platform-config.service.js.map