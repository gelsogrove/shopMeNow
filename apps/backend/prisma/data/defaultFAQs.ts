// Default FAQs for eChatbot e-commerce platform
// IMPORTANT: All FAQs are in ENGLISH (database base language)
// The Translation Agent will translate to customer's language (it/es/pt)

interface DefaultFAQ {
  question: string
  answer: string
  keywords: string[]
  category: string
  order: number
  isActive: boolean
}

export const defaultFAQs = (
  workspaceId: string
): Array<DefaultFAQ & { workspaceId: string }> => [
  // ====================================================================
  // CATEGORY: Orders (7 FAQs) - Order-related questions
  // ====================================================================
  {
    workspaceId,
    question: "How can I place an order?",
    answer:
      'To place an order:\n1. Search for products with "search [product name]"\n2. Add to cart with "add [quantity] [product]"\n3. View cart with "show cart"\n4. Confirm order with "proceed to checkout"\n\nYou will receive immediate confirmation via WhatsApp!',
    keywords: [
      "order",
      "ordering",
      "how",
      "purchase",
      "buy",
      "checkout",
      "place order",
    ],
    category: "Orders",
    order: 1,
    isActive: true,
  },
  {
    workspaceId,
    question: "I want to place an order",
    answer:
      'Of course! To place an order, tell me which product or service you would like to purchase and I will add it directly to your cart. For example, you can say:\n- "I want cheese"\n- "Add wine to cart"\n- "I need gift wrapping service"\n\nWhat would you like to order?',
    keywords: [
      "want order",
      "place order",
      "make order",
      "new order",
      "create order",
      "order",
      "buy",
      "purchase",
    ],
    category: "Orders",
    order: 2,
    isActive: true,
  },
  {
    workspaceId,
    question: "What is the minimum order amount?",
    answer:
      "The minimum order is €50.00 for standard shipping. For orders below this amount, a €5.00 handling fee applies.",
    keywords: ["minimum order", "minimum", "minimum amount", "min spend"],
    category: "Orders",
    order: 3,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I modify an order after placing it?",
    answer:
      "You can modify an order within 30 minutes of placing it by contacting us immediately. After this time, the order enters processing and can no longer be modified.",
    keywords: ["modify order", "change order", "edit", "update order"],
    category: "Orders",
    order: 4,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I repeat a previous order?",
    answer:
      'You can easily repeat a previous order! Write "repeat last order" or "repeat order #[code]". I will show you the details and you can confirm.',
    keywords: ["repeat order", "same order", "reorder", "order again"],
    category: "Orders",
    order: 5,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I cancel an order?",
    answer:
      'You can cancel an order within 1 hour of placing it if it is still in "Pending confirmation" status. Once confirmed and in processing, cancellation is no longer possible. Contact us for assistance.',
    keywords: ["cancel", "cancel order", "cancellation", "abort", "stop order"],
    category: "Orders",
    order: 6,
    isActive: true,
  },
  {
    workspaceId,
    question: "Will I receive an order confirmation?",
    answer:
      "Yes! You will receive immediate confirmation via WhatsApp with:\n- Order code\n- Product summary\n- Total and payment method\n- Estimated delivery times\n\nYou will also receive updates on preparation and shipping.",
    keywords: ["confirmation", "receipt", "order confirmation", "notification"],
    category: "Orders",
    order: 7,
    isActive: true,
  },

  // ====================================================================
  // CATEGORY: Shipping (4 FAQs) - Shipping and delivery
  // ====================================================================
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
    order: 8,
    isActive: true,
  },
  {
    workspaceId,
    question: "How much does shipping cost?",
    answer:
      "Shipping costs:\n- FREE for orders over €80\n- €7.50 for orders €50-€80\n- €12.50 for orders under €50\n\nRefrigerated shipping included for fresh products!",
    keywords: [
      "shipping cost",
      "delivery cost",
      "how much",
      "shipping price",
      "delivery fee",
    ],
    category: "Shipping",
    order: 9,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I track my order?",
    answer:
      'You can track your order in real-time! Write "where is my order" or "track order #[code]" and I will provide:\n- Current status\n- Courier tracking number\n- Link to follow shipment\n- Delivery estimate',
    keywords: [
      "tracking",
      "track",
      "trace",
      "where is",
      "order status",
      "track order",
    ],
    category: "Shipping",
    order: 10,
    isActive: true,
  },
  {
    workspaceId,
    question: "Do you deliver on Saturdays?",
    answer:
      "Yes! We deliver Monday to Saturday, 8:00 AM - 6:00 PM. We are closed on Sundays. You can request a preferred time slot in the order notes.",
    keywords: [
      "saturday",
      "sunday",
      "weekend",
      "delivery hours",
      "when deliver",
    ],
    category: "Shipping",
    order: 11,
    isActive: true,
  },

  // ====================================================================
  // CATEGORY: Payments (4 FAQs) - Payment methods and invoices
  // ====================================================================
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
    order: 12,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I get an invoice?",
    answer:
      'Certainly! You can request an invoice:\n1. During checkout (provide VAT/Tax ID)\n2. After ordering by writing "invoice order #[code]"\n\nYou will receive the PDF via WhatsApp within 24 hours of the order.',
    keywords: ["invoice", "receipt", "tax receipt", "VAT", "bill"],
    category: "Payments",
    order: 13,
    isActive: true,
  },
  {
    workspaceId,
    question: "When is payment charged?",
    answer:
      "With card/PayPal: immediate charge upon order confirmation.\nWith bank transfer: order confirmed upon payment receipt (send receipt via WhatsApp).\nCash on delivery: payment upon delivery.",
    keywords: ["charge", "when pay", "payment", "charged", "debit"],
    category: "Payments",
    order: 14,
    isActive: true,
  },
  {
    workspaceId,
    question: "Is it safe to pay by card?",
    answer:
      "Absolutely yes! Payments are processed through PCI-DSS certified gateways with SSL/TLS encryption. We never store your card data. All payments are tracked and protected.",
    keywords: [
      "safe",
      "security",
      "protection",
      "ssl",
      "secure card",
      "safe payment",
    ],
    category: "Payments",
    order: 15,
    isActive: true,
  },

  // ====================================================================
  // CATEGORY: Products (4 FAQs) - Product information
  // ====================================================================
  {
    workspaceId,
    question: "Are the products fresh?",
    answer:
      "All our products are very fresh! We work with local producers and goods are shipped within 24 hours of production. We use refrigerated packaging to maintain the cold chain.",
    keywords: ["fresh", "freshness", "quality", "production", "local"],
    category: "Products",
    order: 16,
    isActive: true,
  },
  {
    workspaceId,
    question: "Do you have products for food intolerances?",
    answer:
      'Yes! We have a wide selection of products:\n✅ Gluten-free\n✅ Lactose-free\n✅ Vegetarian\n✅ Vegan\n✅ Halal\n✅ Organic\n\nSearch with filters: "gluten-free products", "vegan", etc.',
    keywords: [
      "intolerance",
      "gluten-free",
      "lactose",
      "vegetarian",
      "vegan",
      "halal",
      "organic",
      "bio",
      "allergy",
    ],
    category: "Products",
    order: 17,
    isActive: true,
  },
  {
    workspaceId,
    question: "How are products packaged?",
    answer:
      "We use:\n- Food-grade packaging\n- Refrigerated containers for fresh products\n- Eco-friendly protective materials\n- Individual wrapping for delicate products\n\nEverything arrives intact and at the right temperature!",
    keywords: [
      "packaging",
      "package",
      "how packaged",
      "protection",
      "container",
    ],
    category: "Products",
    order: 18,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I see product certifications?",
    answer:
      'Yes! Each product has detailed information on:\n- DOP/IGP/STG certifications\n- Organic/Bio certifications\n- Halal certifications\n- Allergen lists\n\nWrite "product details [name]" to see complete information.',
    keywords: [
      "certifications",
      "dop",
      "igp",
      "organic",
      "bio",
      "halal",
      "allergens",
      "ingredients",
    ],
    category: "Products",
    order: 19,
    isActive: true,
  },

  // ====================================================================
  // CATEGORY: Account (3 FAQs) - Account and privacy
  // ====================================================================
  {
    workspaceId,
    question: "How do I register?",
    answer:
      "Registration is automatic! Just start a conversation on WhatsApp and I will guide you. You will need:\n- Name and surname\n- Delivery address\n- Phone number (already have it!)\n\nThat's it, you're registered!",
    keywords: [
      "register",
      "registration",
      "sign up",
      "create account",
      "how register",
    ],
    category: "Account",
    order: 20,
    isActive: true,
  },
  {
    workspaceId,
    question: "How do I change my data?",
    answer:
      'You can update your information anytime by writing:\n- "change address"\n- "update phone number"\n- "modify delivery address"\n\nI will send you a secure link to update your details.',
    keywords: [
      "change",
      "modify",
      "update",
      "data",
      "address",
      "phone",
      "edit profile",
    ],
    category: "Account",
    order: 21,
    isActive: true,
  },
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
    order: 22,
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
    order: 23,
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
    order: 24,
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
    order: 25,
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
    order: 26,
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
    order: 27,
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
    order: 28,
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
    order: 29,
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
    order: 30,
    isActive: true,
  },
]
