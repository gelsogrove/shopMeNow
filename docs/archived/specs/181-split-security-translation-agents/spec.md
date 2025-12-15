# Feature 181: Split Security and Translation Agents

**Status:** ✅ Completed  
**Date Created:** 2025-11-20  
**Epic:** Agent Architecture Refactoring  

---

## Overview

Currently, the "Safety & Translation Agent" combines two distinct concerns: security validation and language translation. This feature splits it into **two independent agents**:

1. **Translation Agent** - Handles multilingual translation only (configurable via UI)
2. **Security Agent** - Handles content safety validation only (**HARDCODED for safety**)

> ⚠️ **SECURITY DECISION**: Security Agent is **NOT editable** via UI. Its prompt is hardcoded in code to prevent security bypasses. Only developers can modify security rules.

---

## Functional Requirements

### 1. Split Current Agent
- Rename existing "Safety & Translation Agent" → "Translation Agent"
- Extract security rules/prompt into new "Security Agent"
- Translation Agent: configurable in agent_configs table and UI
- Security Agent: **HARDCODED** - not visible in UI, not updatable via database

### 2. Agent Configuration
- **Translation Agent**: 
  - Name: "Translation Agent"
  - Type: "translation"
  - Prompt: Translation rules only (language detection, multilingual output)
  - Model: Configurable (same as current)
  - **Editable: YES** via agent configuration UI
  
- **Security Agent**:
  - Name: "Security Agent"  
  - Type: "security"
  - Prompt: Safety/security rules only (harmful content detection, filtering)
  - Model: Fixed (gpt-4o-mini)
  - **Editable: NO** - hardcoded in `SecurityAgent.ts`

### 3. Message Flow Update
Current WhatsApp queue flow:
```
Message → Safety & Translation Agent → Save to History → Queue → Send
```

New flow:
```
Message → Security Agent → Translation Agent → Save to History → Queue → Send
```

Process:
1. First call **Security Agent** to validate message safety
2. Then call **Translation Agent** to translate if needed
3. Then save to history
4. Then enqueue for sending

### 4. UI & Editability
- Both agents appear in Agent Configuration page
- Full CRUD operations (add/edit/delete)
- Settings form with:
  - Name field
  - Type (read-only: "translation" or "security")
  - Prompt textarea (markdown support)
  - Model selection dropdown
  - Temperature/Top-P/Top-K sliders
  - Save/Cancel buttons

---

## Data Model

### Changes to `agent_configs` table
No schema changes needed - use existing structure:
- `name` → "Translation Agent" or "Security Agent"
- `agentType` → "translation" or "security"
- `prompt` → Language-specific (Italian default)
- `model` → LLM model name

### Existing Fields (Unchanged)
- `id`, `workspaceId`, `createdAt`, `updatedAt`
- `isActive`, `temperature`, `topP`, `topK`

---

## User Journeys

### Journey 1: Edit Agent Configuration
**Actor:** Admin  
**Goal:** Update Security Agent prompt to be more/less strict

1. Admin navigates to "Agent Configuration" page
2. Finds "Security Agent" in list
3. Clicks "Edit" or "Pencil" icon
4. Slide panel opens from right with form
5. Updates prompt textarea
6. Clicks "Save" → Confirms changes
7. Returns to list → Changes visible immediately

### Journey 2: Message Processing with Security Check
**Actor:** Customer sends WhatsApp message  
**Goal:** Message is validated for safety, translated, and queued

1. Customer sends WhatsApp message
2. Backend receives webhook
3. Calls **Security Agent LLM** to validate content
   - If unsafe: **BLOCK MESSAGE** ❌ - Save with deliveryStatus="blocked" + 🚫 icon, STOP processing
   - If safe: Continue
4. Calls **Translation Agent LLM** to translate if needed
5. Saves to conversationMessage with deliveryStatus="pending"
6. Enqueues to whatsapp_queue for sending

---

## Non-Functional Requirements

### Performance
- Security Agent call: <500ms (quick safety check)
- Translation Agent call: <1000ms (translation processing)
- Total message processing: <2000ms

### Security
- Security Agent cannot be disabled/bypassed
- Each message validated before queuing
- Failed security checks logged with details

### Observability
- Log Security Agent decision (safe/unsafe)
- Log Translation Agent decision (translation performed/skipped)
- Include timestamps for each stage

