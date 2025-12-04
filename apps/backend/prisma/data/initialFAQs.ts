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
 * Only 5 essential FAQs are included - owners can add more from the admin panel.
 */
export const initialFAQs = (
  workspaceId: string
): Array<InitialFAQ & { workspaceId: string }> => [
  {
    workspaceId,
    question: "Who are you?",
    answer:
      "Hello {{nameUser}}! 👋 I'm {{channelName}} virtual assistant, ready to assist you with everything! I can help you find products, check your order status, or show you today's best deals. You can also sort the catalogue, place orders, download invoices, and resolve any issues.\n\nFor example:\n\n- Do you have Mozzarella?\n\n- Where is my order?\n\n- Give the invoice of my last order please\n\n- Repeat my last order\n\n- I am looking fresh products\n\n- I want to talk with a human operator\n\nHow can I help you today?",
    keywords: [
      "who are you",
      "what are you",
      "assistant",
      "help",
      "what can you do",
      "introduce",
      "hello",
      "hi",
    ],
    category: "General",
    order: 0,
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
    order: 1,
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
    order: 2,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I repeat a previous order?",
    answer:
      'You can easily repeat a previous order! Write "repeat last order" or "repeat order #[code]". I will show you the details and you can confirm.',
    keywords: ["repeat order", "same order", "reorder", "order again"],
    category: "Orders",
    order: 3,
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
    order: 4,
    isActive: true,
  },
]
