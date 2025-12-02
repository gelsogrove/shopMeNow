# Feature Specification: New User Registration Flow with Welcome Message

**Feature ID**: 174-router  
**Branch**: `174-router`  
**Date**: 2025-11-18  
**Author**: Andrea (User Input)  
**Status**: Draft

---

## Overview

Implement a complete new user registration flow that handles unknown WhatsApp users by sending a welcome message with registration link, tracking registration attempts, blocking after 3 attempts, and sending confirmation message after successful registration.

### Context

Currently, when an unknown user sends a WhatsApp message to the bot, the system needs to:

1. Detect the user is not in the database
2. Send a welcome message in the user's language (detected from phone prefix)
3. Include a registration link (short URL)
4. Block the user after 3 registration attempts
5. Send a confirmation message after successful registration

All messages must pass through the **Security & Translation Layer** to ensure proper language translation and content safety.

### Primary Goal

Create a secure, multi-language registration flow that:

- Prevents spam by limiting registration attempts (max 3)
- Uses language detection from phone prefix for unknown users
- Translates all system messages via Security & Translation Layer
- Distinguishes between welcome messages and WIP (work-in-progress) messages
- Sends confirmation after registration completion

---

## Functional Requirements

### FR1: Unknown User Detection (CRITICAL - FIRST CHECK)

**Priority**: P0 (CRITICAL)  
**Requirement**: When a WhatsApp message is received, the system MUST check if the customer exists in the database BEFORE any other processing.

**Acceptance Criteria**:

- Database query: `SELECT * FROM customers WHERE phone = ? AND workspaceId = ? AND isActive = true`
- If customer found → proceed with normal chatbot flow
- If customer NOT found → trigger welcome message flow (FR2)
- Check happens BEFORE any LLM processing

**Implementation Notes**:

- File: `backend/src/routes/webhooks/whatsapp.routes.ts`
- Query must filter by `workspaceId` (workspace isolation)
- Phone number normalized (remove spaces)

---

### FR2: Welcome Message Flow (Unknown User)

**Priority**: P0 (CRITICAL)  
**Requirement**: When an unknown user sends a message, the system MUST send a welcome message with a registration link.

**Acceptance Criteria**:

- Welcome message retrieved from database: `workspace.welcomeMessage['en']` (English base)
- Language detected from phone prefix (FR3)
- Message translated via Security & Translation Layer (stage: `new_user_welcome`)
- Registration link generated and shortened (FR4)
- Message format:

  ```
  {translated_welcome_message}

  🔗 **{link_text}:**
  {short_registration_link}

  ⏰ {validity_text}
  ```

**Dependencies**:

- FR3 (Language Detection)
- FR4 (Registration Link Generation)
- FR5 (Security & Translation Layer)

**Implementation Notes**:

- File: `backend/src/services/llm.service.ts` → `handleNewUserWelcome()`
- Method already exists, verify implementation
- MUST NOT use hardcoded translations (database only)

---

### FR3: Language Detection from Phone Prefix

**Priority**: P0 (CRITICAL)  
**Requirement**: For unknown users (no customer record), the system MUST detect language from the phone number prefix.

**Acceptance Criteria**:

- Prefix mapping:
  - `+39` → Italian (it)
  - `+34` → Spanish (es)
  - `+351` → Portuguese (pt)
  - Other → English (en) [default]
- Language code used for translation (FR5)
- NO LLM call for language detection (simple prefix matching)

**Edge Cases**:

- Invalid phone format → default to English
- Missing prefix → default to English
- Unknown country code → default to English

**Implementation Notes**:

- File: `backend/src/utils/language-detector.ts` or similar
- Function: `detectLanguageFromPhonePrefix(phoneNumber: string): string`
- Pure function (no database, no LLM)

---

### FR4: Registration Link Generation (Short URL)

**Priority**: P0 (CRITICAL)  
**Requirement**: The registration link MUST be converted to a short URL for better user experience.

**Acceptance Criteria**:

- Long URL format: `https://{workspace_url}/register?token={secure_token}`
- Secure token contains: `phoneNumber`, `workspaceId`, `expiresAt` (1 hour)
- Short URL format: `https://{workspace_url}/s/{shortCode}` (7 characters)
- Short URL expires at same time as secure token
- Clicks tracked in database (`shortUrls.clicks`)

**Security Requirements**:

- Token generated via `SecureTokenService`
- Short code unique (no collisions)
- Workspace isolation (short URL linked to `workspaceId`)
- HMAC signature or similar for token integrity

