# Implementation Plan: Chatbot Reactivation Notification

**Feature ID**: 127-chatbot-reactivation-notification  
**Plan Version**: 1.0  
**Created**: 2025-11-16

## Architecture Overview

This is a **backend-only bug fix** - the frontend implementation is already complete and working. We need to add the missing `/push/chatbot-reactivated` endpoint to make the existing frontend dialog functional.

### Current State Analysis

**✅ Already Implemented**:

- Frontend dialog in `ChatPage.tsx` (lines 1555-1580)
- Frontend API call to `/workspaces/:workspaceId/push/chatbot-reactivated` (line 624)
- Push message template in `push-messaging.service.ts` (lines 94-101, 6 languages)
- WhatsApp integration working
- Security & Translation Layer working

**❌ Missing**:

- Backend route `/workspaces/:workspaceId/push/chatbot-reactivated`
- Controller method to handle the push notification request

**Root Cause**: Route was never created or was accidentally removed during previous refactoring.

## Implementation Strategy

### Option A: Create Dedicated Push Routes (RECOMMENDED)

Create new `push.routes.ts` and `push.controller.ts` for push notification endpoints. This follows the existing pattern for campaigns and keeps push-related logic isolated.

**Pros**:

- Clean separation of concerns
- Scalable (easy to add more push notification types)
- Follows existing architecture pattern
- Easier to test in isolation

**Cons**:

- Requires creating 2 new files

### Option B: Add to Campaign Routes

Add push notification endpoint to existing `campaign.routes.ts` since campaigns also send push messages.

**Pros**:

- No new files needed
- Campaigns already handle push messages

**Cons**:

- Mixes campaign management with push notifications
- Breaks single responsibility principle
- Confusing semantics (`/campaigns/chatbot-reactivated`?)

**DECISION**: Use **Option A** - Create dedicated push routes.

## Technical Design

### File Structure

```
backend/src/
├── interfaces/http/
│   ├── controllers/
│   │   └── push.controller.ts              (NEW)
│   ├── routes/
│   │   └── push.routes.ts                  (NEW)
│   └── middlewares/                        (EXISTING - no changes)
│       ├── auth.middleware.ts
│       ├── session-validation.middleware.ts
│       └── workspace-validation.middleware.ts
├── services/
│   └── push-messaging.service.ts           (EXISTING - no changes)
└── routes/
    └── index.ts                            (UPDATE - mount push routes)
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Frontend (ChatPage.tsx)                                      │
│    User clicks "Yes, notify user"                               │
│    POST /workspaces/:workspaceId/push/chatbot-reactivated       │
│    Body: { workspaceId, customerIds: [customerId] }             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Middleware Stack                                             │
│    ├── authMiddleware (JWT validation)                          │
│    ├── sessionValidationMiddleware (x-session-id)               │
│    └── workspaceValidationMiddleware (x-workspace-id)           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PushController.sendChatbotReactivated()                      │
│    - Validate request body                                      │
│    - Extract workspaceId and customerIds                        │
│    - Loop through customerIds                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. pushMessagingService.sendPushMessage()                       │
│    - Fetch customer data (name, phone, language)                │
│    - Select template based on customer language                 │
│    - Replace {customerName} variable                            │
│    - Send WhatsApp message via API                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Response                                                     │
│    { success: true, sent: 1, failed: 0, errors: [] }            │
└─────────────────────────────────────────────────────────────────┘
```

### API Contract

**Endpoint**: `POST /api/workspaces/:workspaceId/push/chatbot-reactivated`

**Request**:

```typescript
// Headers
Authorization: Bearer <jwt_token>
x-session-id: <session_id>
x-workspace-id: <workspace_id>

// Body
{
  workspaceId: string,      // UUID (must match param and header)
  customerIds: string[]     // Array of customer UUIDs
}
```

**Response (Success)**:

```typescript
{
  success: true,
  sent: 1,           // Count of notifications sent successfully
  failed: 0,         // Count of failures
  errors: []         // Array of error messages (empty if all succeeded)
}
```

**Response (Partial Success)**:

```typescript
{
  success: true,     // True even if some failed
  sent: 2,
  failed: 1,
  errors: [
    "Customer abc-123: Missing phone number"
  ]
}
```

**Response (Error)**:

```typescript
{
  error: "Invalid request",
  message: "workspaceId and customerIds are required"
}
```

### Controller Implementation

