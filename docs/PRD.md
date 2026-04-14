# eChatbot.ai - Product Requirements Document (PRD) Completo

> **Versione**: 3.0  
> **Ultimo aggiornamento**: 3 Marzo 2026  
> **Autore**: Andrea Gelsomino + AI Analysis  
> **Status**: Production

---

## 📋 Executive Summary

### Cos'è eChatbot.ai

**eChatbot.ai** è una **piattaforma SaaS multilingua** che permette alle aziende di creare chatbot AI personalizzati per vendita e supporto clienti, disponibili sia su **WhatsApp** che tramite **widget web**.

### Problema Risolto

Le PMI hanno difficoltà a:
- Gestire richieste clienti 24/7 senza personale
- Vendere prodotti tramite canali conversazionali (WhatsApp)
- Fornire supporto multilingua automatico
- Scalare le operazioni senza aumentare costi

### Soluzione Proposta

Una piattaforma completa che offre:
- 🤖 **Chatbot AI multi-agente** con LLM routing intelligente
- 📱 **Canali multipli**: WhatsApp (Meta/UltraMsg/WaAPI) + Widget web
- 🛒 **E-commerce completo**: catalogo prodotti, carrello, ordini, pagamenti PayPal
- 🌍 **Multilingua nativo**: IT, EN, ES, PT con traduzione automatica
- 👥 **Team management**: workspace multipli, operatori, escalation umana
- 💳 **Billing flessibile**: piani + pay-per-use con credit system
- 📊 **Analytics e monitoraggio** completo
- 🔒 **Security enterprise**: 2FA, workspace isolation, rate limiting

---

## 🏗️ Architettura Tecnica - Apps Heroku

Il sistema è organizzato in **4 applicazioni Heroku indipendenti**:

### 1. **Backend** (Node.js/Express + Prisma ORM)
**URL**: `https://echatbot-backend.herokuapp.com`  
**Funzione**: API REST, business logic, integrazioni esterne

**Responsabilità**:
- Gestione autenticazione/autorizzazione (JWT + 2FA)
- CRUD completo per tutte le entities (workspace, products, orders, customers)
- Orchestrazione LLM multi-agente
- Integrazioni esterne (WhatsApp, PayPal, OpenRouter)
-  Webhook handlers (WhatsApp, PayPal, custom functions)
- Billing engine e credit management
- File storage (local dev / Cloudinary prod)
- Email notifications
- WebSocket real-time per chat

**Stack Tecnologico**:
- Node.js 18+ / TypeScript 5.x
- Express.js (routing, middleware)
- Prisma ORM (PostgreSQL access layer)
- OpenRouter (LLM provider - GPT-4o-mini default)
- Cloudinary (image storage prod)
- Socket.io (WebSocket per chat real-time)
- JWT + bcrypt (auth/security)

---

### 2. **Frontend** (React + Vite + TailwindCSS + shadcn/ui)
**URL**: `https://app.echatbot.ai`  
**Funzione**: Dashboard utente per gestire workspace e chatbot

**Responsabilità**:
- Onboarding wizard multi-step
- Gestione workspace settings (AI personality, WhatsApp config, widget customization)
- CRUD prodotti/servizi/categorie/offerte/FAQ
- Gestione ordini e clienti
- Gestione team (invitations, roles)
- Push campaigns (creazione, scheduling, targeting)
- Chat operator panel (live customer support)
- Analytics dashboard
- Billing management (credit recharge, plan selection, PayPal connection)
- Profile settings (2FA, OAuth providers)

**Stack Tecnologico**:
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui (UI components)
- TanStack Query (server state)
- React Router v6 (client routing)
- Axios (API client)
- Recharts (analytics charts)

**Pages Principali** (48 total):
- `DashboardPage` - Overview workspace stats
- `SettingsPage` - 7 sections (AI, business, WhatsApp, widget, security, support, subscription)
- `ProductsPage`, `CategoriesPage`, `OffersPage`, `ServicesPage` - Catalog management
- `OrdersPage`, `CustomersPage`, `ClientsPage` - Order/customer management
- `ChatPage`, `OperatorQueuePage` - Live chat support
- `CampaignsPage` - Push marketing campaigns
- `FAQPage` - Knowledge base management
- `AgentSettingsPage` - LLM agents configuration
- `TeamPage`, `InvitationsPage` - Team management
- `BillingPage`, `SubscriptionPage`, `PayPalConnectionPage` - Billing
- `ProfilePage`, `TwoFactorPage` - User settings
- `SupportTicketsPage`, `SupportChatPage` - Support system

---

### 3. **Backoffice** (React + Vite + shadcn/ui)
**URL**: `https://admin.echatbot.ai`  
**Funzione**: Pannello amministrazione piattaforma

**Responsabilità**:
- Gestione utenti piattaforma (CRUD, soft-delete, trash management)
- Gestione workspace (view all, blocco/sblocco, statistics)
- Billing oversight (monthly invoices, credit notes, payment failures)
- Platform configuration (pricing, feature flags, plan limits)
- Scheduler jobs management (enable/disable, monitor status)
- Legal documents management (GDPR, Privacy, Terms multilingual)
- Calling functions registry (system + custom webhooks)
- Support tickets admin (customer support management)
- Analytics globali piattaforma
- WhatsApp queue monitoring

**Stack Tecnologico**:
- Identico al frontend (React + Vite + shadcn/ui)
- Accesso riservato a `isPlatformAdmin=true` users

**Pages Principali** (18 total):
- `ClientsPage` - All platform users management
- `ChannelsPage` - All workspaces overview + stats
- `TrashPage` - Soft-deleted entities recovery (90 days window)
- `PricingPage` - Dynamic pricing configuration
- `PlanConfigPage` - Plan limits and features
- `SchedulersPage` - Cron jobs monitoring
- `LawsDocumentsPage` - Legal content multilingual
- `CallingFunctionsPage` - System + custom functions registry
- `SupportTicketsAdminPage` - Customer support admin
- `AnalyticsPage` - Platform-wide analytics
- `QueuePage` - WhatsApp message queue monitoring
- `InvoicingPage` - Monthly invoice management

---

### 4. **Scheduler** (Node.js + node-cron)
**URL**: N/A (background worker Heroku dyno)  
**Funzione**: Cron jobs automatici per cleanup e billing

**Jobs Attivi** (11 total):

| Job Name | Frequency | Funzione |
|----------|-----------|----------|
| `whatsapp-channel-queue` | Every 5 seconds | 📤 Invia messaggi WhatsApp dalla coda |
| `push-campaigns` | Every minute | 📢 Esegue campagne push schedulate |
| `monthly-billing` | 1st of month 00:00 | 💳 Genera fatture mensili e addebita subscription |
| `short-urls-cleanup` | Daily 03:00 | 🔗 Elimina short URLs scaduti |
| `unused-images-cleanup` | Daily 04:00 | 🖼️ Rimuove immagini orfane da storage |
| `messages-archive` | Daily 05:00 | 📦 Archivia messaggi >6 mesi in `messages_archive` |
| `whatsapp-queue-cleanup` | Every hour | 🧹 Rimuove messaggi falliti/scaduti dalla queue |
| `soft-delete-cleanup` | Daily 06:00 | 🗑️ Hard-delete entities soft-deleted >90 giorni |
| `support-attachments-cleanup` | Daily 07:00 | 📎 Rimuove attachment support tickets chiusi >30 giorni |
| `waapi-qr-cleanup` | Every 10 minutes | 📱 Rimuove QR code WaAPI scaduti (>5 minuti) |
| `trial-expiration-check` | Daily 09:00 | ⏰ Blocca workspace con trial scaduto |

**Stack Tecnologico**:
- Node.js 18+ / TypeScript
- node-cron (scheduling)
- Prisma ORM (database access)
- Shared logger and utilities

---

## 📊 Database Schema - 50+ Modelli

### Core Entities

#### **User** (Owner/Admin/Member)
- Autenticazione: `email/password` + OAuth (Google/Facebook/Apple)
- 2FA: TOTP secret + recovery codes
- Billing: `creditBalance`, `planType`, `subscriptionStatus`
- PayPal: `paypalSubscriptionId`, `paypalStatus`
- Multi-tenant: One user can own multiple workspaces

#### **Workspace** (Channel/Chatbot Instance)
- Rappresenta un chatbot (1 workspace = 1 numero WhatsApp / 1 widget)
- Owner-based billing (tutti workspace di un owner condividono il credit)
- Configuration:
  - AI: `chatbotName`, `toneOfVoice`, `customAiRules`, `botIdentityResponse`
  - WhatsApp: Multi-provider (`meta`, `ultramsg`, `waapi`) con campi dedicati
  - Widget: `widgetTitle`, `widgetPrimaryColor`, `widgetLanguage`, `widgetIcon`
  - Business: `sellsProductsAndServices`, `hasHumanSupport`, `businessType`
  - Security: `allowedExternalLinks`, `frustrationEscalationInstructions`
  - Messages: `welcomeMessage`, `wipMessage`, `afterRegistrationMessages`
  - Translation: `translateProductNames`, `catalogBaseLanguage`
  - Status: `channelStatus` (active/disabled), `debugMode`, `requireManualApproval`

#### **Customers** (End Users)
- Registrazione: `registrationStatus` (NEW → PENDING_APPROVAL → ACTIVE)
- Language detection: `language` (auto-detected da phone prefix o esplicita)
- BlacklistAuth: `isBlacklisted`, `isActive`
- Operator queue: `operatorRequestedAt`, `operatorQueuePosition`
- Channels: `originChannel` (widget/whatsapp), `activeChatbot` (true = AI, false = human operator)
- GDPR: `privacy_accepted_at`, `push_notifications_consent`
- Tags: `tags[]` per targeting campaigns

### E-commerce

#### **Products**
- Catalog: `name`, `description`, `price`, `stock`, `sku`, `slug`
- Categories: Many-to-many via `ProductCategory`
- Certifications: Many-to-many via `ProductCertification`
- Types: Many-to-many via `ProductType`
- Characteristics: One-to-many `ProductCharacteristic` (custom fields)
- Images: `imageUrl[]`, `imageKey` (per cleanup)
- Security: `link` (external product URL con security validation)
- Status: `status` (ACTIVE, INACTIVE, DRAFT, OUT_OF_STOCK)

#### **Categories**
- Hierarchical catalog organization
- Many-to-many with Products and Offers

#### **Services**
- Same structure as Products but for services (e.g., consultancy, delivery)
- `duration` field for time-based services

