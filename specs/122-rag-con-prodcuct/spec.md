# ShopME - WhatsApp E-Commerce Flow Specification

## Overview

**Project**: ShopME - WhatsApp E-Commerce Platform  
**Version**: 1.0.0  
**Description**: Multi-agent AI chatbot for WhatsApp-based product sales with dynamic prompt variables

### Technology Stack

- **Backend**: Node.js/Express + TypeScript + Prisma ORM
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL
- **LLM**: OpenRouter API (GPT-4-mini)
- **Messaging**: WhatsApp Business API

---

## Critical Architecture Principles

### 1. Database-First Architecture

**MUST**: ALL configuration comes from database - NO hardcoded fallbacks

- Agent prompts MUST come from `agentConfig` table
- NO default values, mock data, or static prompts
- If data missing: return error, don't invent defaults
- Categories/offers/products SEMPRE in italiano (lingua base) dal database

### 2. Workspace Isolation

**MUST**: Multi-tenant security - EVERY query filtered by workspaceId

- Pattern: `where: { workspaceId, ...otherFilters }`
- CRITICAL for multi-tenant security
- NO cross-workspace data leakage

### 3. Variable Replacement

**MUST**: Dynamic prompts with database-driven variables

- `{{PRODUCTS}}`, `{{CATEGORIES}}`, `{{OFFERS}}` in Italian (base language)
- Translation Layer (LLM) handles final translation to customer language
- NEVER create translation mappings - let LLM translate dynamically
- Customer data variables: `{{nome}}`, `{{email}}`, `{{discount}}`, etc.

### 4. No Static Translations

**MUST**: NO hardcoded translations - database + LLM only

- Methods like `getActiveCategories()` return Italian text from DB
- Translation Layer handles final translation to customer's language
- NEVER create translation mappings (it/es/pt/en)

---

## Functional Requirements

### FR-1: WhatsApp Message Reception

**MUST**: System shall receive WhatsApp messages via webhook with HMAC signature verification

- Accept POST requests to `/api/whatsapp/webhook`
- Verify HMAC SHA256 signature in `x-hub-signature-256` header
- Extract phone number and normalize (ensure + prefix)
- Convert WhatsApp format → Markdown
- Find customer in database by phone + workspaceId
- Create or get active chat session

**Acceptance Criteria**:

- HMAC signature must be verified (reject if invalid)
- Phone numbers must be normalized with + prefix
- Only registered customers can chat
- Customer must exist in database with matching workspaceId

### FR-2: Variable Replacement System

**MUST**: System shall replace {{VARIABLES}} in agent prompts with dynamic database content before LLM calls

**Variables - Customer Data**:

- `{{nome}}` → customer.name
- `{{email}}` → customer.email
- `{{discount}}` → customer.discount
- `{{companyName}}` → customer.company
- `{{lastordercode}}` → last order code
- `{{languageUser}}` → ITALIANO/ENGLISH/ESPAÑOL/etc.
- `{{agentName}}` → sales agent full name
- `{{agentPhone}}` → sales agent phone
- `{{agentEmail}}` → sales agent email
- `{{push_notifications_consent}}` → boolean

**Variables - Dynamic Content**:

- `{{PRODUCTS}}` → getActiveProducts(workspaceId, discount) [ITALIAN]
- `{{CATEGORIES}}` → getActiveCategories(workspaceId) [ITALIAN]
- `{{OFFERS}}` → getActiveOffers(workspaceId) [ITALIAN]
- `{{SERVICES}}` → getActiveServices(workspaceId) [ITALIAN]
- `{{FAQS}}` → getActiveFaqs(workspaceId) [ITALIAN]

**Acceptance Criteria**:

- ALL variables replaced BEFORE Router LLM call
- Base content ALWAYS in Italian (database language)
- Translation happens LATER in Safety layer
- NO hardcoded content - everything from database

### FR-3: Router Agent Orchestration

**MUST**: Router Agent shall orchestrate message processing and delegate to specialist agents

**Component**: `LLMRouterService.routeMessage()`

**Calling Functions Available**:

1. `productSearchAgent` - Delegate product search/filtering
2. `cartManagementAgent` - Delegate cart operations
3. `orderTrackingAgent` - Delegate order tracking
4. `customerSupportAgent` - Escalate to customer support
5. `handlePushNotifications` - Manage push notification consent

**LLM Configuration**:

- Model: openai/gpt-4o-mini
- Temperature: 0.3
- Max Tokens: 2048
- Prompt Source: Database `agentConfig` table (AgentType.ROUTER)

**Acceptance Criteria**:

- Router NEVER executes business logic - only orchestrates
- MUST include `{{PRODUCTS}}`, `{{CATEGORIES}}`, `{{OFFERS}}` in Italian
- MUST support multi-language input (IT/ES/PT/FR/EN)
- Router prompt loaded from database (NO hardcoded)
- Variables replaced BEFORE LLM call

### FR-4: Specialist Agent Execution

**MUST**: Specialist agents shall execute with OWN prompts and calling functions when delegated by Router

**🚨 CRITICAL FLOW**: Specialist → Router Second Call → Safety

When Router delegates to a specialist:

1. Router LLM (first call) decides to delegate → calls `productSearchAgent(query)`
2. Specialist executes with OWN LLM + OWN prompt from database
3. **Specialist returns response to Router** (NOT directly to Safety)
4. **Router LLM (second call)** processes specialist response WITH full conversation history (last 10 minutes)
5. Router contextualizes and generates final answer
6. Final answer goes to Safety & Translation layer

**Why Router Second Call?**:

- **Problem**: Specialists only have last 3 messages (limited context)
- **Solution**: Router has full 10-minute conversation history
- **Benefit**: Final response is contextually aware of entire conversation
- **Example**:
  ```
  User (5 min ago): "cerco formaggi freschi"
  Router: "Abbiamo mozzarella, burrata..."
  User (now): "hai la burrata?"
  Specialist: "Yes, we have Burrata Pugliese €8.50"
  Router (2nd call): "Come ti dicevo prima, abbiamo Burrata Pugliese €8.50. Vuoi aggiungerla?"
  ✅ Contextual, cohesive response
  ```

**Code Reference**: `backend/src/services/llm-router.service.ts` lines 1403-1419

```typescript
// Add specialist response to messages
messages.push({
  role: "function" as const,
  name: functionName,
  content: subAgentFinalResponse,
})

// Continue loop - Router LLM called AGAIN
continue
```

**Agents**:

#### Product Search Agent (order: 2)

- **Calling Functions**: `cartManagementAgent` ONLY
- **Variables**: `{{PRODUCTS}}` embedded in prompt (Italian)
- **Features**: Smart Parsing (extractGroupText + filterByGroupKeywords)
- **Temperature**: 0.3, Max Tokens: 2048

#### Cart Management Agent (order: 3)

- **Calling Functions**: `addToCart`, `viewCart`, `clearCart`
- **Link Generation**: Generates `[LINK_CART]` tokens
- **Temperature**: 0.3, Max Tokens: 1024

#### Order Tracking Agent (order: 4)

- **Calling Functions**: `getOrderHistory`, `getLastOrders`, `getOrderDetails`, `trackOrderStatus`, `sendInvoice`, `repeatLastOrder`
- **Link Generation**: Generates `[LINK_ORDERS]`, `[LINK_ORDER_{code}]` tokens
- **Temperature**: 0.3, Max Tokens: 1024

#### Customer Support Agent (order: 5)

- **Calling Functions**: `contactSupport`
- **Temperature**: 0.3, Max Tokens: 1024

**Acceptance Criteria**:

- MUST load prompt from database (NO hardcoded prompts)
- MUST filter all queries by workspaceId
- ProductSearchAgent MUST use `{{PRODUCTS}}` variable (NO searchProducts function)
- Response MUST be in English for Safety layer processing
- Use `[LINK_xxx]` tokens instead of real URLs

**🚨 CRITICAL: contactSupport() Chatbot Disable Behavior**:

When CustomerSupportAgent calls `contactSupport()`:

1. **Database Update**: MUST set `customers.activeChatbot = false` (line 362 in CustomerSupportAgentLLM.ts)
2. **Webhook Check**: WhatsApp webhook MUST check `activeChatbot` before LLM processing (line 607 in whatsapp.routes.ts)
3. **Early Exit**: If `activeChatbot = false` → Save message to DB, return WITHOUT calling LLM
4. **No Bot Response**: Customer receives NO automated reply, only sales agent contact info
5. **Manual Mode**: Operator sees message in ChatPage and responds manually
6. **Reactivation**: Operator can re-enable via ChatPage UI toggle switch

**Triggers for contactSupport()**:

- Explicit operator request: "voglio parlare con operatore"
- Customer frustration: "sono stufo", "sempre danneggiato", "pessimo servizio"
- Product problems: "rotto", "difettoso", "marcio", "scaduto"

### FR-5: Link Token System

**MUST**: System shall use `[LINK_xxx]` placeholder tokens instead of generating real URLs in agent responses

**Available Tokens**:

- `[LINK_CART]` → Secure cart checkout link
- `[LINK_ORDERS]` → Customer orders list link
- `[LINK_ORDER_{code}]` → Specific order details link

**Process**:

1. Agent determines link is needed (e.g., cart checkout)
2. Agent includes `[LINK_CART]` or `[LINK_ORDERS]` in response
3. LinkReplacementService replaces tokens LATER (after Safety layer)

**Acceptance Criteria**:

- NEVER generate real URLs in agent response
- ALWAYS use `[LINK_xxx]` token placeholders
- Tokens replaced AFTER Safety layer

### FR-6: Secure Token Generation

**MUST**: System shall generate time-limited JWT tokens for public URLs

**Component**: `SecureTokenService.generateToken()`

**Process**:

1. Create JWT with payload (customerId, workspaceId, type, expiresAt)
2. Sign with SECURE_TOKEN_SECRET from .env
3. Default expiry: 24 hours

**Token Types**:

- `cart` → Route: `/cart`, URL: `http://localhost:3000/cart?token={token}`
- `orders` → Route: `/orders`, URL: `http://localhost:3000/orders?token={token}`
- `order_detail` → Route: `/order/{orderCode}`, URL: `http://localhost:3000/order/{orderCode}?token={token}`

**Acceptance Criteria**:

- Tokens MUST be time-limited (security)
- Tokens MUST include workspaceId (multi-tenant)
- Tokens MUST include customerId (security)
- Frontend validates token before showing data

### FR-7: Link Replacement Service

**MUST**: System shall replace `[LINK_xxx]` tokens with real secure URLs after Safety layer

**Component**: `LinkReplacementService.replaceLinks()`

**Process**:

1. Find all `[LINK_xxx]` tokens in response text (regex: `/\[LINK_([A-Z_]+)(?:_([^\]]+))?\]/g`)
2. For each token, generate secure URL:
   - Generate time-limited token with SecureTokenService
   - Create full URL with frontend base + route + token
   - Optional: Use URL Shortener (fallback to long URL)
3. Replace all tokens with real URLs

**URL Shortener**:

- Component: `UrlShortenerService.createShortUrl()`
- Process: Generate short code (e.g., 'abc123') → Save mapping in database → Return `http://localhost:3000/s/abc123`
- Fallback: If shortener fails → use long URL

**Acceptance Criteria**:

- MUST generate time-limited secure tokens
- URLs MUST include workspaceId in token payload
- Fallback to long URL if shortener fails
- Token validation on frontend before showing data

### FR-8: Safety & Translation Agent

