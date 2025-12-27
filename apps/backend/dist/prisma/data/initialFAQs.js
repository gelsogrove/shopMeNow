"use strict";
// Initial FAQs created automatically when a new workspace/channel is created.
// Only essential FAQs are included - owners can add more later.
// IMPORTANT: All FAQs are in ENGLISH (database base language)
// The Translation Agent will translate to customer's language (it/es/pt)
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialFAQs = void 0;
/**
 * Initial FAQs created automatically when a new workspace/channel is created.
 * Only 4 essential FAQs are included - owners can add more from the admin panel.
 */
const initialFAQs = (workspaceId) => [
    {
        workspaceId,
        question: "How is my privacy protected?",
        answer: 'Your privacy is fundamental:\n✅ Data encrypted with SSL\n✅ GDPR compliant\n✅ No data sharing with third parties\n✅ Right to access, modify, delete data\n\nWrite "privacy policy" to read the complete document.',
        keywords: [
            "privacy",
            "gdpr",
            "data protection",
            "personal data",
            "security",
            "data privacy",
        ],
        category: "Account",
        order: 0,
        isActive: true,
    },
    {
        workspaceId,
        question: "What are the delivery times?",
        answer: "Standard delivery times are:\n- Metropolitan area: 24-48 hours\n- Region: 2-3 business days\n- Rest of country: 3-5 business days\n\nOrders confirmed before 2:00 PM ship the same day!",
        keywords: [
            "delivery time",
            "when arrives",
            "arrival",
            "delivery",
            "shipping time",
        ],
        category: "Shipping",
        order: 1,
        isActive: true,
    },
    {
        workspaceId,
        question: "How can I repeat a previous order?",
        answer: 'You can easily repeat a previous order! Write "repeat last order" or "repeat order #[code]". I will show you the details and you can confirm.',
        keywords: ["repeat order", "same order", "reorder", "order again"],
        category: "Orders",
        order: 2,
        isActive: true,
    },
    {
        workspaceId,
        question: "What payment methods do you accept?",
        answer: "We accept:\n✅ Credit cards (Visa, Mastercard, Amex)\n✅ Bank transfer (for business orders)\n✅ PayPal\n✅ Cash on delivery (+€3.00)\n\nPayment is secure and protected with SSL encryption.",
        keywords: [
            "payment",
            "pay",
            "card",
            "bank transfer",
            "paypal",
            "cash on delivery",
            "payment methods",
        ],
        category: "Payments",
        order: 3,
        isActive: true,
    },
];
exports.initialFAQs = initialFAQs;
//# sourceMappingURL=initialFAQs.js.map