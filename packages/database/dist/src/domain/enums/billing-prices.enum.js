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
    // 📱 MESSAGE COSTS
    BillingPrices[BillingPrices["MESSAGE"] = 0.1] = "MESSAGE";
    BillingPrices[BillingPrices["WELCOME_MESSAGE"] = 1] = "WELCOME_MESSAGE";
    // 📤 PUSH MESSAGING COSTS
    BillingPrices[BillingPrices["PUSH_CHATBOT_REACTIVATED"] = 0.2] = "PUSH_CHATBOT_REACTIVATED";
    BillingPrices[BillingPrices["PUSH_DISCOUNT_NOTIFICATION"] = 0.2] = "PUSH_DISCOUNT_NOTIFICATION";
    BillingPrices[BillingPrices["PUSH_ORDER_CONFIRMED"] = 0] = "PUSH_ORDER_CONFIRMED";
    BillingPrices[BillingPrices["PUSH_CAMPAIGN"] = 1] = "PUSH_CAMPAIGN";
    BillingPrices[BillingPrices["PUSH_DEFAULT"] = 0.2] = "PUSH_DEFAULT";
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
    // Messages
    MESSAGE: {
        name: "LLM Message",
        description: "AI chatbot conversational response",
        category: "Messages",
    },
    WELCOME_MESSAGE: {
        name: "Welcome Message",
        description: "First message to new user (includes registration)",
        category: "Messages",
    },
    // Push Messaging
    PUSH_CHATBOT_REACTIVATED: {
        name: "Chatbot Reactivated",
        description: "Notification when admin enables chatbot",
        category: "Push Messaging",
    },
    PUSH_DISCOUNT_NOTIFICATION: {
        name: "Discount Notification",
        description: "Customer discount update (FREE)",
        category: "Push Messaging",
    },
    PUSH_ORDER_CONFIRMED: {
        name: "Order Confirmed",
        description: "Order confirmation push (FREE)",
        category: "Push Messaging",
    },
    PUSH_CAMPAIGN: {
        name: "Campaign Message",
        description: "Marketing campaign push message",
        category: "Push Messaging",
    },
    PUSH_DEFAULT: {
        name: "Default Push",
        description: "Default push notification cost",
        category: "Push Messaging",
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
