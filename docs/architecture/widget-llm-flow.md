# Widget LLM Integration Flow

**Feature**: Widget Chat with LLM Processing  
**Version**: v2.0 (Unified Queue Architecture)  
**Date**: January 2026

---

## 📋 Overview

Widget chat messages use the **same LLM processing pipeline** as WhatsApp/Push messages, ensuring consistent AI responses across all channels.

### Key Characteristics

- **Immediate Response**: LLM processes message BEFORE queueing (no polling delay)
- **Unified Queue**: Uses `WhatsAppQueue` table with `channel="widget"`
- **Anonymous Users**: visitor_ID-based (24-hour expiry) → creates "Visitor" customer
- **Security**: 5-step validation pipeline (rate limit, content safety, business rules, channel validation, anti-spam)

---

## 🏢 Business Channels

eChatbot supports two types of business:

| Channel | `sellsProductsAndServices` | Description |
|---------|---------------------------|-------------|
| **E-commerce** | `true` | Sells products/services, cart, orders |
| **Informativo** | `false` | Info only, FAQ, support, no sales |

Both channels work via **WhatsApp** or **Widget (Web)**.

---

## 👤 User Types

| Communication | New User Type | Customer `customId` |
|---------------|---------------|---------------------|
| **WhatsApp** | "Unknown User" | Phone number |
| **Widget** | "Visitor" | `visitor_TIMESTAMP_HASH` |

---

## 🔄 Widget Flow (Debug/WIP Aware)

### Priority Order of Checks

```
1. enableWidget = false → 403 Widget disabled
2. Workspace deleted → 503 Service Unavailable
3. channelStatus = false → 🚫 Block (Channel disabled)
4. Owner inactive → 503 Service Unavailable
5. Security Check (5 steps) → Pass or Block
6. Subscription/Credit Check → Pass or Block
7. debugMode = true → 📢 Return wipMessage
8. LLM Processing → Response
```

### 1. Widget Sends Message

```
Customer → Widget UI → POST /api/v1/widget/chat/:workspaceId
```

**Request**:
```json
{
  "visitorId": "visitor_1736611200000_abc123",
  "message": "Ciao! Vorrei informazioni sui prodotti"
}
```

### 2. Security Validation (5 Steps)

```
WidgetChatController → SecurityCheckService.validateMessage()
```

**Pipeline**:
1. **Rate Limit**: 10 msg/min per visitorId
2. **Content Safety**: XSS/SQL injection detection
3. **Business Rules**: Workspace active, owner not inactive
4. **Channel Validation**: Length limits (5000 chars widget, 4096 WhatsApp)
5. **Anti-Spam**: Duplicate detection (5 min window), flood prevention (5 msg/10 sec)

### 3. LLM Processing (NEW!)

```
WidgetChatController → LLMRouterService.routeMessage()
```

**LLM Call**:
```typescript
const llmResult = await llmRouterService.routeMessage({
  workspaceId,
  customerId,
  conversationId: chatSession.id,
  messageId: `widget-${visitorId}-${Date.now()}`,
  message,
  customerLanguage: customer.language || "ENG",
  customerName: customer.name,
  isSystemMessage: false,
})
```

**LLM Response**:
```typescript
{
  response: "Certo! Abbiamo diverse categorie di prodotti...",
  agentUsed: "INTENT_PARSER",
  tokensUsed: 450,
  isBlocked: false
}
```

### 4. Save to Queue (Logging Only)

```
WidgetChatController → prisma.whatsAppQueue.create()
```

**Database Record**:
```typescript
{
  workspaceId,
  customerId,
  phoneNumber: "",          // Empty for widget
  messageContent: message,  // Customer's question
  status: "sent",           // Widget always "sent" (response is immediate)
  channel: "widget",
  visitorId,
  isAnonymous: true,
  responsePayload: {        // LLM response saved for logging
    response: llmResult.response,
    agentUsed: llmResult.agentUsed,
    tokensUsed: llmResult.tokensUsed,
    isBlocked: llmResult.isBlocked,
    processedAt: new Date().toISOString()
  },
  deliveredAt: new Date(),
  pollingAttempts: 0
}
```

### 5. Immediate Response

**Normal Mode**:
```json
{
  "success": true,
  "messageId": "cm5x9y2z0...",
  "sessionId": "session123",
  "response": "Certo! Abbiamo diverse categorie...",
  "status": "ready"
}
```

---

## 🚧 Maintenance / WIP Mode

WIP is shown when:
- `workspace.debugMode = true`

