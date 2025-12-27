"use strict";
/**
 * Link Replacement Service
 *
 * Application Service Layer - Clean Architecture
 *
 * Handles replacement of token placeholders with actual generated links.
 * Supports cart, profile, orders, tracking, and checkout links with URL shortening.
 *
 * This is a utility service, NOT a calling function for LLM.
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
exports.linkReplacementService = exports.LinkReplacementService = void 0;
exports.ReplaceLinkWithToken = ReplaceLinkWithToken;
const logger_1 = __importDefault(require("../../utils/logger"));
const link_generator_service_1 = require("./link-generator.service");
const secure_token_service_1 = require("./secure-token.service");
/**
 * Service for replacing token placeholders in text with actual secure links
 */
class LinkReplacementService {
    constructor() {
        this.secureTokenService = new secure_token_service_1.SecureTokenService();
    }
    /**
     * Replace token placeholders in response text with actual links
     *
     * @param params - Parameters including response text and optional link type
     * @param customerId - Customer ID for token generation
     * @param workspaceId - Workspace ID for token generation
     * @returns Result with replaced response text
     */
    replaceTokens(params, customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 ReplaceLinkWithToken: Called with params:", {
                    response: params.response.substring(0, 100),
                    customerId,
                    workspaceId,
                });
                let { response, linkType = "auto", context = "auto" } = params;
                if (!customerId || !workspaceId) {
                    return { success: false, response };
                }
                // 🚨 NORMALIZE WRONG TOKENS - LLM sometimes writes wrong patterns
                // Convert all wrong variations to correct token format
                const wrongProfilePatterns = [
                    /\[link profilo\]/gi,
                    /\[link profile\]/gi,
                    /\[profilo link\]/gi,
                    /\[profile link\]/gi,
                    /link profilo/gi,
                    /link profile/gi,
                ];
                wrongProfilePatterns.forEach(pattern => {
                    if (pattern.test(response)) {
                        logger_1.default.warn(`⚠️ Found wrong token pattern, normalizing to [LINK_PROFILE_WITH_TOKEN]`);
                        response = response.replace(pattern, "[LINK_PROFILE_WITH_TOKEN]");
                    }
                });
                const wrongCartPatterns = [
                    /\[link carrello\]/gi,
                    /\[link cart\]/gi,
                    /\[carrello link\]/gi,
                    /\[cart link\]/gi,
                    /link carrello/gi,
                    /link cart/gi,
                ];
                wrongCartPatterns.forEach(pattern => {
                    if (pattern.test(response)) {
                        logger_1.default.warn(`⚠️ Found wrong cart token pattern, normalizing to [LINK_CHECKOUT_WITH_TOKEN]`);
                        response = response.replace(pattern, "[LINK_CHECKOUT_WITH_TOKEN]");
                    }
                });
                // Active tokens only (deprecated tokens removed)
                // Support both plain [TOKEN] and Markdown (TOKEN) formats
                const hasCartToken = response.includes("LINK_CHECKOUT_WITH_TOKEN");
                const hasCartConfirmToken = response.includes("LINK_CHECKOUT_CONFIRM");
                const hasProfileToken = response.includes("LINK_PROFILE_WITH_TOKEN");
                const hasCatalogToken = response.includes("LINK_CATALOG");
                if (!hasCartToken &&
                    !hasCartConfirmToken &&
                    !hasProfileToken &&
                    !hasCatalogToken) {
                    return {
                        success: false,
                        error: "Response does not contain any replaceable tokens",
                    };
                }
                if (!customerId || !workspaceId) {
                    return {
                        success: false,
                        error: "Missing customerId or workspaceId",
                    };
                }
                let replacedResponse = response;
                // Handle cart token
                if (hasCartToken) {
                    try {
                        const { SecureTokenService, } = require("../../application/services/secure-token.service");
                        const secureTokenService = new SecureTokenService();
                        const cartToken = yield secureTokenService.createToken("cart", workspaceId, { customerId, workspaceId }, undefined, // Uses TOKEN_EXPIRATION from env
                        undefined, undefined, undefined, customerId);
                        // Use centralized link generator for cart (which is actually checkout)
                        const finalCartLink = yield link_generator_service_1.linkGeneratorService.generateCheckoutLink(cartToken, workspaceId);
                        // Smart replace: handle multiple formats
                        // 1. Markdown with square brackets + trailing punctuation: [text]([LINK_CHECKOUT_WITH_TOKEN]).
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(\[LINK_CHECKOUT_WITH_TOKEN\]\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalCartLink})${punctuation}`);
                        // 2. Markdown WITHOUT square brackets + trailing punctuation: [text](LINK_CHECKOUT_WITH_TOKEN).
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(LINK_CHECKOUT_WITH_TOKEN\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalCartLink})${punctuation}`);
                        // 3. Plain token with optional punctuation: [LINK_CHECKOUT_WITH_TOKEN]
                        replacedResponse = replacedResponse.replace(/\[LINK_CHECKOUT_WITH_TOKEN\]([\)\.]?[\.!?,]?)/g, (match, suffix) => {
                            const cleanSuffix = suffix.replace(/\)/g, "");
                            return cleanSuffix
                                ? `${finalCartLink}${cleanSuffix}`
                                : finalCartLink;
                        });
                        // 4. Bare token: LINK_CHECKOUT_WITH_TOKEN
                        replacedResponse = replacedResponse.replace(/LINK_CHECKOUT_WITH_TOKEN/g, finalCartLink);
                    }
                    catch (error) {
                        logger_1.default.error("❌ Error generating cart link:", error);
                        replacedResponse = replacedResponse.replace(/\[LINK_CHECKOUT_WITH_TOKEN\]/g, "Link del carrello non disponibile");
                    }
                }
                // Handle cart confirm token (checkout with step=confirm parameter)
                if (hasCartConfirmToken) {
                    try {
                        const { SecureTokenService, } = require("../../application/services/secure-token.service");
                        const secureTokenService = new SecureTokenService();
                        const cartToken = yield secureTokenService.createToken("cart", workspaceId, { customerId, workspaceId }, undefined, // Uses TOKEN_EXPIRATION from env
                        undefined, undefined, undefined, customerId);
                        // Generate checkout link with step=confirm parameter
                        // Note: step parameter expects number (1 or 2), not string
                        // TODO: Clarify if "confirm" should be step 3 or remove parameter
                        const finalCartConfirmLink = yield link_generator_service_1.linkGeneratorService.generateCheckoutLink(cartToken, workspaceId
                        // Removed "confirm" parameter - generateCheckoutLink expects number (1 or 2)
                        );
                        // Smart replace: handle multiple formats (same as LINK_CHECKOUT_WITH_TOKEN)
                        // 1. Markdown with square brackets
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(\[LINK_CHECKOUT_CONFIRM\]\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalCartConfirmLink})${punctuation}`);
                        // 2. Markdown WITHOUT square brackets
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(LINK_CHECKOUT_CONFIRM\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalCartConfirmLink})${punctuation}`);
                        // 3. Plain token with optional punctuation
                        replacedResponse = replacedResponse.replace(/\[LINK_CHECKOUT_CONFIRM\]([\)\.]?[\.!?,]?)/g, (match, suffix) => {
                            const cleanSuffix = suffix.replace(/\)/g, "");
                            return cleanSuffix
                                ? `${finalCartConfirmLink}${cleanSuffix}`
                                : finalCartConfirmLink;
                        });
                        // 4. Bare token
                        replacedResponse = replacedResponse.replace(/LINK_CHECKOUT_CONFIRM/g, finalCartConfirmLink);
                    }
                    catch (error) {
                        logger_1.default.error("❌ Error generating cart confirm link:", error);
                        replacedResponse = replacedResponse.replace(/\[LINK_CHECKOUT_CONFIRM\]/g, "Link di conferma non disponibile");
                    }
                }
                // Handle profile token
                if (hasProfileToken) {
                    try {
                        const { SecureTokenService, } = require("../../application/services/secure-token.service");
                        const secureTokenService = new SecureTokenService();
                        const profileToken = yield secureTokenService.createToken("profile", workspaceId, { customerId, workspaceId }, undefined, // Uses TOKEN_EXPIRATION from env
                        undefined, undefined, undefined, customerId);
                        // Use centralized link generator
                        const finalProfileLink = yield link_generator_service_1.linkGeneratorService.generateProfileLink(profileToken, workspaceId);
                        // Smart replace: handle multiple formats
                        // 1. Markdown with square brackets + trailing punctuation: [text]([LINK_PROFILE_WITH_TOKEN]).
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(\[LINK_PROFILE_WITH_TOKEN\]\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalProfileLink})${punctuation}`);
                        // 2. Markdown WITHOUT square brackets + trailing punctuation: [text](LINK_PROFILE_WITH_TOKEN).
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(LINK_PROFILE_WITH_TOKEN\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalProfileLink})${punctuation}`);
                        // 3. Plain token with optional punctuation: [LINK_PROFILE_WITH_TOKEN]
                        replacedResponse = replacedResponse.replace(/\[LINK_PROFILE_WITH_TOKEN\]([\)\.]?[\.!?,]?)/g, (match, suffix) => {
                            const cleanSuffix = suffix.replace(/\)/g, "");
                            return cleanSuffix
                                ? `${finalProfileLink}${cleanSuffix}`
                                : finalProfileLink;
                        });
                        // 4. Bare token: LINK_PROFILE_WITH_TOKEN
                        replacedResponse = replacedResponse.replace(/LINK_PROFILE_WITH_TOKEN/g, finalProfileLink);
                    }
                    catch (error) {
                        logger_1.default.error("❌ Error generating profile link:", error);
                        replacedResponse = replacedResponse.replace(/\[LINK_PROFILE_WITH_TOKEN\]/g, "Link del profilo non disponibile");
                    }
                }
                // Handle catalog token (static PDF link with URL shortening)
                if (hasCatalogToken) {
                    try {
                        const catalogUrl = "https://laltrait.com/wp-content/uploads/LAltra-Italia-Catalogo-Agosto-2024-v2.pdf";
                        // Use centralized link generator to create short URL for catalog
                        const finalCatalogLink = yield link_generator_service_1.linkGeneratorService.generateShortLink(catalogUrl, workspaceId);
                        // Smart replace: handle multiple formats
                        // 1. Markdown with square brackets + trailing punctuation: [text]([LINK_CATALOG]).
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(\[LINK_CATALOG\]\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalCatalogLink})${punctuation}`);
                        // 2. Markdown WITHOUT square brackets + trailing punctuation: [text](LINK_CATALOG).
                        replacedResponse = replacedResponse.replace(/\[([^\]]+)\]\(LINK_CATALOG\)([\.!?,;:]?)/g, (match, text, punctuation) => `[${text}](${finalCatalogLink})${punctuation}`);
                        // 3. Plain token with optional punctuation: [LINK_CATALOG]
                        replacedResponse = replacedResponse.replace(/\[LINK_CATALOG\]([\)\.]?[\.!?,]?)/g, (match, suffix) => {
                            const cleanSuffix = suffix.replace(/\)/g, "");
                            return cleanSuffix
                                ? `${finalCatalogLink}${cleanSuffix}`
                                : finalCatalogLink;
                        });
                        // 4. Bare token: LINK_CATALOG
                        replacedResponse = replacedResponse.replace(/LINK_CATALOG/g, finalCatalogLink);
                    }
                    catch (error) {
                        logger_1.default.error("❌ Error generating catalog link:", error);
                        replacedResponse = replacedResponse.replace(/\[LINK_CATALOG\]/g, "https://laltrait.com/wp-content/uploads/LAltra-Italia-Catalogo-Agosto-2024-v2.pdf");
                    }
                }
                // 🧹 CLEANUP: Remove any LLM-invented URLs (example.com, placeholder URLs)
                // The LLM sometimes generates fake URLs alongside our tokens
                // Pattern matches: (https://example.com/...) or similar invented URLs
                replacedResponse = replacedResponse.replace(/\(https?:\/\/example\.com[^\s\)]*\)/gi, "");
                // Also clean up any orphaned markdown link syntax with example.com
                replacedResponse = replacedResponse.replace(/\[([^\]]*)\]\(https?:\/\/example\.com[^\)]*\)/gi, "$1");
                // Clean up double spaces that may result from cleanup
                replacedResponse = replacedResponse.replace(/\s{2,}/g, " ").trim();
                return {
                    success: true,
                    response: replacedResponse,
                    linkType: linkType,
                };
            }
            catch (error) {
                logger_1.default.error("❌ LinkReplacementService error:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
    }
}
exports.LinkReplacementService = LinkReplacementService;
// Export singleton instance for backward compatibility
exports.linkReplacementService = new LinkReplacementService();
// Export legacy function name for gradual migration
function ReplaceLinkWithToken(params, customerId, workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        return exports.linkReplacementService.replaceTokens(params, customerId, workspaceId);
    });
}
//# sourceMappingURL=link-replacement.service.js.map