#### **Offers** (Promotional Campaigns)
- Time-based: `startDate`, `endDate`
- Discount: `discountPercent`
- Category-linked: Many-to-many with Categories

#### **Orders**
- Order flow: `status` (PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED)
- Payment: `paymentMethod`, `paymentStatus`, `PaymentDetails` relation
- Billing: `billedAt` (prevents double-charging €1.00 NEW_ORDER fee)
- Invoice: `invoiceUrl`, `invoiceKey`, `invoiceDate` (PDF generation)
- Items: `OrderItems[]` (many-to-many with Products/Services)
- Credit notes: `CreditNote[]` (partial refunds for delivered orders)

#### **Carts**
- One active cart per customer
- `CartItems[]` with quantity and notes

### Chat System

#### **ChatSession**
- One active session per customer (enforced by unique constraint)
- Channels: `channel` (whatsapp/widget), `isAnonymous`, `visitorId`
- Status: `status` (active/closed), `expiresAt` (24h for widget visitors)
- Context: `context` JSON (conversation state)

#### **Message** (OLD - Chat UI messages)
- Direction: `direction` (INBOUND/OUTBOUND)
- Type: `type` (TEXT, IMAGE, DOCUMENT, LOCATION)
- WhatsApp tracking: `whatsappMessageId`, `whatsappStatus`, `whatsappError`
- Operator: `sentBy` (userId if manual send)
- AI metadata: `aiGenerated`, `processingSource`, `debugInfo`

#### **ConversationMessage** (NEW - LLM context window)
- OpenAI format: `role` (user/assistant/function/system), `content`
- Agent tracking: `agentType`, `functionName`, `functionArguments`
- Delivery: `deliveryStatus` (not_queued/pending/sent/error), `deliveredAt`
- Debug: `debugInfo`, `tokensUsed`

#### **MessageArchive**
- Auto-archive messages >6 mesi (scheduler job)
- Full denormalization (`workspaceId`, `customerId`) for fast cleanup

#### **AgentConversationLog**
- Complete LLM execution logs per step
- Agent chain: `step` (1=Router, 2=ProductSearch, 3=Cart, ..., 99=Translation)
- Performance: `executionTimeMs`, `tokensUsed`, `llmModel`
- Debugging: `inputMessage`, `agentPrompt`, `llmResponse`, `functionsCalled`
- Confidence: `confidence` score, `reasoning`

###WhatsApp Queue

#### **WhatsAppQueue**
- Message queue for ALL outbound messages (WhatsApp + Widget)
- Status flow: `pending` → `sent` / `failed`
- Channels: `channel` (whatsapp/widget), `isAnonymous`, `visitorId`
- Push campaigns: `pushCampaignId`, `pushCampaignRecipientId` (idempotency)
- Security: `skipSecurityCheck` (per trusted messages - operator notifications)
- Playground: `isPlayground` (skip billing for test messages)
- Widget polling: `responsePayload`, `pollingAttempts`, `lastPolledAt`
- Expiry: `expiresAt` (24h for widget anonymous sessions)

#### **WhatsappWebhookEvent**
- De-duplication: Prevents Meta retry duplicates
- Unique constraint: `(workspaceId, channel, externalMessageId)`

### LLM & AI

#### **AgentConfig**
- One record per agent type per workspace
- Agent types: `ROUTER`, `PRODUCT_SEARCH`, `CART_MANAGEMENT`, `ORDER_TRACKING`, `CUSTOMER_SUPPORT`, `INFO_AGENT`, `SECURITY`, `TRANSLATION`, `CUSTOM`
- Configuration: `systemPrompt`, `model`, `temperature`, `maxTokens`
- Execution: `order` (defines execution sequence), `isActive`
- Functions: `availableFunctions` JSON (array of Calling Function names)
- UI: `icon`, `description` (for admin display)

#### **WorkspaceCallingFunction**
- Registry of functions callable by LLM (system + custom webhooks)
- **Full CRUD**: Admin can create, read, update, and delete calling functions
- **attachedLlm**: Links `DELEGATE_TO_AGENT` functions to a specific agent type (e.g., `PRODUCT_SEARCH`, `CART_MANAGEMENT`)
- Execution types:
  - `DELEGATE_TO_AGENT`: Routes to specific agent via `attachedLlm` field (e.g., `PRODUCT_SEARCH`)
  - `WEBHOOK`: Calls external URL with HMAC signature
  - `INTERNAL`: Executes internal service function (e.g., `changeLanguage`)
- Schema: `parameters` (OpenAI function calling format)
- Instructions: `description` (quando chiamarla), `responseInstructions` (come presentare risultato)
- Security: `isSystemFunction` (restorable via `/reinstall` if deleted), `webhookUrl` (per-function override)
- **Immutable fields** (cannot be changed after creation): `functionName`, `isSystemFunction`, `workspaceId`, `id`, `createdAt`
- **channelMode gating**: Ecommerce-only functions (`productSearchAgent`, `cartManagementAgent`, `orderTrackingAgent`) are hidden in non-ECOMMERCE workspaces
- **Feature flag gating**: Appointment functions hidden when `enableCalendarBooking=false`, `customerSupportAgent` hidden when `hasHumanSupport=false`

##### channelMode Immutability (2026-04)
- **channelMode is IMMUTABLE after workspace creation**
- Attempting to change channelMode returns `400 CHANNEL_MODE_IMMUTABLE`
- Users must delete the workspace and create a new one to switch mode
- Rationale: Changing mode requires syncing calling functions, resetting agent prompts, and handling many edge cases — blocking is simpler and safer
- Frontend: channelMode dropdown disabled in Settings page with amber warning text
- Backend: `workspace.service.ts update()` throws 400 before any DB write if `data.channelMode !== currentWorkspace.channelMode`

##### Calling Functions CRUD API (2026-04)
- `GET    /workspaces/:workspaceId/functions` — List all (with feature-flag filtering)
- `POST   /workspaces/:workspaceId/functions` — Create custom function
- `PATCH  /workspaces/:workspaceId/functions/:functionName` — Update (respects `IMMUTABLE_KEYS`)
- `DELETE /workspaces/:workspaceId/functions/:functionName` — Hard delete (system functions restorable)
- `POST   /workspaces/:workspaceId/functions/:functionName/reinstall` — Restore deleted system function from constants
- `GET    /workspaces/:workspaceId/functions/system-missing` — List deleted system functions available for reinstall
- `GET    /workspaces/:workspaceId/functions/agent-types` — List valid agent types for current channelMode
- `POST   /workspaces/:workspaceId/functions/test-webhook` — Test external webhook URL connectivity

#### **FAQ**
- Knowledge base: `question`, `answer`, `keywords[]`
- Grouping: `category`, `order` (display priority)
- Router Agent checks FAQs BEFORE routing to specialized agents

### Billing & Subscriptions

#### **PlanType** (Enum)
- `FREE_TRIAL`: 14 giorni + €19 credit iniziale
- `BASIC`: €19/mese - 1 canale, 50 prodotti, 50 clienti
- `PREMIUM`: €49/mese - 2 canali, 100 prodotti, 100 clienti
- `ENTERPRISE`: Custom pricing - unlimited

#### **SubscriptionStatus** (Enum)
- `ACTIVE`: Operativo normale
- `PAUSE_PENDING`: Pausa richiesta (effettiva prossimo mese)
- `PAUSED`: Sottoscrizione in pausa - no billing, no chatbot
- `PAYMENT_FAILED`: Pagamento fallito - chatbot bloccato

#### **BillingTransaction**
- Storico movimenti credit per owner (user-based billing)
- Types: `MESSAGE` (-€0.10), `NEW_ORDER` (-€1.00), `PUSH_NOTIFICATION` (-€1.00), `RECHARGE` (+€X), `MONTHLY_FEE` (-€X), `ADJUSTMENT`, etc.
- Tracking: `referenceId`, `referenceType`, `metadata`
- Balance: `balanceAfter` (snapshot del saldo dopo transazione)

#### **MonthlyInvoice**
- Fattura mensile per owner (user-based)
- Period: `periodStart`, `periodEnd`, `periodMonth`, `periodYear`
- Amounts: `subscriptionAmount` (piano mensile) + `creditUsage` (consumo) + `creditDebt` (saldo negativo pregresso)
- Status: `DRAFT` → `PENDING` → `PAID` / `FAILED` / `CANCELLED`
- PayPal: `paypalTransactionId`, `paymentRetryCount`
- Breakdown: `itemsBreakdown` JSON (messages, orders, pushes count)
- Credit notes: `InvoiceCreditNote[]`, `InvoiceAdjustment[]`

#### **PlanConfiguration**
- Dynamic plan limits from database
- Pricing: `monthlyFee`, `messageCost`, `orderCost`, `pushCost`
- Limits: `maxChannels`, `maxProducts`, `maxCustomers`, `maxTeamMembers`
- Thresholds: `lowBalanceThreshold`, `trialDays`, `initialCredit`

#### **PlatformConfig**
- Single source of truth per pricing & feature flags
- Types: `PRICE` (monetary), `FLAG` (boolean), `LIMIT` (numeric)
- Examples: `BASIC_MONTHLY=19`, `canLogin=true`, `MAX_PRODUCTS=50`
- Strikethrough pricing: `originalValue` (per promozioni tipo `~€29~ €19`)

### Push Campaigns

#### **PushCampaign**
- Status: `DRAFT` → `SCHEDULED` → `RUNNING` → `COMPLETED` / `FAILED` / `CANCELLED`
- Targeting: `targetingType` (ALL, MANUAL, TAGS, SELECTED), `targetCustomerIds[]`, `tagId`
- Scheduling: `frequency` (ONCE, WEEKLY, MONTHLY, etc.), `sendAt`, `nextRunAt`, `lastRunAt`
- Message: `message` (template con variabili tipo `{{nome}}`), `mediaUrl`
- Limits: `throttlePerSecond`, `batchSize`
- Stats: `expectedRecipients`, `actualSent`, `actualFailed`, `actualSkipped`
- Billing: `billingStatus` (PENDING → PARTIAL → BILLED), `costPerMessage`

#### **PushCampaignRecipient**
- One record per destinatario per campaign
- Status: `PENDING` → `SENT` / `FAILED` / `SKIPPED`
- Error tracking: `errorCode`, `errorMessage`
- Billing: `priceCharged` (€1.00 if sent successfully)
- Filtering: `isBlacklisted`, `isBlocked`, `isFake`, `optOutAt`

### Security & Auth

