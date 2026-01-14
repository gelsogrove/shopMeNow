---
description: "Task list for Widget & WhatsApp Unification Feature"
---

# Tasks: Widget & WhatsApp Unification

**Input**: Design documents from `/docs/analysis/` and `/docs/epics/tasks/`  
**Prerequisites**: analisiLLM.md (specification), widget-unification-plan.md (plan)  
**Tests**: Integration tests included - write tests FIRST, ensure they FAIL before implementation  
**Organization**: Tasks grouped by FASE (user story equivalent) to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which phase/story this task belongs to (e.g., [FASE1], [FASE2], etc.)
- Include exact file paths in descriptions
- **360-Degree Impact**: Note affected layers (BE/FE/DB/Scheduler/Security/Tests)

## Path Conventions

- **Backend**: `apps/backend/src/`
- **Frontend**: `apps/frontend/src/` or `apps/backoffice/src/`
- **Scheduler**: `apps/scheduler/src/`
- **Database**: `apps/backend/prisma/`
- **Tests**: `apps/backend/__tests__/` or `apps/frontend/__tests__/`
- **Docs**: `docs/` and `.specify/memory/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for widget unification

- [ ] T001 [P] Create feature directory structure under `.specify/widget-unification/`
- [ ] T002 [P] Initialize specification documents: plan.md, spec.md, research.md in `.specify/widget-unification/`
- [ ] T003 [P] Setup test fixtures for widget/whatsapp message scenarios in `apps/backend/__tests__/fixtures/`
- [ ] T004 [P] Configure environment variables for widget testing (.env.widget.test)
- [ ] T005 [P] Create database backup script before migration: `apps/backend/scripts/backup-db-before-widget-migration.sh`

---

## Phase 2: Foundational (Blocking Prerequisites - CRITICAL)

**Purpose**: Core database and API infrastructure that MUST be complete before any user story can proceed

**⚠️ CRITICAL**: No FASE work can begin until this phase is 100% complete

### [FOUNDATION] Database Schema & Migration

- [ ] T006 [P] **[DB]** Add `channel` field to MessageQueue: `apps/backend/prisma/schema.prisma` → `messageQueue { channel String @default("whatsapp") }`
- [ ] T007 [P] **[DB]** Add `visitorId` field (nullable) to MessageQueue: `apps/backend/prisma/schema.prisma` → `messageQueue { visitorId String? }`
- [ ] T008 [P] **[DB]** Add `phoneNumber` field (nullable) to MessageQueue: `apps/backend/prisma/schema.prisma` → `messageQueue { phoneNumber String? }`
- [ ] T009 [P] **[DB]** Add `isAnonymous` flag to ChatSession: `apps/backend/prisma/schema.prisma` → `chatSession { isAnonymous Boolean @default(false) }`
- [ ] T010 [P] **[DB]** Add `expiresAt` field (nullable) to ChatSession: `apps/backend/prisma/schema.prisma` → `chatSession { expiresAt DateTime? }`
- [ ] T011 **[DB]** Create Prisma migration: `npx prisma migrate dev --name add_widget_support_to_queue` in `apps/backend/`
- [ ] T012 **[DB]** Validate migration applies cleanly: verify schema changes in database, test rollback
- [ ] T013 **[DB]** Generate Prisma client: `npx prisma generate` in `apps/backend/`
- [ ] T014 [P] **[DB]** Update seed script with widget test data: `apps/backend/prisma/seed.ts` (add 5 widget test messages)
- [ ] T015 **[Tests/DB]** Validate backward compatibility: Verify all existing WhatsApp messages have `channel="whatsapp"` and work unchanged

**Checkpoint**: Database schema updated and backward compatible - can begin implementation phases

### [FOUNDATION] Request Validation & Error Standardization

- [ ] T016 [P] **[BE/Validation]** Create Zod schemas for widget requests: `apps/backend/src/interfaces/http/schemas/widget.schemas.ts`
  - Schema for POST /api/v1/widget/chat (visitorId, message, sessionId)
  - Schema for GET /api/v1/widget/poll/:messageId
  - Schema for POST /api/v1/widget/auth (token, workspaceId)
- [ ] T017 [P] **[BE/Error]** Standardize error response format: `apps/backend/src/interfaces/http/utils/error-formatter.ts`
  ```typescript
  {
    "status": "error",
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "timestamp": "ISO8601"
  }
  ```
- [ ] T018 [P] **[BE/CORS]** Configure CORS for widget from any domain: `apps/backend/src/index.ts`

**Checkpoint**: Validation and error handling infrastructure ready

---

## Phase 3: FASE 1 - Database Migration (Priority: P1) 🎯 MVP Foundation

**Goal**: Complete unified database schema with channel-aware message queue supporting both widget and WhatsApp

**Independent Test**: `npm run test -- apps/backend/__tests__/integration/database/widget-migration.test.ts` → should verify schema, backward compatibility, and test data

### Tests for FASE 1 (WRITE THESE FIRST - Ensure they FAIL before implementation)

- [ ] T019 [P] **[Tests/DB]** Create migration test: `apps/backend/__tests__/integration/database/widget-migration.test.ts`
  - Test: channel field exists with default "whatsapp"
  - Test: visitorId field is nullable
  - Test: phoneNumber field is nullable
  - Test: isAnonymous flag defaults to false
  - Test: expiresAt field is nullable
  - Test: Backward compatibility - old messages still queryable
  - Test: Can insert widget message with visitorId
  - Test: Can insert whatsapp message with phoneNumber
  - Test: Migration rollback works (if rollback is needed)

### Implementation for FASE 1

- [ ] T020 [P] **[BE/Repository]** Create MessageQueueRepository with unified insert: `apps/backend/src/repositories/message-queue.repository.ts`
  ```typescript
  async enqueueMessage(data: {
    workspaceId: string
    customerId: string
    channel: "widget" | "whatsapp"
    content: string
    visitorId?: string
    phoneNumber?: string
  }): Promise<MessageQueueItem>
  ```
- [ ] T021 [P] **[BE/Service]** Create VisitorIdService for generation and validation: `apps/backend/src/application/services/visitor-id.service.ts`
  - Format: `visitor_{timestamp}_{randomHash}`
  - Validation: check format and length
- [ ] T022 **[BE/Service]** Create ChatSessionService for widget session management: `apps/backend/src/application/services/chat-session.service.ts`
  ```typescript
  async findOrCreateWidgetSession(workspaceId: string, visitorId: string): Promise<ChatSession>
  ```
- [ ] T023 **[Tests/Unit]** Unit test VisitorIdService: `apps/backend/__tests__/unit/services/visitor-id.service.test.ts`
  - Test generation format
  - Test validation
  - Test uniqueness
- [ ] T024 **[Tests/Unit]** Unit test ChatSessionService: `apps/backend/__tests__/unit/services/chat-session.service.test.ts`
  - Test session creation
  - Test session retrieval
  - Test anonymous session expiry
- [ ] T025 **[Tests/Integration]** Verify seed script runs: `npm run seed` → verify widget test messages in database
- [ ] T026 **[DB/Seed]** Update seed with test data: Add 10 widget test messages to seed for development

**360-Degree Validation for FASE 1**:
- [ ] Database: Migration applied, schema verified, seed updated
- [ ] Repository: Unified insert method created, filters by workspaceId
- [ ] Services: VisitorId generation + ChatSession management working
- [ ] Tests: All DB tests passing (AFTER implementation completes)
- [ ] Backward Compatibility: All existing WhatsApp messages still work

**Checkpoint**: FASE 1 complete - Database schema ready, backward compatible, tests passing

---

## Phase 4: FASE 2 - Backend API Endpoints (Priority: P1)

**Goal**: Implement widget API endpoints for sending messages and polling responses

**Independent Test**: `npm run test:integration -- apps/backend/__tests__/integration/api/widget-endpoints.test.ts` → should verify all endpoints work independently

### Tests for FASE 2 (WRITE THESE FIRST)

- [ ] T027 [P] **[Tests/API]** Create widget API endpoint tests: `apps/backend/__tests__/integration/api/widget-endpoints.test.ts`
  - Test: POST /api/v1/widget/chat/:workspaceId with valid visitorId
  - Test: GET /api/v1/widget/poll/:messageId returns pending status
  - Test: GET /api/v1/widget/poll/:messageId returns ready when message processed
  - Test: Rate limiting blocks after 10 messages/minute
  - Test: Invalid visitorId format rejected (400)
  - Test: Missing X-Workspace-Id header rejected (400)
  - Test: messageId not found returns 404
  - Test: CORS headers present for widget

### Implementation for FASE 2

- [ ] T028 [P] **[BE/Controller]** Create WidgetChatController: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`
  - POST /api/v1/widget/chat/:workspaceId
  - GET /api/v1/widget/poll/:messageId
  - POST /api/v1/widget/auth