| Behavior | Widget | WhatsApp |
|----------|--------|----------|
| LLM Processing | ❌ SKIPPED | ❌ SKIPPED |
| Queue Save | ❌ NONE | ✅ WIP saved + queued |
| Response | ✅ wipMessage | ✅ wipMessage |

**Widget Response when WIP is ON**:
```json
{
  "success": true,
  "status": "wip",
  "response": "Stiamo lavorando per migliorare il servizio. Torna presto!"
}
```

> 🟡 **WIP returns the maintenance message** (no LLM, no normal responses).

---

## 🚫 Channel Disabled (channelStatus=false)

- `GET /api/v1/widget/status/:workspaceId` → `status: "disabled"`
- `POST /api/v1/widget/chat/:workspaceId` → `403 CHANNEL_DISABLED`
- No WIP, no LLM, no billing

---

## ✅ Widget Status Endpoint

The widget checks availability before rendering:

```
GET /api/v1/widget/status/:workspaceId
```

**Example response** (debugMode=true):
```json
{
  "success": true,
  "status": "wip",
  "channelStatus": true,
  "debugMode": true,
  "wipMessage": "Work in progress. Please contact us later."
}
```

---

## 🆚 Pattern Comparison

### Old Pattern (Deprecated)

```
POST /chat → Queue (pending) → Scheduler → LLM → Update Queue (sent) → Poll → Response
Timeline: 0s              1-5s                      5-10s           10s
```

**Problems**:
- ❌ 10-second delay before response
- ❌ Polling overhead (multiple requests)
- ❌ Scheduler dependency (if scheduler down, no responses)

### New Pattern (Current)

```
POST /chat → LLM → Queue (sent with response) → Poll → Response
Timeline: 0s    1-2s                           2s
```

**Benefits**:
- ✅ Immediate response (1-2 seconds)
- ✅ No polling required (status="ready" from start)
- ✅ No scheduler dependency for message processing
- ✅ Consistent with PushController pattern

---

## 🏗️ Architecture Components

### 1. WidgetChatController

**File**: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`

**Methods**:
- `sendMessage()`: Process message through LLM, save to queue
- `pollMessage()`: Return cached response from queue

### 2. LLMRouterService

**File**: `apps/backend/src/services/llm-router.service.ts`

**Shared Service**: Used by Widget, WhatsApp, Push, Chat

**Method**: `routeMessage(params)`

### 3. SecurityCheckService

**File**: `apps/backend/src/application/services/security-check.service.ts`

**Method**: `validateMessage(params)` → 5-step pipeline

### 4. VisitorIdService

**File**: `apps/backend/src/application/services/visitor-id.service.ts`

**Methods**:
- `generate()`: Create visitor_timestamp_hash
- `validate(id)`: Check format
- `isExpired(id)`: Check 24-hour limit

### 5. WhatsAppQueue Table (Unified)

**File**: `packages/database/prisma/schema.prisma`

**Widget-Specific Fields**:
```prisma
model WhatsAppQueue {
  // ... existing fields ...
  
  channel          String    @default("whatsapp") // "whatsapp" | "widget"
  visitorId        String?   // For anonymous widget users
  isAnonymous      Boolean   @default(false)
  expiresAt        DateTime? // 24-hour session expiry
  responsePayload  Json?     // LLM response cached for polling
  pollingAttempts  Int       @default(0)
  lastPolledAt     DateTime?
}
```

---

## 🔒 Security Features

### 1. Rate Limiting

- **Endpoint Level**: 20 req/min per IP (express-rate-limit)
- **Security Pipeline**: 10 msg/min per visitorId (custom logic)

### 2. Content Safety

**Patterns Detected**:
- XSS: `<script>`, `on\w+=`, `javascript:`
- SQL Injection: `union`, `drop table`, `--`, `';`

### 3. CORS Policy

**Configuration**: Allowlist origins from:
- Frontend/Backoffice domains (static)
- Workspace `websiteUrl`/`url` origins (dynamic)

**Rationale**:
- Widget embedded on customer websites with explicit domain registration
- Security still backed by rate limiting + 5-step validation

### 4. Anonymous Session Expiry

- **Duration**: 24 hours from visitorId creation
- **Cleanup**: Automated job runs every 30 minutes
- **Storage**: sessionStorage (NOT localStorage - expires on tab close)

---

## 📊 Scheduler vs Widget

### Key Difference

| | WhatsApp | Widget |
|---|----------|--------|
| **Delivery** | Scheduler → WhatsApp API | Direct response (no scheduler) |
| **Queue Role** | Processing pipeline | Logging only |
| **Status Flow** | pending → sent | Always "sent" |

