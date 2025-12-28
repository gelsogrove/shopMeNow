"use strict";
/**
 * ProductSearchAgent
 *
 * Specialist agent for product search and discovery.
 *
 * Responsibilities:
 * - Parse customer search queries (keywords, filters, intent)
 * - Search products by category, name, description
 * - Apply filters: price range, allergeni, certificazioni
 * - Format results with images, prices, availability
 * - Handle multilanguage (it/es/en/pt)
 *
 * Flow:
 * 1. Receive context from Router Agent (keywords, filters, language)
 * 2. Search ProductRepository with filters
 * 3. Format results for customer language
 * 4. Return product list with "add to cart" prompts
 *
 * Example Queries:
 * - "cerco formaggi italiani" → Search category "Formaggi"
 * - "productos sin lactosa bajo 20 euros" → Filter by allergen + price
 * - "show me organic vegetables" → Filter by certification + category
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
exports.ProductSearchAgent = void 0;
const product_repository_1 = require("../../repositories/product.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
class ProductSearchAgent {
    constructor(prisma) {
        this.prisma = prisma; // ✅ Store prisma instance
        this.productRepo = new product_repository_1.ProductRepository();
    }
    /**
     * Main entry point: Search products based on context
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param context - Search context from Router Agent
     * @returns Formatted product results
     */
    search(workspaceId, context, customerId // ✅ Optional customerId for discount calculation
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                logger_1.default.info(`ProductSearchAgent: Searching products for workspace ${workspaceId}, language: ${context.detectedLanguage}`);
                // Use ProductRepository instead of direct Prisma access (Clean Architecture)
                const products = yield this.productRepo.searchProducts(workspaceId, {
                    keywords: context.keywords,
                    categoryId: (_a = context.filters) === null || _a === void 0 ? void 0 : _a.category,
                    minPrice: (_b = context.filters) === null || _b === void 0 ? void 0 : _b.minPrice,
                    maxPrice: (_c = context.filters) === null || _c === void 0 ? void 0 : _c.maxPrice,
                    allergens: (_d = context.filters) === null || _d === void 0 ? void 0 : _d.allergens,
                    certifications: (_e = context.filters) === null || _e === void 0 ? void 0 : _e.certifications,
                    limit: 20,
                });
                logger_1.default.info(`ProductSearchAgent: Found ${products.length} products`);
                // Format results for customer language WITH DISCOUNT PRICES
                const formattedProducts = yield this.formatProducts(products, context.detectedLanguage, workspaceId, customerId // ✅ Pass customerId for price calculation
                );
                // Generate human-readable message
                const message = this.generateMessage(formattedProducts.length, context.detectedLanguage, context.keywords);
                return {
                    success: true,
                    products: formattedProducts,
                    totalFound: formattedProducts.length,
                    message,
                };
            }
            catch (error) {
                logger_1.default.error("ProductSearchAgent error:", error);
                return {
                    success: false,
                    products: [],
                    totalFound: 0,
                    message: this.getErrorMessage(context.detectedLanguage),
                };
            }
        });
    }
    /**
     * Format products for customer language WITH DISCOUNT CALCULATION
     */
    formatProducts(products, language, workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // 💰 STEP 1: Calculate discounted prices if customerId provided
            let priceMap = new Map();
            if (customerId) {
                try {
                    // Get customer discount
                    const customer = yield this.prisma.customers.findUnique({
                        where: { id: customerId },
                        select: { discount: true },
                    });
                    const customerDiscount = (customer === null || customer === void 0 ? void 0 : customer.discount) || 0;
                    // Calculate prices with discounts
                    const { PriceCalculationService } = yield Promise.resolve().then(() => __importStar(require("../services/price-calculation.service")));
                    const priceService = new PriceCalculationService(this.prisma);
                    const productIds = products.map((p) => p.id);
                    const priceResult = yield priceService.calculatePricesWithDiscounts(workspaceId, productIds, customerDiscount);
                    // Build price map
                    priceMap = new Map(priceResult.products.map((p) => [
                        p.id,
                        { originalPrice: p.originalPrice, finalPrice: p.finalPrice },
                    ]));
                    logger_1.default.info(`💰 Calculated discounted prices for ${priceMap.size} products`, {
                        customerDiscount,
                    });
                }
                catch (error) {
                    logger_1.default.error("Error calculating discounted prices:", error);
                    // Continue without discounts
                }
            }
            // STEP 2: Format products with prices
            return products.map((product) => {
                var _a;
                const priceData = priceMap.get(product.id);
                const originalPrice = (priceData === null || priceData === void 0 ? void 0 : priceData.originalPrice) || product.price;
                const finalPrice = (priceData === null || priceData === void 0 ? void 0 : priceData.finalPrice) || product.price;
                return {
                    id: product.id,
                    code: product.sku, // ✅ Include product code
                    name: product.name,
                    description: product.description || "",
                    price: finalPrice, // ✅ Use discounted price
                    originalPrice: originalPrice, // ✅ Include original price for comparison
                    hasDiscount: originalPrice !== finalPrice, // ✅ Flag if discount applied
                    currency: "EUR",
                    category: ((_a = product.category) === null || _a === void 0 ? void 0 : _a.name) || "Uncategorized",
                    imageUrl: product.image || undefined,
                    available: product.stock > 0,
                    stock: product.stock || 0, // ✅ Include stock quantity
                    allergens: product.allergens || [],
                    certifications: product.certifications || [],
                };
            });
        });
    }
    /**
     * Generate human-readable response message
     */
    generateMessage(productCount, language, keywords) {
        const keywordStr = keywords ? keywords.join(", ") : "";
        const messages = {
            it: {
                found: `Ho trovato ${productCount} ${productCount === 1 ? "prodotto" : "prodotti"}${keywordStr ? ` per "${keywordStr}"` : ""}. Quale ti interessa?`,
                notFound: `Mi dispiace, non ho trovato prodotti${keywordStr ? ` per "${keywordStr}"` : ""}. Vuoi provare con altri termini di ricerca?`,
            },
            es: {
                found: `Encontré ${productCount} ${productCount === 1 ? "producto" : "productos"}${keywordStr ? ` para "${keywordStr}"` : ""}. ¿Cuál te interesa?`,
                notFound: `Lo siento, no encontré productos${keywordStr ? ` para "${keywordStr}"` : ""}. ¿Quieres intentar con otros términos?`,
            },
            en: {
                found: `I found ${productCount} ${productCount === 1 ? "product" : "products"}${keywordStr ? ` for "${keywordStr}"` : ""}. Which one interests you?`,
                notFound: `Sorry, I didn't find any products${keywordStr ? ` for "${keywordStr}"` : ""}. Want to try different search terms?`,
            },
            pt: {
                found: `Encontrei ${productCount} ${productCount === 1 ? "produto" : "produtos"}${keywordStr ? ` para "${keywordStr}"` : ""}. Qual você gostaria?`,
                notFound: `Desculpe, não encontrei produtos${keywordStr ? ` para "${keywordStr}"` : ""}. Quer tentar outros termos?`,
            },
        };
        const lang = messages[language] || messages.it;
        return productCount > 0 ? lang.found : lang.notFound;
    }
    /**
     * Get error message in customer language
     */
    getErrorMessage(language) {
        const messages = {
            it: "Si è verificato un errore durante la ricerca. Riprova tra poco.",
            es: "Ocurrió un error durante la búsqueda. Inténtalo de nuevo pronto.",
            en: "An error occurred during search. Please try again soon.",
            pt: "Ocorreu um erro durante a pesquisa. Tente novamente em breve.",
        };
        return messages[language] || messages.it;
    }
}
exports.ProductSearchAgent = ProductSearchAgent;
//# sourceMappingURL=ProductSearchAgent.js.map