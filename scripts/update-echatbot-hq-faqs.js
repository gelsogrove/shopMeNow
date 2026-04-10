/**
 * UPDATE FAQs for echatbot-hq-support workspace
 *
 * This script REPLACES ALL existing FAQs with a comprehensive set
 * covering ~80% of platform use cases.
 *
 * Run locally (needs DATABASE_URL in env):
 *   node scripts/update-echatbot-hq-faqs.js
 *
 * Run on Heroku:
 *   heroku run "node -e \"$(cat scripts/update-echatbot-hq-faqs.js)\"" --app echatbot-app
 */

const { prisma } = require('/app/node_modules/@echatbot/database/dist/src/index.js');

const WORKSPACE_ID = 'echatbot-hq-support';

const faqs = [

  // ═══════════════════════════════════════════════════════════════════════════
  // GETTING STARTED
  // ═══════════════════════════════════════════════════════════════════════════
  {
    order: 10,
    category: 'Getting Started',
    question: 'What is eChatbot and what can it do for my business?',
    answer: `eChatbot is an AI-powered chatbot platform that lets you automate customer conversations on **WhatsApp** and your **website widget** — without any coding.

With eChatbot you can:
- Answer customer questions automatically 24/7
- Show and sell products, services, and offers directly in chat
- Accept appointment bookings via WhatsApp or widget
- Run marketing broadcast campaigns to your customer base
- Escalate complex requests to a human operator
- Manage everything from a single dashboard

Start free at <a href="https://app.echatbot.io" target="_blank">app.echatbot.io</a>`,
    keywords: 'what is echatbot,overview,features,capabilities,benefits,intro',
  },
  {
    order: 20,
    category: 'Getting Started',
    question: 'How do I create an account and get started?',
    answer: `Getting started is simple:

1. Go to <a href="https://app.echatbot.io" target="_blank">app.echatbot.io</a>
2. Register with your email address
3. Create your first **Workspace** (one workspace = one business channel)
4. Choose your workspace type: **E-commerce** (sells products) or **Informational** (provides info, bookings, support)
5. Connect your WhatsApp number or embed the website widget
6. Configure the AI personality and you're live!

Every new workspace starts with a **14-day free trial** — no credit card required.`,
    keywords: 'create account,register,signup,get started,onboarding,new account',
  },
  {
    order: 30,
    category: 'Getting Started',
    question: 'How long does the setup take?',
    answer: `It depends on what you need:

- **Basic setup** (WhatsApp connected + AI personality configured): **~30 minutes**
- **Full e-commerce setup** (products, categories, orders, payment links): **1–2 days**
- **Appointment booking** (services, business hours, Google Calendar): **1–2 hours**
- **Enterprise rollout** (custom integrations, team training): **1–2 weeks**

Most clients are live with a working chatbot within the same day they sign up.`,
    keywords: 'setup time,how long,onboarding,implementation,launch,go live',
  },
  {
    order: 40,
    category: 'Getting Started',
    question: 'Is there a free trial?',
    answer: `Yes! Every new workspace includes a **14-day free trial** with access to all features.

- No credit card required to start
- Test all automations, the AI chatbot, campaigns, and integrations
- Full conversation history and analytics included
- After the trial, choose a plan or your workspace pauses

Start your free trial at <a href="https://app.echatbot.io" target="_blank">app.echatbot.io</a>`,
    keywords: 'free trial,trial,test,no credit card,demo',
  },

  // ─── WHATSAPP CHANNEL ────────────────────────────────────────────────────
  {
    order: 100,
    category: 'WhatsApp Channel',
    question: 'Do I need WhatsApp Business API to use eChatbot?',
    answer: `Yes. eChatbot requires the **WhatsApp Business API** — not the free WhatsApp or WhatsApp Business app you install on your phone.

**Why?** The API is the only way to send automatic responses, connect a chatbot, and handle unlimited conversations programmatically.

You have two options:
1. **Meta official API** — Direct connection to Meta's servers. Requires business verification (24–48h). Recommended for production workloads.
2. **UltraMsg / Wasender** — Third-party providers that connect faster but have lower message throughput. Good for testing and small volumes.

Go to **Settings > WhatsApp Channel** to configure your provider.`,
    keywords: 'whatsapp business api,api,meta,ultramsg,wasender,provider,official',
  },
  {
    order: 110,
    category: 'WhatsApp Channel',
    question: 'How do I connect my WhatsApp number?',
    answer: `Go to **Menu > Settings > WhatsApp Channel**.

Steps:
1. Choose your **provider**: Meta (official) or UltraMsg/Wasender
2. Enter your **phone number** (international format, e.g. +39 02 1234567)
3. Enter the **API token** and instance/channel ID from your provider
4. Copy the **Webhook URL** shown on the page and paste it in your provider dashboard
5. Enable the channel with the toggle switch

Once connected, all incoming WhatsApp messages go to this workspace automatically.

💡 **Tip**: UltraMsg is the fastest to get started if you need to test quickly. For long-term production use, Meta API is recommended.`,
    keywords: 'connect whatsapp,whatsapp setup,phone number,webhook,api token,instance',
  },
  {
    order: 120,
    category: 'WhatsApp Channel',
    question: 'Can I use my existing WhatsApp number?',
    answer: `Yes, if you want to use the **Meta official API** you can migrate your existing business number. However:

- The number **cannot simultaneously** be active on a phone and the API
- You will lose your existing chat history when migrating
- Meta requires business verification for the number

**Recommendation**: Use a **dedicated business number** for eChatbot to keep your personal and business messaging separate.

If you use **UltraMsg/Wasender**, your phone number must remain active on a real device connected to the internet.`,
    keywords: 'existing number,migrate,phone number,dedicated number,personal number',
  },
  {
    order: 130,
    category: 'WhatsApp Channel',
    question: 'How do I enable or disable the WhatsApp channel?',
    answer: `Go to **Menu > Settings > WhatsApp Channel**.

Use the **Channel Active** toggle switch:
- **Active (ON)**: The chatbot responds to incoming WhatsApp messages automatically
- **Disabled (OFF)**: Messages are received and logged but the AI does NOT respond

This is useful when you want to temporarily pause the bot (e.g., during maintenance) without losing any messages.`,
    keywords: 'enable,disable,pause,activate,deactivate,whatsapp channel,toggle',
  },

  // ─── WEBSITE WIDGET ──────────────────────────────────────────────────────
  {
    order: 200,
    category: 'Website Widget',
    question: 'How do I add a chat widget to my website?',
    answer: `Go to **Menu > Settings > Website Widget**.

Steps:
1. Scroll down to the **Widget Code** section
2. Copy the JavaScript snippet shown
3. Paste it just **before the closing &lt;/body&gt; tag** on every page of your website
4. Save and reload your website — the chat icon will appear

The widget connects to the same chatbot, FAQ knowledge base, and customer database as your WhatsApp channel. No extra AI configuration needed!`,
    keywords: 'widget,embed,website,code,snippet,html,web chat,install',
  },
  {
    order: 210,
    category: 'Website Widget',
    question: 'How do I customize the chat widget appearance?',
    answer: `Go to **Menu > Settings > Website Widget**.

Here you can configure:
- **Widget title** — shown in the chat header (e.g. your business name)
- **Subtitle** — shown below the title (e.g. "Ask us anything!")
- **Colors** — primary color to match your brand
- **Position** — bottom-right or bottom-left
- **Enable/disable** — turn the widget on or off without removing the code

Changes are reflected immediately — no need to update the code snippet on your website.`,
    keywords: 'widget customization,colors,title,appearance,style,brand,position',
  },

  // ─── AI CHATBOT CONFIGURATION ───────────────────────────────────────────
  {
    order: 300,
    category: 'AI Configuration',
    question: 'How do I change the chatbot name, tone of voice, and personality?',
    answer: `Go to **Menu > Settings > AI Personality**.

You can configure:
- **Chatbot Name** — the name shown to customers (e.g. Sofia, Alex, Max)
- **Identity Response** — what the bot says when asked "Who are you?"
- **Tone of Voice** — FORMAL, FRIENDLY, or PROFESSIONAL
- **Welcome Message** — the first message sent to new customers
- **Custom AI Rules** — free-text instructions (e.g. "Always greet by first name", "Use short sentences", "Never mention competitors")

Changes take effect on the **next incoming message** — no restart needed.`,
    keywords: 'personality,tone,name,chatbot name,identity,voice,welcome message,rules',
  },
  {
    order: 310,
    category: 'AI Configuration',
    question: 'How do I train the chatbot with my own questions and answers?',
    answer: `Go to **Menu > FAQ**.

eChatbot uses a FAQ-based knowledge system — much simpler than traditional model training.

To add a custom answer:
1. Click **Add FAQ**
2. Enter the **question** a customer would ask
3. Enter the **answer** you want the chatbot to give
4. Add **keywords** to help the AI find it (e.g. "refund, return, money back")
5. Set a **category** (optional, for organization)
6. Click **Save**

The chatbot will prioritize your FAQ answers over generated responses. **Changes take effect immediately.**

💡 **Tip**: Write the question as a customer would ask it (natural language). The more specific the question and answer, the better the chatbot performs.`,
    keywords: 'train,training,faq,knowledge base,custom answers,teach,questions,responses',
  },
  {
    order: 320,
    category: 'AI Configuration',
    question: 'Does the chatbot support multiple languages?',
    answer: `Yes! eChatbot **auto-detects** the customer's language and responds in that language automatically.

Supported languages include: **Italian, English, Spanish, Portuguese**, and more.

How it works:
- Your product catalog, FAQ answers, and settings stay in your base language (usually Italian or English)
- The AI Translation Agent automatically translates responses to match the customer's language
- No extra configuration needed — it just works

You can also configure your workspace's **default language** in Settings > Business Config.`,
    keywords: 'multilingual,languages,italian,english,spanish,portuguese,translation,auto detect',
  },
  {
    order: 330,
    category: 'AI Configuration',
    question: 'How do I write custom AI rules to control chatbot behavior?',
    answer: `Go to **Menu > Settings > AI Personality** → **Custom AI Rules** field.

This is a free-text field where you write instructions for the AI in plain language. Examples:

✅ **Good rules to write:**
- "Always greet customers by their first name if known"
- "Never disclose pricing without first asking for the customer's email"
- "If the customer asks about shipping, always say 2–4 business days"
- "Always end each message with a question to keep the conversation going"
- "Do not discuss topics unrelated to our products"

Rules are injected into every AI prompt automatically.

💡 **Tip**: Be specific. Instead of "Be polite", write "Always use 'Grazie' when a customer thanks you."`,
    keywords: 'custom rules,ai rules,behavior,instructions,prompt,control,guidelines',
  },

  // ─── E-COMMERCE ──────────────────────────────────────────────────────────
  {
    order: 400,
    category: 'E-commerce',
    question: 'How do I add products to my catalog?',
    answer: `Go to **Menu > E-commerce > Products** (visible when your workspace type is E-commerce).

To add a product:
1. Click **Add Product**
2. Fill in: **name**, **description**, **price**, and optionally **SKU**, **stock quantity**, and **image**
3. Assign it to a **category**
4. Toggle **Active** to make it visible to customers
5. Click **Save**

The chatbot will immediately be able to recommend, show, and sell this product in conversations.

You can also **edit** or **deactivate** existing products at any time.`,
    keywords: 'add product,catalog,products,new product,upload,create,shop',
  },
  {
    order: 410,
    category: 'E-commerce',
    question: 'How do I add product categories?',
    answer: `Go to **Menu > E-commerce > Products** and look for the **Categories** section (or navigate to its dedicated tab if available in your workspace).

Categories help the AI organize and recommend products correctly. When a customer says "show me shoes" or "I want something under €50", the AI uses categories to filter results.

To add a category:
1. Click **Add Category**
2. Enter the **category name** (e.g. Clothing, Electronics, Services)
3. Add an optional **description**
4. Set it as **Active**
5. Click **Save**

Then assign products to categories from the product edit form.`,
    keywords: 'categories,product categories,add category,organize,catalog sections',
  },
  {
    order: 420,
    category: 'E-commerce',
    question: 'How do I add special offers or promotions?',
    answer: `Go to **Menu > E-commerce > Offers**.

To create an offer:
1. Click **Add Offer**
2. Enter the **offer name** and **description** (the AI will use this text when presenting the offer)
3. Set a **discount** (percentage or fixed amount) or describe the offer conditions
4. Set a **validity period** (start and end date)
5. Toggle it as **Active**
6. Click **Save**

The AI automatically includes active offers when customers ask about promotions, discounts, or special prices.`,
    keywords: 'offers,promotions,discounts,deals,special prices,sale,coupon',
  },
  {
    order: 430,
    category: 'E-commerce',
    question: 'How do I add services to the catalog?',
    answer: `Go to **Menu > E-commerce > Services**.

Services work like products but represent non-physical items (e.g. consultations, repair services, subscriptions, professional services).

To add a service:
1. Click **Add Service**
2. Enter the **name**, **description**, and **price**
3. If you want customers to **book appointments** for this service, toggle **Enable Booking** (requires calendar booking to be active in Settings)
4. Set **Duration** and **buffer time** (if bookable)
5. Toggle it as **Active** and click **Save**

The AI can present services, take orders, and — if booking is enabled — guide customers through scheduling an appointment.`,
    keywords: 'services,add service,catalog,professional service,consultation,subscription',
  },
  {
    order: 440,
    category: 'E-commerce',
    question: 'How do I view and manage customer orders?',
    answer: `Go to **Menu > E-commerce > Orders**.

Here you can see all orders placed by customers through the chatbot:
- Filter by **status**: Pending, Confirmed, Shipped, Completed, Cancelled
- Click an order to see full details (customer, items, total, timestamps)
- Update the **order status** manually
- View the **conversation** that generated the order

Orders are created automatically when a customer completes the checkout flow in WhatsApp or the widget.`,
    keywords: 'orders,manage orders,order status,checkout,customer orders,confirm',
  },

  // ─── APPOINTMENT BOOKING ─────────────────────────────────────────────────
  {
    order: 500,
    category: 'Appointment Booking',
    question: 'What is the appointment booking feature and how does it work?',
    answer: `The appointment booking feature lets customers **book, modify, and cancel appointments directly via WhatsApp or the website widget** — all managed automatically by the AI.

**How it works:**
1. A customer asks to book an appointment (e.g. "I'd like to schedule a haircut")
2. The AI checks your available time slots based on your business hours
3. It presents available options and collects customer info
4. The appointment is confirmed and saved
5. The customer receives automatic WhatsApp **reminders** before the appointment

You manage all booked appointments from **Menu > Appointments**.

Optionally, sync with **Google Calendar** so booked appointments appear alongside your personal events.`,
    keywords: 'appointment booking,calendar,book appointment,scheduling,reserve,slot',
  },
  {
    order: 510,
    category: 'Appointment Booking',
    question: 'How do I enable calendar booking for my workspace?',
    answer: `Go to **Menu > Settings** and scroll to the **Calendar & Booking** section.

1. Toggle **Enable Calendar Booking** to ON
2. Click **Save**

Once enabled:
- The **Appointments** menu appears in the sidebar (with sub-pages: Booked Appointments, Appointment Types, Business Hours, Blackout Periods)
- Your services with "Enable Booking" active become bookable via chat
- The AI agent starts offering appointment scheduling to customers

⚠️ **Important**: Before enabling, make sure you have at least one **bookable service** configured and your **business hours** set up.`,
    keywords: 'enable booking,activate calendar,calendar booking,enable appointments,setup',
  },
  {
    order: 520,
    category: 'Appointment Booking',
    question: 'How do I set up bookable services (appointment types)?',
    answer: `Go to **Menu > E-commerce > Services** and edit an existing service (or add a new one).

In the service settings:
1. Toggle **Enable for Booking** to ON
2. Set the **Duration** (in minutes, e.g. 30, 60, 90)
3. Set the **Buffer Time** (minutes between appointments, e.g. 15 min to prepare)
4. Save the service

The service will now appear as a bookable option when customers ask to schedule an appointment.

You can also manage appointment types directly from **Menu > Appointments > Appointment Types**.`,
    keywords: 'appointment types,bookable service,duration,buffer,service booking,setup',
  },
  {
    order: 530,
    category: 'Appointment Booking',
    question: 'How do I configure my business hours for appointment booking?',
    answer: `Go to **Menu > Appointments > Business Hours**.

Here you set your weekly availability:
1. For each day of the week, toggle it **open** or **closed**
2. For open days, set the **start time** and **end time**
3. You can add multiple time slots per day (e.g. 9:00–13:00 and 15:00–18:00)
4. Click **Save**

The AI will only offer appointment slots that fall within these hours. Customers cannot book outside of your configured availability.`,
    keywords: 'business hours,working hours,availability,schedule,open hours,weekdays',
  },
  {
    order: 540,
    category: 'Appointment Booking',
    question: 'How do I block dates when appointments cannot be booked?',
    answer: `Go to **Menu > Appointments > Blackout Periods**.

Blackout periods let you block off specific dates or date ranges (holidays, vacations, closures):
1. Click **Add Blackout Period**
2. Enter a **start date** and **end date**
3. Add an optional **description** (e.g. "Christmas holiday")
4. Click **Save**

No appointments can be booked on those dates — the AI will inform customers and suggest alternative dates.`,
    keywords: 'blackout,holidays,vacation,unavailable,block dates,closure,no appointments',
  },
  {
    order: 550,
    category: 'Appointment Booking',
    question: 'How do I connect Google Calendar to sync appointments?',
    answer: `Go to **Menu > Settings** → **Calendar & Booking** section.

1. Click **Connect Google Calendar**
2. You will be redirected to Google's login page — authorize eChatbot to access your calendar
3. Once connected, the status will show **"Connected"** with your Google account email
4. All new appointments booked through eChatbot will automatically appear in your Google Calendar

To disconnect, click **Disconnect** in the same section.

⚠️ **Note**: Google Calendar sync is optional. Appointments work without it — you can manage them from Menu > Appointments.`,
    keywords: 'google calendar,sync,calendar integration,connect,google,oauth',
  },
  {
    order: 560,
    category: 'Appointment Booking',
    question: 'How do I view and manage booked appointments?',
    answer: `Go to **Menu > Appointments > Booked Appointments**.

Here you can see all scheduled appointments:
- Filter by **date**, **status** (pending, confirmed, completed, cancelled)
- Click an appointment to see details (customer name, service, date/time)
- **Cancel** an appointment — the customer is automatically notified via WhatsApp
- View the **conversation** that created the booking

You can also view appointments in your **Google Calendar** if you have connected it in Settings.`,
    keywords: 'view appointments,manage appointments,cancel appointment,booked,schedule',
  },
  {
    order: 570,
    category: 'Appointment Booking',
    question: 'Does the chatbot send automatic appointment reminders?',
    answer: `Yes! eChatbot sends **automatic WhatsApp reminders** before each appointment.

How it works:
- Reminders are sent based on the configured schedule (e.g. 24 hours before and 1 hour before)
- The customer receives a WhatsApp message with the appointment details and a confirmation/cancellation option
- Reminders run automatically — no manual action needed

The reminder system is powered by the background scheduler that runs 24/7.`,
    keywords: 'reminders,appointment reminders,notifications,whatsapp reminder,automatic,schedule',
  },

  // ─── CAMPAIGNS ──────────────────────────────────────────────────────────
  {
    order: 600,
    category: 'Campaigns',
    question: 'How do I create a push campaign?',
    answer: `Go to **Menu > Campaigns**.

To send a broadcast message to your customers:
1. Click **New Campaign**
2. Write your **message** (plain text or with formatting)
3. Choose the **target audience**: all customers, or filter by tag or language
4. Set a **scheduled date and time** or send immediately
5. Click **Send** (or **Schedule**)

After sending, you can monitor **delivery rate** and **response rate** in the campaign detail page.

⚠️ **Note**: WhatsApp campaigns require customers to have an active conversation (24h window) or use approved message templates according to WhatsApp policy.`,
    keywords: 'campaign,push notification,broadcast,send message,marketing,mass message',
  },
  {
    order: 610,
    category: 'Campaigns',
    question: 'How do I target specific customers with a campaign?',
    answer: `When creating a campaign, use the **Target Audience** filters:

- **All customers** — sends to everyone who has ever chatted with you
- **By tag** — filter by tags you've added to customers (e.g. "VIP", "trial", "italian")
- **By language** — target only customers who chat in a specific language

To use tag-based targeting effectively, first **add tags to your customers** from:
- **Menu > Customers** → open a customer profile → Add Tag
- Or from the **Chat panel** → click the customer name → Add Tag

Tags let you segment your audience and send highly relevant campaigns to specific groups.`,
    keywords: 'target,segment,audience,filter,tag,campaign targeting,customers',
  },

  // ─── TEAM & OPERATORS ───────────────────────────────────────────────────
  {
    order: 700,
    category: 'Team & Operators',
    question: 'How do I invite a team member to my workspace?',
    answer: `Go to **Menu > Team Collaboration** (accessible from the top navigation bar).

Steps:
1. Click **Invite Member**
2. Enter their **email address**
3. Choose their **role**:
   - **SUPER_ADMIN** — full access including billing
   - **ADMIN** — full access except billing
   - **MEMBER** — can view and respond to chats only
4. Click **Send Invitation**

They will receive an email with a registration link. Once they create their account, they can access your workspace with the assigned permissions.`,
    keywords: 'invite,team,member,user,role,permission,admin,collaborate,add user',
  },
  {
    order: 710,
    category: 'Team & Operators',
    question: 'How do I configure human operator escalation?',
    answer: `Go to **Menu > Settings > Human Support**.

Here you can:
- **Enable/disable** human support for your workspace
- Set the **escalation message** shown to customers when they request a human (supports variables like **{{agentName}}**, **{{agentPhone}}**)
- Choose the **notification method**: EMAIL or WHATSAPP for operator alerts
- Write custom **escalation rules** (under what conditions the AI should offer human support)

When a customer requests human assistance:
1. The conversation is escalated and appears in **Menu > Support**
2. The assigned operator receives a notification
3. The operator can reply directly from the dashboard`,
    keywords: 'human support,operator,escalation,handoff,agent,contact,settings,live chat',
  },
  {
    order: 720,
    category: 'Team & Operators',
    question: 'How do I view and manage conversations that need human support?',
    answer: `Go to **Menu > Support**.

The Support view shows all conversations where a customer has requested human assistance or where the chatbot has escalated:

- See the **waiting time** for each open conversation
- Click a chat to **open it and reply** directly
- **Reassign** conversations to a specific team member
- Mark conversations as **resolved** when done

You can configure email notifications for new escalations in **Settings > Human Support**.`,
    keywords: 'support,queue,tickets,human,operator,waiting,escalation,resolve,handoff',
  },
  {
    order: 730,
    category: 'Team & Operators',
    question: 'How do I block a customer from interacting with the chatbot?',
    answer: `Go to **Menu > Customers (Clients)**, find the customer and open their profile.

Click the **Block** button (or use the three-dot menu → Block):
- A blocked customer's messages are received but NOT processed by the AI
- Their existing conversation history remains visible
- You can **unblock** them at any time from the same profile

Blocking is applied to that specific phone number / contact identifier only.

This is useful for preventing spam or blocking abusive users.`,
    keywords: 'block,ban,customer,prevent,stop,spam,blacklist,unblock',
  },

  // ─── CUSTOMER MANAGEMENT ────────────────────────────────────────────────
  {
    order: 800,
    category: 'Customers',
    question: 'How do I view customer profiles and conversation history?',
    answer: `Go to **Menu > Chat History** to see all conversations, or go to **Menu > Clients** for a customer list view.

From the **Chat** view you can:
- Filter conversations by date, language, or status
- Click any conversation to read the full chat history (including AI and human messages)
- See customer details (phone number, name, language, tags) in the right panel

From the **Clients** view you can:
- Search customers by name or phone number
- View individual profiles with full history
- Add/remove tags and notes`,
    keywords: 'customers,chat history,conversation history,profiles,clients,view,search',
  },
  {
    order: 810,
    category: 'Customers',
    question: 'How do I add tags to a customer?',
    answer: `You can add tags from two places:

**Option 1 — From the Clients page:**
1. Go to **Menu > Clients**
2. Find the customer and click their name
3. In the profile panel, click **Add Tag**
4. Type the tag name (e.g. VIP, prospect, italian) and confirm

**Option 2 — From the Chat:**
1. Open a conversation in **Menu > Chat History**
2. Click the customer name in the right panel
3. Add or remove tags directly

Tags are used to **filter campaigns** and **segment your audience**. You can use any tag name you like.`,
    keywords: 'tags,label,segment,customer,audience,filter,vip,add tag',
  },

  // ─── CUSTOM TOOLS ───────────────────────────────────────────────────────
  {
    order: 900,
    category: 'Custom Tools',
    question: 'What are Custom Tools (Calling Functions) and what can I do with them?',
    answer: `Custom Tools allow the chatbot to call your **external systems** via webhook during a conversation — for example:
- Check real-time stock availability
- Look up order status from your ERP
- Verify a customer's loyalty points
- Trigger an action in your CRM

Go to **Menu > Settings > Custom Tools** to view and manage tools.

The AI automatically decides when to call a tool based on the conversation context. No hardcoded keywords needed — the AI understands intent.`,
    keywords: 'calling functions,custom tools,webhook,api,integration,external,crm,erp',
  },
  {
    order: 910,
    category: 'Custom Tools',
    question: 'How do I create a custom webhook integration?',
    answer: `Go to **Menu > Settings > Custom Tools**.

To create a new tool:
1. Click **Add Tool**
2. Enter a **name** that describes what the tool does (e.g. check_stock, get_order_status)
3. Enter the **webhook URL** of your API endpoint
4. Set the **HTTP method** (GET or POST)
5. Define the **parameters** the AI will collect from the conversation and pass to your API
6. Click **Save**

When a customer asks a relevant question, the AI will call your endpoint, receive the response, and include it in its answer — all transparently.

Your endpoint should return a JSON response that the AI can read.`,
    keywords: 'webhook,api,custom tool,create,integration,endpoint,parameters',
  },

  // ─── ANALYTICS ──────────────────────────────────────────────────────────
  {
    order: 950,
    category: 'Analytics',
    question: 'What analytics and reports are available in the dashboard?',
    answer: `Go to **Menu > Analytics**.

The analytics dashboard shows:
- **Total conversations** and daily trends
- **Messages sent/received** over time
- **Chatbot vs human response** breakdown
- **Top FAQ answers** used by the AI
- **Language distribution** of your customers
- **Campaign performance** (delivery and response rates)
- **Appointment stats** (if booking is enabled)

You can filter all data by **date range**.

⚠️ Analytics are updated in near real-time. For historical reporting, use the export feature.`,
    keywords: 'analytics,statistics,reports,dashboard,metrics,performance,data',
  },

  // ─── BILLING ────────────────────────────────────────────────────────────
  {
    order: 1000,
    category: 'Billing',
    question: 'What plans does eChatbot offer and how is pricing calculated?',
    answer: `eChatbot offers **three plans** based on your business size:

- **Starter** — ideal for small businesses just getting started
- **Premium** — for growing businesses with higher conversation volume
- **Enterprise** — custom SLAs, concierge onboarding, dedicated support

Pricing is **usage-based**: a fixed monthly platform fee, plus credits consumed per message and conversation.

👉 See full features and current prices: <a href="https://www.echatbot.ai/pricing" target="_blank">www.echatbot.ai/pricing</a>

Not sure which plan fits you? Take our 2-minute survey: <a href="https://www.echatbot.ai/survey" target="_blank">www.echatbot.ai/survey</a>`,
    keywords: 'pricing,plans,starter,premium,enterprise,costs,subscription,price',
  },
  {
    order: 1010,
    category: 'Billing',
    question: 'Where do I see my credit balance and how do I add credits?',
    answer: `Go to **Menu > Billing**.

Here you can:
- See your **current credit balance** and recent usage history
- View your **active plan** (Starter, Premium, Enterprise)
- **Add credits** via credit card or PayPal — credits are added to your balance immediately
- Download **monthly invoices**

⚠️ You'll receive an **email alert** automatically when your balance is running low.

Credits are consumed per message sent/received. The rate depends on your plan — see your account for exact rates.`,
    keywords: 'billing,credits,balance,top up,add credits,invoice,payment,recharge',
  },
  {
    order: 1020,
    category: 'Billing',
    question: 'What payment methods are accepted for subscriptions and credits?',
    answer: `We accept the following payment methods:

- **Credit cards** (Visa, Mastercard)
- **PayPal**
- **SEPA bank transfer** (for EU customers)
- **Invoicing with 30-day terms** (Enterprise plans only)

All payments are processed securely. Credits are added to your account immediately after payment confirmation.`,
    keywords: 'payment,credit card,paypal,sepa,invoice,payment methods,how to pay',
  },
  {
    order: 1030,
    category: 'Billing',
    question: 'Can I cancel my subscription at any time?',
    answer: `Yes. You can cancel your subscription at any time from **Menu > Billing**.

- Monthly plans end at the end of the current billing cycle — no refund for unused days
- Annual plans may have different cancellation terms — see your contract
- No cancellation fees
- Your workspace data is **retained for 30 days** after cancellation — contact us if you need to export it
- You can reactivate at any time

For Enterprise cancellations, please contact your account manager directly.`,
    keywords: 'cancel,cancellation,subscription,stop,end,billing,refund',
  },

  // ─── SECURITY & PRIVACY ──────────────────────────────────────────────────
  {
    order: 1100,
    category: 'Security & Privacy',
    question: 'Where is data hosted and is it GDPR compliant?',
    answer: `All data is hosted in the **European Union** on secure cloud infrastructure.

- Data is **encrypted at rest and in transit** (TLS 1.2+)
- **Multi-tenant isolation**: each workspace's data is strictly separated
- **Role-based access control** — team members only see what their role permits
- **GDPR compliant** — data minimization, right to erasure, and audit logging implemented
- Regular backups with automated disaster recovery

For full details, see our <a href="https://echatbot.ai/privacy" target="_blank">Privacy Policy</a>.`,
    keywords: 'gdpr,data,privacy,hosting,eu,security,encryption,compliant',
  },
  {
    order: 1110,
    category: 'Security & Privacy',
    question: 'What happens to customer conversation data?',
    answer: `Customer conversations are:
- Stored **encrypted** in our EU servers
- **NOT used to train AI models** — your data is yours
- Processed through AI APIs (OpenRouter/OpenAI) only to generate responses, using enterprise-grade encrypted connections
- Retained for the duration of your subscription, plus 30 days after cancellation
- Deletable on request (GDPR right to erasure)

For the full data processing details, read our <a href="https://echatbot.ai/privacy" target="_blank">Privacy Policy</a>.`,
    keywords: 'data privacy,conversation data,ai training,gdpr,delete,retention,storage',
  },

  // ─── SUPPORT ─────────────────────────────────────────────────────────────
  {
    order: 1200,
    category: 'Support',
    question: 'How do I contact eChatbot support?',
    answer: `You can reach our support team in several ways:

- **This chat** (you're already here!) — ask any question and we'll help
- **Email**: support@echatbot.ai
- **Website**: <a href="https://www.echatbot.ai" target="_blank">www.echatbot.ai</a>

For dedicated support, Enterprise clients have access to a personal account manager and a dedicated Slack channel.

Our team speaks **Italian, English, Spanish, and Portuguese**.`,
    keywords: 'contact,support,help,email,how to reach,get help',
  },
  {
    order: 1210,
    category: 'Support',
    question: 'What are the support response times?',
    answer: `Response times depend on your plan:

| Plan | Response Time | Channel |
|------|--------------|---------|
| **Starter** | 24 hours | Email |
| **Premium** | 4 hours | Email + Live Chat |
| **Enterprise** | 1 hour | Dedicated Slack + Phone (business hours) |

All plans include access to this chatbot support 24/7.

To speak with a human consultant in this chat, just ask "I'd like to speak to an agent" and we'll connect you during business hours.`,
    keywords: 'response time,sla,support hours,priority,how fast,reply',
  },
  {
    order: 1220,
    category: 'Support',
    question: 'Posso avere supporto in italiano?',
    answer: `Sì, assolutamente! Il nostro team è basato in Italia e offre supporto completo in **italiano, inglese, spagnolo e portoghese**.

Non sei sicuro se eChatbot fa al caso tuo? Compila il nostro breve sondaggio (2 minuti) e ti risponderemo con una proposta su misura: <a href="https://www.echatbot.ai/survey" target="_blank">www.echatbot.ai/survey</a>

Puoi anche scriverci direttamente a: **support@echatbot.ai**`,
    keywords: 'italiano,italiano supporto,supporto italiano,lingua,italiano help',
  },

  // ─── PREZZI E PIANI (IT) ─────────────────────────────────────────────────
  {
    order: 1230,
    category: 'Prezzi e Piani',
    question: 'Quanto costa eChatbot? Quali sono i piani disponibili?',
    answer: `eChatbot offre tre piani:

- **Starter** — ideale per piccole imprese che vogliono iniziare
- **Premium** — per aziende in crescita con volumi più elevati
- **Enterprise** — SLA personalizzati, onboarding dedicato, supporto prioritario

Il prezzo è **basato sull'utilizzo**: una fee mensile fissa + crediti consumati per messaggi e conversazioni.

👉 Vedi tutti i prezzi aggiornati: <a href="https://www.echatbot.ai/pricing" target="_blank">www.echatbot.ai/pricing</a>

Hai dubbi su quale piano fa al caso tuo? Rispondi al nostro sondaggio (2 minuti): <a href="https://www.echatbot.ai/survey" target="_blank">www.echatbot.ai/survey</a>`,
    keywords: 'prezzi,costi,piani,abbonamento,starter,premium,enterprise,quanto costa',
  },
  {
    order: 1240,
    category: 'Prezzi e Piani',
    question: 'Cosa include il piano Starter?',
    answer: `Il piano **Starter** è pensato per le piccole imprese che vogliono iniziare ad automatizzare WhatsApp con semplicità.

Include:
- Chatbot AI su WhatsApp e widget web
- Catalogo prodotti/servizi (fino a 500 voci)
- Gestione ordini base
- FAQ knowledge base
- Campagne broadcast
- Supporto email entro 24h

Per i dettagli aggiornati e i limiti esatti del piano: <a href="https://www.echatbot.ai/pricing" target="_blank">www.echatbot.ai/pricing</a>`,
    keywords: 'starter,piano base,piano starter,incluso,funzionalità starter',
  },
  {
    order: 1250,
    category: 'Prezzi e Piani',
    question: 'Cosa include il piano Premium?',
    answer: `Il piano **Premium** è per le aziende in crescita che hanno volumi di conversazioni più elevati e necessitano di funzionalità avanzate.

Include tutto lo Starter, più:
- Catalogo prodotti esteso (fino a 5.000 voci)
- Booking appuntamenti con promemoria automatici
- Integrazione Google Calendar
- Supporto live chat con risposta entro 4h
- Analytics avanzate

Per i dettagli aggiornati e i prezzi esatti: <a href="https://www.echatbot.ai/pricing" target="_blank">www.echatbot.ai/pricing</a>`,
    keywords: 'premium,piano premium,funzionalità premium,incluso premium',
  },
  {
    order: 1260,
    category: 'Prezzi e Piani',
    question: 'Cosa include il piano Enterprise?',
    answer: `Il piano **Enterprise** è dedicato alle grandi organizzazioni che necessitano di personalizzazione, SLA garantiti e supporto dedicato.

Include tutto il Premium, più:
- Catalogo illimitato con ricerca avanzata
- SLA personalizzati
- Onboarding dedicato (2 settimane di implementazione)
- Account manager dedicato
- Canale Slack dedicato con risposta entro 1h
- Supporto telefonico durante gli orari d'ufficio
- Fatturazione con termini 30 giorni

Contattaci per un preventivo personalizzato: <a href="https://www.echatbot.ai/survey" target="_blank">www.echatbot.ai/survey</a>`,
    keywords: 'enterprise,piano enterprise,grande azienda,sla,account manager,personalizzato',
  },
  {
    order: 1270,
    category: 'Prezzi e Piani',
    question: 'Come funzionano i crediti? Come vengono scalati?',
    answer: `I **crediti** sono la valuta interna di eChatbot. Vengono scalati ogni volta che il chatbot invia o riceve un messaggio.

Come funziona:
- Ogni piano include una quota mensile di crediti
- Se esaurisci i crediti, puoi ricaricare dal menu **Billing**
- I crediti vengono scalati per messaggi WhatsApp inviati, messaggi widget, e invii di campagne push
- Il tasso di consumo dipende dal tuo piano — vedi i dettagli in <a href="https://www.echatbot.ai/pricing" target="_blank">www.echatbot.ai/pricing</a>

⚠️ Ricevi un'email di avviso automatico quando il saldo è in esaurimento.`,
    keywords: 'crediti,come funzionano,scalati,consumo,ricarica,saldo,costo per messaggio',
  },

  // ─── WHATSAPP PROVIDERS (IT + EN) ────────────────────────────────────────
  {
    order: 1300,
    category: 'WhatsApp Providers',
    question: 'What is the difference between Meta API, UltraMsg, and Wasender?',
    answer: `eChatbot supports three WhatsApp providers:

**1. Meta Official API** (recommended for production)
- Direct connection to Meta's infrastructure
- Highest reliability and message throughput
- Requires Meta Business verification (24–48h approval)
- Supports WhatsApp templates for outbound campaigns
- Best for businesses sending >500 messages/day

**2. UltraMsg**
- Third-party gateway — connects your SIM-based WhatsApp number
- No Meta approval needed — works in minutes
- Requires a phone/SIM to remain connected and online
- Lower throughput — suitable for smaller volumes

**3. Wasender**
- Similar to UltraMsg — SIM-based gateway
- Quick setup, good for testing and low-volume use

**Which to choose?**
- Just starting out → UltraMsg (fast setup)
- Scaling up / production → Meta official API`,
    keywords: 'meta,ultramsg,wasender,provider,whatsapp api,difference,which provider,comparison',
  },
  {
    order: 1310,
    category: 'WhatsApp Providers',
    question: 'How do I get approved for Meta WhatsApp Business API?',
    answer: `To use the **Meta official WhatsApp Business API** you need:

1. A **Meta Business Account** — create one at business.facebook.com
2. A **verified phone number** (dedicated, not already used on WhatsApp)
3. A **Facebook App** with WhatsApp product enabled

Steps:
1. Go to <a href="https://developers.facebook.com" target="_blank">developers.facebook.com</a>
2. Create an app → Business → Add WhatsApp product
3. Register your phone number and verify it via SMS/voice call
4. Submit for business verification (takes 24–48h)
5. Once approved, copy your **Phone Number ID**, **Business Account ID**, and **Access Token**
6. Paste these into eChatbot: **Settings > WhatsApp Channel > Meta provider**

💡 Most businesses get approved within 24–48 hours.`,
    keywords: 'meta api,approval,meta business,verification,facebook app,phone number id,access token,setup meta',
  },
  {
    order: 1320,
    category: 'WhatsApp Providers',
    question: 'How do I set up UltraMsg as my WhatsApp provider?',
    answer: `**UltraMsg** lets you connect a regular WhatsApp number (SIM-based) without Meta API approval.

Steps:
1. Go to <a href="https://ultramsg.com" target="_blank">ultramsg.com</a> and create an account
2. Create an **Instance** and scan the QR code with your WhatsApp
3. Copy your **Instance ID** and **Token** from the UltraMsg dashboard
4. In eChatbot go to **Settings > WhatsApp Channel**
5. Select **UltraMsg** as provider
6. Paste the Instance ID, Token, and your phone number
7. Copy the **Webhook URL** from eChatbot and paste it in UltraMsg → Instance → Webhooks

⚠️ Your phone/device with WhatsApp must remain **online and connected** for UltraMsg to work.`,
    keywords: 'ultramsg,setup,qr code,instance id,token,connect,ultramsg setup',
  },
  {
    order: 1330,
    category: 'WhatsApp Providers',
    question: 'Il mio chatbot WhatsApp ha smesso di rispondere. Cosa faccio?',
    answer: `Ecco i controlli da fare in ordine:

**1. Verifica che il canale sia attivo**
Vai in **Impostazioni > Canale WhatsApp** e controlla che il toggle **Canale Attivo** sia ON.

**2. Controlla il provider**
- Se usi **UltraMsg/Wasender**: il telefono con WhatsApp collegato deve essere acceso e connesso a internet. Controlla che la sessione WhatsApp non sia scaduta (riapri il QR code se necessario).
- Se usi **Meta API**: verifica che il tuo **Access Token** non sia scaduto. Rigenera il token da Meta Developer Console.

**3. Controlla il webhook**
Il webhook URL configurato nel tuo provider deve corrispondere esattamente a quello mostrato in eChatbot (Settings > WhatsApp Channel).

**4. Saldo crediti**
Vai in **Billing** e verifica di avere crediti sufficienti.

Se il problema persiste, scrivici a **support@echatbot.ai**.`,
    keywords: 'chatbot non risponde,non funziona,smesso,problemi whatsapp,risoluzione problemi,troubleshooting',
  },

  // ─── WEBSITE WIDGET (expanded) ───────────────────────────────────────────
  {
    order: 1400,
    category: 'Website Widget',
    question: 'Il widget del sito non appare. Come lo risolvo?',
    answer: `Se il widget non compare sul tuo sito, controlla questi punti:

1. **Il codice snippet è installato correttamente?**
   Deve essere incollato **prima del tag </body>** su ogni pagina. Se usi WordPress, puoi usare un plugin "Insert Headers and Footers" o modificare il tema direttamente.

2. **Il canale widget è attivo?**
   Vai in **Impostazioni > Widget Sito Web** e verifica che il toggle **Canale Attivo** sia ON.

3. **Cache del browser**
   Prova a svuotare la cache o aprire la pagina in modalità incognito.

4. **Conflitti JavaScript**
   Verifica nella console del browser (F12 → Console) se ci sono errori JavaScript che bloccano il caricamento del widget.

Se il problema persiste, condividi l'URL del sito con il nostro supporto: **support@echatbot.ai**`,
    keywords: 'widget non appare,non funziona,problemi widget,installazione,snippet,code',
  },
  {
    order: 1410,
    category: 'Website Widget',
    question: 'Can the widget work at the same time as WhatsApp?',
    answer: `Yes! The widget and WhatsApp channel are fully **independent channels** that work simultaneously.

- Both connect to the **same AI chatbot** and knowledge base (FAQs, products, etc.)
- Both connect to the **same customer database** — if a customer contacts you via both channels, their profiles are managed separately but linked to the same workspace
- You can enable/disable each channel independently from its settings page

This means a customer on your website uses the widget, while a customer on their phone uses WhatsApp — and your AI handles both automatically at the same time.`,
    keywords: 'widget and whatsapp,both channels,simultaneous,same time,multichannel',
  },
  {
    order: 1420,
    category: 'Website Widget',
    question: 'Can I embed the widget on multiple websites?',
    answer: `Yes. The same JavaScript snippet can be installed on multiple websites, subdomains, or landing pages.

Each workspace has **one widget** with a single configuration (title, colors, position). All conversations from all your websites with that snippet flow into the same workspace.

If you need **different widgets with different configurations** (e.g. different languages or different brands), you would need separate workspaces.`,
    keywords: 'multiple websites,several sites,widget multiple,domains,subdomains',
  },

  // ─── AI PERSONALITY (expanded) ───────────────────────────────────────────
  {
    order: 1500,
    category: 'AI Personality',
    question: 'Come scrivo un buon messaggio di benvenuto?',
    answer: `Il **messaggio di benvenuto** è il primo messaggio che il chatbot invia a ogni nuovo cliente. È fondamentale per fare una buona prima impressione.

**Consigli pratici:**

✅ Presentati chiaramente: "Ciao! Sono Sofia, l'assistente virtuale di [Nome Azienda] 👋"
✅ Dì subito cosa puoi fare: "Posso aiutarti a scoprire i nostri prodotti, prenotare un appuntamento o rispondere alle tue domande."
✅ Invita all'azione: "Come posso aiutarti oggi?"
✅ Tienilo breve: idealmente 2–3 frasi

❌ Evita messaggi troppo lunghi o generici
❌ Non iniziare con "Come assistente AI..."

Il messaggio di benvenuto si configura in **Menu > Impostazioni > Personalità AI**.`,
    keywords: 'benvenuto,welcome message,primo messaggio,messaggio iniziale,configurare',
  },
  {
    order: 1510,
    category: 'AI Personality',
    question: 'What is the "Identity Response" field and what should I write there?',
    answer: `The **Identity Response** is what the AI says when a customer asks "Who are you?", "Are you a bot?", or "Am I talking to a human?".

**What to write:**
- Be honest but brand it: "I'm Sofia, the virtual assistant of [Your Company]. I'm an AI, but I'm here to help you 24/7 just like a human would!"
- You can include your company's mission: "I'm the digital assistant of Mario's Bakery — I can show you our products, take orders, and answer any question about our store."
- Avoid denying being an AI — this violates WhatsApp policies and erodes customer trust

The identity response is configured in **Settings > AI Personality > Identity Response**.`,
    keywords: 'identity response,chi sei,who are you,sono un bot,are you a bot,identity,identity field',
  },
  {
    order: 1520,
    category: 'AI Personality',
    question: 'Come faccio a far rispondere il chatbot solo in italiano?',
    answer: `Il chatbot di eChatbot **auto-rileva la lingua** del cliente e risponde di conseguenza. Se vuoi limitarlo solo all'italiano:

Aggiungi questa regola in **Impostazioni > Personalità AI > Regole AI personalizzate**:

*"Rispondi sempre e solo in italiano, indipendentemente dalla lingua usata dal cliente."*

⚠️ Nota: questa regola disabilita il supporto multilingua. Considera se il tuo pubblico include clienti stranieri prima di applicarla.

Se vuoi invece rispondere in italiano per default ma supportare altre lingue quando necessario, non aggiungere nessuna regola — il comportamento automatico è già ottimale.`,
    keywords: 'solo italiano,lingua,rispondere italiano,forzare italiano,lingua risposta',
  },
  {
    order: 1530,
    category: 'AI Personality',
    question: 'Posso dare istruzioni specifiche al chatbot per la mia categoria di business?',
    answer: `Sì! Il campo **Regole AI personalizzate** in **Impostazioni > Personalità AI** ti permette di dare qualsiasi istruzione al chatbot.

Esempi per settore:

**Ristorante/Food:**
"Ricorda sempre di chiedere le preferenze alimentari (vegano, senza glutine, allergie) prima di suggerire piatti."

**Studio medico/Estetica:**
"Non fornire mai consigli medici. Per qualsiasi domanda clinica, invita il cliente a contattare direttamente il medico."

**E-commerce abbigliamento:**
"Se il cliente non conosce la taglia, suggerisci sempre di consultare la guida taglie a questo link: [URL]"

**Immobiliare:**
"Prima di mostrare annunci, chiedi sempre il budget e il comune di interesse."

**SaaS/Tech:**
"Per problemi tecnici complessi, raccogli sempre nome, email e descrizione del problema, poi offri di aprire un ticket."`,
    keywords: 'regole,istruzioni,personalizzare,settore,business specific,regole ai,custom instructions',
  },

  // ─── ECOMMERCE (expanded) ────────────────────────────────────────────────
  {
    order: 1600,
    category: 'E-commerce',
    question: 'Come faccio a caricare i prodotti in modo massivo (CSV import)?',
    answer: `Puoi aggiungere prodotti uno alla volta dalla dashboard oppure importarli in massa.

Per l'**importazione CSV**:
1. Vai in **Menu > Prodotti**
2. Cerca il pulsante **Importa CSV** (o "Import")
3. Scarica il template CSV di esempio per vedere il formato richiesto
4. Compila il file con i tuoi prodotti (nome, descrizione, prezzo, categoria, SKU, etc.)
5. Carica il file CSV
6. Revisiona l'anteprima e conferma

**Campi supportati nel CSV**: name, description, price, category, sku, stock, imageUrl, isActive

⚠️ Se hai molti prodotti (500+) considera di suddividere il CSV in batch da 200 per evitare timeout.`,
    keywords: 'importare,csv import,caricamento massivo,bulk,importazione prodotti,tanti prodotti',
  },
  {
    order: 1610,
    category: 'E-commerce',
    question: 'Come il chatbot mostra e vende i prodotti in chat?',
    answer: `Quando un cliente chiede di vedere prodotti, il chatbot:

1. **Interpreta l'intento** — capisce cosa cerca (es. "voglio una scarpa rossa taglia 40")
2. **Cerca nel catalogo** — filtra per nome, categoria, descrizione, prezzo
3. **Presenta i risultati** — invia una lista con nome, prezzo, e descrizione
4. **Gestisce le domande** — risponde a domande su materiali, disponibilità, taglie
5. **Aggiunge al carrello** — quando il cliente dice "lo voglio" o sceglie un numero dalla lista
6. **Gestisce il checkout** — raccoglie indirizzo, conferma l'ordine, invia il link di pagamento

Tutto questo avviene automaticamente senza configurazione aggiuntiva — basta avere i prodotti nel catalogo con descrizioni accurate.`,
    keywords: 'come funziona vendita,mostra prodotti,carrello,checkout,acquisto,comprare,vendere',
  },
  {
    order: 1620,
    category: 'E-commerce',
    question: 'Come integro un sistema di pagamento?',
    answer: `Il chatbot crea il carrello e invia un **link di pagamento sicuro** al cliente. Il cliente clicca il link e completa il pagamento sul tuo gateway preferito.

**Gateway supportati:**
- **Stripe** — il più diffuso, accetta carte di credito internazionali
- **PayPal** — pagamenti via conto PayPal o carta
- **Gateway personalizzato** — puoi configurare il tuo endpoint di pagamento

Per configurare:
1. Vai in **Impostazioni > Pagamenti** (sezione E-commerce)
2. Scegli il provider
3. Inserisci le credenziali API del tuo account
4. Testa con un ordine di prova

⚠️ WhatsApp Pay non è ancora disponibile in tutti i Paesi. Il link di pagamento funziona universalmente.`,
    keywords: 'pagamento,stripe,paypal,gateway,checkout,link pagamento,pagare,integrazione pagamento',
  },
  {
    order: 1630,
    category: 'E-commerce',
    question: 'Come faccio ad aggiornare lo stato di un ordine?',
    answer: `Vai in **Menu > E-commerce > Ordini**.

1. Trova l'ordine (puoi cercare per nome cliente o numero ordine)
2. Clicca sull'ordine per aprire il dettaglio
3. Cambia lo **stato** dal menu a tendina:
   - **In attesa** → **Confermato** → **Spedito** → **Completato**
   - Oppure **Annullato** se necessario
4. Clicca **Salva**

Il cliente **non riceve automaticamente** una notifica al cambio di stato (a meno che tu non abbia configurato una campagna di notifica stato ordine). Puoi contattarlo manualmente dalla sezione Chat.`,
    keywords: 'stato ordine,aggiornare ordine,ordine spedito,ordine completato,gestione ordini',
  },
  {
    order: 1640,
    category: 'E-commerce',
    question: 'What workspace type should I choose: E-commerce or Informational?',
    answer: `When creating your workspace you choose between two types:

**E-commerce**
Choose this if your business sells physical or digital products, and you want the chatbot to:
- Show product catalog and pricing
- Add items to a cart
- Process orders and send payment links
- Manage order status

**Informational**
Choose this if your business provides services, information, or appointments without a product checkout flow. Examples: clinics, law firms, gyms, consultants, restaurants that just want to answer FAQs and take bookings.

The Informational type still supports appointment booking, FAQ answers, human support escalation, and campaigns — just without the e-commerce catalog and cart features.

You can change your workspace type anytime from **Settings > Business Config**.`,
    keywords: 'workspace type,ecommerce,informational,tipo workspace,scegliere,qual è la differenza',
  },

  // ─── CHAT & CONVERSAZIONI ─────────────────────────────────────────────────
  {
    order: 1700,
    category: 'Chat e Conversazioni',
    question: 'Come funziona la sezione Chat? Dove vedo le conversazioni?',
    answer: `Vai in **Menu > Chat (Chat History)**.

Qui trovi tutte le conversazioni dei tuoi clienti, ordinate per data. Puoi:

- **Cercare** per nome cliente, numero di telefono, o testo del messaggio
- **Filtrare** per lingua, data, stato (attiva, chiusa, in attesa operatore)
- **Cliccare** su una conversazione per leggerla integralmente
- Vedere in tempo reale i messaggi in arrivo (con aggiornamento automatico)
- Nel pannello di destra: dettagli cliente, tag, note operative

I messaggi del chatbot AI sono distinguibili dai messaggi dell'operatore umano con un'apposita etichetta.`,
    keywords: 'chat,conversazioni,storico chat,messaggi,dove vedo,chat history,conversazione',
  },
  {
    order: 1710,
    category: 'Chat e Conversazioni',
    question: 'Posso scrivere manualmente a un cliente dal pannello?',
    answer: `Sì. Puoi inviare messaggi ai tuoi clienti direttamente dalla dashboard.

Come fare:
1. Vai in **Menu > Chat**
2. Apri la conversazione del cliente
3. Scrivi il tuo messaggio nel campo di testo in basso
4. Premi Invio o clicca **Invia**

Il messaggio viene recapitato al cliente via WhatsApp (o widget) esattamente come se arrivasse dall'AI.

⚠️ Attenzione: WhatsApp permette di inviare messaggi liberi solo entro la **finestra di 24 ore** dall'ultimo messaggio del cliente. Fuori da questa finestra devi usare un **template approvato** (solo Meta API).`,
    keywords: 'scrivere manualmente,messaggio manuale,rispondere,inviare messaggio,operatore scrive',
  },
  {
    order: 1720,
    category: 'Chat e Conversazioni',
    question: 'Come faccio a chiudere o archiviare una conversazione?',
    answer: `Le conversazioni rimangono visibili nella lista Chat finché non le archivi manualmente.

Per chiudere/archiviare:
1. Apri la conversazione in **Menu > Chat**
2. Clicca il pulsante **Chiudi** o **Archivia** (di solito nell'angolo in alto a destra del pannello chat)

Le conversazioni archiviate rimangono visibili nei filtri ma non appariranno nella lista principale attiva.

Nelle conversazioni di **supporto umano escalate**, usa il pulsante **Risolto** in **Menu > Support** per chiuderle formalmente e notificare il cliente.`,
    keywords: 'chiudere,archiviare,chiudi chat,archivia conversazione,risolvere',
  },
  {
    order: 1730,
    category: 'Chat e Conversazioni',
    question: 'Il cliente può cancellare la sua conversazione o i suoi dati?',
    answer: `Il cliente non ha un accesso diretto alla dashboard per cancellare i dati.

Tuttavia, per rispettare il **GDPR (diritto alla cancellazione)**:
1. Il cliente ti contatta e richiede la cancellazione dei propri dati
2. Vai in **Menu > Clienti**, trova il profilo del cliente
3. Puoi **eliminare il profilo** del cliente — questo cancella nome, telefono, e metadati
4. Lo storico messaggi può essere eliminato separatamente (contatta il nostro supporto se hai bisogno di cancellazioni massive)

⚠️ Una volta eliminato, il profilo non è recuperabile. L'eliminazione è permanente.`,
    keywords: 'cancellare dati,gdpr,diritto cancellazione,eliminare cliente,privacy,delete data',
  },

  // ─── HUMAN IN THE LOOP ───────────────────────────────────────────────────
  {
    order: 1800,
    category: 'Human in the Loop',
    question: 'Come funziona il passaggio a un operatore umano?',
    answer: `Il sistema di **human in the loop** permette al chatbot di passare la conversazione a un operatore reale quando necessario.

**Quando avviene l'escalation:**
- Il cliente chiede esplicitamente di parlare con un umano ("voglio parlare con una persona")
- L'AI non riesce a gestire la richiesta e la scala automaticamente
- L'operatore può prendere in carico proattivamente qualsiasi chat

**Flusso:**
1. Il cliente richiede un operatore
2. Il chatbot risponde con il messaggio di escalation configurato (es. "Ti sto connettendo con uno dei nostri operatori. Riceverai risposta a breve.")
3. La conversazione appare in **Menu > Support** con stato "In attesa"
4. L'operatore riceve una notifica (email o WhatsApp) e prende in carico la chat
5. L'operatore risponde dalla dashboard
6. Quando il problema è risolto, segna la conversazione come **Risolta**`,
    keywords: 'operatore umano,human in the loop,escalation,passaggio,live agent,human handoff',
  },
  {
    order: 1810,
    category: 'Human in the Loop',
    question: 'Come ricevo la notifica quando un cliente chiede un operatore?',
    answer: `Vai in **Impostazioni > Supporto Umano** per configurare le notifiche.

Puoi scegliere il metodo di notifica:
- **Email** — ricevi un'email all'indirizzo configurato ogni volta che un cliente richiede un operatore
- **WhatsApp** — ricevi un messaggio WhatsApp di notifica all'operatore designato

Il messaggio di notifica include:
- Nome/numero del cliente
- Un riassunto AI della conversazione (in 1 frase)
- Link diretto per aprire la chat dalla dashboard

Assicurati di configurare correttamente l'**email operatore** o il **numero WhatsApp operatore** nelle impostazioni.`,
    keywords: 'notifica operatore,alert,avviso,ricevere notifica,email operatore,supporto notifiche',
  },
  {
    order: 1820,
    category: 'Human in the Loop',
    question: 'The AI keeps escalating to human even for simple questions. How do I fix this?',
    answer: `If the AI escalates too frequently, it usually means:

1. **FAQ knowledge gaps** — the AI can't find an answer and defaults to escalation
   → Fix: Add more relevant FAQs in **Menu > FAQ**

2. **Escalation rules too broad** — the custom escalation rules in Settings > Human Support are triggering too easily
   → Fix: Review and tighten the escalation rules. Be specific about WHEN to escalate (e.g. "Escalate only when the customer mentions a formal complaint or requests a refund")

3. **Custom AI rules conflict** — a rule you wrote is causing the AI to give up too quickly
   → Fix: Review **Settings > AI Personality > Custom AI Rules**

4. **Products/Services not in catalog** — customers ask about things the AI doesn't know
   → Fix: Update your product/service catalog and FAQ with the missing information`,
    keywords: 'too many escalations,escalates too often,ai escalation,fix escalation,human support too much',
  },
  {
    order: 1830,
    category: 'Human in the Loop',
    question: 'Posso avere più operatori che gestiscono le chat di supporto?',
    answer: `Sì. Puoi invitare tutti gli operatori che vuoi nella tua workspace.

1. Vai in **Menu > Team** (dalla barra di navigazione)
2. Invita i tuoi operatori con email e ruolo **MEMBER** o **ADMIN**
3. Una volta che accettano l'invito, possono accedere a **Menu > Support** e prendere in carico le chat

**Visibilità**: tutti gli operatori con accesso alla workspace vedono le stesse conversazioni in coda. Puoi riassegnare manualmente una chat a un operatore specifico dalla vista Support.

**Consiglio**: definisci chi è responsabile per le chat in un certo orario, per evitare che nessuno risponda o che rispondano tutti contemporaneamente.`,
    keywords: 'più operatori,team operatori,gestire chat,assegnare chat,operatori multipli',
  },

  // ─── CAMPAGNE PUSH ────────────────────────────────────────────────────────
  {
    order: 1900,
    category: 'Campagne Push',
    question: 'Cosa sono le campagne push e a cosa servono?',
    answer: `Le **campagne push** ti permettono di inviare messaggi broadcast di marketing in **uscita** a tutti (o parte) dei tuoi clienti WhatsApp.

Casi d'uso tipici:
- Annunciare una **promozione** o un'offerta a tempo
- Inviare un **reminder** (es. "Il tuo appuntamento è domani")
- Comunicare una **novità** (nuovo prodotto, apertura domenicale, cambio orari)
- Fidelizzazione: auguri di compleanno, messaggi di ringraziamento
- Re-engagement: ricontattare clienti inattivi

Vai in **Menu > Campagne** per creare e gestire le tue campagne.

⚠️ Le campagne WhatsApp funzionano solo con clienti che hanno già avviato una conversazione con te nelle ultime 24 ore, oppure tramite template approvati Meta (per Meta API).`,
    keywords: 'campagne push,broadcast,marketing,promozione,inviare a tutti,notifiche push,messaggi uscita',
  },
  {
    order: 1910,
    category: 'Campagne Push',
    question: 'Posso pianificare l\'invio di una campagna per una data futura?',
    answer: `Sì! Quando crei una campagna puoi scegliere se inviarla **subito** o **programmarla**.

Come programmare:
1. Vai in **Menu > Campagne > Nuova Campagna**
2. Scrivi il messaggio
3. Scegli il pubblico target
4. Alla sezione data/ora, seleziona **Programma** invece di **Invia ora**
5. Imposta data e ora di invio
6. Clicca **Programma**

La campagna verrà inviata automaticamente alla data e ora impostata — non devi essere online.

Puoi vedere e annullare le campagne programmate dall'elenco campagne (stato: "Schedulata").`,
    keywords: 'programmare campagna,schedulare,data futura,invio automatico,schedule,timing',
  },
  {
    order: 1920,
    category: 'Campagne Push',
    question: 'Come personalizzo il messaggio di una campagna con il nome del cliente?',
    answer: `Puoi usare **variabili di personalizzazione** nel testo della campagna.

Variabili disponibili:
- \`{{nomeCliente}}\` — nome del cliente (se disponibile nel profilo)
- \`{{nomeAzienda}}\` — nome della tua workspace

Esempio:
*"Ciao {{nomeCliente}}! 👋 Abbiamo una promozione speciale per te: 20% di sconto su tutti i prodotti questo weekend. Non perdertela!"*

Se il nome del cliente non è disponibile, la variabile viene sostituita con una stringa vuota o con un valore di fallback — per sicurezza, scrivi i messaggi in modo che abbiano senso anche senza il nome.`,
    keywords: 'personalizzare campagna,nome cliente,variabili,personalizzazione,nome utente in campagna',
  },
  {
    order: 1930,
    category: 'Campagne Push',
    question: 'Perché alcuni clienti non ricevono la mia campagna?',
    answer: `Ci sono diverse ragioni per cui un cliente potrebbe non ricevere una campagna:

1. **Finestra 24h WhatsApp** — WhatsApp permette messaggi liberi solo a clienti che hanno scritto nelle ultime 24h. Fuori da questa finestra, il messaggio non viene consegnato (solo con Meta API + template approvato è possibile raggiungerli).

2. **Cliente bloccato** — se il cliente ha bloccato il tuo numero WhatsApp, il messaggio non verrà consegnato.

3. **Filtri pubblico** — se hai usato un filtro (per tag o lingua), solo i clienti che corrispondono ai criteri ricevono la campagna.

4. **Numero non raggiungibile** — il numero del cliente era spento o fuori servizio al momento dell'invio.

Controlla le statistiche della campagna (tasso di consegna) nel dettaglio della campagna dopo l'invio.`,
    keywords: 'campagna non ricevuta,non consegnata,deliverability,perché non arriva,finestra 24h',
  },

  // ─── BOOKING APPUNTAMENTI (expanded) ────────────────────────────────────
  {
    order: 2000,
    category: 'Booking Appuntamenti',
    question: 'Come il cliente prenota un appuntamento via WhatsApp?',
    answer: `Il cliente **non deve fare nulla di speciale** — basta che scriva un messaggio come:

- "Vorrei prenotare un appuntamento"
- "Sono disponibile lunedì pomeriggio per un taglio"
- "Puoi fissarmi una consulenza per martedì?"

Il chatbot gestisce automaticamente il flusso:
1. Chiede il **tipo di servizio** desiderato (se ce ne sono più di uno)
2. Mostra le **date e fasce orarie disponibili** basandosi sui tuoi orari apertura e gli appuntamenti già prenotati
3. Il cliente **sceglie** data e ora
4. Raccoglie la **conferma** e salva la prenotazione
5. Invia un **messaggio di conferma** con i dettagli

Il cliente riceverà automaticamente **promemoria WhatsApp** prima dell'appuntamento.`,
    keywords: 'come prenota,flusso prenotazione,cliente prenota,booking flow,come funziona prenotazione',
  },
  {
    order: 2010,
    category: 'Booking Appuntamenti',
    question: 'Il cliente può cancellare o modificare un appuntamento via chat?',
    answer: `Sì. Il chatbot gestisce anche le modifiche e le cancellazioni.

Il cliente può scrivere:
- "Voglio cancellare il mio appuntamento"
- "Posso spostare l'appuntamento di domani a giovedì?"

Il chatbot:
1. Trova l'appuntamento esistente del cliente
2. Lo cancella o propone nuove date disponibili per la modifica
3. Conferma la variazione e aggiorna il calendario

Come admin, puoi anche cancellare o modificare appuntamenti manualmente da **Menu > Appuntamenti > Appuntamenti Prenotati**.`,
    keywords: 'cancellare appuntamento,modificare appuntamento,spostare,disdire,cambio appuntamento',
  },
  {
    order: 2020,
    category: 'Booking Appuntamenti',
    question: 'Come configuro i promemoria automatici per gli appuntamenti?',
    answer: `I promemoria sono **automatici** — non devi configurare nulla di speciale dopo aver abilitato il booking.

Il sistema invia promemoria WhatsApp:
- **24 ore prima** dell'appuntamento
- **1–2 ore prima** dell'appuntamento (dipende dalla configurazione)

Il messaggio di promemoria include:
- Data e ora dell'appuntamento
- Tipo di servizio prenotato
- Opzione per confermare o cancellare

I promemoria vengono gestiti dal **scheduler di background** che gira 24/7 automaticamente.

Se i promemoria non vengono inviati, verifica che il canale WhatsApp sia attivo e che ci siano crediti sufficienti.`,
    keywords: 'promemoria,reminders,automatici,notifiche appuntamento,configurare reminder',
  },
  {
    order: 2030,
    category: 'Booking Appuntamenti',
    question: 'Posso avere più tipi di servizi prenotabili con durate diverse?',
    answer: `Sì, assolutamente. Puoi creare un numero illimitato di servizi prenotabili, ognuno con la propria durata.

Esempi:
- "Taglio capelli" — 30 minuti
- "Colorazione" — 90 minuti
- "Consulenza base" — 30 minuti, "Consulenza completa" — 60 minuti

Per configurarli:
1. Vai in **Menu > E-commerce > Servizi**
2. Per ogni servizio, abilita **Abilita per Prenotazione**
3. Imposta la **Durata** in minuti
4. Imposta il **Buffer time** (pausa tra un appuntamento e l'altro)

Il sistema gestisce automaticamente la disponibilità in base alla durata di ogni servizio — un slot da 30 minuti non sará proposto per un servizio da 60 minuti.`,
    keywords: 'più servizi,servizi diversi,durate diverse,multiple service types,multiple appointment types',
  },

  // ─── FATTURE E BILLING ────────────────────────────────────────────────────
  {
    order: 2100,
    category: 'Fatturazione',
    question: 'Come scarico le mie fatture mensili?',
    answer: `Vai in **Menu > Billing**.

Nella sezione **Fatture** (o "Invoices") trovi l'elenco di tutte le fatture mensili. Per ogni fattura puoi:
- Vedere il **periodo di riferimento**, l'importo, e lo stato (Pagata/In attesa)
- Cliccare **Scarica PDF** per scaricare la fattura in formato PDF
- Inviare la fattura via email al tuo indirizzo aziendale

Le fatture vengono generate automaticamente alla fine di ogni periodo di fatturazione.

Se hai bisogno di una fattura con dati specifici (P.IVA, ragione sociale, etc.), assicurati di aver compilato i dati di fatturazione in **Impostazioni > Configurazione Business**.`,
    keywords: 'fatture,invoice,scaricare fattura,fatturazione mensile,pdf fattura,billing',
  },
  {
    order: 2110,
    category: 'Fatturazione',
    question: 'Come aggiorno i dati di fatturazione (P.IVA, ragione sociale)?',
    answer: `Vai in **Menu > Impostazioni > Configurazione Business**.

Qui puoi compilare/aggiornare:
- **Ragione sociale** / Nome azienda
- **P.IVA** o Codice Fiscale
- **Indirizzo di fatturazione**
- **Email** per la ricezione fatture
- **PEC** (se applicabile)

I dati inseriti appariranno nelle fatture successive. Per le fatture già emesse, contatta il supporto: **support@echatbot.ai**`,
    keywords: 'dati fatturazione,p.iva,ragione sociale,indirizzo fatturazione,fatturazione dati,aggiornare fatturazione',
  },
  {
    order: 2120,
    category: 'Fatturazione',
    question: 'Il mio credito è esaurito e il chatbot si è fermato. Cosa devo fare?',
    answer: `Se il credito si esaurisce, il chatbot smette di inviare risposte automaticamente.

Per ripristinarlo immediatamente:
1. Vai in **Menu > Billing**
2. Clicca **Aggiungi Crediti**
3. Scegli l'importo e procedi con il pagamento (carta di credito o PayPal)
4. I crediti vengono aggiunti **immediatamente** dopo il pagamento
5. Il chatbot riprende a rispondere dalla prossima conversazione

⚠️ **Prevenzione**: puoi impostare un avviso email automatico (configurato di default) che ti notifica quando il saldo scende sotto una soglia. Assicurati di avere un metodo di pagamento valido salvato per ricaricare rapidamente.`,
    keywords: 'credito esaurito,saldo zero,chatbot fermo,ricarica crediti,ripristinare',
  },
  {
    order: 2130,
    category: 'Fatturazione',
    question: 'Posso impostare il rinnovo automatico dei crediti?',
    answer: `Sì. Puoi configurare una **soglia di ricarica automatica** in **Menu > Billing > Impostazioni pagamento automatico**.

Come funziona:
- Imposti una **soglia minima** (es. quando il credito scende sotto €10)
- Imposti un **importo di ricarica** automatica (es. ricarica sempre €50)
- Il sistema addebita automaticamente il metodo di pagamento salvato quando la soglia viene raggiunta

In questo modo non rischi mai di avere il chatbot fermo per mancanza di crediti.

Devi avere un **metodo di pagamento salvato** (carta di credito o PayPal) per attivare la ricarica automatica.`,
    keywords: 'ricarica automatica,auto topup,rinnovo automatico,pagamento automatico,soglia ricarica',
  },

  // ─── SICUREZZA ───────────────────────────────────────────────────────────
  {
    order: 2200,
    category: 'Sicurezza',
    question: 'Come attivo l\'autenticazione a due fattori (2FA)?',
    answer: `Vai in **Menu > Impostazioni Account** (clicca sull'icona del tuo profilo in alto a destra → Impostazioni Account).

Per abilitare il **2FA (Two-Factor Authentication)**:
1. Cerca la sezione **Sicurezza** o **Autenticazione a due fattori**
2. Clicca **Abilita 2FA**
3. Scansiona il QR code con un'app autenticatore (Google Authenticator, Authy, Microsoft Authenticator)
4. Inserisci il codice di 6 cifre per confermare
5. Salva i **codici di recupero** in un posto sicuro — servono se perdi l'accesso all'app

Con il 2FA attivato, ad ogni login ti verrà chiesto il codice dall'app autenticatore oltre alla password.`,
    keywords: 'two factor,2fa,autenticazione due fattori,sicurezza account,google authenticator',
  },
  {
    order: 2210,
    category: 'Sicurezza',
    question: 'How do I reset my password?',
    answer: `If you forgot your password:

1. Go to <a href="https://app.echatbot.io/login" target="_blank">app.echatbot.io/login</a>
2. Click **"Forgot password?"**
3. Enter your email address
4. Check your email for a reset link (valid for 1 hour)
5. Click the link and set a new password

If you don't receive the email within a few minutes, check your spam/junk folder.

If you still can't access your account, contact us at **support@echatbot.ai** with your registered email address and we'll help you regain access.`,
    keywords: 'reset password,forgot password,lost access,change password,recover account',
  },
  {
    order: 2220,
    category: 'Sicurezza',
    question: 'The chatbot answered something wrong or harmful. What should I do?',
    answer: `If the AI provided incorrect or inappropriate information:

**Immediate fix:**
1. Go to **Menu > FAQ** and add a specific FAQ with the correct answer for that topic
2. Update **Settings > AI Personality > Custom AI Rules** to explicitly prevent the wrong type of response
3. If it's a product/price error, update your catalog in **Menu > Products/Services**

**Investigation:**
- Find the conversation in **Menu > Chat** and review what question triggered the wrong answer
- Use this insight to improve your FAQ knowledge base

**Prevention:**
- Write detailed, accurate FAQ entries for your most common questions
- Use Custom AI Rules to set explicit guardrails (e.g. "Never quote prices that are not in the catalog")
- Regularly review chat logs to spot recurring misunderstandings

If the issue is a platform AI bug, report it to: **support@echatbot.ai** with the conversation details.`,
    keywords: 'wrong answer,incorrect response,harmful,ai mistake,fix chatbot,error AI',
  },
  {
    order: 2230,
    category: 'Sicurezza',
    question: 'I miei dati clienti sono al sicuro? Cosa succede se cambiamo provider?',
    answer: `Sì, i tuoi dati sono completamente al sicuro.

**Sicurezza dati:**
- Tutti i dati sono cifrati sia a riposo che in transito (TLS 1.2+)
- I server sono in **Unione Europea** (GDPR compliant)
- Multi-tenant isolation garantisce che nessun'altra azienda possa vedere i tuoi dati
- Backup automatici giornalieri con ripristino garantito

**Se cambi provider WhatsApp** (es. da UltraMsg a Meta):
- I dati dei clienti, le conversazioni, i prodotti, e tutte le configurazioni **rimangono invariati**
- Cambia solo il canale di comunicazione WhatsApp
- La cronologia dei messaggi precedenti rimane visibile nella dashboard

**Se cancelli il workspace:**
- I dati vengono conservati per 30 giorni
- Puoi richiedere un'esportazione completa a **support@echatbot.ai** prima della cancellazione`,
    keywords: 'sicurezza dati,protezione,cambio provider,backup,european hosting,gdpr,dati clienti',
  },

  // ─── ACCOUNT E WORKSPACE ─────────────────────────────────────────────────
  {
    order: 2300,
    category: 'Account e Workspace',
    question: 'Posso avere più workspace con lo stesso account?',
    answer: `Sì! Con un singolo account eChatbot puoi creare e gestire **più workspace**.

Ogni workspace è completamente indipendente:
- Canale WhatsApp, widget, e DNS dedicati
- Catalogo prodotti/servizi separato
- Clienti, conversazioni, e FAQ separate
- Piano di fatturazione indipendente

**Casi d'uso tipici:**
- Un'agenzia con più clienti: un workspace per cliente
- Un'azienda con più brand o punti vendita
- Ambienti separati: uno per la produzione, uno per il testing

Per creare un nuovo workspace, clicca sul **nome del workspace** in alto a sinistra nella dashboard → **Crea nuovo workspace**.`,
    keywords: 'più workspace,multiple workspace,tanti workspace,agenzia,multi business,creare workspace',
  },
  {
    order: 2310,
    category: 'Account e Workspace',
    question: 'Come passo da un workspace all\'altro?',
    answer: `Se hai più workspace associati al tuo account:

1. Clicca sul **nome del workspace** visibile in alto nella dashboard (o sull'icona del workspace)
2. Si aprirà un menu a tendina con tutti i tuoi workspace
3. Clicca sul workspace che vuoi selezionare
4. La dashboard si aggiornerà automaticamente mostrando i dati del workspace selezionato

Ogni workspace mantiene le proprie impostazioni, clienti e configurazioni separate.`,
    keywords: 'cambiare workspace,switch workspace,passare tra workspace,selezionare workspace',
  },
  {
    order: 2320,
    category: 'Account e Workspace',
    question: 'Come elimino un workspace?',
    answer: `Per eliminare un workspace:
1. Vai in **Impostazioni > Configurazione Business** del workspace che vuoi eliminare
2. Scorri fino in fondo alla pagina
3. Trova la sezione **Zona Pericolosa** (Danger Zone)
4. Clicca **Elimina Workspace** e conferma

⚠️ **Attenzione**: l'eliminazione è irreversibile. Tutti i dati (clienti, conversazioni, prodotti, ordini) vengono eliminati definitivamente dopo 30 giorni.

Prima di eliminare, considera di **esportare i dati** importanti. Contatta il supporto a **support@echatbot.ai** se hai bisogno di un backup.`,
    keywords: 'eliminare workspace,cancellare,delete workspace,danger zone,chiudere account',
  },

  // ─── ANALYTICS (expanded) ────────────────────────────────────────────────
  {
    order: 2400,
    category: 'Analytics',
    question: 'Come misuro l\'efficacia del mio chatbot?',
    answer: `Le metriche chiave da monitorare in **Menu > Analytics**:

- **Tasso di risoluzione AI** — % di conversazioni gestite completamente dall'AI senza escalation all'operatore. Più alto è meglio (obiettivo: 70%+)
- **Top FAQ usate** — le domande più frequenti dei clienti. Usale per migliorare il tuo catalogo e FAQ
- **Tasso di escalation** — % di conversazioni passate a un operatore. Se è troppo alto, aggiungi più FAQ
- **Conversioni** (per i workspace e-commerce) — numero di ordini generati dal chatbot
- **Lingua dei clienti** — capisci in che lingue parlano i tuoi clienti

Consulta questi dati settimanalmente e usa le informazioni per migliorare continuamente le FAQ e le regole AI.`,
    keywords: 'metriche,kpi,efficacia chatbot,misurare,analytics,performance,tasso risoluzione',
  },

  // ─── TROUBLESHOOTING ─────────────────────────────────────────────────────
  {
    order: 2500,
    category: 'Troubleshooting',
    question: 'Non riesco ad accedere alla dashboard. Cosa faccio?',
    answer: `Ecco i passaggi per risolvere i problemi di accesso:

1. **Password dimenticata** → clicca "Password dimenticata?" nella pagina di login
2. **Account bloccato** → controlla la tua email per messaggi di sicurezza da eChatbot
3. **2FA non funziona** → usa un codice di recupero che hai salvato all'attivazione del 2FA
4. **Email non riconosciuta** → verifica di usare l'email con cui ti sei registrato
5. **Problema tecnico** → prova a svuotare cache e cookie del browser, o usa un browser diverso

Se nessuna di queste soluzioni funziona, contattaci:
📧 **support@echatbot.ai** — indica la tua email registrata e descrivi il problema`,
    keywords: 'non accedo,login non funziona,problemi accesso,password,account bloccato',
  },
  {
    order: 2510,
    category: 'Troubleshooting',
    question: 'La dashboard è lenta o non carica. Come risolvo?',
    answer: `Se la dashboard è lenta o non carica correttamente:

1. **Svuota la cache del browser** (Ctrl+Shift+Delete / Cmd+Shift+Delete) e ricarica
2. **Disabilita le estensioni** del browser — alcune estensioni (ad-blocker, VPN) possono interferire
3. **Prova un altro browser** (Chrome, Firefox, Edge)
4. **Verifica la connessione internet** — la dashboard richiede una connessione stabile
5. **Prova in modalità incognito** — esclude problemi legati a cache o estensioni

Se il problema persiste o riguarda una funzionalità specifica (es. la pagina Analytics non carica), contattaci a **support@echatbot.ai** specificando browser e sistema operativo.`,
    keywords: 'lenta,non carica,problemi dashboard,bug,lentezza,errore caricamento',
  },
  {
    order: 2520,
    category: 'Troubleshooting',
    question: 'Sto ricevendo messaggi duplicati dai clienti. Come risolvo?',
    answer: `I messaggi duplicati di solito indicano un problema di configurazione del webhook.

**Cause comuni:**
1. **Webhook configurato due volte** — hai incollato lo stesso webhook URL in due provider diversi o in due punti del provider
2. **Provider riconfigura il webhook** — UltraMsg/Wasender a volte reimpostano il webhook dopo un aggiornamento

**Come risolvere:**
1. Vai in **Impostazioni > Canale WhatsApp** e copia il webhook URL corretto
2. Accedi al pannello del tuo provider (UltraMsg/Wasender/Meta)
3. Verifica che ci sia **un solo webhook URL** configurato
4. Rimuovi eventuali webhook duplicati

Se il problema persiste, contatta il supporto con un esempio dei messaggi duplicati.`,
    keywords: 'messaggi duplicati,double messages,webhook duplicato,messaggi ripetuti',
  },

  // ─── GENERALE / ALTRO ────────────────────────────────────────────────────
  {
    order: 2600,
    category: 'Generale',
    question: 'eChatbot funziona anche per i ristoranti, parrucchieri, studi medici?',
    answer: `Sì! eChatbot è progettato per qualsiasi tipo di business, non solo per l'e-commerce.

**Esempi di utilizzo per settore:**

🍕 **Ristorante**: prendi prenotazioni tavoli, invia il menu, gestisci ordini da asporto, rispondi a domande sugli allergeni

✂️ **Parrucchiere/Estetica**: prenota appuntamenti, mostra listino prezzi, invia promemoria automatici

🏥 **Studio medico/Dental**: gestisci le prenotazioni visite, invia informazioni pre-visita, risponi a FAQ sulla clinica. ⚠️ Nota: il chatbot non può dare consigli medici.

🏋️ **Palestra/Centro benessere**: iscrizioni, orari corsi, prenotazione lezioni private

🏠 **Agente immobiliare**: raccolta info clienti, mostra annunci, prenota visite

📱 **SaaS/Tech**: supporto tecnico di primo livello, documentazione, apertura ticket

In tutti i casi, eChatbot può gestire l'80%+ delle richieste comuni, liberando il tuo team per i casi più complessi.`,
    keywords: 'ristorante,parrucchiere,medico,studio,palestra,settore,che business,funziona per',
  },
  {
    order: 2610,
    category: 'Generale',
    question: 'Quanto è difficile da usare e devo sapere programmare?',
    answer: `**No, non devi saper programmare.** eChatbot è progettato per essere usato da chiunque, senza competenze tecniche.

Tutto si fa dalla dashboard grafica:
- ✅ Aggiungere prodotti e FAQ — semplice come compilare un form
- ✅ Configurare la personalità AI — campi di testo
- ✅ Collegare WhatsApp — copia-incolla di token e URL
- ✅ Creare campagne — editor visuale
- ✅ Leggere le analytics — grafici intuitivi

L'unica parte leggermente tecnica è la configurazione iniziale del canale WhatsApp, ma abbiamo guide passo-passo e il nostro team è disponibile per supportarti.

Se hai un piano Premium o Enterprise, offriamo anche **onboarding assistito** direttamente con un consulente.`,
    keywords: 'difficile,programmare,tecnico,semplice,facile,no code,senza tecnico,configurare',
  },
  {
    order: 2620,
    category: 'Generale',
    question: 'Posso fare una demo prima di acquistare?',
    answer: `Sì, hai due opzioni:

**1. Trial gratuito** (consigliato)
Crea un account gratuita su <a href="https://app.echatbot.io" target="_blank">app.echatbot.io</a> e hai 14 giorni di accesso completo senza carta di credito. È la demo migliore perché configuri il tuo chatbot reale.

**2. Demo con il nostro team**
Vuoi vedere eChatbot in azione per il tuo settore specifico o hai domande prima di iniziare? Compila il sondaggio (2 minuti) e ti contatteremo per una demo personalizzata: <a href="https://www.echatbot.ai/survey" target="_blank">www.echatbot.ai/survey</a>

Il nostro team parla italiano e può risponderti via email, WhatsApp, o videochiamata.`,
    keywords: 'demo,prova,vedere,prima di comprare,trial,sondaggio,consulenza',
  },
  {
    order: 2630,
    category: 'Generale',
    question: 'È possibile migrare da un altro chatbot provider a eChatbot?',
    answer: `Sì, le migrazioni sono possibili e relativamente semplici.

**Cosa si può migrare:**
- ✅ Catalogo prodotti/servizi (via CSV import)
- ✅ Database clienti (via import contatti)
- ✅ FAQ e knowledge base (manuale o assistita)

**Cosa non si può migrare:**
- ❌ Storico conversazioni (rimane nel vecchio sistema)
- ❌ Configurazioni AI-specifiche del vecchio provider (devono essere riscritte)

**Come procedere:**
1. Crea un workspace di test su eChatbot
2. Importa il catalogo tramite CSV
3. Trascrivi le FAQ più importanti
4. Testa con conversazioni reali prima del go-live
5. Sposta il numero WhatsApp al nuovo sistema

Per migrazioni complesse o **Enterprise**, contattaci per un'assistenza dedicata: <a href="https://www.echatbot.ai/survey" target="_blank">www.echatbot.ai/survey</a>`,
    keywords: 'migrazione,migrare,cambiare provider,switch,altro chatbot,import,portare dati',
  },
];

