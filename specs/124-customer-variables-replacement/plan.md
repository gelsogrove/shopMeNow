# Technical Plan: Customer Variables Replacement

## Overview

Implement centralized customer variable replacement in `PromptProcessorService` and integrate it into the multi-agent flow to fix the critical bug where `{{discountUser}}` and other customer-specific variables are not replaced in LLM responses.

---

## Tech Stack

**Existing Stack** (no new dependencies):
- **Backend**: Node.js 18+, TypeScript 5.x
- **Framework**: Express.js
- **ORM**: Prisma
- **LLM**: OpenRouter API (GPT-4o-mini)
- **Architecture**: Clean Architecture / DDD

**Modified Services**:
- `PromptProcessorService` (add new method)
- `LLMRouterService` (integrate replacement call)

---

## Architecture

### Current Flow (BROKEN)
```
User Message → Router → Specialist Agent → [response with {{variables}}]
                                                ↓
                                         Safety Layer (sees {{discountUser}})
                                                ↓
                                         Final Response: "discount of {{discountUser}}%"
```

### New Flow (FIXED)
```
User Message → Router → Specialist Agent → [response with {{variables}}]
                                                ↓
                                    🆕 REPLACE CUSTOMER VARIABLES
                                                ↓
                                         Replace Link Tokens
                                                ↓
                                         Safety Layer (sees "15%")
                                                ↓
                                         Final Response: "discount of 15%"
```

---

## File Structure

```
backend/src/
├── services/
│   ├── prompt-processor.service.ts    # 🔧 MODIFY: Add replaceCustomerVariables()
│   └── llm-router.service.ts          # 🔧 MODIFY: Call replacement after specialist response
├── domain/
│   └── calling-functions/
│       ├── RepeatOrder.ts             # ✅ VERIFY: Uses {{discountUser}}
│       ├── ResetCart.ts               # ✅ VERIFY: Uses {{discountUser}}
│       └── ...                        # ✅ AUDIT: Check all functions for variables
└── __tests__/
    └── unit/
        └── prompt-processor.test.ts   # 🆕 CREATE: Unit tests for new method
```

---

## Data Model

### CustomerData Interface
```typescript
interface CustomerData {
  nome: string          // → {{nameUser}}
  email: string         // → {{email}}
  phone: string         // → {{phone}}
  discountUser: number  // → {{discountUser}}
}
```

**No database changes required** - all data already available in multi-agent flow context.

---

## Implementation Details

### 1. PromptProcessorService Enhancement

**File**: `backend/src/services/prompt-processor.service.ts`

**New Method**:
```typescript
/**
 * Replace customer-specific variables in ANY text (prompts or responses)
 * 
 * @param text - Text with potential {{variables}}
 * @param customerData - Customer data from database
 * @returns Text with all variables replaced
 * 
 * @example
 * const input = "Hello {{nameUser}}, you have {{discountUser}}% discount!"
 * const output = replaceCustomerVariables(input, { nome: "Mario", discountUser: 15 })
 * // → "Hello Mario, you have 15% discount!"
 */
public replaceCustomerVariables(
  text: string,
  customerData: {
    nome: string
    email: string
    phone: string
    discountUser: number
  }
): string {
  return text
    .replace(/\{\{nameUser\}\}/g, customerData.nome || "Cliente")
    .replace(/\{\{email\}\}/g, customerData.email || "")
    .replace(/\{\{phone\}\}/g, customerData.phone || "")
    .replace(/\{\{discountUser\}\}/g, String(customerData.discountUser || 0))
    .replace(/\{\{TOKEN_DURATION\}\}/g, this.formatTokenDuration(process.env.TOKEN_EXPIRATION || "1h"))
}

/**
 * Format token duration from env var (e.g., "15m" → "15 minutes")
 */
private formatTokenDuration(duration: string): string {
  const match = duration.match(/^(\d+)([mh])$/)
  if (!match) return "15 minutes"
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  if (unit === 'm') return value === 1 ? "1 minute" : `${value} minutes`
  if (unit === 'h') return value === 1 ? "1 hour" : `${value} hours`
  
  return "15 minutes"
}
```

**Why in PromptProcessorService?**
- Already handles variable replacement for prompts
- Centralized location for all template processing
- Easy to extend with new variables

