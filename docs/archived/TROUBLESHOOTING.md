> ⚠️ **ARCHIVED DOCUMENTATION**  
> This troubleshooting guide may contain outdated information from Nov 2025.  
> **Status**: Superseded - Refer to current documentation  
> **Date Archived**: December 31, 2025  
> **Current Documentation**: See [PRD.md](../PRD.md) and active troubleshooting in README  
>
> ---

# eChatbot Troubleshooting Guide

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

## (file truncated for archive copy)
