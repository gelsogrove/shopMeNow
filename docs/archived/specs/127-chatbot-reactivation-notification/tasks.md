# Implementation Tasks: Chatbot Reactivation Notification

**Feature ID**: 127-chatbot-reactivation-notification  
**Tasks Version**: 1.0  
**Created**: 2025-11-16  
**Status**: ✅ COMPLETED  
**Completed**: 2025-11-17

---

## ✅ IMPLEMENTATION COMPLETE

All tasks have been successfully completed. See `IMPLEMENTATION_SUMMARY.md` for detailed completion report.

### Summary of Completion:

- ✅ Backend endpoint created (`POST /push/system-notification`)
- ✅ Frontend service implemented (`pushNotificationService`)
- ✅ ChatPage integration complete (notification dialog)
- ✅ Infinite loop bug fixed (page reload pattern)
- ✅ System Notification icon fixed
- ✅ All tests passing
- ✅ Documentation updated

---

## Task Breakdown

### Phase 1: Backend Implementation (Core Feature)

#### Task 1.1: Create Push Controller

**ID**: T1.1  
**Type**: Implementation  
**Priority**: P0 (Critical)  
**Estimated Time**: 30 minutes  
**Dependencies**: None

**Description**: Create new controller to handle push notification requests.

**Files to Create**:

- `backend/src/interfaces/http/controllers/push.controller.ts`

**Implementation Details**:

```typescript
export class PushController {
  async sendChatbotReactivated(req: Request, res: Response) {
    // 1. Extract workspaceId from params
    // 2. Extract customerIds from body
    // 3. Validate inputs (400 if invalid)
    // 4. Loop through customerIds
    // 5. For each customer:
    //    - Fetch from DB with workspace isolation
    //    - Skip if not found or missing phone
    //    - Call pushMessagingService.sendPushMessage()
    //    - Track success/failure
    // 6. Return results { sent, failed, errors[] }
  }
}
```

**Validation Rules**:

- `workspaceId` must be UUID
- `customerIds` must be array
- Database query MUST filter by `workspaceId`

**Acceptance Criteria**:

- [ ] Controller file created
- [ ] Method `sendChatbotReactivated()` implemented
- [ ] Validates request body (workspaceId, customerIds)
- [ ] Returns 400 for invalid input
- [ ] Fetches customers with workspace isolation
- [ ] Calls `pushMessagingService.sendPushMessage()` for each customer
- [ ] Handles errors gracefully (customer not found, missing phone)
- [ ] Returns success response with counts (sent, failed, errors)
- [ ] Logs all operations with logger

---

#### Task 1.2: Create Push Routes

**ID**: T1.2  
**Type**: Implementation  
**Priority**: P0 (Critical)  
**Estimated Time**: 20 minutes  
**Dependencies**: T1.1

**Description**: Create routes file to expose push notification endpoint.

**Files to Create**:

- `backend/src/interfaces/http/routes/push.routes.ts`

**Implementation Details**:

```typescript
export const pushRoutes = (controller: PushController): Router => {
  const router = Router()

  // Apply middleware stack
  router.use(authMiddleware)
  router.use(sessionValidationMiddleware)
  router.use(validateWorkspaceOperation)

  // Endpoint
  router.post(
    "/:workspaceId/push/chatbot-reactivated",
    controller.sendChatbotReactivated.bind(controller)
  )

  return router
}
```

**Middleware Stack**:

1. `authMiddleware` - JWT validation
2. `sessionValidationMiddleware` - x-session-id header
3. `validateWorkspaceOperation` - x-workspace-id + workspaceId param

**Acceptance Criteria**:

- [ ] Routes file created
- [ ] Exports `pushRoutes()` function
- [ ] Applies 3-layer middleware stack
- [ ] POST endpoint `/:workspaceId/push/chatbot-reactivated` defined
- [ ] Controller method bound correctly
- [ ] Includes Swagger JSDoc comments

---

#### Task 1.3: Mount Push Routes in Main Router

