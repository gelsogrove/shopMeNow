"use strict";
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
exports.ProductService = void 0;
const database_1 = require("@echatbot/database");
const product_entity_1 = require("../../domain/entities/product.entity");
const product_repository_1 = require("../../repositories/product.repository");
const certification_service_1 = require("../../services/certification.service");
const transport_type_service_1 = require("../../services/transport-type.service");
const prisma_1 = require("../../lib/prisma");
const logger_1 = __importDefault(require("../../utils/logger"));
class ProductService {
    constructor(productRepository, certificationService, transportTypeService) {
        this.productRepository = productRepository || new product_repository_1.ProductRepository();
        this.certificationService =
            certificationService || new certification_service_1.CertificationService(prisma_1.prisma);
        this.transportTypeService =
            transportTypeService || new transport_type_service_1.TransportTypeService(prisma_1.prisma);
    }
    getAllProducts(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("ProductService.getAllProducts chiamato con:", {
                    workspaceId,
                    filters,
                });
                // Get products
                const result = yield this.productRepository.findAll(workspaceId, filters);
                // Sales performance calculation removed - no longer needed
                return result;
            }
            catch (error) {
                logger_1.default.error("Error in product service getAllProducts:", error);
                throw new Error(`Failed to get products: ${error.message}`);
            }
        });
    }
    getProductById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in product service getProductById for product ${id}:`, error);
                throw new Error(`Failed to get product: ${error.message}`);
            }
        });
    }
    getProductsByCategory(categoryId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productRepository.findByCategory(categoryId, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in product service getProductsByCategory for category ${categoryId}:`, error);
                throw new Error(`Failed to get products by category: ${error.message}`);
            }
        });
    }
    createProduct(productData, certificationIds, transportTypeIds, categoryIds) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                if (!productData.name) {
                    throw new Error("Product name is required");
                }
                // Price is optional during creation, but must be non-negative if provided
                if (productData.price !== undefined && productData.price < 0) {
                    throw new Error("Product price must be a non-negative number");
                }
                if (!productData.workspaceId) {
                    throw new Error("WorkspaceId is required");
                }
                // Validate certificationIds if provided
                if (certificationIds && certificationIds.length > 0) {
                    yield this.certificationService.validateCertificationIds(certificationIds, productData.workspaceId);
                }
                // Validate transportTypeIds if provided
                if (transportTypeIds && transportTypeIds.length > 0) {
                    yield this.transportTypeService.validateTransportTypeIds(transportTypeIds, productData.workspaceId);
                }
                // Generate slug if not provided
                if (!productData.slug && productData.name) {
                    productData.slug =
                        productData.name
                            .toLowerCase()
                            .replace(/[^\w\s]/gi, "")
                            .replace(/\s+/g, "-") +
                            "-" +
                            Date.now();
                }
                // Default values
                productData.status = productData.status || database_1.ProductStatus.ACTIVE;
                productData.isActive = (_a = productData.isActive) !== null && _a !== void 0 ? _a : true;
                productData.stock = (_b = productData.stock) !== null && _b !== void 0 ? _b : 0;
                productData.price = (_c = productData.price) !== null && _c !== void 0 ? _c : 0; // Default to 0 if not provided
                // Create a proper domain entity
                const product = new product_entity_1.Product(productData);
                const createdProduct = yield this.productRepository.create(product);
                // Sync certifications if provided
                if (certificationIds && certificationIds.length > 0) {
                    yield this.productRepository.syncProductCertifications(createdProduct.id, certificationIds);
                }
                // Sync transport types if provided
                if (transportTypeIds && transportTypeIds.length > 0) {
                    yield this.productRepository.syncProductTransportTypes(createdProduct.id, transportTypeIds);
                }
                // Sync categories if provided (many-to-many)
                if (categoryIds && categoryIds.length > 0) {
                    yield this.productRepository.syncProductCategories(createdProduct.id, categoryIds);
                }
                // Re-fetch product with certifications
                return ((yield this.productRepository.findById(createdProduct.id, productData.workspaceId)) || createdProduct);
            }
            catch (error) {
                logger_1.default.error("Error in product service createProduct:", error);
                throw new Error(`Failed to create product: ${error.message}`);
            }
        });
    }
    updateProduct(id, productData, workspaceId, certificationIds, transportTypeIds, categoryIds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if price is valid when provided
                if (productData.price !== undefined && productData.price < 0) {
                    throw new Error("Product price must be a non-negative number");
                }
                // Validate certificationIds if provided
                if (certificationIds && certificationIds.length > 0) {
                    yield this.certificationService.validateCertificationIds(certificationIds, workspaceId);
                }
                // Validate transportTypeIds if provided
                if (transportTypeIds && transportTypeIds.length > 0) {
                    yield this.transportTypeService.validateTransportTypeIds(transportTypeIds, workspaceId);
                }
                // Update the product
                const updatedProduct = yield this.productRepository.update(id, productData, workspaceId);
                // Sync certifications (even if empty array to clear all)
                if (certificationIds !== undefined) {
                    yield this.productRepository.syncProductCertifications(id, certificationIds);
                }
                // Sync transport types (even if empty array to clear all)
                if (transportTypeIds !== undefined) {
                    yield this.productRepository.syncProductTransportTypes(id, transportTypeIds);
                }
                // Sync categories (even if empty array to clear all)
                if (categoryIds !== undefined) {
                    yield this.productRepository.syncProductCategories(id, categoryIds);
                }
                // Re-fetch product with certifications and transport types
                return yield this.productRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in product service updateProduct for product ${id}:`, error);
                throw new Error(`Failed to update product: ${error.message}`);
            }
        });
    }
    deleteProduct(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productRepository.delete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in product service deleteProduct for product ${id}:`, error);
                throw new Error(`Failed to delete product: ${error.message}`);
            }
        });
    }
    updateProductStock(id, stock, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (stock < 0) {
                    throw new Error("Stock cannot be negative");
                }
                return yield this.productRepository.updateStock(id, stock, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in product service updateProductStock for product ${id}:`, error);
                throw new Error(`Failed to update product stock: ${error.message}`);
            }
        });
    }
    updateProductStatus(id, status, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productRepository.updateStatus(id, status, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in product service updateProductStatus for product ${id}:`, error);
                throw new Error(`Failed to update product status: ${error.message}`);
            }
        });
    }
    getProductsWithDiscounts(workspaceId, customerDiscount) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productRepository.getProductsWithDiscounts(workspaceId, customerDiscount);
            }
            catch (error) {
                logger_1.default.error("Error in product service getProductsWithDiscounts:", error);
                throw new Error(`Failed to get products with discounts: ${error.message}`);
            }
        });
    }
    /**
     * Recupera i prodotti con gli sconti applicati secondo la logica di Andrea
     * NON-CUMULATIVO: lo sconto più alto vince
     * @param workspaceId ID del workspace
     * @param customer Cliente per cui calcolare gli sconti (opzionale)
     * @returns Prodotti con lo sconto migliore applicato
     */
    getProductsWithOffersApplied(workspaceId, customer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { PriceCalculationService } = yield Promise.resolve().then(() => __importStar(require("./price-calculation.service")));
                const { prisma } = yield Promise.resolve().then(() => __importStar(require("../../lib/prisma")));
                const priceService = new PriceCalculationService(prisma);
                const customerDiscount = (customer === null || customer === void 0 ? void 0 : customer.discount) || 0;
                const result = yield priceService.calculatePricesWithDiscounts(workspaceId, undefined, customerDiscount);
                // Map result to expected format
                return result.products.map((product) => ({
                    id: product.id,
                    name: product.name,
                    price: product.finalPrice || product.price,
                    originalPrice: product.originalPrice,
                    hasDiscount: (product.appliedDiscount || 0) > 0,
                    discountPercent: product.appliedDiscount || 0,
                    discountSource: product.discountSource || undefined,
                    discountName: product.discountName || undefined,
                    categoryId: product.categoryId,
                }));
            }
            catch (error) {
                logger_1.default.error("Error in getProductsWithOffersApplied service:", error);
                throw error;
            }
        });
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=product.service.js.map