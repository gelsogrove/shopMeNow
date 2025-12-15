# Implementation Plan - Feature 180: WhatsApp Queue

**Created**: 2025-11-20  
**Estimated Total**: 8-12 hours  
**Priority Order**: P1 → P2 → P3

---

## Phase 1: Database & Backend Foundation (3-4 hours)

### Task 1.1: Database Schema - WhatsApp Queue Table
**Estimated**: 30 min  
**Files**: `backend/prisma/schema.prisma`

**Changes**:
```prisma
model WhatsAppQueue {
  id            String   @id @default(uuid())
  workspaceId   String
  customerId    String
  phoneNumber   String
  messageContent String  @db.Text
  status        String   @default("pending") // pending, sent, error
  errorMessage  String?  @db.Text
  createdAt     DateTime @default(now())
  deliveredAt   DateTime?
  
  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  customer      Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  
  @@index([workspaceId, status])
  @@index([customerId])
  @@map("whatsapp_queue")
}
```

**Actions**:
- [ ] Add WhatsAppQueue model to schema.prisma
- [ ] Add relation to Workspace model: `whatsappQueue WhatsAppQueue[]`
- [ ] Add relation to Customer model: `whatsappQueue WhatsAppQueue[]`
- [ ] Run `npx prisma migrate dev --name add_whatsapp_queue_table`
- [ ] Run `npx prisma generate`

---

### Task 1.2: Database Schema - Add deliveredAt to ConversationMessage
**Estimated**: 15 min  
**Files**: `backend/prisma/schema.prisma`

**Changes**:
```prisma
model ConversationMessage {
  // ... existing fields
  deliveredAt   DateTime? // NEW: Track WhatsApp delivery timestamp
}
```

**Actions**:
- [ ] Add `deliveredAt DateTime?` field to ConversationMessage model
- [ ] Run `npx prisma migrate dev --name add_delivered_at_to_conversation_message`
- [ ] Run `npx prisma generate`

---

### Task 1.3: Seed Data - Add Test Queue Messages
**Estimated**: 20 min  
**Files**: `backend/prisma/seed.ts`

**Actions**:
- [ ] Add 5 test messages to whatsapp_queue for workspace1:
  - 2 pending messages (different customers)
  - 1 sent message (with deliveredAt)
  - 2 error messages (1 "Safety validation failed", 1 "Invalid phone number")
- [ ] Run `npm run seed` to verify
- [ ] Verify in database: `SELECT * FROM whatsapp_queue WHERE workspace_id = 'workspace1-id';`

---

### Task 1.4: Repository - WhatsAppQueueRepository
**Estimated**: 45 min  
**Files**: `backend/src/repositories/whatsapp-queue.repository.ts` (NEW)

**Methods**:
```typescript
export class WhatsAppQueueRepository {
  async findByWorkspace(workspaceId: string, status?: string): Promise<WhatsAppQueue[]>
  async findPending(workspaceId: string, limit: number = 1): Promise<WhatsAppQueue | null>
  async create(data: CreateQueueMessageDto): Promise<WhatsAppQueue>
  async updateStatus(id: string, status: string, error?: string): Promise<void>
  async delete(id: string): Promise<void>
  async checkDuplicate(customerId: string, content: string, withinMinutes: number = 1): Promise<boolean>
}
```

**Actions**:
- [ ] Create repository file with all methods
- [ ] Implement workspace isolation on ALL queries
- [ ] Add deduplication check (customerId + content + timestamp < 1 min)
- [ ] Add pagination support (skip/take parameters)
- [ ] Export from `backend/src/repositories/index.ts`

---

### Task 1.5: Service - WhatsAppQueueService
**Estimated**: 1 hour  
**Files**: `backend/src/services/whatsapp-queue.service.ts` (NEW)

**Methods**:
```typescript
export class WhatsAppQueueService {
  async getQueueStatus(workspaceId: string, status?: string): Promise<WhatsAppQueue[]>
  async enqueue(workspaceId: string, customerId: string, phone: string, message: string): Promise<WhatsAppQueue>
  async processPendingMessages(workspaceId: string): Promise<void>
  async validateAndSend(message: WhatsAppQueue): Promise<{success: boolean, error?: string}>
  async markDelivered(messageId: string, conversationMessageId: string): Promise<void>
}
```

**Actions**:
- [ ] Create service with constructor injection (repository, prisma)
- [ ] Implement `enqueue()` with validation (phone/message/workspaceId required)
- [ ] Implement `getQueueStatus()` with workspace isolation
- [ ] Implement `validateAndSend()` with console.log("SEND MESSAGE WHATSAPP") placeholder
- [ ] Implement `markDelivered()` to update conversationMessage.deliveredAt
- [ ] Add error handling with descriptive messages
- [ ] Export from `backend/src/services/index.ts`

