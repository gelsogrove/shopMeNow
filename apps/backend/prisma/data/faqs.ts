/**
 * FAQs Data - Auto-generated from database
 * Last updated: 2025-10-30T16:02:52.308Z
 * Seed data for eChatbot
 */

export interface FAQData {
  question: string
  answer: string
  category: string
  language: string
  isActive: boolean
}

export const faqs: FAQData[] = [
  {
    question: "How can I place an order?",
    answer: "To place an order:\n1. Search for products with \"search [product name]\"\n2. Add to cart with \"add [quantity] [product]\"\n3. View cart with \"show cart\"\n4. Confirm order with \"proceed to checkout\"\n\nYou will receive immediate confirmation via WhatsApp!",
    category: "Orders",
    language: null,
    isActive: true,
  },
  {
    question: "What is the minimum order amount?",
    answer: "The minimum order is €50.00 for standard shipping. For orders below this amount, a €5.00 handling fee applies.",
    category: "Orders",
    language: null,
    isActive: true,
  },
  {
    question: "Can I modify an order after placing it?",
    answer: "You can modify an order within 30 minutes of placing it by contacting us immediately. After this time, the order enters processing and can no longer be modified.",
    category: "Orders",
    language: null,
    isActive: true,
  },
  {
    question: "How can I repeat a previous order?",
    answer: "You can easily repeat a previous order! Write \"repeat last order\" or \"repeat order #[code]\". I will show you the details and you can confirm.",
    category: "Orders",
    language: null,
    isActive: true,
  },
  {
    question: "Can I cancel an order?",
    answer: "You can cancel an order within 1 hour of placing it if it is still in \"Pending confirmation\" status. Once confirmed and in processing, cancellation is no longer possible. Contact us for assistance.",
    category: "Orders",
    language: null,
    isActive: true,
  },
  {
    question: "What are the delivery times?",
    answer: "Standard delivery times are:\n- Metropolitan area: 24-48 hours\n- Region: 2-3 business days\n- Rest of country: 3-5 business days\n\nOrders confirmed before 2:00 PM ship the same day!",
    category: "Shipping",
    language: null,
    isActive: true,
  },
  {
    question: "Will I receive an order confirmation?",
    answer: "Yes! You will receive immediate confirmation via WhatsApp with:\n- Order code\n- Product summary\n- Total and payment method\n- Estimated delivery times\n\nYou will also receive updates on preparation and shipping.",
    category: "Orders",
    language: null,
    isActive: true,
  },
  {
    question: "How much does shipping cost?",
    answer: "Shipping costs:\n- FREE for orders over €80\n- €7.50 for orders €50-€80\n- €12.50 for orders under €50\n\nRefrigerated shipping included for fresh products!",
    category: "Shipping",
    language: null,
    isActive: true,
  },
  {
    question: "How can I track my order?",
    answer: "You can track your order in real-time! Write \"where is my order\" or \"track order #[code]\" and I will provide:\n- Current status\n- Courier tracking number\n- Link to follow shipment\n- Delivery estimate",
    category: "Shipping",
    language: null,
    isActive: true,
  },
  {
    question: "Do you deliver on Saturdays?",
    answer: "Yes! We deliver Monday to Saturday, 8:00 AM - 6:00 PM. We are closed on Sundays. You can request a preferred time slot in the order notes.",
    category: "Shipping",
    language: null,
    isActive: true,
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept:\n✅ Credit cards (Visa, Mastercard, Amex)\n✅ Bank transfer (for business orders)\n✅ PayPal\n✅ Cash on delivery (+€3.00)\n\nPayment is secure and protected with SSL encryption.",
    category: "Payments",
    language: null,
    isActive: true,
  },
  {
    question: "Can I get an invoice?",
    answer: "Certainly! You can request an invoice:\n1. During checkout (provide VAT/Tax ID)\n2. After ordering by writing \"invoice order #[code]\"\n\nYou will receive the PDF via WhatsApp within 24 hours of the order.",
    category: "Payments",
    language: null,
    isActive: true,
  },
  {
    question: "When is payment charged?",
    answer: "With card/PayPal: immediate charge upon order confirmation.\nWith bank transfer: order confirmed upon payment receipt (send receipt via WhatsApp).\nCash on delivery: payment upon delivery.",
    category: "Payments",
    language: null,
    isActive: true,
  },
  {
    question: "Is it safe to pay by card?",
    answer: "Absolutely yes! Payments are processed through PCI-DSS certified gateways with SSL/TLS encryption. We never store your card data. All payments are tracked and protected.",
    category: "Payments",
    language: null,
    isActive: true,
  },
  {
    question: "Are the products fresh?",
    answer: "All our products are very fresh! We work with local producers and goods are shipped within 24 hours of production. We use refrigerated packaging to maintain the cold chain.",
    category: "Products",
    language: null,
    isActive: true,
  },
  {
    question: "Do you have products for food intolerances?",
    answer: "Yes! We have a wide selection of products:\n✅ Gluten-free\n✅ Lactose-free\n✅ Vegetarian\n✅ Vegan\n✅ Halal\n✅ Organic\n\nSearch with filters: \"gluten-free products\", \"vegan\", etc.",
    category: "Products",
    language: null,
    isActive: true,
  },
  {
    question: "How are products packaged?",
    answer: "We use:\n- Food-grade packaging\n- Refrigerated containers for fresh products\n- Eco-friendly protective materials\n- Individual wrapping for delicate products\n\nEverything arrives intact and at the right temperature!",
    category: "Products",
    language: null,
    isActive: true,
  },
  {
    question: "How do I register?",
    answer: "Registration is automatic! Just start a conversation on WhatsApp and I will guide you. You will need:\n- Name and surname\n- Delivery address\n- Phone number (already have it!)\n\nThat's it, you're registered!",
    category: "Account",
    language: null,
    isActive: true,
  },
  {
    question: "Can I see product certifications?",
    answer: "Yes! Each product has detailed information on:\n- DOP/IGP/STG certifications\n- Organic/Bio certifications\n- Halal certifications\n- Allergen lists\n\nWrite \"product details [name]\" to see complete information.",
    category: "Products",
    language: null,
    isActive: true,
  },
  {
    question: "How do I change my data?",
    answer: "You can update your information anytime by writing:\n- \"change address\"\n- \"update phone number\"\n- \"modify delivery address\"\n\nI will send you a secure link to update your details.",
    category: "Account",
    language: null,
    isActive: true,
  },
  {
    question: "How is my privacy protected?",
    answer: "Your privacy is fundamental:\n✅ Data encrypted with SSL\n✅ GDPR compliant\n✅ No data sharing with third parties\n✅ Right to access, modify, delete data\n\nWrite \"privacy policy\" to read the complete document.",
    category: "Account",
    language: null,
    isActive: true,
  }
]
