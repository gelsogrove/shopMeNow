"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Category = void 0;
/**
 * Category Entity
 * Represents a product category in the domain
 */
class Category {
    constructor(props) {
        Object.assign(this, props);
    }
    /**
     * Generate a URL-friendly slug from the category name
     */
    generateSlug() {
        return this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }
    /**
     * Validate category
     */
    validate() {
        // Basic validation
        if (!this.name || this.name.trim() === '') {
            return false;
        }
        if (!this.workspaceId) {
            return false;
        }
        return true;
    }
    /**
     * Check if category is active
     */
    isActiveCategory() {
        return this.isActive;
    }
}
exports.Category = Category;
//# sourceMappingURL=category.entity.js.map