**Implementation Notes**:

- Service: `URLShortenerService` (verify if exists)
- Table: `shortUrls` (verify schema)
- Redirect endpoint: `GET /s/:shortCode` (verify if exists)

---

### FR5: Security & Translation Layer (MANDATORY)

**Priority**: P0 (CRITICAL)  
**Requirement**: ALL system messages (welcome, confirmation, WIP) MUST pass through the Security & Translation Layer.

**Acceptance Criteria**:

- Welcome message: English from DB → translated to detected language
- Confirmation message: English from DB → translated to customer language
- Translation stage names:
  - `new_user_welcome` for welcome messages
  - `registration_confirmation` for post-registration messages
- Security layer validates content (no harmful/inappropriate content)
- Translation handles variable replacement: `[nome]` → customer first name

**Implementation Notes**:

- Service: `LLMService.translateSystemMessage()`
- Agent: `SafetyTranslationAgent`
- Input: English message from database
- Output: Translated message in target language
- NO static translation dictionaries

---

### FR6: Registration Attempts Tracking & Blocking

**Priority**: P0 (CRITICAL)  
**Requirement**: The system MUST track registration attempts and block users after 3 attempts within 24 hours.

**Acceptance Criteria**:

- First attempt: Send welcome message, increment counter (attempt = 1)
- Second attempt: Send welcome message, increment counter (attempt = 2)
- Third attempt: Send welcome message, increment counter (attempt = 3), **BLOCK USER**
- Fourth+ attempts: Return "CUSTOMER_BLACKLISTED", no message sent
- Counter resets after 24 hours
- Blocking applies to both `registrationAttempts` table AND `customers` table (if exists)

**Database**:

- Table: `registrationAttempts`
- Fields: `phoneNumber`, `workspaceId`, `attemptCount`, `lastAttemptAt`, `isBlocked`
- Unique constraint: `[phoneNumber, workspaceId]`

**Configuration**:

- `MAX_ATTEMPTS = 3` (NOT 5!)
- `ATTEMPT_WINDOW_HOURS = 24`

**Implementation Notes**:

- Service: `RegistrationAttemptsService`
- Methods: `isBlocked()`, `recordAttempt()`, `blockCustomer()`
- File: `backend/src/application/services/registration-attempts.service.ts`

---

### FR7: Registration Completion & Confirmation Message

**Priority**: P0 (CRITICAL)  
**Requirement**: After successful registration, the system MUST send a confirmation message via the message queue.

**Acceptance Criteria**:

- User completes registration form → creates customer record
- System sends confirmation message: "Grazie per esserti registrato, [nome]! Presto ti contatteremo per abilitarti il nostro chatbot."
- Message in English from DB: `workspace.afterRegistrationMessages['en']`
- Translated via Security & Translation Layer (stage: `registration_confirmation`)
- Variable replacement: `[nome]` → customer first name
- Message saved with `isSystemMessage = true` (if field exists) or in `debugInfo`
- Message queued for WhatsApp delivery

**Dependencies**:

- FR5 (Security & Translation Layer)
- Customer record must exist (id, phone, workspaceId, language, name)

**Implementation Notes**:

- Controller: `RegistrationController.register()`
- Service: `RegistrationService.sendAfterRegistrationMessage()`
- File: `backend/src/application/services/registration.service.ts`
- MUST call `LLMService.translateSystemMessage()` (not static translations!)

---

### FR8: WIP Message vs Welcome Message Separation

**Priority**: P1 (HIGH)  
**Requirement**: The system MUST distinguish between WIP (Work In Progress) messages and Welcome messages. These are two SEPARATE flows.

**Acceptance Criteria**:

- **WIP Message**: Sent when workspace has `challengeStatus = false` (chatbot disabled/maintenance)
  - Retrieved from: `workspace.wipMessage` (multilingua)
  - Sent to: EXISTING customers
  - Meaning: "Bot is under maintenance, try later"
- **Welcome Message**: Sent when user is NOT in database (unknown user)
  - Retrieved from: `workspace.welcomeMessage` (English base)
  - Sent to: NEW/unregistered users
  - Meaning: "Register to use the bot"
- NO conflict between the two (different triggers)

**Implementation Notes**:

- WIP message: `backend/src/services/llm-router.service.ts` (lines ~500-560)
- Welcome message: `backend/src/services/llm.service.ts` (lines ~529-620)
- Different database fields: `wipMessage` vs `welcomeMessage`

---

