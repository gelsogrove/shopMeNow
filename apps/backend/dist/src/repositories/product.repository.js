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
exports.ProductRepository = void 0;
const database_1 = require("@echatbot/database");
const product_entity_1 = require("../domain/entities/product.entity");
const logger_1 = __importDefault(require("../utils/logger"));
class ProductRepository {
    constructor() {
        this.prisma = database_1.prisma;
    }
    findAll(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("ProductRepository.findAll chiamato con:", {
                    workspaceId,
                    filters,
                });
                // 🔐 SECURITY: workspaceId is MANDATORY
                if (!workspaceId) {
                    logger_1.default.error("ProductRepository.findAll: workspaceId is required");
                    throw new Error("workspaceId is mandatory for product retrieval");
                }
                // Iniziamo con il filtro workspaceId obbligatorio
                const where = {
                    workspaceId: workspaceId,
                };
                // Aggiungiamo la ricerca per nome, se presente
                if (filters === null || filters === void 0 ? void 0 : filters.search) {
                    where.name = {
                        contains: filters.search,
                        mode: "insensitive",
                    };
                }
                // Aggiungiamo il filtro per categoria, se presente
                if (filters === null || filters === void 0 ? void 0 : filters.categoryId) {
                    where.categoryId = filters.categoryId;
                }
                // Gestiamo lo status in maniera semplificata
                if (filters === null || filters === void 0 ? void 0 : filters.status) {
                    switch (filters.status) {
                        case "IN_STOCK":
                            where.stock = { gt: 0 };
                            break;
                        case "OUT_OF_STOCK":
                            where.stock = { lte: 0 };
                            break;
                        case "ACTIVE":
                            where.status = "ACTIVE";
                            break;
                        case "INACTIVE":
                            where.status = "INACTIVE";
                            break;
                    }
                }
                // Filtro per prodotti in stock
                if ((filters === null || filters === void 0 ? void 0 : filters.inStock) === true) {
                    where.stock = { gt: 0 };
                }
                // Filtro per prodotti attivi
                if ((filters === null || filters === void 0 ? void 0 : filters.active) === true) {
                    where.isActive = true;
                }
                // Filtro per certificazioni (many-to-many)
                if ((filters === null || filters === void 0 ? void 0 : filters.certificationIds) && filters.certificationIds.length > 0) {
                    where.productCertifications = {
                        some: {
                            certificationId: {
                                in: filters.certificationIds,
                            },
                        },
                    };
                }
                const page = (filters === null || filters === void 0 ? void 0 : filters.page) || 1;
                const limit = (filters === null || filters === void 0 ? void 0 : filters.limit) || 1000; // No limit - show all products
                const skip = (page - 1) * limit;
                logger_1.default.info("Query Prisma products con:", { where, skip, take: limit });
                // Contiamo i prodotti che soddisfano il filtro
                const total = yield this.prisma.products.count({ where });
                const totalPages = Math.ceil(total / limit);
                if (total === 0) {
                    return {
                        products: [],
                        total: 0,
                        page,
                        totalPages: 0,
                    };
                }
                // Otteniamo i prodotti filtrati e paginati
                const productsData = yield this.prisma.products.findMany({
                    where,
                    include: this.getIncludeWithCertifications(),
                    orderBy: {
                        updatedAt: "desc",
                    },
                    skip,
                    take: limit,
                });
                // Convertiamo i dati dal database nelle nostre entità di dominio
                const products = productsData.map((data) => this.mapToDomainEntity(data));
                return {
                    products,
                    total,
                    page,
                    totalPages,
                };
            }
            catch (error) {
                logger_1.default.error("Error in findAll:", error);
                return {
                    products: [],
                    total: 0,
                    page: (filters === null || filters === void 0 ? void 0 : filters.page) || 1,
                    totalPages: 0,
                };
            }
        });
    }
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const product = yield this.prisma.products.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                    include: {
                        category: true,
                    },
                });
                if (!product)
                    return null;
                return this.mapToDomainEntity(product);
            }
            catch (error) {
                logger_1.default.error(`Error in findById for product ${id}:`, error);
                return null;
            }
        });
    }
    /**
     * Find product by sku (e.g., "SALUMI-006")
     * Used by CartManagementAgent to add products to cart
     */
    findBySku(sku, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const product = yield this.prisma.products.findFirst({
                    where: {
                        sku,
                        workspaceId,
                        isActive: true, // Only active products can be added to cart
                    },
                    include: {
                        category: true,
                    },
                });
                if (!product) {
                    logger_1.default.warn(`Product not found: ${sku} in workspace ${workspaceId}`);
                    return null;
                }
                return this.mapToDomainEntity(product);
            }
            catch (error) {
                logger_1.default.error(`Error in findBySku for ${sku}:`, error);
                return null;
            }
        });
    }
    findByCategory(categoryId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const products = yield this.prisma.products.findMany({
                    where: {
                        categoryId,
                        workspaceId,
                    },
                    include: this.getIncludeWithCertifications(),
                    orderBy: {
                        updatedAt: "desc",
                    },
                });
                return products.map((product) => this.mapToDomainEntity(product));
            }
            catch (error) {
                logger_1.default.error(`Error in findByCategory for category ${categoryId}:`, error);
                return [];
            }
        });
    }
    create(product) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const createdProduct = yield this.prisma.products.create({
                    data: {
                        name: product.name,
                        sku: product.sku,
                        description: product.description,
                        formato: product.formato,
                        price: product.price,
                        stock: product.stock,
                        status: product.status,
                        isActive: product.isActive,
                        slug: product.slug,
                        categoryId: product.categoryId,
                        workspaceId: product.workspaceId,
                    },
                    include: {
                        category: true,
                    },
                });
                return this.mapToDomainEntity(createdProduct);
            }
            catch (error) {
                logger_1.default.error("Error creating product:", error);
                throw new Error(`Failed to create product: ${error.message}`);
            }
        });
    }
    update(id, product, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const updateData = {
                    name: product.name,
                    sku: product.sku,
                    description: product.description,
                    formato: product.formato,
                    price: product.price,
                    stock: product.stock,
                    status: product.status,
                    isActive: product.isActive,
                    slug: product.slug,
                    categoryId: product.categoryId,
                    supplierId: product.supplierId,
                    certifications: product.certifications, // ✅ Use certifications array instead of boolean fields
                    transportType: product.transportType,
                    region: product.region,
                };
                // Add imageUrl if provided
                if (product.imageUrl !== undefined) {
                    updateData.imageUrl = product.imageUrl;
                    logger_1.default.info(`Repository - Setting imageUrl in updateData:`, JSON.stringify(product.imageUrl));
                    logger_1.default.info(`Repository - imageUrl type: isArray=${Array.isArray(product.imageUrl)}, length=${product.imageUrl.length}`);
                }
                logger_1.default.info(`Repository - Full updateData before Prisma:`, JSON.stringify(updateData));
                const updatedProduct = yield this.prisma.products.update({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: updateData,
                    include: {
                        category: true,
                    },
                });
                logger_1.default.info(`Repository - After Prisma update, imageUrl:`, JSON.stringify(updatedProduct.imageUrl));
                logger_1.default.info(`Repository - imageUrl type from DB: isArray=${Array.isArray(updatedProduct.imageUrl)}, length=${(_a = updatedProduct.imageUrl) === null || _a === void 0 ? void 0 : _a.length}`);
                return this.mapToDomainEntity(updatedProduct);
            }
            catch (error) {
                logger_1.default.error(`Error updating product ${id}:`, error);
                return null;
            }
        });
    }
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.products.delete({
                    where: {
                        id,
                        workspaceId,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`Error deleting product ${id}:`, error);
                throw new Error(`Failed to delete product: ${error.message}`);
            }
        });
    }
    updateStock(id, stock, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedProduct = yield this.prisma.products.update({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: {
                        stock: Math.max(0, stock), // Ensure stock isn't negative
                    },
                    include: {
                        category: true,
                    },
                });
                return this.mapToDomainEntity(updatedProduct);
            }
            catch (error) {
                logger_1.default.error(`Error updating stock for product ${id}:`, error);
                return null;
            }
        });
    }
    updateStatus(id, status, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedProduct = yield this.prisma.products.update({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: {
                        status,
                    },
                    include: {
                        category: true,
                    },
                });
                return this.mapToDomainEntity(updatedProduct);
            }
            catch (error) {
                logger_1.default.error(`Error updating status for product ${id}:`, error);
                return null;
            }
        });
    }
    getProductsWithDiscounts(workspaceId, customerDiscount) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const products = yield this.prisma.products.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                        status: "ACTIVE",
                    },
                    include: this.getIncludeWithCertifications(),
                });
                const domainProducts = products.map((p) => this.mapToDomainEntity(p));
                // Se non c'è sconto cliente, ritorna i prodotti senza modifiche
                if (!customerDiscount || customerDiscount <= 0) {
                    return domainProducts;
                }
                // Applica lo sconto cliente a tutti i prodotti
                return domainProducts.map((product) => product.applyDiscount(customerDiscount, "customer"));
            }
            catch (error) {
                logger_1.default.error("Error getting products with discounts:", error);
                return [];
            }
        });
    }
    /**
     * Search products with advanced filters for Agent system
     * Used by ProductSearchAgent for customer queries
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param filters - Search filters
     * @returns Array of matching products with category relations
     */
    searchProducts(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = {
                    workspaceId,
                    isActive: true, // Only active products
                };
                // Keywords search (name, sku, transportType, formato, region)
                // 🔧 CRITICAL: If categoryId is provided, keywords become OPTIONAL (OR)
                // This allows "formaggi?" to match category WITHOUT requiring "formaggi" in product name
                if (filters.keywords && filters.keywords.length > 0) {
                    const orConditions = [];
                    filters.keywords.forEach((keyword) => {
                        // Search in: name, sku, transportType, formato, region (case-insensitive)
                        orConditions.push({ name: { contains: keyword, mode: "insensitive" } }, { sku: { contains: keyword, mode: "insensitive" } }, { transportType: { contains: keyword, mode: "insensitive" } }, { formato: { contains: keyword, mode: "insensitive" } }, { region: { contains: keyword, mode: "insensitive" } });
                    });
                    // 🆕 If categoryId is present, keywords are OPTIONAL (enhance search)
                    // Otherwise, keywords are REQUIRED (OR match)
                    if (!filters.categoryId) {
                        where.OR = orConditions;
                    }
                    // When categoryId exists, don't apply OR - category is the primary filter
                }
                // Category filter (single or multiple)
                // 🎯 Primary filter when user asks "formaggi?" - matches category, not product name
                if (filters.categoryId) {
                    where.categoryId = filters.categoryId;
                }
                // Regions filter (array of Italian region names)
                if (filters.regions && filters.regions.length > 0) {
                    where.region = {
                        in: filters.regions,
                    };
                }
                // Price range filter
                if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
                    where.price = {};
                    if (filters.minPrice !== undefined) {
                        where.price.gte = filters.minPrice;
                    }
                    if (filters.maxPrice !== undefined) {
                        where.price.lte = filters.maxPrice;
                    }
                }
                // Allergens filter - use dedicated array field
                if (filters.allergens && filters.allergens.length > 0) {
                    where.allergens = {
                        hasSome: filters.allergens,
                    };
                }
                // Certifications filter - search in certification names via relation
                if (filters.certifications && filters.certifications.length > 0) {
                    where.productCertifications = {
                        some: {
                            certification: {
                                name: {
                                    in: filters.certifications.map((cert) => {
                                        const certLower = cert.toLowerCase().trim();
                                        // Normalize certification names
                                        if (certLower === "halal" ||
                                            certLower === "ishalal" ||
                                            certLower === "hallal" ||
                                            certLower === "allal") {
                                            return "Halal";
                                        }
                                        else if (certLower === "bio" ||
                                            certLower === "isorganic" ||
                                            certLower === "organic" ||
                                            certLower === "biologico") {
                                            return "Organic";
                                        }
                                        else if (certLower === "vegan" ||
                                            certLower === "isvegan" ||
                                            certLower === "vegano") {
                                            return "Vegan";
                                        }
                                        else if (certLower === "gluten-free" ||
                                            certLower === "isglutenfree" ||
                                            certLower === "senza glutine") {
                                            return "Gluten-Free";
                                        }
                                        else if (certLower === "whole-grain" ||
                                            certLower === "iswholegrain" ||
                                            certLower === "integrali" ||
                                            certLower === "integrale") {
                                            return "Whole-Grain";
                                        }
                                        else if (certLower === "dop") {
                                            return "DOP";
                                        }
                                        else if (certLower === "igp") {
                                            return "IGP";
                                        }
                                        else if (certLower === "igt") {
                                            return "IGT";
                                        }
                                        return cert; // Return original if no mapping
                                    }),
                                    mode: "insensitive",
                                },
                            },
                        },
                    };
                }
                const products = yield this.prisma.products.findMany({
                    where,
                    include: {
                        category: true, // Include category for name/translations
                        productCertifications: {
                            include: {
                                certification: true,
                            },
                        },
                        productTransportTypes: {
                            include: {
                                transportType: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc", // Newest first
                    },
                    take: filters.limit || 20, // Default 20 results
                });
                logger_1.default.info(`ProductRepository.searchProducts: Found ${products.length} products`);
                return products;
            }
            catch (error) {
                logger_1.default.error("Error searching products:", error);
                throw error;
            }
        });
    }
    /**
     * Helper to get include clause with certifications, transport types and categories
     */
    getIncludeWithCertifications() {
        return {
            category: true, // DEPRECATED: keep for backward compatibility
            productCertifications: {
                include: {
                    certification: true,
                },
            },
            productTransportTypes: {
                include: {
                    transportType: true,
                },
            },
            productCategories: {
                include: {
                    category: true,
                },
            },
        };
    }
    /**
     * Sync product certifications (delete old + create new)
     */
    syncProductCertifications(productId, certificationIds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Delete existing certifications
                yield tx.productCertification.deleteMany({
                    where: { productId },
                });
                // Create new certifications
                if (certificationIds.length > 0) {
                    yield tx.productCertification.createMany({
                        data: certificationIds.map((certificationId) => ({
                            productId,
                            certificationId,
                        })),
                    });
                }
            }));
        });
    }
    /**
     * Sync product transport types (delete old + create new)
     */
    syncProductTransportTypes(productId, transportTypeIds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Delete existing transport types
                yield tx.productTransportType.deleteMany({
                    where: { productId },
                });
                // Create new transport types
                if (transportTypeIds.length > 0) {
                    yield tx.productTransportType.createMany({
                        data: transportTypeIds.map((transportTypeId) => ({
                            productId,
                            transportTypeId,
                        })),
                    });
                }
            }));
        });
    }
    /**
     * Sync product categories (delete old + create new)
     */
    syncProductCategories(productId, categoryIds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Delete existing categories
                yield tx.productCategory.deleteMany({
                    where: { productId },
                });
                // Create new categories
                if (categoryIds.length > 0) {
                    yield tx.productCategory.createMany({
                        data: categoryIds.map((categoryId) => ({
                            productId,
                            categoryId,
                        })),
                    });
                }
            }));
        });
    }
    mapToDomainEntity(data) {
        var _a, _b, _c;
        // Extract certification names from productCertifications relation
        const certificationNames = ((_a = data.productCertifications) === null || _a === void 0 ? void 0 : _a.map((pc) => pc.certification.name)) || data.certifications || [];
        // Extract transport type names from productTransportTypes relation
        const transportTypeNames = ((_b = data.productTransportTypes) === null || _b === void 0 ? void 0 : _b.map((pt) => pt.transportType.name)) || [];
        // Extract category IDs from productCategories relation (many-to-many)
        const categoryIds = ((_c = data.productCategories) === null || _c === void 0 ? void 0 : _c.map((pc) => pc.categoryId)) || (data.categoryId ? [data.categoryId] : []);
        const product = new product_entity_1.Product({
            id: data.id,
            name: data.name,
            sku: data.sku,
            description: data.description,
            formato: data.formato,
            price: data.price,
            stock: data.stock,
            status: data.status,
            isActive: data.isActive,
            slug: data.slug,
            categoryId: data.categoryId, // DEPRECATED: keep for backward compatibility
            supplierId: data.supplierId,
            workspaceId: data.workspaceId,
            imageUrl: data.imageUrl || [],
            imageKey: data.imageKey || null, // 💾 S3 key for cleanup
            certifications: certificationNames, // Use relation data or fallback to array
            transportType: data.transportType || "Temperatura ambiente",
            region: data.region,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            category: data.category, // DEPRECATED: keep for backward compatibility
        });
        product.productCertifications = data.productCertifications || [];
        product.productTransportTypes = data.productTransportTypes || [];
        product.productCategories = data.productCategories || [];
        product.categoryIds = categoryIds;
        return product;
    }
}
exports.ProductRepository = ProductRepository;
//# sourceMappingURL=product.repository.js.map