#### **AdminSession**
- Session tracking per admin backoffice access
- Expiry: `expiresAt`, `lastActivityAt`
- Security: `ipAddress`, `userAgent`

#### **AuthenticationAttempt**
- Audit log for ALL auth attempts (success + failed)
- Rate limiting: `ipAddress`, `email` tracking
- Types: `registration`, `login`, `2fa`, `password_reset`, `oauth-google/facebook/apple`

#### **TwoFactorResetToken**
- Admin-initiated 2FA reset when user loses phone
- Security: `passwordAttempts` (max 5), `lockedUntil`
- Expiry: 1 hour from creation

#### **PasswordReset**
- Standard password reset flow
- Token: SHA-256 hashed, unique, time-limited

#### **SecureToken**
- Generic secure token for:
  - Order public access (without login)
  - Customer registration links
  - Short-lived access tokens
- Payload: `type`, `customerId`, `workspaceId`, `payload` JSON

#### **RegistrationToken**
- Phone-number based registration tokens (optional step)

### Team Management

#### **UserWorkspace**
- Many-to-many User ↔ Workspace
- Roles: `SUPER_ADMIN` (owner), `ADMIN` (team member)
- ONE owner per workspace (`Workspace.ownerId`)

#### **WorkspaceInvitation**
- Email-based team invitations
- Status: `PENDING` → `ACCEPTED` / `CANCELLED` / `EXPIRED` (7 days)
- Token: SHA-256 hashed, unique
- Pre-fill: `firstName`, `lastName` (optional)

### Support System

#### **SupportTicket**
- User-based support (owner requests help)
- Type: `issueType` (ACCOUNT_ISSUE, PLAN_AND_BILLING, WHATSAPP, WIDGET, etc.)
- Status: `PENDING` → `IN_PROGRESS` → `CLOSED`
- Unique code: `ticketCode` (TKT-XXXXXX)
- Thread: `SupportMessage[]`

#### **SupportMessage**
- Rich HTML content (WYSIWYG editor)
- Sender: `senderType` (CUSTOMER/ADMIN), `senderId`
- Attachments: `SupportAttachment[]` (files uploaded)

#### **SupportAttachment**
- S3 storage: `url`, `storageKey` (for cleanup)
- Metadata: `filename`, `mimeType`, `size`

### Utilities

#### **ShortUrls**
- URL shortener: `shortCode` (10 chars) → `originalUrl`
- Analytics: `clicks`, `lastAccessedAt`
- Expiry: `expiresAt` (optional)
- Cleanup job removes expired URLs

#### **SoftDeleteAuditLog**
- Audit log for hard-deletes (compliance)
- Tracks: `entityType`, `deletedIds[]`, `deletedIdCount`, `reason`, `deletedByUserId`
- Retention: 7 years for GDPR

#### **SchedulerJobStatus**
- Monitors cron job execution
- Status: `NEVER_RUN`, `RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`
- Manual control: `isActive` (enable/disable from backoffice)
- Timing: `lastRunAt`, `nextRunAt`, `lastDuration`

#### **Documents**
- File uploads per workspace
- Status: `UPLOADED` → `PROCESSING` → `PROCESSED` / `ERROR`
- RAG context (future: semantic search in documents)

#### **LegalDocument**
- Platform-wide legal pages (GDPR, Privacy, Terms, Refund)
- Multilingual: IT, EN, ES, PT (separate fields per language)

---

## 🔄 Flussi Chiave

### 1. Flusso Registrazione Utente (Owner)

```
1. User → Frontend: /signup (email, password, firstName, lastName)
2. Backend: Create User (status=ACTIVE, planType=FREE_TRIAL, creditBalance=€19, trialEndsAt=+14 days)
3. Backend: Create BillingTransaction (type=INITIAL_CREDIT, amount=+€19)
4. Backend: Send verification email
5. Frontend: Redirect to /workspace-selection (empty state, prompt to create first workspace)
```

**Security**:
- Password: bcrypt hash (rounds=10)
- JWT token: 24h expiry
- Rate limiting: 5 registration tentativi / IP / hour

---

### 2. Flusso Onboarding Wizard (Creazione Workspace)

**Steps del Wizard**:

```
Step 1: Tipo Chatbot
- sellsProductsAndServices: Boolean (E-commerce vs Informativo)

Step 2: AI Personality
- chatbotName: String (e.g., "Sofia", "Marco")
- toneOfVoice: "friendly" | "formal" | "professional" | "casual"
- botIdentityResponse: Text (risposta a "Chi sei?")
- customAiRules: Text (regole personalizzate che override default)

Step 3: Business Info
- name: String (nome workspace/business)
- slug: String (auto-generated da name, unique)
- businessType: "food" | "fashion" | "tech" | "other"
- currency: "EUR" | "USD" | etc.
- address: Text (indirizzo fisico per domande "Dove siete?")

Step 4: Canali
- enableWhatsapp: Boolean
- enableWidget: Boolean
- (Se WhatsApp) whatsappProvider: "meta" | "ultramsg" | "waapi"
- (Se Widget) widgetTitle, widgetPrimaryColor, widgetLanguage

Step 5: Welcome Messages (Auto-compiled con default + placeholders)
- welcomeMessage: "Ciao! Sono {{chatbotName}}, ..."
- wipMessage: "Stiamo lavorando al sistema. Contattaci più tardi."
- afterRegistrationMessages: "Grazie per esserti registrato, {{customerName}}!"

Step 6: Human Support
- hasHumanSupport: Boolean
- operatorContactMethod: "email" | "whatsapp"
- operatorEmail / operatorWhatsappNumber
- humanSupportInstructions: Text (quando escalare a operatore)

Step 7: Security (Optional)
- allowedExternalLinks: String[] (domini consentiti per link esterni)
- requireManualApproval: Boolean (nuovi clienti vanno in PENDING_APPROVAL)

Step 8: Review & Create
- Summary di tutte le scelte
- Crea Workspace con valori default per campi non specificati
- Crea AgentConfig records con prompt default per tutti gli agent type
```

**Post-Creation Actions**:
1. Redirect a `/workspace/{id}/settings` (configurazione dettagliata)
2. Mostra checklist onboarding: [ ] Configura WhatsApp [ ] Aggiungi prodotti [ ] Testa chatbot

---

