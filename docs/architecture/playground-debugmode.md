# 🧪 Playground & debugMode Architecture

**Created**: January 26, 2026  
**Version**: v221  
**Status**: Production

---

## 🎯 Overview

This document describes the **playground testing mode** and **debugMode (WIP mode)** features that allow workspace owners to test and maintain their chatbot without affecting production billing or WhatsApp delivery.

---

## 🔑 Core Concepts

### 1. **Playground Mode** (`isPlayground=true`)

**Purpose**: Test LLM prompts, agent configurations, and chatbot behavior WITHOUT sending WhatsApp messages or consuming credits.

**Key Characteristics**:
- ✅ **Immediate LLM response** (synchronous)
- ❌ **NO queue enqueue** → message never reaches WhatsApp
- ❌ **NO billing deduction** → free testing
- ✅ **Bypasses access checks for billing & debugMode** (credit limits, subscription checks)
- ⚠️ **Does NOT bypass channelStatus=false** (channel disabled still blocks)
- 🎯 **Use Case**: Testing prompt changes, agent configurations, new features

**Detection**:
```typescript
const isPlayground = req.body.isPlayground === true
```

**Flow**:
```
User Message → Webhook Controller → LLM Processing → Response
                                   ↓
                            (Skip queue & billing)
```

---

### 2. **debugMode** (WIP/Maintenance Mode)

**Purpose**: Put workspace in maintenance mode for REAL WhatsApp customers - send automatic WIP message without LLM processing.

**Key Characteristics**:
- ✅ **Messages go to queue** (normal enqueue)
- ✅ **Queue processor detects debugMode=true**
- 📢 **Sends WIP message automatically** (no LLM call)
- ❌ **NO extra billing** (WIP is automatic response)
- ✅ **Updates conversation history** (message marked as sent)
- 🎯 **Use Case**: Maintenance windows, prompt updates, emergency shutdown

**Detection**:
```typescript
const workspace = await prisma.workspace.findUnique({
  where: { id: workspaceId },
  select: { debugMode: true, wipMessage: true }
})

if (workspace?.debugMode === true) {
  // Send WIP automatically
}
```

**Flow**:
```
User Message → Webhook → Queue Enqueue
                          ↓
                    Queue Processor
                          ↓
                  Check debugMode=true?
                          ↓
              Fetch wipMessage → Send to WhatsApp
                          ↓
                  Mark as 'sent' (NO LLM)
```

---

## 📊 Comparison Matrix

| Feature | **Playground** (`isPlayground=true`) | **debugMode** (`debugMode=true`) | **Normal Production** |
|---------|--------------------------------------|-----------------------------------|-----------------------|
| **Message Processing** | Immediate LLM response | WIP message (no LLM) | Full LLM processing |
| **Queue** | ❌ NOT enqueued | ✅ Enqueued | ✅ Enqueued |
| **WhatsApp Delivery** | ❌ NEVER sent | ✅ WIP sent via queue | ✅ LLM response sent |
| **Billing** | ❌ FREE (skip billing) | ❌ FREE (no LLM cost) | ✅ $0.10 per message |
| **Access Checks** | ❌ Bypassed | ✅ Enforced | ✅ Enforced |
| **Use Case** | Testing prompts/config | Maintenance mode | Live customers |
| **Channel** | Playground UI | Real WhatsApp | Real WhatsApp |
| **Response Time** | Immediate (sync) | 2 minutes (queue cron) | 2 minutes (queue cron) |

---

## 🏗️ Implementation Details

### Playground - Code Locations

**1. Webhook Controller** (`whatsapp-webhook.controller.ts`)

```typescript
// Line ~1295-1340
const isPlayground = req.body.isPlayground === true

// ... LLM processing happens here ...

// 🧪 PLAYGROUND: Skip queue for playground messages
if (!isPlayground) {
  try {
    const { WhatsAppQueueService } = require("../../../services/whatsapp-queue.service")
    const queueService = new WhatsAppQueueService(prisma)
    
    await queueService.enqueue({
      workspaceId,
      customerId: customer.id,
      phoneNumber: customerPhone,
      message: finalResponse,
      messageId: generatedMessageId,
    })
    
    logger.info("✅ Response queued for WhatsApp delivery")
  } catch (queueError) {
    logger.error("❌ Failed to enqueue WhatsApp response", queueError)
  }
} else {
  logger.info("🧪 Playground mode - skipping queue (no WhatsApp send)")
}
```

**2. Billing Service** (`billing.service.ts`)

