// Default FAQs for eChatbot e-commerce platform
// IMPORTANT: All FAQs are in ENGLISH (database base language)
// The Translation Agent will translate to customer's language (it/es/pt)

interface DefaultFAQ {
  question: string
  answer: string
  category: string
  order: number
  isActive: boolean
}

/**
 * Initial FAQs created automatically when a new workspace/channel is created.
 * Only essential FAQs are included - owners can add more from the full list later.
 */
export const initialFAQs = (
  workspaceId: string
): Array<DefaultFAQ & { workspaceId: string }> => [
  {
    workspaceId,
    question: "How is my privacy protected?",
    answer:
      'Your privacy is fundamental:\n✅ Data encrypted with SSL\n✅ GDPR compliant\n✅ No data sharing with third parties\n✅ Right to access, modify, delete data\n\nWrite "privacy policy" to read the complete document.',
    category: "Account",
    order: 0,
    isActive: true,
  },
  {
    workspaceId,
    question: "What are the delivery times?",
    answer:
      "Standard delivery times are:\n- Metropolitan area: 24-48 hours\n- Region: 2-3 business days\n- Rest of country: 3-5 business days\n\nOrders confirmed before 2:00 PM ship the same day!",
    category: "Shipping",
    order: 1,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I repeat a previous order?",
    answer:
      'You can easily repeat a previous order! Write "repeat last order" or "repeat order #[code]". I will show you the details and you can confirm.',
    category: "Orders",
    order: 2,
    isActive: true,
  },
  {
    workspaceId,
    question: "What payment methods do you accept?",
    answer:
      "We accept:\n✅ Credit cards (Visa, Mastercard, Amex)\n✅ Bank transfer (for business orders)\n✅ PayPal\n✅ Cash on delivery (+€3.00)\n\nPayment is secure and protected with SSL encryption.",
    category: "Payments",
    order: 3,
    isActive: true,
  },
]

