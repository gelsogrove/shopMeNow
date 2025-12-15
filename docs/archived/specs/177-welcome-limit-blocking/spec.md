# Feature Specification: Welcome Message Limit with Auto-Blocking

**Feature Branch**: `177-welcome-limit-blocking`  
**Created**: 2025-11-19  
**Status**: Draft  
**Input**: User description: "cosa succede se un utente nuovo scrive? viene fuori il messaggio di welcome per registrarsi e cosa succede se non si registra e continua a scrivere? il modello dovrebbe continuare a dare come risposta il welcome message fino a 3 volte, dopo 3 volte passa a bloccato, questa logica va implementata nel nostro flusso stai attento a cosa tocchi quello che abbiamo fatto fino ad ora non deve cambiare e ovviamente mettiamoci un test e ovviamente voglio vedere che giro fa con il view Flow secondo me dovrebbe passare da welcome a security and translation"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - First Welcome Message to Unregistered User (Priority: P1)

When a new user (phone number not in database) sends their first WhatsApp message, the system sends a welcome message with a registration link.

**Why this priority**: This is the entry point for all new customers - critical for user acquisition and onboarding flow.

**Independent Test**: Can be fully tested by sending a message from an unregistered phone number and verifying welcome message is sent with registration link.

**Acceptance Scenarios**:

1. **Given** a phone number not in the database, **When** the user sends their first message, **Then** system creates temporary customer record (isActive=false) and sends welcome message with registration link
2. **Given** welcome message is sent, **When** checking chat history, **Then** message appears with agentType="REGISTRATION_FLOW" and tokensUsed=0
3. **Given** first welcome message sent, **When** checking RegistrationAttempts table, **Then** record exists with attemptCount=1, isBlocked=false

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: No changes needed - existing chat UI displays messages
- [x] Backend API: `/api/whatsapp/webhook` endpoint (already exists, needs modification)
- [x] Service Layer: Modify whatsapp-webhook.controller.ts to track attempts and check blocking
- [x] Repository: Use existing RegistrationAttempts model, add queries for attempt tracking
- [x] Database: RegistrationAttempts table already exists, no migration needed
- [x] Security: No auth required (webhook is public), workspace isolation via workspaceId
- [x] Testing: Unit tests for attempt tracking logic, integration tests for webhook flow
- [x] Documentation: No Swagger changes (webhook endpoint documented)
- [x] Concurrency: Transaction for creating/updating RegistrationAttempts with unique constraint
- [x] Prompt Variables: Not applicable (no LLM prompt changes)
- [x] Code Cleanliness: Keep changes isolated in whatsapp-webhook.controller.ts

---

### User Story 2 - Repeated Messages Trigger Additional Welcome Messages (Priority: P1)

When an unregistered user sends 2nd or 3rd message without completing registration, system sends the same welcome message again (up to 3 times total).

**Why this priority**: Gives users multiple opportunities to register before blocking - improves conversion rate while preventing abuse.

**Independent Test**: Send 3 messages from unregistered phone number and verify welcome message sent each time, with attemptCount incrementing.

**Acceptance Scenarios**:

1. **Given** user already received 1 welcome message (attemptCount=1), **When** user sends 2nd message, **Then** system sends welcome message again and sets attemptCount=2
2. **Given** user already received 2 welcome messages (attemptCount=2), **When** user sends 3rd message, **Then** system sends welcome message again and sets attemptCount=3
3. **Given** each welcome message sent, **When** checking conversation messages, **Then** each message saved with role="assistant", agentType="REGISTRATION_FLOW"
4. **Given** welcome message sent, **When** checking Message Flow Timeline in UI, **Then** flow shows: Welcome → Safety & Translation → Save → WhatsApp

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: Message Flow Timeline should display welcome message steps
- [x] Backend API: Webhook controller increments attemptCount on each message
- [x] Service Layer: Check attemptCount before sending welcome vs blocking
- [x] Repository: Update RegistrationAttempts.attemptCount and lastAttemptAt
- [x] Database: Transaction ensures atomic increment of attemptCount
- [x] Security: Workspace isolation maintained (workspaceId filter)
- [x] Testing: Test attemptCount increments correctly, test welcome message repeated
- [x] Documentation: No API changes
- [x] Concurrency: Use transaction to prevent race conditions on attemptCount increment
- [x] Prompt Variables: Not applicable
- [x] Code Cleanliness: Extract attempt tracking logic to helper function

