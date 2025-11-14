# Feature 126: Challenge Disabled WIP Message Flow - Technical Plan

**Feature Branch**: `126-challenge-disabled-wip`  
**Spec Version**: 1.0.0  
**Plan Version**: 1.0.0  
**Created**: 2025-11-14  
**Author**: AI Coding Agent

---

## 📋 Executive Summary

This plan implements a **priority-based message flow** that intercepts user requests BEFORE LLM processing to deliver immediate, database-driven responses for blocked users and challenge-disabled workspaces.

**Key Innovation**: Security-first routing layer that prevents LLM token waste and ensures instant response for edge cases.

**Flow Priority Order**:
```
Incoming Message
    ↓
[1] Security Layer: Blocked User? → EXIT (410 Gone)
    ↓
[2] Feature Flag Check: Challenge Disabled? → WIP Message (200 OK)
    ↓
[3] Session Check: First Message? → Welcome Message (200 OK)
    ↓
[4] Default: LLM Router Processing
```

---

## 🎯 Objectives

### Primary Goals
1. **P1 - Security**: Block users immediately without LLM processing
2. **P2 - Feature Flag**: Deliver challenge disabled message when workspace WIP
3. **P3 - UX Continuity**: Preserve welcome message for new users
4. **Performance**: Zero LLM tokens for P1/P2/P3 flows

### Success Metrics
- ✅ Blocked users get 410 response in <100ms
- ✅ Challenge disabled message delivered in <200ms
- ✅ Welcome message preserved for first-time users
- ✅ No LLM calls for P1/P2/P3 flows
- ✅ All existing tests pass (regression prevention)

---

## 🏗️ Architecture Overview

### Current State Analysis

**File**: `backend/src/services/llm-router.service.ts`  
**Current Flow** (Line ~1240-1350):
```typescript
async routeMessage(params: RouteMessageParams): Promise<LLMRouterResponse> {
  // 1. Load workspace config
  // 2. Create/find chat session
  // 3. Save user message
  // 4. Determine sub-agent (PRODUCT_SEARCH, CART, etc.)
  // 5. Sub-agent processing
  // 6. Router validation
  // 7. Save assistant response
  // 8. Return response
}
```

**Problem**: No early exit for blocked users or disabled workspaces. LLM processing happens before checks.

### Proposed Architecture

**New Flow** (Lines 1240-1350 refactored):
```typescript
async routeMessage(params: RouteMessageParams): Promise<LLMRouterResponse> {
  // PHASE 1: SECURITY LAYER (NEW - Priority 1)
  const blockedCheck = await this.checkBlockedUser(params.customerId, params.workspaceId)
  if (blockedCheck.isBlocked) {
    throw new BlockedUserError(blockedCheck.reason) // 410 Gone
  }

  // PHASE 2: FEATURE FLAG CHECK (NEW - Priority 2)
  const workspace = await this.loadWorkspaceConfig(params.workspaceId)
  if (workspace.isChallengeDisabled) {
    const wipMessage = await this.getChallengeDisabledMessage(params.workspaceId)
    return this.buildImmediateResponse(wipMessage, 'CHALLENGE_DISABLED')
  }

  // PHASE 3: SESSION INITIALIZATION (Modified - Priority 3)
  const session = await this.findOrCreateSession(params.customerId, params.workspaceId)
  const isFirstMessage = await this.isFirstUserMessage(session.id)
  
  if (isFirstMessage) {
    const welcomeMessage = await this.getWelcomeMessage(params.workspaceId)
    return this.buildImmediateResponse(welcomeMessage, 'WELCOME')
  }

  // PHASE 4: EXISTING LLM FLOW (Unchanged)
  // ... current implementation continues ...
}
```

---

## 📂 File Changes

### 1. **Database Schema** (Priority: CRITICAL)

**File**: `backend/prisma/schema.prisma`

