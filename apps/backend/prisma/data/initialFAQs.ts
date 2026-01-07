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
]