---

### Task 1.6: Controller - WhatsAppQueueController
**Estimated**: 30 min  
**Files**: `backend/src/controllers/whatsapp-queue.controller.ts` (NEW)

**Endpoints**:
```typescript
GET    /api/workspaces/:workspaceId/whatsapp-queue        // Get all queue messages
GET    /api/workspaces/:workspaceId/whatsapp-queue/:id    // Get single message
POST   /api/whatsapp-queue                                // Add to queue (internal only)
DELETE /api/workspaces/:workspaceId/whatsapp-queue/:id    // Delete message
```

**Actions**:
- [ ] Create controller with service injection
- [ ] Implement `getQueueMessages()` - calls service.getQueueStatus()
- [ ] Implement `getQueueMessage()` - get single message by id
- [ ] Implement `deleteQueueMessage()` - remove from queue (operator action)
- [ ] Add JSDoc @swagger comments for all endpoints
- [ ] Extract workspaceId from `(req as any).workspaceId` (set by middleware)
- [ ] Export from `backend/src/controllers/index.ts`

---

### Task 1.7: Routes - WhatsApp Queue Routes
**Estimated**: 20 min  
**Files**: `backend/src/routes/whatsapp-queue.routes.ts` (NEW)

**Actions**:
- [ ] Create routes file with Express router
- [ ] Apply authMiddleware + validateWorkspaceOperation on all GET/DELETE routes
- [ ] Mount routes in `backend/src/routes/index.ts`: `router.use('/whatsapp-queue', whatsappQueueRoutes)`
- [ ] Verify middleware stack order: auth → session → workspace validation → controller

---

### Task 1.8: Swagger Documentation
**Estimated**: 20 min  
**Files**: `backend/src/swagger.yaml`

**Actions**:
- [ ] Add WhatsAppQueue schema definition
- [ ] Document GET /api/workspaces/{workspaceId}/whatsapp-queue endpoint
- [ ] Document DELETE /api/workspaces/{workspaceId}/whatsapp-queue/{id} endpoint
- [ ] Add example responses (200, 401, 403, 404)
- [ ] Run `npm run build` to regenerate swagger.json
- [ ] Verify at http://localhost:3001/api-docs

---

## Phase 2: Cron Job Processor (2-3 hours)

### Task 2.1: Install Cron Dependency
**Estimated**: 5 min  
**Files**: `backend/package.json`

**Actions**:
- [ ] Run `cd backend && npm install node-cron @types/node-cron --save`
- [ ] Verify installation in package.json

---

### Task 2.2: Cron Job Implementation
**Estimated**: 1.5 hours  
**Files**: `backend/src/jobs/whatsapp-queue-processor.job.ts` (NEW)

**Logic**:
```typescript
import cron from 'node-cron'
import { WhatsAppQueueService } from '../services/whatsapp-queue.service'

let isProcessing = false // Cron lock

export function startWhatsAppQueueProcessor() {
  cron.schedule('*/3 * * * * *', async () => { // Every 3 seconds
    if (isProcessing) {
      console.log('[WhatsApp Queue] Skipping - previous job still running')
      return
    }
    
    isProcessing = true
    try {
      // Get all workspaces (or specific workspace if single-tenant)
      const workspaces = await prisma.workspace.findMany({ where: { isActive: true } })
      
      for (const workspace of workspaces) {
        const service = new WhatsAppQueueService()
        await service.processPendingMessages(workspace.id)
      }
    } catch (error) {
      logger.error('[WhatsApp Queue] Cron error:', error)
    } finally {
      isProcessing = false
    }
  })
}
```

