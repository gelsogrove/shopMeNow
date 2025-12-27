"use strict";
/**
 * OpenAI Agents SDK - Product Tools
 *
 * Tools for product search, filtering, and details.
 * Uses Fuse.js for fuzzy matching (typo-tolerant search).
 *
 * @architecture Clean Architecture - Tools layer
 * @security ALL queries filtered by workspaceId
 * @critical NO hardcoded data - all from database
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
exports.productTools = exports.getProductsByCategoryTool = exports.getActiveOffersTool = exports.getCategoriesList = exports.getProductDetailsTool = exports.searchProductsTool = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const fuse_js_1 = __importDefault(require("fuse.js"));
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Search products with fuzzy matching
 * Supports typo-tolerance, partial matches, and multilingual queries
 */
exports.searchProductsTool = (0, agents_1.tool)({
    name: "search_products",
    description: `Search for products by name, description, or category. 
    Supports typo-tolerance (e.g., "bufalo mozarela" matches "Mozzarella di Bufala").
    Use this when the customer asks about products, wants to find something, or mentions a product name.`,
    parameters: zod_1.z.object({
        query: zod_1.z.string().describe("Search query - product name, description keyword, or category"),
        categorySlug: zod_1.z.string().optional().describe("Optional: filter by category slug"),
        maxResults: zod_1.z.number().default(10).describe("Maximum number of results to return"),
        priceMin: zod_1.z.number().optional().describe("Optional: minimum price filter"),
        priceMax: zod_1.z.number().optional().describe("Optional: maximum price filter"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ query, categorySlug, maxResults, priceMin, priceMax }, { context }) {
        const ctx = context;
        const startTime = Date.now();
        try {
            logger_1.default.info(`🔍 [searchProducts] Query: "${query}", workspace: ${ctx.workspaceId}`);
            // Build where clause with workspace isolation
            const whereClause = {
                workspaceId: ctx.workspaceId,
                isActive: true,
                status: "ACTIVE",
            };
            // Category filter
            if (categorySlug) {
                const category = yield ctx.prisma.categories.findFirst({
                    where: { slug: categorySlug, workspaceId: ctx.workspaceId },
                });
                if (category) {
                    whereClause.productCategories = {
                        some: { categoryId: category.id },
                    };
                }
            }
            // Price filters
            if (priceMin !== undefined) {
                whereClause.price = Object.assign(Object.assign({}, whereClause.price), { gte: priceMin });
            }
            if (priceMax !== undefined) {
                whereClause.price = Object.assign(Object.assign({}, whereClause.price), { lte: priceMax });
            }
            // Fetch products from database
            const products = yield ctx.prisma.products.findMany({
                where: whereClause,
                include: {
                    productCategories: {
                        include: { category: true },
                    },
                },
                take: 100, // Get more for fuzzy search, then filter
            });
            if (products.length === 0) {
                return {
                    success: true,
                    data: [],
                    message: "Nessun prodotto trovato con i filtri specificati",
                };
            }
            // Fuzzy search with Fuse.js
            const fuse = new fuse_js_1.default(products, {
                keys: [
                    { name: "name", weight: 0.5 },
                    { name: "description", weight: 0.3 },
                    { name: "productCategories.category.name", weight: 0.2 },
                ],
                threshold: 0.4, // 0 = exact match, 1 = match anything
                ignoreLocation: true,
                includeScore: true,
            });
            const searchResults = fuse.search(query);
            // Map results
            const results = searchResults
                .slice(0, maxResults)
                .map(({ item: p }) => {
                var _a, _b, _c;
                const product = p;
                const customerDiscount = ctx.customerDiscount || 0;
                const discountedPrice = customerDiscount > 0
                    ? product.price * (1 - customerDiscount / 100)
                    : undefined;
                return {
                    id: product.id,
                    name: product.name,
                    sku: product.sku || undefined,
                    description: product.description || undefined,
                    price: product.price,
                    discountedPrice,
                    stock: product.stock,
                    categoryName: (_c = (_b = (_a = product.productCategories) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.category) === null || _c === void 0 ? void 0 : _c.name,
                    imageUrl: product.imageUrl,
                    isAvailable: product.stock > 0,
                };
            });
            logger_1.default.info(`✅ [searchProducts] Found ${results.length} products in ${Date.now() - startTime}ms`);
            return {
                success: true,
                data: results,
                message: results.length > 0
                    ? `Trovati ${results.length} prodotti`
                    : "Nessun prodotto corrisponde alla ricerca",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [searchProducts] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore durante la ricerca prodotti",
            };
        }
    }),
});
/**
 * Get product details by ID or SKU
 */
exports.getProductDetailsTool = (0, agents_1.tool)({
    name: "get_product_details",
    description: `Get detailed information about a specific product by ID or SKU.
    Use this when the customer wants more details about a specific product.`,
    parameters: zod_1.z.object({
        productId: zod_1.z.string().optional().describe("Product ID"),
        sku: zod_1.z.string().optional().describe("Product SKU code"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ productId, sku }, { context }) {
        var _c, _d;
        const ctx = context;
        try {
            if (!productId && !sku) {
                return {
                    success: false,
                    error: "Product ID or SKU required",
                    message: "Specifica l'ID o il codice SKU del prodotto",
                };
            }
            const whereClause = {
                workspaceId: ctx.workspaceId,
                isActive: true,
            };
            if (productId) {
                whereClause.id = productId;
            }
            else if (sku) {
                whereClause.sku = sku;
            }
            const product = yield ctx.prisma.products.findFirst({
                where: whereClause,
                include: {
                    productCategories: {
                        include: { category: true },
                    },
                    productCertifications: {
                        include: { certification: true },
                    },
                    productTransportTypes: {
                        include: { transportType: true },
                    },
                },
            });
            if (!product) {
                return {
                    success: false,
                    error: "Product not found",
                    message: "Prodotto non trovato",
                };
            }
            const customerDiscount = ctx.customerDiscount || 0;
            const discountedPrice = customerDiscount > 0
                ? product.price * (1 - customerDiscount / 100)
                : undefined;
            return {
                success: true,
                data: {
                    id: product.id,
                    name: product.name,
                    sku: product.sku || undefined,
                    description: product.description || undefined,
                    price: product.price,
                    discountedPrice,
                    stock: product.stock,
                    categoryName: (_d = (_c = product.productCategories[0]) === null || _c === void 0 ? void 0 : _c.category) === null || _d === void 0 ? void 0 : _d.name,
                    imageUrl: product.imageUrl,
                    isAvailable: product.stock > 0,
                },
                message: "Dettagli prodotto recuperati",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getProductDetails] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero dettagli prodotto",
            };
        }
    }),
});
/**
 * Get all categories
 */