---

## Integration Points

### Backend Updates Required
1. **Services:**
   - Modify `ConversationManagerService` to call agents sequentially
   - Add `securityAgent` parameter before `translationAgent`

2. **Repositories:**
   - `AgentConfigRepository` - already supports querying by type

3. **Controllers:**
   - `AgentConfigurationController` - supports both agents
   - No changes needed (already generic)

4. **Routes:**
   - `/api/workspaces/{id}/agents` - already supports all agents

### Frontend Updates Required
1. **Pages:**
   - `AgentConfigurationPage` - already shows all agents

2. **Components:**
   - `AgentConfigSheet` - already handles any agent type

3. **Services:**
   - `agentApi` - already supports all agent CRUD

---

## Edge Cases & Error Handling

### Security Agent Fails
- Log error: "Security Agent failed to validate"
- Default: **BLOCK MESSAGE** (fail-safe) - Save with deliveryStatus="blocked"
- Display 🚫 block icon in chat history
- Do NOT enqueue

### Translation Agent Fails  
- Log error: "Translation Agent failed"
- Default: Skip translation, use original message
- Continue processing (non-critical)
- Message still enqueued normally

### Both Agents Called Twice
- Add deduplication: Check if message already validated
- Use lock per `customerId` + `messageId`

---

## Edge Cases NOT Included (Out of Scope)

- A/B testing different security/translation models
- Rollback mechanism for agent prompt changes
- Agent versioning history
- User-level agent customization

---

## Acceptance Criteria

### Definition of Done

✅ **Database**
- [ ] New "Security Agent" record created in seed data
- [ ] Existing "Safety & Translation Agent" renamed to "Translation Agent" in seed

✅ **Backend Services**
- [ ] Security Agent called BEFORE Translation Agent
- [ ] Sequential calling (not parallel) for predictable ordering
- [ ] Error handling for failed agents (fail-safe for security)
- [ ] Logging shows agent name, decision, timestamp

✅ **API Endpoints**
- [ ] GET /agents returns both Translation + Security agents
- [ ] PUT /agents/{id} updates either agent
- [ ] PATCH /agents/{id} patches prompt/settings

✅ **Frontend UI**
- [ ] Agent Configuration page shows both agents
- [ ] Edit form works for both agent types
- [ ] Prompts are independently editable
- [ ] Changes persist and are immediately active

✅ **Message Flow**
- [ ] WhatsApp queue messages go through Security → Translation
- [ ] Message history shows deliveryStatus correctly
- [ ] Queue page reflects the new flow

✅ **Testing**
- [ ] 5+ unit tests for agent sequencing
- [ ] Integration test: Security + Translation flow
- [ ] Security agent cannot be bypassed
- [ ] 165+ tests still PASS (no regressions)

✅ **Documentation**
- [ ] Prompt templates in `/docs/memory-bank/` updated
- [ ] Agent types documented in README
- [ ] Message flow diagram updated

---

### Clarifications

### Session 2025-11-20
- Q: What happens when Security Agent blocks a message? → A: **Block completely** - deliveryStatus="blocked", show 🚫 icon, do NOT enqueue, stop processing

---

## Implementation Notes

- **No database schema changes** - reuse existing agent_configs structure
- **Type field** already in schema via `agentType` column
- **Prompt templates** stored in database (already working)
- **Agent order** hardcoded in code for security > translation sequence
- **Seed data** needs 2 new records (was 1 combined record)

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Security Agent called multiple times | Medium | Add per-message deduplication lock |
| Translation Agent modifies security payload | Medium | Security Agent validates first, output is immutable |
| Agent configuration UI bugs | Low | Reuse existing working component |
| Performance impact of 2 LLM calls | Medium | Add caching for recent messages (future) |

---

## Success Metrics

- [ ] Both agents independently editable (test with admin UI)
- [ ] Security Agent called first, Translation Agent second (log verification)
- [ ] All 165+ existing tests pass
- [ ] New agent flow tested in integration tests
- [ ] Zero security regressions (same unsafe content blocked)

---

## Next Steps

1. Run `/speckit.clarify` if any ambiguities remain
2. Run `/speckit.plan` to generate detailed implementation tasks
3. Begin development following task breakdown
4. Run test suite validation
5. Merge to main via PR

