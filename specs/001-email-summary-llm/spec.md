# Feature Specification: Summary LLM Agent for Email Generation

**Feature Branch**: `001-email-summary-llm`  
**Created**: 2025-01-19  
**Status**: Draft  
**Input**: User description: "Add Summary LLM Agent for email generation with chat history summarization"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sales Agent Receives Email with Chat Summary (Priority: P1)

When a customer escalates to a human operator, the sales agent receives an email containing a concise summary of the customer's conversation history. The summary is professionally written, translated to the sales agent's language, and includes all critical context needed to continue the conversation.

**Why this priority**: This is the core value proposition. Without this, the current system sends no email at all (contactSupport function is a placeholder), making operator escalation completely broken. This is a critical bug fix and the MVP.

**Independent Test**: Can be fully tested by triggering contactSupport calling function (e.g., customer writes "vorrei parlare con un agente"), checking email delivery to sales agent, and verifying summary contains recent chat history in proper language.

**Acceptance Scenarios**:

1. **Given** customer "Mario Rossi" has 15 messages in last hour of chat history, **When** customer requests operator assistance ("voglio parlare con un agente"), **Then** contactSupport function triggers, chatbot disables, and sales agent Alessandro Romano receives email at andrea_gelsomino@hotmail.com with Italian summary of messages from last hour
2. **Given** customer conversation includes product questions and cart operations, **When** escalation occurs, **Then** email summary includes both product inquiries and cart actions in chronological order
3. **Given** customer conversation contains profanity or unsafe content, **When** summary is generated, **Then** Safety Translation Agent sanitizes the content before including in email
4. **Given** sales agent's preferred language is different from customer's language, **When** email is sent, **Then** summary is translated to sales agent's language (Italian default)

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: No changes required (backend handles email automatically)
- [ ] Backend API: contactSupport calling function modified to invoke contactOperator.ts instead of placeholder response
- [ ] Service Layer: SummaryAgentLLM service created, integrated into contactOperator flow (receives array, returns text only - NO calling functions)
- [ ] Repository: Retrieve messages from last hour (createdAt >= NOW() - 1 hour) with workspaceId filter
- [ ] Database: Add SUMMARY agent configuration to agentConfigs table via seed
- [ ] Security: Email sending requires workspace isolation (sales agent must belong to customer's workspace)
- [ ] Testing: Unit test for summary generation, integration test for full email flow
- [ ] Documentation: Document Summary Agent system prompt structure and variables
- [ ] Concurrency: No race conditions (email sending is final step after chatbot disable)
- [ ] Prompt Variables: Ensure {{conversationHistory}} appears only once in summary-agent.md prompt
- [ ] Code Cleanliness: Remove TODO placeholder from contactSupport function, extract email logic cleanly

---

### User Story 2 - Admin Configures Summary Agent Behavior (Priority: P2)

An administrator can configure the Summary Agent's behavior through the Agent Settings UI, including LLM model, temperature, token limits, and whether the agent is active. This allows workspace owners to optimize summary quality and cost.

**Why this priority**: Important for production flexibility but not required for initial email functionality. Summary Agent can work with default settings (GPT-4-mini, temp 0.5, 500 tokens) from seed.

**Independent Test**: Can be tested by accessing Agent Settings page, modifying Summary Agent configuration (e.g., change temperature to 0.3), saving changes, and triggering escalation to verify new settings affect summary style.

**Acceptance Scenarios**:

1. **Given** admin is on Agent Settings page, **When** admin views agent list, **Then** Summary Agent appears with order 7 (after Safety Translation Agent order 6)
2. **Given** admin edits Summary Agent configuration, **When** admin changes maxTokens from 500 to 300, **Then** next email summary is shorter (~150 words instead of ~250 words)
3. **Given** admin disables Summary Agent (isActive = false), **When** escalation occurs, **Then** email contains raw conversation history instead of LLM-generated summary
4. **Given** admin changes model from "openai/gpt-4o-mini" to "openai/gpt-4o", **Then** summary quality improves but API costs increase

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Agent Settings page already supports all agent types (no changes if schema consistent)
- [ ] Backend API: Agent CRUD endpoints already handle all agent types
- [ ] Service Layer: SummaryAgentLLM respects configuration from database (model, temperature, maxTokens)
- [ ] Repository: Agent configuration retrieved with workspaceId filter
- [ ] Database: SUMMARY agent type added to AgentType enum in schema.prisma
- [ ] Security: Admin-only access to Agent Settings (existing authMiddleware + role check)
- [ ] Testing: Test that configuration changes affect summary output
- [ ] Documentation: Add SUMMARY to agent types documentation
- [ ] Concurrency: No concurrency issues (config read-only during execution)
- [ ] Prompt Variables: Summary prompt must not duplicate large variables
- [ ] Code Cleanliness: Use existing agent configuration patterns (no duplication)

---

### User Story 3 - Summary Agent Handles Edge Cases Gracefully (Priority: P3)

The system handles edge cases like empty chat history, very long conversations, and missing customer data without failing email delivery.

**Why this priority**: Nice-to-have robustness improvements but not blocking core functionality. Default behavior (send raw history or error message) is acceptable for MVP.

**Independent Test**: Can be tested by triggering escalation with only 1 message in history, or with 100+ messages, or with customer missing name field.

**Acceptance Scenarios**:

1. **Given** customer has only 1 message in chat history, **When** escalation occurs, **Then** email contains that single message without LLM summary (fallback to raw history)
2. **Given** customer has 200+ messages in chat history, **When** summary is generated, **Then** system uses last 20 messages only to avoid token limits
3. **Given** customer has no name in database (phone number only), **When** email is sent, **Then** email uses phone number as identifier instead of name
4. **Given** Summary Agent API call fails (OpenRouter timeout), **When** email is sent, **Then** email contains raw conversation history with error notice

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: No changes (backend handles all fallbacks)
- [ ] Backend API: Error handling in contactSupport calling function
- [ ] Service Layer: SummaryAgentLLM has try/catch with fallback to raw history
- [ ] Repository: Query filters messages from last hour (WHERE createdAt >= NOW() - INTERVAL '1 hour')
- [ ] Database: No schema changes needed
- [ ] Security: Fallback behavior must still respect workspace isolation
- [ ] Testing: Unit tests for each edge case scenario
- [ ] Documentation: Document fallback behaviors and error handling
- [ ] Concurrency: No issues (fallback logic sequential)
- [ ] Prompt Variables: N/A (edge cases don't affect prompt structure)
- [ ] Code Cleanliness: Centralize fallback logic in one place (avoid duplication)

---

### Edge Cases

- **What happens when Summary Agent is disabled (isActive = false)?**  
  System sends email with raw conversation history instead of LLM-generated summary. Email still delivers successfully.

- **What happens when customer has no messages in chat history?**  
  System sends email with notice "No conversation history available" instead of summary. Escalation still proceeds.

- **What happens when OpenRouter API is down or rate-limited?**  
  System logs error, falls back to raw conversation history in email. Sales agent receives email with full context even if summary fails.

- **What happens when chat history exceeds token limit (>10k tokens)?**  
  System retrieves only messages from last hour (time-based filter). If last hour still exceeds token limit, system truncates oldest messages to fit within limit.

- **What happens when sales agent email is missing from customer record?**  
  System falls back to workspace admin email (existing contactOperator.ts behavior). Email always delivers.

- **What happens when Safety Translation Agent blocks entire summary?**  
  System sends email with notice "Content could not be translated due to safety concerns" and raw history. Sales agent can review original conversation in admin panel.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST create a new agent type called SUMMARY that generates concise summaries of conversation history
- **FR-002**: System MUST store Summary Agent configuration in agentConfigs table with fields: name, type (SUMMARY), systemPrompt, model, temperature, maxTokens, order (7), isActive, availableFunctions (empty array)
- **FR-003**: System MUST load Summary Agent system prompt from `docs/prompts/summary-agent.md` during database seed
- **FR-004**: Summary Agent MUST accept conversation history as input array and return text summary (NO calling functions - only text generation)
- **FR-005**: System MUST replace variables in summary prompt: {{conversationHistory}}, {{customerName}}, {{agentName}} before sending to LLM
- **FR-006**: System MUST integrate Summary Agent into email flow: retrieve history → Summary Agent → Safety Translation Agent → Email Service
- **FR-007**: System MUST modify contactSupport calling function in function-executor.service.ts to invoke contactOperator.ts instead of returning placeholder response
- **FR-008**: System MUST retrieve messages from last hour (createdAt >= NOW() - 1 hour) from ConversationMessages table filtered by customerId and workspaceId
- **FR-009**: System MUST pass Summary Agent output through Safety Translation Agent to sanitize and translate content
- **FR-010**: System MUST send final email using EmailService.sendOperatorNotificationEmail method with sales agent email address
- **FR-011**: System MUST log each step of email generation pipeline with clear markers (📧 for email, 🤖 for LLM)
- **FR-012**: Summary Agent prompt MUST limit variable usage to at most one occurrence of each large variable ({{conversationHistory}} appears once)
- **FR-013**: System MUST fallback to raw conversation history if Summary Agent fails (API error, timeout, empty response)
- **FR-014**: System MUST respect Summary Agent isActive flag: if false, skip summary generation and use raw history
- **FR-015**: System MUST allow administrators to edit Summary Agent configuration through existing Agent Settings UI

### Key Entities _(include if feature involves data)_

- **Agent (SUMMARY type)**: Represents LLM agent configuration for summarizing conversations. Attributes: name, type (SUMMARY enum value), systemPrompt (markdown content from file), model (e.g., "openai/gpt-4o-mini"), temperature (0.5 default), maxTokens (500 default), order (7), isActive (true), availableFunctions (empty array - Summary Agent only generates text, NO calling functions), workspaceId
- **ConversationMessage**: Represents individual messages in customer chat history. Attributes: id, customerId, workspaceId, role (customer/assistant), content (text), createdAt (timestamp). Used as input source for summary generation (filtered by last hour: createdAt >= NOW() - 1 hour)
- **EmailNotification**: Represents email sent to sales agent. Contains: recipient (sales agent email), subject, body (includes summary), chatSummary (LLM-generated or raw history), customerName, timestamp

### Assumptions

- Summary Agent will summarize messages from **last hour** (createdAt >= NOW() - INTERVAL '1 hour') instead of fixed message count
- Summary Agent **does NOT have calling functions** - it only receives conversation history array and returns text summary
- Email implementation follows pattern from working test script `npm test:smtp` (nodemailer with Gmail SMTP)
- Safety Translation Agent (order 6) already exists and handles language translation + content safety
- EmailService.sendOperatorNotificationEmail accepts direct email addresses (already modified in previous work)
- contactOperator.ts already loads sales agent email from customer.sales.email relationship
- customerLanguage variable is NOT needed (Safety Translation Agent determines target language from sales agent profile or workspace settings)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: When contactSupport calling function executes, sales agent MUST receive email within 30 seconds (measured from CF invocation to email delivery confirmation log)
- **SC-002**: Email summary MUST be under 250 words (approximately 1500 characters) for conversations with messages from last hour
- **SC-003**: Summary MUST include key conversation topics: product inquiries, cart operations, customer concerns from last hour (verified by human review of 10 test emails)
- **SC-004**: System MUST successfully generate summary and send email for 95% of escalations (5% failure rate acceptable for API timeouts, with fallback to raw history)
- **SC-005**: Summary Agent configuration changes (temperature, maxTokens) MUST affect next email within 1 minute (no caching delays)
- **SC-006**: Summary MUST pass through Safety Translation Agent and arrive in sales agent's language (Italian default) regardless of customer's original language
- **SC-007**: Email MUST deliver even if Summary Agent fails (fallback to raw history maintains 100% email delivery rate)
- **SC-008**: Logs MUST show complete email pipeline trace: contactSupport → contactOperator → Summary Agent → Safety Agent → EmailService → SMTP confirmation