### FR9: WorkspaceId Retrieval for Unknown Users

**Priority**: P1 (HIGH)  
**Requirement**: When an unknown user sends a message, the system MUST extract the workspaceId from the webhook payload (NOT from customer record).

**Acceptance Criteria**:

- WorkspaceId extracted from WhatsApp webhook "From" field (receiving phone number)
- Query: `SELECT id FROM workspace WHERE whatsappPhoneNumber = ?`
- If not found → fallback to test workspace (dev only)
- WorkspaceId passed to all services: welcome message, registration link, attempts tracking

**Security**:

- Workspace isolation maintained
- No cross-workspace data access
- Token contains correct workspaceId

**Implementation Notes**:

- File: `backend/src/routes/webhooks/whatsapp.routes.ts`
- Parse `From` field from WhatsApp payload
- Query workspace by phone number

---

## Non-Functional Requirements

### NFR1: Performance

- Welcome message generation: < 3 seconds
- Language detection: < 100ms (no LLM call)
- Short URL generation: < 500ms
- Registration confirmation: < 2 seconds

### NFR2: Security

- All endpoints with workspace operations use 3-layer middleware:
  1. `authMiddleware` (JWT validation)
  2. `sessionValidationMiddleware` (session header)
  3. `validateWorkspaceOperation` (workspace isolation)
- Public registration endpoint uses `SecureTokenService` (time-limited tokens)
- Short URLs expire with tokens (1 hour)
- No cross-workspace access (workspace isolation tests required)

### NFR3: Translation Quality

- All system messages pass through Security & Translation Layer
- NO hardcoded translations
- NO static translation dictionaries
- Variable replacement before translation: `[nome]` → first name

### NFR4: Database Consistency

- All queries filter by `workspaceId`
- Atomic operations for attempt tracking (prevent race conditions)
- Unique constraint: `[phoneNumber, workspaceId]` on `registrationAttempts`

### NFR5: Observability

- Log all welcome message sends with language detection
- Log registration attempt increments
- Log blocking events
- Log confirmation message sends
- Debug info stored in messages table

---

## User Stories

### US1: Unknown User Receives Welcome Message

**As a** new WhatsApp user  
**I want to** receive a welcome message in my language  
**So that** I know I need to register before using the bot

**Acceptance Criteria**:

- Given: I send "Ciao" from +39 333 1234567 (Italian number)
- When: System checks database and finds no customer record
- Then:
  - System detects language: Italian (from +39 prefix)
  - System retrieves English welcome message from database
  - System translates to Italian via Security & Translation Layer
  - System generates short registration link
  - System sends complete message in Italian
  - System increments registration attempt counter (1/3)

**Test Scenario**:

```
Input: Phone: +39 333 1234567, Message: "Ciao"
Database: No customer with this phone
Output:
  - Language detected: IT
  - Welcome message translated to Italian
  - Short link: https://echatbot.ai/s/AbC123d
  - Attempt count: 1
```

---

### US2: User Blocked After 3 Attempts

**As a** system administrator  
**I want to** block users who don't register after 3 attempts  
**So that** we prevent spam and abuse

**Acceptance Criteria**:

- Given: User +34 611 223344 has sent 2 messages without registering
- When: User sends 3rd message
- Then:
  - System sends welcome message (attempt 3/3)
  - System marks user as blocked (`isBlocked = true`)
  - Future messages return "CUSTOMER_BLACKLISTED" (no message sent)

**Test Scenario**:

```
Attempt 1: Send "Hola" → Welcome message sent, attempt = 1
Attempt 2: Send "Info" → Welcome message sent, attempt = 2
Attempt 3: Send "Help" → Welcome message sent, attempt = 3, isBlocked = true
Attempt 4: Send "Test" → Response: "CUSTOMER_BLACKLISTED", no message
```

---

### US3: User Receives Confirmation After Registration

**As a** newly registered user  
**I want to** receive a confirmation message  
**So that** I know my registration was successful

**Acceptance Criteria**:

- Given: User completes registration form with name "Carlos"
- When: System creates customer record
- Then:
  - System retrieves English confirmation message from database
  - System replaces `[nome]` with "Carlos"
  - System translates to Spanish (customer language) via Security & Translation Layer
  - System queues message for WhatsApp delivery
  - System saves message with debugInfo marking it as system message

**Test Scenario**:

