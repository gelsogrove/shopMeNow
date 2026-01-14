// Initial FAQs created automatically when a new workspace/channel is created.
// Only essential FAQs are included - owners can add more later.
// IMPORTANT: All FAQs are in ENGLISH (database base language)
// The Translation Agent will translate to customer's language (it/es/pt)

interface InitialFAQ {
  question: string
  answer: string
  keywords: string[]
  category: string
  order: number
  isActive: boolean
}

/**
 * Initial FAQs created automatically when a new workspace/channel is created.
 * Only 4 essential FAQs are included - owners can add more from the admin panel.
 */
export const initialFAQs = (
  workspaceId: string
): Array<InitialFAQ & { workspaceId: string }> => [
  {
    workspaceId,
    question: "How is my privacy protected?",
    answer:
      'Your privacy is fundamental:\n✅ Data encrypted with SSL\n✅ GDPR compliant\n✅ No data sharing with third parties\n✅ Right to access, modify, delete data\n\nWrite "privacy policy" to read the complete document.',
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
    answer:
      "Standard delivery times are:\n- Metropolitan area: 24-48 hours\n- Region: 2-3 business days\n- Rest of country: 3-5 business days\n\nOrders confirmed before 2:00 PM ship the same day!",
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
    answer:
      'You can easily repeat a previous order! Write "repeat last order" or "repeat order #[code]". I will show you the details and you can confirm.',
    keywords: ["repeat order", "same order", "reorder", "order again"],
    category: "Orders",
    order: 2,
    isActive: true,
  },
  {
    workspaceId,
    question: "What payment methods do you accept?",
    answer:
      "We accept:\n✅ Credit cards (Visa, Mastercard, Amex)\n✅ Bank transfer (for business orders)\n✅ PayPal\n✅ Cash on delivery (+€3.00)\n\nPayment is secure and protected with SSL encryption.",
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
  {
    workspaceId,
    question: "What are the costs for using eChatbot messaging?",
    answer:
      "eChatbot messaging costs:\n💬 Messages: $0.10 (10 cents USD) per message sent\n🔔 Push notifications: €1.00 per push notification sent\n\nYou only pay for messages and notifications actually sent. No hidden fees!",
    keywords: [
      "cost",
      "pricing",
      "price",
      "message cost",
      "push cost",
      "fees",
      "charges",
      "how much",
    ],
    category: "Billing",
    order: 4,
    isActive: true,
  },
  {
    workspaceId,
    question: "How am I charged for eChatbot messages?",
    answer:
      "Billing is simple and transparent:\n📊 Per-message charging: Each message costs $0.10 USD\n📊 Per-push charging: Each push notification costs €1.00\n💳 Billing on use: You only pay for what you actually send\n📈 Transparent dashboard: Track all your costs in real-time\n\nMonthly invoices show detailed breakdown of all messages and notifications.",
    keywords: [
      "billing",
      "charged",
      "invoice",
      "cost structure",
      "pricing",
      "how charged",
      "payment",
    ],
    category: "Billing",
    order: 5,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I contact a sales agent directly?",
    answer:
      "If your team has a dedicated sales agent assigned to you, you can contact them directly! 👤\n\nWrite:\n- \"contact sales agent\"\n- \"speak with my agent\"\n- \"my dedicated agent\"\n\nYour support message will be routed directly to your assigned sales agent who will respond personally.",
    keywords: [
      "agent",
      "sales agent",
      "contact agent",
      "dedicated agent",
      "speak agent",
      "support team",
      "sales team",
    ],
    category: "Support",
    order: 6,
    isActive: true,
  },
  {
    workspaceId,
    question: "How do I set up WhatsApp integration with eChatbot?",
    answer:
      "To connect WhatsApp with eChatbot, you need:\n\n1️⃣ Facebook Business Account (create at https://business.facebook.com)\n2️⃣ Enable WhatsApp Channel in Facebook App Manager\n3️⃣ Get WhatsApp API Key from Meta\n4️⃣ Add API Key to eChatbot settings\n\n📺 Helpful video guide: https://www.youtube.com/watch?v=BsDsc1ZtSs4\n\nOnce configured, your customers can message you directly on WhatsApp!",
    keywords: [
      "whatsapp",
      "integration",
      "setup",
      "configure",
      "api key",
      "meta",
      "facebook",
      "channel",
    ],
    category: "Setup",
    order: 7,
    isActive: true,
  },
  {
    workspaceId,
    question: "What languages does eChatbot support?",
    answer:
      "eChatbot is multilingual! 🌍 The AI automatically understands and responds in:\n\n🇮🇹 Italian (Italiano)\n🇬🇧 English\n🇪🇸 Spanish (Español)\n🇵🇹 Portuguese (Português)\n\nNo configuration needed! Your customers can write in any of these languages and the AI will respond in their language automatically. Perfect for international businesses!",
    keywords: [
      "language",
      "multilingual",
      "italian",
      "english",
      "spanish",
      "portuguese",
      "translate",
      "international",
    ],
    category: "Features",
    order: 8,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can eChatbot integrate with my CRM?",
    answer:
      "Yes! eChatbot offers custom CRM integration 🔗\n\nConnect your:\n✅ Customer data & profiles\n✅ Order history\n✅ Real-time event triggers\n✅ Carrier APIs for shipping tracking\n\nEvery response is grounded in YOUR data. Sync customer profiles, pull order history, and trigger workflows automatically.\n\n📧 Contact support for a quote: Integration available upon request",
    keywords: [
      "crm",
      "integration",
      "salesforce",
      "hubspot",
      "customer data",
      "api",
      "connect",
      "sync",
    ],
    category: "Integration",
    order: 9,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can eChatbot track shipments in real-time?",
    answer:
      "Yes! With CRM integration, eChatbot can connect to your carrier's API 🚚\n\nFeatures:\n✅ Real-time shipment tracking\n✅ Automatic status updates\n✅ Delivery predictions\n✅ Customer notifications\n\nYour customers ask \"where is my order?\" and the chatbot pulls live tracking data from your carrier.\n\n📧 Contact us for setup: Custom carrier integration available",
    keywords: [
      "tracking",
      "shipment",
      "carrier",
      "delivery",
      "real-time",
      "logistics",
      "order tracking",
    ],
    category: "Integration",
    order: 10,
    isActive: true,
  },
  {
    workspaceId,
    question: "What is Privacy by Design in eChatbot?",
    answer:
      "Your data privacy is built into everything we do 🔒\n\n✅ NO sensitive data sent to AI models\n✅ NO data sharing with third parties\n✅ Scoped tokens: Each interaction has minimum required access\n✅ Encrypted in transit: All data protected with industry-standard encryption\n✅ Your control: Customer data stays under YOUR control at all times\n\nWe believe privacy isn't an afterthought—it's the foundation. Every feature is designed to use the minimum data necessary, and you maintain complete control over your customer information.",
    keywords: [
      "privacy",
      "design",
      "security",
      "data protection",
      "encrypted",
      "tokens",
      "third party",
      "ai models",
      "customer data",
    ],
    category: "Features",
    order: 11,
    isActive: true,
  },

  // ====================================================================
  // CATEGORY: Campaigns (8 FAQs) - Push notifications and campaigns
  // ====================================================================
  {
    workspaceId,
    question: "How much does it cost to send a push notification?",
    answer:
      "Push notifications cost $1.00 per message. This is a simple and transparent pricing model that allows you to reach your customers directly with targeted messages and promotions.",
    keywords: [
      "cost",
      "price",
      "push",
      "notification",
      "campaign",
      "send",
      "dollar",
    ],
    category: "Campaigns",
    order: 12,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I schedule push notifications?",
    answer:
      "Yes! You can schedule push notifications to be sent at specific times and dates. This allows you to plan your campaigns in advance and reach customers when they are most likely to engage. You can also set up recurring campaigns for regular reminders and promotions.",
    keywords: [
      "schedule",
      "push",
      "notification",
      "campaign",
      "time",
      "date",
      "recurring",
      "plan",
    ],
    category: "Campaigns",
    order: 13,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I use AI to understand what message to send in a push?",
    answer:
      "With the Enterprise version, we can analyze your data together to determine the best campaign strategy. Our AI analyzes customer behavior, preferences, and engagement patterns to recommend optimal message content, timing, and target segments for maximum impact.",
    keywords: [
      "ai",
      "artificial intelligence",
      "push",
      "message",
      "strategy",
      "campaign",
      "enterprise",
      "analyze",
    ],
    category: "Campaigns",
    order: 14,
    isActive: true,
  },
  {
    workspaceId,
    question: "Where can I get product availability information?",
    answer:
      "With the Enterprise version, we can connect to external services to retrieve real-time product availability information. This integration allows us to keep your campaigns accurate by showing up-to-date stock levels, delivery dates, and inventory status directly from your systems.",
    keywords: [
      "availability",
      "product",
      "stock",
      "inventory",
      "external",
      "service",
      "enterprise",
      "real-time",
    ],
    category: "Campaigns",
    order: 15,
    isActive: true,
  },
  {
    workspaceId,
    question: "How many people can collaborate on campaigns?",
    answer:
      "The workspace is shared with users who have received an invitation. All team members with workspace access can view and collaborate on campaigns together. You can invite as many team members as you need, and everyone will have visibility into campaign performance and customer engagement.",
    keywords: [
      "collaborate",
      "collaboration",
      "team",
      "workspace",
      "users",
      "invite",
      "members",
      "share",
    ],
    category: "Campaigns",
    order: 16,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I block a user from receiving campaigns?",
    answer:
      "Yes, you can block users if needed. If a customer sends spam or requests to stop receiving messages, you can block them. Blocked users will not receive any further campaigns or communications from your business.",
    keywords: [
      "block",
      "user",
      "customer",
      "spam",
      "unsubscribe",
      "stop",
      "campaign",
      "message",
    ],
    category: "Campaigns",
    order: 17,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I intervene in the chat during a campaign?",
    answer:
      "Yes, absolutely! You can take over the chat at any moment and intervene directly. Simply turn off the chatbot and start conversing with the customer personally. This allows you to provide personal support, handle special requests, or resolve issues in real-time.",
    keywords: [
      "intervene",
      "chat",
      "take over",
      "control",
      "chatbot",
      "manual",
      "personal",
      "support",
    ],
    category: "Campaigns",
    order: 18,
    isActive: true,
  },
  {
    workspaceId,
    question: "Are there statistics for campaigns?",
    answer:
      "Yes! We provide detailed statistics for every channel. You can view:\n✅ Message delivery rates\n✅ Customer engagement metrics\n✅ Click-through rates\n✅ Conversion data\n✅ Performance by channel (WhatsApp, Widget, etc.)\n✅ Customer response analysis\n\nUse these insights to optimize your campaigns and improve results.",
    keywords: [
      "statistics",
      "stats",
      "metrics",
      "analytics",
      "campaign",
      "performance",
      "channel",
      "data",
    ],
    category: "Campaigns",
    order: 19,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I use the widget for web and WhatsApp at the same time?",
    answer:
      "Yes! That's exactly the purpose of eChatbot. You can deploy the widget on your website and also maintain your WhatsApp business number, using both channels simultaneously. Customers can choose their preferred way to communicate, and all conversations are unified in your workspace for a seamless experience.",
    keywords: [
      "widget",
      "web",
      "whatsapp",
      "together",
      "simultaneous",
      "channel",
      "both",
      "communication",
    ],
    category: "Campaigns",
    order: 20,
    isActive: true,
  },
]
