"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Offer = void 0;
/**
 * Offer Entity
 * Represents an offer in the domain
 */
class Offer {
    constructor(props) {
        Object.assign(this, props);
    }
    /**
     * Check if the offer is currently active
     */
    isCurrentlyActive() {
        const now = new Date();
        return (this.isActive &&
            this.startDate <= now &&
            this.endDate >= now);
    }
    /**
     * Calculate discounted price
     */
    calculateDiscountedPrice(originalPrice) {
        if (!this.isCurrentlyActive()) {
            return originalPrice;
        }
        const discount = originalPrice * (this.discountPercent / 100);
        return originalPrice - discount;
    }
    /**
     * Validate offer
     */
    validate() {
        // Basic validation
        if (!this.name || this.name.trim() === '') {
            return false;
        }
        if (this.discountPercent < 0 || this.discountPercent > 100) {
            return false;
        }
        if (this.startDate > this.endDate) {
            return false;
        }
        return true;
    }
    /**
     * Get the status of the offer
     */
    getStatus() {
        const now = new Date();
        if (!this.isActive) {
            return 'inactive';
        }
        if (this.startDate <= now && this.endDate >= now) {
            return 'active';
        }
        if (this.startDate > now) {
            return 'scheduled';
        }
        return 'expired';
    }
}
exports.Offer = Offer;
//# sourceMappingURL=offer.entity.js.map