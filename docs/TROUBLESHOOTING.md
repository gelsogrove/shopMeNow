# ShopME Troubleshooting Guide

**Version**: 1.0.0  
**Last Updated**: 2025-11-13

---

## Table of Contents

1. [LLM Response Issues](#llm-response-issues)
   - [Incomplete Product Lists](#incomplete-product-lists)
   - [Count Mismatch](#count-mismatch)
   - [Product Hallucination](#product-hallucination)
2. [Database Issues](#database-issues)
3. [Authentication Issues](#authentication-issues)
4. [Performance Issues](#performance-issues)

---

## LLM Response Issues

### Incomplete Product Lists

**Symptom**: LLM shows fewer products than exist in database (e.g., shows 4 of 5 DOP cheeses)

**Root Cause**: Stale cache in `searchConversations` table

**Discovery** (2025-11-13):

- User query: "avete i formaggi?" → LLM grouped by certification (DOP, Freschi, Stagionati)
- User selects: "1" (Formaggi DOP - 5 products)
- **Bug**: LLM consistently showed only 4 of 5 DOP cheeses, missing Taleggio DOP
- **Investigation**:
  - ✅ Database confirmed: 5 DOP cheeses (Gorgonzola, Parmigiano, Mozzarella, Pecorino, Taleggio)
  - ✅ `MessageRepository.getActiveProducts()`: All 5 in formatted output
  - ✅ `PromptProcessorService`: {{PRODUCTS}} includes all 5 (verified in `logs/prompt-debug-*.txt`)
  - ❌ **LLM output**: Only 4 shown in every test
- **Root Cause**: `searchConversations` cached first response (possibly with 4 products), LLM reused cache instead of re-filtering from {{PRODUCTS}}

**Solution**:

```typescript
// Clear session memory before re-querying
await prisma.searchConversations.deleteMany({
  where: { sessionId },
})
```

**Test Validation**:

```bash
cd backend
npx ts-node scripts/test-cheese-count.ts
```

Expected output: All 5 DOP cheeses shown including Taleggio

**Prevention**:

1. **Automatic cache invalidation** on product CRUD operations:

   ```typescript
   async function updateProduct(productId: string, data: ProductUpdateDto) {
     const product = await prisma.products.update({
       where: { id: productId },
       data,
     })

     // Invalidate related sessions
     await prisma.searchConversations.deleteMany({
       where: {
         workspaceId: product.workspaceId,
         lastQuery: { contains: product.category },
       },
     })

     return product
   }
   ```

2. **Product version tracking**:

   - Add `catalogVersion` column to `workspace` table
   - Increment on product add/update/delete
   - Store version in `searchConversations`, invalidate on mismatch

3. **TTL expiration**: Already implemented (10-minute expiry via `expiresAt`)

**References**:

- Constitution: [Principle VIII - Conversational Memory Invalidation](../.specify/memory/constitution.md#viii-conversational-memory-invalidation-must---critical)
- Test script: `backend/scripts/test-cheese-count.ts`

---

### Count Mismatch

**Symptom**: LLM says "(N prodotti)" in header but shows fewer than N items

**Related to**: [Incomplete Product Lists](#incomplete-product-lists)

**Quick Fix**:

```typescript
// Clear stale cache
await prisma.searchConversations.deleteMany({
  where: { sessionId },
})
```

**Verification**:

1. Check database count:

   ```sql
   SELECT COUNT(*) FROM "Products"
   WHERE "workspaceId" = 'xxx'
   AND "isActive" = true
   AND "category" = 'Formaggi'
   AND "certifications" ? 'DOP';
   ```

2. Check LLM prompt debug file:

   ```bash
   tail -100 backend/logs/prompt-debug-*.txt | grep "FORMAG-"
   ```

3. Verify all products present in `{{PRODUCTS}}` variable

---

### Product Hallucination

**Symptom**: LLM invents products not in database (e.g., "Salame Napoli" when only "Salame Milano" exists)

**Root Cause**: LLM copying fake product names from prompt examples OR {{PRODUCTS}} variable not replaced

**Solution 1**: Verify {{PRODUCTS}} replacement

```typescript
// Check PromptProcessorService is called
const processedPrompt = await promptProcessor.replaceAllVariables(
  promptTemplate,
  workspaceId,
  customerId,
  sessionId
)
```

**Solution 2**: Check prompt examples use placeholders

```markdown
❌ WRONG - Realistic fake names:
"Example: Customer asks 'avete salame?' → show 'Salame Toscano 200g €8.50'"

✅ CORRECT - Generic placeholders:
"Example: Customer asks 'avete [PRODUCT_CATEGORY]?' → show '[PRODUCT_NAME] [SIZE] €[PRICE]'"
```

**Verification**:

```bash
cd backend
npx ts-node scripts/test-salame-query.ts
```

Expected: LLM shows "Salame Milano" (real product), NOT "Salame Napoli" (fake)

**References**:

- Constitution: [Principle III.4 - Example Products Prevention](../.specify/memory/constitution.md#iii-variable-replacement-must---non-negotiable)
- Prompt: `docs/prompts/product-search-agent.md` (lines 1-35, warning box)

---

## Database Issues

### Missing agentConfig

**Symptom**: `Error: Missing systemPrompt for agent PRODUCT_SEARCH`

**Cause**: Database not seeded or `agentConfig` table empty

**Solution**:

```bash
cd backend
npm run seed
```

**Verification**:

```sql
SELECT "agentType", LENGTH("systemPrompt") FROM "AgentConfig" WHERE "workspaceId" = 'xxx';
```

Expected: 6 agents (ROUTER, PRODUCT_SEARCH, CART, ORDER_TRACKING, CUSTOMER_SUPPORT, SAFETY_TRANSLATION) with non-null systemPrompt

---

### Workspace Isolation Violation

**Symptom**: Users see products/orders from other workspaces

**Cause**: Missing `workspaceId` filter in Prisma query

**Detection**:

```bash
cd backend
npm run test:security
```

**Solution**:

```typescript
// ❌ WRONG - No workspace filter
const products = await prisma.products.findMany({
  where: { isActive: true },
})

// ✅ CORRECT - Workspace isolated
const products = await prisma.products.findMany({
  where: { workspaceId, isActive: true },
})
```

**References**:

- Constitution: [Principle II - Workspace Isolation](../.specify/memory/constitution.md#ii-workspace-isolation-must---non-negotiable)

---

## Authentication Issues

### Invalid JWT Token

**Symptom**: `401 Unauthorized` on protected endpoints

**Common Causes**:

1. Token expired (24h TTL)
2. Token missing from localStorage
3. Wrong `Authorization` header format

**Solution**:

```typescript
// Frontend - Check token exists
const token = localStorage.getItem('token')
if (!token) {
  // Redirect to login
}

// Frontend - Verify header format
headers: {
  'Authorization': `Bearer ${token}` // Must include "Bearer " prefix
}
```

**Verification**:

```bash
# Decode JWT to check expiry
jwt_decode() { jq -R 'split(".") | .[1] | @base64d | fromjson' <<< "$1"; }
jwt_decode "YOUR_TOKEN_HERE"
```

---

### Session Validation Failed

**Symptom**: `403 Forbidden - Session validation failed`

**Cause**: Missing or invalid `x-session-id` header

**Solution**:

```typescript
// Frontend - Include session ID
headers: {
  'Authorization': `Bearer ${token}`,
  'x-session-id': sessionId // From chat session
}
```

---

## Performance Issues

### Slow LLM Responses

**Symptom**: 10+ seconds for ProductSearchAgent responses

**Common Causes**:

1. **Large {{PRODUCTS}} variable**: >50k tokens
2. **Network latency**: OpenRouter API delays
3. **Database query**: Slow `getActiveProducts()` query

**Diagnosis**:

```bash
# Check prompt size
tail -10 backend/logs/prompt-debug-*.txt | grep "token count"

# Check database query time
# Add to MessageRepository.getActiveProducts()
const start = Date.now()
const products = await prisma.products.findMany({ ... })
logger.info(`Query time: ${Date.now() - start}ms`)
```

**Solutions**:

1. **Reduce product count**: Archive inactive products

   ```sql
   UPDATE "Products" SET "isActive" = false WHERE "lastSold" < NOW() - INTERVAL '6 months';
   ```

2. **Optimize query**: Add database indexes

   ```sql
   CREATE INDEX idx_products_workspace_active ON "Products"("workspaceId", "isActive");
   ```

3. **Cache formatted products**: Store `getActiveProducts()` output in Redis with 5-minute TTL

---

### High Token Usage / Billing

**Symptom**: Unexpected API costs from OpenRouter

**Diagnosis**:

```bash
# Check usage tracking
SELECT
  DATE(timestamp),
  SUM("inputTokens") as total_input,
  SUM("outputTokens") as total_output,
  SUM("totalCost") as daily_cost
FROM "LLMUsage"
WHERE "workspaceId" = 'xxx'
GROUP BY DATE(timestamp)
ORDER BY DATE(timestamp) DESC
LIMIT 30;
```

**Solutions**:

1. **Enable debugMode** to skip billing during testing:

   ```sql
   UPDATE "Workspace" SET "debugMode" = true WHERE id = 'xxx';
   ```

2. **Reduce {{PRODUCTS}} size**: Remove unnecessary fields

   ```typescript
   // Before: ~13,851 chars (3,463 tokens)
   ;`• ${code} ${name} ${formato} ~€${originalPrice}~ → €${finalPrice} - ${description} | Stock: ${icon} | ${certs} | ${supplier} | ${region} | ${transport}`// After: ~8,500 chars (2,125 tokens) - 39% reduction
   `• ${code} ${name} ${formato} €${finalPrice} | ${certs}`
   ```

3. **Rate limiting**: Add per-customer limits
   ```typescript
   const messageCount = await prisma.messages.count({
     where: {
       customerId,
       timestamp: { gte: new Date(Date.now() - 3600000) }, // Last hour
     },
   })
   if (messageCount > 20) {
     throw new Error("Rate limit exceeded")
   }
   ```

---

## Debugging Tools

### Prompt Debug Files

Location: `backend/logs/prompt-debug-*.txt`

Format: `prompt-debug-{workspaceId}-{ISO8601_timestamp}.txt`

**What to check**:

1. **{{PRODUCTS}} replaced**: Search for product codes (e.g., `FORMAG-001`)
2. **Variable count**: Verify each variable appears only once
3. **Token estimation**: Check `{{PRODUCTS}} token count: XXXX` log entry
4. **Complete product list**: Verify all expected products present

**Example**:

```bash
# Find latest debug file for workspace
ls -lt backend/logs/prompt-debug-cm9hjgq9v00014qk8fsdy4ujv-*.txt | head -1

# Check if Taleggio DOP is included
grep "Taleggio DOP" backend/logs/prompt-debug-*.txt

# Count products in CHEESES section
grep "^• FORMAG-" backend/logs/prompt-debug-*.txt | wc -l
```

---

### Integration Tests

**Run all tests**:

```bash
cd backend
npm run test:unit         # Unit tests (fast)
npm run test:security     # Security/isolation tests
npm run test:integration  # API endpoint tests (requires backend running)
npm run test:coverage     # Coverage report
```

**Specific test suites**:

```bash
# Test product search accuracy
npx ts-node scripts/test-cheese-count.ts

# Test hallucination prevention
npx ts-node scripts/test-salame-query.ts

# Test workspace isolation
npm run test:security -- --testNamePattern="workspace"
```

---

### Database Inspection

**Check product catalog**:

```sql
-- Count products by category
SELECT "category", COUNT(*) FROM "Products"
WHERE "workspaceId" = 'cm9hjgq9v00014qk8fsdy4ujv' AND "isActive" = true
GROUP BY "category";

-- Check DOP certifications
SELECT "code", "name", "certifications" FROM "Products"
WHERE "certifications" ? 'DOP' AND "isActive" = true;

-- Find cached conversations
SELECT "sessionId", "lastQuery", "productsCount", "expiresAt"
FROM "SearchConversations"
WHERE "workspaceId" = 'cm9hjgq9v00014qk8fsdy4ujv'
ORDER BY "updatedAt" DESC;
```

**Clear stale caches**:

```sql
-- Clear expired conversations
DELETE FROM "SearchConversations" WHERE "expiresAt" < NOW();

-- Clear all caches for workspace
DELETE FROM "SearchConversations" WHERE "workspaceId" = 'xxx';

-- Clear specific session
DELETE FROM "SearchConversations" WHERE "sessionId" = 'xxx';
```

---

## Emergency Procedures

### Reset Workspace Data

**⚠️ WARNING**: This deletes ALL workspace data (products, orders, customers)

```bash
cd backend
npx ts-node scripts/reset-workspace.ts {workspaceId}
```

### Restore from Backup

```bash
cd backend
npx ts-node scripts/restore-workspace-backup.ts {workspaceId}
```

**Note**: Only ONE backup per workspace (latest overwrites previous)

---

## Contact & Escalation

For issues not covered in this guide:

1. Check Constitution: `.specify/memory/constitution.md`
2. Check Copilot Instructions: `.github/copilot-instructions.md`
3. Contact Andrea (Project Owner)

---

**Version**: 1.0.0 | **Last Updated**: 2025-11-13
