"use strict";
/**
 * Keyword Matcher - Match against known categories and products from database
 *
 * This provides a second layer of intent detection after pattern matching.
 * It matches user input against actual data in the workspace.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchCategory = matchCategory;
exports.matchProduct = matchProduct;
exports.matchService = matchService;
exports.matchKnownEntities = matchKnownEntities;
const logger_1 = __importDefault(require("../../../utils/logger"));
// =============================================================================
// FUZZY MATCHING UTILITIES
// =============================================================================
/**
 * Normalize string for comparison
 */
function normalize(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s]/g, "") // Remove special chars
        .trim();
}
/**
 * Extract words from message for matching
 * NO HARDCODED STOP WORDS - sistema multilingua!
 * We just split into words and try to match each against known entities
 */
function extractWords(message) {
    const normalized = normalize(message);
    return normalized.split(/\s+/).filter(word => word.length > 1);
}
/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}
/**
 * Calculate similarity score (0-1)
 */
function similarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb)
        return 1;
    const distance = levenshteinDistance(na, nb);
    const maxLength = Math.max(na.length, nb.length);
    if (maxLength === 0)
        return 1;
    return 1 - distance / maxLength;
}
/**
 * Check if string contains word as a whole word
 */
function containsWord(text, word) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(text);
}
// =============================================================================
// MATCHING FUNCTIONS
// =============================================================================
/**
 * Find best matching category
 * MULTILINGUAL: No hardcoded words, matches against DB entities only
 */
function matchCategory(message, categories) {
    const normalizedMessage = normalize(message);
    const messageWords = extractWords(message);
    let bestMatch = null;
    let bestScore = 0;
    for (const category of categories) {
        const normalizedName = normalize(category.name);
        const categoryWords = extractWords(category.name);
        // Check exact match (full message equals category name)
        if (normalizedMessage === normalizedName) {
            return {
                intent: { type: "SHOW_CATEGORY", categoryName: category.name },
                matchedEntity: category,
                matchType: "EXACT",
                confidence: 1.0
            };
        }
        // IMPORTANT: If message has MORE words than category name, it might be
        // a qualified search like "Formaggi Freschi" which needs semantic search
        // Don't do simple containsWord match in this case
        const hasQualifier = messageWords.length > categoryWords.length;
        // Check if category name is contained in message as whole word
        // BUT only if message doesn't have extra qualifying words
        if (!hasQualifier && containsWord(normalizedMessage, normalizedName)) {
            return {
                intent: { type: "SHOW_CATEGORY", categoryName: category.name },
                matchedEntity: category,
                matchType: "EXACT",
                confidence: 1.0
            };
        }
        // If message has qualifier (e.g., "Formaggi Freschi"), reduce confidence
        // so that semantic search can take over
        if (hasQualifier && containsWord(normalizedMessage, normalizedName)) {
            // Still track it as potential match but with lower confidence
            const score = 0.5; // Low enough that LLM fallback will be preferred
            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    intent: { type: "SHOW_CATEGORY", categoryName: category.name },
                    matchedEntity: category,
                    matchType: "FUZZY",
                    confidence: score
                };
            }
            continue; // Don't return immediately, check for better matches
        }
        // Check each word of message against category name (for partial matches)
        for (const word of messageWords) {
            if (word.length >= 3 && similarity(word, normalizedName) > 0.8) {
                const score = similarity(word, normalizedName);
                // Reduce score if there are qualifier words
                const adjustedScore = hasQualifier ? score * 0.6 : score;
                if (adjustedScore > bestScore) {
                    bestScore = adjustedScore;
                    bestMatch = {
                        intent: { type: "SHOW_CATEGORY", categoryName: category.name },
                        matchedEntity: category,
                        matchType: "FUZZY",
                        confidence: adjustedScore
                    };
                }
            }
        }
        // Check aliases
        if (category.aliases) {
            for (const alias of category.aliases) {
                const normalizedAlias = normalize(alias);
                if (normalizedMessage === normalizedAlias ||
                    containsWord(normalizedMessage, normalizedAlias)) {
                    return {
                        intent: { type: "SHOW_CATEGORY", categoryName: category.name },
                        matchedEntity: category,
                        matchType: "ALIAS",
                        confidence: 0.95
                    };
                }
                // Also check individual words against aliases
                for (const word of messageWords) {
                    if (word.length >= 3 && similarity(word, normalizedAlias) > 0.8) {
                        return {
                            intent: { type: "SHOW_CATEGORY", categoryName: category.name },
                            matchedEntity: category,
                            matchType: "ALIAS",
                            confidence: 0.9
                        };
                    }
                }
            }
        }
        // Calculate fuzzy score on full message
        const score = similarity(normalizedMessage, normalizedName);
        if (score > bestScore && score > 0.7) {
            bestScore = score;
            bestMatch = {
                intent: { type: "SHOW_CATEGORY", categoryName: category.name },
                matchedEntity: category,
                matchType: "FUZZY",
                confidence: score
            };
        }
    }
    if (bestMatch) {
        logger_1.default.debug(`🔍 Keyword match: CATEGORY "${message}" → "${bestMatch.matchedEntity.name}" (${bestMatch.matchType}, ${(bestMatch.confidence * 100).toFixed(0)}%)`);
    }
    return bestMatch;
}
/**
 * Find best matching product
 * MULTILINGUAL: No hardcoded words, matches against DB entities only
 */