```
Input: Registration form completed
  - Name: Carlos Gomez
  - Phone: +34 611 223344
  - Language: Spanish
Database: Customer created with id=xyz
Output:
  - Message: "Gracias por registrarte, Carlos! Pronto te contactaremos..."
  - Translated via Security & Translation Layer (stage: registration_confirmation)
  - Saved in messages table with agentSelected: CHATBOT
```

---

## Edge Cases

### EC1: Invalid Phone Number Format

**Scenario**: User sends message from phone without country code  
**Expected**: Default to English, log warning, continue flow

### EC2: Workspace Not Found (Unknown "From" Number)

**Scenario**: WhatsApp webhook has "From" number not in workspace table  
**Expected**:

- Development: Fallback to test workspace (log warning)
- Production: Return error 404 (reject message)

### EC3: Welcome Message Not Configured

**Scenario**: Workspace has no `welcomeMessage` in database  
**Expected**: Throw error, don't send message (no fallback defaults)

### EC4: Translation Layer Failure

**Scenario**: Security & Translation Layer returns error  
**Expected**: Don't send message, log error, return 500 (safety first)

### EC5: Short URL Generation Collision

**Scenario**: Generated short code already exists (rare)  
**Expected**: Retry up to 10 times, throw error if all fail

### EC6: Registration During Blocked Status

**Scenario**: User is blocked but completes registration via old link  
**Expected**:

- Create customer record
- Unblock user (clear `isBlocked` flag)
- Send confirmation message

### EC7: Concurrent Registration Attempts

**Scenario**: User sends 2 messages simultaneously (race condition)  
**Expected**:

- Use database transactions for attempt tracking
- Unique constraint prevents duplicate session creation
- Both messages handled correctly (no errors)

---

## Technical Constraints

### Database-First Architecture (Constitution Principle I)

- NO hardcoded welcome messages or translations
- ALL content from database: `workspace.welcomeMessage`, `workspace.afterRegistrationMessages`
- Error if data missing (no fallback defaults)

### Workspace Isolation (Constitution Principle II)

- ALL queries filter by `workspaceId`
- Short URLs linked to workspace
- Registration tokens contain workspaceId
- Security tests verify no cross-workspace access

### Security & Translation Layer Mandatory (Constitution Principle IV)

- ALL system messages pass through `translateSystemMessage()`
- NO static translation dictionaries
- Base language: English (from database)
- LLM handles translation to target language

### 360-Degree Thinking (Constitution Principle V)

- Frontend: Registration form (already exists?)
- Backend API: Registration endpoint (verify security)
- Service Layer: Welcome message, confirmation message
- Repository: Database queries with workspace filter
- Security: 3-layer middleware on protected endpoints
- Tests: Unit tests, security tests, integration tests

### Code Cleanliness (Constitution Principle VII)

- No temporary files or backup files in repo
- No commented-out code
- Extract shared logic to utilities
- Files under 500 lines

---

## Dependencies

### Existing Infrastructure (Verify)

- ✅ `ShortUrls` table in database
- ✅ `UrlShortenerService` with `createShortUrl()` method
- ✅ `SecureTokenService` with token generation/validation
- ✅ `SafetyTranslationAgent` for message translation
- ✅ `LLMService.translateSystemMessage()` method
- ✅ `RegistrationAttemptsService` with blocking logic
- ✅ `registrationAttempts` table with unique constraint
- ❓ Language detection utility (verify implementation)
- ❓ Short URL redirect endpoint (verify exists)
- ❓ Registration confirmation message (verify uses Security layer)

### New Components (To Implement)

- ❌ Update `RegistrationService.sendAfterRegistrationMessage()` to use Security & Translation Layer
- ❌ Verify welcome message flow calls `translateSystemMessage()`
- ❌ Verify workspaceId extraction from webhook payload
- ❌ Integration tests for complete flow

---

## Success Metrics

- Unknown user receives welcome message in correct language (100% of cases)
- Registration link is shortened (<20 characters after domain)
- Users blocked after exactly 3 attempts (not 4, not 5)
- Confirmation message sent after registration (100% of cases)
- All messages pass through Security & Translation Layer (no static translations)
- Zero cross-workspace data leaks (security tests)

---

## Out of Scope

- Manual admin unblocking of users (future feature)
- Email registration (WhatsApp only)
- Multi-step registration wizard (single form)
- Customer profile editing after registration (separate feature)
- SMS fallback if WhatsApp fails (WhatsApp only)

---

## References

- Constitution: `.specify/memory/constitution.md`
- PRD: `docs/memory-bank/PRD.md`
- Backend structure: `backend/src/`
- Database schema: `backend/prisma/schema.prisma`