**Changes Required**:
```prisma
model Customer {
  id               String   @id @default(cuid())
  workspaceId      String
  phoneNumber      String
  name             String?
  email            String?
  preferredLanguage String?
  isBlocked        Boolean  @default(false)  // NEW FIELD
  blockedReason    String?                   // NEW FIELD
  blockedAt        DateTime?                 // NEW FIELD
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  workspace        Workspace @relation(fields: [workspaceId], references: [id])
  chatSessions     ChatSession[]
  orders           Order[]

  @@unique([workspaceId, phoneNumber])
  @@index([workspaceId, isBlocked])  // NEW INDEX for fast blocked user lookup
}

model Workspace {
  id                      String   @id @default(cuid())
  name                    String
  phoneNumber             String
  isChallengeDisabled     Boolean  @default(false)  // NEW FIELD
  challengeDisabledMessage String?                  // NEW FIELD
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  // ... existing relations ...
}
```

**Migration Command**:
```bash
npx prisma migrate dev --name add_blocked_user_and_challenge_disabled
```

**Seed Update**: `backend/prisma/seed.ts`
```typescript
// Add blocked user test case
await prisma.customer.create({
  data: {
    workspaceId: workspace1.id,
    phoneNumber: '+393331234567',
    name: 'Blocked Test User',
    isBlocked: true,
    blockedReason: 'Spam detected',
    blockedAt: new Date()
  }
})

// Add challenge disabled workspace test case
await prisma.workspace.create({
  data: {
    name: 'WIP Test Workspace',
    phoneNumber: '+393339999999',
    isChallengeDisabled: true,
    challengeDisabledMessage: 'Siamo in manutenzione. Riprova più tardi.'
  }
})
```

---

### 2. **LLM Router Service** (Priority: CRITICAL)

**File**: `backend/src/services/llm-router.service.ts`

#### 2.1 New Methods (Add after constructor, ~Line 1200)

```typescript
/**
 * PHASE 1: Security Layer - Check if customer is blocked
 */
private async checkBlockedUser(
  customerId: string,
  workspaceId: string
): Promise<{ isBlocked: boolean; reason?: string }> {
  const customer = await this.prisma.customer.findUnique({
    where: {
      workspaceId_phoneNumber: {
        workspaceId,
        phoneNumber: customerId // Assuming customerId is phone number
      }
    },
    select: {
      isBlocked: true,
      blockedReason: true
    }
  })

  if (!customer) {
    return { isBlocked: false }
  }

  return {
    isBlocked: customer.isBlocked,
    reason: customer.blockedReason || undefined
  }
}

/**
 * PHASE 2: Feature Flag Check - Get challenge disabled message from database
 */
private async getChallengeDisabledMessage(workspaceId: string): Promise<string> {
  const workspace = await this.prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { challengeDisabledMessage: true }
  })

  if (!workspace?.challengeDisabledMessage) {
    // Fallback: should never happen if isChallengeDisabled=true
    logger.warn(`Workspace ${workspaceId} has isChallengeDisabled=true but no message set`)
    return 'Il servizio è temporaneamente non disponibile. Riprova più tardi.'
  }

  return workspace.challengeDisabledMessage
}

/**
 * PHASE 3: Session Check - Get welcome message from database
 */
private async getWelcomeMessage(workspaceId: string): Promise<string> {
  const agentConfig = await this.prisma.agentConfig.findFirst({
    where: { workspaceId },
    select: { welcomeMessage: true }
  })

  if (!agentConfig?.welcomeMessage) {
    // Fallback: should never happen, seed should create welcomeMessage
    logger.warn(`Workspace ${workspaceId} has no welcomeMessage in agentConfig`)
    return 'Benvenuto! Come posso aiutarti?'
  }

  return agentConfig.welcomeMessage
}

/**
 * PHASE 3: Check if this is the first user message in session
 */
private async isFirstUserMessage(sessionId: string): Promise<boolean> {
  const messageCount = await this.prisma.chatMessage.count({
    where: {
      sessionId,
      role: 'user'
    }
  })

  return messageCount === 0 // First message if count is 0 (before saving current message)
}

/**
 * Build immediate response for P1/P2/P3 flows (no LLM)
 */
private buildImmediateResponse(
  message: string,
  flowType: 'BLOCKED' | 'CHALLENGE_DISABLED' | 'WELCOME'
): LLMRouterResponse {
  return {
    response: message,
    sessionId: '', // Will be set by caller if needed
    debugInfo: {
      flowType,
      tokensUsed: 0,
      routerDecision: 'IMMEDIATE_RESPONSE',
      timestamp: new Date().toISOString()
    }
  }
}
```

