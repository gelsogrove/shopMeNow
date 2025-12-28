"use strict";
/**
 * TemplateLoaderService - Load prompt templates from filesystem
 *
 * Single Responsibility: Load template files for each agent type.
 * Templates are organized by workspace type:
 *   - shared/     → Templates used by ALL workspace types (Security, Translation, Summary)
 *   - ecommerce/  → Templates for e-commerce workspaces (sell products/services)
 *   - informational/ → Templates for info-only workspaces (no sales)
 *
 * @architecture Part of PromptBuilder system
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
const logger_1 = __importDefault(require("../../../utils/logger"));
// Agent types that are SHARED across all workspace types
const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT"];
// Agent types available ONLY for e-commerce workspaces
const ECOMMERCE_ONLY_AGENTS = ["PRODUCT_SEARCH", "ORDER_TRACKING"];
// Map agent types to template file names
const TEMPLATE_FILES = {
    // Shared agents
    SECURITY: "06-security.template.md",
    TRANSLATION: "07-translation.template.md",
    SUMMARY_AGENT: "08-summary.template.md",
    // Workspace-specific agents
    ROUTER: "01-router.template.md",
    PRODUCT_SEARCH: "02-product-search.template.md",
    ORDER_TRACKING: "03-order-tracking.template.md",
    CUSTOMER_SUPPORT: "04-customer-support.template.md",
    PROFILE_MANAGEMENT: "05-profile-management.template.md",
};
class TemplateLoaderService {
    constructor() {
        this.cache = new Map();
        // Templates are in src/templates/ directory (up 3 levels from prompt-builder folder)
        this.templatesDir = path.join(__dirname, "..", "..", "..", "templates");
        logger_1.default.info(`✅ TemplateLoaderService initialized (dir: ${this.templatesDir})`);
    }
    /**
     * Load template for a specific agent type
     *
     * @param agentType - The agent type (ROUTER, PRODUCT_SEARCH, etc.)
     * @param hasEcommerce - Whether this workspace sells products/services
     * @returns Template content as string
     */
    load(agentType_1) {
        return __awaiter(this, arguments, void 0, function* (agentType, hasEcommerce = true) {
            const typeKey = String(agentType);
            const cacheKey = `${typeKey}:${hasEcommerce ? "ecommerce" : "informational"}`;
            // Check cache first
            if (this.cache.has(cacheKey)) {
                logger_1.default.debug(`📋 Template cache hit for ${cacheKey}`);
                return this.cache.get(cacheKey);
            }
            // Validate agent type for informational workspaces
            if (!hasEcommerce && ECOMMERCE_ONLY_AGENTS.includes(typeKey)) {
                throw new Error(`Agent type ${typeKey} is not available for informational workspaces`);
            }
            // Get template file name
            const templateFile = TEMPLATE_FILES[typeKey];
            if (!templateFile) {
                throw new Error(`No template defined for agent type: ${typeKey}`);
            }
            // Determine subdirectory based on agent type and workspace type
            const subDir = this.getTemplateSubDir(typeKey, hasEcommerce);
            // Build full path
            const templatePath = path.join(this.templatesDir, subDir, templateFile);
            // Check if file exists
            if (!fs.existsSync(templatePath)) {
                // Fallback to root templates folder for backward compatibility
                const fallbackPath = path.join(this.templatesDir, templateFile);
                if (fs.existsSync(fallbackPath)) {
                    logger_1.default.warn(`⚠️ Using fallback template for ${typeKey} (not in ${subDir}/)`);
                    const content = fs.readFileSync(fallbackPath, "utf-8");
                    this.cache.set(cacheKey, content);
                    return content;
                }
                throw new Error(`Template file not found: ${templatePath}`);
            }
            // Read template content
            const content = fs.readFileSync(templatePath, "utf-8");
            // Cache it
            this.cache.set(cacheKey, content);
            logger_1.default.info(`📄 Loaded template for ${typeKey} from ${subDir}/ (${content.length} chars)`);
            return content;
        });
    }
    /**
     * Determine which subdirectory to load template from
     */
    getTemplateSubDir(agentType, hasEcommerce) {
        // Shared agents always from shared/
        if (SHARED_AGENTS.includes(agentType)) {
            return "shared";
        }
        // E-commerce agents always from ecommerce/
        if (ECOMMERCE_ONLY_AGENTS.includes(agentType)) {
            return "ecommerce";
        }
        // Other agents depend on workspace type
        return hasEcommerce ? "ecommerce" : "informational";
    }
    /**
     * Get list of available agent types for a workspace type
     */
    getAvailableTypes(hasEcommerce = true) {
        if (hasEcommerce) {
            return Object.keys(TEMPLATE_FILES);
        }
        // Informational workspaces don't have e-commerce agents
        return Object.keys(TEMPLATE_FILES).filter(type => !ECOMMERCE_ONLY_AGENTS.includes(type));
    }
    /**
     * Clear template cache (useful for development/testing)
     */
    clearCache() {
        this.cache.clear();
        logger_1.default.info("🗑️ Template cache cleared");
    }
    /**
     * Reload all templates (useful for hot-reload during development)
     */
    reloadAll() {
        return __awaiter(this, arguments, void 0, function* (hasEcommerce = true) {
            this.clearCache();
            for (const agentType of this.getAvailableTypes(hasEcommerce)) {
                yield this.load(agentType, hasEcommerce);
            }
            logger_1.default.info("🔄 All templates reloaded");
        });
    }
}
exports.TemplateLoaderService = TemplateLoaderService;
//# sourceMappingURL=template-loader.service.js.map