/**
 * Full list of all default FAQs for seeding or bulk import.
 * Use initialFAQs() for new workspace creation.
 */
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
    category: "Orders",
    order: 1,
    isActive: true,
  },
  {
    workspaceId,
    question: "I want to place an order",
    answer:
      'Of course! To place an order, tell me which product or service you would like to purchase and I will add it directly to your cart. For example, you can say:\n- "I want cheese"\n- "Add wine to cart"\n- "I need gift wrapping service"\n\nWhat would you like to order?',
    category: "Orders",
    order: 2,
    isActive: true,
  },
  {
    workspaceId,
    question: "What is the minimum order amount?",
    answer:
      "The minimum order is €50.00 for standard shipping. For orders below this amount, a €5.00 handling fee applies.",
    category: "Orders",
    order: 3,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I modify an order after placing it?",
    answer:
      "You can modify an order within 30 minutes of placing it by contacting us immediately. After this time, the order enters processing and can no longer be modified.",
    category: "Orders",
    order: 4,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I repeat a previous order?",
    answer:
      'You can easily repeat a previous order! Write "repeat last order" or "repeat order #[code]". I will show you the details and you can confirm.',
    category: "Orders",
    order: 5,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I cancel an order?",
    answer:
      'You can cancel an order within 1 hour of placing it if it is still in "Pending confirmation" status. Once confirmed and in processing, cancellation is no longer possible. Contact us for assistance.',
    category: "Orders",
    order: 6,
    isActive: true,
  },
  {
    workspaceId,
    question: "Will I receive an order confirmation?",
    answer:
      "Yes! You will receive immediate confirmation via WhatsApp with:\n- Order code\n- Product summary\n- Total and payment method\n- Estimated delivery times\n\nYou will also receive updates on preparation and shipping.",
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
    category: "Shipping",
    order: 8,
    isActive: true,
  },
  {
    workspaceId,
    question: "How much does shipping cost?",
    answer:
      "Shipping costs:\n- FREE for orders over €80\n- €7.50 for orders €50-€80\n- €12.50 for orders under €50\n\nRefrigerated shipping included for fresh products!",
    category: "Shipping",
    order: 9,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I track my order?",
    answer:
      'You can track your order in real-time! Write "where is my order" or "track order #[code]" and I will provide:\n- Current status\n- Courier tracking number\n- Link to follow shipment\n- Delivery estimate',
    category: "Shipping",
    order: 10,
    isActive: true,
  },
  {
    workspaceId,
    question: "Do you deliver on Saturdays?",
    answer:
      "Yes! We deliver Monday to Saturday, 8:00 AM - 6:00 PM. We are closed on Sundays. You can request a preferred time slot in the order notes.",
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
    category: "Payments",
    order: 12,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I get an invoice?",
    answer:
      'Certainly! You can request an invoice:\n1. During checkout (provide VAT/Tax ID)\n2. After ordering by writing "invoice order #[code]"\n\nYou will receive the PDF via WhatsApp within 24 hours of the order.',
    category: "Payments",
    order: 13,
    isActive: true,
  },
  {
    workspaceId,
    question: "When is payment charged?",
    answer:
      "With card/PayPal: immediate charge upon order confirmation.\nWith bank transfer: order confirmed upon payment receipt (send receipt via WhatsApp).\nCash on delivery: payment upon delivery.",
    category: "Payments",
    order: 14,
    isActive: true,
  },
  {
    workspaceId,
    question: "Is it safe to pay by card?",
    answer:
      "Absolutely yes! Payments are processed through PCI-DSS certified gateways with SSL/TLS encryption. We never store your card data. All payments are tracked and protected.",
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
    category: "Products",
    order: 16,
    isActive: true,
  },
  {
    workspaceId,
    question: "Do you have products for food intolerances?",
    answer:
      'Yes! We have a wide selection of products:\n✅ Gluten-free\n✅ Lactose-free\n✅ Vegetarian\n✅ Vegan\n✅ Halal\n✅ Organic\n\nSearch with filters: "gluten-free products", "vegan", etc.',
    category: "Products",
    order: 17,
    isActive: true,
  },
  {
    workspaceId,
    question: "How are products packaged?",
    answer:
      "We use:\n- Food-grade packaging\n- Refrigerated containers for fresh products\n- Eco-friendly protective materials\n- Individual wrapping for delicate products\n\nEverything arrives intact and at the right temperature!",
    category: "Products",
    order: 18,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I see product certifications?",
    answer:
      'Yes! Each product has detailed information on:\n- DOP/IGP/STG certifications\n- Organic/Bio certifications\n- Halal certifications\n- Allergen lists\n\nWrite "product details [name]" to see complete information.',
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
    category: "Account",
    order: 20,
    isActive: true,
  },
  {
    workspaceId,
    question: "How do I change my data?",
    answer:
      'You can update your information anytime by writing:\n- "change address"\n- "update phone number"\n- "modify delivery address"\n\nI will send you a secure link to update your details.',
    category: "Account",
    order: 21,
    isActive: true,
  },
  {
    workspaceId,
    question: "How is my privacy protected?",
    answer:
      'Your privacy is fundamental:\n✅ Data encrypted with SSL\n✅ GDPR compliant\n✅ No data sharing with third parties\n✅ Right to access, modify, delete data\n\nWrite "privacy policy" to read the complete document.',
    category: "Account",
    order: 22,
    isActive: true,
  },
  {
    workspaceId,
    question: "How do I invite team members to my workspace?",
    answer:
      'To invite team members:\n1. Go to Settings → Team section\n2. Click "Invite Member" button (green)\n3. Enter their email address\n4. They will receive an invitation email with a secure link\n\n⚠️ Available on Premium (max 3 members) and Enterprise (unlimited) plans only.',
    category: "Account",
    order: 23,
    isActive: true,
  },
  {
    workspaceId,
    question: "What happens when I accept a team invitation?",
    answer:
      'When you receive a team invitation email:\n1. Click "Accept Invitation" in the email\n2. If you already have an account → automatic acceptance\n3. If you are new → register with the invited email\n4. You will be added to the workspace with ADMIN role\n\n✅ Invitations expire after 7 days for security.',
    category: "Account",
    order: 24,
    isActive: true,
  },
  {
    workspaceId,
    question: "How many team members can I add to my workspace?",
    answer:
      'Team member limits by plan:\n\n🆓 Free Trial: Team members not available\n📊 Basic: Team members not available\n💎 Premium: Up to 3 team members\n🏢 Enterprise: Unlimited team members\n\nUpgrade your plan to add more team members!',
    category: "Account",
    order: 25,
    isActive: true,
  },
  // ====================================================================
  // CATEGORY: Billing (New FAQs about pricing and costs)
  // ====================================================================
  {
    workspaceId,
    question: "How much does it cost to send messages?",
    answer:
      "💰 **Message Pricing Structure:**\n\n📱 **WhatsApp Channel**: €0.10 per message\n- You pay only for messages you actually send\n- Each customer message counts as 1 message\n- Replies and notifications also count\n\n🌐 **Web Widget Channel**: €0.05 per message\n- Lower cost for web-based conversations\n- All widget messages count (customer + bot)\n\n📅 **Plus Subscription Fee**:\n- Plan-based subscription (Basic, Premium, Enterprise)\n- Includes team members, features, and dashboard access\n- Billing cycles: Monthly or Annual\n\n💡 **How It Works**:\n1. You choose a subscription plan\n2. Each message sent costs the per-message fee\n3. Total monthly bill = Subscription + (Number of messages × per-message cost)\n4. View real-time costs in your Dashboard → Billing\n\n✅ Free Trial includes 100 messages to test!",
    category: "Billing",
    order: 26,
    isActive: true,
  },
  {
    workspaceId,
    question: "What is included in my subscription plan?",
    answer:
      "📊 **Subscription Plan Inclusions**:\n\n🆓 **Free Trial** (7 days):\n- 100 free messages to test\n- Full access to all features\n- No credit card required initially\n\n📊 **Basic** (€29/month):\n- Unlimited messages at €0.10 each (WhatsApp) / €0.05 (Widget)\n- Up to 1,000 products in catalog\n- 1 team member\n- Email support\n\n💎 **Premium** (€99/month):\n- Unlimited messages\n- Up to 10,000 products\n- Up to 3 team members\n- Priority support\n- Advanced analytics\n\n🏢 **Enterprise** (Custom pricing):\n- Everything in Premium\n- Unlimited team members\n- Custom integrations\n- Dedicated account manager\n- SLA guarantee\n\n💡 All plans include the per-message cost on top of subscription!",
    category: "Billing",
    order: 27,
    isActive: true,
  },
  {
    workspaceId,
    question: "How do I upgrade my plan?",
    answer:
      "📈 **To Upgrade Your Plan**:\n\n1. Go to **Dashboard** → **Billing** → **Plans**\n2. Click **Upgrade** on the desired plan\n3. Choose billing frequency: **Monthly** or **Annual** (save 20%)\n4. Complete payment with card or bank transfer\n5. ✅ Plan activated immediately!\n\n💡 **Prorated Billing**: If you upgrade mid-month, you only pay for the remaining days of the current period + full next period.\n\n🔄 **Downgrade**: You can downgrade anytime. Changes take effect on the next billing cycle.",
    category: "Billing",
    order: 28,
    isActive: true,
  },
  // ====================================================================
  // CATEGORY: Campaigns (Push messaging)
  // ====================================================================
  {
    workspaceId,
    question: "Can I send promotional WhatsApp campaigns?",
    answer:
      "Yes. You can create a promotional campaign, select your audience (all customers, filtered by tags, or a CSV list), and send a templated WhatsApp message. Only contacts with marketing opt-in are allowed.",
    category: "Campaigns",
    order: 401,
    isActive: true,
  },
  {
    workspaceId,
    question: "How much do campaigns cost?",
    answer:
      "Each attempted send costs $1.00. The estimated total is shown before you confirm. Credit is deducted per message sent; skipped opt-out/blocked contacts are not charged.",
    category: "Campaigns",
    order: 402,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I schedule a campaign?",
    answer:
      "Yes. You can send immediately or schedule a date and time. The system throttles sends to respect WhatsApp limits and avoid rate-limit errors.",
    category: "Campaigns",
    order: 403,
    isActive: true,
  },
  {
    workspaceId,
    question: "Do recipients need to opt in?",
    answer:
      "Yes. Only customers with marketing consent are eligible. Blacklisted, blocked, fake, or opt-out contacts are automatically skipped and not charged.",
    category: "Campaigns",
    order: 404,
    isActive: true,
  },
  {
    workspaceId,
    question: "What happens if I don’t have enough credit?",
    answer:
      "If credit is insufficient at scheduling, the campaign is blocked. If credit runs out during sending, the campaign pauses and no further messages are sent. You can top up credit and resume.",
    category: "Campaigns",
    order: 405,
    isActive: true,
  },
]