---

### 2. LLMRouterService Integration

**File**: `backend/src/services/llm-router.service.ts`

**Location**: After line 664 (after `{{TOKEN_DURATION}}` replacement, before Safety layer)

**Changes**:
```typescript
// STEP 4.5: Replace {{TOKEN_DURATION}} variable
const tokenDuration = this.formatTokenDuration(
  process.env.TOKEN_EXPIRATION || "1h"
)
responseWithLinks = responseWithLinks.replace(
  /\{\{TOKEN_DURATION\}\}/g,
  tokenDuration
)
logger.info(`✅ Replaced {{TOKEN_DURATION}} with: ${tokenDuration}`)

// 🆕 STEP 4.6: Replace customer-specific variables
// This fixes the critical bug where {{discountUser}}, {{nameUser}}, etc.
// were not replaced in specialist agent responses
const customerData = {
  nome: params.customerName,
  email: customer.email,
  phone: customer.phone,
  discountUser: customer.discount || 0,
}

responseWithLinks = this.promptProcessor.replaceCustomerVariables(
  responseWithLinks,
  customerData
)

logger.info("✅ Replaced customer variables", {
  nameUser: customerData.nome,
  discountUser: customerData.discountUser,
  responsePreview: responseWithLinks.substring(0, 150),
})

// STEP 5: Apply Safety & Translation Layer
// Now processes the response WITH customer variables already replaced
```

**Dependencies**:
- `customer` object already loaded (line ~390)
- `params.customerName` already available
- `this.promptProcessor` already injected in constructor

---

### 3. Calling Functions Audit

**Files to Check**:
- `RepeatOrder.ts` - Uses `{{discountUser}}` (line 335) ✅ CONFIRMED
- `ResetCart.ts` - Uses `{{discountUser}}` (line 211) ✅ CONFIRMED
- `AddToCart.ts` - Check for variables
- `RemoveFromCart.ts` - Check for variables
- `SearchProducts.ts` - Check for variables
- `TrackOrder.ts` - Check for variables

**Action**: Grep search to find ALL variable usage across calling functions.

---

## Testing Strategy

### Unit Tests

**File**: `backend/__tests__/unit/prompt-processor.test.ts`

**Test Cases**:
```typescript
describe('PromptProcessorService.replaceCustomerVariables', () => {
  it('should replace {{nameUser}} with customer name', () => {
    const result = service.replaceCustomerVariables(
      "Hello {{nameUser}}!",
      { nome: "Mario", email: "", phone: "", discountUser: 0 }
    )
    expect(result).toBe("Hello Mario!")
  })

  it('should replace {{discountUser}} with discount value', () => {
    const result = service.replaceCustomerVariables(
      "You have {{discountUser}}% discount",
      { nome: "", email: "", phone: "", discountUser: 15 }
    )
    expect(result).toBe("You have 15% discount")
  })

  it('should replace ALL occurrences of same variable', () => {
    const result = service.replaceCustomerVariables(
      "{{nameUser}}, your discount is {{discountUser}}%. Thanks {{nameUser}}!",
      { nome: "Mario", email: "", phone: "", discountUser: 10 }
    )
    expect(result).toBe("Mario, your discount is 10%. Thanks Mario!")
  })

  it('should handle missing discount (use 0)', () => {
    const result = service.replaceCustomerVariables(
      "Discount: {{discountUser}}%",
      { nome: "", email: "", phone: "", discountUser: 0 }
    )
    expect(result).toBe("Discount: 0%")
  })

  it('should replace {{TOKEN_DURATION}} from env', () => {
    process.env.TOKEN_EXPIRATION = "15m"
    const result = service.replaceCustomerVariables(
      "Link valid for {{TOKEN_DURATION}}",
      { nome: "", email: "", phone: "", discountUser: 0 }
    )
    expect(result).toBe("Link valid for 15 minutes")
  })
})
```

---

### Integration Test

**File**: `backend/__tests__/integration/customer-variables.test.ts`