---

### User Story 3 - Auto-Block After 3 Attempts (Priority: P1)

When an unregistered user sends their 4th message without registering, system blocks the phone number and stops sending welcome messages.

**Why this priority**: Prevents spam and abuse while giving legitimate users reasonable opportunity to register.

**Independent Test**: Send 4 messages from unregistered phone number and verify 4th message results in blocking (no welcome message sent).

**Acceptance Scenarios**:

1. **Given** user already received 3 welcome messages (attemptCount=3), **When** user sends 4th message, **Then** system sets isBlocked=true and does NOT send welcome message
2. **Given** user is blocked (isBlocked=true), **When** user sends any subsequent message, **Then** system returns 200 OK but does NOT send any response
3. **Given** blocking occurs, **When** checking RegistrationAttempts table, **Then** isBlocked=true and attemptCount=4 (or higher)
4. **Given** user blocked, **When** admin checks customer record, **Then** customer status shows isActive=false and isBlocked in RegistrationAttempts

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: No changes needed - blocked users don't receive messages
- [x] Backend API: Webhook controller checks isBlocked before processing
- [x] Service Layer: Blocking logic sets isBlocked=true after 3rd attempt exceeded
- [x] Repository: Query RegistrationAttempts.isBlocked before sending welcome
- [x] Database: Transaction updates isBlocked atomically
- [x] Security: Blocking is per workspaceId (multi-tenant isolation)
- [x] Testing: Test 4th message blocks user, test blocked user receives no response
- [x] Documentation: No API changes
- [x] Concurrency: Transaction prevents race conditions on blocking check
- [x] Prompt Variables: Not applicable
- [x] Code Cleanliness: Keep blocking logic in single function

---

### User Story 4 - Welcome Message Flow Through Safety & Translation (Priority: P2)

Welcome messages for unregistered users must pass through Safety & Translation agent before being sent to WhatsApp.

**Why this priority**: Ensures consistent message processing pipeline and allows translation to customer's detected language.

**Independent Test**: Send message from unregistered user with non-English phone prefix and verify welcome message translated to detected language.

**Acceptance Scenarios**:

1. **Given** new user sends message, **When** system processes welcome message, **Then** message passes through Safety & Translation agent (LLM call)
2. **Given** Safety agent processes welcome message, **When** checking debugInfo in conversationMessage, **Then** debugInfo shows flow: "welcome" → "safety" → "save" → "whatsapp"
3. **Given** customer language detected as Spanish (+34 prefix), **When** welcome message sent, **Then** message translated to Spanish by Safety agent
4. **Given** Message Flow Timeline in UI, **When** viewing welcome message, **Then** timeline shows: Welcome (system) → Safety & Translation → Save → WhatsApp

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: Message Flow Timeline displays welcome → safety → save → whatsapp
- [x] Backend API: Route welcome message through Safety agent before saving
- [x] Service Layer: Call Safety & Translation service for welcome message
- [x] Repository: Save debugInfo with complete flow trace
- [x] Database: ConversationMessage.debugInfo contains flow steps
- [x] Security: No security concerns (welcome message is public)
- [x] Testing: Test welcome message goes through Safety agent, test debugInfo contains flow
- [x] Documentation: No API changes
- [x] Concurrency: No concurrency issues (sequential flow)
- [x] Prompt Variables: Safety agent uses existing prompt (no changes)
- [x] Code Cleanliness: Reuse existing Safety agent integration

---

