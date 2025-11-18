# Feature Specification: Token Expiration Variable in Prompts

**Feature Branch**: `175-token-expiration-variable`  
**Created**: 2025-11-18  
**Status**: Draft  
**Input**: User description: "dentro .env abbiamo TOKEN_EXPIRATION e dovrebbe essere una variabili che abdiamo a sostituire dentro il prompt...pensavo gia' funzionasse cosi....puopi verificare se e' cosi ? puoi verificare che fuzniona in tutti i prompt? puoi verificare che non ci siano variabili con altri nomi e che il replace funziona in tutti i casi miraccomando il replace lo deve fare prima di inviarlo a opernotuer forsedovrebbe esserre. {{token_expiration}} e il valore lo prende da .env"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Token Duration Display in Agent Responses (Priority: P1)

When an AI agent sends a secure link to a customer (order link, profile link, checkout link), the response must display the correct token expiration time based on the `TOKEN_EXPIRATION` environment variable value (e.g., "1h", "30m", "2h").

**Why this priority**: Critical for customer trust and security transparency. Customers need to know how long their secure links remain valid. Without this, customers may try to use expired links or rush unnecessarily.

**Independent Test**: Can be fully tested by triggering any calling function that generates secure links (e.g., `GetOrderDetails`, `GetProfile`, `GetCheckout`) and verifying the LLM response contains the correct human-readable duration from `.env`.

**Acceptance Scenarios**:

1. **Given** `TOKEN_EXPIRATION="1h"` in `.env` **When** customer requests order details **Then** LLM response shows "Il link è valido per 1 ora" (or equivalent in customer's language)
2. **Given** `TOKEN_EXPIRATION="30m"` in `.env` **When** customer requests profile **Then** LLM response shows "Il link è valido per 30 minuti"
3. **Given** `TOKEN_EXPIRATION="2h"` in `.env` **When** customer requests checkout **Then** LLM response shows "Il link è valido per 2 ore"
4. **Given** agent prompt contains `{{TOKEN_DURATION}}` **When** prompt is processed **Then** variable is replaced BEFORE sending to OpenRouter

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: No changes needed (backend-only feature)
- [x] Backend API: No new routes (uses existing prompt processing)
- [x] Service Layer: `PromptProcessorService.replaceCustomerVariables()` already handles `{{TOKEN_DURATION}}`
- [ ] Repository: Verify all agent prompts use consistent variable name
- [ ] Database: Verify `agentConfig` table prompts use `{{TOKEN_DURATION}}` (not other names)
- [x] Security: No security changes (uses existing workspace isolation)
- [ ] Testing: Unit tests for variable replacement with different `.env` values
- [ ] Documentation: Document `{{TOKEN_DURATION}}` variable in prompt guidelines
- [x] Concurrency: No concurrency concerns (read-only operation)
- [x] Prompt Variables: `{{TOKEN_DURATION}}` is small (not subject to duplication constraint)
- [x] Code Cleanliness: No new files, only verification/fixes

---

### User Story 2 - Consistent Variable Naming Across All Prompts (Priority: P2)

All agent prompts in the database use the same variable name `{{TOKEN_DURATION}}` (not `{{token_expiration}}`, `{{TOKEN_EXPIRATION}}`, or other variants) to ensure consistent replacement.

**Why this priority**: Prevents bugs where some prompts show raw variable names to customers due to naming mismatches. Important for quality but can be fixed retroactively.

**Independent Test**: Can be tested by querying `agentConfig` table and grep-searching all prompts for token-related variables, verifying only `{{TOKEN_DURATION}}` is used.

**Acceptance Scenarios**:

1. **Given** all agent prompts in database **When** searched for `{{.*}}` patterns **Then** token duration uses only `{{TOKEN_DURATION}}` (no `{{TOKEN_EXPIRATION}}`, `{{token_expiration}}`, etc.)
2. **Given** new agent prompt is saved **When** prompt contains `{{TOKEN_EXPIRATION}}` **Then** validation error suggests using `{{TOKEN_DURATION}}` instead

---

### Edge Cases

- What happens when `TOKEN_EXPIRATION` is missing from `.env`? → System uses fallback "1h" (already implemented)
- What happens when `TOKEN_EXPIRATION` has invalid format (e.g., "invalid")? → `formatTokenDuration()` should handle gracefully or default to "1 ora"
- What happens when prompt uses `{{TOKEN_EXPIRATION}}` instead of `{{TOKEN_DURATION}}`? → Variable not replaced, customer sees raw `{{TOKEN_EXPIRATION}}` text
- What happens when admin updates `TOKEN_EXPIRATION` in `.env` while app is running? → PM2 restart required to load new value (document this)

## Requirements _(mandatory)_

### Functional Requirements

**FR-1: Variable Replacement Before LLM Call**

- System MUST replace `{{TOKEN_DURATION}}` with human-readable duration BEFORE sending prompt to OpenRouter
- Replacement happens in `PromptProcessorService.replaceCustomerVariables()` method
- Source value: `process.env.TOKEN_EXPIRATION` (e.g., "1h", "30m", "2h")
- Output format: Human-readable Italian text (e.g., "1 ora", "30 minuti", "2 ore")
- Language-agnostic: Translation to customer's language handled by Safety Translation agent

**FR-2: Consistent Variable Naming**

- All agent prompts in `agentConfig` table MUST use `{{TOKEN_DURATION}}` (standardized name)
- System MUST NOT use: `{{TOKEN_EXPIRATION}}`, `{{token_expiration}}`, `{{tokenExpiration}}`, or other variants
- Existing prompts using wrong variable names MUST be identified and corrected

**FR-3: Graceful Fallback**

- If `TOKEN_EXPIRATION` is missing from `.env`, system defaults to "1h"
- If `TOKEN_EXPIRATION` has invalid format, system defaults to "1 ora" and logs warning
- System MUST NOT crash or show errors to customers due to missing/invalid token duration

## Success Criteria _(mandatory)_

1. **Variable Replacement Works**: When admin sets `TOKEN_EXPIRATION="30m"` in `.env`, all LLM responses containing `{{TOKEN_DURATION}}` show "30 minuti" (or translated equivalent)

2. **No Raw Variables**: 0% of customer-facing LLM responses contain unreplaced `{{TOKEN_DURATION}}` or `{{TOKEN_EXPIRATION}}`

3. **Consistent Naming**: 100% of agent prompts use `{{TOKEN_DURATION}}` (verified via grep search)

## Dependencies _(mandatory)_

**Internal Dependencies:**
- Existing `PromptProcessorService.replaceCustomerVariables()` method (already implements `{{TOKEN_DURATION}}`)
- Existing `PromptProcessorService.formatTokenDuration()` method (converts "1h" to "1 ora")

**Blockers:**
- None (verification/fix only)

## Assumptions _(mandatory)_

1. `{{TOKEN_DURATION}}` replacement is already implemented (verified in code)
2. Some prompts may use incorrect variable names needing correction
3. Admins know to restart PM2 after `.env` changes
4. Italian output is OK (Safety Translation handles language conversion)

## Out of Scope _(mandatory)_

- Admin UI for token duration (remains `.env`-based)
- Dynamic per-customer token duration
- Automatic prompt migration (manual admin update)
- Real-time `.env` reload (requires PM2 restart)
