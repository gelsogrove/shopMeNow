"use strict";
/**
 * 💰 BILLING PRICES - SINGLE SOURCE OF TRUTH
 *
 * ⚠️ CRITICAL: This is the ONLY place where pricing is defined
 * All backend services and frontend components MUST use these values
 *
 * To change pricing: Update values here, restart backend, frontend will auto-sync via API
 *
 * @author Andrea Gelso
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingPricesMetadata = exports.BillingPrices = void 0;
exports.getBillingPrice = getBillingPrice;
exports.getAllBillingPrices = getAllBillingPrices;
exports.getAllBillingPricesWithMetadata = getAllBillingPricesWithMetadata;
var BillingPrices;
(function (BillingPrices) {
    // 📱 MESSAGE COSTS - Only 2 types!
    BillingPrices[BillingPrices["MESSAGE"] = 0.1] = "MESSAGE";
    BillingPrices[BillingPrices["PUSH_CAMPAIGN"] = 1] = "PUSH_CAMPAIGN";
    // 🏢 SUBSCRIPTION PLANS (Monthly)
    BillingPrices[BillingPrices["MONTHLY_CHANNEL_COST"] = 49] = "MONTHLY_CHANNEL_COST";
    BillingPrices[BillingPrices["FREE_MONTHLY"] = 0] = "FREE_MONTHLY";
    BillingPrices[BillingPrices["BASIC_MONTHLY"] = 19] = "BASIC_MONTHLY";
    BillingPrices[BillingPrices["PREMIUM_MONTHLY"] = 49] = "PREMIUM_MONTHLY";
    BillingPrices[BillingPrices["ENTERPRISE_MONTHLY"] = 149] = "ENTERPRISE_MONTHLY";
})(BillingPrices || (exports.BillingPrices = BillingPrices = {}));
/**
 * 📊 BILLING PRICES METADATA
 * Human-readable descriptions for each price type
 */
exports.BillingPricesMetadata = {
    // Only 2 usage-based prices!
    MESSAGE: {
        name: "Message",
        description: "Cost per message (AI-powered responses)",
        category: "Usage",
    },
    PUSH_CAMPAIGN: {
        name: "Push Notification",
        description: "Cost per push notification sent (all types)",
        category: "Usage",
    },
    // Subscription Plans
    MONTHLY_CHANNEL_COST: {
        name: "Monthly Channel",
        description: "Per WhatsApp channel monthly cost",
        category: "Subscription",
    },
    FREE_MONTHLY: {
        name: "Free Plan",
        description: "Free tier monthly cost",
        category: "Subscription",
    },
    BASIC_MONTHLY: {
        name: "Basic Plan",
        description: "Basic tier monthly cost",
        category: "Subscription",
    },
    PREMIUM_MONTHLY: {
        name: "Premium Plan",
        description: "Premium tier monthly cost",
        category: "Subscription",
    },
    ENTERPRISE_MONTHLY: {
        name: "Enterprise Plan",
        description: "Enterprise tier monthly cost",
        category: "Subscription",
    },
};
/**
 * 🔍 Helper function to get price by key
 */
function getBillingPrice(key) {
    return BillingPrices[key];
}
/**
 * 📋 Get all prices as object (for API response)
 */
function getAllBillingPrices() {
    const prices = {};
    for (const key in BillingPrices) {
        if (typeof BillingPrices[key] === "number") {
            prices[key] = BillingPrices[key];
        }
    }
    return prices;
}
/**
 * 📊 Get all prices with metadata (for admin UI)
 */
function getAllBillingPricesWithMetadata() {
    const pricesWithMeta = [];
    for (const key in BillingPrices) {
        if (typeof BillingPrices[key] === "number") {
            const metadata = exports.BillingPricesMetadata[key];
            pricesWithMeta.push({
                key,
                value: BillingPrices[key],
                name: metadata.name,
                description: metadata.description,
                category: metadata.category,
            });
        }
    }
    return pricesWithMeta;
}
//# sourceMappingURL=billing-prices.enum.js.map