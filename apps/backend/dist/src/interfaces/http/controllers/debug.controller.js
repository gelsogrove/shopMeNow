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
exports.DebugController = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
class DebugController {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }
    searchProducts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                const { query } = req.body;
                if (!query || query.trim().length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: "Query parameter required",
                    });
                }
                logger_1.default.info("🔍 DEBUG SEARCH: Analyzing query", {
                    query,
                    workspaceId,
                });
                // Extract tokens from query - NO language-specific mappings
                // Let the repository/LLM handle semantic understanding
                const tokens = query
                    .toLowerCase()
                    .split(/[\s,]+/)
                    .filter((t) => t.length > 2);
                const filters = {
                    keywords: tokens.length > 0 ? tokens : undefined,
                };
                logger_1.default.info("🔧 Built Filters (language-agnostic)", {
                    filters,
                });
                // Execute search
                const startTime = Date.now();
                const results = yield this.productRepository.searchProducts(workspaceId, filters);
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.info("✅ Search Completed", {
                    resultsCount: results.length,
                    executionTimeMs,
                });
                return res.json({
                    success: true,
                    query: { originalQuery: query, tokens },
                    filters,
                    results,
                    totalFound: results.length,
                    executionTimeMs,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Debug search error:", error);
                return res.status(500).json({
                    success: false,
                    error: "Search failed",
                    message: error.message,
                });
            }
        });
    }
}
exports.DebugController = DebugController;
//# sourceMappingURL=debug.controller.js.map