### 3. Flusso Messaggio WhatsApp Inbound (Meta Provider)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Meta → POST /api/whatsapp/webhook/:webhookId            │
│    - mTLS verification (Meta IP whitelist)                  │
│    - HMAC signature validation                              │
│    - Rate limiting (100 req/min)                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. WhatsAppWebhookController.receiveMessage()               │
│    - Parse webhook payload                                  │
│    - De-duplication check (WhatsappWebhookEvent)            │
│    - Extract: phoneNumber, messageContent, externalMessageId│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. findOrCreateCustomer()                                   │
│    - Language detection da phone prefix                     │
│      (+39 → it, +34 → es, +351 → pt, default → en)         │
│    - Se nuovo: status=NEW, isActive=false (Rule #4)        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Pre-checks (Channel & Customer Status)                  │
│    - channelStatus=false? → WIP message, STOP              │
│    - debugMode=true? → WIP message, STOP                   │
│    - isBlacklisted=true? → BLOCK silently, STOP            │
│    - subscriptionStatus=PAUSED/PAYMENT_FAILED? → BLOCK     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Welcome vs Returning Customer                           │
│    - NEW customer + first message? → Send welcomeMessage   │
│    - PENDING_APPROVAL? → "Registrazione in attesa..."      │
│    - ACTIVE + isActive=false? → NOT registered flow        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. findOrCreateChatSession()                               │
│    - Unique constraint: (customerId, status='active')      │
│    - Transaction-safe creation (prevents duplicates)       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Operator Queue Check                                    │
│    - activeChatbot=false? → Route to human operator        │
│    - operatorQueuePosition != null? → In queue, FIFO       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. LLM Router Orchestration                                │
│    └─→ LLMRouterService.routeMessage()                     │
│        ├─→ STEP 0: Load last 10 ConversationMessages       │
│        ├─→ STEP 1: Call ROUTER agent (intent classification│
│        │            + FAQ check)                            │
│        ├─→ STEP 2: Route to specialized agent based on     │
│        │            intent (PRODUCT_SEARCH, CART, ORDER,    │
│        │            CUSTOMER_SUPPORT, INFO_AGENT, etc.)     │
│        ├─→ STEP 3-N: Agent executes (can call functions)   │
│        ├─→ STEP 98: SECURITY agent validates response      │
│        └─→ STEP 99: TRANSLATION agent translates to        │
│                     customer.language                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Save to Database                                        │
│    - ConversationMessage (role=user, content=message)      │
│    - ConversationMessage (role=assistant, content=response)│
│    - AgentConversationLog (per ogni step con metrics)      │
│    - Message (old table, per chat UI)                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. WhatsApp Queue + Billing                               │
│     - Create WhatsAppQueue (status=pending)                │
│     - Create BillingTransaction (type=MESSAGE, -€0.10)     │
│     - Update User.creditBalance -= 0.10                    │
│     - Check creditBalance < -10 → BLOCK workspace          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Scheduler Job (every 5 sec)                            │
│     - WhatsAppChannelQueueJob picks pending messages       │
│     - Sends via provider API (Meta/UltraMsg/WaAPI)         │
│     - Update status: pending → sent / failed               │
│     - Cooldown 6 sec tra messaggi                          │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. Flusso LLM Multi-Agent Routing

**Architecture**: Multi-Agent Orchestration con OpenRouter

```
INPUT: customerMessage, customer, workspace, chatSession
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 0.5: Variable Replacement                              │
│  PromptProcessorService.replaceAllVariables()               │
│  - {{chatbotName}} → workspace.chatbotName                  │
│  - {{customerName}} → customer.name                         │
│  - {{products}} → formatted product catalog                 │
│  - {{categories}} → formatted categories                    │
│  - {{offers}} → active offers                               │
│  - {{services}} → available services                        │
│  - {{faqs}} → FAQ knowledge base                            │
│  - {{lastOrderCode}} → customer's last order                │
│  - {{cartContents}} → current cart items                    │
│  - {{salesAgentName}} → assigned sales agent name           │
│  - {{salesAgentEmail}} → assigned sales agent email         │
│  - {{salesAgentPhone}} → assigned sales agent phone         │
│  - IF sellsProductsAndServices=false → skip ecommerce vars  │
│  - IF customer has no sales agent → sales vars are empty    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: ROUTER Agent (order=0)                              │
│  Model: GPT-4o-mini                                          │
│  Prompt: "You are the ROUTER..."                            │
│  Task:                                                       │
│   1. Check FAQs FIRST → exact match? Return FAQ answer      │
│   2. Classify intent → return AgentType to route to         │
│   3. Extract entities (product names, order codes, etc.)    │
│  Output:                                                     │
│   {                                                          │
│     "intent": "SEARCH_PRODUCTS",                            │
│     "targetAgent": "PRODUCT_SEARCH",                        │
│     "confidence": 0.95,                                      │
│     "entities": {"productName": "vino rosso"},              │
│     "reasoning": "Customer looking for wine products"        │
│   }                                                          │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Route to Specialized Agent                          │
│  Based on targetAgent:                                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PRODUCT_SEARCH Agent (order=2)                      │   │
│  │ - Task: Search products by name/category/price      │   │
│  │ - Functions: searchProducts(), getCatalog()         │   │
│  │ - Output: List of relevant products with details    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CART_MANAGEMENT Agent (order=3)                     │   │
│  │ - Task: Add/remove/view cart items                  │   │
│  │ - Functions: addToCart(), removeFromCart(),         │   │
│  │              viewCart(), clearCart()                │   │
│  │ - Output: Updated cart summary                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ORDER_TRACKING Agent (order=4)                      │   │
│  │ - Task: View past orders, check order status        │   │
│  │ - Functions: getOrders(), getOrderByCode()          │   │
│  │ - Output: Order history or specific order details   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CUSTOMER_SUPPORT Agent (order=5) - E-commerce       │   │
│  │ - Task: Handle complaints, refunds, support         │   │
│  │ - Functions: contactOperator(), createComplaint()   │   │
│  │ - Output: Escalation to human or automated response │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ INFO_AGENT (order=2) - Informational workspaces     │   │
│  │ - Task: Answer questions, provide info              │   │
│  │ - Functions: searchFAQs(), provideInfo()            │   │
│  │ - Output: Informative response, FAQ answers         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PROFILE_MANAGEMENT Agent (order=6)                  │   │
│  │ - Task: Update customer profile, preferences        │   │
│  │ - Functions: updateProfile(), viewProfile()         │   │
│  │ - Output: Confirmation of profile changes           │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 3-N: Agent Execution                                   │
│  - Agent receives: customerMessage + context + history      │
│  - Agent can call Calling Functions:                        │
│    ├─ DELEGATE_TO_AGENT: Routes to another agent           │
│    ├─ WEBHOOK: POST to workspace.webhookUrl with HMAC      │
│    └─ INTERNAL: Direct service call (e.g., searchProducts) │
│  - Agent returns: answer + metadata                         │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 5.5: SUMMARY_AGENT (optional - order=5.5)              │
│  - Summarizes long conversations for context window         │
│  - Only runs if ConversationMessage count > threshold       │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 8: CONVERSATION_HISTORY (optional - order=8)           │
│  - Humanization layer: adds greetings, context, offers      │
│  - E.g., "Ciao Andrea! 👋 Ho visto che..."                  │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 98: SECURITY Agent (order=98)                          │
│  - Validates response content for safety                    │
│  - Blocks: offensive, personal data leaks, phishing links   │
│  - Checks: allowedExternalLinks (only whitelisted domains)  │
│  - Output: SAFE / UNSAFE (if unsafe → generic error msg)    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 99: TRANSLATION Agent (order=99)                       │
│  - Translates FINAL response to customer.language           │
│  - Preserves formatting, emojis, special chars              │
│  - Translation rules:                                        │
│    - Product names: Preserve IF translateProductNames=false │
│    - Category names: Preserve IF translateCategoryNames=false│
│    - Service names: Always translate (default)             │
│  - Output: Translated message ready for customer            │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
                     FINAL RESPONSE
```

**Key Features**:
- **Agent Chaining**: ROUTER → Specialized → SECURITY → TRANSLATION
- **Context Window**: Last 10 ConversationMessages passed to each agent
- **Function Calling**: Agents can trigger system actions (searchProducts, addToCart, etc.)
- **Variable Injection**: Dynamic prompts with `{{placeholder}}` replacement
- **E-commerce Toggle**: `sellsProductsAndServices=false` → hides product agents, uses INFO_AGENT
- **Logging**: Every step logged in `AgentConversationLog` with metrics (tokens, latency, confidence)

---

### 5. Flusso Chiamata Funzione (Calling Functions)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. LLM Agent decides to call function                       │
│    Example: PRODUCT_SEARCH agent calls "searchProducts"     │
│    Parameters: {"query": "vino rosso", "maxResults": 5}     │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Lookup WorkspaceCallingFunction                          │
│    - Find by workspaceId + functionName                     │
│    - Check isActive=true                                    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Route based on executionType                             │
│                                                              │
│    ┌────────────────────────────────────────────────┐       │
│    │ A) DELEGATE_TO_AGENT                           │       │
│    │    - Route to targetAgent (e.g., PRODUCT_SEARCH)│      │
│    │    - Internal execution, no external call       │      │
│    └────────────────────────────────────────────────┘       │
│                                                              │
│    ┌────────────────────────────────────────────────┐       │
│    │ B) WEBHOOK (External Custom Function)          │       │
│    │    - URL: functionRecord.webhookUrl ??          │      │
│    │           workspace.webhookUrl                  │      │
│    │    - HMAC signature:                            │      │
│    │      sha256(workspace.webhookSecret + payload)  │      │
│    │    - POST with timeout (default 10s)            │      │
│    │    - Payload: {                                 │      │
│    │        functionName,                            │      │
│    │        parameters,                              │      │
│    │        customer: {...},                         │      │
│    │        workspace: {...}                         │      │
│    │      }                                           │      │
│    │    - Expected response: {                       │      │
│    │        success: true,                           │      │
│    │        data: {...}                              │      │
│    │      }                                           │      │
│    └────────────────────────────────────────────────┘       │
│                                                              │
│    ┌────────────────────────────────────────────────┐       │
│    │ C) INTERNAL (Built-in System Function)         │       │
│    │    - Direct call to service method              │      │
│    │    - Examples: searchProducts(), addToCart()    │      │
│    └────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Return result to LLM Agent                               │
│    - Success: {success: true, data: {...}}                  │
│    - Error: {success: false, error: "message"}              │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Agent processes result                                   │
│    - Formats response per LLM instructions                  │
│    - Uses responseInstructions from function config         │
│    - Example: "Ecco i prodotti trovati: ..."                │
└──────────────────────────────────────────────────────────────┘
```

**System Functions** (built-in, non-deletable):
- `searchProducts` → ProductSearchAgentLLM
- `addToCart`, `removeFromCart`, `viewCart`, `clearCart` → CartManagementAgentLLM
- `getOrders`, `getOrderByCode` → OrderTrackingAgentLLM
- `contactOperator` → CustomerSupportAgentLLM (escalate to human)
- `updateProfile`, `viewProfile` → ProfileManagementAgentLLM

**Custom Functions** (user-defined webhooks):
- Example: `cercaPrecedentiLegali` (cerca casi giurisprudenziali)  
  → POST https://cliente-law-api.com/search  
  → HMAC signed with workspace.webhookSecret

---

### 6. Flusso Widget Chat (Anonymous Customer)

```
1. User opens website → Widget script loaded
2. Widget generates visitorId: `visitor_{timestamp}_{random}`
3. User sends message → POST /api/widget/chat
   - Headers: x-workspace-id, x-visitor-id
   - NO authentication required
4. Backend:
   - findOrCreateCustomer(customId=visitorId, isAnonymous=true)
   - findOrCreateChatSession(visitorId, channel='widget', expiresAt=+24h)
5. LLM routing (same as WhatsApp)
6. Response saved to WhatsAppQueue (channel='widget', responsePayload=JSON)
7. Widget polls /api/widget/chat/{visitorId}/messages
   - Returns: messages with deliveryStatus='sent'
8. After 24h: Scheduler deletes expired anonymous sessions
```

**Widget Security**:
- No login required for anonymous mode
- Rate limiting: 10 messages/minute per visitorId
- Session expiry: 24 hours (auto-cleanup)
- CORS: Origin validation against workspace.websiteUrl

---

### 7. Flusso Human Operator Escalation

```
1. Customer sends: "Voglio parlare con un operatore"
2. Router Agent → returns: targetAgent=CUSTOMER_SUPPORT, intent=CONTACT_OPERATOR
3. CustomerSupportAgentLLM → calls contactOperator()
4. Backend:
   - Set customer.activeChatbot=false (disable AI)
   - Set customer.operatorRequestedAt=NOW
   - Set customer.operatorQueuePosition=NEXT_AVAILABLE
   
   🆕 SALES AGENT ROUTING:
   - IF workspace.hasSalesAgents=true AND customer.salesId exists:
     → Email sent to customer.sales.email (priority routing)
   - ELSE:
     → Email sent to workspace.operatorEmail (general operator)
   
   🆕 CONVERSATION SUMMARY AI:
   - SummaryAgentLLM generates 1-sentence intelligent summary
   - Patterns: "L'utente vuole/cerca/si lamenta/non è riuscito..."
   - Fallback: "Riassunto non disponibile" (never shows message list)
   - LLM Config: temperature=0.3, max_tokens=50 (90% cost reduction)
   - Summary shown at TOP of notification (most important info first)
   
   - notification to target email (if operatorContactMethod='email')
     OR add to WhatsApp queue for workspace.operatorWhatsappNumber
5. Customer in queue → AI sends: "Sei in coda. Un operatore ti contatterà a breve."
6. Operator panel (Frontend /operator-queue):
   - Shows list of customers sorted by operatorQueuePosition + operatorQueueEnteredAt
   - Operator clicks "Take" → customer.operatorQueuePosition=1 (currently served)
7. Operator sends message manually:
   - Message.sentBy=operatorUserId
   - Message queued to WhatsAppQueue
8. When operator done:
   - Clicks "Close" → customer.activeChatbot=true (re-enable AI)
   - customer.operatorQueuePosition=null
```

**Operator Features**:
- View live customer profile + order history
- Send manual messages (text, images, documents)
- Transfer to another operator
- End conversation (re-enable AI)
- 🆕 **AI-generated conversation summary** in notification email (1 professional sentence)
- 🆕 **Priority routing** to assigned sales agent when available

---

### 8. Flusso E-commerce Order

```
1. Customer adds products to cart:
   "Vorrei 2 bottiglie di Chianti"
   → Router → CART_MANAGEMENT agent → calls addToCart()
   
2. View cart:
   "Mostrami il carrello"
   → Router → CART_MANAGEMENT → calls viewCart()
   → Response: "Carrello: 2x Chianti Classico (€25.00 cad) = €50.00"

