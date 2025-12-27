"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Customer = void 0;
const uuid_1 = require("uuid");
/**
 * Customer Entity
 * Represents a customer in the domain
 */
class Customer {
    constructor(props) {
        this.id = props.id || (0, uuid_1.v4)();
        this.name = props.name;
        this.email = props.email;
        this.phone = props.phone;
        this.address = props.address;
        this.company = props.company;
        this.discount = props.discount || 0;
        this.language = props.language || "ENG";
        this.currency = props.currency || "EUR";
        this.notes = props.notes;
        this.serviceIds = props.serviceIds || [];
        this.isBlacklisted = props.isBlacklisted || false;
        this.isActive = props.isActive !== undefined ? props.isActive : true;
        this.workspaceId = props.workspaceId;
        this.last_privacy_version_accepted = props.last_privacy_version_accepted;
        this.privacy_accepted_at = props.privacy_accepted_at;
        this.push_notifications_consent = props.push_notifications_consent || false;
        this.push_notifications_consent_at = props.push_notifications_consent_at;
        this.createdAt = props.createdAt || new Date();
        this.updatedAt = props.updatedAt || new Date();
        this.activeChatbot =
            props.activeChatbot !== undefined ? props.activeChatbot : true;
        this.invoiceAddress = props.invoiceAddress;
        this.salesId = props.salesId;
        this.feedbacks = props.feedbacks || [];
    }
    /**
     * Validate customer data
     */
    validate() {
        if (!this.name || this.name.trim() === "") {
            return false;
        }
        if (!this.email || !this.isValidEmail(this.email)) {
            return false;
        }
        if (!this.workspaceId) {
            return false;
        }
        return true;
    }
    /**
     * Check if customer is active
     */
    isActiveCustomer() {
        return this.isActive;
    }
    /**
     * Check if customer has active chatbot
     */
    hasChatbotEnabled() {
        return this.activeChatbot;
    }
    /**
     * Check if customer has accepted privacy policy
     */
    hasAcceptedPrivacy() {
        return !!this.last_privacy_version_accepted && !!this.privacy_accepted_at;
    }
    /**
     * Check if email is valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}
exports.Customer = Customer;
//# sourceMappingURL=customer.entity.js.map