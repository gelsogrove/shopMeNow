# Test Scenarios Checklist

**Feature**: Summary LLM Agent for Email Generation  
**Spec File**: `specs/001-email-summary-llm/spec.md`  
**Date**: 2025-01-19

## Priority 1 (P1) - Email with Summary

### Happy Path Tests

- [ ] **Test 1.1**: Customer with 15 messages escalates → Email sent to sales agent with LLM-generated summary
  - **Given**: Mario Rossi has 15 messages in chat history
  - **When**: Customer writes "voglio parlare con un agente"
  - **Then**: Alessandro Romano receives email at andrea_gelsomino@hotmail.com with Italian summary
  - **Verify**: Email subject contains customer name, body has summary under 250 words

- [ ] **Test 1.2**: Customer conversation includes products + cart → Summary includes both topics
  - **Given**: Chat history has 5 product inquiries + 3 cart operations
  - **When**: Escalation triggered
  - **Then**: Summary mentions both product questions and cart actions chronologically
  - **Verify**: Email body contains keywords from product names and cart quantities

- [ ] **Test 1.3**: Customer uses profanity → Safety Translation sanitizes summary
  - **Given**: Chat history contains profane words ("cazzo", "merda")
  - **When**: Summary generated
  - **Then**: Safety Translation Agent removes/replaces profanity before email
  - **Verify**: Email body contains cleaned language, no profane words

