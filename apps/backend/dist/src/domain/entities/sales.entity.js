"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sales = void 0;
/**
 * Sales Entity
 * Represents a salesperson in the domain
 */
class Sales {
    constructor(props) {
        Object.assign(this, props);
    }
    /**
     * Get full name
     */
    getFullName() {
        return `${this.firstName} ${this.lastName}`;
    }
    /**
     * Validate sales
     */
    validate() {
        // Basic validation
        if (!this.firstName || this.firstName.trim() === "") {
            return false;
        }
        if (!this.lastName || this.lastName.trim() === "") {
            return false;
        }
        if (!this.email || this.email.trim() === "") {
            return false;
        }
        if (!this.workspaceId) {
            return false;
        }
        return true;
    }
    /**
     * Check if sales is active
     */
    isActiveSales() {
        return this.isActive;
    }
}
exports.Sales = Sales;
//# sourceMappingURL=sales.entity.js.map