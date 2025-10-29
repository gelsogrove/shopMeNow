# Agent Logging System Documentation

## 📋 Overview

The Agent Logging System provides comprehensive tracking and analytics for all LLM agent interactions in the ShopME multi-agent system.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentLoggerService                       │
│  (High-level orchestration + security validation)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            AgentConversationLogRepository                   │
│  (Database access layer with Prisma ORM)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                        │
│  Table: agent_conversation_logs (20+ fields)                │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Database Schema

**Table: `agent_conversation_logs`**

| Field             | Type      | Description                             |
| ----------------- | --------- | --------------------------------------- |
| `id`              | UUID      | Primary key                             |
| `workspaceId`     | UUID      | Tenant isolation (FK)                   |
| `customerId`      | UUID      | Customer reference (FK)                 |
| `conversationId`  | String    | Groups messages in same conversation    |
| `messageId`       | String    | Unique message identifier               |
| `step`            | Integer   | Position in agent pipeline (0, 1, 2...) |
| `agentType`       | Enum      | ROUTER, PRODUCT_SEARCH, etc.            |
| `agentAction`     | String    | FAQ_CHECK, INTENT_CLASSIFICATION, etc.  |
| `inputMessage`    | Text      | User message or previous agent output   |
| `agentPrompt`     | Text      | Complete prompt sent to LLM             |
| `llmModel`        | String    | e.g., "openai/gpt-4o-mini"              |
| `llmResponse`     | Text      | Raw LLM response                        |
| `confidence`      | Float     | 0-1 confidence score                    |
| `reasoning`       | Text      | LLM reasoning/explanation               |
| `tokensUsed`      | Integer   | Token count for cost tracking           |
| `executionTimeMs` | Integer   | Milliseconds to complete                |
| `functionsCalled` | JSONB     | Functions called by LLM                 |
| `hasError`        | Boolean   | Error flag                              |
| `errorMessage`    | Text      | Error details if any                    |
| `createdAt`       | Timestamp | When logged                             |

**Indexes for Performance:**

- `[workspaceId, createdAt]` - Fast workspace queries
- `[conversationId]` - Fast conversation retrieval
- `[customerId, createdAt]` - Customer history
- `[agentType]` - Analytics by agent
- `[hasError, createdAt]` - Error tracking

## 🔒 Security Model

### Multi-Tenant Isolation

**EVERY** query includes `workspaceId` filter:

```typescript
where: { workspaceId, customerId, ... }
```

### Customer Validation

Before logging, service validates:

```typescript
const customer = await prisma.customers.findFirst({
  where: { id: customerId, workspaceId },
})

if (!customer) {
  throw new Error("Security violation")
}
```

This prevents:

- Cross-workspace data leakage
- Invalid customer references
- Unauthorized access

## 📈 Use Cases

### 1. Complete Audit Trail

Log every LLM interaction:

```typescript
await loggerService.logAgentInteraction({
  workspaceId,
  customerId,
  conversationId,
  agentType: "ROUTER",
  inputMessage: "cerco latticini",
  llmResponse: '{"agent": "PRODUCT_SEARCH"}',
  tokensUsed: 234,
  executionTimeMs: 145,
})
```

### 2. Debug Agent Pipeline

See all agents that processed a message:

```typescript
const logs = await loggerService.getConversationLogs(
  workspaceId,
  conversationId
)

// Returns:
// ROUTER (145ms, 234 tokens) →
// PRODUCT_SEARCH (280ms, 450 tokens) →
// SAFETY_TRANSLATION (150ms, 300 tokens)
```

### 3. Performance Analytics

Track agent performance over time:

```typescript
const metrics = await loggerService.getAgentPerformanceMetrics(
  workspaceId,
  startDate,
  endDate
)

// Returns:
// - Total interactions per agent
// - Avg confidence, execution time, tokens
// - Error rates
```

### 4. Cost Optimization

Identify expensive agents:

```typescript
const breakdown = await loggerService.getTokenUsageBreakdown(workspaceId)

// Returns:
// PRODUCT_SEARCH: 45% of tokens ($0.0234)
// ROUTER: 30% of tokens ($0.0156)
// SAFETY_TRANSLATION: 25% of tokens ($0.0130)
```

### 5. Error Monitoring

Debug recent failures:

```typescript
const errors = await loggerService.getErrorLogs(workspaceId, 50)

// Returns logs with hasError=true
// - Error message
// - Which agent failed
// - When it happened
```

### 6. Customer Support

View customer interaction history:

```typescript
const history = await loggerService.getCustomerInteractionHistory(
  workspaceId,
  customerId
)

// Returns:
// - All conversations
// - Agents used
// - Success/error status
```

### 7. Real-time Monitoring

Dashboard metrics:

```typescript
const stats = await loggerService.getRealtimeStats(workspaceId)

// Returns:
// - Last 24h interactions
// - Last hour interactions
// - Error rate
// - System status (healthy/warning)
```

### 8. Data Retention

Cleanup old logs (run monthly):

```typescript
const retentionDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
const deletedCount = await loggerService.cleanupOldLogs(
  workspaceId,
  retentionDate
)
```

## 🎯 Integration with Router Agent

When Router Agent processes a message:

```typescript
// Step 0: Router Agent
const startTime = Date.now()

// ... LLM call ...

await loggerService.logAgentInteraction({
  workspaceId,
  customerId,
  conversationId,
  messageId,
  step: 0,
  agentType: "ROUTER",
  agentAction: "INTENT_CLASSIFICATION",
  inputMessage: userMessage,
  agentPrompt: routerPrompt,
  llmModel: "openai/gpt-4o-mini",
  llmResponse: llmOutput,
  confidence: parsedResponse.confidence,
  reasoning: parsedResponse.reasoning,
  tokensUsed: llmUsage.totalTokens,
  executionTimeMs: Date.now() - startTime,
})

// Step 1: Specialist Agent
// ... same pattern ...

// Step 2: Safety & Translation
// ... same pattern ...
```

## 📊 Analytics Queries

### Most Used Agents

```sql
SELECT agentType, COUNT(*) as total
FROM agent_conversation_logs
WHERE workspaceId = ?
GROUP BY agentType
ORDER BY total DESC
```

### Average Response Time by Agent

```sql
SELECT agentType, AVG(executionTimeMs) as avgTime
FROM agent_conversation_logs
WHERE workspaceId = ?
GROUP BY agentType
```

### Error Rate by Agent

```sql
SELECT
  agentType,
  COUNT(*) as total,
  SUM(CASE WHEN hasError THEN 1 ELSE 0 END) as errors,
  (SUM(CASE WHEN hasError THEN 1 ELSE 0 END)::float / COUNT(*)) as errorRate
FROM agent_conversation_logs
WHERE workspaceId = ?
GROUP BY agentType
```

### Token Cost by Agent

```sql
SELECT
  agentType,
  SUM(tokensUsed) as totalTokens,
  (SUM(tokensUsed) / 1000000.0 * 0.15) as estimatedCost
FROM agent_conversation_logs
WHERE workspaceId = ?
GROUP BY agentType
ORDER BY totalTokens DESC
```

## 🚀 Performance Considerations

### Indexes

All queries use indexed fields:

- `workspaceId` - Always indexed for tenant isolation
- `conversationId` - Fast conversation retrieval
- `agentType` - Analytics queries
- `createdAt` - Time-based filtering

### Bulk Operations

For high-volume logging, consider batching:

```typescript
// Instead of logging one-by-one
await Promise.all([logInteraction1, logInteraction2, logInteraction3])
```

### Data Retention

Set up monthly cleanup:

```bash
# Cron job: Run first day of month
0 0 1 * * ts-node scripts/cleanup-old-logs.ts
```

## 🔍 Debugging Tips

### View Complete Agent Pipeline

```typescript
const logs = await loggerService.getConversationLogs(
  workspaceId,
  conversationId
)

logs.agentPipeline.forEach((agent) => {
  console.log(`${agent.step}. ${agent.agentType}:`)
  console.log(`   - Time: ${agent.executionTimeMs}ms`)
  console.log(`   - Tokens: ${agent.tokensUsed}`)
  console.log(`   - Error: ${agent.hasError}`)
})
```

### Find Slow Agents

```typescript
const metrics = await loggerService.getAgentPerformanceMetrics(workspaceId)
const slowAgents = metrics.metrics
  .filter((m) => m.avgExecutionTimeMs > 500)
  .sort((a, b) => b.avgExecutionTimeMs - a.avgExecutionTimeMs)
```

### Identify High-Cost Agents

```typescript
const breakdown = await loggerService.getTokenUsageBreakdown(workspaceId)
const expensive = breakdown.byAgent.filter(
  (a) => parseFloat(a.estimatedCost) > 0.01
)
```

## 📝 Best Practices

1. **Always log interactions** - Even errors
2. **Include reasoning** - Helps debugging
3. **Track token usage** - Cost monitoring
4. **Set confidence scores** - Quality metrics
5. **Use descriptive agentAction** - Easy filtering
6. **Monitor error rates** - Set alerts
7. **Regular cleanup** - 90-day retention
8. **Security first** - Always validate workspace+customer

## 🎓 Example: Complete Message Flow

```typescript
const conversationId = generateConversationId()
const messageId = generateMessageId()

try {
  // Step 0: Router
  const routerStart = Date.now()
  const routerResponse = await callRouterLLM(userMessage)
  await loggerService.logAgentInteraction({
    // ... router log
    step: 0,
    executionTimeMs: Date.now() - routerStart,
  })

  // Step 1: Specialist (e.g., PRODUCT_SEARCH)
  const specialistStart = Date.now()
  const specialistResponse = await callSpecialistLLM(routerResponse)
  await loggerService.logAgentInteraction({
    // ... specialist log
    step: 1,
    executionTimeMs: Date.now() - specialistStart,
  })

  // Step 2: Safety & Translation
  const safetyStart = Date.now()
  const finalResponse = await callSafetyLLM(specialistResponse)
  await loggerService.logAgentInteraction({
    // ... safety log
    step: 2,
    executionTimeMs: Date.now() - safetyStart,
  })
} catch (error) {
  // Log error
  await loggerService.logAgentInteraction({
    // ... error log
    hasError: true,
    errorMessage: error.message,
  })
}
```

## 🔗 Related Files

- Service: `backend/src/services/AgentLoggerService.ts`
- Repository: `backend/src/repositories/AgentConversationLogRepository.ts`
- Tests: `backend/src/services/__test__AgentLoggerService.ts`
- Examples: `backend/src/services/AgentLoggerService.examples.ts`
- Schema: `backend/prisma/schema.prisma` (AgentConversationLog model)