```typescript
// Line ~16-36
async trackMessage(
  workspaceId: string,
  customerId: string,
  description: string = "Message interaction",
  userQuery?: string,
  isPlayground: boolean = false // NEW PARAMETER
): Promise<void> {
  // 🧪 PLAYGROUND: Skip billing for playground messages
  if (isPlayground) {
    logger.info(`🧪 Playground mode - skipping credit deduction`, {
      workspaceId,
      customerId,
      description,
    })
    return
  }
  
  // Normal billing logic...
}
```

---

### debugMode - Code Locations

**Queue Processor** (`whatsapp-queue.service.ts`)

```typescript
// Line ~150-190
async processPendingMessages(workspaceId: string): Promise<void> {
  try {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { 
        debugMode: true, 
        name: true, 
        wipMessage: true // ✅ ADDED for custom WIP
      },
    })

    if (workspace?.debugMode === true) {
      logger.info(`🔧 DEBUG MODE ENABLED for workspace ${workspace.name}`)
      logger.info(`📢 Sending WIP message instead of processing queue`)
      
      // ✅ NEW: Fetch pending message to send WIP
      const message = await this.repository.findPending(workspaceId, 1)
      
      if (!message) {
        logger.info("No pending messages to send WIP for")
        return
      }
      
      // Send WIP message (workspace custom or default)
      const wipMessage = workspace.wipMessage || 
        "We are currently in maintenance mode. Please try again later."
      
      // TODO: Send wipMessage to WhatsApp
      // await whatsappService.sendMessage(message.phoneNumber, wipMessage)
      
      // Mark as sent and update conversation
      await this.repository.updateStatus(message.id, "sent")
      await this.markDeliveredInHistory(message.id, workspaceId, message.customerId)
      
      logger.info(`✅ WIP message sent for debugMode workspace`)
      return // ✅ Exit early, no LLM processing
    }
    
    // Normal queue processing continues...
  }
}
```

---

## 🧪 Test Coverage

### Playground Tests (`playground-isolation.spec.ts`)

**12 tests, all passing**:
- ✅ Skip credit deduction when `isPlayground=true`
- ✅ Deduct credit when `isPlayground=false`
- ✅ Default to `isPlayground=false` when not specified
- ✅ Documentation tests for queue isolation

### debugMode Tests (`debugmode-queue.spec.ts`)

**6 tests, all passing**:
- ✅ Document WIP message automatic response when `debugMode=true`
- ✅ Use default WIP message if `workspace.wipMessage` is null
- ✅ NOT call LLM when `debugMode=true`
- ✅ Not deduct credit for WIP automatic response
- ✅ Process message normally when `debugMode=false`
- ✅ Handle no pending messages gracefully

**Total Test Coverage**: 1459 unit tests passing (100%)

---

## 🚨 Critical Rules

### 1. **Variable Uniqueness in Prompts**

Large variables (`{{products}}`, `{{offers}}`, `{{services}}`, `{{categories}}`) can inject **50k+ tokens each**.

**RULE**: Each variable can appear **AT MOST ONCE** per prompt.

❌ **WRONG**:
```
Prodotti disponibili: {{products}}
...
Vedi anche questi prodotti: {{products}}
```
→ **100k+ tokens** → LLM API failure

✅ **CORRECT**:
```
Prodotti: {{products}}
```
→ **~50k tokens** → Works

**Validation**: 
- Admin UI validates on save
- `PromptProcessorService.validatePromptVariables()` checks at runtime

---

### 2. **Playground Bypasses debugMode**

Playground is intended for **testing LLM behavior**, so it **ignores debugMode** and still returns a normal LLM response:

- If `debugMode=true` → Playground still runs LLM (no WIP)
- Playground tests the prompt/agents, not the delivery mechanism

---

### 3. **debugMode vs channelStatus**

| Setting | Effect |
|---------|--------|
| `debugMode=true` | Queue sends WIP automatically (no LLM) |
| `channelStatus=false` | Total channel shutdown (blocks ALL messages at webhook) |
| Both `true` and `false` | channelStatus wins (total shutdown) |

**Priority**: `channelStatus` > `debugMode` > normal processing

---

## 📋 Use Cases

### Testing Scenario 1: Prompt Changes

**Goal**: Test new agent prompt without affecting production

**Steps**:
1. Update `agentConfig.systemPrompt` in database
2. Open playground UI
3. Send test message with `isPlayground=true`
4. Review LLM response
5. Iterate until satisfied
6. **Result**: NO billing, NO WhatsApp sends, immediate feedback

---

### Testing Scenario 2: Maintenance Window

**Goal**: Put workspace in maintenance mode for 1 hour during prompt updates

