"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAQ = void 0;
/**
 * FAQ Entity
 * Represents a frequently asked question in the domain
 */
class FAQ {
    constructor(props) {
        Object.assign(this, props);
    }
    /**
     * Validate FAQ
     */
    validate() {
        // Basic validation
        if (!this.question || this.question.trim() === '') {
            return false;
        }
        if (!this.answer || this.answer.trim() === '') {
            return false;
        }
        if (!this.workspaceId) {
            return false;
        }
        return true;
    }
    /**
     * Check if FAQ is active
     */
    isActiveFAQ() {
        return this.isActive;
    }
}
exports.FAQ = FAQ;
//# sourceMappingURL=faq.entity.js.map