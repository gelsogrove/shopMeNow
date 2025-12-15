# Feature Specification: Email Notification System

**Feature Branch**: `176-email-notification-system`  
**Created**: 2025-11-18  
**Status**: Draft  
**Input**: User description: "devo poter fare una funzione sendMail che riceve in input (type, to, subject, body, cc) per inviare email agli agenti quando cliente chiede operatore (con ultimi 10 messaggi) e al cliente quando crea ordine (con copia admin)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Agent Notification When Customer Requests Operator (Priority: P1)

When a customer explicitly requests to speak with a human operator, the system automatically sends an email notification to the assigned sales agent containing the customer's request and the last 10 chat messages for context.

**Why this priority**: Critical for customer service responsiveness. Agents need immediate notification when customers escalate to human assistance. Without this, customers wait indefinitely and lose trust.

**Independent Test**: Can be fully tested by triggering "contact operator" calling function and verifying agent receives email with customer name, request, and message history.

**Acceptance Scenarios**:

1. **Given** customer has assigned sales agent **When** customer says "voglio parlare con un operatore" **Then** agent receives email with subject "🔔 Cliente [Nome] richiede assistenza" and body contains last 10 messages
2. **Given** customer has no assigned agent **When** customer requests operator **Then** email is sent to workspace admin email as fallback
3. **Given** agent email is invalid/missing **When** notification is triggered **Then** system logs error and sends to admin email instead

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: No changes needed (backend-only feature)
- [ ] Backend API: No new routes (uses existing calling function trigger)
- [x] Service Layer: New `sendMail()` method in `EmailService`
- [x] Repository: Query customer's last 10 messages for email body
- [ ] Database: No schema changes (uses existing `customers`, `salesAgents`, `workspace` tables)
- [x] Security: No security changes (internal server-to-SMTP communication)
- [ ] Testing: Unit tests for `sendMail()`, integration test with real SMTP (Step 1: test file)
- [ ] Documentation: Update README with SMTP configuration requirements
- [x] Concurrency: No concurrency concerns (async email sending)
- [x] Prompt Variables: Not applicable
- [x] Code Cleanliness: New email service method, clean implementation

---

### User Story 2 - Customer Order Confirmation Email with Admin CC (Priority: P2)

When a new order is successfully created, the system sends a detailed order summary email to the customer with the workspace admin in CC for record-keeping.

**Why this priority**: Important for customer confirmation and admin oversight but not as urgent as operator requests. Can be implemented after P1.

**Independent Test**: Can be tested by creating an order via API and verifying customer receives email with order details and admin is CC'd.

**Acceptance Scenarios**:

1. **Given** order is created successfully **When** order status is CONFIRMED **Then** customer receives email with order code, items, total, and admin is CC'd
2. **Given** customer email is missing **When** order is created **Then** system logs warning and sends only to admin
3. **Given** SMTP credentials are invalid **When** sending email **Then** system logs error but order creation succeeds (email is non-critical)

---

### User Story 3 - SMTP Test Script Before Implementation (Priority: P0 - Prerequisite)

Before implementing the `sendMail()` function, create a standalone test script that validates SMTP credentials and successfully sends a test email.

**Why this priority**: P0 (prerequisite) - Must verify SMTP configuration works before building email system. Prevents wasting time on implementation with broken SMTP setup.

**Independent Test**: Can be tested by running `npm run test:smtp` and verifying test email is received.

**Acceptance Scenarios**:

1. **Given** valid SMTP credentials in `.env` **When** test script runs **Then** test email is sent successfully and script outputs "✅ SMTP test passed"
2. **Given** invalid SMTP credentials **When** test script runs **Then** script outputs clear error message with troubleshooting steps
3. **Given** missing SMTP_HOST or SMTP_USER **When** test script runs **Then** script outputs which env vars are missing

---

### Edge Cases

