"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const database_1 = require("@echatbot/database");
class Order {
    constructor(data) {
        this.id = data.id || '';
        this.orderCode = data.orderCode || this.generateOrderCode();
        this.customerId = data.customerId || '';
        this.workspaceId = data.workspaceId || '';
        this.status = data.status || database_1.OrderStatus.PENDING;
        this.paymentMethod = data.paymentMethod || null;
        this.totalAmount = data.totalAmount || 0;
        this.shippingAmount = data.shippingAmount || 0;
        this.taxAmount = data.taxAmount || 0;
        this.shippingAddress = data.shippingAddress || null;
        this.billingAddress = data.billingAddress || null;
        this.notes = data.notes || null;
        this.discountCode = data.discountCode || null;
        this.discountAmount = data.discountAmount || 0;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.customer = data.customer;
        this.items = data.items || [];
        this.trackingNumber = data.trackingNumber || null;
    }
    generateOrderCode() {
        // Generate 5 random uppercase letters
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let orderCode = '';
        for (let i = 0; i < 5; i++) {
            orderCode += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return orderCode;
    }
    getTotalItemsCount() {
        var _a;
        return ((_a = this.items) === null || _a === void 0 ? void 0 : _a.reduce((sum, item) => sum + item.quantity, 0)) || 0;
    }
    getSubtotal() {
        return this.totalAmount - this.shippingAmount - this.taxAmount + this.discountAmount;
    }
    updateStatus(status) {
        return new Order(Object.assign(Object.assign({}, this), { status, updatedAt: new Date() }));
    }
    calculateTotalAmount() {
        var _a;
        const itemsTotal = ((_a = this.items) === null || _a === void 0 ? void 0 : _a.reduce((sum, item) => sum + item.totalPrice, 0)) || 0;
        return itemsTotal + this.shippingAmount + this.taxAmount - this.discountAmount;
    }
    canBeCancelled() {
        return this.status === database_1.OrderStatus.PENDING || this.status === database_1.OrderStatus.CONFIRMED;
    }
    isComplete() {
        return this.status === database_1.OrderStatus.DELIVERED;
    }
    // Helper methods for services
    hasServices() {
        var _a;
        return ((_a = this.items) === null || _a === void 0 ? void 0 : _a.some(item => item.itemType === database_1.ItemType.SERVICE)) || false;
    }
    hasProducts() {
        var _a;
        return ((_a = this.items) === null || _a === void 0 ? void 0 : _a.some(item => item.itemType === database_1.ItemType.PRODUCT)) || false;
    }
    getServices() {
        var _a;
        return ((_a = this.items) === null || _a === void 0 ? void 0 : _a.filter(item => item.itemType === database_1.ItemType.SERVICE)) || [];
    }
    getProducts() {
        var _a;
        return ((_a = this.items) === null || _a === void 0 ? void 0 : _a.filter(item => item.itemType === database_1.ItemType.PRODUCT)) || [];
    }
}
exports.Order = Order;
//# sourceMappingURL=order.entity.js.map