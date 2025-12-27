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
exports.SalesController = void 0;
const sales_service_1 = require("../../../application/services/sales.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Gets the workspace ID from request parameters or query
 */
const getWorkspaceId = (req) => {
    return req.params.workspaceId || req.query.workspaceId;
};
/**
 * SalesController class
 * Handles HTTP requests related to sales
 */
class SalesController {
    constructor() {
        this.salesService = new sales_service_1.SalesService();
    }
    /**
     * Get all sales for a workspace
     */
    getAllSales(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const sales = yield this.salesService.getAllForWorkspace(workspaceId);
                return res.json(sales);
            }
            catch (error) {
                logger_1.default.error("Error getting sales:", error);
                return res.status(500).json({ error: "Failed to get sales" });
            }
        });
    }
    /**
     * Get sales by ID
     */
    getSalesById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const sales = yield this.salesService.getById(id, workspaceId);
                if (!sales) {
                    return res.status(404).json({ error: "Salesperson not found" });
                }
                return res.json(sales);
            }
            catch (error) {
                logger_1.default.error(`Error getting sales ${req.params.id}:`, error);
                return res.status(500).json({ error: "Failed to get salesperson" });
            }
        });
    }
    /**
     * Create a new sales
     */
    createSales(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const { firstName, lastName, email, phone, isActive } = req.body;
                const salesData = {
                    firstName,
                    lastName,
                    email,
                    phone,
                    isActive: isActive !== undefined ? isActive : true,
                    workspaceId,
                };
                const sales = yield this.salesService.create(salesData);
                return res.status(201).json(sales);
            }
            catch (error) {
                logger_1.default.error("Error creating sales:", error);
                if (error.message === "A salesperson with this email already exists") {
                    return res.status(409).json({ error: error.message });
                }
                if (error.message === "Missing required fields" ||
                    error.message === "Invalid sales data") {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: "Failed to create salesperson" });
            }
        });
    }
    /**
     * Update a sales
     */
    updateSales(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const { firstName, lastName, email, phone, isActive } = req.body;
                const sales = yield this.salesService.update(id, workspaceId, {
                    firstName,
                    lastName,
                    email,
                    phone,
                    isActive,
                });
                return res.json(sales);
            }
            catch (error) {
                logger_1.default.error(`Error updating sales ${req.params.id}:`, error);
                if (error.message === "Salesperson not found") {
                    return res.status(404).json({ error: "Salesperson not found" });
                }
                if (error.message === "A salesperson with this email already exists") {
                    return res.status(409).json({ error: error.message });
                }
                if (error.message === "Missing required fields" ||
                    error.message === "Invalid sales data") {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: "Failed to update salesperson" });
            }
        });
    }
    /**
     * Delete a sales
     */
    deleteSales(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                try {
                    const result = yield this.salesService.delete(id, workspaceId);
                    return res.status(204).send();
                }
                catch (error) {
                    if (error.message === "Salesperson not found") {
                        return res.status(404).json({ error: "Salesperson not found" });
                    }
                    if (error.message ===
                        "Cannot delete salesperson that is assigned to customers") {
                        return res.status(409).json({ error: error.message });
                    }
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error(`Error deleting sales ${req.params.id}:`, error);
                return res.status(500).json({ error: "Failed to delete salesperson" });
            }
        });
    }
    /**
     * Check if a sales has customers
     */
    hasCustomers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const hasCustomers = yield this.salesService.hasCustomers(id, workspaceId);
                return res.json({ hasCustomers });
            }
            catch (error) {
                logger_1.default.error(`Error checking customers for sales ${req.params.id}:`, error);
                return res.status(500).json({ error: "Failed to check sales customers" });
            }
        });
    }
}
exports.SalesController = SalesController;
//# sourceMappingURL=sales.controller.js.map