**File**: `backend/src/interfaces/http/controllers/push.controller.ts`

```typescript
import { PrismaClient } from "@prisma/client"
import { Request, Response } from "express"
import logger from "../../../utils/logger"
import { pushMessagingService } from "../../../services/push-messaging.service"
import { PushMessageType } from "../../../services/push-messaging.service"

const prisma = new PrismaClient()

export class PushController {
  /**
   * Send chatbot reactivation notification to customers
   *
   * @route POST /workspaces/:workspaceId/push/chatbot-reactivated
   */
  async sendChatbotReactivated(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params
      const { customerIds } = req.body

      // Validation
      if (!workspaceId || !customerIds || !Array.isArray(customerIds)) {
        return res.status(400).json({
          error: "Invalid request",
          message: "workspaceId and customerIds array are required",
        })
      }

      const results = { sent: 0, failed: 0, errors: [] as string[] }

      // Send notification to each customer
      for (const customerId of customerIds) {
        try {
          // Fetch customer data
          const customer = await prisma.customer.findUnique({
            where: { id: customerId, workspaceId }, // Workspace isolation
            select: {
              id: true,
              phone: true,
              name: true,
              language: true,
            },
          })

          if (!customer) {
            results.failed++
            results.errors.push(`Customer ${customerId}: Not found`)
            continue
          }

          if (!customer.phone) {
            results.failed++
            results.errors.push(
              `Customer ${customer.name}: Missing phone number`
            )
            continue
          }

          // Send push message
          const success = await pushMessagingService.sendPushMessage({
            type: PushMessageType.CHATBOT_REACTIVATED,
            customerId: customer.id,
            customerPhone: customer.phone,
            customerName: customer.name,
            workspaceId,
            variables: {
              customerName: customer.name,
            },
          })

          if (success) {
            results.sent++
          } else {
            results.failed++
            results.errors.push(`Customer ${customer.name}: Failed to send`)
          }
        } catch (error) {
          logger.error(`Error sending notification to ${customerId}:`, error)
          results.failed++
          results.errors.push(`Customer ${customerId}: ${error.message}`)
        }
      }

      // Return results
      return res.status(200).json({
        success: true,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors,
      })
    } catch (error) {
      logger.error("Error in sendChatbotReactivated:", error)
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      })
    }
  }
}
```

### Routes Implementation

**File**: `backend/src/interfaces/http/routes/push.routes.ts`

```typescript
import { Router } from "express"
import { PushController } from "../controllers/push.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { sessionValidationMiddleware } from "../middlewares/session-validation.middleware"
import { validateWorkspaceOperation } from "../middlewares/workspace-validation.middleware"

export const pushRoutes = (controller: PushController): Router => {
  const router = Router()

  // All routes require full auth stack
  router.use(authMiddleware)
  router.use(sessionValidationMiddleware)
  router.use(validateWorkspaceOperation)

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
   *         schema:
   *           type: string
   *       - in: header
   *         name: x-workspace-id
   *         required: true
   *         schema:
   *           type: string
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
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  router.post(
    "/:workspaceId/push/chatbot-reactivated",
    controller.sendChatbotReactivated.bind(controller)
  )

  return router
}
```

### Main Router Update

**File**: `backend/src/routes/index.ts`

Add to imports section:

```typescript
import { PushController } from "../interfaces/http/controllers/push.controller"
import { pushRoutes } from "../interfaces/http/routes/push.routes"
```

Add to controller instantiation section:

```typescript
const pushController = new PushController()
```

Add to route mounting section:

```typescript
// Push Notifications
router.use("/workspaces", pushRoutes(pushController))
```

## Testing Strategy

### Unit Tests

**File**: `backend/__tests__/unit/push.controller.test.ts`

Test cases:

1. ✅ Successfully sends notification to single customer
2. ✅ Successfully sends notifications to multiple customers
3. ✅ Handles customer not found error
4. ✅ Handles missing phone number error
5. ✅ Handles WhatsApp API failure
6. ✅ Returns 400 for invalid request body
7. ✅ Applies workspace isolation (rejects customers from other workspace)
8. ✅ Handles partial success (some succeed, some fail)

### Integration Tests

**File**: `backend/__tests__/integration/push.integration.test.ts`

Test cases:

1. ✅ Full flow: API call → notification sent → WhatsApp message delivered
2. ✅ Middleware stack: JWT + session + workspace validation
3. ✅ Database query filters by workspaceId
4. ✅ Error handling end-to-end