3. Confirm order:
   "Confermo l'ordine"
   → Router → CART_MANAGEMENT → calls createOrderFromCart()
   → Backend:
      a) Create Order (status=PENDING, paymentStatus=PENDING)
      b) Generate orderCode (ORD-2026-001)
      c) Create OrderItems from CartItems
      d) Clear cart
      e) Create PaymentDetails (provider=PAYPAL)
      f) Generate PayPal payment link
      g) Billing: -€1.00 NEW_ORDER fee
      h) Set order.billedAt=NOW (prevent double-charge)
   → Response: "Ordine creato! Paga qui: https://paypal.me/..."

4. Customer pays via PayPal:
   → PayPal webhook → POST /api/paypal/webhook
   → Backend:
      a) Validate HMAC signature
      b) Update PaymentDetails (status=COMPLETED)
      c) Update Order (paymentStatus=COMPLETED, status=CONFIRMED)
      d) Generate invoice PDF (stored in Cloudinary)
      e) Update order.invoiceUrl, order.invoiceKey
   → Send confirmation via WhatsApp: "Pagamento ricevuto! Ordine confermato."

5. Customer views order:
   "Vedi i miei ordini"
   → Router → ORDER_TRACKING → calls getOrders()
   → Response: "Ordini:\n1. ORD-2026-001 - €50.00 - CONFERMATO"

6. Download invoice:
   Customer clicks link → GET /api/orders/:orderCode/invoice
   → Validates SecureToken
   → Returns signed URL (24h expiry) or redirects to Cloudinary URL
```

---

### 9. Flusso Push Campaign

```
1. Owner creates campaign (Frontend /campaigns):
   - Name: "Promo Natale 2026"
   - Targeting: TAGS → tagId="vip-customers"
   - Message: "Ciao {{customerName}}! Sconto 20% su tutti i vini fino al 31/12!"
   - Schedule: sendAt="2026-12-15 10:00", frequency=ONCE

2. Backend saves PushCampaign (status=SCHEDULED)

3. Scheduler job (runs every minute):
   a) Find campaigns WHERE status=SCHEDULED AND sendAt <= NOW
   b) For each campaign:
      - Load target customers (by tags/manual IDs/ALL)
      - Create PushCampaignRecipient for each (status=PENDING)
      - Update campaign status=RUNNING
   c) Process batch (throttlePerSecond=10, batchSize=50):
      - Replace variables: {{customerName}} → customer.name
      - Create WhatsAppQueue (pushCampaignId, pushCampaignRecipientId)
      - Billing: -€1.00 PUSH_NOTIFICATION per message
      - Update recipient status=SENT
   d) When all done: campaign status=COMPLETED

4. WhatsApp queue job (every 5 sec) sends messages

5. Track results:
   - actualSent, actualFailed, actualSkipped
   - billingStatus: PENDING → PARTIAL → BILLED
```

**Campaign Features**:
- Recurring: WEEKLY, MONTHLY, QUARTERLY, etc. (nextRunAt auto-calculated)
- Variable replacement: `{{customerName}}`, `{{email}}`, `{{phone}}`, etc.
- Tag-based targeting: Customers with specific tags
- Manual targeting: Select specific customers
- Throttling: Limit sending rate (avoid provider blocks)
- Idempotency: Push campaign ID prevents duplicate sends

---

### 10. Flusso Billing & Credit System

```
┌──────────────────────────────────────────────────────────────┐
│ Owner Registration                                           │
│ - Plan: FREE_TRIAL                                           │
│ - Credit: +€19 (initialCredit)                               │
│ - Trial ends: +14 days                                       │
│ - BillingTransaction: type=INITIAL_CREDIT, amount=+19       │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Usage Events (Per-Action Billing)                           │
│                                                              │
│ Message Sent:                                               │
│  - BillingTransaction: type=MESSAGE, amount=-0.10           │
│  - User.creditBalance -= 0.10                               │
│                                                              │
│ New Order Created:                                           │
│  - BillingTransaction: type=NEW_ORDER, amount=-1.00         │
│  - User.creditBalance -= 1.00                               │
│  - order.billedAt=NOW (prevent double-charge)               │
│                                                              │
│ Push Message Sent:                                           │
│  - BillingTransaction: type=PUSH_NOTIFICATION, amount=-1.00 │
│  - User.creditBalance -= 1.00                               │
│  - PushCampaignRecipient.priceCharged=1.00                  │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Low Balance Check                                           │
│ - After each transaction, check User.creditBalance          │
│ - IF creditBalance < lowBalanceThreshold (€5):              │
│   → Send email notification (once per day max)              │
│   → Update User.lowBalanceNotifiedAt                        │
│ - IF creditBalance < -10:                                   │
│   → Block ALL workspaces (channelStatus=false)              │
│   → subscriptionStatus=PAYMENT_FAILED                       │
│   → Send urgent email                                       │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Monthly Billing (1st of month - Scheduler job)              │
│                                                              │
│ For each User WHERE subscriptionStatus=ACTIVE:              │
│  1. Calculate:                                              │
│     - subscriptionAmount = planType monthly fee             │
│     - creditUsage = SUM(BillingTransaction) last month      │
│     - creditDebt = creditBalance < 0 ? abs(creditBalance) : 0│
│     - totalAmount = subscriptionAmount + creditDebt         │
│                                                              │
│  2. Create MonthlyInvoice:                                  │
│     - status=PENDING                                        │
│     - periodStart=1st, periodEnd=last day of month          │
│     - invoiceNumber=INV-2026-03-0001                        │
│     - itemsBreakdown={messages: 150, orders: 10, pushes: 5}│
│                                                              │
│  3. Charge via PayPal (if connected):                       │
│     - IF User.paypalStatus=CONNECTED:                       │
│       → Create PayPal subscription charge                   │
│       → Update invoice.status=PAID / FAILED                 │
│       → Create BillingTransaction (type=INVOICE_PAID)       │
│     - ELSE:                                                 │
│       → Send email with bank transfer instructions          │
│                                                              │
│  4. Reset trial:                                            │
│     - IF planType=FREE_TRIAL AND trialEndsAt < NOW:         │
│       → Force downgrade to BASIC or BLOCK                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Credit Recharge (Manual)                                    │
│ - Owner → Frontend /billing → "Recharge €50"                │
│ - Redirects to PayPal Checkout                              │
│ - PayPal webhook confirms payment                           │
│ - Backend:                                                  │
│   → BillingTransaction: type=RECHARGE, amount=+50           │
│   → User.creditBalance += 50                                │
│   → IF was blocked: Unblock workspaces                      │
└──────────────────────────────────────────────────────────────┘
```

**Plan Pricing** (configurable via PlanConfiguration table):

| Plan | Monthly Fee | Max Channels | Max Products | Max Customers | Max Team Members |
|------|------------|--------------|--------------|---------------|------------------|
| FREE_TRIAL | €0 (14 days) | 1 | 20 | 50 | 1 |
| BASIC | €19/month | 1 | 50 | 100 | 2 |
| PREMIUM | €49/month | 3 | 200 | 500 | 5 |
| ENTERPRISE | Custom | Unlimited | Unlimited | Unlimited | Unlimited |

**Usage Costs**:
- WhatsApp message: €0.10 per message sent
- New order created: €1.00 per order
- Push notification: €1.00 per recipient

---

## 🔌 Integrazioni Esterne

### 1. WhatsApp Providers

#### **A) Meta Business API** (Default, Production)
**Status**: ✅ Implementato e funzionante

**Configuration**:
- `whatsappProvider='meta'`
- `metaPhoneNumberId`: Phone Number ID da Meta Business
- `metaAccessToken`: Access token permanente
- `webhookVerifyToken`: Token per webhook verification

**Features**:
- mTLS certificate verification (Meta IPs whitelist)
- HMAC signature validation
- Message templates support
- Media handling (images, documents)
- Rate limiting: 1000 msg/day (tier 1), up to 100K/day (tier 4)

**Webhook Flow**:
```
Meta → POST /api/whatsapp/webhook/:webhookId
      → verifyMetaWebhookCertificate (mTLS check)
      → HMAC signature validation
      → WhatsAppWebhookController.receiveMessage()
```

---

#### **B) UltraMsg** (Alternative, Simpler)
**Status**: ✅ Implementato e funzionante

**Configuration**:
- `whatsappProvider='ultramsg'`
- `ultraMsgInstanceId`: Instance ID da dashboard UltraMsg
- `ultraMsgToken`: API token
- `ultraMsgApiUrl`: Base URL (e.g., `https://api.ultramsg.com/{instanceId}`)

**Features**:
- Simpler setup (no Meta Business account needed)
- Send API: POST to `{apiUrl}/messages/chat`
- NO signature validation (less secure)
- Rate limiting only

**Webhook Flow**:
```
UltraMsg → POST /api/whatsapp/ultramsg/:webhookId
         → ultraMsgWebhookController.receiveMessage()
         → NO signature validation (security risk)
```

**Known Issues**:
- Less reliable than Meta
- No official template support
- Rate limits unclear

---

#### **C) WaAPI** (Professional, Best for High Volume)
**Status**: ❌ PARZIALE - Da completare

**Configuration**:
- `whatsappProvider='waapi'`
- `waapiInstanceId`: Instance ID from WaAPI
- `waapiInstanceStatus`: 'pending' → 'authenticated' → 'ready'
- `waapiPhoneNumber`: WhatsApp number
- `waapiQrCodeData`: Base64 QR code for auth (ephemeral, 5 min TTL)
- `waapiWebhookUrl`: Webhook URL configured
- `waapiWebhookEvents[]`: Subscribed events

**Authentication Flow**:
```
1. Backend POST /api/workspaces/{id}/waapi/create-instance
   → Creates WaAPI instance
   → Returns instanceId

2. WaAPI sends QR code webhook → POST /api/waapi/webhook/:workspaceId
   → Save workspace.waapiQrCodeData (base64 image)
   → Frontend polls GET /api/workspaces/{id}/waapi/qr-code
   → Displays QR code to user

3. User scans QR with WhatsApp mobile app

4. WaAPI sends 'authenticated' webhook
   → Update workspace.waapiInstanceStatus='authenticated'

5. WaAPI sends 'ready' webhook
   → Update workspace.waapiInstanceStatus='ready'
   → channelStatus=true (enable chatbot)

6. Cleanup: Scheduler job removes QR codes older than 5 minutes
```