async function main() {
  console.log(`\n🚀 Starting FAQ update for workspace: ${WORKSPACE_ID}`);
  console.log(`📋 Total FAQs to create: ${faqs.length}\n`);

  try {
    // Step 1: delete all existing FAQs for this workspace
    const deleted = await prisma.fAQ.deleteMany({
      where: { workspaceId: WORKSPACE_ID },
    });
    console.log(`🗑️  Deleted ${deleted.count} existing FAQs`);

    // Step 2: create all new FAQs
    const created = await prisma.fAQ.createMany({
      data: faqs.map((faq) => ({
        workspaceId: WORKSPACE_ID,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords
          ? faq.keywords.split(',').map((k) => k.trim()).filter(Boolean)
          : [],
        category: faq.category || '',
        order: faq.order || 0,
        isActive: true,
      })),
    });
    console.log(`✅ Created ${created.count} new FAQs\n`);

    // Step 3: verify
    const total = await prisma.fAQ.count({ where: { workspaceId: WORKSPACE_ID } });
    console.log(`📊 Total FAQs now in database: ${total}`);

    // Show categories summary
    const all = await prisma.fAQ.findMany({
      where: { workspaceId: WORKSPACE_ID },
      orderBy: { order: 'asc' },
      select: { category: true, question: true, order: true },
    });
    const byCategory = {};
    all.forEach((f) => {
      const cat = f.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(`  [${f.order}] ${f.question.substring(0, 60)}...`);
    });
    console.log('\n📂 FAQs by category:');
    Object.entries(byCategory).forEach(([cat, items]) => {
      console.log(`\n  ${cat} (${items.length}):`);
      items.forEach((i) => console.log(i));
    });

    console.log('\n🎉 FAQ update complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('   Code:', error.code);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