### User Story 5 - Successful Registration Clears Blocking (Priority: P3)

When a previously unregistered user completes registration via the link, their blocking status is cleared and they can use the chatbot normally.

**Why this priority**: Enables recovered users to access full system features after registration, but lower priority since it's the happy path recovery.

**Independent Test**: Register a user via link who had 1-2 welcome attempts, verify attemptCount reset and isBlocked=false.

**Acceptance Scenarios**:

1. **Given** user has RegistrationAttempts record (attemptCount=2, isBlocked=false), **When** user completes registration, **Then** system sets customer.isActive=true and can optionally reset attemptCount
2. **Given** registered customer (isActive=true), **When** customer sends message, **Then** system processes message through normal LLM Router flow (not welcome flow)
3. **Given** customer registered, **When** checking RegistrationAttempts, **Then** record still exists but no longer affects message processing

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: Registration form already exists, no changes needed
- [x] Backend API: registration.controller.ts marks customer as active
- [x] Service Layer: No changes needed - active customers bypass attempt check
- [x] Repository: Update customer.isActive=true on registration
- [x] Database: No schema changes needed
- [x] Security: Existing registration flow security maintained
- [x] Testing: Test registered user bypasses attempt check, test normal LLM flow resumes
- [x] Documentation: No API changes
- [x] Concurrency: Existing registration transaction handles this
- [x] Prompt Variables: Not applicable
- [x] Code Cleanliness: No changes needed - existing registration flow works

---

### Edge Cases

- **What happens when phone number blocked (isBlocked=true) but admin manually activates customer?** System should check customer.isActive=true FIRST before checking RegistrationAttempts - active customers always get normal LLM processing
- **What happens when user sends message exactly at 3rd attempt boundary (race condition)?** Transaction with unique constraint on (phoneNumber, workspaceId) ensures atomic attemptCount increment - only one request can increment to 4 and set isBlocked=true
- **How does system handle concurrent messages from same unregistered user?** Customer-level locking (similar to chat session creation) prevents race conditions - messages processed sequentially per phone number
- **What happens when workspace.welcomeMessage is null or empty?** Use default fallback message: "Welcome! How can I help you?" (already implemented in current code)
- **What happens when blocked user tries to register via link?** Registration flow should succeed and set isActive=true - active status overrides blocking
- **What happens if RegistrationAttempts record doesn't exist for new user?** Create record with attemptCount=1, isBlocked=false on first message

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST track registration attempts per phone number using RegistrationAttempts table with fields: phoneNumber, workspaceId, attemptCount, lastAttemptAt, isBlocked
- **FR-002**: System MUST increment attemptCount by 1 each time an unregistered user (isActive=false) sends a message
- **FR-003**: System MUST send welcome message with registration link when attemptCount ≤ 3 and isBlocked=false
- **FR-004**: System MUST set isBlocked=true when attemptCount reaches 4 (after 3rd welcome message sent)
- **FR-005**: System MUST return 200 OK with no response sent to WhatsApp when user is blocked (isBlocked=true)
- **FR-006**: System MUST check customer.isActive=true BEFORE checking RegistrationAttempts - active customers bypass attempt tracking
- **FR-007**: System MUST route welcome messages through Safety & Translation agent for language translation
- **FR-008**: System MUST save welcome message flow in debugInfo as: "welcome" → "safety" → "save" → "whatsapp"
- **FR-009**: System MUST create or update RegistrationAttempts record using transaction to prevent race conditions
- **FR-010**: System MUST maintain workspace isolation - attemptCount is per (phoneNumber, workspaceId) combination
- **FR-011**: System MUST save each welcome message in ConversationMessage with agentType="REGISTRATION_FLOW" and tokensUsed=0
- **FR-012**: System MUST implement customer-level locking to prevent concurrent message processing from same phone number
- **FR-013**: System MUST allow registration to succeed even when isBlocked=true - registration sets isActive=true which overrides blocking

### Key Entities _(include if feature involves data)_