**Actions**:
- [ ] Create cron job file with locking mechanism (isProcessing flag)
- [ ] Schedule every 3 seconds: `'*/3 * * * * *'`
- [ ] Process ONE message per workspace per run
- [ ] Call service.processPendingMessages(workspaceId)
- [ ] Log "SEND MESSAGE WHATSAPP" via service.validateAndSend()
- [ ] Handle errors gracefully (catch + log, don't crash)
- [ ] Export startWhatsAppQueueProcessor function

---

### Task 2.3: Integrate Cron in Server Startup
**Estimated**: 15 min  
**Files**: `backend/src/index.ts`

**Actions**:
- [ ] Import `startWhatsAppQueueProcessor` from jobs
- [ ] Call function after server starts: `startWhatsAppQueueProcessor()`
- [ ] Add console.log('[WhatsApp Queue] Cron job started - processing every 3 seconds')
- [ ] Test: Start backend, verify cron logs appear every 3 seconds

---

### Task 2.4: Service processPendingMessages Logic
**Estimated**: 45 min  
**Files**: `backend/src/services/whatsapp-queue.service.ts`

**Logic**:
```typescript
async processPendingMessages(workspaceId: string): Promise<void> {
  const message = await this.repository.findPending(workspaceId, 1)
  if (!message) return
  
  const result = await this.validateAndSend(message)
  
  if (result.success) {
    await this.repository.delete(message.id)
    // Mark delivered in conversation history (if exists)
    const conversationMsg = await prisma.conversationMessage.findFirst({
      where: { customerId: message.customerId, message: message.messageContent }
    })
    if (conversationMsg) {
      await this.markDelivered(message.id, conversationMsg.id)
    }
  } else {
    await this.repository.updateStatus(message.id, 'error', result.error)
  }
}
```

**Actions**:
- [ ] Implement method in WhatsAppQueueService
- [ ] Fetch ONE pending message (FIFO order: oldest first)
- [ ] Call validateAndSend()
- [ ] On success: delete from queue + mark deliveredAt in conversationMessage
- [ ] On error: update status to 'error' with error message
- [ ] Add comprehensive logging (console.log each step)

---

## Phase 3: Frontend Queue UI (2-3 hours)

### Task 3.1: API Service - Queue API Client
**Estimated**: 20 min  
**Files**: `frontend/src/services/queueApi.ts` (NEW)

**Methods**:
```typescript
export const queueApi = {
  async getAll(workspaceId: string): Promise<WhatsAppQueue[]>
  async delete(workspaceId: string, id: string): Promise<void>
}
```

**Actions**:
- [ ] Create API service with axios
- [ ] Implement getAll() - GET /api/workspaces/:workspaceId/whatsapp-queue
- [ ] Implement delete() - DELETE /api/workspaces/:workspaceId/whatsapp-queue/:id
- [ ] Add error handling with toast notifications
- [ ] Export from `frontend/src/services/index.ts`

---

### Task 3.2: Queue Page Component
**Estimated**: 1.5 hours  
**Files**: `frontend/src/pages/QueuePage.tsx` (NEW)

**Features**:
- DataTable with columns: Phone, Message, Timestamp, Status, Error, Actions
- Status badges: pending (yellow), sent (green), error (red)
- Delete button for error messages (red trash icon)
- Auto-refresh every 5 seconds using useEffect + setInterval
- Empty state: "No messages in queue"
- Loading state during fetch

**Actions**:
- [ ] Create QueuePage component
- [ ] Use shadcn/ui DataTable component
- [ ] Add status badge rendering (Badge component with color variants)
- [ ] Implement auto-refresh (useEffect with 5-second interval)
- [ ] Add delete functionality with confirmation dialog
- [ ] Format timestamp (relative time: "2 minutes ago")
- [ ] Truncate long messages (show first 50 chars + "...")
- [ ] Add error tooltip on hover (full error message)

---

### Task 3.3: Add Queue Route
**Estimated**: 10 min  
**Files**: `frontend/src/App.tsx`

**Actions**:
- [ ] Import QueuePage component
- [ ] Add route: `<Route path="/queue" element={<QueuePage />} />`
- [ ] Verify route is protected (inside authenticated routes wrapper)

---

### Task 3.4: Add Queue Menu Item in Sidebar
**Estimated**: 10 min  
**Files**: `frontend/src/components/layout/Sidebar.tsx`

**Actions**:
- [ ] Add menu item in top navigation area (after Dashboard, before Settings)
- [ ] Label: "Queue" 
- [ ] Icon: QueueListIcon or InboxStackIcon from heroicons
- [ ] Link: `/queue`
- [ ] Highlight active when on /queue route

---

## Phase 4: Testing & Validation (2-3 hours)

### Task 4.1: Unit Tests - WhatsAppQueueService
**Estimated**: 1 hour  
**Files**: `backend/__tests__/unit/services/whatsapp-queue.service.spec.ts` (NEW)

**Test Cases** (15 tests):
- **Validation Tests** (4):
  - Rejects enqueue with missing phone number
  - Rejects enqueue with empty message
  - Rejects enqueue with missing workspaceId
  - Accepts valid enqueue with all fields
  
- **Deduplication Tests** (3):
  - Prevents duplicate within 1 minute window
  - Allows same message after 1 minute
  - Different customers can have same message
  
- **Processing Tests** (4):
  - Processes pending messages FIFO order
  - Marks delivered after successful send
  - Deletes from queue after success
  - Updates status to error on failure
  
- **Workspace Isolation Tests** (4):
  - getQueueStatus filters by workspaceId
  - processPendingMessages only processes workspace messages
  - enqueue creates message with correct workspaceId
  - Cannot access other workspace's queue

**Actions**:
- [ ] Create test file with all test cases
- [ ] Mock repository and prisma
- [ ] Verify all 15 tests pass
- [ ] Run `npm run test:unit` to verify

---

### Task 4.2: Security Tests - Workspace Isolation
**Estimated**: 30 min  
**Files**: `backend/__tests__/security/whatsapp-queue.security.spec.ts` (NEW)

**Test Cases** (4 tests):
- GET /queue returns only workspace messages (not other workspaces)
- DELETE /queue/:id fails if message belongs to different workspace
- Middleware rejects requests without workspaceId
- Middleware rejects invalid workspaceId format

**Actions**:
- [ ] Create security test file
- [ ] Mock workspace validation middleware
- [ ] Test cross-workspace access prevention
- [ ] Run `npm run test:security` to verify

---

### Task 4.3: Integration Tests - Queue Flow
**Estimated**: 45 min  
**Files**: `backend/__tests__/integration/whatsapp-queue.integration.spec.ts` (NEW)

**Test Cases** (6 tests):
- POST message to queue → verify in database
- GET /queue → returns queued messages
- Cron processes message → deletes from queue
- Cron marks deliveredAt in conversation history
- Failed validation → stays in queue with error
- DELETE /queue/:id → removes message

**Actions**:
- [ ] Create integration test file
- [ ] Use test database (isolate from dev DB)
- [ ] Seed test data before each test
- [ ] Clean up after each test
- [ ] Run `npm run test:integration` to verify

---

### Task 4.4: Manual Testing Checklist
**Estimated**: 30 min

**Scenarios**:
- [ ] Backend starts → cron logs appear every 3 seconds
- [ ] Navigate to /queue → table loads with test data
- [ ] Add message to queue (via API/seed) → appears in UI within 5 seconds
- [ ] Cron processes message → see "SEND MESSAGE WHATSAPP" in backend logs
- [ ] Message deleted from queue after processing
- [ ] Failed message shows error in queue UI
- [ ] Delete error message from UI → removed from queue
- [ ] Auto-refresh works (add message, wait 5s, see it appear)
- [ ] Verify deliveredAt timestamp in conversation history
- [ ] Test workspace isolation (switch workspace, see different queue)

---

## Phase 5: Documentation & Cleanup (30 min)

### Task 5.1: Update README
**Estimated**: 15 min  
**Files**: `README.md`

**Actions**:
- [ ] Add "WhatsApp Queue" section under Features
- [ ] Document cron job (runs every 3 seconds)
- [ ] Explain queue monitoring UI (/queue route)
- [ ] Note WhatsApp API not yet implemented (console.log placeholder)

---

### Task 5.2: Code Review Checklist
**Estimated**: 15 min

**Verify**:
- [ ] All imports organized (external → internal → middleware → services → controllers)
- [ ] No duplicate code (extract shared logic)
- [ ] No commented-out code
- [ ] All files under 500 lines
- [ ] Workspace isolation on ALL queries
- [ ] 2-layer security (authMiddleware + validateWorkspaceOperation)
- [ ] All tests passing (156 → 171+ tests)
- [ ] Swagger docs updated
- [ ] No temporary files committed

---

## Deployment Checklist

**Before Merging to Main**:
- [ ] All 171+ tests passing (`npm run test:unit && npm run test:security && npm run test:integration`)
- [ ] Backend runs without errors
- [ ] Frontend runs without errors
- [ ] Cron job logs every 3 seconds
- [ ] Queue UI displays correctly
- [ ] Database migration applied
- [ ] Seed data includes queue test messages
- [ ] Swagger docs updated and accessible
- [ ] No console errors in browser
- [ ] No ESLint warnings
- [ ] README updated
- [ ] Andrea approves feature

---

## Estimated Timeline

| Phase | Tasks | Time | Priority |
|-------|-------|------|----------|
| Phase 1: Database & Backend | 8 tasks | 3-4 hours | P1 |
| Phase 2: Cron Processor | 4 tasks | 2-3 hours | P2 |
| Phase 3: Frontend UI | 4 tasks | 2-3 hours | P1 |
| Phase 4: Testing | 4 tasks | 2-3 hours | P3 |
| Phase 5: Documentation | 2 tasks | 30 min | P3 |
| **TOTAL** | **22 tasks** | **8-12 hours** | |

---

## Next Steps

1. **Review Plan**: Andrea, verify implementation plan is correct
2. **Approve or Adjust**: Request changes if needed
3. **Begin Implementation**: Start with Phase 1 (Database + Backend)
4. **Follow 360-Degree Checklists**: Use spec.md validation checklists during implementation
5. **Test Incrementally**: Run tests after each phase
6. **Deploy**: Merge to main after all tests pass

**Ready to start implementation?** 🚀
