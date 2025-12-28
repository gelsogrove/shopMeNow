"use strict";
/**
 * FAQRepository
 *
 * Repository for managing FAQ (Frequently Asked Questions) knowledge base.
 * Provides keyword-based search for FAQ matching in the Router Agent.
 *
 * Key Methods:
 * - searchByKeywords: Intelligent FAQ matching using PostgreSQL text search
 * - findByCategory: Get FAQs filtered by category
 * - findActiveByOrder: Get all active FAQs sorted by priority
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
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
exports.FAQRepository = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class FAQRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Search FAQs by keywords (intelligent matching)
     *
     * Strategy:
     * 1. Check if ANY keyword in FAQ matches user query (case-insensitive)
     * 2. Order by relevance (more keyword matches = higher priority)
     * 3. Return top N results
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param searchQuery - User query string
     * @param limit - Maximum number of results (default: 5)
     * @returns Array of matching FAQs sorted by relevance
     */
    searchByKeywords(workspaceId_1, searchQuery_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, searchQuery, limit = 5) {
            try {
                const queryLower = searchQuery.toLowerCase();
                // Get all active FAQs for workspace
                const allFAQs = yield this.prisma.fAQ.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        order: "asc", // Respect manual priority ordering
                    },
                });
                // Calculate relevance score for each FAQ
                const scoredFAQs = allFAQs.map((faq) => {
                    let score = 0;
                    // Check keywords array
                    if (faq.keywords && Array.isArray(faq.keywords)) {
                        for (const keyword of faq.keywords) {
                            const keywordLower = keyword.toLowerCase();
                            // Exact match in query (high score)
                            if (queryLower.includes(keywordLower)) {
                                score += 10;
                            }
                            // Partial match (lower score)
                            const words = queryLower.split(/\s+/);
                            for (const word of words) {
                                if (keywordLower.includes(word) || word.includes(keywordLower)) {
                                    score += 3;
                                }
                            }
                        }
                    }
                    // Check question text for matches
                    const questionLower = faq.question.toLowerCase();
                    const questionWords = queryLower.split(/\s+/);
                    for (const word of questionWords) {
                        if (questionLower.includes(word) && word.length > 3) {
                            score += 1;
                        }
                    }
                    return { faq, score };
                });
                // Filter FAQs with score > 0 and sort by score
                const matchedFAQs = scoredFAQs
                    .filter((item) => item.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limit)
                    .map((item) => item.faq);
                logger_1.default.info(`FAQ search for "${searchQuery}": found ${matchedFAQs.length} matches (workspace: ${workspaceId})`);
                return matchedFAQs;
            }
            catch (error) {
                logger_1.default.error("Error searching FAQs by keywords:", error);
                throw error;
            }
        });
    }
    /**
     * Find FAQs by category
     * @param workspaceId - Workspace ID (security filter)
     * @param category - FAQ category (e.g., "Ordini", "Spedizioni")
     * @returns Array of FAQs in the category
     */
    findByCategory(workspaceId, category) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.fAQ.findMany({
                    where: {
                        workspaceId,
                        category,
                        isActive: true,
                    },
                    orderBy: {
                        order: "asc",
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`Error finding FAQs by category ${category}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find all active FAQs sorted by order (priority)
     * @param workspaceId - Workspace ID (security filter)
     * @returns Array of active FAQs sorted by order field
     */
    findActiveByOrder(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.fAQ.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        order: "asc",
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error finding active FAQs by order:", error);
                throw error;
            }
        });
    }
    /**
     * Find FAQ by ID
     * @param id - FAQ ID
     * @param workspaceId - Workspace ID (security filter)
     * @returns FAQ or null
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.fAQ.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`Error finding FAQ by ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find all FAQs for a workspace (including inactive)
     * @param workspaceId - Workspace ID (security filter)
     * @returns Array of all FAQs
     */
    findAll(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.fAQ.findMany({
                    where: {
                        workspaceId,
                        isActive: true, // Filter out soft-deleted FAQs
                    },
                    orderBy: {
                        order: "asc",
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error finding all FAQs:", error);
                throw error;
            }
        });
    }
    /**
     * Get FAQ categories with counts
     * @param workspaceId - Workspace ID (security filter)
     * @returns Array of categories with FAQ counts
     */
    getCategoriesWithCount(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.fAQ.groupBy({
                    by: ["category"],
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    _count: {
                        id: true,
                    },
                });
                return result.map((item) => ({
                    category: item.category,
                    count: item._count.id,
                }));
            }
            catch (error) {
                logger_1.default.error("Error getting FAQ categories with count:", error);
                throw error;
            }
        });
    }
    /**
     * Create new FAQ
     * @param data - FAQ data
     * @returns Created FAQ
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const faq = yield this.prisma.fAQ.create({
                    data: {
                        workspaceId: data.workspaceId,
                        question: data.question,
                        answer: data.answer,
                        keywords: data.keywords || [],
                        category: data.category,
                        order: (_a = data.order) !== null && _a !== void 0 ? _a : 999, // Default to low priority
                        isActive: (_b = data.isActive) !== null && _b !== void 0 ? _b : true,
                    },
                });
                logger_1.default.info(`Created FAQ "${faq.question}" for workspace ${data.workspaceId}`);
                return faq;
            }
            catch (error) {
                logger_1.default.error("Error creating FAQ:", error);
                throw error;
            }
        });
    }
    /**
     * Update FAQ
     * @param id - FAQ ID
     * @param workspaceId - Workspace ID (security filter)
     * @param data - Updated fields
     * @returns Updated FAQ
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const faq = yield this.prisma.fAQ.updateMany({
                    where: {
                        id,
                        workspaceId,
                    },
                    data,
                });
                if (faq.count === 0) {
                    throw new Error(`FAQ ${id} not found in workspace ${workspaceId}`);
                }
                logger_1.default.info(`Updated FAQ ${id} for workspace ${workspaceId}`);
                // Return updated FAQ
                const updatedFAQ = yield this.findById(id, workspaceId);
                if (!updatedFAQ) {
                    throw new Error(`Failed to retrieve updated FAQ ${id}`);
                }
                return updatedFAQ;
            }
            catch (error) {
                logger_1.default.error(`Error updating FAQ ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete FAQ (soft delete: set isActive = false)
     * @param id - FAQ ID
     * @param workspaceId - Workspace ID (security filter)
     * @returns Deleted FAQ
     */
    softDelete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.update(id, workspaceId, { isActive: false });
            }
            catch (error) {
                logger_1.default.error(`Error soft deleting FAQ ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Hard delete FAQ (permanent removal)
     * @param id - FAQ ID
     * @param workspaceId - Workspace ID (security filter)
     */
    hardDelete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.fAQ.deleteMany({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                logger_1.default.info(`Hard deleted FAQ ${id} from workspace ${workspaceId}`);
            }
            catch (error) {
                logger_1.default.error(`Error hard deleting FAQ ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete FAQ (alias for softDelete to match interface)
     * @param id - FAQ ID
     * @param workspaceId - Workspace ID (security filter)
     * @returns true if deleted successfully
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.softDelete(id, workspaceId);
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    /**
     * Count active FAQs for a workspace
     * @param workspaceId - Workspace ID (security filter)
     * @returns Number of active FAQs
     */
    countActive(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.fAQ.count({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error counting active FAQs:", error);
                throw error;
            }
        });
    }
}
exports.FAQRepository = FAQRepository;
//# sourceMappingURL=faq.repository.js.map