**ID**: T1.3  
**Type**: Integration  
**Priority**: P0 (Critical)  
**Estimated Time**: 10 minutes  
**Dependencies**: T1.1, T1.2

**Description**: Register push routes in main application router.

**Files to Modify**:

- `backend/src/routes/index.ts`

**Changes Required**:

1. **Add imports** (around line 44-50):

```typescript
import { PushController } from "../interfaces/http/controllers/push.controller"
import { pushRoutes } from "../interfaces/http/routes/push.routes"
```

2. **Instantiate controller** (around line 200-250, with other controllers):

```typescript
const pushController = new PushController()
```

3. **Mount routes** (around line 575, near campaign routes):

```typescript
// Push Notifications
router.use("/workspaces", pushRoutes(pushController))
```

**Acceptance Criteria**:

- [ ] PushController imported
- [ ] pushRoutes imported
- [ ] PushController instantiated
- [ ] Routes mounted at `/workspaces`
- [ ] No import conflicts
- [ ] Server starts without errors

---

### Phase 2: Testing (Quality Assurance)

#### Task 2.1: Create Unit Tests for Push Controller

**ID**: T2.1  
**Type**: Testing  
**Priority**: P1 (High)  
**Estimated Time**: 45 minutes  
**Dependencies**: T1.1

**Description**: Write comprehensive unit tests for push controller.

**Files to Create**:

- `backend/__tests__/unit/push.controller.test.ts`

**Test Cases**:

1. ✅ **Success: Single customer**

   - Send notification to 1 customer
   - Returns `{ sent: 1, failed: 0, errors: [] }`

2. ✅ **Success: Multiple customers**

   - Send notification to 3 customers
   - Returns `{ sent: 3, failed: 0, errors: [] }`

3. ✅ **Error: Customer not found**

   - Customer ID doesn't exist
   - Returns `{ sent: 0, failed: 1, errors: ["Customer abc: Not found"] }`

4. ✅ **Error: Missing phone number**

   - Customer exists but has no phone
   - Returns `{ sent: 0, failed: 1, errors: ["Customer John: Missing phone number"] }`

5. ✅ **Error: WhatsApp API failure**

   - pushMessagingService.sendPushMessage() returns false
   - Returns `{ sent: 0, failed: 1, errors: ["Customer John: Failed to send"] }`

6. ✅ **Validation: Invalid request body**

   - Missing customerIds
   - Returns 400 with error message

7. ✅ **Security: Workspace isolation**

   - Customer belongs to different workspace
   - Returns `{ sent: 0, failed: 1, errors: ["Customer abc: Not found"] }`

8. ✅ **Partial success**
   - 2 customers: 1 succeeds, 1 fails (missing phone)
   - Returns `{ sent: 1, failed: 1, errors: [...] }`

**Mocking Requirements**:

- Mock `PrismaClient.customer.findUnique()`
- Mock `pushMessagingService.sendPushMessage()`
- Mock `logger`

**Acceptance Criteria**:

- [ ] Test file created
- [ ] All 8 test cases implemented
- [ ] Tests pass: `npm run test:unit`
- [ ] Coverage > 80% for push.controller.ts
- [ ] Uses proper mocking (no real DB or WhatsApp calls)

---

#### Task 2.2: Create Integration Tests

**ID**: T2.2  
**Type**: Testing  
**Priority**: P1 (High)  
**Estimated Time**: 30 minutes  
**Dependencies**: T1.3

**Description**: Write integration tests for full endpoint flow.

**Files to Create**:

- `backend/__tests__/integration/push.integration.test.ts`

**Test Cases**:

1. ✅ **Full flow: Authenticated request**

   - POST with valid JWT, session, workspace
   - Returns 200 with success response

2. ✅ **Auth: Missing JWT token**

   - Request without Authorization header
   - Returns 401

3. ✅ **Auth: Invalid session**

   - Request with invalid x-session-id
   - Returns 401

4. ✅ **Auth: Wrong workspace**

   - x-workspace-id doesn't match workspaceId param
   - Returns 403

