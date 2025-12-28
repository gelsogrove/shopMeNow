"use strict";
/**
 * TemplateLoaderService - Lightweight On-Demand Template Loading
 *
 * PERFORMANCE-OPTIMIZED: Only handles STEP 1 (RENDER conditionals)
 * Each agent handles STEP 2 (REPLACE variables) with its own optimized queries
 *
 * Flow:
 * 1. Load template from file (CACHED in memory)
 * 2. Compile {{#if}} conditionals with workspace settings
 * 3. Return template ready for variable replacement
 *
 * Performance:
 * - Template cache: O(1) lookup after first load
 * - Conditional compilation: O(n) where n = template length
 * - Total overhead: < 5ms per request
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.TemplateLoaderService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const template_engine_service_1 = require("./prompt-builder/template-engine.service");
const logger_1 = __importDefault(require("../../utils/logger"));
// Template file mapping by agent type
const TEMPLATE_FILES = {
    ROUTER: "01-router.template.md",
    PRODUCT_SEARCH: "02-product-search.template.md",
    CART_MANAGEMENT: "03-cart-management.template.md", // Dedicated template with {{products}}
    ORDER_TRACKING: "03-order-tracking.template.md",
    CUSTOMER_SUPPORT: "04-customer-support.template.md",
    PROFILE_MANAGEMENT: "05-profile-management.template.md",
    SECURITY: "06-security.template.md",
    TRANSLATION: "07-translation.template.md",
    SUMMARY_AGENT: "08-summary.template.md",
    PRODUCT_CONTEXT: "09-product-context.template.md",
};
// Shared agents (always from root templates)
const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT"];
// Template cache - lives for entire server lifetime
const templateCache = new Map();
// Workspace settings cache - short TTL for freshness
const workspaceCache = new Map();
const WORKSPACE_CACHE_TTL_MS = 30000; // 30 seconds
class TemplateLoaderService {
    constructor(prisma) {
        this.prisma = prisma;
        this.templateEngine = new template_engine_service_1.TemplateEngineService();
    }
    /**
     * Singleton instance for maximum cache efficiency
     */
    static getInstance(prisma) {
        if (!TemplateLoaderService.instance) {
            TemplateLoaderService.instance = new TemplateLoaderService(prisma);
        }
        return TemplateLoaderService.instance;
    }
    /**
     * Load and render template with conditionals compiled
     *
     * @param agentType - Agent type (ROUTER, PRODUCT_SEARCH, etc.)
     * @param workspaceId - Workspace ID for settings lookup
     * @returns Template with {{#if}} resolved, {{variables}} intact
     *
     * Performance: < 5ms (cached template + cached workspace settings)
     */
    loadAndRenderTemplate(agentType, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            try {
                // 1. Get workspace settings (cached)
                const settings = yield this.getWorkspaceSettings(workspaceId);
                // 2. Load template (cached)
                const template = this.loadTemplate(agentType, settings.sellsProductsAndServices);
                // 3. Process conditionals (pure CPU, no I/O)
                const rendered = this.templateEngine.process(template, settings);
                const elapsed = performance.now() - startTime;
                logger_1.default.debug(`⚡ Template loaded in ${elapsed.toFixed(2)}ms`, { agentType, chars: rendered.length });
                return rendered;
            }
            catch (error) {
                logger_1.default.error(`❌ Failed to load template for ${agentType}:`, error);
                throw error;
            }
        });
    }
    /**
     * Load template from file (cached in memory - DISABLED IN DEVELOPMENT)
     */
    loadTemplate(agentType, isEcommerce) {
        const templateFile = TEMPLATE_FILES[agentType];
        if (!templateFile) {
            throw new Error(`Unknown agent type: ${agentType}`);
        }
        // Determine folder
        let folder;
        if (SHARED_AGENTS.includes(agentType)) {
            folder = ""; // Root templates
        }
        else if (isEcommerce) {
            folder = "ecommerce";
        }
        else {
            folder = "informational";
        }
        const cacheKey = `${folder}/${templateFile}`;
        // 🔧 DEVELOPMENT: Always reload from disk (no cache)
        const isDevelopment = process.env.NODE_ENV === "development";
        // Cache hit - instant return (SKIP IN DEVELOPMENT)
        if (!isDevelopment && templateCache.has(cacheKey)) {
            return templateCache.get(cacheKey);
        }
        // Load from disk
        const templatePath = folder
            ? path.join(__dirname, "..", "..", "templates", folder, templateFile)
            : path.join(__dirname, "..", "..", "templates", templateFile);
        try {
            const content = fs.readFileSync(templatePath, "utf-8");
            // Only cache in production
            if (!isDevelopment) {
                templateCache.set(cacheKey, content);
                logger_1.default.info(`📂 Template cached: ${cacheKey}`);
            }
            else {
                logger_1.default.debug(`📂 Template loaded (no cache in dev): ${cacheKey}`);
            }
            return content;
        }
        catch (error) {
            // Fallback for informational: try ecommerce version
            if (folder === "informational") {
                const fallbackPath = path.join(__dirname, "..", "..", "templates", "ecommerce", templateFile);
                try {
                    const content = fs.readFileSync(fallbackPath, "utf-8");
                    // Only cache in production
                    if (!isDevelopment) {
                        templateCache.set(cacheKey, content);
                    }
                    logger_1.default.warn(`⚠️ Using ecommerce fallback for: ${templateFile}`);
                    return content;
                }
                catch (_a) {
                    // Fall through to original error
                }
            }
            throw new Error(`Template not found: ${templatePath}`);
        }
    }
    /**
     * Get workspace settings (cached with short TTL)
     */
    getWorkspaceSettings(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const now = Date.now();
            const cached = workspaceCache.get(workspaceId);
            // Cache hit and still fresh
            if (cached && (now - cached.timestamp) < WORKSPACE_CACHE_TTL_MS) {
                return cached.settings;
            }
            // Cache miss or stale - fetch from DB
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    sellsProductsAndServices: true,
                    hasHumanSupport: true,
                    hasSalesAgents: true,
                    address: true, // 🆕 For {{#if address}} conditional in templates
                },
            });
            if (!workspace) {
                throw new Error(`Workspace not found: ${workspaceId}`);
            }
            const settings = {
                sellsProductsAndServices: (_a = workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true,
                hasHumanSupport: (_b = workspace.hasHumanSupport) !== null && _b !== void 0 ? _b : false,
                hasSalesAgents: (_c = workspace.hasSalesAgents) !== null && _c !== void 0 ? _c : false,
                address: workspace.address || "", // 🆕 Physical address for location questions
            };
            workspaceCache.set(workspaceId, { settings, timestamp: now });
            return settings;
        });
    }
    /**
     * Clear all caches (for testing)
     */
    static clearCaches() {
        templateCache.clear();
        workspaceCache.clear();
        logger_1.default.info("🗑️ Template and workspace caches cleared");
    }
    /**
     * Invalidate workspace cache (call after workspace settings update)
     */
    static invalidateWorkspace(workspaceId) {
        workspaceCache.delete(workspaceId);
        logger_1.default.debug(`🔄 Workspace cache invalidated: ${workspaceId}`);
    }
}
exports.TemplateLoaderService = TemplateLoaderService;
//# sourceMappingURL=template-loader.service.js.map