**Webhook Events**:
- `qr`: QR code generated
- `authenticated`: User scanned QR
- `ready`: WhatsApp connection established
- `disconnected`: Connection lost
- `message`: Incoming message

**TODO** (Manca implementazione):
- ❌ Send message API integration
- ❌ Media handling (images, documents)
- ❌ Message status updates (delivered, read)
- ❌ Reconnection logic on disconnect
- ❌ Rate limiting configuration

---

### 2. LLM Provider - OpenRouter

**Status**: ✅ Implementato e funzionante

**Configuration**:
- API Key: `process.env.OPENROUTER_API_KEY`
- Base URL: `https://openrouter.ai/api/v1`
- Default model: `openai/gpt-4o-mini` (ogni agent può overridare)

**Model Selection** (configurabile per agent):
- `openai/gpt-4o-mini` - Fast, cheap, good for routing (default)
- `openai/gpt-4o` - More capable, expensive
- `anthropic/claude-3.5-sonnet` - Alternative provider
- `google/gemini-pro` - Google's offering

**Features**:
- Auto-fallback su provider failure
- Token counting con `tiktoken`
- Streaming support (not used yet)
- Rate limiting handled by OpenRouter

**Usage Tracking**:
- Save to `AgentConversationLog.tokensUsed`
- Monthly aggregation for billing insights

---

### 3. PayPal Integration

**Status**: ✅ Implementato (Sandbox + Production)

#### **A) PayPal Checkout (One-time Payments)**
Used for: Order payments, credit recharges

**Flow**:
```
1. Backend creates PayPal order:
   POST https://api.paypal.com/v2/checkout/orders
   {
     "intent": "CAPTURE",
     "purchase_units": [{
       "amount": {"currency_code": "EUR", "value": "50.00"}
     }]
   }
   → Returns: orderID

2. Frontend redirects to PayPal:
   https://www.paypal.com/checkoutnow?token={orderID}

3. User completes payment

4. PayPal webhook → POST /api/paypal/webhook
   → Validate HMAC signature
   → Capture order: POST /v2/checkout/orders/{orderID}/capture
   → Update Order.paymentStatus=COMPLETED
   → Create BillingTransaction

5. Redirect user to /paypal-result?success=true
```

#### **B) PayPal Subscriptions (Recurring Monthly Billing)**
**Status**: ✅ Implemented but needs testing

**Setup Flow**:
```
1. Owner → Frontend /billing → "Connect PayPal"
2. Backend creates subscription:
   POST https://api.paypal.com/v1/billing/subscriptions
   {
     "plan_id": "P-BASIC-PLAN-ID", // Pre-created in PayPal dashboard
     "start_time": "2026-04-01T00:00:00Z",
     "subscriber": {"email_address": "owner@example.com"}
   }
   → Returns: subscriptionID + approval_url

3. Redirect to approval_url
4. User approves subscription
5. PayPal webhook: BILLING.SUBSCRIPTION.ACTIVATED
   → Update User.paypalSubscriptionId, paypalSubscriptionStatus=ACTIVE
```

**Monthly Billing Webhook**:
```
PayPal sends: PAYMENT.SALE.COMPLETED
→ Backend:
  - Find User by paypalSubscriptionId
  - Create MonthlyInvoice (status=PAID)
  - Create BillingTransaction (type=INVOICE_PAID, amount=plan monthly fee)
  - NO credit deduction (invoice paid via bank)
```

**Sandbox Config**:
- `process.env.PAYPAL_CLIENT_ID_SANDBOX`
- `process.env.PAYPAL_CLIENT_SECRET_SANDBOX`
- Test accounts: buyer/seller from PayPal Developer Dashboard

---

### 4. File Storage - Cloudinary

**Status**: ✅ Implementato (Production)

**Configuration**:
- Cloud name: `process.env.CLOUDINARY_CLOUD_NAME`
- API key: `process.env.CLOUDINARY_API_KEY`
- API secret: `process.env.CLOUDINARY_API_SECRET`

**Upload Pattern**:
```typescript
// Unified storage service
import { storageService } from '@/services/storage.service'

// Upload image
const result = await storageService.uploadImage(file, {
  folder: 'products',
  workspaceId,
  resourceId: product.id
})
// Returns: { url: 'https://res.cloudinary.com/...', key: 'products/workspace-id/product-id.jpg' }

// Delete image (cleanup)
await storageService.deleteByKey(imageKey)
```

**Storage Paths**:
- Products: `products/{workspaceId}/{productId}.{ext}`
- Services: `services/{workspaceId}/{serviceId}.{ext}`
- Logos: `logos/{workspaceId}/{type}.{ext}` (type=channel/widget)
- Invoices: `invoices/{workspaceId}/{orderCode}.pdf`
- Support attachments: `support/{ticketId}/{filename}`

**Cleanup**:
- Scheduler job: `unused-images-cleanup` (daily 04:00)
  - Finds `imageKey` in Products/Services/Workspace where deletedAt IS NOT NULL
  - Deletes from Cloudinary
  - Nulls `imageKey` field

**Local Development**:
- Falls back to local filesystem: `uploads/` folder
- No cleanup job for local files (manual cleanup)

---

### 5. Email Notifications

**Status**: ✅ Implementato (Production: SendGrid, Dev: Ethereal)

**Configuration**:
- Production: SendGrid (`process.env.SENDGRID_API_KEY`)
- Development: Ethereal (auto-generated test account)

**Email Types**:

```typescript
// Welcome email
await emailService.sendWelcomeEmail(user.email, user.firstName)

// Password reset
await emailService.sendPasswordReset(user.email, resetToken)

// Low balance warning
await emailService.sendLowBalanceNotification(user.email, user.creditBalance)

// Trial expiration
await emailService.sendTrialExpiring(user.email, daysLeft)

// Monthly invoice
await emailService.sendMonthlyInvoice(user.email, invoice)

// Team invitation
await emailService.sendTeamInvitation(email, workspace.name, invitationToken)

// Operator notification (escalation)
await emailService.sendOperatorNotification(workspace.operatorEmail, customer)
```

**Multilingual Support**:
- Email language based on `workspace.defaultLanguage` or `user.language`
- Templates in: IT, EN, ES, PT
- HTML templates with inline CSS

---

## 🔒 Security & Authentication

### 1. Autenticazione Utenti

#### **A) Email/Password**
- Password: bcrypt hash (rounds=10, salt automatically generated)
- JWT token: HS256 algorithm, 24h expiry
- Payload: `{ userId, email, workspaceId, role, iat, exp }`
- Cookie: `httpOnly=true, secure=true (prod), sameSite=strict`

#### **B) OAuth Providers**
**Status**: ✅ Implementato (Google, Facebook, Apple login/signup)

**Supported Providers**:
- Google OAuth 2.0
- Facebook Login
- Apple Sign In

**Flow**:
```
1. Frontend → /auth/google (redirect to Google consent)
2. Google → callback: /auth/google/callback?code=...
3. Backend:
   - Exchange code for access token
   - Fetch user profile (email, name, picture)
   - findOrCreate User (authProvider='google', linkedProviders=[])
   - Generate JWT token
4. Redirect to /dashboard with token
```

**Account Linking**:
- User can link multiple providers (email+Google+Facebook)
- `User.linkedProviders` JSON: `[{provider: 'google', linkedAt: '2026-03-01'}]`
- Primary login method: First registered provider

---

#### **C) 2FA (Two-Factor Authentication)**
**Status**: ✅ Implementato (TOTP + Recovery codes)

**Setup Flow**:
```
1. User → Frontend /profile/2fa → Enable 2FA
2. Backend generates TOTP secret (otpauth://...)
3. Frontend displays QR code (user scans with Authy/Google Authenticator)
4. User enters 6-digit code for verification
5. Backend:
   - Validates code
   - Save User.twoFactorSecret (encrypted)
   - Set User.twoFactorEnabled=true
   - Generate 10 recovery codes (bcrypt hashed)
   - Return recovery codes to user (display once, user must save)
```

**Login Flow con 2FA**:
```
1. User → POST /auth/login (email, password)
2. Backend:
   - Validates password
   - IF twoFactorEnabled=true:
     → Return: { requires2FA: true, tempToken: "..." }
     → Frontend shows 2FA code input
3. User → POST /auth/2fa/verify (tempToken, code)
4. Backend:
   - Validates TOTP code OR recovery code
   - IF recovery code used: Mark as used (can't reuse)
   - Generate full JWT token
   - Return: { token, user }
```

**Admin 2FA Reset**:
- Admin can reset user's 2FA (when user loses phone)
- Creates `TwoFactorResetToken` (1h expiry, unique URL)
- User must verify password before re-enabling 2FA

---

### 2. Workspace Isolation (Multi-Tenancy Security)

**Rule**: EVERY database query MUST filter by `workspaceId`

**Pattern**:
```typescript
// ❌ WRONG - No workspace filter
const products = await prisma.products.findMany()

// ✅ CORRECT - Workspace isolation
const products = await prisma.products.findMany({
  where: { workspaceId, deletedAt: null }
})
```

**Middleware Stack** (Protected Routes):
```typescript
router.get(
  '/workspaces/:workspaceId/products',
  authMiddleware,                    // 1. JWT validation
  sessionValidationMiddleware,       // 2. x-session-id header
  validateWorkspaceOperation,        // 3. x-workspace-id + param match
  productController.getAll
)
```

**Validation Checks**:
1. `authMiddleware`: JWT token valid → sets `req.user`
2. `sessionValidationMiddleware`: `x-session-id` header present
3. `validateWorkspaceOperation`:
   - `x-workspace-id` header === `:workspaceId` param
   - User has access to workspace (UserWorkspace relation exists)
   - Sets `req.workspaceId` for controller use

**IDOR Prevention**:
```typescript
// Verify user has access to workspace before ANY operation
const userWorkspace = await prisma.userWorkspace.findUnique({
  where: {
    userId_workspaceId: { userId, workspaceId }
  }
})
if (!userWorkspace) {
  throw new Error('Access denied to workspace')
}
```

---

### 3. Rate Limiting

#### **WhatsApp Webhook**
- 100 requests/minute per `workspaceId`
- Prevents DDoS via webhook flooding

#### **API Endpoints**
- Global: 100 requests/15 minutes per IP
- Login: 5 attempts/15 minutes per IP
- Registration: 5 attempts/hour per IP
- Password reset: 3 attempts/hour per email

#### **Message Sending**
- Operator: 10 messages/minute (prevents spam)
- Customer: 20 messages/minute (generous limit)

**Implementation**: `express-rate-limit` middleware