#### 2.2 Modify `routeMessage()` Method (~Line 1240)

**BEFORE** (Current):
```typescript
async routeMessage(params: RouteMessageParams): Promise<LLMRouterResponse> {
  try {
    logger.info(`[LLM Router] Starting message routing for workspace: ${params.workspaceId}`)

    // Load workspace config
    const workspace = await this.loadWorkspaceConfig(params.workspaceId)
    
    // ... rest of implementation
  }
}
```

**AFTER** (Modified):
```typescript
async routeMessage(params: RouteMessageParams): Promise<LLMRouterResponse> {
  try {
    logger.info(`[LLM Router] Starting message routing for workspace: ${params.workspaceId}`)

    // ========== PHASE 1: SECURITY LAYER (Priority 1) ==========
    const blockedCheck = await this.checkBlockedUser(params.customerId, params.workspaceId)
    if (blockedCheck.isBlocked) {
      logger.warn(`[Security] Blocked user attempted access: ${params.customerId}`, {
        reason: blockedCheck.reason
      })
      throw new Error(`BLOCKED_USER: ${blockedCheck.reason || 'Access denied'}`)
    }

    // ========== PHASE 2: FEATURE FLAG CHECK (Priority 2) ==========
    const workspace = await this.loadWorkspaceConfig(params.workspaceId)
    
    if (workspace.isChallengeDisabled) {
      logger.info(`[Challenge Disabled] Workspace in WIP mode: ${params.workspaceId}`)
      const wipMessage = await this.getChallengeDisabledMessage(params.workspaceId)
      
      // Save interaction to database for analytics
      const session = await this.chatSessionService.findOrCreateChatSession(
        params.workspaceId,
        params.customerId
      )
      
      await this.chatMessageService.saveChatMessage({
        sessionId: session.id,
        role: 'user',
        content: params.message,
        agentType: 'CHALLENGE_DISABLED'
      })
      
      await this.chatMessageService.saveChatMessage({
        sessionId: session.id,
        role: 'assistant',
        content: wipMessage,
        agentType: 'CHALLENGE_DISABLED'
      })
      
      const response = this.buildImmediateResponse(wipMessage, 'CHALLENGE_DISABLED')
      response.sessionId = session.id
      return response
    }

    // ========== PHASE 3: SESSION INITIALIZATION (Priority 3) ==========
    const session = await this.chatSessionService.findOrCreateChatSession(
      params.workspaceId,
      params.customerId
    )
    
    const isFirstMessage = await this.isFirstUserMessage(session.id)
    
    if (isFirstMessage) {
      logger.info(`[Welcome Flow] First message for customer: ${params.customerId}`)
      const welcomeMessage = await this.getWelcomeMessage(params.workspaceId)
      
      // Save user message
      await this.chatMessageService.saveChatMessage({
        sessionId: session.id,
        role: 'user',
        content: params.message,
        agentType: 'WELCOME'
      })
      
      // Save welcome response
      await this.chatMessageService.saveChatMessage({
        sessionId: session.id,
        role: 'assistant',
        content: welcomeMessage,
        agentType: 'WELCOME'
      })
      
      const response = this.buildImmediateResponse(welcomeMessage, 'WELCOME')
      response.sessionId = session.id
      return response
    }

    // ========== PHASE 4: EXISTING LLM FLOW (Unchanged) ==========
    // ... existing implementation continues as-is ...
    // (Save user message, determine sub-agent, process, etc.)
  }
}
```

---

### 3. **Error Handling** (Priority: HIGH)

**File**: `backend/src/interfaces/http/middlewares/errorHandler.middleware.ts`

**Add New Error Type**:
```typescript
// Add after existing error types
export class BlockedUserError extends Error {
  statusCode = 410 // Gone
  constructor(message: string) {
    super(message)
    this.name = 'BlockedUserError'
  }
}
```

