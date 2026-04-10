/**
 * HelpPanel - Right sidebar with help for selected field
 * Shows: title, description, examples, tips, and available variables
 */

interface HelpPanelProps {
  title: string
  description: string
  examples?: string[]
  tips?: string[]
  showVariables?: boolean // Show available variables reference
  sellsProductsAndServices?: boolean // E-commerce toggle state - filters e-commerce variables
}

// Available template variables for prompts and messages
// CRITICAL: Variables differ by channel type
const AVAILABLE_VARIABLES = [
  // Always available (both informational and ecommerce)
  { variable: "{{customerName}}", alwaysAvailable: true },
  { variable: "{{customerEmail}}", alwaysAvailable: true },
  { variable: "{{customerPhone}}", alwaysAvailable: true },
  { variable: "{{languageUser}}", alwaysAvailable: true },
  { variable: "{{companyName}}", alwaysAvailable: true },
  { variable: "{{chatbotName}}", alwaysAvailable: true },
  { variable: "{{address}}", alwaysAvailable: true },
  { variable: "{{websiteUrl}}", alwaysAvailable: true },
  { variable: "{{supportEmail}}", alwaysAvailable: true },
  { variable: "{{agentName}}", alwaysAvailable: true },
  { variable: "{{agentPhone}}", alwaysAvailable: true },
  { variable: "{{agentEmail}}", alwaysAvailable: true },
  
  // Ecommerce only (sellsProductsAndServices=true)
  { variable: "{{categories}}", ecommerceOnly: true },
  { variable: "{{offers}}", ecommerceOnly: true },
  { variable: "{{cartContents}}", ecommerceOnly: true },
  { variable: "{{lastOrderCode}}", ecommerceOnly: true },
  
  // Informational only (sellsProductsAndServices=false)
  { variable: "{{faqs}}", informationalOnly: true },
]

