# Feature Specification: E2E Language, Billing, Campaigns & Escalation

**Feature Branch**: `main` (no feature branch per Andrea's policy)
**Created**: 2026-02-13
**Status**: Final
**Input**: `minrequirement.md` — end-to-end regression scenarios

## User Scenarios & Testing

### User Story 1 — Language Selection & Translation (Priority: P1)

All chatbot responses MUST be translated to the customer's language via TranslationAgent. No hardcoded JSON lookups for language resolution.

**Why this priority**: Language is the foundation — every other feature (campaigns, escalation, WIP) depends on correct translation routing.

**Independent Test**: Send a widget message with `language=es` → verify response is in Spanish. Send with phone prefix `+34` → same result.

**Acceptance Scenarios**:

1. **Given** customer.language = "es", **When** chatbot responds, **Then** response passes through TranslationAgent with targetLanguage "es"
2. **Given** no language set, phone prefix +34, **When** chatbot responds, **Then** targetLanguage = "es"
3. **Given** no language, phone prefix +39, **Then** targetLanguage = "it"
4. **Given** no language, phone prefix +351, **Then** targetLanguage = "pt"
5. **Given** no language, unknown prefix, **Then** targetLanguage = "en" (default)
6. **Given** debugMode=true, **When** WIP message returned, **Then** WIP message MUST pass through TranslationAgent (not JSON lookup)
7. **Given** TranslationAgent prompt, **Then** ALL variables replaced (no `{{VAR}}` left): frustrationEscalationInstructions, humanSupportInstructions, botIdentityResponse, allowedExternalLinks

**360-Degree Validation**:

- [x] Frontend: Widget sends `language` parameter
- [ ] Backend API: widget-chat.controller resolveWipMessage → TranslationAgent
- [ ] Service Layer: TranslationAgent.process() called for WIP
- [ ] Database: customer.language default → "en", workspace.defaultLanguage default → "en"
- [ ] Scheduler: normalizeLanguage default → "en" (not "it")
- [ ] Testing: Unit tests for language resolution priority, WIP translation

---

### User Story 2 — Billing & Credit Cutoffs (Priority: P1)

Correct message costs and credit blocking at threshold.

**Why this priority**: Billing accuracy is critical for revenue. Wrong costs = lost money or blocked customers.

**Independent Test**: Check PlatformConfig prices match spec. Test credit cutoff at -$10.

**Acceptance Scenarios**:

1. **Given** WhatsApp message sent, **Then** cost = $0.10 deducted
2. **Given** Widget message sent, **Then** cost = $0.05 deducted
3. **Given** Push campaign message sent, **Then** cost = $1.00 deducted
4. **Given** owner balance ≤ -$10.00, **When** any message attempted, **Then** all channels blocked (no response)
5. **Given** push campaign scheduled, **When** credit insufficient, **Then** campaign blocked before send

**360-Degree Validation**:

- [ ] Database: PlatformConfig WIDGET_MESSAGE = 0.05
- [ ] Backend: subscription-billing.service uses correct cost from DB
- [ ] Testing: Unit tests assert exact costs and cutoff threshold

---

### User Story 3 — Human Operator Escalation (Priority: P2)

contactOperator must translate humanSupportInstructions to customer language.

**Why this priority**: Escalation is a critical customer experience moment — wrong language = bad UX.

**Independent Test**: Trigger contactOperator for a Spanish customer → verify response is translated.

**Acceptance Scenarios**:

1. **Given** customer says "talk to human", **When** contactOperator executes, **Then** activeChatbot = false
2. **Given** workspace has humanSupportInstructions with {{nameUser}}, **When** contactOperator runs, **Then** variables replaced AND result translated via TranslationAgent to customer language
3. **Given** contactOperator runs, **Then** summary of last-hour conversation sent to operator (email/WhatsApp per settings)
4. **Given** frustrationEscalationInstructions set, **Then** used ONLY as trigger hints, NOT in customer-facing message

**360-Degree Validation**:

- [ ] Backend: contactOperator.ts calls TranslationAgent after variable replacement
- [ ] Service: TranslationAgent processes the humanSupportInstructions message
- [ ] Testing: Unit test for translated escalation response

---

### User Story 4 — Campaign Translation Pipeline (Priority: P2)

Campaign messages must be translated to each recipient's language using the full translation pipeline.

**Why this priority**: Campaigns reach many customers — wrong language = wasted messages.

**Independent Test**: Create campaign, send to ESP customer → verify message arrives in Spanish.

**Acceptance Scenarios**:

1. **Given** campaign message with variables ({{customerName}}), **When** sent to customer with language "es", **Then** variables replaced AND translated to Spanish
2. **Given** scheduler normalizeLanguage, **When** no language available, **Then** default = "en" (not "it")
3. **Given** campaign being sent, **Then** translation uses LLM (TranslationService/TranslationAgent)

**360-Degree Validation**:

- [ ] Scheduler: normalizeLanguage fallback changed from 'it' to 'en'
- [ ] Scheduler: whatsapp-channel-queue language fallback changed from 'it' to 'en'
- [ ] Testing: Unit tests for scheduler language defaults

---

### User Story 5 — Widget vs WhatsApp Parity (Priority: P3)

Widget must have same behavior as WhatsApp (welcome, WIP, debug) but respond immediately without queue.

**Why this priority**: Feature parity ensures consistent UX across channels.

**Independent Test**: Send widget message → get immediate response (no queue). Channel disabled → no response.

**Acceptance Scenarios**:

1. **Given** widget message, **Then** response returned immediately (no WhatsAppQueue entry)
2. **Given** widget channel disabled, **Then** no response returned
3. **Given** debugMode=true, **Then** WIP message returned and translated via TranslationAgent
4. **Given** widget fallback response, **Then** message is in English (not Italian)

---

### User Story 6 — Registration & Profile Links (Priority: P3)

Token-based profile/registration links with workspace branding.

**Acceptance Scenarios**:

1. **Given** user asks "see my profile", **Then** tokenized short link returned
2. **Given** registration form, **Then** shows workspace logo and widgetPrimaryColor
3. **Given** registration form, **Then** includes delete account / opt-out functionality
4. **Given** unregistered customer, every 6th message, **Then** registration link appended

---

### Edge Cases

- Customer with mixed-case language code ("Es", "PT", "eng") → normalize correctly
- WIP message as string (not JSON object) → still translate via TranslationAgent
- contactOperator when humanSupportInstructions is null → use English default from DB, still translate
- Campaign to customer with null language → use workspace default → fallback to "en"

## Requirements

### Functional Requirements

- **FR-001**: System MUST default to English ("en") when no language is determinable (not Italian)
- **FR-002**: WIP message MUST pass through TranslationAgent LLM translation (no JSON lookup)
- **FR-003**: contactOperator response MUST be translated via TranslationAgent to customer language
- **FR-004**: Widget message cost MUST be $0.05 per message
- **FR-005**: WhatsApp message cost MUST be $0.10 per message
- **FR-006**: Push campaign cost MUST be $1.00 per message
- **FR-007**: All channels MUST be blocked when owner credit ≤ -$10.00
- **FR-008**: Scheduler normalizeLanguage MUST default to "en" (not "it")
- **FR-009**: No placeholder variables ({{VAR}}) in customer-facing responses
- **FR-010**: Fallback response messages MUST be in English (not Italian)

### Key Entities

- **Customer**: language field (default "en"), activeChatbot, isActive
- **Workspace**: defaultLanguage (default "en"), widgetLanguage, debugMode, wipMessage
- **PlatformConfig**: WIDGET_MESSAGE price = 0.05
- **AgentConfig**: TRANSLATION agent systemPrompt (database-driven)
- **TranslationAgent**: LLM-based translation service

## Success Criteria

- **SC-001**: All 9 minrequirement scenarios pass regression testing
- **SC-002**: Zero {{VAR}} placeholders in customer responses
- **SC-003**: Language routing matches spec rules (customer.language > phone prefix > workspace default > "en")
- **SC-004**: Billing costs match spec ($0.10/$0.05/$1.00) with -$10 cutoff
- **SC-005**: All existing tests pass (or are updated to match corrected spec values)
