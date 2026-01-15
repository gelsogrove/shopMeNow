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
      'It\'s super easy! Here\'s how:\n\n1️⃣ Search: "search [product name]" (e.g., "search mozzarella")\n2️⃣ Add to cart: "add [quantity] [product]" (e.g., "add 2 wine")\n3️⃣ Check cart: "show cart"\n4️⃣ Checkout: "proceed to checkout"\n\n💬 You\'ll get instant confirmation right here on WhatsApp! Easy, right? 😊',
    category: "Orders",
    order: 1,
    isActive: true,
  },
  {
    workspaceId,
    question: "I want to place an order",
    answer:
      'Awesome! 🎉 Just tell me what you\'d like and I\'ll add it straight to your cart. You can say things like:\n\n• "I want cheese"\n• "Add wine to cart"\n• "I need gift wrapping service"\n\nGo ahead—what are you looking for today? 🛒',
    category: "Orders",
    order: 2,
    isActive: true,
  },
  {
    workspaceId,
    question: "What is the minimum order amount?",
    answer:
      "Our minimum order is €50.00 for free standard shipping. 📦\n\nOrdering less? No problem! Just add a small €5.00 handling fee and we\'re good to go. This helps us cover the costs of packing and delivery for smaller orders.",
    category: "Orders",
    order: 3,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I modify an order after placing it?",
    answer:
      "Yes, but you need to be quick! ⚡ You have 30 minutes after placing your order to make changes—just message us right away.\n\nAfter that 30-minute window, your order goes into processing and we can\'t modify it anymore. So if you spot a mistake, let us know ASAP!",
    category: "Orders",
    order: 4,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I repeat a previous order?",
    answer:
      'Love something and want it again? Easy! 🔄\n\nJust say:\n• "repeat last order" (for your most recent order)\n• "repeat order #ABC123" (for a specific order)\n\nI\'ll show you the details so you can double-check, then just confirm and you\'re done! Same great order, zero hassle.',
    category: "Orders",
    order: 5,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I cancel an order?",
    answer:
      'Yes, but timing matters! ⏰\n\nYou can cancel within 1 hour of placing your order IF it\'s still showing "Pending confirmation" status. Once it moves to processing, we can\'t cancel it anymore (it\'s already being packed!).\n\nNeed to cancel? Message us right away and we\'ll help you out! 💬',
    category: "Orders",
    order: 6,
    isActive: true,
  },
  {
    workspaceId,
    question: "Will I receive an order confirmation?",
    answer:
      "Absolutely! 📱 You\'ll get instant confirmation right here on WhatsApp with everything you need:\n\n✅ Order code\n✅ What you ordered\n✅ Total amount & payment method\n✅ Estimated delivery time\n\nPlus, we\'ll keep you updated as we prepare and ship your order. You\'ll always know what\'s happening! 📦",
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
      "Here's how fast we deliver: 🚀\n\n📍 Metropolitan area: 24-48 hours\n📍 Your region: 2-3 business days\n📍 Rest of country: 3-5 business days\n\n💡 Pro tip: Order before 2:00 PM and we'll ship it THE SAME DAY! That's how we roll. 😎",
    category: "Shipping",
    order: 8,
    isActive: true,
  },
  {
    workspaceId,
    question: "How much does shipping cost?",
    answer:
      "Great question! Here's the breakdown: 📦\n\n🎉 FREE for orders over €80 (yes, FREE!)\n💵 €7.50 for orders €50-€80\n💵 €12.50 for orders under €50\n\n❄️ Bonus: Refrigerated shipping is INCLUDED for all fresh products—no extra charge! We keep your food perfectly fresh.",
    category: "Shipping",
    order: 9,
    isActive: true,
  },
  {
    workspaceId,
    question: "How can I track my order?",
    answer:
      'Want to know where your order is? Easy! 📍\n\nJust message me:\n• "where is my order"\n• "track order #ABC123"\n\nI\'ll give you:\n✅ Current status\n✅ Courier tracking number\n✅ Direct link to follow your shipment\n✅ Delivery estimate\n\nReal-time updates, right at your fingertips! 📱',
    category: "Shipping",
    order: 10,
    isActive: true,
  },
  {
    workspaceId,
    question: "Do you deliver on Saturdays?",
    answer:
      "Yes we do! 📦\n\nWe deliver Monday through Saturday, 8:00 AM - 6:00 PM. Sundays we take off to rest (even delivery drivers need a break! 😊).\n\n💡 Want a specific time? Just add a note to your order with your preferred delivery window and we'll do our best to accommodate!",
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
      "We make paying easy! Choose what works for you: 💳\n\n✅ Credit cards (Visa, Mastercard, Amex)\n✅ Bank transfer (perfect for business orders)\n✅ PayPal\n✅ Cash on delivery (+€3.00 fee)\n\n🔒 All payments are secure and protected with SSL encryption. Your info is safe with us!",
    category: "Payments",
    order: 12,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I get an invoice?",
    answer:
      'Of course! 📝 You can request an invoice two ways:\n\n1️⃣ During checkout: Just provide your VAT/Tax ID when ordering\n2️⃣ After ordering: Message "invoice order #ABC123"\n\nWe\'ll send you the PDF invoice right here on WhatsApp within 24 hours. Easy peasy! 🚀',
    category: "Payments",
    order: 13,
    isActive: true,
  },
  {
    workspaceId,
    question: "When is payment charged?",
    answer:
      "Great question! It depends on your payment method: 💳\n\n🔹 Card/PayPal: Charged immediately when you confirm your order\n🔹 Bank transfer: We confirm your order once we receive payment (send us the receipt via WhatsApp!)\n🔹 Cash on delivery: You pay when the delivery arrives at your door\n\nSimple as that! 😊",
    category: "Payments",
    order: 14,
    isActive: true,
  },
  {
    workspaceId,
    question: "Is it safe to pay by card?",
    answer:
      "100% safe! 🔒 Here's why:\n\n✅ We use PCI-DSS certified payment gateways (industry gold standard)\n✅ All data is encrypted with SSL/TLS\n✅ We NEVER store your card details\n✅ Every transaction is tracked and protected\n\nYour payment info is as secure as it gets. We take your security seriously! 🛡️",
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
      "Super fresh! 🌱 Here's our promise:\n\n✅ We work directly with local producers\n✅ Products ship within 24 hours of production\n✅ We use refrigerated packaging to keep the cold chain intact\n\nYou're getting farm-to-table freshness delivered right to your door!",
    category: "Products",
    order: 16,
    isActive: true,
  },
  {
    workspaceId,
    question: "Do you have products for food intolerances?",
    answer:
      'Absolutely! 🌿 We have a great selection:\n\n✅ Gluten-free\n✅ Lactose-free\n✅ Vegetarian\n✅ Vegan\n✅ Halal\n✅ Organic\n\nJust search with filters like "gluten-free products" or "vegan options" and I\'ll show you what we have!',
    category: "Products",
    order: 17,
    isActive: true,
  },
  {
    workspaceId,
    question: "How are products packaged?",
    answer:
      "We package everything with care! 📦\n\n✅ Food-grade materials (safe for contact with food)\n✅ Refrigerated containers for fresh products\n✅ Eco-friendly protective packaging (we love the planet! 🌍)\n✅ Individual wrapping for delicate items\n\nEverything arrives intact and at the perfect temperature!",
    category: "Products",
    order: 18,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I see product certifications?",
    answer:
      'Yes! Each product comes with detailed info: 📜\n\n✅ DOP/IGP/STG certifications (protected origin)\n✅ Organic/Bio certifications\n✅ Halal certifications\n✅ Complete allergen lists\n\nJust message "product details [name]" and I\'ll show you everything!',
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
      "Super easy! Just start chatting with us right here on WhatsApp and we'll walk you through it. 😊\n\nAll we need:\n✅ Your name\n✅ Delivery address\n✅ Phone number (we already have this!)\n\nThat's it—you're in! No complicated forms, no hassle.",
    category: "Account",
    order: 20,
    isActive: true,
  },
  {
    workspaceId,
    question: "How do I change my data?",
    answer:
      'Need to update something? No problem! Just message me:\n\n• "change address"\n• "update phone number"\n• "modify delivery address"\n\nI\'ll send you a secure link where you can update your details. Quick and easy! 🔗',
    category: "Account",
    order: 21,
    isActive: true,
  },
  {
    workspaceId,
    question: "How is my privacy protected?",
    answer:
      'Your privacy is sacred to us! 🔒 Here\'s how we protect you:\n\n✅ All data encrypted with SSL\n✅ Fully GDPR compliant\n✅ We NEVER share your data with third parties\n✅ You have full rights to access, modify, or delete your data\n\nWant the full details? Just message "privacy policy" to read our complete document.',
    category: "Account",
    order: 22,
    isActive: true,
  },
  {
    workspaceId,
    question: "What are the costs for using eChatbot messaging?",
    answer:
      "eChatbot pricing is simple and transparent! 💰\n\n💬 Messages: $0.10 (10 cents USD) per message sent\n🔔 Push notifications: €1.00 per notification sent\n\nYou only pay for what you actually use. No hidden fees, no surprises! Track everything in your dashboard in real-time. 📊",
    category: "Billing",
    order: 23,
    isActive: true,
  },
  {
    workspaceId,
    question: "How am I charged for eChatbot messages?",
    answer:
      "Billing is crystal clear: 💳\n\n📊 Per-message: Each message costs $0.10 USD\n📊 Per-push: Each push notification costs €1.00\n💳 Pay for usage: You only pay for what you send\n📈 Real-time tracking: See all costs live in your dashboard\n\nMonthly invoices show a detailed breakdown of every message and notification. No surprises!",
    category: "Billing",
    order: 24,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I contact a sales agent directly?",
    answer:
      "If you have a dedicated sales agent assigned, absolutely! 👤\n\nJust say:\n• \"contact sales agent\"\n• \"speak with my agent\"\n• \"my dedicated agent\"\n\nYour message will go straight to your personal agent who'll respond personally. It's like having a direct line to your team!",
    category: "Support",
    order: 25,
    isActive: true,
  },
  {
    workspaceId,
    question: "How do I set up WhatsApp integration with eChatbot?",
    answer:
      "Let's get you connected! Here's what you need: 📱\n\n1️⃣ Create a Facebook Business Account at https://business.facebook.com\n2️⃣ Enable WhatsApp in Facebook App Manager\n3️⃣ Get your WhatsApp API Key from Meta\n4️⃣ Add the API Key to eChatbot settings\n\n📺 Need help? Watch this guide: https://www.youtube.com/watch?v=BsDsc1ZtSs4\n\nOnce done, your customers can message you directly on WhatsApp! 🎉",
    category: "Setup",
    order: 26,
    isActive: true,
  },
  {
    workspaceId,
    question: "What languages does eChatbot support?",
    answer:
      "We speak YOUR customer's language! 🌍 The AI automatically understands and responds in:\n\n🇮🇹 Italian (Italiano)\n🇬🇧 English\n🇪🇸 Spanish (Español)\n🇵🇹 Portuguese (Português)\n\nZero configuration needed! Customers can write in any of these languages and the AI responds back in their language automatically. Perfect for going international! 🚀",
    category: "Features",
    order: 27,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can eChatbot integrate with my CRM?",
    answer:
      "Yes! We offer custom CRM integration 🔗\n\nConnect:\n✅ Customer data & profiles\n✅ Order history\n✅ Real-time event triggers\n✅ Carrier APIs for shipment tracking\n\nEvery response is grounded in YOUR data. Sync profiles, pull order history, trigger workflows automatically.\n\n📧 Want this? Contact our team for a quote—custom integration available on request!",
    category: "Integration",
    order: 28,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can eChatbot track shipments in real-time?",
    answer:
      "Absolutely! With CRM integration, we connect directly to your carrier's API 🚚\n\nFeatures:\n✅ Live shipment tracking\n✅ Automatic status updates\n✅ Delivery predictions\n✅ Customer notifications\n\nCustomers ask \"where is my order?\" and boom—instant live tracking from your carrier!\n\n📧 Want this setup? Contact us for custom carrier integration!",
    category: "Integration",
    order: 29,
    isActive: true,
  },
  {
    workspaceId,
    question: "What is Privacy by Design in eChatbot?",
    answer:
      "Privacy isn't an afterthought—it's built into everything! 🔒\n\n✅ NO sensitive data sent to AI models\n✅ NO sharing with third parties\n✅ Scoped tokens: Each interaction has minimum required access\n✅ Encrypted in transit: Industry-standard encryption\n✅ Your control: Customer data stays under YOUR control\n\nWe believe privacy is the foundation. Every feature uses the minimum data necessary, and you maintain complete control.",
    category: "Features",
    order: 30,
    isActive: true,
  },

  // ====================================================================
  // CATEGORY: Campaigns (8 FAQs) - Push notifications and campaigns
  // ====================================================================
  {
    workspaceId,
    question: "How much does it cost to send a push notification?",
    answer:
      "Push notifications cost $1.00 per message. 📲\n\nSimple, transparent pricing! This lets you reach your customers directly with targeted messages and promotions whenever you need to. No monthly fees—just pay for what you send!",
    category: "Campaigns",
    order: 31,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I schedule push notifications?",
    answer:
      "Absolutely! ⏰ Schedule your campaigns for specific times and dates.\n\nThis means you can:\n✅ Plan campaigns in advance\n✅ Reach customers at optimal times\n✅ Set up recurring campaigns for regular promotions\n\nSmart timing = better engagement! 📈",
    category: "Campaigns",
    order: 32,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I use AI to understand what message to send in a push?",
    answer:
      "With the Enterprise version, YES! 🤖\n\nWe'll work together to analyze your data and determine the best campaign strategy. Our AI looks at:\n✅ Customer behavior patterns\n✅ Preferences & engagement history\n✅ Optimal timing & content\n✅ Target segments\n\nIt's like having a marketing expert on your team! Want to learn more? Contact us!",
    category: "Campaigns",
    order: 33,
    isActive: true,
  },
  {
    workspaceId,
    question: "Where can I get product availability information?",
    answer:
      "With Enterprise, we connect to your external services for real-time data! 📊\n\nThis integration gives you:\n✅ Up-to-date stock levels\n✅ Delivery dates\n✅ Inventory status\n✅ Live product availability\n\nKeep your campaigns accurate with data straight from your systems!",
    category: "Campaigns",
    order: 34,
    isActive: true,
  },
  {
    workspaceId,
    question: "How many people can collaborate on campaigns?",
    answer:
      "Your whole team! 👥\n\nThe workspace is shared with everyone you invite. All team members get:\n✅ Full campaign visibility\n✅ Performance metrics\n✅ Customer engagement data\n✅ Collaboration tools\n\nInvite as many teammates as you need—everyone works together seamlessly!",
    category: "Campaigns",
    order: 35,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I block a user from receiving campaigns?",
    answer:
      "Yes, you have full control! 🚫\n\nIf a customer sends spam or asks to unsubscribe, you can block them. Blocked users won't receive:\n✅ Any further campaigns\n✅ Marketing messages\n✅ Push notifications\n\nRespecting preferences keeps your reputation strong!",
    category: "Campaigns",
    order: 36,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I intervene in the chat during a campaign?",
    answer:
      "Absolutely! You're always in control. 💬\n\nJust turn off the chatbot and jump in personally. Perfect for:\n✅ Providing personal support\n✅ Handling special requests\n✅ Resolving issues in real-time\n✅ Building customer relationships\n\nSwitch between AI and human support anytime!",
    category: "Campaigns",
    order: 37,
    isActive: true,
  },
  {
    workspaceId,
    question: "Are there statistics for campaigns?",
    answer:
      "Oh yes! We love data. 📊\n\nYou get detailed stats for every channel:\n✅ Message delivery rates\n✅ Customer engagement metrics\n✅ Click-through rates\n✅ Conversion data\n✅ Performance by channel (WhatsApp, Widget, etc.)\n✅ Response analysis\n\nUse these insights to optimize and improve your results!",
    category: "Campaigns",
    order: 38,
    isActive: true,
  },
  {
    workspaceId,
    question: "Can I use the widget for web and WhatsApp at the same time?",
    answer:
      "That's exactly the point! 🎯\n\nDeploy the widget on your website AND maintain your WhatsApp Business number—both at once!\n\nBenefits:\n✅ Customers choose their preferred channel\n✅ All conversations unified in one workspace\n✅ Seamless experience across platforms\n✅ Maximum reach\n\nMeet your customers wherever they are! 🌐",
    category: "Campaigns",
    order: 39,
    isActive: true,
  },
]
