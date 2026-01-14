# Widget LLM Integration Flow

**Feature**: Widget Chat with LLM Processing  
**Version**: v2.0 (Unified Queue Architecture)  
**Date**: January 2026

---

## 📋 Overview

Widget chat messages now use the **same LLM processing pipeline** as WhatsApp/Push messages, ensuring consistent AI responses across all channels.

### Key Characteristics

- **Immediate Response**: LLM processes message BEFORE queueing (no polling delay)
- **Unified Queue**: Uses `WhatsAppQueue` table with `channel="widget"`
- **Anonymous Users**: visitor_ID-based (24-hour expiry)
- **Security**: 5-step validation pipeline (rate limit, content safety, business rules, channel validation, anti-spam)

---

## 🔄 Message Flow

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

### 4. Save to Queue with Response

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
  status: "sent",          // Already processed!
  channel: "widget",
  visitorId,
  isAnonymous: true,
  responsePayload: {
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

```json
{
  "success": true,
  "messageId": "cm5x9y2z0...",
  "status": "ready",    // Response already available!
  "retryAfter": 0       // No need to poll
}
```

### 6. Optional Polling

```
Widget UI → GET /api/v1/widget/poll/:messageId
```

**Response**:
```json
{
  "status": "ready",
  "message": "Certo! Abbiamo diverse categorie di prodotti..."
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

## 📊 Scheduler Integration

### Widget-Specific Jobs

**File**: `apps/scheduler/src/jobs/widget-timeout-cleanup.job.ts`

**Schedule**: Every 30 seconds

**Logic**:
```typescript
// Find messages with 30+ polling attempts
const timedOutMessages = await prisma.whatsAppQueue.findMany({
  where: {
    channel: "widget",
    status: "pending",
    pollingAttempts: { gte: 30 }
  }
})

// Mark as error
await prisma.whatsAppQueue.updateMany({
  data: { 
    status: "error",
    errorMessage: "Timeout: No response within 15 seconds"
  }
})
```

### Channel-Aware Delivery

**File**: `apps/scheduler/src/jobs/whatsapp-channel-queue.job.ts`

**Logic**:
```typescript
if (message.channel === 'widget') {
  // Widget: Save response to queue (no API call)
  await prisma.whatsAppQueue.update({
    status: 'sent',
    responsePayload: { response: llmResponse }
  })
} else {
  // WhatsApp: Send via API (existing logic)
  await whatsappApi.sendMessage(...)
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

Widget LLM integration is **COMPLETE** for Phase 2 Foundational:

✅ **LLM Processing**: Immediate response via LLMRouterService  
✅ **Unified Queue**: Single table with channel discriminator  
✅ **Security**: 5-step validation pipeline  
✅ **Testing**: Integration tests passing  
✅ **Performance**: 1-2 second response time  
✅ **Scalability**: Stateless architecture  

**Next**: Phase 3-7 frontend implementation
