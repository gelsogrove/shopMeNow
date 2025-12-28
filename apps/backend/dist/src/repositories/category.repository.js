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
exports.CategoryRepository = void 0;
const category_entity_1 = require("../domain/entities/category.entity");
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Implementation of Category Repository using Prisma
 */
class CategoryRepository {
    /**
     * Find all categories in a workspace
     */
    findAll(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const categories = yield prisma_1.prisma.categories.findMany({
                    where: {
                        workspaceId,
                        isActive: true
                    },
                    orderBy: {
                        name: 'asc'
                    }
                });
                return categories ? categories.map(category => new category_entity_1.Category(category)) : [];
            }
            catch (error) {
                logger_1.default.error("Error finding categories:", error);
                return [];
            }
        });
    }
    /**
     * Find a single category by ID and workspace
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const category = yield prisma_1.prisma.categories.findFirst({
                    where: {
                        id,
                        workspaceId
                    }
                });
                return category ? new category_entity_1.Category(category) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding category ${id}:`, error);
                return null;
            }
        });
    }
    /**
     * Find a category by slug within a workspace
     */
    findBySlug(slug, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const category = yield prisma_1.prisma.categories.findFirst({
                    where: {
                        slug,
                        workspaceId
                    }
                });
                return category ? new category_entity_1.Category(category) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding category by slug ${slug}:`, error);
                return null;
            }
        });
    }
    /**
     * Create a new category
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const category = yield prisma_1.prisma.categories.create({
                    data: data
                });
                return new category_entity_1.Category(category);
            }
            catch (error) {
                logger_1.default.error("Error creating category:", error);
                throw error;
            }
        });
    }
    /**
     * Update an existing category
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.categories.updateMany({
                    where: {
                        id,
                        workspaceId
                    },
                    data: data
                });
                // Get updated category
                return this.findById(id, workspaceId);
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
                const result = yield prisma_1.prisma.categories.deleteMany({
                    where: {
                        id,
                        workspaceId
                    }
                });
                return result && result.count > 0;
            }
            catch (error) {
                logger_1.default.error(`Error deleting category ${id}:`, error);
                return false;
            }
        });
    }
    /**
     * Check if a category has associated products
     */
    hasProducts(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const products = yield prisma_1.prisma.products.findMany({
                    where: {
                        categoryId: id,
                        workspaceId
                    },
                    take: 1
                });
                return products.length > 0;
            }
            catch (error) {
                logger_1.default.error(`Error checking products for category ${id}:`, error);
                return false;
            }
        });
    }
}
exports.CategoryRepository = CategoryRepository;
//# sourceMappingURL=category.repository.js.map