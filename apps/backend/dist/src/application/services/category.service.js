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
exports.CategoryService = void 0;
const category_entity_1 = require("../../domain/entities/category.entity");
const category_repository_1 = require("../../repositories/category.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service layer for Category
 * Handles business logic for categories
 */
class CategoryService {
    constructor() {
        this.categoryRepository = new category_repository_1.CategoryRepository();
    }
    /**
     * Get all categories for a workspace
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.categoryRepository.findAll(workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error getting all categories:", error);
                throw error;
            }
        });
    }
    /**
     * Get category by ID
     */
    getById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.categoryRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error getting category ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new category
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!data.name || !data.workspaceId) {
                    throw new Error("Missing required fields");
                }
                // Create a category entity for validation and slug generation
                const categoryToCreate = new category_entity_1.Category(data);
                categoryToCreate.slug = categoryToCreate.generateSlug();
                // Validate the category
                if (!categoryToCreate.validate()) {
                    throw new Error("Invalid category data");
                }
                // Check if a category with the same slug already exists
                const existingCategory = yield this.categoryRepository.findBySlug(categoryToCreate.slug, categoryToCreate.workspaceId);
                if (existingCategory) {
                    throw new Error("A category with this name already exists");
                }
                // Create the category
                return yield this.categoryRepository.create(categoryToCreate);
            }
            catch (error) {
                logger_1.default.error("Error creating category:", error);
                throw error;
            }
        });
    }
    /**
     * Update a category
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if category exists
                const existingCategory = yield this.categoryRepository.findById(id, workspaceId);
                if (!existingCategory) {
                    throw new Error("Category not found");
                }
                // Create merged category for validation and slug generation
                const categoryToUpdate = new category_entity_1.Category(Object.assign(Object.assign({}, existingCategory), data));
                // If name is changed, update the slug
                if (data.name && data.name !== existingCategory.name) {
                    categoryToUpdate.slug = categoryToUpdate.generateSlug();
                    // Check if a category with the new slug already exists (excluding the current one)
                    const categoryWithSlug = yield this.categoryRepository.findBySlug(categoryToUpdate.slug, workspaceId);
                    if (categoryWithSlug && categoryWithSlug.id !== id) {
                        throw new Error("A category with this name already exists");
                    }
                }
                // Update the category
                return yield this.categoryRepository.update(id, workspaceId, categoryToUpdate);
            }
            catch (error) {
                logger_1.default.error(`Error updating category ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete a category
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if category exists
                const category = yield this.categoryRepository.findById(id, workspaceId);
                if (!category) {
                    throw new Error("Category not found");
                }
                // Check if category has products
                const hasProducts = yield this.categoryRepository.hasProducts(id, workspaceId);
                if (hasProducts) {
                    throw new Error("Cannot delete category that is used by products");
                }
                // Delete the category
                return yield this.categoryRepository.delete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error deleting category ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Check if a category has products
     */
    hasProducts(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.categoryRepository.hasProducts(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error checking if category ${id} has products:`, error);
                throw error;
            }
        });
    }
}
exports.CategoryService = CategoryService;
//# sourceMappingURL=category.service.js.map