exports.getCategoriesList = (0, agents_1.tool)({
    name: "get_categories",
    description: `Get list of all product categories.
    Use this when the customer asks what categories are available or wants to browse by category.`,
    parameters: zod_1.z.object({}),
    execute: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { context }) {
        const ctx = context;
        try {
            const categories = yield ctx.prisma.categories.findMany({
                where: {
                    workspaceId: ctx.workspaceId,
                    isActive: true,
                },
                include: {
                    _count: {
                        select: {
                            productCategories: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            });
            const results = categories.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                description: c.description || undefined,
                productCount: c._count.productCategories,
            }));
            return {
                success: true,
                data: results,
                message: `${results.length} categorie disponibili`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getCategories] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero categorie",
            };
        }
    }),
});
/**
 * Get active offers
 */
exports.getActiveOffersTool = (0, agents_1.tool)({
    name: "get_offers",
    description: `Get list of active promotional offers.
    Use this when the customer asks about discounts, promotions, or special offers.`,
    parameters: zod_1.z.object({}),
    execute: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { context }) {
        const ctx = context;
        try {
            const now = new Date();
            const offers = yield ctx.prisma.offers.findMany({
                where: {
                    workspaceId: ctx.workspaceId,
                    isActive: true,
                    startDate: { lte: now },
                    endDate: { gte: now },
                },
                include: {
                    category: true,
                },
                orderBy: { discountPercent: "desc" },
            });
            const results = offers.map((o) => {
                var _a;
                return ({
                    id: o.id,
                    name: o.name,
                    description: o.description || undefined,
                    discountPercent: o.discountPercent,
                    startDate: o.startDate,
                    endDate: o.endDate,
                    categoryName: (_a = o.category) === null || _a === void 0 ? void 0 : _a.name,
                });
            });
            return {
                success: true,
                data: results,
                message: results.length > 0
                    ? `${results.length} offerte attive`
                    : "Nessuna offerta attiva al momento",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getOffers] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero offerte",
            };
        }
    }),
});
/**
 * Get products by category
 */
exports.getProductsByCategoryTool = (0, agents_1.tool)({
    name: "get_products_by_category",
    description: `Get all products in a specific category.
    Use this when the customer wants to see products in a particular category.`,
    parameters: zod_1.z.object({
        categorySlug: zod_1.z.string().describe("Category slug identifier"),
        maxResults: zod_1.z.number().default(20).describe("Maximum number of results"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ categorySlug, maxResults }, { context }) {
        const ctx = context;
        try {
            const category = yield ctx.prisma.categories.findFirst({
                where: {
                    slug: categorySlug,
                    workspaceId: ctx.workspaceId,
                    isActive: true,
                },
            });
            if (!category) {
                return {
                    success: false,
                    error: "Category not found",
                    message: "Categoria non trovata",
                };
            }
            const products = yield ctx.prisma.products.findMany({
                where: {
                    workspaceId: ctx.workspaceId,
                    isActive: true,
                    status: "ACTIVE",
                    productCategories: {
                        some: { categoryId: category.id },
                    },
                },
                include: {
                    category: true,
                },
                take: maxResults,
                orderBy: { name: "asc" },
            });
            const customerDiscount = ctx.customerDiscount || 0;
            const results = products.map((p) => ({
                id: p.id,
                name: p.name,
                sku: p.sku || undefined,
                description: p.description || undefined,
                price: p.price,
                discountedPrice: customerDiscount > 0
                    ? p.price * (1 - customerDiscount / 100)
                    : undefined,
                stock: p.stock,
                categoryName: category.name,
                imageUrl: p.imageUrl,
                isAvailable: p.stock > 0,
            }));
            return {
                success: true,
                data: results,
                message: `${results.length} prodotti nella categoria "${category.name}"`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getProductsByCategory] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero prodotti per categoria",
            };
        }
    }),
});
// Export all product tools
exports.productTools = [
    exports.searchProductsTool,
    exports.getProductDetailsTool,
    exports.getCategoriesList,
    exports.getActiveOffersTool,
    exports.getProductsByCategoryTool,
];
//# sourceMappingURL=product.tools.js.map