The **Scheduler does NOT process Widget messages** - they get immediate response in the controller.

### Widget Cleanup Job

**File**: `apps/scheduler/src/jobs/widget-timeout-cleanup.job.ts`

**Schedule**: Every 30 seconds

**Purpose**: Clean up orphaned widget sessions (not delivery)

```typescript
// Find expired sessions
const expiredSessions = await prisma.whatsAppQueue.findMany({
  where: {
    channel: "widget",
    expiresAt: { lt: new Date() }
  }
})

// Mark as expired
await prisma.whatsAppQueue.updateMany({
  data: { status: "expired" }
})
```

### WhatsApp Queue Job (Channel-Aware)

**File**: `apps/scheduler/src/jobs/whatsapp-channel-queue.job.ts`

**Logic**:
```typescript
// Only process WhatsApp messages (not widget)
const pendingMessages = await prisma.whatsAppQueue.findMany({
  where: {
    channel: "whatsapp",  // IMPORTANT: Exclude widget
    status: "pending"
  }
})

// Send via WhatsApp API
for (const message of pendingMessages) {
  await whatsappApi.sendMessage(message.phoneNumber, response)
}
```

---

## 🧪 Testing

### Integration Test

**File**: `apps/backend/__tests__/integration/widget-chat-flow.integration.spec.ts`

**Coverage**:
- ✅ Send message → LLM processing → Immediate response
- ✅ Poll message → Return cached response
- ✅ Security validation (rate limit, XSS, SQL injection)
- ✅ VisitorId expiry
- ✅ Multiple consecutive messages
- ✅ End-to-end flow

**Run**:
```bash
npm run test:integration --workspace=@echatbot/backend -- widget-chat-flow.integration.spec.ts
```

### Unit Tests

**Existing**: 1477 tests passed (no regression)

**New Coverage**:
- VisitorIdService (generation, validation)
- SecurityCheckService (5-step pipeline)
- WidgetDeliveryService (cleanup jobs)

---

## 📈 Performance Metrics

### Response Time

- **LLM Processing**: 1-2 seconds (GPT-4-mini via OpenRouter)
- **Total Request**: 1.5-2.5 seconds (LLM + DB save)
- **Polling**: <50ms (cached response from DB)

### Resource Usage

- **Database**: +7 fields to WhatsAppQueue (minimal overhead)
- **Memory**: No in-memory state (fully stateless)
- **CPU**: Scheduler job runs every 30 sec (lightweight query)

### Scalability

- **Concurrent Users**: No limit (stateless architecture)
- **Messages/Second**: Rate limited to prevent abuse
- **Database Load**: Indexed on `channel`, `visitorId`, `expiresAt`

---

## 🚀 Future Enhancements

### Phase 3-7 (Not Implemented Yet)

- [ ] Frontend widget UI (React component)
- [ ] Widget embed code generator
- [ ] Customization (colors, branding)
- [ ] E2E testing with Playwright
- [ ] User acceptance testing

### Potential Improvements

- [ ] WebSocket support (real-time instead of polling)
- [ ] Typing indicators
- [ ] Read receipts
- [ ] File attachments
- [ ] Voice messages

---

## 📚 Related Documentation

- **Architecture**: [docs/architecture/routing-unification.md](../routing-unification.md)
- **PRD**: [docs/PRD.md](../../PRD.md) (line 9933+)
- **Tasks**: [.specify/widget-unification/tasks.md](../../.specify/widget-unification/tasks.md)
- **Cleanup Report**: [.specify/widget-unification/widget-llm-cleanup-report.md](../../.specify/widget-unification/widget-llm-cleanup-report.md)

---

## 🎯 Summary

### Architecture Table

| Setting | Widget | WhatsApp |
|---------|--------|----------|
| **debugMode=true** | 📢 wipMessage (200) | 📢 wipMessage |
| **channelStatus=false** | 🚫 Disabled (403) | 🚫 Blocked at webhook |
| **Normal** | ✅ LLM → Response | ✅ LLM → Queue → Send |

### Widget LLM Integration Status

✅ **LLM Processing**: Immediate response via LLMRouterService  
✅ **Unified Queue**: Single table with channel discriminator  
✅ **Security**: 5-step validation pipeline  
✅ **Debug Mode**: Returns wipMessage without LLM  
✅ **WIP Mode**: Returns wipMessage without LLM (debugMode only)  
✅ **Testing**: Integration tests passing  
✅ **Performance**: 1-2 second response time  
✅ **Scalability**: Stateless architecture  

**Next**: Phase 3-7 frontend implementation
