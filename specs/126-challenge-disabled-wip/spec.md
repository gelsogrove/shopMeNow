# Feature Specification: Challenge Disabled WIP Message Flow

**Feature Branch**: `126-challenge-disabled-wip`  
**Created**: 2025-11-14  
**Status**: Draft  
**Input**: User description: "Workspace challenge disabled WIP message flow with security layer integration"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Blocked User Immediate Exit (Priority: P1)

**Description**: When a blocked customer sends a message, the system must immediately terminate the flow without executing any LLM logic, saving to history, or sending responses.

**Why this priority**: Security critical - prevents blocked users from consuming resources or receiving service. This is the highest-priority check that supersedes all other logic (WIP, welcome, challenge states).

**Independent Test**: Block a customer via Admin UI, send WhatsApp message from that customer, verify no LLM processing occurs, no message saved in database, no response sent.

**Acceptance Scenarios**:

1. **Given** customer is marked as blocked (isBlacklisted=true), **When** customer sends any WhatsApp message, **Then** system exits immediately without LLM processing, message history save, or response delivery
2. **Given** customer is blocked, **When** webhook receives message, **Then** system logs blocking event and returns 200 OK without further processing
3. **Given** customer is blocked and challenge is disabled, **When** message arrives, **Then** blocked status takes precedence over WIP message logic

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: N/A (backend-only flow)
- [x] Backend API: Webhook endpoint early-exit logic for blocked customers
- [x] Service Layer: Block check BEFORE any other business logic (WIP, welcome, LLM)
- [x] Repository: Efficient query to check customer.isBlacklisted status
- [x] Database: No migration needed (isBlacklisted field exists)
- [x] Security: No auth required (public webhook), workspace isolation via customer lookup
- [x] Testing: Unit test for blocked user immediate exit, no LLM mock called
- [x] Documentation: Update webhook flow documentation with block check precedence
- [x] Concurrency: No special handling needed (read-only check)
- [x] Prompt Variables: N/A (no LLM execution for blocked users)
- [x] Code Cleanliness: Single responsibility function for block check

---

### User Story 2 - Challenge Disabled WIP Message Delivery (Priority: P2)

**Description**: When workspace challenge is disabled and customer sends a message, system sends the configured WIP message through security layer to WhatsApp without LLM processing or history save.

**Why this priority**: Core feature requirement - allows workspace to communicate "service temporarily unavailable" to customers when AI challenge is turned off. Must pass through security layer for validation and translation.