**Update Error Handler**:
```typescript
// In errorHandler middleware (~Line 50)
if (error.message?.startsWith('BLOCKED_USER:')) {
  return res.status(410).json({
    error: 'User Blocked',
    message: error.message.replace('BLOCKED_USER: ', ''),
    timestamp: new Date().toISOString()
  })
}
```

---

### 4. **WhatsApp Webhook Controller** (Priority: MEDIUM)

**File**: `backend/src/interfaces/http/controllers/whatsapp.controller.ts`

**Modify** `handleIncomingMessage()` method (~Line 80):

```typescript
async handleIncomingMessage(req: Request, res: Response) {
  try {
    const { from, body, workspaceId } = req.body
    
    // ... existing validation ...
    
    try {
      const llmResponse = await this.llmRouterService.routeMessage({
        workspaceId,
        customerId: from,
        message: body.trim()
      })
      
      // Send response via WhatsApp
      await this.whatsappService.sendMessage(from, llmResponse.response)
      
      return res.status(200).json({ 
        success: true,
        flowType: llmResponse.debugInfo?.flowType || 'LLM'
      })
      
    } catch (error) {
      // Handle blocked user error
      if (error.message?.startsWith('BLOCKED_USER:')) {
        logger.warn(`Blocked user attempted message: ${from}`)
        // Do NOT send WhatsApp message to blocked user
        return res.status(410).json({ 
          error: 'User blocked',
          message: 'Access denied'
        })
      }
      
      throw error // Re-throw for generic error handler
    }
    
  } catch (error) {
    logger.error('WhatsApp webhook error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

---

### 5. **Admin UI - Customer Management** (Priority: MEDIUM)

**File**: `frontend/src/pages/Customers.tsx`

**Add Block/Unblock Actions**:
```typescript
// Add to customer table actions column
<DropdownMenuItem
  onClick={() => handleBlockCustomer(customer.id, !customer.isBlocked)}
>
  {customer.isBlocked ? 'Unblock Customer' : 'Block Customer'}
</DropdownMenuItem>
```

**Add Block Dialog**:
```typescript
const [blockDialogOpen, setBlockDialogOpen] = useState(false)
const [blockReason, setBlockReason] = useState('')

async function handleBlockCustomer(customerId: string, block: boolean) {
  if (block) {
    setBlockDialogOpen(true)
    setSelectedCustomerId(customerId)
  } else {
    // Unblock immediately
    await customerApi.unblock(customerId)
    toast.success('Customer unblocked')
    refetch()
  }
}

// Block Dialog Component
<Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
  <DialogContent>
    <DialogTitle>Block Customer</DialogTitle>
    <Input
      placeholder="Reason (optional)"
      value={blockReason}
      onChange={(e) => setBlockReason(e.target.value)}
    />
    <Button onClick={async () => {
      await customerApi.block(selectedCustomerId, blockReason)
      setBlockDialogOpen(false)
      toast.success('Customer blocked')
      refetch()
    }}>
      Confirm Block
    </Button>
  </DialogContent>
</Dialog>
```

---

### 6. **Admin UI - Workspace Settings** (Priority: MEDIUM)

**File**: `frontend/src/pages/WorkspaceSettings.tsx`

**Add Challenge Disabled Section**:
```typescript
// Add after existing workspace settings form
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Challenge Mode</h3>
  
  <div className="flex items-center space-x-2">
    <Switch
      id="challenge-disabled"
      checked={isChallengeDisabled}
      onCheckedChange={setIsChallengeDisabled}
    />
    <Label htmlFor="challenge-disabled">
      Disable Challenge (Work in Progress Mode)
    </Label>
  </div>
  
  {isChallengeDisabled && (
    <Textarea
      placeholder="Message to show when challenge is disabled"
      value={challengeDisabledMessage}
      onChange={(e) => setChallengeDisabledMessage(e.target.value)}
      rows={4}
    />
  )}
  
  <Button onClick={handleSaveWorkspace}>
    Save Settings
  </Button>