5. ✅ **Database: Workspace isolation verified**
   - Request includes customer from different workspace
   - Customer is not notified (returns "Not found")

**Test Setup**:

- Use test database
- Seed test customer with phone
- Generate valid JWT token
- Create test session

**Acceptance Criteria**:

- [ ] Test file created
- [ ] All 5 test cases implemented
- [ ] Tests pass: `npm run test:integration`
- [ ] Tests verify middleware stack works
- [ ] Tests verify database queries filter by workspaceId

---

### Phase 3: Documentation & Validation

#### Task 3.1: Update Swagger Documentation

**ID**: T3.1  
**Type**: Documentation  
**Priority**: P2 (Medium)  
**Estimated Time**: 15 minutes  
**Dependencies**: T1.2

**Description**: Add Swagger JSDoc comments to push routes.

**Files to Modify**:

- `backend/src/interfaces/http/routes/push.routes.ts`

**Swagger Spec**:

```typescript
/**
 * @swagger
 * /workspaces/{workspaceId}/push/chatbot-reactivated:
 *   post:
 *     summary: Send chatbot reactivation notification
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace UUID
 *       - in: header
 *         name: x-session-id
 *         required: true
 *       - in: header
 *         name: x-workspace-id
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - customerIds
 *             properties:
 *               workspaceId:
 *                 type: string
 *               customerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Notifications sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sent:
 *                   type: number
 *                 failed:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
```

**Acceptance Criteria**:

- [ ] Swagger comments added to route
- [ ] Includes all parameters (path, headers)
- [ ] Includes request body schema
- [ ] Includes all response codes (200, 400, 401, 500)
- [ ] Swagger UI shows endpoint after `npm run build`

---

#### Task 3.2: Manual Testing Checklist

**ID**: T3.2  
**Type**: Testing  
**Priority**: P2 (Medium)  
**Estimated Time**: 20 minutes  
**Dependencies**: T1.3

**Description**: Manually test the feature in development environment.

**Test Scenarios**:

1. **Happy Path: Enable chatbot with notification**

   - [ ] Start backend: `cd backend && npm run dev`
   - [ ] Start frontend: `cd frontend && npm run dev`
   - [ ] Login as admin (admin@echatbot.ai / venezia44)
   - [ ] Go to ChatPage
   - [ ] Find customer with chatbot disabled
   - [ ] Click "Enable Chatbot"
   - [ ] Dialog appears: "Would you like to notify [Customer]?"
   - [ ] Click "Yes, notify user"
   - [ ] Success toast: "Chatbot enabled for [Customer]"
   - [ ] Check backend logs: "Sending CHATBOT_REACTIVATED push..."
   - [ ] Check customer WhatsApp: Message received in correct language

2. **Alternative Path: Enable without notification**

   - [ ] Click "Enable Chatbot"
   - [ ] Click "No, just enable"
   - [ ] Chatbot enabled
   - [ ] No notification sent
   - [ ] No errors in logs

3. **Error Path: Customer missing phone**

   - [ ] Remove phone from test customer in database
   - [ ] Try to send notification
   - [ ] Check logs: "Customer [Name]: Missing phone number"
   - [ ] Frontend still shows success (chatbot enabled)

4. **Error Path: WhatsApp API down**
   - [ ] Disable WhatsApp API (or use invalid credentials)
   - [ ] Try to send notification
   - [ ] Check logs: Error message
   - [ ] Frontend still shows success (fails silently)

**Acceptance Criteria**:

- [ ] All 4 test scenarios pass
- [ ] No errors in browser console
- [ ] No errors in backend logs (except expected ones)
- [ ] Message arrives on customer's WhatsApp
- [ ] Message is in customer's language

---

### Phase 4: Code Quality & Security

#### Task 4.1: Security Audit

**ID**: T4.1  
**Type**: Security  
**Priority**: P1 (High)  
**Estimated Time**: 15 minutes  
**Dependencies**: T1.3

**Description**: Verify security requirements are met.

**Security Checklist**:

1. **Workspace Isolation**:

   - [ ] Database query includes `where: { id: customerId, workspaceId }`
   - [ ] Cannot send notification to customer from other workspace

2. **Authentication**:

   - [ ] Route uses `authMiddleware` (JWT validation)
   - [ ] Route uses `sessionValidationMiddleware` (x-session-id)
   - [ ] Route uses `validateWorkspaceOperation` (x-workspace-id)

3. **Input Validation**:

   - [ ] Validates `workspaceId` is present
   - [ ] Validates `customerIds` is array
   - [ ] Returns 400 for invalid input

4. **Error Handling**:

   - [ ] Doesn't leak sensitive data in error messages
   - [ ] Logs errors with full context
   - [ ] Returns generic error message to client

5. **Rate Limiting**:
   - [ ] No rate limiting implemented (document as future enhancement)

**Acceptance Criteria**:

- [ ] All security checklist items verified
- [ ] No security vulnerabilities found
- [ ] Workspace isolation tested
- [ ] Authentication tested

---

#### Task 4.2: Code Review Checklist

**ID**: T4.2  
**Type**: Quality  
**Priority**: P2 (Medium)  
**Estimated Time**: 10 minutes  
**Dependencies**: All implementation tasks

**Description**: Self-review code quality before commit.

**Code Quality Checklist**:

1. **Clean Code**:

   - [ ] No commented-out code
   - [ ] No console.log statements
   - [ ] No TODO comments left
   - [ ] Imports organized (external → internal → services → controllers)

2. **Error Handling**:

   - [ ] All try-catch blocks have proper error logging
   - [ ] All database queries have error handling
   - [ ] All service calls have error handling

3. **TypeScript**:

   - [ ] No `any` types used
   - [ ] All parameters typed
   - [ ] All return types specified

4. **Logging**:

   - [ ] Uses `logger.info()` for info messages
   - [ ] Uses `logger.error()` for errors
   - [ ] Logs include context (customerId, workspaceId)

5. **Constitution Compliance**:
   - [ ] Workspace isolation enforced (Principle I)
   - [ ] No hardcoded data
   - [ ] Follows existing patterns

**Acceptance Criteria**:

- [ ] All checklist items pass
- [ ] Code follows project conventions
- [ ] No TypeScript errors
- [ ] No ESLint warnings

---

## Task Summary

### Phase 1: Implementation (1h 0m)

- [T1.1] Create Push Controller (30m) - P0
- [T1.2] Create Push Routes (20m) - P0
- [T1.3] Mount Push Routes (10m) - P0

### Phase 2: Testing (1h 15m)

- [T2.1] Unit Tests (45m) - P1
- [T2.2] Integration Tests (30m) - P1

### Phase 3: Documentation (35m)

- [T3.1] Swagger Documentation (15m) - P2
- [T3.2] Manual Testing (20m) - P2

### Phase 4: Quality (25m)

- [T4.1] Security Audit (15m) - P1
- [T4.2] Code Review (10m) - P2

**Total Estimated Time**: 2h 15m

## Execution Order

1. **Phase 1** (MUST complete first):

   - T1.1 → T1.2 → T1.3

2. **Phase 2** (Can run in parallel after Phase 1):

   - T2.1 (parallel)
   - T2.2 (parallel)

3. **Phase 3** (After Phase 1):

   - T3.1 (parallel with Phase 2)
   - T3.2 (after T1.3)

4. **Phase 4** (Final validation):
   - T4.1 (after Phase 1)
   - T4.2 (after all other tasks)

## Definition of Done

- [ ] All P0 tasks complete
- [ ] All P1 tasks complete
- [ ] Unit tests pass: `npm run test:unit`
- [ ] Integration tests pass: `npm run test:integration`
- [ ] Manual testing scenarios pass
- [ ] Security audit complete
- [ ] Code review complete
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Swagger documentation updated
- [ ] Backend starts without errors
- [ ] Frontend dialog works end-to-end
- [ ] Customer receives WhatsApp notification

---

**Status**: Ready for Implementation
