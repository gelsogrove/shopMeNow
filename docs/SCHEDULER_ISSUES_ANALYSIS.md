# 🚨 SCHEDULER ISSUES ANALYSIS

**Date**: 2025-01-XX  
**Analyst**: AI Agent  
**Scope**: `/apps/scheduler/` - All cron jobs and runner service

---

## 🔴 CRITICAL ISSUES (Immediate Action Required)

### 1. **RACE CONDITION: monthly-billing.job.ts - No Atomic Transactions**

**File**: [monthly-billing.job.ts](../apps/scheduler/src/jobs/monthly-billing.job.ts#L200-L394)

**PROBLEM**:
- Each owner is processed WITHOUT a transaction wrapping the entire operation
- If process crashes mid-owner, data becomes inconsistent
- Example scenario:
  ```
  1. Invoice created ✅
  2. user.nextBillingDate NOT updated ❌ (crash before this)
  3. Next run → creates DUPLICATE invoice for same month
  ```

**CURRENT CODE** (Line 200-394):
```typescript
for (const owner of owners) {
  try {
    // Update pending plan
    await prisma.user.update({ ... })
    
    // Create invoice
    const invoiceResult = await createPendingInvoice(...)
    
    // Update next billing date
    await prisma.user.update({ nextBillingDate: ... })
    
    stats.processed++
  } catch (error) {
    stats.errors++
  }
}
```

**❌ WRONG**: Multiple DB operations without transaction  
**✅ FIX**:
```typescript
for (const owner of owners) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update pending plan
      await tx.user.update({ ... })
      
      // 2. Create invoice (use tx, not prisma)
      const invoice = await tx.monthlyInvoice.upsert({ ... })
      
      // 3. Update next billing date
      await tx.user.update({ nextBillingDate: ... })
      
      // ALL OR NOTHING - atomic guarantee
    })
    
    stats.processed++
  } catch (error) {
    stats.errors++ // Entire owner rolled back
  }
}
```

**IMPACT**: 🔴 **CRITICAL**  
- Duplicate invoices possible
- Inconsistent billing state
- Customer charged twice or not at all

**PRIORITY**: **P0 - Fix Immediately**

---

### 2. **RACE CONDITION: whatsapp-channel-queue.job.ts - Throttle Cache Loss**

**File**: [whatsapp-channel-queue.job.ts](../apps/scheduler/src/jobs/whatsapp-channel-queue.job.ts#L13)

**PROBLEM**:
- Recipient throttle uses in-memory Map: `recipientSendTimestamps`
- If scheduler RESTARTS (deploy, crash, scale-up), cache is LOST
- WhatsApp sends messages faster than 6s cooldown → **API rate limit violation**
- WhatsApp may BLOCK phone number temporarily

**CURRENT CODE** (Line 13):
```typescript
const recipientSendTimestamps = new Map<string, number>()
// ❌ WRONG: In-memory only, lost on restart
```

**✅ FIX OPTION A**: Database-backed throttle (simple, works with single instance):
```typescript
// Store in ConversationMessage.lastMessageSentAt field
const lastSent = await prisma.conversationMessage.findFirst({
  where: {
    customerId: customer.id,
    role: 'assistant',
    deliveryStatus: 'sent',
  },
  orderBy: { createdAt: 'desc' },
  select: { createdAt: true },
})

const nowTs = Date.now()
if (lastSent && nowTs - lastSent.createdAt.getTime() < RECIPIENT_COOLDOWN_MS) {
  logger.info(`Throttling recipient ${phoneNumber}`)
  continue // Skip this cycle
}
```

**✅ FIX OPTION B**: Redis-backed throttle (best for multi-instance):
```typescript
import Redis from 'ioredis'
const redis = new Redis(process.env.REDIS_URL)

const throttleKey = `whatsapp:throttle:${phoneNumber}`
const lastSentTs = await redis.get(throttleKey)

if (lastSentTs && Date.now() - parseInt(lastSentTs) < RECIPIENT_COOLDOWN_MS) {
  continue // Throttled
}

// After send:
await redis.set(throttleKey, Date.now(), 'EX', 60) // Expire after 60s
```

**IMPACT**: 🔴 **CRITICAL**  
- WhatsApp API rate limit violations
- Phone number temporary ban
- Messages delivery blocked

**PRIORITY**: **P0 - Fix Before Scale**

---

### 3. **BUG: push-campaigns.job.ts - Credit Check Inconsistency**

**File**: [push-campaigns.job.ts](../apps/scheduler/src/jobs/push-campaigns.job.ts#L135-L145)

**PROBLEM**:
- Credit balance checked **every 10 messages** (line 135)
- Uses **local variable** `availableBalance` instead of fresh DB query
- If **widget** or **another campaign** depletes balance concurrently, this campaign continues until next check
- Can send up to **10 messages with negative balance** beyond -$10 threshold

**CURRENT CODE** (Line 135-145):
```typescript
// Refresh credit balance every 10 messages
if (processed > 0 && processed % 10 === 0) {
  const freshOwner = await prisma.user.findUnique({ ... })
  availableBalance = Number(freshOwner.creditBalance)
  
  if (availableBalance < CREDIT_MIN_THRESHOLD) {
    creditExhausted = true
    break
  }
}
```

**❌ WRONG**: Checks only every 10th message  
**✅ FIX**: Check BEFORE every message send:
```typescript
for (const recipient of recipients) {
  // 💰 Check credit BEFORE each send (not every 10)
  const owner = await prisma.user.findUnique({
    where: { id: workspace.ownerId },
    select: { creditBalance: true },
  })
  
  if (!owner || Number(owner.creditBalance) < CREDIT_MIN_THRESHOLD) {
    creditExhausted = true
    break
  }
  
  // Safe to send - balance is above threshold
  // ... send message
}
```

**ALTERNATIVE** (More efficient - batch credit deduction):
```typescript
// Deduct credit BEFORE queueing (not after send)
await prisma.user.update({
  where: { id: workspace.ownerId },
  data: { creditBalance: { decrement: costPerMessage } },
})

// Then queue message
await prisma.whatsAppQueue.create({ ... })

// This way, credit is atomically deducted before any send attempt
```

**IMPACT**: 🟡 **HIGH**  
- Overspending by -$1 to -$10 per campaign
- Billing inconsistency
- Angry customers

**PRIORITY**: **P1 - Fix This Week**

---

## 🟡 HIGH PRIORITY ISSUES

### 4. **MISSING: No Graceful Shutdown for In-Progress Jobs**

**File**: [index.ts](../apps/scheduler/src/index.ts#L139-L151)

**PROBLEM**:
- SIGINT/SIGTERM handlers disconnect database **immediately**
- If `whatsappChannelQueueJob` is processing (isProcessing=true), it gets killed mid-transaction
- Can leave messages in partial state: queue status updated, but conversationMessage not updated

**CURRENT CODE** (Line 139-151):
```typescript
process.on('SIGINT', async () => {
  logger.info('Shutting down scheduler...')
  await disconnectDatabase() // ❌ Does NOT wait for jobs!
  process.exit(0)
})
```

**✅ FIX**: Wait for in-progress jobs:
```typescript
let isShuttingDown = false

process.on('SIGINT', async () => {
  logger.info('🛑 Shutdown signal received - waiting for jobs to complete...')
  isShuttingDown = true
  
  // Wait for WhatsApp Queue job to finish (max 30s)
  const maxWaitMs = 30000
  const startWait = Date.now()
  
  while (isProcessing && Date.now() - startWait < maxWaitMs) {
    logger.info('⏳ Waiting for WhatsApp Queue job to finish...')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  if (isProcessing) {
    logger.warn('⚠️ Job still running after 30s - forcing shutdown')
  } else {
    logger.info('✅ All jobs completed - safe to shutdown')
  }
  
  await disconnectDatabase()
  process.exit(0)
})
```

**ALSO UPDATE** whatsapp-channel-queue.job.ts:
```typescript
export async function whatsappChannelQueueJob(): Promise<void> {
  // Check shutdown flag at loop start
  if (isShuttingDown) {
    logger.info('[WhatsApp Queue] Shutdown in progress - skipping cycle')
    return
  }
  
  if (isProcessing) {
    return
  }
  
  isProcessing = true
  // ... rest of job
}
```

**IMPACT**: 🟡 **HIGH**  
- Data corruption on deploy/restart
- Messages stuck in partial state
- Manual cleanup required

**PRIORITY**: **P1 - Fix Before Next Deploy**

---

### 5. **MISSING: No Retry Logic for Failed Jobs**

**File**: [job-runner.service.ts](../apps/scheduler/src/services/job-runner.service.ts#L1-L62)

**PROBLEM**:
- If job fails (network error, DB timeout, external API down), it's marked FAILED and that's it
- Only alert email sent
- Next run waits until next cron schedule (could be 24 hours for daily jobs)
- No exponential backoff, no immediate retry

**CURRENT CODE**:
```typescript
export async function runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    await touchJobStatus('SUCCESS')
  } catch (error) {
    await touchJobStatus('FAILED', errorMsg)
    await sendJobErrorAlert(jobName, error) // ❌ Only email, no retry
  }
}
```

**✅ FIX**: Add retry with exponential backoff:
```typescript
const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 30000, 120000] // 5s, 30s, 2min

export async function runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
  let retries = 0
  
  while (retries <= MAX_RETRIES) {
    try {
      await fn()
      await touchJobStatus('SUCCESS')
      return // Success - exit
    } catch (error) {
      retries++
      
      if (retries > MAX_RETRIES) {
        // Final failure after all retries
        await touchJobStatus('FAILED', errorMsg)
        await sendJobErrorAlert(jobName, error)
        throw error
      }
      
      // Retry with backoff
      const delay = RETRY_DELAYS[retries - 1]
      logger.warn(`[JobRunner] ${jobName} failed (attempt ${retries}/${MAX_RETRIES}), retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      await touchJobStatus('RETRYING', `Attempt ${retries + 1}/${MAX_RETRIES + 1}`)
    }
  }
}
```

**IMPACT**: 🟡 **MEDIUM**  
- Jobs fail unnecessarily on transient errors
- 24h wait for next retry (daily jobs)
- Manual intervention required

**PRIORITY**: **P2 - Nice to Have**

---

### 6. **MISSING: No Dead Letter Queue for WhatsApp Messages**

**File**: [whatsapp-channel-queue.job.ts](../apps/scheduler/src/jobs/whatsapp-channel-queue.job.ts#L1-L728)

**PROBLEM**:
- Messages that fail (status='error') are never retried automatically
- No DLQ (Dead Letter Queue) pattern
- Manual intervention required to resend failed messages  
- Users don't receive messages and don't know

**CURRENT BEHAVIOR**:
```
1. Message fails to send (API timeout)
2. Status = 'error', errorMessage logged
3. Message sits in queue forever
4. Customer NEVER receives message
```

**✅ FIX OPTION A**: Retry failed messages (simple):
```typescript
// In whatsapp-channel-queue.job.ts
const pendingMessages = await prisma.whatsAppQueue.findMany({
  where: {
    workspaceId: workspace.id,
    OR: [
      { status: 'pending' },
      {
        status: 'error',
        retryCount: { lt: 3 }, // Max 3 retries
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h only
      },
    ],
  },
  take: 10,
  orderBy: { createdAt: 'asc' },
})

// After send failure:
await prisma.whatsAppQueue.update({
  where: { id: message.id },
  data: {
    status: 'error',
    errorMessage: error,
    retryCount: { increment: 1 },
    nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 min
  },
})
```

**✅ FIX OPTION B**: Dead Letter Queue (DLQ) pattern:
```typescript
// After 3 failed retries, move to DLQ
if (message.retryCount >= 3) {
  await prisma.whatsAppDLQ.create({
    data: {
      originalQueueId: message.id,
      workspaceId: message.workspaceId,
      customerId: message.customerId,
      phoneNumber: message.phoneNumber,
      messageContent: message.messageContent,
      failureReason: message.errorMessage,
      failedAt: new Date(),
    },
  })
  
  // Delete from main queue
  await prisma.whatsAppQueue.delete({ where: { id: message.id } })
  
  // Alert admin via email or backoffice notification
  await sendDLQAlert(workspace.ownerId, message.id)
}
```

**IMPACT**: 🟡 **MEDIUM**  
- Failed messages lost forever
- Poor customer experience
- Manual resend required

**PRIORITY**: **P2 - Implement If Scaling**

---

## 🟢 LOW PRIORITY ISSUES

### 7. **INEFFICIENCY: Batch Processing Without Cursor-Based Pagination**

**File**: [messages-archive.job.ts](../apps/scheduler/src/jobs/messages-archive.job.ts#L24-L45)

**PROBLEM**:
- Uses implicit offset pagination (take BATCH_SIZE, repeat)
- If new messages are inserted DURING archiving, offset shifts
- Can skip records or process duplicates

**CURRENT CODE** (Line 24-45):
```typescript
while (hasMore) {
  const oldMessages = await prisma.message.findMany({
    where: { createdAt: { lt: cutoffDate } },
    take: BATCH_SIZE, // ❌ Implicit offset - unreliable during concurrent inserts
  })
  
  // Archive + delete
  
  if (oldMessages.length < BATCH_SIZE) hasMore = false
}
```

**✅ FIX**: Cursor-based pagination:
```typescript
let cursor: string | undefined = undefined
let hasMore = true

while (hasMore) {
  const oldMessages = await prisma.message.findMany({
    where: { createdAt: { lt: cutoffDate } },
    take: BATCH_SIZE,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }), // ✅ Cursor pagination
    orderBy: { id: 'asc' }, // Stable sort order
  })
  
  if (oldMessages.length === 0) {
    hasMore = false
    break
  }
  
  // Archive + delete (in transaction)
  await prisma.$transaction(async (tx) => {
    // ... same logic
  })
  
  cursor = oldMessages[oldMessages.length - 1].id // Update cursor
  if (oldMessages.length < BATCH_SIZE) hasMore = false
}
```

**IMPACT**: 🟢 **LOW**  
- Skipped records (rare)
- Incomplete archive (rare)
- Can self-heal on next run

**PRIORITY**: **P3 - Refactor When Convenient**

---

### 8. **SECURITY: soft-delete-cleanup.job.ts - No Backup Before Hard Delete**

**File**: [soft-delete-cleanup.job.ts](../apps/scheduler/src/jobs/soft-delete-cleanup.job.ts#L1-L476)

**PROBLEM**:
- Hard delete is **IRREVERSIBLE**
- No automatic backup before deletion
- If wrong data deleted (bug, wrong retention config), **CANNOT RECOVER**
- GDPR compliance issue: should archive for audit, not just delete

**CURRENT BEHAVIOR**:
```
1. Find records with deletedAt < expiryDate
2. Hard delete in transaction
3. Data GONE FOREVER
```

**✅ FIX**: Export to S3/backup before delete:
```typescript
export async function softDeleteCleanupJob(): Promise<void> {
  // ... existing code to find expired records
  
  // NEW: Export to S3 before delete
  if (userIds.length > 0 || workspaceIds.length > 0) {
    const backupData = {
      timestamp: new Date().toISOString(),
      retentionDays: retentionDays,
      expiryDate: expiryDate.toISOString(),
      users: await prisma.user.findMany({
        where: { id: { in: userIds } },
      }),
      workspaces: await prisma.workspace.findMany({
        where: { id: { in: workspaceIds } },
        include: {
          customers: true,
          products: true,
          orders: true,
          // ... all related data
        },
      }),
    }
    
    // Upload to S3
    const s3Key = `soft-delete-backups/${new Date().toISOString()}.json`
    await s3.putObject({
      Bucket: process.env.S3_BACKUP_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(backupData, null, 2),
    }).promise()
    
    logger.info(`📦 Backup created: s3://${process.env.S3_BACKUP_BUCKET}/${s3Key}`)
  }
  
  // NOW safe to hard delete
  await prisma.$transaction(async (tx) => {
    // ... existing deletion logic
  })
}
```

**ALTERNATIVE** (Cheaper - local filesystem):
```typescript
const backupPath = `./backups/soft-delete/${new Date().toISOString()}.json`
await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2))
logger.info(`📦 Backup saved: ${backupPath}`)
```

**IMPACT**: 🟢 **LOW (but important for compliance)**  
- Cannot recover accidentally deleted data
- GDPR audit trail missing
- Legal risk

**PRIORITY**: **P3 - Add Before Production Scale**

---

## 📊 SUMMARY

| Issue | Severity | File | Priority | Status |
|-------|----------|------|----------|--------|
| 1. Monthly Billing Race Condition | 🔴 CRITICAL | monthly-billing.job.ts | P0 | ❌ NOT FIXED |
| 2. Throttle Cache Loss | 🔴 CRITICAL | whatsapp-channel-queue.job.ts | P0 | ❌ NOT FIXED |
| 3. Credit Check Inconsistency | 🟡 HIGH | push-campaigns.job.ts | P1 | ❌ NOT FIXED |
| 4. No Graceful Shutdown | 🟡 HIGH | index.ts | P1 | ❌ NOT FIXED |
| 5. No Retry Logic | 🟡 MEDIUM | job-runner.service.ts | P2 | ❌ NOT FIXED |
| 6. No DLQ for WhatsApp | 🟡 MEDIUM | whatsapp-channel-queue.job.ts | P2 | ❌ NOT FIXED |
| 7. Batch Pagination | 🟢 LOW | messages-archive.job.ts | P3 | ❌ NOT FIXED |
| 8. No Backup Before Delete | 🟢 LOW | soft-delete-cleanup.job.ts | P3 | ❌ NOT FIXED |

---

## 🎯 RECOMMENDED FIX ORDER

### Week 1 (CRITICAL):
1. ✅ Fix monthly billing race condition (wrap in transaction)
2. ✅ Fix throttle cache loss (use DB or Redis)

### Week 2 (HIGH):
3. ✅ Fix credit check inconsistency (check before every send)
4. ✅ Add graceful shutdown (wait for jobs)

### Week 3 (MEDIUM - Optional but Recommended):
5. ✅ Add retry logic to job runner
6. ✅ Implement DLQ or retry for failed WhatsApp messages

### Future (LOW - Nice to Have):
7. ✅ Fix batch pagination (cursor-based)
8. ✅ Add backup before hard delete (S3 or filesystem)

---

## 🔧 TESTING CHECKLIST

After implementing fixes:

- [ ] **Test 1**: Monthly billing doesn't create duplicate invoices if crashed mid-owner
- [ ] **Test 2**: Throttle persists after scheduler restart (no faster than 6s to same number)
- [ ] **Test 3**: Push campaigns stop immediately when credit drops below threshold
- [ ] **Test 4**: SIGTERM during WhatsApp Queue job waits for completion (max 30s)
- [ ] **Test 5**: Failed jobs retry with exponential backoff (5s, 30s, 2min)
- [ ] **Test 6**: Failed WhatsApp messages retry 3 times, then move to DLQ
- [ ] **Test 7**: Archive job processes all messages even with concurrent inserts
- [ ] **Test 8**: Hard delete creates S3 backup before deletion

---

**Andrea, vuoi che implemento qualcuno di questi fix subito? Consiglio di iniziare con #1 (billing transaction) e #2 (throttle cache) perché sono CRITICAL.**
