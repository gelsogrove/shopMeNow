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
