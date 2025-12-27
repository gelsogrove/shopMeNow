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
exports.CategoryController = void 0;
const category_service_1 = require("../../../application/services/category.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Gets the workspace ID from request parameters or query
 */
const getWorkspaceId = (req) => {
    return req.params.workspaceId || req.query.workspaceId;
};
/**
 * CategoryController class
 * Handles HTTP requests related to categories
 */
class CategoryController {
    constructor() {
        this.categoryService = new category_service_1.CategoryService();
    }
    /**
     * Get all categories for a workspace
     */
    getAllCategories(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: 'Workspace ID is required' });
                }
                const categories = yield this.categoryService.getAllForWorkspace(workspaceId);
                return res.json(categories);
            }
            catch (error) {
                logger_1.default.error("Error getting categories:", error);
                return res.status(500).json({ error: 'Failed to get categories' });
            }
        });
    }
    /**
     * Get category by ID
     */
    getCategoryById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: 'Workspace ID is required' });
                }
                const category = yield this.categoryService.getById(id, workspaceId);
                if (!category) {
                    return res.status(404).json({ error: 'Category not found' });
                }
                return res.json(category);
            }
            catch (error) {
                logger_1.default.error(`Error getting category ${req.params.id}:`, error);
                return res.status(500).json({ error: 'Failed to get category' });
            }
        });
    }
    /**
     * Create a new category
     */
    createCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: 'Workspace ID is required' });
                }
                const { name, description, isActive } = req.body;
                const categoryData = {
                    name,
                    description,
                    isActive: isActive !== undefined ? isActive : true,
                    workspaceId
                };
                const category = yield this.categoryService.create(categoryData);
                return res.status(201).json(category);
            }
            catch (error) {
                logger_1.default.error("Error creating category:", error);
                if (error.message === 'A category with this name already exists') {
                    return res.status(409).json({ error: error.message });
                }
                if (error.message === 'Missing required fields' || error.message === 'Invalid category data') {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: 'Failed to create category' });
            }
        });
    }
    /**
     * Update a category
     */
    updateCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: 'Workspace ID is required' });
                }
                const { name, description, isActive } = req.body;
                // Validate required fields for update
                if (!name || name.trim() === '') {
                    return res.status(400).json({ error: 'Category name is required' });
                }
                const category = yield this.categoryService.update(id, workspaceId, {
                    name,
                    description,
                    isActive
                });
                return res.json(category);
            }
            catch (error) {
                logger_1.default.error(`Error updating category ${req.params.id}:`, error);
                if (error.message === 'Category not found') {
                    return res.status(404).json({ error: 'Category not found' });
                }
                if (error.message === 'A category with this name already exists') {
                    return res.status(409).json({ error: error.message });
                }
                if (error.message === 'Missing required fields' || error.message === 'Invalid category data') {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: 'Failed to update category' });
            }
        });
    }
    /**
     * Delete a category
     */
    deleteCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: 'Workspace ID is required' });
                }
                try {
                    const result = yield this.categoryService.delete(id, workspaceId);
                    return res.status(204).send();
                }
                catch (error) {
                    if (error.message === 'Category not found') {
                        return res.status(404).json({ error: 'Category not found' });
                    }
                    if (error.message === 'Cannot delete category that is used by products') {
                        return res.status(409).json({ error: error.message });
                    }
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error(`Error deleting category ${req.params.id}:`, error);
                return res.status(500).json({ error: 'Failed to delete category' });
            }
        });
    }
    /**
     * Check if a category has products
     */
    hasProducts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: 'Workspace ID is required' });
                }
                const hasProducts = yield this.categoryService.hasProducts(id, workspaceId);
                return res.json({ hasProducts });
            }
            catch (error) {
                logger_1.default.error(`Error checking products for category ${req.params.id}:`, error);
                return res.status(500).json({ error: 'Failed to check category products' });
            }
        });
    }
}
exports.CategoryController = CategoryController;
//# sourceMappingURL=category.controller.js.map