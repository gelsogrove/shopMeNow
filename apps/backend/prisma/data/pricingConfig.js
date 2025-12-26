"use strict";
/**
 * Pricing Configuration Data
 *
 * SINGLE SOURCE OF TRUTH for all pricing in the application.
 * Values come from BillingPrices enum.
 * Change values in enum and both BE + FE will update automatically.
 *
 * Historical billing records preserve the price at transaction time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingConfigData = void 0;
const billing_prices_enum_1 = require("../../src/domain/enums/billing-prices.enum");
exports.pricingConfigData = [
    // ============================================================================
    // MONTHLY SUBSCRIPTION PLANS
    // ============================================================================
    {
        type: "PLAN",
        key: "FREE_MONTHLY",
        value: billing_prices_enum_1.BillingPrices.FREE_MONTHLY,
        description: "Free plan - €0/month for 14 days trial with €19 credit included",
        isActive: true,
    },
    {
        type: "PLAN",
        key: "BASIC_MONTHLY",
        value: billing_prices_enum_1.BillingPrices.BASIC_MONTHLY,
        description: "Basic plan - €19/month for growing businesses",
        isActive: true,
    },
    {
        type: "PLAN",
        key: "PREMIUM_MONTHLY",
        value: billing_prices_enum_1.BillingPrices.PREMIUM_MONTHLY,
        description: "Premium plan - €49/month for established businesses",
        isActive: true,
    },
    {
        type: "PLAN",
        key: "ENTERPRISE_MONTHLY",
        value: billing_prices_enum_1.BillingPrices.ENTERPRISE_MONTHLY,
        description: "Enterprise plan - €299/month for large scale operations",
        isActive: true,
    },
    {
        type: "PLAN",
        key: "MONTHLY_CHANNEL_COST",
        value: billing_prices_enum_1.BillingPrices.MONTHLY_CHANNEL_COST,
        description: "Monthly WhatsApp channel cost (included in all paid plans)",
        isActive: true,
    },
    // ============================================================================
    // USAGE-BASED PRICING (Pay-per-use)
    // ============================================================================
    {
        type: "USAGE",
        key: "MESSAGE",
        value: billing_prices_enum_1.BillingPrices.MESSAGE,
        description: "Cost per message (AI-powered responses, including support conversations)",
        isActive: true,
    },
    {
        type: "USAGE",
        key: "WELCOME_MESSAGE",
        value: billing_prices_enum_1.BillingPrices.WELCOME_MESSAGE,
        description: "Cost per new customer registration (welcome message)",
        isActive: true,
    },
    {
        type: "USAGE",
        key: "PUSH_CAMPAIGN",
        value: billing_prices_enum_1.BillingPrices.PUSH_CAMPAIGN,
        description: "Cost per push notification sent (promotional messages)",
        isActive: true,
    },
    // ============================================================================
    // FREE TIER THRESHOLDS (Limits)
    // ============================================================================
    {
        type: "THRESHOLD",
        key: "FREE_MESSAGES",
        value: 200,
        description: "Free messages included in trial (after this, €0.15/message)",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "FREE_PRODUCTS",
        value: 50,
        description: "Maximum products for Free plan",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "FREE_CLIENTS",
        value: 50,
        description: "Maximum clients for Free plan",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "BASIC_PRODUCTS",
        value: 50,
        description: "Maximum products for Basic plan",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "BASIC_CLIENTS",
        value: 50,
        description: "Maximum clients for Basic plan",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "PREMIUM_PRODUCTS",
        value: 100,
        description: "Maximum products for Premium plan",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "PREMIUM_CLIENTS",
        value: 100,
        description: "Maximum clients for Premium plan",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "ENTERPRISE_PRODUCTS",
        value: 999999,
        description: "Unlimited products for Enterprise plan",
        isActive: true,
    },
    {
        type: "THRESHOLD",
        key: "ENTERPRISE_CLIENTS",
        value: 999999,
        description: "Unlimited clients for Enterprise plan",
        isActive: true,
    },
];
//# sourceMappingURL=pricingConfig.js.map