**Independent Test**: Disable challenge via workspace settings, send message as customer, verify WIP message returned (in customer's language), no LLM processing, no message saved to history.

**Acceptance Scenarios**:

1. **Given** workspace challenge is disabled (challenge.disabled=true), **When** non-blocked customer sends message, **Then** system loads workspace.wip_message, passes through security layer, sends to WhatsApp, exits without LLM/history
2. **Given** workspace wip_message is "Servizio momentaneamente non disponibile" and customer language is Spanish, **When** challenge disabled message sent, **Then** security layer translates to "Servicio temporalmente no disponible"
3. **Given** workspace wip_message is empty/null, **When** challenge disabled, **Then** system uses default fallback message "Service temporarily unavailable"
4. **Given** challenge is disabled and customer is NOT blocked, **When** message received, **Then** WIP logic executes (blocked check already passed in P1)

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Admin UI displays workspace.wip_message as plain string (not [object Object]), editable in settings
- [ ] Backend API: GET/PUT /workspaces/:id/settings returns wip_message as string
- [ ] Service Layer: Challenge disabled check → load wip_message → pass to security layer → send to WhatsApp
- [ ] Repository: Fetch workspace.wip_message efficiently (single query with workspace settings)
- [ ] Database: Verify wip_message stored as TEXT/VARCHAR, not JSON object
- [ ] Security: Security layer receives raw string, validates, translates to customer language
- [ ] Testing: Unit test for challenge disabled flow, mock security layer translation
- [ ] Documentation: Document challenge.disabled check position in message flow
- [ ] Concurrency: No special handling (read-only workspace settings)
- [ ] Prompt Variables: N/A (WIP message is plain text, not LLM prompt)
- [ ] Code Cleanliness: Extract challenge check to separate function for readability

---

### User Story 3 - New User Welcome Message (Priority: P3)

**Description**: When a new customer sends their first message, system delivers the configured welcome message through security layer (for translation) before processing the actual message content.

**Why this priority**: User onboarding - existing behavior that MUST NOT be broken by new changes. Lower priority because it's already implemented and stable.

**Independent Test**: Create new customer record, send first message, verify welcome_message delivered in customer's language, then actual message processed normally.

**Acceptance Scenarios**:

1. **Given** customer is new (no prior messages in system), **When** first message received, **Then** welcome_message sent through security layer, translated to customer language, delivered to WhatsApp
2. **Given** workspace welcome_message is "Benvenuto!" and customer language is Portuguese, **When** new customer sends message, **Then** security layer translates to "Bem-vindo!"
3. **Given** welcome message sent successfully, **When** flow continues, **Then** original customer message processed normally through LLM Router

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Admin UI displays workspace.welcome_message as plain string, editable
- [ ] Backend API: GET/PUT /workspaces/:id/settings includes welcome_message field
- [ ] Service Layer: New customer detection → send welcome → continue to LLM Router
- [ ] Repository: Efficient check for new customer (message count = 0 for customerId)
- [ ] Database: Verify welcome_message stored as TEXT/VARCHAR
- [ ] Security: Security layer handles welcome message same as WIP message
- [ ] Testing: Unit test for new customer welcome flow, verify LLM still processes original message
- [ ] Documentation: Clarify welcome message does not replace LLM processing
- [ ] Concurrency: Transaction to prevent race condition (two simultaneous first messages)
- [ ] Prompt Variables: N/A (welcome message is plain text)
- [ ] Code Cleanliness: Reuse security layer helper for both welcome and WIP messages

---

### Edge Cases

- **What happens when workspace.wip_message is null/empty?**  
  System uses hardcoded fallback: "Service temporarily unavailable" (English), then security layer translates.

- **What happens when challenge is disabled AND customer is new?**  
  Blocked check (P1) → Challenge disabled check (P2) → WIP message sent. Welcome message is NOT sent (challenge disabled takes precedence).

- **What happens when security layer rejects WIP/welcome message?**  
  Log error, send generic fallback message "We're experiencing technical difficulties", continue flow or exit based on context.

- **What happens when customer is blocked mid-conversation (blocked after sending message)?**  
  Next message from that customer triggers blocked check (P1), flow exits immediately.

- **What happens when challenge is re-enabled after being disabled?**  
  Next message processes normally through LLM Router (challenge disabled check fails, flow continues).

- **What happens if workspace settings fail to load?**  
  Error logged, system assumes challenge enabled (safe default), processes message through LLM Router.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST check customer.isBlacklisted BEFORE any other processing (WIP, welcome, LLM, history save)
- **FR-002**: System MUST exit immediately when customer is blocked, without LLM execution, message save, or response delivery
- **FR-003**: System MUST check workspace.challenge.disabled status AFTER blocked check, BEFORE LLM processing
- **FR-004**: System MUST load workspace.wip_message when challenge is disabled and send through security layer
- **FR-005**: System MUST NOT save customer message to history when challenge is disabled (WIP message flow)
- **FR-006**: System MUST NOT execute LLM Router when challenge is disabled (WIP message flow)
- **FR-007**: System MUST pass wip_message and welcome_message through security layer for validation and translation
- **FR-008**: System MUST store wip_message and welcome_message as plain TEXT strings, not JSON objects
- **FR-009**: Admin UI MUST display wip_message and welcome_message as editable plain strings (not "[object Object]")
- **FR-010**: System MUST use default fallback "Service temporarily unavailable" when wip_message is null/empty
- **FR-011**: System MUST maintain existing welcome message behavior for new customers when challenge is enabled
- **FR-012**: System MUST prioritize checks in order: Blocked (P1) → Challenge Disabled (P2) → Welcome (P3) → Normal LLM Flow

### Key Entities _(include if feature involves data)_

- **Workspace Settings**: Contains challenge.disabled (boolean), wip_message (TEXT), welcome_message (TEXT), email (required field)
- **Customer**: Contains isBlacklisted (boolean), language preference (for translation), message history count (for new user detection)
- **Challenge**: Workspace-level configuration with disabled (boolean) flag to control AI availability
- **Security Layer**: Validates and translates messages to customer's language before delivery to WhatsApp

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Blocked customers receive zero LLM responses within 100ms of webhook receipt (immediate exit)
- **SC-002**: WIP message delivered to customers within 500ms when challenge disabled (no LLM processing delay)
- **SC-003**: 100% of WIP/welcome messages correctly translated to customer's language via security layer
- **SC-004**: Zero messages saved to history when challenge is disabled (verify via database query)
- **SC-005**: Admin UI displays workspace messages as plain text, not "[object Object]", with successful edit/save
- **SC-006**: 100% of existing unit tests pass after implementation (no regression in welcome message, new user flow)
- **SC-007**: Challenge disabled check adds <50ms overhead to message processing (measured via performance profiling)
- **SC-008**: System handles 1000 messages/minute with challenge disabled without performance degradation

## Assumptions

- Security layer already exists and handles message validation + translation (no changes needed)
- Workspace settings GET/PUT endpoints already exist (only need to verify wip_message/welcome_message representation)
- Customer language preference is already captured in database (used by security layer for translation)
- WhatsApp delivery mechanism is abstracted and works same for LLM responses and WIP/welcome messages
- Database schema allows TEXT storage for wip_message and welcome_message (migration may be needed if currently JSON)

## Dependencies

- **Security Layer Service**: Must be functional for message validation and translation
- **Workspace Settings API**: Must correctly serialize/deserialize plain text strings (not JSON objects)
- **Customer Repository**: Must efficiently query isBlacklisted status and message count
- **WhatsApp Webhook Handler**: Entry point for all message processing logic

## Out of Scope

- Modifying security layer translation logic (already functional)
- Changing welcome message delivery mechanism for new users (existing behavior preserved)
- Adding retry logic for failed WIP message delivery (use existing error handling)
- Creating admin UI for challenge enable/disable toggle (assumed already exists)
- Implementing A/B testing for different WIP message variations
- Adding analytics/telemetry for WIP message delivery (can be added in future iteration)

## Technical Notes

### Flow Priority Order (CRITICAL)

```
1. Webhook receives message
2. Load customer record
3. ✅ CHECK: customer.isBlacklisted?
   → YES: Exit immediately (P1)
   → NO: Continue
4. Load workspace settings
5. ✅ CHECK: workspace.challenge.disabled?
   → YES: Load wip_message → Security Layer → WhatsApp → Exit (P2)
   → NO: Continue
6. ✅ CHECK: Is new customer? (message count = 0)
   → YES: Send welcome_message → Security Layer → WhatsApp → Continue to LLM (P3)
   → NO: Continue to LLM
7. Normal LLM Router processing
8. Save message to history
9. Send LLM response to WhatsApp
```

### Security Layer Integration

```typescript
// Pseudo-code for WIP/welcome message flow
async function sendSystemMessage(message: string, customerId: string, workspaceId: string) {
  const customer = await customerRepo.findById(customerId)
  const securityResult = await securityLayer.validate({
    message,
    targetLanguage: customer.language,
    workspaceId
  })
  
  if (securityResult.approved) {
    await whatsappService.send({
      to: customer.phone,
      message: securityResult.translatedMessage
    })
  } else {
    // Log rejection, send fallback message
    await whatsappService.send({
      to: customer.phone,
      message: "We're experiencing technical difficulties"
    })
  }
}
```

### Database Schema Verification

Ensure workspace settings schema:
```sql
-- Verify these fields exist and are TEXT/VARCHAR (not JSON)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workspace' 
AND column_name IN ('wip_message', 'welcome_message', 'email');
```

If stored as JSON, migration needed:
```sql
-- Example migration (if needed)
ALTER TABLE workspace 
  ALTER COLUMN wip_message TYPE TEXT,
  ALTER COLUMN welcome_message TYPE TEXT;
```

## Testing Strategy

### Phase 1: Validate Existing Flow (Pre-Implementation)

**Goal**: Ensure current system is 100% stable before modifications.

**Tasks**:
1. Run existing unit tests for:
   - New user welcome message flow
   - Blocked user behavior (if exists)
   - Normal LLM message processing
2. Identify missing tests for current behavior:
   - Welcome message translation via security layer
   - New customer detection logic
   - Workspace settings retrieval
3. Add missing unit tests for current flow
4. Ensure ALL tests pass before proceeding to Phase 2

**Exit Criteria**: 100% of existing unit tests pass, no regressions.

---

### Phase 2: Add Tests for New Behavior (Pre-Implementation)

**Goal**: Define expected behavior via tests BEFORE writing implementation code.

**New Unit Tests Required**:

1. **Blocked User Immediate Exit**
   \`\`\`typescript
   it('should exit immediately when customer is blocked', async () => {
     // Mock customer.isBlacklisted = true
     // Send message
     // Assert: LLM Router NOT called
     // Assert: No message saved to database
     // Assert: No WhatsApp response sent
   })
   \`\`\`

2. **Challenge Disabled → WIP Message Flow**
   \`\`\`typescript
   it('should send WIP message when challenge disabled', async () => {
     // Mock workspace.challenge.disabled = true
     // Mock workspace.wip_message = "Servizio non disponibile"
     // Mock customer.language = "es"
     // Send message
     // Assert: Security layer called with wip_message
     // Assert: WhatsApp receives translated message "Servicio no disponible"
     // Assert: LLM Router NOT called
     // Assert: No message saved to history
   })
   \`\`\`

3. **Blocked User Overrides Challenge Disabled**
   \`\`\`typescript
   it('should prioritize blocked check over challenge disabled', async () => {
     // Mock customer.isBlacklisted = true
     // Mock workspace.challenge.disabled = true
     // Send message
     // Assert: Flow exits at blocked check
     // Assert: WIP message NOT sent
     // Assert: Security layer NOT called
   })
   \`\`\`

4. **Challenge Disabled Overrides Welcome Message**
   \`\`\`typescript
   it('should send WIP message instead of welcome when challenge disabled for new customer', async () => {
     // Mock new customer (message count = 0)
     // Mock workspace.challenge.disabled = true
     // Send message
     // Assert: WIP message sent
     // Assert: Welcome message NOT sent
   })
   \`\`\`

5. **Workspace Settings Plain Text Representation**
   \`\`\`typescript
   it('should store and retrieve wip_message as plain string', async () => {
     // Create workspace with wip_message = "Test message"
     // Fetch workspace settings
     // Assert: typeof workspace.wip_message === 'string'
     // Assert: workspace.wip_message !== '[object Object]'
   })
   \`\`\`

**Exit Criteria**: All new tests written and failing (expected, since feature not implemented yet).

---

### Phase 3: Implement New Behavior

**Goal**: Safely add challenge disabled check without breaking existing flow.

**Implementation Order**:
1. Add challenge disabled check AFTER blocked check, BEFORE welcome/LLM logic
2. Implement WIP message loading from workspace settings
3. Integrate security layer call for WIP message
4. Add early exit after WIP message sent (no LLM, no history)
5. Verify workspace settings schema (TEXT vs JSON)
6. Update seed script with valid email field

**Exit Criteria**: All tests (Phase 1 + Phase 2) pass.

---

### Phase 4: Final Validation

**Goal**: Confirm no regressions and new behavior works correctly.

**Tasks**:
1. Run full test suite (unit + integration)
2. Manual testing:
   - Block customer → send message → verify no response
   - Disable challenge → send message → verify WIP message received
   - Enable challenge → send message → verify normal LLM flow
   - New customer + challenge enabled → verify welcome message + LLM processing
   - New customer + challenge disabled → verify WIP message only
3. Load testing: 1000 messages/minute with challenge disabled
4. Verify Admin UI displays wip_message/welcome_message as editable plain text

**Exit Criteria**: All tests pass, no performance degradation, Admin UI functional.

---

## Migration Plan

### Database Changes (if needed)

If wip_message/welcome_message currently stored as JSON:

1. Create migration to convert JSON to TEXT
2. Update seed script to use plain strings
3. Verify GET/PUT endpoints serialize correctly

### Seed Script Updates

Add valid email to workspace settings:
\`\`\`typescript
workspace: {
  create: {
    name: "Test Workspace",
    email: "admin@echatbot.ai", // REQUIRED
    wip_message: "Servizio momentaneamente non disponibile",
    welcome_message: "Benvenuto! Come posso aiutarti?",
    challenge: {
      disabled: false
    }
  }
}
\`\`\`

### Rollback Plan

If issues arise:
1. Feature flag: Add \`ENABLE_CHALLENGE_DISABLED_CHECK\` env var (default false)
2. Revert migration if database changes cause issues
3. Restore previous webhook handler logic
4. Monitor error logs for security layer failures

---

## Open Questions

None - all requirements clarified in user input. Implementation can proceed with defined assumptions.

---

## Approval

- [ ] Product Owner Review
- [ ] Technical Lead Review
- [ ] Security Review (for blocked user logic)
- [ ] QA Test Plan Approval
