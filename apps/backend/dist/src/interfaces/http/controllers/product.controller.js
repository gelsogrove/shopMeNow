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
exports.ProductController = void 0;
const database_1 = require("@echatbot/database");
const product_service_1 = require("../../../application/services/product.service");
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
const storage_1 = require("../../../services/storage");
class ProductController {
    constructor(productService) {
        this.getAllProducts = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const effectiveWorkspaceId = workspaceIdParam || workspaceIdQuery;
                if (!effectiveWorkspaceId) {
                    logger_1.default.error("WorkspaceId mancante nella richiesta");
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const { search, categoryId, status, page, limit, active, inStock } = req.query;
                const pageNumber = page ? parseInt(page) : undefined;
                const limitNumber = limit ? parseInt(limit) : undefined;
                const result = yield this.productService.getAllProducts(effectiveWorkspaceId, {
                    search: search,
                    categoryId: categoryId,
                    status: status,
                    page: pageNumber,
                    limit: limitNumber,
                    active: active === "true",
                    inStock: inStock === "true",
                });
                logger_1.default.info(`🔍 Products found in database: ${result.products.length} (total: ${result.total})`);
                // Map backend 'Sku' field to frontend 'code' field for all products
                const productsWithCode = result.products.map((product) => (Object.assign(Object.assign({}, product), { code: product.sku, formato: product.formato })));
                return res.json({
                    products: productsWithCode,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        totalPages: result.totalPages,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error fetching products:", error);
                return res.status(500).json({
                    message: "An error occurred while fetching products",
                    error: error.message,
                });
            }
        });
        this.getProductById = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const product = yield this.productService.getProductById(id, workspaceId);
                if (!product) {
                    return res.status(404).json({ message: "Product not found" });
                }
                // Map backend 'Sku' field to frontend 'code' field
                const responseProduct = Object.assign(Object.assign({}, product), { code: product.sku });
                return res.json(responseProduct);
            }
            catch (error) {
                logger_1.default.error(`Error getting product by ID:`, error);
                return res.status(500).json({
                    message: "An error occurred while fetching the product",
                    error: error.message,
                });
            }
        });
        this.getProductsByCategory = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { categoryId } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const products = yield this.productService.getProductsByCategory(categoryId, workspaceId);
                return res.json(products);
            }
            catch (error) {
                logger_1.default.error(`Error getting products by category:`, error);
                return res.status(500).json({
                    message: "An error occurred while fetching products by category",
                    error: error.message,
                });
            }
        });
        this.createProduct = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                const productData = req.body;
                // DEBUG: Log everything about the request
                logger_1.default.info("=== CREATE PRODUCT DEBUG ===");
                logger_1.default.info("req.body:", productData);
                logger_1.default.info("req.files:", req.files);
                logger_1.default.info("workspaceId:", workspaceId);
                logger_1.default.info("supplierId in body:", productData.supplierId);
                logger_1.default.info("categoryId in body:", productData.categoryId);
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                // Check workspace exists
                const workspace = yield prisma_1.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { id: true },
                });
                if (!workspace) {
                    return res.status(404).json({
                        message: "Workspace not found",
                        error: "Invalid workspaceId",
                    });
                }
                if (!productData.workspaceId) {
                    productData.workspaceId = workspaceId;
                }
                // Validate Sku uniqueness within workspace
                const sku = productData.code || productData.sku;
                if (sku) {
                    const existingProduct = yield prisma_1.prisma.products.findFirst({
                        where: {
                            sku: sku,
                            workspaceId: workspaceId,
                        },
                    });
                    if (existingProduct) {
                        logger_1.default.warn(`Duplicate Sku attempt: ${sku} in workspace ${workspaceId}`);
                        return res.status(400).json({
                            message: "Product code already exists",
                            error: `A product with code "${sku}" already exists in this workspace`,
                        });
                    }
                }
                // Convert string fields to proper types (FormData sends everything as strings)
                if (typeof productData.price === "string") {
                    productData.price = parseFloat(productData.price);
                }
                if (typeof productData.stock === "string") {
                    productData.stock = parseInt(productData.stock, 10);
                }
                if (typeof productData.isActive === "string") {
                    productData.isActive = productData.isActive === "true";
                }
                // Parse certificationIds array from JSON string (sent from frontend)
                let certificationIds = [];
                if (productData.certificationIds &&
                    typeof productData.certificationIds === "string") {
                    try {
                        certificationIds = JSON.parse(productData.certificationIds);
                    }
                    catch (error) {
                        logger_1.default.error("Failed to parse certificationIds JSON:", error);
                        certificationIds = [];
                    }
                }
                else if (Array.isArray(productData.certificationIds)) {
                    certificationIds = productData.certificationIds;
                }
                // Remove certificationIds from productData (handled separately)
                delete productData.certificationIds;
                // Parse transportTypeIds array from JSON string (sent from frontend)
                let transportTypeIds = [];
                if (productData.transportTypeIds &&
                    typeof productData.transportTypeIds === "string") {
                    try {
                        transportTypeIds = JSON.parse(productData.transportTypeIds);
                    }
                    catch (error) {
                        logger_1.default.error("Failed to parse transportTypeIds JSON:", error);
                        transportTypeIds = [];
                    }
                }
                else if (Array.isArray(productData.transportTypeIds)) {
                    transportTypeIds = productData.transportTypeIds;
                }
                // Remove transportTypeIds from productData (handled separately)
                delete productData.transportTypeIds;
                // Parse categoryIds array from JSON string (sent from frontend) - many-to-many
                let categoryIds = [];
                if (productData.categoryIds &&
                    typeof productData.categoryIds === "string") {
                    try {
                        categoryIds = JSON.parse(productData.categoryIds);
                    }
                    catch (error) {
                        logger_1.default.error("Failed to parse categoryIds JSON:", error);
                        categoryIds = [];
                    }
                }
                else if (Array.isArray(productData.categoryIds)) {
                    categoryIds = productData.categoryIds;
                }
                // Remove categoryIds from productData (handled separately via many-to-many)
                delete productData.categoryIds;
                // Handle supplierId: convert empty string to null
                if (productData.supplierId === "" || productData.supplierId === "none") {
                    productData.supplierId = null;
                }
                // Handle categoryId: convert empty string to null (DEPRECATED - use categoryIds instead)
                if (productData.categoryId === "" || productData.categoryId === "none") {
                    productData.categoryId = null;
                }
                // Handle transportType: set default if not provided
                if (!productData.transportType) {
                    productData.transportType = "Temperatura ambiente";
                }
                logger_1.default.info("✅ After conversion - supplierId:", productData.supplierId, "categoryId:", productData.categoryId);
                // Map frontend 'code' field to backend 'Sku' field
                if (productData.code && !productData.sku) {
                    productData.sku = productData.code;
                    delete productData.code;
                }
                // Handle multiple image uploads with Storage Service
                const storage = (0, storage_1.getStorageService)();
                let allImageUrls = [];
                let allImageKeys = [];
                // Add existing images first (if reordered)
                if (req.body.existingImageUrls) {
                    try {
                        const existingUrls = JSON.parse(req.body.existingImageUrls);
                        if (Array.isArray(existingUrls) && existingUrls.length > 0) {
                            allImageUrls = [...existingUrls];
                            logger_1.default.info(`Existing images:`, existingUrls);
                        }
                    }
                    catch (error) {
                        logger_1.default.error("Error parsing existingImageUrls JSON", error);
                    }
                }
                // Add new uploaded images via Storage Service
                if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                    for (const file of req.files) {
                        const uploadedFile = yield storage.upload(file.buffer, {
                            filename: file.filename,
                            folder: `products/${workspaceId}`,
                            contentType: file.mimetype,
                            isPublic: true
                        });
                        allImageUrls.push(uploadedFile.url);
                        allImageKeys.push(uploadedFile.key);
                    }
                    logger_1.default.info(`New images uploaded via Storage Service:`, allImageUrls);
                }
                // Always set imageUrl and imageKey
                productData.imageUrl = allImageUrls;
                productData.imageKey = allImageKeys.length > 0 ? allImageKeys[0] : null;
                logger_1.default.info(`Total images for product:`, allImageUrls);
                const product = yield this.productService.createProduct(productData, certificationIds, transportTypeIds, categoryIds);
                // Map backend 'Sku' field to frontend 'code' field
                const responseProduct = Object.assign(Object.assign({}, product), { code: product.sku });
                return res.status(201).json(responseProduct);
            }
            catch (error) {
                logger_1.default.error("Error creating product:", error);
                return res.status(((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("required")) ? 400 : 500).json({
                    message: "An error occurred while creating the product",
                    error: error.message,
                });
            }
        });
        this.updateProduct = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const productData = req.body;
                // Validate required fields for update
                if (!productData.name || productData.name.trim() === "") {
                    return res.status(400).json({
                        message: "Product name is required",
                        error: "Missing required field: name",
                    });
                }
                if (productData.price === undefined ||
                    productData.price === null ||
                    isNaN(productData.price) ||
                    productData.price < 0) {
                    return res.status(400).json({
                        message: "Valid product price is required",
                        error: "Missing or invalid field: price",
                    });
                }
                // Convert string fields to proper types (FormData sends everything as strings)
                if (typeof productData.price === "string") {
                    productData.price = parseFloat(productData.price);
                }
                if (typeof productData.stock === "string") {
                    productData.stock = parseInt(productData.stock, 10);
                }
                if (typeof productData.isActive === "string") {
                    productData.isActive = productData.isActive === "true";
                }
                // Parse certificationIds array from JSON string (sent from frontend)
                let certificationIds = [];
                if (productData.certificationIds &&
                    typeof productData.certificationIds === "string") {
                    try {
                        certificationIds = JSON.parse(productData.certificationIds);
                    }
                    catch (error) {
                        logger_1.default.error("Failed to parse certificationIds JSON:", error);
                        certificationIds = [];
                    }
                }
                else if (Array.isArray(productData.certificationIds)) {
                    certificationIds = productData.certificationIds;
                }
                // Remove certificationIds from productData (handled separately)
                delete productData.certificationIds;
                // Parse transportTypeIds array from JSON string (sent from frontend)
                let transportTypeIds = [];
                if (productData.transportTypeIds &&
                    typeof productData.transportTypeIds === "string") {
                    try {
                        transportTypeIds = JSON.parse(productData.transportTypeIds);
                    }
                    catch (error) {
                        logger_1.default.error("Failed to parse transportTypeIds JSON:", error);
                        transportTypeIds = [];
                    }
                }
                else if (Array.isArray(productData.transportTypeIds)) {
                    transportTypeIds = productData.transportTypeIds;
                }
                // Remove transportTypeIds from productData (handled separately)
                delete productData.transportTypeIds;
                // Parse categoryIds array from JSON string (sent from frontend) - many-to-many
                let categoryIds = [];
                if (productData.categoryIds &&
                    typeof productData.categoryIds === "string") {
                    try {
                        categoryIds = JSON.parse(productData.categoryIds);
                    }
                    catch (error) {
                        logger_1.default.error("Failed to parse categoryIds JSON:", error);
                        categoryIds = [];
                    }
                }
                else if (Array.isArray(productData.categoryIds)) {
                    categoryIds = productData.categoryIds;
                }
                // Remove categoryIds from productData (handled separately via many-to-many)
                delete productData.categoryIds;
                // Handle supplierId: convert empty string to null
                if (productData.supplierId === "" || productData.supplierId === "none") {
                    productData.supplierId = null;
                }
                // Handle categoryId: convert empty string to null (DEPRECATED - use categoryIds instead)
                if (productData.categoryId === "" || productData.categoryId === "none") {
                    productData.categoryId = null;
                }
                // Handle transportType: set default if not provided
                if (!productData.transportType) {
                    productData.transportType = "Temperatura ambiente";
                }
                logger_1.default.info("✅ UPDATE - After conversion - supplierId:", productData.supplierId, "categoryId:", productData.categoryId);
                // Map frontend 'code' field to backend 'Sku' field
                if (productData.code && !productData.sku) {
                    productData.sku = productData.code;
                    delete productData.code;
                }
                // Get current product to compare image changes
                const currentProduct = yield this.productService.getProductById(id, workspaceId);
                if (!currentProduct) {
                    return res.status(404).json({ message: "Product not found" });
                }
                const storage = (0, storage_1.getStorageService)();
                const oldImageKey = currentProduct.imageKey;
                let allImageUrls = [];
                let newImageKey = null;
                // Add existing images first (if provided)
                if (req.body.existingImageUrls) {
                    try {
                        const existingUrls = JSON.parse(req.body.existingImageUrls);
                        if (Array.isArray(existingUrls) && existingUrls.length > 0) {
                            allImageUrls = [...existingUrls];
                            logger_1.default.info(`Existing images for update:`, existingUrls);
                        }
                    }
                    catch (error) {
                        logger_1.default.error("Error parsing existingImageUrls JSON", error);
                    }
                }
                // Add new uploaded images via Storage Service
                if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                    logger_1.default.info(`Received ${req.files.length} files from multer`);
                    // Delete old image if replacing
                    if (oldImageKey) {
                        yield storage.delete(oldImageKey);
                        logger_1.default.info(`Deleted old image: ${oldImageKey}`);
                    }
                    for (const file of req.files) {
                        const uploadedFile = yield storage.upload(file.buffer, {
                            filename: file.filename,
                            folder: `products/${workspaceId}`,
                            contentType: file.mimetype,
                            isPublic: true
                        });
                        allImageUrls.push(uploadedFile.url);
                        if (!newImageKey)
                            newImageKey = uploadedFile.key;
                    }
                    logger_1.default.info(`New images uploaded via Storage Service:`, allImageUrls);
                }
                // Always set imageUrl and update imageKey if changed
                productData.imageUrl = allImageUrls;
                if (newImageKey) {
                    productData.imageKey = newImageKey;
                }
                logger_1.default.info(`Total images for product update:`, allImageUrls);
                const updatedProduct = yield this.productService.updateProduct(id, productData, workspaceId, certificationIds, transportTypeIds, categoryIds);
                if (!updatedProduct) {
                    return res.status(404).json({ message: "Product not found" });
                }
                // Map backend 'sku' field to frontend 'code' field
                const responseProduct = Object.assign(Object.assign({}, updatedProduct), { code: updatedProduct.sku });
                return res.json(responseProduct);
            }
            catch (error) {
                logger_1.default.error("Error updating product:", error);
                return res.status(((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("negative")) ? 400 : 500).json({
                    message: "An error occurred while updating the product",
                    error: error.message,
                });
            }
        });
        this.deleteProduct = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                // Check if the product exists before deleting it
                const existingProduct = yield this.productService.getProductById(id, workspaceId);
                if (!existingProduct) {
                    return res.status(404).json({ message: "Product not found" });
                }
                // Delete image from storage if exists
                if (existingProduct.imageKey) {
                    const storage = (0, storage_1.getStorageService)();
                    yield storage.delete(existingProduct.imageKey);
                    logger_1.default.info(`Deleted image from storage: ${existingProduct.imageKey}`);
                }
                yield this.productService.deleteProduct(id, workspaceId);
                return res.status(200).json({ message: "Product deleted successfully" });
            }
            catch (error) {
                logger_1.default.error("Error deleting product:", error);
                return res.status(500).json({
                    message: "An error occurred while deleting the product",
                    error: error.message,
                });
            }
        });
        this.updateProductStock = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const { stock } = req.body;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                if (stock === undefined || stock === null) {
                    return res.status(400).json({
                        message: "Stock value is required",
                        error: "Missing stock parameter",
                    });
                }
                const updatedProduct = yield this.productService.updateProductStock(id, stock, workspaceId);
                if (!updatedProduct) {
                    return res.status(404).json({ message: "Product not found" });
                }
                return res.json(updatedProduct);
            }
            catch (error) {
                logger_1.default.error("Error updating product stock:", error);
                return res.status(((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("negative")) ? 400 : 500).json({
                    message: "An error occurred while updating product stock",
                    error: error.message,
                });
            }
        });
        this.updateProductStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { status } = req.body;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                if (!status ||
                    !Object.values(database_1.ProductStatus).includes(status)) {
                    return res.status(400).json({
                        message: "Valid status is required",
                        error: "Missing or invalid status parameter",
                        validStatuses: Object.values(database_1.ProductStatus),
                    });
                }
                const updatedProduct = yield this.productService.updateProductStatus(id, status, workspaceId);
                if (!updatedProduct) {
                    return res.status(404).json({ message: "Product not found" });
                }
                return res.json(updatedProduct);
            }
            catch (error) {
                logger_1.default.error("Error updating product status:", error);
                return res.status(500).json({
                    message: "An error occurred while updating product status",
                    error: error.message,
                });
            }
        });
        this.getProductsWithDiscounts = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceId = workspaceIdParam || workspaceIdQuery;
                const { customerDiscount } = req.query;
                const discountValue = customerDiscount
                    ? parseFloat(customerDiscount)
                    : undefined;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const products = yield this.productService.getProductsWithDiscounts(workspaceId, discountValue);
                return res.json(products);
            }
            catch (error) {
                logger_1.default.error("Error fetching products with discounts:", error);
                return res.status(500).json({
                    message: "An error occurred while fetching products with discounts",
                    error: error.message,
                });
            }
        });
        /**
         * Export products to CSV
         * Uses supplierName and categoryName instead of IDs for readability
         */
        this.exportProductsCsv = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                const workspaceId = req.params.workspaceId;
                if (!workspaceId) {
                    res.status(400).json({ message: "WorkspaceId is required" });
                    return;
                }
                // Fetch all products with relations
                const products = yield prisma_1.prisma.products.findMany({
                    where: {
                        workspaceId
                    },
                    include: {
                        category: { select: { name: true } },
                    },
                    orderBy: { name: "asc" },
                });
                // CSV Header
                const headers = [
                    "sku",
                    "name",
                    "description",
                    "formato",
                    "price",
                    "stock",
                    "status",
                    "isActive",
                    "supplierName",
                    "categoryName",
                    "transportType",
                    "region",
                    "allergens",
                    "certifications",
                ];
                // Escape CSV value
                const escapeCsv = (value) => {
                    if (value === null || value === undefined)
                        return "";
                    const str = String(value);
                    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };
                // Build CSV content
                const csvRows = [headers.join(",")];
                for (const product of products) {
                    const row = [
                        escapeCsv(product.sku),
                        escapeCsv(product.name),
                        escapeCsv(product.description),
                        escapeCsv(product.formato),
                        ((_a = product.price) === null || _a === void 0 ? void 0 : _a.toString()) || "0",
                        ((_b = product.stock) === null || _b === void 0 ? void 0 : _b.toString()) || "0",
                        product.status || "ACTIVE",
                        product.isActive ? "true" : "false",
                        "", // supplierName - deprecated
                        escapeCsv((_c = product.category) === null || _c === void 0 ? void 0 : _c.name),
                        escapeCsv(product.transportType),
                        escapeCsv(product.region),
                        escapeCsv((_d = product.allergens) === null || _d === void 0 ? void 0 : _d.join("|")),
                        escapeCsv((_e = product.certifications) === null || _e === void 0 ? void 0 : _e.join("|")),
                    ];
                    csvRows.push(row.join(","));
                }
                const csvContent = csvRows.join("\n");
                // Set headers for file download
                res.setHeader("Content-Type", "text/csv; charset=utf-8");
                res.setHeader("Content-Disposition", `attachment; filename="products-export-${new Date().toISOString().split("T")[0]}.csv"`);
                res.send(csvContent);
                logger_1.default.info(`📤 Exported ${products.length} products to CSV for workspace ${workspaceId}`);
            }
            catch (error) {
                logger_1.default.error("Error exporting products to CSV:", error);
                res.status(500).json({
                    message: "An error occurred while exporting products",
                    error: error.message,
                });
            }
        });
        /**
         * Import products from CSV
         * Supports upsert: creates new products or updates existing ones by SKU
         * Uses supplierName and categoryName with lookup to find IDs
         */
        this.importProductsCsv = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            try {
                const workspaceId = req.params.workspaceId;
                if (!workspaceId) {
                    return res.status(400).json({ message: "WorkspaceId is required" });
                }
                if (!req.file) {
                    return res.status(400).json({ message: "CSV file is required" });
                }
                const csvContent = req.file.buffer.toString("utf-8");
                const lines = csvContent.split("\n").filter(line => line.trim());
                if (lines.length < 2) {
                    return res.status(400).json({ message: "CSV file is empty or has no data rows" });
                }
                // Parse header
                const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
                const requiredHeaders = ["sku", "name", "price"];
                for (const required of requiredHeaders) {
                    if (!headers.includes(required)) {
                        return res.status(400).json({
                            message: `Missing required column: ${required}`,
                            headers: headers
                        });
                    }
                }
                // Build lookup maps for categories
                const categories = yield prisma_1.prisma.categories.findMany({
                    where: { workspaceId },
                    select: { id: true, name: true },
                });
                const categoryMap = new Map(categories.map(c => { var _a; return [(_a = c.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().trim(), c.id]; }));
                // Parse CSV value (handle quoted values)
                const parseCsvValue = (value) => {
                    if (!value)
                        return "";
                    let result = value.trim();
                    if (result.startsWith('"') && result.endsWith('"')) {
                        result = result.slice(1, -1).replace(/""/g, '"');
                    }
                    return result;
                };
                // Parse CSV row handling quoted values
                const parseCsvRow = (line) => {
                    const result = [];
                    let current = "";
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            if (inQuotes && line[i + 1] === '"') {
                                current += '"';
                                i++;
                            }
                            else {
                                inQuotes = !inQuotes;
                            }
                        }
                        else if (char === "," && !inQuotes) {
                            result.push(current.trim());
                            current = "";
                        }
                        else {
                            current += char;
                        }
                    }
                    result.push(current.trim());
                    return result;
                };
                const results = {
                    created: 0,
                    updated: 0,
                    errors: [],
                };
                // Process each row
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCsvRow(lines[i]);
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = parseCsvValue(values[index] || "");
                    });
                    const sku = (_a = rowData.sku) === null || _a === void 0 ? void 0 : _a.trim();
                    const name = (_b = rowData.name) === null || _b === void 0 ? void 0 : _b.trim();
                    const price = parseFloat(rowData.price) || 0;
                    if (!sku || !name) {
                        results.errors.push({
                            row: i + 1,
                            sku: sku || "N/A",
                            error: "Missing required field: sku or name",
                        });
                        continue;
                    }
                    try {
                        // Lookup supplier and category IDs
                        const categoryName = (_c = rowData.categoryname) === null || _c === void 0 ? void 0 : _c.toLowerCase().trim();
                        const categoryId = categoryName ? categoryMap.get(categoryName) : null;
                        // Warn if category not found but continue
                        if (categoryName && !categoryId) {
                            logger_1.default.warn(`⚠️ Category not found: "${rowData.categoryname}" for product ${sku}`);
                        }
                        // Parse arrays (pipe-separated)
                        const allergens = rowData.allergens
                            ? rowData.allergens.split("|").map(a => a.trim()).filter(Boolean)
                            : [];
                        const certifications = rowData.certifications
                            ? rowData.certifications.split("|").map(c => c.trim()).filter(Boolean)
                            : [];
                        // Generate slug from name
                        const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                        // Upsert product
                        const existingProduct = yield prisma_1.prisma.products.findFirst({
                            where: { workspaceId, sku },
                        });
                        if (existingProduct) {
                            // Update existing
                            yield prisma_1.prisma.products.update({
                                where: { id: existingProduct.id },
                                data: {
                                    name,
                                    description: rowData.description || null,
                                    formato: rowData.formato || null,
                                    price,
                                    stock: parseInt(rowData.stock) || 0,
                                    status: ((_d = rowData.status) === null || _d === void 0 ? void 0 : _d.toUpperCase()) || "ACTIVE",
                                    isActive: ((_e = rowData.isactive) === null || _e === void 0 ? void 0 : _e.toLowerCase()) !== "false",
                                    categoryId: categoryId || existingProduct.categoryId,
                                    transportType: rowData.transporttype || existingProduct.transportType,
                                    region: rowData.region || existingProduct.region,
                                    allergens,
                                    certifications,
                                    updatedAt: new Date(),
                                },
                            });
                            results.updated++;
                        }
                        else {
                            // Create new
                            yield prisma_1.prisma.products.create({
                                data: {
                                    sku,
                                    name,
                                    description: rowData.description || null,
                                    formato: rowData.formato || null,
                                    price,
                                    stock: parseInt(rowData.stock) || 0,
                                    status: ((_f = rowData.status) === null || _f === void 0 ? void 0 : _f.toUpperCase()) || "ACTIVE",
                                    isActive: ((_g = rowData.isactive) === null || _g === void 0 ? void 0 : _g.toLowerCase()) !== "false",
                                    categoryId,
                                    transportType: rowData.transporttype || "Temperatura ambiente",
                                    region: rowData.region || null,
                                    allergens,
                                    certifications,
                                    slug,
                                    workspaceId,
                                },
                            });
                            results.created++;
                        }
                    }
                    catch (error) {
                        results.errors.push({
                            row: i + 1,
                            sku,
                            error: error.message,
                        });
                    }
                }
                logger_1.default.info(`📥 Import completed for workspace ${workspaceId}: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);
                return res.json({
                    message: "Import completed",
                    results,
                });
            }
            catch (error) {
                logger_1.default.error("Error importing products from CSV:", error);
                return res.status(500).json({
                    message: "An error occurred while importing products",
                    error: error.message,
                });
            }
        });
        this.productService = productService || new product_service_1.ProductService();
    }
}
exports.ProductController = ProductController;
//# sourceMappingURL=product.controller.js.map