**Test Case**:
```typescript
describe('Multi-Agent Flow - Customer Variables', () => {
  it('should replace {{discountUser}} in repeat order flow', async () => {
    // Setup: Customer with 15% discount
    const customer = await createTestCustomer({ discount: 15 })
    
    // Action: Send "repeat last order" message
    const response = await llmRouter.routeMessage({
      message: "I want to repeat my last order",
      customerId: customer.id,
      workspaceId: testWorkspace.id,
      customerName: customer.nome,
      customerLanguage: "en",
    })
    
    // Assert: Response has actual discount, not {{discountUser}}
    expect(response.finalResponse).toContain("15%")
    expect(response.finalResponse).not.toContain("{{discountUser}}")
  })
})
```

---

### Manual E2E Test

1. **Restart backend**: `npm run dev`
2. **Send message**: "I want to repeat my last order please"
3. **Verify response**: Should show "You have a discount of 15%" (not `{{discountUser}}`)
4. **Check Message Flow Timeline**:
   - Router → ORDER_TRACKING → Safety
   - No "Router (validation-only)" step visible
   - PROMPT appears BEFORE INPUT
5. **Check backend logs**: Should show "✅ Replaced customer variables"

---

## Performance Considerations

### Expected Impact

- **Latency**: +2ms (5 regex replacements)
- **Memory**: +1KB (string operations)
- **Database**: 0 additional queries (uses existing customer data)

### Optimization

- Regex patterns pre-compiled (global flag `/g`)
- Replacement happens ONCE per request (not per agent)
- No async operations (synchronous string manipulation)

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate**: Comment out lines calling `replaceCustomerVariables()` in llm-router.service.ts
2. **Temporary**: Variables will show as `{{discountUser}}` again (known bug, but not critical)
3. **Investigation**: Check logs for errors, verify customer data format
4. **Fix Forward**: Add error handling around replacement call

**Rollback Code**:
```typescript
// TEMPORARY ROLLBACK: Comment this block if replacement causes issues
// responseWithLinks = this.promptProcessor.replaceCustomerVariables(
//   responseWithLinks,
//   customerData
// )
```

---

## Security Considerations

### Input Validation

- Customer data comes from **database** (trusted source)
- No user input directly injected into variables
- Email/phone already sanitized by Prisma schema

### XSS Prevention

- Variables replaced in **backend** before sending to frontend
- Safety layer validates final response (no malicious content)
- Customer data already validated on write (Prisma schema constraints)

**No additional security measures required** - existing protections sufficient.

---

## Deployment Steps

1. ✅ **Test locally**: Run unit tests, integration tests, manual E2E
2. ✅ **Code review**: Verify changes in PR
3. ✅ **Merge to main**: After approval
4. ✅ **Deploy backend**: Restart backend service with new code
5. ✅ **Monitor logs**: Check for "✅ Replaced customer variables" messages
6. ✅ **Test production**: Send test message from admin account
7. ✅ **Verify metrics**: No increase in errors, latency remains <500ms

---

## Dependencies

**No new packages required** - uses existing:
- `@prisma/client` (already installed)
- Built-in `String.prototype.replace()`

---

## Backward Compatibility

### Breaking Changes

**NONE** - This is an additive change:
- New method added to PromptProcessorService
- Existing `replaceAllVariables()` unchanged
- No changes to public API or database schema

### Migration Required

**NO** - Existing code continues to work without modification.

---

## Monitoring

### Metrics to Track

1. **Error Rate**: Check for errors in `replaceCustomerVariables()` calls
2. **Variable Coverage**: Log which variables were replaced per request
3. **Performance**: Track replacement execution time (should be <5ms)

### Log Examples

```
✅ Replaced customer variables { nameUser: "Mario Rossi", discountUser: 15 }
⚠️ Customer missing email - replaced with empty string
```

---

## Future Enhancements

1. **Dynamic Variable Registry**: Allow adding variables without code changes
2. **Variable Validation**: Warn if unknown variable used in calling function
3. **Localization**: Format numbers/dates based on customer language
4. **Audit Trail**: Track which variables were replaced in debugInfo

---

## References

- **Spec**: `specs/124-customer-variables-replacement/spec.md`
- **Constitution**: `.specify/memory/constitution.md` (Principle I)
- **Related Feature**: Validation-Only Router Pattern (v1.8.0)
- **Bug Report**: Router duplicates responses, variables not replaced

---

## Version

- Plan Version: 1.0.0
- Created: 2025-11-13
- Feature ID: 124
- Estimated Effort: 2 hours (including testing)
