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
exports.ServicesController = void 0;
const service_service_1 = __importDefault(require("../../../application/services/service.service"));
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
const storage_service_1 = require("../../../services/storage.service");
/**
 * ServicesController class
 * Handles HTTP requests related to services
 */
class ServicesController {
    constructor() {
        this.serviceService = service_service_1.default;
    }
    /**
     * Get all services for a workspace
     */
    getServicesForWorkspace(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.workspaceContext;
                logger_1.default.info(`Getting services for workspace: ${workspaceId}`);
                const services = yield this.serviceService.getAllForWorkspace(workspaceId);
                return res.json(services);
            }
            catch (error) {
                logger_1.default.error("Error getting services:", error);
                return res.status(500).json({ error: "Failed to get services" });
            }
        });
    }
    /**
     * Get service by ID
     */
    getServiceById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { workspaceId } = req.workspaceContext;
                const service = yield this.serviceService.getById(id, workspaceId);
                if (!service) {
                    return res.status(404).json({ error: "Service not found" });
                }
                return res.json(service);
            }
            catch (error) {
                logger_1.default.error(`Error getting service ${req.params.id}:`, error);
                return res.status(500).json({ error: "Failed to get service" });
            }
        });
    }
    /**
     * Create a new service
     */
    createService(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.workspaceContext;
                const { name, code, description = "", price, currency = "EUR", duration, isActive, } = req.body;
                // Validate required fields
                if (!name) {
                    return res.status(400).json({ error: "Name is required" });
                }
                // Check workspace exists
                const workspace = yield prisma_1.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { id: true },
                });
                if (!workspace) {
                    return res.status(404).json({
                        error: "Workspace not found",
                    });
                }
                // Price is optional during creation (defaults to 0 if not provided)
                let numericPrice = 0;
                if (price !== undefined && price !== null) {
                    if (typeof price === "string") {
                        numericPrice = parseFloat(price);
                        if (isNaN(numericPrice)) {
                            return res
                                .status(400)
                                .json({ error: "Price must be a valid number" });
                        }
                    }
                    else if (typeof price === "number") {
                        numericPrice = price;
                    }
                    else {
                        return res.status(400).json({ error: "Price must be a valid number" });
                    }
                }
                // Parse duration if provided, or use default
                let numericDuration = 60; // Default duration
                if (duration !== undefined && duration !== null) {
                    if (typeof duration === "string") {
                        numericDuration = parseInt(duration, 10);
                        if (isNaN(numericDuration)) {
                            return res
                                .status(400)
                                .json({ error: "Duration must be a valid number" });
                        }
                    }
                    else if (typeof duration === "number") {
                        numericDuration = duration;
                    }
                    else {
                        return res
                            .status(400)
                            .json({ error: "Duration must be a valid number" });
                    }
                }
                // Convert isActive from string to boolean
                let booleanIsActive = false; // Default to false like products
                if (isActive !== undefined) {
                    if (typeof isActive === "string") {
                        booleanIsActive = isActive === "on" || isActive === "true";
                    }
                    else if (typeof isActive === "boolean") {
                        booleanIsActive = isActive;
                    }
                }
                const serviceData = {
                    name,
                    code: code || `SRV${Date.now().toString().slice(-6)}`, // Auto-generate if not provided
                    description: description || "",
                    price: numericPrice,
                    duration: numericDuration,
                    currency,
                    isActive: booleanIsActive,
                    workspaceId,
                };
                // Handle multiple image uploads with Storage Service
                let allImageUrls = [];
                let imageKey = null;
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
                    const uploadedUrls = yield storage_service_1.storageService.uploadImages(req.files, 'services');
                    allImageUrls.push(...uploadedUrls);
                    imageKey = uploadedUrls[0]; // Store first image URL as key
                    logger_1.default.info(`New images uploaded via Storage Service:`, uploadedUrls);
                }
                // Always set imageUrl and imageKey
                serviceData.imageUrl = allImageUrls;
                serviceData.imageKey = imageKey;
                logger_1.default.info(`Total images for service:`, allImageUrls);
                logger_1.default.info(`Creating service for workspace: ${workspaceId}`);
                const service = yield this.serviceService.create(serviceData);
                return res.status(201).json(service);
            }
            catch (error) {
                logger_1.default.error("Error creating service:", error);
                if (error.message === "Invalid service data") {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: "Failed to create service" });
            }
        });
    }
    /**
     * Update a service
     */
    updateService(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { workspaceId } = req.workspaceContext;
                // Verify service belongs to the workspace
                const existingService = yield this.serviceService.getById(id, workspaceId);
                if (!existingService) {
                    return res
                        .status(404)
                        .json({ error: "Service not found in specified workspace" });
                }
                const { name, code, description, price, currency, duration, isActive } = req.body;
                // Process numeric fields and validate data
                const updateData = {};
                // Add fields only if they are provided to avoid null overwrites
                if (name !== undefined)
                    updateData.name = name;
                if (code !== undefined)
                    updateData.code = code;
                if (description !== undefined)
                    updateData.description = description;
                if (currency !== undefined)
                    updateData.currency = currency;
                // Convert isActive from string "on"/"off" or boolean to proper boolean
                if (isActive !== undefined) {
                    if (typeof isActive === "string") {
                        updateData.isActive = isActive === "on" || isActive === "true";
                    }
                    else if (typeof isActive === "boolean") {
                        updateData.isActive = isActive;
                    }
                }
                // Handle price conversion properly
                if (price !== undefined) {
                    if (typeof price === "string") {
                        const numericPrice = parseFloat(price);
                        if (isNaN(numericPrice)) {
                            return res
                                .status(400)
                                .json({ error: "Price must be a valid number" });
                        }
                        updateData.price = numericPrice;
                    }
                    else if (typeof price === "number") {
                        updateData.price = price;
                    }
                    else {
                        return res.status(400).json({ error: "Price must be a valid number" });
                    }
                }
                // Handle duration conversion properly
                if (duration !== undefined) {
                    if (typeof duration === "string") {
                        const numericDuration = parseInt(duration, 10);
                        if (isNaN(numericDuration)) {
                            return res
                                .status(400)
                                .json({ error: "Duration must be a valid integer" });
                        }
                        updateData.duration = numericDuration;
                    }
                    else if (typeof duration === "number") {
                        updateData.duration = Math.floor(duration); // Ensure it's an integer
                    }
                    else if (duration !== null) {
                        return res
                            .status(400)
                            .json({ error: "Duration must be a valid integer" });
                    }
                }
                // Get old image URLs for cleanup
                const oldImageUrls = existingService.imageUrl || [];
                let newImageKey = null;
                // Handle multiple image uploads and existing images for update
                let allImageUrls = [];
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
                    // Delete old images that are being replaced
                    const imagesToDelete = oldImageUrls.filter(url => !allImageUrls.includes(url));
                    if (imagesToDelete.length > 0) {
                        yield storage_service_1.storageService.deleteImages(imagesToDelete);
                        logger_1.default.info(`Deleted old images:`, imagesToDelete);
                    }
                    const uploadedUrls = yield storage_service_1.storageService.uploadImages(req.files, 'services');
                    allImageUrls.push(...uploadedUrls);
                    newImageKey = uploadedUrls[0]; // Store first image URL as key
                    logger_1.default.info(`New images uploaded via Storage Service:`, uploadedUrls);
                }
                // Always set imageUrl and update imageKey if changed
                updateData.imageUrl = allImageUrls;
                if (newImageKey) {
                    updateData.imageKey = newImageKey;
                }
                logger_1.default.info(`Total images for service update:`, allImageUrls);
                // Basic validation checks
                if (Object.keys(updateData).length === 0) {
                    return res
                        .status(400)
                        .json({ error: "No valid fields provided for update" });
                }
                const service = yield this.serviceService.update(id, workspaceId, updateData);
                return res.json(service);
            }
            catch (error) {
                logger_1.default.error(`Error updating service ${req.params.id}:`, error);
                if (error.message === "Service not found") {
                    return res.status(404).json({ error: "Service not found" });
                }
                if (error.message === "Invalid service data") {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: "Failed to update service" });
            }
        });
    }
    /**
     * Hard delete a service
     */
    deleteService(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { workspaceId } = req.workspaceContext;
                // Verify service belongs to the workspace
                const existingService = yield this.serviceService.getById(id, workspaceId);
                if (!existingService) {
                    return res
                        .status(404)
                        .json({ error: "Service not found in specified workspace" });
                }
                // Clean up service images from storage before deleting
                if (existingService.imageUrl && existingService.imageUrl.length > 0) {
                    yield storage_service_1.storageService.deleteImages(existingService.imageUrl);
                    logger_1.default.info(`Deleted images from storage:`, existingService.imageUrl);
                }
                yield this.serviceService.delete(id, workspaceId);
                return res.status(204).send();
            }
            catch (error) {
                logger_1.default.error(`Error deleting service ${req.params.id}:`, error);
                if (error.message === "Service not found") {
                    return res.status(404).json({ error: "Service not found" });
                }
                return res.status(500).json({ error: "Failed to delete service" });
            }
        });
    }
}
exports.ServicesController = ServicesController;
//# sourceMappingURL=services.controller.js.map