- [ ] **Test 1.4**: Customer speaks Spanish, sales agent expects Italian → Summary translated
  - **Given**: Customer chat history in Spanish ("Hola, quiero comprar...")
  - **When**: Summary passes through Safety Translation Agent
  - **Then**: Email summary is in Italian (sales agent's language)
  - **Verify**: Email body contains Italian translation, not Spanish original

### Logs & Observability Tests

- [ ] **Test 1.5**: Complete pipeline logged with markers
  - **Given**: Escalation triggered
  - **When**: Email sent successfully
  - **Then**: Logs show: contactSupport CF → contactOperator → Summary Agent 🤖 → Safety Agent 🤖 → EmailService 📧 → SMTP confirmation 📧
  - **Verify**: All pipeline steps logged with clear markers, no missing steps

- [ ] **Test 1.6**: Email delivery confirmed with MessageID
  - **Given**: Email sent to andrea_gelsomino@hotmail.com
  - **When**: SMTP send completes
  - **Then**: Log shows `✅ [EmailService] Email sent, MessageID: <xxx>`
  - **Verify**: MessageID present in logs, matches Gmail's format

### Security & Isolation Tests

- [ ] **Test 1.7**: Email only sent to sales agent within same workspace
  - **Given**: Mario Rossi belongs to workspace A, Alessandro Romano to workspace A
  - **When**: Escalation triggered
  - **Then**: Email sent to Alessandro (workspace A sales agent), not random sales agent from workspace B
  - **Verify**: Workspace isolation maintained, no cross-workspace leakage

- [ ] **Test 1.8**: ConversationMessages query filtered by workspaceId
  - **Given**: Database has messages from multiple workspaces
  - **When**: Summary Agent retrieves chat history
  - **Then**: Only messages from customer's workspace retrieved
  - **Verify**: SQL query includes `WHERE workspaceId = ? AND customerId = ?`

---

## Priority 2 (P2) - Admin Configuration

### Happy Path Tests

- [ ] **Test 2.1**: Summary Agent appears in Agent Settings UI (order 7)
  - **Given**: Admin on Agent Settings page
  - **When**: Page loads agent list
  - **Then**: Summary Agent shown after Safety Translation Agent (order 6)
  - **Verify**: Agent name "Summary Agent", type SUMMARY, order 7

- [ ] **Test 2.2**: Admin reduces maxTokens → shorter summary
  - **Given**: Summary Agent maxTokens = 500 (default)
  - **When**: Admin changes maxTokens to 300, saves, triggers escalation
  - **Then**: Email summary is ~150 words (vs ~250 words at 500 tokens)
  - **Verify**: Word count reduced, summary still coherent

- [ ] **Test 2.3**: Admin disables Summary Agent → raw history sent
  - **Given**: Summary Agent isActive = false
  - **When**: Escalation triggered
  - **Then**: Email contains raw conversation history (not LLM summary)
  - **Verify**: Email body shows message-by-message history, no summarization

- [ ] **Test 2.4**: Admin changes model → different summary style
  - **Given**: Summary Agent model = "openai/gpt-4o-mini"
  - **When**: Admin changes to "openai/gpt-4o", saves, triggers escalation
  - **Then**: Summary quality/style differs (GPT-4o more detailed)
  - **Verify**: API logs show call to gpt-4o model, not gpt-4o-mini

### Configuration Persistence Tests

- [ ] **Test 2.5**: Agent config changes persist across server restarts
  - **Given**: Admin changes Summary Agent temperature to 0.3, saves
  - **When**: Backend server restarted, escalation triggered
  - **Then**: Summary uses temperature 0.3 (from database)
  - **Verify**: Database agentConfigs table shows temperature = 0.3

- [ ] **Test 2.6**: Agent config changes affect next email within 1 minute
  - **Given**: Summary Agent temperature = 0.7
  - **When**: Admin changes to 0.3, waits 30 seconds, triggers escalation
  - **Then**: Email summary reflects new temperature (more deterministic)
  - **Verify**: No caching delay, config read fresh from database

---

## Priority 3 (P3) - Edge Cases

### Minimal History Tests

- [ ] **Test 3.1**: Customer has only 1 message → raw message sent (no summary)
  - **Given**: Chat history has 1 message: "Ciao"
  - **When**: Escalation triggered
  - **Then**: Email contains "Ciao" without LLM summary (fallback)
  - **Verify**: Email body shows single message, log indicates "insufficient history for summary"

- [ ] **Test 3.2**: Customer has 0 messages → notice sent
  - **Given**: Chat history empty (session just created)
  - **When**: Escalation triggered
  - **Then**: Email contains "No conversation history available"
  - **Verify**: Email delivered successfully with notice message

### Large History Tests

- [ ] **Test 3.3**: Customer has 200 messages → only last 20 summarized
  - **Given**: Chat history has 200 messages
  - **When**: Summary Agent retrieves history
  - **Then**: Only last 20 messages passed to LLM (query LIMIT 20)
  - **Verify**: Summary references recent topics, ignores old messages

- [ ] **Test 3.4**: Chat history exceeds 10k tokens → truncation prevents API error
  - **Given**: Last 20 messages total 12k tokens
  - **When**: Summary Agent processes
  - **Then**: System truncates to fit token limit, summary still generated
  - **Verify**: No OpenRouter API error, summary coherent despite truncation

### API Failure Tests

- [ ] **Test 3.5**: OpenRouter API timeout → fallback to raw history
  - **Given**: OpenRouter API responds slowly (>30 seconds)
  - **When**: Summary Agent times out
  - **Then**: Email sent with raw conversation history + error notice
  - **Verify**: Log shows timeout error, fallback triggered, email delivered

- [ ] **Test 3.6**: OpenRouter API returns error → fallback to raw history
  - **Given**: OpenRouter API returns 500 error
  - **When**: Summary Agent fails
  - **Then**: Email sent with raw history + error notice
  - **Verify**: Log shows API error, fallback triggered, email delivered

### Missing Data Tests

- [ ] **Test 3.7**: Customer has no name → phone number used in email
  - **Given**: Customer record has phone "+39 333 123 4567" but name is NULL
  - **When**: Email generated
  - **Then**: Email subject/body uses phone number as identifier
  - **Verify**: Email says "Customer +39 333 123 4567" instead of name

- [ ] **Test 3.8**: Sales agent email missing → fallback to workspace admin
  - **Given**: Customer's sales agent has NULL email
  - **When**: Email send attempted
  - **Then**: contactOperator.ts falls back to workspace admin email
  - **Verify**: Email sent to admin, log shows fallback reason

### Safety Translation Tests

- [ ] **Test 3.9**: Safety Translation blocks entire summary → notice sent
  - **Given**: Summary contains only blocked content (hate speech)
  - **When**: Safety Translation Agent processes
  - **Then**: Email contains "Content could not be translated due to safety concerns" + raw history
  - **Verify**: Email delivered with notice, sales agent can review original in admin panel

- [ ] **Test 3.10**: Safety Translation partial block → sanitized summary sent
  - **Given**: Summary contains some unsafe content
  - **When**: Safety Translation Agent sanitizes
  - **Then**: Email contains cleaned summary (unsafe parts removed)
  - **Verify**: Email coherent, no unsafe content, key topics preserved

---

## Integration Tests

### End-to-End Flow

- [ ] **Test INT-1**: Complete escalation flow from customer message to email delivery
  - **Steps**:
    1. Customer sends 15 messages (product questions, cart operations)
    2. Customer writes "vorrei parlare con un agente"
    3. contactSupport CF triggers
    4. contactOperator.ts disables chatbot
    5. contactOperator.ts retrieves last 15 messages
    6. Summary Agent generates summary
    7. Safety Translation Agent translates + sanitizes
    8. EmailService sends via SMTP
    9. Sales agent receives email
  - **Verify**: Complete trace in logs, email delivered within 30 seconds, summary under 250 words

- [ ] **Test INT-2**: Configuration change affects live escalation
  - **Steps**:
    1. Admin changes Summary Agent temperature to 0.2
    2. Customer triggers escalation within 30 seconds
    3. Summary generated with new temperature
  - **Verify**: Email summary more deterministic (less creative), config change immediate

- [ ] **Test INT-3**: Multiple concurrent escalations maintain isolation
  - **Steps**:
    1. Customer A (workspace 1) escalates
    2. Customer B (workspace 2) escalates simultaneously
    3. Both summaries generated and emailed
  - **Verify**: No cross-workspace leakage, each email goes to correct sales agent, chat histories isolated

---

## Performance Tests

- [ ] **Test PERF-1**: Email delivery within 30 seconds for 95% of escalations
  - **Method**: Trigger 100 escalations, measure time from contactSupport to email delivery log
  - **Success**: 95+ emails delivered within 30 seconds
  - **Verify**: Median time <10 seconds, 95th percentile <30 seconds

- [ ] **Test PERF-2**: Summary generation within 10 seconds for typical conversation
  - **Method**: Trigger 50 escalations with 10-15 messages each, measure Summary Agent API call time
  - **Success**: 90+ summaries generated within 10 seconds
  - **Verify**: Median time <5 seconds, 95th percentile <10 seconds

---

## Regression Tests

- [ ] **Test REG-1**: Existing contactSupport behavior preserved (chatbot disable)
  - **Given**: Customer escalates
  - **When**: contactSupport CF executes
  - **Then**: Chatbot disabled (isChatbotDisabled = true), customer sees notice
  - **Verify**: Chatbot disable functionality unaffected by email changes

- [ ] **Test REG-2**: Other calling functions unaffected
  - **Given**: Customer uses searchProducts, addToCart, etc.
  - **When**: Functions execute
  - **Then**: No email sent, no Summary Agent invoked
  - **Verify**: Only contactSupport triggers email flow

- [ ] **Test REG-3**: Safety Translation Agent still works for chat responses
  - **Given**: Customer asks question in Spanish
  - **When**: Response generated and translated
  - **Then**: Safety Translation Agent processes normally (not affected by Summary Agent)
  - **Verify**: Chat translations still work, Summary Agent only used in email flow

---

## Manual Validation Tests (for human review)

- [ ] **Test MAN-1**: Summary quality - human reviews 10 email summaries for coherence
  - **Method**: Generate 10 emails from real conversations, have Andrea review summaries
  - **Success**: 8+ summaries accurately capture conversation topics
  - **Verify**: No hallucinations, key details preserved, professional tone

- [ ] **Test MAN-2**: Summary completeness - human verifies critical info included
  - **Method**: Generate email from conversation about order issue (order #12345, damaged product)
  - **Success**: Summary mentions order number and issue reason
  - **Verify**: Sales agent has enough context to continue conversation

- [ ] **Test MAN-3**: Translation quality - human verifies Italian translation correct
  - **Method**: Generate summary from Spanish customer conversation, review Italian email
  - **Success**: Translation grammatically correct, meaning preserved
  - **Verify**: No translation errors, professional Italian

---

## Test Execution Summary

**Total Test Cases**: 40  
**P1 Tests (Critical)**: 8  
**P2 Tests (Important)**: 6  
**P3 Tests (Edge Cases)**: 10  
**Integration Tests**: 3  
**Performance Tests**: 2  
**Regression Tests**: 3  
**Manual Validation**: 3  

**Coverage**:
- ✅ Happy path: Complete (Tests 1.1-1.4, 2.1-2.4)
- ✅ Edge cases: Complete (Tests 3.1-3.10)
- ✅ Security: Complete (Tests 1.7-1.8)
- ✅ Performance: Complete (Tests PERF-1, PERF-2)
- ✅ Regression: Complete (Tests REG-1, REG-2, REG-3)
- ✅ Observability: Complete (Tests 1.5-1.6)
- ✅ Configuration: Complete (Tests 2.5-2.6)
- ✅ API failures: Complete (Tests 3.5-3.6)
- ✅ Concurrency: Complete (Test INT-3)
- ✅ Data validation: Complete (Tests 3.7-3.8)

**Recommended Test Execution Order**:
1. **Phase 1 - Core Functionality**: Run P1 tests (1.1-1.8) to validate basic email flow
2. **Phase 2 - Configuration**: Run P2 tests (2.1-2.6) to validate admin controls
3. **Phase 3 - Robustness**: Run P3 tests (3.1-3.10) to validate fallback behaviors
4. **Phase 4 - Integration**: Run INT tests (INT-1 to INT-3) to validate end-to-end
5. **Phase 5 - Performance**: Run PERF tests to validate speed requirements
6. **Phase 6 - Regression**: Run REG tests to ensure no existing functionality broken
7. **Phase 7 - Manual Review**: Run MAN tests for qualitative validation

**Success Criteria for Test Phase**:
- ✅ 95% of P1 tests pass (7/8 minimum)
- ✅ 100% of P2 tests pass (configuration must be reliable)
- ✅ 90% of P3 tests pass (fallbacks critical for 100% email delivery)
- ✅ 100% of integration tests pass
- ✅ Performance tests meet SLA (95% under 30 seconds)
- ✅ 100% of regression tests pass (no existing features broken)
- ✅ Manual validation confirms summary quality acceptable