---

### 4. Content Security

#### **Security Agent** (LLM-based)
Validates ALL outbound responses before sending to customer:
- ❌ Blocks: Offensive language, personal data leaks, phishing
- ❌ Validates: External links against `workspace.allowedExternalLinks`
- ✅ Pass-through: Safe, appropriate content

#### **HMAC Signature** (Webhook Security)
All custom function webhooks signed with HMAC-SHA256:
```typescript
const signature = crypto
  .createHmac('sha256', workspace.webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex')

// Send in header: x-signature: sha256={signature}
```

Recipient MUST validate signature to prevent tampering.

---

### 5. Soft Delete + Trash System

**Retention Policy**:
- Soft delete: `deletedAt` set to NOW
- Retention: 90 days in trash
- Hard delete: Scheduler job runs daily, removes records with `deletedAt < NOW - 90 days`

**Trash Management** (Backoffice):
- `TrashPage`: Lists all soft-deleted entities
- Actions: RESTORE (set `deletedAt=null`) or PERMANENTLY DELETE (hard delete now)

**Audit Logging**:
- `SoftDeleteAuditLog`: Records all hard deletes for compliance
- Tracks: `entityType`, `deletedIds[]`, `reason`, `deletedByUserId`

---

## 📊 Analytics & Monitoring

### 1. Dashboard Stats (Owner)

**Real-time Metrics**:
- Total customers (active + inactive)
- Total orders (by status)
- Revenue (total + monthly)
- Messages sent (last 7/30 days)
- Credit balance + burn rate
- Workspace health score (0-100)

**Charts**:
- Orders over time (line chart, last 30 days)
- Revenue by product category (pie chart)
- Customer acquisition (line chart)
- Message volume (bar chart, hourly/daily)

---

### 2. Analytics Page (Owner)

**Advanced Metrics**:
- Conversion rate: Orders / Conversations
- Average order value (AOV)
- Customer lifetime value (CLV)
- Response time: Avg time to first AI response
- Agent performance: Success rate per agent type
- FAQ hit rate: % queries answered by FAQ vs agent

**Filters**:
- Date range picker
- Product category filter
- Customer segment filter

---

### 3. Platform Analytics (Admin - Backoffice)

**Global Metrics**:
- Total users (owners)
- Total workspaces (channels)
- Total revenue (subscription + usage)
- Active trials vs paid plans
- Churn rate
- Average credit balance per user

**Insights**:
- Top workspaces by revenue
- Failed payments dashboard
- Trial expiration calendar
- Support ticket trends

---

### 4. Performance Monitoring

**Logging**:
- Winston logger (info, error, debug levels)
- Log rotation: Daily, max 14 days retention
- Heroku log drains (for production)

**Metrics Tracked**:
- API response times (per endpoint)
- LLM latency (per agent, per model)
- Database query times (slow query log)
- WhatsApp queue processing time
- Error rates (5xx responses)

**Alerts** (Future):
- Credit balance < €5 → Email owner
- Failed payment 3x → Block workspace
- High error rate (>5%) → Email admin
- Slow LLM response (>10s) → Log warning

---

## 🔮 Gap Analysis - Features Da Implementare

### 1. **WaAPI Integration Completion** (HIGH PRIORITY)

**Status**: ❌ Parziale - 40% implementato

**Missing**:
- ❌ Send message API integration
- ❌ Media handling (images, documents, audio)
- ❌ Message status updates (sent, delivered, read, failed)
- ❌ Reconnection logic on disconnect event
- ❌ Rate limiting configuration
- ❌ Error handling for API failures
- ❌ QR code re-generation on expiry

**Implementation Plan**:
```typescript
// 1. Send Message API
async sendViaWaAPI(workspace: Workspace, message: string, phone: string) {
  const response = await axios.post(
    `https://waapi.app/api/v1/instances/${workspace.waapiInstanceId}/client/action/send-message`,
    {
      chatId: `${phone}@c.us`,
      message: message
    },
    {
      headers: {
        'Authorization': `Bearer ${workspace.waapiToken}`,
        'Content-Type': 'application/json'
      }
    }
  )
  
  // Handle response
  if (response.data.success) {
    return { messageId: response.data.data.key.id }
  } else {
    throw new Error(response.data.error)
  }
}

// 2. Webhook Handler for Message Status
router.post('/api/waapi/webhook/:workspaceId', async (req, res) => {
  const { event, data } = req.body
  
  switch (event) {
    case 'message.ack':
      // Update WhatsAppQueue status based on ack level
      // 1 = sent, 2 = delivered, 3 = read
      break
    case 'disconnected':
      // Update workspace.waapiInstanceStatus='disconnected'
      // Trigger re-authentication flow
      break
  }
})
```

**Estimated Effort**: 2-3 giorni

---

### 2. **Facebook Meta Integration** (MEDIUM PRIORITY)

**Status**: ❌ Non implementato - 0%

**Scope**:
- Messenger chatbot integration (similar to WhatsApp)
- Instagram DM chatbot
- Unified inbox per messaggi cross-platform

**Architecture**:
```
┌─────────────────────────────────────────────────┐
│ New Fields in Workspace Model                  │
├─────────────────────────────────────────────────┤
│ messengerPageId: String?                        │
│ messengerPageAccessToken: String?               │
│ instagramAccountId: String?                     │
│ instagramAccessToken: String?                   │
│ facebookAppId: String?                          │
│ facebookAppSecret: String?                      │
│ enableMessenger: Boolean @default(false)        │
│ enableInstagram: Boolean @default(false)        │
└─────────────────────────────────────────────────┘
```

**Implementation Steps**:
1. Create Facebook App in Meta Developers
2. Configure webhook subscriptions (messages, messaging_postbacks)
3. Implement webhook handler: `/api/meta/webhook/:workspaceId`
4. Adapt LLM routing for Messenger/Instagram (channel detection)
5. Send API integration for both platforms
6. Media handling (images, videos, stickers)

**Challenges**:
- Meta review process for production access
- Different API rate limits than WhatsApp
- Structured messages support (buttons, carousels)
- Story replies handling (Instagram-specific)

**Estimated Effort**: 1-2 settimane

**Priority Reasoning**: Non prioritario - WhatsApp copre >90% del mercato target (PMI italiane)

---

### 3. **Improved Onboarding Wizard** (HIGH PRIORITY)

**Status**: ✅ Implementato BUT needs UX improvements

**Andrea's Vision**:
> "Voglio arrivare a fare un chatbot funzionante in pochissimi passaggi. Per questo WAAPI è migliore di Meta (troppo complesso setup)."

**Current Flow**: 8 steps, ~10 minutes
**Target Flow**: 3 steps, ~3 minutes

**Proposed Simplified Wizard**:
```
Step 1: "Cosa vende la tua azienda?"
- Input: Business name, tipo (food/fashion/tech/services)
- Auto-fill: chatbotName = business name

Step 2: "Come vuoi ricevere messaggi?"
- Options:
  [x] WhatsApp (recommended) → Auto-select WaAPI
  [ ] Website Widget
  [ ] Entrambi
- IF WhatsApp: Show QR code IMMEDIATELY (no config needed)
- IF Widget: Generate embed code IMMEDIATELY

Step 3: "Carica i tuoi prodotti" (OPTIONAL - skip per servizi)
- Bulk CSV upload
- Or: "Aggiungerò dopo" → Skip to dashboard

DONE! → Redirect to dashboard
```

**Post-Wizard Quick Actions**:
- [ ] Personalizza AI (tono, personality) → Settings
- [ ] Aggiungi FAQ comuni → FAQ Page
- [ ] Configura pagamenti PayPal → Billing
- [ ] Invita team member → Team Page

**Key Improvements**:
1. **Default over Configuration**: Auto-fill everything possibile
2. **QR Code First**: Show WaAPI QR immediately (no fields to fill)
3. **Skip What's Not Essential**: Product catalog is optional for info chatbots
4. **Progressive Disclosure**: Advanced settings moved to Settings page post-onboarding

**Estimated Effort**: 3-4 giorni

---

### 4. **Advanced Analytics & Reporting** (MEDIUM PRIORITY)

**Missing Features**:
- ❌ Funnel analysis (Conversation → Cart → Order)
- ❌ A/B testing for prompts/messages
- ❌ Customer segmentation dashboard
- ❌ Export to CSV/Excel
- ❌ Scheduled email reports (weekly/monthly)
- ❌ Heatmaps (message timing, product views)

**Proposed Dashboard Sections**:

**A) Sales Funnel**:
```
Conversations → Products Viewed → Cart Created → Order Placed → Payment Completed
100%          → 45%              → 25%          → 15%          → 12%

Drop-off points highlighted with actionable insights
```

**B) Customer Segments**:
- VIP: >3 orders, AOV >€100
- At Risk: No orders last 90 days
- New: First order <30 days ago
- Churned: No activity >180 days

**C) Product Performance**:
- Top sellers (by revenue, by units)
- Slow movers (stock >30 days)
- Out of stock alerts
- Margin analysis

**Estimated Effort**: 1-2 settimane

---

### 5. **Mobile App (React Native)** (LOW PRIORITY)

**Scope**:
- Owner mobile app per gestione on-the-go
- Push notifications per nuovi ordini
- Quick reply dal mobile
- Dashboard stats mobile-friendly

**Why Low Priority**:
- Web dashboard già responsive
- Most owners usano desktop per gestione
- Development effort molto alto (iOS + Android)

**Alternative**: Progressive Web App (PWA)
- Installabile su home screen
- Push notifications via service worker
- Offline support
- Much lower effort than native app

**Estimated Effort** (PWA): 1 settimana

---

### 6. **AI Prompt Optimization** (HIGH PRIORITY - Andrea's Concern)

**Andrea's Request**:
> "Devo anche controllare i prompt che abbiamo messo. Voglio migliorare il flusso e la qualità dei messaggi."

**Current Issues**:
- Prompt troppo verbosi → risposte lunghe, token sprecati
- Inconsistency tra agent prompts
- Non sfruttano bene le variabili `{{placeholder}}`
- Mancano esempi di one-shot/few-shot learning

**Optimization Plan**:

```markdown
# ROUTER Agent Prompt (BEFORE)
You are the ROUTER agent. Your job is to analyze the customer's message and decide which specialized agent should handle the request. You can also answer simple questions directly if they are covered by FAQs. Be concise and always provide reasoning for your routing decision.

# ROUTER Agent Prompt (AFTER - Optimized)
Classify intent + answer FAQs.

