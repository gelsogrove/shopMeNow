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
]