- What happens when agent email is missing/invalid? → Send to workspace admin email as fallback
- What happens when SMTP credentials are wrong? → Log error, don't crash app, return false from `sendMail()`
- What happens when customer has no message history? → Send email with note "Nessuno storico messaggi disponibile"
- What happens when multiple CC recipients are needed? → Support array of CC addresses: `cc: string | string[]`
- What happens when email sending times out? → Set timeout (30s), log error, continue app flow

## Requirements _(mandatory)_

### Functional Requirements

**FR-1: sendMail Function Signature**

System MUST provide a `sendMail()` method with this interface:

```typescript
async sendMail(params: {
  type: 'customer' | 'agent'
  to: string  // customerId or agentId
  subject: string
  body: string
  cc?: string | string[]  // Optional CC recipients
  workspaceId: string
}): Promise<boolean>
```

- `type`: Determines if `to` is a customerId or agentId (for email lookup)
- `to`: ID to resolve to email address from database
- `subject`: Email subject line
- `body`: HTML or plain text email body
- `cc`: Optional CC recipients (single email or array)
- `workspaceId`: For workspace isolation (fetch adminEmail as FROM)
- Returns `true` if email sent successfully, `false` otherwise

**FR-2: Dynamic FROM Address from Workspace**

- System MUST fetch FROM email address from `workspace.adminEmail` field (not hardcoded)
- Format: `"eChatbot Support" <{workspace.adminEmail}>`
- Fallback: If `adminEmail` is missing, use `SMTP_FROM` from `.env`

**FR-3: SMTP Configuration from Environment**

System MUST use these environment variables:

```bash
SMTP_HOST="smtp.movistar.es"
SMTP_PORT="25"
SMTP_SECURE="true"  # true for port 465, false for others
SMTP_USER="gelsogrovel@gmail.com"
SMTP_AUTH="Gocciole44@"  # Password
SMTP_FROM="noreply@echatbot.ai"  # Fallback FROM address
```

**FR-4: Agent Notification on Operator Request**

When customer triggers "contact operator" calling function:

- System MUST send email to customer's assigned `salesAgents.email`
- Subject: `"🔔 Cliente [Nome Cliente] richiede assistenza urgente"`
- Body MUST include:
  - Customer name and phone
  - Explicit request message
  - Last 10 chat messages (timestamp, sender, message)
  - Link to admin dashboard (optional)
- If no assigned agent: Send to `workspace.adminEmail`

**FR-5: Order Confirmation Email with CC**

When new order is created (status = CONFIRMED):

- System MUST send email to `customer.email`
- CC: `workspace.adminEmail`
- Subject: `"✅ Conferma Ordine #{orderCode} - {workspaceName}"`
- Body MUST include:
  - Order code
  - Order date
  - Product list (name, quantity, price)
  - Subtotal, shipping, total
  - Delivery address
  - Payment status

**FR-6: SMTP Test Script (Step 1)**

- Create script: `backend/scripts/test-smtp.ts`
- Command: `npm run test:smtp`
- Script MUST:
  - Load SMTP credentials from `.env`
  - Validate all required env vars present
  - Send test email to `SMTP_USER` address
  - Output success/failure with clear error messages

**FR-7: Error Handling & Logging**

- If email fails to send: Log error with full details (recipient, subject, error message)
- App MUST NOT crash if email fails (emails are non-critical)
- `sendMail()` returns `false` on error, `true` on success
- Timeout: 30 seconds per email send operation

### Non-Functional Requirements

**NFR-1: Performance**

- Email sending MUST be asynchronous (non-blocking)
- Max timeout: 30 seconds per email
- No impact on API response times (fire-and-forget pattern)

**NFR-2: Reliability**

- Email failures MUST NOT block order creation or chat operations
- All email operations logged for debugging
- Clear error messages for SMTP configuration issues

**NFR-3: Maintainability**

- Centralized email service (extend existing `EmailService`)
- Reusable `sendMail()` method for future email types
- Template-based email bodies (easy to customize)

## Success Criteria _(mandatory)_

1. **SMTP Test Passes**: Running `npm run test:smtp` successfully sends test email and outputs "✅ SMTP test passed"