- [ ] T029 [P] **[BE/Routes]** Create widget routes with middleware stack: `apps/backend/src/interfaces/http/routes/widget.routes.ts`
  ```typescript
  router.post(
    "/chat/:workspaceId",
    validateWorkspaceOperation,  // Extract and validate workspaceId
    widgetAuthMiddleware,        // Validate visitorId OR JWT token
    rateLimitMiddleware,         // Rate limit per visitorId
    widgetChatController.sendMessage
  )
  ```
- [ ] T030 [P] **[BE/Middleware]** Create widget authentication middleware: `apps/backend/src/interfaces/http/middlewares/widget-auth.middleware.ts`
  - Validate visitorId format if anonymous
  - Validate JWT token if authenticated
  - Set req.customerId and req.isAnonymous
- [ ] T031 [P] **[BE/Middleware]** Create widget-specific rate limiting middleware: `apps/backend/src/interfaces/http/middlewares/widget-rate-limit.middleware.ts`
  - Track per visitorId or userId
  - Limit: 10 messages/minute, 50 messages/hour
  - Return 429 if exceeded
- [ ] T032 **[BE/Service]** Refactor LLMRouterService to use unified queue: `apps/backend/src/application/services/llm-router.service.ts`
  - Change: Instead of sending response directly to widget, put in MessageQueue with channel="widget"
  - Change: WhatsApp behavior unchanged
  - Call: `messageQueueRepository.enqueueMessage()`