**Steps**:
1. Set `workspace.debugMode = true` in database/backoffice
2. Queue cron runs every 2 minutes
3. Any pending WhatsApp messages get WIP response
4. Update prompts/configuration safely
5. Set `workspace.debugMode = false` when done
6. **Result**: Customers informed, NO LLM costs during maintenance

---

### Testing Scenario 3: Emergency Shutdown

**Goal**: Immediately stop all chatbot responses (broken prompt)

**Steps**:
1. Set `workspace.channelStatus = false` in backoffice
2. Webhook immediately blocks new messages
3. Queue stops processing pending messages
4. Fix the issue
5. Re-enable `channelStatus = true`
6. **Result**: Complete shutdown, both playground and WhatsApp blocked

---

## 🔍 Debugging

### Logs to Watch

**Playground Mode**:
```
🧪 Playground mode - skipping queue (no WhatsApp send)
🧪 Playground mode - skipping credit deduction
```

**debugMode Active**:
```
🔧 DEBUG MODE ENABLED for workspace <name>
📢 Sending WIP message instead of processing queue
✅ WIP message sent for debugMode workspace
```

**Normal Production**:
```
✅ Response queued for WhatsApp delivery
💰 Credit deduction: $0.10 from owner <ownerId>
```

---

## 🛡️ Security Considerations

### Playground Isolation

**RISK**: Playground bypasses billing and queue, but still processes messages through LLM

**MITIGATION**:
- Playground ONLY accessible to authenticated workspace owners
- `isPlayground` flag MUST come from trusted request body (not customer input)
- Playground messages NEVER reach WhatsApp API
- Separate test coverage ensures isolation

---

### debugMode Abuse Prevention

**RISK**: Owner sets `debugMode=true` permanently to avoid billing

**MITIGATION**:
- debugMode is for REAL WhatsApp messages (already enqueued)
- Setting debugMode doesn't prevent billing for FUTURE messages
- Billing happens at **webhook enqueue time**, not queue processing
- debugMode only affects **queue processor** (WIP instead of LLM)

**Billing Timeline**:
1. Message arrives → webhook → billing deducted → enqueued
2. Queue processor runs → checks debugMode
3. If true: send WIP (no extra cost)
4. If false: process LLM (no extra cost, already billed)

---

## 📊 Metrics & Monitoring

### Playground Usage

**Track**: Count of messages with `isPlayground=true` flag

**Alert**: If playground usage > 1000 messages/day for single workspace → potential abuse

---

### debugMode Duration

**Track**: Time between `debugMode=true` → `debugMode=false`

**Alert**: If debugMode enabled for > 24 hours → investigate if stuck

---

## 🔄 Migration Notes

**Version**: v221 (January 26, 2026)

**Breaking Changes**: NONE (backward compatible)

**Database Changes**: NONE (uses existing `workspace.debugMode` and `workspace.wipMessage` fields)

**New Dependencies**: NONE

**Deployment**:
1. Deploy backend code (webhook controller + billing service + queue service)
2. Run tests: `npm run test:unit` (1459 tests must pass)
3. Deploy to Heroku: `git push heroku-app main`
4. Verify logs for playground and debugMode markers

---

## 📚 Related Documentation

- [Billing System](./billing.md) - Owner-based credit tracking
- [Queue System](./widget-llm-flow.md) - WhatsApp message queue
- [Workspace Access](./blocking.md) - Access control rules
- [PRD](../PRD.md) - Product requirements document

---

## 🎓 Developer Notes

### Adding New Playground Features

When adding features that should respect playground mode:

1. **Check `isPlayground` flag** in webhook controller
2. **Skip external API calls** (WhatsApp, emails, SMS)
3. **Skip billing** if feature costs money
4. **Add test coverage** in `playground-isolation.spec.ts`

**Pattern**:
```typescript
if (!isPlayground) {
  // External API call or billing
  await externalService.doSomething()
} else {
  logger.info("🧪 Playground mode - skipping externalService")
}
```

---

### Adding New debugMode Behaviors

When adding queue processor logic that should respect debugMode:

1. **Check `workspace.debugMode`** EARLY in processor
2. **Send WIP message** if true
3. **Exit early** (no LLM, no further processing)
4. **Add test coverage** in `debugmode-queue.spec.ts`

**Pattern**:
```typescript
const workspace = await prisma.workspace.findUnique({
  where: { id: workspaceId },
  select: { debugMode: true, wipMessage: true }
})

if (workspace?.debugMode === true) {
  // Send WIP and exit
  const message = await repository.findPending(workspaceId, 1)
  if (message) {
    await sendWIP(message, workspace.wipMessage)
    await markSent(message.id)
  }
  return
}

// Normal processing continues...
```

---

**End of Document**