export function HelpPanel({ title, description, examples, tips, showVariables, sellsProductsAndServices }: HelpPanelProps) {
  // Filter variables based on channel type
  const availableVariables = AVAILABLE_VARIABLES.filter(v => {
    // Always show variables that are always available
    if (v.alwaysAvailable) return true
    
    // Show ecommerce variables only if ecommerce is enabled
    if (v.ecommerceOnly) return sellsProductsAndServices === true
    
    // Show informational variables only if ecommerce is disabled
    if (v.informationalOnly) return sellsProductsAndServices === false
    
    return true
  })

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>

      {examples && examples.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Examples
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            {examples.map((example, i) => (
              <li key={i} className="flex items-start gap-2 bg-gray-50 p-2 rounded-lg">
                <span className="text-green-500 font-bold">•</span>
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tips && tips.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
            💡 Tips
          </p>
          <ul className="text-sm text-amber-700 space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="leading-relaxed">{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {showVariables && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">
            📝 Available Variables
          </p>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map(({ variable }) => (
              <code key={variable} className="bg-blue-100 px-2 py-1 rounded text-blue-800 font-mono text-xs">
                {variable}
              </code>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-700">
              💡 Use these in Welcome Message, Custom Rules, and Bot Identity fields
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Predefined help content for each field (ENGLISH)
// Organized by section with detailed descriptions
export const HELP_CONTENT: Record<string, HelpPanelProps> = {
  // ============================================
  // AI PERSONALITY SECTION
  // ============================================
  botName: {
    title: "Chatbot Name",
    description:
      "This is the name your AI assistant will use when interacting with customers. " +
      "Choose a name that reflects your brand personality and feels approachable to your customers.",
    examples: [
      '"Sofia" - Friendly and personal',
      '"Marco" - Professional assistant',
      '"TechBot" - Clear and functional',
    ],
    tips: [
      "Use a short, memorable name (max 20 characters)",
      "Choose a name that matches your brand tone",
      "Avoid generic names like 'Bot' or 'Assistant'",
    ],
  },
  botDescription: {
    title: "Bot Identity Response",
    description:
      "This is how your AI will introduce itself when customers ask questions like " +
      "'Who are you?' or 'What can you do?'. Make it informative yet conversational.",
    examples: [
      '"I\'m Sofia, BellItalia\'s virtual assistant. I can help you with orders, products, and answer your questions!"',
    ],
    tips: [
      "Be friendly but professional",
      "Mention what the bot can help with",
      "Keep it concise (2-3 sentences max)",
    ],
  },
  toneOfVoice: {
    title: "Tone of Voice",
    description:
      "Define how your AI communicates with customers. This affects the style, " +
      "formality, and personality of all AI responses throughout conversations.",
    examples: [
      'Formal: "Good morning, how may I assist you today?"',
      'Friendly: "Hey there! 👋 How can I help?"',
      'Professional: "Thank you for contacting us. I\'d be happy to help."',
      'Casual: "Hi! What\'s up? Need any help?"',
    ],
    tips: [
      "Match the tone to your brand identity",
      "Consider your target audience preferences",
      "Formal works best for B2B, Friendly for B2C",
    ],
  },

  // ============================================
  // BUSINESS CONFIG SECTION
  // ============================================
  businessName: {
    title: "Channel Name",
    description:
      "Your business or workspace name. This appears in the admin dashboard, " +
      "notifications, and is used by the AI when referencing your company.",
    tips: [
      "Use your official business name",
      "Keep it recognizable to customers",
      "This can be different from your legal name",
    ],
  },
  businessType: {
    title: "Business Type",
    description:
      "Select the industry that best describes your business. This helps the AI " +
      "understand your context and provide more relevant responses to customers.",
    examples: [
      "Retail: Online stores, physical shops",
      "Restaurant: Cafes, restaurants, food delivery",
      "Healthcare: Clinics, pharmacies, wellness",
    ],
    tips: [
      "Choose the closest match to your main activity",
      "This affects AI suggestions and terminology",
    ],
  },
  registrationPage: {
    title: "Customer Registration Page",
    description:
      "Custom URL for customer registration. When the AI generates a [LINK_REGISTRATION] token, " +
      "it will use this URL instead of the default /registration page. " +
      "The token parameter will be automatically appended for secure access.",
    examples: [
      "https://mystore.com/join-us - External registration page",
      "/custom-registration - Relative path on your domain",
      "Leave empty to use default /registration page",
    ],
    tips: [
      "Use this if you have a custom registration flow",
      "Token is appended as ?token=xxx for authentication",
      "If URL already has query params, token is added with &token=xxx",
    ],
  },
  requireManualApproval: {
    title: "Require Manual Approval",
    description:
      "When enabled, new customers who complete registration will be placed in 'Pending Approval' status. " +
      "An administrator must manually approve them before they gain full access to the system.",
    examples: [
      "Enabled: Customer registers → Status: PENDING_APPROVAL → Admin approves → Status: ACTIVE",
      "Disabled (default): Customer registers → Status: ACTIVE (immediate access)",
    ],
    tips: [
      "Use this for B2B scenarios where customer vetting is required",
      "Pending customers will see 'awaiting approval' message instead of registration link",
      "Admins can approve customers from the Customers page",
      "Welcome messages are only sent after approval",
    ],
  },
  businessEmail: {
    title: "Business Email",
    description:
      "The main email address for business notifications. You'll receive alerts " +
      "about new orders, support requests, and important system messages here.",
    tips: [
      "Use an email you check regularly",
      "Consider using a shared inbox for teams",
      "This email receives order confirmations too",
    ],
  },
  businessWebsite: {
    title: "Website URL",
    description:
      "Your business website address. The AI may reference this when customers " +
      "ask for more information or need to be directed to your main site.",
    examples: ["https://www.mybusiness.com", "https://shop.example.com"],
    tips: [
      "Include the full URL with https://",
      "Make sure the site is accessible",
    ],
  },

  // ============================================
  // CHANNELS CONFIG SECTION
  // ============================================
  whatsappPhoneNumber: {
    title: "WhatsApp Phone Number",
    description:
      "The phone number associated with your WhatsApp Business account. " +
      "This is the number customers will message to reach your AI chatbot.",
    examples: ["+1 555 123 4567", "+39 333 123 4567"],
    tips: [
      "Use international format with country code",
      "Must be registered with WhatsApp Business API",
      "This number cannot be used on regular WhatsApp",
    ],
  },
  widgetTitle: {
    title: "Widget Title",
    description:
      "The title displayed at the top of your chat widget. This is what customers " +
      "see when they open the chat on your website.",
    examples: ['"Chat with us"', '"Need help? Ask Sofia!"', '"Support"'],
    tips: [
      "Keep it short and inviting",
      "Use action-oriented language",
      "Can include emojis for friendliness",
    ],
  },
  widgetPrimaryColor: {
    title: "Widget Primary Color",
    description:
      "The main color of your chat widget button and header. Choose a color that " +
      "matches your website design and brand identity.",
    examples: ["#22c55e (green)", "#3b82f6 (blue)", "#8b5cf6 (purple)"],
    tips: [
      "Use your brand's primary color",
      "Ensure good contrast for visibility",
      "Test on both light and dark backgrounds",
    ],
  },
  widgetLanguage: {
    title: "Widget Default Language",
    description:
      "The initial language for the chat widget interface. The AI will respond " +
      "in the customer's language regardless of this setting.",
    examples: ["it (Italian)", "en (English)", "es (Spanish)"],
    tips: [
      "Set to your main customer base language",
      "AI auto-detects customer language for responses",
    ],
  },

  // ============================================
  // AI CONFIG SECTION
  // ============================================
  agentSystemPrompt: {
    title: "Override Rules",
    description:
      "Advanced instructions that define how your AI should behave. These rules " +
      "override default behavior and let you customize responses for your specific needs.",
    examples: [
      '"Never mention competitor products"',
      '"Always suggest related items after answering questions"',
      '"For refund requests, ask for the order number first"',
    ],
    tips: [
      "Be specific and clear in your instructions",
      "Test rules thoroughly before going live",
      "Use variables like {{customerName}} for personalization",
    ],
  },
  welcomeMessage: {
    title: "Welcome Message",
    description:
      "The first message customers see when they start a conversation. Make a " +
      "great first impression and guide them on what the bot can help with.",
    examples: [
      '"👋 Welcome! I\'m here to help with orders, products, and any questions!"',
      '"Hi there! I can help you find products, track orders, or answer questions."',
    ],
    tips: [
      "Keep it concise and friendly",
      "Mention 2-3 things the bot can help with",
      "Consider adding an emoji for warmth",
    ],
  },
  maintenanceMessage: {
    title: "Maintenance Message",
    description:
      "Message displayed when the chatbot is temporarily unavailable. Shown when " +
      "Channel Status is OFF or Debug Mode is ON.",
    examples: [
      '"⚠️ We\'re updating our systems. Please try again in a few minutes."',
      '"🔧 Maintenance in progress. We\'ll be back shortly!"',
    ],
    tips: [
      "Be apologetic and set expectations",
      "Provide alternative contact if urgent",
      "Keep it brief but informative",
    ],
  },

  // ============================================
  // WIDGET SUPPORT SECTION (Human Support)
  // ============================================
  humanSupportEnabled: {
    title: "Enable Human Support",
    description:
      "When enabled, customers can request to speak with a real person. The AI " +
      "will transfer the conversation based on your escalation rules.",
    tips: [
      "✨ Smart Routing: If a customer has an assigned sales agent, support requests will automatically be sent to that agent. Otherwise, they'll go to the operator configured below.",
      "Enable if you have staff to handle live chats",
      "Set clear escalation instructions below",
      "Consider your team's availability hours",
    ],
  },
  contactMethodEmail: {
    title: "Email Contact Method",
    description:
      "Support requests are sent via email notification. Your team receives an " +
      "email with the customer's conversation history and contact details.",
    tips: [
      "Best for non-urgent requests",
      "Allows time to research before responding",
      "Email goes to your business email address",
    ],
  },
  contactMethodWhatsApp: {
    title: "WhatsApp Contact Method",
    description:
      "Support requests are forwarded directly to an operator's WhatsApp. " +
      "This enables real-time chat continuation with a human.",
    tips: [
      "Best for urgent or complex issues",
      "Requires an operator available on WhatsApp",
      "Conversation context is shared with operator",
    ],
  },
  operatorWhatsApp: {
    title: "Operator WhatsApp Number",
    description:
      "The WhatsApp number of the human operator who will receive escalated " +
      "support requests. Must include country code.",
    examples: ["+1 555 987 6543", "+39 333 987 6543"],
    tips: [
      "Use a dedicated support number",
      "Ensure someone monitors this number",
      "Include country code (e.g., +1 for USA)",
    ],
  },
  escalationInstructions: {
    title: "Escalation Instructions",
    description:
      "Define clear rules for when the AI should hand off to a human. The AI " +
      "follows these instructions to decide when to escalate conversations.",
    examples: [
      '"Escalate when customer explicitly asks for a human"',
      '"Transfer complaints or refund requests immediately"',
      '"Escalate if AI cannot resolve after 3 attempts"',
    ],
    tips: [
      "Be specific about escalation triggers",
      "Include common scenarios that need humans",
      "Consider high-value customer scenarios",
    ],
  },

  // ============================================
  // SECURITY SECTION
  // ============================================
  allowedDomains: {
    title: "Allowed External Domains",
    description:
      "A whitelist of external websites the AI is allowed to link to in responses. " +
      "This prevents the AI from directing customers to unauthorized or malicious sites.",
    examples: [
      "stripe.com - for payment links",
      "instagram.com - for social media",
      "docs.google.com - for documentation",
    ],
    tips: [
      "Only add domains you trust completely",
      "Include payment processors you use",
      "Add your own website and social profiles",
      "Separate multiple domains with commas",
    ],
  },

  // ============================================
  // SUBSCRIPTION SECTION
  // ============================================
  subscription: {
    title: "Subscription & Billing",
    description:
      "Manage your subscription plan and payment method. View your current plan, " +
      "connect PayPal for payments, and upgrade when you need more features.",
    tips: [
      "Connect PayPal to enable full features",
      "Upgrade to Premium for more channels",
      "Enterprise plans include dedicated support",
    ],
  },

  // ============================================
  // E-COMMERCE FEATURES
  // ============================================
  ecommerceFeatures: {
    title: "E-commerce Features",
    description:
      "Enable or disable e-commerce capabilities. When enabled, the AI can help " +
      "customers browse products, add items to cart, and complete purchases.",
    tips: [
      "Enable if you sell products or services",
      "Disable for purely informational bots (customer support, FAQ, info)",
      "Requires product catalog to be set up",
      "🔄 When OFF: E-commerce variables ({{products}}, {{offers}}, {{categories}}, {{services}}, {{lastOrderCode}}, {{cartContents}}) become empty in all prompts",
      "🔄 When ON: All variables are available with real data from your catalog",
    ],
  },

  // ============================================
  // CALENDAR & APPOINTMENTS SECTION
  // ============================================
  appointmentReminderMessage: {
    title: "Appointment Reminder Messages",
    description:
      "Templates for automatic reminders sent before appointments. You can configure up to 3 separate " +
      "reminder intervals (24h, 1h, 30min) with custom messages for each. Each WhatsApp reminder costs €0.50, " +
      "while email reminders are FREE.",
    examples: [
      "Hello {{customerName}}, your appointment for {{appointmentType}} is on {{appointmentDate}} at {{appointmentTime}}. See you soon!",
    ],
    showVariables: true,
    tips: [
      "💰 Pricing: €0.50 per WhatsApp reminder, FREE for email",
      "📊 Cost examples: 24h only = €0.50, 24h+1h = €1.00, All 3 intervals = €1.50",
      "Available variables: {{customerName}}, {{appointmentType}}, {{appointmentDate}}, {{appointmentTime}}",
      "Each interval can have its own custom message",
      "30-minute reminder is disabled by default (enable if needed)",
      "Keep messages concise but informative",
    ],
  },
  appointmentReminder24hMessage: {
    title: "24-Hour Reminder Message",
    description:
      "Message sent 1 day before the appointment. This is the most common reminder interval " +
      "and gives customers enough time to prepare or reschedule if needed.",
    examples: [
      "Hello {{customerName}}, reminder: your {{appointmentType}} appointment is tomorrow at {{appointmentTime}}.",
    ],
    showVariables: true,
    tips: [
      "Cost: €0.50 per WhatsApp reminder (FREE for email)",
      "Enabled by default for new workspaces",
      "Good for customers who need to plan their day",
    ],
  },
  appointmentReminder1hMessage: {
    title: "1-Hour Reminder Message",
    description:
      "Message sent 1 hour before the appointment. Useful as a last-minute confirmation " +
      "to reduce no-shows.",
    examples: [
      "Hello {{customerName}}, your {{appointmentType}} appointment starts in 1 hour at {{appointmentTime}}.",
    ],
    showVariables: true,
    tips: [
      "Cost: €0.50 per WhatsApp reminder (FREE for email)",
      "Enabled by default for new workspaces",
      "Reduces no-shows by ~30%",
    ],
  },
  appointmentReminder30mMessage: {
    title: "30-Minute Reminder Message",
    description:
      "Message sent 30 minutes before the appointment. Optional extra reminder for critical appointments " +
      "or high-value services where no-shows are very costly.",
    examples: [
      "Hello {{customerName}}, your {{appointmentType}} appointment starts in 30 minutes at {{appointmentTime}}.",
    ],
    showVariables: true,
    tips: [
      "Cost: €0.50 per WhatsApp reminder (FREE for email)",
      "Disabled by default (enable only if needed)",
      "Total cost with all 3 reminders: €1.50 per appointment",
      "Best for high-value appointments (€150+)",
    ],
  },
  appointmentReminderChannel: {
    title: "Reminder Channel",
    description:
      "Choose how appointment reminders are delivered to customers. WhatsApp provides " +
      "better engagement but has a cost, while email is free but may have lower open rates.",
    examples: [
      "WhatsApp: €0.50 per reminder (higher engagement)",
      "Email: FREE (lower engagement but no cost)",
      "Both: Send to WhatsApp AND Email (€0.50 per reminder)",
    ],
    tips: [
      "💰 Cost: WhatsApp = €0.50/reminder, Email = FREE",
      "WhatsApp reminders have ~95% open rate vs ~20% for email",
      "Consider your budget and customer preferences",
      "For high-value appointments (€150+ consultation), WhatsApp worth the cost",
      "For free or low-cost services, email may be sufficient",
    ],
  },
  timezone: {
    title: "Workspace Timezone",
    description:
      "The timezone used for calculating appointment slots, business hours, and reminder timing. " +
      "All appointments are stored in UTC internally but displayed to customers in this timezone.",
    examples: [
      "Europe/Rome - Italy Standard Time (UTC+1, UTC+2 in summer)",
      "America/New_York - Eastern Time (UTC-5, UTC-4 in summer)",
      "Asia/Tokyo - Japan Standard Time (UTC+9)",
    ],
    tips: [
      "Use IANA timezone format (e.g., 'Europe/Rome', not 'GMT+1')",
      "This affects when reminders are sent",
      "Business hours are calculated in this timezone",
      "Customers see appointment times in this timezone too",
    ],
  },

  // ============================================
  // DEFAULT/FALLBACK
  // ============================================
  default: {
    title: "Settings Help",
    description:
      "Select any field to see detailed information, examples, and tips for " +
      "configuring that setting. The help panel updates as you navigate through the form.",
    tips: [
      "Click or focus on any field for context-specific help",
      "Green bullet points show examples you can use",
      "Yellow tips provide best practices",
    ],
  },
}