- [ ] T033 **[BE/Swagger]** Add @swagger JSDoc tags to WidgetChatController: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`
  ```typescript
  /**
   * @swagger
   * /api/v1/widget/chat/{workspaceId}:
   *   post:
   *     summary: Send widget message
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/WidgetChatRequest'
   */
  ```
- [ ] T034 [P] **[Tests/Unit]** Unit test WidgetChatController: `apps/backend/__tests__/unit/controllers/widget-chat.controller.test.ts`
  - Test: sendMessage calls LLMRouterService
  - Test: polls returns correct status
  - Test: error handling
- [ ] T035 [P] **[Tests/Security]** Security test for rate limiting: `apps/backend/__tests__/security/widget-rate-limit.test.ts`
  - Test: 10 messages allowed per minute
  - Test: 11th message blocked (429)
  - Test: Rate limit independent per visitorId
- [ ] T036 **[Tests/Integration]** Test API endpoints: `npm run test -- apps/backend/__tests__/integration/api/widget-endpoints.test.ts`
- [ ] T037 **[Build]** Rebuild Swagger: `npm run build` → verify `swagger.json` updated

**360-Degree Validation for FASE 2**:
- [ ] Endpoints: POST/GET widget endpoints work
- [ ] Controller: Calls correct services, proper error handling
- [ ] Routes: Middleware stack complete
- [ ] Middleware: Auth + rate limiting working
- [ ] LLMRouter: Uses unified queue for widget
- [ ] Swagger: Documentation generated
- [ ] Tests: All API tests passing

**Checkpoint**: FASE 2 complete - Widget API endpoints working, rate limiting active, WhatsApp unchanged

---

## Phase 5: FASE 3 - Backend Services (Priority: P1)

**Goal**: Implement security checks and message queue services for unified processing

**Independent Test**: `npm run test -- apps/backend/__tests__/integration/services/message-processing.test.ts` → verify security validation flow

### Tests for FASE 3 (WRITE THESE FIRST)

- [ ] T038 [P] **[Tests/Service]** Create security check tests: `apps/backend/__tests__/unit/services/security-check.service.test.ts`
  - Test: Rate limit check (step 1)
  - Test: Content safety check (step 2)
  - Test: Business rules check (step 3)
  - Test: Channel-specific validation (step 4)
  - Test: Anti-spam pattern detection (step 5)
  - Test: Correct order of validation
  - Test: Each failure returns correct status
- [ ] T039 [P] **[Tests/Service]** Create message delivery service tests: `apps/backend/__tests__/unit/services/message-delivery.service.test.ts`
  - Test: WhatsApp messages sent to API
  - Test: Widget messages marked as "ready"
  - Test: Retry logic on failure
  - Test: DLQ handling after 3 failures

### Implementation for FASE 3

- [ ] T040 [P] **[BE/Service]** Create SecurityCheckService with 5-step validation: `apps/backend/src/application/services/security-check.service.ts`
  ```typescript
  async validateMessage(data: {
    workspaceId: string
    customerId: string
    channel: "widget" | "whatsapp"
    content: string
    visitorId?: string
    phoneNumber?: string
  }): Promise<{ valid: boolean, status: "pending" | "blocked" | "queued" }>
  ```
  - Step 1: Rate limit check (workspace credits > 0, customer not hitting limit)
  - Step 2: Content safety check (LLM evaluation)
  - Step 3: Business rules check (closed hours, maintenance mode)
  - Step 4: Channel-specific validation (widget: visitorId valid + workspace active; whatsapp: number valid + not blacklist)
  - Step 5: Anti-spam pattern (10+ msgs in 30s or 5+ same question in 1 min)
- [ ] T041 [P] **[BE/Service]** Create MessageDeliveryService for channel-specific logic: `apps/backend/src/application/services/message-delivery.service.ts`
  ```typescript
  async deliverMessage(messageQueueItem: MessageQueueItem): Promise<void>
  ```
  - If channel="whatsapp": send via WhatsApp API, status = "sent"
  - If channel="widget": status = "ready", await polling
- [ ] T042 [P] **[BE/Service]** Create StatusManagementService: `apps/backend/src/application/services/status-management.service.ts`
  - Lifecycle: pending → ready/blocked → sent/expired
  - Immutability: status cannot change after decision
  - Atomic updates to avoid race conditions
- [ ] T043 [P] **[BE/Service]** Create ErrorHandlingService: `apps/backend/src/application/services/error-handling.service.ts`
  - Retry logic: max 3 retries with exponential backoff
  - Move to DLQ after 3 failures
  - Log incident for team review
- [ ] T044 [P] **[BE/Service]** Create RateLimitingService: `apps/backend/src/application/services/rate-limiting.service.ts`
  - Track per visitorId (widget) or customerId (whatsapp)
  - Limits: 10 msg/min, 50 msg/hour per customer
  - Database or Redis backend (choose based on existing infrastructure)
  - Auto-unblock after timeout
- [ ] T045 **[BE/Service]** Create AnalyticsService for tracking: `apps/backend/src/application/services/analytics.service.ts`
  - Track: messages by channel, response times, success rates, customer engagement
  - Store in separate analytics table or external service
  - Enable dashboard queries
- [ ] T046 [P] **[Tests/Unit]** Unit test SecurityCheckService: `npm run test -- apps/backend/__tests__/unit/services/security-check.service.test.ts`
- [ ] T047 [P] **[Tests/Unit]** Unit test MessageDeliveryService: `npm run test -- apps/backend/__tests__/unit/services/message-delivery.service.test.ts`
- [ ] T048 [P] **[Tests/Unit]** Unit test StatusManagementService: `npm run test -- apps/backend/__tests__/unit/services/status-management.service.test.ts`
- [ ] T049 [P] **[Tests/Unit]** Unit test RateLimitingService: `npm run test -- apps/backend/__tests__/unit/services/rate-limiting.service.test.ts`
- [ ] T050 **[Tests/Integration]** Integration test message flow: `npm run test -- apps/backend/__tests__/integration/services/message-processing.test.ts`
  - Test: Complete flow from widget message to response
  - Test: Security validation applied
  - Test: Status transitions correct

**360-Degree Validation for FASE 3**:
- [ ] SecurityCheckService: All 5 steps working, correct order, proper status returns
- [ ] MessageDeliveryService: Widget and WhatsApp paths work correctly
- [ ] StatusManagement: Lifecycle transitions atomic and correct
- [ ] ErrorHandling: Retry logic working, DLQ population
- [ ] RateLimiting: Per-customer tracking, auto-unblock
- [ ] Analytics: Metrics tracked and queryable
- [ ] Tests: All service tests passing

**Checkpoint**: FASE 3 complete - Security validation and message delivery working

---

## Phase 6: FASE 4 - Scheduler Processing (Priority: P1)

**Goal**: Implement scheduler jobs for unified message processing with security checks

**Independent Test**: `npm run test -- apps/scheduler/__tests__/unit/jobs/message-processor.test.ts` → verify scheduler processes both channels correctly

### Tests for FASE 4 (WRITE THESE FIRST)

- [ ] T051 [P] **[Tests/Scheduler]** Create message processor tests: `apps/scheduler/__tests__/unit/jobs/message-processor.test.ts`
  - Test: Picks up pending messages from queue
  - Test: Applies security checks
  - Test: Routes to WhatsApp API for whatsapp channel
  - Test: Marks widget messages as "ready"
  - Test: Updates status correctly
  - Test: Error handling and retry logic
  - Test: Timeout detection (30 sec for widget)
- [ ] T052 [P] **[Tests/Scheduler]** Create cron job tests: `apps/scheduler/__tests__/unit/jobs/widget-polling-timeout.test.ts`
  - Test: Detects widget messages pending > 30 seconds
  - Test: Marks as error
  - Test: Logs timeout event

### Implementation for FASE 4

- [ ] T053 **[Scheduler/Job]** Refactor existing message processor: `apps/scheduler/src/jobs/message-processor.job.ts`
  - Query: `MessageQueue where status="pending"`
  - For each message:
    - Call SecurityCheckService
    - If failed: status = "blocked", continue
    - Call MessageDeliveryService
    - Update status based on delivery result
  - Handle errors with ErrorHandlingService
- [ ] T054 [P] **[Scheduler/Job]** Create widget polling timeout job: `apps/scheduler/src/jobs/widget-polling-timeout.job.ts`
  - Cron: Every 30 seconds
  - Query: widget messages with status="pending" for > 30 seconds
  - Action: Mark as "error", notify polling client
- [ ] T055 [P] **[Scheduler/Job]** Create message cleanup job: `apps/scheduler/src/jobs/message-cleanup.job.ts`
  - Cron: Daily
  - Query: messages > 30 days old
  - Action: Delete or archive to cold storage
  - Preserve audit trail
- [ ] T056 [P] **[Scheduler/Monitoring]** Create monitoring service: `apps/scheduler/src/services/monitoring.service.ts`
  - Track metrics: job execution time, error rate, queue depth, timeout count
  - Emit alerts: job fails, queue > 1000, error rate > 5%
  - Log to centralized system
- [ ] T057 **[Scheduler/Config]** Configure cron jobs: `apps/scheduler/src/config/cron-jobs.ts`
  - Message processor: Every 5 seconds
  - Widget timeout check: Every 30 seconds
  - Cleanup job: Daily at 2 AM
  - Monitoring: Every minute
- [ ] T058 [P] **[Tests/Unit]** Unit test message processor: `npm run test -- apps/scheduler/__tests__/unit/jobs/message-processor.test.ts`
- [ ] T059 [P] **[Tests/Unit]** Unit test timeout job: `npm run test -- apps/scheduler/__tests__/unit/jobs/widget-polling-timeout.test.ts`
- [ ] T060 [P] **[Tests/Unit]** Unit test cleanup job: `npm run test -- apps/scheduler/__tests__/unit/jobs/message-cleanup.test.ts`
- [ ] T061 **[Tests/Integration]** Integration test scheduler flow: `npm run test -- apps/scheduler/__tests__/integration/scheduler-widget-flow.test.ts`
  - Simulate: Widget message → Queue → Processor → Response ready
  - Simulate: WhatsApp message → Queue → Processor → Sent

**360-Degree Validation for FASE 4**:
- [ ] Message Processor: Picks up messages, applies security, delivers correctly
- [ ] Timeout Job: Detects widget timeouts
- [ ] Cleanup Job: Removes old messages
- [ ] Monitoring: Tracks metrics and alerts
- [ ] Cron Config: All jobs running at correct intervals
- [ ] Tests: All scheduler tests passing

**Checkpoint**: FASE 4 complete - Scheduler processing working, both channels handled

---

## Phase 7: FASE 5 - Frontend Widget (Priority: P2)

**Goal**: Implement frontend widget component for user-facing chat interface

**Independent Test**: `npm run test -- apps/frontend/__tests__/integration/widget-chat-flow.test.ts` → verify widget sends/receives messages

### Tests for FASE 5 (WRITE THESE FIRST)

- [ ] T062 [P] **[Tests/Frontend]** Create widget component tests: `apps/frontend/__tests__/components/WidgetChat.test.tsx`
  - Test: Component renders
  - Test: Input form submission calls API
  - Test: Polling starts after message sent
  - Test: Response displayed when ready
  - Test: Error states handled
  - Test: Loading states visible
  - Test: Timeout message after 15 seconds
- [ ] T063 [P] **[Tests/Frontend]** Create polling service tests: `apps/frontend/__tests__/services/widget-polling.service.test.ts`
  - Test: Polling interval is 500ms
  - Test: Max 30 retries (15 seconds timeout)
  - Test: Stops when ready/blocked/error
  - Test: Exponential backoff on network error

### Implementation for FASE 5

- [ ] T064 [P] **[FE/Component]** Create WidgetChat component: `apps/frontend/src/components/WidgetChat.tsx`
  - Message input form
  - Message list display
  - Loading indicator
  - Error handling
  - Responsive design (mobile-first)
- [ ] T065 [P] **[FE/Component]** Create message display sub-component: `apps/frontend/src/components/WidgetMessageList.tsx`
  - Render messages with markdown (bold, italic, links)
  - Emojis support
  - Scroll to latest message
  - Message timestamps
- [ ] T066 [P] **[FE/Service]** Create widget API service: `apps/frontend/src/services/widgetApi.ts`
  ```typescript
  export const widgetApi = {
    sendMessage(workspaceId: string, visitorId: string, message: string),
    pollMessage(messageId: string),
    authenticate(token: string, workspaceId: string)
  }
  ```
- [ ] T067 [P] **[FE/Service]** Create widget polling service: `apps/frontend/src/services/widget-polling.service.ts`
  - 500ms interval
  - Max 30 retries = 15 seconds timeout
  - Exponential backoff on error
  - Stop on ready/blocked/error
- [ ] T068 [P] **[FE/Service]** Create session management service: `apps/frontend/src/services/widget-session.service.ts`
  - Generate visitorId on first load (format: visitor_{timestamp}_{random})
  - Store in sessionStorage (NOT localStorage)
  - Reuse on page reload
  - Clear on widget close
- [ ] T069 **[FE/Hook]** Create useWidgetChat hook: `apps/frontend/src/hooks/useWidgetChat.ts`
  - Manage widget state (messages, loading, error)
  - Handle send message
  - Handle polling
  - Handle session management
- [ ] T070 **[FE/Integration]** Integrate widget into existing pages: 
  - Option 1: Iframe on public pages
  - Option 2: Direct component on customer portal
  - Create: `apps/frontend/src/pages/WidgetPage.tsx`
- [ ] T071 [P] **[Tests/Frontend]** Unit test WidgetChat: `npm run test -- apps/frontend/__tests__/components/WidgetChat.test.tsx`
- [ ] T072 [P] **[Tests/Frontend]** Unit test polling service: `npm run test -- apps/frontend/__tests__/services/widget-polling.service.test.ts`
- [ ] T073 [P] **[Tests/Frontend]** Unit test session service: `npm run test -- apps/frontend/__tests__/services/widget-session.service.test.ts`
- [ ] T074 **[Tests/Integration]** End-to-end widget test: `npm run test -- apps/frontend/__tests__/integration/widget-chat-flow.test.ts`
  - Send message via widget
  - Receive response via polling
  - Verify message content

**360-Degree Validation for FASE 5**:
- [ ] Component: Renders correctly, responsive, accessibility
- [ ] Input: Form validates, sends via API
- [ ] Polling: 500ms interval, stops correctly, error handling
- [ ] Session: VisitorId generated and persisted
- [ ] Integration: Works with backend API
- [ ] Tests: All frontend tests passing

**Checkpoint**: FASE 5 complete - Frontend widget working, user can send/receive messages

---

## Phase 8: Integration & Testing (Priority: P1)

**Goal**: Complete end-to-end testing and production readiness

**Independent Test**: `npm run test:integration` → all integration tests passing

### Tests for Integration Phase (WRITE THESE FIRST)

- [ ] T075 [P] **[Tests/E2E]** Create end-to-end tests: `apps/backend/__tests__/integration/widget-whatsapp-unified.test.ts`
  - Scenario 1: Widget message → Security check → Response ready → Polling receives it
  - Scenario 2: WhatsApp message → Security check → Response sent → API webhook
  - Scenario 3: Both channels simultaneously → No interference
  - Scenario 4: Rate limiting blocks 11th widget message
  - Scenario 5: Security check blocks unsafe content
  - Scenario 6: Timeout: widget message not responded within 30s → error

### Implementation for Integration Phase

- [ ] T076 **[Tests/Integration]** Run all integration tests: `npm run test:integration`
  - Database tests: Migration, backward compatibility
  - API tests: Widget endpoints, WhatsApp endpoints
  - Service tests: Security, delivery, status management
  - Scheduler tests: Message processor, timeout, cleanup
  - Frontend tests: Widget component, polling
  - E2E tests: Full flows
- [ ] T077 **[Tests/Performance]** Performance baseline: `apps/backend/__tests__/performance/widget-performance.test.ts`
  - Widget message response time < 500ms (before LLM)
  - Polling request response time < 100ms
  - Queue processing latency < 5 seconds
  - Load test: 100 concurrent widget messages
- [ ] T078 **[Tests/Security]** Security validation: `npm run test:security`
  - Widget authentication working
  - Rate limiting enforced
  - Workspace isolation verified
  - No data leakage between workspaces
- [ ] T079 **[Tests/Concurrency]** Concurrent message handling: `apps/backend/__tests__/integration/concurrency/widget-concurrency.test.ts`
  - Same visitorId sending 10 concurrent messages
  - Database transactions handle correctly
  - No message loss
  - Status updates atomic
- [ ] T080 [P] **[Documentation]** Update API documentation: `docs/api/widget-endpoints.md`
  - POST /api/v1/widget/chat/:workspaceId
  - GET /api/v1/widget/poll/:messageId
  - POST /api/v1/widget/auth
  - Request/response examples
  - Error codes
  - Rate limits
- [ ] T081 [P] **[Documentation]** Update architecture documentation: `docs/architecture/widget-unification.md`
  - System diagram (ASCII or Mermaid)
  - Message flow (Widget vs WhatsApp)
  - Database schema changes
  - Security checks (5 steps)
  - Scheduler jobs
  - Monitoring & alerts
- [ ] T082 [P] **[Documentation]** Create operations guide: `docs/operations/widget-operations.md`
  - Deployment steps
  - Rollback procedure
  - Monitoring metrics
  - Troubleshooting guide
  - Runbooks for on-call
- [ ] T083 **[Deployment]** Create deployment checklist: `docs/deployment/widget-unification-checklist.md`
  - Pre-deployment: backup DB, verify tests, notify team
  - Deployment: run migration, deploy scheduler, deploy API, deploy frontend
  - Post-deployment: monitor metrics, verify both channels work, customer validation
  - Rollback: restore DB, redeploy previous version

### Validation Criteria

- [ ] All tests passing (unit + integration + security + performance)
- [ ] Swagger documentation updated and accurate
- [ ] No regressions: WhatsApp still works unchanged
- [ ] Performance baselines met: response times < limits
- [ ] Security checks applied to both channels
- [ ] Rate limiting working per visitorId
- [ ] Concurrent requests handled safely
- [ ] Database backward compatible
- [ ] Monitoring and alerts configured
- [ ] Team trained on new architecture

**Checkpoint**: Integration complete - Ready for production deployment

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and cleanup

- [ ] T084 [P] Code cleanup: `apps/backend/src/` and `apps/frontend/src/`
  - Remove unused imports
  - Remove dead code
  - Extract duplicated logic to utilities
  - Verify no files > 500 lines
- [ ] T085 [P] **[Cleanup]** Remove temporary files
  - Delete `*.backup`, `*.old`, `*.tmp`, `temp.*`, `test-*.js` files
  - Verify `.gitignore` updated
- [ ] T086 [P] **[Cleanup]** Run linting: `npm run lint` in all workspaces
  - Fix all linting errors
  - Ensure consistent code style
- [ ] T087 **[Refactoring]** Refactor for performance
  - Database query optimization (add indexes if needed)
  - Caching where appropriate (Redis)
  - Async processing where blocking
- [ ] T088 **[Security]** Final security audit
  - Review all endpoints for auth/validation
  - Verify no hardcoded secrets
  - Check for injection vulnerabilities
  - Validate rate limiting effectiveness
- [ ] T089 [P] Final documentation pass
  - Update README with widget feature
  - Update CONTRIBUTING.md with widget development guide
  - Create FAQ for widget feature
  - Add troubleshooting section
- [ ] T090 **[Validation]** Run quickstart.md validation
  - Verify from-scratch setup instructions work
  - Test on clean machine (or container)
  - Document any setup issues
  - Update instructions if needed

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: No dependencies - can start immediately
2. **Foundational (Phase 2)**: Depends on Setup → **BLOCKS all FASE work**
3. **FASE 1-5 (Phases 3-7)**: All depend on Foundational → can proceed in sequence or parallel
4. **Integration (Phase 8)**: Depends on all FASE phases complete
5. **Polish (Phase 9)**: Final cleanup after everything works

### Critical Path

```
Setup → Foundational → FASE 1 → FASE 2 → FASE 3 → FASE 4 → FASE 5 → Integration → Polish
(30 min) (2 hours)   (1 day) (1 day) (1 day) (1 day) (1 day) (1 day)     (1 day)
```

### Parallel Opportunities

**Within Foundational Phase**:
- T006-T010: All database schema changes [P]
- T016-T018: All validation/error/CORS [P]

**Within FASE phases**:
- Tests (T019+) can start while implementation tasks run
- Database tasks before API tasks
- Unit tests before integration tests

**Across FASE phases**:
- FASE 2 (API) and FASE 3 (Services) can start simultaneously (different files)
- FASE 4 (Scheduler) can start after FASE 2 (needs unified queue)
- FASE 5 (Frontend) can start after FASE 2 (needs API endpoints)

**Parallel Team Strategy** (if multiple developers):
1. Developer A: Foundational (database + infrastructure)
2. Developer B: FASE 2-3 (API + Services)
3. Developer C: FASE 4 (Scheduler)
4. Developer D: FASE 5 (Frontend)
5. All together: Integration + Polish

### Execution Examples

**Sequential (1 developer, 7 days)**:
```
Day 1: Setup + Foundational (T001-T037)
Day 2: FASE 1-2 (T020-T050)
Day 3: FASE 3 (T051-T061)
Day 4: FASE 4 (T053-T074)
Day 5: FASE 5 (T064-T090)
Day 6: Integration (T075-T083)
Day 7: Polish (T084-T090)
```

**Parallel (4 developers, 3-4 days)**:
```
Day 1: All start Foundational together (T001-T037)
Day 1 end: Foundation complete - split up
  - Dev A: FASE 1 (T020-T050)
  - Dev B: FASE 2 (T028-T037)
  - Dev C: FASE 3 (T040-T050)
  - Dev D: FASE 4 (T053-T061)