</div>
```

---

### 7. **API Endpoints** (Priority: HIGH)

**File**: `backend/src/interfaces/http/routes/customer.routes.ts`

**Add Block/Unblock Routes**:
```typescript
router.post(
  '/workspaces/:workspaceId/customers/:customerId/block',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  customerController.blockCustomer.bind(customerController)
)

router.post(
  '/workspaces/:workspaceId/customers/:customerId/unblock',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  customerController.unblockCustomer.bind(customerController)
)
```

**File**: `backend/src/interfaces/http/controllers/customer.controller.ts`

```typescript
async blockCustomer(req: Request, res: Response) {
  const { customerId } = req.params
  const { reason } = req.body
  const workspaceId = (req as any).workspaceId
  
  await this.prisma.customer.update({
    where: { id: customerId },
    data: {
      isBlocked: true,
      blockedReason: reason || null,
      blockedAt: new Date()
    }
  })
  
  return res.json({ success: true })
}

async unblockCustomer(req: Request, res: Response) {
  const { customerId } = req.params
  
  await this.prisma.customer.update({
    where: { id: customerId },
    data: {
      isBlocked: false,
      blockedReason: null,
      blockedAt: null
    }
  })
  
  return res.json({ success: true })
}
```

---

## 🧪 Testing Strategy (4-Phase TDD)

### Phase 1: Validate Existing Tests ✅
**Goal**: Ensure current behavior stable before changes

**Commands**:
```bash
cd backend
npm run test:unit
npm run test:integration
```

**Expected**:
- All existing tests pass
- No regression in LLM flow tests
- Welcome message tests still valid

**Action if Fails**: Fix existing tests BEFORE proceeding to Phase 2

---

### Phase 2: Write New Unit Tests ✅
**File**: `backend/__tests__/unit/llm-router-priority-flow.test.ts`

```typescript
describe('LLM Router - Priority Flow', () => {
  describe('PHASE 1: Blocked User Security', () => {
    it('should return 410 for blocked user', async () => {
      // Setup: Create blocked customer
      await prisma.customer.create({
        data: {
          workspaceId: testWorkspace.id,
          phoneNumber: '+393331111111',
          isBlocked: true,
          blockedReason: 'Spam'
        }
      })
      
      // Act & Assert
      await expect(
        llmRouterService.routeMessage({
          workspaceId: testWorkspace.id,
          customerId: '+393331111111',
          message: 'Hello'
        })
      ).rejects.toThrow('BLOCKED_USER')
    })
    
    it('should NOT call LLM for blocked user', async () => {
      const llmSpy = jest.spyOn(llmService, 'chat')
      
      // ... trigger blocked user flow ...
      
      expect(llmSpy).not.toHaveBeenCalled()
    })
  })
  
  describe('PHASE 2: Challenge Disabled Feature Flag', () => {
    it('should return WIP message when isChallengeDisabled=true', async () => {
      // Setup
      await prisma.workspace.update({
        where: { id: testWorkspace.id },
        data: {
          isChallengeDisabled: true,
          challengeDisabledMessage: 'Siamo in manutenzione'
        }
      })
      
      // Act
      const response = await llmRouterService.routeMessage({
        workspaceId: testWorkspace.id,
        customerId: '+393332222222',
        message: 'Ciao'
      })
      
      // Assert
      expect(response.response).toBe('Siamo in manutenzione')
      expect(response.debugInfo.flowType).toBe('CHALLENGE_DISABLED')
      expect(response.debugInfo.tokensUsed).toBe(0)
    })
    
    it('should save messages to database for analytics', async () => {
      // ... trigger challenge disabled flow ...
      
      const messages = await prisma.chatMessage.findMany({
        where: { sessionId: response.sessionId }
      })
      
      expect(messages).toHaveLength(2) // user + assistant
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
      expect(messages[1].agentType).toBe('CHALLENGE_DISABLED')
    })
  })
  
  describe('PHASE 3: Welcome Message Preservation', () => {
    it('should return welcome message for first user message', async () => {
      // Act
      const response = await llmRouterService.routeMessage({
        workspaceId: testWorkspace.id,
        customerId: '+393333333333',
        message: 'Prima volta'
      })
      
      // Assert
      expect(response.debugInfo.flowType).toBe('WELCOME')
      expect(response.debugInfo.tokensUsed).toBe(0)
    })
    
    it('should NOT return welcome for second message', async () => {
      // Setup: send first message
      await llmRouterService.routeMessage({...})
      
      // Act: send second message
      const response = await llmRouterService.routeMessage({...})
      
      // Assert
      expect(response.debugInfo.flowType).not.toBe('WELCOME')
      // Should go to LLM flow
    })
  })
  
  describe('PHASE 4: Flow Priority Order', () => {
    it('should prioritize BLOCKED over CHALLENGE_DISABLED', async () => {
      // Setup: blocked user + challenge disabled workspace
      await prisma.customer.update({
        where: { id: customer.id },
        data: { isBlocked: true }
      })
      await prisma.workspace.update({
        where: { id: testWorkspace.id },
        data: { isChallengeDisabled: true }
      })
      
      // Act & Assert
      await expect(
        llmRouterService.routeMessage({...})
      ).rejects.toThrow('BLOCKED_USER') // Not WIP message
    })
    
    it('should prioritize CHALLENGE_DISABLED over WELCOME', async () => {
      // Setup: first-time user + challenge disabled
      await prisma.workspace.update({
        where: { id: testWorkspace.id },
        data: { isChallengeDisabled: true }
      })
      
      // Act
      const response = await llmRouterService.routeMessage({
        workspaceId: testWorkspace.id,
        customerId: '+393334444444', // New customer
        message: 'Ciao'
      })
      
      // Assert
      expect(response.debugInfo.flowType).toBe('CHALLENGE_DISABLED')
      // NOT 'WELCOME'
    })
  })
})
```

**Run Tests** (should FAIL initially):
```bash
npm run test:unit -- llm-router-priority-flow.test.ts
```

---

### Phase 3: Implementation ✅
**Execute file changes from Section "📂 File Changes"**

**Verification**:
```bash
# 1. Database migration
npx prisma migrate dev --name add_blocked_user_and_challenge_disabled

