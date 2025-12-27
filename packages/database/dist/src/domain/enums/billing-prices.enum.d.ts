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
export declare enum BillingPrices {
    MESSAGE = 0.1,// €0.10 - LLM chatbot message (conversational)
    WELCOME_MESSAGE = 1,// €1.00 - First message to new user (includes registration)
    PUSH_CHATBOT_REACTIVATED = 0.2,// €0.20 - When admin enables chatbot for customer
    PUSH_DISCOUNT_NOTIFICATION = 0.2,// €0.00 - FREE - Discount update notification
    PUSH_ORDER_CONFIRMED = 0,// €0.00 - FREE - Order confirmation
    PUSH_CAMPAIGN = 1,// €1.00 - Marketing campaign message
    PUSH_DEFAULT = 0.2,// €0.20 - Default for other push notifications
    MONTHLY_CHANNEL_COST = 49,// €49.00 - Per WhatsApp channel/month (same as Premium)
    FREE_MONTHLY = 0,// €0.00 - Free plan
    BASIC_MONTHLY = 19,// €19.00 - Basic plan
    PREMIUM_MONTHLY = 49,// €49.00 - Premium plan
    ENTERPRISE_MONTHLY = 149
}
/**
 * 📊 BILLING PRICES METADATA
 * Human-readable descriptions for each price type
 */
export declare const BillingPricesMetadata: Record<keyof typeof BillingPrices, {
    name: string;
    description: string;
    category: string;
}>;
/**
 * 🔍 Helper function to get price by key
 */
export declare function getBillingPrice(key: keyof typeof BillingPrices): number;
/**
 * 📋 Get all prices as object (for API response)
 */
export declare function getAllBillingPrices(): Record<string, number>;
/**
 * 📊 Get all prices with metadata (for admin UI)
 */
export declare function getAllBillingPricesWithMetadata(): {
    key: string;
    value: number;
    name: string;
    description: string;
    category: string;
}[];