Day 2: Complete FASE 1-4 + start FASE 5
  - All: FASE 5 (T064-T074)
Day 3: Complete FASE 5 + start Integration
  - All: Integration (T075-T083)
Day 4: Complete + Polish (T084-T090)
```

---

## Implementation Strategy

### MVP First (Recommended - Deliver widget in 5-7 days)

1. **Days 1-2**: Setup + Foundational (Foundation complete)
2. **Days 3-5**: FASE 1-5 (Widget fully functional)
3. **Days 6-7**: Integration + Polish (Production ready)

**Stop-Point for Minimal Viable Widget**:
- ✅ Database schema supports widget
- ✅ Widget API endpoints working
- ✅ Backend security checks active
- ✅ Scheduler processes messages
- ✅ Frontend widget sends/receives messages
- ✅ WhatsApp still works unchanged

### Incremental Delivery

Deliver features in this order for maximum value:

1. **Foundation + FASE 1-2** (Days 1-3): Widget can send messages to backend
2. **+ FASE 3** (Day 4): Security validation working
3. **+ FASE 4** (Day 5): Scheduler processes both channels
4. **+ FASE 5** (Day 6): Frontend widget complete
5. **+ Integration** (Day 7): Everything working together
6. **+ Polish** (Day 7): Production ready

---

## Task Checklist for Daily Standup

Use this format for daily progress reports:

```
Standup: [Date] - Widget Unification
✅ Completed: [N tasks]
🔄 In Progress: [Task IDs - e.g., T045, T046]
🚫 Blocked: [if any, explain reason]
📊 Progress: [X/90 tasks = Y%]
🎯 Target for Next: [list tasks]
🔴 Risk: [if any]
```

---

## Notes

- [P] tasks = can run in parallel (different files, no blocking dependencies)
- [Story] label maps task to specific FASE for traceability
- Each FASE should be independently testable and deployable
- **CRITICAL**: Write tests FIRST (T019, T027, T038, T051, T062, T075), ensure they FAIL before implementing
- Commit after each checkpoint
- Stop at any checkpoint to validate independently
- Database migration is critical - test rollback before production

---

## Success Criteria - Production Readiness

- [ ] All 90 tasks completed
- [ ] All tests passing (unit + integration + security + performance)
- [ ] No regressions: WhatsApp API unchanged and working
- [ ] Database migration successful, backward compatible, rollback tested
- [ ] Widget API responding < 500ms
- [ ] Widget polling working with < 100ms latency
- [ ] Rate limiting enforced (10 msg/min per visitorId)
- [ ] Scheduler processing both channels correctly
- [ ] Frontend widget responsive on mobile/desktop
- [ ] Security checks applied to both channels
- [ ] Monitoring metrics tracked and alerting configured
- [ ] Documentation complete and accurate
- [ ] Team trained on new architecture
- [ ] Deployment checklist completed
- [ ] Post-deployment validation successful

---

**Ready to begin?** Start with Phase 1 (Setup) tasks T001-T005, then immediately proceed to Phase 2 (Foundational) tasks T006-T037 which MUST complete before any FASE work begins.

Andrea, pronto a partire? 🚀

