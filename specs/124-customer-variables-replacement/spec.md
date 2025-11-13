# Customer Variables Replacement in LLM Responses

## Problem Statement

**CRITICAL BUG**: Customer-specific variables like `{{discountUser}}`, `{{nameUser}}`, `{{email}}`, `{{phone}}` are **not being replaced** in LLM-generated responses in the multi-agent flow.

**Evidence**:
```
User message: "I want to repeat my last order please"
LLM response: "💡 Remember: You have a discount of {{discountUser}}% applied automatically! 🎉"
                                                      ^^^^^^^^^^^^^^
                                                      NOT REPLACED!
```

**Root Cause**:
- `PromptProcessorService.replaceAllVariables()` is called ONLY for **system prompts** (before LLM call)
- Variables in **LLM responses** (from calling functions like `RepeatOrder.ts`) are NEVER replaced
- Old `llm.service.ts` had this replacement (line 1793), but new `llm-router.service.ts` does NOT

**Constitution Violation**:
- **Principle I**: "NEVER use hardcoded fallbacks, default values, or mock data"
- Showing `{{discountUser}}` to customer is effectively showing mock data

---

## Requirements

### FR-1: Replace Customer Variables in ALL Text
**Priority**: CRITICAL  
**Description**: Any text sent to customer MUST have customer-specific variables replaced with actual database values.

**Variables to Replace**:
- `{{nameUser}}` → Customer.nome (e.g., "Mario Rossi")
- `{{email}}` → Customer.email (e.g., "mario@example.com")
- `{{phone}}` → Customer.phone (e.g., "+39 123 456 7890")
- `{{discountUser}}` → Customer.discount (e.g., "15")
- `{{TOKEN_DURATION}}` → Formatted token expiration (e.g., "15 minutes")

**Acceptance Criteria**:
- ✅ All variables replaced in final customer-facing response
- ✅ Replacement works for system prompts (already working)
- ✅ Replacement works for LLM responses (NEW - currently broken)
- ✅ No placeholder tokens visible in UI or WhatsApp messages

---

### FR-2: Centralized Replacement Logic
**Priority**: HIGH  
**Description**: Avoid code duplication by centralizing variable replacement in `PromptProcessorService`.

**Requirements**:
- Single source of truth for variable names and replacement patterns
- Reusable method callable from multiple services
- Easy to add new variables in the future

**Acceptance Criteria**:
- ✅ `PromptProcessorService.replaceCustomerVariables(text, customerData)` method exists
- ✅ Used in multi-agent flow (llm-router.service.ts)
- ✅ Used in specialist agents (ProductSearch, Cart, OrderTracking, CustomerSupport)
- ✅ Consistent behavior across all LLM services

---

### FR-3: Replacement in Multi-Agent Flow
**Priority**: CRITICAL  
**Description**: Variables MUST be replaced AFTER specialist agents generate responses, but BEFORE Safety & Translation layer.

**Execution Order**:
1. Router delegates to specialist agent
2. Specialist returns response (may contain `{{variables}}`)
3. **🆕 REPLACE customer variables** ← NEW STEP
4. Replace link tokens ([LINK_XXX])
5. Safety & Translation layer
6. Final response to customer

**Acceptance Criteria**:
- ✅ Replacement happens after specialist response (line ~665 in llm-router.service.ts)
- ✅ Replacement happens BEFORE Safety layer
- ✅ Replacement logged in debugInfo (optional debug step)

---

### NFR-1: Performance
**Priority**: MEDIUM  
**Description**: Variable replacement should be fast (string operations only, no database calls).

**Requirements**:
- No additional database queries (use already-loaded customer data)
- Simple regex replacements (`.replace(/{{var}}/g, value)`)
- Total overhead < 5ms per request

**Acceptance Criteria**:
- ✅ No new database queries introduced
- ✅ Replacement time < 5ms (measured in logs)

---

### NFR-2: Backward Compatibility
**Priority**: HIGH  
**Description**: Existing code using `PromptProcessorService` should continue to work without changes.

**Requirements**:
- `replaceAllVariables()` method unchanged (still replaces variables in prompts)
- New `replaceCustomerVariables()` method is additive (doesn't break existing code)

**Acceptance Criteria**:
- ✅ All existing tests still pass
- ✅ No breaking changes to PromptProcessorService interface

---

## User Stories

### US-1: Customer Sees Actual Discount
**As a** customer  
**I want** to see my actual discount percentage in messages  
**So that** I know exactly what savings I have

**Example**:
```
❌ OLD: "You have a discount of {{discountUser}}% applied!"
✅ NEW: "You have a discount of 15% applied!"
```

---

### US-2: Developer Adds New Variable Easily
**As a** developer  
**I want** to add new customer variables in one place  
**So that** I don't have to update multiple services

**Example**:
```typescript
// Add to PromptProcessorService.replaceCustomerVariables()
.replace(/\{\{loyaltyPoints\}\}/g, String(customerData.loyaltyPoints || 0))

// Automatically works in all agents!
```

---

## Edge Cases

### EC-1: Missing Customer Data
**Scenario**: Customer has no discount set (null or undefined)  
**Expected**: Replace with "0" or sensible default  
**Implementation**:
```typescript
.replace(/\{\{discountUser\}\}/g, String(customerData.discountUser || 0))
```

---

### EC-2: Variable Used Multiple Times
**Scenario**: `{{discountUser}}` appears 3 times in one message  
**Expected**: ALL occurrences replaced  
**Implementation**: Use global regex flag `/g`

---

### EC-3: Variable Not in Customer Data
**Scenario**: Future variable `{{membershipLevel}}` used but not yet implemented  
**Expected**: Leave as-is (visible in logs for debugging)  
**Alternative**: Replace with empty string or "N/A"

---

## Out of Scope

- ❌ Variable replacement in database-stored prompts (already handled by `replaceAllVariables()`)
- ❌ Variable replacement in frontend (variables only in backend responses)
- ❌ Complex variable expressions (e.g., `{{discount * 2}}` - not supported, use simple tokens only)
- ❌ Localization of variable values (e.g., formatting numbers/dates - handled separately)

---

## Success Metrics

1. **Bug Resolution**: Zero instances of `{{variableName}}` visible in production customer messages
2. **Test Coverage**: 100% coverage for `replaceCustomerVariables()` method
3. **Performance**: Variable replacement adds <5ms to request latency
4. **Code Quality**: Zero duplication of replacement logic across services

---

## References

- **Constitution Principle I**: Database-First Architecture (no hardcoded values)
- **Bug Report**: Customer saw `{{discountUser}}` in "repeat order" flow
- **Related Code**:
  - `backend/src/services/prompt-processor.service.ts` (line 212: existing replacement in prompts)
  - `backend/src/services/llm-router.service.ts` (line 656: replacement site for responses)
  - `backend/src/domain/calling-functions/RepeatOrder.ts` (line 335: variable usage)
  - OLD `backend/src/services/llm.service.ts` (line 1793: legacy replacement logic)

---

## Implementation Priority

**CRITICAL** - Blocks PR for Constitution v1.8.0 (Validation-Only Router Pattern)

**Timeline**:
- Spec creation: 10 min
- Plan creation: 10 min
- Tasks generation: 5 min
- Implementation: 15 min
- Testing: 10 min
- **Total**: ~50 minutes

---

## Version

- Spec Version: 1.0.0
- Created: 2025-11-13
- Feature ID: 124
- Related Issue: Constitution Principle I Violation