**MUST**: System shall validate content safety and translate to customer's language

**Component**: `SafetyTranslationAgent.process()`

**LLM Configuration**:

- Model: openai/gpt-4o-mini
- Temperature: 0.1
- Max Tokens: 1024
- Prompt Source: Database `agentConfig` table (AgentType.SAFETY_TRANSLATION)

**Process**:

1. Load SAFETY_TRANSLATION agent config from database
2. Call LLM with safety + translation instructions
3. Check for inappropriate content (scams, harassment, etc.)
4. Translate to customer's language (IT/ES/PT/FR/EN)
5. Preserve Italian product names (Mozzarella, Parmigiano, etc.)
6. Keep `[LINK_xxx]` tokens unchanged

**Calling Functions**:

- `sendAlertEmail` - Send email alert if inappropriate content detected (TODO #13 - not implemented)

**Acceptance Criteria**:

- MUST check for inappropriate content BEFORE translation
- MUST preserve Italian product/category names
- MUST translate to customer's original language
- MUST keep `[LINK_xxx]` tokens unchanged for next step
- If unsafe: block message and return standard warning

### FR-9: Message History Persistence

**MUST**: System shall save both INBOUND and OUTBOUND messages atomically to database

**Component**: `ConversationManager.saveAssistantMessage()`

**Process**:

1. Save INBOUND message (user message) with role='user'
2. Save OUTBOUND message (assistant response) with role='assistant'
3. Include metadata: agentType, tokensUsed, executionTimeMs, debugInfo
4. Filter role='function' messages from user-visible chat

**Debug Info Structure**:

```json
{
  "steps": [
    {
      "type": "router | sub_agent | safety | token-replacement | function_call",
      "agent": "Router Agent | ProductSearchAgent | etc.",
      "model": "openai/gpt-4o-mini",
      "temperature": 0.3,
      "timestamp": "2025-11-11T10:00:00Z",
      "input": { "userMessage": "...", "conversationHistory": [] },
      "output": { "decision": "...", "functionCall": "..." },
      "tokenUsage": {
        "promptTokens": 1500,
        "completionTokens": 150,
        "totalTokens": 1650
      }
    }
  ],
  "totalTokens": 3500,
  "totalCost": 0.000525,
  "executionTimeMs": 2341,
  "timestamp": "2025-11-11T10:00:02Z"
}
```

**Acceptance Criteria**:

- MUST save both INBOUND and OUTBOUND atomically
- MUST filter role='function' messages from user-visible chat
- MUST save debugInfo for flow tracking (TODO #1)
- MUST filter by workspaceId

### FR-10: WhatsApp Queue Emission (DEFERRED)

**Status**: 🚧 DEFERRED TO PRODUCTION - Not implemented yet

**Description**: Messages saved to DB but NOT sent via WhatsApp API yet

**Current Behavior**:

- LLMRouterService returns response to webhook controller
- Response saved to database
- Response returned to client (frontend simulator)
- ❌ WhatsApp API NOT called - message not sent to user

**Future Implementation**:

- Component: `WhatsAppQueueService` (TO CREATE)
- Process: Queue → Worker → WhatsApp API → Status update
- Queue Data: customerId, message, workspaceId, customerPhone, customerLanguage, priority

**Acceptance Criteria** (when implemented):

- Queue MUST handle retry on failure
- MUST update message status (sent/failed)
- MUST log errors for monitoring
- Priority queue for urgent messages

---

### FR-11: Chatbot Disable System (activeChatbot)

**MUST**: System shall allow chatbot to be disabled per customer when human support is requested

**Database Field**: `customers.activeChatbot` (BOOLEAN, default: true)

**Trigger**:

- CustomerSupportAgent calls `contactSupport()` function
- Operator manually disables via ChatPage UI

**Behavior**:

1. **Disable Action** (backend/src/application/agents/CustomerSupportAgentLLM.ts:362):

   ```typescript
   await this.prisma.customers.update({
     where: { id: context.customerId },
     data: { activeChatbot: false },
   })
   ```

2. **Webhook Check** (backend/src/routes/webhooks/whatsapp.routes.ts:607):

   ```typescript
   if (customer && !customer.activeChatbot) {
     // Save message to DB
     await messageRepository.saveMessage({ ... })
     // Return WITHOUT calling LLM
     return res.json({ message: null, chatbotDisabled: true })
   }
   ```

3. **Effect**:

   - Customer messages STILL saved to database (for history)
   - NO LLM processing (early exit before routerService.routeMessage)
   - NO automated bot response sent
   - Operator sees messages in ChatPage
   - Operator responds manually

4. **Reactivation**:
   - Operator clicks toggle in ChatPage UI
   - API: `PATCH /workspaces/:workspaceId/customers/:customerId { activeChatbot: true }`
   - Once re-enabled → chatbot resumes normal operation

**Acceptance Criteria**:

- MUST check `activeChatbot` BEFORE calling LLMRouterService
- MUST save customer message even when chatbot disabled
- MUST NOT send any automated response when disabled
- MUST allow operator to re-enable via API/UI
- MUST filter by workspaceId in all operations

**Integration Points**:

- CustomerSupportAgentLLM: Sets `activeChatbot = false`
- WhatsApp Webhook: Checks `activeChatbot` before LLM
- ChatPage UI: Toggle switch to enable/disable
- Customer API: PATCH endpoint to update status

---

## Non-Functional Requirements

### NFR-1: Security

**MUST**: System shall enforce multi-layer security

- WhatsApp webhook MUST verify HMAC signature
- All API calls MUST use authMiddleware + workspaceValidationMiddleware
- Secure tokens MUST be time-limited (default: 24 hours)
- Frontend MUST validate tokens before showing data

### NFR-2: Performance

**MUST**: System shall optimize LLM calls and token usage

- Variable replacement happens ONCE before Router LLM call
- NO redundant LLM calls (e.g., removed Translation Agent, QueryAnalyzer)
- Cache products/categories if workspace doesn't change

### NFR-3: Multi-Tenancy

**MUST**: System shall enforce strict workspace isolation

- EVERY database query MUST filter by workspaceId
- Pattern: `where: { workspaceId, ...otherFilters }`
- NO cross-workspace data access

### NFR-4: Error Handling

**MUST**: System shall log full error details and provide user-friendly messages

- ALWAYS log full error stack (never generic "Error occurred")
- Return proper HTTP status codes
- User-facing errors MUST be translated to customer language
- Safety layer blocks inappropriate content

### NFR-5: Rate Limiting

**MUST**: System shall apply rate limiting to prevent abuse

- WhatsApp webhook: 10 messages per minute per customer
- API endpoints: Standard rate limiting per user/workspace

---

## User Stories

### US-1: Customer Searches Products

**As a** customer  
**I want to** search for products via WhatsApp  
**So that** I can find items I want to purchase

**Acceptance Criteria**:

- Customer sends message "Voglio formaggi DOP"
- Router delegates to ProductSearchAgent
- Agent filters from `{{PRODUCTS}}` variable (Italian)
- Agent shows product groups
- Customer selects group by number
- Agent shows specific product details
- Customer can add to cart via `cartManagementAgent` delegation

### US-2: Customer Views Cart

**As a** customer  
**I want to** view my shopping cart  
**So that** I can review items before checkout

**Acceptance Criteria**:

- Customer sends message "Vedi il mio carrello"
- Router delegates to CartManagementAgent
- Agent calls `viewCart` function
- Agent generates `[LINK_CART]` token
- LinkReplacementService replaces with secure URL
- Customer receives message with cart items and checkout link

### US-3: Customer Tracks Order

**As a** customer  
**I want to** track my order status  
**So that** I know when it will arrive

**Acceptance Criteria**:

- Customer sends message "Dov'è il mio ordine #12345?"
- Router delegates to OrderTrackingAgent
- Agent calls `trackOrder` function (TODO #13 - not implemented)
- Agent returns shipping status and tracking info

### US-4: Customer Escalates to Support

**As a** customer  
**I want to** speak with a human when frustrated  
**So that** I can resolve complex issues

**Acceptance Criteria**:

- Customer sends panic message "Voglio parlare con una persona!"
- Router detects panic keywords (TODO #4 - panic mode)
- Router immediately delegates to CustomerSupportAgent
- Agent calls `contactSupport` function
- Support team receives notification

### US-5: Multi-Language Support

**As a** customer  
**I want to** chat in my preferred language  
**So that** I can communicate comfortably

**Acceptance Criteria**:

- Customer sends message in Spanish: "Quiero mozzarella"
- Router accepts IT/ES/PT/FR/EN directly (multi-language)
- Router delegates with original language context
- Safety layer translates response to Spanish
- Italian product names preserved (Mozzarella di Bufala)

---

## Edge Cases

### EC-1: Token Expiration

**Scenario**: Customer clicks cart link after 24+ hours

**Expected Behavior**:

- Frontend validates token
- Token expired → show clear error message
- Provide CTA to contact support for new link

### EC-2: Empty Cart Checkout

**Scenario**: Customer clicks cart link with empty cart

**Expected Behavior**:

- Frontend shows "Cart is empty" message
- Suggest products or categories
- Allow customer to start shopping

### EC-3: Invalid Order Number

**Scenario**: Customer requests order tracking with non-existent order

**Expected Behavior**:

- OrderTrackingAgent queries database
- Order not found → return clear error message
- Suggest viewing all orders instead

### EC-4: Product Not Found

**Scenario**: Customer searches for unavailable product (e.g., "Voglio caviale")

**Expected Behavior**:

- ProductSearchAgent filters `{{PRODUCTS}}`
- No matches found → return "Product not available" message
- Suggest similar categories or popular products

### EC-5: HMAC Signature Failure

**Scenario**: WhatsApp webhook receives request with invalid signature

**Expected Behavior**:

- WhatsAppWebhookController verifies signature
- Signature invalid → reject with 401 Unauthorized
- Log security incident
- DO NOT process message

---

## Data Model References

### Agent Configuration (agentConfig table)

```typescript
{
  id: string
  workspaceId: string
  type: AgentType // ROUTER, PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING, CUSTOMER_SUPPORT, SAFETY_TRANSLATION
  order: number
  name: string
  systemPrompt: string // With {{VARIABLES}}
  temperature: number
  maxTokens: number
  availableFunctions: string[] // Calling function names
  isActive: boolean
}
```

### Secure Tokens

```typescript
{
  customerId: string
  workspaceId: string
  type: "cart" | "orders" | "order_detail"
  expiresAt: Date
}
```

### Message History

```typescript
{
  id: string
  conversationId: string
  workspaceId: string
  role: 'user' | 'assistant' | 'function'
  content: string
  metadata: {
    agentType?: AgentType
    tokensUsed?: number
    executionTimeMs?: number
    debugInfo?: DebugInfoSteps
  }
}
```

---

## Technical Constraints

### TC-1: Database-First

- NO hardcoded prompts, variables, or configuration
- ALL agent prompts from `agentConfig` table
- If data missing: return error (NO defaults)

### TC-2: Workspace Isolation

- EVERY query MUST filter by workspaceId
- Pattern: `where: { workspaceId, ...otherFilters }`

### TC-3: Variable Replacement Timing

- Variables replaced BEFORE Router LLM call
- NO runtime variable replacement during LLM streaming

### TC-4: Link Token Flow

- Agents generate `[LINK_xxx]` tokens (NOT real URLs)
- Replacement happens AFTER Safety layer
- NEVER generate URLs in LLM responses

### TC-5: Italian Base Language

- `{{PRODUCTS}}`, `{{CATEGORIES}}`, `{{OFFERS}}` ALWAYS in Italian
- Translation to customer language happens in Safety layer
- NO translation mappings (it/es/pt/en) - LLM translates dynamically

---

## FR-12: PDF Invoice Generation & Email Delivery

**Priority**: HIGH  
**Status**: TODO  
**Effort**: 8 story points  
**Related**: FR-4 (Order Tracking Agent), TODO #13

### Description

Generate professional PDF invoices with workspace branding and send via email when customers request invoices, receipts, or proof of purchase.

### Current State

**Existing Implementation** (incomplete):

- ✅ `sendInvoice()` calling function exists (`backend/src/domain/calling-functions/SendInvoice.ts`)
- ✅ Function signature correct: `{ customerId, workspaceId, orderId, email? }`
- ✅ OrderTrackingAgentLLM can call the function
- ✅ CallingFunctionsService wrapper exists
- ❌ **Uses mock invoice URL** (no real PDF generation)
- ❌ **Email not sent** (TODO comment: "Integration with email service")
- ❌ No PDF storage mechanism
- ❌ No workspace branding (logo, colors)

**Code Reference**:

```typescript
// backend/src/domain/calling-functions/SendInvoice.ts:84-90
// TODO: Generate PDF invoice
// For now, create a mock invoice URL
const invoiceUrl = `${process.env.FRONTEND_URL}/invoice-public?orderId=${order.id}&token=mock-token`

// TODO: Send email with PDF attachment
// const emailService = new EmailService()
// await emailService.sendInvoice(...)
```

### Requirements

**MUST-1: PDF Generation with Workspace Branding**

- Generate PDF using workspace data from database:
  - `workspace.name` - Business name on invoice
  - `workspace.logo` - Logo image (top of invoice)
  - `workspace.address` - Business address
  - `workspace.vatNumber` - VAT/Tax ID
  - `workspace.email` - Business contact email
  - `workspace.phone` - Business phone number
- Template must be professional (aligned, proper spacing, clear sections)
- Italian language for invoice content (e.g., "Fattura N.", "Data", "Cliente", "Totale")

**MUST-2: Invoice Content**

- Order details:
  - Invoice number: Auto-generated from `orderCode` (e.g., "INVOICE-ORD-048-2025-9")
  - Invoice date: `order.createdAt`
  - Customer: `customer.name`, `customer.email`, `customer.address`
- Line items table:
  - Product/Service name
  - Quantity
  - Unit price (formatted €X.XX)
  - Line total
- Subtotal, taxes (if applicable), shipping cost, grand total
- Footer: Payment terms, notes from `workspace.invoiceNotes`

**MUST-3: Email Delivery**

- Send email via SMTP using workspace-specific configuration:
  - SMTP config stored in `workspace` table (host, port, user, password)
  - Fallback: Environment variable SMTP config if workspace has none
- Email template:
  - Subject: "Fattura per ordine {orderCode} - {workspace.name}"
  - Body: Professional HTML email with invoice attached
  - Attachment: PDF file `fattura_{orderCode}.pdf`
- Recipient: `email` parameter OR `customer.email` (fallback)

**MUST-4: Workspace-Isolated Storage**

- Store generated PDFs in workspace-isolated directory:
  - Pattern: `backend/uploads/{workspaceId}/invoices/{orderCode}.pdf`
  - Create directory if doesn't exist
  - Overwrite if invoice regenerated
- Workspace isolation CRITICAL: NEVER access other workspace files

**MUST-5: Secure Download Link**

- Generate secure token with `SecureTokenService`:
  ```typescript
  const token = await secureTokenService.generateToken({
    customerId: order.customerId,
    workspaceId: order.workspaceId,
    type: "invoice",
    metadata: { orderId: order.id },
  })
  ```
- Link format: `{FRONTEND_URL}/invoice-public?token={token}`
- Token expiry: 24 hours (configurable in SecureTokenService)
- Public endpoint: No authentication required, token validates access

### Technical Decisions

**PDF Library**: Use `@react-pdf/renderer` (NOT puppeteer)

- **Rationale**:
  - No headless browser overhead (puppeteer requires Chrome)
  - React-like component syntax (easy templates)
  - Server-side rendering (works in Node.js)
  - Small bundle size vs puppeteer
- **Alternative considered**: puppeteer (rejected - too heavy)

**Email Service**: `nodemailer` with workspace SMTP config

- **Pattern**:
  ```typescript
  const smtpConfig = workspace.smtpConfig || {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  }
  ```
- Fallback to env vars ensures system works even without workspace config

**Storage Location**: Local filesystem (for now)

- `backend/uploads/{workspaceId}/invoices/{orderCode}.pdf`
- Future enhancement: S3/Cloud Storage (out of scope)

### Architecture

**New Services**:

1. `InvoicePDFService` (`backend/src/application/services/invoice-pdf.service.ts`)

   - `generateInvoicePDF(orderId, workspaceId): Promise<string>` - Returns file path
   - Uses @react-pdf/renderer to create PDF from template
   - Queries order + workspace data from database
   - Saves to workspace-isolated directory

2. `EmailService` (`backend/src/application/services/email.service.ts`)
   - `sendInvoiceEmail(recipient, invoiceFilePath, orderCode, workspace): Promise<boolean>`
   - Uses nodemailer with workspace SMTP config
   - HTML email template with attachment
   - Error handling with retry logic (optional)

**Updated Service**:

- `SendInvoice.ts` (`backend/src/domain/calling-functions/SendInvoice.ts`)
  - Remove TODO comments
  - Call `InvoicePDFService.generateInvoicePDF()`
  - Call `EmailService.sendInvoiceEmail()`
  - Generate real secure token with `SecureTokenService`
  - Return success with real `invoiceUrl` and `sentTo` email

### Integration Points

**1. OrderTrackingAgentLLM**

- Already configured to call `sendInvoice()` function
- Function definition in `getOrderTrackingFunctions()`:
  ```typescript
  {
    name: "sendInvoice",
    description: "Send or resend invoice for a specific order...",
    parameters: { orderCode, email? }
  }
  ```

**2. SecureTokenService**

- Existing service for generating time-limited access tokens
- Used for cart links, order links, now invoice links
- Pattern: `{ customerId, workspaceId, type, metadata, expiresAt }`

**3. Workspace Table (Database Schema Update)**

- Add SMTP configuration columns:
  ```prisma
  model Workspaces {
    // ... existing fields
    logo          String?   // URL or file path
    address       String?   // Business address
    vatNumber     String?   // VAT/Tax ID
    invoiceNotes  String?   // Footer notes on invoices
    smtpHost      String?   // SMTP server
    smtpPort      Int?      // SMTP port
    smtpUser      String?   // SMTP username
    smtpPassword  String?   // SMTP password (encrypted)
  }
  ```

### Acceptance Criteria

**AC-1: PDF Generated with Workspace Branding**

- GIVEN a workspace with logo, name, address configured
- WHEN `sendInvoice()` is called
- THEN PDF contains workspace logo at top
- AND business name, address, VAT number in header
- AND invoice follows professional template layout

**AC-2: Email Sent Successfully**

- GIVEN customer email is valid
- WHEN invoice is generated
- THEN email sent with PDF attachment
- AND email subject contains order code and workspace name
- AND email body is professional HTML template
- AND recipient receives email within 30 seconds

**AC-3: Secure Download Link Works**

- GIVEN invoice generated and token created
- WHEN customer opens link `/invoice-public?token=xxx`
- THEN PDF downloads or displays in browser
- AND token is valid for 24 hours
- AND expired token returns 401 error

**AC-4: Workspace Isolation Verified**

- GIVEN two workspaces (W1, W2) with orders
- WHEN W1 customer requests invoice
- THEN only W1's invoice data is used (logo, branding, SMTP)
- AND W1 invoice stored in `uploads/W1/invoices/`
- AND W2's data is NEVER accessible

**AC-5: Fallback Handling**

- GIVEN workspace has no SMTP config
- WHEN invoice is requested
- THEN system uses environment variable SMTP config
- AND email is still sent successfully

**AC-6: Error Handling**

- GIVEN invalid orderId
- WHEN `sendInvoice()` is called
- THEN function returns `{ success: false, error: "Order not found" }`
- AND no PDF is generated
- AND no email is sent

### Testing Strategy

**Unit Tests** (`backend/__tests__/unit/services/invoice-pdf.service.test.ts`):

- ✅ Test PDF generation with workspace data
- ✅ Test template rendering with order items
- ✅ Test file save to correct directory
- ✅ Test error handling (missing workspace, invalid order)

**Unit Tests** (`backend/__tests__/unit/services/email.service.test.ts`):

- ✅ Test email sending with mock SMTP
- ✅ Test workspace SMTP config usage
- ✅ Test fallback to env vars
- ✅ Test attachment handling

**Integration Tests** (`backend/__tests__/integration/sendInvoice.test.ts`):

- ✅ Test complete flow: generatePDF → sendEmail → return link
- ✅ Test workspace isolation (W1 cannot access W2 invoices)
- ✅ Test token expiry (24h)
- ✅ Test OrderTrackingAgentLLM calling sendInvoice CF

### Out of Scope (Future Enhancements)

- PDF customization (customer-specific templates)
- Cloud storage (S3, Google Cloud Storage)
- Retry mechanism for failed emails
- Email tracking (open rate, click rate)
- Multiple invoice formats (PDF, XML for e-invoicing)

---

## FR-13: Repeat Last Order (One-Click Reorder)

**Priority**: HIGH  
**Status**: ✅ IMPLEMENTED  
**Effort**: 13 story points  
**Branch**: `122-rag-con-product`  
**Related**: FR-4 (Order Tracking Agent)

### Description

Enable customers to instantly repeat their last delivered order through a conversational flow, reducing friction and increasing repeat purchase rate. The system shows order summary, asks for confirmation, then adds all items to cart and provides checkout link.

### Requirements

**MUST-1: Three-Step Confirmation Flow**

Multi-turn conversation with confirmation before execution:

1. **STEP 1 - Show Last Order Summary**

   - Customer triggers: "voglio ripetere ultimo ordine", "repeat order", "riordina"
   - System shows: Order details (items, quantities, prices, total, delivery date)
   - Question: "Vuoi ripetere questo ordine? 🔄"

2. **STEP 2 - Await Confirmation**

   - System waits for explicit confirmation: "si", "yes", "ok", "conferma"
   - Negative response: "no", "annulla" → Cancel operation
   - Ambiguous response: Request clarification

3. **STEP 3 - Execute & Provide Checkout**
   - Call `repeatOrder()` function (no parameters needed)
   - Add all order items to customer's cart
   - Generate checkout link with `?step=2` parameter (cart review step)
   - Return link: "✅ Ordine aggiunto al carrello! {CHECKOUT_LINK}"

**MUST-2: Only Last DELIVERED Order**

- Query: `ORDER BY createdAt DESC WHERE status = 'DELIVERED' LIMIT 1`
- Rationale: Avoid confusion with pending/cancelled orders
- Error handling: No delivered orders → "Non hai ancora ordini consegnati"

**MUST-3: Cart Management**

- Clear existing cart items before adding repeat order
- Preserve product prices from original order (ignore current catalog prices)
- Apply current customer discount to total
- Verify product availability:
  - If product deleted/inactive → Skip item with warning
  - If stock insufficient → Add available quantity with note

**MUST-4: Workspace Isolation**

- ALL queries filtered by `workspaceId` AND `customerId`
- Pattern:
  ```typescript
  where: {
    workspaceId,
    customerId,
    status: 'DELIVERED'
  }
  orderBy: { createdAt: 'desc' }
  ```

**MUST-5: Router Agent Awareness**

Router must recognize confirmation context:

- Track conversation state: "Did Order Tracking Agent just show order summary?"
- Recognize "si" after order summary as confirmation for FR-13
- Delegate to Order Tracking with `CONFIRMED: ripeti ultimo ordine` prefix

### Technical Implementation

**New Domain Function**:

`RepeatOrder.ts` (`backend/src/domain/calling-functions/RepeatOrder.ts`)

```typescript
export async function RepeatOrder(request: {
  customerId: string
  workspaceId: string
  orderCode?: string // Optional - uses last delivered if omitted
}): Promise<{
  success: boolean
  message: string
  cartCode?: string
  orderCode?: string
  productsAdded?: number
  cartUrl?: string
  expiresAt?: string
}> {
  // 1. Query last DELIVERED order
  const lastOrder = await prisma.orders.findFirst({
    where: {
      workspaceId,
      customerId,
      status: "DELIVERED",
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  })

  if (!lastOrder) {
    return {
      success: false,
      message: "Non hai ancora ordini consegnati.",
    }
  }

  // 2. Clear existing cart
  await prisma.cartItems.deleteMany({
    where: {
      cart: { customerId, workspaceId },
    },
  })

  // 3. Add order items to cart
  let productsAdded = 0
  for (const item of lastOrder.items) {
    const product = await prisma.products.findUnique({
      where: { id: item.productId },
    })

    if (product && product.isActive) {
      await prisma.cartItems.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price, // Preserve original price
        },
      })
      productsAdded++
    }
  }

  // 4. Generate checkout link with ?step=2
  const token = await secureTokenService.generateToken({
    customerId,
    workspaceId,
    type: "checkout",
  })

  const cartUrl = `${process.env.FRONTEND_URL}/checkout?token=${token}&step=2`

  return {
    success: true,
    message: `✅ ${productsAdded} prodotti aggiunti al carrello!`,
    cartCode: cart.cartCode,
    orderCode: lastOrder.orderCode,
    productsAdded,
    cartUrl,
    expiresAt: token.expiresAt,
  }
}
```

**OrderTrackingAgentLLM Integration**:

Add `repeatOrder` to available functions list:

```typescript
// backend/src/application/agents/OrderTrackingAgentLLM.ts
getOrderTrackingFunctions() {
  return [
    // ... existing functions
    {
      name: "repeatOrder",
      description: "Repeat the customer's last delivered order by adding all items to cart. Use after customer confirms they want to repeat their last order. Returns checkout link with step=2 parameter.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ]
}
```

Add case handler in function execution switch:

```typescript
case "repeatOrder":
  const { RepeatOrder } = require("../../domain/calling-functions/RepeatOrder")
  return await RepeatOrder({
    customerId: context.customerId,
    workspaceId: context.workspaceId,
    orderCode: args.orderCode,
  })
```

**Router Agent Prompt Update**:

Add to `docs/prompts/router-agent.md`:

```markdown
**SCENARIO 1B - User confirms after Order Tracking shows last order (FR-13)**:

- User says: "si", "yes", "ok", "conferma" (short affirmative)
- Check conversation history: Did previous assistant message come from Order Tracking and show last order details?
- Signs: Previous message contains "Vuoi ripetere l'operazione?" and shows order summary
- **ACTION**: Delegate to Order Tracking to execute RepeatOrder():
```

orderTrackingAgent("CONFIRMED: ripeti ultimo ordine")

```

**SCENARIO 4 - Repeat order request (FR-13)**:

- Customer says: "ripeti ultimo ordine", "repeat order", "voglio ripetere ordine"
- **ACTION**: Delegate to Order Tracking Agent:
```

orderTrackingAgent("ripeti ultimo ordine")

```
- Order Tracking will:
1. Show last DELIVERED order summary
2. Ask confirmation: "Vuoi ripetere questo ordine?"
3. Wait for Router to delegate back with "CONFIRMED: ..."
4. Call RepeatOrder() function
5. Return checkout link with ?step=2
```

**Order Tracking Agent Prompt Update**:

Add to `docs/prompts/order-tracking-agent.md`:

```markdown
## SPECIAL SCENARIO: FR-13 - Repeat Last Order

**STEP 1: SHOW ORDER SUMMARY**

When user requests: "ripeti ordine", "repeat order", "voglio ripetere ultimo ordine":

1. Call `getOrderDetails()` WITHOUT orderCode → Returns last DELIVERED order
2. Show formatted summary:
```

📦 Here is your last delivered order: {orderCode}!

You ordered:

- {qty} x {product} (€{price})
- {qty} x {product} (€{price})

**Total Amount:** €{total}
**Delivery Date:** {date}
**Status:** Delivered

Do you want to repeat this order? 🔄

````
3. **STOP HERE** - DO NOT call RepeatOrder() yet! Wait for confirmation.

**STEP 2: AWAIT CONFIRMATION FROM ROUTER**

Router will send back query with prefix `CONFIRMED: ripeti ultimo ordine`

**STEP 3: EXECUTE REPEAT ORDER**

- Only after receiving "CONFIRMED" prefix, call RepeatOrder()
- Do NOT pass orderCode parameter (function uses last delivered automatically)
- Function calling:
```json
{
 "name": "RepeatOrder",
 "arguments": {}
}
````

- Format response with checkout link:

  ```
  ✅ Your order has been added to the cart!

  {CHECKOUT_LINK}

  You can review and confirm your order. The cart is ready for checkout! 🛒
  ```

````

### Architecture

**New Files**:

1. `backend/src/domain/calling-functions/RepeatOrder.ts` - Domain function
2. Updated: `backend/src/application/agents/OrderTrackingAgentLLM.ts` - Add function
3. Updated: `docs/prompts/router-agent.md` - Confirmation flow
4. Updated: `docs/prompts/order-tracking-agent.md` - 3-step flow

**Database Access Pattern**:

```typescript
// Last delivered order (workspace-isolated)
const lastOrder = await prisma.orders.findFirst({
  where: {
    workspaceId,
    customerId,
    status: "DELIVERED",
  },
  orderBy: { createdAt: "desc" },
  include: { items: { include: { product: true } } },
})
````

**Function Calling Iterations**:

- Iteration 1: Router → OrderTracking("ripeti ultimo ordine")
- Iteration 2: OrderTracking → getOrderDetails() → Show summary
- Iteration 3: Router contextualizes response
- **User confirms "si"**
- Iteration 4: Router → OrderTracking("CONFIRMED: ripeti ultimo ordine")
- Iteration 5: OrderTracking → repeatOrder() → Return checkout link
- Iteration 6: Router contextualizes final response

**Total iterations**: 6-7 (required `maxFunctionIterations = 8`)

### Acceptance Criteria

**AC-1: Successful Repeat Order Flow**

- GIVEN customer has 1+ delivered orders
- WHEN customer says "voglio ripetere ultimo ordine"
- THEN system shows order summary with confirmation question
- WHEN customer confirms "si"
- THEN all order items added to cart
- AND checkout link provided with `?step=2` parameter
- AND link expires in 15 minutes

**AC-2: Cart Replacement (Not Merge)**

- GIVEN customer has existing cart with 2 products
- WHEN customer repeats order with 3 products
- THEN cart is CLEARED first
- AND only 3 products from repeated order remain
- AND previous cart items are GONE

**AC-3: Price Preservation**

- GIVEN repeated order had product at €10.00
- AND current catalog price is €12.00
- WHEN order is repeated
- THEN cart shows €10.00 (original price preserved)
- AND customer discount applied on top

**AC-4: Inactive Product Handling**

- GIVEN repeated order contains 3 products
- AND 1 product is now deleted/inactive
- WHEN order is repeated
- THEN 2 active products added to cart
- AND warning shown: "1 prodotto non più disponibile"

**AC-5: No Delivered Orders**

- GIVEN customer has only PENDING orders
- WHEN customer requests repeat order
- THEN system responds: "Non hai ancora ordini consegnati"
- AND no cart modification occurs

**AC-6: Workspace Isolation**

- GIVEN Workspace W1 customer repeats order
- THEN ONLY W1 orders are queried
- AND ONLY W1 products are added to cart
- AND W2 data is NEVER accessible

### Testing Strategy

**Unit Tests** (`backend/__tests__/unit/RepeatOrder.test.ts`):

- ✅ Test successful repeat with all items active
- ✅ Test cart clearing before adding items
- ✅ Test inactive product filtering
- ✅ Test no delivered orders error
- ✅ Test workspace isolation

**Integration Tests** (`backend/__tests__/integration/fr13-repeat-order.test.ts`):

- ✅ Test complete 3-step flow (show → confirm → execute)
- ✅ Test Router delegation with "CONFIRMED" prefix
- ✅ Test OrderTrackingAgentLLM calling repeatOrder()
- ✅ Test checkout link generation with ?step=2
- ✅ Test price preservation from original order

**Manual Testing** (WhatsApp UI):

- ✅ Test "voglio ripetere ultimo ordine" → summary shown
- ✅ Test "si" → cart updated + link provided
- ✅ Test "no" → operation cancelled
- ✅ Test link opens checkout at step 2 (cart review)

### Bug Fixes During Implementation

**Bug #1: Function Not Recognized**

- **Issue**: LLM called `repeatOrder()` but got `Unknown function: repeatOrder`
- **Root Cause**: Missing `case "repeatOrder":` in OrderTrackingAgentLLM switch statement
- **Fix**: Added case handler to call RepeatOrder domain function

**Bug #2: Max Iterations Reached**

- **Issue**: Flow timed out with "Sto elaborando..." after 5 iterations
- **Root Cause**: `maxFunctionIterations = 5` insufficient for 6-7 iteration flow
- **Fix**: Increased to `maxFunctionIterations = 8` in llm-router.service.ts

**Bug #3: Module Cache Not Refreshing**

- **Issue**: Code changes not reflected after backend restart
- **Root Cause**: ts-node-dev module cache persisting old code
- **Fix**: Touch both llm-router.service.ts and OrderTrackingAgentLLM.ts to force reload

---

## Dependencies

1. **OpenRouter API** - LLM calls (GPT-4-mini)

   - Endpoint: https://openrouter.ai/api/v1
   - Authentication: OPENROUTER_API_KEY in .env

2. **WhatsApp Business API** - Send messages to customers

   - Endpoint: https://graph.facebook.com/v18.0
   - Authentication: Workspace-specific API key in database
   - Status: Queue implementation pending (TODO #1)

3. **PostgreSQL** - Database (Prisma ORM)

   - Schema: backend/prisma/schema.prisma

4. **Redis (Optional)** - Caching, queue management (future)
   - Status: Not yet implemented

### Internal Dependencies

- Prisma ORM (database access)
- Express.js (HTTP server)
- TypeScript (type safety)
- JWT (secure token generation)
- Crypto (HMAC signature verification)

---

## Out of Scope (Current Version)

- WhatsApp Queue implementation (DEFERRED to production)
- Missing Calling Functions: Implementation complete - all CF aligned (TODO #13 RESOLVED)
- Message Flow Tracking visualization (TODO #1)
- Panic Mode detection (TODO #4)

---

## References

- Complete YAML Spec: `.spec-kit/shopme-complete-flow.yaml`