2. **Agent Notification Works**: When customer requests operator, agent receives email within 30 seconds containing customer name and last 10 messages

3. **Order Confirmation Sent**: When order is created, customer receives email with order details and admin is CC'd

4. **Error Resilience**: Email failures do not crash app or block critical operations (order creation, chat flow)

5. **Configuration Flexible**: Changing `SMTP_HOST` or `workspace.adminEmail` in database updates email behavior without code changes

## Key Entities _(if applicable)_

**Workspace** (existing table)
- `adminEmail`: FROM address for emails (e.g., "admin@echatbot.ai")
- Used to fetch workspace-specific sender email

**Customers** (existing table)
- `email`: Recipient address for order confirmations
- `nome`: Customer name for email personalization

**SalesAgents** (existing table)
- `email`: Recipient address for operator request notifications
- Linked to customers via `customerId` → `salesAgentId`

**Messages** (existing table)
- Last 10 messages queried for agent notification context
- Includes `timestamp`, `senderType` (customer/agent), `content`

**Orders** (existing table)
- Order details for confirmation email body
- Triggers email on status = CONFIRMED

## Dependencies _(mandatory)_

**Internal Dependencies:**
- Existing `EmailService` class (`backend/src/application/services/email.service.ts`)
- Existing `nodemailer` package (already in `package.json`)
- Existing workspace, customer, salesAgent repositories

**External Dependencies:**
- SMTP server credentials (must be configured in `.env`)
- Internet connection for SMTP communication

**Blockers:**
- Valid SMTP credentials MUST be configured before testing

## Assumptions _(mandatory)_

1. **SMTP Credentials Valid**: Assume provided SMTP credentials (`smtp.movistar.es`, `gelsogrovel@gmail.com`, etc.) are correct and functional
2. **EmailService Exists**: Assume `EmailService` class exists and can be extended (verified: exists at `backend/src/application/services/email.service.ts`)
3. **nodemailer Package**: Assume `nodemailer` is already installed (common email library for Node.js)
4. **Workspace Has Admin Email**: Assume all workspaces have `adminEmail` field populated (used as FROM address)
5. **Message History Available**: Assume `messages` table stores chat history with timestamps and sender info
6. **Emails Non-Critical**: Assume email delivery failures should NOT block app functionality

## Out of Scope _(mandatory)_

- **Email Templates UI**: Admin UI to customize email templates (hardcoded templates for now)
- **Email Queue System**: Advanced retry logic or queue-based email sending (simple async for MVP)
- **Email Tracking**: Open rates, click tracking, delivery status webhooks
- **Multi-Language Emails**: Emails are Italian-only (no translation layer)
- **Email Attachments**: PDF order receipts, images (plain text/HTML only)
- **Scheduled Emails**: Delayed sending, recurring emails (immediate send only)

## Implementation Plan (3 Steps)

### Step 1: SMTP Test Script ✅ (P0 - Prerequisite)

**File**: `backend/scripts/test-smtp.ts`

**Purpose**: Validate SMTP credentials work before building email system

**Script Should**:
1. Load env vars from `.env`
2. Validate required vars present
3. Create nodemailer transporter
4. Send test email to `SMTP_USER`
5. Output clear success/failure message

**Command**: `npm run test:smtp`

**Success Criteria**: Test email received in inbox

---

### Step 2: Implement sendMail() Function ✅ (Core Feature)

**Location**: Extend `backend/src/application/services/email.service.ts`

**New Method**:
```typescript
async sendMail(params: {
  type: 'customer' | 'agent'
  to: string
  subject: string
  body: string
  cc?: string | string[]
  workspaceId: string
}): Promise<boolean>
```

**Logic**:
1. Fetch workspace to get `adminEmail` (FROM address)
2. Resolve `to` ID to email:
   - If `type === 'customer'`: Query `customers` table
   - If `type === 'agent'`: Query `salesAgents` table
3. Build email options with FROM, TO, CC, subject, body
4. Send via `this.transporter.sendMail()`
5. Return `true` on success, `false` on error

**Unit Tests**: Test with mock prisma, verify email options built correctly