function matchProduct(message, products) {
    const normalizedMessage = normalize(message);
    const messageWords = extractWords(message);
    let bestMatch = null;
    let bestScore = 0;
    for (const product of products) {
        const normalizedName = normalize(product.name);
        // Check exact match
        if (normalizedMessage === normalizedName) {
            return {
                intent: {
                    type: "SHOW_PRODUCT",
                    productName: product.name,
                    productId: product.id
                },
                matchedEntity: product,
                matchType: "EXACT",
                confidence: 1.0
            };
        }
        // Check if message contains the product name as whole word
        if (containsWord(normalizedMessage, normalizedName)) {
            const score = normalizedName.length / normalizedMessage.length;
            if (score > bestScore) {
                bestScore = Math.min(score, 0.95);
                bestMatch = {
                    intent: {
                        type: "SHOW_PRODUCT",
                        productName: product.name,
                        productId: product.id
                    },
                    matchedEntity: product,
                    matchType: "EXACT",
                    confidence: bestScore
                };
            }
        }
        // Check each word of message against product name
        for (const word of messageWords) {
            if (word.length >= 4 && similarity(word, normalizedName) > 0.8) {
                const score = similarity(word, normalizedName);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        intent: {
                            type: "SHOW_PRODUCT",
                            productName: product.name,
                            productId: product.id
                        },
                        matchedEntity: product,
                        matchType: "FUZZY",
                        confidence: score
                    };
                }
            }
        }
        // Check aliases
        if (product.aliases) {
            for (const alias of product.aliases) {
                const normalizedAlias = normalize(alias);
                if (normalizedMessage === normalizedAlias ||
                    containsWord(normalizedMessage, normalizedAlias)) {
                    return {
                        intent: {
                            type: "SHOW_PRODUCT",
                            productName: product.name,
                            productId: product.id
                        },
                        matchedEntity: product,
                        matchType: "ALIAS",
                        confidence: 0.9
                    };
                }
            }
        }
        // Calculate fuzzy score (only for longer messages to avoid false positives)
        if (normalizedMessage.length > 5) {
            const score = similarity(normalizedMessage, normalizedName);
            if (score > bestScore && score > 0.75) { // Higher threshold for products
                bestScore = score;
                bestMatch = {
                    intent: {
                        type: "SHOW_PRODUCT",
                        productName: product.name,
                        productId: product.id
                    },
                    matchedEntity: product,
                    matchType: "FUZZY",
                    confidence: score
                };
            }
        }
    }
    if (bestMatch) {
        logger_1.default.debug(`🔍 Keyword match: PRODUCT "${message}" → "${bestMatch.matchedEntity.name}" (${bestMatch.matchType}, ${(bestMatch.confidence * 100).toFixed(0)}%)`);
    }
    return bestMatch;
}
/**
 * Find best matching service
 */
function matchService(message, services) {
    const normalizedMessage = normalize(message);
    for (const service of services) {
        const normalizedName = normalize(service.name);
        // Check exact match or contains
        if (normalizedMessage === normalizedName ||
            containsWord(normalizedMessage, normalizedName)) {
            logger_1.default.debug(`🔍 Keyword match: SERVICE "${message}" → "${service.name}"`);
            return {
                intent: { type: "SHOW_SERVICE", serviceName: service.name },
                matchedEntity: service,
                matchType: "EXACT",
                confidence: 1.0
            };
        }
    }
    return null;
}
/**
 * Match against all known entities (categories, products, services)
 */
function matchKnownEntities(message, entities) {
    // Priority: Exact category > Exact product > Fuzzy category > Fuzzy product
    // 1. Try categories first (usually shorter names)
    const categoryMatch = matchCategory(message, entities.categories);
    if (categoryMatch && categoryMatch.matchType === "EXACT") {
        return categoryMatch;
    }
    // 2. Try products
    const productMatch = matchProduct(message, entities.products);
    if (productMatch && productMatch.matchType === "EXACT") {
        return productMatch;
    }
    // 3. Try services
    const serviceMatch = matchService(message, entities.services);
    if (serviceMatch) {
        return serviceMatch;
    }
    // 4. Return best fuzzy match if any
    if (categoryMatch && productMatch) {
        return categoryMatch.confidence >= productMatch.confidence
            ? categoryMatch
            : productMatch;
    }
    return categoryMatch || productMatch || null;
}
//# sourceMappingURL=keyword-matcher.js.map