# 2. Generate Prisma client
npx prisma generate

# 3. Update seed
npm run seed

# 4. Compile TypeScript
npm run build

# 5. Run unit tests (should PASS now)
npm run test:unit -- llm-router-priority-flow.test.ts
```

---

### Phase 4: Final Validation ✅
**Integration Tests**: `backend/__tests__/integration/priority-flow-e2e.test.ts`

```typescript
describe('Priority Flow - End to End', () => {
  it('should handle blocked user via WhatsApp webhook', async () => {
    // Setup: blocked customer
    const customer = await prisma.customer.create({
      data: {
        workspaceId: testWorkspace.id,
        phoneNumber: '+393335555555',
        isBlocked: true
      }
    })
    
    // Act: POST to WhatsApp webhook
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send({
        from: '+393335555555',
        body: 'Ciao',
        workspaceId: testWorkspace.id
      })
    
    // Assert
    expect(response.status).toBe(410)
    expect(response.body.error).toContain('blocked')
  })
  
  it('should handle challenge disabled workspace', async () => {
    // Setup
    await prisma.workspace.update({
      where: { id: testWorkspace.id },
      data: {
        isChallengeDisabled: true,
        challengeDisabledMessage: 'WIP Test Message'
      }
    })
    
    // Act
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send({
        from: '+393336666666',
        body: 'Ordine?',
        workspaceId: testWorkspace.id
      })
    
    // Assert
    expect(response.status).toBe(200)
    expect(response.body.flowType).toBe('CHALLENGE_DISABLED')
  })
  
  it('should preserve normal LLM flow when all flags false', async () => {
    // Setup: normal workspace, unblocked customer, not first message
    const session = await createTestSession()
    await createTestMessage(session.id, 'user', 'Previous message')
    
    // Act
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send({
        from: testCustomer.phoneNumber,
        body: 'Show products',
        workspaceId: testWorkspace.id
      })
    
    // Assert
    expect(response.status).toBe(200)
    expect(response.body.flowType).toBe('LLM')
  })
})
```

**Performance Tests**: Verify <200ms response time for P1/P2/P3

```bash
npm run test:integration
```

---

## 📊 Migration Plan

### Pre-Deployment Checklist
- [ ] Database backup: `npx ts-node scripts/export-workspace-backup.ts {workspaceId}`
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Verify seed update: `npm run seed` (in staging)
- [ ] All tests pass: `npm run test:unit && npm run test:integration`

### Deployment Steps
1. **Database Migration** (CRITICAL - do first)
   ```bash
   npx prisma migrate deploy
   ```

2. **Backend Deployment**
   ```bash
   npm run build
   pm2 restart backend
   ```

3. **Frontend Deployment**
   ```bash
   npm run build
   # Deploy frontend build
   ```

### Rollback Plan
If issues occur:
```bash
# 1. Revert database migration
npx prisma migrate resolve --rolled-back {migration_name}