### Manual Testing

1. Start backend: `npm run dev`
2. Start frontend: `npm run dev`
3. Login as admin
4. Go to ChatPage
5. Select a customer with chatbot disabled
6. Click "Enable Chatbot"
7. Click "Yes, notify user"
8. Verify:
   - Success toast appears
   - Backend logs show notification sent
   - Customer receives WhatsApp message in their language

## Security Considerations

### Workspace Isolation

- ALL database queries MUST filter by `workspaceId`
- Middleware stack validates workspace access
- Cannot send notifications to customers from other workspaces

### Authentication

- Requires valid JWT token
- Requires valid session ID
- Requires workspace access permission

### Rate Limiting

- Currently no rate limiting on push endpoints
- **Future enhancement**: Add rate limiter to prevent spam

### Data Validation

- Validate `customerIds` is array
- Validate `workspaceId` is UUID
- Validate customers exist and belong to workspace

## Error Handling

### Expected Errors

1. **Customer not found**: Log warning, skip, continue with others
2. **Missing phone**: Log warning, skip, continue with others
3. **WhatsApp API down**: Log error, mark as failed, continue
4. **Invalid request**: Return 400 immediately
5. **Unauthorized**: Return 401 (middleware handles this)

### Error Response Format

```typescript
{
  success: true,        // Always true if any succeeded
  sent: number,         // Count of successful sends
  failed: number,       // Count of failures
  errors: string[]      // Detailed error messages
}
```

## Performance Considerations

### Expected Load

- Low volume: Typically 1 customer at a time
- Future: May support bulk notifications (multiple customers)

### Optimization Opportunities

1. **Parallel sends**: Use `Promise.all()` instead of sequential loop
2. **Batch fetching**: Fetch all customers in one query
3. **Caching**: Cache customer data for 1 minute

### Current Implementation

- Sequential sends (simple, reliable)
- Individual customer queries
- No caching

**Recommendation**: Start with simple sequential implementation, optimize later if needed.

## Rollout Plan

### Phase 1: Implementation (This PR)

- Create `push.controller.ts`
- Create `push.routes.ts`
- Update `routes/index.ts`
- Add unit tests
- Add integration tests

### Phase 2: Testing

- Run unit tests: `npm run test:unit`
- Run integration tests: `npm run test:integration`
- Manual testing in dev environment

### Phase 3: Deployment

- Merge to main
- Deploy backend
- Verify in production

### Phase 4: Monitoring

- Monitor backend logs for errors
- Check WhatsApp message delivery rate
- Gather feedback from admins

## Rollback Plan

If issues are discovered:

1. Revert commit that added push routes
2. Backend returns 404 (same as before)
3. Frontend handles error gracefully (already implemented)
4. No data loss or corruption

## Dependencies

### External Services

- WhatsApp Business API (already configured)
- OpenRouter API for translation (Security & Translation Layer)

### Internal Services

- `push-messaging.service.ts` (existing, no changes)
- `PrismaClient` for database access
- Middleware stack for auth/session/workspace

### No Breaking Changes

- This is a pure addition (new endpoint)
- No changes to existing code behavior
- Frontend already expects this endpoint

## Success Criteria

### Functional

- [ ] Endpoint `/workspaces/:workspaceId/push/chatbot-reactivated` responds with 200
- [ ] Customer receives WhatsApp message in correct language
- [ ] Message content matches template
- [ ] No duplicate notifications

### Non-Functional

- [ ] Response time < 2 seconds
- [ ] Unit test coverage > 80%
- [ ] Integration tests pass
- [ ] No errors in production logs

### User Experience

- [ ] Admin clicks "Yes, notify user" → success toast
- [ ] Customer receives friendly message
- [ ] Error handling is transparent (doesn't block chatbot enable)

## Open Questions

1. **Rate limiting**: Should we add rate limiting to prevent abuse?

   - **Answer**: Not needed initially, add if abuse is detected

2. **Notification history**: Should we log sent notifications in database?

   - **Answer**: Out of scope for this PR, can add later

3. **Retry logic**: Should we retry failed WhatsApp sends?

   - **Answer**: No, user can manually retry by disabling/enabling again

4. **Batch size**: Maximum customers per request?
   - **Answer**: No limit initially, frontend only sends 1 at a time

---

**Status**: Ready for Task Breakdown