- **RegistrationAttempts**: Tracks registration attempts and blocking status per phone number and workspace. Attributes: id, phoneNumber, workspaceId, attemptCount (increments on each message), lastAttemptAt (timestamp of last message), isBlocked (true after 3 attempts), createdAt, updatedAt. Unique constraint: (phoneNumber, workspaceId)
- **Customers**: Modified to interact with RegistrationAttempts. Key check: isActive=true bypasses attempt tracking (registered users always get normal LLM flow)
- **ConversationMessage**: Stores welcome messages with agentType="REGISTRATION_FLOW", debugInfo contains flow trace: welcome → safety → save → whatsapp

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Unregistered users receive welcome message within 3 seconds on first message
- **SC-002**: System correctly increments attemptCount from 1 to 2 to 3 on repeated messages from same unregistered phone number
- **SC-003**: System blocks phone number (isBlocked=true) after 4th message sent without registration
- **SC-004**: Blocked users receive no response and system returns 200 OK status
- **SC-005**: Welcome messages appear in Message Flow Timeline with 4 steps: Welcome → Safety & Translation → Save → WhatsApp
- **SC-006**: 100% of welcome messages pass through Safety & Translation agent (verified in debugInfo)
- **SC-007**: Registered customers (isActive=true) bypass attempt tracking and receive normal LLM responses
- **SC-008**: System handles concurrent messages from same phone number without race conditions (verified via load testing)
- **SC-009**: attemptCount increments atomically using database transactions (no duplicate increments)
- **SC-010**: 95% of legitimate users register within first 2 welcome messages (reducing unnecessary blocking)

## Assumptions _(optional)_

- Existing `RegistrationAttempts` table in database already has all required fields (phoneNumber, workspaceId, attemptCount, lastAttemptAt, isBlocked)
- Existing Safety & Translation agent can process welcome messages without modification to prompts
- Existing Message Flow Timeline UI can display welcome message steps without frontend changes
- Webhook endpoint `/api/whatsapp/webhook` continues to receive messages from unregistered users
- Current `customer.isActive` field accurately reflects registration status (false = unregistered, true = registered)
- BillingPrices.WELCOME_MESSAGE cost tracking remains unchanged
- Existing customer-level locking mechanism (similar to chat session creation) can be reused for attempt tracking

## Dependencies _(optional)_

- Database: Requires `RegistrationAttempts` table (already exists in schema)
- Safety & Translation Agent: Welcome messages must route through existing safety agent
- WhatsApp Webhook: Depends on existing webhook controller at `/api/whatsapp/webhook`
- Billing System: Welcome message cost tracking via BillingService.trackMessage()
- Secure Token Service: Registration links use existing SecureTokenService for 24h tokens
- URL Shortener Service: Registration links shortened via existing UrlShortenerService

## Technical Constraints _(optional)_

- Must use Prisma transactions for atomic attemptCount increments
- Must maintain workspace isolation (all queries filter by workspaceId)
- Must not modify existing LLM Router flow for registered customers
- Must preserve existing Message Flow Timeline data structure
- Must not introduce breaking changes to `/api/whatsapp/webhook` endpoint
- Must implement customer-level locking to prevent race conditions
- Must keep changes isolated in whatsapp-webhook.controller.ts (minimize files touched)
- Must reuse existing RegistrationAttempts model without schema changes

## Open Questions _(optional)_

None - all requirements are clear based on user description.

## Out of Scope _(optional)_

- Unblocking mechanism via admin UI (future feature - admins would manually set isBlocked=false)
- Customizable attempt limit (hardcoded to 3 attempts for this feature)
- Different blocking strategies per workspace (all workspaces use same 3-attempt rule)
- Email/SMS notifications to admin when user blocked (future enhancement)
- Analytics dashboard showing blocked user statistics (future feature)
- Grace period or cooldown between attempts (blocking is permanent until admin intervention)
- Automatic unblocking after time period (blocked users stay blocked until manual action)