# 2. Restore code from previous commit
git revert HEAD

# 3. Redeploy previous version
pm2 restart backend
```

---

## 🔍 Monitoring & Observability

### Key Metrics to Track
1. **Blocked User Attempts**: Count of 410 responses
2. **Challenge Disabled Hits**: Count of CHALLENGE_DISABLED flow
3. **Welcome Message Delivery**: Count of WELCOME flow
4. **LLM Token Savings**: Difference in token usage before/after

### Logging Requirements
```typescript
// Add structured logging
logger.info('[Priority Flow]', {
  flowType: 'BLOCKED' | 'CHALLENGE_DISABLED' | 'WELCOME' | 'LLM',
  customerId,
  workspaceId,
  timestamp,
  responseTime
})
```

### Dashboard Queries (Analytics)
```sql
-- Count flow types per workspace
SELECT 
  w.name,
  cm.agentType,
  COUNT(*) as message_count
FROM ChatMessage cm
JOIN ChatSession cs ON cm.sessionId = cs.id
JOIN Workspace w ON cs.workspaceId = w.id
WHERE cm.agentType IN ('BLOCKED', 'CHALLENGE_DISABLED', 'WELCOME')
GROUP BY w.id, cm.agentType
ORDER BY message_count DESC;

-- Calculate token savings
SELECT 
  workspaceId,
  COUNT(*) * 500 as estimated_tokens_saved
FROM ChatMessage
WHERE agentType IN ('CHALLENGE_DISABLED', 'WELCOME')
  AND createdAt >= NOW() - INTERVAL '30 days';
```

---

## 🚀 Success Criteria Validation

### Automated Tests
- ✅ Unit tests: 100% coverage for new methods
- ✅ Integration tests: E2E flow validation
- ✅ Security tests: Blocked user cannot bypass

### Manual Tests
- [ ] Block customer via Admin UI → WhatsApp message returns 410
- [ ] Enable challenge disabled → All customers get WIP message
- [ ] New customer first message → Welcome message delivered
- [ ] Existing customer → LLM flow works as before

### Performance Benchmarks
- [ ] Blocked user response: <100ms
- [ ] Challenge disabled response: <200ms
- [ ] Welcome message response: <200ms
- [ ] No LLM calls for P1/P2/P3 flows (verify logs)

---

## 📚 Documentation Updates

### Files to Update
1. **Architecture Diagram**: `docs/architecture/MULTI_AGENT_FLOW.md`
   - Add priority flow diagram
   - Document new security layer

2. **API Documentation**: `backend/src/swagger.yaml`
   - Document block/unblock endpoints
   - Add 410 response code documentation

3. **Admin Guide**: `docs/admin/CUSTOMER_MANAGEMENT.md`
   - How to block/unblock customers
   - How to enable challenge disabled mode

---

## 🎯 Next Steps After Plan Approval

1. **Run**: `/speckit.tasks` → Generate task breakdown
2. **Phase 1**: Validate existing tests (ensure stability)
3. **Phase 2**: Write unit tests (TDD approach)
4. **Phase 3**: Implement feature (file changes)
5. **Phase 4**: Integration tests + manual validation
6. **Completion**: Update documentation, commit

---

**Plan Ready for Review** ✅  
**Estimated Effort**: 8-12 hours (with testing)  
**Risk Level**: Medium (touches critical LLM flow)  
**Dependencies**: None (self-contained feature)