---

### Step 3: Integration Points ✅ (Trigger Points)

**3.1 Agent Notification - Operator Request**

**Location**: `backend/src/domain/calling-functions/contactOperator.ts` (or similar)

**Trigger**: When `contactOperator` calling function executes

**Logic**:
1. Fetch customer's last 10 messages
2. Get customer's assigned `salesAgentId`
3. Build email body with customer name + message history
4. Call `emailService.sendMail({ type: 'agent', to: salesAgentId, ... })`
5. If no agent: Send to admin

**3.2 Order Confirmation Email**

**Location**: `backend/src/services/order.service.ts` (or controller)

**Trigger**: After order created successfully (status = CONFIRMED)

**Logic**:
1. Format order details (items, total, address)
2. Call `emailService.sendMail({ type: 'customer', to: customerId, cc: workspace.adminEmail, ... })`
3. Log success/failure

## Risks & Mitigations _(optional)_

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| SMTP credentials invalid/expired | High (emails don't send) | Medium | Step 1 test script validates before implementation |
| SMTP server blocks/rate limits | Medium (some emails fail) | Low | Add retry logic, use reputable SMTP provider |
| Email lands in spam | Medium (users don't see) | Medium | Use proper FROM address, avoid spam keywords |
| Agent email missing/wrong | Low (fallback to admin) | Medium | Always fallback to workspace admin email |
| Email timeout blocks app | High (app becomes slow) | Low | 30s timeout + async fire-and-forget pattern |

## Related Features _(optional)_

- **Existing EmailService**: `backend/src/application/services/email.service.ts` (password reset emails)
- **Calling Functions**: `contactOperator`, `CreateOrder` will trigger emails
- **Workspace Settings**: `adminEmail` field used as FROM address

## Technical Notes _(optional)_

**Current EmailService (Verified)**:

```typescript
// File: backend/src/application/services/email.service.ts
export class EmailService {
  private transporter: nodemailer.Transporter
  
  constructor() {
    this.setupTransporter()  // Already initializes SMTP
  }
  
  async sendPasswordResetEmail(data: ResetPasswordEmailData): Promise<boolean> {
    // Existing method for password reset
  }
  
  // NEW: Add sendMail() method here
}
```

**SMTP Configuration (from .env)**:
```bash
SMTP_HOST="smtp.movistar.es"
SMTP_PORT="25"
SMTP_SECURE="true"
SMTP_USER="gelsogrovel@gmail.com"
SMTP_AUTH="Gocciole44@"
SMTP_FROM="noreply@echatbot.ai"
```

**Note**: Existing code uses `SMTP_PASS` but user mentioned `SMTP_AUTH`. Verify which env var name is used.

**Email Body Templates**:

**Agent Notification Template**:
```
🔔 RICHIESTA ASSISTENZA URGENTE

Cliente: {customerName}
Telefono: {customerPhone}

Il cliente ha richiesto di parlare con un operatore.

📜 ULTIMI 10 MESSAGGI:
---
[15:30] Cliente: Ciao, vorrei informazioni
[15:31] Chatbot: Ciao! Come posso aiutarti?
...
---

Accedi alla dashboard per rispondere: {dashboardLink}
```

**Order Confirmation Template**:
```
✅ CONFERMA ORDINE #{orderCode}

Grazie per il tuo ordine!

📦 PRODOTTI:
1. Pasta di Gragnano IGP (2x €8.50) = €17.00
2. Olio EVO Toscano (1x €12.00) = €12.00

Subtotale: €29.00
Spedizione: €5.00
TOTALE: €34.00

📍 INDIRIZZO SPEDIZIONE:
{customerAddress}

Stato pagamento: {paymentStatus}

Riceverai una notifica quando l'ordine sarà spedito.
```

**Verification Commands**:

```bash
# Step 1: Test SMTP
npm run test:smtp

# Step 2: Unit test sendMail
npm run test:unit -- email.service.test.ts

# Step 3: Integration test
npm run test:integration -- email-notifications.test.ts
```
