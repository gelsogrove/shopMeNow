"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const database_1 = require("@echatbot/database");
class Product {
    constructor(data) {
        var _a;
        this.id = data.id || "";
        this.name = data.name || "";
        this.sku = data.sku || null; // Fixed: was Sku
        this.description = data.description || null;
        this.formato = data.formato || null;
        this.price = data.price || 0;
        this.stock = data.stock || 0;
        this.status = data.status || database_1.ProductStatus.ACTIVE;
        this.isActive = (_a = data.isActive) !== null && _a !== void 0 ? _a : true;
        this.slug = data.slug || "";
        this.categoryId = data.categoryId || null;
        this.supplierId = data.supplierId || null;
        this.workspaceId = data.workspaceId || "";
        this.imageUrl = data.imageUrl || [];
        this.imageKey = data.imageKey || null;
        this.certifications = data.certifications || [];
        this.transportType = data.transportType || "Temperatura ambiente";
        this.region = data.region || null; // ✅ Feature 123 - Geographic region
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.category = data.category;
        this.originalPrice = data.originalPrice;
        this.hasDiscount = data.hasDiscount;
        this.discountPercent = data.discountPercent;
        this.discountSource = data.discountSource;
    }
    isInStock() {
        return this.stock > 0;
    }
    applyDiscount(percentage, source) {
        if (percentage <= 0)
            return this;
        const originalPrice = this.price;
        const discountedPrice = originalPrice * (1 - percentage / 100);
        return new Product(Object.assign(Object.assign({}, this), { originalPrice: originalPrice, price: discountedPrice, hasDiscount: true, discountPercent: percentage, discountSource: source }));
    }
    updateStock(quantity) {
        return new Product(Object.assign(Object.assign({}, this), { stock: Math.max(0, quantity), updatedAt: new Date() }));
    }
    updateStatus(status) {
        return new Product(Object.assign(Object.assign({}, this), { status, updatedAt: new Date() }));
    }
}
exports.Product = Product;
//# sourceMappingURL=product.entity.js.map