INPUT: Customer message
OUTPUT: {intent, targetAgent, faqAnswer?, entities}

RULES:
1. Check FAQs first → exact match? Return faqAnswer + targetAgent=null
2. Extract entities (product names, order codes, quantities)
3. Route to:
   - PRODUCT_SEARCH: "voglio", "cerca", "mostrami", product mention
   - CART: "aggiungi", "rimuovi", "carrello", "ordina"
   - ORDER: "ordini", "stato ordine", order code mention
   - SUPPORT: "problema", "assistenza", "operatore"
   - INFO: "chi sei", "dove", "quando", "come funziona"

EXAMPLES:
User: "Avete vino rosso toscano?"
→ {intent: "SEARCH_PRODUCTS", targetAgent: "PRODUCT_SEARCH", entities: {query: "vino rosso toscano"}}

User: "Dove siete?"
→ {intent: "INFO", targetAgent: null, faqAnswer: "{{address}}", entities: {}}
(Use FAQ answer directly, no agent needed)

User: "Aggiungi 2 bottiglie di Chianti"
→ {intent: "ADD_TO_CART", targetAgent: "CART_MANAGEMENT", entities: {productName: "Chianti", quantity: 2}}
```

**Key Improvements**:
1. **Structured Output**: JSON schema forces consistency
2. **Examples**: Few-shot learning improves accuracy
3. **Conciseness**: Remove fluff, keep only essential instructions
4. **Variable Usage**: Leverage `{{faqs}}`, `{{address}}`, etc.

**Prompt Review Checklist**:
- [ ] Router Agent
- [ ] Product Search Agent
- [ ] Cart Management Agent
- [ ] Order Tracking Agent
- [ ] Customer Support Agent
- [ ] Info Agent (for non-ecommerce)
- [ ] Security Agent
- [ ] Translation Agent

**Estimated Effort**: 2-3 giorni + testing

---

### 7. **Conversation Quality Improvements**

**Issues Identified**:
- AI responses troppo formali per `toneOfVoice=friendly`
- Manca personalizzazione basata su customer history
- No proactive suggestions (e.g., "Hai visto le nostre offerte?")
- Repeat customer non riconosciuto (no "Bentornato!")

**Proposed Enhancements**:

**A) Tone Calibration**:
```typescript
// Adjust prompt based on workspace.toneOfVoice
const toneInstructions = {
  friendly: "Usa un tono amichevole e informale. Emoji occasionali 😊. Tu al posto di Lei.",
  formal: "Tono professionale. Usa Lei. No emoji. Linguaggio preciso.",
  professional: "Equilibrio tra cortesia e competenza. Lei quando appropriato.",
  casual: "Molto rilassato. Tu sempre. Emoji frequenti 🎉. Slang OK."
}
```

**B) Customer History Context**:
```typescript
// Add to prompt variables
{{customerSummary}}:
"Andrea è un cliente VIP con 5 ordini negli ultimi 3 mesi. AOV: €120. 
Prodotti preferiti: Vini Toscani, Formaggi Pecorino. 
Ultima conversazione: 2 giorni fa (chiedeva disponibilità Brunello)."
```

**C) Proactive Suggestions**:
```typescript
// After answering query, CONVERSATION_HISTORY agent adds context
"Ottima scelta! 🍷 
[Answer to query]
...
P.S. Abbiamo una nuova offerta: 15% su tutti i vini toscani fino al 31/03! 
Vuoi dare un'occhiata?"
```

**Estimated Effort**: 1 settimana

---

## 💡 Suggerimenti per Miglioramenti

### 1. **Message Queue Optimization**

**Current Issue**: Sequential processing (one message every 6 sec) → slow for high volume

**Proposed**: Parallelization per workspace
```typescript
// Process up to 10 workspaces in parallel
const workspaces = await prisma.workspace.findMany({
  where: { channelStatus: true },
  take: 10
})

await Promise.all(
  workspaces.map(workspace => processWorkspaceQueue(workspace.id))
)

// Per workspace: still 6 sec cooldown between messages (to avoid WhatsApp blocks)
async function processWorkspaceQueue(workspaceId: string) {
  const messages = await prisma.whatsAppQueue.findMany({
    where: { workspaceId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 1 // One at a time per workspace
  })
  
  for (const message of messages) {
    await sendMessage(message)
    await sleep(6000) // 6 sec cooldown
  }
}
```

**Impact**: 10x throughput improvement for multi-tenant platform

---

### 2. **Caching Layer**

**Proposed**: Redis cache for hot data
```typescript
// Cache frequently accessed data
- Product catalog (per workspace, TTL=1h)
- FAQ list (per workspace, TTL=6h)
- Customer profile (per customer, TTL=15min)
- Workspace config (per workspace, TTL=30min)

// Invalidate on update
await redis.del(`products:${workspaceId}`)
```

**Impact**: 70-80% reduction in database queries for LLM context loading

---

### 3. **Webhook Retry Logic**

**Current**: Custom function webhooks fail silently if endpoint down

**Proposed**: Exponential backoff retry
```typescript
// Retry failed webhooks: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
async function callWebhookWithRetry(url: string, payload: any, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post(url, payload, { timeout: 10000 })
      return response.data
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      await sleep(1000 * Math.pow(2, attempt))
    }
  }
}
```

---

### 4. **LLM Response Streaming**

**Current**: Wait for full LLM response → send to customer (high latency)

**Proposed**: Stream response chunks as they arrive
```typescript
// OpenRouter supports streaming
const stream = await openrouter.chat.completions.create({
  model: 'openai/gpt-4o-mini',
  messages: [...],
  stream: true
})

for await (const chunk of stream) {
  const content = chunk.choices[0].delta.content
  if (content) {
    // Send incremental update to frontend via WebSocket
    websocketService.emit(`chat:${sessionId}`, {
      type: 'chunk',
      content
    })
  }
}
```

**Impact**: Perceived latency reduction from 5s to <1s for first response

---

### 5. **A/B Testing Infrastructure**

**Proposed**: Test multiple prompt versions to optimize conversion
```typescript
// Split traffic 50/50
const promptVersion = Math.random() < 0.5 ? 'A' : 'B'

const prompt = promptVersion === 'A'
  ? agentConfig.systemPrompt
  : agentConfig.systemPromptVariantB

// Track performance per version
await prisma.agentConversationLog.create({
  data: {
    ...,
    metadata: { promptVersion, converted: didUserPlaceOrder }
  }
})

// After 1000 conversations, analyze winner
```

---

### 6. **Customer Sentiment Analysis**

**Proposed**: Track customer satisfaction in real-time
```typescript
// After TRANSLATION, add sentiment analysis step
const sentimentPrompt = `
Rate customer sentiment (1-5):
1 = Very Negative (angry, frustrated)
2 = Negative (disappointed)
3 = Neutral
4 = Positive (satisfied)
5 = Very Positive (enthusiastic)

Recent messages:
${customerMessages.join('\n')}

Return only number.
`

const sentiment = await llm.call(sentimentPrompt)

// Save to customer profile
await prisma.customers.update({
  where: { id: customerId },
  data: { currentSentiment: parseInt(sentiment) }
})

// Alert if sentiment drops below 2
if (sentiment <= 2) {
  await notifyOperator(customerId, "Customer frustrated - needs human support")
}
```

---

## 📝 Conclusioni e Prossimi Passi

### ✅ Stato Attuale del Progetto

**Implementazione**: ~85% completato

**Punti di Forza**:
- 🏗️ Architettura solida (multi-tenant, scalabile)
- 🤖 LLM multi-agent funzionante e configurabile
- 📱 Multi-canale (WhatsApp + Widget) operativo
- 🛒 E-commerce completo (prodotti, ordini, pagamenti)
- 💳 Billing system robusto (piani + pay-per-use)
- 🌍 Multilingua nativo con traduzione automatica
- 🔒 Security enterprise-grade (2FA, workspace isolation, audit logs)
- 📊 Analytics e monitoring base implementati

**Punti di Debolezza**:
- ⚠️ WaAPI integration parziale (40%)
- ⚠️ Facebook Meta integration assente
- ⚠️ Onboarding wizard troppo complesso per utenti non-tecnici
- ⚠️ Prompt optimization needed (qualità risposte AI)
- ⚠️ Performance optimization (caching, streaming) da implementare

---

### 🎯 Roadmap Prioritaria (Q1 2026)

#### **SETTIMANA 1-2: Onboarding Semplificato**
- Ridurre wizard a 3 step
- QR Code WaAPI immediato (no config manuale)
- Bulk product import CSV
- Dashboard onboarding checklist

#### **SETTIMANA 3-4: WaAPI Completion**
- Send message API integration
- Media handling (images, docs)
- Message status updates (delivered, read)
- Reconnection logic on disconnect

#### **SETTIMANA 5-6: LLM Prompt Optimization**
- Review e riscrittura di TUTTI i prompt degli agent
- Few-shot learning examples
- Tone calibration per toneOfVoice
- Customer history context injection
- A/B testing infrastructure base

#### **SETTIMANA 7-8: Performance & UX**
- Redis caching layer
- LLM response streaming
- Message queue parallelization
- Analytics dashboard improvements
- Mobile-responsive fixes

---

### 🚀 Roadmap Futura (Q2-Q3 2026)

**Q2 2026**:
- Facebook Messenger + Instagram integration
- Advanced analytics (funnel, segmentation, export)
- Customer sentiment analysis
- Proactive offer suggestions
- Voice message support (WhatsApp audio)

**Q3 2026**:
- Multi-region deployment (US, EU, LATAM)
- White-label reseller program
- Marketplace for custom calling functions
- Advanced AI training (fine-tuned models per vertical)
- Mobile admin app (React Native o PWA)

---

### 📚 Documentazione Come Single Source of Truth

**Questo PRD è ora la BIBBIA del progetto.**

Utilizzo raccomandato:
1. **Per IA**: Usare come context per comprendere architettura e generare codice coerente
2. **Per trovare bug**: Confrontare implementazione vs spec documentata
3. **Per unit test**: Usare flussi descritti come test cases
4. **Per sicurezza**: Verificare che tutti i pattern di security siano applicati
5. **Per onboarding nuovi dev**: Leggere questo doc PRIMA di toccare codice
6. **Per roadmap**: Prioritizzare features basandosi su gap analysis

**Mantenimento**:
- **Aggiornare PRD dopo ogni feature release**
- **Versioning**: Bump version number (3.1, 3.2, etc.)
- **Change log**: Aggiungere sezione "Recent Updates" in testa al doc
- **Review mensile**: Andrea + team review accuracy
