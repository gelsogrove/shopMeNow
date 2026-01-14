# Widget & WhatsApp Unification - Implementation Plan

**Date**: January 11, 2026  
**Tech Stack**: Node.js/Express + TypeScript + PostgreSQL + Prisma  
**Effort**: 40-50 hours  
**Timeline**: 7 days (single developer)  

---

## Architecture Overview

### Current State
```
Widget: LLMRouter → Direct Response (❌ No security)
WhatsApp: API → LLMRouter → MessageQueue → Scheduler → WhatsApp API (✅ Secure)
```

### Target State
```
Widget: API → LLMRouter → MessageQueue (channel="widget") ↘
                                                           → Scheduler (Security validation)
WhatsApp: API → LLMRouter → MessageQueue (channel="whatsapp") → Delivery logic per channel
```

---

## Technology Decisions

### Why Unified Queue?
- Single source of truth for all messages
- Consistent security validation
- Easier to scale (add new channels)
- Better observability and monitoring

### Why Polling (Not WebSocket)?
- Simpler implementation (no connection management)
- Stateless backend (easier to scale)
- No persistent connections needed
- 500ms interval acceptable for UX

### Why 5-Step Security?
- Rate limiting prevents abuse
- Content safety catches malicious input
- Business rules respect hours/maintenance
- Channel-specific validation catches format errors
- Anti-spam prevents flood attacks

---

## Project Structure

```
apps/backend/
├── src/
│   ├── application/services/
│   │   ├── visitor-id.service.ts (NEW)
│   │   ├── chat-session.service.ts (NEW)
│   │   ├── security-check.service.ts (NEW)
│   │   ├── message-delivery.service.ts (NEW)
│   │   ├── status-management.service.ts (NEW)
│   │   ├── error-handling.service.ts (NEW)
│   │   └── rate-limiting.service.ts (NEW)
│   ├── interfaces/http/
│   │   ├── controllers/
│   │   │   └── widget-chat.controller.ts (NEW)
│   │   ├── routes/
│   │   │   └── widget.routes.ts (NEW)
│   │   ├── middlewares/
│   │   │   ├── widget-auth.middleware.ts (NEW)
│   │   │   └── widget-rate-limit.middleware.ts (NEW)
│   │   ├── schemas/
│   │   │   └── widget.schemas.ts (NEW)
│   │   └── utils/
│   │       └── error-formatter.ts (NEW)
│   └── repositories/
│       └── message-queue.repository.ts (MODIFY)
├── prisma/
│   ├── schema.prisma (MODIFY)
│   ├── migrations/
│   │   └── add_widget_support_to_queue/ (NEW)
│   └── seed.ts (MODIFY)
└── __tests__/
    └── unit/
        ├── services/
        │   ├── visitor-id.service.test.ts
        │   ├── security-check.service.test.ts
        │   └── message-delivery.service.test.ts
        └── controllers/
            └── widget-chat.controller.test.ts

apps/scheduler/
├── src/
│   ├── jobs/
│   │   ├── message-processor.job.ts (MODIFY)
│   │   ├── widget-polling-timeout.job.ts (NEW)
│   │   └── message-cleanup.job.ts (NEW)
│   ├── services/
│   │   └── monitoring.service.ts (NEW)
│   └── config/
│       └── cron-jobs.ts (NEW)

apps/frontend/
├── src/
│   ├── components/
│   │   └── WidgetChat.tsx (NEW)
│   ├── services/
│   │   ├── widgetApi.ts (NEW)
│   │   ├── widget-polling.service.ts (NEW)
│   │   └── widget-session.service.ts (NEW)
│   └── hooks/
│       └── useWidgetChat.ts (NEW)
```

---

## Database Schema Changes

```prisma
model MessageQueue {
  // Existing fields
  id          String    @id @default(cuid())
  workspaceId String
  customerId  String
  content     String
  status      String    @default("pending")
  createdAt   DateTime  @default(now())
  
  // NEW FIELDS
  channel     String    @default("whatsapp")  // "whatsapp" | "widget"
  visitorId   String?                         // For anonymous widget users
  phoneNumber String?                         // For WhatsApp tracking
  
  @@index([workspaceId, status])
  @@index([channel])
}

model ChatSession {
  // Existing fields
  id          String    @id @default(cuid())
  workspaceId String
  customerId  String
  status      String    @default("active")
  createdAt   DateTime  @default(now())
  
  // NEW FIELDS
  isAnonymous Boolean   @default(false)      // True for widget visitors
  expiresAt   DateTime?                      // Session expiry for anonymous
}
```

---

## API Contracts

### POST /api/v1/widget/chat/:workspaceId
**Purpose**: Send message from widget

**Request**:
```json
{
  "visitorId": "visitor_1726262000000_a7k2m9x1",
  "message": "Ciao!",
  "sessionId": "optional_session_id"
}
```

**Response**:
```json
{
  "success": true,
  "messageId": "msg_12345",
  "status": "pending",
  "retryAfter": 500
}
```

### GET /api/v1/widget/poll/:messageId
**Purpose**: Poll for response (widget client)

**Request**:
```http
GET /api/v1/widget/poll/msg_12345
X-Widget-Session: session_id
X-Workspace-Id: workspace_id
```

**Response**:
```json
{
  "status": "pending|ready|blocked|error",
  "message": "Response text (null if pending)",
  "retryAfter": 500,
  "isComplete": false
}
```

---

## Implementation Phases

### Phase 1: Database (1 day)
- [ ] Add schema fields
- [ ] Create migration
- [ ] Test backward compatibility
- [ ] Update seed data

### Phase 2: API Endpoints (1 day)
- [ ] Create controllers
- [ ] Create routes + middleware
- [ ] Add validation schemas
- [ ] Error standardization

### Phase 3: Backend Services (1 day)
- [ ] VisitorId generation
- [ ] ChatSession management
- [ ] Security validation (5 steps)
- [ ] Message delivery logic

### Phase 4: Scheduler (1 day)
- [ ] Refactor message processor
- [ ] Add timeout detection
- [ ] Add cleanup job
- [ ] Monitoring integration

### Phase 5: Frontend (1 day)
- [ ] Widget component
- [ ] Polling service
- [ ] Session management
- [ ] Error handling

### Phase 6: Testing & Documentation (1 day)
- [ ] Write unit tests
- [ ] API documentation
- [ ] Architecture docs
- [ ] Operational guides

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Migration rollback fails | MEDIUM | CRITICAL | Backup DB before migration |
| Widget polling too aggressive | MEDIUM | HIGH | Rate limiting per visitorId |
| WhatsApp regression | LOW | CRITICAL | Comprehensive regression tests |
| Performance degrades | MEDIUM | HIGH | Baseline testing, caching |
| Data loss | LOW | CRITICAL | Transaction-based operations |

---

## Success Metrics

- **Code Quality**: 0 linting errors, > 80% test coverage
- **Performance**: API response < 500ms, polling latency < 100ms
- **Reliability**: 99.9% uptime, zero data loss
- **Security**: All 5 validation steps working, rate limiting enforced
- **User Experience**: Widget response < 15 seconds

